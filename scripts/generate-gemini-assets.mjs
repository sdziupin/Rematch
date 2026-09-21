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
