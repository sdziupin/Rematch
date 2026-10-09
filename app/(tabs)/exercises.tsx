import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { BodyMap } from '../../src/components/charts';
import { ExerciseAnimation } from '../../src/components/ExerciseAnimation';
import { Chip, ChipRow, EmptyState, FilterButton, FilterGroup, Grid, Screen, ScreenHeader, SearchField } from '../../src/components/ui';
import { EQUIPMENT, EQUIPMENT_LABELS, MUSCLE_LABELS, MUSCLES, type MuscleId } from '../../src/content/types';
import { listExercises, parseJsonArray } from '../../src/db/repository';
import type { ExerciseRow } from '../../src/db/schema';
import { titleCase } from '../../src/domain/utils';
import { useLayout } from '../../src/hooks/useLayout';
import { colors, fonts, radius, spacing, typography } from '../../src/theme';

const CATEGORIES = ['all', 'push', 'pull', 'squat', 'lunge', 'hinge', 'core', 'cardio', 'conditioning', 'accessory', 'mobility', 'recovery'] as const;

export default function ExercisesScreen() {
  const router = useRouter();
  const { contentWidth, isWide } = useLayout();
  const [rows, setRows] = useState<ExerciseRow[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('all');
  const [muscle, setMuscle] = useState<MuscleId | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void listExercises().then(setRows);
    }, []),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((e) => {
      if (q && !`${e.name} ${e.description}`.toLowerCase().includes(q)) return false;
      if (category !== 'all' && e.category !== category) return false;
      if (muscle && ![...parseJsonArray(e.primaryMusclesJson), ...parseJsonArray(e.secondaryMusclesJson)].includes(muscle)) return false;
      if (equipment && !parseJsonArray(e.equipmentJson).includes(equipment)) return false;
      return true;
    });
  }, [rows, query, category, muscle, equipment]);

  const columns = contentWidth >= 1000 ? 5 : contentWidth >= 760 ? 4 : contentWidth >= 520 ? 3 : 2;
  const tileSize = Math.floor((contentWidth - (isWide ? 64 : 40) - (columns - 1) * 12) / columns);
  const activeFilters = (muscle ? 1 : 0) + (equipment ? 1 : 0);

  return (
    <Screen>
      <ScreenHeader title="Exercises" subtitle={`${rows.length} movements, each with an animated demo, coaching cues and easier or harder options.`} />

      <View style={styles.searchRow}>
        <SearchField value={query} onChange={setQuery} label="Search exercises" />
        <FilterButton open={showFilters} count={activeFilters} onPress={() => setShowFilters((v) => !v)} />
      </View>
      <ChipRow options={CATEGORIES} value={category} onChange={setCategory} format={(c) => (c === 'all' ? 'All' : titleCase(c))} scroll />

      {showFilters && (
        <View style={[styles.filters, isWide && styles.filtersWide]}>
          <View style={styles.filterCol}>
            <FilterGroup label="Equipment">
              <View style={styles.chips}>
                {EQUIPMENT.filter((e) => e !== 'bodyweight').map((e) => (
                  <Chip key={e} label={EQUIPMENT_LABELS[e]} selected={equipment === e} onPress={() => setEquipment(equipment === e ? null : e)} />
                ))}
              </View>
            </FilterGroup>
            <FilterGroup label="Muscle">
              <View style={styles.chips}>
                {MUSCLES.map((m) => (
                  <Chip key={m} label={MUSCLE_LABELS[m]} selected={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />
                ))}
              </View>
            </FilterGroup>
          </View>
          {isWide && (
            <View style={styles.map}>
              <BodyMap load={muscle ? { [muscle]: 1 } : {}} height={220} />
              <Text style={styles.mapNote}>{muscle ? MUSCLE_LABELS[muscle] : 'Pick a muscle'}</Text>
            </View>
          )}
        </View>
      )}

      <Text style={styles.count}>
        {filtered.length} exercise{filtered.length === 1 ? '' : 's'}
      </Text>
      {filtered.length === 0 ? (
        <EmptyState icon="search" title="No exercises match" body="Clear a filter to see more." />
      ) : (
        <Grid columns={columns}>
          {filtered.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => router.push(`/exercise/${e.id}`)}
              onHoverIn={() => setHovered(e.id)}
              onHoverOut={() => setHovered((h) => (h === e.id ? null : h))}
              accessibilityRole="button"
              accessibilityLabel={`${e.name}, ${e.category}`}
              style={(s) => [styles.tile, (s as { hovered?: boolean }).hovered && styles.tileHover, s.pressed && { opacity: 0.8 }]}
            >
              <View style={styles.tileArt}>
                <ExerciseAnimation exerciseId={e.id} category={e.category} size={Math.max(120, Math.min(tileSize, 200))} playing={hovered === e.id} background={null} />
              </View>
              <View style={styles.tileText}>
                <Text style={styles.tileName} numberOfLines={1}>
                  {e.name}
                </Text>
                <Text style={styles.tileMeta} numberOfLines={1}>
                  {parseJsonArray(e.primaryMusclesJson).map((m) => MUSCLE_LABELS[m as MuscleId] ?? m).join(', ') || titleCase(e.category)}
                </Text>
              </View>
            </Pressable>
          ))}
        </Grid>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm + 4 },
  filters: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.lg, marginTop: spacing.sm + 4 },
  filtersWide: { flexDirection: 'row', alignItems: 'center' },
  filterCol: { flex: 1, gap: spacing.md },
  map: { width: 240, alignItems: 'center', gap: 6 },
  mapNote: { ...typography.caption, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  count: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm + 4 },
  tile: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tileHover: { borderColor: colors.borderStrong },
  tileArt: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised, paddingVertical: 4 },
  tileText: { paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  tileName: { ...typography.callout, fontFamily: fonts.semibold, color: colors.text },
  tileMeta: { ...typography.caption, color: colors.textMuted },
});
