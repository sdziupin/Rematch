#!/usr/bin/env node
// Synthesises REMATCH's workout cue sounds into assets/sounds/*.wav.
// Pure sine tones with a short attack and exponential decay: small, original, license-free.
//   node scripts/generate-sounds.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RATE = 22050;
const out = join(process.cwd(), 'assets', 'sounds');
mkdirSync(out, { recursive: true });

/** notes: [frequencyHz, startSec, durationSec, gain] */
function render(notes, totalSec) {
  const samples = new Float32Array(Math.ceil(totalSec * RATE));
  for (const [freq, start, dur, gain = 0.6] of notes) {
    const s0 = Math.floor(start * RATE);
    const n = Math.floor(dur * RATE);
    for (let i = 0; i < n && s0 + i < samples.length; i++) {
      const t = i / RATE;
      const attack = Math.min(1, t / 0.005);
      const decay = Math.exp((-4 * t) / dur);
      // A touch of the octave keeps beeps audible on small phone speakers.
      const tone = Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(4 * Math.PI * freq * t);
      samples[s0 + i] += tone * attack * decay * gain * 0.8;
    }
  }
  return samples;
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.max(-1, Math.min(1, v)) * 32767, i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const sounds = {
  tick: render([[880, 0, 0.09]], 0.12),
  go: render([[1320, 0, 0.28, 0.7]], 0.32),
  done: render([[660, 0, 0.1], [990, 0.09, 0.16]], 0.28),
  rest: render([[523, 0, 0.32, 0.5]], 0.36),
  finish: render([[660, 0, 0.14], [880, 0.12, 0.14], [1320, 0.24, 0.4, 0.7]], 0.7),
  pb: render([[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.12], [1047, 0.3, 0.5, 0.7]], 0.85),
};

for (const [name, samples] of Object.entries(sounds)) {
  writeFileSync(join(out, `${name}.wav`), wav(samples));
  console.log(`assets/sounds/${name}.wav`);
}
