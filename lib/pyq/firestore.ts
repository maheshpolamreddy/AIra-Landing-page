/**
 * Firestore helpers for JEE Advanced PYQ (landing / admin).
 * Answers stay server-side; student APIs must call stripAnswers().
 */
import { getAdminFirestore } from '@/lib/content/firestore'
import { loadPyqBank, type BankQuestion } from '@/lib/pyq/bank'

export const PYQ_COLLECTIONS = {
  documents: 'pyqDocuments',
  questions: 'pyqQuestions',
  examSessions: 'pyqExamSessions',
} as const

function db() {
  return getAdminFirestore()
}

export function toFirestoreQuestion(q: BankQuestion, status: string = 'VALIDATED') {
  return {
    id: q.id,
    exam: 'JEE_ADVANCED' as const,
    sourceType: 'PYQ' as const,
    year: q.year,
    paper: q.paper,
    paperSource: q.paperSource || 'CONTENT_VERIFIED',
    subject: q.subject,
    questionNumber: q.questionNumber,
    questionType: q.questionType,
    content: q.content,
    options: q.options,
    answer: q.answer,
    answerStatus: q.answerStatus,
    answerSource:
      q.answerSource ||
      (q.answerStatus === 'VERIFIED_FROM_SOURCE'
        ? 'OFFICIAL_PDF'
        : q.answerStatus === 'EXTERNAL_VERIFIED'
          ? 'EXTERNAL_VERIFIED'
          : q.answerStatus === 'AI_REVIEW_REQUIRED' || q.answerStatus === 'VERIFIED_BY_ADMIN'
            ? 'AI_DERIVED'
            : 'MISSING'),
    answerProvenance: q.answerProvenance || null,
    aiSolution: q.aiSolution || null,
    aiModel: q.aiModel || null,
    visualStatus: q.visualStatus || null,
    scoringEligible: q.scoringEligible !== false,
    source: {
      ...q.source,
      storagePrefix: `pyq/jee-advanced/${q.year}/paper-${q.paper}/q${String(q.questionNumber).padStart(2, '0')}`,
    },
    validation: {
      status,
      confidence: q.answerStatus === 'VERIFIED_FROM_SOURCE' ? 'HIGH' : 'MEDIUM',
      reviewedBy: null,
      reviewedAt: null,
      notes: null,
    },
    updatedAt: new Date().toISOString(),
  }
}

/** Upsert eligible bank questions into Firestore (admin/publish path). */
export async function publishBankToFirestore(opts?: {
  onlyVerified?: boolean
  markPublished?: boolean
}) {
  const onlyVerified = opts?.onlyVerified !== false
  const markPublished = opts?.markPublished === true
  const bank = loadPyqBank().filter((q) =>
    onlyVerified
      ? q.answerStatus === 'VERIFIED_FROM_SOURCE' || q.answerStatus === 'EXTERNAL_VERIFIED'
      : true,
  )

  const batchSize = 400
  let written = 0
  for (let i = 0; i < bank.length; i += batchSize) {
    const chunk = bank.slice(i, i + batchSize)
    const batch = db().batch()
    for (const q of chunk) {
      const status = markPublished ? 'PUBLISHED' : 'VALIDATED'
      const ref = db().collection(PYQ_COLLECTIONS.questions).doc(q.id)
      batch.set(ref, toFirestoreQuestion(q, status), { merge: true })
      written += 1
    }
    await batch.commit()
  }

  return { written, totalInBank: bank.length }
}

export async function listReviewQueue(limit = 100) {
  const snap = await db()
    .collection(PYQ_COLLECTIONS.questions)
    .where('validation.status', 'in', ['VALIDATION_REQUIRED', 'EXTRACTED', 'VALIDATED'])
    .limit(limit)
    .get()

  const fromFs = snap.docs.map((d) => d.data())

  // Fallback: bank JSON questions that need typing / subject review
  if (fromFs.length === 0) {
    const bank = loadPyqBank()
    return bank
      .filter(
        (q) =>
          q.answerStatus === 'ANSWER_REVIEW_REQUIRED' ||
          q.subject === 'SUBJECT_REVIEW_REQUIRED' ||
          q.questionType === 'UNKNOWN',
      )
      .slice(0, limit)
      .map((q) => toFirestoreQuestion(q, 'VALIDATION_REQUIRED'))
  }

  return fromFs
}

export async function updateQuestionAdmin(
  questionId: string,
  patch: {
    validationStatus?: string
    subject?: string
    questionType?: string
    notes?: string
    reviewedBy?: string
    answerStatus?: string
    answerSource?: string
    editedAnswer?: string
  },
) {
  const ref = db().collection(PYQ_COLLECTIONS.questions).doc(questionId)
  const snap = await ref.get()
  if (!snap.exists) {
    throw Object.assign(new Error('Question not found'), { code: 'NOT_FOUND' })
  }
  const prev = snap.data() || {}
  const validation = {
    ...(prev.validation || {}),
    status: patch.validationStatus || prev.validation?.status || 'VALIDATED',
    reviewedBy: patch.reviewedBy || prev.validation?.reviewedBy || null,
    reviewedAt: new Date().toISOString(),
    notes: patch.notes ?? prev.validation?.notes ?? null,
  }

  let answer = prev.answer
  if (patch.editedAnswer != null && patch.editedAnswer.trim()) {
    const raw = patch.editedAnswer.trim()
    if (/^[A-D](,[A-D])*$/i.test(raw)) {
      answer = {
        kind: 'OPTIONS',
        values: raw.split(',').map((x) => x.trim().toUpperCase()),
      }
    } else {
      answer = { kind: 'NUMERIC', value: raw }
    }
  }

  // Never upgrade AI_DERIVED → OFFICIAL_PDF
  let answerSource = patch.answerSource ?? prev.answerSource
  let answerStatus = patch.answerStatus ?? prev.answerStatus
  if (patch.answerStatus === 'VERIFIED_BY_ADMIN') {
    answerStatus = 'VERIFIED_BY_ADMIN'
    // Preserve AI provenance; if unmarked, treat as AI_DERIVED after admin verify
    if (prev.answerSource === 'AI_DERIVED' || prev.answerStatus === 'AI_REVIEW_REQUIRED') {
      answerSource = 'AI_DERIVED'
    } else if (prev.answerSource === 'EXTERNAL_VERIFIED') {
      answerSource = 'EXTERNAL_VERIFIED'
      answerStatus = 'EXTERNAL_VERIFIED'
    } else if (prev.answerSource === 'OFFICIAL_PDF') {
      answerSource = 'OFFICIAL_PDF'
      answerStatus = 'VERIFIED_FROM_SOURCE'
    } else {
      answerSource = answerSource || 'AI_DERIVED'
    }
  }

  await ref.set(
    {
      subject: patch.subject ?? prev.subject,
      questionType: patch.questionType ?? prev.questionType,
      answer,
      answerStatus,
      answerSource,
      validation,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
  return { id: questionId, validation, answerStatus, answerSource }
}

export async function listPublishedQuestions(filters?: {
  year?: number
  paper?: number
  subject?: string
  limit?: number
}) {
  let q: FirebaseFirestore.Query = db()
    .collection(PYQ_COLLECTIONS.questions)
    .where('validation.status', '==', 'PUBLISHED')

  if (filters?.year != null) q = q.where('year', '==', filters.year)
  if (filters?.paper != null) q = q.where('paper', '==', filters.paper)
  if (filters?.subject) q = q.where('subject', '==', filters.subject)

  const snap = await q.limit(filters?.limit ?? 200).get()
  return snap.docs.map((d) => d.data())
}
