# Plan: Pitch Detection (Sing/Play a Note)

## Goal
Let users sing or play a note on an instrument and have the app detect which note it is (C–G, same as the button row), as an alternative input method alongside the existing buttons and speech recognition.

## Library Choice: `react-native-pitch-detector`

**Why this one:**
- Returns the **note name directly** (e.g. `"A"`, `"C#"`) — no frequency-to-note math needed
- Simple event-based API: `PitchDetector.start()` / `.stop()` / `.addListener()`
- Uses battle-tested native engines (TarsosDSP on Android, Beethoven on iOS)
- Lightweight — no heavy DSP framework to bundle
- The project already requires a dev build (expo-speech-recognition), so adding another native module is fine

Other options considered:
- `react-native-pitchy` — returns frequency only, would need manual Hz→note conversion
- `@siteed/expo-audio-studio` — overkill for just pitch; better if we also wanted waveform visualisation
- `react-native-audio-api` — no microphone input support yet

## Implementation Steps

### 1. Install and configure `react-native-pitch-detector`
- `npm install react-native-pitch-detector`
- Run `npx expo prebuild` if an Expo config plugin is needed (or add to `app.json` plugins)
- Microphone permissions are already configured in `app.json` for both platforms

### 2. Create `src/utils/usePitchDetection.ts` hook
New hook modelled after the existing `useVoiceRecognition.ts`:

```ts
interface UsePitchDetectionOptions {
  onNote: (note: NoteName) => void;
}

function usePitchDetection({ onNote }: UsePitchDetectionOptions) {
  return { listening, available, start, stop, toggle };
}
```

Key behaviours:
- Lazy-load the native module (same pattern as voice recognition) so it doesn't crash in Expo Go
- Map the returned tone string (e.g. `"C#"`, `"Bb"`) to the nearest natural note name (`NoteName`)
  — The game only uses natural notes (C D E F G A B), so sharps/flats map to their nearest natural
- Debounce rapid detections (same 600ms window as voice recognition)
- Require a **minimum volume/confidence threshold** to avoid ambient noise triggering notes
- Expose the same `{ listening, available, start, stop, toggle }` API so it's a drop-in companion to voice recognition

### 3. Integrate into `GameScreen.tsx` and `GrandStaffGameScreen.tsx`
- Import `usePitchDetection` alongside `useVoiceRecognition`
- Wire `onNote` callback to the same `handleGuessRef` pattern
- Add a new toggle button in the buttons area (next to the existing Voice button):
  `"🎵 Pitch"` / `"🎵 Listening..."`
- When pitch detection is active, voice recognition should be stopped (and vice versa) — they both use the mic
- Both buttons only appear when their respective module is available

### 4. Mutual exclusion between voice and pitch modes
- When the user taps "Pitch", stop voice recognition if it's running
- When the user taps "Voice", stop pitch detection if it's running
- Could combine into a single button with 3 states (Off / Voice / Pitch) to simplify UI, but two separate buttons is simpler to implement and clearer to the user

### 5. Clean up and test
- Verify pitch detection works for singing and instruments
- Tune the volume threshold — too low picks up noise, too high misses quiet singing
- Ensure the "Play Again" reset and round-end cleanup stop pitch detection
- Remove debug logging from voice recognition (or keep behind a flag)

## Files Changed
- **New:** `src/utils/usePitchDetection.ts`
- **Modified:** `src/screens/GameScreen.tsx` — add pitch hook + UI button
- **Modified:** `src/screens/GrandStaffGameScreen.tsx` — same changes
- **Modified:** `package.json` — new dependency

## Risks / Open Questions
- **Latency:** Pitch detection inherently has ~50-100ms latency for low notes. Should be fine for this game's pace.
- **Sharps/flats mapping:** If someone plays C#, should it count as C or not match? Proposed: map to nearest natural note, which means C# → C (or D). We could use a ±50 cents threshold to reject notes that are too far from any natural.
- **Ambient noise:** Need a sensible volume floor. The library may expose a confidence or amplitude value we can threshold on.
- **Expo Go:** Won't work — same as voice recognition. The button just won't appear.
