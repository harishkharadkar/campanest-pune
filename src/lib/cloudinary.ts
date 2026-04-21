export const optimizeCloudinaryUrl = (url?: string) => {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (!raw.includes('res.cloudinary.com') || raw.includes('/upload/f_auto,q_auto')) {
    return raw;
  }
  return raw.replace('/upload/', '/upload/f_auto,q_auto/');
};

export const uploadImage = async (file: File) => {
  console.log('[Cloudinary] file selected', {
    name: file?.name,
    size: file?.size,
    type: file?.type
  });

  if (!file) {
    alert('Please select an image file.');
    throw new Error('No file selected');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'campanest_upload');

  console.log('[Cloudinary] upload started', {
    endpoint: 'https://api.cloudinary.com/v1_1/ddyljqef3/image/upload',
    preset: 'campanest_upload'
  });

  const res = await fetch('https://api.cloudinary.com/v1_1/ddyljqef3/image/upload', {
    method: 'POST',
    body: formData
  });

  const data = await res.json().catch(() => ({}));
  console.log('[Cloudinary] upload response received', data);

  if (!res.ok) {
    alert('Image upload failed. Please try again.');
    throw new Error(String((data as any)?.error?.message || 'Image upload failed'));
  }

  const secureUrl = String((data as any)?.secure_url || '').trim();
  if (!secureUrl) {
    alert('Image upload failed. Cloudinary did not return secure_url.');
    throw new Error('Cloudinary secure_url missing');
  }

  return secureUrl;
};
