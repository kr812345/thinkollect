import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView } from 'react-native'
import { supabase } from '../lib/supabase'
import { useThemeStore, getThemeColors } from '../store/themeStore'

export default function SignInScreen({ navigation }: any) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const theme = useThemeStore((s) => s.theme)
  const colors = getThemeColors(theme)

  const handleSignIn = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter both username and password')
      return
    }

    setLoading(true)
    const email = `${username.trim()}@thinkollect.app`
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    setLoading(false)

    if (error) {
      Alert.alert('Sign In Error', error.message)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>Sign In</Text>
        
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="Username"
          placeholderTextColor={colors.textMuted}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: colors.tint }]} 
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('SignUp')} style={styles.linkContainer}>
          <Text style={[styles.link, { color: colors.tint }]}>Don't have an account? Sign up</Text>
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
