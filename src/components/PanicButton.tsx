import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const OPEN_WHATSAPP_DELAY_MS = 800;

const buildEmergencyMessage = (locationUrl?: string) => {
  const locationPart = locationUrl || 'Location unavailable';
  return `I am in emergency. Please help me. My location: ${locationPart}`;
};

const openEmergencyWhatsApp = () => {
  const openWithText = (text: string) => {
    const link = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  if (!navigator.geolocation) {
    openWithText(buildEmergencyMessage());
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
      openWithText(buildEmergencyMessage(mapsUrl));
    },
    () => {
      openWithText(buildEmergencyMessage());
    },
    { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
  );
};

export default function PanicButton() {
  const { pathname } = useLocation();
  const { user, profile } = useAuth();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const shouldShow = useMemo(() => {
    if (!user) return false;
    const isStudent = profile?.role === 'student' || !profile?.role;
    if (!isStudent) return false;
    if (pathname === '/' || pathname.startsWith('/login')) return false;
    return true;
  }, [user, profile?.role, pathname]);

  if (!shouldShow) return null;

  const triggerEmergency = () => {
    setIsConfirmOpen(false);
    window.location.href = 'tel:112';

    window.setTimeout(() => {
      openEmergencyWhatsApp();
    }, OPEN_WHATSAPP_DELAY_MS);
  };

  return (
    <>
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-4 z-40 pointer-events-none">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setIsConfirmOpen(true)}
            className="w-[60px] h-[60px] rounded-full bg-[#FF0000] text-white text-2xl shadow-lg border border-red-300/30 pointer-events-auto"
            aria-label="Emergency panic button"
          >
            🚨
          </button>
        </div>
      </div>

      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface border border-zinc-700 rounded-xl p-5">
            <h3 className="text-lg font-bold">Are you in emergency?</h3>
            <p className="text-zinc-400 text-sm mt-1">Press YES to immediately call 112.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={triggerEmergency}
                className="bg-red-600 text-white font-semibold py-2 rounded-lg"
              >
                YES
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="bg-zinc-800 text-white font-semibold py-2 rounded-lg"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
