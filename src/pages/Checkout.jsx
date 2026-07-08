import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';
import { Copy } from 'lucide-react';
import { uploadFileDirect } from '../utils/directUpload';
import ActionBanner from '../components/ActionBanner';
import { decorateProductPricing } from '../utils/offers';
import LocationPickerMap from '../components/LocationPickerMap';

const PICKUP_SHIPPING_METHOD = {
  id: 'pickup',
  type: 'pickup',
  name: 'استلام من المتجر',
  price: 0,
  estimatedDays: 'نفس اليوم',
  isEstimated: true,
  shippingProvider: 'pickup'
};

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    cartItems,
    currentTotal,
    discountedSubtotal,
    couponDiscount,
    appliedCoupon,
    clearCoupon,
    finalTotal,
    shippingMethod,
    shippingCost,
    clearCart,
  } = useCart();
  const { user } = useContext(AuthContext);

  const customOrder = location.state?.customOrder || null;
  const isCustomOrderPayment = Boolean(customOrder);

  const [banks, setBanks] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);
  const [selectedCustomShipping, setSelectedCustomShipping] = useState(PICKUP_SHIPPING_METHOD);
  const [shippingMode, setShippingMode] = useState('pickup');
  const [nationalAddress, setNationalAddress] = useState(user?.address || '');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [savedLocations, setSavedLocations] = useState([]);
  const [selectedSavedLocationId, setSelectedSavedLocationId] = useState('');
  const [customerLocation, setCustomerLocation] = useState(null);
  const [locationSource, setLocationSource] = useState('address');
  const [locatingCustomer, setLocatingCustomer] = useState(false);
  const [estimatingShipping, setEstimatingShipping] = useState(false);
  const [inputType, setInputType] = useState('image');
  const [file, setFile] = useState(null);
  const [receiptText, setReceiptText] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [receiverDetails, setReceiverDetails] = useState({
    receiverName: '',
    receiverPhone: '',
    receiverCity: '',
    receiverDistrict: '',
    receiverStreet: '',
    receiverNearbyLandmark: ''
  });

  const normalizedShippingProvider = String(shippingMethod?.shippingProvider || '').toLowerCase();
  const normalizedCustomShippingProvider = String(selectedCustomShipping?.shippingProvider || '').toLowerCase();
  const requiresCarrierReceiverDetails = !isCustomOrderPayment && shippingMethod?.type === 'delivery' && (normalizedShippingProvider === 'aramex' || normalizedShippingProvider === 'smsa');
  const requiresCustomOrderShippingDetails = isCustomOrderPayment && shippingMode === 'delivery' && (normalizedCustomShippingProvider.includes('aramex') || normalizedCustomShippingProvider.includes('smsa'));
  const requiresReceiverDetails = requiresCarrierReceiverDetails || requiresCustomOrderShippingDetails;
  const shippingProviderLabel = normalizedShippingProvider === 'smsa' ? 'سمسا' : 'أرامكس';
  const shippingCostInteger = Math.round(Number(shippingCost || 0));
  const customShippingCost = Number(selectedCustomShipping?.price || 0);

  useEffect(() => {
    if (!isCustomOrderPayment && cartItems.length === 0) {
      navigate('/cart');
      return;
    }
    fetchBanks();
  }, [cartItems, navigate, isCustomOrderPayment]);

  useEffect(() => {
    if (!isCustomOrderPayment) {
      return;
    }

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
        setSavedLocations([]);
      }
    };

    loadSavedLocations();
  }, [isCustomOrderPayment, user]);

  useEffect(() => {
    if (!isCustomOrderPayment || !savedLocations.length || nationalAddress.trim() || customerLocation) {
      return;
    }

    const defaultLocation = savedLocations.find((location) => location.isDefault) || savedLocations[0];
    if (defaultLocation) {
      applySavedLocation(defaultLocation);
    }
  }, [customerLocation, isCustomOrderPayment, nationalAddress, savedLocations]);

  const orderSummaryAmount = useMemo(() => {
    if (isCustomOrderPayment) {
      return Number(customOrder?.priceQuote || 0) + customShippingCost;
    }
    return finalTotal || currentTotal;
  }, [currentTotal, customOrder, customShippingCost, finalTotal, isCustomOrderPayment]);

  const fetchBanks = async () => {
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.BANKS));
      if (res.ok) {
        const data = await res.json();
        setBanks(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleShippingModeChange = (mode) => {
    setShippingMode(mode);
    if (mode === 'pickup') {
      setSelectedCustomShipping(PICKUP_SHIPPING_METHOD);
      return;
    }
    setSelectedCustomShipping(null);
  };

  const handleCustomerLocationChange = (nextLocation, source = 'map') => {
    setCustomerLocation(nextLocation);
    setLocationSource(source);
  };

  const applySavedLocation = (location) => {
    if (!location) return;

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
        setSelectedCustomShipping(null);
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

      setSelectedCustomShipping(estimatedMethod);
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

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!selectedBank) {
      setFeedback({ type: 'error', title: 'اختيار البنك مطلوب', message: 'الرجاء اختيار بنك للتحويل أولًا.' });
      return;
    }

    if (isCustomOrderPayment && shippingMode === 'delivery' && (!selectedCustomShipping || selectedCustomShipping.type !== 'delivery' || !selectedCustomShipping.isEstimated)) {
      setFeedback({ type: 'error', title: 'حساب الشحن مطلوب', message: 'الرجاء إدخال العنوان الوطني وحساب قيمة الشحن قبل إرسال الطلب المخصص.' });
      return;
    }

    if (requiresReceiverDetails) {
      if (!receiverDetails.receiverName.trim() || !receiverDetails.receiverPhone.trim() || !receiverDetails.receiverCity.trim() || !receiverDetails.receiverDistrict.trim() || !receiverDetails.receiverStreet.trim() || !receiverDetails.receiverNearbyLandmark.trim()) {
        setFeedback({ type: 'error', title: 'بيانات الشحن مطلوبة', message: 'أكمل اسم المستلم والجوال والمدينة والحي والشارع والمعلم القريب قبل إرسال الطلب.' });
        return;
      }
    }
    
    let finalReceiptUrl = null;
    let finalReceiptText = null;
    const token = localStorage.getItem('token');

    if (inputType === 'image') {
      if (!file) {
        setFeedback({ type: 'error', title: 'إيصال مفقود', message: 'الرجاء إرفاق صورة الإيصال قبل الإرسال.' });
        return;
      }
      try {
        const uploadData = await uploadFileDirect({ token, file });
        finalReceiptUrl = uploadData.url;
      } catch {
        setFeedback({ type: 'error', title: 'فشل رفع الصورة', message: 'حدث خطأ أثناء رفع صورة الإيصال.' });
        return;
      }
    } else {
      if (!receiptText.trim()) {
        setFeedback({ type: 'error', title: 'النص مطلوب', message: 'الرجاء إدخال نص الحوالة قبل المتابعة.' });
        return;
      }
      finalReceiptText = receiptText;
    }

    try {
      const cartCustomOrderItem = !isCustomOrderPayment
        ? cartItems.find((item) => item?.isCustomOrder && item?.customOrderId)
        : null;
      const resolvedCustomOrderId = isCustomOrderPayment
        ? customOrder.id
        : (cartCustomOrderItem?.customOrderId || null);

      const orderItems = isCustomOrderPayment
        ? [{
            id: `custom-order-${customOrder.id}`,
            nameEn: `Custom Order #${customOrder.id}`,
            nameAr: `طلب مخصص #${customOrder.id}`,
            price: Number(customOrder.priceQuote || 0),
            quantity: 1,
            isCustomOrder: true,
            material: customOrder.material,
            details: customOrder.details
          }, {
            id: 'shipping',
            nameEn: selectedCustomShipping?.type === 'pickup' ? 'Pickup from store' : `Shipping: ${selectedCustomShipping?.name || '-'}`,
            nameAr: selectedCustomShipping?.type === 'pickup' ? 'استلام من المتجر' : `الشحن: ${selectedCustomShipping?.name || '-'}`,
            price: customShippingCost,
            quantity: 1,
            isShipping: true,
            image: selectedCustomShipping?.logoUrl || null
          }]
        : ((shippingMethod 
        ? [...cartItems.map((item) => decorateProductPricing(item, { quantity: item.quantity })), { 
            id: 'shipping', 
          nameEn: shippingMethod?.type === 'pickup' ? 'Pickup from store' : `Shipping: ${shippingMethod.name}`,
          nameAr: shippingMethod?.type === 'pickup' ? 'استلام من المتجر' : `الشحن: ${shippingMethod.name}`,
            price: shippingCost, 
            quantity: 1,
            isShipping: true,
            image: shippingMethod.logoUrl
          }]
        : cartItems.map((item) => decorateProductPricing(item, { quantity: item.quantity }))));

      const res = await fetch(buildApiUrl(API_ENDPOINTS.ORDERS), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items: orderItems,
          totalAmount: orderSummaryAmount,
          couponCode: isCustomOrderPayment ? null : (appliedCoupon?.code || null),
          discountAmount: isCustomOrderPayment ? 0 : (couponDiscount || 0),
          bankId: selectedBank.id,
          receiptUrl: finalReceiptUrl,
          receiptText: finalReceiptText,
          shippingProvider: isCustomOrderPayment
            ? (selectedCustomShipping?.type === 'pickup' ? 'pickup' : (selectedCustomShipping?.shippingProvider || String(selectedCustomShipping?.name || '').toLowerCase() || 'custom-order'))
            : (shippingMethod?.shippingProvider || null),
          receiverName: receiverDetails.receiverName.trim() || null,
          receiverPhone: receiverDetails.receiverPhone.trim() || null,
          receiverCity: receiverDetails.receiverCity.trim() || null,
          receiverDistrict: receiverDetails.receiverDistrict.trim() || null,
          receiverStreet: receiverDetails.receiverStreet.trim() || null,
          receiverNearbyLandmark: receiverDetails.receiverNearbyLandmark.trim() || null,
          customOrderId: resolvedCustomOrderId
        })
      });

      if (res.ok) {
        setFeedback({
          type: 'success',
          title: isCustomOrderPayment ? 'تم إرسال الدفع' : 'تم رفع الطلب',
          message: isCustomOrderPayment
            ? 'تم إرسال دفع الطلب المخصص بنجاح. بانتظار مراجعة الإيصال واعتماد الطلب من الإدارة.'
            : 'تم رفع الطلب بنجاح. بانتظار مراجعة الإيصال واعتماد الطلب من الإدارة.'
        });
        if (!isCustomOrderPayment) {
          clearCart();
          clearCoupon();
        }
        setTimeout(() => navigate('/profile'), 900);
      } else {
        setFeedback({ type: 'error', title: 'تعذر الإرسال', message: 'حدث خطأ أثناء رفع الطلب. حاول مرة أخرى.' });
      }
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', title: 'خطأ في الاتصال', message: 'تعذر الاتصال بالخادم. تحقق من الشبكة ثم أعد المحاولة.' });
    }
  };

  if (loading) return <div className="container section text-center">جاري التحميل...</div>;

  return (
    <div className="container section" style={{ maxWidth: '800px' }}>
      <h1 className="text-center" style={{ marginBottom: '20px', color: 'var(--accent-main)' }}>{isCustomOrderPayment ? 'إتمام دفع الطلب المخصص' : 'إتمام الطلب (الدفع بالتحويل البنكي)'}</h1>
      
      <div className="glass" style={{ padding: '30px', borderRadius: '12px' }}>
        <ActionBanner
          type={feedback?.type}
          title={feedback?.title}
          message={feedback?.message}
          onClose={() => setFeedback(null)}
        />

        <div style={{ marginBottom: '16px', padding: '14px 16px', borderRadius: '12px', background: isCustomOrderPayment ? 'rgba(134,59,255,0.08)' : 'rgba(15,23,42,0.03)', border: isCustomOrderPayment ? '1px solid rgba(134,59,255,0.16)' : '1px solid var(--border-color)' }}>
          <strong>{isCustomOrderPayment ? 'مرحلة الدفع النهائية للطلب المخصص' : 'مرحلة التحويل البنكي'}</strong>
          <div style={{ marginTop: '6px', color: 'var(--text-light)' }}>
            {isCustomOrderPayment
              ? 'تمت الموافقة على السعر. اختر البنك وارفع الإيصال لإرسال الطلب إلى الإدارة.'
              : 'اختر البنك وارفع الإيصال لإرسال الطلب إلى الإدارة.'}
          </div>
        </div>

        <h2 style={{ marginBottom: '10px' }}>ملخص الطلب</h2>
        {isCustomOrderPayment && (
          <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(134,59,255,0.08)', borderRadius: '12px', border: '1px solid rgba(134,59,255,0.2)' }}>
            <strong>طلب مخصص رقم #{customOrder.id}</strong>
            <div>المادة: {customOrder.material}</div>
            <div>تفاصيل: {customOrder.details}</div>
          </div>
        )}
        <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(0,0,0,0.03)', borderRadius: '8px' }}>
          <p>المجموع الفرعي: {isCustomOrderPayment ? `${Number(customOrder?.priceQuote || 0).toFixed(2)} ر.س` : `${currentTotal.toFixed(2)} ر.س`}</p>
          {isCustomOrderPayment && (
            <p>
              الشحن ({selectedCustomShipping?.name || 'غير محدد'}): {customShippingCost > 0 ? `${customShippingCost.toFixed(2)} ر.س` : 'مجانًا'}
            </p>
          )}
          {!isCustomOrderPayment && couponDiscount > 0 && (
            <p style={{ color: '#166534', fontWeight: 700 }}>
              خصم الكوبون {appliedCoupon ? `(${appliedCoupon.code})` : ''}: -{couponDiscount.toFixed(2)} ر.س
            </p>
          )}
          {!isCustomOrderPayment && couponDiscount > 0 && (
            <p>بعد الخصم: {discountedSubtotal.toFixed(2)} ر.س</p>
          )}
          {!isCustomOrderPayment && (
            <p>
              {shippingMethod?.type === 'pickup' ? 'طريقة التنفيذ (استلام):' : `الشحن (${shippingMethod?.name || 'غير محدد'}):`}{' '}
              {shippingCostInteger > 0 ? `${shippingCostInteger} ر.س` : 'مجانًا'}
              {shippingMethod?.type === 'delivery' && shippingMethod?.distanceKm ? ` - ${shippingMethod.distanceKm.toFixed(2)} كم` : ''}
            </p>
          )}
          {requiresCarrierReceiverDetails && (
            <p style={{ color: '#92400e', fontWeight: 700 }}>
              نوع الشحن: {shippingProviderLabel} - مطلوب إدخال بيانات المستلم للتسليم.
            </p>
          )}
          {requiresCustomOrderShippingDetails && (
            <p style={{ color: '#92400e', fontWeight: 700 }}>
              الطلب المخصص يحتاج تفاصيل الشحن كاملة لتجهيز التسليم بعد اعتماد الدفع.
            </p>
          )}
          <h3 style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>الإجمالي النهائي: {orderSummaryAmount.toFixed(2)} ر.س</h3>
        </div>

        {isCustomOrderPayment && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ marginBottom: '10px' }}>الشحن</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input
                  type="radio"
                  name="customShippingMode"
                  value="pickup"
                  checked={shippingMode === 'pickup'}
                  onChange={() => handleShippingModeChange('pickup')}
                />
                <span>استلام من المتجر (مجانًا)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input
                  type="radio"
                  name="customShippingMode"
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
                      <label htmlFor="savedLocationSelectCustom" style={{ fontSize: '0.95rem', color: '#1f2937', fontWeight: 700 }}>
                        اختر من المواقع المحفوظة
                      </label>
                      <select
                        id="savedLocationSelectCustom"
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
                    <label htmlFor="customNationalAddress" style={{ fontSize: '0.95rem', color: '#1f2937', fontWeight: 700 }}>
                      العنوان الوطني
                    </label>
                    <textarea
                      id="customNationalAddress"
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
                      <label htmlFor="customCity" style={{ fontSize: '0.95rem', color: '#1f2937', fontWeight: 700 }}>
                        المدينة
                      </label>
                      <input
                        id="customCity"
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="المدينة (اختياري)"
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '150px' }}>
                      <label htmlFor="customPostalCode" style={{ fontSize: '0.95rem', color: '#1f2937', fontWeight: 700 }}>
                        الرمز البريدي
                      </label>
                      <input
                        id="customPostalCode"
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

                  {selectedCustomShipping?.type === 'delivery' && selectedCustomShipping.isEstimated && (
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>
                      <div>
                        طريقة التحديد: {selectedCustomShipping.estimationMode === 'real-geocoded' ? 'موقع دقيق عبر GPS/الخريطة' : 'تقدير عبر العنوان والمدينة'}
                      </div>
                      {typeof selectedCustomShipping.distanceKm === 'number' && selectedCustomShipping.distanceKm > 0 && (
                        <div>المسافة التقديرية: {selectedCustomShipping.distanceKm.toFixed(2)} كم</div>
                      )}
                      <div>مدة التوصيل المتوقعة: {selectedCustomShipping.estimatedDays}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <p style={{ marginBottom: '20px' }}>{isCustomOrderPayment ? 'اختر الحساب البنكي الذي تريد التحويل إليه لإتمام الطلب المخصص:' : 'اختر الحساب البنكي الذي ترغب بالتحويل إليه:'}</p>
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {banks.map(bank => (
            <div 
              key={bank.id} 
              onClick={() => setSelectedBank(bank)}
              style={{ 
                width: '100px',
                height: '100px',
                padding: '10px', 
                border: selectedBank?.id === bank.id ? '2px solid var(--accent-main)' : '1px solid var(--border-color)', 
                borderRadius: '8px',
                cursor: 'pointer',
                background: selectedBank?.id === bank.id ? 'rgba(0,0,0,0.05)' : 'white',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}
              title={bank.bankName}
            >
              {bank.logoUrl ? (
                <img src={bank.logoUrl} alt={bank.bankName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ textAlign: 'center', fontSize: '0.9rem', fontWeight: 'bold' }}>{bank.bankName}</span>
              )}
            </div>
          ))}
        </div>

        {selectedBank && (
          <div style={{ padding: '20px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', marginBottom: '30px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginBottom: '15px', color: 'var(--accent-main)' }}>تفاصيل حساب {selectedBank.bankName}</h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
              <div><span style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>اسم الحساب:</span><br/><strong>{selectedBank.accountName}</strong></div>
              <button type="button" className="btn-secondary" style={{ padding: '5px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }} onClick={() => navigator.clipboard.writeText(selectedBank.accountName)}>
                <Copy size={14} /> نسخ
              </button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
              <div><span style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>رقم الحساب:</span><br/><strong>{selectedBank.accountNumber}</strong></div>
              <button type="button" className="btn-secondary" style={{ padding: '5px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }} onClick={() => navigator.clipboard.writeText(selectedBank.accountNumber)}>
                <Copy size={14} /> نسخ
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><span style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>الآيبان IBAN:</span><br/><strong style={{ direction: 'ltr', display: 'inline-block' }}>{selectedBank.iban}</strong></div>
              <button type="button" className="btn-secondary" style={{ padding: '5px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }} onClick={() => navigator.clipboard.writeText(selectedBank.iban)}>
                <Copy size={14} /> نسخ
              </button>
            </div>
          </div>
        )}

        {selectedBank && (
          <form onSubmit={handleSubmitOrder} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '30px' }}>

            {requiresReceiverDetails && (
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', background: 'rgba(15,23,42,0.03)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <strong>
                  {requiresCustomOrderShippingDetails
                    ? 'بيانات الشحن للطلب المخصص'
                    : `بيانات المستلم للشحن عبر ${shippingProviderLabel}`}
                </strong>
                <input
                  type="text"
                  placeholder="الاسم المستلم"
                  value={receiverDetails.receiverName}
                  onChange={(e) => setReceiverDetails((prev) => ({ ...prev, receiverName: e.target.value }))}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                />
                <input
                  type="text"
                  placeholder="الجوال"
                  value={receiverDetails.receiverPhone}
                  onChange={(e) => setReceiverDetails((prev) => ({ ...prev, receiverPhone: e.target.value }))}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                />
                <input
                  type="text"
                  placeholder="المدينة"
                  value={receiverDetails.receiverCity}
                  onChange={(e) => setReceiverDetails((prev) => ({ ...prev, receiverCity: e.target.value }))}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                />
                <input
                  type="text"
                  placeholder="الحي"
                  value={receiverDetails.receiverDistrict}
                  onChange={(e) => setReceiverDetails((prev) => ({ ...prev, receiverDistrict: e.target.value }))}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                />
                <input
                  type="text"
                  placeholder="الشارع"
                  value={receiverDetails.receiverStreet}
                  onChange={(e) => setReceiverDetails((prev) => ({ ...prev, receiverStreet: e.target.value }))}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                />
                <input
                  type="text"
                  placeholder="معلم قريب"
                  value={receiverDetails.receiverNearbyLandmark}
                  onChange={(e) => setReceiverDetails((prev) => ({ ...prev, receiverNearbyLandmark: e.target.value }))}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                />
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '15px' }}>
              <label>
                <input type="radio" value="image" checked={inputType === 'image'} onChange={() => setInputType('image')} /> رفع صورة الإيصال
              </label>
              <label>
                <input type="radio" value="text" checked={inputType === 'text'} onChange={() => setInputType('text')} /> إدخال نص رسالة الحوالة
              </label>
            </div>

            {inputType === 'image' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label>اختر صورة الإيصال من جهازك</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={e => setFile(e.target.files[0])}
                  style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label>نص رسالة التحويل من البنك</label>
                <textarea 
                  placeholder="انسخ والصق رسالة الحوالة هنا..." 
                  value={receiptText}
                  onChange={e => setReceiptText(e.target.value)}
                  style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', minHeight: '100px', resize: 'vertical' }}
                />
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ padding: '15px', fontSize: '1.1rem' }}>
              {isCustomOrderPayment ? 'تأكيد الدفع وإرسال للمراجعة' : 'تأكيد الطلب وإرسال للمراجعة'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Checkout;
