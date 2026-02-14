import { Audio } from 'expo-av';

/**
 * Simple sound manager.
 * We generate short tones programmatically using expo-av silence +
 * rely on system haptics for feedback in this initial version.
 * Sound files can be added to assets/sounds/ later.
 *
 * For now we use lightweight placeholder sounds that ship with the bundle.
 */

let correctSound: Audio.Sound | null = null;
let incorrectSound: Audio.Sound | null = null;
let missedSound: Audio.Sound | null = null;

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

/**
 * Generate a pleasant multi-tone chime (correct answer).
 * Uses a major chord arpeggio.
 */
function generateChimeWav(): string {
  const sampleRate = 22050;
  const durationMs = 500;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = numSamples * 2;
  const fileSize = 44 + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // C major chord: C5 (523), E5 (659), G5 (784)
  const freqs = [523.25, 659.25, 783.99];
  const volume = 0.2;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.max(0, 1 - (i / numSamples) * 1.2);
    let sample = 0;
    for (const freq of freqs) {
      sample += Math.sin(2 * Math.PI * freq * t);
    }
    sample = (sample / freqs.length) * volume * envelope;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, intSample, true);
  }

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

    // Correct: pleasant major chord chime
    const chimeUri = generateChimeWav();
    const { sound: s1 } = await Audio.Sound.createAsync({ uri: chimeUri });
    correctSound = s1;

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

export async function playCorrect(): Promise<void> {
  try {
    if (correctSound) {
      await correctSound.setPositionAsync(0);
      await correctSound.playAsync();
    }
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
    await correctSound?.unloadAsync();
    await incorrectSound?.unloadAsync();
    await missedSound?.unloadAsync();
  } catch {
    // ignore
  }
}
