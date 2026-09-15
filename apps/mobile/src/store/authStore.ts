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

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  initialized: false,
  setSession: (session) => set({ session }),
  initialize: () => {
    // Just mark as initialized directly
    set({ initialized: true })
  },
  login: async (email, password) => {
    try {
      const url = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'
      // Placeholder fetch call for actual implementation
      // const res = await fetch(`${url}/auth/login`, {
      //   method: 'POST',
      //   body: JSON.stringify({ email, password }),
      // })
    } catch (e) {
      console.log(e)
    }

    // Mock response after 1 second delay
    return new Promise((resolve) => {
      setTimeout(() => {
        set({
          session: {
            token: 'mock-token',
            user: { id: 'user-123', email },
          }
        })
        resolve()
      }, 1000)
    })
  },
  signUp: async (email, password) => {
    try {
      const url = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'
      // Placeholder fetch call for actual implementation
      // const res = await fetch(`${url}/auth/signup`, { ... })
    } catch (e) {
      console.log(e)
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        set({
          session: {
            token: 'mock-token',
            user: { id: 'user-123', email },
          }
        })
        resolve()
      }, 1000)
    })
  },
  logout: () => {
    set({ session: null })
  }
}))
