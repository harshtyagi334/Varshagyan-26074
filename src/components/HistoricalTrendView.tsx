import React, { useState } from 'react';
import { TrendingUp, Calendar, Info, Layers, Sparkles } from 'lucide-react';
import { BlockData, DownscalingResult, FarmerReport, Language, Panchayat } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { generateHistoricalTrend } from '../ml/randomForestModel';

interface HistoricalTrendViewProps {
  panchayat: Panchayat;
  block: BlockData;
  downscalingResult: DownscalingResult;
  reports: FarmerReport[];
  lang: Language;
}

export const HistoricalTrendView: React.FC<HistoricalTrendViewProps> = ({
  panchayat,
  block,
  downscalingResult,
  reports,
  lang,
}) => {
  const t = TRANSLATIONS[lang];
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(6); // Default to today (last index)

  const trendData = generateHistoricalTrend(panchayat, block, downscalingResult, reports);

  // SVG Chart Dimensions
  const chartWidth = 700;
  const chartHeight = 220;
  const paddingX = 50;
  const paddingY = 30;

  // Find max rain to scale Y axis
  const maxRain = Math.max(
    ...trendData.map((d) => Math.max(d.blockRainfallMm, d.rfDownscaledMm, d.calibratedRainfallMm)),
    12
  );

  const getX = (index: number) => {
    return paddingX + (index / (trendData.length - 1)) * (chartWidth - paddingX * 2);
  };

  const getY = (val: number) => {
    return chartHeight - paddingY - (val / (maxRain * 1.15)) * (chartHeight - paddingY * 2);
  };

  // Build SVG path strings
  const blockPath = trendData
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.blockRainfallMm)}`)
    .join(' ');

  const rfPath = trendData
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.rfDownscaledMm)}`)
    .join(' ');

  const calibratedPath = trendData
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.calibratedRainfallMm)}`)
    .join(' ');

  const activePoint = hoveredDayIndex !== null ? trendData[hoveredDayIndex] : trendData[6];

  return (
    <div className="bg-[#E6E8DC] rounded-3xl p-5 sm:p-6 border border-gray-300/40 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-300/30 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-2xl bg-[#5A7852]/15 text-[#5A7852] flex items-center justify-center font-bold">
            <TrendingUp className="w-4 h-4 text-[#5A7852]" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-[#2F4638]">
              {lang === 'mr' ? '७ दिवसांचा नमुना आलेख' : '7-day demonstration chart'}
            </h3>
            <p className="text-xs text-[#2F4638]/70">
              {lang === 'mr'
                ? `${panchayat.nameMr} — ऐतिहासिक निरीक्षणे नाहीत; दाखवलेली मूल्ये नमुना आहेत`
                : `${panchayat.nameEn} — no historical observations; displayed values are illustrative`}
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs bg-[#F6F4EC] px-3 py-1.5 rounded-xl border border-gray-300/40">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-sky-500" />
            <span className="text-gray-600">{lang === 'mr' ? 'नमुना ब्लॉक मूल्य' : 'Sample block value'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-[#2F4638] rounded-full" />
            <span className="text-[#2F4638] font-semibold">{lang === 'mr' ? 'भूभाग नमुना' : 'Terrain heuristic'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-[#5A7852] rounded-full" />
            <span className="text-[#5A7852] font-bold">{lang === 'mr' ? 'नमुना समायोजित मूल्य' : 'Sample adjusted value'}</span>
          </div>
        </div>
      </div>

      {/* Responsive SVG Line Chart */}
      <div className="w-full bg-[#F6F4EC] rounded-2xl p-2 sm:p-4 border border-gray-300/40 relative overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto overflow-visible"
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const val = Number((maxRain * pct).toFixed(1));
            const y = getY(val);
            return (
              <g key={i}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="#DDD8CD"
                  strokeWidth="1"
                  strokeDasharray="4 2"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fontFamily="monospace"
                  fill="#8A8A85"
                >
                  {val}mm
                </text>
              </g>
            );
          })}

          {/* 1. Coarse Block Line (dashed sky blue) */}
          <path
            d={blockPath}
            fill="none"
            stroke="#0284C7"
            strokeWidth="2"
            strokeDasharray="4 3"
          />

          {/* 2. RF Downscaled Line (Deep Monsoon Slate Indigo #2F4638) */}
          <path
            d={rfPath}
            fill="none"
            stroke="#2F4638"
            strokeWidth="2.5"
          />

          {/* 3. Calibrated Final Line (Muted Terracotta Clay #5A7852) */}
          <path
            d={calibratedPath}
            fill="none"
            stroke="#5A7852"
            strokeWidth="3.5"
          />

          {/* Points & Hover nodes */}
          {trendData.map((d, i) => {
            const x = getX(i);
            const isHovered = hoveredDayIndex === i;

            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredDayIndex(i)}
              >
                {/* Vertical hover line indicator */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={paddingY}
                    x2={x}
                    y2={chartHeight - paddingY}
                    stroke="#5A7852"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                )}

                {/* IMD Point */}
                <circle
                  cx={x}
                  cy={getY(d.blockRainfallMm)}
                  r="3"
                  fill="#0284C7"
                />

                {/* RF Point */}
                <circle
                  cx={x}
                  cy={getY(d.rfDownscaledMm)}
                  r="4"
                  fill="#2F4638"
                />

                {/* Calibrated Point */}
                <circle
                  cx={x}
                  cy={getY(d.calibratedRainfallMm)}
                  r={isHovered ? 6 : 4.5}
                  fill="#5A7852"
                  stroke="#F6F4EC"
                  strokeWidth="2"
                />

                {/* Day Labels at bottom */}
                <text
                  x={x}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={isHovered ? 'bold' : 'normal'}
                  fill={isHovered ? '#2F4638' : '#8A8A85'}
                >
                  {lang === 'mr' ? d.dayLabelMr.split(' ')[0] : d.dayLabelEn.split(' ')[0]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Hovered Day Detail Card */}
      {activePoint && (
        <div className="bg-[#F6F4EC] p-3.5 rounded-2xl border border-gray-300/40 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="border-r border-gray-300/30 pr-2">
            <span className="text-gray-500 text-[10px] block font-bold">
              {lang === 'mr' ? 'तारीख / दिवस' : 'Date / Day'}
            </span>
            <span className="font-bold text-[#2F4638] text-sm">
              {lang === 'mr' ? activePoint.dayLabelMr : activePoint.dayLabelEn} ({activePoint.date})
            </span>
          </div>

          <div className="border-r border-gray-300/30 pr-2">
            <span className="text-sky-700 text-[10px] block font-bold">
              {lang === 'mr' ? 'IMD ब्लॉक अंदाज' : 'IMD Coarse'}
            </span>
            <span className="font-mono font-black text-[#2F4638] text-sm">
              {activePoint.blockRainfallMm} mm
            </span>
          </div>

          <div className="border-r border-gray-300/30 pr-2">
            <span className="text-[#2F4638] text-[10px] block font-bold">
              {lang === 'mr' ? 'भूभाग नमुना' : 'Terrain heuristic'}
            </span>
            <span className="font-mono font-black text-[#2F4638] text-sm">
              {activePoint.rfDownscaledMm} mm
            </span>
          </div>

          <div>
            <span className="text-[#5A7852] text-[10px] block font-bold">
              {lang === 'mr' ? 'नमुना समायोजित पाऊस' : 'Sample adjusted rainfall'}
            </span>
            <span className="font-mono font-black text-[#5A7852] text-sm">
              {activePoint.calibratedRainfallMm} mm
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
