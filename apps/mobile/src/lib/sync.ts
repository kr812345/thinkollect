import NetInfo from '@react-native-community/netinfo'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getUnsyncedThoughts, markSynced } from '../db/local'
import type { Thought } from '../types'

// Unique device identifier — persisted across sessions
let _clientId: string | null = null

export function getClientId(): string {
  if (!_clientId) {
    // Use a simple random UUID that persists in-memory for the session
    // In production, persist this with expo-secure-store
    _clientId = Math.random().toString(36).slice(2) + Date.now().toString(36)
  }
  return _clientId
}

/**
 * Syncs all locally unsynced thoughts to Supabase.
 * Uses upsert so re-syncing is safe and idempotent.
 * Preserves the original captured_at timestamp.
 */
export async function syncPendingThoughts(): Promise<{ synced: number; failed: boolean }> {
  if (!isSupabaseConfigured) return { synced: 0, failed: false }

  const netState = await NetInfo.fetch()
  if (!netState.isConnected) return { synced: 0, failed: false }

  const unsyncedThoughts = getUnsyncedThoughts()
  if (unsyncedThoughts.length === 0) return { synced: 0, failed: false }

  const clientId = getClientId()
  const now = Date.now()

  const rows = unsyncedThoughts.map((t: Thought) => ({
    id: t.id,
    client_id: clientId,
    content: t.content,
    tags: t.tags,
    // ISO string with the original capture time — never overwritten
    captured_at: new Date(t.captured_at).toISOString(),
  }))

  const { error } = await supabase
    .from('thoughts')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false })

  if (error) {
    console.error('[sync] Supabase upsert failed:', error.message)
    return { synced: 0, failed: true }
  }

  const ids = unsyncedThoughts.map((t) => t.id)
  markSynced(ids, now)

  console.log(`[sync] Synced ${ids.length} thoughts to Supabase.`)
  return { synced: ids.length, failed: false }
}
