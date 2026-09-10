import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateExamSubject, COMPETITIVE_EXAM_CATALOG } from '@/lib/competitive/catalog'
import { generateExamPaper } from '@/lib/competitive/generateExamPaper'
import { EXAM_GENERATION_VERSION } from '@/lib/competitive/generationVersion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const bodySchema = z.object({
  examId: z.string().min(1),
  subjectId: z.string().min(1),
  examName: z.string().optional(),
  subjectName: z.string().optional(),
  count: z.number().int().min(1).max(120),
  examYear: z.string().optional(),
  mode: z.enum(['mock', 'pyq']).optional(),
  topicIds: z.array(z.string()).optional(),
  generationVersion: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Invalid exam generation parameters.' },
        { status: 400 },
      )
    }

    const { examId, subjectId, count, examYear, mode, topicIds } = parsed.data

    if (!validateExamSubject(examId, subjectId)) {
      return NextResponse.json(
        { error: 'invalid_exam_subject', message: 'Unknown exam or subject.' },
        { status: 400 },
      )
    }

    const catalog = COMPETITIVE_EXAM_CATALOG[examId]
    const examName = parsed.data.examName ?? catalog.name
    const subjectName = parsed.data.subjectName ?? catalog.subjects[subjectId]

    const result = await generateExamPaper({
      examId,
      examName,
      subjectId,
      subjectName,
      count,
      examYear: examYear ?? new Date().getFullYear().toString(),
      mode: mode ?? 'mock',
      topicIds,
    })

    return NextResponse.json({
      questions: result.questions,
      generationVersion: result.generationVersion ?? EXAM_GENERATION_VERSION,
      sourcePolicy: result.sourcePolicy,
      validationRejectedCount: result.validationRejectedCount,
    })
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err && typeof (err as { code: string }).code === 'string'
        ? (err as { code: string }).code
        : 'generation_failed'
    const message =
      err instanceof Error
        ? err.message
        : 'Unable to generate a subject-specific exam from the selected content.'
    console.warn('[competitive/generate-exam]', code)
    return NextResponse.json(
      {
        error: code,
        message,
      },
      { status: code === 'INSUFFICIENT_CONTENT' ? 422 : 500 },
    )
  }
}
