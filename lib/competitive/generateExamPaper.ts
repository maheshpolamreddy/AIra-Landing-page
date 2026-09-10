import { generateContentFallbackQuestions } from './examContentFallbacks';
import { buildExamGenerationContext, formatGenerationContextBlock } from './buildExamGenerationContext';
import { EXAM_GENERATION_VERSION } from './generationVersion';
import { getExamSourcePolicy, summarizeSourcePolicy } from './examSourcePolicy';
import { lockScienceDiscipline } from './subjectDiscipline';
import {
  assignDefaultMetadata,
  catalogHasSubjectMapping,
  type ValidatedQuestion,
} from './examSourceValidator';
import { questionsAreNearDuplicates, isValidExamQuestion } from './examQuestionQuality';
import { buildExamSlotPlan, formatSlotPlanTable } from './examSlotPlan';
import { finalizeExamPaper } from './finalizeExamPaper';
import { getDifficultyGenerationRule } from './examSyllabus';
import type { Question } from './types';

export interface GenerateExamParams {
  examId: string;
  examName: string;
  subjectId: string;
  subjectName: string;
  count: number;
  examYear: string;
  mode?: 'mock' | 'pyq';
  topicIds?: string[];
}

interface RawExamQuestion {
  text?: string;
  options?: string[];
  correctAnswer?: number;
  explanation?: string;
  topic?: string;
  topicId?: string;
  syllabusUnit?: string;
  sourceBasis?: 'NCERT' | 'INTERMEDIATE' | 'OFFICIAL_SYLLABUS';
  difficulty?: string;
  questionFormat?: string;
}

function extractExamMcqArray(response: string): RawExamQuestion[] | null {
  const trimmed = response.trim();
  if (trimmed === 'INSUFFICIENT_CONTENT') return null;
  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    return Array.isArray(parsed) ? (parsed as RawExamQuestion[]) : null;
  } catch {
    return null;
  }
}

function mapRawToQuestion(
  raw: RawExamQuestion,
  index: number,
  ctx: GenerateExamParams,
  slotIndex: number,
  slots: ReturnType<typeof buildExamSlotPlan>,
): ValidatedQuestion | null {
  if (!raw?.text || !Array.isArray(raw.options) || raw.options.length !== 4) return null;
  const slot = slots[slotIndex];
  const correctAnswer =
    typeof raw.correctAnswer === 'number' && raw.correctAnswer >= 0 && raw.correctAnswer <= 3
      ? raw.correctAnswer
      : 0;
  const base: Question = {
    id: `srv-${ctx.examId}-${ctx.subjectId}-${index}-${Date.now().toString(36)}`,
    text: String(raw.text).trim(),
    options: raw.options.map((o) => String(o).trim()),
    correctAnswer,
    explanation: String(raw.explanation ?? '').trim() || 'See syllabus concepts.',
    topic: String(raw.topic ?? raw.syllabusUnit ?? 'General').trim(),
    difficulty: (slot?.difficulty ??
      (['Easy', 'Medium', 'Hard'].includes(String(raw.difficulty)) ? raw.difficulty : 'Medium')) as Question['difficulty'],
    examYear: ctx.examYear,
    subjectId: ctx.subjectId,
    subjectName: ctx.subjectName,
    questionFormat: raw.questionFormat ?? slot?.format,
    topicId: raw.topicId ?? slot?.topicId,
    syllabusUnit: raw.syllabusUnit ?? slot?.syllabusUnit ?? raw.topic,
    sourceBasis: raw.sourceBasis,
  };
  if (!isValidExamQuestion(base)) return null;
  return assignDefaultMetadata(base, {
    examId: ctx.examId,
    subjectId: ctx.subjectId,
    defaultTopicId: raw.topicId ?? slot?.topicId,
    defaultSyllabusUnit: slot?.chapterTitle ?? raw.syllabusUnit,
    defaultSourceBasis: raw.sourceBasis,
  });
}

async function callGroq(prompt: string, temperature: number): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_EXAM_MODEL ?? 'openai/gpt-oss-20b',
      messages: [
        {
          role: 'system',
          content:
            'You generate original competitive exam MCQs. Output JSON array only unless content is insufficient — then output exactly: INSUFFICIENT_CONTENT',
        },
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? '';
}

function buildPrompt(
  ctx: ReturnType<typeof buildExamGenerationContext>,
  count: number,
  slots: ReturnType<typeof buildExamSlotPlan>,
): string {
  if (!ctx) return '';
  const slotTable = formatSlotPlanTable(slots);
  const difficultyHints = slots
    .map(
      (s) =>
        `Q${s.index + 1} (${s.difficulty}): ${getDifficultyGenerationRule(ctx.examId, ctx.subjectId, s.difficulty)}`,
    )
    .join('\n');
  const contextBlock = formatGenerationContextBlock(ctx, { slotTable });
  return `You are generating questions for a competitive examination.

Exam: ${ctx.examName} (${ctx.examId})
Subject: ${ctx.subjectName} (${ctx.subjectId}) — ONLY this subject.

${contextBlock}

DIFFICULTY GENERATION RULES PER SLOT:
${difficultyHints}

Generate EXACTLY ${count} original MCQs matching each slot's difficulty and format.
Do NOT use concepts from another subject.
Vary question openings; do not repeat stem skeletons.
Each wrong option must reflect a plausible student mistake.
Return correctAnswer as 0-3 for the option order YOU provide (options will be shuffled server-side).
If sufficient valid questions cannot be generated, return exactly: INSUFFICIENT_CONTENT

Required JSON array. Each object:
text, options[4], correctAnswer(0-3), explanation, topic, difficulty(Easy|Medium|Hard),
topicId, syllabusUnit, sourceBasis(NCERT|INTERMEDIATE|OFFICIAL_SYLLABUS), questionFormat`;
}

