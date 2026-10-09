import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useSettings } from '../store/settingsStore';

/**
 * Workout feedback: haptics, beeps and spoken cues, each behind its setting.
 * Every call is fire-and-forget and never throws — a missing audio device or
 * an unsupported browser API must not interrupt a workout.
 */

export type Sound = 'tick' | 'go' | 'done' | 'rest' | 'finish' | 'pb';

const SOURCES: Record<Sound, number> = {
  tick: require('../../assets/sounds/tick.wav'),
  go: require('../../assets/sounds/go.wav'),
  done: require('../../assets/sounds/done.wav'),
  rest: require('../../assets/sounds/rest.wav'),
  finish: require('../../assets/sounds/finish.wav'),
  pb: require('../../assets/sounds/pb.wav'),
};

let players: Partial<Record<Sound, AudioPlayer>> = {};
let modeSet = false;

/** Lets cue sounds play in silent mode and on top of the athlete's music. */
export async function prepareAudio() {
  if (modeSet) return;
  modeSet = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
  } catch {
    // Not supported everywhere; sounds still play.
  }
}

export function playSound(name: Sound) {
  if (!useSettings.getState().sound) return;
  try {
    const player = (players[name] ??= createAudioPlayer(SOURCES[name]));
    void player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    // ignore
  }
}

export function releaseAudio() {
  for (const p of Object.values(players)) {
    try {
      p?.release();
    } catch {
      // ignore
    }
  }
  players = {};
}

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning';

export function haptic(kind: HapticKind = 'light') {
  if (!useSettings.getState().haptics) return;
  try {
    let p: Promise<void>;
    if (kind === 'success') p = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'warning') p = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else p = Haptics.impactAsync(kind === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    void p.catch(() => undefined);
  } catch {
    // ignore
  }
}

export function speak(text: string) {
  if (!useSettings.getState().voice) return;
  try {
    Speech.stop();
    Speech.speak(text, { rate: 1.02 });
  } catch {
    // ignore
  }
}

export function stopSpeaking() {
  try {
    Speech.stop();
  } catch {
    // ignore
  }
}
