import { buildApiUrl, API_ENDPOINTS } from '../config/api';

const WATERMARK_SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const WATERMARK_LOGO_URL = `${import.meta.env.BASE_URL}logo.png`;

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
  image.src = src;
});

const canvasToBlob = (canvas, mimeType, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob) {
      reject(new Error('Failed to create watermarked image blob'));
      return;
    }

    resolve(blob);
  }, mimeType, quality);
});

const createWatermarkedImageFile = async (file) => {
  const normalizedType = String(file.type || '').toLowerCase();
  if (!WATERMARK_SUPPORTED_IMAGE_TYPES.has(normalizedType)) {
    return null;
  }

  const sourceUrl = URL.createObjectURL(file);

  try {
    const [sourceImage, logoImage] = await Promise.all([
      loadImage(sourceUrl),
      loadImage(WATERMARK_LOGO_URL)
    ]);

    const canvas = document.createElement('canvas');
    canvas.width = sourceImage.naturalWidth || sourceImage.width;
    canvas.height = sourceImage.naturalHeight || sourceImage.height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context unavailable');
    }

    context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

    const logoWidth = Math.max(Math.min(Math.round(canvas.width * 0.2), 280), 90);
    const logoHeight = Math.round((logoImage.naturalHeight || logoImage.height) * (logoWidth / (logoImage.naturalWidth || logoImage.width)));
    const logoX = Math.max(canvas.width - logoWidth, 0);
    const logoY = Math.max(canvas.height - logoHeight, 0);

    context.globalAlpha = 0.9;
    context.drawImage(logoImage, logoX, logoY, logoWidth, logoHeight);
    context.globalAlpha = 1;

    const outputType = normalizedType === 'image/png' ? 'image/png' : normalizedType === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const outputQuality = outputType === 'image/jpeg' || outputType === 'image/webp' ? 0.9 : undefined;
    const blob = await canvasToBlob(canvas, outputType, outputQuality);

    return new File([blob], file.name || `watermarked-${Date.now()}`, {
      type: blob.type || outputType,
      lastModified: file.lastModified || Date.now()
    });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
};

const uploadWithLegacyApi = async (token, file) => {
  const formData = new FormData();
  formData.append('file', file);

  const uploadRes = await fetch(buildApiUrl(API_ENDPOINTS.UPLOAD), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(text || 'Legacy upload failed');
  }

  const uploadData = await uploadRes.json();
  return { url: uploadData.url, storageMode: uploadData.storageMode || 'api-upload' };
};

export const uploadFileDirect = async ({ token, file, applyWatermark = true }) => {
  if (!token) throw new Error('Missing auth token');
  if (!file) throw new Error('Missing file');

  const normalizedType = String(file.type || '').toLowerCase();

  if (normalizedType.startsWith('image/')) {
    try {
      const watermarkedFile = applyWatermark ? await createWatermarkedImageFile(file) : null;
      if (!watermarkedFile) {
        return uploadWithLegacyApi(token, file);
      }

      const prepareRes = await fetch(buildApiUrl(API_ENDPOINTS.UPLOAD_SIGNED_URL), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileName: watermarkedFile.name,
          contentType: watermarkedFile.type || normalizedType,
          fileSize: watermarkedFile.size
        })
      });

      if (!prepareRes.ok) {
        if (prepareRes.status === 503) {
          return uploadWithLegacyApi(token, file);
        }

        const payload = await prepareRes.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to prepare upload');
      }

      const prepared = await prepareRes.json();
      const directUploadRes = await fetch(prepared.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': watermarkedFile.type || normalizedType },
        body: watermarkedFile
      });

      if (!directUploadRes.ok) {
        return uploadWithLegacyApi(token, file);
      }

      return { url: prepared.publicUrl, storageMode: 'supabase-direct-watermarked' };
    } catch (error) {
      console.warn('Direct watermark upload failed, falling back to backend upload:', error.message);
      return uploadWithLegacyApi(token, file);
    }
  }

  const prepareRes = await fetch(buildApiUrl(API_ENDPOINTS.UPLOAD_SIGNED_URL), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      fileSize: file.size
    })
  });

  if (!prepareRes.ok) {
    if (prepareRes.status === 503) {
      return uploadWithLegacyApi(token, file);
    }

    const payload = await prepareRes.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to prepare upload');
  }

  const prepared = await prepareRes.json();
  const directUploadRes = await fetch(prepared.signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file
  });

  if (!directUploadRes.ok) {
    return uploadWithLegacyApi(token, file);
  }

  return { url: prepared.publicUrl, storageMode: 'supabase-direct' };
};
