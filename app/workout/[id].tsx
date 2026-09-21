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

