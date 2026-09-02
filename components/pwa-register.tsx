'use client';

import { useEffect } from 'react';

// Registers the service worker so the CRM can be installed as a PWA.
// Renders nothing — it only runs the registration side-effect once on mount.
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    // Register after load so it never competes with the initial page render.
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Service worker registration failed:', err);
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
