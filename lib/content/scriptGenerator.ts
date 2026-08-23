import type { CurriculumTopicDoc, TeachingStepDoc, TeachingStyle, SupportedLanguage, TeachingSegmentDoc } from './types'
import { buildScriptSystemPrompt } from './stylePrompts'
import { validateSpeakableScript, validateLanguageScript } from './validation'
import { GREETING_TEMPLATES } from './constants'
import {
  parseXmlSegments,
  buildSegmentsFromXml,
  buildSegmentsFromSpokenWithVisuals,
  buildVisualRegistrySnapshot,
  rebuildSpokenContentFromSegments,
} from './visualTimelineBuilder'

export interface GeneratedScriptResult {
  steps: TeachingStepDoc[]
  segments: TeachingSegmentDoc[]
  greetingTemplate: string
  visualRegistry: ReturnType<typeof buildVisualRegistrySnapshot>
}

async function callGroq(prompt: string, system: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not configured')

  const models = ['openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'groq/compound']
  let lastErr = ''

  for (const model of models) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 8000,
      }),
    })
    if (res.ok) {
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const text = json.choices?.[0]?.message?.content?.trim()
      if (text) return text
    }
    lastErr = await res.text().catch(() => res.statusText)
  }
  throw new Error(`Groq script generation failed: ${lastErr}`)
}

function buildUserPrompt(topic: CurriculumTopicDoc, diagramKeys: string[]): string {
  const markerList =
    diagramKeys.length > 0
      ? diagramKeys.map((k) => `  * ${k}`).join('\n')
      : '  (No diagram keys available)'

  return `Generate a complete spoken teaching script for:

Topic: ${topic.topicName}
Subject: ${topic.subjectName || topic.subjectId}
Grade: ${topic.gradeName || topic.gradeId}
Chapter: ${topic.chapterName || topic.chapterId}
Difficulty: ${topic.difficulty || 'intermediate'}
Description: ${topic.description || 'N/A'}

CRITICAL: Every important explanation MUST reference the exact board visual to highlight.
Use ONLY these highlightTarget registry keys:
${markerList}

Output format — use these XML tags (no markdown fences):

<SEGMENTS>
<SEGMENT visualMarker="semantic-id" highlightTarget="concept.diagram.part" visualAction="highlight">
Speakable narration for this segment. Topic-specific, grade-appropriate. 2-4 sentences minimum.
</SEGMENT>
(repeat for each teaching moment — minimum 8 segments covering intro, concepts, examples, recap)
</SEGMENTS>

<BOARD_CONTENT>
Markdown for the teaching board (headings/bullets allowed here only).
</BOARD_CONTENT>

<KEY_CONCEPTS>
Comma-separated list of 5-8 key concepts
</KEY_CONCEPTS>`
}

function parseGeneratedResponse(raw: string): {
  segmentsXml: string
  board: string
  keyConcepts: string[]
} {
  const segmentsMatch = raw.match(/<SEGMENTS>([\s\S]*?)<\/SEGMENTS>/i)
  const boardMatch = raw.match(/<BOARD_CONTENT>([\s\S]*?)<\/BOARD_CONTENT>/i)
  const conceptsMatch = raw.match(/<KEY_CONCEPTS>([\s\S]*?)<\/KEY_CONCEPTS>/i)

  return {
    segmentsXml: segmentsMatch?.[1]?.trim() || raw,
    board: boardMatch?.[1]?.trim() || '## Lesson content',
    keyConcepts:
      conceptsMatch?.[1]
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean) || [],
  }
}

export async function generateTeachingScript(
  topic: CurriculumTopicDoc,
  style: TeachingStyle,
  language: SupportedLanguage,
): Promise<GeneratedScriptResult> {
  const system = buildScriptSystemPrompt(style, language)
  const prompt = buildUserPrompt(topic, topic.diagramKeys || [])
  const raw = await callGroq(prompt, system)
  const { segmentsXml, board, keyConcepts } = parseGeneratedResponse(raw)

  const stepId = `${topic.topicId}-${style}-masterclass`
  const stepBase: TeachingStepDoc = {
    id: stepId,
    stepNumber: 1,
    title: `${topic.topicName} — ${style.charAt(0).toUpperCase()}${style.slice(1)} Lesson`,
    content: board,
    spokenContent: '',
    visualType: 'diagram',
    visualId: topic.topicId,
    durationSeconds: 600,
    keyConcepts,
  }

  let segments: TeachingSegmentDoc[] = []
  const xmlSegments = parseXmlSegments(segmentsXml)

  if (xmlSegments.length > 0) {
    segments = buildSegmentsFromXml(xmlSegments, stepBase, topic, language)
  } else {
    stepBase.spokenContent = segmentsXml
    segments = buildSegmentsFromSpokenWithVisuals(stepBase, topic, language)
  }

  stepBase.spokenContent = rebuildSpokenContentFromSegments(segments)
  stepBase.durationSeconds = Math.max(600, Math.round(stepBase.spokenContent.split(/\s+/).length / 2.2))

  const speakCheck = validateSpeakableScript(stepBase.spokenContent)
  if (!speakCheck.passed) {
    throw new Error(`Script validation failed: ${speakCheck.errors.join('; ')}`)
  }

  const langCheck = validateLanguageScript(
    stepBase.spokenContent.replace(/\[VISUAL:[^\]]+\]/g, ''),
    language,
  )
  if (!langCheck.passed) {
    throw new Error(`Language validation failed: ${langCheck.errors.join('; ')}`)
  }

  return {
    steps: [stepBase],
    segments,
    greetingTemplate: GREETING_TEMPLATES[style][language],
    visualRegistry: buildVisualRegistrySnapshot(topic),
  }
}

export async function generateTeachingScriptWithRetry(
  topic: CurriculumTopicDoc,
  style: TeachingStyle,
  language: SupportedLanguage,
  maxRetries = 2,
): Promise<GeneratedScriptResult> {
  let lastError: Error | null = null
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await generateTeachingScript(topic, style, language)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[scriptGenerator] Attempt ${i + 1} failed:`, lastError.message)
    }
  }
  throw lastError || new Error('Script generation failed')
}
