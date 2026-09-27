import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Cpu, Sparkles, TrendingUp, Layers, Compass, CheckCircle } from 'lucide-react';
import { BlockData, DownscalingResult, FarmerReport, Language, Panchayat } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { getExplainabilityFactors } from '../ml/randomForestModel';

interface ExplainabilityPanelProps {
  panchayat: Panchayat;
  block: BlockData;
  downscalingResult: DownscalingResult;
  reports: FarmerReport[];
  lang: Language;
}

export const ExplainabilityPanel: React.FC<ExplainabilityPanelProps> = ({
  panchayat,
  block,
  downscalingResult,
  reports,
  lang,
}) => {
  const t = TRANSLATIONS[lang];
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const topFactors = getExplainabilityFactors(panchayat, block, downscalingResult, reports);

  return (
    <div className="bg-[#E6E8DC] rounded-3xl border border-gray-300/40 overflow-hidden transition-all shadow-2xs">
      {/* Expand/Collapse Toggle Button Bar */}
      <div className="p-3 sm:p-4 flex items-center justify-between gap-3 bg-[#E6E8DC] hover:bg-[#F6F4EC] transition cursor-pointer select-none" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#2F4638]/10 text-[#2F4638] flex items-center justify-center font-bold">
            <HelpCircle className="w-4 h-4 text-[#2F4638]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-[#2F4638]">
                {t.xai_title}
              </span>
            </div>
            <p className="text-[11px] text-[#2F4638]/70">
              {lang === 'mr'
                ? 'नमुना अंदाज कसा मोजला आहे ते पहा'
                : 'How this sample estimate is calculated'}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 bg-[#2F4638] hover:bg-[#233B2F] text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-2xs transition shrink-0"
        >
          <span>ℹ️ {t.why_button}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 text-[#C9A14A]" />}
        </button>
      </div>

      {/* Expanded Factors Breakdown */}
      {isOpen && (
        <div className="p-4 pt-2 border-t border-gray-300/30 space-y-3 bg-[#F6F4EC] animate-in fade-in duration-200">
          <div className="text-[11px] text-[#2F4638]/70 flex items-center justify-between">
            <span>
              {lang === 'mr'
                ? `${panchayat.nameMr} साठी या नमुना अंदाजावर परिणाम करणारे घटक:`
                : `Factors used by this sample estimate for ${panchayat.nameEn}:`}
            </span>
            <span className="text-[#5A7852] font-bold">
              Base: {block.imdRainfallMm} mm → {downscalingResult.calibratedRainfall} mm
            </span>
          </div>

          {/* Factor Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {topFactors.map((factor, index) => {
              const impactBadgeClass = {
                high: 'bg-rose-100 text-rose-800 border-rose-200',
                moderate: 'bg-amber-100 text-amber-900 border-amber-300',
                low: 'bg-[#E6E8DC] text-gray-700 border-gray-300/50',
              }[factor.impactLevel];

              return (
                <div
                  key={factor.id}
                  className="bg-[#E6E8DC] p-3.5 rounded-2xl border border-gray-300/40 shadow-2xs space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <span className="text-xs font-black text-[#2F4638] flex items-center gap-1">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-[#2F4638]/10 text-[#2F4638] flex items-center justify-center font-mono">
                          {index + 1}
                        </span>
                        <span>{lang === 'mr' ? factor.nameMr : factor.nameEn}</span>
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${impactBadgeClass}`}>
                        {lang === 'mr' ? factor.impactLabelMr : factor.impactLabelEn}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#2F4638]/80 leading-relaxed">
                      {lang === 'mr' ? factor.descriptionMr : factor.descriptionEn}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-gray-300/30 flex items-center justify-between text-[11px]">
                    <span className="text-gray-500 font-mono text-[10px]">
                      {lang === 'mr' ? 'मूल्य:' : 'Value:'}
                    </span>
                    <span className="font-mono font-bold text-[#2F4638] bg-[#F6F4EC] px-2 py-0.5 rounded border border-gray-300/40">
                      {factor.calculatedValue}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mathematical Pipeline Summary Footnote */}
          <div className="bg-[#E6E8DC] p-3 rounded-2xl border border-gray-300/40 text-[11px] text-[#2F4638]/80 flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-gray-700">
              Demonstration formula: sample block value ({block.imdRainfallMm}mm) × terrain factor ({downscalingResult.orographicFactor}) = <b>{downscalingResult.calibratedRainfall} mm</b>
            </span>
            <span className="text-[#5A7852] font-bold text-[10px]">
              Prototype only · Not validated
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
