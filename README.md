# REMATCH

**You vs. you.**

REMATCH is a premium mobile fitness app built with React Native + Expo. Race your past benchmark performances using real checkpoint telemetry.

## Features

- 30 original benchmark workouts (TEMPEST, EMBER, RIPTIDE, …)
- 52 exercises with scaling hierarchies
- REMATCH opponent system (PB, Last, any historical attempt)
- Live ahead/behind comparison during workouts
- Checkpoint breakdown on results
- Offline-first SQLite persistence
- Session recovery after background/kill
- Challenge Me duration picker
- Personal Best tracking with RX/scaled/partial isolation

## Run

```bash
npm install
npm start
```

Press `i` for iOS simulator or `a` for Android emulator.

## Test

```bash
npm test
```

## Stack

- Expo 57 + React Native
- expo-router navigation
- expo-sqlite + drizzle-orm
- Zustand workout state
- Original design system in `design/` and `src/theme/`
