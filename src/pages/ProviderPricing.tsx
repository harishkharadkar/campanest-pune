import React from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { CheckCircle2 } from 'lucide-react';
import { addDays } from 'date-fns';
import { NO_FREE_TRIAL_SERVICE_TYPES } from '../constants';

export default function ProviderPricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const startFreeTrial = async () => {
    if (!user) return;
    try {
      const subEnd = addDays(new Date(), 28);

      await setDoc(doc(db, 'providers', user.uid), {
        uid: user.uid,
        subscriptionStart: serverTimestamp(),
        subscriptionEnd: subEnd,
        isActive: true,
        isFreeTrialUsed: true,
        extraItemCount: 0,
        totalMonthlyCharge: 0,
        createdAt: serverTimestamp()
      });

      showToast('Free trial started! 28 days left.', 'success');
      navigate('/select-service');
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const benefits = [
    '28 days free only for Mess, PG, Hostel, Flat, Shop, Hotel',
    'Unlimited student views',
    'Direct WhatsApp and call',
    'Visitor count dashboard',
    'Student ratings and reviews',
    '10 items free (shops only)'
  ];

  return (
    <div className="min-h-screen flex flex-col px-6 py-12">
      <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6 mb-8 text-center">
        <h2 className="text-2xl font-bold text-primary mb-2">Start with 28 Days FREE</h2>
        <p className="text-zinc-400 text-sm">Then pay as per your service type</p>
        <p className="text-[11px] text-zinc-500 mt-2">
          No free trial for: {NO_FREE_TRIAL_SERVICE_TYPES.join(', ')}
        </p>
      </div>

      <div className="space-y-4 mb-10">
        <h3 className="font-bold text-lg">Pricing Plans</h3>
        <div className="grid grid-cols-1 gap-3">
          <div className="card flex justify-between items-center py-3">
            <span className="text-sm">Mess / PG / Hostel / Flat / Shop</span>
            <span className="text-primary font-bold">Rs119/mo</span>
          </div>
          <div className="card flex justify-between items-center py-3">
            <span className="text-sm">Second Hand Items</span>
            <span className="text-primary font-bold">Rs119/mo</span>
          </div>
          <div className="card flex justify-between items-center py-3">
            <span className="text-sm">Block Renting (Commercial)</span>
            <span className="text-primary font-bold">Rs200/mo</span>
          </div>
          <div className="card flex justify-between items-center py-3">
            <span className="text-sm">Avashyakta (Requirement)</span>
            <span className="text-primary font-bold">Rs150/mo</span>
          </div>
          <div className="card flex justify-between items-center py-3">
            <span className="text-sm">New Opening (Launch Special)</span>
            <span className="text-primary font-bold">Rs2000/mo</span>
          </div>
        </div>
      </div>

      <div className="space-y-4 mb-12">
        <h3 className="font-bold text-lg">Benefits</h3>
        <div className="grid grid-cols-1 gap-4">
          {benefits.map((benefit, i) => (
            <div key={i} className="flex items-center gap-3 text-zinc-300">
              <CheckCircle2 size={20} className="text-accent" />
              <span className="text-sm">{benefit}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={startFreeTrial}
        className="btn-primary w-full mt-auto"
      >
        Proceed for Free
      </button>
    </div>
  );
}
