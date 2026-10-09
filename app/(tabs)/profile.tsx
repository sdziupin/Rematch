import React, { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Button } from '../../src/components/Button';
import { confirmAction, showToast } from '../../src/components/Dialogs';
import { Icon } from '../../src/components/Icon';
import { Card, Chip, ChipRow, Grid, Screen, SectionTitle } from '../../src/components/ui';
import { EQUIPMENT, EQUIPMENT_LABELS } from '../../src/content/types';
import { getDriverInfo } from '../../src/db/client';
import { getProfile, profileEquipment, updateProfile, type Profile } from '../../src/db/repository';
import { titleCase } from '../../src/domain/utils';
import { useLayout } from '../../src/hooks/useLayout';
import { BackupError, backupFileName, createBackup, parseBackup, resetAllData, restoreBackup, serializeBackup } from '../../src/services/backupService';
import { haptic, playSound, prepareAudio, speak } from '../../src/services/cues';
import { pickTextFile, saveTextFile } from '../../src/services/fileTransfer';
import { useSettings } from '../../src/store/settingsStore';
import { colors, spacing, typography } from '../../src/theme';

const GOALS = ['general_fitness', 'conditioning', 'strength_endurance', 'consistency'] as const;
const LEVELS = ['beginner', 'intermediate', 'advanced', 'elite'] as const;
const MINUTES = [10, 15, 20, 30, 45] as const;
const FREQUENCY = [2, 3, 4, 5, 6] as const;
const COUNTDOWNS = [3, 5, 10] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const { isWide } = useLayout();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const storage = getDriverInfo();

  const refresh = useCallback(async () => {
    const p = await getProfile();
    setProfile(p);
    useSettings.getState().applyProfile(p);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const save = async (patch: Parameters<typeof updateProfile>[0]) => {
    setProfile((p) => (p ? ({ ...p, ...patch } as Profile) : p));
    await updateProfile(patch);
    await refresh();
  };

  if (!profile) return <Screen>{null}</Screen>;
  const equipment = profileEquipment(profile);

  const exportData = async () => {
    setBusy('export');
    try {
      const backup = await createBackup();
      const outcome = await saveTextFile(backupFileName(), serializeBackup(backup));
      showToast(outcome === 'shared' ? 'Backup ready to save' : `Backup saved · ${backup.data.results.length} results`, { tone: 'success' });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Export failed', { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const importData = async () => {
    setBusy('import');
    try {
      const text = await pickTextFile();
      if (!text) return;
      const backup = parseBackup(text);
      const ok = await confirmAction({
        title: 'Restore this backup?',
        message: `It replaces your current history with ${backup.data.results.length} results from ${new Date(backup.exportedAt).toLocaleDateString()}. Export first if you want to keep what's here.`,
        confirmLabel: 'Restore',
        destructive: true,
      });
      if (!ok) return;
      const { results } = await restoreBackup(backup);
      await refresh();
      useSettings.getState().touch();
      showToast(`Restored ${results} results`, { tone: 'success' });
    } catch (error) {
      showToast(error instanceof BackupError ? error.message : 'That backup could not be restored.', { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    const ok = await confirmAction({
      title: 'Erase everything?',
      message: 'All results, personal bests, programs and custom workouts are deleted from this device. This cannot be undone.',
      confirmLabel: 'Erase',
      destructive: true,
    });
    if (!ok) return;
    await resetAllData();
    useSettings.getState().touch();
    router.replace('/onboarding');
  };

  const training = (
    <Card style={styles.card}>
      <SectionTitle style={styles.noTop}>Training</SectionTitle>
      <Text style={styles.label}>Focus</Text>
      <ChipRow options={GOALS} value={profile.goal as (typeof GOALS)[number]} onChange={(goal) => save({ goal })} format={titleCase} />
      <Text style={styles.label}>Level</Text>
      <ChipRow options={LEVELS} value={profile.level as (typeof LEVELS)[number]} onChange={(level) => save({ level })} format={titleCase} />
      <Text style={styles.label}>Typical session</Text>
      <ChipRow options={MINUTES} value={profile.typicalMinutes as (typeof MINUTES)[number]} onChange={(typicalMinutes) => save({ typicalMinutes })} format={(m) => `${m} min`} />
      <Text style={styles.label}>Weekly goal</Text>
      <ChipRow options={FREQUENCY} value={profile.frequencyDays as (typeof FREQUENCY)[number]} onChange={(frequencyDays) => save({ frequencyDays })} format={(d) => `${d}× / week`} />
      <Text style={styles.label}>Equipment you have</Text>
      <View style={styles.chips}>
        {EQUIPMENT.filter((e) => e !== 'bodyweight').map((e) => (
          <Chip
            key={e}
            label={EQUIPMENT_LABELS[e]}
            selected={equipment.includes(e)}
            onPress={() => {
              const next = equipment.includes(e) ? equipment.filter((x) => x !== e) : [...equipment, e];
              void save({ equipmentJson: JSON.stringify(next) });
            }}
          />
        ))}
      </View>
    </Card>
  );

  const behaviour = (
    <Card style={styles.card}>
      <SectionTitle style={styles.noTop}>During a workout</SectionTitle>
      <Setting
        label="Sound cues"
        hint="Countdown beeps, round chimes. Plays over your music."
        value={profile.soundEnabled}
        onChange={(v) => {
          void save({ soundEnabled: v }).then(() => {
            if (v) void prepareAudio().then(() => playSound('done'));
          });
        }}
      />
      <Setting
        label="Voice coach"
        hint="Announces each movement and rest."
        value={profile.voiceEnabled}
        onChange={(v) => {
          void save({ voiceEnabled: v }).then(() => v && speak('Voice coach on. Ten burpees.'));
        }}
      />
      <Setting
        label="Haptics"
        hint="Vibration on reps, rounds and countdowns."
        value={profile.hapticsEnabled}
        onChange={(v) => {
          void save({ hapticsEnabled: v }).then(() => v && haptic('success'));
        }}
      />
      <Setting label="Keep screen awake" hint="While a workout is running." value={profile.keepAwakeEnabled} onChange={(v) => save({ keepAwakeEnabled: v })} />
      <Text style={styles.label}>Countdown before starting</Text>
      <ChipRow options={COUNTDOWNS} value={(profile.countdownSec ?? 3) as (typeof COUNTDOWNS)[number]} onChange={(countdownSec) => save({ countdownSec })} format={(s) => `${s} s`} />
      <Text style={styles.label}>Week starts on</Text>
      <ChipRow options={[1, 0] as const} value={(profile.weekStartsOn ?? 1) as 0 | 1} onChange={(weekStartsOn) => save({ weekStartsOn })} format={(d) => (d === 1 ? 'Monday' : 'Sunday')} />
    </Card>
  );

  const data = (
    <Card style={styles.card}>
      <SectionTitle style={styles.noTop}>Your data</SectionTitle>
      <View style={styles.storage}>
        <Icon name="info" size={18} color={storage?.persistent === false ? colors.behind : colors.secondary} />
        <Text style={[styles.hint, storage?.persistent === false && { color: colors.behind }]}>
          {storage?.persistent === false
            ? 'Temporary storage: this browser tab could not open persistent storage (private window, or REMATCH is open in another tab). Export a backup before closing.'
            : `Stored ${storage?.description?.toLowerCase() ?? 'on this device'}. No account, no server — export a backup to move it.`}
        </Text>
      </View>
      <View style={styles.row}>
        <Button title="Export backup" icon="download" variant="secondary" onPress={exportData} loading={busy === 'export'} style={styles.flex} />
        <Button title="Import backup" icon="upload" variant="secondary" onPress={importData} loading={busy === 'import'} style={styles.flex} />
      </View>
      <Button title="Erase all data" icon="trash" variant="ghost" onPress={reset} />
    </Card>
  );

  const about = (
    <Card style={styles.card}>
      <SectionTitle style={styles.noTop}>Training safety</SectionTitle>
      <Text style={styles.hint}>Warm up first, scale anything that hurts, and stop if you feel sharp pain. REMATCH does not provide medical advice.</Text>
      <Text style={[styles.hint, { marginTop: spacing.sm }]}>REMATCH {Constants.expoConfig?.version ?? ''} · MIT licensed · animations and sounds are original.</Text>
    </Card>
  );

  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        Profile
      </Text>
      <Text style={styles.tagline}>You vs. you.</Text>
      {isWide ? (
        <Grid columns={2}>
          <View style={styles.stack}>
            {training}
            {about}
          </View>
          <View style={styles.stack}>
            {behaviour}
            {data}
          </View>
        </Grid>
      ) : (
        <View style={styles.stack}>
          {training}
          {behaviour}
          {data}
          {about}
        </View>
      )}
    </Screen>
  );
}

function Setting({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.setting}>
      <View style={styles.flex}>
        <Text style={styles.settingLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.border }} thumbColor={colors.primary} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { ...typography.displayLG, color: colors.primary },
  tagline: { ...typography.body, color: colors.accent, marginBottom: spacing.md },
  stack: { gap: spacing.md },
  card: { gap: spacing.sm },
  noTop: { marginTop: 0 },
  label: { ...typography.label, color: colors.muted, marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  setting: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 8 },
  settingLabel: { ...typography.bodyBold, color: colors.primary },
  hint: { ...typography.caption, color: colors.secondary, flex: 1 },
  storage: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  row: { flexDirection: 'row', gap: spacing.sm },
});
