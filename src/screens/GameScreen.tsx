import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import Staff, { STAFF_LEFT_MARGIN } from '../components/Staff';
import NoteHead from '../components/NoteHead';
import {
  NoteData,
  NoteName,
  ClefType,
  LevelDef,
  getNotesForLevel,
} from '../data/notes';
import { playCorrect, playIncorrect, playMissed, loadSounds } from '../utils/sound';
import { colors, spacing, fontSizes, borderRadius } from '../utils/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActiveNote {
  key: number;
  note: NoteData;
  animX: Animated.Value;
  feedback: 'none' | 'correct' | 'incorrect';
  answered: boolean;
}

interface GameScreenProps {
  clef: ClefType;
  level: LevelDef;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HALF_SPACE = 12; // pixels per staff position
const STAFF_CONTAINER_H = HALF_SPACE * 20; // generous room for ledger lines
const NOTE_BUTTONS: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NOTES_PER_ROUND = 20;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const GameScreen: React.FC<GameScreenProps> = ({ clef, level, onBack }) => {
  useKeepAwake();

  const [activeNotes, setActiveNotes] = useState<ActiveNote[]>([]);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [spawned, setSpawned] = useState(0);
  const [finished, setFinished] = useState(false);
  const [showNoteName, setShowNoteName] = useState<string | null>(null);

  const noteKeyRef = useRef(0);
  const activeNotesRef = useRef<ActiveNote[]>([]);
  const availableNotes = useRef(getNotesForLevel(clef, level)).current;
  const spawnedRef = useRef(0);
  const spawnNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchronous set to prevent double-spawning when stopAnimation
  // fires the completion callback before React state updates
  const handledKeysRef = useRef<Set<number>>(new Set());

  // Keep ref in sync
  activeNotesRef.current = activeNotes;

  // Voice recognition state
  const [voiceListening, setVoiceListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Load sounds on mount
  useEffect(() => {
    loadSounds();
  }, []);

  // ------------------------------------------------------------------
  // Voice recognition (Web Speech API — works on web and some Android)
  // ------------------------------------------------------------------
  const startVoiceRecognition = useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const last = event.results[event.results.length - 1];
        if (last.isFinal) {
          const transcript = last[0].transcript.trim().toUpperCase();
          // Extract note letter from speech
          const match = transcript.match(/\b([A-G])\b/);
          if (match) {
            handleGuess(match[1] as NoteName);
          }
        }
      };

      recognition.onerror = () => {
        setVoiceListening(false);
      };

      recognition.onend = () => {
        // Restart if still listening
        if (recognitionRef.current) {
          try {
            recognition.start();
          } catch {
            setVoiceListening(false);
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setVoiceListening(true);
    }
  }, []);

  const stopVoiceRecognition = useCallback(() => {
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      try {
        rec.stop();
      } catch {
        // ignore
      }
      setVoiceListening(false);
    }
  }, []);

  // Clean up voice on unmount
  useEffect(() => {
    return () => {
      stopVoiceRecognition();
    };
  }, [stopVoiceRecognition]);

  // ------------------------------------------------------------------
  // Spawn one note at a time
  // ------------------------------------------------------------------
  const spawnNote = useCallback(() => {
    if (spawnedRef.current >= NOTES_PER_ROUND) return;
    spawnedRef.current += 1;

    const note = availableNotes[Math.floor(Math.random() * availableNotes.length)];
    const key = noteKeyRef.current++;
    const animX = new Animated.Value(SCREEN_WIDTH);

    const newNote: ActiveNote = { key, note, animX, feedback: 'none', answered: false };

    setActiveNotes((prev) => [...prev, newNote]);
    setSpawned((s) => s + 1);

    // Animate from right edge to clef area
    Animated.timing(animX, {
      toValue: STAFF_LEFT_MARGIN,
      duration: level.scrollDurationMs,
      useNativeDriver: true,
    }).start(() => {
      // Note reached the clef without being answered
      if (handledKeysRef.current.has(key)) return;
      handledKeysRef.current.add(key);
      playMissed();
      setTotal((t) => t + 1);
      setStreak(0);
      setActiveNotes((prev) => prev.filter((n) => n.key !== key));
      spawnNextTimerRef.current = setTimeout(spawnNote, 400);
    });
  }, [availableNotes, level.scrollDurationMs]);

  // Spawn the very first note
  useEffect(() => {
    if (finished) return;
    const timeout = setTimeout(spawnNote, 500);
    return () => {
      clearTimeout(timeout);
      if (spawnNextTimerRef.current) clearTimeout(spawnNextTimerRef.current);
    };
  }, [finished, spawnNote]);

  useEffect(() => {
    if (total >= NOTES_PER_ROUND && !finished) {
      setFinished(true);
      if (spawnNextTimerRef.current) clearTimeout(spawnNextTimerRef.current);
      stopVoiceRecognition();
    }
  }, [total, finished, stopVoiceRecognition]);

