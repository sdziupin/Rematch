import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../src/components/Button';
import { ExerciseAnimation } from '../src/components/ExerciseAnimation';
import { Wordmark } from '../src/components/Wordmark';
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
          <Wordmark size={16} />
          <Text style={styles.headline}>Your next opponent is you.</Text>
          <Text style={styles.intro}>
            Every workout you finish becomes a recorded rival. Race your own splits, see exactly where you gained or lost time, and beat the last version of yourself.
          </Text>
        </View>
        <View style={styles.demo}>
          <ExerciseAnimation exerciseId="burpee" size={isWide ? 200 : 168} color={colors.accent} background={null} />
        </View>
      </View>

      <Text style={styles.setupTitle}>Set up in 20 seconds</Text>
      <Section title="What are you training for?">
        <ChipRow options={GOALS} value={goal} onChange={setGoal} format={titleCase} />
      </Section>
      <Section title="Your level">
        <ChipRow options={LEVELS} value={level} onChange={setLevel} format={titleCase} />
      </Section>
      <Section title="Equipment you have" hint="No equipment? Plenty of workouts need nothing at all.">
        <View style={styles.wrap}>
          {EQUIPMENT.filter((e) => e !== 'bodyweight').map((e) => (
            <Chip key={e} label={EQUIPMENT_LABELS[e]} selected={equipment.includes(e)} onPress={() => toggleEquip(e)} />
          ))}
        </View>
      </Section>
      <Section title="Typical session">
        <ChipRow options={TIMES} value={minutes} onChange={setMinutes} format={(m) => `${m} min`} />
      </Section>
      <Section title="Sessions per week" last>
        <ChipRow options={FREQ} value={freq} onChange={setFreq} format={(f) => `${f} a week`} />
      </Section>

      <Button title="Show my first challenge" icon="forward" size="lg" onPress={finish} loading={saving} style={{ marginTop: spacing.xl }} />
      <Text style={styles.footnote}>Everything stays on this device. Change any of this later in Profile.</Text>
    </Screen>
  );
}

function Section({ title, hint, last, children }: { title: string; hint?: string; last?: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.section, last && styles.sectionLast]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { gap: spacing.lg, marginBottom: spacing.xxl, marginTop: spacing.md },
  heroWide: { flexDirection: 'row', alignItems: 'center' },
  headline: { ...typography.display, fontSize: 44, lineHeight: 48, color: colors.text, marginTop: spacing.xl },
  intro: { ...typography.body, fontSize: 16, lineHeight: 24, color: colors.textSecondary, marginTop: spacing.md },
  demo: { alignSelf: 'center', borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  setupTitle: { ...typography.overline, color: colors.textMuted, marginBottom: spacing.sm },
  section: { paddingVertical: spacing.md + 4, gap: spacing.sm + 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  sectionLast: { borderBottomWidth: 0 },
  sectionTitle: { ...typography.subheading, color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hint: { ...typography.caption, color: colors.textMuted },
  footnote: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
});
