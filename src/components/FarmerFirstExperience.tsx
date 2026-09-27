import React, { useState } from 'react';
import { AlertTriangle, Bug, CloudLightning, CloudRain, CloudSun, Languages, LocateFixed, MapPin, Sprout, Sun } from 'lucide-react';
import { DownscalingResult, Language, Panchayat } from '../types';
import { CROPS_WITH_STAGES, FarmerProfileSettings, generateCropAdvisory, loadFarmerProfile, saveFarmerProfile } from '../data/cropStageData';

interface FarmerFirstExperienceProps {
  lang: Language;
  onToggleLang: () => void;
  selectedPanchayat: Panchayat;
  onLocationDetected: (latitude: number, longitude: number) => boolean;
  downscalingResult: DownscalingResult;
  isDemoForecast: boolean;
  forecastState: 'loading' | 'live' | 'fallback';
  isDemoScenario: boolean;
  isUrgent: boolean;
  onOpenIntake: () => void;
  onOpenOfficials: () => void;
}

type FarmerScreen = 'home' | 'advice';

export const FarmerFirstExperience: React.FC<FarmerFirstExperienceProps> = ({
  lang,
  onToggleLang,
  selectedPanchayat,
  onLocationDetected,
  downscalingResult,
  isDemoForecast,
  forecastState,
  isDemoScenario,
  isUrgent,
  onOpenIntake,
  onOpenOfficials,
}) => {
  const isMr = lang === 'mr';
  const [screen, setScreen] = useState<FarmerScreen>('home');
  const [profile, setProfile] = useState<FarmerProfileSettings>(loadFarmerProfile);
  const [showCropSetup, setShowCropSetup] = useState(false);
  const [draftCrop, setDraftCrop] = useState(profile.cropType || CROPS_WITH_STAGES[0].id);
  const [draftStage, setDraftStage] = useState(profile.growthStage || CROPS_WITH_STAGES[0].growthStages[0].id);
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');

  const findMyVillage = () => {
    if (!('geolocation' in navigator)) {
      setLocationMessage(isMr ? 'या ब्राउझरमध्ये GPS उपलब्ध नाही. अधिकृत डेमो पोर्टलमधून गाव निवडा.' : 'GPS is unavailable in this browser. Choose your village in the Official Demo Portal.');
      return;
    }
    setIsLocating(true);
    setLocationMessage('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const found = onLocationDetected(coords.latitude, coords.longitude);
        setIsLocating(false);
        setLocationMessage(found
          ? (isMr ? 'तुमचे जवळचे गाव निवडले.' : 'Your nearest demo village has been selected.')
          : (isMr
              ? 'तुमचे स्थान नमुना गावांच्या बाहेर आहे.'
              : 'Your location is outside the demo area.'));
      },
      (error) => {
        setIsLocating(false);
        const message = error.code === error.PERMISSION_DENIED
          ? (isMr ? 'स्थान परवानगी नाकारली. ब्राउझर सेटिंग्जमध्ये परवानगी द्या किंवा गाव मॅन्युअली निवडा.' : 'Location permission was denied. Allow it in browser settings or choose your village manually.')
          : error.code === error.TIMEOUT
            ? (isMr ? 'स्थान शोधण्यास वेळ लागला. पुन्हा प्रयत्न करा किंवा गाव निवडा.' : 'Location lookup timed out. Try again or choose your village manually.')
            : (isMr ? 'स्थान मिळाले नाही. GPS सुरू आहे का ते तपासा किंवा गाव निवडा.' : 'Could not get your location. Check that GPS is on, or choose your village manually.');
        setLocationMessage(message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const rain = downscalingResult.calibratedRainfall;
  const weatherIcon = isDemoForecast
    ? CloudSun
    : isUrgent
    ? CloudLightning
    : rain > 8
      ? CloudRain
      : rain > 1
        ? CloudSun
        : Sun;
  const WeatherIcon = weatherIcon;
  const selectedCrop = CROPS_WITH_STAGES.find((crop) => crop.id === (profile.cropType || draftCrop)) || CROPS_WITH_STAGES[0];
  const selectedStage = selectedCrop.growthStages.find((stage) => stage.id === profile.growthStage);
  const cropRule = profile.isConfigured && profile.cropType && profile.growthStage
    ? generateCropAdvisory(profile.cropType, profile.growthStage, rain)
    : null;

  const simpleAdvice = isDemoForecast
    ? (isMr
        ? 'प्रत्यक्ष हवामान माहिती उपलब्ध नाही. सध्या सल्ला देता येत नाही.'
        : 'Live weather data is unavailable. Advice cannot be provided yet.')
    : isUrgent
    ? (isMr
        ? 'काढलेला शेतमाल सुरक्षित शेडमध्ये ठेवा. सिंचन आणि फवारणी थांबवा.'
        : 'Move harvested crops under cover. Stop irrigation and spraying.')
    : cropRule
      ? (isMr ? cropRule.mr : cropRule.en)
      : isMr
        ? rain >= 10
          ? 'आज जोरदार पाऊस शक्य आहे — सिंचन थांबवा आणि फवारणी करू नका.'
          : rain >= 4
            ? 'आज पाऊस शक्य आहे — सिंचन थोडे उशिरा करा.'
            : rain >= 1
              ? 'हलका पाऊस शक्य आहे — सिंचन उशिरा करा.'
              : 'आज हवामान कोरडे राहील — नेहमीप्रमाणे सिंचन करा.'
        : rain >= 10
          ? 'Heavy rain is possible today — stop irrigation and do not spray.'
          : rain >= 4
            ? 'Rain is possible today — delay irrigation a little.'
            : rain >= 1
              ? 'Light rain is possible — delay irrigation.'
              : 'Dry weather is expected — irrigate as usual.';

  const chooseCrop = (cropId: string) => {
    setDraftCrop(cropId);
    const crop = CROPS_WITH_STAGES.find((option) => option.id === cropId) || CROPS_WITH_STAGES[0];
    if (!crop.growthStages.some((stage) => stage.id === draftStage)) setDraftStage(crop.growthStages[0].id);
  };

  const saveCropSetup = () => {
    const updated = { cropType: draftCrop, growthStage: draftStage, isConfigured: true };
    saveFarmerProfile(updated);
    setProfile(updated);
    setShowCropSetup(false);
  };

  const openCropSetup = () => {
    setDraftCrop(profile.cropType || CROPS_WITH_STAGES[0].id);
    const crop = CROPS_WITH_STAGES.find((option) => option.id === (profile.cropType || CROPS_WITH_STAGES[0].id)) || CROPS_WITH_STAGES[0];
    const savedStage = profile.growthStage && crop.growthStages.some((stage) => stage.id === profile.growthStage)
      ? profile.growthStage
      : crop.growthStages[0].id;
    setDraftStage(savedStage);
    setShowCropSetup(true);
  };

  return (
    <main
      className={`min-h-screen w-full flex flex-col items-center px-5 py-5 sm:px-8 sm:py-8 ${isUrgent && screen === 'advice' ? 'bg-[#B84035] text-white' : 'bg-[#F6F5F0] text-[#26372D]'}`}
      style={!(isUrgent && screen === 'advice') ? {
        backgroundImage: screen === 'home'
          ? "linear-gradient(115deg, rgba(21, 54, 34, 0.28), rgba(34, 62, 34, 0.38)), url('/farmer-cover.png')"
          : "linear-gradient(115deg, rgba(21, 45, 24, 0.20), rgba(34, 50, 28, 0.24)), url('/farmer-advice.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      } : undefined}
    >
      {!(isUrgent && screen === 'advice') && (
        <header className="w-full max-w-5xl flex items-center justify-between gap-4 rounded-2xl border border-white/50 bg-white/90 px-4 py-2 shadow-md backdrop-blur-sm">
          <button type="button" onClick={() => setScreen('home')} className="flex items-center gap-3 text-left" aria-label={isMr ? 'मुख्यपृष्ठ' : 'Go to home'}>
            <span className="w-10 h-10 rounded-xl bg-[#E6EADF] text-[#496747] flex items-center justify-center">
              <WeatherIcon className="w-6 h-6" aria-hidden="true" />
            </span>
            <span className="text-xl sm:text-2xl font-black">{isMr ? 'वर्षा ज्ञान' : 'VarshaGyan'}</span>
          </button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isDemoScenario && <span className="min-h-11 inline-flex items-center rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-bold text-amber-950">{isMr ? 'डेमो परिस्थिती' : 'Demo scenario'}</span>}
            <button
              type="button"
              onClick={onToggleLang}
              className="min-h-11 rounded-lg border border-[#26372D]/15 bg-white px-3.5 py-2 font-semibold flex items-center gap-2"
              aria-label={isMr ? 'Switch to English' : 'मराठीत पहा'}
            >
              <Languages className="w-4 h-4" />{isMr ? 'English' : 'मराठी'}
            </button>
          </div>
        </header>
      )}

      {screen === 'home' ? (
        <section className="w-full max-w-3xl flex-1 flex flex-col justify-center py-8 sm:py-12">
          <div className="overflow-hidden rounded-3xl border border-white/80 border-l-[6px] border-l-[#5E8A45] bg-[#FFFDF8]/95 shadow-[0_18px_60px_rgba(10,32,18,0.28)] backdrop-blur-sm">
            <div className="p-7 sm:p-11">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#EAF0E3] px-3 py-1.5 text-sm font-semibold text-[#496747]">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              <span>{isMr ? 'तुमच्या गावासाठी' : 'For your village'}</span>
            </div>
            <div className="mt-6 flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#E9EEE5] text-[#496747]">
                <WeatherIcon className="h-7 w-7" strokeWidth={1.7} aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-3xl font-bold sm:text-4xl">{isMr ? 'वर्षा ज्ञान' : 'VarshaGyan'}</h1>
                <p className="mt-1 text-lg text-[#4C5B4E] sm:text-xl">{isMr ? 'आजचा पाऊस आणि शेतीचा सल्ला' : 'Today’s rain and farming advice'}</p>
              </div>
            </div>
            <div className="mt-7 border-t border-[#26372D]/10 pt-5">
              <p className="text-base font-medium text-[#59675A]">{isMr ? 'ग्रामपंचायत' : 'Gram Panchayat'}</p>
              <p className="mt-1 text-xl font-semibold text-[#26372D]">{isMr ? selectedPanchayat.nameMr : selectedPanchayat.nameEn}</p>
              <button type="button" onClick={findMyVillage} disabled={isLocating} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#367347]/25 bg-[#EAF0E3] px-4 py-2.5 text-sm font-bold text-[#2F5F3D] transition hover:bg-[#DCE9D4] disabled:cursor-wait disabled:opacity-70">
                <LocateFixed className="h-4 w-4" aria-hidden="true" />
                {isLocating ? (isMr ? 'स्थान शोधत आहे…' : 'Finding your location…') : (isMr ? 'GPS ने माझे गाव शोधा' : 'Find my village with GPS')}
              </button>
              {locationMessage && <p className="mt-2 max-w-xl text-sm font-semibold text-[#52614F]" role="status" aria-live="polite">{locationMessage}</p>}
              <p className="mt-1 text-xs text-[#59675A]">{isMr ? 'GPS परवानगी आवश्यक · स्थान या डिव्हाइसवरच तपासले जाते' : 'GPS permission required · location is matched on this device'}</p>
            </div>
            {isUrgent && !isDemoForecast && (
              <div className="mt-5 rounded-2xl border-2 border-[#B84035] bg-[#FFF0ED] p-4 text-[#792E28]" role="alert" aria-live="assertive">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-lg font-black">{isMr ? 'तातडीचा पावसाचा इशारा' : 'Urgent rain alert'}</p>
                    <p className="mt-1 text-sm font-semibold">{isMr ? 'या ग्रामपंचायतीसाठी मुसळधार पावसाचा अंदाज आहे.' : `Heavy rain is forecast for ${selectedPanchayat.nameEn}.`}</p>
                    <button type="button" onClick={() => setScreen('advice')} className="mt-3 min-h-11 rounded-lg bg-[#B84035] px-4 py-2 font-bold text-white hover:bg-[#96352E]">
                      {isMr ? 'आता काय करावे ते पाहा' : 'See what to do now'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <button type="button" onClick={() => setScreen('advice')} className="mt-7 min-h-16 w-full rounded-xl bg-[#367347] px-6 py-4 text-xl font-semibold text-white shadow-md transition hover:bg-[#2D613C]">
              {isMr ? 'आजचा सल्ला पाहा' : "See today's advice"}
            </button>
            </div>
          </div>
        </section>
      ) : isUrgent ? (
        <section className="w-full max-w-3xl flex-1 flex flex-col items-center justify-center text-center py-10" role="alert" aria-live="assertive">
          <AlertTriangle className="w-28 h-28 sm:w-36 sm:h-36 text-white mb-8" strokeWidth={1.5} aria-hidden="true" />
          <h1 className="text-3xl sm:text-5xl font-black leading-tight">
            {isMr ? 'अतिवृष्टीचा इशारा' : 'Heavy rain warning'}
          </h1>
          <p className="mt-6 text-2xl sm:text-4xl font-bold leading-relaxed">
            {isMr ? 'काढलेला शेतमाल सुरक्षित शेडमध्ये ठेवा. सिंचन आणि फवारणी थांबवा.' : 'Move harvested crops under cover. Stop irrigation and spraying.'}
          </p>
        </section>
      ) : (
        <section className="w-full max-w-4xl flex-1 flex flex-col items-center justify-center py-8 sm:py-12">
          <div className="w-full rounded-3xl border border-white/80 bg-[#FFFDF8]/94 px-5 py-7 text-center shadow-[0_18px_60px_rgba(10,32,18,0.28)] backdrop-blur-sm sm:px-10 sm:py-9">
          <WeatherIcon className="w-16 h-16 sm:w-20 sm:h-20 text-[#526F50] mb-5 mx-auto" strokeWidth={1.6} aria-hidden="true" />
          <p className="text-base sm:text-lg font-semibold text-[#52614F] mb-4">{isMr ? selectedPanchayat.nameMr : selectedPanchayat.nameEn} {isMr ? 'ग्रामपंचायत' : 'Gram Panchayat'}</p>
          {profile.isConfigured && selectedStage && (
            <div className="mx-auto mb-5 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-[#5A7852]/25 bg-[#EAF0E3] px-4 py-2 text-sm font-bold text-[#36543B]">
              <span>{selectedCrop.icon} {isMr ? selectedCrop.nameMr.split(' (')[0] : selectedCrop.nameEn}</span>
              <span aria-hidden="true">·</span>
              <span>{isMr ? selectedStage.nameMr.split(' (')[0] : selectedStage.nameEn}</span>
            </div>
          )}
          {isDemoForecast && (
            <p className="mx-auto mb-5 max-w-2xl rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 text-sm font-bold text-amber-950 sm:text-base" role="status">
              {isDemoScenario
                ? (isMr ? 'डेमो परिस्थिती सक्रिय · ही नमुना माहिती आहे, प्रत्यक्ष शेती निर्णयासाठी वापरू नका.' : 'Demo scenario active · these are illustrative values, not for farm decisions.')
                : forecastState === 'loading'
                  ? (isMr ? 'आजचा ब्लॉक अंदाज लोड होत आहे…' : 'Loading today’s block forecast…')
                  : (isMr ? 'थेट अंदाज सेवा उपलब्ध नाही. सध्या नमुना माहिती दिसत आहे; शेतीचा निर्णय घेण्यासाठी वापरू नका.' : 'Live forecast is unavailable. A sample is shown; do not use it for farm decisions.')}
            </p>
          )}
          <h1 className="mx-auto max-w-3xl text-2xl sm:text-4xl font-bold leading-relaxed">{simpleAdvice}</h1>
          {!isDemoForecast && (
            <p className="mt-5 text-xs font-semibold text-[#52614F]">
              {isMr ? 'शैक्षणिक डेमो · स्थानिक पडताळणी आवश्यक · हवामान स्रोत: ' : 'Educational demo · local validation required · Weather data: '}
              <a className="underline underline-offset-2" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo (CC BY 4.0)</a>
            </p>
          )}
          {profile.isConfigured && !isUrgent && !isDemoForecast && !cropRule && (
            <p className="mx-auto mt-5 max-w-2xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950" role="status">
              {isMr
                ? 'या पीक-अवस्थेसाठी स्वतंत्र पडताळलेला नियम उपलब्ध नाही; वरील सल्ला फक्त हवामानावर आधारित सामान्य मार्गदर्शन आहे.'
                : 'No reviewed crop-stage rule is available for this combination; the advice above is general weather guidance.'}
            </p>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={openCropSetup} className="min-h-11 rounded-xl border border-[#2F4638]/15 bg-white px-4 py-3 text-sm font-bold flex items-center gap-2 shadow-sm">
              <Sprout className="w-4 h-4 text-[#5A7852]" />{isMr ? (profile.isConfigured ? 'पीक / अवस्था बदला' : 'माझे पीक सांगा') : (profile.isConfigured ? 'Change crop / stage' : 'Tell us your crop')}
            </button>
            <button type="button" onClick={onOpenIntake} className="min-h-11 rounded-xl border border-[#2F4638]/15 bg-white px-4 py-3 text-sm font-bold flex items-center gap-2 shadow-sm">
              <Bug className="w-4 h-4 text-[#5A7852]" />{isMr ? 'काही असामान्य दिसले का?' : 'Notice something unusual?'}
            </button>
          </div>
          </div>
        </section>
      )}

      {screen === 'home' && (
        <footer className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
          <button type="button" onClick={onOpenOfficials} className="rounded-xl border border-white/80 bg-white/95 px-4 py-2.5 text-left text-sm font-semibold text-[#26372D] shadow-lg backdrop-blur-sm transition hover:bg-white hover:shadow-xl">
            <span className="block">{isMr ? 'अधिकृत डेमो पोर्टल' : 'Official Demo Portal'}</span>
            <span className="mt-0.5 block text-xs font-medium text-[#59675A]">{isMr ? 'मूल्यमापनासाठी' : 'For Evaluation'}</span>
          </button>
        </footer>
      )}

      {showCropSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="crop-setup-title">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#F6F4EC] p-5 sm:p-7 shadow-2xl">
            <h2 id="crop-setup-title" className="text-2xl font-black">{isMr ? 'तुमचे पीक निवडा' : 'Choose your crop'}</h2>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CROPS_WITH_STAGES.map((crop) => (
                <button key={crop.id} type="button" onClick={() => chooseCrop(crop.id)} aria-pressed={draftCrop === crop.id} className={`min-h-16 rounded-xl border-2 p-3 text-left font-bold ${draftCrop === crop.id ? 'bg-[#2F4638] text-white border-[#2F4638]' : 'bg-white border-[#2F4638]/10'}`}>
                  <span className="mr-2">{crop.icon}</span>{isMr ? crop.nameMr.split(' (')[0] : crop.nameEn}
                </button>
              ))}
            </div>
            <h3 className="mt-6 text-lg font-bold">{isMr ? 'पिकाची अवस्था निवडा' : 'Choose the crop stage'}</h3>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {selectedCrop.growthStages.map((stage) => (
                <button key={stage.id} type="button" onClick={() => setDraftStage(stage.id)} aria-pressed={draftStage === stage.id} className={`min-h-12 rounded-xl border-2 px-3 py-2 text-left text-sm font-semibold ${draftStage === stage.id ? 'bg-[#5A7852] text-white border-[#466849]' : 'bg-white border-[#2F4638]/10'}`}>
                  {isMr ? stage.nameMr.split(' (')[0] : stage.nameEn}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowCropSetup(false)} className="min-h-11 rounded-xl px-4 py-2 font-bold text-[#2F4638]/70">{isMr ? 'नंतर' : 'Later'}</button>
              <button type="button" onClick={saveCropSetup} className="min-h-11 rounded-xl bg-[#5A7852] px-5 py-2 font-bold text-white">{isMr ? 'जतन करा' : 'Save crop'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
