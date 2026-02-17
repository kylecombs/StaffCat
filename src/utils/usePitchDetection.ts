import { useCallback, useEffect, useRef, useState } from 'react';
import type { NoteName } from '../data/notes';

// ---------------------------------------------------------------------------
// Lazy-load react-native-pitch-detector so the app still works in Expo Go
// (where native modules aren't available).
// ---------------------------------------------------------------------------

let PitchDetector: {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  addListener: (cb: (data: { frequency: number; tone: string }) => void) => { remove: () => void };
} | null = null;

try {
  const mod = require('react-native-pitch-detector');
  PitchDetector = mod.PitchDetector ?? null;
} catch {
  // react-native-pitch-detector not available — pitch detection stays disabled
}

// ---------------------------------------------------------------------------
// Map detected tone strings (e.g. "C#", "Bb", "A") to the nearest natural
// note name.  The game only uses natural notes C D E F G A B.
// ---------------------------------------------------------------------------

const NATURAL_NOTES: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** Map a tone string like "C#4" or "Bb" to the nearest natural NoteName. */
function toneToNoteName(tone: string): NoteName | null {
  if (!tone) return null;
  // The detector may return e.g. "C#", "Db", "A", "F#4" etc.
  // Strip octave digits and grab the base letter + accidental
  const cleaned = tone.replace(/[0-9]/g, '').trim().toUpperCase();
  if (cleaned.length === 0) return null;

  const letter = cleaned[0];
  if (letter < 'A' || letter > 'G') return null;

  // If it's already a natural note, return directly
  if (cleaned.length === 1) return letter as NoteName;

  // For sharps/flats, map to the nearest natural:
  // C# / Db -> could be C or D — we round to the sharp's base: C# -> C, D# -> D, etc.
  // Flats go to the note below: Bb -> B (the letter itself), Db -> D (the letter)
  // Since the letter IS the base for flats (Bb = B-flat, still "B" letter)
  // and for sharps the letter is also the base (C# starts as C)
  // just return the letter — this is the closest natural in most cases.
  return letter as NoteName;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UsePitchDetectionOptions {
  onNote: (note: NoteName) => void;
}

/**
 * Real-time pitch detection hook.
 *
 * Uses react-native-pitch-detector when available (dev builds, production).
 * Gracefully degrades to a no-op in Expo Go where the native module
 * isn't loaded — the feature simply won't be available.
 */
export function usePitchDetection({ onNote }: UsePitchDetectionOptions) {
  const [listening, setListening] = useState(false);
  const [available, setAvailable] = useState(false);
  const wantListeningRef = useRef(false);
  const onNoteRef = useRef(onNote);
  onNoteRef.current = onNote;
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);

  // Debounce: avoid rapid-fire detections of the same note
  const lastFiredRef = useRef<{ note: NoteName; time: number } | null>(null);
  const DEBOUNCE_MS = 400;

  useEffect(() => {
    if (!PitchDetector) return;
    setAvailable(true);

    return () => {
      wantListeningRef.current = false;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      PitchDetector?.stop().catch(() => {});
    };
  }, []);

  const start = useCallback(async () => {
    if (!PitchDetector) return;
    console.log('[Pitch] start() called');
    try {
      wantListeningRef.current = true;

      subscriptionRef.current?.remove();
      subscriptionRef.current = PitchDetector.addListener((data) => {
        if (!wantListeningRef.current) return;
        const note = toneToNoteName(data.tone);
        if (!note) return;

        const now = Date.now();
        const last = lastFiredRef.current;
        if (last && last.note === note && now - last.time < DEBOUNCE_MS) {
          return; // debounce
        }
        console.log('[Pitch] detected:', data.tone, data.frequency.toFixed(1), 'Hz ->', note);
        lastFiredRef.current = { note, time: now };
        onNoteRef.current(note);
      });

      await PitchDetector.start();
      setListening(true);
      console.log('[Pitch] started');
    } catch (e) {
      console.warn('[Pitch] start failed:', e);
      wantListeningRef.current = false;
      setListening(false);
    }
  }, []);

  const stop = useCallback(async () => {
    console.log('[Pitch] stop() called');
    wantListeningRef.current = false;
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    try { await PitchDetector?.stop(); } catch { /* ignore */ }
    setListening(false);
  }, []);

  const toggle = useCallback(async () => {
    if (wantListeningRef.current) {
      await stop();
    } else {
      await start();
    }
  }, [start, stop]);

  return { listening, available, start, stop, toggle };
}
