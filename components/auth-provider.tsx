'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { ensureAuthReady, initFirebaseAnalytics } from '@/lib/firebase/client'
import { logOut as firebaseLogOut } from '@/lib/firebase/auth'

type AuthContextValue = {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  logOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub = () => {}

    void (async () => {
      try {
        const auth = await ensureAuthReady()
        void initFirebaseAnalytics()

        unsub = onAuthStateChanged(
          auth,
          (next) => {
            setUser(next)
            setLoading(false)
          },
          (err) => {
            console.error('[auth] onAuthStateChanged error', err)
            setUser(null)
            setLoading(false)
          },
        )
      } catch (err) {
        console.error('[auth] failed to init', err)
        setLoading(false)
      }
    })()

    return () => unsub()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      logOut: async () => {
        await firebaseLogOut()
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
