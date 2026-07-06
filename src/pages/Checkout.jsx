import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';
import { Copy } from 'lucide-react';
import { uploadFileDirect } from '../utils/directUpload';
import ActionBanner from '../components/ActionBanner';
import { decorateProductPricing } from '../utils/offers';

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
  useContext(AuthContext);

  const customOrder = location.state?.customOrder || null;
  const isCustomOrderPayment = Boolean(customOrder);

  const [banks, setBanks] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);
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
  const requiresCarrierReceiverDetails = !isCustomOrderPayment && shippingMethod?.type === 'delivery' && (normalizedShippingProvider === 'aramex' || normalizedShippingProvider === 'smsa');
  const shippingProviderLabel = normalizedShippingProvider === 'smsa' ? 'سمسا' : 'أرامكس';

  useEffect(() => {
    if (!isCustomOrderPayment && cartItems.length === 0) {
      navigate('/cart');
      return;
    }
    fetchBanks();
  }, [cartItems, navigate, isCustomOrderPayment]);

  const orderSummaryAmount = useMemo(() => {
    if (isCustomOrderPayment) {
      return Number(customOrder?.priceQuote || 0);
    }
    return finalTotal || currentTotal;
  }, [currentTotal, customOrder, finalTotal, isCustomOrderPayment]);

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

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!selectedBank) {
      setFeedback({ type: 'error', title: 'اختيار البنك مطلوب', message: 'الرجاء اختيار بنك للتحويل أولًا.' });
      return;
    }

    if (requiresCarrierReceiverDetails) {
      if (!receiverDetails.receiverName.trim() || !receiverDetails.receiverPhone.trim() || !receiverDetails.receiverCity.trim() || !receiverDetails.receiverDistrict.trim() || !receiverDetails.receiverStreet.trim() || !receiverDetails.receiverNearbyLandmark.trim()) {
        setFeedback({ type: 'error', title: 'بيانات المستلم مطلوبة', message: 'أكمل اسم المستلم والجوال والمدينة والحي والشارع والمعلم القريب قبل إرسال الطلب.' });
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
          shippingProvider: shippingMethod?.shippingProvider || null,
          receiverName: receiverDetails.receiverName.trim() || null,
          receiverPhone: receiverDetails.receiverPhone.trim() || null,
          receiverCity: receiverDetails.receiverCity.trim() || null,
          receiverDistrict: receiverDetails.receiverDistrict.trim() || null,
          receiverStreet: receiverDetails.receiverStreet.trim() || null,
          receiverNearbyLandmark: receiverDetails.receiverNearbyLandmark.trim() || null,
          customOrderId: isCustomOrderPayment ? customOrder.id : null
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
              {shippingCost > 0 ? `${shippingCost.toFixed(2)} ر.س` : 'مجانًا'}
              {shippingMethod?.type === 'delivery' && shippingMethod?.distanceKm ? ` - ${shippingMethod.distanceKm.toFixed(2)} كم` : ''}
            </p>
          )}
          {requiresCarrierReceiverDetails && (
            <p style={{ color: '#92400e', fontWeight: 700 }}>
              نوع الشحن: {shippingProviderLabel} - مطلوب إدخال بيانات المستلم للتسليم.
            </p>
          )}
          <h3 style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>الإجمالي النهائي: {orderSummaryAmount.toFixed(2)} ر.س</h3>
        </div>

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

            {requiresCarrierReceiverDetails && (
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', background: 'rgba(15,23,42,0.03)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <strong>بيانات المستلم للشحن عبر {shippingProviderLabel}</strong>
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
