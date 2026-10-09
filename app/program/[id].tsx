import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../../src/components/Button';
import { confirmAction, showToast } from '../../src/components/Dialogs';
import { Icon } from '../../src/components/Icon';
import { Card, EmptyState, Grid, Pill, ProgressBar, Screen, ScreenHeader, SectionTitle, WorkoutMark } from '../../src/components/ui';
import { EQUIPMENT_LABELS } from '../../src/content/types';
import { listWorkouts } from '../../src/db/repository';
import type { WorkoutRow } from '../../src/db/schema';
import { programProgress, programSessionKey, type ProgramProgress } from '../../src/domain/programs';
import { useLayout } from '../../src/hooks/useLayout';
import { completedProgramKeys, enroll, getActiveEnrollment, getProgram, leaveProgram } from '../../src/services/programService';
import { difficultyLabel } from '../../src/services/recommendationService';
import { useSettings } from '../../src/store/settingsStore';
import { colors, fonts, radius, spacing, typography } from '../../src/theme';

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

  const equipmentText = program.equipment.length === 0 ? 'No equipment' : program.equipment.map((e) => EQUIPMENT_LABELS[e] ?? e).join(', ');

  const header = (
    <View style={[styles.hero, isWide && styles.heroWide]}>
      <View style={styles.heroText}>
        <WorkoutMark name={program.name} color={program.identityColor} size={52} />
        <Text style={styles.eyebrow}>
          Program · {program.weeks} weeks · {program.daysPerWeek} a week · {difficultyLabel(program.level)}
        </Text>
        <Text style={styles.name}>{program.name}</Text>
        <Text style={styles.tagline}>{program.tagline}</Text>
        <Text style={styles.description}>{program.description}</Text>
        <Text style={styles.meta}>{equipmentText}</Text>
      </View>
      <Card style={[styles.actionCard, isWide && styles.actionCardWide]}>
        {enrollmentId && progress ? (
          <>
            <View style={styles.progressHead}>
              <Text style={styles.label}>Progress</Text>
              <Text style={styles.progressValue}>
                {progress.done}
                <Text style={styles.progressOf}>/{progress.total}</Text>
              </Text>
            </View>
            <ProgressBar progress={progress.fraction} />
            {progress.next && (
              <Button
                title={`Start week ${progress.next.week}, day ${progress.next.day}`}
                icon="play"
                size="lg"
                onPress={() => openSession({ ...progress.next!, key: programSessionKey(progress.next!), done: false })}
                style={{ marginTop: spacing.sm }}
              />
            )}
            <Button title="Leave program" variant="ghost" size="sm" onPress={leave} />
          </>
        ) : (
          <>
            <Text style={styles.label}>Every program opens and closes on the same benchmark</Text>
            <Text style={styles.description}>So the last session is a rematch against the person who started.</Text>
            <Button title="Start this program" icon="calendar" size="lg" onPress={start} loading={busy} style={{ marginTop: spacing.sm }} />
          </>
        )}
      </Card>
    </View>
  );

  const schedule = progress && (
    <View>
      <SectionTitle>Schedule</SectionTitle>
      <Grid columns={isWide ? 2 : 1}>
        {progress.weeks.map((week) => (
          <View key={week.week} style={styles.week}>
            <Text style={styles.weekTitle}>Week {week.week}</Text>
            <View style={styles.weekList}>
              {week.sessions.map((s, i) => {
                const w = workouts.get(s.workoutId);
                const isNext = !!enrollmentId && !!progress.next && programSessionKey(progress.next) === s.key;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => openSession(s)}
                    style={(st) => [styles.session, i > 0 && styles.sessionDivider, (st as { hovered?: boolean }).hovered && styles.sessionHover]}
                    accessibilityRole="button"
                    accessibilityLabel={`Day ${s.day}: ${w?.name ?? s.workoutId}${s.done ? ', done' : ''}`}
                  >
                    <View style={[styles.check, s.done && styles.checkDone, isNext && styles.checkNext]}>
                      {s.done ? <Icon name="check" size={13} color={colors.onAccent} strokeWidth={2.5} /> : <Text style={styles.dayN}>{s.day}</Text>}
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.sessionName}>
                        {w?.name ?? s.workoutId}
                        {s.partialKey && s.partialKey !== 'full' ? <Text style={styles.partial}> {PARTIAL_LABEL[s.partialKey]}</Text> : null}
                      </Text>
                      {s.note ? <Text style={styles.note}>{s.note}</Text> : null}
                    </View>
                    {isNext && <Pill label="Next" color={colors.accent} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
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
  hero: { gap: spacing.lg },
  heroWide: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xxl },
  heroText: { flex: 1, gap: 6 },
  eyebrow: { ...typography.overline, color: colors.textMuted, marginTop: spacing.md },
  name: { ...typography.display, fontSize: 44, lineHeight: 48, color: colors.text },
  tagline: { ...typography.subheading, fontSize: 18, lineHeight: 26, color: colors.text, marginTop: 4 },
  description: { ...typography.body, color: colors.textSecondary, maxWidth: 620 },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  label: { ...typography.overline, color: colors.textMuted },
  actionCard: { gap: spacing.sm + 2, padding: spacing.lg - 4 },
  actionCardWide: { width: 360 },
  progressHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  progressValue: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.6, color: colors.text, fontVariant: ['tabular-nums'] },
  progressOf: { color: colors.textMuted, fontSize: 18 },
  week: { gap: spacing.sm + 2 },
  weekTitle: { ...typography.overline, color: colors.textMuted },
  weekList: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  session: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 6, paddingVertical: 14, paddingHorizontal: spacing.md },
  sessionDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  sessionHover: { backgroundColor: colors.surfaceRaised },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkNext: { borderColor: colors.accent },
  dayN: { ...typography.caption, fontFamily: fonts.semibold, color: colors.textSecondary },
  sessionName: { ...typography.callout, fontFamily: fonts.semibold, letterSpacing: 0.2, color: colors.text },
  partial: { color: colors.textMuted },
  note: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
