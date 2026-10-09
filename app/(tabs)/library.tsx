import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../../src/components/Button';
import { Icon } from '../../src/components/Icon';
import { WorkoutTile } from '../../src/components/WorkoutCard';
import { Card, Chip, ChipRow, EmptyState, Grid, Pill, Screen, SectionTitle } from '../../src/components/ui';
import type { ProgramSeed } from '../../src/content/types';
import { getProfile, listWorkouts, parseJsonArray, profileEquipment } from '../../src/db/repository';
import type { WorkoutRow } from '../../src/db/schema';
import type { WorkoutStructure } from '../../src/domain/types';
import { formatLabel } from '../../src/engine/workoutEngine';
import { useLayout } from '../../src/hooks/useLayout';
import { getActiveEnrollment, listPrograms } from '../../src/services/programService';
import { difficultyLabel, focusLabel } from '../../src/services/recommendationService';
import { getWorkoutStatsMap } from '../../src/services/sessionService';
import { useSettings } from '../../src/store/settingsStore';
import { colors, spacing, typography, withAlpha } from '../../src/theme';

const TABS = ['benchmarks', 'programs', 'mine', 'prep'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { benchmarks: 'Benchmarks', programs: 'Programs', mine: 'My workouts', prep: 'Warm-ups & cool-downs' };

const FORMATS = ['all', 'fixed_rounds', 'chipper', 'ladder', 'amrap', 'emom', 'intervals'] as const;
const DIFFICULTIES = ['all', 'beginner', 'intermediate', 'advanced', 'elite'] as const;
const DURATIONS = ['any', '≤10', '10–20', '20+'] as const;

export default function LibraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { columns } = useLayout();
  const revision = useSettings((s) => s.revision);
  const [tab, setTab] = useState<Tab>((TABS as readonly string[]).includes(params.tab ?? '') ? (params.tab as Tab) : 'benchmarks');
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getWorkoutStatsMap>>>({});
  const [owned, setOwned] = useState<string[]>(['bodyweight']);
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState<(typeof FORMATS)[number]>('all');
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('all');
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>('any');
  const [onlyOwned, setOnlyOwned] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [rows, s, profile, enrollment] = await Promise.all([listWorkouts(), getWorkoutStatsMap(), getProfile(), getActiveEnrollment()]);
        setWorkouts(rows);
        setStats(s);
        setOwned(profileEquipment(profile));
        setActiveProgramId(enrollment?.programId ?? null);
      })();
    }, [revision]),
  );

  React.useEffect(() => {
    if (params.tab && (TABS as readonly string[]).includes(params.tab)) setTab(params.tab as Tab);
  }, [params.tab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return workouts.filter((w) => {
      const kind = w.kind ?? 'benchmark';
      if (tab === 'benchmarks' && (kind !== 'benchmark' || w.source === 'custom')) return false;
      if (tab === 'mine' && w.source !== 'custom') return false;
      if (tab === 'prep' && kind === 'benchmark') return false;
      if (q && !`${w.name} ${w.focus} ${w.description ?? ''}`.toLowerCase().includes(q)) return false;
      if (format !== 'all' && w.format !== format) return false;
      if (difficulty !== 'all' && w.difficulty !== difficulty) return false;
      const mid = (w.estimatedMinutesMin + w.estimatedMinutesMax) / 2;
      if (duration === '≤10' && mid > 10) return false;
      if (duration === '10–20' && (mid < 10 || mid > 20)) return false;
      if (duration === '20+' && mid < 20) return false;
      if (onlyOwned && !parseJsonArray(w.equipmentJson).every((e) => e === 'bodyweight' || e === 'mat' || owned.includes(e))) return false;
      return true;
    });
  }, [workouts, tab, query, format, difficulty, duration, onlyOwned, owned]);

  const programs = listPrograms();

  return (
    <Screen>
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">
          Workouts
        </Text>
        <Button title="Build your own" icon="plus" variant="outline" size="sm" onPress={() => router.push('/builder')} />
      </View>
      <ChipRow options={TABS} value={tab} onChange={setTab} format={(t) => TAB_LABEL[t]} scroll />

      {tab === 'programs' ? (
        <View style={styles.section}>
          <Text style={styles.intro}>Multi-week plans. Each one re-tests key benchmarks so your rematches show real progress.</Text>
          <Grid columns={Math.min(columns, 2)}>
            {programs.map((p) => (
              <ProgramCard key={p.id} program={p} active={p.id === activeProgramId} onPress={() => router.push(`/program/${p.id}`)} />
            ))}
          </Grid>
        </View>
      ) : (
        <View style={styles.section}>
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.muted} />
            <TextInput
              placeholder="Search workouts"
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
              accessibilityLabel="Search workouts"
              returnKeyType="search"
            />
            {query ? <Chip label="Clear" onPress={() => setQuery('')} /> : null}
          </View>
          {tab !== 'prep' && (
            <>
              <ChipRow options={FORMATS} value={format} onChange={setFormat} format={(f) => (f === 'all' ? 'All formats' : formatLabel(f as WorkoutStructure['format']))} scroll />
              <ChipRow options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} format={(d) => (d === 'all' ? 'Any level' : difficultyLabel(d))} scroll />
            </>
          )}
          <View style={styles.filterRow}>
            <ChipRow options={DURATIONS} value={duration} onChange={setDuration} format={(d) => (d === 'any' ? 'Any length' : `${d} min`)} scroll />
            <Chip label="My equipment" icon="check" selected={onlyOwned} onPress={() => setOnlyOwned((v) => !v)} />
          </View>
          <Text style={styles.count}>
            {filtered.length} workout{filtered.length === 1 ? '' : 's'}
          </Text>
          {filtered.length === 0 ? (
            tab === 'mine' ? (
              <EmptyState
                icon="edit"
                title="Build your own benchmark"
                body="Pick movements, set the format, and race every attempt like any other workout."
                action={<Button title="Create a workout" icon="plus" onPress={() => router.push('/builder')} />}
              />
            ) : (
              <EmptyState icon="search" title="Nothing matches those filters" body="Try a different length, level or format." />
            )
          ) : (
            <Grid columns={columns}>
              {filtered.map((w) => (
                <WorkoutTile
                  key={w.id}
                  name={w.name}
                  symbol={w.symbol}
                  color={w.identityColor}
                  format={formatLabel(w.format as WorkoutStructure['format'])}
                  meta={`${focusLabel(w.focus)} · ${difficultyLabel(w.difficulty)} · ${w.estimatedMinutesMin}–${w.estimatedMinutesMax} min`}
                  pb={stats[w.id]?.pb ?? null}
                  attempts={stats[w.id]?.attempts}
                  tag={w.source === 'custom' ? 'MINE' : undefined}
                  onPress={() => router.push(`/workout/${w.id}`)}
                />
              ))}
            </Grid>
          )}
        </View>
      )}
    </Screen>
  );
}

