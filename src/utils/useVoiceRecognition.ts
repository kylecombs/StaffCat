import { useCallback, useEffect, useRef, useState } from 'react';
import type { NoteName } from '../data/notes';

// ---------------------------------------------------------------------------
// Lazy-load expo-speech-recognition so the app still works in Expo Go
// (where native modules aren't available).
// ---------------------------------------------------------------------------

let SpeechModule: typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule | null = null;
let addSpeechListener: typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule.addListener | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('expo-speech-recognition');
  SpeechModule = mod.ExpoSpeechRecognitionModule ?? null;
  addSpeechListener = SpeechModule?.addListener?.bind(SpeechModule) ?? null;
} catch {
  // expo-speech-recognition not available (e.g. Expo Go) — voice stays disabled
}

// ---------------------------------------------------------------------------
// Speech engines transcribe spoken letter names as phonetic words rather than
// single characters.  Map the common transcriptions back to note names.
// ---------------------------------------------------------------------------

const PHONETIC_TO_NOTE: Record<string, NoteName> = {
  // A
  AY: 'A', HEY: 'A', EH: 'A', AE: 'A', EIGHT: 'A', ACE: 'A',
  // B
  BE: 'B', BEE: 'B', BEA: 'B', BEAN: 'B',
  // C
  SEE: 'C', SEA: 'C', CEE: 'C', SI: 'C',
  // D
  DEE: 'D', DE: 'D', DI: 'D', THE: 'D',
  // E
  EE: 'E', HE: 'E', YE: 'E',
  // F
  EFF: 'F', EF: 'F', IF: 'F', JEFF: 'F',
  // G
  GEE: 'G', GE: 'G', JEE: 'G', JI: 'G', SHE: 'G', JE: 'G',
};

/** Try to extract a note name from a speech transcript. */
function parseNoteFromTranscript(transcript: string): NoteName | null {
  const upper = transcript.trim().toUpperCase();

  // 1. Check for a standalone single letter A-G (best case)
  const letterMatch = upper.match(/\b([A-G])\b/);
  if (letterMatch) return letterMatch[1] as NoteName;

  // 2. Split into words and check each against the phonetic map
  const words = upper.split(/\s+/);
  for (let i = words.length - 1; i >= 0; i--) {
    // Strip trailing punctuation the engine may append
    const word = words[i].replace(/[^A-Z]/g, '');
    if (word.length === 1 && word >= 'A' && word <= 'G') return word as NoteName;
    if (PHONETIC_TO_NOTE[word]) return PHONETIC_TO_NOTE[word];
  }

  // 3. Last resort — check if the whole transcript (stripped) is a known phonetic
  const stripped = upper.replace(/[^A-Z]/g, '');
  if (stripped.length === 1 && stripped >= 'A' && stripped <= 'G') return stripped as NoteName;
  if (PHONETIC_TO_NOTE[stripped]) return PHONETIC_TO_NOTE[stripped];

  return null;
}

interface UseVoiceRecognitionOptions {
  onNote: (note: NoteName) => void;
}

/**
 * Cross-platform voice recognition hook.
 *
 * Uses expo-speech-recognition when available (dev builds, production).
 * Gracefully degrades to a no-op in Expo Go where native modules
 * aren't loaded — the voice button simply won't do anything.
 */
export function useVoiceRecognition({ onNote }: UseVoiceRecognitionOptions) {
  const [listening, setListening] = useState(false);
  const [available, setAvailable] = useState(false);
  const wantListeningRef = useRef(false);
  const onNoteRef = useRef(onNote);
  onNoteRef.current = onNote;

  // Debounce: prevent interim results from firing the same note repeatedly
  const lastFiredRef = useRef<{ note: NoteName; time: number } | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DEBOUNCE_MS = 600;

  // Check availability once on mount & register event listeners
  useEffect(() => {
    if (!SpeechModule || !addSpeechListener) return;
    setAvailable(true);

    const subs = [
      addSpeechListener('start', () => setListening(true)),

      addSpeechListener('end', () => {
        if (wantListeningRef.current) {
          // Delay restart so the engine finishes shutting down first.
          // Without this, an immediate start() call can silently fail on
          // some platforms, causing recognition to stop after the first note.
          restartTimerRef.current = setTimeout(() => {
            if (!wantListeningRef.current) return;
            try {
              SpeechModule!.start({ lang: 'en-US', interimResults: true, continuous: true });
            } catch {
              // Retry once more after a longer delay before giving up
              restartTimerRef.current = setTimeout(() => {
                if (!wantListeningRef.current) return;
                try {
                  SpeechModule!.start({ lang: 'en-US', interimResults: true, continuous: true });
                } catch {
                  setListening(false);
                  wantListeningRef.current = false;
                }
              }, 500);
            }
          }, 150);
        } else {
          setListening(false);
        }
      }),

      addSpeechListener('result', (event: any) => {
        const transcript: string = event.results?.[0]?.transcript ?? '';
        const note = parseNoteFromTranscript(transcript);
        if (note) {
          const now = Date.now();
          const last = lastFiredRef.current;
          if (last && last.note === note && now - last.time < DEBOUNCE_MS) {
            return; // skip duplicate from interim results
          }
          lastFiredRef.current = { note, time: now };
          onNoteRef.current(note);
        }
      }),

      addSpeechListener('error', () => {
        if (wantListeningRef.current) {
          // Try to restart after an error — the engine may have simply timed out
          restartTimerRef.current = setTimeout(() => {
            if (!wantListeningRef.current) return;
            try {
              SpeechModule!.start({ lang: 'en-US', interimResults: true, continuous: true });
            } catch {
              setListening(false);
              wantListeningRef.current = false;
            }
          }, 300);
        } else {
          setListening(false);
        }
      }),
    ];

    return () => {
      wantListeningRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try { SpeechModule!.abort(); } catch { /* ignore */ }
      subs.forEach((s) => s.remove());
    };
  }, []);

  // --- Public API ---

  const start = useCallback(async () => {
    if (!SpeechModule) return;
    try {
      const result = await SpeechModule.requestPermissionsAsync();
      if (!result.granted) {
        console.warn('Speech recognition permission not granted');
        return;
      }
      wantListeningRef.current = true;
      SpeechModule.start({ lang: 'en-US', interimResults: true, continuous: true });
    } catch (e) {
      console.warn('Could not start speech recognition:', e);
      wantListeningRef.current = false;
    }
  }, []);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    try { SpeechModule?.stop(); } catch { /* ignore */ }
    setListening(false);
  }, []);

  const toggle = useCallback(async () => {
    if (wantListeningRef.current) {
      stop();
    } else {
      await start();
    }
  }, [start, stop]);

  return { listening, available, start, stop, toggle };
}
