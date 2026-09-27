import React, { useEffect, useState } from 'react';
import { Download, WifiOff, Wifi } from 'lucide-react';
import { Language } from '../types';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PWAInstallButtonProps {
  lang: Language;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ lang }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const isInstallable = !!deferredPrompt;

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Persistent Connectivity Status Indicator */}
      {isOnline ? (
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-xs"
          title={lang === 'mr' ? 'कनेक्टिव्हिटी: लाईव्ह डेटा सक्रिय' : 'Connectivity: Live API Data Active'}
        >
          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">{lang === 'mr' ? 'लाईव्ह' : 'Live Online'}</span>
        </div>
      ) : (
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold animate-pulse shadow-xs"
          title={lang === 'mr' ? 'ऑफलाइन मोड: सर्व्हिस वर्कर कॅशेमधून डेटा दाखवला जात आहे' : 'Offline Mode: Serving from Local Service Worker Cache'}
        >
          <WifiOff className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">{lang === 'mr' ? 'कॅशे (ऑफलाइन)' : 'PWA Cache'}</span>
        </div>
      )}

      {/* Install Button (if installable and not already installed) */}
      {!isInstalled && isInstallable && (
        <button
          onClick={handleInstall}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E3A8A] text-white font-extrabold text-xs shadow-sm transition active:scale-95"
          title={lang === 'mr' ? 'ॲप इन्स्टॉल करा (ऑफलाइन वापरासाठी)' : 'Install PWA for Offline Use'}
        >
          <Download className="w-3.5 h-3.5 text-blue-200" />
          <span>{lang === 'mr' ? 'ॲप इन्स्टॉल करा' : 'Install App'}</span>
        </button>
      )}

      {/* iOS Install Prompt Button */}
      {!isInstalled && isIOS && !isInstallable && (
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs border border-white/20 transition"
        >
          <Download className="w-3.5 h-3.5 text-blue-200" />
          <span>{lang === 'mr' ? 'iOS इन्स्टॉल' : 'Install iOS'}</span>
        </button>
      )}

      {/* iOS Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-[#1E3A8A] border border-blue-400/30 p-6 text-white shadow-2xl">
            <h3 className="text-lg font-bold text-amber-300">
              {lang === 'mr' ? 'आयफोन / आयपॅडवर इन्स्टॉल करा' : 'Install on iPhone / iPad'}
            </h3>
            <p className="mt-3 text-sm text-white/90 leading-relaxed">
              {lang === 'mr'
                ? '१. सफारी ब्राउझरच्या खालील **शेअर (Share)** बटणावर क्लिक करा.\n२. खाली स्क्रोल करून **"Add to Home Screen"** निवडा.'
                : '1. Tap the Share button in Safari toolbar.\n2. Scroll down and tap "Add to Home Screen".'}
            </p>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-xl bg-[#1D4ED8] py-2.5 text-sm font-bold text-white hover:bg-[#1E3A8A] transition border border-white/20"
            >
              {lang === 'mr' ? 'समजले (Close)' : 'Got It'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
