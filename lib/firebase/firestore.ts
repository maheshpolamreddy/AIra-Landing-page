import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/app'

export type ContactMessage = {
  name: string
  email: string
  organization?: string
  message: string
}

export type WaitlistEntry = {
  email: string
  courseId: string
  courseName: string
}

export async function saveContactMessage(data: ContactMessage) {
  const db = getFirebaseDb()
  return addDoc(collection(db, 'contact_messages'), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function saveWaitlistEntry(data: WaitlistEntry) {
  const db = getFirebaseDb()
  return addDoc(collection(db, 'waitlist'), {
    ...data,
    createdAt: serverTimestamp(),
  })
}
