"use client"

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth"
import { auth } from "./firebase"
import { getUser, setUser } from "./firestore"
import type { User } from "./types"

let cachedUser: User | null = null
let authReady = false

/**
 * Inicializa o listener de auth. Chame uma vez no app (ex.: layout ou provider).
 * Atualiza o cache usado por getCurrentUser().
 */
export function initAuthStateListener(): () => void {
  if (!auth) return () => {}
  return onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
    authReady = true
    if (!fbUser) {
      cachedUser = null
      return
    }
    let profile = await getUser(fbUser.uid)
    if (!profile) {
      const email = fbUser.email ?? ""
      const name = fbUser.displayName ?? email.split("@")[0] ?? "Usuário"
      await setUser(fbUser.uid, {
        email,
        name,
        role: "user",
      })
      profile = await getUser(fbUser.uid)
    }
    cachedUser = profile ?? null
  })
}

export function isAuthReady(): boolean {
  return authReady
}

/**
 * Login com e-mail e senha. Cria ou atualiza o documento do usuário em Firestore.
 */
export async function login(email: string, password: string): Promise<User> {
  if (!auth) throw new Error("Firebase não configurado. Defina as variáveis NEXT_PUBLIC_FIREBASE_* em .env.local")
  const cred = await signInWithEmailAndPassword(auth, email, password)
  let profile = await getUser(cred.user.uid)
  if (!profile) {
    await setUser(cred.user.uid, {
      email: cred.user.email ?? email,
      name: cred.user.displayName ?? email.split("@")[0] ?? "Usuário",
      role: "user",
    })
    profile = (await getUser(cred.user.uid))!
  }
  cachedUser = profile
  return profile
}

/**
 * Registro. Cria usuário no Auth e documento em Firestore com role "user".
 * Admins devem ser definidos manualmente no Firestore (campo role = "admin").
 */
export async function register(name: string, email: string, password: string): Promise<User> {
  if (!auth) throw new Error("Firebase não configurado. Defina as variáveis NEXT_PUBLIC_FIREBASE_* em .env.local")
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await setUser(cred.user.uid, {
    email,
    name,
    role: "user",
  })
  const profile = (await getUser(cred.user.uid))!
  cachedUser = profile
  return profile
}

export function logout(): Promise<void> {
  cachedUser = null
  if (!auth) return Promise.resolve()
  return firebaseSignOut(auth)
}

/**
 * Retorna o usuário atual (cache). Para garantir que o cache está preenchido,
 * use initAuthStateListener() no root do app e aguarde o primeiro callback.
 */
export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null
  return cachedUser
}

/**
 * Retorna o usuário atual buscando do Firestore (útil após login/register ou quando o cache pode estar desatualizado).
 */
export async function getCurrentUserAsync(): Promise<User | null> {
  if (typeof window === "undefined" || !auth) return null
  const fbUser = auth.currentUser
  if (!fbUser) return null
  const profile = await getUser(fbUser.uid)
  if (profile) cachedUser = profile
  return profile
}
