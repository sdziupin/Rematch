import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ACCENTS, ACCENT_SPECS, APPEARANCES, APPEARANCE_LABELS, buildPalette, colors, fonts, makeStyles, radius, spacing, typography, useThemeStore, withAlpha, type AccentId, type Appearance } from '../theme';
import { haptic } from '../services/cues';
import { saveAccent, saveAppearance } from '../services/themeService';
import { Icon } from './Icon';
import { PressableScale } from './motion';

/** A miniature of the app in a theme: canvas, a card, a line of text and the accent. */
function ThemePreview({ appearance, accent }: { appearance: Appearance; accent: AccentId }) {
  const styles = useStyles();
  const system = useThemeStore((s) => s.system);
  if (appearance === 'system') {
    const dark = buildPalette('dark', accent);
    const light = buildPalette('light', accent);
    return (
      <View style={[styles.preview, styles.split]}>
        <View style={[styles.half, { backgroundColor: light.background }]}>
          <MiniCard p={light} />
        </View>
        <View style={[styles.half, { backgroundColor: dark.background }]}>
          <MiniCard p={dark} />
        </View>
      </View>
    );
  }
  const p = buildPalette(appearance, accent, system);
  return (
    <View style={[styles.preview, { backgroundColor: p.background }]}>
      <MiniCard p={p} />
    </View>
  );
}

function MiniCard({ p }: { p: ReturnType<typeof buildPalette> }) {
  const styles = useStyles();
  return (
    <View style={[styles.miniCard, { backgroundColor: p.surface, borderColor: p.border }]}>
      <View style={[styles.miniLine, { backgroundColor: p.text, width: '70%' }]} />
      <View style={[styles.miniLine, { backgroundColor: p.textMuted, width: '45%' }]} />
      <View style={[styles.miniButton, { backgroundColor: p.accent }]} />
    </View>
  );
}

export function AppearancePicker() {
  const styles = useStyles();
  const appearance = useThemeStore((s) => s.appearance);
  const accent = useThemeStore((s) => s.accent);

  return (
    <View style={styles.wrap}>
      <View style={styles.themes} accessibilityRole="radiogroup" accessibilityLabel="Theme">
        {APPEARANCES.map((a) => {
          const selected = a === appearance;
          return (
            <PressableScale
              key={a}
              scaleTo={0.95}
              onPress={() => {
                if (selected) return;
                haptic('selection');
                void saveAppearance(a);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${APPEARANCE_LABELS[a]} theme`}
              style={styles.theme}
            >
              <View style={[styles.previewFrame, selected && { borderColor: colors.accent }]}>
                <ThemePreview appearance={a} accent={accent} />
              </View>
              <Text style={[styles.themeLabel, selected && styles.themeLabelOn]} numberOfLines={1}>
                {APPEARANCE_LABELS[a]}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      <View>
        <Text style={styles.label}>Accent · {ACCENT_SPECS[accent].label}</Text>
        <View style={styles.swatches} accessibilityRole="radiogroup" accessibilityLabel="Accent colour">
          {ACCENTS.map((id) => {
            const selected = id === accent;
            const spec = ACCENT_SPECS[id];
            const fill = colors.scheme === 'light' ? spec.light : spec.dark;
            const ink = colors.scheme === 'light' ? spec.onLight : spec.onDark;
            return (
              <PressableScale
                key={id}
                scaleTo={0.88}
                onPress={() => {
                  if (selected) return;
                  haptic('selection');
                  void saveAccent(id);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${spec.label} accent`}
                style={[styles.swatchRing, selected && { borderColor: withAlpha(fill, 0.9) }]}
              >
                <View style={[styles.swatch, { backgroundColor: fill }]}>{selected && <Icon name="check" size={16} color={ink} strokeWidth={2.4} />}</View>
              </PressableScale>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { gap: spacing.lg },
  themes: { flexDirection: 'row', gap: spacing.sm + 2 },
  theme: { flex: 1, alignItems: 'center', gap: 8 },
  previewFrame: { width: '100%', borderRadius: radius.md + 2, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  preview: { width: '100%', aspectRatio: 0.78, borderRadius: radius.md - 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.border },
  split: { flexDirection: 'row' },
  half: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  miniCard: { width: '74%', borderRadius: 6, borderWidth: 1, padding: 6, gap: 4, minWidth: 30 },
  miniLine: { height: 4, borderRadius: 2 },
  miniButton: { height: 8, borderRadius: 4, marginTop: 4 },
  themeLabel: { ...typography.caption, color: colors.textSecondary },
  themeLabelOn: { color: colors.text, fontFamily: fonts.semibold },
  label: { ...typography.overline, color: colors.textMuted, marginBottom: spacing.sm + 2 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatchRing: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: withAlpha(colors.text, 0.08) },
}));
