import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';
import ActionBanner from '../components/ActionBanner';
import LocationPickerMap from '../components/LocationPickerMap';

const emptyForm = {
  storeNationalAddress: '',
  storeLat: '',
  storeLng: '',
  shippingBasePrice: '',
  shippingPricePerKm: '',
  shippingMinPrice: '',
  shippingMaxPrice: '',
  shippingCarrierThreshold: '',
  shippingCarrierFixedPrice: 35,
  shippingCarrierProvider: 'aramex'
};

const AdminShippingSettings = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const labelStyle = { fontSize: '0.95rem', color: '#1f2937', fontWeight: 700 };
  const fieldWrapStyle = { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '220px' };

  const parsedStoreLat = Number(form.storeLat);
  const parsedStoreLng = Number(form.storeLng);
  const mapStorePosition = Number.isFinite(parsedStoreLat) && Number.isFinite(parsedStoreLng)
    ? { lat: parsedStoreLat, lng: parsedStoreLng }
    : null;

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.SETTINGS));
      if (!response.ok) {
        throw new Error('تعذر تحميل الإعدادات الحالية.');
      }

      const settings = await response.json();
      setForm({
        storeNationalAddress: settings.storeNationalAddress ?? '',
        storeLat: settings.storeLat ?? '',
        storeLng: settings.storeLng ?? '',
        shippingBasePrice: settings.shippingBasePrice ?? '',
        shippingPricePerKm: settings.shippingPricePerKm ?? '',
        shippingMinPrice: settings.shippingMinPrice ?? '',
        shippingMaxPrice: settings.shippingMaxPrice ?? '',
        shippingCarrierThreshold: settings.shippingCarrierThreshold ?? '',
        shippingCarrierFixedPrice: settings.shippingCarrierFixedPrice ?? 35,
        shippingCarrierProvider: settings.shippingCarrierProvider || 'aramex'
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        title: 'تعذر تحميل الإعدادات',
        message: error.message || 'حدث خطأ أثناء تحميل إعدادات الشحن.'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem('token');

    if (!token) {
      setFeedback({
        type: 'error',
        title: 'تسجيل الدخول مطلوب',
        message: 'الرجاء تسجيل الدخول بحساب إداري ثم إعادة المحاولة.'
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_SETTINGS), {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'تعذر حفظ إعدادات الشحن.');
      }

      setFeedback({
        type: 'success',
        title: 'تم الحفظ',
        message: 'تم تحديث صفحة إعدادات الشحن التقديري بنجاح.'
      });
      setForm({
        storeNationalAddress: result.storeNationalAddress ?? '',
        storeLat: result.storeLat ?? '',
        storeLng: result.storeLng ?? '',
        shippingBasePrice: result.shippingBasePrice ?? '',
        shippingPricePerKm: result.shippingPricePerKm ?? '',
        shippingMinPrice: result.shippingMinPrice ?? '',
        shippingMaxPrice: result.shippingMaxPrice ?? '',
        shippingCarrierThreshold: result.shippingCarrierThreshold ?? '',
        shippingCarrierFixedPrice: result.shippingCarrierFixedPrice ?? 35,
        shippingCarrierProvider: result.shippingCarrierProvider || 'aramex'
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        title: 'تعذر الحفظ',
        message: error.message || 'حدث خطأ أثناء حفظ إعدادات الشحن.'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container section" style={{ maxWidth: '860px' }}>
      <div className="glass" style={{ padding: '24px', borderRadius: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <h2 style={{ margin: 0 }}>صفحة تعديل الشحن التقديري</h2>
          <button type="button" className="btn-secondary" onClick={() => navigate('/admin')}>
            رجوع للوحة الإدارة
          </button>
        </div>

        <ActionBanner
          type={feedback?.type}
          title={feedback?.title}
          message={feedback?.message}
          onClose={() => setFeedback(null)}
        />

        {loading ? (
          <p style={{ marginTop: '8px' }}>جاري تحميل الإعدادات...</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, color: 'var(--text-light)' }}>
              تتحكم هذه القيم في حساب المسافة والتسعير عند اختيار الشحن بالعنوان الوطني.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="storeNationalAddress" style={labelStyle}>العنوان الوطني للمتجر</label>
              <textarea
                id="storeNationalAddress"
                placeholder="العنوان الوطني للمتجر"
                value={form.storeNationalAddress}
                onChange={(e) => setForm((prev) => ({ ...prev, storeNationalAddress: e.target.value }))}
                rows={3}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={fieldWrapStyle}>
                <label htmlFor="storeLat" style={labelStyle}>خط عرض المتجر</label>
                <input
                  id="storeLat"
                  type="number"
                  step="0.000001"
                  placeholder="خط عرض المتجر"
                  value={form.storeLat}
                  onChange={(e) => setForm((prev) => ({ ...prev, storeLat: e.target.value }))}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div style={fieldWrapStyle}>
                <label htmlFor="storeLng" style={labelStyle}>خط طول المتجر</label>
                <input
                  id="storeLng"
                  type="number"
                  step="0.000001"
                  placeholder="خط طول المتجر"
                  value={form.storeLng}
                  onChange={(e) => setForm((prev) => ({ ...prev, storeLng: e.target.value }))}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={labelStyle}>تحديد موقع المتجر من الخريطة</label>
              <LocationPickerMap
                selectedPosition={mapStorePosition}
                onPositionChange={(nextLocation) => setForm((prev) => ({
                  ...prev,
                  storeLat: Number(nextLocation.lat).toFixed(6),
                  storeLng: Number(nextLocation.lng).toFixed(6)
                }))}
              />
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>
                  {mapStorePosition
                    ? `الإحداثيات الحالية: ${mapStorePosition.lat.toFixed(6)}, ${mapStorePosition.lng.toFixed(6)}`
                    : 'اضغط على الخريطة لتحديد موقع المتجر وتعبئة الحقول تلقائيًا.'}
                </span>
                {mapStorePosition ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setForm((prev) => ({ ...prev, storeLat: '', storeLng: '' }))}
                  >
                    مسح الإحداثيات
                  </button>
                ) : null}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={fieldWrapStyle}>
                <label htmlFor="shippingBasePrice" style={labelStyle}>سعر أساس الشحن</label>
                <input
                  id="shippingBasePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="سعر أساس الشحن"
                  value={form.shippingBasePrice}
                  onChange={(e) => setForm((prev) => ({ ...prev, shippingBasePrice: e.target.value }))}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div style={fieldWrapStyle}>
                <label htmlFor="shippingPricePerKm" style={labelStyle}>سعر كل كيلومتر</label>
                <input
                  id="shippingPricePerKm"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="سعر كل كيلومتر"
                  value={form.shippingPricePerKm}
                  onChange={(e) => setForm((prev) => ({ ...prev, shippingPricePerKm: e.target.value }))}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={fieldWrapStyle}>
                <label htmlFor="shippingMinPrice" style={labelStyle}>الحد الأدنى للشحن</label>
                <input
                  id="shippingMinPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="الحد الأدنى للشحن"
                  value={form.shippingMinPrice}
                  onChange={(e) => setForm((prev) => ({ ...prev, shippingMinPrice: e.target.value }))}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div style={fieldWrapStyle}>
                <label htmlFor="shippingMaxPrice" style={labelStyle}>الحد الأقصى للشحن</label>
                <input
                  id="shippingMaxPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="الحد الأقصى للشحن"
                  value={form.shippingMaxPrice}
                  onChange={(e) => setForm((prev) => ({ ...prev, shippingMaxPrice: e.target.value }))}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                />
              </div>
            </div>

            <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', background: 'rgba(15,23,42,0.03)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <strong>شرط التحويل إلى شركات الشحن</strong>
              <span style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>
                إذا تجاوز الشحن المحسوب هذا الحد، يتم التحويل تلقائيًا إلى أرامكس أو سمسا مع سعر ثابت قابل للتعديل.
              </span>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={fieldWrapStyle}>
                  <label htmlFor="shippingCarrierThreshold" style={labelStyle}>حد التحويل (مثال: 35)</label>
                  <input
                    id="shippingCarrierThreshold"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="حد التحويل (مثال: 35)"
                    value={form.shippingCarrierThreshold}
                    onChange={(e) => setForm((prev) => ({ ...prev, shippingCarrierThreshold: e.target.value }))}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div style={fieldWrapStyle}>
                  <label htmlFor="shippingCarrierFixedPrice" style={labelStyle}>السعر الثابت بعد التحويل</label>
                  <input
                    id="shippingCarrierFixedPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="السعر الثابت بعد التحويل"
                    value={form.shippingCarrierFixedPrice}
                    onChange={(e) => setForm((prev) => ({ ...prev, shippingCarrierFixedPrice: e.target.value }))}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '280px' }}>
                <label htmlFor="shippingCarrierProvider" style={labelStyle}>شركة الشحن بعد التحويل</label>
                <select
                  id="shippingCarrierProvider"
                  value={form.shippingCarrierProvider}
                  onChange={(e) => setForm((prev) => ({ ...prev, shippingCarrierProvider: e.target.value }))}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                >
                  <option value="aramex">أرامكس</option>
                  <option value="smsa">سمسا</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button type="submit" className="btn-primary" disabled={saving} style={{ minWidth: '180px' }}>
                {saving ? 'جاري الحفظ...' : 'حفظ إعدادات الشحن'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminShippingSettings;
