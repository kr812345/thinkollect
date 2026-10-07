import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Line } from 'react-native-svg'
import { RootStackParamList } from '../../App'
import { useThemeStore, getThemeColors } from '../store/themeStore'
import { apiFetch } from '../lib/api'

type Props = NativeStackScreenProps<RootStackParamList, 'Mind'>
type Tab = 'map' | 'chat'

interface GraphNode {
  id: string
  content: string
  insight: string | null
  captured_at: string
}

interface GraphEdge {
  source: string
  target: string
  similarity: number
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: { id: string; content: string }[]
}

const CLUSTER_DEGREE = 3
const TABS_PADDING = 3

function snippet(text: string, max = 42): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean
}

export default function MindScreen({ navigation }: Props) {
  const theme = useThemeStore((s) => s.theme)
  const colors = getThemeColors(theme)
  const [tab, setTab] = useState<Tab>('map')
  const [tabWidth, setTabWidth] = useState(0)
  const indicator = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(indicator, {
      toValue: tab === 'map' ? 0 : 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 4,
    }).start()
  }, [tab, indicator])

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>mind</Text>
        <View style={{ width: 42 }} />
      </View>

      <View
        style={[styles.tabs, { backgroundColor: colors.surface }]}
        onLayout={(e) => setTabWidth((e.nativeEvent.layout.width - TABS_PADDING * 2) / 2)}
      >
        {tabWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.tabIndicator,
              {
                width: tabWidth,
                backgroundColor: colors.card,
                borderColor: colors.border,
                transform: [
                  { translateX: indicator.interpolate({ inputRange: [0, 1], outputRange: [0, tabWidth] }) },
                ],
              },
            ]}
          />
        )}
        {(['map', 'chat'] as Tab[]).map((name) => (
          <Pressable key={name} onPress={() => setTab(name)} style={styles.tab}>
            <Text style={[styles.tabText, { color: tab === name ? colors.text : colors.textMuted }]}>
              {name}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'map' ? <MapPane navigation={navigation} colors={colors} /> : <ChatPane colors={colors} />}
    </SafeAreaView>
  )
}

