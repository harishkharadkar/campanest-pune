import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, increment, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Listing } from '../types';
import { ChevronLeft, Copy, Eye, MapPin, MessageCircle, Navigation, Phone, Send, Star } from 'lucide-react';
import { useToast } from '../components/Toast';
import { CATEGORY_LABELS } from '../constants';
import { useAuth } from '../context/AuthContext';

const normalizeWhatsAppNumber = (phone?: string, whatsapp?: string) => {
  const raw = (whatsapp || phone || '').replace(/\D/g, '');
  if (!raw) return '';
  return raw.startsWith('91') ? raw : `91${raw}`;
};

const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const formatMenuItems = (value?: string) => {
  return String(value || '')
    .split(/\r?\n|,|•|·|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const getMenuForDay = (listing: Listing, dayLower: string) => {
  const menu = listing.weeklyMenu || {};
  const titleCase = dayLower.charAt(0).toUpperCase() + dayLower.slice(1);
  return String(menu[dayLower as keyof typeof menu] || menu[titleCase as keyof typeof menu] || '');
};

const getListingMapUrl = (listing: Listing) => {
  const lat = listing.location?.lat;
  const lng = listing.location?.lng;
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  if (listing.mapsLink) return listing.mapsLink;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.address || '')}`;
};

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const listingId = (id || '').trim();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!listingId) {
        console.log('Listing ID:', listingId);
        setLoading(false);
        return;
      }
      try {
        console.log('Listing ID:', listingId);
        const ref = doc(db, 'listings', listingId);
        const [snap, ratingSnap] = await Promise.all([
          getDoc(ref),
          user?.uid ? getDoc(doc(db, 'listings', listingId, 'ratings', user.uid)) : Promise.resolve(null)
        ]);

        if (!snap.exists()) {
          setListing(null);
          return;
        }

        const data = { id: snap.id, ...snap.data() } as Listing;
        console.log('ListingDetail: loaded listing', data.id, data.name);
        setListing(data);

        try {
          await updateDoc(ref, { totalViews: increment(1) });
        } catch (viewError) {
          console.warn('ListingDetail: failed to increment views', viewError);
        }

        if (ratingSnap?.exists()) {
          setUserRating(Number(ratingSnap.data().stars) || 0);
        } else {
          setUserRating(0);
        }
      } catch (error: any) {
        console.error('ListingDetail: failed to load listing', error);
        showToast(error?.message || 'Failed to load listing', 'error');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [listingId, user?.uid, showToast]);

  if (loading) return <div className="h-screen flex items-center justify-center bg-background text-zinc-500">Loading...</div>;
  if (!listing) return <div className="h-screen flex items-center justify-center bg-background text-zinc-500">Listing not found</div>;

  const isExpired = listing.validUntil?.toDate?.()?.getTime?.() ? listing.validUntil.toDate().getTime() < Date.now() : false;
  const todayLower = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()).toLowerCase();
  const todayTitle = todayLower.charAt(0).toUpperCase() + todayLower.slice(1);
  const todayMenuItems = formatMenuItems(getMenuForDay(listing, todayLower));

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    showToast('Link copied', 'success');
  };

  const handleRate = async (stars: number) => {
    if (!listingId || !user?.uid || !listing) return;

    setSubmittingRating(true);
    try {
      const ratingRef = doc(db, 'listings', listingId, 'ratings', user.uid);
      await setDoc(
        ratingRef,
        {
          uid: user.uid,
          stars,
          createdAt: serverTimestamp()
        },
        { merge: true }
      );

      const ratingsSnap = await getDocs(collection(db, 'listings', listingId, 'ratings'));
      const totalRatings = ratingsSnap.size;
      const totalStars = ratingsSnap.docs.reduce((sum, ratingDoc) => {
        return sum + (Number(ratingDoc.data().stars) || 0);
      }, 0);
      const avgRating = totalRatings ? Number((totalStars / totalRatings).toFixed(1)) : 0;

      await updateDoc(doc(db, 'listings', listingId), { avgRating, totalRatings });

      setUserRating(stars);
      setListing((prev) => (prev ? { ...prev, avgRating, totalRatings } : prev));
      showToast('Rating submitted', 'success');
    } catch (error: any) {
      console.error('ListingDetail: failed to submit rating', error);
      showToast(error?.message || 'Failed to submit rating', 'error');
    } finally {
      setSubmittingRating(false);
    }
  };

  return (
    <div className="min-h-screen pb-32">
      <div className="px-6 pt-5">
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 px-6 py-8 text-center">
          <p className="text-2xl font-extrabold tracking-wide text-zinc-100">CampaNest Pune</p>
          <p className="mt-1 text-xs text-zinc-500">Student Marketplace</p>
        </div>
        <div className="mt-3 flex justify-between">
          <button onClick={() => navigate(-1)} className="p-2 bg-zinc-900 border border-zinc-800 rounded-full text-white"><ChevronLeft /></button>
          <button onClick={copyLink} className="p-2 bg-zinc-900 border border-zinc-800 rounded-full text-white"><Copy size={18} /></button>
        </div>
      </div>

      <div className="px-6 mt-4 relative z-10 space-y-6">
        <div className="card bg-surface">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] bg-primary text-white px-2 py-1 rounded uppercase">{CATEGORY_LABELS[listing.category] || listing.category}</span>
            {listing.category === 'advertisement' && listing.isSponsored && <span className="text-[10px] bg-fuchsia-600 text-white px-2 py-1 rounded">Sponsored</span>}
            {isExpired && <span className="text-[10px] bg-red-600 text-white px-2 py-1 rounded">Expired</span>}
          </div>
          <h1 className="text-2xl font-bold">{listing.name}</h1>
          <p className="text-zinc-500 text-sm mt-1">{listing.phone}</p>
          <p className="text-zinc-500 text-sm flex items-center gap-1 mt-1"><MapPin size={14} /> {listing.area} · Near {listing.nearCollege}</p>
          <div className="mt-4 flex items-center gap-4 text-sm">
            <span className="text-yellow-500 font-bold flex items-center gap-1"><Star size={14} fill="currentColor" /> {(listing.avgRating || 0).toFixed(1)} ({listing.totalRatings || 0})</span>
            <span className="text-zinc-500 font-bold flex items-center gap-1"><Eye size={14} /> {listing.totalViews || 0}</span>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-1 text-yellow-500">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={`avg-${star}`}
                  size={20}
                  fill={star <= Math.round(listing.avgRating || 0) ? 'currentColor' : 'none'}
                />
              ))}
              <span className="text-zinc-400 text-xs ml-2">({listing.totalRatings || 0} ratings)</span>
            </div>
            <p className="text-zinc-400 text-xs mt-2">
              {userRating > 0 ? `Your rating: ${'★'.repeat(userRating)}${'☆'.repeat(5 - userRating)}` : 'Tap to rate'}
            </p>
            <div className="flex items-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  disabled={submittingRating}
                  onClick={() => void handleRate(star)}
                  className="p-1 rounded disabled:opacity-60"
                  aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  <Star
                    size={24}
                    className={star <= userRating ? 'text-yellow-500' : 'text-zinc-500'}
                    fill={star <= userRating ? 'currentColor' : 'none'}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {listing.category === 'mess' && (
          <div className="space-y-4">
            <div className="card border-primary/50 bg-primary/10">
              <h3 className="text-xl font-bold text-primary">🍛 Today&apos;s Menu</h3>
              <p className="text-zinc-400 text-xs mt-1">{todayTitle}</p>
              {todayMenuItems.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-zinc-200">
                  {todayMenuItems.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">Menu not available for today.</p>
              )}
            </div>

            <div className="card">
              <h3 className="text-lg font-bold">📅 Weekly Menu</h3>
              <div className="mt-3 space-y-2">
                {dayOrder.map((day) => {
                  const menuText = getMenuForDay(listing, day);
                  return (
                    <div key={day} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-primary capitalize">{day}</p>
                      <p className="text-xs text-zinc-300 mt-1">{menuText || 'Not available'}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <h3 className="font-bold mb-2">Description</h3>
          <p className="text-sm text-zinc-300">{listing.description}</p>
          <div className="mt-3 bg-zinc-900 border border-zinc-700 rounded-lg p-3 space-y-2">
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              ही माहिती सेवा पुरवठादाराने दिलेली आहे. कृपया स्वतः तपासणी करून निर्णय घ्या.
            </p>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              This information is provided by the service provider. Please verify independently before making any decision.
            </p>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold mb-2">Address</h3>
          <p className="text-sm text-zinc-300">{listing.address}</p>
          <button
            onClick={() => window.open(getListingMapUrl(listing), '_blank', 'noopener,noreferrer')}
            className="btn-outline w-full mt-4 flex items-center justify-center gap-2"
          >
            <Navigation size={16} /> Open in Maps
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-background/90 backdrop-blur border-t border-zinc-800 z-30 space-y-2">
        <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-3 space-y-1">
          <p className="text-yellow-200 text-[11px] leading-relaxed">
            ⚠️ कोणतीही आगाऊ रक्कम देण्यापूर्वी सेवा प्रत्यक्ष पाहून खात्री करा. कोणत्याही व्यवहारासाठी CampaNest जबाबदार राहणार नाही.
          </p>
          <p className="text-yellow-100 text-[11px] leading-relaxed">
            ⚠️ Do not make any advance payment without verifying the service in person. CampaNest is not responsible for any financial transactions.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              window.location.href = `tel:${listing.phone}`;
            }}
            className="flex-1 btn-outline flex items-center justify-center gap-2 py-3"
          >
            <Phone size={18} /> Call
          </button>
          <button
            type="button"
            onClick={() => {
              const waNumber = normalizeWhatsAppNumber(listing.phone, listing.whatsapp);
              if (!waNumber) return;
              window.open(`https://wa.me/${waNumber}`, '_blank', 'noopener,noreferrer');
            }}
            className="flex-1 bg-green-600 text-white font-bold rounded-lg flex items-center justify-center gap-2 py-3"
          >
            <MessageCircle size={18} /> WhatsApp
          </button>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2">
          <p className="text-[11px] text-zinc-300 leading-relaxed">
            कॉल किंवा WhatsApp द्वारे होणाऱ्या संभाषणासाठी वापरकर्ता स्वतः जबाबदार आहे.
          </p>
          <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">
            Users are solely responsible for any communication via call or WhatsApp.
          </p>
        </div>
        <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(window.location.href)}`)} className="w-full bg-zinc-800 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
          <Send size={16} /> Share
        </button>
      </div>
    </div>
  );
}
