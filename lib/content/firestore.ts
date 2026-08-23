import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { readFileSync } from 'node:fs'
import type { ServiceAccount } from 'firebase-admin/app'
import type {
  ContentGenerationJobDoc,
  ContentStatus,
  CurriculumTopicDoc,
  TeachingContentDoc,
  TeachingSegmentDoc,
  SupportedLanguage,
  TeachingStyle,
} from './types'
import { buildCacheKey, buildContentDocId } from './cacheKeys'
import {
  CONTENT_COLLECTION,
  TOPICS_COLLECTION,
  JOBS_COLLECTION,
  SEGMENTS_SUBCOLLECTION,
  GENERATION_LOCK_TTL_MS,
} from './constants'

const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || 'aira-landingpage'

function loadServiceAccount(): ServiceAccount | undefined {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (inline) {
    let value = inline.trim()
    const start = value.indexOf('{')
    const end = value.lastIndexOf('}')
    if (start >= 0 && end > start) value = value.slice(start, end + 1)
    return JSON.parse(value) as ServiceAccount
  }
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (path) return JSON.parse(readFileSync(path, 'utf8')) as ServiceAccount
  return undefined
}

function getAdminApp() {
  const existing = getApps()[0]
  if (existing) return existing
  const credentials = loadServiceAccount()
  if (credentials) {
    return initializeApp({
      credential: cert(credentials),
      projectId: PROJECT_ID,
      storageBucket: `${PROJECT_ID}.firebasestorage.app`,
    })
  }
  return initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
    storageBucket: `${PROJECT_ID}.firebasestorage.app`,
  })
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getAdminApp())
}

export function getAdminStorage() {
  return getStorage(getAdminApp())
}

export async function getCurriculumTopic(topicId: string): Promise<CurriculumTopicDoc | null> {
  const snap = await getAdminFirestore().collection(TOPICS_COLLECTION).doc(topicId).get()
  if (!snap.exists) return null
  return snap.data() as CurriculumTopicDoc
}

export async function upsertCurriculumTopic(topic: CurriculumTopicDoc): Promise<void> {
  await getAdminFirestore().collection(TOPICS_COLLECTION).doc(topic.topicId).set(topic, { merge: true })
}

export async function getTeachingContent(
  topicId: string,
  language: SupportedLanguage,
  style: TeachingStyle,
  contentVersion: number,
): Promise<TeachingContentDoc | null> {
  const docId = buildContentDocId(topicId, language, style, contentVersion)
  const snap = await getAdminFirestore().collection(CONTENT_COLLECTION).doc(docId).get()
  if (!snap.exists) return null
  return snap.data() as TeachingContentDoc
}

export async function getTeachingSegments(
  topicId: string,
  language: SupportedLanguage,
  style: TeachingStyle,
  contentVersion: number,
): Promise<TeachingSegmentDoc[]> {
  const docId = buildContentDocId(topicId, language, style, contentVersion)
  const snap = await getAdminFirestore()
    .collection(CONTENT_COLLECTION)
    .doc(docId)
    .collection(SEGMENTS_SUBCOLLECTION)
    .orderBy('sequence', 'asc')
    .get()
  return snap.docs.map((d) => d.data() as TeachingSegmentDoc)
}

/** Fetch a single segment — avoids loading the full bundle during per-segment TTS. */
export async function getTeachingSegmentById(
  topicId: string,
  language: SupportedLanguage,
  style: TeachingStyle,
  contentVersion: number,
  segmentId: string,
): Promise<TeachingSegmentDoc | null> {
  const docId = buildContentDocId(topicId, language, style, contentVersion)
  const snap = await getAdminFirestore()
    .collection(CONTENT_COLLECTION)
    .doc(docId)
    .collection(SEGMENTS_SUBCOLLECTION)
    .doc(segmentId)
    .get()
  if (!snap.exists) return null
  return snap.data() as TeachingSegmentDoc
}

