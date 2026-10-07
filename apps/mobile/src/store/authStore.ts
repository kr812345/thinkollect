import { create } from 'zustand'

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

function apiUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'
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
  setSession: (session) => set({ session }),
  initialize: () => {
    // Just mark as initialized directly
    set({ initialized: true })
  },
  login: async (email, password) => {
    const session = await authenticate('login', email, password)
    set({ session })
  },
  signUp: async (email, password) => {
    if (password.length < PASSWORD_MIN_LENGTH) {
      throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    }
    const session = await authenticate('signup', email, password)
    set({ session })
  },
  logout: () => {
    set({ session: null })
  }
}))
