import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { CheckpointBreakdown } from '../../src/components/RaceRails';
import { buildRematchComparison, saveFeedback } from '../../src/services/sessionService';
import { colors, spacing, typography } from '../../src/theme';
import { formatDuration, formatDelta } from '../../src/domain/utils';

export default function ResultScreen() {
  const { sessionId, opponentSessionId } = useLocalSearchParams<{ sessionId: string; opponentSessionId?: string }>();
  const router = useRouter();
  const [comparison, setComparison] = useState<any>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    (async () => {
      if (!sessionId) return;
      if (opponentSessionId) {
        const cmp = await buildRematchComparison(sessionId, opponentSessionId);
        setComparison(cmp);
      } else {
        const { getSession } = await import('../../src/services/sessionService');
        const s = await getSession(sessionId);
        setComparison({ youMs: s?.elapsedActiveMs ?? 0, isFirst: true });
      }
    })();
  }, [sessionId, opponentSessionId]);

  const submitFeedback = async (intensity: string) => {
    if (!sessionId || feedbackSent) return;
    await saveFeedback(sessionId, intensity);
    setFeedbackSent(true);
  };

  if (!comparison) return <SafeAreaView style={styles.safe} />;

  const isFirst = comparison.isFirst;
  const won = comparison.won;
  const newPb = comparison.isNewPb;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.headline}>
          {isFirst ? 'FIRST RESULT' : newPb ? 'NEW PERSONAL BEST' : won ? 'YOU WON' : comparison.tied ? 'TIED' : 'SO CLOSE'}
        </Text>
        <Text style={styles.time}>{formatDuration(comparison.youMs)}</Text>
        {!isFirst && comparison.opponentMs != null && (
          <Text style={styles.opponent}>vs {formatDuration(comparison.opponentMs)} · {formatDelta(comparison.deltaMs)}</Text>
        )}
        {newPb && <Text style={styles.pbNote}>New opponent created.</Text>}
        {comparison.checkpoints?.length > 0 && (
          <View style={styles.breakdown}>
            <Text style={styles.section}>CHECKPOINTS</Text>
            <CheckpointBreakdown items={comparison.checkpoints.map((c: any) => ({ label: c.label, deltaMs: c.deltaMs }))} />
          </View>
