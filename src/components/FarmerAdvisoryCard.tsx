import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Share2, MessageSquare, AlertTriangle, CheckCircle2, Droplet, Sparkles, Sprout, ShieldAlert, PackageCheck, AlertOctagon, Settings2, ChevronDown, ChevronUp, Cpu, BarChart3 } from 'lucide-react';
import { BlockData, CropAdvisory, DownscalingResult, FarmerReport, Language, Panchayat } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { generateCropAdvisories } from '../ml/randomForestModel';
import { ConfidenceBadge } from './ConfidenceBadge';
import { ExplainabilityPanel } from './ExplainabilityPanel';
import { OfflineAlertChannel } from './OfflineAlertChannel';
import { HistoricalTrendView } from './HistoricalTrendView';
import { ThreeDayOutlookStrip } from './ThreeDayOutlookStrip';
import { NASHIK_BLOCKS } from '../data/nashikGeoData';
import { CROPS_WITH_STAGES, generateCropAdvisory, loadFarmerProfile, saveFarmerProfile, FarmerProfileSettings } from '../data/cropStageData';
import { playSpeech, stopAllSpeech } from '../utils/audioSpeech';

interface FarmerAdvisoryCardProps {
  lang: Language;
  selectedPanchayat: Panchayat;
  selectedBlock?: BlockData;
  downscalingResult: DownscalingResult;
  farmerReports?: FarmerReport[];
  onOpenIntake: () => void;
  isUrgent?: boolean;
  onToggleSimulateAlert?: (simulate: boolean) => void;
}

