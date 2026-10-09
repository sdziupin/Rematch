import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../src/components/Button';
import { ExerciseAnimation } from '../src/components/ExerciseAnimation';
import { Chip, ChipRow, Screen } from '../src/components/ui';
import { EQUIPMENT, EQUIPMENT_LABELS, type EquipmentId } from '../src/content/types';
import { getProfile, updateProfile } from '../src/db/repository';
import { titleCase } from '../src/domain/utils';
import { useLayout } from '../src/hooks/useLayout';
import { useSettings } from '../src/store/settingsStore';
import { colors, spacing, typography } from '../src/theme';

const GOALS = ['general_fitness', 'conditioning', 'strength_endurance', 'consistency'] as const;
const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const TIMES = [10, 15, 20, 30] as const;
const FREQ = [2, 3, 4, 5] as const;

export default function Onboarding() {
  const router = useRouter();
  const { isWide } = useLayout();
  const [goal, setGoal] = useState<(typeof GOALS)[number]>('conditioning');
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('intermediate');
  const [equipment, setEquipment] = useState<EquipmentId[]>(['bodyweight', 'mat']);
  const [minutes, setMinutes] = useState<(typeof TIMES)[number]>(15);
  const [freq, setFreq] = useState<(typeof FREQ)[number]>(3);
  const [saving, setSaving] = useState(false);

  const toggleEquip = (e: EquipmentId) => setEquipment((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));

  const finish = async () => {
    setSaving(true);
    await updateProfile({ goal, level, typicalMinutes: minutes, frequencyDays: freq, equipmentJson: JSON.stringify(equipment), onboardingComplete: true });
    useSettings.getState().applyProfile(await getProfile());
    router.replace('/today');
  };

  return (
    <Screen narrow>
      <View style={[styles.hero, isWide && styles.heroWide]}>
        <View style={styles.flex}>
          <Text style={styles.brand}>REMATCH</Text>
          <Text style={styles.tagline}>You vs. you.</Text>
          <Text style={styles.intro}>
            Every workout you finish becomes your next opponent. Race your own recorded splits, find where you gained or lost time, and beat the last version of yourself.
          </Text>
        </View>
        <ExerciseAnimation exerciseId="burpee" size={isWide ? 180 : 140} />
      </View>

      <Section title="What are you training for?">
        <ChipRow options={GOALS} value={goal} onChange={setGoal} format={titleCase} />
      </Section>
      <Section title="Your level">
        <ChipRow options={LEVELS} value={level} onChange={setLevel} format={titleCase} />
      </Section>
      <Section title="Equipment you have">
        <View style={styles.wrap}>
          {EQUIPMENT.filter((e) => e !== 'bodyweight').map((e) => (
            <Chip key={e} label={EQUIPMENT_LABELS[e]} selected={equipment.includes(e)} onPress={() => toggleEquip(e)} />
          ))}
        </View>
        <Text style={styles.hint}>No equipment? Plenty of workouts need nothing at all.</Text>
      </Section>
      <Section title="Typical session">
        <ChipRow options={TIMES} value={minutes} onChange={setMinutes} format={(m) => `${m} min`} />
      </Section>
      <Section title="Sessions per week">
        <ChipRow options={FREQ} value={freq} onChange={setFreq} format={(f) => `${f}×`} />
      </Section>

      <Button title="SHOW MY FIRST CHALLENGE" icon="bolt" size="lg" onPress={finish} loading={saving} style={{ marginTop: spacing.xl }} />
      <Text style={[styles.hint, { textAlign: 'center', marginTop: spacing.md }]}>Everything stays on this device. Change any of this later in Profile.</Text>
    </Screen>
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { gap: spacing.md, alignItems: 'center', marginBottom: spacing.lg },
  heroWide: { flexDirection: 'row' },
  brand: { ...typography.displayXL, color: colors.primary },
  tagline: { ...typography.subheading, color: colors.accent, marginBottom: spacing.sm },
  intro: { ...typography.body, color: colors.secondary },
  section: { marginBottom: spacing.lg, gap: spacing.sm },
  sectionTitle: { ...typography.label, color: colors.muted, textTransform: 'uppercase' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { ...typography.caption, color: colors.muted },
});
