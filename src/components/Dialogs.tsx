import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { colors, radius, spacing, typography } from '../theme';
import { Button } from './Button';

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
  const request = useDialogStore((s) => s.confirm);
  const close = (ok: boolean) => {
    request?.resolve(ok);
    useDialogStore.setState({ confirm: null });
  };
  return (
    <Modal visible={!!request} transparent animationType="fade" onRequestClose={() => close(false)}>
      <Pressable style={styles.backdrop} onPress={() => close(false)} accessibilityLabel="Dismiss">
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
      </Pressable>
    </Modal>
  );
}

function Toast() {
  const toast = useDialogStore((s) => s.toast);
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: Platform.OS !== 'web' }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start(() => {
        if (useDialogStore.getState().toast?.id === toast.id) useDialogStore.setState({ toast: null });
      });
    }, toast.actionLabel ? 5000 : 2600);
    return () => clearTimeout(timer);
  }, [toast, opacity]);

  if (!toast) return null;
  const tone = toast.tone === 'success' ? colors.accent : toast.tone === 'error' ? colors.danger : colors.textSecondary;
  return (
    <Animated.View pointerEvents="box-none" style={[styles.toastWrap, { bottom: insets.bottom + 84, opacity }]}>
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

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  dialog: { width: '100%', maxWidth: 400, backgroundColor: colors.surface, borderRadius: radius.xl + 2, padding: spacing.lg, borderWidth: 1, borderColor: colors.borderStrong },
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
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  toastDot: { width: 7, height: 7, borderRadius: 4 },
  toastText: { ...typography.callout, color: colors.text, flexShrink: 1 },
  toastAction: { ...typography.bodyStrong },
});
