import React, { useState } from 'react';
import { Play, CheckCircle2, ChevronRight, ChevronLeft, Sparkles, Map, Bug, Volume2, Languages, ShieldCheck } from 'lucide-react';
import { Language, Panchayat } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { PANCHAYATS_DATA } from '../data/nashikGeoData';

interface DemoScriptModalProps {
  lang: Language;
  onSetLang: (lang: Language) => void;
  setActiveTab: (tab: 'dashboard' | 'map' | 'intake' | 'science' | 'demo') => void;
  onSelectPanchayat: (p: Panchayat) => void;
  onOpenIntake: () => void;
  simulateSevereAlert?: boolean;
  onToggleSimulateAlert?: (simulate: boolean) => void;
}

export const DemoScriptModal: React.FC<DemoScriptModalProps> = ({
  lang,
  onSetLang,
  setActiveTab,
  onSelectPanchayat,
  onOpenIntake,
  simulateSevereAlert = false,
  onToggleSimulateAlert,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const t = TRANSLATIONS[lang];

  const pimpalgaon = PANCHAYATS_DATA.find((p) => p.id === 'gp_pimpalgaon') || PANCHAYATS_DATA[0];

  const steps = [
    {
      step: 1,
      titleMr: '१. तालुका पातळी (Block Level Coarse Forecast)',
      titleEn: '1. Coarse Block Level Forecast (IMD 0.25°)',
      descMr: 'IMD चा अधिकृत 0.25° ग्रिडेड बुलेटिन संपूर्ण तालुक्यासाठी (उदा. निफाड) एकच एकसमान अंदाज (6.2 mm) देतो.',
      descEn: 'Official IMD 0.25° gridded bulletin gives a single coarse flat forecast (6.2mm) across the entire block.',
      actionLabelMr: 'नकाशावर तालुका दृश्य पहा',
      actionLabelEn: 'View Block Coarse Layer on Map',
      action: () => {
        onSelectPanchayat(pimpalgaon);
        setActiveTab('map');
      },
    },
    {
      step: 2,
      titleMr: '२. ग्रामपंचायत पातळीवरील भूभाग नमुना',
      titleEn: '2. Panchayat Level High-Res Downscaling',
      descMr: 'प्रात्यक्षिक भूभाग गणना नमुना पर्जन्यमानाला उंची, उतार आणि स्थानिक वैशिष्ट्यांनुसार बदलते. ही प्रशिक्षित किंवा पडताळलेली भविष्यवाणी नाही.',
      descEn: 'A demonstration terrain calculation adjusts sample rainfall using elevation, slope, and local features. It is not a trained or validated forecast.',
      actionLabelMr: 'ग्रामपंचायत डाऊनस्केल्ड दृश्य उघडा',
      actionLabelEn: 'Inspect Panchayat Downscaled Polygons',
      action: () => {
        onSelectPanchayat(pimpalgaon);
        setActiveTab('map');
      },
    },
    {
      step: 3,
      titleMr: '३. पारंपारिक संकेत नोंदणी व कॅलिब्रेशन (Ant Evacuation Report)',
      titleEn: '3. Traditional Bio-Indicator Calibration Nudge',
      descMr: 'शेतकऱ्याचे "मुंग्या अंडी घेऊन सुरक्षित स्थलांतर" हे प्रत्यक्ष निरीक्षण नोंदवून मॉडेलमध्ये पारदर्शक प्रायोगिक ॲडजस्टमेंट पहा.',
      descEn: 'Submit a crowdsourced "Ants moving eggs to high ground" bio-indicator report to visibly nudge the local forecast.',
      actionLabelMr: 'संकेत नोंदणी फॉर्म उघडा',
      actionLabelEn: 'Open Bio-Indicator Tap Form',
      action: () => {
        onSelectPanchayat(pimpalgaon);
        onOpenIntake();
      },
    },
    {
      step: 4,
      titleMr: '४. शेतकरी थेट कृषी सल्ला (मराठीमध्ये प्रथम)',
      titleEn: '4. Plain-Language Agro-Advisory Screen (Marathi First)',
      descMr: 'शेतकऱ्याला थेट कृषी सल्ला दिसतो: "आज संध्याकाळी हलका पाऊस शक्य — सिंचन उशिरा करा व फवारणी टाळा" (ऑडिओ वाचनासह).',
      descEn: 'Farmer sees direct plain-language actionable advice ("Delay irrigation this evening & suspend sprays") with audio speech synthesis.',
      actionLabelMr: 'शेतकरी सल्लागार स्क्रीन पहा',
      actionLabelEn: 'Go to Farmer Advisory Screen',
      action: () => {
        onSetLang('mr');
        onSelectPanchayat(pimpalgaon);
        setActiveTab('dashboard');
      },
    },
    {
      step: 5,
      titleMr: '५. इंग्रजी भाषा टॉगल व समारोप',
      titleEn: '5. Bilingual English Toggle & Closure',
      descMr: 'सल्ला इंग्रजीमध्ये तपासा आणि मुख्य प्रेक्षक शेतकरी असल्याने पुन्हा मराठीवर स्विच करून सादरीकरण पूर्ण करा.',
      descEn: 'Briefly toggle to English to demonstrate full dual-language support, then switch back to Marathi to conclude.',
      actionLabelMr: 'इंग्रजी / मराठी टॉगल करा',
      actionLabelEn: 'Toggle Language & Conclude',
      action: () => {
        onSetLang(lang === 'mr' ? 'en' : 'mr');
        setActiveTab('dashboard');
      },
    },
  ];

  const activeStepObj = steps[currentStep - 1];

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2F4638] via-[#2D6651] to-[#2F4638] text-white rounded-3xl p-6 shadow-md border border-[#263A31]">
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-[#C9A14A] text-[#2F4638] text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            SIH26074 • Official Demo Script
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white">
          {lang === 'mr' ? 'हॅकाथॉन परीक्षक प्रात्यक्षिक मार्गदर्शक' : 'Smart India Hackathon 5-Step Demo Script'}
        </h2>
        <p className="text-xs sm:text-sm text-[#F6F4EC]/80 font-medium mt-1">
          {lang === 'mr'
            ? 'खालील ५ पायऱ्यांवर क्लिक करून प्रकल्पाचे सर्व मुख्य पैलू एका क्रमाने सादर करा.'
            : 'Follow the 5-step evaluation script below to systematically demonstrate the end-to-end prototype.'}
        </p>
      </div>

      {/* Steps Progression Bar */}
      <div className="grid grid-cols-5 gap-2">
        {steps.map((s) => {
          const isDone = s.step < currentStep;
          const isCurrent = s.step === currentStep;
          return (
            <button
              key={s.step}
              onClick={() => setCurrentStep(s.step)}
              className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                isCurrent
                  ? 'bg-[#2F4638] text-white border-[#2F4638] shadow-md font-bold'
                  : isDone
                  ? 'bg-[#5A7852] text-white border-[#5A7852]'
                  : 'bg-[#E6E8DC] text-gray-700 border-gray-300/40 hover:bg-white'
              }`}
            >
              <span className="text-xs font-bold">पायरी {s.step}</span>
              <span className="text-[10px] hidden sm:block truncate mt-0.5">
                {s.step === 1 ? 'IMD Coarse' : s.step === 2 ? 'RF GP' : s.step === 3 ? 'Bio Report' : s.step === 4 ? 'Advisory' : 'Bilingual'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Step Showcase Card */}
      <div className="bg-[#E6E8DC] rounded-3xl p-6 border border-gray-300/40 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-300/30 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-[#C9A14A] text-[#2F4638] font-black text-sm flex items-center justify-center shadow-xs">
              {activeStepObj.step}
            </span>
            <h3 className="text-lg font-black text-[#2F4638]">
              {lang === 'mr' ? activeStepObj.titleMr : activeStepObj.titleEn}
            </h3>
          </div>
          <span className="text-xs font-mono font-bold bg-[#F6F4EC] text-[#2F4638] px-2.5 py-1 rounded-md border border-gray-300/40">
            Step {activeStepObj.step} of 5
          </span>
        </div>

        <p className="text-sm text-[#2F4638] leading-relaxed bg-[#F6F4EC] p-4 rounded-2xl border border-gray-300/40 font-medium">
          {lang === 'mr' ? activeStepObj.descMr : activeStepObj.descEn}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Navigation between steps */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentStep === 1}
              onClick={() => setCurrentStep((p) => Math.max(1, p - 1))}
              className="p-2.5 rounded-xl border border-gray-300/50 bg-[#F6F4EC] text-gray-700 hover:bg-white disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentStep === 5}
              onClick={() => setCurrentStep((p) => Math.min(5, p + 1))}
              className="p-2.5 rounded-xl border border-gray-300/50 bg-[#F6F4EC] text-gray-700 hover:bg-white disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Direct trigger action for step */}
          <button
            type="button"
            onClick={activeStepObj.action}
            className="bg-[#5A7852] hover:bg-[#466849] active:scale-95 text-white font-black text-xs sm:text-sm px-6 py-3 rounded-2xl shadow-sm transition flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{lang === 'mr' ? activeStepObj.actionLabelMr : activeStepObj.actionLabelEn}</span>
          </button>
        </div>
      </div>

      {/* Developer / Evaluator Testing Controls */}
      <div className="bg-[#2F4638] text-white rounded-3xl p-6 shadow-md border border-[#263A31] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <h4 className="text-sm font-bold text-white">
              {lang === 'mr' ? 'परीक्षक / डेव्हलपर सिम्युलेशन नियंत्रण' : 'Evaluator / Developer Testing Control'}
            </h4>
          </div>
          <span className="text-[10px] font-mono bg-[#C9A14A] text-[#2F4638] px-2 py-0.5 rounded font-bold">
            IMD &gt;64.5mm Test
          </span>
        </div>
        <p className="text-xs text-white/80">
          {lang === 'mr'
            ? 'ही कंट्रोल सेटिंग केवळ परीक्षकांसाठी आहे. आपत्कालीन अतिवृष्टी (Red Danger Mode) व आपत्कालीन बॅनर्स तपासण्यासाठी टॉगल करा:'
            : 'Developer toggle to test severe IMD rain danger mode (>64.5mm) and emergency banner state without cluttering farmer view:'}
        </p>
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => onToggleSimulateAlert?.(!simulateSevereAlert)}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
              simulateSevereAlert
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-[#B6413A] hover:bg-red-700 text-white animate-pulse'
            }`}
          >
            <span>{simulateSevereAlert ? '✅' : '🚨'}</span>
            <span>
              {simulateSevereAlert
                ? (lang === 'mr' ? 'सिम्युलेशन बंद करा (Stop Simulation)' : 'Stop Severe Simulation')
                : (lang === 'mr' ? 'अतिवृष्टी सिम्युलेट करा (Simulate Heavy Rain >64.5mm)' : 'Simulate Heavy Rain Alert (>64.5mm)')}
            </span>
          </button>
        </div>
      </div>

    </div>
  );
};
