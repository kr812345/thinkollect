import React, { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { initDb } from './src/db/local'
import HomeScreen from './src/screens/HomeScreen'

export default function App() {
  useEffect(() => {
    // Initialize SQLite tables on first boot — synchronous, instant
    initDb()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <HomeScreen />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
