import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProfile, updateProfile } from '../../src/db/seed';
import { colors, spacing, typography } from '../../src/theme';

export default function ProfileScreen() {
  const [haptics, setHaptics] = useState(true);
  const [sound, setSound] = useState(true);
  const [voice, setVoice] = useState(false);
  const [keepAwake, setKeepAwake] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const p = await getProfile();
        if (!p) return;
        setHaptics(p.hapticsEnabled);
        setSound(p.soundEnabled);
        setVoice(p.voiceEnabled);
        setKeepAwake(p.keepAwakeEnabled);
      })();
    }, []),
  );

  const save = async (patch: Record<string, boolean>) => {
