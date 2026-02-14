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

  // Check availability once on mount & register event listeners
  useEffect(() => {
    if (!SpeechModule || !addSpeechListener) return;
    setAvailable(true);

    const subs = [
      addSpeechListener('start', () => setListening(true)),

      addSpeechListener('end', () => {
        if (wantListeningRef.current) {
          try {
            SpeechModule!.start({ lang: 'en-US', interimResults: false, continuous: true });
          } catch {
            setListening(false);
            wantListeningRef.current = false;
          }
        } else {
          setListening(false);
        }
      }),

      addSpeechListener('result', (event: any) => {
        const transcript: string = event.results?.[0]?.transcript ?? '';
        const upper = transcript.trim().toUpperCase();
        const matches = upper.match(/\b([A-G])\b/g);
        if (matches && matches.length > 0) {
          onNoteRef.current(matches[matches.length - 1] as NoteName);
        }
      }),

      addSpeechListener('error', () => {
        if (!wantListeningRef.current) {
          setListening(false);
        }
      }),
    ];

    return () => {
      wantListeningRef.current = false;
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
      SpeechModule.start({ lang: 'en-US', interimResults: false, continuous: true });
    } catch (e) {
      console.warn('Could not start speech recognition:', e);
      wantListeningRef.current = false;
    }
  }, []);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
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
