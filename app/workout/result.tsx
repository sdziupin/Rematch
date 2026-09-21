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
