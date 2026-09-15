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
 * Full 2-way sync: Pull remote changes and push local changes.
 */
export async function syncPendingThoughts(): Promise<{ synced: number; failed: boolean }> {
  if (!isSupabaseConfigured) return { synced: 0, failed: false }

  const netState = await NetInfo.fetch()
  if (!netState.isConnected) return { synced: 0, failed: false }

  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user?.id
  if (!userId) return { synced: 0, failed: false }

  const clientId = getClientId()
  const now = Date.now()

  // 1. PULL changes from Supabase
  const { data: remoteThoughts, error: pullError } = await supabase
    .from('thoughts')
    .select('*')
    .eq('user_id', userId)

  if (pullError) {
    console.error('[sync] Pull failed:', pullError.message)
    return { synced: 0, failed: true }
  }

  // Merge remote thoughts into local database
  import('../db/local').then(({ upsertThoughtFromServer }) => {
    for (const rt of (remoteThoughts || [])) {
      upsertThoughtFromServer({
        id: rt.id,
        content: rt.content,
        tags: rt.tags || [],
        captured_at: new Date(rt.captured_at).getTime(),
        updated_at: new Date(rt.updated_at).getTime(),
        deleted: rt.deleted_at ? 1 : 0,
        synced: 1,
        synced_at: now
      })
    }
  })

  // 2. PUSH local changes to Supabase
  const unsyncedThoughts = getUnsyncedThoughts()
  if (unsyncedThoughts.length === 0) return { synced: 0, failed: false }

  const rows = unsyncedThoughts.map((t: Thought) => ({
    id: t.id,
    user_id: userId,
    client_id: clientId,
    content: t.content,
    tags: t.tags,
    captured_at: new Date(t.captured_at).toISOString(),
    updated_at: new Date(t.updated_at).toISOString(),
    deleted_at: t.deleted === 1 ? new Date(t.updated_at).toISOString() : null,
  }))

  const { error: pushError } = await supabase
    .from('thoughts')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false })

  if (pushError) {
    console.error('[sync] Push failed:', pushError.message)
    return { synced: 0, failed: true }
  }

  const ids = unsyncedThoughts.map((t) => t.id)
  markSynced(ids, now)

  console.log(`[sync] Pushed ${ids.length} thoughts to Supabase. Pulled ${(remoteThoughts||[]).length}.`)
  return { synced: ids.length, failed: false }
}
