import { create } from 'zustand'
import uuid from 'react-native-uuid'
import {
  saveThought,
  getAllThoughts,
  getUnsyncedCount,
  getTotalCount,
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

    // Save locally — synchronous, instant
    saveThought(thought)

    // Refresh state from DB
    get().loadThoughts()

    // Fire sync in background — no await on UI thread
    get().triggerSync()
  },

  triggerSync: async () => {
    if (get().isSyncing) return
    set({ isSyncing: true })
    try {
      await syncPendingThoughts()
    } finally {
      set({ isSyncing: false })
      // Refresh counts after sync
      get().loadThoughts()
    }
  },
}))
