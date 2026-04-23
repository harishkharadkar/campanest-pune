import React, { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from '../components/Toast';

interface PWAContextType {
  deferredPrompt: any;
  installApp: () => Promise<void>;
  isInstallable: boolean;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export const PWAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const beforeInstallHandler = (e: any) => {
      console.log('PWA: beforeinstallprompt event fired');
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const appInstalledHandler = () => {
      console.log('PWA: App installed successfully');
      setDeferredPrompt(null);
      setIsInstallable(false);
      localStorage.setItem('campanest_installed', 'true');
      showToast('App installed successfully!', 'success');
    };

    window.addEventListener('beforeinstallprompt', beforeInstallHandler);
    window.addEventListener('appinstalled', appInstalledHandler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      localStorage.setItem('campanest_installed', 'true');
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstallHandler);
      window.removeEventListener('appinstalled', appInstalledHandler);
    };
  }, [showToast]);

  const installApp = async () => {
    console.log('PWA: installApp called');
    try {
      if (!deferredPrompt) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        if (isIOS) {
          showToast('To install on iOS: tap Share, then Add to Home Screen.', 'info');
        } else {
          showToast('Install prompt unavailable. Open browser menu and tap Install app or Add to Home Screen.', 'info');
        }
        return;
      }

      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('PWA: User accepted the install prompt');
        localStorage.setItem('campanest_installed', 'true');
      } else {
        console.log('PWA: User dismissed the install prompt');
      }

      setDeferredPrompt(null);
      setIsInstallable(false);
    } catch (error) {
      console.error('PWA: Install error', error);
      showToast('Something went wrong during installation', 'error');
    }
  };

  return (
    <PWAContext.Provider value={{ deferredPrompt, installApp, isInstallable }}>
      {children}
    </PWAContext.Provider>
  );
};

export const usePWA = () => {
  const context = useContext(PWAContext);
  if (context === undefined) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
};
