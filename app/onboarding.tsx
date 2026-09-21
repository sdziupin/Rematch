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
  const router = useRouter();
  const [goal, setGoal] = useState('conditioning');
  const [level, setLevel] = useState('intermediate');
  const [equipment, setEquipment] = useState<string[]>(['bodyweight', 'mat']);
  const [minutes, setMinutes] = useState(15);
  const [freq, setFreq] = useState(3);

  const toggleEquip = (e: string) => {
    setEquipment((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  };

  const finish = async () => {
    await updateProfile({
      goal,
      level,
      typicalMinutes: minutes,
