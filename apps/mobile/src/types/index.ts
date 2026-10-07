// Types shared across the app

export interface Thought {
  id: string
  content: string
  tags: string[]
  captured_at: number // epoch ms (device time, never changes)
  updated_at: number  // epoch ms of last update
  deleted: 0 | 1      // soft delete flag
  synced: 0 | 1       // 0 = not synced, 1 = synced to backend
  synced_at: number | null // epoch ms when backend confirmed
  insight: string | null // mentor comment from the backend
}

export type NewThought = Pick<Thought, 'content' | 'tags'>
