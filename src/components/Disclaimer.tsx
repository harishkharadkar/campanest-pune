import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

const SESSION_KEY = 'campanest_disclaimer_closed_session';

const Disclaimer: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const closed = sessionStorage.getItem(SESSION_KEY) === 'true';
    if (!closed) setShow(true);
  }, []);

  const closeTemporarily = () => {
    sessionStorage.setItem(SESSION_KEY, 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-[#121212] flex items-center justify-center p-6 overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-[420px] bg-[#1E1E1E] rounded-2xl border border-zinc-800 p-6 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center">
              <AlertTriangle size={24} className="text-[#FF7A00]" />
            </div>
            <button
              onClick={closeTemporarily}
              className="p-1 rounded text-zinc-500 hover:text-white"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <h2 className="text-xl font-bold text-white mt-4">Important Notice</h2>
          <p className="text-zinc-300 text-sm mt-3 leading-relaxed">
            CampaNest is a discovery platform. Please verify listings, providers, and payment details independently before any transaction.
          </p>
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
            <ul className="text-xs text-zinc-400 space-y-1 list-disc pl-4">
              <li>Verify service quality in person</li>
              <li>Do not pay in advance without confirmation</li>
              <li>Use your own judgment before finalizing</li>
            </ul>
          </div>

          <button
            onClick={closeTemporarily}
            className="w-full mt-6 bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold py-3 rounded-xl transition-all"
          >
            I Understand & Continue
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Disclaimer;
