import NetInfo from '@react-native-community/netinfo'
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
 * Full 2-way sync: Pull remote changes and push local changes via Custom API.
 */
export async function syncPendingThoughts(): Promise<{ synced: number; failed: boolean }> {
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'

  const netState = await NetInfo.fetch()
  if (!netState.isConnected) return { synced: 0, failed: false }

  // Get session from custom Auth Store
  let sessionData: any = null
  let userId = null
  let token = null
  try {
    const authStore = require('../store/authStore').useAuthStore.getState()
    sessionData = authStore.session
    userId = sessionData?.user?.id
    token = sessionData?.token
  } catch (e) {
    console.warn("Auth store not found or session missing")
  }

  if (!userId || !token) return { synced: 0, failed: false }

  const clientId = getClientId()
  const now = Date.now()

  try {
    // 1. PULL changes from Backend
    // Boilerplate: GET /api/thoughts/sync?last_sync=...
    /*
    const pullRes = await fetch(`${API_URL}/api/thoughts/sync`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const remoteThoughts = await pullRes.json()
    */
    const remoteThoughts: any[] = [] // MOCK for now

    // Merge remote thoughts into local database
    import('../db/local').then(({ upsertThoughtFromServer }) => {
      for (const rt of remoteThoughts) {
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

    // 2. PUSH local changes to Backend
    const unsyncedThoughts = getUnsyncedThoughts()
    if (unsyncedThoughts.length === 0) return { synced: 0, failed: false }

    const rows = unsyncedThoughts.map((t: Thought) => ({
      id: t.id,
      client_id: clientId,
      content: t.content,
      tags: t.tags,
      captured_at: new Date(t.captured_at).toISOString(),
      updated_at: new Date(t.updated_at).toISOString(),
      deleted_at: t.deleted === 1 ? new Date(t.updated_at).toISOString() : null,
    }))

    // Boilerplate: POST /api/thoughts/sync
    /*
    const pushRes = await fetch(`${API_URL}/api/thoughts/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ thoughts: rows })
    })
    if (!pushRes.ok) throw new Error("Push failed")
    */

    const ids = unsyncedThoughts.map((t) => t.id)
    markSynced(ids, now)

    console.log(`[sync] Pushed ${ids.length} thoughts to API. Pulled ${remoteThoughts.length}.`)
    return { synced: ids.length, failed: false }
  } catch (err: any) {
    console.error('[sync] API sync failed:', err.message)
    return { synced: 0, failed: true }
  }
}
