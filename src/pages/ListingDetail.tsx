import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, increment, query, runTransaction, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Listing, MenuItem } from '../types';
import { ChevronLeft, Copy, Eye, MapPin, MessageCircle, Navigation, Phone, Send, Star } from 'lucide-react';
import { useToast } from '../components/Toast';
import { CATEGORY_LABELS } from '../constants';
import { useAuth } from '../context/AuthContext';
import { optimizeCloudinaryUrl } from '../lib/cloudinary';

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

const toSafeDate = (value: any) => {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || !Number.isFinite(date.getTime())) return null;
  return date;
};

const formatLastUpdated = (value: any) => {
  const date = toSafeDate(value);
  if (!date) return 'Last updated: Not available';
  const diffDays = Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)));
  if (diffDays === 0) return 'Last updated: Today';
  if (diffDays === 1) return 'Last updated: 1 day ago';
  return `Last updated: ${diffDays} days ago`;
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

const IMAGE_ENABLED_CATEGORIES = ['pg', 'flat', 'hostel', 'secondhand', 'advertisement'] as const;

const getListingImages = (listing: Listing) => {
  const arrayImages = Array.isArray((listing as any).images) ? ((listing as any).images as string[]) : [];
  const photoImages = Array.isArray((listing as any).photos) ? ((listing as any).photos as string[]) : [];
  const singleImage = String((listing as any).image || (listing as any).bannerImage || '').trim();
  const merged = [...arrayImages, ...photoImages, ...(singleImage ? [singleImage] : [])];
  return merged.map((url) => optimizeCloudinaryUrl(url)).filter(Boolean);
};

