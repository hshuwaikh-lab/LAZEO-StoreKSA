import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';
import { Trash2, ShoppingCart } from 'lucide-react';
import ActionBanner from '../components/ActionBanner';
import './Cart.css';

const Cart = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { cartItems, updateQuantity, removeFromCart, currentTotal, shippingMethod, setShippingMethod, shippingCost, finalTotal } = useCart();
  const { user } = useContext(AuthContext);
  const isAr = i18n.language === 'ar';

  const [shippingOptions, setShippingOptions] = useState([]);
  const [loadingShipping, setLoadingShipping] = useState(true);
  const [feedback, setFeedback] = useState(null);

  const fetchShippingOptions = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.SHIPPING));
      if (res.ok) {
        const data = await res.json();
        setShippingOptions(data);
        // Automatically select first option if none selected
        if (data.length > 0 && !shippingMethod) {
          setShippingMethod(data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch shipping options', error);
    } finally {
      setLoadingShipping(false);
    }
  }, [setShippingMethod, shippingMethod]);

  useEffect(() => {
    fetchShippingOptions();
  }, [fetchShippingOptions]);

  const handleCheckout = () => {
    if (!user) {
      setFeedback({
        type: 'info',
        title: 'تسجيل الدخول مطلوب',
        message: t('login_required_checkout') || 'You must log in to proceed to checkout'
      });
      navigate('/login', { state: { from: '/cart' } });
      return;
    }
    navigate('/checkout');
  };

  if (cartItems.length === 0) {
    return (
      <div className="container section">
        <div className="empty-cart glass text-center">
          <ShoppingCart size={64} color="var(--text-light)" />
          <h2>{t('cart_empty') || 'Your Cart is Empty'}</h2>
          <p style={{color: 'var(--text-light)', marginBottom: '20px'}}>
            {t('cart_empty_desc') || 'Looks like you haven\'t added any items to your cart yet.'}
          </p>
          <button className="btn-primary" onClick={() => navigate('/shop')}>
            {t('shop_now') || 'Start Shopping'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container section cart-page">
      <h1 style={{marginBottom: '40px'}}>{t('shopping_cart') || 'Shopping Cart'}</h1>

      <ActionBanner
        type={feedback?.type}
        title={feedback?.title}
        message={feedback?.message}
        onClose={() => setFeedback(null)}
      />

      <div className="cart-grid">
        {/* Items List */}
        <div className="cart-items">
          {cartItems.map((item) => {
            const name = isAr ? item.nameAr : item.nameEn;
            return (
              <div key={item.cartItemId || item.id} className="cart-item glass">
                <div className="cart-item-info">
                  <img src={item.image} alt={name} className="cart-item-img" />
                  <div className="cart-item-details">
                    <Link to={`/product/${item.id}`} style={{textDecoration: 'none'}}>
                      <h3>{name}</h3>
                    </Link>
                    <div className="cart-item-price">{item.price} {t('currency') || 'SAR'}</div>
                    {item.note && (
                      <div style={{ marginTop: '8px', fontSize: '0.9rem', color: 'var(--text-light)' }}>
                        <strong>{t('product_note')}:</strong> {item.note}
                      </div>
                    )}
                  </div>
                </div>

                <div className="quantity-selector" style={{margin: 0}}>
                  <button className="quantity-btn" onClick={() => updateQuantity(item.cartItemId || item.id, item.quantity - 1)}>-</button>
                  <span className="quantity-display">{item.quantity}</span>
                  <button className="quantity-btn" onClick={() => updateQuantity(item.cartItemId || item.id, item.quantity + 1)}>+</button>
                </div>

                <div className="item-total" style={{ fontWeight: 'bold' }}>
                  {(item.price * item.quantity).toFixed(2)} {t('currency') || 'SAR'}
                </div>

                <button 
                  className="remove-btn" 
                  onClick={() => removeFromCart(item.cartItemId || item.id)}
                  title={t('remove_item') || 'Remove Item'}
                >
                  <Trash2 size={20} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Order Summary */}
        <div className="cart-summary glass">
          <h2>{t('order_summary') || 'Order Summary'}</h2>
          
          <div style={{ marginBottom: '20px', textAlign: isAr ? 'right' : 'left' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px' }}>{t('shipping_method') || 'طريقة الشحن / الاستلام'}</h3>
            {loadingShipping ? (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>{t('loading') || 'جاري التحميل...'}</p>
            ) : shippingOptions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {shippingOptions.map(option => (
                  <label key={option.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                    <input 
                      type="radio" 
                      name="shipping" 
                      value={option.id} 
                      checked={shippingMethod?.id === option.id}
                      onChange={() => setShippingMethod(option)}
                    />
                    {option.logoUrl && <img src={option.logoUrl} alt={option.name} style={{ width: '25px', height: '25px', objectFit: 'contain', marginLeft: '5px' }} />}
                    <span>{option.name} ({option.price > 0 ? `${option.price} ${t('currency') || 'ر.س'}` : t('free') || 'مجانًا'})</span>
                  </label>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>{t('no_shipping_methods') || 'لا توجد طرق شحن متاحة'}</p>
            )}
          </div>

          <div className="summary-row">
            <span>{t('subtotal') || 'Subtotal'}</span>
            <span>{currentTotal.toFixed(2)} {t('currency') || 'SAR'}</span>
          </div>
          <div className="summary-row">
            <span>{t('shipping') || 'Shipping'}</span>
            <span>{shippingCost > 0 ? `${shippingCost.toFixed(2)} ${t('currency') || 'SAR'}` : t('free') || 'Free'}</span>
          </div>
          <div className="summary-total">
            <span>{t('total') || 'Total'}</span>
            <span>{finalTotal.toFixed(2)} {t('currency') || 'SAR'}</span>
          </div>
          <button className="btn-primary checkout-btn" onClick={handleCheckout}>
            {t('proceed_to_checkout') || 'Proceed to Checkout'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Cart;
