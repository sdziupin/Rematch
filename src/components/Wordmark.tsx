import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

/** The REMATCH wordmark: two offset marks (you and past you) and the name. */
export function Wordmark({ size = 18 }: { size?: number }) {
  return (
    <View style={styles.wordmark} accessibilityRole="header" accessibilityLabel="REMATCH">
      <View style={{ width: size, height: size }}>
        <View style={[styles.markBack, { width: size * 0.62, height: size * 0.62, borderRadius: size * 0.31 }]} />
        <View style={[styles.markFront, { width: size * 0.62, height: size * 0.62, borderRadius: size * 0.31 }]} />
      </View>
      <Text style={[styles.brand, { fontSize: size, lineHeight: size * 1.2 }]}>REMATCH</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  markBack: { position: 'absolute', right: 0, bottom: 0, borderWidth: 1.5, borderColor: colors.textMuted },
  markFront: { position: 'absolute', left: 0, top: 0, backgroundColor: colors.accent },
  brand: { fontFamily: fonts.display, letterSpacing: 1.2, color: colors.text },
});
