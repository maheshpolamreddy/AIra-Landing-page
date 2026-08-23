import { NextRequest, NextResponse, after } from 'next/server'

import { randomUUID } from 'node:crypto'

import { requireAuth, bridgeOk } from '@/lib/content/auth'

import { createImportStagingDoc } from '@/lib/content/importStaging'

import type { CurriculumTopicDoc, TeachingStepDoc, SupportedLanguage, TeachingStyle } from '@/lib/content/types'



export const runtime = 'nodejs'

export const dynamic = 'force-dynamic'



const IMPORT_WORKER_RUN_URL =

  process.env.CONTENT_IMPORT_WORKER_RUN_URL || 'http://127.0.0.1:3001/run-import'



export async function POST(req: NextRequest) {

  const bridge = req.headers.get('x-aira-content-bridge')

  if (!bridgeOk(bridge)) {

    const auth = await requireAuth(req, true)

    if (!auth.ok) {

      return NextResponse.json({ error: auth.error }, { status: auth.status })

    }

  }



  let body: Record<string, unknown>

  try {

    body = await req.json()

  } catch {

    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  }



  const topic = body.topic as CurriculumTopicDoc | undefined

  const steps = body.steps as TeachingStepDoc[] | undefined

  const teachingStyle = ((body.teachingStyle as string) || 'professional') as TeachingStyle

  const language = ((body.language as string) || 'en-IN') as SupportedLanguage

  const contentVersion = typeof body.contentVersion === 'number' ? body.contentVersion : 1



  if (!topic?.topicId || !steps?.length) {

    return NextResponse.json({ error: 'topic and steps required' }, { status: 400 })

  }



  const importJobId = randomUUID()

  await createImportStagingDoc(importJobId, { topic, steps, teachingStyle, language, contentVersion })



  after(async () => {

    try {

      await fetch(IMPORT_WORKER_RUN_URL, {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ importJobId }),

        signal: AbortSignal.timeout(600_000),

      })

    } catch (err) {

      console.error('[import-curated] worker dispatch failed:', err)

    }

  })



  return NextResponse.json({

    ok: true,

    queued: true,

    importJobId,

    topicId: topic.topicId,

    teachingStyle,

    language,

    contentVersion,

  })

}

