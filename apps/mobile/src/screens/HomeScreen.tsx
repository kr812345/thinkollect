import React, { useEffect, useRef, useCallback, useState } from 'react'
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  AppState,
  type AppStateStatus,
  Pressable,
  Image,
  Modal,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { GestureDetector } from 'react-native-gesture-handler'
import NetInfo from '@react-native-community/netinfo'
import { Ionicons } from '@expo/vector-icons'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { RootStackParamList } from '../../App'
import { useThoughtStore } from '../store/thoughtStore'
import { useThemeStore, getThemeColors } from '../store/themeStore'
import CaptureCard from '../components/CaptureCard'
import ThoughtRow from '../components/ThoughtRow'
import { useAuthStore } from '../store/authStore'
import { useSwipeLeft } from '../lib/useSwipeLeft'
import type { Thought } from '../types'

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>

export default function HomeScreen({ navigation }: Props) {
  const thoughts = useThoughtStore((s) => s.thoughts)
  const totalCount = useThoughtStore((s) => s.totalCount)
  const loadThoughts = useThoughtStore((s) => s.loadThoughts)
  const triggerSync = useThoughtStore((s) => s.triggerSync)
  const removeThoughts = useThoughtStore((s) => s.removeThoughts)

  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const colors = getThemeColors(theme)

  const [settingsVisible, setSettingsVisible] = useState(false)
  const [comingSoonVisible, setComingSoonVisible] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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
    loadThoughts()
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) triggerSync()
    })
    const unsubscribeApp = AppState.addEventListener('change', handleAppStateChange)
    return () => {
      unsubscribeNet()
      unsubscribeApp.remove()
    }
  }, [loadThoughts, triggerSync, handleAppStateChange])

  const handleThoughtPress = useCallback((thought: Thought) => {
    if (selectionMode) {
      const next = new Set(selectedIds)
      if (next.has(thought.id)) next.delete(thought.id)
      else next.add(thought.id)
      setSelectedIds(next)
    } else {
      navigation.navigate('Detail', { id: thought.id })
    }
  }, [selectionMode, selectedIds, navigation])

  const handleThoughtLongPress = useCallback((thought: Thought) => {
    if (!selectionMode) {
      setSelectionMode(true)
      setSelectedIds(new Set([thought.id]))
    }
  }, [selectionMode])

  const renderThought = useCallback(
    ({ item }: { item: Thought }) => (
      <ThoughtRow 
        thought={item} 
        onPress={() => handleThoughtPress(item)}
        onLongPress={() => handleThoughtLongPress(item)}
        selectionMode={selectionMode}
        isSelected={selectedIds.has(item.id)}
      />
    ),
    [handleThoughtPress, handleThoughtLongPress, selectionMode, selectedIds]
  )

  const deleteSelected = () => {
    removeThoughts(Array.from(selectedIds))
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  const cancelSelection = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  const swipeToChat = useSwipeLeft(() => navigation.navigate('Mind', { tab: 'chat' }), !selectionMode)

  return (
    <GestureDetector gesture={swipeToChat}>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={toggleTheme} style={styles.headerTitleContainer}>
            <Image 
              source={require('../../assets/logo_thinkollect.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.title, { color: colors.text }]}>Thinkollect</Text>
            {totalCount > 0 && (
              <Text style={[styles.counter, { color: colors.textDim }]}>{totalCount}</Text>
            )}
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Mind')} style={styles.mindBtn} accessibilityLabel="Open mind map">
            <Ionicons name="git-network-outline" size={20} color={colors.insight} />
          </Pressable>
        </View>

        <CaptureCard />

        {thoughts.length > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}

        <FlatList
          data={thoughts}
          renderItem={renderThought}
          keyExtractor={item => item.id}
          style={styles.list}
          contentContainerStyle={thoughts.length === 0 ? styles.emptyContainer : undefined}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              no thoughts yet.{'\n'}dump your first one.
            </Text>
          }
          showsVerticalScrollIndicator={false}
        />

        {/* Selection Mode Bottom Bar */}
        {selectionMode && (
          <View style={[styles.selectionBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <Pressable onPress={cancelSelection} style={styles.selectionBtn}>
              <Text style={{ color: colors.text, fontSize: 13 }}>Cancel</Text>
            </Pressable>
              <Text style={{ color: colors.text, fontWeight: '500', fontSize: 13 }}>
                {selectedIds.size} Selected
              </Text>
            <Pressable onPress={deleteSelected} style={styles.selectionBtn} disabled={selectedIds.size === 0}>
              <Text style={{ color: selectedIds.size > 0 ? colors.danger : colors.textMuted, fontWeight: '500', fontSize: 13 }}>Delete</Text>
            </Pressable>
          </View>
        )}

        {/* Settings FAB */}
        {!selectionMode && (
          <Pressable 
            style={[styles.fab, { backgroundColor: colors.card, borderColor: colors.border }]} 
            onPress={() => setSettingsVisible(true)}
          >
            <Ionicons name="settings-outline" size={18} color={colors.textMuted} />
          </Pressable>
        )}

        {/* Settings Modal */}
        <Modal visible={settingsVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Settings</Text>
              
              <Pressable 
                style={[styles.modalOption, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setSettingsVisible(false)
                  setSelectionMode(true)
                }}
              >
                <Ionicons name="create-outline" size={18} color={colors.text} />
                <Text style={[styles.modalOptionText, { color: colors.text }]}>Edit Thoughts</Text>
              </Pressable>

              <Pressable 
                style={[styles.modalOption, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setSettingsVisible(false)
                  navigation.navigate('Mind')
                }}
              >
                <Ionicons name="git-network-outline" size={18} color={colors.text} />
                <Text style={[styles.modalOptionText, { color: colors.text }]}>Mind</Text>
              </Pressable>

              <Pressable 
                style={[styles.modalOption, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setSettingsVisible(false)
                  triggerSync()
                }}
              >
                <Ionicons name="sync-outline" size={18} color={colors.text} />
                <Text style={[styles.modalOptionText, { color: colors.text }]}>Sync Now</Text>
              </Pressable>

              <Pressable 
                style={[styles.modalOption, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setSettingsVisible(false)
                  useAuthStore.getState().logout()
                }}
              >
                <Ionicons name="log-out-outline" size={18} color={colors.text} />
                <Text style={[styles.modalOptionText, { color: colors.text }]}>Log Out</Text>
              </Pressable>

              <Pressable 
                style={styles.modalCloseBtn}
                onPress={() => setSettingsVisible(false)}
              >
                <Text style={{ color: colors.tint, fontWeight: '500', fontSize: 14 }}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Coming Soon Modal */}
        <Modal visible={comingSoonVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.bg, borderColor: colors.border, alignItems: 'center', padding: 32 }]}>
              <Ionicons name="construct-outline" size={36} color={colors.tint} style={{ marginBottom: 12 }} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>Coming Soon</Text>
              <Text style={{ color: colors.textMuted, textAlign: 'center', marginBottom: 24, marginTop: 8 }}>
                This feature is under construction and will be available in a future update.
              </Text>
              <Pressable 
                style={[styles.dumpBtn, { backgroundColor: colors.tint, borderWidth: 0 }]}
                onPress={() => setComingSoonVisible(false)}
              >
                <Text style={{ color: colors.onTint, fontWeight: '500', fontSize: 13 }}>Got it</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mindBtn: {
    padding: 8,
  },
  logo: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  title: {
    fontSize: 16,
    fontFamily: 'System',
    fontWeight: '500',
    letterSpacing: 1.5,
  },
  counter: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
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
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'System',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 32,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  selectionBtn: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  modalOptionText: {
    fontSize: 14,
  },
  modalCloseBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dumpBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 8,
  },
})
