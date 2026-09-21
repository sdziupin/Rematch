import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { getActiveSession } from '../../src/services/sessionService';
import { getWorkoutById } from '../../src/db/seed';
import { useWorkoutStore } from '../../src/store/workoutStore';
import { colors, spacing, typography } from '../../src/theme';
import type { ActiveWorkoutState } from '../../src/domain/types';
import { restoreTimerFromElapsed } from '../../src/domain/timer';

export default function RecoveryScreen() {
  const router = useRouter();
  const { setSession, setTimer } = useWorkoutStore();
  const [info, setInfo] = React.useState<{ name: string; startedAgo: string; sessionId: string; state: ActiveWorkoutState; elapsed: number; status: string } | null>(null);

