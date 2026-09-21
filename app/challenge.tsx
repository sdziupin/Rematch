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
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>CHALLENGE ME</Text>
        <Text style={styles.sub}>Pick your time. We'll pick the workout.</Text>
        <View style={styles.row}>
          {DURATIONS.map((d) => (
            <Button key={d} title={`${d}`} variant={minutes === d ? 'primary' : 'secondary'} onPress={() => pick(d)} style={styles.durationBtn} />
          ))}
        </View>
        {preview && (
          <WorkoutHeroCard
            name={preview.name}
            symbol={preview.symbol}
            meta={`${focusLabel(preview.focus)} · ${difficultyLabel(preview.difficulty)}`}
            duration={`${preview.estimatedMinutesMin}–${preview.estimatedMinutesMax} min`}
