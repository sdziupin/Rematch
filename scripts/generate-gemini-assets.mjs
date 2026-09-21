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
