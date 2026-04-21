import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import EmergencyContactsSection from '../components/EmergencyContactsSection';
import CustomPopup from '../components/CustomPopup';

export default function EmergencyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-20">
      <CustomPopup message="Emergency Alert!" isEmergency={true} />
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-zinc-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/home')} aria-label="Back to home">
          <ChevronLeft />
        </button>
        <div>
          <h1 className="text-lg font-bold text-primary">🚨 Emergency</h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Quick Help</p>
        </div>
      </header>

      <main className="px-6 py-4">
        <EmergencyContactsSection />
      </main>
    </div>
  );
}
