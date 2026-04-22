import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { collection, deleteDoc, doc, getDocs, onSnapshot, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { Listing } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { addDays, format } from 'date-fns';
import { CATEGORY_LABELS } from '../constants';
import { ChartColumnIncreasing, Check, Eye, LayoutDashboard, Pencil, ShieldCheck, Star, TimerReset, Trash2, X } from 'lucide-react';

const toSafeNonNegativeInt = (value: unknown) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return 0;
  return Math.max(0, Math.round(next));
};

const toSafeRatingAverage = (value: unknown) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return 0;
  const clamped = Math.min(5, Math.max(0, next));
  return Number(clamped.toFixed(1));
};

export default function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [listings, setListings] = useState<Listing[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredListings, setFilteredListings] = useState<Listing[]>([]);
  const [category, setCategory] = useState('all');

  const [editingViewsId, setEditingViewsId] = useState<string | null>(null);
  const [viewsDraft, setViewsDraft] = useState('0');
  const [editingRatingsId, setEditingRatingsId] = useState<string | null>(null);
  const [ratingsDraft, setRatingsDraft] = useState({ avg: '0', total: '0' });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'listings'), (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Listing));
      rows.sort((a, b) => {
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
      setListings(rows);
    }, () => {
      showToast('Failed to fetch listings', 'error');
    });

    return () => unsub();
  }, [showToast]);

  useEffect(() => {
    const term = searchQuery.trim().toLowerCase();
    const nextFiltered = listings.filter((listing) => {
      const name = (listing.name || '').toLowerCase();
      const area = (listing.area || '').toLowerCase();
      const listingCategory = (listing.category || '').toLowerCase();
      const matchesSearch = !term
        || name.includes(term)
        || area.includes(term)
        || listingCategory.includes(term);
      const matchesCategory = category === 'all' || (listing.category || '') === category;
      return matchesSearch && matchesCategory;
    });

    setFilteredListings(nextFiltered);
  }, [searchQuery, listings, category]);

  if (!user) return <Navigate to="/login" replace />;
  if ((user.email || '').toLowerCase() !== 'campanest7@gmail.com') return <Navigate to="/home" replace />;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login', { replace: true });
    } catch (error: any) {
      showToast(error.message || 'Logout failed', 'error');
    }
  };

  const save = async (id: string, data: Partial<Listing>, successMessage = 'Updated') => {
    try {
      await updateDoc(doc(db, 'listings', id), { ...data, lastUpdated: serverTimestamp() } as any);
      showToast(successMessage, 'success');
    } catch (error: any) {
      showToast(error.message || 'Update failed', 'error');
    }
  };

  const extend = async (l: Listing, days: number) => {
    try {
      const base = l.validUntil?.toDate?.() || new Date();
      const next = addDays(base > new Date() ? base : new Date(), days);
      await save(l.id, { validUntil: next, duration: (l.duration || 0) + days }, 'Validity extended');
    } catch (error: any) {
      showToast(error.message || 'Failed to extend validity', 'error');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete listing permanently?')) return;
    try {
      await deleteDoc(doc(db, 'listings', id));
      showToast('Listing deleted', 'success');
    } catch (error: any) {
      showToast(error.message || 'Delete failed', 'error');
    }
  };

  const startViewsEdit = (listing: Listing) => {
    const currentViews = toSafeNonNegativeInt(listing.views ?? listing.totalViews ?? 0);
    setEditingViewsId(listing.id);
    setViewsDraft(String(currentViews));
  };

  const saveViewsEdit = async (listingId: string) => {
    const value = toSafeNonNegativeInt(viewsDraft);
    await save(listingId, { views: value, totalViews: value }, 'Views updated');
    setEditingViewsId(null);
  };

  const resetViews = async (listingId: string) => {
    await save(listingId, { views: 0, totalViews: 0 }, 'Views reset');
    if (editingViewsId === listingId) setEditingViewsId(null);
  };

  const startRatingsEdit = (listing: Listing) => {
    const currentAverage = toSafeRatingAverage(listing.avgRating ?? listing.averageRating ?? 0);
    const currentTotal = toSafeNonNegativeInt(listing.totalRatings ?? 0);
    setEditingRatingsId(listing.id);
    setRatingsDraft({ avg: String(currentAverage), total: String(currentTotal) });
  };

  const saveRatingsEdit = async (listingId: string) => {
    const avgInput = Number(ratingsDraft.avg);
    const totalInput = Number(ratingsDraft.total);
    if (!Number.isFinite(avgInput) || avgInput < 0 || avgInput > 5 || !Number.isFinite(totalInput) || totalInput < 0) {
      showToast('Please enter valid rating values', 'error');
      return;
    }

    const avg = toSafeRatingAverage(avgInput);
    const total = toSafeNonNegativeInt(totalInput);
    await save(
      listingId,
      {
        averageRating: avg,
        avgRating: avg,
        totalRatings: total
      },
      'Rating updated successfully'
    );
    setEditingRatingsId(null);
  };

  const resetRatings = async (listingId: string) => {
    if (!confirm('Are you sure? This will delete all user ratings.')) return;

    try {
      const ratingsRef = collection(db, 'listings', listingId, 'ratings');
      const ratingsSnap = await getDocs(ratingsRef);
      const docs = ratingsSnap.docs;

      for (let index = 0; index < docs.length; index += 400) {
        const chunk = docs.slice(index, index + 400);
        const batch = writeBatch(db);
        chunk.forEach((item) => batch.delete(item.ref));
        await batch.commit();
      }

      await updateDoc(doc(db, 'listings', listingId), {
        averageRating: 0,
        avgRating: 0,
        totalRatings: 0,
        lastUpdated: serverTimestamp()
      });

      showToast('Ratings reset', 'success');
      if (editingRatingsId === listingId) setEditingRatingsId(null);
    } catch (error: any) {
      showToast(error.message || 'Failed to reset ratings', 'error');
    }
  };

  const recalculateRatings = async (listingId: string) => {
    try {
      const ratingsRef = collection(db, 'listings', listingId, 'ratings');
      const ratingsSnap = await getDocs(ratingsRef);
      const docs = ratingsSnap.docs;
      let totalRatings = 0;
      let sum = 0;

      docs.forEach((item) => {
        const rating = Number((item.data() as any)?.rating || 0);
        if (rating >= 1 && rating <= 5) {
          totalRatings += 1;
          sum += Math.round(rating);
        }
      });

      const avgRating = totalRatings > 0 ? toSafeRatingAverage(sum / totalRatings) : 0;
      await save(
        listingId,
        {
          avgRating,
          averageRating: avgRating,
          totalRatings
        },
        'Rating updated successfully'
      );
    } catch (error: any) {
      showToast(error.message || 'Failed to recalculate ratings', 'error');
    }
  };

  const categories = ['all', 'pg', 'hostel', 'flat', 'mess', 'shop', 'hotel', 'block', 'doctor', 'requirement', 'secondhand', 'advertisement'];

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 glass-navbar px-6 py-4 z-20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">Admin Dashboard</h1>
            <p className="text-xs text-text-muted">Manage listings, analytics, moderation and pricing.</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-xs text-text-muted break-all">{user.email}</p>
            <div className="flex items-center gap-2">
              <Link to="/admin/add-listing" className="btn-primary text-sm px-4 py-2">+ Add Listing</Link>
              <button className="btn-outline text-sm px-4 py-2" onClick={handleLogout}>Logout</button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 admin-shell">
        <aside className="admin-sidebar">
          <p className="tag-label text-text-muted px-2 mb-2">Admin Navigation</p>
          <nav className="space-y-1">
            <button type="button" className="w-full admin-nav-item admin-nav-item-active"><LayoutDashboard size={16} /> Listings</button>
            <button type="button" className="w-full admin-nav-item"><ChartColumnIncreasing size={16} /> Analytics</button>
            <button type="button" className="w-full admin-nav-item"><ShieldCheck size={16} /> Moderation</button>
          </nav>
        </aside>

        <div className="space-y-4">
          <div className="space-y-3">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search listings by name, area, category"
              className="input-field"
            />
            <div className="pt-1">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field w-full sm:w-56">
                {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All' : (CATEGORY_LABELS[c] || c)}</option>)}
              </select>
            </div>
          </div>

          {filteredListings.length === 0 && (
            <div className="card text-center py-12">
              <h3 className="text-xl font-bold">No listings found</h3>
            </div>
          )}

          {filteredListings.map((l) => {
            const cat = l.category || 'unknown';
            const expiry = l.validUntil?.toDate?.();
            const expired = expiry ? expiry.getTime() < Date.now() : false;
            const currentViews = toSafeNonNegativeInt(l.views ?? l.totalViews ?? 0);
            const currentAverageRating = toSafeRatingAverage(l.avgRating ?? l.averageRating ?? 0);
            const currentTotalRatings = toSafeNonNegativeInt(l.totalRatings ?? 0);

            return (
              <div key={l.id} className="card space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-lg">{l.name}</h3>
                    <p className="text-xs text-text-muted uppercase">{CATEGORY_LABELS[cat] || cat} - {l.area}</p>
                  </div>
                  <div className="flex gap-2">
                    {l.isFeatured && <span className="text-[10px] bg-yellow-500/20 text-warning px-2 py-1 rounded">Featured</span>}
                    {l.isSponsored && <span className="text-[10px] bg-fuchsia-500/20 text-fuchsia-400 px-2 py-1 rounded">Sponsored</span>}
                    {expired && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-1 rounded">Expired</span>}
                  </div>
                </div>

                <section className="space-y-2 border border-border rounded-xl p-3 bg-surface-elevated">
                  <h4 className="text-xs font-bold tracking-wide text-text-muted uppercase">Basic Info</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <p><span className="text-text-muted">Name:</span> {l.name || '-'}</p>
                    <p><span className="text-text-muted">Category:</span> {CATEGORY_LABELS[cat] || cat}</p>
                    <p><span className="text-text-muted">Area:</span> {l.area || '-'}</p>
                  </div>
                </section>

                <section className="space-y-2 border border-border rounded-xl p-3 bg-surface-elevated">
                  <h4 className="text-xs font-bold tracking-wide text-text-muted uppercase">Analytics</h4>

                  <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-text-muted">Views</p>
                      {editingViewsId === l.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            className="input-field w-28"
                            value={viewsDraft}
                            onChange={(e) => setViewsDraft(e.target.value)}
                          />
                          <button type="button" className="btn-primary text-xs px-3 py-2" onClick={() => void saveViewsEdit(l.id)}>Save</button>
                          <button type="button" className="btn-outline text-xs px-3 py-2" onClick={() => setEditingViewsId(null)}>
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold inline-flex items-center gap-1"><Eye size={14} /> {currentViews}</span>
                          <button type="button" className="btn-outline text-xs px-2 py-1.5 inline-flex items-center gap-1" onClick={() => startViewsEdit(l)}>
                            <Pencil size={12} /> Edit
                          </button>
                        </div>
                      )}
                    </div>
                    <button type="button" className="btn-outline text-xs px-3 py-2" onClick={() => void resetViews(l.id)}>Reset Views</button>
                  </div>

                  <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-text-muted">Ratings</p>
                      {editingRatingsId === l.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={5}
                            step="0.1"
                            className="input-field w-24"
                            value={ratingsDraft.avg}
                            onChange={(e) => setRatingsDraft((prev) => ({ ...prev, avg: e.target.value }))}
                            placeholder="Avg"
                          />
                          <input
                            type="number"
                            min={0}
                            step="1"
                            className="input-field w-24"
                            value={ratingsDraft.total}
                            onChange={(e) => setRatingsDraft((prev) => ({ ...prev, total: e.target.value }))}
                            placeholder="Total"
                          />
                          <button type="button" className="btn-primary text-xs px-2.5 py-2 inline-flex items-center" onClick={() => void saveRatingsEdit(l.id)} title="Save ratings">
                            <Check size={14} />
                          </button>
                          <button type="button" className="btn-outline text-xs px-2.5 py-2 inline-flex items-center" onClick={() => setEditingRatingsId(null)} title="Cancel ratings edit">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm font-semibold inline-flex items-center gap-1">
                            <Star size={14} className="text-warning" /> {currentAverageRating.toFixed(1)}
                            <button type="button" className="btn-outline text-xs px-2 py-1 inline-flex items-center" onClick={() => startRatingsEdit(l)} title="Edit average rating">
                              <Pencil size={12} />
                            </button>
                          </span>
                          <span className="text-sm font-semibold inline-flex items-center gap-1">
                            {currentTotalRatings}
                            <button type="button" className="btn-outline text-xs px-2 py-1 inline-flex items-center" onClick={() => startRatingsEdit(l)} title="Edit total ratings">
                              <Pencil size={12} />
                            </button>
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" className="btn-outline text-xs px-3 py-2" onClick={() => void resetRatings(l.id)}>Reset Ratings</button>
                      <button type="button" className="btn-outline text-xs px-3 py-2" onClick={() => void recalculateRatings(l.id)}>Recalculate</button>
                    </div>
                  </div>

                  <label className="space-y-1 block">
                    <span className="text-xs text-text-muted">Priority Score</span>
                    <input
                      type="number"
                      className="input-field"
                      defaultValue={l.priorityScore || 0}
                      onBlur={(e) => save(l.id, { priorityScore: toSafeNonNegativeInt(e.target.value) }, 'Priority updated')}
                    />
                  </label>
                  <p className="text-[11px] text-text-muted">Higher value appears higher in listings.</p>
                </section>

                <section className="space-y-2 border border-border rounded-xl p-3 bg-surface-elevated">
                  <h4 className="text-xs font-bold tracking-wide text-text-muted uppercase">Pricing</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <label className="space-y-1">
                      <span className="text-xs text-text-muted">Price Plan</span>
                      <input type="number" className="input-field" defaultValue={l.pricePlan || 0} onBlur={(e) => save(l.id, { pricePlan: toSafeNonNegativeInt(e.target.value) }, 'Price plan updated')} />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-text-muted">Plan Type</span>
                      <select className="input-field" defaultValue={l.planType || 'monthly'} onChange={(e) => save(l.id, { planType: e.target.value as any }, 'Plan type updated')}>
                        <option value="monthly">monthly</option>
                        <option value="perPost">perPost</option>
                        <option value="ad">ad</option>
                      </select>
                    </label>
                  </div>
                </section>

                <section className="space-y-2 border border-border rounded-xl p-3 bg-surface-elevated">
                  <h4 className="text-xs font-bold tracking-wide text-text-muted uppercase">Status</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <button className="btn-outline inline-flex items-center justify-center gap-2" title={l.isFeatured ? 'Remove featured' : 'Mark as featured'} onClick={() => save(l.id, { isFeatured: !l.isFeatured }, l.isFeatured ? 'Featured removed' : 'Marked featured')}>
                      <Star size={14} /> {l.isFeatured ? 'Remove Featured' : 'Mark as Featured'}
                    </button>
                    <button className="btn-outline inline-flex items-center justify-center gap-2" title={l.isSponsored ? 'Remove sponsored' : 'Mark as sponsored'} onClick={() => save(l.id, { isSponsored: !l.isSponsored }, l.isSponsored ? 'Sponsored removed' : 'Marked sponsored')}>
                      <Eye size={14} /> {l.isSponsored ? 'Remove Sponsored' : 'Mark as Sponsored'}
                    </button>
                    <button className="btn-outline" onClick={() => save(l.id, { active: false }, 'Listing deactivated')}>
                      Deactivate Listing
                    </button>
                    <button className="btn-outline" onClick={() => save(l.id, { active: true }, 'Listing activated')}>
                      Activate Listing
                    </button>
                  </div>
                  <p className="text-[11px] text-text-muted">Featured adds a badge and visibility boost.</p>
                  <p className="text-[11px] text-text-muted">Sponsored appears at the top section.</p>
                </section>

                <section className="space-y-2 border border-border rounded-xl p-3 bg-surface-elevated">
                  <h4 className="text-xs font-bold tracking-wide text-text-muted uppercase">Validity</h4>
                  <p className="text-sm text-text">Valid Until: {expiry ? format(expiry, 'dd MMM yyyy') : 'N/A'}</p>
                  <div className="flex gap-2 text-xs">
                    <button className="btn-outline inline-flex items-center gap-1.5" onClick={() => void extend(l, 7)}><TimerReset size={14} /> Extend 7 Days</button>
                    <button className="btn-outline inline-flex items-center gap-1.5" onClick={() => void extend(l, 30)}><TimerReset size={14} /> Extend 30 Days</button>
                  </div>
                </section>

                <section className="flex items-center justify-end gap-4 pt-1">
                  <button
                    className="btn-outline text-xs px-3 py-2 inline-flex items-center"
                    onClick={() => navigate(`/admin/add-listing?id=${encodeURIComponent(l.id)}`)}
                    title="Edit listing"
                    aria-label="Edit listing"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="btn-outline text-red-400 border-red-500/30 text-xs px-3 py-2 inline-flex items-center hover:border-red-500/50"
                    onClick={() => void remove(l.id)}
                    title="Delete listing"
                    aria-label="Delete listing"
                  >
                    <Trash2 size={14} />
                  </button>
                </section>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
