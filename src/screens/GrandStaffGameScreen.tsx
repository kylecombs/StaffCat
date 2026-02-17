import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
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
import { useVoiceRecognition } from '../utils/useVoiceRecognition';
import { usePitchDetection } from '../utils/usePitchDetection';
import { colors, spacing, fontSizes, borderRadius } from '../utils/theme';

interface ActiveNote {
  key: number;
  note: NoteData;
  clef: ClefType;
  animX: Animated.Value;
  feedback: 'none' | 'correct' | 'incorrect';
  answered: boolean;
}

interface GrandStaffGameScreenProps {
  level: LevelDef;
  onBack: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HALF_SPACE = 10;
const STAFF_CONTAINER_H = HALF_SPACE * 18;
const NOTE_BUTTONS: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NOTES_PER_ROUND = 20;

const GrandStaffGameScreen: React.FC<GrandStaffGameScreenProps> = ({ level, onBack }) => {
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
  const trebleNotes = useRef(getNotesForLevel('treble', level)).current;
  const bassNotes = useRef(getNotesForLevel('bass', level)).current;
  const spawnedRef = useRef(0);
  const spawnNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledKeysRef = useRef<Set<number>>(new Set());

  activeNotesRef.current = activeNotes;

  useEffect(() => { loadSounds(); }, []);

  // Mic input: voice recognition + pitch detection run together
  const handleGuessRef = useRef<(guess: NoteName) => void>(() => {});
  const voice = useVoiceRecognition({
    onNote: (note) => handleGuessRef.current(note),
  });
  const pitch = usePitchDetection({
    onNote: (note) => handleGuessRef.current(note),
  });
  const micAvailable = voice.available || pitch.available;
  const micListening = voice.listening || pitch.listening;

  const toggleMic = useCallback(async () => {
    if (micListening) {
      voice.stop();
      pitch.stop();
    } else {
      await Promise.all([voice.start(), pitch.start()]);
    }
  }, [micListening, voice, pitch]);

  const stopMic = useCallback(() => {
    voice.stop();
    pitch.stop();
  }, [voice, pitch]);

  // Spawn one note at a time
  const spawnNote = useCallback(() => {
    if (spawnedRef.current >= NOTES_PER_ROUND) return;
    spawnedRef.current += 1;

    const clef: ClefType = Math.random() < 0.5 ? 'treble' : 'bass';
    const pool = clef === 'treble' ? trebleNotes : bassNotes;
    const note = pool[Math.floor(Math.random() * pool.length)];
    const key = noteKeyRef.current++;
    const animX = new Animated.Value(SCREEN_WIDTH);

    setActiveNotes((prev) => [...prev, { key, note, clef, animX, feedback: 'none', answered: false }]);
    setSpawned((s) => s + 1);

    Animated.timing(animX, {
      toValue: STAFF_LEFT_MARGIN,
      duration: level.scrollDurationMs,
      useNativeDriver: true,
    }).start(() => {
      if (handledKeysRef.current.has(key)) return;
      handledKeysRef.current.add(key);
      playMissed();
      setTotal((t) => t + 1);
      setStreak(0);
      setActiveNotes((prev) => prev.filter((n) => n.key !== key));
      spawnNextTimerRef.current = setTimeout(spawnNote, 400);
    });
  }, [trebleNotes, bassNotes, level.scrollDurationMs]);

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
      stopMic();
    }
  }, [total, finished, stopMic]);

  const handleGuess = useCallback((guess: NoteName) => {
    const unanswered = activeNotesRef.current
      .filter((n) => !n.answered)
      .sort((a, b) => a.key - b.key);
    if (unanswered.length === 0) return;
    const target = unanswered[0];
    if (handledKeysRef.current.has(target.key)) return;
    handledKeysRef.current.add(target.key);
    const isCorrect = target.note.name === guess;

    setShowNoteName(target.note.name);
    setTimeout(() => setShowNoteName(null), 800);

    if (isCorrect) {
      playCorrect(target.note.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScore((s) => s + 1);
      setStreak((s) => { const n = s + 1; setBestStreak((b) => Math.max(b, n)); return n; });
    } else {
      playIncorrect();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStreak(0);
    }
    setTotal((t) => t + 1);
    setActiveNotes((prev) =>
      prev.map((n) =>
        n.key === target.key ? { ...n, feedback: isCorrect ? 'correct' : 'incorrect', answered: true } : n
      )
    );
    target.animX.stopAnimation();

    const delay = isCorrect ? 600 : 500;
    setTimeout(() => {
      setActiveNotes((prev) => prev.filter((n) => n.key !== target.key));
      spawnNextTimerRef.current = setTimeout(spawnNote, 300);
    }, delay);
  }, [spawnNote]);

  handleGuessRef.current = handleGuess;

  if (finished) {
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const stars = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 50 ? 1 : 0;
    return (
      <View style={styles.container}>
        <View style={styles.resultsCard}>
          <Text style={styles.resultsTitle}>Round Complete!</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3].map((s) => (
              <Text key={s} style={[styles.star, { color: s <= stars ? colors.starGold : colors.starEmpty }]}>★</Text>
            ))}
          </View>
          <Text style={styles.resultsStat}>{score} / {total} correct ({pct}%)</Text>
          <Text style={styles.resultsStat}>Best streak: {bestStreak}</Text>
          <View style={styles.resultsButtons}>
            <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={onBack}>
              <Text style={styles.buttonSecondaryText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={() => {
              setScore(0); setTotal(0); setStreak(0); setBestStreak(0); setSpawned(0);
              setFinished(false); setActiveNotes([]);
            }}>
              <Text style={styles.buttonPrimaryText}>Play Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const centreY = STAFF_CONTAINER_H / 2;
  const trebleActive = activeNotes.filter((n) => n.clef === 'treble');
  const bassActive = activeNotes.filter((n) => n.clef === 'bass');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.scoreArea}>
          <Text style={styles.scoreText}>{score}/{total}</Text>
          {streak >= 3 && <Text style={styles.streakText}>🔥 {streak}</Text>}
        </View>
        <Text style={styles.levelLabel}>{level.label}</Text>
      </View>

      {/* Grand staff: treble on top, bass on bottom */}
      <View style={styles.grandStaffArea}>
        <Staff clef="treble" halfSpace={HALF_SPACE} containerHeight={STAFF_CONTAINER_H}>
          {trebleActive.map((an) => (
            <NoteHead key={an.key} staffPosition={an.note.staffPosition}
              halfSpace={HALF_SPACE} staffCentreY={centreY} animX={an.animX} feedback={an.feedback} />
          ))}
        </Staff>

        {/* Brace area / separator */}
        <View style={styles.staffSeparator} />

        <Staff clef="bass" halfSpace={HALF_SPACE} containerHeight={STAFF_CONTAINER_H}>
          {bassActive.map((an) => (
            <NoteHead key={an.key} staffPosition={an.note.staffPosition}
              halfSpace={HALF_SPACE} staffCentreY={centreY} animX={an.animX} feedback={an.feedback} />
          ))}
        </Staff>

        {showNoteName && (
          <View style={styles.noteNameOverlay}>
            <Text style={styles.noteNameText}>{showNoteName}</Text>
          </View>
        )}
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${Math.min(100, (total / NOTES_PER_ROUND) * 100)}%` }]} />
      </View>

      <View style={styles.buttonsArea}>
        <View style={styles.buttonsRow}>
          {NOTE_BUTTONS.map((name) => (
            <TouchableOpacity key={name} style={styles.noteButton}
              onPress={() => handleGuess(name)} activeOpacity={0.7}>
              <Text style={styles.noteButtonText}>{name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {micAvailable && (
          <TouchableOpacity
            style={[styles.voiceButton, micListening && styles.voiceButtonActive]}
            onPress={toggleMic}>
            <Text style={[styles.voiceButtonText, micListening && styles.voiceButtonActiveText]}>
              {micListening ? '🎤 Listening...' : '🎤 Mic'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.sm,
  },
  backButton: { padding: spacing.sm },
  backText: { fontSize: fontSizes.md, color: colors.primary, fontWeight: '600' },
  scoreArea: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scoreText: { fontSize: fontSizes.xl, fontWeight: '700', color: colors.text },
  streakText: { fontSize: fontSizes.lg, color: colors.accent, fontWeight: '600' },
  levelLabel: { fontSize: fontSizes.md, color: colors.textLight, fontWeight: '500' },
  grandStaffArea: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.sm, overflow: 'hidden' },
  staffSeparator: { height: spacing.lg },
  noteNameOverlay: {
    position: 'absolute', right: spacing.xl, top: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, borderRadius: borderRadius.md,
  },
  noteNameText: { fontSize: fontSizes.xl, fontWeight: '700', color: colors.primary },
  progressBar: {
    height: 4, backgroundColor: colors.disabledButton,
    marginHorizontal: spacing.lg, borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  buttonsArea: {
    paddingHorizontal: spacing.md, paddingTop: spacing.md,
    paddingBottom: spacing.xxl, alignItems: 'center',
  },
  buttonsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  noteButton: {
    width: 46, height: 54, borderRadius: borderRadius.md,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 4, elevation: 3,
  },
  noteButtonText: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.buttonText },
  voiceButton: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: borderRadius.xl, borderWidth: 2, borderColor: colors.primary, backgroundColor: 'transparent',
  },
  voiceButtonActive: { backgroundColor: colors.primary },
  voiceButtonText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '600' },
  voiceButtonActiveText: { color: colors.buttonText },
  resultsCard: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  resultsTitle: { fontSize: fontSizes.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  starsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  star: { fontSize: 48 },
  resultsStat: { fontSize: fontSizes.lg, color: colors.text, marginBottom: spacing.sm },
  resultsButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  button: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.md, minWidth: 120, alignItems: 'center' },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonPrimaryText: { color: colors.buttonText, fontSize: fontSizes.md, fontWeight: '700' },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.primary },
  buttonSecondaryText: { color: colors.primary, fontSize: fontSizes.md, fontWeight: '700' },
});

export default GrandStaffGameScreen;
