import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { 
  ChevronLeft, MessageCircle, Copy, 
  CreditCard, ShieldCheck, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ADMIN_WHATSAPP, ADMIN_UPI } from '../constants';
import { formatCurrency } from '../lib/utils';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ProviderProfile } from '../types';

export default function ProviderPayment() {
  const { user } = useAuth();
  const [provider, setProvider] = React.useState<ProviderProfile | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  React.useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'providers', user.uid), (doc) => {
      if (doc.exists()) {
        setProvider({ uid: doc.id, ...doc.data() } as ProviderProfile);
      }
    });
    return () => unsub();
  }, [user]);

  const copyUPI = () => {
    navigator.clipboard.writeText(ADMIN_UPI);
    showToast("UPI ID copied!", "success");
  };

  const handleWhatsAppPay = () => {
    if (!provider) return;
    const message = `Hi CampaNest, I want to pay for my listing.
Business: ${provider.businessName}
Service: ${provider.serviceType}
Amount: ${formatCurrency(provider.totalMonthlyCharge)}
UID: ${user?.uid}`;
    
    window.open(`https://wa.me/91${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`);
  };

  const markPaymentSubmitted = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'providers', user.uid), {
        paymentStatus: 'pending',
        status: 'inactive',
        isActive: false,
        paymentDate: serverTimestamp()
      }, { merge: true });
      showToast("Payment request submitted. Admin will verify and activate.", "success");
    } catch (error: any) {
      showToast(error.message || "Failed to submit payment request", "error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="px-4 py-4 border-b border-zinc-800 flex items-center gap-4">
        <button onClick={() => navigate(-1)}><ChevronLeft /></button>
        <h1 className="font-bold text-lg">Payment & Activation</h1>
      </div>

      <div className="p-6 space-y-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex items-start gap-4">
          <Info className="text-red-500 shrink-0" size={24} />
          <div>
            <h3 className="font-bold text-red-500">Listing Hidden</h3>
            <p className="text-zinc-400 text-xs mt-1">Your listing is currently hidden from students. Pay to activate it for 30 days.</p>
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-bold text-zinc-500 uppercase text-[10px] tracking-widest">Amount Breakdown</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400 capitalize">{provider?.serviceType} Listing</span>
              <span className="font-bold">{formatCurrency(provider?.totalMonthlyCharge || 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Extra Items</span>
              <span className="font-bold">₹0</span>
            </div>
            <div className="pt-3 border-t border-zinc-800 flex justify-between items-center">
              <span className="font-bold">Total Due</span>
              <span className="text-xl font-bold text-primary">{formatCurrency(provider?.totalMonthlyCharge || 0)}</span>
            </div>
          </div>
        </div>

        {provider?.paymentStatus === 'pending' && (
          <div className="card bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-xs">
            Payment verification is pending. Your listing will be activated after admin approval.
          </div>
        )}

        <div className="space-y-4">
          <h3 className="font-bold text-lg">Payment Method</h3>
          
          <div className="card bg-zinc-900 flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <CreditCard size={20} />
              </div>
              <div>
                <p className="text-xs text-zinc-500 font-bold uppercase">UPI ID</p>
                <p className="text-sm font-bold">{ADMIN_UPI}</p>
              </div>
            </div>
            <button onClick={copyUPI} className="p-2 bg-zinc-800 rounded-lg text-zinc-400">
              <Copy size={16} />
            </button>
          </div>

        <button 
          onClick={handleWhatsAppPay}
          className="w-full bg-green-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg shadow-green-600/20"
        >
          <MessageCircle size={24} />
          Pay via WhatsApp
        </button>

        <button
          onClick={markPaymentSubmitted}
          className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 font-semibold py-3 rounded-xl"
        >
          I Have Shared Payment Screenshot
        </button>
        </div>

        <div className="card bg-zinc-900/50 border-zinc-800 p-5 space-y-4">
          <div className="flex items-center gap-3 text-accent">
            <ShieldCheck size={20} />
            <span className="font-bold text-sm">Safe & Secure Activation</span>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            1. Pay using the UPI ID above.<br/>
            2. Send a screenshot of the payment on WhatsApp.<br/>
            3. Our team will verify and activate your listing within 2 hours.
          </p>
        </div>

        <button 
          onClick={() => window.open(`https://wa.me/91${ADMIN_WHATSAPP}?text=Hi, I already paid. Please check.`)}
          className="w-full text-zinc-500 text-xs font-medium py-4"
        >
          I already paid — Contact Support
        </button>
      </div>
    </div>
  );
}
