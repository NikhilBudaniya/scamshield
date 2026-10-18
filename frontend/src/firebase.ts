import { initializeApp, getApps } from 'firebase/app'
import { browserSessionPersistence, getAuth, setPersistence, signInAnonymously, signOut } from 'firebase/auth'
import type { Auth } from 'firebase/auth'
import type { FirebaseOptions } from 'firebase/app'

let authInstance: Auth | null = null

export async function initializeAnonymousSession(config: FirebaseOptions): Promise<Auth> {
  const app = getApps()[0] ?? initializeApp(config)
  const auth = getAuth(app)
  await setPersistence(auth, browserSessionPersistence)
  if (!auth.currentUser) await signInAnonymously(auth)
  authInstance = auth
  return auth
}

export async function getFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  if (!authInstance?.currentUser) return null
  return authInstance.currentUser.getIdToken(forceRefresh)
}

export async function renewAnonymousSession(config: FirebaseOptions): Promise<Auth> {
  if (authInstance) await signOut(authInstance)
  return initializeAnonymousSession(config)
}
