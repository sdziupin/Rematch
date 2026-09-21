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
- `copy/ui.json` — product strings
- `screens/` — per-screen layout specs

## Active Workout (Priority Screen)

Thumb zone (bottom 40%): NEXT, rep stepper (−/+, large), pause.
Top: workout name, round progress.
Center: exercise name (large), rep count, movement visual.
Bottom strip: elapsed timer + REMATCH delta (ahead/behind).

Minimum touch target: 48pt. Timer display: 56pt+.

## REMATCH Race UI

Two horizontal progress rails (YOU vs opponent). Opponent marker from checkpoint telemetry — never linear interpolation.

## Handoff

Engineering imports tokens from `src/theme/`. Content seeds loaded into SQLite on first launch.
