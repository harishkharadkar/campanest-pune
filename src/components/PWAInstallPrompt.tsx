import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePWA } from '../context/PWAContext';
import CampaNestLogo from './CampaNestLogo';

const PWAInstallPrompt: React.FC = () => {
  const [show, setShow] = useState(false);
  const { user } = useAuth();
  const { isInstallable, installApp } = usePWA();

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isAndroid = /Android/.test(navigator.userAgent);

  useEffect(() => {
    // Don't show if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInstalled = localStorage.getItem('campanest_installed') === 'true';
    
    if (isStandalone || isInstalled) {
      console.log("PWA: App already installed, hiding prompt");
      return;
    }

    // Show prompt if installable OR if it's a mobile device (for manual guide)
    if (user && (isInstallable || isIOS || isAndroid)) {
      const dismissed = localStorage.getItem('campanest_install_dismissed') === 'true';
      const shouldShow = !dismissed;

      if (shouldShow) {
        console.log("PWA: Showing install prompt (Manual or Auto)");
        // Delay showing to not overwhelm the user
        const timer = setTimeout(() => setShow(true), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [user, isInstallable, isIOS, isAndroid]);

  const handleDismiss = () => {
    console.log("PWA: User dismissed prompt (Not Now)");
    setShow(false);
    localStorage.setItem('campanest_install_dismissed', 'true');
  };

  const handleInstall = async () => {
    if (isInstallable) {
      console.log("PWA: Triggering auto install");
      setShow(false);
      await installApp();
    } else {
      console.log("PWA: Manual install guide shown");
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-24 left-4 right-4 z-50 max-w-[480px] mx-auto"
        >
          <div className="bg-[#1E1E1E] border border-zinc-800 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl overflow-hidden shadow-lg flex-shrink-0">
                <CampaNestLogo size={56} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-white font-bold text-base">Install CampaNest</h4>
                    <p className="text-zinc-400 text-xs mt-0.5">Your campus. Your neighbourhood.</p>
                  </div>
                  <button 
                    onClick={handleDismiss}
                    className="p-1 -mr-1 text-zinc-500 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
                
                {isInstallable ? (
                  <>
                    <p className="text-white/90 text-sm mt-3 leading-snug">
                      📲 Add to home screen for faster access and offline features.
                    </p>
                    <div className="flex gap-3 mt-4">
                      <button 
                        onClick={handleInstall}
                        className="flex-1 bg-primary text-white text-xs font-bold py-2.5 rounded-lg active:scale-95 transition-all shadow-lg shadow-primary/20"
                      >
                        Install App
                      </button>
                      <button 
                        onClick={handleDismiss}
                        className="flex-1 bg-zinc-800 text-zinc-300 text-xs font-bold py-2.5 rounded-lg active:scale-95 transition-all border border-zinc-700"
                      >
                        Later
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="mt-3 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                    <p className="text-white text-xs font-bold mb-2">How to Install:</p>
                    {isIOS ? (
                      <p className="text-zinc-400 text-[11px] leading-relaxed">
                        Tap the <span className="text-primary font-bold">Share</span> button in Safari, then scroll down and select <span className="text-primary font-bold">"Add to Home Screen"</span>.
                      </p>
                    ) : isAndroid ? (
                      <p className="text-zinc-400 text-[11px] leading-relaxed">
                        Tap the <span className="text-primary font-bold">Menu (⋮)</span> button in Chrome, then select <span className="text-primary font-bold">"Add to Home Screen"</span>.
                      </p>
                    ) : (
                      <p className="text-zinc-400 text-[11px] leading-relaxed">
                        Open this site in Chrome or Safari on your mobile device to install.
                      </p>
                    )}
                    <button 
                      onClick={handleDismiss}
                      className="w-full mt-3 bg-zinc-800 text-zinc-300 text-[10px] font-bold py-2 rounded-lg"
                    >
                      Got it
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PWAInstallPrompt;
