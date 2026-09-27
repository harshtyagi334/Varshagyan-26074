import React, { useEffect, useRef, useState } from 'react';
import { Compass, Languages, Bug, ChevronDown, Info, X, Settings2 } from 'lucide-react';
import { Language, Panchayat } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { NASHIK_BLOCKS, PANCHAYATS_DATA } from '../data/nashikGeoData';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  lang: Language;
  onToggleLang: () => void;
  activeTab: 'dashboard' | 'map' | 'intake' | 'science' | 'demo';
  setActiveTab: (tab: 'dashboard' | 'map' | 'intake' | 'science' | 'demo') => void;
  selectedPanchayat: Panchayat;
  onSelectPanchayat: (p: Panchayat) => void;
  onOpenIntake: () => void;
  isUrgent?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  lang,
  onToggleLang,
  activeTab,
  setActiveTab,
  selectedPanchayat,
  onSelectPanchayat,
  onOpenIntake,
  isUrgent = false,
}) => {
  const t = TRANSLATIONS[lang];
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [showActionsMenu, setShowActionsMenu] = useState<boolean>(false);
  const [showVillageMenu, setShowVillageMenu] = useState<boolean>(false);
  const villageMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showVillageMenu) return;
    const closeWhenOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !villageMenuRef.current?.contains(event.target)) {
        setShowVillageMenu(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowVillageMenu(false);
    };
    document.addEventListener('pointerdown', closeWhenOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeWhenOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [showVillageMenu]);

  return (
    <header className="sticky top-0 z-40 bg-[#3B4840] text-white border-b border-[#29362F] shadow-sm w-full">
      {/* Top Emergency Indicator (only shown if urgent) */}
      {isUrgent && (
        <div className="w-full px-3 sm:px-6 py-1.5 text-xs bg-[#B6413A] text-white flex justify-between items-center font-bold animate-pulse">
          <span>🚨 {lang === 'mr' ? 'अतिवृष्टी आपत्कालीन इशारा' : 'CRITICAL WEATHER ALERT'}</span>
          <span className="text-[10px] uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded">Action Required</span>
        </div>
      )}

      {/* Main Navbar Header: Fluid Flex-Col on Mobile -> Flex-Row on Desktop */}
      <div className="w-full px-3 sm:px-5 lg:px-7 2xl:px-10 py-3 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        
        {/* Row 1: Logo & App Branding */}
        <div className="flex items-center justify-between gap-3">
          <div
            className="flex items-center gap-3 cursor-pointer select-none group"
            onClick={() => setActiveTab('dashboard')}
          >
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-inner border border-white/20 transition-all ${
              isUrgent ? 'bg-[#B6413A] animate-pulse' : 'bg-[#2F4638]'
            }`}>
              <svg viewBox="0 0 48 48" className="w-8 h-8" role="img" aria-label={lang === 'mr' ? 'पाऊस आणि पीक' : 'Rain and crops'}>
                <path d="M11 25.5a6.5 6.5 0 0 1 1-12.9 12 12 0 0 1 22.7 2.8 5.7 5.7 0 0 1 .6 11.3H11Z" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="m17 30-2 4m10-4-2 4m10-4-2 4" fill="none" stroke="#C9A14A" strokeWidth="2.8" strokeLinecap="round" />
                <path d="M24 42v-5m0 3c-3.5 0-5.4-1.8-5.7-4.7 3.2-.1 5.2 1.5 5.7 4.7Zm0-1.3c.2-3.1 2.2-4.8 5.7-4.8-.1 3-2.2 4.7-5.7 4.8Z" fill="#99A873" stroke="#99A873" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-none">
                  {lang === 'mr' ? 'वर्षा ज्ञान' : 'VarshaGyan'}
                </h1>
              </div>
              <p className="text-[11px] text-white/80 font-normal mt-0.5">
                {t.appTagline}
              </p>
            </div>
          </div>

          <button type="button" onClick={() => setShowActionsMenu((open) => !open)} aria-label={lang === 'mr' ? 'अधिक पर्याय' : 'More options'} aria-expanded={showActionsMenu} className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15">
            <Settings2 className="w-5 h-5" />
          </button>
        </div>

        {/* Row 2: Oversized Touch Selectors & Actions for Field-Grade Smartphones */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          
          {/* Custom village menu keeps labels left-aligned across browsers */}
          <div className="relative flex-1 sm:w-72 md:w-80" ref={villageMenuRef}>
            <button
              type="button"
              id="village-selector"
              aria-haspopup="listbox"
              aria-expanded={showVillageMenu}
              aria-controls="village-options"
              onClick={() => setShowVillageMenu((open) => !open)}
              className="w-full min-h-[58px] flex items-center gap-2.5 bg-[#263A31] hover:bg-[#1D252E] px-3.5 py-2 rounded-xl border-2 border-white/20 shadow-sm transition text-left"
            >
              <Compass className="w-5 h-5 text-[#C9A14A] shrink-0" />
              <span className="flex flex-col flex-1 min-w-0">
                <span className="text-[10px] text-[#F6F4EC]/70 font-semibold uppercase leading-tight">
                  {lang === 'mr' ? 'गाव / ग्रामपंचायत निवडा' : 'Select Gram Panchayat'}
                </span>
                <span className="text-sm font-bold text-[#F6F4EC] leading-5 truncate">
                  {lang === 'mr' ? selectedPanchayat.nameMr : selectedPanchayat.nameEn}
                  {' ('}{lang === 'mr'
                    ? NASHIK_BLOCKS.find((block) => block.id === selectedPanchayat.blockId)?.nameMr
                    : NASHIK_BLOCKS.find((block) => block.id === selectedPanchayat.blockId)?.nameEn}{')'}
                </span>
              </span>
              <ChevronDown className="w-4 h-4 text-[#F6F4EC]/70 shrink-0 transition-transform" style={{ transform: showVillageMenu ? 'rotate(180deg)' : undefined }} />
            </button>

            {showVillageMenu && (
              <div
                id="village-options"
                role="listbox"
                aria-labelledby="village-selector"
                className="absolute left-0 top-full z-[60] mt-2 w-[min(28rem,calc(100vw-1.5rem))] max-h-[min(70vh,30rem)] overflow-y-auto rounded-xl border border-white/20 bg-[#2F4638] p-2 shadow-2xl"
              >
                {NASHIK_BLOCKS.map((block) => (
                  <div key={block.id} role="group" aria-label={lang === 'mr' ? block.nameMr : block.nameEn}>
                    <div className="px-3 pt-2.5 pb-1 text-xs font-extrabold tracking-wide text-[#C9A14A]">
                      {lang === 'mr' ? block.nameMr : block.nameEn} {lang === 'mr' ? 'तालुका' : 'Block'}
                    </div>
                    {PANCHAYATS_DATA.filter((panchayat) => panchayat.blockId === block.id).map((panchayat) => {
                      const isSelected = panchayat.id === selectedPanchayat.id;
                      const villageName = lang === 'mr' ? panchayat.nameMr : panchayat.nameEn;
                      const blockName = lang === 'mr' ? block.nameMr : block.nameEn;
                      return (
                        <button
                          key={panchayat.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          title={villageName + ' (' + blockName + ')'}
                          onClick={() => {
                            onSelectPanchayat(panchayat);
                            setShowVillageMenu(false);
                          }}
                          className={isSelected
                            ? 'w-full min-h-10 rounded-lg px-3 py-2 text-left text-sm leading-5 transition bg-[#5A7852] text-white font-bold'
                            : 'w-full min-h-10 rounded-lg px-3 py-2 text-left text-sm leading-5 transition text-[#F6F4EC] hover:bg-white/10'}
                        >
                          <span className="block truncate">
                            {villageName}
                            <span className={isSelected ? 'text-white/80 font-medium' : 'text-white/60'}>
                              {' '}({blockName})
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Warm Turmeric Ochre Accent Language Switcher */}
          <button
            type="button"
            onClick={onToggleLang}
            className="w-full sm:w-auto h-12 sm:h-auto py-2.5 px-4 rounded-xl text-sm font-black bg-white/10 hover:bg-white/20 active:scale-95 text-[#F6F4EC] border-2 border-white/25 shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            title="Switch Language / भाषा बदला"
          >
            <Languages className="w-4 h-4 text-[#C9A14A]" />
            <span>{t.switchLang}</span>
          </button>

        </div>
      </div>

      {showActionsMenu && (
        <div className="w-full px-3 sm:px-5 lg:px-7 2xl:px-10 pb-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => { onOpenIntake(); setShowActionsMenu(false); }} className="flex items-center gap-2 rounded-xl bg-[#5A7852] px-3 py-2 text-xs font-bold text-white hover:bg-[#466849]"><Bug className="w-4 h-4" />{lang === 'mr' ? 'पारंपारिक संकेत नोंदवा' : 'Record traditional signs'}</button>
          <button type="button" onClick={() => { setShowInfoModal(true); setShowActionsMenu(false); }} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"><Info className="w-4 h-4" />{lang === 'mr' ? 'सिस्टम माहिती' : 'System information'}</button>
          <PWAInstallButton lang={lang} />
        </div>
      )}

      {/* Navigation Tabs Bar with Horizontal Scroll for Mobile */}
      <nav className="w-full bg-[#263A31]/90 border-t border-white/10 px-3 sm:px-6">
        <div className="w-full min-w-0 grid grid-cols-2 gap-1 px-1 text-xs py-1.5 sm:flex sm:overflow-x-auto sm:scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`min-w-0 flex flex-col sm:flex-row sm:flex-1 items-center justify-center text-center leading-tight gap-1.5 px-1.5 sm:px-4 py-2.5 rounded-xl font-bold whitespace-normal sm:whitespace-nowrap transition cursor-pointer text-xs sm:text-sm ${
              activeTab === 'dashboard'
                ? 'bg-[#F6F4EC] text-[#2F4638] shadow-md ring-2 ring-white/30'
                : 'text-[#F6F4EC]/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span>🌾</span>
            <span className="min-w-0 break-words">{t.tabDashboard}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`min-w-0 flex flex-col sm:flex-row sm:flex-1 items-center justify-center text-center leading-tight gap-1.5 px-1.5 sm:px-4 py-2.5 rounded-xl font-bold whitespace-normal sm:whitespace-nowrap transition cursor-pointer text-xs sm:text-sm ${
              activeTab === 'map'
                ? 'bg-[#F6F4EC] text-[#2F4638] shadow-md ring-2 ring-white/30'
                : 'text-[#F6F4EC]/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span>🗺️</span>
            <span className="min-w-0 break-words">{t.tabMap}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('intake')}
            className={`min-w-0 flex flex-col sm:flex-row sm:flex-1 items-center justify-center text-center leading-tight gap-1.5 px-1.5 sm:px-4 py-2.5 rounded-xl font-bold whitespace-normal sm:whitespace-nowrap transition cursor-pointer text-xs sm:text-sm ${
              activeTab === 'intake'
                ? 'bg-[#5A7852] text-white shadow-md ring-2 ring-[#5A7852]/50'
                : 'text-[#F6F4EC]/80 hover:bg-[#5A7852]/40 hover:text-white'
            }`}
          >
            <span>🐜</span>
            <span className="min-w-0 break-words">{t.tabIntake}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('science')}
            className={`min-w-0 flex flex-col sm:flex-row sm:flex-1 items-center justify-center text-center leading-tight gap-1.5 px-1.5 sm:px-4 py-2.5 rounded-xl font-bold whitespace-normal sm:whitespace-nowrap transition cursor-pointer text-xs sm:text-sm ${
              activeTab === 'science'
                ? 'bg-[#F6F4EC] text-[#2F4638] shadow-md ring-2 ring-white/30'
                : 'text-[#F6F4EC]/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span>⚙️</span>
            <span className="min-w-0 break-words">{t.tabScience}</span>
          </button>

        </div>
      </nav>

      {/* System Technical Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-[#3B4840] border border-white/20 p-6 text-white shadow-2xl relative">
            <button
              onClick={() => setShowInfoModal(false)}
              className="absolute top-4 right-4 text-white/70 hover:text-white p-1 rounded-lg bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-base font-bold text-white">
                {lang === 'mr' ? 'सिस्टम माहिती व डेटा संच' : 'System Mesh & Live Status'}
              </h3>
            </div>

            <div className="space-y-3 text-xs text-white/85 leading-relaxed">
              <div className="bg-black/20 p-3 rounded-xl border border-white/10">
                <div className="font-bold text-[#C9A14A] mb-1">IMD Gridded Dataset</div>
                <p>IMD 0.25° Mesh Gridded Forecast + 30m SRTM Topographic Digital Elevation Model.</p>
              </div>

              <div className="bg-black/20 p-3 rounded-xl border border-white/10">
                <div className="font-bold text-emerald-300 mb-1">Live Synchronization</div>
                <p>{lang === 'mr' ? 'लाईव्ह API कनेक्शन आणि सर्व्हर कॅशे सक्रिय.' : 'Live API connection and offline PWA cache active.'}</p>
              </div>
            </div>

            <button
              onClick={() => setShowInfoModal(false)}
              className="mt-5 w-full rounded-xl bg-[#2B6CB0] py-2.5 text-sm font-bold text-white hover:bg-[#1D4ED8] transition"
            >
              {lang === 'mr' ? 'समजले (Close)' : 'Got It'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

