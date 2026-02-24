"use client"

import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getFirestore, type Firestore } from "firebase/firestore"
import { getAuth, type Auth } from "firebase/auth"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let app: FirebaseApp | undefined

if (getApps().length === 0 && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
  app = initializeApp(firebaseConfig)
} else if (getApps().length > 0) {
  app = getApps()[0] as FirebaseApp
}

export const db: Firestore | undefined = app ? getFirestore(app) : undefined
export const auth: Auth | undefined = app ? getAuth(app) : undefined
export { app }
