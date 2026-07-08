import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';
import { Trash2, ShoppingCart } from 'lucide-react';
import ActionBanner from '../components/ActionBanner';
import LocationPickerMap from '../components/LocationPickerMap';
import { getOfferLabel } from '../utils/offers';
import { normalizeCouponCode } from '../utils/coupons';
import './Cart.css';

const PICKUP_SHIPPING_METHOD = {
  id: 'pickup',
  type: 'pickup',
  name: 'استلام من المتجر',
  price: 0,
  estimatedDays: 'نفس اليوم'
};

const Cart = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
    currentTotal,
    discountedSubtotal,
    couponDiscount,
    appliedCoupon,
    applyCoupon,
    clearCoupon,
    shippingMethod,
    setShippingMethod,
    shippingCost,
    finalTotal,
  } = useCart();
  const { user } = useContext(AuthContext);
  const isAr = i18n.language === 'ar';

  const [shippingMode, setShippingMode] = useState(shippingMethod?.type || 'pickup');
  const [nationalAddress, setNationalAddress] = useState(shippingMethod?.nationalAddress || user?.address || '');
  const [city, setCity] = useState(shippingMethod?.city || '');
  const [postalCode, setPostalCode] = useState(shippingMethod?.postalCode || '');
  const [savedLocations, setSavedLocations] = useState([]);
  const [selectedSavedLocationId, setSelectedSavedLocationId] = useState('');
  const [customerLocation, setCustomerLocation] = useState(
    shippingMethod?.customerLat != null && shippingMethod?.customerLng != null
      ? { lat: Number(shippingMethod.customerLat), lng: Number(shippingMethod.customerLng) }
      : null
  );
  const [locationSource, setLocationSource] = useState(shippingMethod?.locationSource || 'address');
  const [locatingCustomer, setLocatingCustomer] = useState(false);
  const [estimatingShipping, setEstimatingShipping] = useState(false);
  const [processingCustomOrderId, setProcessingCustomOrderId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [couponInput, setCouponInput] = useState(appliedCoupon?.code || '');
  const [couponLoading, setCouponLoading] = useState(false);
  const shippingCostInteger = Math.round(Number(shippingCost || 0));

  useEffect(() => {
    if (!shippingMethod) {
      if (shippingMode === 'pickup') {
        setShippingMethod(PICKUP_SHIPPING_METHOD);
      }
      return;
    }

    if (shippingMethod.type === 'pickup') {
      setShippingMode('pickup');
      return;
    }

    setShippingMode('delivery');
    if (shippingMethod.nationalAddress) {
      setNationalAddress(shippingMethod.nationalAddress);
    }
    if (shippingMethod.city) {
      setCity(shippingMethod.city);
    }
    if (shippingMethod.postalCode) {
      setPostalCode(shippingMethod.postalCode);
    }
    if (shippingMethod.customerLat != null && shippingMethod.customerLng != null) {
      setCustomerLocation({ lat: Number(shippingMethod.customerLat), lng: Number(shippingMethod.customerLng) });
    }
    if (shippingMethod.locationSource) {
      setLocationSource(shippingMethod.locationSource);
    }
  }, [setShippingMethod, shippingMethod, shippingMode]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!user || !token) {
      setSavedLocations([]);
      return;
    }

    const loadSavedLocations = async () => {
      try {
        const response = await fetch(buildApiUrl(API_ENDPOINTS.USER_LOCATIONS), {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
          return;
        }

        const result = await response.json().catch(() => []);
        setSavedLocations(Array.isArray(result) ? result : []);
      } catch {
        // Ignore saved-location loading failures in cart flow.
      }
    };

    loadSavedLocations();
  }, [user]);

  useEffect(() => {
    if (!savedLocations.length || nationalAddress.trim() || customerLocation) {
      return;
    }

    const defaultLocation = savedLocations.find((location) => location.isDefault) || savedLocations[0];
    if (defaultLocation) {
      applySavedLocation(defaultLocation);
    }
  }, [savedLocations]);

  const handleShippingModeChange = (mode) => {
    setShippingMode(mode);

    if (mode === 'pickup') {
      setShippingMethod(PICKUP_SHIPPING_METHOD);
      return;
    }

    setShippingMethod(null);
  };

  const handleCustomerLocationChange = (nextLocation, source = 'map') => {
    setCustomerLocation(nextLocation);
    setLocationSource(source);
  };

  const applySavedLocation = (location) => {
    if (!location) {
      return;
    }

    setSelectedSavedLocationId(String(location.id));
    setNationalAddress(location.nationalAddress || '');
    setCity(location.city || '');
    setPostalCode(location.postalCode || '');

    if (location.lat != null && location.lng != null) {
      handleCustomerLocationChange({ lat: Number(location.lat), lng: Number(location.lng) }, 'saved-location');
    } else {
      setCustomerLocation(null);
      setLocationSource('address');
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setFeedback({ type: 'error', title: 'الموقع غير متاح', message: 'المتصفح الحالي لا يدعم تحديد الموقع الجغرافي.' });
      return;
    }

    setLocatingCustomer(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        handleCustomerLocationChange(nextLocation, 'gps');
        setFeedback({ type: 'success', title: 'تم تحديد الموقع', message: 'يمكنك الآن مراجعة الدبوس على الخريطة أو حساب قيمة الشحن مباشرة.' });
        setLocatingCustomer(false);
      },
      () => {
        setFeedback({ type: 'error', title: 'تعذر تحديد الموقع', message: 'امنح صلاحية الموقع أو حدد موقع العميل يدويًا من الخريطة.' });
        setLocatingCustomer(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleEstimateShipping = async () => {
    if (!nationalAddress.trim() && !customerLocation) {
      setFeedback({ type: 'error', title: 'بيانات الموقع مطلوبة', message: 'أدخل العنوان الوطني أو استخدم الخريطة لتحديد موقع العميل.' });
      return;
    }

    setEstimatingShipping(true);
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.SHIPPING_ESTIMATE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nationalAddress: nationalAddress.trim(),
          city: city.trim(),
          postalCode: postalCode.trim(),
          customerLat: customerLocation?.lat ?? null,
          customerLng: customerLocation?.lng ?? null,
          locationSource
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setShippingMethod(null);
        setFeedback({ type: 'error', title: 'تعذر حساب الشحن', message: result.error || 'تحقق من بيانات العنوان الوطني.' });
        return;
      }

      const estimatedMethod = {
        id: 'delivery-estimate',
        type: 'delivery',
        name: result.isCarrierFixedPrice ? `شحن عبر ${result.shippingProviderLabel || 'شركة الشحن'}` : 'شحن للعنوان الوطني',
        price: Number(result.shippingCost || 0),
        estimatedDays: result.estimatedDays || '2-4 أيام',
        distanceKm: result.distanceKm == null ? null : Number(result.distanceKm),
        nationalAddress: nationalAddress.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        customerLat: customerLocation?.lat ?? null,
        customerLng: customerLocation?.lng ?? null,
        locationSource,
        shippingProvider: result.shippingProvider || 'national-address',
        shippingProviderLabel: result.shippingProviderLabel || '',
        isCarrierFixedPrice: Boolean(result.isCarrierFixedPrice),
        estimatedShippingCost: Number(result.estimatedShippingCost || result.shippingCost || 0),
        estimationMode: result.estimationMode || 'normal',
        isEstimated: true
      };

      setShippingMethod(estimatedMethod);
      setFeedback({
        type: estimatedMethod.estimationMode === 'fallback-no-city' ? 'info' : 'success',
        title: estimatedMethod.estimationMode === 'fallback-no-city' ? 'تم اعتماد الشحن الثابت' : 'تم تقدير الشحن',
        message: estimatedMethod.estimationMode === 'fallback-no-city'
          ? (result.warning || `تم اعتماد ${estimatedMethod.shippingProviderLabel} بالسعر الثابت ${Math.round(estimatedMethod.price)} ر.س.`)
          : (estimatedMethod.isCarrierFixedPrice
            ? `المسافة التقديرية ${estimatedMethod.distanceKm.toFixed(2)} كم. تم التحويل تلقائيًا إلى ${estimatedMethod.shippingProviderLabel} بسعر ثابت ${Math.round(estimatedMethod.price)} ر.س.`
            : `المسافة التقديرية ${estimatedMethod.distanceKm.toFixed(2)} كم، وقيمة الشحن ${Math.round(estimatedMethod.price)} ر.س.`)
      });
    } catch {
      setFeedback({ type: 'error', title: 'خطأ في الاتصال', message: 'تعذر حساب الشحن حالياً. أعد المحاولة.' });
    } finally {
      setEstimatingShipping(false);
    }
  };

  useEffect(() => {
    if (!appliedCoupon) {
      return;
    }

    if (currentTotal <= 0) {
      clearCoupon();
      return;
    }

    const validateAppliedCoupon = async () => {
      try {
        const response = await fetch(buildApiUrl(API_ENDPOINTS.COUPON_VALIDATE), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: appliedCoupon.code, subtotal: currentTotal })
        });

        if (!response.ok) {
          clearCoupon();
          return;
        }

        await response.json();
      } catch {
        // Keep the previous coupon state on transient network errors.
      }
    };

    validateAppliedCoupon();
  }, [appliedCoupon, clearCoupon, currentTotal]);

  const handleApplyCoupon = async () => {
    const normalizedCode = normalizeCouponCode(couponInput);
    if (!normalizedCode) {
      setFeedback({ type: 'error', title: 'كوبون غير صالح', message: 'أدخل كود الخصم أولاً.' });
      return;
    }

    setCouponLoading(true);
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.COUPON_VALIDATE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalizedCode, subtotal: currentTotal })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.valid) {
        setFeedback({ type: 'error', title: 'تعذر تفعيل الكوبون', message: result.error || 'الكوبون غير صالح.' });
        return;
      }

      applyCoupon(result.coupon);
      setCouponInput(result.coupon.code);
      setFeedback({ type: 'success', title: 'تم تفعيل الكوبون', message: `تم خصم ${Number(result.discountAmount || 0).toFixed(2)} ر.س من السلة.` });
    } catch {
      setFeedback({ type: 'error', title: 'خطأ في الاتصال', message: 'تعذر التحقق من الكوبون حالياً.' });
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    clearCoupon();
    setCouponInput('');
    setFeedback({ type: 'info', title: 'تم إزالة الكوبون', message: 'تم إلغاء الخصم من السلة.' });
  };

  const handleRemoveItem = async (item) => {
    const cartItemId = item.cartItemId || item.id;

    if (!item?.isCustomOrder || !item?.customOrderId) {
      removeFromCart(cartItemId);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setFeedback({ type: 'error', title: 'تسجيل الدخول مطلوب', message: 'سجل الدخول أولاً لإلغاء الطلب المخصص.' });
      return;
    }

    setProcessingCustomOrderId(item.customOrderId);
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.USER_CUSTOM_ORDER_CANCEL(item.customOrderId)), {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'تعذر إلغاء الطلب المخصص');
      }

      removeFromCart(cartItemId);
      setFeedback({ type: 'success', title: 'تم الإلغاء', message: 'تم إلغاء الطلب المخصص عند إزالته من السلة.' });
    } catch (error) {
      setFeedback({ type: 'error', title: 'تعذر الإلغاء', message: error.message || 'تعذر إلغاء الطلب المخصص حالياً.' });
    } finally {
      setProcessingCustomOrderId(null);
    }
  };

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

    if (shippingMode === 'delivery' && (!shippingMethod || shippingMethod.type !== 'delivery' || !shippingMethod.isEstimated)) {
      setFeedback({
        type: 'error',
        title: 'حساب الشحن مطلوب',
        message: 'الرجاء إدخال العنوان الوطني وحساب قيمة الشحن قبل إتمام الطلب.'
      });
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
                    {item.offerActive ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div className="cart-item-price">{item.price} {t('currency') || 'SAR'}</div>
                        {item.offerApplied ? (
                          <div style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 700 }}>
                            {isAr ? 'تم تطبيق سعر العرض' : 'Offer price applied'}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.85rem', color: '#b45309', fontWeight: 700 }}>
                            {getOfferLabel(item, isAr)}
                          </div>
                        )}
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', textDecoration: 'line-through' }}>
                          {item.originalPrice} {t('currency') || 'SAR'}
                        </div>
                      </div>
                    ) : (
                      <div className="cart-item-price">{item.price} {t('currency') || 'SAR'}</div>
                    )}
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
                  onClick={() => handleRemoveItem(item)}
                  disabled={processingCustomOrderId === item.customOrderId}
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
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px' }}>{t('shipping')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input
                  type="radio"
                  name="shippingMode"
                  value="pickup"
                  checked={shippingMode === 'pickup'}
                  onChange={() => handleShippingModeChange('pickup')}
                />
                <span>استلام من المتجر (مجانًا)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input
                  type="radio"
                  name="shippingMode"
                  value="delivery"
                  checked={shippingMode === 'delivery'}
                  onChange={() => handleShippingModeChange('delivery')}
                />
                <span>شحن (حسب العنوان الوطني)</span>
              </label>

              {shippingMode === 'delivery' && (
                <div style={{ marginTop: '8px', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px', background: 'rgba(15,23,42,0.03)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {savedLocations.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label htmlFor="savedLocationSelect" style={{ fontSize: '0.95rem', color: '#1f2937', fontWeight: 700 }}>
                        اختر من المواقع المحفوظة
                      </label>
                      <select
                        id="savedLocationSelect"
                        value={selectedSavedLocationId}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setSelectedSavedLocationId(nextValue);
                          const picked = savedLocations.find((location) => String(location.id) === nextValue);
                          if (picked) {
                            applySavedLocation(picked);
                          }
                        }}
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                      >
                        <option value="">اختر موقعًا محفوظًا</option>
                        {savedLocations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.label}{location.isDefault ? ' - افتراضي' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="cartNationalAddress" style={{ fontSize: '0.95rem', color: '#1f2937', fontWeight: 700 }}>
                      العنوان الوطني
                    </label>
                    <textarea
                      id="cartNationalAddress"
                      value={nationalAddress}
                      onChange={(e) => setNationalAddress(e.target.value)}
                      placeholder="اكتب العنوان الوطني بالكامل"
                      rows={3}
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                    />
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
                      يمكنك الحساب بالعناوين، أو تحديد موقع العميل مباشرة عبر GPS والخريطة لنتيجة أدق.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '150px' }}>
                      <label htmlFor="cartCity" style={{ fontSize: '0.95rem', color: '#1f2937', fontWeight: 700 }}>
                        المدينة
                      </label>
                      <input
                        id="cartCity"
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="المدينة (اختياري)"
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '150px' }}>
                      <label htmlFor="cartPostalCode" style={{ fontSize: '0.95rem', color: '#1f2937', fontWeight: 700 }}>
                        الرمز البريدي
                      </label>
                      <input
                        id="cartPostalCode"
                        type="text"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="الرمز البريدي (اختياري)"
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button type="button" className="btn-secondary" onClick={handleUseCurrentLocation} disabled={locatingCustomer}>
                      {locatingCustomer ? 'جاري تحديد الموقع...' : 'استخدم موقعي الحالي'}
                    </button>
                    {customerLocation ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setCustomerLocation(null);
                          setLocationSource('address');
                        }}
                      >
                        إزالة الموقع المحدد
                      </button>
                    ) : null}
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
                      {customerLocation
                        ? `الموقع الحالي: ${customerLocation.lat.toFixed(5)}, ${customerLocation.lng.toFixed(5)}`
                        : 'يمكنك الضغط على الخريطة لإضافة دبوس وتعديل مكان العميل يدويًا.'}
                    </span>
                  </div>
                  <LocationPickerMap
                    selectedPosition={customerLocation}
                    onPositionChange={(nextLocation) => handleCustomerLocationChange(nextLocation, 'map')}
                  />
                  <button type="button" className="btn-secondary" onClick={handleEstimateShipping} disabled={estimatingShipping}>
                    {estimatingShipping ? 'جاري الحساب...' : 'حساب قيمة الشحن'}
                  </button>

                  {shippingMethod?.type === 'delivery' && shippingMethod.isEstimated && (
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>
                      <div>
                        طريقة التحديد: {shippingMethod.estimationMode === 'real-geocoded' ? 'موقع دقيق عبر GPS/الخريطة' : 'تقدير عبر العنوان والمدينة'}
                      </div>
                      {typeof shippingMethod.distanceKm === 'number' && shippingMethod.distanceKm > 0 && (
                        <div>المسافة التقديرية: {shippingMethod.distanceKm.toFixed(2)} كم</div>
                      )}
                      <div>مدة التوصيل المتوقعة: {shippingMethod.estimatedDays}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '20px', textAlign: isAr ? 'right' : 'left' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px' }}>كوبون الخصم</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="مثال: SAVE10"
                style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', flex: 1, minWidth: '180px' }}
              />
              <button type="button" className="btn-secondary" onClick={handleApplyCoupon} disabled={couponLoading}>
                {couponLoading ? 'جاري التحقق...' : 'تفعيل'}
              </button>
              {appliedCoupon && (
                <button type="button" className="btn-secondary" onClick={handleRemoveCoupon}>
                  إزالة
                </button>
              )}
            </div>
            {appliedCoupon && (
              <p style={{ marginTop: '8px', fontSize: '0.9rem', color: '#166534', fontWeight: 700 }}>
                الكوبون النشط: {appliedCoupon.code}
              </p>
            )}
          </div>

          <div className="summary-row">
            <span>{t('subtotal') || 'Subtotal'}</span>
            <span>{currentTotal.toFixed(2)} {t('currency') || 'SAR'}</span>
          </div>
          {couponDiscount > 0 && (
            <div className="summary-row" style={{ color: '#166534', fontWeight: 700 }}>
              <span>خصم الكوبون {appliedCoupon ? `(${appliedCoupon.code})` : ''}</span>
              <span>-{couponDiscount.toFixed(2)} {t('currency') || 'SAR'}</span>
            </div>
          )}
          {couponDiscount > 0 && (
            <div className="summary-row">
              <span>بعد الخصم</span>
              <span>{discountedSubtotal.toFixed(2)} {t('currency') || 'SAR'}</span>
            </div>
          )}
          <div className="summary-row">
            <span>{t('shipping') || 'Shipping'}</span>
            <span>{shippingCostInteger > 0 ? `${shippingCostInteger} ${t('currency') || 'SAR'}` : t('free') || 'Free'}</span>
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
