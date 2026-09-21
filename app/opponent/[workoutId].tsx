import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentVersion, getVariant, getWorkoutById } from '../../src/db/seed';
import { createSession, listResults } from '../../src/services/sessionService';
import { useWorkoutStore } from '../../src/store/workoutStore';
import { colors, spacing, typography } from '../../src/theme';
import { formatDuration } from '../../src/domain/utils';
import type { WorkoutStructure } from '../../src/domain/types';

export default function OpponentScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const router = useRouter();
  const setSession = useWorkoutStore((s) => s.setSession);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [workout, setWorkout] = useState<any>(null);
  const [versionId, setVersionId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [structure, setStructure] = useState<WorkoutStructure | null>(null);

  useEffect(() => {
    (async () => {
      const w = await getWorkoutById(workoutId);
      setWorkout(w);
      const version = await getCurrentVersion(workoutId);
      if (!version) return;
      setVersionId(version.id);
      const variant = await getVariant(version.id, 'full');
      if (!variant) return;
      setVariantId(variant.id);
      setStructure(JSON.parse(variant.structureJson));
      const results = await listResults(workoutId, variant.id, 'rx');
      setAttempts(results);
    })();
  }, [workoutId]);

  const rematch = async (opponentSessionId: string) => {
    if (!workout || !structure || !versionId || !variantId) return;
    const { sessionId, state } = await createSession({
      workoutId: workout.id,
      workoutVersionId: versionId,
      workoutVariantId: variantId,
      scalingCategory: 'rx',
      structure,
      partialKey: 'full',
      opponentSessionId,
    });
    setSession(sessionId, state, opponentSessionId);
    router.replace('/workout/active');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Choose Opponent</Text>
        <Text style={styles.sub}>{workout?.name}</Text>
        <FlatList
          data={attempts}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <Pressable style={styles.row} onPress={() => rematch(item.sessionId)}>
              <Text style={styles.time}>{formatDuration(item.completionMs)}</Text>
              <Text style={styles.label}>{index === 0 ? 'Last' : index === attempts.length - 1 ? 'First attempt' : ''}</Text>
              <Text style={styles.action}>REMATCH THIS</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No attempts yet.</Text>}
        />
      </View>
    </SafeAreaView>
