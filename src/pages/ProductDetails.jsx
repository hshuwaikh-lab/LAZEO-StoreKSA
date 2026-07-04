import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';
import { decorateProductPricing, formatOfferEndsAt, getOfferBadgeText, getOfferLabel } from '../utils/offers';
import { getProductPrimaryImage, parseProductImageUrls } from '../utils/productImages';
import './ProductDetails.css';

const ProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { addToCart } = useCart();
  
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [added, setAdded] = useState(false);
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.PRODUCT_DETAIL(id)));
        if (res.ok) {
          const data = await res.json();
          setProduct(data);
        }
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [product?.id]);

  if (loading) {
    return <div className="container section text-center">جاري التحميل...</div>;
  }

  if (!product) {
    return (
      <div className="container section text-center">
        <h2>{t('product_not_found') || 'Product not found'}</h2>
        <button className="btn-primary" onClick={() => navigate('/shop')} style={{marginTop: '20px'}}>
          {t('back_to_shop') || 'Back to Shop'}
        </button>
      </div>
    );
  }

  const isAr = i18n.language === 'ar';
  const name = isAr ? product.nameAr : product.nameEn;
  const description = isAr ? product.descriptionAr : product.descriptionEn;
  const pricedProduct = decorateProductPricing(product, { referenceTime: currentTime, quantity });
  const productImages = parseProductImageUrls(product.image);
  const activeImage = productImages[selectedImageIndex] || getProductPrimaryImage(product.image);

  const increaseQty = () => setQuantity(q => q + 1);
  const decreaseQty = () => setQuantity(q => (q > 1 ? q - 1 : 1));

  const handleAddToCart = () => {
    addToCart(product, quantity, note);
    setAdded(true);
    setNote('');
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="container section product-details-page">
      <button 
        onClick={() => navigate('/shop')} 
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '30px', color: 'var(--text-light)' }}
      >
        {isAr ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
        {t('back_to_shop') || 'Back to Shop'}
      </button>

      <div className="product-details-grid">
        {/* Gallery */}
        <div className="product-gallery" style={{ position: 'relative' }}>
          {pricedProduct.offerActive && <span className="offer-badge product-offer-badge">{getOfferBadgeText(product, isAr)}</span>}
          {activeImage ? (
            <>
              <img src={activeImage} alt={name} className="product-image" />
              {productImages.length > 1 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))', gap: '8px', marginTop: '12px' }}>
                  {productImages.map((imageUrl, index) => (
                    <button
                      key={`${imageUrl}-${index}`}
                      type="button"
                      onClick={() => setSelectedImageIndex(index)}
                      style={{ border: index === selectedImageIndex ? '2px solid #0f766e' : '1px solid #cbd5e1', borderRadius: '10px', padding: '0', overflow: 'hidden', background: '#fff', cursor: 'pointer' }}
                    >
                      <img src={imageUrl} alt={`${name} ${index + 1}`} style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }} />
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {/* Info */}
        <div className="product-info glass" style={{borderRadius: '12px'}}>
          <h1 className="product-title">{name}</h1>
          {pricedProduct.offerActive ? (
            <div className="product-price-block">
              <div className="product-price product-price-offer">{pricedProduct.price} {t('currency') || 'SAR'}</div>
              <div className="product-price-original">{pricedProduct.originalPrice} {t('currency') || 'SAR'}</div>
              <div className="product-offer-meta">{pricedProduct.offerApplied ? (isAr ? 'تم تطبيق العرض على الكمية الحالية' : 'Offer applied to current quantity') : getOfferLabel(product, isAr)}</div>
              {product.offerEndsAt && <div className="product-offer-meta">{isAr ? `العرض ينتهي في ${formatOfferEndsAt(product.offerEndsAt, 'ar-SA')}` : `Offer ends on ${formatOfferEndsAt(product.offerEndsAt, 'en-GB')}`}</div>}
            </div>
          ) : (
            <div className="product-price">{pricedProduct.price} {t('currency') || 'SAR'}</div>
          )}
          
          <div className="product-desc">
            <p>{description}</p>
          </div>

          <div className="quantity-selector">
            <span style={{ fontWeight: 'bold' }}>{t('quantity') || 'Quantity'}:</span>
            <button className="quantity-btn" onClick={decreaseQty}>-</button>
            <span className="quantity-display">{quantity}</span>
            <button className="quantity-btn" onClick={increaseQty}>+</button>
          </div>

          <div className="product-note" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-main)' }}>
              {t('product_note')}
            </label>
            <textarea 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('add_note_optional')}
              rows="3"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-main)', resize: 'vertical' }}
            />
          </div>

          <button 
            className={`btn-primary add-btn ${added ? 'added' : ''}`} 
            onClick={handleAddToCart}
            style={{ backgroundColor: added ? '#2e7d32' : '' }}
          >
            {added ? (t('added_to_cart') || 'Added to Cart!') : (t('add_to_cart') || 'Add to Cart')}
          </button>
          
          {added && (
            <button 
              className="btn-outline" 
              onClick={() => navigate('/cart')} 
              style={{ width: '100%', marginTop: '10px' }}
            >
              {t('view_cart') || 'View Cart'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;
