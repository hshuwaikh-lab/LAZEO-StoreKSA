import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';
import { decorateProductPricing, formatOfferEndsAt, getOfferBadgeText, getOfferLabel } from '../utils/offers';
import { getProductPrimaryImage } from '../utils/productImages';
import { PRODUCT_CATEGORIES, getProductCategoryLabel, normalizeProductCategory } from '../data/productCategories';

const Shop = () => {
  const { t, i18n } = useTranslation();
  const { addToCart } = useCart();
  const isAr = i18n.language === 'ar';

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.PRODUCTS));
        if (res.ok) {
          const data = await res.json();
          setProducts(data);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleAddToCart = (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, 1);
  };

  const categoryOrderMap = useMemo(() => {
    return new Map(PRODUCT_CATEGORIES.map((category, index) => [category.key, index]));
  }, []);

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(PRODUCT_CATEGORIES.map((category) => [category.key, 0]));
    products.forEach((product) => {
      const normalizedCategory = normalizeProductCategory(product.category);
      if (counts[normalizedCategory] !== undefined) {
        counts[normalizedCategory] += 1;
      }
    });
    return counts;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const source = selectedCategory === 'all'
      ? products
      : products.filter((product) => normalizeProductCategory(product.category) === selectedCategory);

    return [...source].sort((a, b) => {
      const categoryA = normalizeProductCategory(a.category);
      const categoryB = normalizeProductCategory(b.category);
      const orderA = categoryOrderMap.has(categoryA) ? categoryOrderMap.get(categoryA) : Number.MAX_SAFE_INTEGER;
      const orderB = categoryOrderMap.has(categoryB) ? categoryOrderMap.get(categoryB) : Number.MAX_SAFE_INTEGER;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return String(isAr ? a.nameAr : a.nameEn).localeCompare(String(isAr ? b.nameAr : b.nameEn), isAr ? 'ar' : 'en');
    });
  }, [products, selectedCategory, categoryOrderMap, isAr]);

  return (
    <div className="container section" style={{ paddingBottom: '80px' }}>
      <h1 className="text-center" style={{marginBottom: '40px', fontSize: '2.5rem', color: 'var(--accent-main)'}}>{t('shop')}</h1>
      
      {loading ? (
        <p className="text-center">جاري التحميل...</p>
      ) : products.length === 0 ? (
        <p className="text-center">لا توجد منتجات حالياً.</p>
      ) : (
      <>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '22px', justifyContent: 'center' }}>
        <button
          type="button"
          className={selectedCategory === 'all' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setSelectedCategory('all')}
        >
          {isAr ? 'الكل' : 'All'} ({products.length})
        </button>
        {PRODUCT_CATEGORIES.map((category) => (
          <button
            key={category.key}
            type="button"
            className={selectedCategory === category.key ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setSelectedCategory(category.key)}
          >
            {isAr ? category.labelAr : category.labelEn} ({categoryCounts[category.key] || 0})
          </button>
        ))}
      </div>

      {filteredProducts.length === 0 ? (
        <p className="text-center">لا توجد منتجات في هذا القسم حالياً.</p>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' }}>
        {filteredProducts.map((product) => {
          const name = isAr ? product.nameAr : product.nameEn;
          const pricedProduct = decorateProductPricing(product, { referenceTime: currentTime, quantity: product.offerMinQuantity || 1 });

          return (
            <Link 
              to={`/product/${product.id}`}
              key={product.id} 
              className="glass" 
              style={{ borderRadius: '12px', overflow: 'hidden', transition: 'transform 0.3s, box-shadow 0.3s', textDecoration: 'none', display: 'flex', flexDirection: 'column', position: 'relative', border: pricedProduct.offerActive ? '1px solid rgba(245, 158, 11, 0.3)' : 'none' }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {pricedProduct.offerActive && <span className="offer-badge">{getOfferBadgeText(product, isAr)}</span>}
              <div style={{ height: '240px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                 <img src={getProductPrimaryImage(product.image)} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <h3 style={{ marginBottom: '10px', color: 'var(--text-main)', fontSize: '1.2rem', lineHeight: '1.4' }}>{name}</h3>
                <span style={{ marginBottom: '8px', color: '#475569', fontSize: '0.85rem', fontWeight: 700 }}>
                  {getProductCategoryLabel(product.category, isAr)}
                </span>
                {pricedProduct.offerActive ? (
                  <div style={{ marginTop: 'auto', marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '1.35rem' }}>
                        {pricedProduct.price} {t('currency') || 'SAR'}
                      </span>
                      <span style={{ color: '#94a3b8', textDecoration: 'line-through', fontSize: '1rem' }}>
                        {pricedProduct.originalPrice} {t('currency') || 'SAR'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.85rem', color: '#b45309', fontWeight: 700 }}>
                      {getOfferLabel(product, isAr)}
                    </span>
                    {product.offerEndsAt && (
                      <span style={{ fontSize: '0.82rem', color: '#92400e', fontWeight: 700 }}>
                        {isAr ? `ينتهي العرض: ${formatOfferEndsAt(product.offerEndsAt, 'ar-SA')}` : `Offer ends: ${formatOfferEndsAt(product.offerEndsAt, 'en-GB')}`}
                      </span>
                    )}
                  </div>
                ) : (
                  <p style={{ color: 'var(--accent-main)', fontWeight: 'bold', fontSize: '1.3rem', marginBottom: '15px', marginTop: 'auto' }}>
                    {pricedProduct.price} {t('currency') || 'SAR'}
                  </p>
                )}
                <button 
                  className="btn-primary" 
                  style={{ width: '100%' }}
                  onClick={(e) => handleAddToCart(e, product)}
                >
                  {t('add_to_cart') || 'Add to Cart'}
                </button>
              </div>
            </Link>
          );
        })}
      </div>
      )}
      </>
      )}
    </div>
  );
};

export default Shop;
