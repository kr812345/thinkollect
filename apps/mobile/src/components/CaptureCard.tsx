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
import { useThemeStore, getThemeColors } from '../store/themeStore'

const MAX_LENGTH = 2000

export default function CaptureCard() {
  const [text, setText] = useState('')
  const inputRef = useRef<TextInput>(null)
  const addThought = useThoughtStore((s) => s.addThought)
  
  const theme = useThemeStore((s) => s.theme)
  const colors = getThemeColors(theme)

  const handleDump = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed) return

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    setText('')
    inputRef.current?.focus()

    await addThought({ content: trimmed, tags: [] })
  }, [text, addThought])

  const remaining = MAX_LENGTH - text.length
  const isOverLimit = remaining < 0

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TextInput
        ref={inputRef}
        style={[styles.input, { color: colors.text }]}
        value={text}
        onChangeText={setText}
        placeholder="What's the thought?"
        placeholderTextColor={colors.textDim}
        multiline
        autoFocus
        autoCorrect={false}
        autoCapitalize="sentences"
        maxLength={MAX_LENGTH + 50}
        selectionColor={colors.tint}
        returnKeyType="default"
        blurOnSubmit={false}
      />

      <View style={styles.footer}>
        {text.length > 0 && (
          <Text style={[styles.counter, { color: colors.textDim }, isOverLimit && { color: colors.danger }]}>
            {remaining}
          </Text>
        )}
        <Pressable
          onPress={handleDump}
          disabled={!text.trim() || isOverLimit}
          style={({ pressed }) => [
            styles.dumpBtn,
            { borderColor: colors.text },
            (!text.trim() || isOverLimit) && { borderColor: colors.border },
            pressed && { backgroundColor: colors.text },
          ]}
          accessibilityLabel="Dump thought"
          accessibilityRole="button"
        >
          {({ pressed }) => (
            <Text style={[
              styles.dumpBtnText,
              { color: colors.text },
              (!text.trim() || isOverLimit) && { color: colors.textDim },
              pressed && { color: colors.bg }
            ]}>
              dump
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    minHeight: 140,
  },
  input: {
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
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  dumpBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 6,
  },
  dumpBtnText: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
})
