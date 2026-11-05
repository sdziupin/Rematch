import React, { useEffect } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, Keyframe, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { colors, elevation, radius, spacing, typography, makeStyles } from '../theme';
import { Button } from './Button';
import { EASE_OUT, SPRING, nativeKeyframe } from './motion';

const DIALOG_ENTER = nativeKeyframe(
  new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.95 }, { translateY: 8 }] },
    100: { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }], easing: EASE_OUT },
  })
    .duration(240)
    .reduceMotion(ReduceMotion.System),
  160,
);

const TOAST_ENTER =
  Platform.OS === 'web'
    ? FadeInDown.duration(220).reduceMotion(ReduceMotion.System)
    : FadeInDown.springify().damping(SPRING.damping).stiffness(SPRING.stiffness).mass(SPRING.mass).withInitialValues({ opacity: 0, transform: [{ translateY: 16 }] }).reduceMotion(ReduceMotion.System);
const TOAST_EXIT = FadeOutDown.duration(180).reduceMotion(ReduceMotion.System);

/**
 * App-wide confirm dialog and toast. React Native's `Alert.alert` with buttons
 * does nothing on the web, so every confirmation goes through here instead.
 */

interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
}

interface ToastState {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

interface DialogStore {
  confirm: ConfirmRequest | null;
  toast: ToastState | null;
}

const useDialogStore = create<DialogStore>(() => ({ confirm: null, toast: null }));

export function confirmAction(options: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.getState().confirm?.resolve(false);
    useDialogStore.setState({ confirm: { ...options, resolve } });
  });
}

/** True while a confirm dialog is on screen (keyboard shortcuts stand down). */
export function isConfirmOpen(): boolean {
  return useDialogStore.getState().confirm !== null;
}

let toastId = 0;
export function showToast(message: string, options: { tone?: ToastState['tone']; actionLabel?: string; onAction?: () => void } = {}) {
  useDialogStore.setState({ toast: { id: ++toastId, message, tone: options.tone ?? 'info', actionLabel: options.actionLabel, onAction: options.onAction } });
}

function ConfirmModal() {
  const styles = useStyles();
  const request = useDialogStore((s) => s.confirm);
  const close = (ok: boolean) => {
    request?.resolve(ok);
    useDialogStore.setState({ confirm: null });
  };
  return (
    <Modal visible={!!request} transparent animationType="fade" onRequestClose={() => close(false)}>
      <Pressable style={styles.backdrop} onPress={() => close(false)} accessibilityLabel="Dismiss">
        <Animated.View entering={DIALOG_ENTER} style={styles.dialogWrap}>
        <Pressable style={styles.dialog} onPress={() => undefined} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">
            {request?.title}
          </Text>
          {request?.message ? <Text style={styles.message}>{request.message}</Text> : null}
          <View style={styles.actions}>
            <Button title={request?.cancelLabel ?? 'Cancel'} variant="secondary" onPress={() => close(false)} style={styles.action} />
            <Button
              title={request?.confirmLabel ?? 'OK'}
              variant={request?.destructive ? 'danger' : 'primary'}
              onPress={() => close(true)}
              style={styles.action}
            />
          </View>
        </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function Toast() {
  const styles = useStyles();
  const toast = useDialogStore((s) => s.toast);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    // Dismissing unmounts the toast; its exit animation runs on the way out.
    const timer = setTimeout(() => {
      if (useDialogStore.getState().toast?.id === toast.id) useDialogStore.setState({ toast: null });
    }, toast.actionLabel ? 5000 : 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  const tone = toast.tone === 'success' ? colors.accent : toast.tone === 'error' ? colors.danger : colors.textSecondary;
  return (
    <Animated.View key={toast.id} entering={TOAST_ENTER} exiting={TOAST_EXIT} pointerEvents="box-none" style={[styles.toastWrap, { bottom: insets.bottom + 84 }]}>
      <View style={styles.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
        <View style={[styles.toastDot, { backgroundColor: tone }]} />
        <Text style={styles.toastText}>{toast.message}</Text>
        {toast.actionLabel && (
          <Pressable
            onPress={() => {
              toast.onAction?.();
              useDialogStore.setState({ toast: null });
            }}
            accessibilityRole="button"
            hitSlop={10}
          >
            <Text style={[styles.toastAction, { color: tone }]}>{toast.actionLabel}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

export function DialogHost() {
  return (
    <>
      <ConfirmModal />
      <Toast />
    </>
  );
}

const useStyles = makeStyles(() => ({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  dialogWrap: { width: '100%', maxWidth: 400 },
  dialog: { width: '100%', backgroundColor: colors.surface, borderRadius: radius.xl + 2, padding: spacing.lg, borderWidth: 1, borderColor: colors.scheme === 'light' ? colors.border : colors.borderStrong, ...elevation(3) },
  title: { ...typography.heading, color: colors.text },
  message: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  action: { flex: 1, paddingHorizontal: spacing.sm },
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: spacing.md },
  toast: {
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.scheme === 'light' ? colors.surface : colors.surfaceRaised,
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.scheme === 'light' ? colors.border : colors.borderStrong,
    ...elevation(3),
  },
  toastDot: { width: 7, height: 7, borderRadius: 4 },
  toastText: { ...typography.callout, color: colors.text, flexShrink: 1 },
  toastAction: { ...typography.bodyStrong },
}));
