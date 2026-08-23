import type { SupportedLanguage, TeachingStyle } from './types'

export { TEACHING_STYLES, SUPPORTED_LANGUAGES } from './types'
export type { TeachingStyle, SupportedLanguage } from './types'

export const CONTENT_COLLECTION = 'teachingContent'
export const TOPICS_COLLECTION = 'curriculumTopics'
export const JOBS_COLLECTION = 'contentGenerationJobs'
export const SEGMENTS_SUBCOLLECTION = 'segments'
export const STORAGE_PREFIX = 'lesson-audio'
export const DEFAULT_CONTENT_VERSION = 1
export const GENERATION_LOCK_TTL_MS = 15 * 60 * 1000
export const MAX_SCRIPT_RETRIES = 2
export const MAX_TTS_RETRIES = 3

/** Map legacy tutor teaching styles to pipeline styles. */
export function normalizeTeachingStyle(raw: string | undefined): TeachingStyle {
  const map: Record<string, TeachingStyle> = {
    encouraging: 'encouraging',
    friendly: 'friendly',
    disciplined: 'disciplined',
    professional: 'professional',
    interactive: 'interactive',
    mentor: 'encouraging',
    strict: 'disciplined',
  }
  return map[raw || ''] || 'friendly'
}

export function normalizeLanguage(raw: string | undefined): SupportedLanguage {
  const v = (raw || 'en-IN').trim().replace('_', '-')
  if (v === 'hi' || v === 'hi-IN') return 'hi-IN'
  if (v === 'te' || v === 'te-IN') return 'te-IN'
  return 'en-IN'
}

export const GREETING_TEMPLATES: Record<TeachingStyle, Record<SupportedLanguage, string>> = {
  encouraging: {
    'en-IN': 'Hi {firstName}, welcome to today\'s lesson. Let\'s learn this together — you\'re going to do great.',
    'hi-IN': 'नमस्ते {firstName}, आज के पाठ में आपका स्वागत है। चलिए, साथ मिलकर सीखते हैं।',
    'te-IN': 'హాయ్ {firstName}, ఈ రోజు పాఠానికి స్వాగతం. కలిసి నేర్చుకుందాం.',
  },
  friendly: {
    'en-IN': 'Hey {firstName}! Great to see you. Let\'s dive into today\'s topic.',
    'hi-IN': 'हाय {firstName}! आपको देखकर अच्छा लगा। चलिए, आज के विषय पर बात करते हैं।',
    'te-IN': 'హాయ్ {firstName}! మిమ్మల్ని చూసి సంతోషంగా ఉంది. ఈ రోజు అంశాన్ని ప్రారంభిద్దాం.',
  },
  disciplined: {
    'en-IN': 'Hello {firstName}. Today we will cover this topic with focus and precision. Pay close attention.',
    'hi-IN': 'नमस्कार {firstName}। आज हम इस विषय को ध्यान से और सटीकता से पढ़ेंगे।',
    'te-IN': 'నమస్కారం {firstName}. ఈ రోజు మనం ఈ అంశాన్ని స్పష్టంగా, క్రమబద్ధంగా చూస్తాం.',
  },
  professional: {
    'en-IN': 'Good day, {firstName}. Welcome to this lesson. We will proceed systematically through the key concepts.',
    'hi-IN': 'नमस्कार {firstName}। इस पाठ में आपका स्वागत है। हम मुख्य अवधारणाओं को क्रम से समझेंगे।',
    'te-IN': 'నమస్కారం {firstName}. ఈ పాఠానికి స్వాగతం. ముఖ్య భావనలను క్రమపద్ధతిలో చూస్తాం.',
  },
  interactive: {
    'en-IN': 'Hi {firstName}! Ready for an interactive lesson? Think along with me as we go.',
    'hi-IN': 'हाय {firstName}! इंटरैक्टिव पाठ के लिए तैयार हैं? साथ-साथ सोचते हुए आगे बढ़ेंगे।',
    'te-IN': 'హాయ్ {firstName}! ఇంటరాక్టివ్ పాఠానికి సిద్ధమా? నాతో పాటు ఆలochinchu.',
  },
}
