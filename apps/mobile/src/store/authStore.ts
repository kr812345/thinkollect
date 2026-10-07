import { create } from 'zustand'
import { Platform } from 'react-native'
import Storage from 'expo-sqlite/kv-store'

interface User {
  id: string
  email: string
}

interface Session {
  token: string
  user: User
}

interface AuthState {
  session: Session | null
  initialized: boolean
  setSession: (session: Session | null) => void
  initialize: () => void
  login: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  logout: () => void
}

// Must match the backend (apps/api/src/models/auth.py)
export const PASSWORD_MIN_LENGTH = 8

const SESSION_KEY = 'thinkollect_session'

function apiUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'
}

function isTokenExpired(token: string): boolean {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '=')))
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()
  } catch {
    return false
  }
}

function readStoredSession(): Session | null {
  try {
    const raw = Platform.OS === 'web' ? localStorage.getItem(SESSION_KEY) : Storage.getItemSync(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as Session
    if (!session?.token || !session?.user?.id || isTokenExpired(session.token)) return null
    return session
  } catch {
    return null
  }
}

function writeStoredSession(session: Session | null) {
  try {
    if (Platform.OS === 'web') {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      else localStorage.removeItem(SESSION_KEY)
    } else if (session) {
      Storage.setItemSync(SESSION_KEY, JSON.stringify(session))
    } else {
      Storage.removeItemSync(SESSION_KEY)
    }
  } catch (e) {
    console.error('Failed to persist session', e)
  }
}

/** Extract a human-readable message from a FastAPI error body. */
function errorMessage(data: any, fallback: string): string {
  const detail = data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((e: any) => e?.msg).filter(Boolean).join(', ') || fallback
  }
  return fallback
}

async function authenticate(
  endpoint: 'login' | 'signup',
  email: string,
  password: string,
): Promise<Session> {
  const res = await fetch(`${apiUrl()}/api/auth/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  let data: any = null
  try {
    data = await res.json()
  } catch {
    // Non-JSON error body (proxy error, server down, etc.)
  }

  if (!res.ok) {
    throw new Error(errorMessage(data, `Request failed (${res.status})`))
  }
  if (!data?.token || !data?.user?.id) {
    throw new Error('Server returned an incomplete session.')
  }

  return { token: data.token, user: { id: data.user.id, email: data.user.email } }
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  initialized: false,
  setSession: (session) => {
    writeStoredSession(session)
    set({ session })
  },
  initialize: () => {
    const session = readStoredSession()
    if (!session) writeStoredSession(null)
    set({ session, initialized: true })
  },
  login: async (email, password) => {
    const session = await authenticate('login', email, password)
    writeStoredSession(session)
    set({ session })
  },
  signUp: async (email, password) => {
    if (password.length < PASSWORD_MIN_LENGTH) {
      throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    }
    const session = await authenticate('signup', email, password)
    writeStoredSession(session)
    set({ session })
  },
  logout: () => {
    writeStoredSession(null)
    set({ session: null })
  }
}))
