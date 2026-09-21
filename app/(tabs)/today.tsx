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
        const w = await getWorkoutById(rec.workoutId);
        if (!w) return;
        setWorkout(w);
        const versionId = `${w.id}-v1`;
        const variantId = `${versionId}-full`;
        const pbRow = await getPb(w.id, versionId, variantId, 'rx');
        const lastRow = await getLastResult(w.id, variantId, 'rx');
        setPb(pbRow?.completionMs ?? null);
        setLast(lastRow?.completionMs ?? null);
      })();
    }, []),
  );

  if (!workout) return <SafeAreaView style={styles.safe} />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.brand}>REMATCH</Text>
        <Text style={styles.section}>TODAY</Text>

        <WorkoutHeroCard
          name={workout.name}
          symbol={workout.symbol}
          meta={`${focusLabel(workout.focus)} · ${difficultyLabel(workout.difficulty as any)}`}
          duration={`${workout.estimatedMinutesMin}–${workout.estimatedMinutesMax} min`}
          pb={pb}
          last={last}
          color={workout.identityColor}
          onPress={() => {}}
        />

        <Button title="START REMATCH" onPress={() => router.push(`/workout/${workout.id}`)} style={styles.cta} />
        <Button title="Just Train" variant="secondary" onPress={() => router.push(`/workout/${workout.id}?mode=train`)} />
        <Button title="CHALLENGE ME" variant="ghost" onPress={() => router.push('/challenge')} style={{ marginTop: spacing.sm }} />

        <View style={styles.footer}>
          <Text style={styles.footerLabel}>Quick alternative</Text>
          <Pressable onPress={() => router.push('/challenge?minutes=8')}>
            <Text style={styles.footerLink}>8 min →</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/(tabs)/library')} style={{ marginTop: spacing.sm }}>
            <Text style={styles.footerLink}>Browse workouts</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.lg },
  brand: { ...typography.displayMD, color: colors.primary },
  section: { ...typography.label, color: colors.muted, marginVertical: spacing.md },
  cta: { marginVertical: spacing.md },
  footer: { marginTop: 'auto', paddingTop: spacing.lg },
  footerLabel: { ...typography.caption, color: colors.muted },
  footerLink: { ...typography.bodyBold, color: colors.accent, marginTop: 4 },
});
