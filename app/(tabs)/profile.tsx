import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProfile, updateProfile } from '../../src/db/seed';
import { colors, spacing, typography } from '../../src/theme';

export default function ProfileScreen() {
  const [haptics, setHaptics] = useState(true);
  const [sound, setSound] = useState(true);
  const [voice, setVoice] = useState(false);
  const [keepAwake, setKeepAwake] = useState(true);

