import { buildApiUrl, API_ENDPOINTS } from '../config/api';

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

export const uploadFileDirect = async ({ token, file }) => {
  if (!token) throw new Error('Missing auth token');
  if (!file) throw new Error('Missing file');

  // Image uploads must pass through the backend so the store logo watermark can be applied.
  if (String(file.type || '').toLowerCase().startsWith('image/')) {
    return uploadWithLegacyApi(token, file);
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
