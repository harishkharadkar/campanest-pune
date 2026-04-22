import imageCompression from 'browser-image-compression';

type OptimizationType = 'thumb' | 'detail';

const CLOUD_NAME = String(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim();
const UPLOAD_PRESET = String(import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim();
const FALLBACK_CLOUD_NAME = 'ddyljqef3';
const FALLBACK_UPLOAD_PRESET = 'campanest_upload';

const getCloudName = () => CLOUD_NAME || FALLBACK_CLOUD_NAME;
const getUploadPreset = () => UPLOAD_PRESET || FALLBACK_UPLOAD_PRESET;

const getUploadEndpoint = () => `https://api.cloudinary.com/v1_1/${getCloudName()}/image/upload`;

export const getOptimizedUrl = (url?: string, type: OptimizationType = 'detail') => {
  const raw = String(url || '').trim();
  if (!raw || !raw.includes('res.cloudinary.com') || !raw.includes('/upload/')) return raw;

  const transformation = type === 'thumb'
    ? 'c_fill,w_600,h_400,q_auto,f_auto'
    : 'q_auto,f_auto';

  if (raw.includes(`/upload/${transformation}/`)) return raw;

  return raw.replace('/upload/', `/upload/${transformation}/`);
};

export const optimizeCloudinaryUrl = (url?: string, type: OptimizationType = 'detail') => getOptimizedUrl(url, type);

type UploadProgressCallback = (progress: number) => void;

export const uploadToCloudinary = async (file: File, onProgress?: UploadProgressCallback) => {
  if (!file) throw new Error('No file selected');

  console.log('[Cloudinary] file selected', {
    name: file.name,
    size: file.size,
    type: file.type
  });

  const compressed = await imageCompression(file, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
  });

  const formData = new FormData();
  formData.append('file', compressed);
  formData.append('upload_preset', getUploadPreset());

  const endpoint = getUploadEndpoint();
  console.log('[Cloudinary] upload started', { endpoint, preset: getUploadPreset() });

  const secureUrl = await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      const pct = Math.min(100, Math.round((event.loaded / event.total) * 100));
      onProgress(pct);
    };

    xhr.onload = () => {
      let data: any = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        data = {};
      }

      console.log('[Cloudinary] upload response received', data);

      const url = String(data?.secure_url || '').trim();
      if (xhr.status >= 200 && xhr.status < 300 && url) {
        onProgress?.(100);
        resolve(url);
      } else {
        reject(new Error(String(data?.error?.message || 'Upload failed')));
      }
    };

    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(formData);
  });

  return secureUrl;
};

export const uploadImage = uploadToCloudinary;
