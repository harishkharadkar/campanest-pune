import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, increment, limit, query, runTransaction, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Listing, MenuItem } from '../types';
import { Camera, ChevronLeft, Copy, Eye, MapPin, MessageCircle, Navigation, Phone, Send } from 'lucide-react';
import { useToast } from '../components/Toast';
import RatingStars from '../components/RatingStars';
import { CATEGORY_LABELS } from '../constants';
import { useAuth } from '../context/AuthContext';
import { getOptimizedUrl } from '../lib/cloudinary';
import { getListingPhotos } from '../lib/listingPhotos';

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
  if (typeof listing.location === 'string' && listing.location.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.location.trim())}`;
  }
  const lat = typeof listing.location === 'object' ? listing.location?.lat : undefined;
  const lng = typeof listing.location === 'object' ? listing.location?.lng : undefined;
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  if (listing.mapsLink) return listing.mapsLink;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.address || '')}`;
};

const VIEWED_LISTINGS_KEY = 'campanest:viewedListings';

const getListingImages = (listing: Listing) => getListingPhotos(listing as unknown as Record<string, unknown>);

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

const getPrimaryPrice = (listing: Listing) => {
  const value = Number((listing as any).pricePerMonth || (listing as any).price || listing.pricePlan || 0);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const roundToOneDecimal = (value: number) => Number(value.toFixed(1));

const getViewedListingIds = (): string[] => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(VIEWED_LISTINGS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
};

const hasViewedListingInSession = (listingId: string) => getViewedListingIds().includes(listingId);

const markListingViewedInSession = (listingId: string) => {
  try {
    const ids = new Set(getViewedListingIds());
    ids.add(listingId);
    sessionStorage.setItem(VIEWED_LISTINGS_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Ignore session storage failures and keep runtime behavior stable.
  }
};

const sanitizeStars = (value: number) => Math.min(5, Math.max(1, Math.round(value)));

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const listingId = (id || '').trim();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [listing, setListing] = useState<Listing | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenuItems, setLoadingMenuItems] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [hasRated, setHasRated] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(true);
  const [ratingsBreakdown, setRatingsBreakdown] = useState<number[]>([0, 0, 0, 0, 0]);
  const [similarListings, setSimilarListings] = useState<Listing[]>([]);
  const [animateBars, setAnimateBars] = useState(false);
  const ratingsSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!listingId) {
        setLoading(false);
        return;
      }

      try {
        const listingRef = doc(db, 'listings', listingId);
        const snap = await getDoc(listingRef);

        if (!snap.exists()) {
          setListing(null);
          return;
        }

        const listingData = { id: snap.id, ...snap.data() } as Listing;
        setListing(listingData);
        setLoadingMenuItems(true);

        const warningKey = `warningDismissed:${listingId}`;
        const hiddenForSession = sessionStorage.getItem(warningKey) === '1';
        setShowWarning(!hiddenForSession);

        try {
          const menuSnap = await getDocs(query(collection(db, 'menuItems'), where('listingId', '==', listingId)));
          if (!menuSnap.empty) {
            const fetchedItems = menuSnap.docs.map((menuDoc) => ({ id: menuDoc.id, ...menuDoc.data() } as MenuItem));
            setMenuItems(fetchedItems);
          } else {
            const inlineItems = Array.isArray((listingData as any).menuItems) ? (listingData as any).menuItems : [];
            setMenuItems(
              inlineItems.map((item: any, index: number) => ({
                id: `inline-${index}`,
                itemName: String(item.itemName || ''),
                price: Number(item.price || 0),
                type: item.type === 'Non-Veg' ? 'Non-Veg' : 'Veg',
                category: item.category || 'Other',
                servingDetails: Array.isArray(item.servingDetails) ? item.servingDetails : [],
                listingId,
                listingName: listingData.name || '',
                location: listingData.area || listingData.address || ''
              }))
            );
          }
        } catch {
          setMenuItems([]);
        } finally {
          setLoadingMenuItems(false);
        }

        try {
          const ratingsSnap = await getDocs(collection(db, 'listings', listingId, 'ratings'));
          const counts = [0, 0, 0, 0, 0];
          ratingsSnap.docs.forEach((ratingDoc) => {
            const rating = Number((ratingDoc.data() as any).rating || 0);
            if (rating >= 1 && rating <= 5) counts[rating - 1] += 1;
          });
          setRatingsBreakdown(counts);
        } catch {
          setRatingsBreakdown([0, 0, 0, 0, 0]);
        }

        if (user?.uid) {
          try {
            const existingRatingRef = doc(db, 'listings', listingId, 'ratings', user.uid);
            const existingRatingSnap = await getDoc(existingRatingRef);
            const value = Number(existingRatingSnap.data()?.rating || 0);
            const nextRating = value >= 1 && value <= 5 ? value : 0;
            setUserRating(nextRating);
            setHasRated(nextRating > 0);
          } catch {
            setUserRating(0);
            setHasRated(false);
          }
        } else {
          setUserRating(0);
          setHasRated(false);
        }

        try {
          const similarQuery = query(
            collection(db, 'listings'),
            where('active', '==', true),
            where('category', '==', listingData.category),
            limit(4)
          );
          const similarSnap = await getDocs(similarQuery);
          const rows = similarSnap.docs
            .map((item) => ({ id: item.id, ...item.data() } as Listing))
            .filter((item) => item.id !== listingId);
          setSimilarListings(rows.slice(0, 3));
        } catch {
          setSimilarListings([]);
        }

        try {
          if (!hasViewedListingInSession(listingId)) {
            await updateDoc(listingRef, { views: increment(1), totalViews: increment(1) });
            markListingViewedInSession(listingId);
            setListing((prev) => {
              if (!prev) return prev;
              const currentViews = Number(prev.views ?? prev.totalViews ?? 0);
              const nextViews = currentViews + 1;
              return { ...prev, views: nextViews, totalViews: nextViews };
            });
          }
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
  }, [listingId, showToast, user?.uid]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [listing?.id]);

  useEffect(() => {
    if (!ratingsSectionRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setAnimateBars(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(ratingsSectionRef.current);
    return () => observer.disconnect();
  }, [listing?.id]);

  if (loading) return <div className="h-screen flex items-center justify-center text-text-muted">Loading listing...</div>;
  if (!listing) return <div className="h-screen flex items-center justify-center text-text-muted">Listing not found.</div>;

  const isExpired = listing.validUntil?.toDate?.()?.getTime?.() ? listing.validUntil.toDate().getTime() < Date.now() : false;
  const todayLower = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()).toLowerCase();
  const todayTitle = todayLower.charAt(0).toUpperCase() + todayLower.slice(1);
  const todayMenuItems = formatMenuItems(getMenuForDay(listing, todayLower));
  const normalizedMenuItems = menuItems.filter((item) => item.itemName && Number.isFinite(Number(item.price)));
  const todayMenuFromItems = normalizedMenuItems.slice(0, 8);
  const structuredItems = getStructuredListingItems(listing, normalizedMenuItems);

  const displayedAverageRating = Math.min(5, Math.max(0, Number(listing.avgRating ?? listing.averageRating ?? 0)));
  const displayedTotalRatings = Math.max(0, Number(listing.totalRatings ?? 0));
  const displayedViews = Number(listing.views ?? listing.totalViews ?? 0);
  const isBillboard = listing.category === 'billboard' || String((listing as any).serviceType || '').toLowerCase() === 'billboard';
  const trafficLevel = String((listing as any).trafficLevel || 'Medium');
  const locationDisplay = String((listing as any).location || listing.address || listing.area || '').trim();
  const contactNumber = String((listing as any).contactNumber || listing.phone || '').trim();
  const whatsappNumber = String((listing as any).whatsappNumber || listing.whatsapp || listing.phone || '').trim();
  const trafficBadgeClass = trafficLevel === 'Very High'
    ? 'bg-red-500/20 text-red-300 border-red-500/40'
    : trafficLevel === 'High'
      ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
      : trafficLevel === 'Medium'
        ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
        : 'bg-green-500/20 text-green-300 border-green-500/40';
  const listingImages = getListingImages(listing);
  const hasImages = listingImages.length > 0;
  const currentImage = hasImages ? getOptimizedUrl(listingImages[activeImageIndex], 'detail') : '';
  const warningKey = `warningDismissed:${listingId}`;
  const warningText = String(
    (listing as any).warning
    || 'Do not make any advance payment without verifying the service in person. CampaNest is not responsible for financial transactions.'
  );
  const price = getPrimaryPrice(listing);

  const breakdownTotal = ratingsBreakdown.reduce((sum, current) => sum + current, 0);
  const getPercentage = (count: number) => (breakdownTotal === 0 ? 0 : Math.round((count / breakdownTotal) * 100));

  const prevImage = () => {
    if (listingImages.length < 2) return;
    setActiveImageIndex((current) => (current - 1 + listingImages.length) % listingImages.length);
  };

  const nextImage = () => {
    if (listingImages.length < 2) return;
    setActiveImageIndex((current) => (current + 1) % listingImages.length);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    showToast('Link copied', 'success');
  };

  const handleRate = async (stars: number) => {
    if (!listingId || !listing) return;
    if (!auth.currentUser || !user?.uid) {
      showToast('Please login to rate', 'error');
      return;
    }

    if (profile?.role !== 'student') {
      showToast('Only students can rate', 'error');
      return;
    }

    setSubmittingRating(true);
    const previousRating = userRating;
    const ratingValue = sanitizeStars(stars);
    setUserRating(ratingValue);
    setHasRated(true);
    try {
      const listingRef = doc(db, 'listings', listingId);
      const ratingRef = doc(db, 'listings', listingId, 'ratings', user.uid);

      const result = await runTransaction(db, async (tx) => {
        const listingSnap = await tx.get(listingRef);
        if (!listingSnap.exists()) throw new Error('Listing not found');

        const existingRatingSnap = await tx.get(ratingRef);
        const listingData = listingSnap.data() as any;

        const oldAverage = Number(listingData?.avgRating ?? listingData?.averageRating ?? 0);
        const oldTotal = Math.max(0, Number(listingData?.totalRatings || 0));
        const oldUserRating = existingRatingSnap.exists()
          ? sanitizeStars(Number(existingRatingSnap.data()?.rating || 0))
          : null;

        let nextTotal = oldTotal;
        let nextAverage = oldAverage;

        if (oldUserRating === null) {
          nextTotal = oldTotal + 1;
          nextAverage = nextTotal > 0
            ? Number((((oldAverage * oldTotal) + ratingValue) / nextTotal).toFixed(1))
            : 0;
        } else {
          nextAverage = nextTotal > 0
            ? Number((((oldAverage * oldTotal) - oldUserRating + ratingValue) / nextTotal).toFixed(1))
            : 0;
        }

        tx.set(ratingRef, {
          uid: user.uid,
          rating: ratingValue,
          createdAt: existingRatingSnap.data()?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });

        tx.update(listingRef, {
          avgRating: nextAverage,
          averageRating: nextAverage,
          totalRatings: nextTotal,
          lastUpdated: serverTimestamp()
        });

        return { nextAverage, nextTotal, wasUpdate: oldUserRating !== null };
      });

      setListing((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          avgRating: result.nextAverage,
          averageRating: result.nextAverage,
          totalRatings: result.nextTotal
        };
      });
      setRatingsBreakdown((prev) => {
        const next = [...prev];
        if (userRating >= 1 && userRating <= 5) {
          next[userRating - 1] = Math.max(0, (next[userRating - 1] || 0) - 1);
        }
        next[ratingValue - 1] = (next[ratingValue - 1] || 0) + 1;
        return next;
      });
      setUserRating(ratingValue);
      showToast(result.wasUpdate ? 'Rating updated successfully!' : 'Rating submitted successfully!', 'success');
    } catch (error: any) {
      setUserRating(previousRating);
      setHasRated(previousRating > 0);
      console.error('[Rating] submit failed:', error);
      if (error?.code === 'permission-denied') {
        showToast('Rating permission denied. Please refresh and try again.', 'error');
      } else {
        showToast(error?.message || 'Failed to submit rating. Please try again.', 'error');
      }
    } finally {
      setSubmittingRating(false);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 pt-6">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => navigate(-1)} className="btn-outline px-4 py-2 text-sm inline-flex items-center gap-1.5">
            <ChevronLeft size={16} /> Back
          </button>
          <button onClick={copyLink} className="btn-outline px-4 py-2 text-sm inline-flex items-center gap-1.5">
            <Copy size={16} /> Share
          </button>
        </div>

        {showWarning && (
          <div className="warning-banner-enter mt-4 card bg-[#1A1A28] border-l-[3px] border-l-warning">
            <button
              type="button"
              onClick={() => {
                setShowWarning(false);
                sessionStorage.setItem(warningKey, '1');
              }}
              className="absolute right-4 top-4 text-text-muted hover:text-text"
              aria-label="Close warning"
            >
              ✖
            </button>
            <p className="pr-8 text-sm text-text-muted leading-relaxed">
              <span className="text-warning mr-1">⚠️</span>
              {warningText}
            </p>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
          <div className="space-y-5">
                        <div className="card p-0 overflow-hidden">
              <div
                className="relative aspect-[16/9] bg-[#141422]"
                onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
                onTouchEnd={(event) => {
                  if (touchStartX === null) return;
                  const endX = event.changedTouches[0]?.clientX ?? touchStartX;
                  const diff = endX - touchStartX;
                  if (Math.abs(diff) > 40) {
                    if (diff > 0) prevImage();
                    else nextImage();
                  }
                  setTouchStartX(null);
                }}
              >
                {hasImages && currentImage ? (
                  <img
                    src={currentImage}
                    alt={listing.name}
                    className="listing-image"
                    loading="eager"
                    onError={(event) => {
                      const target = event.currentTarget;
                      target.onerror = null;
                      target.src = '/placeholder.jpg';
                      console.error('Slider image failed:', currentImage);
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500">
                    <Camera size={30} />
                  </div>
                )}
                {listingImages.length > 1 && (
                  <>
                    <button type="button" onClick={prevImage} className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 items-center justify-center text-white">&#8249;</button>
                    <button type="button" onClick={nextImage} className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 items-center justify-center text-white">&#8250;</button>
                  </>
                )}
                <span className="absolute top-3 left-3 tag-label px-3 py-1 rounded-full bg-primary/90 text-white">
                  {CATEGORY_LABELS[listing.category] || listing.category}
                </span>
                {isExpired && <span className="absolute top-3 right-3 tag-label px-3 py-1 rounded-full bg-red-500/80 text-white">Expired</span>}
                {listingImages.length > 0 && (
                  <span className="absolute top-3 right-3 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                    {activeImageIndex + 1} / {listingImages.length}
                  </span>
                )}
              </div>

              {listingImages.length > 1 && (
                <div className="p-3 border-t border-border">
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {listingImages.map((image, index) => {
                      const thumbUrl = getOptimizedUrl(image, 'thumb');
                      return (
                        <button
                          key={`${image}-${index}`}
                          type="button"
                          onClick={() => setActiveImageIndex(index)}
                          className={`relative w-20 h-14 rounded-lg overflow-hidden border ${index === activeImageIndex ? 'border-primary' : 'border-border'}`}
                        >
                          <img
                            src={thumbUrl}
                            alt={`Thumbnail ${index + 1}`}
                            className="listing-image"
                            loading="lazy"
                            onError={(event) => {
                              const target = event.currentTarget;
                              target.onerror = null;
                              target.src = '/placeholder.jpg';
                              console.error('Slider thumbnail failed:', thumbUrl);
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="card">
              <h1 className="text-3xl">{listing.name}</h1>
              <p className="mt-2 text-text-muted flex items-center gap-1 text-sm"><MapPin size={14} /> {isBillboard && locationDisplay ? locationDisplay : listing.area} · Near {listing.nearCollege || 'Campus Area'}</p>
              <p className="mt-2 text-xs text-text-muted">{formatLastUpdated(listing.lastUpdated || listing.createdAt)}</p>
              {isBillboard && (
                <div className="mt-3 flex items-center flex-wrap gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${trafficBadgeClass}`}>{trafficLevel}</span>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-border bg-surface-elevated text-text">Area: {listing.area}</span>
                </div>
              )}
              <div className="mt-4 flex items-center flex-wrap gap-4 text-sm">
                <RatingStars avgRating={displayedAverageRating} totalRatings={displayedTotalRatings} size={14} className="font-medium" />
                <span className="inline-flex items-center gap-1 text-text-muted"><Eye size={14} /> {displayedViews} views</span>
              </div>
            </div>

            {isBillboard && (
              <div className="card space-y-3">
                <h3 className="text-xl">Billboard Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <p className="rounded-xl border border-border bg-surface-elevated px-3 py-2">Location: {locationDisplay || 'N/A'}</p>
                  <p className="rounded-xl border border-border bg-surface-elevated px-3 py-2">Exact Address: {listing.address || 'N/A'}</p>
                  <p className="rounded-xl border border-border bg-surface-elevated px-3 py-2">Traffic Level: {trafficLevel}</p>
                  <p className="rounded-xl border border-border bg-surface-elevated px-3 py-2">Size: {String((listing as any).size || 'N/A')}</p>
                  <p className="rounded-xl border border-border bg-surface-elevated px-3 py-2">Price Per Month: {price ? `₹${price.toLocaleString('en-IN')}` : 'N/A'}</p>
                  <p className="rounded-xl border border-border bg-surface-elevated px-3 py-2">Near College: {listing.nearCollege || 'N/A'}</p>
                  <p className="rounded-xl border border-border bg-surface-elevated px-3 py-2">Near Landmark: {String((listing as any).nearLandmark || listing.landmark || 'N/A')}</p>
                </div>
              </div>
            )}

            {(listing.category === 'mess' || listing.category === 'hotel' || listing.category === 'shop') && (
              <div className="card">
                <h3 className="text-xl">{listing.category === 'shop' ? 'Items' : 'Menu'} </h3>
                {loadingMenuItems ? (
                  <p className="mt-3 text-sm text-text-muted">Loading items...</p>
                ) : structuredItems.length === 0 ? (
                  <p className="mt-3 text-sm text-text-muted">No items available right now.</p>
                ) : (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {structuredItems.map((item, index) => (
                      <div key={`${item.name}-${index}`} className="rounded-xl border border-border bg-surface-elevated p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-text-muted">₹{item.price}</p>
                        </div>
                        {item.description && <p className="mt-1.5 text-xs text-text-muted">{item.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {listing.category === 'mess' && (
              <div className="card space-y-4">
                <div>
                  <h3 className="text-xl">Today&apos;s Menu</h3>
                  <p className="text-xs text-text-muted mt-1">{todayTitle}</p>
                  {todayMenuFromItems.length > 0 ? (
                    <ul className="mt-3 space-y-1 text-sm text-text-muted">
                      {todayMenuFromItems.map((item) => <li key={item.id || item.itemName}>• {item.itemName}</li>)}
                    </ul>
                  ) : todayMenuItems.length > 0 ? (
                    <ul className="mt-3 space-y-1 text-sm text-text-muted">
                      {todayMenuItems.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-text-muted">Menu not shared for today.</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <p className="rounded-xl border border-border bg-surface-elevated px-3 py-2">Monthly: {listing.monthlyRate ? `₹${listing.monthlyRate}` : 'N/A'}</p>
                  <p className="rounded-xl border border-border bg-surface-elevated px-3 py-2">Weekly: {listing.weeklyRate ? `₹${listing.weeklyRate}` : 'N/A'}</p>
                  <p className="rounded-xl border border-border bg-surface-elevated px-3 py-2">Per Plate: {listing.perPlateRate ? `₹${listing.perPlateRate}` : 'N/A'}</p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-sm">Weekly Menu</h4>
                  {dayOrder.map((day) => (
                    <div key={day} className="rounded-xl border border-border bg-surface-elevated px-3 py-2">
                      <p className="text-xs tag-label text-primary capitalize">{day}</p>
                      <p className="text-xs text-text-muted mt-1">{getMenuForDay(listing, day) || 'Not available'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(listing.category === 'pg' || listing.category === 'hostel' || listing.category === 'flat') && (
              <div className="card">
                <h3 className="text-xl">Amenities & Stay Details</h3>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border bg-surface-elevated p-3 text-sm">Gender: {listing.gender || 'both'}</div>
                  <div className="rounded-xl border border-border bg-surface-elevated p-3 text-sm">Room Type: {listing.roomType || 'withCot'}</div>
                  <div className="rounded-xl border border-border bg-surface-elevated p-3 text-sm">Mess: {listing.messAvailable ? 'Available' : 'No'}</div>
                  <div className="rounded-xl border border-border bg-surface-elevated p-3 text-sm">Rooms Left: {Number(((listing as any).roomsAvailable ?? listing.availableRooms) || 0)}</div>
                  <div className="rounded-xl border border-border bg-surface-elevated p-3 text-sm">Area: {listing.area}</div>
                  <div className="rounded-xl border border-border bg-surface-elevated p-3 text-sm">Near: {listing.nearCollege || 'N/A'}</div>
                </div>
              </div>
            )}

            <div className="card">
              <h3 className="text-xl">Description</h3>
              <p className="mt-3 text-sm text-text-muted leading-relaxed">{listing.description}</p>
            </div>

            <div className="card" ref={ratingsSectionRef}>
              <h3 className="text-xl">Ratings & Reviews</h3>
              <div className="mt-4">
                <RatingStars avgRating={displayedAverageRating} totalRatings={displayedTotalRatings} size={20} />
              </div>

              <div className="mt-4 space-y-3">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = ratingsBreakdown[star - 1];
                  const percentage = getPercentage(count);
                  return (
                    <div key={star} className="grid grid-cols-[40px_minmax(0,1fr)_44px] items-center gap-3 text-xs text-text-muted">
                      <span>{star}★</span>
                      <div className="rating-bar-track">
                        <div className="rating-bar-fill" style={{ width: animateBars ? `${percentage}%` : '0%' }} />
                      </div>
                      <span className="text-right">{percentage}%</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5">
                <p className="text-xs text-text-muted mb-2">
                  {userRating > 0 ? `Your rating: ${userRating} star${userRating > 1 ? 's' : ''} (tap to update)` : 'Rate this listing'}
                </p>
                <div className="flex items-center gap-1" style={{ cursor: 'pointer' }}>
                  {authLoading ? (
                    <p className="text-xs text-text-muted">Checking login status...</p>
                  ) : user ? (
                    [1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => {
                          if (submittingRating) return;
                          void handleRate(star);
                        }}
                        style={{
                          fontSize: '32px',
                          lineHeight: '1',
                          color: star <= (hoverRating || userRating) ? '#F59E0B' : '#444455',
                          transition: 'color 100ms ease',
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          opacity: submittingRating ? 0.6 : 1
                        }}
                        aria-label={`Rate ${star}`}
                        role="button"
                      >
                        ★
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-text-muted">
                      Please <Link to="/login" className="text-primary">login</Link> to rate
                    </p>
                  )}
                </div>
                {user && hasRated && (
                  <p style={{ color: '#22C55E', fontSize: '13px', marginTop: '8px' }}>
                    ✓ You rated this {userRating} / 5
                  </p>
                )}
                {!user && (
                  <p style={{ color: '#9090AA', fontSize: '13px', marginTop: '8px' }}>
                    Please login to rate this listing
                  </p>
                )}
              </div>
            </div>

            {similarListings.length > 0 && (
              <div className="card">
                <h3 className="text-xl">Similar Listings</h3>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {similarListings.map((item) => {
                    const image = getOptimizedUrl(getListingImages(item)[0], 'thumb');
                    return (
                      <Link key={item.id} to={`/listing/${item.id}`} className="rounded-xl border border-border bg-surface-elevated p-3 hover:border-primary transition-colors">
                        {image && (
                          <img
                            src={image}
                            alt={item.name}
                            className="w-full h-28 rounded-lg object-cover mb-3"
                            loading="lazy"
                            onError={(event) => {
                              const target = event.currentTarget;
                              target.onerror = null;
                              target.src = '/placeholder.jpg';
                              console.error('Similar listing image failed:', image);
                            }}
                          />
                        )}
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-text-muted mt-1">{item.area}</p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
            <div className="card">
              <p className="tag-label text-text-muted">Listing Price</p>
              <p className="mt-2 text-3xl font-bold text-text">{price ? `₹${price.toLocaleString('en-IN')}` : 'Contact for Price'}</p>
              <p className="mt-2 text-xs text-text-muted">
                {isBillboard
                  ? 'Billboard rental listing'
                  : listing.category === 'advertisement'
                    ? 'Promotional advertisement listing'
                    : 'Verified provider listing'}
              </p>
            </div>

            <div className="card space-y-2">
              <button
                type="button"
                onClick={() => { window.location.href = `tel:${contactNumber}`; }}
                className="btn-outline w-full inline-flex items-center justify-center gap-2 rounded-xl"
              >
                <Phone size={16} /> Call
              </button>
              <button
                type="button"
                onClick={() => {
                  const waNumber = normalizeWhatsAppNumber(contactNumber, whatsappNumber);
                  if (!waNumber) return;
                  window.open(`https://wa.me/${waNumber}`, '_blank', 'noopener,noreferrer');
                }}
                className="btn-primary w-full inline-flex items-center justify-center gap-2 rounded-xl"
              >
                <MessageCircle size={16} /> WhatsApp
              </button>
              <button
                type="button"
                onClick={() => window.open(getListingMapUrl(listing), '_blank', 'noopener,noreferrer')}
                className="btn-outline w-full inline-flex items-center justify-center gap-2 rounded-xl"
              >
                <Navigation size={16} /> View on Map
              </button>
              <button
                type="button"
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(window.location.href)}`, '_blank', 'noopener,noreferrer')}
                className="btn-outline w-full inline-flex items-center justify-center gap-2 rounded-xl"
              >
                <Send size={16} /> Share Listing
              </button>
            </div>

            <div className="card bg-[#161622] border-l-[3px] border-l-warning">
              <p className="text-sm text-text-muted leading-relaxed">
                <span className="text-warning mr-1">⚠️</span>
                Always verify in person before any transaction. CampaNest is not responsible for direct payments made to providers.
              </p>
            </div>

            <div className="card">
              <h4 className="font-bold text-sm">Address</h4>
              <p className="mt-2 text-sm text-text-muted">{listing.address || 'Address not shared'}</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

