import 'react-native-get-random-values';
import React, { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { Colors } from '../src/constants/theme';
import { useStore } from '../src/store/useStore';

export default function RootLayout() {
  const loadPersistedData = useStore((s) => s.loadPersistedData);
  const loaded = useRef(false);

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      setTimeout(() => loadPersistedData(), 0);
    }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'slide_from_right',
        }}
      />
    </View>
  );
}
