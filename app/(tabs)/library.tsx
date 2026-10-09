import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../../src/components/Button';
import { Icon } from '../../src/components/Icon';
import { WorkoutTile } from '../../src/components/WorkoutCard';
import { Card, Chip, ChipRow, EmptyState, FilterButton, FilterGroup, Grid, Pill, Screen, ScreenHeader, SearchField, Segmented, WorkoutMark } from '../../src/components/ui';
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
import { colors, radius, spacing, typography } from '../../src/theme';

const TABS = ['benchmarks', 'programs', 'mine', 'prep'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { benchmarks: 'Benchmarks', programs: 'Programs', mine: 'Mine', prep: 'Warm-ups' };

const FORMATS = ['all', 'fixed_rounds', 'chipper', 'ladder', 'amrap', 'emom', 'intervals'] as const;
const DIFFICULTIES = ['all', 'beginner', 'intermediate', 'advanced', 'elite'] as const;
const DURATIONS = ['any', '≤10', '10–20', '20+'] as const;

export default function LibraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { columns, isWide } = useLayout();
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
  const [showFilters, setShowFilters] = useState(false);

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
  const activeFilters = (format !== 'all' ? 1 : 0) + (difficulty !== 'all' ? 1 : 0) + (duration !== 'any' ? 1 : 0) + (onlyOwned ? 1 : 0);
  const clearFilters = () => {
    setFormat('all');
    setDifficulty('all');
    setDuration('any');
    setOnlyOwned(false);
  };

  return (
    <Screen>
      <ScreenHeader
        title="Workouts"
        subtitle="Original benchmarks, multi-week programs and your own creations."
        right={isWide ? <Button title="Build your own" icon="plus" variant="secondary" size="sm" onPress={() => router.push('/builder')} /> : undefined}
      />
      <Segmented options={TABS.map((t) => ({ key: t, label: TAB_LABEL[t] }))} value={tab} onChange={setTab} fill={!isWide} />

      {tab === 'programs' ? (
        <View style={styles.section}>
          <Grid columns={Math.min(columns, 2)}>
            {programs.map((p) => (
              <ProgramCard key={p.id} program={p} active={p.id === activeProgramId} onPress={() => router.push(`/program/${p.id}`)} />
            ))}
          </Grid>
        </View>
      ) : (
        <View style={styles.section}>
          <View style={styles.searchRow}>
            <SearchField value={query} onChange={setQuery} label="Search workouts" />
            <FilterButton open={showFilters} count={activeFilters} onPress={() => setShowFilters((v) => !v)} />
          </View>
          {showFilters && (
            <View style={styles.filters}>
              {tab !== 'prep' && (
                <>
                  <FilterGroup label="Format">
                    <ChipRow options={FORMATS} value={format} onChange={setFormat} format={(f) => (f === 'all' ? 'All' : formatLabel(f as WorkoutStructure['format']))} />
                  </FilterGroup>
                  <FilterGroup label="Level">
                    <ChipRow options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} format={(d) => (d === 'all' ? 'Any' : difficultyLabel(d))} />
                  </FilterGroup>
                </>
              )}
              <FilterGroup label="Length">
                <ChipRow options={DURATIONS} value={duration} onChange={setDuration} format={(d) => (d === 'any' ? 'Any' : `${d} min`)} />
              </FilterGroup>
              <View style={styles.filterFooter}>
                <Chip label="Only my equipment" icon="check" selected={onlyOwned} onPress={() => setOnlyOwned((v) => !v)} />
                {activeFilters > 0 && <Button title="Reset" variant="ghost" size="sm" onPress={clearFilters} />}
              </View>
            </View>
          )}
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
              <EmptyState icon="search" title="Nothing matches" body="Try a different length, level or format." />
            )
          ) : (
            <Grid columns={columns}>
              {filtered.map((w) => (
                <WorkoutTile
                  key={w.id}
                  name={w.name}
                  color={w.identityColor}
                  format={formatLabel(w.format as WorkoutStructure['format'])}
                  meta={`${difficultyLabel(w.difficulty)} · ${w.estimatedMinutesMin}–${w.estimatedMinutesMax} min`}
                  pb={stats[w.id]?.pb ?? null}
                  attempts={stats[w.id]?.attempts}
                  tag={w.source === 'custom' ? 'Mine' : undefined}
                  onPress={() => router.push(`/workout/${w.id}`)}
                />
              ))}
            </Grid>
          )}
          {!isWide && (
            <Button title="Build your own workout" icon="plus" variant="secondary" onPress={() => router.push('/builder')} style={{ marginTop: spacing.md }} />
          )}
        </View>
      )}
    </Screen>
  );
}

function ProgramCard({ program, active, onPress }: { program: ProgramSeed; active: boolean; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.programCard} accessibilityLabel={`${program.name}. ${program.tagline}`}>
      <View style={styles.programTop}>
        <WorkoutMark name={program.name} color={program.identityColor} size={40} />
        {active ? <Pill label="Active" color={colors.accent} /> : <Pill label={difficultyLabel(program.level)} />}
      </View>
      <View style={styles.programBody}>
        <Text style={styles.programName}>{program.name}</Text>
        <Text style={styles.programTagline}>{program.tagline}</Text>
      </View>
      <View style={styles.programFooter}>
        <Text style={styles.programMeta}>
          {program.weeks} weeks · {program.daysPerWeek} sessions a week
        </Text>
        <Icon name="forward" size={16} color={colors.textMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: spacing.sm + 4, marginTop: spacing.lg },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  filters: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.md },
  filterFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  count: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  programCard: { gap: spacing.md, padding: spacing.lg - 4 },
  programTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  programBody: { gap: 6 },
  programName: { ...typography.heading, color: colors.text, letterSpacing: 0 },
  programTagline: { ...typography.body, color: colors.textSecondary },
  programFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm + 4, borderTopWidth: 1, borderTopColor: colors.border },
  programMeta: { ...typography.caption, color: colors.textMuted },
});
