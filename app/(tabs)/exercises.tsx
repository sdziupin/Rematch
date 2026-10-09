import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { BodyMap } from '../../src/components/charts';
import { ExerciseAnimation } from '../../src/components/ExerciseAnimation';
import { Icon } from '../../src/components/Icon';
import { Chip, ChipRow, EmptyState, Grid, Screen } from '../../src/components/ui';
import { EQUIPMENT, EQUIPMENT_LABELS, MUSCLE_LABELS, MUSCLES, type MuscleId } from '../../src/content/types';
import { listExercises, parseJsonArray } from '../../src/db/repository';
import type { ExerciseRow } from '../../src/db/schema';
import { titleCase } from '../../src/domain/utils';
import { useLayout } from '../../src/hooks/useLayout';
import { colors, spacing, typography } from '../../src/theme';

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
  const tileSize = Math.floor((contentWidth - (isWide ? 64 : 40) - (columns - 1) * spacing.md) / columns) - 16;

  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        Exercises
      </Text>
      <Text style={styles.sub}>{rows.length} movements, each with a demo, coaching cues and easier or harder options.</Text>

      <View style={[styles.top, isWide && styles.topWide]}>
        <View style={styles.flex}>
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.muted} />
            <TextInput
              placeholder="Search exercises"
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
              accessibilityLabel="Search exercises"
            />
          </View>
          <ChipRow options={CATEGORIES} value={category} onChange={setCategory} format={(c) => (c === 'all' ? 'All' : titleCase(c))} scroll />
          <ChipStrip wrap={isWide}>
            {EQUIPMENT.filter((e) => e !== 'bodyweight').map((e) => (
              <Chip key={e} label={EQUIPMENT_LABELS[e]} selected={equipment === e} onPress={() => setEquipment(equipment === e ? null : e)} />
            ))}
          </ChipStrip>
          <ChipStrip wrap={isWide}>
            {MUSCLES.map((m) => (
              <Chip key={m} label={MUSCLE_LABELS[m]} selected={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} color={colors.accentWarm} />
            ))}
          </ChipStrip>
        </View>
        {isWide && (
          <View style={styles.map}>
            <BodyMap load={muscle ? { [muscle]: 1 } : {}} height={240} color={colors.accentWarm} />
            <Text style={styles.mapNote}>{muscle ? `Showing ${MUSCLE_LABELS[muscle].toLowerCase()}` : 'Pick a muscle to filter'}</Text>
          </View>
        )}
      </View>

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
              style={(s) => [styles.tile, (s as { hovered?: boolean }).hovered && styles.tileHover]}
            >
              <ExerciseAnimation exerciseId={e.id} category={e.category} size={Math.max(96, Math.min(tileSize, 180))} playing={hovered === e.id} />
              <Text style={styles.tileName} numberOfLines={2}>
                {e.name}
              </Text>
              <Text style={styles.tileMeta} numberOfLines={1}>
                {titleCase(e.category)} · {parseJsonArray(e.primaryMusclesJson).map((m) => MUSCLE_LABELS[m as MuscleId] ?? m).join(', ')}
              </Text>
            </Pressable>
          ))}
        </Grid>
      )}
    </Screen>
  );
}

/** Wrapping chips on wide screens, one swipeable row on phones. */
function ChipStrip({ wrap, children }: { wrap: boolean; children: React.ReactNode }) {
  if (wrap) return <View style={styles.chips}>{children}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: spacing.sm },
  title: { ...typography.displayLG, color: colors.primary },
  sub: { ...typography.body, color: colors.secondary, marginBottom: spacing.md },
  top: { gap: spacing.md },
  topWide: { flexDirection: 'row', alignItems: 'flex-start' },
  map: { width: 260, alignItems: 'center', gap: 6 },
  mapNote: { ...typography.caption, color: colors.muted },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, minHeight: 48 },
  searchInput: { flex: 1, color: colors.primary, ...typography.body, paddingVertical: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingRight: spacing.md },
  count: { ...typography.caption, color: colors.muted, marginVertical: spacing.md },
  tile: { backgroundColor: colors.surface, borderRadius: 16, padding: 8, gap: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  tileHover: { backgroundColor: colors.surfaceElevated },
  tileName: { ...typography.bodyBold, color: colors.primary, textAlign: 'center' },
  tileMeta: { ...typography.caption, color: colors.muted, textAlign: 'center' },
});
