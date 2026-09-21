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
