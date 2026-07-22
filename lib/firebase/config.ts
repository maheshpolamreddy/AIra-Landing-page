/** Client-safe Firebase web config (from env, with project defaults). */

export const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    'AIzaSyC9L2gJBJI_C0kCy2zVxMfiZqIGEjd-w1o',
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    'aira-landingpage.firebaseapp.com',
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'aira-landingpage',
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    'aira-landingpage.firebasestorage.app',
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '993289285952',
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    '1:993289285952:web:5c5751a02c1fc3c173caa5',
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? 'G-9FT49STZ0P',
} as const
