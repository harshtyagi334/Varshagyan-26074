import React, { useState } from 'react';
import { AlertTriangle, BellRing, Send } from 'lucide-react';
import { Language, Panchayat, PanchayatAlert } from '../types';
import { DEMO_ALERT_EN } from '../data/demoWeatherScenario';

interface PanchayatAlertComposerProps {
  lang: Language;
  panchayat: Panchayat;
  activeAlert: PanchayatAlert | null;
  onPublish: (message: string, sourceLanguage: Language, severity: PanchayatAlert['severity']) => void;
  onClear: () => void;
}

export const PanchayatAlertComposer: React.FC<PanchayatAlertComposerProps> = ({
  lang,
  panchayat,
  activeAlert,
  onPublish,
  onClear,
}) => {
  const isMr = lang === 'mr';
  const [message, setMessage] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState<Language>('en');
  const [severity, setSeverity] = useState<PanchayatAlert['severity']>('info');

  const handlePublish = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanMessage = message.trim();
    if (!cleanMessage) return;
    onPublish(cleanMessage, sourceLanguage, severity);
    setMessage('');
  };

  const loadDemoAlert = () => {
    setSourceLanguage('en');
    setSeverity('info');
    setMessage(DEMO_ALERT_EN);
  };

  return (
    <section className="mt-5 rounded-3xl border border-[#2F4638]/15 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="official-alert-heading">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2F4638] text-[#C9A14A]">
          <BellRing className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 id="official-alert-heading" className="text-lg font-black text-[#2F4638] sm:text-xl">
            {isMr ? 'शेतकऱ्यांसाठी पंचायत सूचना' : 'Panchayat alert for farmers'}
          </h2>
          <p className="mt-1 text-sm text-[#2F4638]/70">
            {isMr ? 'निवडलेल्या ग्रामपंचायतीच्या शेतकरी दृश्यात सूचना पॉप-अप म्हणून दाखवा.' : 'Show a pop-up notice in the farmer view for the selected Panchayat.'}
          </p>
        </div>
      </div>

      <form onSubmit={handlePublish} className="mt-4 space-y-3">
        <div className="rounded-xl bg-[#F6F4EC] px-3 py-2 text-sm font-bold text-[#2F4638]">
          {isMr ? 'लक्ष्य ग्रामपंचायत: ' : 'Target Panchayat: '}{isMr ? panchayat.nameMr : panchayat.nameEn}
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_1fr]">
          <label className="block text-sm font-bold text-[#2F4638]" htmlFor="panchayat-alert-source-language">
            {isMr ? 'संदेशाची भाषा' : 'Message language'}
            <select
              id="panchayat-alert-source-language"
              value={sourceLanguage}
              onChange={(event) => setSourceLanguage(event.target.value as Language)}
              className="mt-1 block min-h-11 w-full rounded-xl border border-[#2F4638]/20 bg-white px-3 py-2 font-normal"
            >
              <option value="en">English</option>
              <option value="mr">मराठी</option>
            </select>
          </label>
          <label className="block text-sm font-bold text-[#2F4638]" htmlFor="panchayat-alert-message">
            {isMr ? 'एकच सूचना संदेश' : 'Single alert message'}
            <textarea
              id="panchayat-alert-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={280}
              required
              rows={3}
              placeholder={sourceLanguage === 'mr' ? 'उदा. पावसामुळे नदीकाठच्या सखल भागात जाणे टाळा.' : 'Example: Avoid low-lying areas near the stream due to rainfall.'}
              className="mt-1 block w-full rounded-xl border border-[#2F4638]/20 bg-white p-3 font-normal outline-none focus:border-[#5A7852] focus:ring-2 focus:ring-[#5A7852]/20"
            />
            <span className="mt-1 flex items-center justify-between gap-2 text-xs font-normal text-[#2F4638]/60">
              <button type="button" onClick={loadDemoAlert} className="rounded-lg bg-[#EAF0E3] px-2.5 py-1.5 font-bold text-[#2F5F3D] hover:bg-[#DCE9D4]">
                {isMr ? 'डेमो पावसाची सूचना भरा' : 'Load demo rain alert'}
              </button>
              <span>{message.length}/280</span>
            </span>
          </label>
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-[#2F4638]">
          <input
            type="checkbox"
            checked={severity === 'urgent'}
            onChange={(event) => setSeverity(event.target.checked ? 'urgent' : 'info')}
            className="h-4 w-4 accent-[#B6413A]"
          />
          <AlertTriangle className="h-4 w-4 text-[#B6413A]" aria-hidden="true" />
          {isMr ? 'तातडीची सूचना' : 'Mark as urgent'}
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={!message.trim()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2F4638] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#233B2F] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {isMr ? 'शेतकरी दृश्यात सूचना दाखवा' : 'Show alert in farmer view'}
          </button>
          {activeAlert && (
            <button type="button" onClick={onClear} className="min-h-11 rounded-xl border border-[#2F4638]/20 px-4 py-2.5 text-sm font-bold text-[#2F4638] hover:bg-[#F6F4EC]">
              {isMr ? 'सध्याची सूचना हटवा' : 'Clear current alert'}
            </button>
          )}
        </div>
      </form>

    </section>
  );
};
