import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { InterTight_600SemiBold, InterTight_700Bold } from '@expo-google-fonts/inter-tight';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { openExpoDriver } from '../src/db/expoDriver';
import { claimTab, takeOverTab } from '../src/db/tabLock';
import { initDatabase } from '../src/db/seed';
import { getProfile } from '../src/db/repository';
import { useSettings } from '../src/store/settingsStore';
import { DialogHost } from '../src/components/Dialogs';
import { Button } from '../src/components/Button';
import { colors, spacing } from '../src/theme';

type Boot = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string } | { status: 'elsewhere' } | { status: 'no-storage' };

let bootPromise: Promise<'ready' | 'elsewhere' | 'no-storage'> | null = null;

function registerServiceWorker() {
  // Production web builds work offline after the first visit (see public/sw.js).
  if (Platform.OS !== 'web' || __DEV__ || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

async function boot(): Promise<'ready' | 'elsewhere' | 'no-storage'> {
  registerServiceWorker();
  const tab = await claimTab();
  if (tab !== 'owner') return tab;
  const driver = await openExpoDriver();
  await initDatabase(driver);
  useSettings.getState().applyProfile(await getProfile());
  return 'ready';
}

export default function RootLayout() {
  const [boot_, setBoot] = useState<Boot>({ status: 'loading' });
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    InterTight_600SemiBold,
    InterTight_700Bold,
  });

  const start = useCallback(() => {
    setBoot({ status: 'loading' });
    bootPromise ??= boot();
    bootPromise
      .then((status) => setBoot({ status }))
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

  if (boot_.status === 'elsewhere') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>REMATCH is open in another tab</Text>
        <Text style={styles.body}>Your data can only be open in one tab at a time.</Text>
        <Button title="Use REMATCH here" onPress={() => void takeOverTab()} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  if (boot_.status === 'no-storage') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Storage isn't available</Text>
        <Text style={styles.body}>
          REMATCH keeps your workouts in this browser's private storage, which this window doesn't allow (private browsing often blocks it). Open REMATCH in a regular window.
        </Text>
      </View>
    );
  }

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
        <ActivityIndicator color={colors.textMuted} />
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

// Fonts may still be loading here, so these screens use the system font.
const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4, color: colors.text, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, maxWidth: 420 },
  detail: { fontSize: 13, lineHeight: 18, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
});
