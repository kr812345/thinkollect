import { Platform } from 'react-native'
import * as SQLite from 'expo-sqlite'
import type { Thought } from '../types'

// Max thoughts stored on device (FIFO ring buffer)
export const LOCAL_LIMIT = 50

let _db: SQLite.SQLiteDatabase | null = null

// --- Web Fallback ---
let webThoughts: Thought[] = []
function loadWebDb() {
  if (Platform.OS !== 'web') return
  try {
    const data = localStorage.getItem('thinkollect_web_db')
    if (data) webThoughts = JSON.parse(data)
  } catch (e) {}
}
function saveWebDb() {
  if (Platform.OS !== 'web') return
  try {
    localStorage.setItem('thinkollect_web_db', JSON.stringify(webThoughts))
  } catch (e) {}
}
// --------------------

// Open or return the existing database connection
export function getDb(): SQLite.SQLiteDatabase {
  if (Platform.OS === 'web') return {} as any
  if (!_db) {
    _db = SQLite.openDatabaseSync('thinkollect.db')
  }
  return _db
}

// Run migrations on app start
export function initDb(): void {
  if (Platform.OS === 'web') {
    loadWebDb()
    return
  }
  const db = getDb()
  db.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS thoughts (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      captured_at INTEGER NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      synced_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_synced_captured
      ON thoughts(synced, captured_at ASC);
  `)
}

// Insert a new thought and evict oldest *synced* if over limit
export function saveThought(thought: Omit<Thought, 'synced' | 'synced_at'>): void {
  if (Platform.OS === 'web') {
    webThoughts.push({ ...thought, synced: 0 } as Thought)
    // Evict oldest synced thought if we exceed the limit
    if (webThoughts.length > LOCAL_LIMIT) {
      const oldestSyncedIdx = webThoughts.findIndex(t => t.synced === 1)
      if (oldestSyncedIdx !== -1) {
        webThoughts.splice(oldestSyncedIdx, 1)
      }
    }
    saveWebDb()
    return
  }

  const db = getDb()
  db.runSync(
    `INSERT INTO thoughts (id, content, tags, captured_at, synced, synced_at)
     VALUES (?, ?, ?, ?, 0, NULL)`,
    thought.id,
    thought.content,
    JSON.stringify(thought.tags),
    thought.captured_at,
  )

  const count = (db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM thoughts`
  ))?.count ?? 0

  if (count > LOCAL_LIMIT) {
    db.runSync(
      `DELETE FROM thoughts WHERE id = (
         SELECT id FROM thoughts
         WHERE synced = 1
         ORDER BY captured_at ASC
         LIMIT 1
       )`
    )
  }
}

// Get all thoughts ordered newest first
export function getAllThoughts(): Thought[] {
  if (Platform.OS === 'web') {
    return [...webThoughts].sort((a, b) => b.captured_at - a.captured_at)
  }
  const db = getDb()
  const rows = db.getAllSync<Omit<Thought, 'tags'> & { tags: string }>(
    `SELECT * FROM thoughts ORDER BY captured_at DESC`
  )
  return rows.map((r) => ({ ...r, tags: JSON.parse(r.tags) as string[] }))
}

// Get all unsynced thoughts (for sync engine)
export function getUnsyncedThoughts(): Thought[] {
  if (Platform.OS === 'web') {
    return webThoughts.filter(t => t.synced === 0).sort((a, b) => a.captured_at - b.captured_at)
  }
  const db = getDb()
  const rows = db.getAllSync<Omit<Thought, 'tags'> & { tags: string }>(
    `SELECT * FROM thoughts WHERE synced = 0 ORDER BY captured_at ASC`
  )
  return rows.map((r) => ({ ...r, tags: JSON.parse(r.tags) as string[] }))
}

// Mark a list of thought IDs as synced with the exact server-acknowledged time
export function markSynced(ids: string[], synced_at: number): void {
  if (ids.length === 0) return
  if (Platform.OS === 'web') {
    webThoughts = webThoughts.map(t => 
      ids.includes(t.id) ? { ...t, synced: 1, synced_at } : t
    )
    saveWebDb()
    return
  }
  const db = getDb()
  const placeholders = ids.map(() => '?').join(', ')
  db.runSync(
    `UPDATE thoughts SET synced = 1, synced_at = ? WHERE id IN (${placeholders})`,
    synced_at,
    ...ids,
  )
}

// Get count of unsynced thoughts
export function getUnsyncedCount(): number {
  if (Platform.OS === 'web') {
    return webThoughts.filter(t => t.synced === 0).length
  }
  const db = getDb()
  return (db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM thoughts WHERE synced = 0`
  ))?.count ?? 0
}

// Get total local thought count
export function getTotalCount(): number {
  if (Platform.OS === 'web') {
    return webThoughts.length
  }
  const db = getDb()
  return (db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM thoughts`
  ))?.count ?? 0
}
