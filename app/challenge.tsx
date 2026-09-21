import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { WorkoutHeroCard } from '../src/components/WorkoutCard';
import { getProfile, getWorkoutById } from '../src/db/seed';
import { recommendWorkout, focusLabel, difficultyLabel } from '../src/services/recommendationService';
import { colors, spacing, typography } from '../src/theme';

const DURATIONS = [5, 10, 15, 20, 30];

export default function ChallengeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ minutes?: string }>();
  const initial = params.minutes ? Number(params.minutes) : 15;
  const [minutes, setMinutes] = useState(initial);
  const [preview, setPreview] = useState<any>(null);

  const pick = async (m: number) => {
    setMinutes(m);
    const profile = await getProfile();
    const rec = recommendWorkout({
      minutes: m,
      level: profile?.level ?? 'intermediate',
      goal: profile?.goal ?? 'conditioning',
      equipment: JSON.parse(profile?.equipmentJson ?? '["bodyweight"]'),
      recentWorkoutIds: [],
      painRecent: false,
    });
    const w = await getWorkoutById(rec.workoutId);
    setPreview(w);
  };

  React.useEffect(() => {
    pick(initial);
