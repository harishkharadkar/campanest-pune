import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Listing, ProviderProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { 
  Plus, Edit2, Trash2, Eye, Star, 
  AlertTriangle, CheckCircle, Clock, 
  ExternalLink, LogOut
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { formatCurrency } from '../lib/utils';
import { differenceInDays } from 'date-fns';
import { auth } from '../lib/firebase';
import { clsx } from 'clsx';

export default function ProviderDashboard() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    if (!user) return;

    const unsubProvider = onSnapshot(doc(db, 'providers', user.uid), (doc) => {
      if (doc.exists()) {
        setProvider({ uid: doc.id, ...doc.data() } as ProviderProfile);
      }
    });

    const q = query(collection(db, 'listings'), where('providerId', '==', user.uid));
    const unsubListings = onSnapshot(q, (snapshot) => {
      setListings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing)));
      setLoading(false);
    });

    return () => {
      unsubProvider();
      unsubListings();
    };
  }, [user]);

  const toggleListingStatus = async (id: string, currentStatus: boolean) => {
    console.log(`ProviderDashboard: toggleListingStatus called for ${id} (current: ${currentStatus})`);
    if (provider?.paymentStatus !== 'paid' || provider?.status !== 'active') {
      showToast("Complete payment verification before activating listings.", "info");
      navigate('/provider-payment');
      return;
    }
    try {
      await updateDoc(doc(db, 'listings', id), { active: !currentStatus });
      showToast(`Listing ${!currentStatus ? 'activated' : 'deactivated'}`, "success");
    } catch (error: any) {
      console.error("ProviderDashboard: Error toggling status", error);
      showToast(error.message, "error");
      alert("Failed to update listing status");
    }
  };

  const deleteListing = async (id: string) => {
    console.log(`ProviderDashboard: deleteListing called for ${id}`);
    if (!confirm("Are you sure you want to delete this listing?")) return;
    try {
      await deleteDoc(doc(db, 'listings', id));
      showToast("Listing deleted", "success");
    } catch (error: any) {
      console.error("ProviderDashboard: Error deleting listing", error);
      showToast(error.message, "error");
      alert("Failed to delete listing");
    }
  };

  const handleLogout = async () => {
    console.log("ProviderDashboard: Logout button clicked");
    try {
      await auth.signOut();
      console.log("ProviderDashboard: Logout successful, navigating to login");
      navigate('/login');
    } catch (error: any) {
      console.error("ProviderDashboard: Logout error", error);
      alert("Logout failed");
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-background text-zinc-500">Loading Dashboard...</div>;

  const totalViews = listings.reduce((acc, curr) => acc + Number(curr.totalViews ?? curr.views ?? 0), 0);
  const avgRating = listings.length > 0
    ? listings.reduce((acc, curr) => acc + Number(curr.avgRating ?? curr.averageRating ?? 0), 0) / listings.length
    : 0;
  
  const daysRemaining = provider?.subscriptionEnd ? differenceInDays(provider.subscriptionEnd.toDate(), new Date()) : 0;
  const isExpired = daysRemaining < 0;
  const isPaymentPending = provider?.paymentStatus === 'pending' || provider?.status === 'inactive';

  return (
    <div className="min-h-screen pb-20">
      <header className="px-6 py-6 flex justify-between items-center border-b border-zinc-800">
        <h1 className="text-2xl font-bold">My Dashboard</h1>
        <button onClick={handleLogout} className="p-2 bg-zinc-900 rounded-lg text-red-500">
          <LogOut size={20} />
        </button>
      </header>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card flex flex-col items-center p-3">
            <Eye size={16} className="text-zinc-500 mb-1" />
            <span className="text-lg font-bold">{totalViews}</span>
            <span className="text-[8px] uppercase text-zinc-500 font-bold">Views</span>
          </div>
          <div className="card flex flex-col items-center p-3">
            <Star size={16} className="text-yellow-500 mb-1" />
            <span className="text-lg font-bold">{avgRating.toFixed(1)}</span>
            <span className="text-[8px] uppercase text-zinc-500 font-bold">Rating</span>
          </div>
          <div className="card flex flex-col items-center p-3">
            <CheckCircle size={16} className="text-accent mb-1" />
            <span className="text-lg font-bold">{listings.filter(l => l.active).length}</span>
            <span className="text-[8px] uppercase text-zinc-500 font-bold">Active</span>
          </div>
        </div>

        {/* Subscription */}
        <div className={clsx(
          "card border-l-4 p-5",
          isExpired ? "border-l-red-500 bg-red-500/5" : 
          daysRemaining < 3 ? "border-l-yellow-500 bg-yellow-500/5" : 
          "border-l-green-500 bg-green-500/5"
        )}>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-sm">Subscription Status</h3>
              <p className={clsx(
                "text-xs mt-1 font-medium",
                isExpired ? "text-red-500" : daysRemaining < 3 ? "text-yellow-500" : "text-green-500"
              )}>
                {isExpired ? "🔴 Expired" : daysRemaining < 3 ? "⚠️ Expiring Soon" : "✅ Active"}
                {provider?.isFreeTrialUsed && !isExpired && ` — ${daysRemaining} days left`}
              </p>
            </div>
            <Link to="/provider-payment" className="btn-primary py-1.5 px-4 text-[10px]">
              {isExpired ? "Reactivate" : "Renew Now"}
            </Link>
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between items-center">
            <span className="text-[10px] text-zinc-500 uppercase font-bold">Monthly Charge</span>
            <span className="text-sm font-bold">{formatCurrency(provider?.totalMonthlyCharge || 0)}</span>
          </div>
        </div>

        {isPaymentPending && (
          <div className="card bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            Payment is pending. Listings remain hidden until admin verification.
          </div>
        )}

        {/* Listings */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">My Listings</h3>
            <Link to="/select-service" className="text-primary text-xs font-bold flex items-center gap-1">
              <Plus size={14} /> Add New
            </Link>
          </div>

          {listings.length > 0 ? (
            <div className="space-y-3">
              {listings.map(listing => (
                <div key={listing.id} className="card p-3 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center text-center px-1">
                    <p className="text-[9px] font-bold text-zinc-200 leading-tight">CampaNest Pune</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm truncate">{listing.name}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                        <Eye size={10} /> {Number(listing.totalViews ?? listing.views ?? 0)}
                      </span>
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                        <Star size={10} className="text-yellow-500" /> {Number(listing.avgRating ?? listing.averageRating ?? 0).toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => toggleListingStatus(listing.id, listing.active)}
                      className={clsx(
                        "p-2 rounded-lg transition-colors",
                        listing.active ? "bg-green-500/10 text-green-500" : "bg-zinc-800 text-zinc-500"
                      )}
                    >
                      <CheckCircle size={16} />
                    </button>
                    <button 
                      onClick={() => deleteListing(listing.id)}
                      className="p-2 bg-red-500/10 text-red-500 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card border-dashed border-zinc-800 flex flex-col items-center justify-center py-12 text-zinc-500">
              <AlertTriangle size={32} className="mb-2 opacity-20" />
              <p className="text-sm">No listings yet.</p>
              <Link to="/select-service" className="text-primary text-xs font-bold mt-2">Create your first listing →</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
