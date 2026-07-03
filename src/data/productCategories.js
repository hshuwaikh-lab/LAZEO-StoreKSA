export const PRODUCT_CATEGORIES = [
  { key: 'clocks', labelAr: 'الساعات', labelEn: 'Clocks' },
  { key: 'medals', labelAr: 'الميداليات', labelEn: 'Medals' },
  { key: 'mirrors', labelAr: 'المرايا', labelEn: 'Mirrors' },
  { key: 'giveaways', labelAr: 'التوزيعات', labelEn: 'Giveaways' },
  { key: 'certificates', labelAr: 'الشهادات', labelEn: 'Certificates' },
  { key: 'piggy-banks', labelAr: 'حصالات', labelEn: 'Piggy Banks' },
];

export const DEFAULT_PRODUCT_CATEGORY = PRODUCT_CATEGORIES[0].key;

const CATEGORY_ALIAS_MAP = new Map([
  ['الساعات', 'clocks'],
  ['الميداليات', 'medals'],
  ['المرايا', 'mirrors'],
  ['التوزيعات', 'giveaways'],
  ['الشهادات', 'certificates'],
  ['حصالات', 'piggy-banks'],
  ['piggy banks', 'piggy-banks'],
]);

export const normalizeProductCategory = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';

  const direct = PRODUCT_CATEGORIES.find((item) => item.key === normalized);
  if (direct) return direct.key;

  return CATEGORY_ALIAS_MAP.get(normalized) || String(value || '').trim();
};

export const getProductCategoryLabel = (value, isArabic = true) => {
  const normalized = normalizeProductCategory(value);
  const category = PRODUCT_CATEGORIES.find((item) => item.key === normalized);
  if (!category) return String(value || '-');
  return isArabic ? category.labelAr : category.labelEn;
};
