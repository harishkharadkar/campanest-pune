import React, { useState } from 'react';

interface WarningPopupProps {
  message: string;
  isEmergency?: boolean;
}

export default function WarningPopup({ message, isEmergency = false }: WarningPopupProps) {
  const [show, setShow] = useState(true);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 px-4 warning-popup-fade">
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
          isEmergency
            ? 'border-red-500/60 bg-zinc-950 text-red-100'
            : 'border-zinc-700 bg-zinc-900 text-zinc-100'
        }`}
      >
        {!isEmergency && (
          <button
            type="button"
            onClick={() => setShow(false)}
            aria-label="Close warning"
            className="absolute right-3 top-3 h-8 w-8 rounded-full bg-zinc-800 text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
          >
            X
          </button>
        )}

        <p className={`pr-8 text-sm leading-relaxed ${isEmergency ? 'text-red-200' : 'text-zinc-100'}`}>
          {message}
        </p>
      </div>
    </div>
  );
}
