import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

const Disclaimer: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem('campanest_disclaimer_accepted');
    if (!accepted) {
      setShow(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('campanest_disclaimer_accepted', 'true');
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
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-[400px] bg-[#1E1E1E] rounded-2xl border border-zinc-800 p-6 shadow-2xl"
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle size={32} className="text-[#FF7A00]" />
            </div>

            <div className="space-y-6 text-left max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {/* Marathi Section */}
              <div className="space-y-3">
                <h2 className="text-xl font-bold text-white text-center">⚠️ महत्वाची सूचना</h2>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  CampaNest हे फक्त विद्यार्थ्यांना आणि सेवा पुरवठादारांना जोडणारे प्लॅटफॉर्म आहे.
                </p>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  आम्ही कोणत्याही सेवा, लिस्टिंग किंवा वापरकर्त्यांची पडताळणी करत नाही.
                </p>
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 space-y-2">
                  <p className="text-red-400 text-xs font-bold uppercase">⚠️ आम्ही खालील बाबींकरिता जबाबदार नाही:</p>
                  <ul className="text-zinc-400 text-xs space-y-1 list-disc pl-4">
                    <li>कोणताही फसवणूक किंवा स्कॅम</li>
                    <li>पेमेंट संबंधित समस्या</li>
                    <li>सेवांच्या गुणवत्तेचे प्रश्न</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <p className="text-zinc-300 text-sm font-bold">कोणतेही पेमेंट करण्यापूर्वी:</p>
                  <ul className="text-zinc-400 text-xs space-y-1">
                    <li className="flex items-start gap-2">✔ <span>प्रत्यक्ष जागेवर भेट द्या</span></li>
                    <li className="flex items-start gap-2">✔ <span>सेवा पुरवठादाराची पडताळणी करा</span></li>
                    <li className="flex items-start gap-2">✔ <span>सर्व माहिती स्वतः तपासा</span></li>
                  </ul>
                </div>
                <p className="text-zinc-500 text-[10px] italic text-center">ही सेवा वापरताना स्वतःची जबाबदारी घ्या.</p>
              </div>

              <div className="h-px bg-zinc-800 my-4" />

              {/* English Section */}
              <div className="space-y-3">
                <h2 className="text-xl font-bold text-white text-center">⚠️ Important Notice</h2>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  CampaNest is only a platform that connects students and service providers.
                </p>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  We do NOT verify any listings, services, or users.
                </p>
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 space-y-2">
                  <p className="text-red-400 text-xs font-bold uppercase">⚠️ We are NOT responsible for:</p>
                  <ul className="text-zinc-400 text-xs space-y-1 list-disc pl-4">
                    <li>Any fraud or scam</li>
                    <li>Payment-related issues</li>
                    <li>Service quality problems</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <p className="text-zinc-300 text-sm font-bold">Before making any payment:</p>
                  <ul className="text-zinc-400 text-xs space-y-1">
                    <li className="flex items-start gap-2">✔ <span>Visit the location physically</span></li>
                    <li className="flex items-start gap-2">✔ <span>Verify the provider</span></li>
                    <li className="flex items-start gap-2">✔ <span>Confirm all details yourself</span></li>
                  </ul>
                </div>
                <p className="text-zinc-500 text-[10px] italic text-center">Use this platform at your own risk.</p>
              </div>
            </div>

            <button 
              onClick={handleAccept}
              className="w-full mt-8 bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold py-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-orange-500/20"
            >
              I Understand & Continue
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Disclaimer;
