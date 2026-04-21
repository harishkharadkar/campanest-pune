import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePWA } from '../context/PWAContext';
import CampaNestLogo from './CampaNestLogo';

const SESSION_KEY = 'campanest_install_prompt_closed_session';

const PWAInstallPrompt: React.FC = () => {
  const [show, setShow] = useState(false);
  const { user } = useAuth();
  const { isInstallable, installApp } = usePWA();

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isAndroid = /Android/.test(navigator.userAgent);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInstalled = localStorage.getItem('campanest_installed') === 'true';
    const closedInSession = sessionStorage.getItem(SESSION_KEY) === 'true';

    if (isStandalone || isInstalled || closedInSession) return;

    if (user && (isInstallable || isIOS || isAndroid)) {
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [user, isInstallable, isIOS, isAndroid]);

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem(SESSION_KEY, 'true');
  };

  const handleInstall = async () => {
    if (isInstallable) {
      setShow(false);
      await installApp();
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
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                {isInstallable ? (
                  <>
                    <p className="text-white/90 text-sm mt-3 leading-snug">
                      Add to home screen for faster access and offline support.
                    </p>
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => void handleInstall()}
                        className="flex-1 bg-primary text-white text-xs font-bold py-2.5 rounded-lg"
                      >
                        Install App
                      </button>
                      <button
                        onClick={handleDismiss}
                        className="flex-1 bg-zinc-800 text-zinc-300 text-xs font-bold py-2.5 rounded-lg border border-zinc-700"
                      >
                        Later
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="mt-3 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                    <p className="text-white text-xs font-bold mb-2">How to Install</p>
                    {isIOS ? (
                      <p className="text-zinc-400 text-[11px] leading-relaxed">
                        Tap Share in Safari, then choose "Add to Home Screen".
                      </p>
                    ) : isAndroid ? (
                      <p className="text-zinc-400 text-[11px] leading-relaxed">
                        Tap menu in Chrome, then choose "Add to Home Screen".
                      </p>
                    ) : (
                      <p className="text-zinc-400 text-[11px] leading-relaxed">
                        Open this site on mobile Chrome or Safari to install.
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
