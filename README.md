# Brief — the morning briefing for your body

A daily readiness app built with [Expo](https://expo.dev) (React Native, SDK 54 — pinned to what the app-store Expo Go clients support). Open it each morning, sync Apple Health, and get one clear briefing from recorded sleep and heart data.

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

Scan the QR code with your phone (iPhone: Camera app; Android: from inside Expo Go). The app opens in Expo Go and **hot-reloads on every save**. If the venue Wi-Fi blocks the connection, use `npx expo start --tunnel`. Press `w` for the browser version or `i` for the iOS Simulator (Mac only). Apple Health requires the native development build described below.

## How it works

- **Health sync** ([src/app/scan.tsx](src/app/scan.tsx)) — reads sleep, resting heart rate, HRV, and a recent heart-rate sample directly from Apple Health. Missing values stay missing.
- **Engine** ([src/lib/engine.ts](src/lib/engine.ts)) — turns HRV/RHR/sleep into a recovery score, calm natural-language explanations, one recommendation, one mission. Always compared to *your* baseline, never a population.
- **Patterns** ([src/lib/patterns.ts](src/lib/patterns.ts)) — conservative associations computed only after enough real history exists.
- **Store** ([src/lib/store.tsx](src/lib/store.tsx)) — AsyncStorage containing only the user's saved records and runs; no demo history is seeded.

## Project layout

- `src/app/` — screens, one file per route ([expo-router](https://docs.expo.dev/router/introduction/)): tabs `(tabs)/` (Today / Insights / History), plus `scan`, `brief`, `details`, `settings`, `day/[date]`
- `src/components/` — UI building blocks (score ring, sparkline, waveform, cards)
- `src/lib/` — health access, engine, patterns, storage, and run tracking
- `src/constants/theme.ts` — the calm palette (light + dark)

## Health sync (Apple Health / Google Health Connect)

Brief reads sleep and heart metrics from **Apple Health** (iOS) and **Health Connect** (Android).
This needs native modules, so it does NOT work
inside Expo Go — the Settings toggle stays disabled there and explains why.

To use it, make a development build:

- **iOS (needs a Mac + Xcode):** `npx expo run:ios --device` — installs a dev build with
  HealthKit entitlements on a plugged-in iPhone. Then enable the toggle in Settings.
- **Android:** `npx expo run:android` (Android Studio) or
  `eas build --profile development --platform android` in the cloud — no local toolchain needed.
  Requires Health Connect installed (built into Android 14+).

The integration lives in [src/lib/health.ts](src/lib/health.ts). If a required sample is missing,
Brief shows that state instead of generating a replacement value.

## Runs + Strava

The Run tab has a one-tap **Just Run** mode plus optional timed plans. Distance comes only from
GPS, and heart rate is included only when Apple Health publishes a real sample during the run.
Finished runs export as TCX and upload to Strava (`activity:write`). One-tap sync needs a Strava
API app — see `.env.example`; without it, share the TCX file instead.

## Team workflow

- Everyone runs their **own** dev server and sees their **own** copy on their own phone — share code through Git, pull often.
- Windows folks: no Xcode needed, ever. Your phone + Expo Go is your test device; the browser (`w`) is the fastest iteration loop.
- Anything Apple-specific (Simulator, TestFlight, HealthKit dev build) → Hassan's Mac.
