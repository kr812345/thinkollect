import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore, PASSWORD_MIN_LENGTH } from '../store/authStore'
import { useThemeStore, getThemeColors } from '../store/themeStore'

export default function SignUpScreen({ navigation }: any) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const theme = useThemeStore((s) => s.theme)
  const colors = getThemeColors(theme)
  const signUp = useAuthStore((s) => s.signUp)

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password')
      return
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      Alert.alert('Error', `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
      return
    }

    setLoading(true)
    try {
      await signUp(email.trim(), password)
      // On success, state updates and navigation changes automatically if session is set.
    } catch (error: any) {
      Alert.alert('Sign Up Error', error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Join Thinkollect today</Text>
          
          <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Ionicons name="mail-outline" size={16} color={colors.textMuted} style={styles.icon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} style={styles.icon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            At least {PASSWORD_MIN_LENGTH} characters
          </Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.tint }]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onTint} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.onTint }]}>Sign Up</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.linkContainer}>
            <Text style={[styles.link, { color: colors.tint }]}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '600', marginBottom: 6, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, marginBottom: 28 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 14 },
  eyeIcon: { padding: 4 },
  hint: { fontSize: 11, marginTop: -4, marginBottom: 12, marginLeft: 2 },
  button: { height: 38, minWidth: 140, paddingHorizontal: 22, borderRadius: 8, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  buttonText: { fontSize: 14, fontWeight: '500' },
  linkContainer: { marginTop: 20, alignItems: 'center' },
  link: { fontSize: 13, fontWeight: '500' },
})
