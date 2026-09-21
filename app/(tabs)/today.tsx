import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { WorkoutHeroCard } from '../../src/components/WorkoutCard';
import { getProfile, getWorkoutById } from '../../src/db/seed';
import { recommendTodayWorkout } from '../../src/services/recommendationService';
import { getLastResult, getPb } from '../../src/services/sessionService';
import { colors, spacing, typography } from '../../src/theme';
import { focusLabel, difficultyLabel } from '../../src/services/recommendationService';

export default function TodayScreen() {
  const router = useRouter();
  const [workout, setWorkout] = useState<any>(null);
  const [pb, setPb] = useState<number | null>(null);
  const [last, setLast] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const profile = await getProfile();
        const rec = recommendTodayWorkout({
          minutes: profile?.typicalMinutes ?? 15,
          level: profile?.level ?? 'intermediate',
          goal: profile?.goal ?? 'conditioning',
          equipment: JSON.parse(profile?.equipmentJson ?? '["bodyweight"]'),
          recentWorkoutIds: [],
          painRecent: false,
        });
