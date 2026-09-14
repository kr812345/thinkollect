import { create } from 'zustand'
import uuid from 'react-native-uuid'
import {
  saveThought,
  getAllThoughts,
  getUnsyncedCount,
  getTotalCount,
  deleteThoughts,
  updateThought,
} from '../db/local'
import { syncPendingThoughts } from '../lib/sync'
import type { Thought, NewThought } from '../types'


interface ThoughtStore {
  thoughts: Thought[]
  unsyncedCount: number
  totalCount: number
  isSyncing: boolean
  // Actions
  loadThoughts: () => void
  addThought: (input: NewThought) => Promise<void>
  triggerSync: () => Promise<void>
  removeThoughts: (ids: string[]) => Promise<void>
  editThought: (id: string, newContent: string) => Promise<void>
}

export const useThoughtStore = create<ThoughtStore>((set, get) => ({
  thoughts: [],
  unsyncedCount: 0,
  totalCount: 0,
  isSyncing: false,

  loadThoughts: () => {
    const thoughts = getAllThoughts()
    set({
      thoughts,
      unsyncedCount: getUnsyncedCount(),
      totalCount: getTotalCount(),
    })
  },

  addThought: async ({ content, tags }: NewThought) => {
    const thought: Omit<Thought, 'synced' | 'synced_at'> = {
      id: uuid.v4() as string,
      content: content.trim(),
      tags,
      captured_at: Date.now(),
    }

    saveThought(thought)
    get().loadThoughts()
    get().triggerSync()
  },

  removeThoughts: async (ids: string[]) => {
    deleteThoughts(ids)
    get().loadThoughts()
    // Ideally we'd also delete from Supabase or queue deletions
    // For now we just remove locally based on user's simple request
  },

  editThought: async (id: string, newContent: string) => {
    updateThought(id, newContent.trim())
    get().loadThoughts()
    get().triggerSync()
  },

  triggerSync: async () => {
    if (get().isSyncing) return
    set({ isSyncing: true })
    try {
      await syncPendingThoughts()
    } finally {
      set({ isSyncing: false })
      get().loadThoughts()
    }
  },
}))
