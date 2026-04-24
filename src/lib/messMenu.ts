import { Listing, MessMenuType } from '../types';

export type DayKey = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export type MenuSlot = { morning: string; evening: string };

export const WEEK_DAYS: DayKey[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const EMPTY_SLOT: MenuSlot = { morning: '', evening: '' };

const toText = (value: unknown) => String(value || '').trim();

const normalizeDailyKey = (raw: string) => {
  const value = String(raw || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
};

export const toLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const normalizeWeeklyMenu = (raw: unknown): Record<DayKey, MenuSlot> => {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const normalized = {} as Record<DayKey, MenuSlot>;

  WEEK_DAYS.forEach((day) => {
    const lowerKey = day.toLowerCase();
    const value = input[day] ?? input[lowerKey];
    if (value && typeof value === 'object') {
      normalized[day] = {
        morning: toText((value as Record<string, unknown>).morning),
        evening: toText((value as Record<string, unknown>).evening)
      };
      return;
    }

    // Legacy format fallback: single text stored per day.
    const legacyText = toText(value);
    normalized[day] = legacyText ? { morning: '', evening: legacyText } : { ...EMPTY_SLOT };
  });

  return normalized;
};

export const normalizeDailyMenu = (raw: unknown) => {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const output: Record<string, MenuSlot> = {};

  Object.entries(input).forEach(([key, value]) => {
    const dateKey = normalizeDailyKey(key);
    if (!dateKey || !value || typeof value !== 'object') return;
    output[dateKey] = {
      morning: toText((value as Record<string, unknown>).morning),
      evening: toText((value as Record<string, unknown>).evening)
    };
  });

  return output;
};

const resolveMenuType = (listing: Listing): MessMenuType => {
  const configured = toText(listing.menuType).toLowerCase();
  if (configured === 'daily') return 'daily';
  if (configured === 'fixed') return 'fixed';
  const daily = normalizeDailyMenu((listing as Record<string, unknown>).dailyMenu);
  return Object.keys(daily).length > 0 ? 'daily' : 'fixed';
};

export const getTodayMessMenu = (listing: Listing, date = new Date()) => {
  const menuType = resolveMenuType(listing);
  if (menuType === 'daily') {
    const daily = normalizeDailyMenu((listing as Record<string, unknown>).dailyMenu);
    return daily[toLocalDateKey(date)] || { ...EMPTY_SLOT };
  }

  const weekly = normalizeWeeklyMenu((listing as Record<string, unknown>).weeklyMenu);
  const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date) as DayKey;
  return weekly[dayName] || { ...EMPTY_SLOT };
};

export const getRecentDailyMenuEntries = (listing: Listing, limit = 7) => {
  const daily = normalizeDailyMenu((listing as Record<string, unknown>).dailyMenu);
  return Object.entries(daily)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, limit)
    .map(([date, slot]) => ({ date, ...slot }));
};

export const getResolvedMenuType = (listing: Listing): MessMenuType => resolveMenuType(listing);
