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
