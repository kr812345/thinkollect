import React, { useEffect, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { initDb } from './src/db/local'
import HomeScreen from './src/screens/HomeScreen'
import DetailScreen from './src/screens/DetailScreen'
import { useThemeStore, getThemeColors } from './src/store/themeStore'

export type RootStackParamList = {
  Home: undefined
  Detail: { id: string }
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function App() {
  const [isDbReady, setIsDbReady] = useState(false)
  const theme = useThemeStore((s) => s.theme)
  const colors = getThemeColors(theme)

  useEffect(() => {
    try {
      initDb()
      setIsDbReady(true)
    } catch (e) {
      console.error('Failed to initialize DB', e)
    }
  }, [])

  if (!isDbReady) {
    return null
  }

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: colors.bg,
      card: colors.bg,
      text: colors.text,
      border: colors.border,
      primary: colors.tint,
    }
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Detail" component={DetailScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