/** Lightweight audio readiness probe — avoids loading full segment narration blobs during publish. */
export async function getSegmentAudioReadiness(
  topicId: string,
  language: SupportedLanguage,
  style: TeachingStyle,
  contentVersion: number,
): Promise<{ narrationCount: number; readyCount: number; allReady: boolean }> {
  const docId = buildContentDocId(topicId, language, style, contentVersion)
  const snap = await getAdminFirestore()
    .collection(CONTENT_COLLECTION)
    .doc(docId)
    .collection(SEGMENTS_SUBCOLLECTION)
    .select('status', 'narration', 'audioUrl', 'audioStoragePath')
    .get()

  let narrationCount = 0
  let readyCount = 0
  for (const doc of snap.docs) {
    const d = doc.data()
    if (!d.narration?.trim()) continue
    narrationCount++
    if (d.status === 'READY' && (d.audioUrl || d.audioStoragePath)) readyCount++
  }
  return {
    narrationCount,
    readyCount,
    allReady: narrationCount > 0 && readyCount === narrationCount,
  }
}

export async function upsertTeachingContent(
  topicId: string,
  language: SupportedLanguage,
  style: TeachingStyle,
  contentVersion: number,
  data: Partial<TeachingContentDoc>,
): Promise<string> {
  const docId = buildContentDocId(topicId, language, style, contentVersion)
  const cacheKey = buildCacheKey(topicId, language, style, contentVersion)
  await getAdminFirestore()
    .collection(CONTENT_COLLECTION)
    .doc(docId)
    .set(
      {
        topicId,
        language,
        teachingStyle: style,
        contentVersion,
        cacheKey,
        ...data,
      },
      { merge: true },
    )
  return docId
}

export async function upsertTeachingSegment(
  contentDocId: string,
  segment: TeachingSegmentDoc,
): Promise<void> {
  await getAdminFirestore()
    .collection(CONTENT_COLLECTION)
    .doc(contentDocId)
    .collection(SEGMENTS_SUBCOLLECTION)
    .doc(segment.segmentId)
    .set(segment, { merge: true })
}

/** Batch-write segments — respects Firestore 500-op limit per commit. */
export async function batchUpsertTeachingSegments(
  contentDocId: string,
  segments: TeachingSegmentDoc[],
): Promise<void> {
  if (!segments.length) return
  const db = getAdminFirestore()
  const BATCH_LIMIT = 450
  for (let i = 0; i < segments.length; i += BATCH_LIMIT) {
    const chunk = segments.slice(i, i + BATCH_LIMIT)
    const batch = db.batch()
    for (const segment of chunk) {
      const ref = db
        .collection(CONTENT_COLLECTION)
        .doc(contentDocId)
        .collection(SEGMENTS_SUBCOLLECTION)
        .doc(segment.segmentId)
      batch.set(ref, segment, { merge: true })
    }
    await batch.commit()
  }
}

export async function acquireGenerationLock(
  topicId: string,
  language: SupportedLanguage,
  style: TeachingStyle,
  contentVersion: number,
  jobId: string,
): Promise<boolean> {
  const docId = buildContentDocId(topicId, language, style, contentVersion)
  const ref = getAdminFirestore().collection(CONTENT_COLLECTION).doc(docId)
  const now = Date.now()

  return getAdminFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const data = snap.data() as TeachingContentDoc | undefined
    if (data?.status === 'READY') return false
    const lock = data?.generationLock
    if (lock && new Date(lock.expiresAt).getTime() > now) return false
    tx.set(
      ref,
      {
        topicId,
        language,
        teachingStyle: style,
        contentVersion,
        cacheKey: buildCacheKey(topicId, language, style, contentVersion),
        status: 'GENERATING_SCRIPT' as ContentStatus,
        generationLock: {
          jobId,
          lockedAt: new Date().toISOString(),
          expiresAt: new Date(now + GENERATION_LOCK_TTL_MS).toISOString(),
        },
      },
      { merge: true },
    )
    return true
  })
}

export async function extendGenerationLock(contentDocId: string, jobId: string): Promise<void> {
  const now = Date.now()
  await getAdminFirestore()
    .collection(CONTENT_COLLECTION)
    .doc(contentDocId)
    .set(
      {
        generationLock: {
          jobId,
          lockedAt: new Date().toISOString(),
          expiresAt: new Date(now + GENERATION_LOCK_TTL_MS).toISOString(),
        },
      },
      { merge: true },
    )
}

