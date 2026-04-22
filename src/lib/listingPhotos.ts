export const LEGACY_PHOTO_ARRAY_FIELDS = [
  'photos',
  'images',
  'imageUrls',
  'photoUrls',
  'imgs',
  'pictures',
  'imageList',
] as const;

const LEGACY_PHOTO_SINGLE_FIELDS = ['photo', 'image', 'bannerImage'] as const;

const normalizeUrl = (value: unknown) => String(value || '').trim();

export const getListingPhotos = (listing?: Record<string, unknown> | null): string[] => {
  if (!listing) return [];

  const urls: string[] = [];

  LEGACY_PHOTO_ARRAY_FIELDS.forEach((field) => {
    const value = listing[field];
    if (!Array.isArray(value)) return;

    value.forEach((entry) => {
      const url = normalizeUrl(entry);
      if (url) urls.push(url);
    });
  });

  LEGACY_PHOTO_SINGLE_FIELDS.forEach((field) => {
    const url = normalizeUrl(listing[field]);
    if (url) urls.push(url);
  });

  return Array.from(new Set(urls));
};

