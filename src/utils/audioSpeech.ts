import { Language } from '../types';
import { bhashini } from '../services/bhashini';

let voicesCache: SpeechSynthesisVoice[] = [];
let activeBhashiniAudio: HTMLAudioElement | null = null;
let speechRequestId = 0;

// Pre-populate voices and listen for voice change events
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const updateVoices = () => {
    try {
      voicesCache = window.speechSynthesis.getVoices() || [];
    } catch {
      voicesCache = [];
    }
  };

  updateVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  if (voicesCache.length === 0) {
    voicesCache = window.speechSynthesis.getVoices() || [];
  }
  return voicesCache;
}

export function getBestVoiceForLanguage(lang: Language): SpeechSynthesisVoice | null {
  const voices = getAvailableVoices();
  if (!voices || voices.length === 0) return null;

  if (lang === 'mr') {
    // 1. Direct Marathi voice (e.g. mr-IN, mr_IN, Google मराठी)
    const marathiVoice = voices.find(
      (v) =>
        v.lang.toLowerCase().replace('_', '-').startsWith('mr') ||
        v.name.toLowerCase().includes('marathi') ||
        v.name.toLowerCase().includes('मराठी')
    );
    if (marathiVoice) return marathiVoice;

    // 2. Hindi Devanagari voice (e.g. hi-IN, Google हिन्दी, Microsoft Swara / Madhur)
    // Devanagari script phonetics in Hindi voices render Marathi Devanagari with authentic Indian phonetics
    const hindiVoice = voices.find(
      (v) =>
        v.lang.toLowerCase().replace('_', '-').startsWith('hi') ||
        v.name.toLowerCase().includes('hindi') ||
        v.name.toLowerCase().includes('हिन्दी')
    );
    if (hindiVoice) return hindiVoice;

    // 3. Indian English / Regional voice (e.g. en-IN, Google English India)
    const indianVoice = voices.find(
      (v) =>
        v.lang.toLowerCase().replace('_', '-').includes('-in') ||
        v.name.toLowerCase().includes('india')
    );
    if (indianVoice) return indianVoice;

    return voices[0] || null;
  } else {
    // English
    // 1. Indian English voice (e.g. en-IN) for authentic regional clarity
    const indianEnVoice = voices.find(
      (v) =>
        v.lang.toLowerCase().replace('_', '-').startsWith('en-in') ||
        v.name.toLowerCase().includes('india')
    );
    if (indianEnVoice) return indianEnVoice;

    // 2. Any English voice (en-US, en-GB, etc.)
    const anyEnVoice = voices.find((v) =>
      v.lang.toLowerCase().replace('_', '-').startsWith('en')
    );
    if (anyEnVoice) return anyEnVoice;

    return voices[0] || null;
  }
}

export interface PlaySpeechOptions {
  text: string;
  lang: Language;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
  rate?: number;
  pitch?: number;
}

export function stopAllSpeech(): void {
  speechRequestId += 1;
  if (activeBhashiniAudio) {
    activeBhashiniAudio.pause();
    activeBhashiniAudio.src = '';
    activeBhashiniAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

export function playSpeech({
  text,
  lang,
  onStart,
  onEnd,
  onError,
  rate = 0.92,
  pitch = 1.0,
}: PlaySpeechOptions): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined') {
    onError?.(new Error('SpeechSynthesis not supported'));
    return null;
  }

  stopAllSpeech();
  const requestId = speechRequestId;

  // Prefer the configured Government of India Bhashini voice. If the service
  // is not configured or temporarily unavailable, retain the device voice.
  void bhashini.speak(text, lang === 'mr' ? 'mr' : 'en').then(({ audioContent, audioFormat }) => {
    if (requestId !== speechRequestId) return;
    const audio = new Audio(`data:audio/${audioFormat || 'wav'};base64,${audioContent}`);
    activeBhashiniAudio = audio;
    audio.onplay = () => onStart?.();
    audio.onended = () => { if (activeBhashiniAudio === audio) activeBhashiniAudio = null; onEnd?.(); };
    audio.onerror = () => { if (activeBhashiniAudio === audio) activeBhashiniAudio = null; playLocalSpeech(); };
    void audio.play().catch(() => { if (requestId === speechRequestId) playLocalSpeech(); });
  }).catch(() => {
    if (requestId === speechRequestId) playLocalSpeech();
  });

  const playLocalSpeech = () => {
    if (requestId !== speechRequestId) return;
    if (!('speechSynthesis' in window)) {
      onError?.(new Error('SpeechSynthesis not supported and BHASHINI voice is unavailable'));
      return;
    }

    // Small delay to ensure previous utterance is fully cleared in WebKit/Blink
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'mr' ? 'mr-IN' : 'en-IN';
    utterance.rate = rate;
    utterance.pitch = pitch;

    const voice = getBestVoiceForLanguage(lang);
    if (voice) utterance.voice = voice;

    utterance.onstart = () => onStart?.();
    utterance.onend = () => onEnd?.();
    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') onError?.(e);
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      onError?.(err);
    }
  };

  // The cloud voice starts asynchronously; return null to preserve the public
  // helper contract while callbacks report the playback state.
  return null;
}
