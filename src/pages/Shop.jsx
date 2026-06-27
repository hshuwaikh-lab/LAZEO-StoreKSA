import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

const Shop = () => {
  const { t, i18n } = useTranslation();
  const { addToCart } = useCart();
  const isAr = i18n.language === 'ar';

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="container section" style={{ paddingBottom: '80px' }}>
      <h1 className="text-center" style={{marginBottom: '40px', fontSize: '2.5rem', color: 'var(--accent-main)'}}>{t('shop')}</h1>
      
      {loading ? (
        <p className="text-center">جاري التحميل...</p>
      ) : products.length === 0 ? (
        <p className="text-center">لا توجد منتجات حالياً.</p>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' }}>
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
    </div>
  );
};

export default Shop;
