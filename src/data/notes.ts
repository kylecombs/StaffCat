/**
 * Music theory data: notes, clefs, staff positions, and level definitions.
 *
 * Staff position 0 = middle line of a 5-line staff.
 * Positive positions go up, negative go down.
 * Each integer step = one staff position (line or space).
 *
 * For treble clef: position 0 = B4 (middle line)
 * For bass clef:   position 0 = D3 (middle line)
 */

export type NoteName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export type ClefType = 'treble' | 'bass';

export interface NoteData {
  /** Display name, e.g. "C4" */
  id: string;
  /** Just the letter */
  name: NoteName;
  /** Octave number */
  octave: number;
  /** Staff position relative to middle line (0). Each step = line or space. */
  staffPosition: number;
}

// ---------------------------------------------------------------------------
// Treble clef notes — from C4 (ledger line below) up to G5 (ledger line above)
// Middle line of treble staff = B4 (position 0)
// ---------------------------------------------------------------------------

export const TREBLE_NOTES: NoteData[] = [
  // Below staff — ledger lines
  { id: 'C4', name: 'C', octave: 4, staffPosition: -6 },
  { id: 'D4', name: 'D', octave: 4, staffPosition: -5 },
  // On the staff
  { id: 'E4', name: 'E', octave: 4, staffPosition: -4 },
  { id: 'F4', name: 'F', octave: 4, staffPosition: -3 },
  { id: 'G4', name: 'G', octave: 4, staffPosition: -2 },
  { id: 'A4', name: 'A', octave: 4, staffPosition: -1 },
  { id: 'B4', name: 'B', octave: 4, staffPosition: 0 },
  { id: 'C5', name: 'C', octave: 5, staffPosition: 1 },
  { id: 'D5', name: 'D', octave: 5, staffPosition: 2 },
  { id: 'E5', name: 'E', octave: 5, staffPosition: 3 },
  { id: 'F5', name: 'F', octave: 5, staffPosition: 4 },
  // Above staff — ledger lines
  { id: 'G5', name: 'G', octave: 5, staffPosition: 5 },
  { id: 'A5', name: 'A', octave: 5, staffPosition: 6 },
];

// ---------------------------------------------------------------------------
// Bass clef notes — from E2 (ledger line below) up to B3 (ledger line above)
// Middle line of bass staff = D3 (position 0)
// ---------------------------------------------------------------------------

export const BASS_NOTES: NoteData[] = [
  // Below staff — ledger lines
  { id: 'E2', name: 'E', octave: 2, staffPosition: -6 },
  { id: 'F2', name: 'F', octave: 2, staffPosition: -5 },
  // On the staff
  { id: 'G2', name: 'G', octave: 2, staffPosition: -4 },
  { id: 'A2', name: 'A', octave: 2, staffPosition: -3 },
  { id: 'B2', name: 'B', octave: 2, staffPosition: -2 },
  { id: 'C3', name: 'C', octave: 3, staffPosition: -1 },
  { id: 'D3', name: 'D', octave: 3, staffPosition: 0 },
  { id: 'E3', name: 'E', octave: 3, staffPosition: 1 },
  { id: 'F3', name: 'F', octave: 3, staffPosition: 2 },
  { id: 'G3', name: 'G', octave: 3, staffPosition: 3 },
  { id: 'A3', name: 'A', octave: 3, staffPosition: 4 },
  // Above staff — ledger lines
  { id: 'B3', name: 'B', octave: 3, staffPosition: 5 },
  { id: 'C4', name: 'C', octave: 4, staffPosition: 6 },
];

export function getNotesForClef(clef: ClefType): NoteData[] {
  return clef === 'treble' ? TREBLE_NOTES : BASS_NOTES;
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

export interface LevelDef {
  id: number;
  label: string;
  /** Duration in ms for a note to cross the screen */
  scrollDurationMs: number;
  /** How many staff positions from centre to include (symmetrical) */
  noteRange: number;
  /** Description shown on level select */
  description: string;
}

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    label: 'Level 1',
    scrollDurationMs: 10000,
    noteRange: 2, // staff lines only (5 notes near centre)
    description: 'Staff lines only — very slow',
  },
  {
    id: 2,
    label: 'Level 2',
    scrollDurationMs: 9000,
    noteRange: 4, // full staff
    description: 'Full staff — slow',
  },
  {
    id: 3,
    label: 'Level 3',
    scrollDurationMs: 7500,
    noteRange: 4,
    description: 'Full staff — moderate',
  },
  {
    id: 4,
    label: 'Level 4',
    scrollDurationMs: 6000,
    noteRange: 5,
    description: 'Staff + 1 ledger line — moderate',
  },
  {
    id: 5,
    label: 'Level 5',
    scrollDurationMs: 5000,
    noteRange: 6,
    description: 'Staff + 2 ledger lines — faster',
  },
  {
    id: 6,
    label: 'Level 6',
    scrollDurationMs: 4000,
    noteRange: 6,
    description: 'Full range — fast',
  },
];

/** Return the subset of notes that a given level uses for a given clef */
export function getNotesForLevel(clef: ClefType, level: LevelDef): NoteData[] {
  const all = getNotesForClef(clef);
  return all.filter(
    (n) => Math.abs(n.staffPosition) <= level.noteRange,
  );
}
