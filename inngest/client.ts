import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'aira-curriculum',
  name: 'Aira Curriculum Content Pipeline',
  eventKey: process.env.INNGEST_EVENT_KEY,
})

export type TopicRegisteredEvent = {
  name: 'curriculum/topic.registered'
  data: {
    topicId: string
    contentVersion?: number
    styles?: string[]
    languages?: string[]
  }
}

export type GenerateScriptEvent = {
  name: 'content/generate.script'
  data: {
    topicId: string
    language: string
    teachingStyle: string
    contentVersion: number
    jobId?: string
  }
}

export type GenerateTtsEvent = {
  name: 'content/generate.tts'
  data: {
    topicId: string
    language: string
    teachingStyle: string
    contentVersion: number
    contentDocId: string
    segmentId: string
    jobId?: string
  }
}

export type PublishContentEvent = {
  name: 'content/publish'
  data: {
    topicId: string
    language: string
    teachingStyle: string
    contentVersion: number
    contentDocId: string
    jobId?: string
  }
}

export type ImportCuratedEvent = {
  name: 'content/import.curated'
  data: {
    importJobId: string
  }
}
