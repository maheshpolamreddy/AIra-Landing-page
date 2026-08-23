import type { SupportedLanguage, TeachingStyle } from './types'

export function buildCacheKey(
  topicId: string,
  language: SupportedLanguage,
  style: TeachingStyle,
  contentVersion: number,
): string {
  const lang = language.toLowerCase().replace('_', '-')
  return `aira:lesson:${topicId}:${lang}:${style}:v${contentVersion}`
}

export function buildContentDocId(
  topicId: string,
  language: SupportedLanguage,
  style: TeachingStyle,
  contentVersion: number,
): string {
  const lang = language.toLowerCase().replace('_', '-')
  return `${topicId}__${lang}__${style}__v${contentVersion}`
}

export function parseContentDocId(docId: string): {
  topicId: string
  language: string
  style: string
  contentVersion: number
} | null {
  const match = docId.match(/^(.+)__([^_]+(?:-[^_]+)?)__([^_]+)__v(\d+)$/)
  if (!match) return null
  return {
    topicId: match[1],
    language: match[2],
    style: match[3],
    contentVersion: parseInt(match[4], 10),
  }
}
