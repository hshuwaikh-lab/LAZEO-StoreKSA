import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';
import { decorateProductPricing, formatOfferEndsAt, getOfferBadgeText, getOfferLabel, isOfferActive } from '../utils/offers';
import { getProductPrimaryImage } from '../utils/productImages';
import ProtectedImage from '../components/ProtectedImage';
import logo from '/logo.png';
import './Home.css';

const homepageWorks = [
  {
    title: 'واجهة متجر متكاملة',
    description: 'ترتيب بصري واضح من الصفحة الرئيسية حتى صفحة المنتج والدفع.',
  },
  {
    title: 'عرض منتجات ذكي',
    description: 'صور متعددة، معاينات، وعروض تساعد العميل على اتخاذ القرار أسرع.',
  },
  {
    title: 'إدارة وتشغيل',
    description: 'تدفق طلبات، شحن، وإدارة منسقة من المكتب واللوحة.',
  },
];

const Home = () => {
  const { t, i18n } = useTranslation();
  const { addToCart } = useCart();
  const isAr = i18n.language === 'ar';

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

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
        console.error('Error fetching featured products:', error);
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

  const activeOffers = products.filter((product) => isOfferActive(product, currentTime));
  const featuredProducts = products.filter((product) => !isOfferActive(product, currentTime)).slice(0, 4);
  const visibleFeaturedProducts = featuredProducts.length ? featuredProducts : products.slice(0, 4);

  const renderPrice = (product) => {
    const pricedProduct = decorateProductPricing(product, { referenceTime: currentTime, quantity: product.offerMinQuantity || 1 });

    if (!pricedProduct.offerActive) {
      return (
        <p style={{ color: 'var(--accent-main)', fontWeight: 'bold', fontSize: '1.3rem', marginBottom: '15px', marginTop: 'auto' }}>
          {pricedProduct.price} {t('currency') || 'SAR'}
        </p>
      );
    }

    return (
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
    );
  };

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-overlay"></div>
        <div className="container hero-content">
          <img 
            src={logo} 
            alt="LAZEO StoreKSA" 
            className="hero-logo"
          />
          <h1 className="hero-title" style={{display: 'none'}}>{t('hero_title')}</h1>
          <p className="hero-subtitle" style={{marginTop: '20px'}}>{t('hero_subtitle')}</p>
          <div className="hero-actions">
            <Link to="/shop" className="btn-primary" style={{ order: 1 }}>{t('shop_now')}</Link>
            <Link to="/custom-order" className="btn-outline" style={{ order: 2 }}>{t('request_custom')}</Link>
            <Link to="/our-works" className="btn-outline" style={{ order: 3 }}>{t('our_works')}</Link>
          </div>
        </div>
      </section>

      <section className="section container works-preview-section">
        <div className="works-preview-header">
          <div>
            <span className="works-preview-kicker">{t('our_works')}</span>
            <h2 className="works-preview-title">نماذج من ما نبنيه للمتاجر والعلامات التجارية</h2>
          </div>
          <Link to="/our-works" className="works-preview-link">عرض الصفحة الكاملة</Link>
        </div>

        <div className="works-preview-grid">
          {homepageWorks.map((work, index) => (
            <article key={work.title} className="works-preview-card glass">
              <div className="works-preview-card__index">0{index + 1}</div>
              <h3>{work.title}</h3>
              <p>{work.description}</p>
            </article>
          ))}
        </div>
      </section>

      {activeOffers.length > 0 && (
        <section className="section container offers-section">
          <div className="offers-header">
            <div>
              <span className="offers-kicker">{isAr ? 'لفترة محدودة' : 'Limited Time'}</span>
              <h2 className="offers-title">{isAr ? 'العروض الحالية' : 'Current Offers'}</h2>
            </div>
            <Link to="/shop" className="offers-link">{isAr ? 'عرض كل المنتجات' : 'Browse all products'}</Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px', marginTop: '20px' }}>
            {activeOffers.map((product) => {
              const name = isAr ? product.nameAr : product.nameEn;

              return (
                <Link
                  to={`/product/${product.id}`}
                  key={`offer-${product.id}`}
                  className="glass"
                  style={{ borderRadius: '12px', overflow: 'hidden', transition: 'transform 0.3s, box-shadow 0.3s', textDecoration: 'none', display: 'flex', flexDirection: 'column', position: 'relative', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                  onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <span className="offer-badge">{getOfferBadgeText(product, isAr)}</span>
                  <div style={{ height: '240px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <ProtectedImage
                      src={getProductPrimaryImage(product.image)}
                      alt={name}
                      imageStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      watermarkText="LAZEO PREVIEW"
                    />
                  </div>
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <h3 style={{ marginBottom: '10px', color: 'var(--text-main)', fontSize: '1.2rem', lineHeight: '1.4' }}>{name}</h3>
                    {renderPrice(product)}
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
        </section>
      )}
      
      {/* Featured Section */}
      <section className="section container">
         <h2 className="text-center" style={{ marginBottom: '40px', fontSize: '2.5rem', color: 'var(--accent-main)' }}>
           {t('featured_products')}
         </h2>
         
         {loading ? (
           <p className="text-center" style={{ color: '#888' }}>{t('loading') || 'جاري التحميل...'}</p>
         ) : visibleFeaturedProducts.length === 0 ? (
           <p className="text-center" style={{ color: '#888' }}>{t('no_products') || 'لا توجد منتجات حالياً.'}</p>
         ) : (
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px', marginTop: '20px' }}>
             {visibleFeaturedProducts.map((product) => {
               const name = isAr ? product.nameAr : product.nameEn;
               return (
                 <Link 
                   to={`/product/${product.id}`}
                   key={product.id} 
                   className="glass" 
                   style={{ borderRadius: '12px', overflow: 'hidden', transition: 'transform 0.3s, box-shadow 0.3s', textDecoration: 'none', display: 'flex', flexDirection: 'column' }}
                   onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'}
                   onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                 >
                   <div style={{ height: '240px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                     <ProtectedImage
                      src={getProductPrimaryImage(product.image)}
                      alt={name}
                      imageStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      watermarkText="LAZEO PREVIEW"
                     />
                   </div>
                   <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                     <h3 style={{ marginBottom: '10px', color: 'var(--text-main)', fontSize: '1.2rem', lineHeight: '1.4' }}>{name}</h3>
                     {renderPrice(product)}
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
      </section>
    </div>
  );
};

export default Home;
