const toTimestamp = (value) => {
  if (!value) {
    return null;
  }

  const parsedValue = new Date(value).getTime();
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

export const getOfferMinQuantity = (product) => {
  const parsedValue = Number.parseInt(product?.offerMinQuantity, 10);
  return Number.isInteger(parsedValue) && parsedValue > 1 ? parsedValue : 1;
};

export const hasOfferWindowOpen = (product, referenceTime = Date.now()) => {
  const offerEndsAt = toTimestamp(product?.offerEndsAt);
  if (!Number.isFinite(offerEndsAt)) {
    return true;
  }

  return offerEndsAt > referenceTime;
};

export const hasOfferConfigured = (product, referenceTime = Date.now()) => {
  const offerPrice = Number(product?.offerPrice);
  return Number.isFinite(offerPrice) && offerPrice > 0 && hasOfferWindowOpen(product, referenceTime);
};

export const isOfferActive = (product, referenceTime = Date.now()) => {
  return hasOfferConfigured(product, referenceTime);
};

export const isOfferApplied = (product, quantity = 1, referenceTime = Date.now()) => {
  if (!hasOfferConfigured(product, referenceTime)) {
    return false;
  }

  return Number(quantity || 0) >= getOfferMinQuantity(product);
};

export const getProductDisplayPrice = (product, quantity = 1, referenceTime = Date.now()) => {
  if (isOfferApplied(product, quantity, referenceTime)) {
    return Number(product.offerPrice);
  }

  return Number((product?.originalPrice ?? product?.price) || 0);
};

export const decorateProductPricing = (product, options = {}) => {
  const referenceTime = typeof options === 'number' ? options : (options.referenceTime ?? Date.now());
  const quantity = typeof options === 'number' ? 1 : (options.quantity ?? 1);
  const originalPrice = Number((product?.originalPrice ?? product?.price) || 0);
  const offerActive = hasOfferConfigured(product, referenceTime);
  const offerApplied = isOfferApplied({ ...product, price: originalPrice }, quantity, referenceTime);
  const offerMinQuantity = getOfferMinQuantity(product);

  return {
    ...product,
    originalPrice,
    offerActive,
    offerApplied,
    offerMinQuantity,
    price: offerApplied ? Number(product.offerPrice) : originalPrice,
  };
};

export const toDateTimeLocalValue = (value) => {
  const timestamp = toTimestamp(value);
  if (!Number.isFinite(timestamp)) {
    return '';
  }

  const date = new Date(timestamp);
  const pad = (part) => String(part).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const formatOfferEndsAt = (value, locale = 'ar-SA') => {
  const timestamp = toTimestamp(value);
  if (!Number.isFinite(timestamp)) {
    return '';
  }

  return new Date(timestamp).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getOfferLabel = (product, isArabic = true) => {
  const minQuantity = getOfferMinQuantity(product);
  if (minQuantity > 1) {
    return isArabic ? `سعر العرض يبدأ من ${minQuantity} قطع` : `Offer starts from ${minQuantity} items`;
  }

  return isArabic ? 'عرض خاص' : 'Special offer';
};

export const getOfferBadgeText = (product, isArabic = true) => {
  const minQuantity = getOfferMinQuantity(product);
  if (minQuantity > 1) {
    return isArabic ? `عرض ${minQuantity}+` : `Offer ${minQuantity}+`;
  }

  return isArabic ? 'عرض' : 'Offer';
};