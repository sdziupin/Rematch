import React, { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Button } from '../../src/components/Button';
import { confirmAction, showToast } from '../../src/components/Dialogs';
import { Icon } from '../../src/components/Icon';
import { Wordmark } from '../../src/components/Wordmark';
import { Card, Chip, ChipRow, Grid, Screen, ScreenHeader, SectionTitle } from '../../src/components/ui';
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
    <View>
      <SectionTitle>Training</SectionTitle>
      <Card style={styles.group}>
        <Field label="Focus">
          <ChipRow options={GOALS} value={profile.goal as (typeof GOALS)[number]} onChange={(goal) => save({ goal })} format={titleCase} />
        </Field>
        <Field label="Level">
          <ChipRow options={LEVELS} value={profile.level as (typeof LEVELS)[number]} onChange={(level) => save({ level })} format={titleCase} />
        </Field>
        <Field label="Typical session">
          <ChipRow options={MINUTES} value={profile.typicalMinutes as (typeof MINUTES)[number]} onChange={(typicalMinutes) => save({ typicalMinutes })} format={(m) => `${m} min`} />
        </Field>
        <Field label="Weekly goal">
          <ChipRow options={FREQUENCY} value={profile.frequencyDays as (typeof FREQUENCY)[number]} onChange={(frequencyDays) => save({ frequencyDays })} format={(d) => `${d} a week`} />
        </Field>
        <Field label="Equipment" last>
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
        </Field>
      </Card>
    </View>
  );

  const behaviour = (
    <View>
      <SectionTitle>During a workout</SectionTitle>
      <Card style={styles.group}>
        <Setting
          label="Sound cues"
          hint="Countdown beeps and round chimes, mixed with your music."
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
        <Field label="Countdown">
          <ChipRow options={COUNTDOWNS} value={(profile.countdownSec ?? 3) as (typeof COUNTDOWNS)[number]} onChange={(countdownSec) => save({ countdownSec })} format={(s) => `${s} seconds`} />
        </Field>
        <Field label="Week starts on" last>
          <ChipRow options={[1, 0] as const} value={(profile.weekStartsOn ?? 1) as 0 | 1} onChange={(weekStartsOn) => save({ weekStartsOn })} format={(d) => (d === 1 ? 'Monday' : 'Sunday')} />
        </Field>
      </Card>
    </View>
  );

  const data = (
    <View>
      <SectionTitle>Your data</SectionTitle>
      <Card style={styles.group}>
        <View style={[styles.field, styles.storage]}>
          <Icon name="info" size={17} color={colors.textMuted} />
          <Text style={styles.hint}>Stored {storage?.description ?? 'on this device'}. No account, no server. Export a backup to move it.</Text>
        </View>
        <View style={[styles.field, styles.fieldLast, styles.row]}>
          <Button title="Export" icon="download" variant="secondary" onPress={exportData} loading={busy === 'export'} style={styles.flex} />
          <Button title="Import" icon="upload" variant="secondary" onPress={importData} loading={busy === 'import'} style={styles.flex} />
        </View>
      </Card>
      <Button title="Erase all data" variant="ghost" onPress={reset} style={styles.erase} />
    </View>
  );

  const about = (
    <View>
      <SectionTitle>About</SectionTitle>
      <Card style={styles.about}>
        <Wordmark size={14} />
        <Text style={styles.hint}>Warm up first, scale anything that hurts, and stop if you feel sharp pain. REMATCH does not provide medical advice.</Text>
        <Text style={styles.version}>Version {Constants.expoConfig?.version ?? ''} · MIT licensed · Original animations and sounds</Text>
      </Card>
    </View>
  );

  return (
    <Screen>
      <ScreenHeader title="Profile" subtitle="How you train, how workouts behave, and where your data lives." />
      {isWide ? (
        <Grid columns={2} gap={spacing.lg}>
          <View>
            {training}
            {about}
          </View>
          <View>
            {behaviour}
            {data}
          </View>
        </Grid>
      ) : (
        <View>
          {training}
          {behaviour}
          {data}
          {about}
        </View>
      )}
    </Screen>
  );
}

function Field({ label, last, children }: { label: string; last?: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.field, last && styles.fieldLast]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Setting({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={[styles.field, styles.setting]}>
      <View style={styles.flex}>
        <Text style={styles.settingLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.surfaceHover }}
        thumbColor={value ? colors.onAccent : colors.textSecondary}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { padding: 0, overflow: 'hidden' },
  field: { gap: spacing.sm + 2, paddingHorizontal: spacing.md + 2, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  fieldLast: { borderBottomWidth: 0 },
  label: { ...typography.overline, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  setting: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  settingLabel: { ...typography.bodyStrong, color: colors.text },
  hint: { ...typography.caption, color: colors.textSecondary, flex: 1, marginTop: 1 },
  storage: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm + 2 },
  row: { flexDirection: 'row', gap: spacing.sm },
  erase: { alignSelf: 'flex-start', marginTop: spacing.sm, paddingHorizontal: spacing.md + 2 },
  about: { gap: spacing.sm + 4 },
  version: { ...typography.caption, color: colors.textMuted },
});
