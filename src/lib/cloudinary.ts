type OptimizationType = 'thumb' | 'detail';

export const getOptimizedUrl = (url?: string, type: OptimizationType = 'detail') => {
  const raw = String(url || '').trim();
  if (!raw || !raw.includes('res.cloudinary.com') || !raw.includes('/upload/')) return raw;

  const transformation = type === 'thumb'
    ? 'c_fill,w_600,h_400,q_auto,f_auto'
    : 'q_auto,f_auto';

  if (raw.includes(`/upload/${transformation}/`)) return raw;

  return raw.replace('/upload/', `/upload/${transformation}/`);
};
