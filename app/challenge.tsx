import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../src/components/Button';
import { WorkoutHeroCard } from '../src/components/WorkoutCard';
import { ChipRow, Screen, ScreenHeader } from '../src/components/ui';
import { WORKOUT_SEEDS } from '../src/content/seed';
import { getProfile, getWorkoutById, profileEquipment } from '../src/db/repository';
import type { WorkoutRow } from '../src/db/schema';
import type { WorkoutStructure } from '../src/domain/types';
import { formatLabel } from '../src/engine/workoutEngine';
import { difficultyLabel, focusLabel, recommendWorkout } from '../src/services/recommendationService';
import { getRecentWorkoutIds, getWorkoutStatsMap, hadPainRecently } from '../src/services/sessionService';
import { colors, spacing, typography } from '../src/theme';

const DURATIONS = [5, 10, 15, 20, 30] as const;

export default function ChallengeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ minutes?: string }>();
  const initial = (DURATIONS as readonly number[]).includes(Number(params.minutes)) ? (Number(params.minutes) as (typeof DURATIONS)[number]) : 15;
  const [minutes, setMinutes] = useState<(typeof DURATIONS)[number]>(initial);
  const [roll, setRoll] = useState(0);
  const [preview, setPreview] = useState<WorkoutRow | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getWorkoutStatsMap>>>({});

  const pick = useCallback(async (m: number, seed: number) => {
    const [profile, recent, pain, s] = await Promise.all([getProfile(), getRecentWorkoutIds(), hadPainRecently(), getWorkoutStatsMap()]);
    const rec = recommendWorkout({
      minutes: m,
      level: profile?.level ?? 'intermediate',
      goal: profile?.goal ?? 'conditioning',
      equipment: profileEquipment(profile),
      recentWorkoutIds: recent,
      painRecent: pain,
      daySeed: Math.floor(Date.now() / 86_400_000) + seed,
      pool: WORKOUT_SEEDS,
    });
    setStats(s);
    setPreview(await getWorkoutById(rec.workoutId));
  }, []);

  useEffect(() => {
    void pick(minutes, roll);
  }, [minutes, roll, pick]);

  return (
    <Screen narrow>
      <ScreenHeader title="CHALLENGE ME" subtitle="Pick your time. We'll pick the opponent." onBack={() => router.back()} />
      <ChipRow options={DURATIONS} value={minutes} onChange={setMinutes} format={(d) => `${d} min`} />
      <View style={{ marginTop: spacing.lg }}>
        {preview && (
          <WorkoutHeroCard
            name={preview.name}
            symbol={preview.symbol}
            color={preview.identityColor}
            format={formatLabel(preview.format as WorkoutStructure['format'])}
            meta={`${focusLabel(preview.focus)} · ${difficultyLabel(preview.difficulty)}`}
            duration={`${preview.estimatedMinutesMin}–${preview.estimatedMinutesMax} min`}
            description={preview.description}
            pb={stats[preview.id]?.pb ?? null}
            last={stats[preview.id]?.last ?? null}
            onPress={() => router.push(`/workout/${preview.id}`)}
          />
        )}
      </View>
      {preview && (
        <View style={styles.actions}>
          <Button title="LET'S GO" icon="play" size="lg" onPress={() => router.push(`/workout/${preview.id}`)} />
          <Button title="Something else" icon="swap" variant="ghost" onPress={() => setRoll((r) => r + 1)} />
        </View>
      )}
      <Text style={styles.note}>Picked for your level, equipment and recent sessions. Low-impact options appear after you report pain.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm, marginTop: spacing.lg },
  note: { ...typography.caption, color: colors.muted, textAlign: 'center', marginTop: spacing.lg },
});
