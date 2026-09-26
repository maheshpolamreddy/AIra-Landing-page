import { NextResponse } from 'next/server'
import { listReviewQueue, publishBankToFirestore, updateQuestionAdmin } from '@/lib/pyq/firestore'
import { loadPyqBank } from '@/lib/pyq/bank'

export const runtime = 'nodejs'

/**
 * GET — review queue (Firestore, falls back to bank JSON needing review)
 * POST — actions: publish-bank | update
 *
 * Auth: production should verify admin Bearer token; local/dev allows when
 * PYQ_ADMIN_OPEN=1 or x-pyq-admin-key matches PYQ_ADMIN_KEY.
 */
function adminAllowed(req: Request): boolean {
  if (process.env.PYQ_ADMIN_OPEN === '1') return true
  const key = process.env.PYQ_ADMIN_KEY?.trim()
  if (key && req.headers.get('x-pyq-admin-key') === key) return true
  // Dev convenience on localhost
  const host = req.headers.get('host') || ''
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return true
  return false
}

export async function GET(req: Request) {
  if (!adminAllowed(req)) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(500, Number(searchParams.get('limit') || 100))
    const queue = await listReviewQueue(limit)
    const bank = loadPyqBank()
    return NextResponse.json({
      ok: true,
      queueCount: queue.length,
      bankEligible: bank.length,
      queue,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Review queue failed'
    // Soft-fail when Firebase admin credentials are missing — return bank-based queue
    if (/credential|FIREBASE_SERVICE_ACCOUNT|Could not load/i.test(message)) {
      const bank = loadPyqBank()
      const queue = bank
        .filter(
          (q) =>
            q.answerStatus !== 'VERIFIED_FROM_SOURCE' ||
            q.subject === 'SUBJECT_REVIEW_REQUIRED' ||
            q.questionType === 'UNKNOWN',
        )
        .slice(0, 100)
      return NextResponse.json({
        ok: true,
        queueCount: queue.length,
        bankEligible: bank.length,
        queue,
        warning: 'Firestore unavailable; showing local bank review candidates',
      })
    }
    return NextResponse.json({ error: message, code: 'PYQ_ADMIN_FAILED' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!adminAllowed(req)) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    const body = (await req.json()) as {
      action?: string
      questionId?: string
      validationStatus?: string
      subject?: string
      questionType?: string
      notes?: string
      reviewedBy?: string
      markPublished?: boolean
      editedAnswer?: string
    }

    if (body.action === 'publish-bank') {
      try {
        const result = await publishBankToFirestore({
          onlyVerified: true,
          markPublished: body.markPublished === true,
        })
        return NextResponse.json({ ok: true, ...result })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Publish failed'
        return NextResponse.json(
          { error: message, code: 'FIRESTORE_UNAVAILABLE', hint: 'Set FIREBASE_SERVICE_ACCOUNT_JSON' },
          { status: 503 },
        )
      }
    }

    if (
      (body.action === 'update' ||
        body.action === 'verify-answer' ||
        body.action === 'keep-review') &&
      body.questionId
    ) {
      try {
        const isVerify = body.action === 'verify-answer'
        const isKeep = body.action === 'keep-review'
        const result = await updateQuestionAdmin(body.questionId, {
          validationStatus: isKeep
            ? 'VALIDATION_REQUIRED'
            : isVerify
              ? 'VALIDATED'
              : body.validationStatus,
          subject: body.subject,
          questionType: body.questionType,
          notes: body.notes,
          reviewedBy: body.reviewedBy,
          editedAnswer: body.editedAnswer,
          answerStatus: isVerify ? 'VERIFIED_BY_ADMIN' : undefined,
        })
        return NextResponse.json({ ok: true, ...result })
      } catch (err) {
        const code = (err as { code?: string }).code || 'UPDATE_FAILED'
        const message = err instanceof Error ? err.message : 'Update failed'
        const status = code === 'NOT_FOUND' ? 404 : 500
        return NextResponse.json({ error: message, code }, { status })
      }
    }

    if (body.action === 'approve' && body.questionId) {
      const result = await updateQuestionAdmin(body.questionId, {
        validationStatus: 'PUBLISHED',
        reviewedBy: body.reviewedBy || 'admin',
        notes: body.notes,
        subject: body.subject,
        questionType: body.questionType,
        editedAnswer: body.editedAnswer,
      })
      return NextResponse.json({ ok: true, ...result })
    }

    if (body.action === 'reject' && body.questionId) {
      const result = await updateQuestionAdmin(body.questionId, {
        validationStatus: 'REJECTED',
        reviewedBy: body.reviewedBy || 'admin',
        notes: body.notes,
      })
      return NextResponse.json({ ok: true, ...result })
    }

    return NextResponse.json({ error: 'Unknown action', code: 'INVALID' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Admin action failed'
    return NextResponse.json({ error: message, code: 'PYQ_ADMIN_FAILED' }, { status: 500 })
  }
}
