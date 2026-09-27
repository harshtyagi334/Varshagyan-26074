import React from 'react';
import { ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import { ConfidenceLevel, FarmerReport, Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { getPanchayatConfidence } from '../ml/randomForestModel';

interface ConfidenceBadgeProps {
  reports: FarmerReport[];
  lang: Language;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  showLabel?: boolean;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  reports,
  lang,
  size = 'md',
  showCount = true,
  showLabel = true,
}) => {
  const t = TRANSLATIONS[lang];
  const { level, count, labelKey } = getPanchayatConfidence(reports);

  // Style configurations strictly matching organic palette:
  // Low confidence (grey badge): zero or one report
  // Medium confidence (amber/ochre badge): 2-4 reports -> Warm Turmeric Ochre (#C9A14A)
  // High confidence (terracotta badge): 5+ reports -> Muted Terracotta Clay (#5A7852)
  const config = {
    low: {
      bg: 'bg-[#E6E8DC]',
      text: 'text-[#2F4638]/80',
      border: 'border-gray-300/60',
      dot: 'bg-gray-400',
      icon: Shield,
    },
    medium: {
      bg: 'bg-[#C9A14A]/15',
      text: 'text-[#806000]',
      border: 'border-[#C9A14A]/40',
      dot: 'bg-[#C9A14A]',
      icon: ShieldAlert,
    },
    high: {
      bg: 'bg-[#5A7852]/15',
      text: 'text-[#5A7852]',
      border: 'border-[#5A7852]/40',
      dot: 'bg-[#5A7852]',
      icon: ShieldCheck,
    },
  }[level];

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses} shadow-2xs transition-all`}
      title={`${t[labelKey]} (${count} ${lang === 'mr' ? 'स्थानिक संकेत' : 'bio-indicator reports'})`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dot} shrink-0`} />
      {showLabel && <span className="leading-none whitespace-nowrap">{t[labelKey]}</span>}
      {showCount && (
        <span className="text-[10px] opacity-75 font-mono ml-0.5">
          ({count})
        </span>
      )}
    </span>
  );
};
