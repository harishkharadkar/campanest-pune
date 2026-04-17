import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { Listing, Rating } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { addDays, format } from 'date-fns';
import { CATEGORY_LABELS } from '../constants';

export default function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [listings, setListings] = useState<Listing[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredListings, setFilteredListings] = useState<Listing[]>([]);
  const [category, setCategory] = useState('all');

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
    const ratingsQuery = query(collection(db, 'ratings'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(ratingsQuery, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Rating));
      setRatings(rows);
    }, () => {
      setRatings([]);
    });

    return () => unsub();
  }, []);

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

  const save = async (id: string, data: Partial<Listing>) => {
    try {
      await updateDoc(doc(db, 'listings', id), data as any);
      showToast('Updated', 'success');
    } catch (error: any) {
      showToast(error.message || 'Update failed', 'error');
    }
  };

  const extend = async (l: Listing, days: number) => {
    try {
      const base = l.validUntil?.toDate?.() || new Date();
      const next = addDays(base > new Date() ? base : new Date(), days);
      await save(l.id, { validUntil: next, duration: (l.duration || 0) + days });
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

  const deleteRating = async (ratingId: string) => {
    if (!ratingId) return;
    if (!confirm('Delete this rating?')) return;
    try {
      await deleteDoc(doc(db, 'ratings', ratingId));
      showToast('Rating deleted', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to delete rating', 'error');
    }
  };

  const categories = ['all', 'pg', 'hostel', 'flat', 'mess', 'shop', 'hotel', 'block', 'doctor', 'requirement', 'secondhand', 'advertisement'];

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 bg-background/90 backdrop-blur border-b border-zinc-800 px-6 py-4 z-20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">Admin Dashboard</h1>
            <p className="text-xs text-zinc-500">Manage Listings, Views, Ratings, Pricing</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-xs text-zinc-400 break-all">{user.email}</p>
            <div className="flex items-center gap-2">
              <Link to="/admin/add-listing" className="btn-primary text-sm px-4 py-2">+ Add Listing</Link>
              <button className="btn-outline text-sm px-4 py-2" onClick={handleLogout}>Logout</button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-4">
        <div className="space-y-3">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search listings by name, area, category"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-[15px] py-[10px] text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-primary"
          />
          <div className="pt-1">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field w-full sm:w-56">
              {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All' : (CATEGORY_LABELS[c] || c)}</option>)}
            </select>
          </div>
        </div>

        <section className="space-y-2 border border-zinc-800 rounded-lg p-3">
          <h4 className="text-xs font-bold tracking-wide text-zinc-400 uppercase">Ratings Moderation</h4>
          {ratings.length === 0 ? (
            <p className="text-xs text-zinc-500">No ratings found.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {ratings.slice(0, 50).map((rating) => (
                <div key={rating.id} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                  <div className="text-xs text-zinc-300">
                    <p>Listing: {rating.listingId || '-'}</p>
                    <p>User: {rating.userId || '-'}</p>
                    <p>Rating: {Number(rating.rating || 0)}</p>
                  </div>
                  <button className="text-red-500 text-xs font-semibold hover:text-red-400" onClick={() => deleteRating(String(rating.id || ''))}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {filteredListings.length === 0 && (
          <div className="card border-zinc-800 text-center py-12">
            <h3 className="text-xl font-bold">No listings found</h3>
          </div>
        )}

        {filteredListings.map((l) => {
          const cat = l.category || 'unknown';
          const expiry = l.validUntil?.toDate?.();
          const expired = expiry ? expiry.getTime() < Date.now() : false;
          const currentViews = Number(l.views ?? l.totalViews ?? 0);
          const currentAverageRating = Number(l.averageRating ?? l.avgRating ?? 0);
          const currentTotalRatings = Number(l.totalRatings ?? 0);

          return (
            <div key={l.id} className="card space-y-5 border-zinc-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-lg">{l.name}</h3>
                  <p className="text-xs text-zinc-500 uppercase">{CATEGORY_LABELS[cat] || cat} - {l.area}</p>
                </div>
                <div className="flex gap-2">
                  {l.isFeatured && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded">Featured</span>}
                  {l.isSponsored && <span className="text-[10px] bg-fuchsia-500/20 text-fuchsia-400 px-2 py-1 rounded">Sponsored</span>}
                  {expired && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-1 rounded">Expired</span>}
                </div>
              </div>

              <section className="space-y-2 border border-zinc-800 rounded-lg p-3">
                <h4 className="text-xs font-bold tracking-wide text-zinc-400 uppercase">Basic Info</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <p><span className="text-zinc-500">Name:</span> {l.name || '-'}</p>
                  <p><span className="text-zinc-500">Category:</span> {CATEGORY_LABELS[cat] || cat}</p>
                  <p><span className="text-zinc-500">Area:</span> {l.area || '-'}</p>
                </div>
              </section>

              <section className="space-y-2 border border-zinc-800 rounded-lg p-3">
                <h4 className="text-xs font-bold tracking-wide text-zinc-400 uppercase">Analytics</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <label className="space-y-1">
                    <span className="text-xs text-zinc-400">Views</span>
                    <input
                      type="number"
                      className="input-field"
                      defaultValue={currentViews}
                      onBlur={(e) => {
                        const value = Number(e.target.value || 0);
                        save(l.id, { views: value, totalViews: value });
                      }}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-zinc-400">Average Rating</span>
                    <input
                      type="number"
                      step="0.1"
                      className="input-field"
                      defaultValue={currentAverageRating}
                      onBlur={(e) => {
                        const value = Number(e.target.value || 0);
                        save(l.id, { averageRating: value, avgRating: value });
                      }}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-zinc-400">Total Ratings</span>
                    <input
                      type="number"
                      className="input-field"
                      defaultValue={currentTotalRatings}
                      onBlur={(e) => save(l.id, { totalRatings: Number(e.target.value || 0) })}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-zinc-400">Priority Score</span>
                    <input type="number" className="input-field" defaultValue={l.priorityScore || 0} onBlur={(e) => save(l.id, { priorityScore: Number(e.target.value || 0) })} />
                  </label>
                </div>
                <p className="text-[11px] text-zinc-500">Higher value appears higher in listings.</p>
              </section>

              <section className="space-y-2 border border-zinc-800 rounded-lg p-3">
                <h4 className="text-xs font-bold tracking-wide text-zinc-400 uppercase">Pricing</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <label className="space-y-1">
                    <span className="text-xs text-zinc-400">Price Plan</span>
                    <input type="number" className="input-field" defaultValue={l.pricePlan || 0} onBlur={(e) => save(l.id, { pricePlan: Number(e.target.value || 0) })} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-zinc-400">Plan Type</span>
                    <select className="input-field" defaultValue={l.planType || 'monthly'} onChange={(e) => save(l.id, { planType: e.target.value as any })}>
                      <option value="monthly">monthly</option>
                      <option value="perPost">perPost</option>
                      <option value="ad">ad</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="space-y-2 border border-zinc-800 rounded-lg p-3">
                <h4 className="text-xs font-bold tracking-wide text-zinc-400 uppercase">Status</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <button className="btn-outline" onClick={() => save(l.id, { isFeatured: !l.isFeatured })}>
                    {l.isFeatured ? 'Remove Featured' : 'Mark as Featured'}
                  </button>
                  <button className="btn-outline" onClick={() => save(l.id, { isSponsored: !l.isSponsored })}>
                    {l.isSponsored ? 'Remove Sponsored' : 'Mark as Sponsored'}
                  </button>
                  <button className="btn-outline" onClick={() => save(l.id, { active: false })}>
                    Deactivate Listing
                  </button>
                  <button className="btn-outline" onClick={() => save(l.id, { active: true })}>
                    Activate Listing
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500">Featured adds a badge and visibility boost.</p>
                <p className="text-[11px] text-zinc-500">Sponsored appears at the top section.</p>
              </section>

              <section className="space-y-2 border border-zinc-800 rounded-lg p-3">
                <h4 className="text-xs font-bold tracking-wide text-zinc-400 uppercase">Validity</h4>
                <p className="text-sm text-zinc-300">Valid Until: {expiry ? format(expiry, 'dd MMM yyyy') : 'N/A'}</p>
                <div className="flex gap-2 text-xs">
                  <button className="btn-outline" onClick={() => extend(l, 7)}>Extend 7 Days</button>
                  <button className="btn-outline" onClick={() => extend(l, 30)}>Extend 30 Days</button>
                </div>
              </section>

              <section className="flex items-center justify-end gap-4 pt-1">
                <button
                  className="btn-outline text-xs px-3 py-1.5"
                  onClick={() => navigate(`/admin/add-listing?id=${encodeURIComponent(l.id)}`)}
                >
                  Edit
                </button>
                <button className="text-red-500 text-sm font-semibold hover:text-red-400" onClick={() => remove(l.id)}>
                  Delete Listing
                </button>
              </section>
            </div>
          );
        })}
      </div>
    </div>
  );
}
