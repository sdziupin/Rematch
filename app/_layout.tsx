import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { View, ActivityIndicator } from 'react-native';
import { runMigrations } from '../src/db/client';
import { seedDatabaseIfNeeded } from '../src/db/seed';
import { colors } from '../src/theme';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({
    BebasNeue: BebasNeue_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  useEffect(() => {
    (async () => {
      runMigrations();
      await seedDatabaseIfNeeded();
      setReady(true);
    })();
  }, []);

  if (!fontsLoaded || !ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