export async function releaseGenerationLock(
  contentDocId: string,
  status: ContentStatus,
  extra?: Partial<TeachingContentDoc>,
): Promise<void> {
  await getAdminFirestore()
    .collection(CONTENT_COLLECTION)
    .doc(contentDocId)
    .set(
      {
        status,
        generationLock: FieldValue.delete(),
        ...extra,
      },
      { merge: true },
    )
}

export async function createGenerationJob(job: ContentGenerationJobDoc): Promise<string> {
  const ref = getAdminFirestore().collection(JOBS_COLLECTION).doc()
  await ref.set(job)
  return ref.id
}

export async function updateGenerationJob(
  jobId: string,
  patch: Partial<ContentGenerationJobDoc>,
): Promise<void> {
  await getAdminFirestore().collection(JOBS_COLLECTION).doc(jobId).set(patch, { merge: true })
}

export async function listContentStatusForTopic(topicId: string): Promise<TeachingContentDoc[]> {
  const snap = await getAdminFirestore()
    .collection(CONTENT_COLLECTION)
    .where('topicId', '==', topicId)
    .get()
  return snap.docs.map((d) => d.data() as TeachingContentDoc)
}

/** Mark older versions STALE for the same topic/language/style when a new version becomes READY. */
export async function markStalePreviousVersions(
  topicId: string,
  language: SupportedLanguage,
  style: TeachingStyle,
  currentVersion: number,
): Promise<number> {
  const snap = await getAdminFirestore()
    .collection(CONTENT_COLLECTION)
    .where('topicId', '==', topicId)
    .where('language', '==', language)
    .where('teachingStyle', '==', style)
    .get()
  let count = 0
  const batch = getAdminFirestore().batch()
  for (const doc of snap.docs) {
    const data = doc.data() as TeachingContentDoc
    if (data.contentVersion < currentVersion && data.status !== 'STALE') {
      batch.set(doc.ref, { status: 'STALE', activeVersion: false }, { merge: true })
      count++
    }
  }
  if (count > 0) await batch.commit()
  return count
}

export function validateCachedContent(
  content: TeachingContentDoc,
  segments: TeachingSegmentDoc[],
  expectedTopicId: string,
  expectedLanguage: SupportedLanguage,
  expectedStyle: TeachingStyle,
): boolean {
  if (content.status !== 'READY') return false
  if (content.topicId !== expectedTopicId) return false
  if (content.language !== expectedLanguage) return false
  if (content.teachingStyle !== expectedStyle) return false
  if (!content.steps?.length) return false
  if (!segments.length) return false

  const narrationSegs = segments.filter((s) => s.narration?.trim())
  if (narrationSegs.length === 0) return false

  for (const s of narrationSegs) {
    if (s.status !== 'READY') return false
    if (!s.audioUrl && !s.audioStoragePath) return false
    if (!s.highlightTarget || !s.visualMarker || !s.visualAction) return false
  }

  return true
}

export async function getActiveTeachingContent(
  topicId: string,
  language: SupportedLanguage,
  style: TeachingStyle,
): Promise<{ content: TeachingContentDoc; contentVersion: number } | null> {
  const snap = await getAdminFirestore()
    .collection(CONTENT_COLLECTION)
    .where('topicId', '==', topicId)
    .where('language', '==', language)
    .where('teachingStyle', '==', style)
    .where('status', '==', 'READY')
    .get()

  const docs = snap.docs
    .map((d) => d.data() as TeachingContentDoc)
    .filter((d) => d.activeVersion !== false)
    .sort((a, b) => b.contentVersion - a.contentVersion)

  if (docs.length === 0) return null
  return { content: docs[0], contentVersion: docs[0].contentVersion }
}

export async function markContentFailed(
  contentDocId: string,
  stage: string,
  message: string,
): Promise<void> {
  await getAdminFirestore()
    .collection(CONTENT_COLLECTION)
    .doc(contentDocId)
    .set(
      {
        status: 'FAILED' as ContentStatus,
        overallStatus: 'FAILED' as ContentStatus,
        error: { stage, message, retryCount: 0 },
        generationLock: FieldValue.delete(),
      },
      { merge: true },
    )
}
