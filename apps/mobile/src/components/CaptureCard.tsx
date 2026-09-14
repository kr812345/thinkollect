import React, { useRef, useState, useCallback } from 'react'
import {
  View,
  TextInput,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { useThoughtStore } from '../store/thoughtStore'

const MAX_LENGTH = 2000

export default function CaptureCard() {
  const [text, setText] = useState('')
  const inputRef = useRef<TextInput>(null)
  const addThought = useThoughtStore((s) => s.addThought)

  const handleDump = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed) return

    // Instant tactile feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    setText('')
    inputRef.current?.focus()

    // Save — local write is synchronous so it's instant
    await addThought({ content: trimmed, tags: [] })
  }, [text, addThought])

  const remaining = MAX_LENGTH - text.length
  const isOverLimit = remaining < 0

  return (
    <View style={styles.card}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="What's the thought?"
        placeholderTextColor="#333333"
        multiline
        autoFocus
        autoCorrect={false}
        autoCapitalize="sentences"
        maxLength={MAX_LENGTH + 50}
        selectionColor="#f5f5f5"
        returnKeyType="default"
        blurOnSubmit={false}
      />

      <View style={styles.footer}>
        {text.length > 0 && (
          <Text style={[styles.counter, isOverLimit && styles.counterOver]}>
            {remaining}
          </Text>
        )}
        <Pressable
          onPress={handleDump}
          disabled={!text.trim() || isOverLimit}
          style={({ pressed }) => [
            styles.dumpBtn,
            (!text.trim() || isOverLimit) && styles.dumpBtnDisabled,
            pressed && styles.dumpBtnPressed,
          ]}
          accessibilityLabel="Dump thought"
          accessibilityRole="button"
        >
          <Text style={styles.dumpBtnText}>dump</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    minHeight: 140,
  },
  input: {
    color: '#f5f5f5',
    fontSize: 17,
    lineHeight: 26,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 12,
  },
  counter: {
    color: '#3a3a3a',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  counterOver: {
    color: '#ef4444',
  },
  dumpBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#f5f5f5',
    borderRadius: 6,
  },
  dumpBtnDisabled: {
    borderColor: '#2a2a2a',
  },
  dumpBtnPressed: {
    backgroundColor: '#f5f5f5',
  },
  dumpBtnText: {
    color: '#f5f5f5',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
})
