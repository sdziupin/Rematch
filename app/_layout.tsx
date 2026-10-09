import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { openExpoDriver } from '../src/db/expoDriver';
import { initDatabase } from '../src/db/seed';
import { getProfile } from '../src/db/repository';
import { useSettings } from '../src/store/settingsStore';
import { DialogHost } from '../src/components/Dialogs';
import { Button } from '../src/components/Button';
import { colors, spacing, typography } from '../src/theme';

type Boot = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

let bootPromise: Promise<void> | null = null;

function registerServiceWorker() {
  // Production web builds work offline after the first visit (see public/sw.js).
  if (Platform.OS !== 'web' || __DEV__ || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

async function boot() {
  registerServiceWorker();
  const driver = await openExpoDriver();
  await initDatabase(driver);
  useSettings.getState().applyProfile(await getProfile());
}

export default function RootLayout() {
  const [boot_, setBoot] = useState<Boot>({ status: 'loading' });
  const [fontsLoaded, fontError] = useFonts({
    BebasNeue: BebasNeue_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  const start = useCallback(() => {
    setBoot({ status: 'loading' });
    bootPromise ??= boot();
    bootPromise
      .then(() => setBoot({ status: 'ready' }))
      .catch((error: unknown) => {
        bootPromise = null;
        console.error('[rematch] startup failed', error);
        setBoot({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });
  }, []);

  useEffect(() => {
    start();
  }, [start]);

  // Fonts that fail to load fall back to system fonts rather than blocking the app.
  const fontsReady = fontsLoaded || !!fontError;

  if (boot_.status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>REMATCH couldn't start</Text>
        <Text style={styles.body}>Your local database failed to open. Nothing has been deleted.</Text>
        <Text style={styles.detail}>{boot_.message}</Text>
        <Button title="Try again" onPress={() => (Platform.OS === 'web' ? window.location.reload() : start())} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  if (!fontsReady || boot_.status !== 'ready') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade_from_bottom' }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen name="challenge" options={{ presentation: 'modal' }} />
        <Stack.Screen name="workout/[id]" />
        <Stack.Screen name="workout/active" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="workout/result" options={{ gestureEnabled: false }} />
        <Stack.Screen name="workout/recovery" />
        <Stack.Screen name="opponent/[workoutId]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="exercise/[id]" />
        <Stack.Screen name="program/[id]" />
        <Stack.Screen name="builder" />
      </Stack>
      <DialogHost />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  title: { ...typography.heading, color: colors.primary, fontFamily: undefined, fontWeight: '700' },
  body: { ...typography.body, color: colors.secondary, fontFamily: undefined, textAlign: 'center', marginTop: spacing.sm },
  detail: { ...typography.caption, color: colors.muted, fontFamily: undefined, textAlign: 'center', marginTop: spacing.sm },
});
