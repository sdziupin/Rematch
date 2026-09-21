# REMATCH Design System

Implementation-ready design foundation for REMATCH — **You vs. you.**

## Brand

- **Product:** REMATCH
- **Tagline:** You vs. you.
- **Tone:** Athletic, premium, modern, focused, confident — competitive without toxicity.

## Visual Identity

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0A0C10` | App canvas |
| Surface | `#141820` | Cards, sheets |
| Surface Elevated | `#1C2230` | Active controls |
| Primary | `#E8ECF4` | Primary text |
| Accent | `#4ECDC4` | Ahead, PB, primary CTA |
| Accent Warm | `#F4A261` | Behind, challenge |
| Success | `#6BCB77` | Win, new PB |
| Muted | `#6B7280` | Secondary text |
| Border | `#2A3142` | Dividers |

**Typography**
- Display: Bebas Neue — workout names, timers, round counts
- Body: DM Sans — UI copy, metadata

**Motion**
- Countdown: 200ms scale per tick
- Transitions: 250ms ease-out
- No blocking animations on workout controls

## Files

- `tokens/colors.ts` — color tokens (mirrored in `src/theme/`)
- `tokens/typography.ts` — type scale
- `tokens/spacing.ts` — 4px grid
- `content/workouts.json` — 30 benchmark workouts
- `content/exercises.json` — 52 exercises with scaling
