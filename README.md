# riwayah-hack

Hackathon app — built with [Expo](https://expo.dev) (React Native, SDK 57). One codebase, runs on iOS + Android + web. Works on Mac **and** Windows.

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

Then scan the QR code in the terminal with your phone (iPhone: use the Camera app; Android: scan from inside Expo Go). The app opens in Expo Go and **hot-reloads every time you save a file**.

Other ways to view it while `npx expo start` is running:

- press **`w`** → opens in your browser (works on any laptop)
- press **`i`** → iOS Simulator (Mac only)
- press **`a`** → Android emulator (needs Android Studio)

### QR code won't connect?

Your phone and laptop must be on the same Wi-Fi. Venue/corporate Wi-Fi often blocks this — use:

```bash
npx expo start --tunnel
```

## Where the code lives

- `src/app/` — screens. Each file is a route ([file-based routing](https://docs.expo.dev/router/introduction/)): `index.tsx` is the home screen, `_layout.tsx` wraps everything.
- `src/components/` — shared UI components
- `src/constants/theme.ts` — colors/theme
- `src/hooks/` — shared hooks

## Team workflow

- Everyone runs their **own** dev server and sees their **own** copy on their own phone — share code through Git (pull often!).
- Windows folks: you never need Xcode or a Mac. iPhone + Expo Go **is** your iOS test device; the browser (`w`) is the fastest way to iterate.
- iOS Simulator / TestFlight / anything Apple-specific → Hassan's Mac.
