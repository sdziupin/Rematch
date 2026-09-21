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
