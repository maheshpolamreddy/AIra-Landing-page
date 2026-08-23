import { getAdminStorage } from './firestore'
import { STORAGE_PREFIX } from './constants'
import type { SupportedLanguage, TeachingStyle } from './types'
import fs from 'node:fs'
import path from 'node:path'

const SIGNED_URL_TTL_MS = 60 * 60 * 1000 // 1 hour
const DEV_AUDIO_ROOT = path.join(process.cwd(), '.dev-audio')

function devAudioStubEnabled(): boolean {
  if (process.env.TTS_DEV_STUB === '1') return true
  return process.env.INNGEST_DEV === '1' && process.env.NODE_ENV !== 'production'
}

function devAudioPublicUrl(storagePath: string): string {
  const base = (process.env.LANDING_URL || process.env.CONTENT_API_BASE || 'http://127.0.0.1:3000').replace(/\/$/, '')
  return `${base}/api/content/dev-audio?path=${encodeURIComponent(storagePath)}`
}

async function writeDevAudioFile(storagePath: string, audioBuffer: Buffer): Promise<void> {
  const filePath = path.join(DEV_AUDIO_ROOT, storagePath)
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
  await fs.promises.writeFile(filePath, audioBuffer)
}

export function buildAudioStoragePath(
  topicId: string,
  language: SupportedLanguage,
  style: TeachingStyle,
  contentVersion: number,
  segmentId: string,
): string {
  const lang = language.toLowerCase().replace('_', '-')
  return `${STORAGE_PREFIX}/${topicId}/${lang}/${style}/v${contentVersion}/${segmentId}.wav`
}

export async function uploadLessonAudio(
  path: string,
  audioBuffer: Buffer,
  contentType = 'audio/wav',
): Promise<{ storagePath: string; publicUrl: string }> {
  if (devAudioStubEnabled()) {
    await writeDevAudioFile(path, audioBuffer)
    return { storagePath: path, publicUrl: devAudioPublicUrl(path) }
  }
  const bucket = getAdminStorage().bucket()
  const file = bucket.file(path)
  await file.save(audioBuffer, {
    metadata: {
      contentType,
      cacheControl: 'private, max-age=31536000, immutable',
    },
    resumable: false,
  })
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${path}`
  return { storagePath: path, publicUrl }
}

export async function getSignedAudioUrl(storagePath: string): Promise<string> {
  if (devAudioStubEnabled()) {
    const filePath = path.join(DEV_AUDIO_ROOT, storagePath)
    if (fs.existsSync(filePath)) return devAudioPublicUrl(storagePath)
  }
  const bucket = getAdminStorage().bucket()
  const file = bucket.file(storagePath)
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + SIGNED_URL_TTL_MS,
  })
  return url
}

export async function deleteLessonAudio(path: string): Promise<void> {
  const bucket = getAdminStorage().bucket()
  await bucket.file(path).delete({ ignoreNotFound: true })
}
