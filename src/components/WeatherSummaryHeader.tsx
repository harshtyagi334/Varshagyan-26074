import React from 'react';
import { CloudRain, Droplets, Thermometer, Wind, Mountain, Eye, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { BlockData, DownscalingResult, FarmerReport, Language, Panchayat } from '../types';
import { TRANSLATIONS } from '../i18n/translations';

interface WeatherSummaryHeaderProps {
  lang: Language;
  selectedPanchayat: Panchayat;
  selectedBlock: BlockData;
  downscalingResult: DownscalingResult;
  farmerReports?: FarmerReport[];
  onOpenIntake: () => void;
  onGoToMap: () => void;
  isUrgent?: boolean;
}

export const WeatherSummaryHeader: React.FC<WeatherSummaryHeaderProps> = ({
  lang,
  selectedPanchayat,
  selectedBlock,
  downscalingResult,
  farmerReports = [],
  onOpenIntake,
  onGoToMap,
  isUrgent = false,
}) => {
  const t = TRANSLATIONS[lang];
  const delta = downscalingResult.calibrationDeltaMm;
  const isHigherRain = downscalingResult.calibratedRainfall > selectedBlock.imdRainfallMm;

  return (
    <div className="bg-[#F6F4EC] pt-4 pb-2 w-full">
      <div className="w-full min-w-0 px-3 sm:px-6 2xl:px-10">
        {/* Top Breadcrumb & Micro-Location Title */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs uppercase tracking-wider font-semibold px-2.5 py-1 rounded-xl transition-colors ${
              isUrgent ? 'text-[#B6413A] bg-red-100 border border-red-300 font-bold' : 'text-[#5A7852] bg-[#5A7852]/15'
            }`}>
              📍 {lang === 'mr' ? selectedBlock.nameMr : selectedBlock.nameEn} {lang === 'mr' ? 'तालुका' : 'Block'}
            </span>
            <span className="text-[#2F4638]/40">/</span>
            <span className="text-sm font-bold text-[#2F4638]">
              {lang === 'mr' ? selectedPanchayat.nameMr : selectedPanchayat.nameEn} {lang === 'mr' ? 'ग्रामपंचायत' : 'Gram Panchayat'}
            </span>
            {!isUrgent ? (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-900">
                {selectedBlock.isDemoForecast ? (lang === 'mr' ? 'नमुना अंदाज' : 'Sample forecast') : (lang === 'mr' ? 'IMD अंदाज' : 'IMD forecast')}
              </span>
            ) : (
              <span className="bg-[#B6413A] text-white text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1 shadow-xs border border-white/20">
                🚨 {lang === 'mr' ? 'अतिवृष्टी इशारा' : 'IMD RED ALERT'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="bg-[#2F4638]/10 text-[#2F4638] px-2.5 py-1 rounded-xl font-mono font-medium" title={lang === 'mr' ? 'डिजिटल उंची नकाशा' : 'Digital elevation model'}>
              {lang === 'mr' ? 'उंची माहिती' : 'Elevation data'}
            </span>
            <span className="bg-[#C9A14A]/15 text-[#806000] px-2.5 py-1 rounded-xl font-medium">
              {lang === 'mr' ? selectedPanchayat.soilTypeMr : selectedPanchayat.soilTypeEn}
            </span>
          </div>
        </div>

        {/* The Side-by-Side Dual Engine Comparison Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          
          {/* 1. LEFT CARD: Coarse IMD Block Forecast (0.25° Resolution) */}
          <div className="lg:col-span-6 bg-gradient-to-br from-[#2F4638] to-[#233B2F] text-[#F6F4EC] rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-300/40 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute -right-8 -top-8 w-28 h-28 bg-white/5 rounded-full blur-xl pointer-events-none" />
            
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-200">
                    {selectedBlock.isDemoForecast ? (lang === 'mr' ? 'नमुना ब्लॉक इनपुट' : 'Sample block input') : t.blockLevelLabel}
                  </h3>
                </div>
                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded font-mono text-[#F6F4EC]/80">
                  {selectedBlock.imdGridCell}
                </span>
              </div>

              <div className="text-xs text-[#F6F4EC]/70 mb-3">
                {lang === 'mr'
                  ? `संपूर्ण ${selectedBlock.nameMr} तालुक्यासाठी एकच सरासरी अंदाज:`
                  : `Coarse single uniform estimate for whole ${selectedBlock.nameEn} block:`}
              </div>

              {/* Rain Value */}
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl sm:text-5xl font-extrabold tracking-tight font-mono text-[#F6F4EC]">
                  {selectedBlock.imdRainfallMm}
                </span>
                <span className="text-lg text-[#F6F4EC]/80 font-medium">
                  {t.mm}
                </span>
                <span className="text-xs text-cyan-300 font-medium ml-2 bg-cyan-950/60 px-2 py-1 rounded border border-cyan-800">
                  {lang === 'mr' ? 'एकसमान ब्लॉक अंदाज' : 'Uniform Block Forecast'}
                </span>
              </div>

              {/* Coarse Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 text-center bg-black/20 p-2.5 rounded-xl border border-white/10">
                <div>
                  <div className="text-[10px] text-[#F6F4EC]/60">{t.tempMax}</div>
                  <div className="text-sm font-bold text-[#F6F4EC] font-mono">{selectedBlock.imdTempMaxC}°C</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#F6F4EC]/60">{t.humidity}</div>
                  <div className="text-sm font-bold text-[#F6F4EC] font-mono">{selectedBlock.imdHumidityPct}%</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#F6F4EC]/60">{t.wind}</div>
                  <div className="text-sm font-bold text-[#F6F4EC] font-mono">{selectedBlock.imdWindSpeedKmh} {t.kmh}</div>
                </div>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-[#F6F4EC]/60 italic flex items-center justify-between">
              <span>{selectedBlock.isDemoForecast
                ? (lang === 'mr' ? 'नमुना डेटा — IMD कडून थेट नाही' : 'Sample data — not live from IMD')
                : (lang === 'mr' ? 'स्रोत: IMD' : 'Source: IMD')}</span>
              <button onClick={onGoToMap} className="text-cyan-300 underline font-medium hover:text-cyan-200 cursor-pointer">
                {lang === 'mr' ? 'नकाशावर पहा' : 'View on Map'}
              </button>
            </div>
          </div>

          {/* 2. RIGHT CARD: Hyperlocal Calibrated Downscaled Panchayat Forecast */}
          <div className={`lg:col-span-6 rounded-2xl p-4 sm:p-5 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all duration-300 ${
            isUrgent
              ? 'bg-gradient-to-br from-red-50 to-rose-100 border-2 border-[#B6413A] shadow-md ring-2 ring-red-200'
              : 'bg-[#E6E8DC] border-2 border-[#5A7852]/40'
          }`}>
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                  isUrgent ? 'bg-[#B6413A] animate-pulse' : 'bg-[#5A7852]'
                }`}>
                  {isUrgent ? '🚨' : '✓'}
                </div>
                <h3 className={`text-xs font-black uppercase tracking-wider ${
                  isUrgent ? 'text-[#B6413A]' : 'text-[#5A7852]'
                }`}>
                  {isUrgent
                    ? (lang === 'mr' ? 'अतिवृष्टी इशारा (>६४.५ मिमी)' : 'IMD HEAVY RAIN ALERT (>64.5mm)')
                    : t.calibratedLabel}
                </h3>
                {isUrgent ? (
                  <span className="text-[10px] font-black bg-[#B6413A] text-white px-2 py-0.5 rounded-full shadow-2xs">
                    URGENT
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-900">{selectedBlock.isDemoForecast ? (lang === 'mr' ? 'नमुना' : 'Sample') : ''}</span>
                )}
              </div>
              
              {/* Delta badge */}
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-xl flex items-center gap-1 border ${
                isUrgent
                  ? 'bg-red-100 text-[#B6413A] border-red-300 font-black'
                  : isHigherRain
                  ? 'bg-amber-100 text-[#806000] border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}>
                <span>{isHigherRain ? '▲' : '▼'} {Math.abs(Number((downscalingResult.calibratedRainfall - selectedBlock.imdRainfallMm).toFixed(1)))} mm</span>
                <span className="text-[10px] font-normal">{lang === 'mr' ? 'स्थानिक तफावत' : 'Micro-Delta'}</span>
              </span>
            </div>

            {/* Main Downscaled Rainfall */}
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-4xl sm:text-5xl font-black tracking-tight font-mono ${
                isUrgent ? 'text-[#B6413A]' : 'text-[#2F4638]'
              }`}>
                {downscalingResult.calibratedRainfall}
              </span>
              <span className={`text-xl font-bold ${isUrgent ? 'text-[#B6413A]' : 'text-[#2F4638]/70'}`}>
                {t.mm}
              </span>
              <div className="ml-auto text-right">
                <span className={`text-xs font-black block ${isUrgent ? 'text-[#B6413A]' : 'text-[#C9A14A]'}`}>
                  {downscalingResult.rainProbabilityPct}% {t.rainProbability}
                </span>
                <span className="text-[10px] text-[#2F4638]/60">
                  {lang === 'mr' ? 'हायपरलोकल अंदाज' : 'Hyperlocal Forecast'}
                </span>
              </div>
            </div>

            {/* Breakdown: RF Model vs Traditional Signal */}
              <div className="bg-[#F6F4EC] p-3 rounded-xl border border-gray-300/40 space-y-1.5 mb-3 text-xs">
              <div className="flex justify-between items-start gap-2 text-[#2F4638]">
                <span className="flex min-w-0 items-center gap-1.5 text-gray-700">
                  <span className="w-2 h-2 rounded-full bg-[#2F4638]" />
                  <span>{lang === 'mr' ? 'भूभागानुसार प्राथमिक अंदाज:' : 'Terrain-adjusted prototype estimate:'}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap font-mono font-bold text-[#2F4638]">
                  {downscalingResult.rfDownscaledRainfall} mm
                </span>
              </div>
              
              <div className={`flex justify-between items-start gap-2 transition-colors ${
                isUrgent ? 'text-[#B6413A] font-bold' : 'text-[#5A7852]'
              }`}>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isUrgent ? 'bg-[#B6413A]' : 'bg-[#5A7852]'}`} />
                  <span>{lang === 'mr' ? 'शेतकरी निरीक्षणे (अंदाजात वापरलेली नाहीत):' : 'Farmer observations (not used in estimate):'}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap font-mono font-bold">
                  {delta >= 0 ? `+${delta}` : delta} mm
                </span>
              </div>
            </div>

            {/* Micro Metrics Grid */}
            <div className={`grid grid-cols-3 gap-2 text-center p-2.5 rounded-xl transition-colors ${
              isUrgent ? 'bg-red-100/70 border border-red-200' : 'bg-[#F6F4EC] border border-gray-300/40'
            }`}>
              <div>
                <div className="text-[10px] text-[#2F4638]/70">{t.tempMax}</div>
                <div className="text-sm font-bold text-[#2F4638] font-mono">{downscalingResult.calibratedTemp}°C</div>
              </div>
              <div>
                <div className="text-[10px] text-[#2F4638]/70">{t.humidity}</div>
                <div className={`text-sm font-bold font-mono ${isUrgent ? 'text-[#B6413A] font-black' : 'text-[#2F4638]'}`}>
                  {downscalingResult.calibratedHumidity}%
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#2F4638]/70">{lang === 'mr' ? 'पडताळणी' : 'Validation'}</div>
                <div className={`text-sm font-bold font-mono ${isUrgent ? 'text-[#B6413A] font-black' : 'text-[#5A7852]'}`}>
                  {isUrgent ? (lang === 'mr' ? 'धोकादायक' : 'ALERT') : (lang === 'mr' ? 'पडताळणी बाकी' : 'Not validated')}
                </div>
              </div>
            </div>

            {/* Action nudge */}
            <div className="mt-3 flex items-center justify-between text-[11px]">
              <span className={`font-medium flex items-center gap-1 transition-colors ${
                isUrgent ? 'text-[#B6413A] font-black' : 'text-[#5A7852]'
              }`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                {isUrgent
                  ? (lang === 'mr' ? '🚨 अतिवृष्टी इशारा सक्रिय — आपत्कालीन खबरदारी घ्या' : '🚨 Heavy rain emergency active — exercise caution')
                  : downscalingResult.activeReportsCount > 0
                  ? `${downscalingResult.activeReportsCount} ${lang === 'mr' ? 'शेतकरी निरीक्षणे नोंदली' : 'farmer observations recorded'}`
                  : selectedBlock.isDemoForecast
                    ? (lang === 'mr' ? 'नमुना आकडे — शेतीच्या निर्णयासाठी वापरू नका' : 'Sample values — do not use for farm decisions')
                    : (lang === 'mr' ? 'स्थानिक निरीक्षण नोंदवा' : 'Add a local observation')}
              </span>
              <button
                onClick={onOpenIntake}
                className="text-[#5A7852] hover:text-[#466849] font-bold underline cursor-pointer"
              >
                {lang === 'mr' ? '+ संकेत नोंदवा' : '+ Report Sign'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