function ProgramCard({ program, active, onPress }: { program: ProgramSeed; active: boolean; onPress: () => void }) {
  return (
    <Card onPress={onPress} accent={program.identityColor} style={styles.programCard} accessibilityLabel={`${program.name}. ${program.tagline}`}>
      <View style={styles.programTop}>
        <View style={[styles.programSymbol, { backgroundColor: withAlpha(program.identityColor, 0.16) }]}>
          <Text style={[styles.programSymbolText, { color: program.identityColor }]}>{program.symbol}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.programName}>{program.name}</Text>
          <Text style={styles.programMeta}>
            {program.weeks} weeks · {program.daysPerWeek}×/week · {difficultyLabel(program.level)}
          </Text>
        </View>
        {active && <Pill label="ACTIVE" color={colors.pb} />}
      </View>
      <Text style={styles.programTagline}>{program.tagline}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md, gap: spacing.md },
  title: { ...typography.displayLG, color: colors.primary },
  section: { gap: spacing.sm, marginTop: spacing.md },
  intro: { ...typography.body, color: colors.secondary, marginBottom: spacing.sm },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, minHeight: 48 },
  searchInput: { flex: 1, color: colors.primary, ...typography.body, paddingVertical: 10 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  count: { ...typography.caption, color: colors.muted, marginTop: spacing.sm },
  programCard: { gap: spacing.sm },
  programTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  programSymbol: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  programSymbolText: { fontSize: 26 },
  programName: { ...typography.displayMD, fontSize: 26, lineHeight: 30, color: colors.primary },
  programMeta: { ...typography.caption, color: colors.secondary },
  programTagline: { ...typography.body, color: colors.primary },
});
