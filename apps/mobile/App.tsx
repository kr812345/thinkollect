import React, { useEffect, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { initDb } from './src/db/local'
import HomeScreen from './src/screens/HomeScreen'

export default function App() {
  const [isDbReady, setIsDbReady] = useState(false)

  useEffect(() => {
    // Initialize SQLite tables before rendering children
    try {
      initDb()
      setIsDbReady(true)
    } catch (e) {
      console.error('Failed to initialize DB', e)
    }
  }, [])

  if (!isDbReady) {
    return null // or a loading spinner
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <HomeScreen />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
