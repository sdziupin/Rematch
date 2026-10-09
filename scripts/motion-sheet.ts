/**
 * Renders every exercise motion as a contact sheet (HTML) for visual review.
 *
 *   npx tsx scripts/motion-sheet.ts [out.html] [--only id1,id2] [--frames 6]
 *
 * Each row is one exercise sampled at evenly spaced points of its cycle, plus a
 * live looping preview at the end of the row.
 */
import { writeFileSync } from 'node:fs';
import { MOTIONS } from '../src/animation/motions';
import { centreOffset, frameAt, frameToSvg } from '../src/animation/skeleton';

const args = process.argv.slice(2);
const out = args.find((a) => a.endsWith('.html')) ?? 'motion-sheet.html';
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(',')) : null;
const framesIdx = args.indexOf('--frames');
const frames = framesIdx >= 0 ? Number(args[framesIdx + 1]) : 6;

let names = new Map<string, string>();
try {
  // Names are optional: the sheet still renders while content is being edited.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EXERCISE_SEEDS } = require('../src/content/seed') as { EXERCISE_SEEDS: { id: string; name: string }[] };
  names = new Map(EXERCISE_SEEDS.map((e) => [e.id, e.name]));
} catch {
  // ignore
}
const ids = Object.keys(MOTIONS).filter((id) => !only || only.has(id));

const rows = ids.map((id) => {
  const motion = MOTIONS[id];
  const offset = centreOffset(motion);
  const cells = Array.from({ length: frames }, (_, i) => {
    const t = i / frames;
    return `<div class="cell">${frameToSvg(frameAt(motion, t, offset), { size: 110 })}<span>t=${t.toFixed(2)}</span></div>`;
  }).join('');
  const thumb = frameToSvg(frameAt(motion, motion.thumbT ?? 0.5, offset), { size: 110, color: '#F4A261', dim: '#8a5a33' });
  return `<div class="row"><div class="name">${names.get(id) ?? id}<small>${id} · ${motion.view} · ${motion.durationMs}ms</small></div>${cells}<div class="cell">${thumb}<span>thumb</span></div></div>`;
});

writeFileSync(
  out,
  `<!doctype html><meta charset="utf-8"><title>Motion sheet</title><style>
  body{background:#09090B;color:#F4F4F1;font:12px system-ui;margin:12px}
  .row{display:flex;gap:6px;align-items:center;margin-bottom:8px}
  .name{width:150px;font-weight:600}.name small{display:block;color:#6B7280;font-weight:400}
  .cell{display:flex;flex-direction:column;align-items:center;color:#6B7280}
  </style>${rows.join('\n')}`,
);
console.log(`Wrote ${ids.length} motions to ${out}`);
