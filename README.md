# Brief — the morning briefing for your body

A daily readiness app built with [Expo](https://expo.dev) (React Native, SDK 57). Open it each morning, run a calm ~30-second scan, and get one clear briefing: how you recovered, how much energy you have, and one mission for the day. No jargon, no charts you don't need.

Built at a hackathon by a mixed Mac/Windows team — everything below works the same on both.

## One-time setup (everyone)

1. Install [Node.js LTS](https://nodejs.org) (v20 or newer)
2. Install [Git](https://git-scm.com/downloads)
3. On your **phone**, install the **Expo Go** app ([App Store](https://apps.apple.com/app/expo-go/id982107779) / [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent))

## Run the app

```bash
git clone https://github.com/N1tr029/riwayah-hack.git
cd riwayah-hack
npm install
npx expo start
```

Scan the QR code with your phone (iPhone: Camera app; Android: from inside Expo Go). The app opens in Expo Go and **hot-reloads on every save**. If the venue Wi-Fi blocks the connection, use `npx expo start --tunnel`. Press `w` for the browser version (the camera scan is simulated on web), `i` for the iOS Simulator (Mac only).

## How it works

- **Scan** ([src/app/scan.tsx](src/app/scan.tsx)) — camera + torch turn on, you cover the lens with a fingertip. The accelerometer genuinely detects movement ("Gently hold still") and downgrades signal confidence. The biometric numbers themselves come from a plausible generator anchored to your history — the seam for real camera-PPG is `makeScanMetrics` in [src/lib/engine.ts](src/lib/engine.ts).
- **Engine** ([src/lib/engine.ts](src/lib/engine.ts)) — turns HRV/RHR/sleep into a recovery score, calm natural-language explanations, one recommendation, one mission. Always compared to *your* baseline, never a population.
- **Patterns** ([src/lib/patterns.ts](src/lib/patterns.ts)) — real computations over your history ("You recover better after volleyball than weightlifting", "Recovery drops when you sleep after midnight").
- **Store** ([src/lib/store.tsx](src/lib/store.tsx)) — AsyncStorage, seeded with 3 weeks of demo history on first launch (reset from Settings).

## Project layout

- `src/app/` — screens, one file per route ([expo-router](https://docs.expo.dev/router/introduction/)): tabs `(tabs)/` (Today / Insights / History), plus `scan`, `brief`, `details`, `settings`, `day/[date]`
- `src/components/` — UI building blocks (score ring, sparkline, waveform, cards)
- `src/lib/` — engine, patterns, storage, seed data
- `src/constants/theme.ts` — the calm palette (light + dark)

## Team workflow

- Everyone runs their **own** dev server and sees their **own** copy on their own phone — share code through Git, pull often.
- Windows folks: no Xcode needed, ever. Your phone + Expo Go is your test device; the browser (`w`) is the fastest iteration loop.
- Anything Apple-specific (Simulator, TestFlight, HealthKit dev build) → Hassan's Mac.
