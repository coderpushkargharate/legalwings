'use client';

import React, { useEffect, useState } from 'react';
import { Download, Share, X, Plus } from 'lucide-react';

// Chromium fires this before showing its own install UI; we capture it so we can
// trigger installation from our own button instead.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isIos = () =>
  typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

// True when the app is already running as an installed PWA (standalone window).
const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari exposes this non-standard flag instead of display-mode.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true);

// "Install App" control for the header — visible on every panel (admin + employee).
// Uses the native install prompt on Android/Windows/Chrome/Edge, and shows
// Add-to-Home-Screen instructions on iOS (which has no programmatic prompt).
export default function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setInstalled(isStandalone());

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // stop Chrome's mini-infobar; we'll prompt on click
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      setDeferred(null);
    } else if (isIos()) {
      setShowIosHelp(true);
    }
  };

  // Nothing to show once installed, or on a browser that can't install and isn't iOS.
  if (!mounted || installed) return null;
  const canShow = !!deferred || isIos();
  if (!canShow) return null;

  return (
    <>
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#00843d] hover:bg-[#00622d] rounded-lg transition-colors shadow-sm"
        title="Install LegalWings as an app"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Install App</span>
      </button>

      {showIosHelp && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={() => setShowIosHelp(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-base font-semibold text-slate-800">Install on iPhone / iPad</h3>
              <button onClick={() => setShowIosHelp(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <ol className="space-y-3 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-semibold">1</span>
                Tap the <Share className="w-4 h-4 inline text-blue-600" /> <strong>Share</strong> button in Safari.
              </li>
              <li className="flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-semibold">2</span>
                Choose <Plus className="w-4 h-4 inline" /> <strong>Add to Home Screen</strong>.
              </li>
              <li className="flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-semibold">3</span>
                Tap <strong>Add</strong> — LegalWings will appear on your home screen.
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
