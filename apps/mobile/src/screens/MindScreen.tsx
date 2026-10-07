import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
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

function snippet(text: string, max = 42): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean
}

export default function MindScreen({ navigation }: Props) {
  const theme = useThemeStore((s) => s.theme)
  const colors = getThemeColors(theme)
  const [tab, setTab] = useState<Tab>('map')

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>mind</Text>
        <View style={{ width: 42 }} />
      </View>

      <View style={[styles.tabs, { borderColor: colors.border }]}>
        {(['map', 'chat'] as Tab[]).map((name) => (
          <Pressable
            key={name}
            onPress={() => setTab(name)}
            style={[
              styles.tab,
              tab === name && { backgroundColor: colors.card, borderColor: colors.insight },
            ]}
          >
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
              stroke={colors.border}
              strokeWidth={1}
            />
          )
        })}
      </Svg>
      {nodes.map((node) => {
        const pos = layout.positions[node.id]
        if (!pos) return null
        return (
          <Pressable
            key={node.id}
            onPress={() => navigation.navigate('Detail', { id: node.id })}
            style={[
              styles.node,
              {
                left: pos.x - 54,
                top: pos.y - 28,
                backgroundColor: colors.card,
                borderColor: colors.insight,
              },
            ]}
          >
            <Text style={[styles.nodeText, { color: colors.text }]} numberOfLines={2}>
              {snippet(node.content, 36)}
            </Text>
          </Pressable>
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
                ? { alignSelf: 'flex-end', backgroundColor: colors.card, borderColor: colors.insight }
                : { alignSelf: 'flex-start', backgroundColor: colors.surface, borderColor: colors.border },
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
            <Ionicons name="arrow-up" size={18} color={draft.trim() ? colors.insight : colors.textDim} />
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
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 2,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    margin: 16,
    borderWidth: 1,
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
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
  nodeText: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  chatList: { padding: 16, gap: 10, paddingBottom: 24 },
  chatEmpty: { flex: 1, justifyContent: 'center', paddingBottom: 80 },
  bubble: {
    maxWidth: '86%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
