import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Listing } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { AREAS, CATEGORY_DESCRIPTIONS, CATEGORY_LABELS } from '../constants';
import { Search, MapPin, Eye, Phone, MessageCircle, User, Store } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const CATEGORIES = ['all', 'pg', 'hostel', 'mess', 'flat', 'shop', 'hotel', 'block', 'doctor', 'requirement', 'secondhand', 'advertisement'] as const;

const isNewListing = (listing: Listing) => {
  const created = listing.createdAt?.toDate?.();
  if (!created) return false;
  return Date.now() - created.getTime() <= 7 * 24 * 60 * 60 * 1000;
};

const isPopularListing = (listing: Listing) => (listing.totalViews || 0) >= 100;
const normalizeWhatsAppNumber = (listing: Listing) => {
  const raw = (listing.whatsapp || listing.phone || '').replace(/\D/g, '');
  if (!raw) return '';
  return raw.startsWith('91') ? raw : `91${raw}`;
};
const getListingMapUrl = (listing: Listing) => {
  const lat = listing.location?.lat;
  const lng = listing.location?.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return '';
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return '';
  return `https://www.google.com/maps?q=${lat},${lng}`;
};
const getCategoryIcon = (category: Listing['category']) => {
  const iconMap: Record<Listing['category'], string> = {
    pg: '🏠',
    hostel: '🏠',
    mess: '🍛',
    hotel: '🍽',
    flat: '🏢',
    block: '🏢',
    doctor: '🩺',
    shop: '🏬',
    secondhand: '🔁',
    requirement: '📢',
    advertisement: '📣'
  };
  return iconMap[category] || '📍';
};

const getDayKeys = () => {
  const todayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
  return {
    lower: todayName.toLowerCase(),
    title: todayName
  };
};

