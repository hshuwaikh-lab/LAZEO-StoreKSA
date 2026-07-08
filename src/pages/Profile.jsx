import React, { useState, useEffect, useRef, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import InvoiceTemplate from '../components/InvoiceTemplate';
import ActionBanner from '../components/ActionBanner';
import LocationPickerMap from '../components/LocationPickerMap';
import { AuthContext } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

const emptyLocationForm = {
  label: '',
  nationalAddress: '',
  city: '',
  postalCode: '',
  lat: null,
  lng: null,
  isDefault: false
};

const RECEIVER_PROFILE_STORAGE_KEY = 'lazeo_receiver_profile';
const emptyReceiverProfile = {
  receiverName: '',
  receiverPhone: '',
  receiverCity: '',
  receiverDistrict: '',
  receiverStreet: '',
  receiverNearbyLandmark: ''
};

const Profile = () => {
  useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('info'); // info, locations, orders, customOrders, password
  const [profile, setProfile] = useState({ username: '', email: '', phone: '', address: '', receiveWhatsApp: true });
  const [savedLocations, setSavedLocations] = useState([]);
  const [locationForm, setLocationForm] = useState(emptyLocationForm);
  const [editingLocationId, setEditingLocationId] = useState(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [locatingLocation, setLocatingLocation] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [orders, setOrders] = useState([]);
  const [customOrders, setCustomOrders] = useState([]);
  const [receiverProfile, setReceiverProfile] = useState(emptyReceiverProfile);
  const [loading, setLoading] = useState(true);
  const [printingOrder, setPrintingOrder] = useState(null);
  const [processingCustomOrderId, setProcessingCustomOrderId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const invoiceRef = useRef(null);
  const { updateUser, user } = useContext(AuthContext);
  const { addToCart, cartItems, removeFromCart } = useCart();

  const isCustomOrderInCart = (customOrderId) => {
    return cartItems.some(
      (item) => item?.isCustomOrder && Number(item?.customOrderId) === Number(customOrderId)
    );
  };

  const getCustomOrderCartItemId = (customOrderId) => {
    const matchingItem = cartItems.find(
      (item) => item?.isCustomOrder && Number(item?.customOrderId) === Number(customOrderId)
    );
    return matchingItem ? (matchingItem.cartItemId || matchingItem.id) : null;
  };

  const addCustomOrderToCart = (customOrder) => {
    if (!customOrder || customOrder.priceQuote == null) {
      return false;
    }

    if (isCustomOrderInCart(customOrder.id)) {
      return false;
    }

    const customCartId = `custom-order-${customOrder.id}`;
    addToCart({
      id: customCartId,
      nameEn: `Custom Order #${customOrder.id}`,
      nameAr: `طلب مخصص #${customOrder.id}`,
      price: Number(customOrder.priceQuote || 0),
      image: customOrder.attachmentUrl || '/logo.png',
      isCustomOrder: true,
      customOrderId: customOrder.id,
      material: customOrder.material,
      details: customOrder.details,
    }, 1, customCartId);

    return true;
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    try {
      const storedProfile = localStorage.getItem(RECEIVER_PROFILE_STORAGE_KEY);
      if (!storedProfile) return;

      const parsed = JSON.parse(storedProfile);
      setReceiverProfile({
        receiverName: String(parsed?.receiverName || ''),
        receiverPhone: String(parsed?.receiverPhone || ''),
        receiverCity: String(parsed?.receiverCity || ''),
        receiverDistrict: String(parsed?.receiverDistrict || ''),
        receiverStreet: String(parsed?.receiverStreet || ''),
        receiverNearbyLandmark: String(parsed?.receiverNearbyLandmark || '')
      });
    } catch {
      setReceiverProfile(emptyReceiverProfile);
    }
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setLoading(true);
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [profileRes, ordersRes, customRes] = await Promise.all([
        fetch(buildApiUrl(API_ENDPOINTS.USER_PROFILE), { headers }),
        fetch(buildApiUrl(API_ENDPOINTS.USER_ORDERS), { headers }),
        fetch(buildApiUrl(API_ENDPOINTS.USER_CUSTOM_ORDERS), { headers })
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
        setSavedLocations(profileData.savedLocations || []);
        setReceiverProfile((prev) => ({
          ...prev,
          receiverName: prev.receiverName || profileData.username || '',
          receiverPhone: prev.receiverPhone || profileData.phone || '',
          receiverCity: prev.receiverCity || '',
          receiverDistrict: prev.receiverDistrict || '',
          receiverStreet: prev.receiverStreet || '',
          receiverNearbyLandmark: prev.receiverNearbyLandmark || ''
        }));
      }
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (customRes.ok) {
        const customOrdersData = await customRes.json();
        setCustomOrders(customOrdersData);

        const autoAddedCount = (Array.isArray(customOrdersData) ? customOrdersData : []).reduce((count, customOrder) => {
          const canAutoAdd =
            (customOrder?.status === 'priced' || customOrder?.status === 'accepted')
            && customOrder?.priceQuote != null;

          if (!canAutoAdd) {
            return count;
          }

          return count + (addCustomOrderToCart(customOrder) ? 1 : 0);
        }, 0);

        if (autoAddedCount > 0) {
          setFeedback({
            type: 'success',
            title: 'تمت الإضافة تلقائيًا',
            message: `تمت إضافة ${autoAddedCount} طلب/طلبات مخصصة مسعّرة إلى السلة.`
          });
        }
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetLocationForm = () => {
    setLocationForm(emptyLocationForm);
    setEditingLocationId(null);
  };

  const handleLocationMapChange = (nextLocation) => {
    setLocationForm((prev) => ({
      ...prev,
      lat: Number(nextLocation.lat),
      lng: Number(nextLocation.lng)
    }));
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setFeedback({ type: 'error', title: 'الموقع غير متاح', message: 'المتصفح الحالي لا يدعم تحديد الموقع.' });
      return;
    }

    setLocatingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationForm((prev) => ({
          ...prev,
          lat: Number(position.coords.latitude),
          lng: Number(position.coords.longitude)
        }));
        setLocatingLocation(false);
      },
      () => {
        setFeedback({ type: 'error', title: 'تعذر تحديد الموقع', message: 'اسمح بالوصول للموقع أو ضع الدبوس يدويًا على الخريطة.' });
        setLocatingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleEditLocation = (location) => {
    setEditingLocationId(location.id);
    setLocationForm({
      label: location.label || '',
      nationalAddress: location.nationalAddress || '',
      city: location.city || '',
      postalCode: location.postalCode || '',
      lat: location.lat ?? null,
      lng: location.lng ?? null,
      isDefault: Boolean(location.isDefault)
    });
    setActiveTab('locations');
  };

  const handleDeleteLocation = async (locationId) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.USER_LOCATION_DETAIL(locationId)), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'تعذر حذف الموقع');
      }

      const remaining = savedLocations.filter((location) => location.id !== locationId);
      setSavedLocations(remaining);
      setFeedback({ type: 'success', title: 'تم حذف الموقع', message: 'تم حذف الموقع المحفوظ بنجاح.' });
      if (editingLocationId === locationId) {
        resetLocationForm();
      }
    } catch (error) {
      setFeedback({ type: 'error', title: 'تعذر الحذف', message: error.message || 'حدث خطأ أثناء حذف الموقع.' });
    }
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return;

    setSavingLocation(true);
    try {
      const endpoint = editingLocationId
        ? API_ENDPOINTS.USER_LOCATION_DETAIL(editingLocationId)
        : API_ENDPOINTS.USER_LOCATIONS;
      const method = editingLocationId ? 'PUT' : 'POST';

      const payload = {
        label: locationForm.label,
        nationalAddress: locationForm.nationalAddress,
        city: locationForm.city,
        postalCode: locationForm.postalCode,
        lat: locationForm.lat,
        lng: locationForm.lng,
        isDefault: locationForm.isDefault
      };

      const res = await fetch(buildApiUrl(endpoint), {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.error || 'تعذر حفظ الموقع');
      }

      const nextLocations = editingLocationId
        ? savedLocations.map((location) => (location.id === result.id ? result : location))
        : [result, ...savedLocations];
      const normalizedLocations = result.isDefault
        ? nextLocations.map((location) => ({ ...location, isDefault: location.id === result.id }))
        : nextLocations;

      setSavedLocations(normalizedLocations.sort((a, b) => Number(b.isDefault) - Number(a.isDefault)));
      setFeedback({ type: 'success', title: 'تم حفظ الموقع', message: editingLocationId ? 'تم تحديث الموقع المحفوظ.' : 'تم إضافة الموقع المحفوظ بنجاح.' });
      resetLocationForm();
    } catch (error) {
      setFeedback({ type: 'error', title: 'تعذر الحفظ', message: error.message || 'حدث خطأ أثناء حفظ الموقع.' });
    } finally {
      setSavingLocation(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.USER_PROFILE), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username: profile.username, phone: profile.phone, address: profile.address, receiveWhatsApp: profile.receiveWhatsApp })
      });
      if (res.ok) {
        localStorage.setItem(RECEIVER_PROFILE_STORAGE_KEY, JSON.stringify({
          receiverName: receiverProfile.receiverName.trim(),
          receiverPhone: receiverProfile.receiverPhone.trim(),
          receiverCity: receiverProfile.receiverCity.trim(),
          receiverDistrict: receiverProfile.receiverDistrict.trim(),
          receiverStreet: receiverProfile.receiverStreet.trim(),
          receiverNearbyLandmark: receiverProfile.receiverNearbyLandmark.trim()
        }));

        setFeedback({ type: 'success', title: 'تم التحديث', message: 'تم تحديث البيانات الشخصية بنجاح.' });
        if (updateUser) {
          updateUser({ username: profile.username });
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        setFeedback({ type: 'error', title: 'تعذر التحديث', message: errorData.error || 'لم يتم حفظ التغييرات.' });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setFeedback({ type: 'error', title: 'تعذر التحديث', message: 'حدث خطأ أثناء حفظ البيانات.' });
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.USER_PASSWORD), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(passwordForm)
      });
      if (res.ok) {
        setFeedback({ type: 'success', title: 'تم تغيير كلمة المرور', message: 'تم تحديث كلمة المرور بنجاح.' });
        setPasswordForm({ currentPassword: '', newPassword: '' });
      } else {
        const errorData = await res.json();
        setFeedback({ type: 'error', title: 'تعذر تغيير كلمة المرور', message: errorData.error || 'تحقق من البيانات وأعد المحاولة.' });
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setFeedback({ type: 'error', title: 'تعذر تغيير كلمة المرور', message: 'حدث خطأ أثناء الاتصال بالخادم.' });
    }
  };

  const handlePrintInvoice = (order) => {
    setPrintingOrder(order);
    setTimeout(async () => {
      if (invoiceRef.current) {
        try {
          const canvas = await html2canvas(invoiceRef.current, { scale: 2, useCORS: true });
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          pdf.save(`Invoice_${order.invoiceNumber || order.id}.pdf`);
        } catch (err) {
          console.error("Error generating PDF:", err);
          setFeedback({ type: 'error', title: 'فشل طباعة الفاتورة', message: 'حدث خطأ أثناء تجهيز ملف الفاتورة.' });
        }
      }
      setPrintingOrder(null);
    }, 100);
  };

  const handleAcceptCustomOrder = async (customOrder) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setProcessingCustomOrderId(customOrder.id);

    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.USER_CUSTOM_ORDER_ACCEPT(customOrder.id)), {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'تعذر الموافقة على السعر');
      }

      const addedToCart = addCustomOrderToCart(customOrder);

      await fetchData();
      setFeedback({
        type: 'success',
        title: 'تمت الموافقة',
        message: addedToCart
          ? 'تمت إضافة الطلب المخصص إلى السلة بنجاح.'
          : 'هذا الطلب المخصص موجود بالفعل في السلة.'
      });
      navigate('/cart');
    } catch (error) {
      console.error('Error accepting custom order:', error);
      setFeedback({ type: 'error', title: 'تعذر الموافقة', message: error.message || 'حدث خطأ أثناء الموافقة على السعر.' });
    } finally {
      setProcessingCustomOrderId(null);
    }
  };

  const handleGoToCartWithCustomOrder = (customOrder) => {
    const addedToCart = addCustomOrderToCart(customOrder);
    setFeedback({
      type: 'success',
      title: 'تم التوجيه للسلة',
      message: addedToCart
        ? 'تمت إضافة الطلب المخصص إلى السلة.'
        : 'هذا الطلب المخصص موجود بالفعل في السلة.'
    });
    navigate('/cart');
  };

  const handleCancelCustomOrder = async (customOrder) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setProcessingCustomOrderId(customOrder.id);

    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.USER_CUSTOM_ORDER_CANCEL(customOrder.id)), {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'تعذر إلغاء الطلب');
      }

      const cartItemId = getCustomOrderCartItemId(customOrder.id);
      if (cartItemId) {
        removeFromCart(cartItemId);
      }

      await fetchData();
      setFeedback({ type: 'success', title: 'تم الإلغاء', message: 'تم إلغاء الطلب المخصص وحذفه من السلة.' });
    } catch (error) {
      console.error('Error canceling custom order:', error);
      setFeedback({ type: 'error', title: 'تعذر الإلغاء', message: error.message || 'حدث خطأ أثناء إلغاء الطلب.' });
    } finally {
      setProcessingCustomOrderId(null);
    }
  };

  if (loading) return <div className="container section text-center">جاري التحميل...</div>;

  return (
    <div className="container section">
      <h1 className="text-center" style={{ marginBottom: '40px', color: 'var(--accent-main)' }}>الملف الشخصي</h1>

      {user?.role === 'admin' && (
        <div style={{ marginBottom: '24px', padding: '16px 18px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(134,59,255,0.12), rgba(15,23,42,0.06))', border: '1px solid rgba(134,59,255,0.18)', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <strong style={{ display: 'block', marginBottom: '4px' }}>حساب إداري</strong>
            <span style={{ color: 'var(--text-light)' }}>يمكنك الدخول إلى لوحة الإدارة أو برنامج المكتب مباشرة من هنا.</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" className="btn-primary" onClick={() => navigate('/admin')}>لوحة الإدارة</button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/admin/desktop-program')}>برنامج المكتب</button>
          </div>
        </div>
      )}
      
      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className={activeTab === 'info' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('info')}>البيانات الشخصية</button>
        <button className={activeTab === 'locations' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('locations')}>المواقع المحفوظة</button>
        <button className={activeTab === 'password' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('password')}>تغيير كلمة المرور</button>
        <button className={activeTab === 'orders' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('orders')}>الطلبات السابقة</button>
        <button className={activeTab === 'customOrders' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('customOrders')}>الطلبات المخصصة</button>
      </div>

      <div className="glass" style={{ padding: '30px', borderRadius: '12px' }}>
        {activeTab === 'info' && (
          <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '500px', margin: '0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label>الاسم</label>
              <input type="text" value={profile.username || ''} onChange={(e) => setProfile({...profile, username: e.target.value})} style={{ padding: '10px', borderRadius: '6px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label>البريد الإلكتروني (غير قابل للتعديل)</label>
              <input type="email" value={profile.email || ''} readOnly style={{ padding: '10px', borderRadius: '6px', background: '#e9ecef' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label>رقم الهاتف</label>
              <input type="text" value={profile.phone || ''} onChange={(e) => setProfile({...profile, phone: e.target.value})} style={{ padding: '10px', borderRadius: '6px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label>العنوان</label>
              <textarea value={profile.address || ''} onChange={(e) => setProfile({...profile, address: e.target.value})} rows="3" style={{ padding: '10px', borderRadius: '6px' }}></textarea>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="checkbox" id="whatsappToggle" checked={profile.receiveWhatsApp} onChange={(e) => setProfile({...profile, receiveWhatsApp: e.target.checked})} />
              <label htmlFor="whatsappToggle">استلام رسائل الواتساب من المتجر</label>
            </div>

            <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', background: 'rgba(15,23,42,0.03)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <strong>بيانات المستلم الافتراضية</strong>
              <span style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>سيتم استخدامها تلقائيًا في السلة وصفحة الدفع ويمكن تعديلها لاحقًا.</span>
              <input
                type="text"
                placeholder="اسم المستلم"
                value={receiverProfile.receiverName}
                onChange={(e) => setReceiverProfile((prev) => ({ ...prev, receiverName: e.target.value }))}
                style={{ padding: '10px', borderRadius: '6px' }}
              />
              <input
                type="text"
                placeholder="الجوال"
                value={receiverProfile.receiverPhone}
                onChange={(e) => setReceiverProfile((prev) => ({ ...prev, receiverPhone: e.target.value }))}
                style={{ padding: '10px', borderRadius: '6px' }}
              />
              <input
                type="text"
                placeholder="المدينة"
                value={receiverProfile.receiverCity}
                onChange={(e) => setReceiverProfile((prev) => ({ ...prev, receiverCity: e.target.value }))}
                style={{ padding: '10px', borderRadius: '6px' }}
              />
              <input
                type="text"
                placeholder="الحي"
                value={receiverProfile.receiverDistrict}
                onChange={(e) => setReceiverProfile((prev) => ({ ...prev, receiverDistrict: e.target.value }))}
                style={{ padding: '10px', borderRadius: '6px' }}
              />
              <input
                type="text"
                placeholder="الشارع"
                value={receiverProfile.receiverStreet}
                onChange={(e) => setReceiverProfile((prev) => ({ ...prev, receiverStreet: e.target.value }))}
                style={{ padding: '10px', borderRadius: '6px' }}
              />
              <input
                type="text"
                placeholder="معلم قريب"
                value={receiverProfile.receiverNearbyLandmark}
                onChange={(e) => setReceiverProfile((prev) => ({ ...prev, receiverNearbyLandmark: e.target.value }))}
                style={{ padding: '10px', borderRadius: '6px' }}
              />
            </div>
            <button type="submit" className="btn-primary">حفظ التعديلات</button>
          </form>
        )}

        {activeTab === 'locations' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)', gap: '20px' }}>
            <form onSubmit={handleSaveLocation} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0 }}>{editingLocationId ? 'تعديل موقع محفوظ' : 'إضافة موقع جديد'}</h3>
                {editingLocationId ? (
                  <button type="button" className="btn-secondary" onClick={resetLocationForm}>إلغاء التعديل</button>
                ) : null}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label>المسمى</label>
                <input
                  type="text"
                  value={locationForm.label}
                  onChange={(e) => setLocationForm((prev) => ({ ...prev, label: e.target.value }))}
                  placeholder="مثال: المنزل، العمل، بيت الوالد"
                  style={{ padding: '10px', borderRadius: '8px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label>العنوان الوطني</label>
                <textarea
                  value={locationForm.nationalAddress}
                  onChange={(e) => setLocationForm((prev) => ({ ...prev, nationalAddress: e.target.value }))}
                  rows={3}
                  placeholder="اكتب العنوان الوطني لهذا الموقع"
                  style={{ padding: '10px', borderRadius: '8px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '180px' }}>
                  <label>المدينة</label>
                  <input
                    type="text"
                    value={locationForm.city}
                    onChange={(e) => setLocationForm((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="المدينة"
                    style={{ padding: '10px', borderRadius: '8px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '180px' }}>
                  <label>الرمز البريدي</label>
                  <input
                    type="text"
                    value={locationForm.postalCode}
                    onChange={(e) => setLocationForm((prev) => ({ ...prev, postalCode: e.target.value }))}
                    placeholder="الرمز البريدي"
                    style={{ padding: '10px', borderRadius: '8px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="btn-secondary" onClick={handleUseCurrentLocation} disabled={locatingLocation}>
                  {locatingLocation ? 'جاري تحديد الموقع...' : 'استخدم موقعي الحالي'}
                </button>
                {locationForm.lat != null && locationForm.lng != null ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setLocationForm((prev) => ({ ...prev, lat: null, lng: null }))}
                  >
                    إزالة الإحداثيات
                  </button>
                ) : null}
                <span style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>
                  {locationForm.lat != null && locationForm.lng != null
                    ? `${locationForm.lat.toFixed(5)}, ${locationForm.lng.toFixed(5)}`
                    : 'يمكنك تعيين الموقع من الخريطة أو عبر GPS.'}
                </span>
              </div>

              <LocationPickerMap
                selectedPosition={locationForm.lat != null && locationForm.lng != null ? { lat: locationForm.lat, lng: locationForm.lng } : null}
                onPositionChange={handleLocationMapChange}
              />

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  id="defaultLocationToggle"
                  checked={locationForm.isDefault}
                  onChange={(e) => setLocationForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                />
                <label htmlFor="defaultLocationToggle">تعيين كموقع افتراضي</label>
              </div>

              <button type="submit" className="btn-primary" disabled={savingLocation}>
                {savingLocation ? 'جاري الحفظ...' : editingLocationId ? 'حفظ التعديل' : 'إضافة الموقع'}
              </button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ margin: 0 }}>مواقعي المحفوظة</h3>
              {savedLocations.length === 0 ? (
                <div style={{ padding: '18px', borderRadius: '12px', background: 'rgba(15,23,42,0.03)', border: '1px solid var(--border-color)' }}>
                  لا توجد مواقع محفوظة بعد.
                </div>
              ) : savedLocations.map((location) => (
                <div key={location.id} style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: location.isDefault ? 'rgba(22,163,74,0.06)' : 'rgba(15,23,42,0.03)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{location.label}</strong>
                    {location.isDefault ? <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#166534' }}>افتراضي</span> : null}
                  </div>
                  {location.nationalAddress ? <div>{location.nationalAddress}</div> : null}
                  <div style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>
                    {[location.city, location.postalCode].filter(Boolean).join(' - ') || 'بدون مدينة أو رمز بريدي'}
                  </div>
                  {location.lat != null && location.lng != null ? (
                    <div style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>
                      {Number(location.lat).toFixed(5)}, {Number(location.lng).toFixed(5)}
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button type="button" className="btn-secondary" onClick={() => handleEditLocation(location)}>تعديل</button>
                    <button type="button" className="btn-secondary" onClick={() => handleDeleteLocation(location.id)}>حذف</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'password' && (
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '500px', margin: '0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label>كلمة المرور الحالية</label>
              <input type="password" required value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})} style={{ padding: '10px', borderRadius: '6px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label>كلمة المرور الجديدة</label>
              <input type="password" required value={passwordForm.newPassword} onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})} style={{ padding: '10px', borderRadius: '6px' }} />
            </div>
            <button type="submit" className="btn-primary">تغيير كلمة المرور</button>
          </form>
        )}

        {activeTab === 'orders' && (
          <div>
            {orders.length === 0 ? <p className="text-center">لا توجد طلبات سابقة.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th>رقم الفاتورة</th>
                    <th>أنواع الطلبات</th>
                    <th>التاريخ</th>
                    <th>المبلغ الإجمالي</th>
                    <th>الحالة</th>
                    <th>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    let itemsCount = 0;
                    try {
                      itemsCount = JSON.parse(o.items).length;
                    } catch (e) {
                      console.error('Failed to parse order items:', e);
                    }
                    return (
                    <tr key={o.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px' }}>{o.invoiceNumber || '-'}</td>
                      <td style={{ padding: '10px' }}>{itemsCount}</td>
                      <td style={{ padding: '10px' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '10px' }}>{o.totalAmount} ر.س</td>
                      <td style={{ padding: '10px' }}>{o.status}</td>
                      <td style={{ padding: '10px' }}>
                        {o.invoiceNumber && <button className="btn-secondary" onClick={() => handlePrintInvoice(o)}>نسخة من الفاتورة</button>}
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'customOrders' && (
          <div>
            <div style={{ marginBottom: '18px', padding: '14px 16px', borderRadius: '10px', background: 'rgba(134,59,255,0.06)', border: '1px solid rgba(134,59,255,0.12)' }}>
              <strong>تسلسل الطلب المخصص</strong>
              <div style={{ marginTop: '6px', color: 'var(--text-light)' }}>بعد التسعير من الإدارة يظهر زر الموافقة هنا. بعد الموافقة يضاف الطلب إلى السلة ويكمل عبر نفس مسار الطلبات العادية.</div>
            </div>
            {customOrders.length === 0 ? <p className="text-center">لا توجد طلبات مخصصة.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th>رقم الطلب</th>
                    <th>التاريخ</th>
                    <th>المادة</th>
                    <th>التسعير</th>
                    <th>الحالة</th>
                    <th>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {customOrders.map(co => (
                    <tr key={co.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px' }}>#{co.id}</td>
                      <td style={{ padding: '10px' }}>{new Date(co.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '10px' }}>{co.material}</td>
                      <td style={{ padding: '10px' }}>{co.priceQuote ? `${co.priceQuote} ر.س` : 'بانتظار التسعير'}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ padding: '5px 10px', borderRadius: '999px', background: co.status === 'accepted' ? '#dcfce7' : co.status === 'priced' ? '#fef3c7' : '#e2e8f0', color: co.status === 'accepted' ? '#166534' : co.status === 'priced' ? '#92400e' : '#334155', fontSize: '0.85rem', fontWeight: 700 }}>
                          {co.status === 'priced' ? 'بانتظار موافقة العميل' : co.status === 'accepted' ? 'بانتظار الدفع' : co.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        {co.priceQuote && co.status === 'priced' && !isCustomOrderInCart(co.id) && (
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleAcceptCustomOrder(co)}
                            disabled={processingCustomOrderId === co.id}
                          >
                            {processingCustomOrderId === co.id ? 'جاري...' : 'موافقة وإضافة للسلة'}
                          </button>
                        )}
                        {co.priceQuote && isCustomOrderInCart(co.id) && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleGoToCartWithCustomOrder(co)}
                          >
                            الذهاب للسلة
                          </button>
                        )}
                        {co.priceQuote && (co.status === 'priced' || co.status === 'accepted') && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleCancelCustomOrder(co)}
                            disabled={processingCustomOrderId === co.id}
                            style={{ marginInlineStart: '8px' }}
                          >
                            {processingCustomOrderId === co.id ? 'جاري...' : 'إلغاء الطلب'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
      <ActionBanner
        type={feedback?.type}
        title={feedback?.title}
        message={feedback?.message}
        onClose={() => setFeedback(null)}
      />
      
      {printingOrder && <InvoiceTemplate order={printingOrder} ref={invoiceRef} />}
    </div>
  );
};

export default Profile;
