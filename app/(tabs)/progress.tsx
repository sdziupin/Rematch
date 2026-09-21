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
