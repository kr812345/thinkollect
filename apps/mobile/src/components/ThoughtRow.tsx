import React, { memo } from 'react'
import { View, Text, StyleSheet, Platform } from 'react-native'
import { formatDistanceToNowStrict } from 'date-fns'
import type { Thought } from '../types'

interface Props {
  thought: Thought
}

function ThoughtRow({ thought }: Props) {
  const relativeTime = formatDistanceToNowStrict(new Date(thought.captured_at), {
    addSuffix: true,
  })

  return (
    <View style={styles.row}>
      <Text style={styles.content} numberOfLines={3} ellipsizeMode="tail">
        {thought.content}
      </Text>
      <View style={styles.meta}>
        <Text style={styles.time}>{relativeTime}</Text>
        {/* Sync state: visible only as a minimal dot, no colors */}
        {thought.synced === 0 && <Text style={styles.unsyncedDot}>·</Text>}
      </View>
    </View>
  )
}

export default memo(ThoughtRow)

const styles = StyleSheet.create({
  row: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1a1a1a',
  },
  content: {
    color: '#d4d4d4',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 6,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  time: {
    color: '#3a3a3a',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  // A near-invisible dot — not a color badge, just a glyph that signals "not yet uploaded"
  // Completely unobtrusive. Developers will notice it; others won't.
  unsyncedDot: {
    color: '#3a3a3a',
    fontSize: 18,
    lineHeight: 14,
    marginTop: -2,
  },
})
