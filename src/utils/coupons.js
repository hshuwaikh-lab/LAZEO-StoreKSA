export const calculateCouponDiscount = ({ subtotal, coupon }) => {
  const normalizedSubtotal = Number(subtotal || 0);
  if (!coupon || normalizedSubtotal <= 0) {
    return 0;
  }

  if (coupon.minOrderAmount && normalizedSubtotal < Number(coupon.minOrderAmount)) {
    return 0;
  }

  const discountValue = Number(coupon.discountValue || 0);
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return 0;
  }

  let discountAmount = coupon.discountType === 'percent'
    ? normalizedSubtotal * (discountValue / 100)
    : discountValue;

  if (coupon.maxDiscount && discountAmount > Number(coupon.maxDiscount)) {
    discountAmount = Number(coupon.maxDiscount);
  }

  if (discountAmount > normalizedSubtotal) {
    discountAmount = normalizedSubtotal;
  }

  return Number(discountAmount.toFixed(2));
};

export const normalizeCouponCode = (value = '') => String(value).trim().toUpperCase();

export const toDateTimeLocalValue = (value) => {
  if (!value) {
    return '';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  const pad = (number) => String(number).padStart(2, '0');
  return `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}T${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}`;
};
