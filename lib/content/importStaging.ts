import { getAdminFirestore } from './firestore'
import type { CurriculumTopicDoc, TeachingStepDoc, SupportedLanguage, TeachingStyle } from './types'

const STAGING_COLLECTION = 'contentImportStaging'

export interface ImportStagingDoc {
  topic: CurriculumTopicDoc
  steps: TeachingStepDoc[]
  teachingStyle: TeachingStyle
  language: SupportedLanguage
  contentVersion: number
  createdAt: string
}

export async function createImportStagingDoc(
  importJobId: string,
  payload: Omit<ImportStagingDoc, 'createdAt'>,
): Promise<void> {
  await getAdminFirestore()
    .collection(STAGING_COLLECTION)
    .doc(importJobId)
    .set({ ...payload, createdAt: new Date().toISOString() })
}

export async function loadImportStagingDoc(importJobId: string): Promise<ImportStagingDoc | null> {
  const snap = await getAdminFirestore().collection(STAGING_COLLECTION).doc(importJobId).get()
  if (!snap.exists) return null
  return snap.data() as ImportStagingDoc
}

export async function deleteImportStagingDoc(importJobId: string): Promise<void> {
  await getAdminFirestore().collection(STAGING_COLLECTION).doc(importJobId).delete()
}
