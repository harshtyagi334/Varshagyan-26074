import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, PhoneCall, Radio, Volume2, VolumeX, CheckCircle, Clock, AlertTriangle, ShieldCheck, Copy, Check, ChevronDown } from 'lucide-react';
import { DownscalingResult, Language, Panchayat } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { playSpeech, stopAllSpeech } from '../utils/audioSpeech';

interface OfflineAlertChannelProps {
  panchayat: Panchayat;
  downscalingResult: DownscalingResult;
  lang: Language;
  isUrgent?: boolean;
}

export const OfflineAlertChannel: React.FC<OfflineAlertChannelProps> = ({
  panchayat,
  downscalingResult,
  lang,
  isUrgent = false,
}) => {
  const t = TRANSLATIONS[lang];
  const [activeChannel, setActiveChannel] = useState<'sms' | 'ivr'>('sms');
  const [isIvrPlaying, setIsIvrPlaying] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [recipientPhone, setRecipientPhone] = useState('');

  // Short feature-phone SMS text (plain Marathi first, or English)
  const rain = downscalingResult.calibratedRainfall;

  const smsText = lang === 'mr'
    ? `${isUrgent ? 'हवामान सूचना' : 'वर्षा ज्ञान नमुना अंदाज'}: ${panchayat.nameMr} येथे आज अंदाजे ${rain} मिमी पाऊस (${downscalingResult.rainProbabilityPct}% शक्यता). स्थानिक अधिकृत सूचनांचे पालन करा. हा नमुना अंदाज आहे.`
    : `${isUrgent ? 'Weather alert' : 'VarshaGyan prototype forecast'}: About ${rain} mm rain (${downscalingResult.rainProbabilityPct}% chance) for ${panchayat.nameEn} today. Follow official local advisories. Prototype estimate, not an official forecast.`;

  const getIvrScript = (targetLang: Language) => {
    return isUrgent
      ? (targetLang === 'mr'
        ? `हवामान सूचना. ${panchayat.nameMr} येथे आज अंदाजे ${rain} मिलीमीटर पाऊस, शक्यता ${downscalingResult.rainProbabilityPct} टक्के. हा नमुना अंदाज आहे. अधिकृत स्थानिक सूचनांचे पालन करा.`
        : `Weather advisory for ${panchayat.nameEn}. About ${rain} millimeters of rain is estimated today, with ${downscalingResult.rainProbabilityPct} percent probability. This is a prototype estimate. Follow official local advisories.`)
      : (targetLang === 'mr'
        ? `वर्षा ज्ञान आवाज पूर्वावलोकन. ${panchayat.nameMr} ग्रामपंचायतीसाठी आजचा नमुना पावसाचा अंदाज ${rain} मिलीमीटर आहे. ही प्रात्यक्षिक माहिती आहे, अधिकृत अंदाज नाही. निर्णयासाठी स्थानिक अधिकृत सूचनांचे पालन करा.`
        : `VarshaGyan spoken preview for ${panchayat.nameEn} Gram Panchayat. The illustrative rainfall estimate for today is ${rain} millimeters. This is a prototype preview, not an official forecast. Follow official local advisories for decisions.`);
  };

  const isIvrPlayingRef = useRef<boolean>(false);
  useEffect(() => {
    isIvrPlayingRef.current = isIvrPlaying;
  }, [isIvrPlaying]);

  const handleToggleIvrSpeech = () => {
    if (isIvrPlaying) {
      stopAllSpeech();
      setIsIvrPlaying(false);
      return;
    }

    if (!('speechSynthesis' in window)) {
      alert(lang === 'mr' ? 'ऑडिओ सपोर्ट उपलब्ध नाही.' : 'Speech synthesis not supported.');
      return;
    }

    const script = getIvrScript(lang);
    setIsIvrPlaying(true);
    playSpeech({
      text: script,
      lang,
      rate: 0.9,
      onStart: () => setIsIvrPlaying(true),
      onEnd: () => setIsIvrPlaying(false),
      onError: () => setIsIvrPlaying(false),
    });
  };

  // Transfer audio immediately if user changes language while IVR is playing
  useEffect(() => {
    if (isIvrPlayingRef.current) {
      stopAllSpeech();
      const script = getIvrScript(lang);
      playSpeech({
        text: script,
        lang,
        rate: 0.9,
        onStart: () => setIsIvrPlaying(true),
        onEnd: () => setIsIvrPlaying(false),
        onError: () => setIsIvrPlaying(false),
      });
    }
  }, [lang]);

  useEffect(() => {
    return () => {
      stopAllSpeech();
    };
  }, []);

  const handleCopySms = () => {
    void navigator.clipboard.writeText(smsText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }).catch(() => setIsCopied(false));
  };

  const normalizedPhone = recipientPhone.replace(/[\s()-]/g, '');
  const canComposeSms = /^\+?[0-9]{7,15}$/.test(normalizedPhone);
  const smsHref = `sms:${normalizedPhone}?body=${encodeURIComponent(smsText)}`;

  return (
    <details id="sms-voice-alerts" open className="bg-[#E6E8DC] rounded-3xl border border-gray-300/40 shadow-sm group">
      <summary className="list-none cursor-pointer rounded-3xl p-4 sm:p-5 flex items-center gap-3 hover:bg-white/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F4638]">
        <span className="w-10 h-10 rounded-2xl bg-[#2F4638] text-white flex items-center justify-center shrink-0">
          <Radio className="w-5 h-5 text-[#C9A14A]" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-base sm:text-lg font-black text-[#2F4638]">{t.sms_log_header}</span>
          <span className="block text-xs text-[#2F4638]/70">
            {lang === 'mr' ? 'SMS तयार करा किंवा आवाजात सल्ला ऐका' : 'Compose an SMS or listen to a spoken advisory'}
          </span>
        </span>
        <ChevronDown className="w-5 h-5 text-[#2F4638] transition-transform group-open:rotate-180 shrink-0" />
      </summary>
      <div className="p-4 sm:p-6 pt-0 space-y-4">
      {/* Channel options and phone-message preview */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          {/* Channel Selector Pill */}
          <div className="flex items-center gap-1 bg-[#F6F4EC] p-1 rounded-xl border border-gray-300/40 text-xs">
            <button
              onClick={() => setActiveChannel('sms')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                activeChannel === 'sms'
                  ? 'bg-[#2F4638] text-white shadow-2xs'
                  : 'text-[#2F4638] hover:bg-[#E6E8DC]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{lang === 'mr' ? 'संदेश' : 'Text message'}</span>
            </button>
            <button
              onClick={() => setActiveChannel('ivr')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                activeChannel === 'ivr'
                  ? 'bg-[#2F4638] text-white shadow-2xs'
                  : 'text-[#2F4638] hover:bg-[#E6E8DC]'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5 text-[#C9A14A]" />
              <span>{lang === 'mr' ? 'आवाज पूर्वावलोकन' : 'Voice preview'}</span>
            </button>
          </div>
        </div>

        {/* Mandatory Honest Scope Disclaimer Banner */}
        <div className="bg-[#F6F4EC] border border-[#C9A14A]/40 rounded-2xl p-3 flex items-start gap-2 text-xs text-[#806000]">
          <ShieldCheck className="w-4 h-4 text-[#C9A14A] shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            <b>{lang === 'mr' ? 'प्रोटोटाइप सूचना:' : 'Prototype:'}</b> {t.sms_disclaimer}
          </span>
        </div>
      </div>

      {/* 2. SMS / spoken preview */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        
        {/* Left: Device Simulator Mockup */}
        <div className="md:col-span-7 bg-[#2F4638] text-white rounded-2xl p-4 border border-[#233B2F] space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between text-[11px] text-white/60 border-b border-white/10 pb-2">
              <span className="flex items-center gap-1 text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {activeChannel === 'sms' ? (lang === 'mr' ? 'SMS पूर्वावलोकन' : 'SMS preview') : (lang === 'mr' ? 'आवाज पूर्वावलोकन' : 'Voice preview')}
            </span>
            <span className="font-mono">{lang === 'mr' ? 'आजचा अंदाज' : 'Today’s estimate'}</span>
          </div>

          {activeChannel === 'sms' ? (
            /* SMS Bubble */
            <div className="space-y-2">
              <div className="bg-[#233B2F] p-3.5 rounded-xl border border-white/10 text-xs font-mono leading-relaxed text-emerald-300">
                {smsText}
              </div>
              <div className="text-[10px] text-white/60">{smsText.length} {lang === 'mr' ? 'अक्षरे' : 'characters'}</div>
            </div>
          ) : (
            /* Local spoken preview */
            <div className="space-y-3 text-center py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-400/40 animate-pulse text-xl">
                📞
              </div>
              <div>
                <div className="font-bold text-sm text-white">
                  {lang === 'mr' ? 'डिव्हाइसवरील आवाज पूर्वावलोकन' : 'On-device voice preview'}
                </div>
                <div className="text-xs text-white/70">
                  {lang === 'mr' ? `ग्रामपंचायत ${panchayat.nameMr} · फोन कॉल नाही` : `${panchayat.nameEn} Panchayat · no phone call`}
                </div>
              </div>
              <p className="text-[11px] text-white/80 bg-[#233B2F] p-2.5 rounded-xl border border-white/10 italic text-left max-h-24 overflow-y-auto">
                "{getIvrScript(lang)}"
              </p>
            </div>
          )}
        </div>

        {/* Right: Controls & Broadcast Action */}
        <div className="md:col-span-5 space-y-3">
          {activeChannel === 'sms' ? (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#2F4638]">
                {lang === 'mr' ? 'प्राप्तकर्त्याचा फोन नंबर' : 'Recipient phone number'}
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={recipientPhone}
                  onChange={(event) => setRecipientPhone(event.target.value)}
                  placeholder={lang === 'mr' ? '+९१ ९८७६५ ४३२१०' : '+91 98765 43210'}
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 font-normal"
                />
              </label>
              <a
                href={smsHref}
                aria-disabled={!canComposeSms}
                onClick={(event) => { if (!canComposeSms) event.preventDefault(); }}
                className={`w-full font-bold text-xs py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 ${canComposeSms ? 'bg-[#2F4638] hover:bg-[#233B2F] text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>{lang === 'mr' ? 'SMS अॅपमध्ये उघडा' : 'Open in SMS app'}</span>
              </a>
              <p className="text-[11px] text-[#2F4638]/70">{lang === 'mr' ? 'तुमच्या फोनचे SMS अॅप उघडेल. पाठवण्यापूर्वी संदेश तपासा; वाहक शुल्क लागू होऊ शकते.' : 'Opens your device messaging app. Review and send the message there; carrier charges may apply.'}</p>
              <button
                type="button"
                onClick={handleCopySms}
                className="w-full bg-[#2F4638] hover:bg-[#233B2F] text-white font-bold text-xs py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{isCopied ? (lang === 'mr' ? 'कॉपी झाले!' : 'Copied!') : (lang === 'mr' ? 'SMS मजकूर कॉपी करा' : 'Copy SMS text')}</span>
              </button>
              <div className="text-[11px] text-[#2F4638]/70 leading-relaxed bg-[#F6F4EC] p-3 rounded-xl border border-gray-300/40">
                💡 <b>{lang === 'mr' ? 'SMS पाठवणे:' : 'SMS delivery:'}</b> {lang === 'mr' ? 'हा प्रोटोटाइप थेट SMS पाठवत नाही; फोनच्या संदेश अॅपमधून वापरकर्ता पाठवतो.' : 'This prototype does not send SMS automatically; you send it from your messaging app.'}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleToggleIvrSpeech}
                className={`w-full font-bold text-xs py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
                  isIvrPlaying
                    ? 'bg-[#B6413A] text-white animate-pulse'
                    : 'bg-[#2F4638] hover:bg-[#233B2F] text-white'
                }`}
              >
                {isIvrPlaying ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#C9A14A]" />}
                <span>{isIvrPlaying ? (lang === 'mr' ? 'आवाज थांबवा' : 'Stop voice') : (lang === 'mr' ? 'आवाजातील सूचना ऐका' : 'Listen to spoken advisory')}</span>
              </button>
              <div className="text-[11px] text-[#2F4638]/70 leading-relaxed bg-[#F6F4EC] p-3 rounded-xl border border-gray-300/40">
                🔊 <b>{lang === 'mr' ? 'आवाजातील सूचना:' : 'Voice advisory:'}</b> {lang === 'mr' ? 'BHASHINI टेक्स्ट-टू-स्पीच उपलब्ध असल्यास वापरले जाते; अन्यथा डिव्हाइसचा आवाज वापरला जातो. हा फोन कॉल नाही.' : 'Uses BHASHINI text-to-speech when configured, with device voice fallback. This does not place a phone call.'}
              </div>
            </div>
          )}
        </div>

      </div>
      </div>
    </details>
  );
};
