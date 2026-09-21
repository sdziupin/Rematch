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
