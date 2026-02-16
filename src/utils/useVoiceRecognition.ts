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
  const DEBOUNCE_MS = 150;

  // Check availability once on mount & register event listeners
  useEffect(() => {
    if (!SpeechModule || !addSpeechListener) return;
    setAvailable(true);

    const subs = [
      addSpeechListener('start', () => {
        console.log('[Voice] >>> start event');
        setListening(true);
      }),

      addSpeechListener('end', () => {
        console.log('[Voice] >>> end event, wantListening=', wantListeningRef.current);
        if (wantListeningRef.current) {
          // Delay restart so the engine finishes shutting down first.
          restartTimerRef.current = setTimeout(() => {
            if (!wantListeningRef.current) {
              console.log('[Voice] end restart: wantListening became false, skipping');
              return;
            }
            console.log('[Voice] end restart: attempting start()...');
            try {
              SpeechModule!.start({ lang: 'en-US', interimResults: true, continuous: true });
              console.log('[Voice] end restart: start() succeeded');
            } catch (e) {
              console.warn('[Voice] end restart: start() failed, retrying in 500ms', e);
              restartTimerRef.current = setTimeout(() => {
                if (!wantListeningRef.current) return;
                try {
                  SpeechModule!.start({ lang: 'en-US', interimResults: true, continuous: true });
                  console.log('[Voice] end restart (retry): start() succeeded');
                } catch (e2) {
                  console.warn('[Voice] end restart (retry): giving up', e2);
                  setListening(false);
                  wantListeningRef.current = false;
                }
              }, 500);
            }
          }, 150);
        } else {
          console.log('[Voice] end: not restarting (wantListening=false)');
          setListening(false);
        }
      }),

      addSpeechListener('result', (event: any) => {
        const result = event.results?.[0];
        const transcript: string = result?.transcript ?? '';
        const segments: Array<{ segment: string }> = result?.segments ?? [];
        const isFinal: boolean = event.isFinal ?? result?.isFinal ?? false;
        console.log('[Voice] >>> result event, transcript=', JSON.stringify(transcript), 'isFinal=', isFinal, 'raw=', JSON.stringify(event.results));

        // Use the most recent segment rather than the full transcript to avoid
        // accumulation issues when multiple notes are spoken in one session.
        const lastSegment = segments.length > 0 ? segments[segments.length - 1].segment : null;
        const textToParse = lastSegment ?? transcript;
        console.log('[Voice] result: parsing from', JSON.stringify(textToParse));

        const note = parseNoteFromTranscript(textToParse);
        if (note) {
          const now = Date.now();
          const last = lastFiredRef.current;
          if (last && last.note === note && now - last.time < DEBOUNCE_MS) {
            console.log('[Voice] result: debounced duplicate', note);
            return;
          }
          console.log('[Voice] result: firing note', note);
          lastFiredRef.current = { note, time: now };
          onNoteRef.current(note);
        } else {
          console.log('[Voice] result: no note parsed from', JSON.stringify(textToParse));
        }
      }),

      addSpeechListener('error', (event: any) => {
        console.warn('[Voice] >>> error event', JSON.stringify(event));
        if (wantListeningRef.current) {
          console.log('[Voice] error: will retry in 300ms');
          restartTimerRef.current = setTimeout(() => {
            if (!wantListeningRef.current) return;
            try {
              SpeechModule!.start({ lang: 'en-US', interimResults: true, continuous: true });
              console.log('[Voice] error restart: start() succeeded');
            } catch (e) {
              console.warn('[Voice] error restart: giving up', e);
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
    console.log('[Voice] start() called');
    try {
      const result = await SpeechModule.requestPermissionsAsync();
      if (!result.granted) {
        console.warn('[Voice] start: permission not granted');
        return;
      }
      wantListeningRef.current = true;
      SpeechModule.start({ lang: 'en-US', interimResults: true, continuous: true });
      console.log('[Voice] start: SpeechModule.start() called');
    } catch (e) {
      console.warn('[Voice] start: failed', e);
      wantListeningRef.current = false;
    }
  }, []);

  const stop = useCallback(() => {
    console.log('[Voice] stop() called');
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
