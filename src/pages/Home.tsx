import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Listing, MenuItem } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { AREAS, CATEGORY_DESCRIPTIONS, CATEGORY_LABELS } from '../constants';
import { Search, MapPin, User, Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const CATEGORIES = ['all', 'pg', 'hostel', 'mess', 'flat', 'shop', 'hotel', 'block', 'doctor', 'requirement', 'secondhand', 'advertisement'] as const;
const MENU_ITEMS_FETCH_LIMIT = 400;

type FoodSearchResult = {
  id: string;
  isItemResult: true;
  itemName: string;
  price: number;
  listingName: string;
  location: string;
  listingId: string;
  itemCategory: 'food' | 'shop';
};

const toLower = (value: unknown) => String(value || '').toLowerCase();

const stringIncludes = (source: unknown, term: string) => {
  if (!term) return true;
  return toLower(source).includes(term);
};

const normalizeLegacyItems = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/\r?\n|,|•|·|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const resolveItemCategory = (item: MenuItem): 'food' | 'shop' => {
  const normalized = toLower(item.category);
  if (normalized === 'shop') return 'shop';
  if (normalized === 'food') return 'food';
  return normalized.includes('shop') ? 'shop' : 'food';
};

const normalizePhone = (value?: string) => {
  return String(value || '').replace(/[^\d]/g, '');
};

const getContactNumber = (listing: Listing) => {
  return String((listing as any).contactNumber || listing.phone || '').trim();
};

const getWhatsAppNumber = (listing: Listing) => {
  const raw = String((listing as any).whatsappNumber || (listing as any).whatsapp || getContactNumber(listing) || '').trim();
  return normalizePhone(raw);
};

const getMapUrl = (listing: Listing) => {
  const rawCoords = String((listing as any).locationCoordinates || '').trim();
  if (rawCoords) {
    const parts = rawCoords.split(',').map((value) => value.trim());
    if (parts.length === 2) {
      const lat = Number(parts[0]);
      const lng = Number(parts[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return `https://www.google.com/maps?q=${lat},${lng}`;
      }
    }
  }

  const lat = listing.location?.lat;
  const lng = listing.location?.lng;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  return '';
};

export default function Home() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [loadingMenuItems, setLoadingMenuItems] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('all');
  const [area, setArea] = useState('All Areas');

  useEffect(() => {
    const load = async () => {
      setLoadingListings(true);
      try {
        let q = query(collection(db, 'listings'), where('active', '==', true));

        if (category !== 'all') q = query(q, where('category', '==', category));
        if (area !== 'All Areas') q = query(q, where('area', '==', area));

        const snap = await getDocs(q);
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Listing));

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

        console.log('listingsData', activeRows);
        setAllListings(activeRows);
      } catch (error: any) {
        showToast(error?.message || 'Failed to fetch listings', 'error');
      } finally {
        setLoadingListings(false);
      }
    };

    void load();
  }, [category, area, showToast]);

  useEffect(() => {
    const loadMenuItems = async () => {
      setLoadingMenuItems(true);
      try {
        const snap = await getDocs(query(collection(db, 'menuItems'), limit(MENU_ITEMS_FETCH_LIMIT)));
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MenuItem));
        console.log('menuData', rows);
        setAllMenuItems(rows);
      } catch {
        setAllMenuItems([]);
      } finally {
        setLoadingMenuItems(false);
      }
    };

    void loadMenuItems();
  }, []);

  const searchTerm = search.trim().toLowerCase();

  const listings = useMemo(() => {
    if (!searchTerm) return allListings;

    return allListings.filter((l) => {
      const oldFoodItems = normalizeLegacyItems((l as any)?.foodItems);
      const oldShopItems = normalizeLegacyItems((l as any)?.shopItems);

      return (
        stringIncludes(l.name, searchTerm) ||
        stringIncludes(l.area, searchTerm) ||
        stringIncludes(l.nearCollege, searchTerm) ||
        stringIncludes((l as any)?.locationCoordinates, searchTerm) ||
        oldFoodItems.some((item) => stringIncludes(item, searchTerm)) ||
        oldShopItems.some((item) => stringIncludes(item, searchTerm))
      );
    });
  }, [allListings, searchTerm]);

  const itemResults = useMemo<FoodSearchResult[]>(() => {
    if (!searchTerm) return [];

    return allMenuItems
      .filter((item) => String(item.itemName || '').toLowerCase().includes(searchTerm))
      .filter((item) => {
        if (area === 'All Areas') return true;
        const location = String(item.location || '').toLowerCase();
        return location.includes(area.toLowerCase());
      })
      .map((item) => ({
        id: String(item.id || `${item.listingId}-${item.itemName}`),
        isItemResult: true,
        itemName: String(item.itemName || 'Menu item'),
        price: Number(item.price || 0),
        listingName: String(item.listingName || 'Listing'),
        location: String(item.location || 'Location not available'),
        listingId: String(item.listingId || ''),
        itemCategory: resolveItemCategory(item)
      }));
  }, [allMenuItems, area, searchTerm]);

  const mergedResults = useMemo(() => {
    if (!searchTerm) return listings;
    return [...listings, ...itemResults];
  }, [itemResults, listings, searchTerm]);

  useEffect(() => {
    console.log('finalResults', mergedResults);
  }, [mergedResults]);

  const isLoadingResults = loadingListings || (searchTerm ? loadingMenuItems : false);

  const selectedCategoryDescription = category === 'all'
    ? 'Browse verified student services around Pune'
    : (CATEGORY_DESCRIPTIONS[category] || '');

  const renderListingCard = (listing: Listing) => {
    const avgRating = Number(listing.avgRating || 0);
    const totalRatings = Number(listing.totalRatings || 0);
    const totalViews = Number(listing.totalViews || 0);
    const availableRooms = Number((listing as any).availableRooms || 0);
    const showRooms = listing.category === 'pg' || listing.category === 'flat';
    const contactNumber = getContactNumber(listing);
    const whatsappNumber = getWhatsAppNumber(listing);
    const mapUrl = getMapUrl(listing);
    const hasContact = Boolean(normalizePhone(contactNumber));

    return (
      <Link key={listing.id} to={`/listing/${listing.id}`} className="block card p-5 border-zinc-800 hover:border-primary/50 shadow-sm transition-colors">
        <h3 className="font-bold text-xl">{listing.name}</h3>
        <p className="text-zinc-500 text-xs flex items-center gap-1 mt-2">
          <MapPin size={12} />
          {listing.area}
          {listing.nearCollege ? ` · Near ${listing.nearCollege}` : ''}
        </p>
        <div className="mt-3 flex items-center gap-3 text-xs text-zinc-300">
          <span>{`\u2B50 ${avgRating.toFixed(1)} (${totalRatings || 0})`}</span>
          <span>{`\u{1F441} ${totalViews || 0}`}</span>
          {showRooms && <span>{`\u{1F3E0} ${availableRooms || 0} rooms left`}</span>}
        </div>
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!hasContact}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!hasContact) return;
                window.location.href = `tel:${normalizePhone(contactNumber)}`;
              }}
              className="flex-1 px-2 py-2 bg-zinc-900 rounded text-primary text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {'\u{1F4DE} Call'}
            </button>
            <button
              type="button"
              disabled={!hasContact}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!hasContact || !whatsappNumber) return;
                window.open(`https://wa.me/${whatsappNumber}`, '_blank', 'noopener,noreferrer');
              }}
              className="flex-1 px-2 py-2 bg-zinc-900 rounded text-primary text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {'\u{1F4AC} WhatsApp'}
            </button>
            {mapUrl && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(mapUrl, '_blank', 'noopener,noreferrer');
                }}
                className="flex-1 px-2 py-2 bg-zinc-900 rounded text-primary text-xs font-semibold"
              >
                {'\u{1F4CD} Map'}
              </button>
            )}
          </div>
        </div>
      </Link>
    );
  };

  const renderItemCard = (item: FoodSearchResult) => {
    const icon = item.itemCategory === 'shop' ? '\u{1F6D2}' : '\u{1F35B}';
    const content = (
      <div className="card p-4 border-zinc-800">
        <p className="font-semibold text-sm">{`${icon} ${item.itemName} - \u20B9${item.price || 0}`}</p>
        <p className="text-xs text-zinc-400 mt-1">{item.listingName}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{item.location}</p>
      </div>
    );

    if (!item.listingId) return <div key={item.id}>{content}</div>;

    return (
      <Link key={item.id} to={`/listing/${item.listingId}`} className="block hover:opacity-95 transition-opacity">
        {content}
      </Link>
    );
  };

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
            placeholder="Search listings, food, or shop items"
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
          {'\u{1F6A8} Emergency'}
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
        {isLoadingResults ? (
          <p className="text-zinc-500">Loading listings...</p>
        ) : mergedResults.length === 0 ? (
          <div className="card bg-zinc-900/50 border-dashed border-zinc-800 py-12 text-center text-zinc-500">
            No listings found.
          </div>
        ) : (
          mergedResults.map((result) => {
            if ((result as FoodSearchResult).isItemResult) {
              return renderItemCard(result as FoodSearchResult);
            }
            return renderListingCard(result as Listing);
          })
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-background/90 backdrop-blur border-t border-zinc-800 z-30">
        <a
          href={`https://wa.me/917385670673?text=${encodeURIComponent('Hi, I want to list my service on CampaNest Pune')}`}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Store size={18} />
          {'\u{1F3EA} List Your Service'}
        </a>
      </div>
    </div>
  );
}
