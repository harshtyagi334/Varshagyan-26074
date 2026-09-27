import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  X,
  Sparkles,
  Bug,
  Info,
  ShieldCheck,
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Trash2,
  CheckCircle2,
  Headphones
} from 'lucide-react';
import { FarmerReport, Language, Panchayat, TraditionalIndicator } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { TRADITIONAL_INDICATORS } from '../data/bioIndicatorsData';
import { PANCHAYATS_DATA } from '../data/nashikGeoData';
import { playSpeech, stopAllSpeech } from '../utils/audioSpeech';
import { audioBlobToWavBase64, bhashini } from '../services/bhashini';

interface TraditionalIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  selectedPanchayat: Panchayat;
  onAddReport: (report: FarmerReport) => void;
  recentReports: FarmerReport[];
}

export const TraditionalIntakeModal: React.FC<TraditionalIntakeModalProps> = ({
  isOpen,
  onClose,
  lang,
  selectedPanchayat,
  onAddReport,
  recentReports,
}) => {
  const t = TRANSLATIONS[lang];

  // Core form states
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string>(TRADITIONAL_INDICATORS[0].id);
  const [targetPanchayatId, setTargetPanchayatId] = useState<string>(selectedPanchayat.id);
  const [farmerName, setFarmerName] = useState<string>('बाळासाहेब शिंदे (शेतकरी)');
  const [farmerNotes, setFarmerNotes] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // Audio Guide state
  const [isPlayingGuide, setIsPlayingGuide] = useState<boolean>(false);

  // Voice recording states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [hasVoiceNote, setHasVoiceNote] = useState<boolean>(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingRecordedAudio, setIsPlayingRecordedAudio] = useState<boolean>(false);
  const [playingReportId, setPlayingReportId] = useState<string | null>(null);
  const [isTranscribingWithBhashini, setIsTranscribingWithBhashini] = useState(false);
  const [isTranslatingWithBhashini, setIsTranslatingWithBhashini] = useState(false);
  const [bhashiniMessage, setBhashiniMessage] = useState('');

  // Refs for audio handling
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const speechRecognitionRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const recordedAudioBlobRef = useRef<Blob | null>(null);

  // Clean up timers and audio on unmount or close
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
      }
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch { /* ignore */ }
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
    };
  }, []);

  const isPlayingGuideRef = useRef<boolean>(false);
  useEffect(() => {
    isPlayingGuideRef.current = isPlayingGuide;
  }, [isPlayingGuide]);

  const getGuideAudioText = (targetLang: Language) => {
    return targetLang === 'mr'
      ? `नमस्कार शेतकरी बंधूंनो. आज निसर्गात तुम्हाला काय बदल दिसले? जसे की मुंग्यांची अंडी घेऊन हालचाल, बेडकांचा आवाज किंवा ढगांचे स्वरूप. खालील चित्रावर स्पर्श करा किंवा माईक बटण दाबून तुमचा आवाज रेकॉर्ड करा. टायपिंग करण्याची गरज नाही.`
      : `Greetings farmers. What bio-indicator changes did you observe today? Such as ants carrying eggs, frog vocalizations, or dark clouds. Tap any picture below or press the microphone button to record your voice observation without typing.`;
  };

  // Audio Guide: reads instructions in Marathi or English
  const handleToggleAudioGuide = () => {
    if (isPlayingGuide) {
      stopAllSpeech();
      setIsPlayingGuide(false);
      return;
    }

    if (!('speechSynthesis' in window)) {
      alert(lang === 'mr' ? 'ऑडिओ सपोर्ट उपलब्ध नाही.' : 'Speech synthesis not supported in this browser.');
      return;
    }

    const textToSpeak = getGuideAudioText(lang);
    setIsPlayingGuide(true);
    playSpeech({
      text: textToSpeak,
      lang,
      rate: 0.92,
      onStart: () => setIsPlayingGuide(true),
      onEnd: () => setIsPlayingGuide(false),
      onError: () => setIsPlayingGuide(false),
    });
  };

  // Transfer audio when language switches
  useEffect(() => {
    if (isPlayingGuideRef.current) {
      stopAllSpeech();
      const textToSpeak = getGuideAudioText(lang);
      playSpeech({
        text: textToSpeak,
        lang,
        rate: 0.92,
        onStart: () => setIsPlayingGuide(true),
        onEnd: () => setIsPlayingGuide(false),
        onError: () => setIsPlayingGuide(false),
      });
    }
  }, [lang]);

  if (!isOpen) return null;

  const activeIndicator = TRADITIONAL_INDICATORS.find((i) => i.id === selectedIndicatorId) || TRADITIONAL_INDICATORS[0];

  // Start Voice Recording (Mic + Speech-to-Text Transcription)
  const handleStartVoiceRecording = async () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsPlayingGuide(false);
    setIsPlayingRecordedAudio(false);

    setRecordingSeconds(0);
    recordedAudioBlobRef.current = null;
    setBhashiniMessage('');
    setIsRecording(true);

    // 1. Start timer
    timerIntervalRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    // 2. Initialize Speech Recognition for live Marathi/English transcription
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.lang = lang === 'mr' ? 'mr-IN' : 'en-IN';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript.trim()) {
            setFarmerNotes(transcript.trim());
          }
        };

        recognition.onerror = () => { /* fallback gracefully */ };
        recognition.start();
        speechRecognitionRef.current = recognition;
      } catch {
        // speech recognition not supported, continue with audio capture
      }
    }

    // 3. Audio MediaRecorder stream
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          recordedAudioBlobRef.current = audioBlob;
          const url = URL.createObjectURL(audioBlob);
          setRecordedAudioUrl(url);
          setHasVoiceNote(true);
          // Stop media tracks
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start();
      } else {
        // Fallback simulation for unsupported browsers
        setHasVoiceNote(true);
      }
    } catch {
      // Permission denied or not available; fallback to simulated voice note
      setHasVoiceNote(true);
    }
  };

  const handleBhashiniTranscription = async () => {
    if (!recordedAudioBlobRef.current) return;
    setIsTranscribingWithBhashini(true);
    setBhashiniMessage('');
    try {
      const audioContent = await audioBlobToWavBase64(recordedAudioBlobRef.current);
      const { transcript } = await bhashini.transcribe(audioContent, lang === 'mr' ? 'mr' : 'en');
      setFarmerNotes(transcript);
      setBhashiniMessage(lang === 'mr' ? 'भाषिणीने आवाजाचे मजकुरात रूपांतर केले. पाठवण्यापूर्वी तपासा.' : 'Bhashini transcribed the audio. Review it before submitting.');
    } catch (error) {
      const fallbackMessage = lang === 'mr' ? 'आवाजाचे मजकुरात रूपांतर झाले नाही.' : 'Speech transcription could not be completed.';
      setBhashiniMessage(error instanceof Error && error.message.includes('not configured')
        ? (lang === 'mr' ? 'भाषिणी API की आणि ASR मॉडेल सेट केलेले नाही.' : 'Bhashini API key and ASR model are not configured.')
        : fallbackMessage);
    } finally {
      setIsTranscribingWithBhashini(false);
    }
  };

  const handleBhashiniTranslation = async () => {
    if (!farmerNotes.trim()) return;
    setIsTranslatingWithBhashini(true);
    setBhashiniMessage('');
    try {
      const sourceLanguage = lang === 'mr' ? 'mr' : 'en';
      const targetLanguage = lang === 'mr' ? 'en' : 'mr';
      const { translation } = await bhashini.translate(farmerNotes, sourceLanguage, targetLanguage);
      setFarmerNotes(translation);
      setBhashiniMessage(lang === 'mr' ? 'भाषिणी भाषांतर तयार झाले. कृपया तपासा.' : 'Bhashini translation is ready. Please review it.');
    } catch {
      setBhashiniMessage(lang === 'mr' ? 'भाषांतर सेवा सध्या उपलब्ध नाही.' : 'Translation service is not configured or available right now.');
    } finally {
      setIsTranslatingWithBhashini(false);
    }
  };

  // Stop Voice Recording
  const handleStopVoiceRecording = () => {
    setIsRecording(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch { /* ignore */ }
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    } else {
      setHasVoiceNote(true);
    }
  };

  // Playback recorded audio or read synthesized note
  const handleTogglePlayRecordedAudio = () => {
    if (isPlayingRecordedAudio) {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingRecordedAudio(false);
      return;
    }

    if (recordedAudioUrl) {
      if (!audioElementRef.current) {
        audioElementRef.current = new Audio(recordedAudioUrl);
      } else {
        audioElementRef.current.src = recordedAudioUrl;
      }

      audioElementRef.current.onended = () => setIsPlayingRecordedAudio(false);
      audioElementRef.current.onerror = () => {
        // Fallback to speech synthesis if blob fails
        playViaSpeechSynthesis();
      };

      setIsPlayingRecordedAudio(true);
      audioElementRef.current.play().catch(() => {
        playViaSpeechSynthesis();
      });
    } else {
      playViaSpeechSynthesis();
    }
  };

  const playViaSpeechSynthesis = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const noteToSpeak = farmerNotes || (lang === 'mr' ? activeIndicator.titleMr : activeIndicator.titleEn);
    const textToSpeak = lang === 'mr'
      ? `शेतकरी व्हॉइस नोंद: ${noteToSpeak}`
      : `Farmer voice note: ${noteToSpeak}`;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = lang === 'mr' ? 'mr-IN' : 'en-IN';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onend = () => setIsPlayingRecordedAudio(false);
    utterance.onerror = () => setIsPlayingRecordedAudio(false);

    setIsPlayingRecordedAudio(true);
    window.speechSynthesis.speak(utterance);
  };

  // Discard recorded audio
  const handleDeleteAudio = () => {
    if (isPlayingRecordedAudio) {
      if (audioElementRef.current) audioElementRef.current.pause();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setIsPlayingRecordedAudio(false);
    }
    setHasVoiceNote(false);
    setRecordedAudioUrl(null);
    setRecordingSeconds(0);
  };

  // 1-Tap Quick Spoken Samples (For zero-typing instant submission)
  const handleSelectQuickVoiceSample = (sampleMr: string, sampleEn: string) => {
    setFarmerNotes(lang === 'mr' ? sampleMr : sampleEn);
    setHasVoiceNote(true);
    setRecordingSeconds(5);

    // Speak a brief confirmation so farmer hears audio feedback immediately
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(lang === 'mr' ? sampleMr : sampleEn);
      utt.lang = lang === 'mr' ? 'mr-IN' : 'en-IN';
      utt.rate = 1.0;
      window.speechSynthesis.speak(utt);
    }
  };

  // Play neighbor's report audio
  const handlePlayNeighborReport = (report: FarmerReport) => {
    if (playingReportId === report.id) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setPlayingReportId(null);
      return;
    }

    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const textToSpeak = lang === 'mr'
      ? `${report.farmerNameMr} यांची नोंद: ${report.notesMr}`
      : `${report.farmerNameEn} report: ${report.notesEn}`;

    const utt = new SpeechSynthesisUtterance(textToSpeak);
    utt.lang = lang === 'mr' ? 'mr-IN' : 'en-IN';
    utt.rate = 0.95;

    utt.onend = () => setPlayingReportId(null);
    utt.onerror = () => setPlayingReportId(null);

    setPlayingReportId(report.id);
    window.speechSynthesis.speak(utt);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const durationSec = recordingSeconds > 0 ? recordingSeconds : (hasVoiceNote ? 6 : undefined);

    const newReport: FarmerReport = {
      id: `rep_${Date.now()}`,
      panchayatId: targetPanchayatId,
      indicatorId: selectedIndicatorId,
      reportedAt: new Date().toISOString(),
      timeAgoMr: 'आत्ताच (Just now)',
      timeAgoEn: 'Just now',
      farmerNameMr: farmerName || 'प्रगतीशील शेतकरी',
      farmerNameEn: farmerName || 'Progressive Farmer',
      notesMr: farmerNotes || (lang === 'mr' ? activeIndicator.titleMr : activeIndicator.titleEn),
      notesEn: farmerNotes || activeIndicator.titleEn,
      reliabilityScore: 0,
      isDemoData: false,
      hasAudio: hasVoiceNote || !!farmerNotes,
      audioDurationSec: durationSec || 6,
      audioUrl: recordedAudioUrl || undefined,
    };

    onAddReport(newReport);
    setIsSubmitted(true);

    // Trigger celebratory confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#5A7852', '#C9A14A', '#2F4638', '#F6F4EC'],
      });
    } catch {
      // ignore
    }

    setTimeout(() => {
      setIsSubmitted(false);
      onClose();
    }, 2200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#F6F4EC] rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border-2 border-[#5A7852]/40 my-auto relative animate-in fade-in zoom-in duration-200 max-h-[92vh] flex flex-col">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#E6E8DC] text-gray-500 hover:text-[#2F4638] hover:bg-white flex items-center justify-center transition border border-gray-300/50 z-10 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Demo Tag & Audio Guide Button */}
        <div className="mb-3 pr-10 shrink-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="bg-[#5A7852] text-white text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
              <Bug className="w-3.5 h-3.5 text-amber-200" />
              {lang === 'mr' ? 'पारंपारिक हवामान संकेत' : 'Folk Bio-Indicators'}
            </span>
            <span className="bg-[#C9A14A]/20 text-[#806000] text-[10px] font-bold px-2 py-0.5 rounded-md border border-[#C9A14A]/40">
              {t.demoTag}
            </span>

            {/* Read-Aloud Audio Guide for illiterate / non-typing farmers */}
            <button
              type="button"
              onClick={handleToggleAudioGuide}
              className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition border shadow-xs cursor-pointer ${
                isPlayingGuide
                  ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                  : 'bg-[#E6E8DC] text-[#2F4638] border-gray-300/50 hover:bg-white'
              }`}
              title={lang === 'mr' ? 'प्रश्न ऐका' : 'Listen audio instructions'}
            >
              <Volume2 className="w-3.5 h-3.5 text-[#C9A14A]" />
              <span>{isPlayingGuide ? (lang === 'mr' ? 'थांबवा (Stop)' : 'Stop') : t.voiceInstructionAudio}</span>
            </button>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-[#2F4638]">
            {t.intakeTitle}
          </h2>
          <p className="text-xs text-[#2F4638]/70 mt-0.5">
            {t.intakeSubtitle}
          </p>
        </div>

        {isSubmitted ? (
          /* Success Screen */
          <div className="bg-[#E6E8DC] border-2 border-[#5A7852] rounded-2xl p-6 text-center space-y-3 my-auto">
            <div className="w-14 h-14 bg-[#5A7852] text-white rounded-full flex items-center justify-center mx-auto text-2xl shadow-lg animate-bounce">
              ✓
            </div>
            <h3 className="text-lg font-bold text-[#2F4638]">
              {t.reportSuccess}
            </h3>
            <p className="text-xs text-[#2F4638]/80">
              {lang === 'mr'
                ? 'हे निरीक्षण या सत्रात नोंदले आहे. ते सध्या पावसाचा अंदाज बदलत नाही किंवा केंद्रिय सर्व्हरवर पाठवले जात नाही.'
                : 'This observation is recorded for this session. It does not change the rainfall estimate or upload to a central server.'}
            </p>
            {hasVoiceNote && (
              <div className="inline-flex items-center gap-1.5 bg-[#5A7852]/20 text-[#5A7852] text-xs font-bold px-3 py-1 rounded-full border border-[#5A7852]/40">
                <span>🎙️</span>
                <span>{t.voiceRecordedSuccess}</span>
              </div>
            )}
          </div>
        ) : (
          /* Form Content with Scrollable Area */
          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1">
            
            {/* 1. Large Tap-to-Select Visual Indicator Cards */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#5A7852] mb-2">
                {t.selectIndicator}
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {TRADITIONAL_INDICATORS.map((indicator) => {
                  const isSelected = indicator.id === selectedIndicatorId;
                  return (
                    <button
                      key={indicator.id}
                      type="button"
                      onClick={() => setSelectedIndicatorId(indicator.id)}
                      className={`flex flex-col items-start p-3 rounded-2xl border text-left transition relative cursor-pointer ${
                        isSelected
                          ? 'bg-[#5A7852] text-white border-[#466849] shadow-md ring-2 ring-[#5A7852]/40'
                          : 'bg-[#E6E8DC] text-[#2F4638] border-gray-300/40 hover:bg-white'
                      }`}
                    >
                      <div className="text-3xl mb-1.5">{indicator.icon}</div>
                      
                      {/* Primary Label */}
                      <div className="text-xs font-bold leading-tight">
                        {lang === 'mr' ? indicator.titleMr : indicator.titleEn}
                      </div>

                      {/* Small Subtext / Meaning */}
                      <div className={`text-[10px] mt-1 line-clamp-2 ${isSelected ? 'text-white/80' : 'text-gray-600'}`}>
                        {lang === 'mr' ? indicator.folkloreMeaningMr : indicator.folkloreMeaningEn}
                      </div>

                      {/* Observation label; reports do not change the forecast. */}
                      <div className={`mt-2 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-[#C9A14A]/20 text-[#806000]'
                      }`}>
                        {lang === 'mr' ? 'निरीक्षण' : 'Observation'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Indicator Scientific Rationale Callout */}
            <details className="bg-[#E6E8DC] p-3 rounded-2xl border border-gray-300/40 text-xs">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 font-bold text-[#2F4638]">
                <Info className="w-4 h-4 text-[#C9A14A]" />
                {lang === 'mr' ? 'या निरीक्षणाबद्दल अधिक माहिती' : 'More about this observation'}
              </summary>
              <p className="mt-2 text-[#2F4638]/80 text-[11px] leading-relaxed">
                {lang === 'mr' ? activeIndicator.scientificHypothesisMr : activeIndicator.scientificHypothesisEn}
              </p>
            </details>

            {/* 2. Panchayat and Farmer Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#2F4638] mb-1">
                  {t.selectPanchayatToReport}
                </label>
                <select
                  value={targetPanchayatId}
                  onChange={(e) => setTargetPanchayatId(e.target.value)}
                  className="w-full bg-[#E6E8DC] border border-gray-300/50 text-xs font-bold text-[#2F4638] p-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5A7852] cursor-pointer"
                >
                  {PANCHAYATS_DATA.map((p) => (
                    <option key={p.id} value={p.id}>
                      {lang === 'mr' ? `${p.nameMr} (${p.blockNameMr})` : `${p.nameEn} (${p.blockNameEn})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2F4638] mb-1">
                  {t.farmerNameLabel}
                </label>
                <input
                  type="text"
                  value={farmerName}
                  onChange={(e) => setFarmerName(e.target.value)}
                  placeholder={lang === 'mr' ? 'उदा. बाळासाहेब शिंदे' : 'e.g. Balasaheb Shinde'}
                  className="w-full bg-[#E6E8DC] border border-gray-300/50 text-xs font-medium text-[#2F4638] p-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5A7852]"
                />
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 3. VOICE RECORDING SYSTEM & AUDIO BUTTON (NO TYPING BARRIER FOR FARMERS)   */}
            {/* ========================================================================= */}
            <div className="bg-[#E6E8DC] p-3.5 sm:p-4 rounded-2xl border-2 border-[#5A7852]/30 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#2F4638] flex items-center gap-1.5">
                  <Mic className="w-4 h-4 text-[#5A7852]" />
                  <span>{lang === 'mr' ? 'आवाज रेकॉर्ड करा (टायपिंग न करता बोला):' : 'Voice Audio System (Speak without typing):'}</span>
                </label>
                <span className="text-[10px] font-bold text-[#806000] bg-[#C9A14A]/20 px-2 py-0.5 rounded-md">
                  {lang === 'mr' ? '⚡ जलद पर्याय' : '⚡ Fast Audio'}
                </span>
              </div>

              {/* State A: Recording In Progress */}
              {isRecording ? (
                <div className="bg-rose-50 border-2 border-rose-400 p-4 rounded-2xl space-y-3 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-700 font-black text-sm">
                      <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                      <span>{t.voiceRecordingActive}</span>
                    </div>
                    <div className="text-rose-900 font-mono font-black text-base px-2.5 py-0.5 bg-white rounded-lg border border-rose-200">
                      00:0{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}
                    </div>
                  </div>

                  {/* Animated Soundwave Equalizer Bars */}
                  <div className="flex items-center justify-center gap-1.5 h-8 py-1">
                    <div className="w-1.5 bg-rose-500 rounded-full animate-bounce h-7" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 bg-rose-600 rounded-full animate-bounce h-5" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 bg-rose-700 rounded-full animate-bounce h-8" style={{ animationDelay: '300ms' }} />
                    <div className="w-1.5 bg-rose-600 rounded-full animate-bounce h-6" style={{ animationDelay: '100ms' }} />
                    <div className="w-1.5 bg-rose-500 rounded-full animate-bounce h-7" style={{ animationDelay: '250ms' }} />
                  </div>

                  {/* Live transcription feedback */}
                  <div className="text-xs text-rose-900 font-medium bg-white/80 p-2 rounded-xl border border-rose-200">
                    <span className="font-bold text-gray-500 mr-1">{t.voiceListening}</span>
                    <span>{farmerNotes || (lang === 'mr' ? 'मुंग्या किंवा ढगांचे निरीक्षण बोला...' : 'Speak what you noticed...')}</span>
                  </div>

                  {/* Stop Button */}
                  <button
                    type="button"
                    onClick={handleStopVoiceRecording}
                    className="w-full bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-black text-xs py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    <span>{t.voiceStopBtn}</span>
                  </button>
                </div>
              ) : hasVoiceNote ? (
                /* State B: Audio Note Recorded Successfully */
                <div className="bg-[#F6F4EC] border-2 border-[#5A7852] p-3.5 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#5A7852] font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-[#5A7852]" />
                      <span>{t.voiceRecordedSuccess}</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold bg-[#E6E8DC] text-[#2F4638] px-2 py-0.5 rounded-md border border-gray-300/40">
                      0:0{recordingSeconds > 0 ? (recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds) : '06'}s
                    </span>
                  </div>

                  {/* Audio Controls Bar */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleTogglePlayRecordedAudio}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                        isPlayingRecordedAudio
                          ? 'bg-[#C9A14A] text-[#2F4638]'
                          : 'bg-[#5A7852] hover:bg-[#466849] text-white'
                      }`}
                    >
                      {isPlayingRecordedAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                      <span>{isPlayingRecordedAudio ? t.voicePauseAudio : t.voicePlayAudio}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleStartVoiceRecording}
                      className="flex items-center gap-1.5 py-2 px-3 bg-[#E6E8DC] hover:bg-white text-[#2F4638] rounded-xl text-xs font-bold border border-gray-300/40 transition cursor-pointer"
                      title={t.voiceReRecord}
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#2F4638]" />
                      <span>{t.voiceReRecord}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDeleteAudio}
                      className="p-2 bg-[#E6E8DC] hover:bg-rose-50 text-rose-600 rounded-xl border border-gray-300/40 transition cursor-pointer"
                      title={t.voiceDelete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {recordedAudioBlobRef.current && (
                    <button
                      type="button"
                      onClick={handleBhashiniTranscription}
                      disabled={isTranscribingWithBhashini}
                      className="w-full rounded-xl border border-[#5A7852]/30 bg-white px-3 py-2 text-xs font-bold text-[#2F4638] disabled:opacity-60"
                    >
                      {isTranscribingWithBhashini
                        ? (lang === 'mr' ? 'भाषिणी आवाज ऐकत आहे…' : 'Bhashini is transcribing…')
                        : (lang === 'mr' ? 'भाषिणीने आवाज मजकुरात बदला' : 'Transcribe with Bhashini')}
                    </button>
                  )}
                  {recordedAudioBlobRef.current && (
                    <p className="text-[10px] text-[#2F4638]/65">
                      {lang === 'mr' ? 'हा पर्याय निवडल्यावर ऑडिओ भाषिणी सेवेकडे पाठवला जाईल.' : 'Selecting this sends the recording to Bhashini for transcription.'}
                    </p>
                  )}
                </div>
              ) : (
                /* State C: Ready to Record - Giant Mic Button in Muted Terracotta Clay */
                <div>
                  <button
                    type="button"
                    onClick={handleStartVoiceRecording}
                    className="w-full bg-[#5A7852] hover:bg-[#466849] active:scale-98 text-white font-black text-xs sm:text-sm py-3 px-4 rounded-2xl shadow-md transition flex items-center justify-center gap-2.5 cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition">
                      <Mic className="w-4 h-4" />
                    </div>
                    <span>{t.voiceObservationBtn}</span>
                  </button>
                  <p className="text-[11px] text-center text-[#2F4638]/70 mt-1 font-medium">
                    {lang === 'mr'
                      ? '🎙️ माईक दाबा आणि बोला — टायपिंग न करता तुमचे निरीक्षण थेट नोंदवले जाईल!'
                      : '🎙️ Tap the mic to speak — your observation is captured directly without typing!'}
                  </p>
                </div>
              )}

              {/* 1-Tap Quick Spoken Samples (Zero-typing presets) */}
              <div className="pt-1">
                <div className="text-[11px] font-semibold text-[#2F4638]/80 mb-1.5">
                  {t.quickVoicePrompts}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {[
                    {
                      icon: '🐜',
                      mr: 'द्राक्ष बागेत झाडाच्या खोडावर मुंग्यांची रांग दिसली',
                      en: 'Observed ant lines climbing vineyard posts',
                    },
                    {
                      icon: '🐸',
                      mr: 'विहिरीच्या ओढ्यालगत बेडकांचा मोठा आवाज सुरू आहे',
                      en: 'Heard loud frog chorus along stream',
                    },
                    {
                      icon: '☁️',
                      mr: 'चांदवड डोंगरावरून काळे दाट ढग गोळा होत आहेत',
                      en: 'Dark cumulus clouds rolling from hill',
                    },
                    {
                      icon: '🌿',
                      mr: 'झाडांची पाने उलटली व गार वाऱ्याची लकेर आली',
                      en: 'Leaves inverting with sudden cold gusts',
                    },
                  ].map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectQuickVoiceSample(sample.mr, sample.en)}
                      className="flex items-center gap-1.5 p-2 bg-[#F6F4EC] hover:bg-white text-left rounded-xl border border-gray-300/40 text-[11px] text-[#2F4638] font-medium transition cursor-pointer group"
                    >
                      <span className="text-base shrink-0">{sample.icon}</span>
                      <span className="truncate group-hover:text-[#5A7852]">
                        {lang === 'mr' ? sample.mr : sample.en}
                      </span>
                      <span className="ml-auto text-[10px] text-[#5A7852] font-bold shrink-0">
                        🎙️ +
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Field (Auto-filled by voice, or optionally fine-tuned) */}
              <div className="pt-1">
                <label className="block text-[11px] font-semibold text-[#2F4638]/70 mb-1">
                  {lang === 'mr' ? 'उच्चारित मजकूर / तपासणी (Voice Transcript):' : 'Voice Transcript / Notes:'}
                </label>
                <input
                  type="text"
                  value={farmerNotes}
                  onChange={(e) => setFarmerNotes(e.target.value)}
                  placeholder={lang === 'mr' ? 'उदा. द्राक्ष बागेत झाडाच्या खोडावर मुंग्यांची रांग दिसली' : 'e.g. Observed ant lines along vineyard poles'}
                  className="w-full bg-[#F6F4EC] border border-gray-300/40 text-xs text-[#2F4638] p-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5A7852]"
                />
                {farmerNotes.trim() && (
                  <button
                    type="button"
                    onClick={handleBhashiniTranslation}
                    disabled={isTranslatingWithBhashini}
                    className="mt-2 min-h-9 rounded-lg border border-[#5A7852]/25 bg-white px-3 py-1.5 text-[11px] font-bold text-[#2F4638] disabled:opacity-60"
                  >
                    {isTranslatingWithBhashini
                      ? (lang === 'mr' ? 'भाषांतर सुरू आहे…' : 'Translating…')
                      : (lang === 'mr' ? 'मराठीतून इंग्रजीत भाषांतर' : 'Translate English to Marathi')}
                  </button>
                )}
                {bhashiniMessage && <p className="mt-1 text-[11px] font-semibold text-[#526F50]" role="status">{bhashiniMessage}</p>}
              </div>
            </div>

            {/* Recent Farmer Voice Notes in this Area */}
            {recentReports && recentReports.length > 0 && (
              <div className="bg-[#E6E8DC] p-3 rounded-2xl border border-gray-300/40 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#2F4638]">
                  <span className="flex items-center gap-1.5">
                    <Headphones className="w-3.5 h-3.5 text-[#5A7852]" />
                    <span>{lang === 'mr' ? 'परिसरातील शेतकऱ्यांची व्हॉइस निरीक्षणे:' : 'Neighboring Farmers Voice Notes:'}</span>
                  </span>
                  <span className="text-[10px] text-gray-500 font-normal">
                    {recentReports.length} {lang === 'mr' ? 'नोंदी' : 'reports'}
                  </span>
                </div>

                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {recentReports.slice(0, 3).map((rep) => {
                    const isThisPlaying = playingReportId === rep.id;
                    return (
                      <div
                        key={rep.id}
                        className="bg-[#F6F4EC] p-2 rounded-xl border border-gray-300/40 flex items-center justify-between gap-2 text-[11px]"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-[#2F4638] mr-1.5">
                            {lang === 'mr' ? rep.farmerNameMr.split(' ')[0] : rep.farmerNameEn.split(' ')[0]}:
                          </span>
                          <span className="text-[#2F4638]/80 truncate inline-block max-w-[200px] sm:max-w-xs align-bottom">
                            {lang === 'mr' ? rep.notesMr : rep.notesEn}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handlePlayNeighborReport(rep)}
                          className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg font-bold text-[10px] transition cursor-pointer ${
                            isThisPlaying
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                              : 'bg-[#5A7852]/15 text-[#5A7852] hover:bg-[#5A7852]/25'
                          }`}
                        >
                          {isThisPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                          <span>{isThisPlaying ? (lang === 'mr' ? 'थांबवा' : 'Pause') : (lang === 'mr' ? 'ऐका' : 'Play')}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Honest Scope Disclaimer Note */}
            <div className="bg-[#5A7852]/10 p-2.5 rounded-xl border border-[#5A7852]/30 text-[11px] text-[#5A7852] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t.disclaimerTraditional}</span>
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#2F4638] hover:bg-[#E6E8DC] transition cursor-pointer"
              >
                {t.close}
              </button>

              <button
                type="submit"
                className="bg-[#5A7852] hover:bg-[#466849] active:scale-95 text-white text-xs font-black px-6 py-2.5 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>{hasVoiceNote ? (lang === 'mr' ? '✅ ऑडिओ निरीक्षण पाठवा' : '✅ Submit Voice Note') : t.submitReportBtn}</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