function generateFallback(params: GenerateExamParams, count: number, baseSeed: number): ValidatedQuestion[] {
  const scienceDiscipline =
    params.subjectId === 'sci' || params.subjectId === 'sat-sci'
      ? lockScienceDiscipline(`${params.examId}:${params.subjectId}:${params.examYear}`)
      : undefined;
  const slots = buildExamSlotPlan(params.examId, params.subjectId, count, baseSeed);
  const raw = generateContentFallbackQuestions({
    examId: params.examId,
    examName: params.examName,
    subjectId: params.subjectId,
    subjectName: params.subjectName,
    count,
    year: params.examYear,
    difficulties: slots.map((s) => s.difficulty),
    seed: baseSeed,
    scienceDiscipline,
  });
  return raw as ValidatedQuestion[];
}

export async function generateExamPaper(params: GenerateExamParams): Promise<{
  questions: ValidatedQuestion[];
  generationVersion: string;
  sourcePolicy: string;
  validationRejectedCount: number;
}> {
  if (!catalogHasSubjectMapping(params.examId, params.subjectId)) {
    throw Object.assign(new Error('No syllabus mapping'), { code: 'INSUFFICIENT_CONTENT' });
  }

  const genCtx = buildExamGenerationContext({
    examId: params.examId,
    examName: params.examName,
    subjectId: params.subjectId,
    subjectName: params.subjectName,
    topicIds: params.topicIds,
  });
  if (!genCtx) {
    throw Object.assign(new Error('Cannot build generation context'), { code: 'INSUFFICIENT_CONTENT' });
  }

  const policy = getExamSourcePolicy(params.examId);
  const baseSeed = Date.now();
  const slots = buildExamSlotPlan(params.examId, params.subjectId, params.count, baseSeed);
  const prompt = buildPrompt(genCtx, params.count, slots);
  const scienceDiscipline =
    params.subjectId === 'sci' || params.subjectId === 'sat-sci'
      ? lockScienceDiscipline(`${params.examId}:${params.subjectId}:${params.examYear}`)
      : undefined;

  let aggregated: ValidatedQuestion[] = [];
  let totalRejected = 0;
  const temperatures = [0.45, 0.55, 0.62];

  for (const temp of temperatures) {
    if (aggregated.length >= params.count) break;
    try {
      const response = await callGroq(prompt, temp);
      const arr = extractExamMcqArray(response);
      if (!arr?.length) continue;
      const mapped: ValidatedQuestion[] = [];
      for (let i = 0; i < arr.length && mapped.length < params.count; i++) {
        const q = mapRawToQuestion(arr[i], aggregated.length + mapped.length, params, mapped.length, slots);
        if (!q) continue;
        if (aggregated.concat(mapped).some((prev) => questionsAreNearDuplicates(prev, q))) continue;
        mapped.push(q);
      }
      aggregated = [...aggregated, ...mapped];
    } catch {
      /* try next temperature or fallback */
    }
  }

  if (aggregated.length < Math.ceil(params.count * 0.75)) {
    const need = params.count - aggregated.length;
    const fallback = generateFallback(params, need, baseSeed + 1);
    aggregated = [...aggregated, ...fallback];
  }

  const finalized = finalizeExamPaper(aggregated.slice(0, params.count), slots, {
    examId: params.examId,
    subjectId: params.subjectId,
    subjectName: params.subjectName,
    scienceDiscipline,
    paperSeed: `${params.examId}:${params.subjectId}:${baseSeed}`,
  });

  totalRejected +=
    finalized.rejected.subject +
    finalized.rejected.source +
    finalized.rejected.difficulty +
    finalized.rejected.options +
    finalized.rejected.duplicates;

  if (finalized.questions.length < Math.ceil(params.count * 0.75)) {
    const extra = generateFallback(params, params.count, baseSeed + 99);
    const retry = finalizeExamPaper(extra, slots, {
      examId: params.examId,
      subjectId: params.subjectId,
      subjectName: params.subjectName,
      scienceDiscipline,
      paperSeed: `${params.examId}:${params.subjectId}:retry`,
    });
    if (retry.questions.length >= Math.ceil(params.count * 0.75)) {
      return {
        questions: retry.questions.slice(0, params.count) as ValidatedQuestion[],
        generationVersion: EXAM_GENERATION_VERSION,
        sourcePolicy: policy ? summarizeSourcePolicy(policy) : '',
        validationRejectedCount: totalRejected + retry.rejected.subject,
      };
    }
    throw Object.assign(
      new Error('Not enough valid questions are available for the selected exam and subject.'),
      { code: 'INSUFFICIENT_CONTENT' },
    );
  }

  return {
    questions: finalized.questions.slice(0, params.count) as ValidatedQuestion[],
    generationVersion: EXAM_GENERATION_VERSION,
    sourcePolicy: policy ? summarizeSourcePolicy(policy) : '',
    validationRejectedCount: totalRejected,
  };
}
