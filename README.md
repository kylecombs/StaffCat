# StaffCat

A gentle music staff notation learning game built with React Native and Expo. Inspired by [StaffWars](https://apps.apple.com/us/app/staffwars/id810405576), but designed to be calmer and more encouraging for young learners.

## How It Works

1. **Pick a clef** — treble, bass, or grand staff
2. **Choose a level** — 6 levels that increase in note range and scroll speed
3. **Play** — notes scroll across the staff from right to left; identify each note by tapping a button (C through B) or saying the note name aloud
4. **Get feedback** — correct answers pop with a pleasant chime; wrong answers get a gentle wobble; missed notes quietly fade away
5. **See your results** — score, percentage, best streak, and a 1–3 star rating after each 20-note round

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (installed automatically via npx)
- For iOS: macOS with Xcode
- For Android: Android Studio with an emulator configured

### Install Dependencies

```bash
npm install
```

### Run the App

```bash
# Start the Expo dev server (shows QR code for Expo Go)
npx expo start

# Or run directly on a platform:
npm run ios       # iOS simulator (macOS only)
npm run android   # Android emulator
npm run web       # Browser
```

To run on a physical device, install [Expo Go](https://expo.dev/go) and scan the QR code from the terminal.

### Voice Recognition

Voice input uses [expo-speech-recognition](https://github.com/jamsch/expo-speech-recognition) and works on iOS, Android, and Web.

| Environment | Voice works? | How to run |
|---|---|---|
| Web (Chrome/Edge) | Yes | `npx expo start --web` |
| Dev build (iOS/Android) | Yes | `npx expo run:ios` / `npx expo run:android` |
| Expo Go | No (button hidden) | `npx expo start` |

Expo Go doesn't support custom native modules, so the voice button is automatically hidden there. To test voice on a phone or simulator, create a [dev build](https://docs.expo.dev/develop/development-builds/introduction/) with `npx expo run:ios` or `npx expo run:android`.

## Project Structure

```
├── App.tsx                           # Root component and screen navigation
├── src/
│   ├── data/
│   │   └── notes.ts                  # Notes, clefs, staff positions, level definitions
│   ├── components/
│   │   ├── Staff.tsx                  # 5-line staff with clef symbol
│   │   └── NoteHead.tsx              # Animated note head with ledger lines
│   ├── screens/
│   │   ├── HomeScreen.tsx            # Clef selection
│   │   ├── LevelSelectScreen.tsx     # Level picker
│   │   ├── GameScreen.tsx            # Single-staff gameplay
│   │   └── GrandStaffGameScreen.tsx  # Grand staff gameplay
│   └── utils/
│       ├── theme.ts                  # Colors, spacing, typography constants
│       ├── sound.ts                  # Programmatically generated sound effects
│       └── useVoiceRecognition.ts    # Cross-platform voice input hook
├── app.json                          # Expo configuration
└── tsconfig.json                     # TypeScript configuration
```

## Levels

| Level | Note Range | Speed |
|-------|-----------|-------|
| 1 | Staff lines only | Very slow (10s) |
| 2 | Full staff | Slow (9s) |
| 3 | Full staff | Moderate (7.5s) |
| 4 | Staff + 1 ledger line | Moderate (6s) |
| 5 | Staff + 2 ledger lines | Faster (5s) |
| 6 | Full range | Fast (4s) |

## Design Choices vs StaffWars

- **No explosions** — missed notes fade away gently instead of exploding
- **No speed ramp** — speed stays constant within a level; pick a harder level when ready
- **Positive feedback** — chime sounds, streak counter, and star ratings reward progress
- **Voice input** — say the note name instead of (or in addition to) tapping buttons
- **Minimal UI** — warm cream/blue palette with no distracting theme
