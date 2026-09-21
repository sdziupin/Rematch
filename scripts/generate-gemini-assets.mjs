#!/usr/bin/env node
/**
 * REMATCH asset generator — Gemini native image generation
 *
 * Requires GEMINI_API_KEY with image generation quota (paid tier).
 * Models: gemini-3.1-flash-image (default), gemini-2.5-flash-image
 *
 * Usage:
 *   node scripts/generate-gemini-assets.mjs --type icon
 *   node scripts/generate-gemini-assets.mjs --type exercises --limit 10
 *   node scripts/generate-gemini-assets.mjs --type workouts --all
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const API_KEY = process.env.GEMINI_API_KEY;

const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const BRAND = {
  bg: '#0A0C10',
  surface: '#141820',
  accent: '#4ECDC4',
  accentWarm: '#F4A261',
  success: '#6BCB77',
};

const STYLE_PREFIX = `Premium REMATCH fitness app visual. Dark charcoal background ${BRAND.surface}. Minimal athletic geometric line-art figure. Clean, modern, confident. No text, no watermark.`;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { type: 'exercises', limit: 5, all: false, id: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type') opts.type = args[++i];
    else if (args[i] === '--limit') opts.limit = Number(args[++i]);
    else if (args[i] === '--all') opts.all = true;
    else if (args[i] === '--id') opts.id = args[++i];
  }
  return opts;
}

async function generateImage(prompt, aspectRatio = '1:1') {
  if (!API_KEY) throw new Error('GEMINI_API_KEY is not set');

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio },
    },
  };

  const res = await fetch(`${API_URL}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.error) {
    const err = new Error(data.error.message || 'Gemini API error');
    err.code = data.error.code;
    throw err;
  }

  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) {
      return {
        buffer: Buffer.from(inline.data, 'base64'),
        mime: inline.mimeType || inline.mime_type || 'image/png',
      };
    }
  }
  throw new Error('No image in Gemini response');
}

function extForMime(mime) {
  if (mime.includes('png')) return '.png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('webp')) return '.webp';
  return '.png';
}

async function saveImage(prompt, outPath, aspectRatio = '1:1') {
  const { buffer, mime } = await generateImage(prompt, aspectRatio);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const finalPath = outPath.replace(/\.[^.]+$/, '') + extForMime(mime);
  fs.writeFileSync(finalPath, buffer);
  console.log(`✓ ${finalPath} (${buffer.length} bytes)`);
  return finalPath;
}

function loadSeed() {
  // Dynamic import of TS seed via transpile-free JSON export
  const seedPath = path.join(ROOT, 'design/content/seed-manifest.json');
  if (fs.existsSync(seedPath)) {
    return JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  }
  return null;
}

function exercisePrompt(name, category) {
  const color = category === 'squat' || category === 'lunge' ? BRAND.accentWarm
    : category === 'core' ? BRAND.success
    : category === 'cardio' ? '#5B8DEF'
    : BRAND.accent;
  return `${STYLE_PREFIX} Exercise: ${name}. Category: ${category}. Accent color ${color}. Single clear pose for instruction.`;
}

function workoutPrompt(name, symbol, focus) {
  return `${STYLE_PREFIX} Abstract workout identity symbol for "${name}" (${focus}). Inspired by ${symbol}. Geometric storm/force motif. Teal and white on dark. Square card art.`;
}

async function generateIcon() {
  const prompt = `App icon for REMATCH fitness app. Square. Background ${BRAND.bg}. Bold stylized letter R in off-white with diagonal teal slash ${BRAND.accent}. Premium athletic minimal flat vector. No other text.`;
  await saveImage(prompt, path.join(ROOT, 'assets/icon.png'));
  await saveImage(prompt, path.join(ROOT, 'assets/splash-icon.png'));
  await saveImage(prompt, path.join(ROOT, 'assets/android-icon-foreground.png'));
}

async function generateExercises(limit, singleId) {
  const manifest = loadSeed();
  const exercises = manifest?.exercises ?? [
    { id: 'push-up', name: 'Push-up', category: 'push' },
    { id: 'air-squat', name: 'Air Squat', category: 'squat' },
    { id: 'burpee', name: 'Burpee', category: 'conditioning' },
    { id: 'plank-hold', name: 'Plank Hold', category: 'core' },
  ];

  const list = singleId ? exercises.filter((e) => e.id === singleId) : exercises.slice(0, limit);
  for (const ex of list) {
    const out = path.join(ROOT, `assets/generated/exercises/${ex.id}.png`);
    if (fs.existsSync(out)) {
      console.log(`– skip ${ex.id} (exists)`);
      continue;
    }
    try {
      await saveImage(exercisePrompt(ex.name, ex.category), out);
      await sleep(1500);
    } catch (e) {
      console.error(`✗ ${ex.id}: ${e.message}`);
      if (e.code === 429 || e.message.includes('quota')) {
        console.error('\nGemini image quota exhausted. Enable billing at https://ai.google.dev/');
        process.exit(1);
      }
    }
  }
}

async function generateWorkouts(limit, singleId) {
  const manifest = loadSeed();
  const workouts = manifest?.workouts ?? [{ id: 'tempest', name: 'TEMPEST', symbol: 'storm', focus: 'full body' }];
  const list = singleId ? workouts.filter((w) => w.id === singleId || w.slug === singleId) : workouts.slice(0, limit);

  for (const w of list) {
    const slug = w.slug || w.id.replace(/^w-/, '');
    const out = path.join(ROOT, `assets/generated/workouts/${slug}.png`);
    if (fs.existsSync(out)) {
      console.log(`– skip ${slug} (exists)`);
      continue;
    }
    try {
      await saveImage(workoutPrompt(w.name, w.symbol, w.focus), out);
