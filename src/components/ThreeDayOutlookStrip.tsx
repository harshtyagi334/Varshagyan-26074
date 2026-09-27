import React from 'react';
import { Calendar, CloudRain, Droplets, Sun, Thermometer, Wind } from 'lucide-react';
import { DownscalingResult, FarmerReport, Language, Panchayat } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { BlockForecastDay } from '../types';

interface ThreeDayOutlookStripProps {
  panchayat: Panchayat;
  downscalingResult: DownscalingResult;
  farmerReports: FarmerReport[];
  lang: Language;
  blockForecastDays?: BlockForecastDay[];
  blockRainfallMm: number;
  isDemoForecast?: boolean;
}

export const ThreeDayOutlookStrip: React.FC<ThreeDayOutlookStripProps> = ({
  panchayat,
  downscalingResult,
  farmerReports,
  lang,
  blockForecastDays,
  blockRainfallMm,
  isDemoForecast = false,
}) => {
  const t = TRANSLATIONS[lang];
  const activeReports = farmerReports.filter((r) => r.panchayatId === panchayat.id && !r.isDemoData);

  // Generate 3-day projection based on today's downscalingResult and regional forecast trend
  const baseRain = downscalingResult.calibratedRainfall;

  const outlookDays = [
    {
      dayIndex: 0,
      labelMr: 'आज (Today)',
      labelEn: 'Today',
      dateStr: '२५ सप्टें',
      dateEn: '25 Sep',
      rainMm: baseRain,
      probPct: downscalingResult.rainProbabilityPct,
      tempMax: downscalingResult.calibratedTemp,
      tempMin: Math.round(downscalingResult.calibratedTemp - 8),
      humidity: downscalingResult.calibratedHumidity,
      icon: baseRain > 64.5 ? '⛈️' : baseRain > 8 ? '🌧️' : baseRain > 2 ? '🌦️' : '☀️',
      statusMr: baseRain > 64.5 ? 'अतिवृष्टी धोका (Severe Downpour)' : baseRain > 8 ? 'पाऊस (Rain)' : baseRain > 2 ? 'हलकी सर (Showers)' : 'स्वच्छ (Sunny)',
      statusEn: baseRain > 64.5 ? 'Severe Downpour' : baseRain > 8 ? 'Rain' : baseRain > 2 ? 'Showers' : 'Sunny',
      themeBg: baseRain > 64.5 ? 'bg-red-50 border-2 border-[#B6413A] text-red-950 shadow-md ring-2 ring-red-200' : baseRain > 8 ? 'bg-[#E6E8DC] border-[#2F4638]/30 text-[#2F4638]' : baseRain > 2 ? 'bg-[#E6E8DC] border-[#C9A14A]/50 text-[#2F4638]' : 'bg-[#E6E8DC] border-gray-300/40 text-[#2F4638]',
      reportsForDay: activeReports,
      isSevere: baseRain > 64.5,
    },
    {
      dayIndex: 1,
      labelMr: 'उद्या (Tomorrow)',
      labelEn: 'Tomorrow',
      dateStr: '२६ सप्टें',
      dateEn: '26 Sep',
      rainMm: Number((baseRain * 0.75 + (panchayat.elevationM > 650 ? 1.2 : 0.4)).toFixed(1)),
      probPct: Math.max(15, Math.min(95, downscalingResult.rainProbabilityPct - 12)),
      tempMax: Math.round(downscalingResult.calibratedTemp + 0.5),
      tempMin: Math.round(downscalingResult.calibratedTemp - 7.5),
      humidity: Math.max(45, downscalingResult.calibratedHumidity - 6),
      icon: baseRain * 0.75 > 40 ? '🌧️' : baseRain * 0.75 > 5 ? '🌧️' : baseRain * 0.75 > 1.5 ? '🌦️' : '☀️',
      statusMr: baseRain * 0.75 > 40 ? 'जोरदार पाऊस (Heavy Rain)' : baseRain * 0.75 > 5 ? 'पाऊस (Rain)' : baseRain * 0.75 > 1.5 ? 'हलकी सर (Showers)' : 'स्वच्छ (Sunny)',
      statusEn: baseRain * 0.75 > 40 ? 'Heavy Rain' : baseRain * 0.75 > 5 ? 'Rain' : baseRain * 0.75 > 1.5 ? 'Showers' : 'Sunny',
      themeBg: baseRain * 0.75 > 40 ? 'bg-amber-50 border-amber-500 text-[#2F4638] shadow-xs' : baseRain * 0.75 > 5 ? 'bg-[#E6E8DC] border-[#2F4638]/30 text-[#2F4638]' : 'bg-[#E6E8DC] border-gray-300/40 text-[#2F4638]',
      reportsForDay: activeReports.slice(0, Math.max(1, Math.floor(activeReports.length * 0.6))),
      isSevere: false,
    },
    {
      dayIndex: 2,
      labelMr: 'परवा (Day After)',
      labelEn: 'Day After',
      dateStr: '२७ सप्टें',
      dateEn: '27 Sep',
      rainMm: Number((baseRain * 0.45 + (panchayat.distanceToRiverKm < 1 ? 0.8 : 0.2)).toFixed(1)),
      probPct: Math.max(10, Math.min(85, downscalingResult.rainProbabilityPct - 24)),
      tempMax: Math.round(downscalingResult.calibratedTemp + 1.2),
      tempMin: Math.round(downscalingResult.calibratedTemp - 7.0),
      humidity: Math.max(40, downscalingResult.calibratedHumidity - 12),
      icon: baseRain * 0.45 > 3 ? '🌦️' : '☀️',
      statusMr: baseRain * 0.45 > 3 ? 'हलकी सर (Showers)' : 'स्वच्छ सूर्यप्रकाश (Sunny)',
      statusEn: baseRain * 0.45 > 3 ? 'Showers' : 'Sunny',
      themeBg: 'bg-[#E6E8DC] border-gray-300/40 text-[#2F4638]',
      reportsForDay: activeReports.slice(0, Math.max(0, Math.floor(activeReports.length * 0.3))),
      isSevere: false,
    },
  ];

  const terrainMultiplier = blockRainfallMm > 0
    ? downscalingResult.calibratedRainfall / blockRainfallMm
    : 1;
  const displayedDays = blockForecastDays?.length
    ? blockForecastDays.map((forecastDay, dayIndex) => {
        const rain = Number((forecastDay.rainfallMm * terrainMultiplier).toFixed(1));
        const date = new Date(`${forecastDay.date}T00:00:00`);
        const isSevere = rain > 64.5;
        const statusEn = isSevere ? 'Severe Downpour' : rain > 8 ? 'Rain' : rain > 2 ? 'Showers' : 'Sunny';
        const statusMr = isSevere ? 'अतिवृष्टी धोका' : rain > 8 ? 'पाऊस' : rain > 2 ? 'हलकी सर' : 'स्वच्छ';
        return {
          ...outlookDays[dayIndex],
          dayIndex,
          labelMr: dayIndex === 0 ? 'आज' : dayIndex === 1 ? 'उद्या' : 'परवा',
          labelEn: dayIndex === 0 ? 'Today' : dayIndex === 1 ? 'Tomorrow' : 'Day After',
          dateStr: new Intl.DateTimeFormat('mr-IN', { day: 'numeric', month: 'short' }).format(date),
          dateEn: new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date),
          rainMm: rain,
          probPct: forecastDay.precipitationProbabilityPct,
          tempMax: Math.round(forecastDay.tempMaxC),
          tempMin: Math.round(forecastDay.tempMinC),
          icon: isSevere ? '⛈️' : rain > 8 ? '🌧️' : rain > 2 ? '🌦️' : '☀️',
          statusMr,
          statusEn,
          isSevere,
        };
      })
    : outlookDays;

  return (
    <div className="bg-[#E6E8DC] rounded-3xl p-4 sm:p-5 border border-gray-300/40 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-300/30 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-[#2F4638] text-white flex items-center justify-center font-bold shadow-xs">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-black text-[#2F4638] flex items-center gap-2">
              <span>{t.outlook_3day_header}</span>
            </h3>
          </div>
        </div>
        <span className="text-xs bg-[#F6F4EC] px-3 py-1.5 rounded-xl border border-gray-300/40 font-black text-[#2F4638]">
          📍 {lang === 'mr' ? panchayat.nameMr : panchayat.nameEn}
        </span>
      </div>

      {/* 3 High-Contrast Visual Cards with Oversized Symbols */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {displayedDays.map((day) => {
          const isToday = day.dayIndex === 0;

          return (
            <div
              key={day.dayIndex}
              className={`p-4 rounded-2xl border transition flex flex-col justify-between ${day.themeBg} ${
                isToday ? 'ring-2 ring-[#2F4638]/40 shadow-md' : 'shadow-xs'
              }`}
            >
              <div>
                {/* Day title & Confidence Badge */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="font-black text-sm text-[#2F4638] flex items-center gap-1.5">
                    <span className="text-base">{lang === 'mr' ? day.labelMr.split(' ')[0] : day.labelEn}</span>
                    <span className="text-xs text-gray-600 font-mono font-bold">
                      ({lang === 'mr' ? day.dateStr : day.dateEn})
                    </span>
                  </div>
                  {day.isSevere ? (
                    <span className="text-[10px] font-black bg-[#B6413A] text-white px-2 py-0.5 rounded-full uppercase shadow-2xs animate-pulse">
                      🚨 {lang === 'mr' ? 'पावसाचा इशारा' : 'Rain alert'}
                    </span>
                  ) : null}
                </div>

                {/* Oversized Weather Symbol + Rain value */}
                <div className="flex items-center justify-between my-2">
                  <div className="text-4xl sm:text-5xl select-none filter drop-shadow-xs">
                    {day.icon}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-[#2F4638]">
                      {day.rainMm} <span className="text-sm font-sans font-bold">{t.mm}</span>
                    </div>
                    <div className="text-xs font-black text-[#C9A14A]">
                      {day.probPct}% {t.rainProbability}
                    </div>
                  </div>
                </div>

                {/* Status description */}
                <div className="text-xs font-bold mt-1 text-[#2F4638]">
                  {lang === 'mr' ? day.statusMr.split(' (')[0] : day.statusEn}
                </div>
              </div>

              {/* Day metrics footer (subtle secondary text) */}
              <div className="pt-2 mt-2 border-t border-gray-300/30 flex items-center justify-between text-[10px] text-gray-500 font-mono">
                <span>🌡️ {day.tempMax}°C</span>
                <span>💧 {day.humidity}%</span>
              </div>
            </div>
          );
        })}
      </div>
      {!blockForecastDays?.length && <p className="text-[11px] font-semibold text-amber-900">{lang === 'mr' ? 'नमुना तीन-दिवसीय अंदाज' : 'Illustrative three-day outlook'}</p>}
      {!!blockForecastDays?.length && <p className="text-[11px] font-semibold text-[#2F4638]/70">{isDemoForecast
        ? (lang === 'mr' ? 'नमुना तीन-दिवसीय परिस्थिती · प्रात्यक्षिकासाठी' : 'Illustrative three-day demo scenario')
        : (lang === 'mr' ? 'Open-Meteo ब्लॉक अंदाज · पंचायत मूल्यासाठी समान भूभाग गुणक (प्रायोगिक)' : 'Open-Meteo block forecast · same terrain factor applied to Panchayat values (experimental)')}</p>}
    </div>
  );
};
