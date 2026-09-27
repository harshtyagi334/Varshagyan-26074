import { Language } from '../types';

export type BhashiniTask = 'asr' | 'tts' | 'translate';
let statusPromise: Promise<{ languages: Record<string, { speechToText: boolean; textToSpeech: boolean }> }> | null = null;

export function getBhashiniStatus() {
  if (!statusPromise) {
    statusPromise = fetch('/api/bhashini/status').then((response) => {
      if (!response.ok) throw new Error('Bhashini status unavailable.');
      return response.json();
    }).catch(() => ({ languages: {} }));
  }
  return statusPromise;
}

async function requestBhashini<T>(task: BhashiniTask, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`/api/bhashini/${task}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Bhashini request failed.');
  return result as T;
}

export const bhashini = {
  transcribe(audioContent: string, sourceLanguage: string) {
    return requestBhashini<{ transcript: string }>('asr', { audioContent, sourceLanguage });
  },
  speak(text: string, sourceLanguage: string) {
    return getBhashiniStatus().then((status) => {
      if (!status.languages[sourceLanguage]?.textToSpeech) throw new Error('Bhashini TTS is not configured.');
      return requestBhashini<{ audioContent: string; audioFormat: string }>('tts', { text, sourceLanguage });
    });
  },
  translate(text: string, sourceLanguage: string, targetLanguage: string) {
    return requestBhashini<{ translation: string }>('translate', { text, sourceLanguage, targetLanguage });
  },
};

export async function translateAlertMessage(text: string, sourceLanguage: Language, targetLanguage: Language): Promise<string> {
  if (sourceLanguage === targetLanguage) return text;

  try {
    const direct = await bhashini.translate(text, sourceLanguage, targetLanguage);
    return direct.translation;
  } catch (directError) {
    if (sourceLanguage === 'en' || targetLanguage === 'en') throw directError;

    throw directError;
  }
}

export async function audioBlobToWavBase64(blob: Blob): Promise<string> {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error('Audio conversion is not supported in this browser.');
  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const targetRate = 16_000;
    const outputLength = Math.ceil(decoded.duration * targetRate);
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
    const offline = new OfflineAudioContext(1, outputLength, targetRate);
    const monoSource = offline.createBuffer(1, decoded.length, decoded.sampleRate);
    const monoInput = monoSource.getChannelData(0);
    for (let i = 0; i < decoded.length; i += 1) {
      monoInput[i] = channels.reduce((sum, channel) => sum + channel[i], 0) / channels.length;
    }
    const source = offline.createBufferSource();
    source.buffer = monoSource;
    source.connect(offline.destination);
    source.start();
    const resampled = await offline.startRendering();
    const mono = resampled.getChannelData(0);

    const wav = new ArrayBuffer(44 + mono.length * 2);
    const view = new DataView(wav);
    const writeText = (offset: number, value: string) => Array.from(value).forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    writeText(0, 'RIFF'); view.setUint32(4, 36 + mono.length * 2, true); writeText(8, 'WAVE');
    writeText(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, targetRate, true); view.setUint32(28, targetRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); writeText(36, 'data'); view.setUint32(40, mono.length * 2, true);
    for (let i = 0; i < mono.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, mono[i]));
      view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    let binary = '';
    const bytes = new Uint8Array(wav);
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  } finally {
    await context.close();
  }
}
