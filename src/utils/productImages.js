const flattenImageCandidates = (value) => {
  if (Array.isArray(value)) {
    return value.flatMap(flattenImageCandidates);
  }

  if (typeof value !== 'string') {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.flatMap(flattenImageCandidates);
    }

    if (typeof parsed === 'string') {
      return [parsed];
    }
  } catch {
    // Fall through to legacy delimiters and raw URL support.
  }

  return trimmed
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

export const parseProductImageUrls = (value) => {
  const uniqueUrls = [];
  const seen = new Set();

  for (const candidate of flattenImageCandidates(value)) {
    if (!candidate || seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    uniqueUrls.push(candidate);
  }

  return uniqueUrls;
};

export const getProductPrimaryImage = (value) => parseProductImageUrls(value)[0] || '';

export const serializeProductImageUrls = (value) => {
  const urls = parseProductImageUrls(value);

  if (!urls.length) {
    return '';
  }

  return urls.length === 1 ? urls[0] : JSON.stringify(urls);
};