export const FarmerAdvisoryCard: React.FC<FarmerAdvisoryCardProps> = ({
  lang,
  selectedPanchayat,
  selectedBlock,
  downscalingResult,
  farmerReports = [],
  onOpenIntake,
  isUrgent: isUrgentProp,
  onToggleSimulateAlert,
}) => {
  const t = TRANSLATIONS[lang];
  const effectiveBlock = selectedBlock || NASHIK_BLOCKS.find((b) => b.id === selectedPanchayat.blockId) || NASHIK_BLOCKS[0];
  const activeReports = farmerReports.filter((r) => r.panchayatId === selectedPanchayat.id && !r.isDemoData);
  
  // Severe-Weather IMD Official Threshold
  const HEAVY_RAIN_THRESHOLD_MM = 64.5; // IMD official "Heavy Rain" classification (64.5mm - 115.5mm / 24 hrs)
  const [localSimulateSevereAlert, setLocalSimulateSevereAlert] = useState<boolean>(false);
  const isUrgent = isUrgentProp !== undefined
    ? isUrgentProp
    : (downscalingResult.calibratedRainfall > HEAVY_RAIN_THRESHOLD_MM || effectiveBlock.imdRainfallMm > HEAVY_RAIN_THRESHOLD_MM || localSimulateSevereAlert);

  const handleSetSimulate = (val: boolean) => {
    setLocalSimulateSevereAlert(val);
    onToggleSimulateAlert?.(val);
  };
  const setSimulateSevereAlert = handleSetSimulate;

  // High-intensity calibrated values under severe alert to prevent contradictory states
  const effectiveDownscalingResult: DownscalingResult = isUrgent
    ? {
        ...downscalingResult,
        calibratedRainfall: Math.max(downscalingResult.calibratedRainfall, 78.5),
        rainProbabilityPct: Math.max(downscalingResult.rainProbabilityPct, 95),
        calibratedHumidity: Math.max(downscalingResult.calibratedHumidity, 92),
      }
    : downscalingResult;

  // Farmer crop + growth-stage profile (persisted in localStorage)
  const [farmerProfile, setFarmerProfile] = useState<FarmerProfileSettings>(loadFarmerProfile);

  // Online / Offline PWA cache detector
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Active crop selection (defaults to saved profile crop or 'onion')
  const [selectedCropId, setSelectedCropId] = useState<string>(farmerProfile.cropType || 'onion');
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [showSmsModal, setShowSmsModal] = useState<boolean>(false);
  const [copiedSms, setCopiedSms] = useState<boolean>(false);

  // Section 4: Collapsible Technical Backtest Accordion (Default: false / hidden)
  const [showTechnicalBacktest, setShowTechnicalBacktest] = useState<boolean>(false);

  const advisories = generateCropAdvisories(downscalingResult, selectedPanchayat);
  const activeAdvisory = advisories.find((a) => a.cropId === selectedCropId) || advisories[0];

  // Evaluate rule-based crop-and-stage specific risk advisory
  const currentCropType = farmerProfile.cropType || selectedCropId;
  const currentGrowthStage = farmerProfile.growthStage || 'near_harvest';
  const cropSpecificRule = generateCropAdvisory(currentCropType, currentGrowthStage, downscalingResult.calibratedRainfall);
  const hasRiskAdvisory = Boolean(cropSpecificRule);

  const currentCropObj = CROPS_WITH_STAGES.find((c) => c.id === currentCropType) || CROPS_WITH_STAGES[0];
  const currentStageObj = currentCropObj.growthStages.find((s) => s.id === currentGrowthStage) || currentCropObj.growthStages[0];

  // Plain-Language Action Headline Generator (in simple Marathi & English)
  const getAdvisoryHeadline = () => {
    if (isUrgent) {
      return lang === 'mr'
        ? `🚨 तातडीचा इशारा: ${selectedPanchayat.nameMr} भागात ६४.५ मिमी पेक्षा जास्त मुसळधार पावसाची शक्यता — सर्व शेतमाल सुरक्षित शेडमध्ये झाका!`
        : `🚨 URGENT ALERT: Heavy rain is forecast in ${selectedPanchayat.nameEn} — Move all harvested produce to covered shelters!`;
    }

    if (cropSpecificRule) {
      return lang === 'mr' ? cropSpecificRule.mr : cropSpecificRule.en;
    }

    const rain = downscalingResult.calibratedRainfall;
    if (lang === 'mr') {
      if (rain >= 10.0) {
        return `⚠️ सावधगिरी: ${selectedPanchayat.nameMr} भागात आज मुसळधार पावसाची शक्यता (${rain} मिमी) — सर्व सिंचन बंद ठेवा व फवारणी पुढे ढकला!`;
      } else if (rain >= 4.0) {
        return `🌧️ आज संध्याकाळी मध्यम पाऊस शक्य (${rain} मिमी) — ठिबक सिंचन थांबवा व काढलेला माल सुरक्षित शेडमध्ये झाका.`;
      } else if (rain >= 1.0) {
        return `🌦️ आज दुपारनंतर हलकी पावसाची सर शक्य (${rain} मिमी) — सिंचन ३०% कमी करा, फवारणी सकाळच्या वेळेत उरका.`;
      } else {
        return `☀️ हवामान कोरडे राहण्याचा अंदाज (${rain} मिमी) — वेळापत्रकानुसार नियमित सिंचन व पीक मशागत सुरू ठेवा.`;
      }
    } else {
      if (rain >= 10.0) {
        return `⚠️ Alert: Heavy rainfall predicted in ${selectedPanchayat.nameEn} (${rain} mm) — Suspend irrigation & avoid spraying!`;
      } else if (rain >= 4.0) {
        return `🌧️ Moderate rain expected this evening (${rain} mm) — Halt drip irrigation and move harvested produce to cover.`;
      } else if (rain >= 1.0) {
        return `🌦️ Light showers likely this evening (${rain} mm) — Safe to delay irrigation; complete sprays early morning.`;
      } else {
        return `☀️ Dry weather expected (${rain} mm) — Continue routine irrigation and crop maintenance schedule.`;
      }
    }
  };

  const advisoryHeadline = getAdvisoryHeadline();

  // One-tap crop selection handler
  const handleSelectCrop = (cropId: string) => {
    setSelectedCropId(cropId);
    const cropObj = CROPS_WITH_STAGES.find((c) => c.id === cropId);
    const firstStage = cropObj?.growthStages[0]?.id || 'near_harvest';
    const updated: FarmerProfileSettings = {
      ...farmerProfile,
      cropType: cropId,
      growthStage: cropObj?.growthStages.some((s) => s.id === farmerProfile.growthStage)
        ? farmerProfile.growthStage
        : firstStage,
      isConfigured: true,
    };
    setFarmerProfile(updated);
    saveFarmerProfile(updated);
  };

  // One-tap growth stage handler
  const handleSelectStage = (stageId: string) => {
    const updated: FarmerProfileSettings = {
      ...farmerProfile,
      growthStage: stageId,
      isConfigured: true,
    };
    setFarmerProfile(updated);
    saveFarmerProfile(updated);
  };

  // Helper to construct natural speech advisory in Marathi or English
  const getAdvisoryAudioText = (targetLang: Language) => {
    const isTargetMr = targetLang === 'mr';
    const villageName = isTargetMr ? selectedPanchayat.nameMr : selectedPanchayat.nameEn;
    const blockName = isTargetMr ? effectiveBlock.nameMr : effectiveBlock.nameEn;
    
    // Pick appropriate language headline
    let headlineText = '';
    if (isUrgent) {
      headlineText = isTargetMr
        ? `तातडीचा इशारा! ${villageName} भागात ६४.५ मिमी पेक्षा जास्त मुसळधार पावसाची शक्यता आहे. सर्व काढलेला शेतमाल तात्काळ सुरक्षित शेडमध्ये झाका!`
        : `URGENT ALERT! Heavy rain forecast in ${villageName}. Move all harvested produce to covered shelters immediately!`;
    } else if (cropSpecificRule) {
      headlineText = isTargetMr ? cropSpecificRule.mr : cropSpecificRule.en;
    } else {
      const rain = effectiveDownscalingResult.calibratedRainfall;
      if (isTargetMr) {
        headlineText = rain >= 10.0
          ? `सावधगिरी: ${villageName} भागात आज मुसळधार पावसाची शक्यता (${rain} मिमी) आहे. सर्व सिंचन बंद ठेवा व फवारणी पुढे ढकला!`
          : rain >= 4.0
          ? `आज संध्याकाळी मध्यम पाऊस शक्य (${rain} मिमी). ठिबक सिंचन थांबवा व काढलेला माल सुरक्षित शेडमध्ये झाका.`
          : rain >= 1.0
          ? `आज दुपारनंतर हलकी पावसाची सर शक्य (${rain} मिमी). सिंचन ३० टक्के कमी करा, फवारणी सकाळच्या वेळेत उरका.`
          : `हवामान कोरडे राहण्याचा अंदाज (${rain} मिमी). वेळापत्रकानुसार नियमित सिंचन व पीक मशागत सुरू ठेवा.`;
      } else {
        headlineText = rain >= 10.0
          ? `Alert: Heavy rainfall predicted in ${villageName} (${rain} mm). Suspend irrigation and postpone spraying!`
          : rain >= 4.0
          ? `Moderate rain expected this evening (${rain} mm). Halt drip irrigation and move harvested produce to cover.`
          : rain >= 1.0
          ? `Light showers likely this evening (${rain} mm). Safe to delay irrigation; complete sprays early morning.`
          : `Dry weather expected (${rain} mm). Continue routine irrigation and crop maintenance schedule.`;
      }
    }

    const irrigation = isTargetMr ? activeAdvisory.irrigationAdviceMr : activeAdvisory.irrigationAdviceEn;
    const spraying = isTargetMr ? activeAdvisory.sprayingAdviceMr : activeAdvisory.sprayingAdviceEn;
    const harvest = isTargetMr ? activeAdvisory.harvestAdviceMr : activeAdvisory.harvestAdviceEn;

    return isTargetMr
      ? `नमस्कार शेतकरी बंधूंनो. वर्षा ज्ञान कृषी हवामान सल्ला, ग्रामपंचायत ${villageName}, तालुका ${blockName}. ${headlineText}. सिंचन सल्ला: ${irrigation}. फवारणी सल्ला: ${spraying}. पीक साठवणूक: ${harvest}. धन्यवाद.`
      : `VarshaGyan agro-weather advisory for ${villageName} Gram Panchayat, ${blockName} Block. ${headlineText}. Irrigation advisory: ${irrigation}. Spraying advice: ${spraying}. Harvest advisory: ${harvest}. Thank you.`;
  };

  const isPlayingAudioRef = useRef<boolean>(false);
  useEffect(() => {
    isPlayingAudioRef.current = isPlayingAudio;
  }, [isPlayingAudio]);

  // Web Speech Audio narration
  const handleToggleSpeech = () => {
    if (isPlayingAudio) {
      stopAllSpeech();
      setIsPlayingAudio(false);
      return;
    }

    if (!('speechSynthesis' in window)) {
      alert(lang === 'mr' ? 'तुमच्या ब्राउझरमध्ये ऑडिओ सपोर्ट उपलब्ध नाही.' : 'Speech synthesis not supported in this browser.');
      return;
    }

    const textToSpeak = getAdvisoryAudioText(lang);
    setIsPlayingAudio(true);
    playSpeech({
      text: textToSpeak,
      lang,
      rate: 0.92,
      onStart: () => setIsPlayingAudio(true),
      onEnd: () => setIsPlayingAudio(false),
      onError: () => setIsPlayingAudio(false),
    });
  };

  // Seamless transfer: when language changes while audio is playing, switch language immediately!
  useEffect(() => {
    if (isPlayingAudioRef.current) {
      stopAllSpeech();
      const textToSpeak = getAdvisoryAudioText(lang);
      playSpeech({
        text: textToSpeak,
        lang,
        rate: 0.92,
        onStart: () => setIsPlayingAudio(true),
        onEnd: () => setIsPlayingAudio(false),
        onError: () => setIsPlayingAudio(false),
      });
    }
  }, [lang]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopAllSpeech();
    };
  }, []);

  const getShareText = () => {
    const alertPrefix = isUrgent ? `🚨 *[${t.urgent_alert_tag} - IMD >64.5mm]*\n` : '';
    return `${alertPrefix}*वर्षा ज्ञान (VarshaGyan) - कृषी हवामान सल्ला*\n📍 *ग्रामपंचायत:* ${selectedPanchayat.nameMr} (${selectedPanchayat.blockNameMr})\n🌧️ *नमुना पाऊस अंदाज:* ${downscalingResult.calibratedRainfall} mm (${downscalingResult.rainProbabilityPct}% नमुना शक्यता)\n\n📌 *सामान्य हवामान मार्गदर्शन:* ${advisoryHeadline}\n\n💧 *सिंचन:* ${activeAdvisory.irrigationAdviceMr}\n🛡️ *फवारणी:* ${activeAdvisory.sprayingAdviceMr}\n📦 *साठवणूक:* ${activeAdvisory.harvestAdviceMr}\n\n(स्रोत: वर्षा ज्ञान प्रोटोटाइप; हा अधिकृत किंवा पडताळलेला अंदाज नाही.)`;
  };

  const handleWhatsAppShare = () => {
    const encoded = encodeURIComponent(getShareText());
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handleShareViaSmsOrNative = async () => {
    const textToShare = getShareText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: lang === 'mr' ? 'वर्षा ज्ञान कृषी सल्ला' : 'VarshaGyan Agro Advisory',
          text: textToShare,
        });
        return;
      } catch (err) {
        // user cancelled or failed, fallback to sms: or modal
      }
    }

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `sms:?body=${encodeURIComponent(textToShare)}`;
    } else {
      setShowSmsModal(true);
    }
  };

  return (
    <div className="w-full space-y-5">
      
      {/* Keep the emergency control visible only when it is actionable. */}
      {isUrgent && (
        /* STRICT CRIMSON WARNING RED BANNER (#B6413A) EXCLUSIVELY FOR HEAVY RAIN ALERT */
        <div className="bg-[#B6413A] text-white rounded-3xl p-5 sm:p-7 shadow-2xl border-4 border-red-900 ring-4 ring-red-400/50 relative overflow-hidden transition-all duration-300 animate-pulse">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white/20 border-2 border-white/50 flex items-center justify-center shrink-0 shadow-inner">
                <span className="text-5xl sm:text-6xl drop-shadow-md select-none leading-none">🚨</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <span className="bg-white text-[#B6413A] text-xs font-black px-3 py-0.5 rounded-full uppercase tracking-wider shadow-xs animate-bounce">
                    {t.danger_badge} • DANGER
                  </span>
                  {!isOnline && (
                    <span className="bg-red-950 text-amber-300 text-xs font-black px-3 py-0.5 rounded-full uppercase tracking-wider shadow-xs flex items-center gap-1 border border-amber-400 animate-pulse" title="Serving from PWA local cache — last saved forecast">
                      🗄️ {lang === 'mr' ? 'ऑफलाइन कॅशे अंदाज' : 'PWA Cache Active'}
                    </span>
                  )}
                  <span className="bg-red-950/60 text-white text-xs font-mono px-2.5 py-0.5 rounded-full font-bold">
                    {lang === 'mr' ? 'मुसळधार पाऊस' : 'Heavy rain warning'}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-snug">
                  {lang === 'mr'
                    ? `🚨 सावधान! ${selectedPanchayat.nameMr} भागात अतिमुसळधार पाऊस इशारा!`
                    : `🚨 SEVERE WEATHER DANGER in ${selectedPanchayat.nameEn}!`}
                </h2>
                <p className="text-sm text-white/95 max-w-2xl font-bold">
                  {lang === 'mr'
                    ? 'काढलेला कांदा, द्राक्ष व टोमॅटो माल त्वरित सुरक्षित शेडमध्ये झाका! सर्व सिंचन व रासायनिक फवारण्या तात्काळ बंद करा.'
                    : 'Move harvested onions, grapes, and tomatoes to covered sheds immediately! Halt all irrigation and chemical sprays.'}
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 text-xs font-black text-white flex-wrap">
                  <span className="bg-red-950/70 border border-white/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                    🛑 {lang === 'mr' ? 'सिंचन पूर्ण बंद' : 'Stop Irrigation'}
                  </span>
                  <span className="bg-red-950/70 border border-white/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                    ❌ {lang === 'mr' ? 'फवारणी तात्काळ रद्द' : 'Cancel Sprays'}
                  </span>
                  <span className="bg-red-950/70 border border-white/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                    ⛺ {lang === 'mr' ? 'माल शेडमध्ये झाका' : 'Cover Harvest'}
                  </span>
                </div>
              </div>
            </div>

            <div className="shrink-0 self-center md:self-center">
              <button
                type="button"
                onClick={() => setSimulateSevereAlert(false)}
                className="bg-white text-[#B6413A] hover:bg-gray-100 text-xs font-black px-4 py-2.5 rounded-2xl shadow-lg transition active:scale-95 flex items-center gap-2 border-2 border-white cursor-pointer"
              >
                <span>✅</span>
                <span>{t.stop_alert_btn}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN ACTIONABLE ADVISORY HEADLINE BANNER                                  */}
      {/* ========================================================================= */}
      <div className={`rounded-3xl p-4 sm:p-6 border shadow-sm relative overflow-hidden transition-all duration-300 ${
        isUrgent || hasRiskAdvisory
          ? 'bg-red-50 border-2 border-[#B6413A] ring-2 ring-red-200'
          : 'bg-[#E6E8DC] border-2 border-[#C9A14A]/50'
      }`}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_19rem] gap-5 items-center">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`${
                isUrgent || hasRiskAdvisory ? 'bg-[#B6413A] text-white' : 'bg-[#C9A14A] text-[#2F4638]'
              } font-bold text-xs uppercase px-2.5 py-0.5 rounded-md tracking-wide flex items-center gap-1 shadow-sm`}>
                <Sparkles className="w-3.5 h-3.5" />
                {isUrgent ? (lang === 'mr' ? '🚨 तातडीचा सल्ला' : '🚨 Emergency advice') : (lang === 'mr' ? 'आजचा सल्ला' : "Today's advice")}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                isUrgent || hasRiskAdvisory ? 'text-[#B6413A] bg-red-100 font-bold border border-red-300' : 'text-[#5A7852] bg-[#5A7852]/15'
              }`}>
                📍 {lang === 'mr' ? selectedPanchayat.nameMr : selectedPanchayat.nameEn}
              </span>
              {!isUrgent ? (
                <ConfidenceBadge reports={activeReports} lang={lang} size="sm" showCount={false} showLabel={false} />
              ) : (
                <span className="bg-[#B6413A] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1 shadow-xs border border-white/20">
                  🚨 {lang === 'mr' ? 'आपत्ती स्थिती' : 'CRITICAL THREAT'}
                </span>
              )}
            </div>

            {/* Plain Action Line */}
            <h2 className={`text-xl sm:text-3xl font-black leading-snug ${hasRiskAdvisory ? 'text-[#B6413A]' : 'text-[#2F4638]'}`}>
              {advisoryHeadline}
            </h2>
            {!isUrgent && !cropSpecificRule && (
              <p className="max-w-3xl rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950" role="status">
                {effectiveBlock.isDemoForecast
                  ? (lang === 'mr' ? 'हा नमुना अंदाज आहे; पीक-अवस्थेनुसार पडताळलेला सल्ला म्हणून वापरू नका.' : 'This is a sample forecast; this is not reviewed crop-stage advice.')
                  : (lang === 'mr' ? 'या पीक-अवस्थेसाठी स्वतंत्र पडताळलेला नियम नाही; वरील मजकूर सामान्य हवामान मार्गदर्शन आहे.' : 'No reviewed rule is available for this crop stage; the message above is general weather guidance.')}
              </p>
            )}

            <p className="text-sm text-[#2F4638]/75 flex items-center gap-2 flex-wrap">
              <span>{lang === 'mr' ? 'अपेक्षित पाऊस:' : 'Expected rain:'}</span>
              <span className={`font-bold font-mono ${isUrgent ? 'text-[#B6413A] font-black' : 'text-[#2F4638]'}`}>
                {effectiveDownscalingResult.calibratedRainfall} mm {t.rainfall}
              </span>
              <span className="text-[#2F4638]/60">•</span>
              <span className="font-bold text-[#2F4638]">
                {effectiveDownscalingResult.rainProbabilityPct}% {t.rainProbability}
              </span>
            </p>
          </div>

          {/* Audio narration & Share actions in a clean, uniform horizontal row */}
          <div className="w-full grid grid-cols-3 xl:grid-cols-1 gap-2 self-start xl:self-stretch xl:rounded-2xl xl:bg-white/55 xl:p-3 xl:content-center">
            <button
              onClick={handleToggleSpeech}
                className={`min-h-11 w-full justify-center flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs transition border border-[#2F4638]/15 active:scale-95 cursor-pointer ${
                isPlayingAudio
                  ? 'bg-[#B6413A] text-white animate-pulse'
                  : 'bg-[#2F4638] hover:bg-[#263A31] text-white'
              }`}
            >
              {isPlayingAudio ? (
                <>
                  <VolumeX className="w-4 h-4" />
                  <span>{t.stopAudio}</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-[#C9A14A]" />
                  <span>{t.listenAdvisory}</span>
                </>
              )}
            </button>

            <button
              onClick={handleWhatsAppShare}
              className="min-h-11 w-full justify-center flex items-center gap-1.5 bg-[#2F4638] hover:bg-[#263A31] text-white px-3 py-2.5 rounded-xl text-xs font-bold transition border border-[#2F4638]/15 active:scale-95 cursor-pointer"
              title={t.shareWhatsApp}
            >
              <Share2 className="w-4 h-4 text-[#25D366]" />
              <span>{lang === 'mr' ? 'शेअर' : 'Share'}</span>
            </button>

            <button
              onClick={handleShareViaSmsOrNative}
              className="min-h-11 w-full justify-center flex items-center gap-1.5 bg-[#2F4638] hover:bg-[#263A31] text-white px-3 py-2.5 rounded-xl text-xs font-bold transition border border-[#2F4638]/15 active:scale-95 cursor-pointer"
              title={lang === 'mr' ? 'SMS द्वारे पाठवा' : 'Share via SMS'}
            >
              <MessageSquare className="w-4 h-4 text-[#C9A14A]" />
              <span>{lang === 'mr' ? 'एसएमएस' : 'SMS'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: VISUAL CROP SELECTOR (Soft Pumice Card, Oversized Icons)        */}
      {/* ========================================================================= */}
      <div className="bg-[#E6E8DC] rounded-3xl p-4 sm:p-6 border border-gray-300/40 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-300/30 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#5A7852]/15 text-[#5A7852] flex items-center justify-center text-xl font-bold">
              🌱
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#2F4638] flex items-center gap-2">
                <span>{t.crop_select_label}</span>
              </h3>
              <p className="text-xs text-gray-600 font-medium">
                {lang === 'mr'
                  ? 'तुमचे पीक निवडा — सल्ला त्यानुसार बदलेल.'
                  : 'Choose your crop to see advice for it.'}
              </p>
            </div>
          </div>
        </div>

        {/* Oversized Crop Cards */}
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 lg:gap-4">
          {CROPS_WITH_STAGES.map((crop) => {
            const isSelected = selectedCropId === crop.id;
            return (
              <button
                key={crop.id}
                type="button"
                onClick={() => handleSelectCrop(crop.id)}
                className={`h-24 sm:h-28 rounded-2xl border-2 transition-all duration-150 flex items-center justify-start px-3.5 sm:px-4 gap-3.5 relative overflow-hidden select-none active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-[#2F4638] text-white border-[#263A31] shadow-lg ring-3 ring-[#2F4638]/30'
                    : 'bg-[#F6F4EC] hover:bg-white text-[#2F4638] border-gray-300/40 hover:border-[#2F4638]/40 shadow-xs'
                }`}
              >
                <span className="text-4xl sm:text-5xl filter drop-shadow-sm shrink-0">
                  {crop.icon}
                </span>
                <div className="text-left overflow-hidden">
                  <div className="font-black text-sm sm:text-base leading-tight truncate">
                    {lang === 'mr' ? crop.nameMr.split(' ')[0] : crop.nameEn}
                  </div>
                  {lang === 'mr' && (
                    <div className={`text-[11px] font-semibold truncate ${isSelected ? 'text-white/80' : 'text-gray-600'}`}>
                      {crop.nameMr.includes('(') ? crop.nameMr.replace(/^[^(]+/, '').replace(/[()]/g, '') : crop.nameMr}
                    </div>
                  )}
                  {isSelected && (
                    <span className="absolute top-1.5 right-1.5 text-[8px] bg-[#C9A14A]/90 text-[#2F4638] font-black px-1 py-0.5 rounded">
                      ✓ {lang === 'mr' ? 'सक्रिय' : 'Active'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Growth Stage Selector */}
        <div className="pt-2 border-t border-gray-300/30">
          <div className="text-xs font-black text-[#2F4638] mb-2 flex items-center gap-1.5">
            <span>{t.growth_stage_label}</span>
            <span className="text-[11px] text-gray-500 font-normal">
              {lang === 'mr' ? 'पिकाला सध्या आलेली अवस्था निवडा' : "Choose your crop's current stage"}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
            {currentCropObj.growthStages.map((stage) => {
              const isStageActive = currentGrowthStage === stage.id;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => handleSelectStage(stage.id)}
                  className={`p-2.5 rounded-xl border-2 text-left text-xs font-bold transition select-none active:scale-95 cursor-pointer ${
                    isStageActive
                      ? (isUrgent ? 'bg-[#B6413A] text-white border-red-900 shadow-sm' : 'bg-[#5A7852] text-white border-[#466849] shadow-sm')
                      : 'bg-[#F6F4EC] text-gray-700 border-gray-300/40 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{lang === 'mr' ? stage.nameMr : stage.nameEn}</span>
                    {isStageActive && <span className="text-xs">✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* SECTION 3: THREE-DAY OUTLOOK STRIP */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr)_minmax(22rem,1fr)] gap-5 items-start">
        <ThreeDayOutlookStrip
          panchayat={selectedPanchayat}
          downscalingResult={effectiveDownscalingResult}
          farmerReports={farmerReports}
          lang={lang}
          blockForecastDays={selectedBlock?.forecastDays}
          blockRainfallMm={selectedBlock?.imdRainfallMm ?? 0}
          isDemoForecast={selectedBlock?.isDemoForecast}
        />

        {/* 4. "WHY THIS FORECAST?" EXPLAINABILITY PANEL (XAI) */}
        <ExplainabilityPanel
          panchayat={selectedPanchayat}
          block={effectiveBlock}
          downscalingResult={effectiveDownscalingResult}
          reports={farmerReports}
          lang={lang}
        />
      </div>

      {/* ========================================================================= */}
      {/* 5. THE 4 FARMER ACTION CARDS (Soft Pumice #E6E8DC Container Blocks)       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        
        {/* Card 1: Irrigation Advice */}
        <div className="bg-[#E6E8DC] rounded-3xl p-5 border border-gray-300/40 shadow-sm flex flex-col justify-between hover:border-[#2F4638]/40 transition">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-cyan-100 text-cyan-800 flex items-center justify-center font-bold text-xl">
                  💧
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-[#2F4638]">
                    {t.irrigationCard}
                  </h3>
                  <span className="text-[11px] text-gray-600 font-medium">
                    {currentCropObj.icon} {lang === 'mr' ? currentCropObj.nameMr.split(' ')[0] : currentCropObj.nameEn}
                  </span>
                </div>
              </div>
              <span className={`text-xs font-black px-2.5 py-1 rounded-xl shadow-2xs ${
                isUrgent || effectiveDownscalingResult.calibratedRainfall > 3
                  ? 'bg-red-100 text-[#B6413A] border-2 border-red-400 font-black'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}>
                {isUrgent || effectiveDownscalingResult.calibratedRainfall > 3
                  ? (lang === 'mr' ? '🛑 सिंचन पूर्ण बंद' : '🛑 Halt All Irrigation')
                  : (lang === 'mr' ? '✅ नियमित सिंचन' : '✅ Normal Drip')}
              </span>
            </div>

            <p className="text-sm text-[#2F4638] font-medium leading-relaxed bg-[#F6F4EC] p-3.5 rounded-2xl border border-gray-300/40">
              {lang === 'mr' ? activeAdvisory.irrigationAdviceMr : activeAdvisory.irrigationAdviceEn}
            </p>
          </div>

          <div className="mt-3 text-xs text-[#5A7852] flex items-center justify-between pt-2.5 border-t border-gray-300/30 font-semibold">
            <span>{lang === 'mr' ? 'जमिनीतील ओलावा अंदाज:' : 'Estimated Soil Moisture:'}</span>
            <span className={`font-bold font-mono ${isUrgent ? 'text-[#B6413A] font-black' : ''}`}>
              {isUrgent
                ? (lang === 'mr' ? 'पाणी साचण्याचा धोका' : 'High waterlogging risk')
                : effectiveDownscalingResult.calibratedHumidity > 80
                ? (lang === 'mr' ? 'जास्त' : 'High')
                : (lang === 'mr' ? 'योग्य' : 'Good')}
            </span>
          </div>
        </div>

        {/* Card 2: Spraying & Disease Protection */}
        <div className="bg-[#E6E8DC] rounded-3xl p-5 border border-gray-300/40 shadow-sm flex flex-col justify-between hover:border-[#2F4638]/40 transition">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xl">
                  🛡️
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-[#2F4638]">
                    {t.sprayingCard}
                  </h3>
                  <span className="text-[11px] text-gray-600 font-medium">
                    {currentCropObj.icon} {lang === 'mr' ? currentCropObj.nameMr.split(' ')[0] : currentCropObj.nameEn}
                  </span>
                </div>
              </div>
              <span className="text-xs bg-rose-100 text-rose-800 font-bold px-2.5 py-1 rounded-xl border border-rose-300">
                {lang === 'mr' ? 'रोग प्रतिबंध' : 'Pest/Fungus Risk'}
              </span>
            </div>

            <p className="text-sm text-[#2F4638] font-medium leading-relaxed bg-[#F6F4EC] p-3.5 rounded-2xl border border-gray-300/40">
              {lang === 'mr' ? activeAdvisory.sprayingAdviceMr : activeAdvisory.sprayingAdviceEn}
            </p>
          </div>

          <div className="mt-3 text-xs text-[#806000] flex items-center justify-between pt-2.5 border-t border-gray-300/30 font-semibold">
            <span>{lang === 'mr' ? 'फवारणी खिडकी (Spray Window):' : 'Spraying Window:'}</span>
            <span className={`font-bold ${isUrgent ? 'text-[#B6413A] font-black bg-red-100 px-2 py-0.5 rounded border border-red-300' : ''}`}>
              {isUrgent || effectiveDownscalingResult.calibratedRainfall > 5
                ? (lang === 'mr' ? '❌ आज फवारणी पूर्ण रद्द' : '❌ Cancel all sprays today')
                : (lang === 'mr' ? '✅ सकाळी ७ ते १० योग्य' : '✅ Clear 7-10 AM')}
            </span>
          </div>
        </div>

        {/* Card 3: Fertilizer Management */}
        <div className="bg-[#E6E8DC] rounded-3xl p-5 border border-gray-300/40 shadow-sm flex flex-col justify-between hover:border-[#2F4638]/40 transition">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xl">
                  🌱
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-[#2F4638]">
                    {t.fertilizerCard}
                  </h3>
                  <span className="text-[11px] text-gray-600 font-medium">
                    {lang === 'mr' ? 'पिकासाठी अन्नद्रव्ये' : 'Plant nutrients'}
                  </span>
                </div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${
                isUrgent || effectiveDownscalingResult.calibratedRainfall > 6
                  ? 'bg-red-100 text-[#B6413A] border-red-300 font-black'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}>
                {isUrgent || effectiveDownscalingResult.calibratedRainfall > 6
                  ? (lang === 'mr' ? '⚠️ खते तात्काळ थांबवा' : '⚠️ Halt Fertilizer')
                  : (lang === 'mr' ? '✅ खत नियोजन योग्य' : '✅ Fertilizer Optimal')}
              </span>
            </div>

            <p className="text-sm text-[#2F4638] font-medium leading-relaxed bg-[#F6F4EC] p-3.5 rounded-2xl border border-gray-300/40">
              {lang === 'mr' ? activeAdvisory.fertilizerAdviceMr : activeAdvisory.fertilizerAdviceEn}
            </p>
          </div>

          <div className="mt-3 text-xs text-[#5A7852] flex items-center justify-between pt-2.5 border-t border-gray-300/30 font-semibold">
            <span>{lang === 'mr' ? 'खतांचा अपव्यय टाळा' : 'Prevent nutrient leaching'}</span>
            <span className={`font-bold ${isUrgent ? 'text-[#B6413A] font-black' : ''}`}>
              {isUrgent || effectiveDownscalingResult.calibratedRainfall > 6
                ? (lang === 'mr' ? '⚠️ तीव्र निचरा धोका (Leaching)' : '⚠️ Severe Leaching Danger')
                : '✅ Optimal'}
            </span>
          </div>
        </div>

        {/* Card 4: Harvesting & Storage */}
        <div className="bg-[#E6E8DC] rounded-3xl p-5 border border-gray-300/40 shadow-sm flex flex-col justify-between hover:border-[#2F4638]/40 transition">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-xl">
                  📦
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-[#2F4638]">
                    {t.harvestCard}
                  </h3>
                  <span className="text-[11px] text-gray-600 font-medium">
                    {lang === 'mr' ? 'काढणी व साठवणूक' : 'Post-Harvest Protection'}
                  </span>
                </div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${
                isUrgent ? 'bg-red-100 text-[#B6413A] border-red-300 font-black animate-pulse' : 'bg-amber-100 text-amber-900 border-amber-300'
              }`}>
                {isUrgent ? (lang === 'mr' ? '🚨 तातडीने माल झाका' : '🚨 Immediate Tarp Cover') : (lang === 'mr' ? 'काढणी नियोजन' : 'Post-Harvest')}
              </span>
            </div>

            <p className="text-sm text-[#2F4638] font-medium leading-relaxed bg-[#F6F4EC] p-3.5 rounded-2xl border border-gray-300/40">
              {lang === 'mr' ? activeAdvisory.harvestAdviceMr : activeAdvisory.harvestAdviceEn}
            </p>
          </div>

          <div className="mt-3 text-xs text-[#2F4638] flex items-center justify-between pt-2.5 border-t border-gray-300/30 font-semibold">
            <span>{lang === 'mr' ? 'बाजारपेठ वाहतूक:' : 'Market transit:'}</span>
            <span className={`font-bold ${isUrgent ? 'text-[#B6413A] font-black' : ''}`}>
              {isUrgent
                ? (lang === 'mr' ? '🚨 ताडपत्रीने माल सुरक्षित शेडमध्ये झाका' : '🚨 Cover produce with tarpaulin immediately')
                : (lang === 'mr' ? 'ताडपत्रीने माल झाका' : 'Cover produce')}
            </span>
          </div>
        </div>
      </div>

      {/* Traditional Crowdsource Observation Callout Bar: Muted Terracotta Clay */}
      <div className={`rounded-3xl p-4 sm:p-5 border flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors ${
        isUrgent
          ? 'bg-red-50 border-2 border-[#B6413A]'
          : 'bg-[#5A7852]/10 border-[#5A7852]/30'
      }`}>
        <div className="flex items-center gap-3.5 text-left">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-xs text-white ${
            isUrgent ? 'bg-[#B6413A] animate-pulse' : 'bg-[#5A7852]'
          }`}>
            {isUrgent ? '🚨' : '🐜'}
          </div>
          <div>
            <div className={`text-xs font-black uppercase tracking-wider ${
              isUrgent ? 'text-[#B6413A]' : 'text-[#5A7852]'
            }`}>
              {isUrgent
                ? (lang === 'mr' ? 'आपत्ती काळात स्थानिक माहिती नोंदवा' : 'Report emergency ground observations')
                : (lang === 'mr' ? 'तुमच्या शिवारात काय दिसले?' : 'Noticed natural indicators in your farm?')}
            </div>
            <p className="text-xs text-[#2F4638] mt-0.5 font-medium">
              {isUrgent
                ? (lang === 'mr'
                    ? 'पाणी साचणे, ओढे भरणे किंवा पीक नुकसान तात्काळ नोंदवा — पंचायतीला मदत होईल.'
                    : 'Report waterlogging, overflowing drains or field inundation to help local response.')
                : (lang === 'mr'
                    ? 'मुंग्यांची हालचाल, बेडकांचा आवाज किंवा ढगांचे स्वरूप नोंदवा — मॉडेल अचूकता सुधारेल.'
                    : 'Report ant movement, frog choruses or dark cloud formations to calibrate local accuracy.')}
            </p>
          </div>
        </div>

        <button
          onClick={onOpenIntake}
          className={`active:scale-95 text-white font-black text-xs px-5 py-3 rounded-2xl transition shrink-0 shadow-sm cursor-pointer ${
            isUrgent ? 'bg-[#B6413A] hover:bg-red-700' : 'bg-[#5A7852] hover:bg-[#466849]'
          }`}
        >
          {lang === 'mr' ? 'आता नोंदवा (Tap to Report)' : 'Report Observation'}
        </button>
      </div>

      {/* Offline Alert Channel */}
      <OfflineAlertChannel
        panchayat={selectedPanchayat}
        downscalingResult={downscalingResult}
        lang={lang}
        isUrgent={isUrgent}
      />

      {/* SECTION 4: COLLAPSIBLE TECHNICAL BACKTEST ACCORDION */}
      <div className="bg-[#E6E8DC] rounded-3xl border border-gray-300/40 shadow-xs overflow-hidden mt-6">
        <button
          type="button"
          onClick={() => setShowTechnicalBacktest(!showTechnicalBacktest)}
          className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left hover:bg-[#F6F4EC] transition select-none cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#2F4638] text-white flex items-center justify-center font-bold text-lg shadow-xs">
              <Cpu className="w-5 h-5 text-[#C9A14A]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm sm:text-base text-[#2F4638]">
                  {t.evaluator_accordion_title}
                </span>
                <span className="bg-[#2F4638] text-white text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold">
                  {t.evaluator_badge}
                </span>
              </div>
              <p className="text-xs text-gray-600 font-medium mt-0.5">
                {lang === 'mr'
                  ? 'MAE, R² अचूकता, ८०/२० स्प्लिट, व ७-दिवसीय सांख्यिकी मॉडेल पडताळणी तपासण्यासाठी येथे क्लिक करा'
                  : 'Click to expand model evaluation metrics, MAE, R² score, and 7-day validation charts'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-[#2F4638] hidden sm:inline">
              {showTechnicalBacktest ? (lang === 'mr' ? 'लपवा (Hide)' : 'Hide') : (lang === 'mr' ? 'पहा (Expand)' : 'Expand')}
            </span>
            <div className="w-8 h-8 rounded-full bg-[#F6F4EC] flex items-center justify-center text-[#2F4638] font-bold text-sm shadow-2xs border border-gray-300/40">
              {showTechnicalBacktest ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </button>

        {/* Accordion Body */}
        {showTechnicalBacktest && (
          <div className="p-4 sm:p-6 border-t border-gray-300/40 bg-[#F6F4EC] space-y-5 animate-in fade-in duration-200">
            <div className="bg-[#E6E8DC] rounded-2xl p-4 sm:p-5 border border-gray-300/40 shadow-xs">
              <p className="text-sm text-[#2F4638]/85 leading-relaxed">
                {lang === 'mr'
                  ? 'या प्रोटोटाइपमध्ये IMD चे थेट ब्लॉक अंदाज किंवा स्थानिक पर्जन्यमापकांचा जोडलेला इतिहास नाही. त्यामुळे शिकलेले RF मॉडेल, वैशिष्ट्यांचे वजन किंवा अचूकता गुण उपलब्ध नाहीत.'
                  : 'This prototype has no live IMD block feed or paired local rain-gauge history. A trained Random Forest, learned feature weights, and accuracy scores are therefore unavailable.'}
              </p>
            </div>

            {/* 7-Day Historical Trend View */}
            <HistoricalTrendView
              panchayat={selectedPanchayat}
              block={effectiveBlock}
              downscalingResult={downscalingResult}
              reports={farmerReports}
              lang={lang}
            />
          </div>
        )}
      </div>

      {/* SMS Simulation Modal */}
      {showSmsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#F6F4EC] rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-xl border border-gray-300">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#2F4638]" />
                <h3 className="font-bold text-base text-[#2F4638]">
                  {lang === 'mr' ? 'शेतकरी SMS / WhatsApp संदेश' : 'Farmer SMS Advisory'}
                </h3>
              </div>
              <button
                onClick={() => setShowSmsModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600 mb-3">
              {lang === 'mr'
                ? 'हा संदेश ग्रामपंचायत शेतकरी मेसेजिंग किंवा कृषी सहाय्यक ग्रुपमध्ये थेट पाठवता येतो:'
                : 'Direct plain-language broadcast message for farmer SMS/WhatsApp groups:'}
            </p>

            <div className="bg-[#E6E8DC] p-3.5 rounded-xl border border-gray-300/40 text-xs font-mono whitespace-pre-line text-[#2F4638] leading-relaxed select-all">
              {getShareText()}
            </div>

            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(getShareText());
                  setCopiedSms(true);
                  setTimeout(() => setCopiedSms(false), 2000);
                }}
                className="flex-1 bg-[#2F4638] text-white py-2.5 rounded-xl text-xs font-bold hover:bg-[#263A31] transition cursor-pointer"
              >
                {copiedSms
                  ? (lang === 'mr' ? '✓ कॉपी केले!' : '✓ Copied!')
                  : (lang === 'mr' ? 'मजकूर कॉपी करा' : 'Copy Text')}
              </button>
              <button
                onClick={() => setShowSmsModal(false)}
                className="bg-[#E6E8DC] text-[#2F4638] py-2.5 px-4 rounded-xl text-xs font-semibold hover:bg-gray-200 transition cursor-pointer"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
