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
    await updateProfile(patch);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.tagline}>You vs. you.</Text>
        <Setting label="Haptics" value={haptics} onChange={(v) => { setHaptics(v); save({ hapticsEnabled: v }); }} />
        <Setting label="Sound cues" value={sound} onChange={(v) => { setSound(v); save({ soundEnabled: v }); }} />
        <Setting label="Voice cues" value={voice} onChange={(v) => { setVoice(v); save({ voiceEnabled: v }); }} />
        <Setting label="Keep screen awake during workout" value={keepAwake} onChange={(v) => { setKeepAwake(v); save({ keepAwakeEnabled: v }); }} />
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerTitle}>Training safety</Text>
          <Text style={styles.disclaimerText}>Stop if you feel pain. Scale exercises as needed. REMATCH does not provide medical advice.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Setting({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.setting}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent }} />
    </View>
  );
