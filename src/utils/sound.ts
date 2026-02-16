import { Audio } from 'expo-av';

/**
 * Simple sound manager.
 * We generate short tones programmatically using expo-av silence +
 * rely on system haptics for feedback in this initial version.
 * Sound files can be added to assets/sounds/ later.
 *
 * For now we use lightweight placeholder sounds that ship with the bundle.
 */

let incorrectSound: Audio.Sound | null = null;
let missedSound: Audio.Sound | null = null;

// Note frequencies in Hz (A4 = 440Hz standard tuning)
const NOTE_FREQUENCIES: Record<string, number> = {
  // Octave 2
  E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47,
  // Octave 3
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  // Octave 4
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  // Octave 5
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
};

/**
 * Generate a simple sine-wave WAV buffer encoded as a base64 data URI.
 * This lets us ship sound effects without external files.
 */
function generateToneWav(
  frequency: number,
  durationMs: number,
  volume: number = 0.3,
  sampleRate: number = 22050,
): string {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = numSamples * 2; // 16-bit mono
  const fileSize = 44 + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Generate sine wave with fade-out envelope
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.max(0, 1 - (i / numSamples) * 1.5); // fade out
    const sample = Math.sin(2 * Math.PI * frequency * t) * volume * envelope;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, intSample, true);
  }

  // Convert to base64
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

export async function loadSounds(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    // Incorrect: gentle low tone
    const lowUri = generateToneWav(220, 300, 0.15);
    const { sound: s2 } = await Audio.Sound.createAsync({ uri: lowUri });
    incorrectSound = s2;

    // Missed: soft descending tone
    const missUri = generateToneWav(330, 400, 0.12);
    const { sound: s3 } = await Audio.Sound.createAsync({ uri: missUri });
    missedSound = s3;
  } catch (e) {
    console.warn('Could not load sounds:', e);
  }
}

/**
 * Play the correct answer sound.
 * If a noteId is provided (e.g., "C4"), plays that note's pitch.
 * Otherwise falls back to a generic pleasant tone.
 */
export async function playCorrect(noteId?: string): Promise<void> {
  try {
    const frequency = noteId ? NOTE_FREQUENCIES[noteId] : 523.25; // Default to C5
    if (!frequency) return;

    // Generate and play the note tone dynamically
    const toneUri = generateToneWav(frequency, 400, 0.25);
    const { sound } = await Audio.Sound.createAsync({ uri: toneUri });
    await sound.playAsync();

    // Unload after playback to avoid memory leaks
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch {
    // ignore
  }
}

export async function playIncorrect(): Promise<void> {
  try {
    if (incorrectSound) {
      await incorrectSound.setPositionAsync(0);
      await incorrectSound.playAsync();
    }
  } catch {
    // ignore
  }
}

export async function playMissed(): Promise<void> {
  try {
    if (missedSound) {
      await missedSound.setPositionAsync(0);
      await missedSound.playAsync();
    }
  } catch {
    // ignore
  }
}

export async function unloadSounds(): Promise<void> {
  try {
    await incorrectSound?.unloadAsync();
    await missedSound?.unloadAsync();
  } catch {
    // ignore
  }
}
