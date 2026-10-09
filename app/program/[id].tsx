import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../../src/components/Button';
import { confirmAction, showToast } from '../../src/components/Dialogs';
import { Icon } from '../../src/components/Icon';
import { Card, EmptyState, Grid, Pill, Screen, ScreenHeader, SectionTitle } from '../../src/components/ui';
import { EQUIPMENT_LABELS } from '../../src/content/types';
import { listWorkouts } from '../../src/db/repository';
import type { WorkoutRow } from '../../src/db/schema';
import { programProgress, programSessionKey, type ProgramProgress } from '../../src/domain/programs';
import { useLayout } from '../../src/hooks/useLayout';
import { completedProgramKeys, enroll, getActiveEnrollment, getProgram, leaveProgram } from '../../src/services/programService';
import { difficultyLabel } from '../../src/services/recommendationService';
import { useSettings } from '../../src/store/settingsStore';
import { colors, spacing, typography, withAlpha } from '../../src/theme';

const PARTIAL_LABEL: Record<string, string> = { full: '', three_quarter: '¾', half: '½', quarter: '¼' };

export default function ProgramScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isWide } = useLayout();
  const program = getProgram(id);
  const [workouts, setWorkouts] = useState<Map<string, WorkoutRow>>(new Map());
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgramProgress | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!program) return;
    const [rows, enrollment] = await Promise.all([listWorkouts({ includeArchived: true }), getActiveEnrollment()]);
    setWorkouts(new Map(rows.map((w) => [w.id, w])));
    const mine = enrollment?.programId === program.id ? enrollment : null;
    setEnrollmentId(mine?.id ?? null);
    setProgress(programProgress(program, mine ? await completedProgramKeys(mine.id) : new Set()));
  }, [program]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!program) {
    return (
      <Screen narrow>
        <ScreenHeader title="Program" onBack={() => router.back()} />
        <EmptyState title="Program not found" />
      </Screen>
    );
  }

  const start = async () => {
    setBusy(true);
    const active = await getActiveEnrollment();
    if (active && active.programId !== program.id) {
      const other = getProgram(active.programId);
      const ok = await confirmAction({
        title: `Switch to ${program.name}?`,
        message: `You're on ${other?.name ?? 'another program'}. Switching ends it (your results stay).`,
        confirmLabel: 'Switch',
      });
      if (!ok) {
        setBusy(false);
        return;
      }
    }
    await enroll(program.id);
    useSettings.getState().touch();
    showToast(`${program.name} started. Your first session is on Today.`, { tone: 'success' });
    await load();
    setBusy(false);
  };

  const leave = async () => {
    if (!enrollmentId) return;
    const ok = await confirmAction({ title: 'Leave this program?', message: 'Your results stay in your history.', confirmLabel: 'Leave', destructive: true });
    if (!ok) return;
    await leaveProgram(enrollmentId);
    useSettings.getState().touch();
    await load();
  };

  const openSession = (s: ProgramProgress['weeks'][number]['sessions'][number]) => {
    router.push({
      pathname: '/workout/[id]',
      params: { id: s.workoutId, variant: s.partialKey ?? 'full', ...(enrollmentId ? { program: enrollmentId, key: programSessionKey(s) } : {}) },
    });
  };

  const header = (
    <Card accent={program.identityColor} style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={[styles.symbol, { backgroundColor: withAlpha(program.identityColor, 0.18) }]}>
          <Text style={[styles.symbolText, { color: program.identityColor }]}>{program.symbol}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{program.name}</Text>
          <Text style={styles.meta}>
            {program.weeks} weeks · {program.daysPerWeek} sessions a week · {difficultyLabel(program.level)}
          </Text>
        </View>
      </View>
      <Text style={styles.tagline}>{program.tagline}</Text>
      <Text style={styles.description}>{program.description}</Text>
      <View style={styles.pills}>
        {program.equipment.length === 0 ? <Pill label="NO EQUIPMENT" /> : program.equipment.map((e) => <Pill key={e} label={(EQUIPMENT_LABELS[e] ?? e).toUpperCase()} />)}
      </View>
      {enrollmentId && progress ? (
        <>
          <View style={styles.bar}>
            <View style={[styles.fill, { width: `${Math.round(progress.fraction * 100)}%`, backgroundColor: program.identityColor }]} />
          </View>
          <Text style={styles.meta}>
            {progress.done} of {progress.total} sessions done
          </Text>
          {progress.next && (
            <Button
              title={`START WEEK ${progress.next.week} · DAY ${progress.next.day}`}
              icon="play"
              size="lg"
              tint={program.identityColor}
              onPress={() => openSession({ ...progress.next!, key: programSessionKey(progress.next!), done: false })}
            />
          )}
          <Button title="Leave program" variant="ghost" onPress={leave} />
        </>
      ) : (
        <Button title="START THIS PROGRAM" icon="calendar" size="lg" tint={program.identityColor} onPress={start} loading={busy} />
      )}
    </Card>
  );

  const schedule = progress && (
    <View>
      <SectionTitle>Schedule</SectionTitle>
      <Grid columns={isWide ? 2 : 1}>
        {progress.weeks.map((week) => (
          <Card key={week.week} style={styles.week}>
            <Text style={styles.weekTitle}>WEEK {week.week}</Text>
            {week.sessions.map((s) => {
              const w = workouts.get(s.workoutId);
              const isNext = enrollmentId && progress.next && programSessionKey(progress.next) === s.key;
              return (
                <Card key={s.key} onPress={() => openSession(s)} style={[styles.session, isNext ? { borderColor: program.identityColor } : null]} accessibilityLabel={`Day ${s.day}: ${w?.name ?? s.workoutId}${s.done ? ', done' : ''}`}>
                  <View style={[styles.check, s.done && { backgroundColor: colors.pb, borderColor: colors.pb }]}>{s.done && <Icon name="check" size={14} color={colors.background} />}</View>
                  <View style={styles.flex}>
                    <Text style={styles.sessionName}>
                      Day {s.day} · {w?.name ?? s.workoutId} {PARTIAL_LABEL[s.partialKey ?? 'full']}
                    </Text>
                    {s.note ? <Text style={styles.note}>{s.note}</Text> : null}
                  </View>
                  {isNext && <Pill label="NEXT" color={program.identityColor} />}
                </Card>
              );
            })}
          </Card>
        ))}
      </Grid>
    </View>
  );

  return (
    <Screen>
      <ScreenHeader title="" onBack={() => (router.canGoBack() ? router.back() : router.replace({ pathname: '/library', params: { tab: 'programs' } }))} />
      {header}
      {schedule}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { gap: spacing.sm, padding: spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  symbol: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  symbolText: { fontSize: 32 },
  name: { ...typography.displayLG, color: colors.primary },
  meta: { ...typography.caption, color: colors.secondary },
  tagline: { ...typography.subheading, color: colors.primary },
  description: { ...typography.body, color: colors.secondary },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden', marginTop: spacing.sm },
  fill: { height: 6 },
  week: { gap: 8 },
  weekTitle: { ...typography.label, color: colors.muted },
  session: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, backgroundColor: colors.background },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  sessionName: { ...typography.bodyBold, color: colors.primary },
  note: { ...typography.caption, color: colors.secondary },
});
