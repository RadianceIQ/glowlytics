import 'react-native-get-random-values';
import React, { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../src/constants/theme';
import { useStore } from '../src/store/useStore';

export default function RootLayout() {
  const loadPersistedData = useStore((s) => s.loadPersistedData);
  const loaded = useRef(false);
  const [fontsLoaded] = useFonts({
    'Switzer-Regular': require('../assets/fonts/Switzer-Regular.ttf'),
    'Switzer-Bold': require('../assets/fonts/Switzer-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded && !loaded.current) {
      loaded.current = true;
      setTimeout(() => loadPersistedData(), 0);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        </Stack>
      </View>
    </SafeAreaProvider>
  );
}
