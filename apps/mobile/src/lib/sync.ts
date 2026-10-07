import NetInfo from '@react-native-community/netinfo'
import { getUnsyncedThoughts, markSynced, upsertThoughtFromServer } from '../db/local'
import { apiFetch } from './api'
import type { Thought } from '../types'

// Unique device identifier — persisted across sessions
let _clientId: string | null = null

export function getClientId(): string {
  if (!_clientId) {
    _clientId = Math.random().toString(36).slice(2) + Date.now().toString(36)
  }
  return _clientId
}

function toLocalThought(rt: any, now: number): Thought {
  return {
    id: rt.id,
    content: rt.content,
    tags: rt.tags || [],
    captured_at: new Date(rt.captured_at).getTime(),
    updated_at: new Date(rt.updated_at).getTime(),
    deleted: rt.deleted_at ? 1 : 0,
    synced: 1,
    synced_at: now,
    insight: rt.insight ?? null,
  }
}

/**
 * Full 2-way sync: push local changes, then pull remote (including insights).
 */
export async function syncPendingThoughts(): Promise<{ synced: number; failed: boolean }> {
  const netState = await NetInfo.fetch()
  if (!netState.isConnected) return { synced: 0, failed: false }

  let userId: string | null = null
  let token: string | null = null
  try {
    const authStore = require('../store/authStore').useAuthStore.getState()
    userId = authStore.session?.user?.id ?? null
    token = authStore.session?.token ?? null
  } catch (e) {
    console.warn('Auth store not found or session missing')
  }

  if (!userId || !token) return { synced: 0, failed: false }

  const clientId = getClientId()
  const now = Date.now()

  try {
    const unsyncedThoughts = getUnsyncedThoughts()
    if (unsyncedThoughts.length > 0) {
      const rows = unsyncedThoughts.map((t: Thought) => ({
        id: t.id,
        client_id: clientId,
        content: t.content,
        tags: t.tags,
        captured_at: new Date(t.captured_at).toISOString(),
        updated_at: new Date(t.updated_at).toISOString(),
        deleted_at: t.deleted === 1 ? new Date(t.updated_at).toISOString() : null,
      }))

      const pushRes = await apiFetch('/api/thoughts/sync', {
        method: 'POST',
        body: JSON.stringify({ thoughts: rows }),
      })
      if (!pushRes.ok) throw new Error('Push failed')
      markSynced(unsyncedThoughts.map((t) => t.id), now)
    }

    const pullRes = await apiFetch('/api/thoughts/sync')
    if (!pullRes.ok) throw new Error('Pull failed')
    const remoteThoughts: any[] = await pullRes.json()

    for (const rt of remoteThoughts) {
      upsertThoughtFromServer(toLocalThought(rt, now))
    }

    console.log(`[sync] Pushed ${unsyncedThoughts.length}. Pulled ${remoteThoughts.length}.`)
    return { synced: unsyncedThoughts.length, failed: false }
  } catch (err: any) {
    console.error('[sync] API sync failed:', err.message)
    return { synced: 0, failed: true }
  }
}
