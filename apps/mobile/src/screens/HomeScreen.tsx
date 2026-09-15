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
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import NetInfo from '@react-native-community/netinfo'
import { Ionicons } from '@expo/vector-icons'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { RootStackParamList } from '../../App'
import { useThoughtStore } from '../store/thoughtStore'
import { useThemeStore, getThemeColors } from '../store/themeStore'
import CaptureCard from '../components/CaptureCard'
import ThoughtRow from '../components/ThoughtRow'
import { useAuthStore } from '../store/authStore'
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

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <Pressable onPress={toggleTheme} style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Image 
            source={require('../../assets/logo_thinkollect.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: colors.text }]}>Thinkollect</Text>
        </View>
        {totalCount > 0 && (
          <Text style={[styles.counter, { color: colors.textDim }]}>{totalCount}</Text>
        )}
      </Pressable>

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
            <Text style={{ color: colors.text }}>Cancel</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            {selectedIds.size} Selected
          </Text>
          <Pressable onPress={deleteSelected} style={styles.selectionBtn} disabled={selectedIds.size === 0}>
            <Text style={{ color: selectedIds.size > 0 ? colors.danger : colors.textMuted, fontWeight: '600' }}>Delete</Text>
          </Pressable>
        </View>
      )}

      {/* Settings FAB */}
      {!selectionMode && (
        <Pressable 
          style={[styles.fab, { backgroundColor: colors.tint }]} 
          onPress={() => setSettingsVisible(true)}
        >
          <Ionicons name="settings-outline" size={24} color="#fff" />
        </Pressable>
      )}

      {/* Settings Modal */}
      <Modal visible={settingsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Settings</Text>
            
            <Pressable 
              style={[styles.modalOption, { borderBottomColor: colors.border }]}
              onPress={() => {
                setSettingsVisible(false)
                setSelectionMode(true)
              }}
            >
              <Ionicons name="create-outline" size={22} color={colors.text} />
              <Text style={[styles.modalOptionText, { color: colors.text }]}>Edit Thoughts</Text>
            </Pressable>

            <Pressable 
              style={[styles.modalOption, { borderBottomColor: colors.border }]}
              onPress={() => {
                setSettingsVisible(false)
                triggerSync()
              }}
            >
              <Ionicons name="sync-outline" size={22} color={colors.text} />
              <Text style={[styles.modalOptionText, { color: colors.text }]}>Sync Now</Text>
            </Pressable>

            <Pressable 
              style={[styles.modalOption, { borderBottomColor: colors.border }]}
              onPress={() => {
                setSettingsVisible(false)
                useAuthStore.getState().logout()
              }}
            >
              <Ionicons name="log-out-outline" size={22} color={colors.text} />
              <Text style={[styles.modalOptionText, { color: colors.text }]}>Log Out</Text>
            </Pressable>

            <Pressable 
              style={styles.modalCloseBtn}
              onPress={() => setSettingsVisible(false)}
            >
              <Text style={{ color: colors.tint, fontWeight: '600', fontSize: 16 }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Coming Soon Modal */}
      <Modal visible={comingSoonVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bg, borderColor: colors.border, alignItems: 'center', padding: 32 }]}>
            <Ionicons name="construct-outline" size={48} color={colors.tint} style={{ marginBottom: 16 }} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Coming Soon</Text>
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginBottom: 24, marginTop: 8 }}>
              This feature is under construction and will be available in a future update.
            </Text>
            <Pressable 
              style={[styles.dumpBtn, { backgroundColor: colors.tint, borderWidth: 0 }]}
              onPress={() => setComingSoonVisible(false)}
            >
              <Text style={{ color: '#fff', fontWeight: '600', paddingHorizontal: 16, paddingVertical: 4 }}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
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
  logo: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  title: {
    fontSize: 18,
    fontFamily: 'System',
    fontWeight: '600', // Semibold
    letterSpacing: 2, // Extra space
  },
  counter: {
    fontSize: 12,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  selectionBtn: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  modalOptionText: {
    fontSize: 16,
  },
  modalCloseBtn: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 12,
  },
  dumpBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 6,
  },
})