function MapPane({
  navigation,
  colors,
}: {
  navigation: Props['navigation']
  colors: ReturnType<typeof getThemeColors>
}) {
  const { width, height } = useWindowDimensions()
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/thoughts/graph')
      if (!res.ok) throw new Error('Could not load graph')
      const data = await res.json()
      setNodes(data.nodes || [])
      setEdges(data.edges || [])
    } catch (e: any) {
      setError(e.message || 'Could not load graph')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const layout = useMemo(() => {
    const cx = width / 2
    const cy = Math.max(220, (height - 220) / 2)
    const radius = Math.min(width, height) * 0.32
    const positions: Record<string, { x: number; y: number }> = {}
    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1) - Math.PI / 2
      positions[node.id] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      }
    })
    return { cx, cy, positions }
  }, [nodes, width, height])

  const degree = useMemo(() => {
    const counts: Record<string, number> = {}
    edges.forEach((edge) => {
      counts[edge.source] = (counts[edge.source] || 0) + 1
      counts[edge.target] = (counts[edge.target] || 0) + 1
    })
    return counts
  }, [edges])

  const pulse = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] })
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] })

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.insight} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.empty, { color: colors.textMuted }]}>{error}</Text>
        <Pressable onPress={load} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.insight }}>retry</Text>
        </Pressable>
      </View>
    )
  }

  if (nodes.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          no graph yet.{'\n'}dump a few thoughts, then sync.
        </Text>
      </View>
    )
  }

  const canvasH = Math.max(420, height - 180)

  return (
    <View style={{ flex: 1 }}>
      <Svg width={width} height={canvasH} style={StyleSheet.absoluteFill}>
        {edges.map((edge) => {
          const a = layout.positions[edge.source]
          const b = layout.positions[edge.target]
          if (!a || !b) return null
          return (
            <Line
              key={`${edge.source}-${edge.target}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={colors.insight}
              strokeOpacity={0.15 + 0.5 * Math.max(0, Math.min(1, edge.similarity))}
              strokeWidth={0.5}
            />
          )
        })}
      </Svg>
      {nodes.map((node) => {
        const pos = layout.positions[node.id]
        if (!pos) return null
        const isCluster = (degree[node.id] || 0) >= CLUSTER_DEGREE
        return (
          <React.Fragment key={node.id}>
            {isCluster && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.node,
                  styles.ring,
                  {
                    left: pos.x - 54,
                    top: pos.y - 28,
                    borderColor: colors.insight,
                    opacity: ringOpacity,
                    transform: [{ scale: ringScale }],
                  },
                ]}
              />
            )}
            <Pressable
              onPress={() => navigation.navigate('Detail', { id: node.id })}
              style={[
                styles.node,
                {
                  left: pos.x - 54,
                  top: pos.y - 28,
                  backgroundColor: colors.card,
                  borderColor: isCluster ? colors.insight : colors.border,
                },
              ]}
            >
              <Text style={[styles.nodeText, { color: colors.text }]} numberOfLines={2}>
                {snippet(node.content, 36)}
              </Text>
            </Pressable>
          </React.Fragment>
        )
      })}
    </View>
  )
}

function ChatPane({ colors }: { colors: ReturnType<typeof getThemeColors> }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const send = async () => {
    const text = draft.trim()
    if (!text || sending) return
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setDraft('')
    setSending(true)
    try {
      const history = next
        .filter((m) => m.id !== userMsg.id)
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }))
      const res = await apiFetch('/api/thoughts/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text, history }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Chat failed')
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.answer,
          sources: data.sources || [],
        },
      ])
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: 'assistant', content: e.message || 'Chat failed.' },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={8}
    >
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={messages.length === 0 ? styles.chatEmpty : styles.chatList}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            ask your notebook.{'\n'}answers come from linked ideas.
          </Text>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.role === 'user'
                ? { alignSelf: 'flex-end', backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }
                : { alignSelf: 'flex-start', backgroundColor: colors.insightBg, borderLeftColor: colors.insight, borderLeftWidth: 2 },
            ]}
          >
            <Text style={[styles.bubbleText, { color: colors.text }]}>{item.content}</Text>
            {item.sources && item.sources.length > 0 && (
              <View style={styles.sources}>
                {item.sources.slice(0, 3).map((s) => (
                  <Text key={s.id} style={[styles.sourceChip, { color: colors.insight, borderColor: colors.border }]}>
                    {snippet(s.content, 28)}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}
      />
      <View style={[styles.composer, { borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.composerInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
          value={draft}
          onChangeText={setDraft}
          placeholder="talk to your ideas"
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <Pressable
          onPress={send}
          disabled={sending || !draft.trim()}
          style={[styles.sendBtn, { borderColor: sending || !draft.trim() ? colors.border : colors.insight }]}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.insight} />
          ) : (
            <Ionicons name="arrow-up" size={15} color={draft.trim() ? colors.insight : colors.textDim} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { padding: 8 },
  title: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 2,
    fontWeight: '500',
  },
  tabs: {
    flexDirection: 'row',
    alignSelf: 'center',
    width: 200,
    margin: 12,
    borderRadius: 999,
    padding: TABS_PADDING,
  },
  tabIndicator: {
    position: 'absolute',
    top: TABS_PADDING,
    bottom: TABS_PADDING,
    left: TABS_PADDING,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
  },
  tabText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    letterSpacing: 1,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: {
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    lineHeight: 22,
  },
  node: {
    position: 'absolute',
    width: 108,
    minHeight: 56,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    justifyContent: 'center',
  },
  ring: {
    height: 56,
    backgroundColor: 'transparent',
  },
  nodeText: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  chatList: { padding: 16, gap: 10, paddingBottom: 24 },
  chatEmpty: { flex: 1, justifyContent: 'center', paddingBottom: 80 },
  bubble: {
    maxWidth: '86%',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  sources: { marginTop: 10, gap: 6 },
  sourceChip: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
