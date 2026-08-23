/** Teaching personality styles for cached curriculum content. */
export type TeachingStyle =
  | 'encouraging'
  | 'friendly'
  | 'disciplined'
  | 'professional'
  | 'interactive'

export const TEACHING_STYLES: TeachingStyle[] = [
  'encouraging',
  'friendly',
  'disciplined',
  'professional',
  'interactive',
]

export const SUPPORTED_LANGUAGES = ['en-IN', 'hi-IN', 'te-IN'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export type ContentStatus =
  | 'REGISTERED'
  | 'QUEUED'
  | 'PENDING'
  | 'GENERATING_SCRIPT'
  | 'SCRIPT_READY'
  | 'GENERATING_TTS'
  | 'GENERATING_AUDIO'
  | 'VALIDATING'
  | 'READY'
  | 'FAILED'
  | 'STALE'

export type VisualActionType = 'highlight' | 'show' | 'clear'

export interface VisualActionEntry {
  highlightTarget: string
  action: VisualActionType
  startOffsetMs: number
  endOffsetMs?: number
}

export interface VisualRegistrySnapshot {
  topicId: string
  diagramKeys: string[]
  visualRegistryVersion: number
}

export type GenerationStage = 'script' | 'tts' | 'publish' | 'validate'

export interface CurriculumTopicDoc {
  topicId: string
  gradeId: string
  subjectId: string
  chapterId: string
  topicName: string
  description?: string
  difficulty?: string
  gradeName?: string
  subjectName?: string
  chapterName?: string
  contentVersion: number
  visualRegistryVersion: number
  diagramKeys: string[]
  status: 'active' | 'deprecated'
  updatedAt: string
}

export interface TeachingStepDoc {
  id: string
  stepNumber: number
  title: string
  content: string
  spokenContent: string
  visualType: string
  visualId?: string
  durationSeconds: number
  keyConcepts?: string[]
}

export interface TeachingSegmentDoc {
  segmentId: string
  sequence: number
  stepId: string
  /** Speakable text (markers stripped for TTS) */
  narration: string
  text?: string
  visualMarker: string
  visualAction: VisualActionType
  highlightTarget: string
  visualActions?: VisualActionEntry[]
  audioUrl?: string
  audioStoragePath?: string
  audioDuration?: number
  duration?: number
  voiceId?: string
  language: string
  speed?: number
  audioVersion: number
  status: 'PENDING' | 'READY' | 'FAILED'
  error?: string
}

export interface TeachingContentDoc {
  topicId: string
  language: SupportedLanguage
  teachingStyle: TeachingStyle
  contentVersion: number
  cacheKey: string
  status: ContentStatus
  scriptStatus?: ContentStatus
  audioStatus?: ContentStatus
  overallStatus?: ContentStatus
  activeVersion?: boolean
  scriptVersion: number
  generatedAt?: string
  publishedAt?: string
  segmentCount: number
  steps: TeachingStepDoc[]
  greetingTemplate?: string
  visualRegistry?: VisualRegistrySnapshot
  validationReport?: { passed: boolean; errors: string[] }
  error?: { stage: string; message: string; retryCount: number }
  generationLock?: { jobId: string; lockedAt: string; expiresAt: string }
}

export interface ContentGenerationJobDoc {
  topicId: string
  language: SupportedLanguage
  teachingStyle: TeachingStyle
  contentVersion: number
  stage: GenerationStage
  status: 'pending' | 'running' | 'completed' | 'failed'
  retryCount: number
  startedAt: string
  completedAt?: string
  error?: string
}

export interface CachedLessonResponse {
  status: ContentStatus
  topicId: string
  language: string
  teachingStyle: TeachingStyle
  contentVersion: number
  cacheKey: string
  steps: TeachingStepDoc[]
  segments: TeachingSegmentDoc[]
  visualRegistry: VisualRegistrySnapshot
  greetingTemplate: string
  scriptStatus?: ContentStatus
  audioStatus?: ContentStatus
  generatedAt?: string
  message?: string
}
