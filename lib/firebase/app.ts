import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { firebaseConfig } from '@/lib/firebase/config'

let app: FirebaseApp | undefined
let db: Firestore | undefined

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  }
  return app
}

export function getFirebaseDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp())
  }
  return db
}
