import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Share,
  Platform,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { RootStackParamList } from '../../App'
import { useThoughtStore } from '../store/thoughtStore'
import { useThemeStore, getThemeColors } from '../store/themeStore'

type Props = NativeStackScreenProps<RootStackParamList, 'Detail'>

export default function DetailScreen({ route, navigation }: Props) {
  const { id } = route.params
  const theme = useThemeStore((s) => s.theme)
  const colors = getThemeColors(theme)
  
  const thoughts = useThoughtStore((s) => s.thoughts)
  const editThought = useThoughtStore((s) => s.editThought)
  const removeThoughts = useThoughtStore((s) => s.removeThoughts)
  
  const thought = thoughts.find(t => t.id === id)
  const [content, setContent] = useState(thought?.content || '')

  useEffect(() => {
    if (!thought) {
      navigation.goBack()
    }
  }, [thought, navigation])

  if (!thought) return null

  const handleSave = () => {
    if (content.trim() && content !== thought.content) {
      editThought(id, content)
    }
    navigation.goBack()
  }

  const handleDelete = () => {
    removeThoughts([id])
    navigation.goBack()
  }

  const handleShare = async () => {
    try {
      await Share.share({
        message: thought.content,
      })
    } catch (error: any) {
      console.error(error.message)
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={handleSave} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>thought</Text>
        <View style={styles.headerRight}>
          <Pressable onPress={handleShare} style={styles.headerBtn}>
            <Ionicons name="share-outline" size={19} color={colors.text} />
          </Pressable>
          <Pressable onPress={handleDelete} style={styles.headerBtn}>
            <Ionicons name="trash-outline" size={19} color={colors.danger} />
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={content}
          onChangeText={setContent}
          multiline
          autoFocus
          selectionColor={colors.tint}
        />

        <View style={[styles.mentorCard, { backgroundColor: colors.insightBg, borderLeftColor: colors.insight }]}>
          <Text style={[styles.mentorLabel, { color: colors.insight }]}>mentor</Text>
          <Text style={[styles.mentorBody, { color: thought.insight ? colors.textMuted : colors.textDim }]}>
            {thought.insight || 'A short note will land here after sync.'}
          </Text>
        </View>
      </ScrollView>
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
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '500',
    letterSpacing: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBtn: {
    padding: 8,
  },
  body: {
    flex: 1,
  },
  input: {
    minHeight: 180,
    padding: 16,
    fontSize: 16,
    lineHeight: 25,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textAlignVertical: 'top',
  },
  mentorCard: {
    marginHorizontal: 16,
    marginBottom: 32,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderLeftWidth: 2,
  },
  mentorLabel: {
    fontSize: 11,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  mentorBody: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontStyle: 'italic',
  },
})
