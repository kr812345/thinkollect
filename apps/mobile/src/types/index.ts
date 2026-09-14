// Types shared across the app

export interface Thought {
  id: string
  content: string
  tags: string[]
  captured_at: number // epoch ms (device time, never changes)
  synced: 0 | 1       // 0 = not synced, 1 = synced to Supabase
  synced_at: number | null // epoch ms when Supabase confirmed
}

export type NewThought = Pick<Thought, 'content' | 'tags'>
