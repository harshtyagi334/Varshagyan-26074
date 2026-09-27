import React, { useEffect, useState } from 'react';
import { AlertTriangle, BellRing, X } from 'lucide-react';
import { Language, PanchayatAlert } from '../types';
import { translateAlertMessage } from '../services/bhashini';
import { DEMO_ALERT_EN, DEMO_ALERT_MR } from '../data/demoWeatherScenario';

interface FarmerPanchayatAlertProps {
  lang: Language;
  panchayatId: string;
  alert: PanchayatAlert | null;
}

export const FarmerPanchayatAlert: React.FC<FarmerPanchayatAlertProps> = ({ lang, panchayatId, alert }) => {
  const [dismissedAlertId, setDismissedAlertId] = useState<string | null>(null);
  const [translatedMessage, setTranslatedMessage] = useState('');
  const [translationState, setTranslationState] = useState<'ready' | 'translating' | 'fallback'>('ready');

  useEffect(() => {
    if (alert?.id) setDismissedAlertId(null);
  }, [alert?.id, lang]);

  useEffect(() => {
    if (!alert) return;
    if (lang === alert.sourceLanguage) {
      setTranslatedMessage(alert.message);
      setTranslationState('ready');
      return;
    }

    // Keep the prewritten video-demo alert bilingual even when no API keys are
    // configured. Officer-authored messages still use BHASHINI when available.
    if (alert.message.trim() === DEMO_ALERT_EN && lang === 'mr') {
      setTranslatedMessage(DEMO_ALERT_MR);
      setTranslationState('ready');
      return;
    }
    if (alert.message.trim() === DEMO_ALERT_MR && lang === 'en') {
      setTranslatedMessage(DEMO_ALERT_EN);
      setTranslationState('ready');
      return;
    }

    let isCurrentRequest = true;
    setTranslatedMessage('');
    setTranslationState('translating');
    void translateAlertMessage(alert.message, alert.sourceLanguage, lang)
      .then((translation) => {
        if (!isCurrentRequest) return;
        setTranslatedMessage(translation);
        setTranslationState('ready');
      })
      .catch(() => {
        if (!isCurrentRequest) return;
        setTranslatedMessage(alert.message);
        setTranslationState('fallback');
      });

    return () => { isCurrentRequest = false; };
  }, [alert?.id, alert?.message, alert?.sourceLanguage, lang]);

  if (!alert || alert.panchayatId !== panchayatId || dismissedAlertId === alert.id) return null;

  const isUrgent = alert.severity === 'urgent';
  const label = lang === 'mr'
      ? { title: 'ग्रामपंचायत सूचना', urgent: 'तातडीचे', translating: 'तुमच्या भाषेत भाषांतर सुरू आहे…', fallback: 'भाषांतर सेवा उपलब्ध नाही. मूळ संदेश दाखवत आहोत.', dismiss: 'सूचना बंद करा' }
      : { title: 'Panchayat alert', urgent: 'Urgent', translating: 'Translating this message…', fallback: 'Translation is unavailable. Showing the original message.', dismiss: 'Dismiss alert' };

  return (
    <aside className="fixed bottom-4 left-4 right-4 z-[70] mx-auto max-w-lg sm:bottom-6" role="alert" aria-live="assertive">
      <div className={`relative flex items-start gap-3 rounded-2xl border-2 p-4 pr-12 shadow-2xl ${isUrgent ? 'border-red-200 bg-[#B6413A] text-white' : 'border-[#2F4638]/15 bg-white text-[#2F4638]'}`}>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isUrgent ? 'bg-white/15 text-white' : 'bg-[#E6E8DC] text-[#2F4638]'}`}>
          {isUrgent ? <AlertTriangle className="h-5 w-5" aria-hidden="true" /> : <BellRing className="h-5 w-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-black">{label.title}{isUrgent ? ` · ${label.urgent}` : ''}</h2>
          {translationState === 'translating' ? (
            <p className={`mt-1 text-sm ${isUrgent ? 'text-white/85' : 'text-[#2F4638]/70'}`} role="status">{label.translating}</p>
          ) : (
            <p className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed ${isUrgent ? 'text-white' : 'text-[#2F4638]/85'}`}>{translatedMessage}</p>
          )}
          {translationState === 'fallback' && <p className={`mt-1 text-xs ${isUrgent ? 'text-white/80' : 'text-amber-800'}`}>{label.fallback}</p>}
        </div>
        <button
          type="button"
          onClick={() => setDismissedAlertId(alert.id)}
          className={`absolute right-2 top-2 rounded-lg p-2 ${isUrgent ? 'text-white/80 hover:bg-white/15 hover:text-white' : 'text-[#2F4638]/60 hover:bg-[#E6E8DC] hover:text-[#2F4638]'}`}
          aria-label={label.dismiss}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
};
