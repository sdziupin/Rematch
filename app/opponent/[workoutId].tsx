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