  // ------------------------------------------------------------------
  // Handle a guess
  // ------------------------------------------------------------------
  const handleGuess = useCallback((guess: NoteName) => {
    const notes = activeNotesRef.current;
    // Find the left-most unanswered note (closest to clef)
    const unanswered = notes
      .filter((n) => !n.answered)
      .sort((a, b) => {
        // Lower animX value = closer to clef = should be answered first
        // We can't easily read animated value, so use key order (lower key = spawned earlier)
        return a.key - b.key;
      });

    if (unanswered.length === 0) return;

    const target = unanswered[0];
    if (handledKeysRef.current.has(target.key)) return;
    handledKeysRef.current.add(target.key);

    const isCorrect = target.note.name === guess;

    // Show the note name briefly
    setShowNoteName(target.note.name);
    setTimeout(() => setShowNoteName(null), 800);

    if (isCorrect) {
      playCorrect();
      setScore((s) => s + 1);
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
    } else {
      playIncorrect();
      setStreak(0);
    }

    setTotal((t) => t + 1);

    // Update feedback
    setActiveNotes((prev) =>
      prev.map((n) =>
        n.key === target.key
          ? { ...n, feedback: isCorrect ? 'correct' : 'incorrect', answered: true }
          : n,
      ),
    );

    // Stop the scroll animation so the note doesn't also trigger the "missed" handler
    target.animX.stopAnimation();

    // Remove after feedback animation plays, then spawn next
    const delay = isCorrect ? 600 : 500;
    setTimeout(() => {
      setActiveNotes((prev) => prev.filter((n) => n.key !== target.key));
      spawnNextTimerRef.current = setTimeout(spawnNote, 300);
    }, delay);
  }, [spawnNote]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (finished) {
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const stars = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 50 ? 1 : 0;

    return (
      <View style={styles.container}>
        <View style={styles.resultsCard}>
          <Text style={styles.resultsTitle}>Round Complete!</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3].map((s) => (
              <Text
                key={s}
                style={[
                  styles.star,
                  { color: s <= stars ? colors.starGold : colors.starEmpty },
                ]}
              >
                ★
              </Text>
            ))}
          </View>

          <Text style={styles.resultsStat}>
            {score} / {total} correct ({pct}%)
          </Text>
          <Text style={styles.resultsStat}>Best streak: {bestStreak}</Text>

          <View style={styles.resultsButtons}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={onBack}
            >
              <Text style={styles.buttonSecondaryText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={() => {
                setScore(0);
                setTotal(0);
                setStreak(0);
                setBestStreak(0);
                setSpawned(0);
                setFinished(false);
                setActiveNotes([]);
              }}
            >
              <Text style={styles.buttonPrimaryText}>Play Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const centreY = STAFF_CONTAINER_H / 2;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.scoreArea}>
          <Text style={styles.scoreText}>
            {score}/{total}
          </Text>
          {streak >= 3 && (
            <Text style={styles.streakText}>🔥 {streak}</Text>
          )}
        </View>
        <Text style={styles.levelLabel}>{level.label}</Text>
      </View>

      {/* Staff area */}
      <View style={styles.staffArea}>
        <Staff clef={clef} halfSpace={HALF_SPACE} containerHeight={STAFF_CONTAINER_H}>
          {activeNotes.map((an) => (
            <NoteHead
              key={an.key}
              staffPosition={an.note.staffPosition}
              halfSpace={HALF_SPACE}
              staffCentreY={centreY}
              animX={an.animX}
              feedback={an.feedback}
            />
          ))}
        </Staff>

        {/* Brief note name display after answering */}
        {showNoteName && (
          <View style={styles.noteNameOverlay}>
            <Text style={styles.noteNameText}>{showNoteName}</Text>
          </View>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.min(100, (total / NOTES_PER_ROUND) * 100)}%` },
          ]}
        />
      </View>

      {/* Note buttons */}
      <View style={styles.buttonsArea}>
        <View style={styles.buttonsRow}>
          {NOTE_BUTTONS.map((name) => (
            <TouchableOpacity
              key={name}
              style={styles.noteButton}
              onPress={() => handleGuess(name)}
              activeOpacity={0.7}
            >
              <Text style={styles.noteButtonText}>{name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Voice toggle */}
        <TouchableOpacity
          style={[
            styles.voiceButton,
            voiceListening && styles.voiceButtonActive,
          ]}
          onPress={() => {
            if (voiceListening) {
              stopVoiceRecognition();
            } else {
              startVoiceRecognition();
            }
          }}
        >
          <Text style={styles.voiceButtonText}>
            {voiceListening ? '🎤 Listening...' : '🎤 Voice'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  backButton: {
    padding: spacing.sm,
  },
  backText: {
    fontSize: fontSizes.md,
    color: colors.primary,
    fontWeight: '600',
  },
  scoreArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreText: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    color: colors.text,
  },
  streakText: {
    fontSize: fontSizes.lg,
    color: colors.accent,
    fontWeight: '600',
  },
  levelLabel: {
    fontSize: fontSizes.md,
    color: colors.textLight,
    fontWeight: '500',
  },
  staffArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    overflow: 'hidden',
  },
  noteNameOverlay: {
    position: 'absolute',
    right: spacing.xl,
    top: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  noteNameText: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    color: colors.primary,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.disabledButton,
    marginHorizontal: spacing.lg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  buttonsArea: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  noteButton: {
    width: 46,
    height: 54,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
  },
  noteButtonText: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.buttonText,
  },
  voiceButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  voiceButtonActive: {
    backgroundColor: colors.primary,
  },
  voiceButtonText: {
    fontSize: fontSizes.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  // Results screen
  resultsCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  resultsTitle: {
    fontSize: fontSizes.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  starsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  star: {
    fontSize: 48,
  },
  resultsStat: {
    fontSize: fontSizes.lg,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  resultsButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonPrimaryText: {
    color: colors.buttonText,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  buttonSecondaryText: {
    color: colors.primary,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
});

export default GameScreen;
