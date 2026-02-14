import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import type { NoteName } from '../data/notes';

interface UseVoiceRecognitionOptions {
  onNote: (note: NoteName) => void;
}

/**
 * Cross-platform voice recognition hook using expo-speech-recognition.
 * Works on iOS, Android, and Web.
 *
 * Toggle listening on/off. While listening, spoken note letters (A–G)
 * are extracted from transcripts and forwarded via `onNote`.
 */
export function useVoiceRecognition({ onNote }: UseVoiceRecognitionOptions) {
  const [listening, setListening] = useState(false);
  const wantListeningRef = useRef(false);
  const onNoteRef = useRef(onNote);
  onNoteRef.current = onNote;

  // --- Event handlers via expo-speech-recognition hooks ---

  useSpeechRecognitionEvent('start', () => {
    setListening(true);
  });

  useSpeechRecognitionEvent('end', () => {
    // If we still want to be listening (continuous toggle), restart
    if (wantListeningRef.current) {
      try {
        ExpoSpeechRecognitionModule.start({
          lang: 'en-US',
          interimResults: false,
          continuous: true,
        });
      } catch {
        setListening(false);
        wantListeningRef.current = false;
      }
    } else {
      setListening(false);
    }
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript ?? '';
    const upper = transcript.trim().toUpperCase();
    // Extract note letters — take the last one spoken
    const matches = upper.match(/\b([A-G])\b/g);
    if (matches && matches.length > 0) {
      const letter = matches[matches.length - 1] as NoteName;
      onNoteRef.current(letter);
    }
  });

  useSpeechRecognitionEvent('error', () => {
    if (!wantListeningRef.current) {
      setListening(false);
    }
  });

  // --- Public API ---

  const start = useCallback(async () => {
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        console.warn('Speech recognition permission not granted');
        return;
      }
      wantListeningRef.current = true;
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: false,
        continuous: true,
      });
    } catch (e) {
      console.warn('Could not start speech recognition:', e);
      wantListeningRef.current = false;
    }
  }, []);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // ignore
    }
    setListening(false);
  }, []);

  const toggle = useCallback(async () => {
    if (wantListeningRef.current) {
      stop();
    } else {
      await start();
    }
  }, [start, stop]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  return { listening, start, stop, toggle };
}
