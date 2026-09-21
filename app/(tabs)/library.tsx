import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listWorkouts } from '../../src/db/seed';
import { getLastResult, getPb } from '../../src/services/sessionService';
import { colors, spacing, typography } from '../../src/theme';
import { focusLabel, difficultyLabel } from '../../src/services/recommendationService';
import { formatDuration } from '../../src/domain/utils';

const DURATIONS = ['all', '5-10', '10-15', '15-20', '20-30', '30+'];
const DIFFICULTIES = ['all', 'beginner', 'intermediate', 'advanced', 'elite'];

export default function LibraryScreen() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [duration, setDuration] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [stats, setStats] = useState<Record<string, { pb?: number; last?: number }>>({});

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const rows = await listWorkouts();
        setWorkouts(rows);
        const map: Record<string, { pb?: number; last?: number }> = {};
        for (const w of rows) {
          const versionId = `${w.id}-v1`;
          const variantId = `${versionId}-full`;
          const pb = await getPb(w.id, versionId, variantId, 'rx');
          const last = await getLastResult(w.id, variantId, 'rx');
          map[w.id] = { pb: pb?.completionMs, last: last?.completionMs };
        }
        setStats(map);
      })();
    }, []),
  );

  const filtered = useMemo(() => {
    return workouts.filter((w) => {
      if (query && !w.name.toLowerCase().includes(query.toLowerCase())) return false;
      if (difficulty !== 'all' && w.difficulty !== difficulty) return false;
      if (duration !== 'all') {
        const mid = (w.estimatedMinutesMin + w.estimatedMinutesMax) / 2;
        if (duration === '5-10' && mid > 10) return false;
        if (duration === '10-15' && (mid < 10 || mid > 15)) return false;
        if (duration === '15-20' && (mid < 15 || mid > 20)) return false;
        if (duration === '20-30' && (mid < 20 || mid > 30)) return false;
        if (duration === '30+' && mid < 30) return false;
      }
      return true;
    });
  }, [workouts, query, duration, difficulty]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Workouts</Text>
        <TextInput placeholder="Search" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={styles.search} />
        <FilterRow options={DURATIONS} value={duration} onChange={setDuration} />
        <FilterRow options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/workout/${item.id}`)}>
              <Text style={[styles.symbol, { color: item.identityColor }]}>{item.symbol}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{focusLabel(item.focus)} · {difficultyLabel(item.difficulty)} · {item.estimatedMinutesMin}–{item.estimatedMinutesMax} min</Text>
                <Text style={styles.stats}>
                  PB {stats[item.id]?.pb != null ? formatDuration(stats[item.id].pb!) : '—'} · Last {stats[item.id]?.last != null ? formatDuration(stats[item.id].last!) : '—'}
                </Text>
              </View>
            </Pressable>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

function FilterRow({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.filterRow}>
