import React, { useMemo, useState } from 'react';
import { MenuItemCategory, MenuItemType } from '../types';

export interface DraftMenuItem {
  itemName: string;
  price: number;
  type: MenuItemType;
  category: MenuItemCategory;
  servingDetails?: string;
}

interface MenuItemInputProps {
  onAdd: (item: DraftMenuItem) => void;
  disabled?: boolean;
}

const DEFAULT_ITEM: DraftMenuItem = {
  itemName: '',
  price: 0,
  type: 'Veg',
  category: 'Main',
  servingDetails: ''
};

export default function MenuItemInput({ onAdd, disabled = false }: MenuItemInputProps) {
  const [draft, setDraft] = useState<DraftMenuItem>(DEFAULT_ITEM);
  const [touched, setTouched] = useState(false);

  const canAdd = useMemo(() => {
    return draft.itemName.trim().length > 0 && Number.isFinite(draft.price) && draft.price > 0;
  }, [draft.itemName, draft.price]);

  const updateField = <K extends keyof DraftMenuItem>(key: K, value: DraftMenuItem[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const onAddItem = () => {
    setTouched(true);
    if (!canAdd) return;
    onAdd({
      itemName: draft.itemName.trim(),
      price: Number(draft.price),
      type: draft.type,
      category: draft.category,
      servingDetails: draft.servingDetails?.trim() || ''
    });
    setDraft(DEFAULT_ITEM);
    setTouched(false);
  };

  return (
    <div className="space-y-3 border border-zinc-800 rounded-lg p-3 bg-zinc-950/60">
      <p className="text-sm font-semibold">Add Menu Item</p>
      <input
        className="input-field"
        placeholder="Item name"
        value={draft.itemName}
        onChange={(e) => updateField('itemName', e.target.value)}
        disabled={disabled}
      />
      <input
        className="input-field"
        type="number"
        min={1}
        placeholder="Price"
        value={draft.price || ''}
        onChange={(e) => updateField('price', Number(e.target.value))}
        disabled={disabled}
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          className="input-field"
          value={draft.type}
          onChange={(e) => updateField('type', e.target.value as MenuItemType)}
          disabled={disabled}
        >
          <option value="Veg">Veg</option>
          <option value="Non-Veg">Non-Veg</option>
        </select>
        <select
          className="input-field"
          value={draft.category}
          onChange={(e) => updateField('category', e.target.value as MenuItemCategory)}
          disabled={disabled}
        >
          <option value="Thali">Thali</option>
          <option value="Combo">Combo</option>
          <option value="Main">Main</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <textarea
        className="input-field h-20"
        placeholder="Serving details (optional, one line per point)"
        value={draft.servingDetails}
        onChange={(e) => updateField('servingDetails', e.target.value)}
        disabled={disabled}
      />
      {touched && !canAdd && (
        <p className="text-xs text-red-400">Item name and valid price are required.</p>
      )}
      <button type="button" className="btn-outline w-full" onClick={onAddItem} disabled={disabled}>
        Add Item
      </button>
    </div>
  );
}
