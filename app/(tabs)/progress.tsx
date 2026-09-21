import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listWorkouts } from '../../src/db/seed';
import { listResults } from '../../src/services/sessionService';
import { colors, spacing, typography } from '../../src/theme';
import { formatDuration } from '../../src/domain/utils';

export default function ProgressScreen() {
  const [rows, setRows] = useState<{ name: string; first?: number; latest?: number; count: number }[]>([]);
  const [sessionsWeek, setSessionsWeek] = useState(0);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const workouts = await listWorkouts();
        const out: { name: string; first?: number; latest?: number; count: number }[] = [];
        let weekCount = 0;
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        for (const w of workouts.slice(0, 8)) {
          const versionId = `${w.id}-v1`;
          const variantId = `${versionId}-full`;
          const results = await listResults(w.id, variantId, 'rx');
          if (results.length === 0) continue;
          const sorted = [...results].sort((a, b) => a.createdAt - b.createdAt);
          out.push({
            name: w.name,
            first: sorted[0].completionMs,
            latest: sorted[sorted.length - 1].completionMs,
            count: results.length,
          });
          weekCount += results.filter((r) => r.createdAt >= weekAgo).length;
        }
        setRows(out);
        setSessionsWeek(weekCount);
      })();
    }, []),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Progress</Text>
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>This week</Text>
          <Text style={styles.summaryValue}>{sessionsWeek} sessions</Text>
        </View>
        <Text style={styles.section}>Benchmark improvement</Text>
        {rows.length === 0 ? (
          <Text style={styles.empty}>Complete your first benchmark to see progress.</Text>
        ) : (
          rows.map((r) => {
            const delta = r.first != null && r.latest != null ? r.latest - r.first : 0;
            return (
              <View key={r.name} style={styles.row}>
                <Text style={styles.rowName}>{r.name}</Text>
                <Text style={styles.rowMeta}>{r.count} attempts</Text>
                <Text style={[styles.rowDelta, { color: delta <= 0 ? colors.ahead : colors.behind }]}>
                  {r.first != null && r.latest != null ? `${formatDuration(r.first)} → ${formatDuration(r.latest)}` : '—'}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

