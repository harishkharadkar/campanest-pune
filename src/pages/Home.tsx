import React, { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Listing, MenuItem } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { AREAS, CATEGORY_DESCRIPTIONS, CATEGORY_LABELS } from '../constants';
import { Search, MapPin, Store, Eye, MessageCircle, Camera } from 'lucide-react';
import { useToast } from '../components/Toast';
import { getOptimizedUrl } from '../lib/cloudinary';
import { getListingPhotos } from '../lib/listingPhotos';
import RatingStars from '../components/RatingStars';

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
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
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

const normalizePhone = (value?: string) => String(value || '').replace(/[^\d]/g, '');

const getContactNumber = (listing: Listing) => String((listing as any).contactNumber || listing.phone || '').trim();

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
  if (Number.isFinite(lat) && Number.isFinite(lng)) return `https://www.google.com/maps?q=${lat},${lng}`;

  return '';
};

const getListingImages = (listing: Listing) => getListingPhotos(listing as unknown as Record<string, unknown>);

const getStructuredItems = (listing: Listing) => {
  const fromItems = Array.isArray((listing as any).items) ? (listing as any).items : [];
  if (fromItems.length > 0) {
    return fromItems
      .map((item: any) => ({
        name: String(item?.name || '').trim(),
        price: Number(item?.price || 0),
        description: String(item?.description || '').trim()
      }))
      .filter((item: { name: string; price: number }) => item.name && Number.isFinite(item.price));
  }
  return [];
};

