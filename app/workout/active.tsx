import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Button } from '../../src/components/Button';
import { ExerciseVisual } from '../../src/components/ExerciseVisual';
import { RematchBar, TimerDisplay } from '../../src/components/RematchBar';
import { RaceRails } from '../../src/components/RaceRails';
import { getExercise, getProfile, getWorkoutById } from '../../src/db/seed';
import { advanceRep, getCurrentExercise, nextStep } from '../../src/engine/workoutEngine';
import { getLiveDelta, getOpponentProgress } from '../../src/domain/rematch';
import { getElapsedActiveMs, pauseTimer, resumeTimer, startTimer } from '../../src/domain/timer';
import { useWorkoutTimer } from '../../src/hooks/useWorkoutTimer';
import {
  addCheckpoint,
  appendEvent,
  completeSession,
  getCheckpoints,
  getSession,
  saveSessionState,
} from '../../src/services/sessionService';
import { useWorkoutStore } from '../../src/store/workoutStore';
import { colors, spacing, typography, touchTarget } from '../../src/theme';
import { getCheckpointKey } from '../../src/engine/workoutEngine';

export default function ActiveWorkoutScreen() {
