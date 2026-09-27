import React from 'react';
import { ArrowRight, CloudRain, Compass, Leaf, Mountain, Waves } from 'lucide-react';
import { BlockData, FarmerReport, Language, Panchayat } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { PANCHAYATS_DATA } from '../data/nashikGeoData';
import { calculateDownscaledWeather } from '../ml/randomForestModel';

interface ScienceExplanationProps {
  lang: Language;
  selectedPanchayat: Panchayat;
  selectedBlock: BlockData;
  farmerReports: FarmerReport[];
}

export const ScienceExplanation: React.FC<ScienceExplanationProps> = ({
  lang,
  selectedPanchayat,
  selectedBlock,
  farmerReports,
}) => {
  const t = TRANSLATIONS[lang];
  const isMr = lang === 'mr';

  const sameBlockEstimates = PANCHAYATS_DATA
    .filter((panchayat) => panchayat.blockId === selectedBlock.id)
    .map((panchayat) => ({
      panchayat,
      estimate: calculateDownscaledWeather(panchayat, selectedBlock, farmerReports).rfDownscaledRainfall,
    }))
    .sort((a, b) => a.panchayat.id.localeCompare(b.panchayat.id));
  const centralVillage = sameBlockEstimates.find((item) => item.panchayat.id === selectedPanchayat.id) || {
    panchayat: selectedPanchayat,
    estimate: calculateDownscaledWeather(selectedPanchayat, selectedBlock, farmerReports).rfDownscaledRainfall,
  };
  const distanceKm = (first: Panchayat, second: Panchayat) => {
    const radians = (degrees: number) => degrees * Math.PI / 180;
    const dLat = radians(second.lat - first.lat);
    const dLng = radians(second.lng - first.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(first.lat)) * Math.cos(radians(second.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const directionsEn = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const directionsMr = ['उत्तर', 'ईशान्य', 'पूर्व', 'आग्नेय', 'दक्षिण', 'नैऋत्य', 'पश्चिम', 'वायव्य'];
  const directionFromCenter = (center: Panchayat, point: Panchayat) => {
    const toRad = (value: number) => value * Math.PI / 180;
    const lat1 = toRad(center.lat);
    const lat2 = toRad(point.lat);
    const dLng = toRad(point.lng - center.lng);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    const index = Math.round(bearing / 45) % 8;
    return isMr ? directionsMr[index] : directionsEn[index];
  };
  const nearbyVillages = sameBlockEstimates
    .filter((item) => item.panchayat.id !== centralVillage.panchayat.id)
    .map((item) => ({ ...item, distance: distanceKm(centralVillage.panchayat, item.panchayat) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);
  const comparisonVillages = [
    { ...centralVillage, distance: 0, direction: isMr ? 'केंद्र' : 'Center' },
    ...nearbyVillages.map((item) => ({
      ...item,
      direction: directionFromCenter(centralVillage.panchayat, item.panchayat),
    })),
  ];
  const getVillageName = (panchayat: Panchayat) => isMr ? panchayat.nameMr : panchayat.nameEn;
  const rainText = (rainfall: number) => rainfall.toLocaleString(isMr ? 'mr-IN' : 'en-IN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <div className="w-full min-w-0 px-3 sm:px-6 2xl:px-10 py-4 sm:py-6 space-y-5 sm:space-y-6">
      
      {/* 1. Header & Architecture Headline */}
      <div className="bg-[#E6E8DC] rounded-3xl p-6 border border-gray-300/40 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#2F4638]" />
          <span className="text-xs uppercase font-bold tracking-wider text-[#2F4638]">
            {isMr ? 'स्थानिक पाऊस · डेमो मार्गदर्शक' : 'LOCAL RAINFALL · DEMO GUIDE'}
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-[#2F4638]">
          {t.scienceTitle}
        </h2>
        <p className="text-sm text-[#2F4638]/80 mt-1 max-w-3xl">
          {t.scienceSubtitle}
        </p>
      </div>

      {/* The core problem statement: one block input, distinct Panchayat outputs. */}
      <section className="rounded-3xl border border-[#2F4638]/10 bg-white p-5 sm:p-6 shadow-sm space-y-4" aria-labelledby="downscaling-demo-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="downscaling-demo-title" className="mt-1 text-xl sm:text-2xl font-black text-[#2F4638]">
              {isMr ? 'एकच तालुका अंदाज → वेगवेगळे पंचायत अंदाज' : 'One block forecast → different Panchayat estimates'}
            </h3>
            <p className="mt-1 text-sm text-[#2F4638]/70">
              {isMr ? 'निवडलेले गाव आणि त्याच तालुक्यातील जवळची तीन गावे दाखवली आहेत. दिशा व अंतर स्थानिक नमुना माहितीवरून मोजले आहे.' : 'Shows the selected Panchayat and its three nearest Panchayats in the same block, with direction, distance, and local terrain comparisons.'}
            </p>
          </div>
          <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">
            {isMr ? 'डेमो अंदाज · नमुना माहिती' : 'Demo estimate · sample data'}
          </span>
        </div>

        <article className="rounded-2xl border border-[#2F4638]/10 bg-[#F6F4EC] p-4 sm:p-5">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="flex-1 rounded-xl bg-[#2F4638] px-4 py-3 text-white sm:min-w-64">
              <div className="flex items-center gap-2 text-xs font-bold text-white/75">
                <CloudRain className="h-4 w-4 text-[#C9A14A]" />
                {isMr ? 'सर्व गावांसाठी समान तालुका अंदाज' : 'Shared Block Forecast'}
              </div>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{isMr ? selectedBlock.nameMr : selectedBlock.nameEn}</span>
                <span className="text-3xl font-black tabular-nums">{rainText(selectedBlock.imdRainfallMm)} <span className="text-base">mm</span></span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-white/70">
                {isMr ? 'नमुना इनपुट · थेट IMD जोडलेले नाही' : 'Sample input · live IMD feed not connected'}
              </p>
            </div>
            <div className="flex flex-col items-center text-center text-[#5A7852] sm:px-5">
              <ArrowRight className="h-6 w-6 rotate-90 sm:rotate-0" aria-hidden="true" />
              <span className="text-xs font-black">{isMr ? 'स्थानिक घटकांनुसार बदल' : 'Downscaling'}</span>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="text-xs font-black uppercase tracking-wide text-[#5A7852]">{isMr ? 'एक इनपुट → गावानुसार अंदाज' : 'One input → village-level estimates'}</div>
              <div className="mt-1 text-sm font-bold text-[#2F4638]">{isMr ? 'उंची · उतार · नदीचे अंतर · हिरवळ' : 'Elevation · slope · river distance · vegetation'}</div>
            </div>
          </div>
        </article>

        <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
          <article className="rounded-2xl border border-[#2F4638]/10 bg-[#F6F4EC] p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#2F4638]/75">
              <Compass className="h-4 w-4 text-[#5A7852]" />
              {isMr ? 'स्थानिक घटक · प्रत्येक गावासाठी' : 'Local factors · for each village'}
            </div>
            <div className="mt-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {comparisonVillages.map(({ panchayat: data, direction, distance }) => (
                <div key={data.id} className="rounded-xl border border-[#2F4638]/10 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 text-sm font-black text-[#2F4638]">{getVillageName(data)}</div>
                    <span className="shrink-0 rounded-full bg-[#E6E8DC] px-2 py-1 text-[10px] font-bold text-[#2F4638]">{direction}{distance > 0 ? ` · ${distance.toFixed(1)} km` : ''}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-[#2F4638]/75">
                    <span className="flex items-center gap-1"><Mountain className="h-3 w-3" />{isMr ? 'उंची' : 'Elevation'}</span><b className="text-right text-[#2F4638]">{data.elevationM} m</b>
                    <span>{isMr ? 'उतार / दिशा' : 'Slope / aspect'}</span><b className="text-right text-[#2F4638]">{data.slopeDeg}° · {data.aspect}</b>
                    <span className="flex items-center gap-1"><Waves className="h-3 w-3" />{isMr ? 'नदीपासून' : 'From river'}</span><b className="text-right text-[#2F4638]">{data.distanceToRiverKm} km</b>
                    <span className="flex items-center gap-1"><Leaf className="h-3 w-3" />NDVI</span><b className="text-right text-[#2F4638]">{data.ndvi.toFixed(2)}</b>
                    <span>{isMr ? 'माती' : 'Soil'}</span><b className="text-right text-[#2F4638]">{isMr ? data.soilTypeMr : data.soilTypeEn}</b>
                    <span>{isMr ? 'अंदाज' : 'Estimate'}</span><b className="text-right text-[#2F4638]">{rainText(comparisonVillages.find((item) => item.panchayat.id === data.id)?.estimate ?? 0)} mm</b>
                  </div>
                </div>
              ))}
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-[#2F4638]/60">
              {isMr ? 'डेमो सूत्रात उंची, उतार-दिशा, नदीचे अंतर आणि NDVI वापरले आहेत; गावांमधील अंतर किंवा शेजारच्या पावसाची नोंद वापरलेली नाही.' : 'The demo uses elevation, slope/aspect, river distance, and NDVI; it does not use distance between villages or neighboring rain readings.'}
            </p>
          </article>

          <article className="rounded-2xl border border-[#5A7852]/25 bg-[#E6E8DC] p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#2F4638]/75">
              <ArrowRight className="h-4 w-4 text-[#5A7852]" />
              {isMr ? 'पंचायत अंदाज · अंतिम परिणाम' : 'Panchayat forecasts · final estimates'}
            </div>
            {comparisonVillages.map((result) => (
              <div key={result.panchayat.id} className="mt-3 rounded-xl border border-emerald-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2 text-[11px] font-bold text-[#2F4638]/70"><span>{getVillageName(result.panchayat)}</span><span>{result.direction}{result.distance > 0 ? ` · ${result.distance.toFixed(1)} km` : ''}</span></div>
                  <div className="mt-1 text-[10px] font-semibold text-[#2F4638]/65">
                    {isMr ? 'स्थानिक बदल' : 'Terrain adjustment'}:{' '}
                    <span className="font-black text-[#5A7852]">
                      {result.estimate > selectedBlock.imdRainfallMm ? '+' : ''}
                      {selectedBlock.imdRainfallMm > 0
                        ? `${Math.round(((result.estimate - selectedBlock.imdRainfallMm) / selectedBlock.imdRainfallMm) * 100)}%`
                        : '—'}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#2F4638]/60">{isMr ? 'अंतिम अंदाज' : 'Final estimate'}</div>
                  <div className="text-3xl font-black tabular-nums text-[#5A7852]">{rainText(result.estimate)} <span className="text-base">mm</span></div>
                <div className="text-[10px] font-semibold text-[#2F4638]/65">
                  {result.estimate >= selectedBlock.imdRainfallMm ? '+' : ''}{rainText(result.estimate - selectedBlock.imdRainfallMm)} mm {isMr ? 'तालुका मूल्यापासून' : 'from block input'}
                </div>
              </div>
            ))}
          </article>
        </div>

      </section>

    </div>
  );
};