const getPrimaryPrice = (listing: Listing) => {
  const value = Number((listing as any).pricePerMonth || (listing as any).price || listing.pricePlan || 0);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const SkeletonCard = () => (
  <div className="card overflow-hidden p-0">
    <div className="aspect-[16/9] skeleton-shimmer" />
    <div className="p-4 space-y-3">
      <div className="h-4 w-2/3 rounded skeleton-shimmer" />
      <div className="h-3 w-1/2 rounded skeleton-shimmer" />
      <div className="h-3 w-3/4 rounded skeleton-shimmer" />
      <div className="h-9 w-full rounded-xl skeleton-shimmer" />
    </div>
  </div>
);

export default function Home() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [loadingMenuItems, setLoadingMenuItems] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('all');
  const [area, setArea] = useState('All Areas');

  useEffect(() => {
    setLoadingListings(true);

    let q = query(collection(db, 'listings'), where('active', '==', true));
    if (category !== 'all') q = query(q, where('category', '==', category));
    if (area !== 'All Areas') q = query(q, where('area', '==', area));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Listing));
        const now = Date.now();
        const activeRows = rows.filter((listing) => {
          if (!listing.active || !listing.validUntil) return false;
          const expiry = listing.validUntil?.toDate?.()?.getTime?.() || 0;
          return expiry > now;
        });

        activeRows.sort((a, b) => {
          const sponsorSort = Number(Boolean(b.isSponsored)) - Number(Boolean(a.isSponsored));
          if (sponsorSort !== 0) return sponsorSort;
          const featuredSort = Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured));
          if (featuredSort !== 0) return featuredSort;
          const prioritySort = (b.priorityScore || 0) - (a.priorityScore || 0);
          if (prioritySort !== 0) return prioritySort;
          const createdAtA = a.createdAt?.toDate?.()?.getTime?.() || 0;
          const createdAtB = b.createdAt?.toDate?.()?.getTime?.() || 0;
          return createdAtB - createdAtA;
        });

        setAllListings(activeRows);
        setLoadingListings(false);
      },
      (error: any) => {
        showToast(error?.message || 'Failed to fetch listings', 'error');
        setLoadingListings(false);
      }
    );

    return () => unsub();
  }, [area, category, showToast]);

  useEffect(() => {
    setLoadingMenuItems(true);
    const q = query(collection(db, 'menuItems'), limit(MENU_ITEMS_FETCH_LIMIT));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MenuItem));
        setAllMenuItems(rows);
        setLoadingMenuItems(false);
      },
      () => {
        setAllMenuItems([]);
        setLoadingMenuItems(false);
      }
    );

    return () => unsub();
  }, []);

  const searchTerm = search.trim().toLowerCase();

  const listings = useMemo(() => {
    if (!searchTerm) return allListings;
    return allListings.filter((listing) => {
      const oldFoodItems = normalizeLegacyItems((listing as any)?.foodItems);
      const oldShopItems = normalizeLegacyItems((listing as any)?.shopItems);

      return (
        stringIncludes(listing.name, searchTerm) ||
        stringIncludes(listing.area, searchTerm) ||
        stringIncludes(listing.nearCollege, searchTerm) ||
        stringIncludes((listing as any)?.locationCoordinates, searchTerm) ||
        oldFoodItems.some((item) => stringIncludes(item, searchTerm)) ||
        oldShopItems.some((item) => stringIncludes(item, searchTerm))
      );
    });
  }, [allListings, searchTerm]);

  const itemResults = useMemo<FoodSearchResult[]>(() => {
    if (!searchTerm) return [];
    return allMenuItems
      .filter((item) => String(item.itemName || '').toLowerCase().includes(searchTerm))
      .filter((item) => area === 'All Areas' || String(item.location || '').toLowerCase().includes(area.toLowerCase()))
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

  const isLoadingResults = loadingListings || (searchTerm ? loadingMenuItems : false);
  const selectedCategoryDescription = category === 'all'
    ? 'Discover verified student homes and local essentials in Pune.'
    : (CATEGORY_DESCRIPTIONS[category] || '');

  const renderListingCard = (listing: Listing) => {
    const averageRating = Number(listing.avgRating ?? listing.averageRating ?? 0);
    const totalRatings = Math.max(0, Number(listing.totalRatings || 0));
    const totalViews = Number(listing.views ?? listing.totalViews ?? 0);
    const availableRooms = Number((listing as any).roomsAvailable ?? (listing as any).availableRooms ?? 0);
    const showRooms = listing.category === 'pg' || listing.category === 'flat' || listing.category === 'hostel';
    const contactNumber = getContactNumber(listing);
    const whatsappNumber = getWhatsAppNumber(listing);
    const mapUrl = getMapUrl(listing);
    const hasContact = Boolean(normalizePhone(contactNumber));
    const listingImages = getListingImages(listing).slice(0, 5);
    const primaryImage = listingImages[0] ? getOptimizedUrl(listingImages[0], 'thumb') : '';
    const listingItems = getStructuredItems(listing).slice(0, 3);
    const showItemsPreview = listing.category === 'mess' || listing.category === 'hotel' || listing.category === 'shop';
    const price = getPrimaryPrice(listing);
    const tagLabel = CATEGORY_LABELS[listing.category] || listing.category;

    return (
      <Link key={listing.id} to={`/listing/${listing.id}`} className="block card card-hover p-0 overflow-hidden">
        <div className="relative rounded-t-2xl overflow-hidden aspect-[16/9] bg-[#161624]">
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={listing.name}
              className="listing-image"
              loading="lazy"
              onError={(event) => {
                const target = event.currentTarget;
                target.onerror = null;
                target.src = '/placeholder.jpg';
                console.error('Card image failed:', primaryImage);
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-500">
              <Camera size={26} />
            </div>
          )}
          <span className="absolute top-3 left-3 tag-label px-3 py-1 rounded-full bg-primary/90 text-white">
            {tagLabel}
          </span>
          {price && (
            <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/75 backdrop-blur text-white text-sm font-bold">
              ₹{price.toLocaleString('en-IN')}
            </span>
          )}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {Array.from({ length: Math.max(1, Math.min(5, listingImages.length || 1)) }).map((_, index) => (
              <span
                key={index}
                className={`rounded-full ${index === 0 ? 'bg-[#FF7A00] w-2.5 h-2.5' : 'bg-[#2A2A3D] w-2 h-2'}`}
              />
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-border">
          <h3 className="text-lg font-bold leading-tight">{listing.name}</h3>
          <p className="text-sm text-text-muted flex items-center gap-1 mt-2">
            <MapPin size={14} />
            {listing.area}
            {listing.nearCollege ? ` • Near ${listing.nearCollege}` : ''}
          </p>
          <div className="mt-3 flex items-center flex-wrap gap-3 text-sm text-text-muted">
            <RatingStars avgRating={averageRating} totalRatings={totalRatings} size={14} />
            <span className="inline-flex items-center gap-1">
              <Eye size={14} /> {totalViews}
            </span>
            {showRooms && <span>{availableRooms || 0} rooms left</span>}
          </div>

          {showItemsPreview && (
            <div className="mt-3 rounded-xl bg-[#1A1A28] border border-border p-3">
              <p className="tag-label text-text-muted mb-2">{listing.category === 'shop' ? 'Shop Items' : 'Food Highlights'}</p>
              {listingItems.length === 0 ? (
                <p className="text-sm text-text-muted">No highlights shared yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {listingItems.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="flex items-center justify-between text-sm">
                      <span className="text-text">{item.name}</span>
                      <span className="text-text-muted">₹{item.price}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!hasContact}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!hasContact) return;
                window.location.href = `tel:${normalizePhone(contactNumber)}`;
              }}
              className="btn-outline py-2.5 text-sm rounded-xl"
            >
              Call
            </button>
            <button
              type="button"
              disabled={!hasContact || !whatsappNumber}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!hasContact || !whatsappNumber) return;
                window.open(`https://wa.me/${whatsappNumber}`, '_blank', 'noopener,noreferrer');
              }}
              className="btn-primary py-2.5 text-sm rounded-xl inline-flex items-center justify-center gap-1.5"
            >
              <MessageCircle size={15} /> WhatsApp
            </button>
            {mapUrl && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(mapUrl, '_blank', 'noopener,noreferrer');
                }}
                className="col-span-2 btn-outline py-2.5 text-sm rounded-xl"
              >
                View on Map
              </button>
            )}
          </div>
        </div>
      </Link>
    );
  };

  const renderItemCard = (item: FoodSearchResult) => {
    const icon = item.itemCategory === 'shop' ? '🛍️' : '🍽️';
    const content = (
      <div className="card card-hover">
        <p className="font-semibold text-sm">{`${icon} ${item.itemName}`}</p>
        <p className="text-sm text-text mt-1">₹{item.price || 0}</p>
        <p className="text-xs text-text-muted mt-1">{item.listingName}</p>
        <p className="text-xs text-text-muted">{item.location}</p>
      </div>
    );
    if (!item.listingId) return <div key={item.id}>{content}</div>;
    return <Link key={item.id} to={`/listing/${item.listingId}`}>{content}</Link>;
  };

  return (
    <div className="min-h-screen pb-32">
      <section className="hero-gradient border-b border-border">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-16 md:py-24 text-center">
          <p className="tag-label text-primary">Trusted Student Real Estate</p>
          <h1 className="mt-4 text-4xl md:text-5xl font-bold max-w-3xl mx-auto">Find Verified Student Homes & Local Services in Pune</h1>
          <p className="mt-4 text-text-muted max-w-2xl mx-auto">Premium dark-mode marketplace experience with verified contacts, transparent ratings, and safer browsing.</p>

          <div className="mt-8 max-w-2xl mx-auto relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              className="input-field pl-11 py-4 rounded-2xl"
              placeholder="Search PG, flats, food, shop items, and areas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 sm:px-6 mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/emergency')}
            className="px-4 py-2 rounded-full text-xs font-medium uppercase tracking-[0.08em] bg-warning/20 text-warning border border-warning/40"
          >
            Emergency
          </button>
          {CATEGORIES.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`px-4 py-2 rounded-full text-xs font-medium uppercase tracking-[0.08em] border transition-colors ${
                category === item
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface text-text-muted border-border hover:border-primary hover:text-text'
              }`}
            >
              {item === 'all' ? 'All' : (CATEGORY_LABELS[item] || item)}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {['All Areas', ...AREAS].map((areaItem) => (
            <button
              key={areaItem}
              onClick={() => setArea(areaItem)}
              className={`px-3.5 py-2 rounded-full text-[11px] tag-label border transition-colors ${
                area === areaItem
                  ? 'bg-[#1A1A28] text-text border-primary'
                  : 'bg-surface text-text-muted border-border hover:border-primary hover:text-text'
              }`}
            >
              {areaItem}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-text-muted">{selectedCategoryDescription}</p>
      </section>

      <section className="max-w-7xl mx-auto px-5 sm:px-6 mt-6">
        {isLoadingResults ? (
          <div className="listing-grid">
            {Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={index} />)}
          </div>
        ) : mergedResults.length === 0 ? (
          <div className="card py-14 text-center text-text-muted">No listings found for this filter.</div>
        ) : (
          <div className="listing-grid">
            {mergedResults.map((result) => {
              if ((result as FoodSearchResult).isItemResult) return renderItemCard(result as FoodSearchResult);
              return renderListingCard(result as Listing);
            })}
          </div>
        )}
      </section>

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] md:w-auto z-30">
        <a
          href={`https://wa.me/917385670673?text=${encodeURIComponent('Hi, I want to list my service on CampaNest Pune')}`}
          className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 shadow-xl"
        >
          <Store size={18} />
          List Your Service
        </a>
      </div>
    </div>
  );
}
