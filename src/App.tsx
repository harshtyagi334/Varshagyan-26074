import React, { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { FarmerAdvisoryCard } from './components/FarmerAdvisoryCard';
import { TraditionalIntakeModal } from './components/TraditionalIntakeModal';
import { ScienceExplanation } from './components/ScienceExplanation';
import { DemoScriptModal } from './components/DemoScriptModal';
import { SevereWeatherToast } from './components/SevereWeatherToast';
import { FarmerFirstExperience } from './components/FarmerFirstExperience';
import { FarmerPanchayatAlert } from './components/FarmerPanchayatAlert';
import { PanchayatAlertComposer } from './components/PanchayatAlertComposer';
import { FarmerReport, Language, Panchayat, PanchayatAlert } from './types';
import { PANCHAYATS_DATA, NASHIK_BLOCKS } from './data/nashikGeoData';
import { INITIAL_FARMER_REPORTS } from './data/bioIndicatorsData';
import { calculateDownscaledWeather } from './ml/randomForestModel';
import { TRANSLATIONS } from './i18n/translations';
import { ArrowDown, Bug, CloudRain, FlaskConical, MapPin } from 'lucide-react';
import { playSpeech, stopAllSpeech } from './utils/audioSpeech';
import { fetchBlockForecast } from './services/openMeteo';
import { createDemoWeatherByBlock } from './data/demoWeatherScenario';

const PanchayatMap = lazy(() => import('./components/PanchayatMap').then((module) => ({ default: module.PanchayatMap })));

export default function App() {
  // 1. Language state: Marathi ('mr') by default, English ('en') toggle
  const [lang, setLang] = useState<Language>(() => {
    const savedLanguage = window.localStorage.getItem('varshagyan-language');
    return savedLanguage === 'en' || savedLanguage === 'mr' ? savedLanguage : 'mr';
  });
  
  // 2. Active Tab navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'intake' | 'science' | 'demo'>('dashboard');
  const [experience, setExperience] = useState<'farmer' | 'officials'>('farmer');
  // Keep the recording flow deterministic for now. Restore a user-facing live
  // toggle after the demo forecast and model path are ready for general use.
  const isDemoScenario = true;

  // 3. Selected Panchayat state (Default: Pimpalgaon Baswant in Niphad)
  const [selectedPanchayat, setSelectedPanchayat] = useState<Panchayat>(PANCHAYATS_DATA[0]);

  // 4. Crowdsourced Farmer Reports state
  const [farmerReports, setFarmerReports] = useState<FarmerReport[]>(INITIAL_FARMER_REPORTS);

  // 5. Intake Modal Visibility
  const [isIntakeOpen, setIsIntakeOpen] = useState<boolean>(false);

  // 6. Audio playback state for recent reports
  const [playingReportId, setPlayingReportId] = useState<string | null>(null);

  // 7. Severe weather simulation state (IMD Heavy Rain > 64.5mm)
  const [simulateSevereAlert, setSimulateSevereAlert] = useState<boolean>(false);
  const [panchayatAlert, setPanchayatAlert] = useState<PanchayatAlert | null>(null);
  const [forecastByBlock, setForecastByBlock] = useState<Record<string, import('./types').BlockData>>({});
  const [forecastState, setForecastState] = useState<'loading' | 'live' | 'fallback'>('loading');
  const [demoForecastByBlock] = useState(() => createDemoWeatherByBlock(NASHIK_BLOCKS));

  const t = TRANSLATIONS[lang];

  // The app provides its own translations; keep browser metadata in sync so
  // browser-level page translation cannot produce mixed-language screens.
  useEffect(() => {
    document.documentElement.lang = lang === 'mr' ? 'mr' : 'en';
  }, [lang]);

  // Lookup associated block data
  const selectedBlock = NASHIK_BLOCKS.find((b) => b.id === selectedPanchayat.blockId) || NASHIK_BLOCKS[0];

  useEffect(() => {
    const controller = new AbortController();
    setForecastState('loading');
    fetchBlockForecast(selectedBlock, controller.signal)
      .then((forecast) => {
        setForecastByBlock((current) => ({ ...current, [selectedBlock.id]: forecast }));
        setForecastState('live');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn('Open-Meteo forecast unavailable; retaining the labeled sample forecast.', error);
        setForecastState('fallback');
      });
    return () => controller.abort();
  }, [selectedBlock]);

  const forecastBlock = isDemoScenario
    ? (demoForecastByBlock[selectedBlock.id] || selectedBlock)
    : (forecastByBlock[selectedBlock.id] || selectedBlock);
  const isDemoForecast = isDemoScenario || forecastState !== 'live' || forecastBlock.isDemoForecast;
  const mapForecastByBlock = useMemo(() => isDemoScenario
    ? demoForecastByBlock
    : Object.fromEntries(NASHIK_BLOCKS.map((block) => [block.id, forecastByBlock[block.id] || block])),
  [demoForecastByBlock, forecastByBlock, isDemoScenario]);

  // Calculate live downscaled & calibrated results
  const downscalingResult = calculateDownscaledWeather(
    selectedPanchayat,
    forecastBlock,
    farmerReports
  );

  const HEAVY_RAIN_THRESHOLD_MM = 64.5;
  // Never show a simulated/demo value as a live farmer-facing severe weather alert.
  const isUrgent = !isDemoForecast && (simulateSevereAlert || downscalingResult.calibratedRainfall > HEAVY_RAIN_THRESHOLD_MM || forecastBlock.imdRainfallMm > HEAVY_RAIN_THRESHOLD_MM);

  const effectiveDownscalingResult = isUrgent
    ? {
        ...downscalingResult,
        calibratedRainfall: Math.max(downscalingResult.calibratedRainfall, 78.5),
        rainProbabilityPct: Math.max(downscalingResult.rainProbabilityPct, 98),
        calibratedHumidity: Math.max(downscalingResult.calibratedHumidity, 92),
      }
    : downscalingResult;

  const effectiveBlock = isUrgent
    ? {
        ...forecastBlock,
        imdRainfallMm: Math.max(forecastBlock.imdRainfallMm, 72.0),
      }
    : forecastBlock;

  const panchayatAdjustmentPct = forecastBlock.imdRainfallMm > 0
    ? Math.round(((effectiveDownscalingResult.calibratedRainfall - forecastBlock.imdRainfallMm) / forecastBlock.imdRainfallMm) * 100)
    : null;

  const handleAddReport = (newReport: FarmerReport) => {
    setFarmerReports((prev) => [newReport, ...prev]);
  };

  const toggleLanguage = () => {
    setLang((prev) => {
      const nextLanguage = prev === 'mr' ? 'en' : 'mr';
      window.localStorage.setItem('varshagyan-language', nextLanguage);
      return nextLanguage;
    });
  };


  const selectNearestPanchayat = (latitude: number, longitude: number): boolean => {
    const distanceKm = (point: Panchayat) => {
      const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
      const earthRadiusKm = 6371;
      const latDelta = toRadians(point.lat - latitude);
      const lngDelta = toRadians(point.lng - longitude);
      const a = Math.sin(latDelta / 2) ** 2
        + Math.cos(toRadians(latitude)) * Math.cos(toRadians(point.lat)) * Math.sin(lngDelta / 2) ** 2;
      return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const nearest = PANCHAYATS_DATA
      .map((panchayat) => ({ panchayat, distance: distanceKm(panchayat) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (!nearest || nearest.distance > 20) return false;
    setSelectedPanchayat(nearest.panchayat);
    return true;
  };

  const playingReportIdRef = useRef<string | null>(null);
  useEffect(() => {
    playingReportIdRef.current = playingReportId;
  }, [playingReportId]);

  const handleTogglePlayReportAudio = (report: FarmerReport) => {
    if (playingReportId === report.id) {
      stopAllSpeech();
      setPlayingReportId(null);
      return;
    }

    if (!('speechSynthesis' in window)) {
      alert(lang === 'mr' ? 'ऑडिओ सपोर्ट उपलब्ध नाही.' : 'Audio support not available in this browser.');
      return;
    }

    const textToSpeak = lang === 'mr'
      ? `${report.farmerNameMr} यांची व्हॉइस नोंद: ${report.notesMr}`
      : `${report.farmerNameEn} voice note: ${report.notesEn}`;

    setPlayingReportId(report.id);
    playSpeech({
      text: textToSpeak,
      lang,
      rate: 0.95,
      onStart: () => setPlayingReportId(report.id),
      onEnd: () => setPlayingReportId(null),
      onError: () => setPlayingReportId(null),
    });
  };

  // When language switches while report audio is playing, transfer language instantly
  useEffect(() => {
    if (playingReportIdRef.current) {
      const activeReport = farmerReports.find((r) => r.id === playingReportIdRef.current);
      if (activeReport) {
        stopAllSpeech();
        const textToSpeak = lang === 'mr'
          ? `${activeReport.farmerNameMr} यांची व्हॉइस नोंद: ${activeReport.notesMr}`
          : `${activeReport.farmerNameEn} voice note: ${activeReport.notesEn}`;
        
        playSpeech({
          text: textToSpeak,
          lang,
          rate: 0.95,
          onStart: () => setPlayingReportId(activeReport.id),
          onEnd: () => setPlayingReportId(null),
          onError: () => setPlayingReportId(null),
        });
      }
    }
  }, [lang, farmerReports]);

  return (
    <div className="min-h-[100dvh] min-w-0 w-full flex flex-col bg-[#F6F4EC] text-[#2F4638] overflow-x-clip font-marathi selection:bg-[#C9A14A]/30">
      
      {experience === 'farmer' ? (
        <>
          <FarmerFirstExperience
            lang={lang}
            onToggleLang={toggleLanguage}
            selectedPanchayat={selectedPanchayat}
            onLocationDetected={selectNearestPanchayat}
            downscalingResult={effectiveDownscalingResult}
            isDemoForecast={isDemoForecast}
            forecastState={forecastState}
            isDemoScenario={isDemoScenario}
            isUrgent={isUrgent}
            onOpenIntake={() => setIsIntakeOpen(true)}
            onOpenOfficials={() => setExperience('officials')}
          />
          <FarmerPanchayatAlert lang={lang} panchayatId={selectedPanchayat.id} alert={panchayatAlert} />
        </>
      ) : (
        <>
      <div className="bg-[#E6E8DC] px-3 py-2">
        <button type="button" onClick={() => setExperience('farmer')} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#2F4638] shadow-sm">
          {lang === 'mr' ? '← शेतकरी दृश्याकडे परत' : '← Back to Farmer View'}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#2F4638]/10 bg-amber-50 px-3 py-2 text-xs text-amber-950 sm:px-5">
        <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-bold">{lang === 'mr' ? 'डेमो परिस्थिती · नमुना हवामान मूल्ये' : 'Demo scenario · illustrative weather values'}</span>
      </div>
      {/* Official-facing navigation and technical workspace */}
      <Navbar
        lang={lang}
        onToggleLang={toggleLanguage}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedPanchayat={selectedPanchayat}
        onSelectPanchayat={setSelectedPanchayat}
        onOpenIntake={() => setIsIntakeOpen(true)}
        isUrgent={isUrgent}
      />

      {/* 3. Main Responsive Content Container with Split Viewport Matrix */}
      <main className="flex-1 min-w-0 w-full">
        
        {/* ========================================================================= */}
        {/* DASHBOARD VIEW: DEDICATED HYPERLOCAL FARMER AGRO-ADVISORY                 */}
        {/* ========================================================================= */}
        {activeTab === 'dashboard' && (
          <div className="w-full px-3 sm:px-5 lg:px-7 2xl:px-10 py-4 lg:py-6 space-y-5 lg:space-y-6">

            <section className="w-full rounded-3xl border border-[#2F4638]/10 bg-white p-4 sm:p-6 shadow-sm" aria-labelledby="dashboard-downscaling-title">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[#5A7852]">
                    {lang === 'mr' ? 'ब्लॉक ते ग्रामपंचायत' : 'Block to Panchayat'}
                  </p>
                  <h2 id="dashboard-downscaling-title" className="mt-1 text-xl font-black text-[#2F4638] sm:text-2xl">
                    {lang === 'mr' ? 'समान ब्लॉक अंदाज → स्थानिक पंचायत अंदाज' : 'Shared block forecast → local Panchayat estimate'}
                  </h2>
                </div>
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">
                  {lang === 'mr' ? 'डेमो · पडताळणी बाकी' : 'Demo · validation pending'}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                <div className="min-w-0 rounded-2xl bg-[#2F4638] p-4 text-white sm:p-5">
                  <div className="flex items-center gap-2 text-xs font-bold text-white/75">
                    <CloudRain className="h-4 w-4 text-[#C9A14A]" aria-hidden="true" />
                    {lang === 'mr' ? 'सर्व गावांसाठी समान ब्लॉक अंदाज' : 'Shared Block Forecast'}
                  </div>
                  <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-sm font-bold">{lang === 'mr' ? selectedBlock.nameMr : selectedBlock.nameEn}</span>
                    <span className="text-4xl font-black tabular-nums">{forecastBlock.imdRainfallMm.toFixed(1)} <span className="text-lg">mm</span></span>
                  </div>
                  <p className="mt-1 text-xs text-white/70">
                    {isDemoForecast
                      ? (isDemoScenario
                          ? (lang === 'mr' ? 'नमुना डेमो परिस्थिती · प्रत्यक्ष अंदाज नाही' : 'Illustrative demo scenario · not a live forecast')
                          : (lang === 'mr' ? 'नमुना मूल्य · अंदाज सेवा उपलब्ध नाही' : 'Illustrative sample · live feed unavailable'))
                      : (lang === 'mr' ? `Open-Meteo ब्लॉक इनपुट · ${forecastBlock.imdForecastDate} · CC BY 4.0` : `Open-Meteo block input · ${forecastBlock.imdForecastDate} · CC BY 4.0`)}
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 px-2 text-center font-black text-[#5A7852] md:flex-col md:px-4">
                  <ArrowDown className="h-6 w-6 md:rotate-[-90deg]" aria-hidden="true" />
                  <span className="text-xs">{lang === 'mr' ? 'डाउनस्केलिंग' : 'Downscaling'}</span>
                </div>

                <div className="min-w-0 rounded-2xl border-2 border-[#5A7852]/30 bg-[#E6E8DC] p-4 sm:p-5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#2F4638]/75">
                    <MapPin className="h-4 w-4 text-[#5A7852]" aria-hidden="true" />
                    {lang === 'mr' ? 'ग्रामपंचायत अंदाज' : 'Downscaled Panchayat Estimate'}
                  </div>
                  <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
                    <span className="min-w-0 text-sm font-black text-[#2F4638]">{lang === 'mr' ? selectedPanchayat.nameMr : selectedPanchayat.nameEn}</span>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-black tabular-nums text-[#5A7852]">
                      {panchayatAdjustmentPct === null ? '—' : `${panchayatAdjustmentPct > 0 ? '+' : ''}${panchayatAdjustmentPct}%`}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-xs font-semibold text-[#2F4638]/70">{lang === 'mr' ? 'अंतिम अंदाज · स्थानिक बदल' : 'Estimate · terrain adjustment'}</span>
                    <span className="text-4xl font-black tabular-nums text-[#2F4638]">{effectiveDownscalingResult.calibratedRainfall.toFixed(1)} <span className="text-lg">mm</span></span>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-[#2F4638]/65">
                    {lang === 'mr' ? 'उदाहरणासाठीचे स्थानिक भूभाग घटक; पडताळलेला अंदाज नाही.' : 'Illustrative local terrain factors; this is not a validated forecast.'}
                  </p>
                </div>
              </div>
            </section>
            
            {/* Complete Dedicated Farmer Advisory Engine */}
            <FarmerAdvisoryCard
              lang={lang}
              selectedPanchayat={selectedPanchayat}
              selectedBlock={effectiveBlock}
              downscalingResult={effectiveDownscalingResult}
              farmerReports={farmerReports}
              onOpenIntake={() => setIsIntakeOpen(true)}
              isUrgent={isUrgent}
              onToggleSimulateAlert={(val) => setSimulateSevereAlert(val)}
            />

            {/* Crowdsourced Bio-Indicator & Voice Note Stream (Traditional Layer) */}
            <section className="bg-[#E6E8DC] rounded-3xl p-4 sm:p-6 border border-gray-300/40 shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-300/30 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-[#5A7852]/20 text-[#5A7852] flex items-center justify-center text-lg">
                    🐜
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-[#2F4638]">
                      {t.recentReportsTitle}
                    </h3>
                    <p className="text-xs text-[#2F4638]/70">
                      {lang === 'mr' ? 'परिसरातील शेतकऱ्यांची व्हॉइस व पारंपारिक निरीक्षणे' : 'Farmer crowdsourced bio-indicator signals'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsIntakeOpen(true)}
                  className="bg-[#5A7852] hover:bg-[#466849] text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <span>+ {lang === 'mr' ? 'नोंदणी करा' : 'Add Observation'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
                {farmerReports.slice(0, 4).map((report) => {
                  const panchayatObj = PANCHAYATS_DATA.find((p) => p.id === report.panchayatId);
                  const isThisPlaying = playingReportId === report.id;

                  return (
                    <div
                      key={report.id}
                      className="bg-[#F6F4EC] p-3.5 rounded-2xl border border-gray-300/40 text-xs space-y-2 flex flex-col justify-between hover:border-[#5A7852]/50 transition shadow-2xs"
                    >
                      <div>
                        <div className="flex justify-between items-center font-bold text-[#2F4638] mb-1">
                          <span className="flex items-center gap-1.5">
                            <span>{lang === 'mr' ? report.farmerNameMr : report.farmerNameEn}</span>
                            {report.hasAudio && (
                              <span className="bg-[#5A7852]/20 text-[#5A7852] text-[10px] font-bold px-1.5 py-0.2 rounded">
                                🎙️
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-gray-500 font-normal">
                            {lang === 'mr' ? report.timeAgoMr : report.timeAgoEn}
                          </span>
                        </div>

                        <div className="text-[11px] text-[#5A7852] font-bold mb-1">
                          📍 {panchayatObj ? (lang === 'mr' ? panchayatObj.nameMr : panchayatObj.nameEn) : report.panchayatId}
                        </div>

                        <p className="text-[#2F4638] text-[11px] leading-relaxed bg-[#E6E8DC] p-2 rounded-xl border border-gray-300/30 italic">
                          "{lang === 'mr' ? report.notesMr : report.notesEn}"
                        </p>
                      </div>

                      <div className="pt-2 flex items-center justify-between gap-2 border-t border-gray-300/30">
                        <button
                          type="button"
                          onClick={() => handleTogglePlayReportAudio(report)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition shadow-2xs cursor-pointer ${
                            isThisPlaying
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                              : 'bg-[#5A7852]/15 hover:bg-[#5A7852]/25 text-[#5A7852] border border-[#5A7852]/30'
                          }`}
                        >
                          <span>{isThisPlaying ? '⏸️' : '🎙️ ▶️'}</span>
                          <span>
                            {isThisPlaying
                              ? (lang === 'mr' ? 'थांबवा' : 'Pause')
                              : (lang === 'mr' ? 'ऐका' : 'Play Note')}
                          </span>
                        </button>

                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

          </div>
        )}

        {/* ========================================================================= */}
        {/* FULLSCREEN MAP STUDIO TAB                                                 */}
        {/* ========================================================================= */}
        {activeTab === 'map' && (
          <div className="w-full px-3 sm:px-5 lg:px-7 2xl:px-10 py-4">
            <PanchayatAlertComposer
              lang={lang}
              panchayat={selectedPanchayat}
              activeAlert={panchayatAlert}
              onPublish={(message, sourceLanguage, severity) => setPanchayatAlert({
                id: `${Date.now()}`,
                panchayatId: selectedPanchayat.id,
                message,
                sourceLanguage,
                severity,
                sentAt: new Date().toISOString(),
              })}
              onClear={() => setPanchayatAlert(null)}
            />
            <Suspense fallback={<div className="min-h-[320px] rounded-2xl bg-[#E6E8DC] animate-pulse" role="status" aria-live="polite">{lang === 'mr' ? 'नकाशा लोड होत आहे…' : 'Loading map…'}</div>}>
              <PanchayatMap
                lang={lang}
                selectedPanchayat={selectedPanchayat}
                onSelectPanchayat={setSelectedPanchayat}
                farmerReports={farmerReports}
                forecastByBlock={mapForecastByBlock}
                onOpenIntake={() => setIsIntakeOpen(true)}
              />
            </Suspense>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BIO-INDICATOR INTAKE TAB (Traditional Layer: Muted Terracotta Clay)        */}
        {/* ========================================================================= */}
        {activeTab === 'intake' && (
          <div className="py-6 w-full px-3 sm:px-5 lg:px-7 2xl:px-10">
            <div className="w-full bg-gradient-to-r from-[#5A7852] via-[#466849] to-[#205C41] text-white p-6 sm:p-8 rounded-3xl shadow-lg text-center border-2 border-white/20">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto text-3xl mb-3 shadow-inner">
                🐜
              </div>
              <h2 className="text-2xl sm:text-3xl font-black mb-2">
                {lang === 'mr' ? 'पारंपारिक हवामान संकेत व व्हॉइस नोंदणी' : 'Bio-Indicator & Voice Observation Intake'}
              </h2>
              <p className="text-sm text-white/95 max-w-lg mx-auto">
                {lang === 'mr'
                  ? 'टायपिंगचा त्रास नको! मुंग्या, बेडूक, पक्षी किंवा ढगांचे निरीक्षण चित्रावर स्पर्श करून किंवा थेट माईकमध्ये बोलून सांगा.'
                  : 'No need to type! Report ant movement, frog croaks, or dark clouds by tapping pictures or speaking directly into the mic.'}
              </p>

              {/* Dual Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsIntakeOpen(true)}
                  className="bg-[#C9A14A] hover:bg-[#B88A36] active:scale-95 text-[#2F4638] font-black text-xs sm:text-sm px-6 py-3.5 rounded-2xl shadow transition cursor-pointer"
                >
                  {lang === 'mr' ? '📋 फॉर्म उघडा (Open Intake)' : '📋 Open Intake Form'}
                </button>

                <button
                  type="button"
                  onClick={() => setIsIntakeOpen(true)}
                  className="bg-[#F6F4EC] hover:bg-white active:scale-95 text-[#5A7852] font-black text-xs sm:text-sm px-6 py-3.5 rounded-2xl shadow transition cursor-pointer flex items-center gap-2 border border-white/40"
                >
                  <span className="text-base">🎙️</span>
                  <span>{lang === 'mr' ? 'आवाजात बोला (Speak Voice Note)' : 'Record Voice Observation'}</span>
                </button>
              </div>
            </div>

            {/* Reports Stream */}
            <div className="mt-8 bg-[#E6E8DC] rounded-3xl p-4 sm:p-6 border border-gray-300/40 shadow-sm">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="font-bold text-base text-[#2F4638] flex items-center gap-2">
                  <Bug className="w-5 h-5 text-[#5A7852]" />
                  <span>{t.recentReportsTitle}</span>
                </h3>
                <span className="text-xs font-semibold text-[#5A7852] bg-[#5A7852]/15 px-2.5 py-1 rounded-full border border-[#5A7852]/30">
                  🎙️ {lang === 'mr' ? 'व्हॉइस ऑडिओ उपलब्ध' : 'Voice Audio Enabled'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {farmerReports.map((report) => {
                  const panchayatObj = PANCHAYATS_DATA.find((p) => p.id === report.panchayatId);
                  const isThisPlaying = playingReportId === report.id;

                  return (
                    <div
                      key={report.id}
                      className="bg-[#F6F4EC] p-4 rounded-2xl border border-gray-300/40 text-xs space-y-2 flex flex-col justify-between hover:border-[#5A7852]/50 transition"
                    >
                      <div>
                        <div className="flex justify-between items-center font-bold text-[#2F4638] mb-1">
                          <span className="flex items-center gap-1.5">
                            <span>{lang === 'mr' ? report.farmerNameMr : report.farmerNameEn}</span>
                            {report.hasAudio && (
                              <span className="bg-[#5A7852]/20 text-[#5A7852] text-[10px] font-bold px-1.5 py-0.2 rounded">
                                🎙️
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-gray-500 font-normal">
                            {lang === 'mr' ? report.timeAgoMr : report.timeAgoEn}
                          </span>
                        </div>
                        
                        <div className="text-[11px] text-[#5A7852] font-bold mb-1.5">
                          📍 {panchayatObj ? (lang === 'mr' ? panchayatObj.nameMr : panchayatObj.nameEn) : report.panchayatId}
                        </div>

                        <p className="text-[#2F4638] text-[11px] leading-relaxed bg-[#E6E8DC] p-2.5 rounded-xl border border-gray-300/30">
                          "{lang === 'mr' ? report.notesMr : report.notesEn}"
                        </p>
                      </div>

                      <div className="pt-2 flex items-center justify-between gap-2 border-t border-gray-300/30">
                        <button
                          type="button"
                          onClick={() => handleTogglePlayReportAudio(report)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition shadow-2xs cursor-pointer ${
                            isThisPlaying
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                              : 'bg-[#5A7852]/15 hover:bg-[#5A7852]/25 text-[#5A7852] border border-[#5A7852]/30'
                          }`}
                        >
                          <span>{isThisPlaying ? '⏸️' : '🎙️ ▶️'}</span>
                          <span>
                            {isThisPlaying
                              ? (lang === 'mr' ? 'थांबवा (Pause)' : 'Pause')
                              : (lang === 'mr'
                                  ? `व्हॉइस ऐका (${report.audioDurationSec || 6}s)`
                                  : `Play Voice Note (${report.audioDurationSec || 6}s)`)}
                          </span>
                        </button>

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SCIENCE & METHODOLOGY TAB                                                 */}
        {/* ========================================================================= */}
        {activeTab === 'science' && (
          <ScienceExplanation
            lang={lang}
            selectedPanchayat={selectedPanchayat}
            selectedBlock={forecastBlock}
            farmerReports={farmerReports}
          />
        )}

        {/* ========================================================================= */}
        {/* DEMO GUIDE TAB                                                            */}
        {/* ========================================================================= */}
        {activeTab === 'demo' && (
          <DemoScriptModal
            lang={lang}
            onSetLang={setLang}
            setActiveTab={setActiveTab}
            onSelectPanchayat={setSelectedPanchayat}
            onOpenIntake={() => setIsIntakeOpen(true)}
            simulateSevereAlert={simulateSevereAlert}
            onToggleSimulateAlert={setSimulateSevereAlert}
          />
        )}
      </main>

      {/* Footer in Deep Monsoon Slate Indigo */}
      <footer className="bg-[#2F4638] text-white/80 text-xs py-6 border-t border-[#263A31] mt-8 w-full">
        <div className="w-full px-4 sm:px-5 lg:px-7 2xl:px-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="font-black text-white text-sm">
                {lang === 'mr' ? 'वर्षा ज्ञान (VarshaGyan)' : 'VarshaGyan'}
              </span>
              <span className="bg-[#5A7852] text-white px-2 py-0.5 rounded text-[10px] font-bold">
                {lang === 'mr' ? 'ग्रामपंचायत मॉडेल' : 'GP Weather Model'}
              </span>
            </div>
            <p className="text-white/70 text-[11px]">
              {lang === 'mr'
                ? 'ग्रामपंचायत पातळी हवामान डाऊनस्केलिंग व कृषी सल्लागार प्रणाली'
                : 'Hyperlocal Agro-Meteorological Advisory & Gram Panchayat Downscaling System'}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-white/80">
            <button onClick={() => setActiveTab('science')} className="hover:text-white underline cursor-pointer">
              {lang === 'mr' ? 'पद्धती व मॉडेल' : 'Methodology & Science'}
            </button>
            <span>•</span>
            <button onClick={toggleLanguage} className="text-[#C9A14A] font-bold hover:underline cursor-pointer">
              {t.switchLang}
            </button>
          </div>
        </div>
      </footer>

      {/* Severe Weather Warning Toast Notification System */}
      <SevereWeatherToast
        isUrgent={isUrgent}
        lang={lang}
        selectedPanchayat={selectedPanchayat}
        calibratedRainfall={effectiveDownscalingResult.calibratedRainfall}
      />
        </>
      )}

      {/* Shared report form must remain mounted in farmer and officials experiences. */}
      <TraditionalIntakeModal
        isOpen={isIntakeOpen}
        onClose={() => setIsIntakeOpen(false)}
        lang={lang}
        selectedPanchayat={selectedPanchayat}
        onAddReport={handleAddReport}
        recentReports={farmerReports}
      />

    </div>
  );
}
