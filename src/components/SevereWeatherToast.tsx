import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { Language, Panchayat } from '../types';

interface SevereWeatherToastProps {
  isUrgent: boolean;
  lang: Language;
  selectedPanchayat: Panchayat;
  calibratedRainfall: number;
}

export const SevereWeatherToast: React.FC<SevereWeatherToastProps> = ({
  isUrgent,
  lang,
  selectedPanchayat,
  calibratedRainfall,
}) => {
  const [dismissed, setDismissed] = useState<boolean>(false);

  // Reset dismissal when urgent state changes from false to true
  useEffect(() => {
    if (isUrgent) {
      setDismissed(false);
    }
  }, [isUrgent]);

  if (!isUrgent || dismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full mx-4 sm:mx-0 animate-bounce-short">
      <div className="rounded-2xl bg-[#B6413A] text-white p-4 shadow-2xl border-2 border-white/40 flex items-start gap-3.5 relative overflow-hidden">
        {/* Background ambient pulse glow */}
        <div className="absolute inset-0 bg-red-600/30 animate-pulse pointer-events-none" />

        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
          <ShieldAlert className="w-6 h-6 text-white animate-spin-slow" />
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-black/40 text-yellow-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-white/20">
              {lang === 'mr' ? '🚨 आपत्कालीन हवामान इशारा' : '🚨 CRITICAL WEATHER WARNING'}
            </span>
            <span className="text-white/80 text-xs font-mono">
              {calibratedRainfall.toFixed(1)} mm
            </span>
          </div>

          <h4 className="text-sm font-bold text-white leading-tight">
            {lang === 'mr'
              ? `${selectedPanchayat.nameMr} मध्ये अतिवृष्टी (>६४.५ मिमी) नोंदवली!`
              : `Severe Rainfall Alert (>64.5mm) in ${selectedPanchayat.nameEn}!`}
          </h4>

          <p className="mt-1 text-xs text-white/90 leading-relaxed">
            {lang === 'mr'
              ? 'शेतात पाणी साचण्याची शक्यता; सुरक्षिततेची काळजी घ्या व प्रशासनाच्या सूचना पाळा.'
              : 'High risk of waterlogging & flash flooding. Follow local district disaster management guidelines.'}
          </p>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 text-white/70 hover:text-white p-1 rounded-lg hover:bg-black/20 transition cursor-pointer"
          aria-label="Dismiss alert"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
