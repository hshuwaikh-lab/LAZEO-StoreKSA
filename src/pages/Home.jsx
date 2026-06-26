import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import './Home.css';

const Home = () => {
  const { t, i18n } = useTranslation();
  const { addToCart } = useCart();
  const isAr = i18n.language === 'ar';

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/products');
        if (res.ok) {
          const data = await res.json();
          // Show the latest 4 products on the home page
          setProducts(data.slice(0, 4));
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

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-overlay"></div>
        <div className="container hero-content">
          <img 
            src="/logo.png" 
            alt="LAZEO StoreKSA" 
            className="hero-logo"
          />
          <h1 className="hero-title" style={{display: 'none'}}>{t('hero_title')}</h1>
          <p className="hero-subtitle" style={{marginTop: '20px'}}>{t('hero_subtitle')}</p>
          <div className="hero-actions">
            <Link to="/shop" className="btn-primary">{t('shop_now')}</Link>
            <Link to="/custom-order" className="btn-outline">{t('request_custom')}</Link>
          </div>
        </div>
      </section>
      
      {/* Featured Section */}
      <section className="section container">
         <h2 className="text-center" style={{ marginBottom: '40px', fontSize: '2.5rem', color: 'var(--accent-main)' }}>
           {t('featured_products')}
         </h2>
         
         {loading ? (
           <p className="text-center" style={{ color: '#888' }}>{t('loading') || 'جاري التحميل...'}</p>
         ) : products.length === 0 ? (
           <p className="text-center" style={{ color: '#888' }}>{t('no_products') || 'لا توجد منتجات حالياً.'}</p>
         ) : (
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px', marginTop: '20px' }}>
             {products.map((product) => {
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
                      <img src={product.image} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                   </div>
                   <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                     <h3 style={{ marginBottom: '10px', color: 'var(--text-main)', fontSize: '1.2rem', lineHeight: '1.4' }}>{name}</h3>
                     <p style={{ color: 'var(--accent-main)', fontWeight: 'bold', fontSize: '1.3rem', marginBottom: '15px', marginTop: 'auto' }}>
                       {product.price} {t('currency') || 'SAR'}
                     </p>
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
