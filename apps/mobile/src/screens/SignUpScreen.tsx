import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView } from 'react-native'
import { supabase } from '../lib/supabase'
import { useThemeStore, getThemeColors } from '../store/themeStore'

export default function SignUpScreen({ navigation }: any) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const theme = useThemeStore((s) => s.theme)
  const colors = getThemeColors(theme)

  const handleSignUp = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter both username and password')
      return
    }

    setLoading(true)
    const email = `${username.trim()}@thinkollect.app`
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })
    setLoading(false)

    if (error) {
      Alert.alert('Sign Up Error', error.message)
    } else {
      Alert.alert('Success', 'Account created! You are now signed in.')
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>Sign Up</Text>
        
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="Choose a Username"
          placeholderTextColor={colors.textMuted}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="Choose a Password"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: colors.tint }]} 
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.linkContainer}>
          <Text style={[styles.link, { color: colors.tint }]}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 8, padding: 15, marginBottom: 15, fontSize: 16 },
  button: { padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  linkContainer: { marginTop: 20, alignItems: 'center' },
  link: { fontSize: 16 },
})
