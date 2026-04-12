import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Mail, MessageCircle, Phone, Smartphone } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import CampaNestLogo from '../components/CampaNestLogo';
import { useAuth } from '../context/AuthContext';
import { usePWA } from '../context/PWAContext';
import { useToast } from '../components/Toast';
import { auth, db } from '../lib/firebase';

type Theme = 'dark' | 'light';
type Language = 'en' | 'mr' | 'hi';

const warningPoints = [
  '⚠️ कोणतीही आगाऊ रक्कम देण्यापूर्वी सेवा प्रत्यक्ष पाहून खात्री करा. कोणत्याही व्यवहारासाठी CampaNest जबाबदार राहणार नाही.',
  '⚠️ Do not make any advance payment without verifying the service in person. CampaNest is not responsible for any financial transactions.',
  'ही माहिती सेवा पुरवठादाराने दिलेली आहे. कृपया स्वतः तपासणी करून निर्णय घ्या.',
  'This information is provided by the service provider. Please verify independently before making any decision.',
  'कॉल किंवा WhatsApp द्वारे होणाऱ्या संभाषणासाठी वापरकर्ता स्वतः जबाबदार आहे.',
  'Users are solely responsible for any communication via call or WhatsApp.',
  'CampaNest मध्ये काही लिस्टिंगचे क्रम, रेटिंग किंवा व्ह्यूज व्यवस्थापनासाठी अॅडमिनद्वारे नियंत्रित केले जाऊ शकतात.',
  'Listing order, ratings, and views may be managed or adjusted by the admin for better user experience.',
  'आपली वैयक्तिक माहिती सुरक्षित ठेवली जाते आणि कोणत्याही तृतीय पक्षास विकली जात नाही.',
  'Your personal information is kept secure and is not sold to any third party.',
  'अॅपचा गैरवापर केल्यास प्रवेश मर्यादित केला जाऊ शकतो.',
  'Misuse of the app may lead to restricted access.'
];

export default function AboutPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { installApp } = usePWA();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  const selectedTheme = useMemo<Theme>(() => {
    return profile?.theme === 'light' ? 'light' : 'dark';
  }, [profile?.theme]);

  const selectedLanguage = useMemo<Language>(() => {
    if (profile?.language === 'mr' || profile?.language === 'hi') return profile.language;
    return 'en';
  }, [profile?.language]);

  const saveSetting = async (patch: Partial<{ theme: Theme; language: Language }>) => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), patch, { merge: true });
      showToast('Settings updated', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Failed to update setting', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen pb-20">
      <div className="px-4 py-4 border-b border-zinc-800 flex items-center gap-4 sticky top-0 bg-background z-10">
        <button onClick={() => navigate(-1)} aria-label="Go back"><ChevronLeft /></button>
        <h1 className="font-bold text-lg">Profile & Info</h1>
      </div>

      <div className="p-4 space-y-4">
        <section className="card text-center">
          <div className="mx-auto w-16 h-16 rounded-xl overflow-hidden">
            <CampaNestLogo size={64} />
          </div>
          <h2 className="text-xl font-bold mt-3">{profile?.name || 'CampaNest User'}</h2>
          <p className="text-zinc-500 text-sm mt-1">{profile?.email || user?.email || 'No email available'}</p>
          <p className="text-zinc-500 text-xs uppercase tracking-wide mt-2">{profile?.role || 'student'}</p>
        </section>

        <section className="card space-y-3">
          <h3 className="font-bold">Theme / Settings</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-zinc-400">
              Theme
              <select
                value={selectedTheme}
                disabled={saving}
                onChange={(e) => void saveSetting({ theme: e.target.value as Theme })}
                className="input-field mt-2 py-2"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <label className="text-sm text-zinc-400">
              Language
              <select
                value={selectedLanguage}
                disabled={saving}
                onChange={(e) => void saveSetting({ language: e.target.value as Language })}
                className="input-field mt-2 py-2"
              >
                <option value="en">English</option>
                <option value="mr">Marathi</option>
                <option value="hi">Hindi</option>
              </select>
            </label>
          </div>
          <div className="pt-2 border-t border-zinc-800 space-y-2">
            <a className="flex items-center gap-2 text-sm" href="https://wa.me/917385670673" target="_blank" rel="noreferrer">
              <MessageCircle size={14} /> WhatsApp Support
            </a>
            <a className="flex items-center gap-2 text-sm" href="tel:7385670673">
              <Phone size={14} /> Call Support
            </a>
            <a className="flex items-center gap-2 text-sm" href="mailto:campanest7@gmail.com">
              <Mail size={14} /> campanest7@gmail.com
            </a>
          </div>
        </section>

        <section className="card space-y-3">
          <h3 className="font-bold">Install App</h3>
          <button
            onClick={() => void installApp()}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Smartphone size={16} /> Install App
          </button>
        </section>

        <button
          onClick={() => void handleLogout()}
          className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-3 rounded-lg"
        >
          Logout
        </button>

        <section className="card">
          <h3 className="font-bold mb-2">⚠️ Important Notice</h3>
          <div className="max-h-48 overflow-y-auto pr-1 space-y-2 text-[11px] leading-relaxed text-zinc-300">
            {warningPoints.map((point) => (
              <p key={point} className="bg-zinc-900 border border-zinc-800 rounded-md px-2 py-2">
                {point}
              </p>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