const getStructuredListingItems = (listing: Listing, menuItems: MenuItem[]) => {
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

  return menuItems
    .map((item) => ({
      name: String(item.itemName || '').trim(),
      price: Number(item.price || 0),
      description: Array.isArray(item.servingDetails)
        ? item.servingDetails.join(', ')
        : String(item.servingDetails || '').trim()
    }))
    .filter((item) => item.name && Number.isFinite(item.price));
};

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const listingId = (id || '').trim();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [listing, setListing] = useState<Listing | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenuItems, setLoadingMenuItems] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!listingId) {
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, 'listings', listingId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setListing(null);
          return;
        }

        const data = { id: snap.id, ...snap.data() } as Listing;
        setListing(data);
        setLoadingMenuItems(true);

        try {
          const menuSnap = await getDocs(query(collection(db, 'menuItems'), where('listingId', '==', listingId)));
          if (!menuSnap.empty) {
            const fetchedItems = menuSnap.docs.map((menuDoc) => ({ id: menuDoc.id, ...menuDoc.data() } as MenuItem));
            setMenuItems(fetchedItems);
          } else {
            const inlineItems = Array.isArray((data as any).menuItems) ? (data as any).menuItems : [];
            setMenuItems(
              inlineItems.map((item: any, index: number) => ({
                id: `inline-${index}`,
                itemName: String(item.itemName || ''),
                price: Number(item.price || 0),
                type: item.type === 'Non-Veg' ? 'Non-Veg' : 'Veg',
                category: item.category || 'Other',
                servingDetails: Array.isArray(item.servingDetails) ? item.servingDetails : [],
                listingId,
                listingName: data.name || '',
                location: data.area || data.address || ''
              }))
            );
          }
        } catch {
          const inlineItems = Array.isArray((data as any).menuItems) ? (data as any).menuItems : [];
          setMenuItems(
            inlineItems.map((item: any, index: number) => ({
              id: `inline-${index}`,
              itemName: String(item.itemName || ''),
              price: Number(item.price || 0),
              type: item.type === 'Non-Veg' ? 'Non-Veg' : 'Veg',
              category: item.category || 'Other',
              servingDetails: Array.isArray(item.servingDetails) ? item.servingDetails : [],
              listingId,
              listingName: data.name || '',
              location: data.area || data.address || ''
            }))
          );
        } finally {
          setLoadingMenuItems(false);
        }

        setUserRating(0);

        try {
          await updateDoc(ref, {
            views: increment(1),
            totalViews: increment(1)
          });
          setListing((prev) => {
            if (!prev) return prev;
            const currentViews = Number(prev.views ?? prev.totalViews ?? 0);
            const nextViews = currentViews + 1;
            return {
              ...prev,
              views: nextViews,
              totalViews: nextViews
            };
          });
          console.log('[ListingDetail] views incremented', { listingId });
        } catch (viewError) {
          console.warn('[ListingDetail] failed to increment views', viewError);
        }
      } catch (error: any) {
        showToast(error?.message || 'Failed to load listing', 'error');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [listingId, showToast]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [listing?.id]);

  if (loading) return <div className="h-screen flex items-center justify-center bg-background text-zinc-500">Loading...</div>;
  if (!listing) return <div className="h-screen flex items-center justify-center bg-background text-zinc-500">Listing not found</div>;
  console.log('[ListingDetail] listing render', listing);

  const isExpired = listing.validUntil?.toDate?.()?.getTime?.() ? listing.validUntil.toDate().getTime() < Date.now() : false;
  const todayLower = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()).toLowerCase();
  const todayTitle = todayLower.charAt(0).toUpperCase() + todayLower.slice(1);
  const todayMenuItems = formatMenuItems(getMenuForDay(listing, todayLower));
  const normalizedMenuItems = menuItems.filter((item) => item.itemName && Number.isFinite(Number(item.price)));
  const todayMenuFromItems = normalizedMenuItems.slice(0, 8);
  const structuredItems = getStructuredListingItems(listing, normalizedMenuItems);

  const displayedAverageRating = Number(listing.averageRating ?? listing.avgRating ?? 0);
  const displayedTotalRatings = Number(listing.totalRatings ?? 0);
  const displayedViews = Number(listing.views ?? listing.totalViews ?? 0);
  const listingImageArray = Array.isArray((listing as any).images) ? ((listing as any).images as string[]) : [];
  const hasImageArray = listingImageArray.length > 0;
  const singleListingImage = optimizeCloudinaryUrl(String((listing as any).image || (listing as any).bannerImage || '').trim());
  const listingImages = getListingImages(listing);
  const isImageAllowed = IMAGE_ENABLED_CATEGORIES.includes(listing.category as any);
  const currentImage = hasImageArray ? (listingImages[activeImageIndex] || '') : singleListingImage;

  const prevImage = () => {
    if (listingImages.length < 2) return;
    setActiveImageIndex((prev) => (prev - 1 + listingImages.length) % listingImages.length);
  };

  const nextImage = () => {
    if (listingImages.length < 2) return;
    setActiveImageIndex((prev) => (prev + 1) % listingImages.length);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    showToast('Link copied', 'success');
  };

  const handleRate = async (stars: number) => {
    if (!listingId || !listing) return;
    if (!user?.uid) {
      showToast('Please login to rate this listing', 'error');
      return;
    }

    setSubmittingRating(true);
    try {
      const listingRef = doc(db, 'listings', listingId);
      const ratingRef = doc(collection(db, 'ratings'));

      const nextMetrics = await runTransaction(db, async (tx) => {
        const listingSnap = await tx.get(listingRef);
        if (!listingSnap.exists()) {
          throw new Error('Listing not found');
        }

        const listingData = listingSnap.data() as Listing;
        const oldAverage = Number(listingData.averageRating ?? listingData.avgRating ?? 0);
        const oldTotalRatings = Math.max(0, Number(listingData.totalRatings || 0));
        const newTotalRatings = oldTotalRatings + 1;
        const newAverage = Number((((oldAverage * oldTotalRatings) + stars) / newTotalRatings).toFixed(2));

        tx.set(ratingRef, {
          listingId,
          userId: user.uid,
          rating: stars,
          createdAt: serverTimestamp()
        });

        tx.update(listingRef, {
          averageRating: newAverage,
          avgRating: newAverage,
          totalRatings: newTotalRatings,
          lastUpdated: serverTimestamp()
        });

        return { newAverage, newTotalRatings };
      });

      console.log('[ListingDetail] rating saved', {
        listingId,
        rating: stars,
        averageRating: nextMetrics.newAverage,
        totalRatings: nextMetrics.newTotalRatings
      });

      setListing((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          averageRating: nextMetrics.newAverage,
          avgRating: nextMetrics.newAverage,
          totalRatings: nextMetrics.newTotalRatings
        };
      });
      setUserRating(stars);
      showToast('Rating submitted', 'success');
    } catch (error: any) {
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
        {showWarning && (
          <div className="relative bg-[#5a4a00] text-white px-4 py-3 rounded-lg shadow-md">
            <button
              type="button"
              className="absolute top-2 right-3 bg-transparent border-none text-base cursor-pointer text-white"
              onClick={() => setShowWarning(false)}
              aria-label="Close warning banner"
            >
              ✕
            </button>
            <p className="pr-6 text-sm leading-relaxed whitespace-pre-line">
              ⚠️ Do not make any advance payment without verifying the service in person.
              {'\n'}
              CampaNest is not responsible for any financial transactions.
            </p>
          </div>
        )}

        {isImageAllowed && currentImage && (
          <div className="card p-0 overflow-hidden">
            <div
              className="relative aspect-[16/10] bg-zinc-900"
              onTouchStart={(e) => setTouchStartX(e.touches[0]?.clientX ?? null)}
              onTouchEnd={(e) => {
                if (touchStartX === null) return;
                const endX = e.changedTouches[0]?.clientX ?? touchStartX;
                const diff = endX - touchStartX;
                if (Math.abs(diff) > 40) {
                  if (diff > 0) prevImage();
                  else nextImage();
                }
                setTouchStartX(null);
              }}
            >
              <img
                src={currentImage}
                alt={listing.name}
                className="w-full h-full object-cover"
                loading="eager"
              />
              {hasImageArray && listingImages.length > 1 && (
                <>
                  <button type="button" onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/45 text-white text-lg w-8 h-8 rounded-full">‹</button>
                  <button type="button" onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/45 text-white text-lg w-8 h-8 rounded-full">›</button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                    {listingImages.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveImageIndex(i)}
                        className={`text-sm leading-none ${i === activeImageIndex ? 'text-white' : 'text-white/60'}`}
                        aria-label={`Image ${i + 1}`}
                      >
                        {i === activeImageIndex ? '●' : '○'}
                      </button>
                    ))}
                  </div>
                  <p className="absolute top-2 right-2 text-[10px] bg-black/45 text-white px-2 py-0.5 rounded">
                    {activeImageIndex + 1} / {listingImages.length}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        <div className="card bg-surface">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] bg-primary text-white px-2 py-1 rounded uppercase">{CATEGORY_LABELS[listing.category] || listing.category}</span>
            {listing.category === 'advertisement' && listing.isSponsored && <span className="text-[10px] bg-fuchsia-600 text-white px-2 py-1 rounded">Sponsored</span>}
            {isExpired && <span className="text-[10px] bg-red-600 text-white px-2 py-1 rounded">Expired</span>}
          </div>
          <h1 className="text-2xl font-bold">{listing.name}</h1>
          <p className="text-zinc-500 text-sm mt-1">{listing.phone}</p>
          <p className="text-zinc-500 text-sm flex items-center gap-1 mt-1"><MapPin size={14} /> {listing.area} · Near {listing.nearCollege}</p>
          <p className="text-zinc-500 text-xs mt-2">{formatLastUpdated(listing.lastUpdated || listing.createdAt)}</p>
          <div className="mt-4 flex items-center gap-4 text-sm">
            <span className="text-yellow-500 font-bold flex items-center gap-1"><Star size={14} fill="currentColor" /> {displayedAverageRating.toFixed(1)} ({displayedTotalRatings})</span>
            <span className="text-zinc-500 font-bold flex items-center gap-1"><Eye size={14} /> {displayedViews}</span>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-1 text-yellow-500">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={`avg-${star}`}
                  size={20}
                  fill={star <= Math.round(displayedAverageRating) ? 'currentColor' : 'none'}
                />
              ))}
              <span className="text-zinc-400 text-xs ml-2">({displayedTotalRatings} ratings)</span>
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

        {(listing.category === 'mess' || listing.category === 'hotel' || listing.category === 'shop') && (
          <div className="card space-y-3">
            <h3 className="font-bold text-lg">{listing.category === 'shop' ? 'Items' : 'Food Items'}</h3>
            {loadingMenuItems ? (
              <p className="text-sm text-zinc-500">Loading items...</p>
            ) : structuredItems.length === 0 ? (
              <p className="text-sm text-zinc-500">Items not available right now.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {structuredItems.map((item, index) => (
                  <div key={`${item.name}-${item.price}-${index}`} className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/50">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold">{item.name}</p>
                      <p className="font-bold text-primary">₹{Number(item.price)}</p>
                    </div>
                    {item.description && (
                      <p className="text-xs text-zinc-500 mt-1">{item.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {listing.category === 'mess' && (
          <div className="space-y-4">
            <div className="card border-primary/50 bg-primary/10">
              <h3 className="text-xl font-bold text-primary">Today&apos;s Menu</h3>
              <p className="text-zinc-400 text-xs mt-1">{todayTitle}</p>
              {todayMenuFromItems.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-zinc-200">
                  {todayMenuFromItems.map((item) => (
                    <li key={item.id || item.itemName}>{item.itemName}</li>
                  ))}
                </ul>
              ) : todayMenuItems.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-zinc-200">
                  {todayMenuItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">Menu not available for today.</p>
              )}
            </div>

            <div className="card">
              <h3 className="text-lg font-bold">Mess Rates</h3>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <p className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2">Monthly: {listing.monthlyRate ? `₹${listing.monthlyRate}` : 'N/A'}</p>
                <p className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2">Weekly: {listing.weeklyRate ? `₹${listing.weeklyRate}` : 'N/A'}</p>
                <p className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2">Per Plate: {listing.perPlateRate ? `₹${listing.perPlateRate}` : 'N/A'}</p>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-bold">Weekly Menu</h3>
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

        {(listing.category === 'pg' || listing.category === 'hostel' || listing.category === 'flat') && (
          <div className="card space-y-2">
            <h3 className="font-bold text-lg">Stay Details</h3>
            <p className="text-sm text-zinc-300">Gender: {listing.gender || 'both'}</p>
            <p className="text-sm text-zinc-300">Room type: {listing.roomType || 'withCot'}</p>
            <p className="text-sm text-zinc-300">Mess: {listing.messAvailable ? 'Available' : 'Not available'}</p>
            <p className="text-sm text-zinc-300">Price: {listing.pricePerMonth ? `₹${listing.pricePerMonth}` : 'Contact for price'}</p>
            <p className="text-sm text-zinc-300">
              {Number.isFinite(Number((listing as any).roomsAvailable ?? listing.availableRooms))
                ? `${Number((listing as any).roomsAvailable ?? listing.availableRooms)} rooms left`
                : 'Room availability not shared'}
            </p>
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
