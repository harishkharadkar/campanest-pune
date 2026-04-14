import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MenuItem } from '../types';

const MAX_ITEMS = 250;

export default function FoodSearch() {
  const [input, setInput] = useState('');
  const [debouncedInput, setDebouncedInput] = useState('');
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedInput(input.trim().toLowerCase());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    const loadMenuItems = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'menuItems'), limit(MAX_ITEMS)));
        setItems(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as MenuItem)));
      } finally {
        setLoading(false);
      }
    };

    void loadMenuItems();
  }, []);

  const filteredItems = useMemo(() => {
    if (!debouncedInput) return [];
    return items
      .filter((item) => String(item.itemName || '').toLowerCase().includes(debouncedInput))
      .slice(0, 25);
  }, [items, debouncedInput]);

  return (
    <div className="card space-y-3">
      <h3 className="font-bold text-base">Food Search</h3>
      <input
        className="input-field"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Search menu items (e.g. thali, paneer)"
      />
      {loading ? (
        <p className="text-xs text-zinc-500">Loading food items...</p>
      ) : debouncedInput.length === 0 ? (
        <p className="text-xs text-zinc-500">Type an item name to search across mess/hotel listings.</p>
      ) : filteredItems.length === 0 ? (
        <p className="text-xs text-zinc-500">No matching food items found.</p>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div key={item.id || `${item.listingId}-${item.itemName}`} className="rounded-lg border border-zinc-800 p-3 bg-zinc-900/50">
              <p className="font-semibold text-sm">{item.itemName}</p>
              <p className="text-xs text-primary font-bold mt-0.5">₹{Number(item.price || 0)}</p>
              <p className="text-xs text-zinc-400 mt-1">{item.listingName || 'Listing'} · {item.location || 'Location not available'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
