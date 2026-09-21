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
      frequencyDays: freq,
      equipmentJson: JSON.stringify(equipment),
      onboardingComplete: true,
    });
    router.replace('/(tabs)/today');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.brand}>REMATCH</Text>
        <Text style={styles.tagline}>You vs. you.</Text>
        <Text style={styles.intro}>Every workout becomes your next opponent. Quick setup — then your first challenge.</Text>

        <Section title="Focus">
          <Row options={GOALS} value={goal} onChange={setGoal} />
        </Section>
        <Section title="Level">
          <Row options={LEVELS} value={level} onChange={setLevel} />
        </Section>
        <Section title="Equipment">
          <Wrap options={EQUIPMENT} selected={equipment} onToggle={toggleEquip} />
        </Section>
        <Section title="Typical time">
          <NumRow options={TIMES} value={minutes} onChange={setMinutes} suffix=" min" />
        </Section>
        <Section title="Days per week">
          <NumRow options={FREQ} value={freq} onChange={setFreq} suffix="+" />
        </Section>

        <Button title="YOUR FIRST CHALLENGE" onPress={finish} style={{ marginTop: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.row}>
