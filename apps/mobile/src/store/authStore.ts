import { create } from 'zustand'
import { Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

interface AuthState {
  session: Session | null
  initialized: boolean
  setSession: (session: Session | null) => void
  initialize: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  initialized: false,
  setSession: (session) => set({ session }),
  initialize: () => {
    if (!isSupabaseConfigured || !supabase) {
      set({ initialized: true })
      return
    }

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      set({ session: data.session, initialized: true })
    })

    supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      set({ session })
    })
  }
}))
