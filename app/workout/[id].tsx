import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { WorkoutArtwork } from '../../src/components/WorkoutArtwork';
import { getCurrentVersion, getExercise, getVariant, getWorkoutById } from '../../src/db/seed';
import { createSession, getLastResult, getPb } from '../../src/services/sessionService';
import { colors, spacing, typography } from '../../src/theme';
import { focusLabel, difficultyLabel } from '../../src/services/recommendationService';
import { formatDuration } from '../../src/domain/utils';
import type { WorkoutStructure } from '../../src/domain/types';
import { useWorkoutStore } from '../../src/store/workoutStore';

export default function WorkoutDetailScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const [partialKey, setPartialKey] = useState('full');
  const router = useRouter();
  const setSession = useWorkoutStore((s) => s.setSession);
  const [workout, setWorkout] = useState<any>(null);
  const [structure, setStructure] = useState<WorkoutStructure | null>(null);
  const [pb, setPb] = useState<number | null>(null);
  const [last, setLast] = useState<number | null>(null);
  const [versionId, setVersionId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [exerciseNames, setExerciseNames] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const w = await getWorkoutById(id);
      if (!w) return;
      setWorkout(w);
      const version = await getCurrentVersion(w.id);
      if (!version) return;
      setVersionId(version.id);
      const variant = await getVariant(version.id, partialKey);
      if (!variant) return;
      setVariantId(variant.id);
      const s = JSON.parse(variant.structureJson) as WorkoutStructure;
      setStructure(s);
      const pbRow = await getPb(w.id, version.id, variant.id, 'rx');
      const lastRow = await getLastResult(w.id, variant.id, 'rx');
      setPb(pbRow?.completionMs ?? null);
      setLast(lastRow?.completionMs ?? null);
      const ids = s.rounds[0]?.steps ?? [];
      const names: string[] = [];
      for (const st of ids) {
        const ex = await getExercise(st.exerciseId);
        const prefix = st.durationSec ? `${st.durationSec}s` : `${st.reps}`;
        names.push(ex ? `${prefix} ${ex.name}` : st.exerciseId);
      }
      setExerciseNames(names);
    })();
  }, [id, partialKey]);

  const start = async (opponentSessionId?: string | null) => {