const getTodayMenuItems = (listing: Listing) => {
  const menu = listing.weeklyMenu || {};
  const keys = getDayKeys();
  const rawMenu = menu[keys.lower as keyof typeof menu] || menu[keys.title as keyof typeof menu] || '';

  return String(rawMenu)
    .split(/\r?\n|,|•|·|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const toMinutes = (value: string) => {
  const match = value.trim().toUpperCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridian = match[3];
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59 || hour < 1 || hour > 12) {
    return null;
  }
  if (meridian === 'AM') {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }
  return hour * 60 + minute;
};

const isOpenByTiming = (timing: string) => {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const ranges = timing
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  for (const range of ranges) {
    const [startRaw, endRaw] = range.split('-').map((part) => part.trim());
    if (!startRaw || !endRaw) continue;
    const start = toMinutes(startRaw);
    const end = toMinutes(endRaw);
    if (start === null || end === null) continue;

    if (start <= end) {
      if (nowMinutes >= start && nowMinutes <= end) return true;
    } else {
      if (nowMinutes >= start || nowMinutes <= end) return true;
    }
  }

  return false;
};

const getDoctorStatus = (listing: Listing) => {
  const closedTillDate = listing.closedTill?.toDate?.() || (listing.closedTill ? new Date(listing.closedTill) : null);
  if (closedTillDate && Number.isFinite(closedTillDate.getTime()) && closedTillDate.getTime() >= Date.now()) {
    return {
      label: `🔴 Closed till ${closedTillDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      className: 'bg-red-500/15 text-red-300 border border-red-500/40'
    };
  }
  if (listing.closedToday) {
    return {
      label: '🔴 Closed Today',
      className: 'bg-red-500/15 text-red-300 border border-red-500/40'
    };
  }
  const openNow = isOpenByTiming(String(listing.timing || ''));
  return openNow
    ? { label: '🟢 Open Now', className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40' }
    : { label: '🔴 Closed Now', className: 'bg-red-500/15 text-red-300 border border-red-500/40' };
};

export default function Home() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('all');
  const [area, setArea] = useState('All Areas');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        let q = query(
          collection(db, 'listings'),
          where('active', '==', true)
        );

        if (category !== 'all') q = query(q, where('category', '==', category));
        if (area !== 'All Areas') q = query(q, where('area', '==', area));

        const snap = await getDocs(q);
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Listing));
        console.log('Home: fetched listings count', rows.length);

        const now = Date.now();
        const activeRows = rows.filter((l) => {
          if (!l.active) return false;
          if (!l.validUntil) return false;
          const expiry = l.validUntil?.toDate?.()?.getTime?.() || 0;
          return expiry > now;
        });

        activeRows.sort((a, b) => {
          const s = Number(Boolean(b.isSponsored)) - Number(Boolean(a.isSponsored));
          if (s !== 0) return s;
          const f = Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured));
          if (f !== 0) return f;
          const p = (b.priorityScore || 0) - (a.priorityScore || 0);
          if (p !== 0) return p;
          const tA = a.createdAt?.toDate?.()?.getTime?.() || 0;
          const tB = b.createdAt?.toDate?.()?.getTime?.() || 0;
          return tB - tA;
        });

        setAllListings(activeRows);
      } catch (error: any) {
        console.error('Home: failed to fetch listings', error);
        showToast(error?.message || 'Failed to fetch listings', 'error');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [category, area, showToast]);

  const listings = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return allListings;

    return allListings.filter((l) =>
      (l.name || '').toLowerCase().includes(term) ||
      (l.area || '').toLowerCase().includes(term) ||
      (l.nearCollege || '').toLowerCase().includes(term)
    );
  }, [allListings, search]);

  const selectedCategoryDescription = category === 'all'
    ? 'Browse verified student services around Pune'
    : (CATEGORY_DESCRIPTIONS[category] || '');

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-zinc-800 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-primary">CampaNest Pune</h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Student Marketplace</p>
        </div>
        <Link to="/about" className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
          {profile?.name?.[0] || <User size={18} />}
        </Link>
      </header>

      <div className="px-6 mt-5">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            className="input-field pl-10"
            placeholder="Search by name, area, college"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="px-6 mt-4 flex gap-2 overflow-x-auto no-scrollbar pb-2">
        <button
          onClick={() => navigate('/emergency')}
          className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase bg-red-600/90 text-white border border-red-400/30"
        >
          🚨 Emergency
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${category === c ? 'bg-primary text-white' : 'bg-zinc-900 text-zinc-400'}`}
          >
            {c === 'all' ? 'All' : (CATEGORY_LABELS[c] || c)}
          </button>
        ))}
      </div>

      <div className="px-6 mt-2 flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {['All Areas', ...AREAS].map((a) => (
          <button
            key={a}
            onClick={() => setArea(a)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase ${area === a ? 'bg-accent text-white' : 'bg-zinc-900 text-zinc-500'}`}
          >
            {a}
          </button>
        ))}
      </div>
      <div className="px-6 mt-1">
        <p className="text-xs text-zinc-500">{selectedCategoryDescription}</p>
      </div>

      <div className="px-6 mt-6 space-y-4">
        {loading ? (
          <p className="text-zinc-500">Loading listings...</p>
        ) : listings.length === 0 ? (
          <div className="card bg-zinc-900/50 border-dashed border-zinc-800 py-12 text-center text-zinc-500">
            No listings found.
          </div>
        ) : (
          listings.map((listing) => {
            const mapUrl = getListingMapUrl(listing);
            const isDoctor = listing.category === 'doctor';
            const doctorStatus = isDoctor ? getDoctorStatus(listing) : null;

            return (
              <Link key={listing.id} to={`/listing/${listing.id}`} className="block card p-5 border-zinc-800 hover:border-primary/50 shadow-sm transition-colors">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl" aria-hidden="true">{getCategoryIcon(listing.category)}</span>
                      <span className="bg-primary text-white text-[10px] font-bold px-2 py-1 rounded uppercase">
                        {CATEGORY_LABELS[listing.category] || listing.category}
                      </span>
                    </div>
                    <h3 className="font-bold text-xl mt-2">{listing.name}</h3>
                    {isDoctor ? (
                      <div className="mt-2 space-y-1.5">
                        <p className="text-zinc-300 text-sm">{listing.specialization || 'General Physician'}</p>
                        <p className="text-zinc-500 text-xs flex items-center gap-1"><MapPin size={12} /> {listing.area}</p>
                        <p className="text-zinc-400 text-xs">Timing: {listing.timing || 'Not available'}</p>
                        <span className={`inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-full ${doctorStatus?.className}`}>
                          {doctorStatus?.label}
                        </span>
                      </div>
                    ) : (
                      <>
                        <p className="text-zinc-500 text-xs mt-1">{listing.phone}</p>
                        <p className="text-zinc-500 text-xs mt-1 flex items-center gap-1">
                          <MapPin size={12} />
                          {listing.area}
                          {listing.nearCollege ? ` - Near ${listing.nearCollege}` : ''}
                        </p>
                      </>
                    )}
                    {listing.category === 'mess' && (
                      <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                        <p className="text-[11px] font-semibold text-primary">🍛 Today&apos;s Menu:</p>
                        {getTodayMenuItems(listing).slice(0, 4).length > 0 ? (
                          <ul className="mt-1 space-y-1 text-[11px] text-zinc-300">
                            {getTodayMenuItems(listing).slice(0, 4).map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-[11px] text-zinc-500">Menu not available for today</p>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-primary font-black">{formatCurrency(listing.pricePlan || listing.pricePerMonth || 0)}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {listing.category === 'advertisement' && listing.isSponsored && <span className="bg-fuchsia-600 text-white text-[9px] font-black px-2 py-1 rounded">Sponsored</span>}
                  {listing.isFeatured && <span className="bg-yellow-500 text-white text-[9px] font-black px-2 py-1 rounded">Featured</span>}
                  {isNewListing(listing) && <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-1 rounded">New</span>}
                  {isPopularListing(listing) && <span className="bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded">Popular</span>}
                </div>
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-yellow-500 font-bold">★ {(listing.avgRating || 0).toFixed(1)} ({listing.totalRatings || 0})</span>
                      <span className="text-zinc-500 font-bold flex items-center gap-1"><Eye size={12} /> {listing.totalViews || 0}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.location.href = `tel:${listing.phone}`;
                        }}
                        className="px-3 py-2 bg-zinc-900 rounded text-primary text-xs font-semibold flex items-center gap-1"
                      >
                        <Phone size={14} />
                        Call
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const waNumber = normalizeWhatsAppNumber(listing);
                          if (!waNumber) return;
                          window.open(`https://wa.me/${waNumber}`, '_blank', 'noopener,noreferrer');
                        }}
                        className="px-3 py-2 bg-green-600 rounded text-white text-xs font-semibold flex items-center gap-1"
                      >
                        <MessageCircle size={14} />
                        WhatsApp
                      </button>
                    </div>
                  </div>
                  {mapUrl && (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.open(mapUrl, '_blank', 'noopener,noreferrer');
                        }}
                        className="px-3 py-1.5 text-[11px] font-semibold rounded bg-zinc-900 text-zinc-200 border border-zinc-700 hover:border-primary/50"
                      >
                        🗺 View on Map
                      </button>
                    </div>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-background/90 backdrop-blur border-t border-zinc-800 z-30">
        <a
          href={`https://wa.me/917385670673?text=${encodeURIComponent('Hi, I want to list my service on CampaNest Pune')}`}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Store size={18} />
          🏪 List Your Service
        </a>
      </div>
    </div>
  );
}
