import React, { useEffect, useRef, useCallback } from 'react'
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  AppState,
  type AppStateStatus,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import NetInfo from '@react-native-community/netinfo'
import { useThoughtStore } from '../store/thoughtStore'
import CaptureCard from '../components/CaptureCard'
import ThoughtRow from '../components/ThoughtRow'
import type { Thought } from '../types'

export default function HomeScreen() {
  const thoughts = useThoughtStore((s) => s.thoughts)
  const totalCount = useThoughtStore((s) => s.totalCount)
  const loadThoughts = useThoughtStore((s) => s.loadThoughts)
  const triggerSync = useThoughtStore((s) => s.triggerSync)

  // Track app state for sync on foreground
  const appState = useRef(AppState.currentState)

  const handleAppStateChange = useCallback(
    (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        triggerSync()
      }
      appState.current = nextState
    },
    [triggerSync]
  )

  useEffect(() => {
    // Init: load all thoughts from SQLite on mount
    loadThoughts()

    // Sync on reconnect
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        triggerSync()
      }
    })

    // Sync when app comes to foreground
    const unsubscribeApp = AppState.addEventListener('change', handleAppStateChange)

    return () => {
      unsubscribeNet()
      unsubscribeApp.remove()
    }
  }, [loadThoughts, triggerSync, handleAppStateChange])

  const renderThought = useCallback(
    ({ item }: { item: Thought }) => <ThoughtRow thought={item} />,
    []
  )

  const keyExtractor = useCallback((item: Thought) => item.id, [])

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>thinkollect</Text>
        {totalCount > 0 && (
          <Text style={styles.counter}>{totalCount}</Text>
        )}
      </View>

      {/* Capture card — always at top */}
      <CaptureCard />

      {/* Divider */}
      {thoughts.length > 0 && <View style={styles.divider} />}

      {/* Thoughts stream */}
      <FlatList
        data={thoughts}
        renderItem={renderThought}
        keyExtractor={keyExtractor}
        style={styles.list}
        contentContainerStyle={thoughts.length === 0 ? styles.emptyContainer : undefined}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={styles.empty}>no thoughts yet.{'\n'}dump your first one.</Text>
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={20}
        initialNumToRender={20}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  title: {
    color: '#f5f5f5',
    fontSize: 16,
    fontFamily: 'System',
    fontWeight: '500',
    letterSpacing: 1,
  },
  counter: {
    color: '#3a3a3a',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#1a1a1a',
    marginTop: 16,
  },
  list: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  empty: {
    color: '#2a2a2a',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'System',
  },
})
