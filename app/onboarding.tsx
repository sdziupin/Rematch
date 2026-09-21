import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { colors, spacing, typography } from '../src/theme';
import { updateProfile } from '../src/db/seed';

const GOALS = ['general_fitness', 'conditioning', 'strength_endurance', 'consistency'];
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const EQUIPMENT = ['bodyweight', 'mat', 'pull-up bar', 'dumbbells', 'bench', 'jump-rope'];
const TIMES = [10, 15, 20, 30];
const FREQ = [2, 3, 4, 5];

export default function Onboarding() {
