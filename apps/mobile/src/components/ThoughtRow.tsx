import React, { memo } from 'react'
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native'
import { formatDistanceToNowStrict } from 'date-fns'
import { Ionicons } from '@expo/vector-icons'
import type { Thought } from '../types'
import { useThemeStore, getThemeColors } from '../store/themeStore'

interface Props {
  thought: Thought
  onPress: () => void
  onLongPress: () => void
  selectionMode: boolean
  isSelected: boolean
}

function ThoughtRow({ thought, onPress, onLongPress, selectionMode, isSelected }: Props) {
  const theme = useThemeStore((s) => s.theme)
  const colors = getThemeColors(theme)

  const relativeTime = formatDistanceToNowStrict(new Date(thought.captured_at), {
    addSuffix: true,
  })

  return (
    <Pressable 
      onPress={onPress} 
      onLongPress={onLongPress}
      style={[
        styles.row, 
        { borderBottomColor: colors.border },
        isSelected && { backgroundColor: colors.border }
      ]}
    >
      <View style={styles.contentContainer}>
        {selectionMode && (
          <Ionicons 
            name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
            size={24} 
            color={isSelected ? colors.tint : colors.textMuted}
            style={{ marginRight: 12 }}
          />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.content, { color: colors.text }]} numberOfLines={3} ellipsizeMode="tail">
            {thought.content}
          </Text>
          <View style={styles.meta}>
            <Text style={[styles.time, { color: colors.textDim }]}>{relativeTime}</Text>
            {thought.synced === 0 && <Text style={[styles.unsyncedDot, { color: colors.textDim }]}>·</Text>}
          </View>
        </View>
      </View>
    </Pressable>
  )
}

export default memo(ThoughtRow)

const styles = StyleSheet.create({
  row: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
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
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  unsyncedDot: {
    fontSize: 18,
    lineHeight: 14,
    marginTop: -2,
  },
})
