import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { buildApiUrl, API_ENDPOINTS, API_BASE_URL } from '../config/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import InvoiceTemplate from '../components/InvoiceTemplate';
import ActionBanner from '../components/ActionBanner';
import Modal from '../components/Modal';
import { uploadFileDirect } from '../utils/directUpload';
import { getProductPrimaryImage, parseProductImageUrls, serializeProductImageUrls } from '../utils/productImages';
import { formatOfferEndsAt, isOfferActive, toDateTimeLocalValue } from '../utils/offers';
import { normalizeCouponCode, toDateTimeLocalValue as toCouponDateTimeLocalValue } from '../utils/coupons';
import { DEFAULT_PRODUCT_CATEGORY, PRODUCT_CATEGORIES, getProductCategoryLabel, normalizeProductCategory } from '../data/productCategories';

const createEmptyProductForm = () => ({
  nameAr: '',
  nameEn: '',
  price: '',
  offerPrice: '',
  offerMinQuantity: '',
  offerEndsAt: '',
  category: DEFAULT_PRODUCT_CATEGORY,
  descriptionAr: '',
  descriptionEn: '',
  image: ''
});

const createEmptyCouponForm = () => ({
  code: '',
  discountType: 'percent',
  discountValue: '',
  minOrderAmount: '',
  maxDiscount: '',
  expiresAt: '',
  isActive: true,
});

const extractUrlsFromText = (text) => {
  if (!text) return [];
  const matches = text.match(/https?:\/\/[^\s]+/gi);
  return matches || [];
};

const isLikelyImageUrl = (url) => {
  if (!url) return false;
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(url) || url.startsWith('data:image/');
};

const AdminDashboard = () => {
  const { logout, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('orders'); // users, orders, customOrders, shipping, banks, products, materials, coupons, admins, settings, invoices
  const [data, setData] = useState({ users: [], orders: [], customOrders: [], shipping: [], banks: [], products: [], materials: [], coupons: [], admins: [], settings: {} });
  const [loading, setLoading] = useState(true);
  const [printingOrder, setPrintingOrder] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [dialog, setDialog] = useState({ open: false, title: '', content: '', mode: 'text', confirmLabel: '', onConfirm: null });
  const [selectedCustomOrder, setSelectedCustomOrder] = useState(null);
  const [detailsQuoteValue, setDetailsQuoteValue] = useState('');
  const [detailsActionLoading, setDetailsActionLoading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [passwordTargetId, setPasswordTargetId] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [dialogText, setDialogText] = useState('');
  const invoiceRef = useRef(null);
  const shippingImportInputRef = useRef(null);
  const banksImportInputRef = useRef(null);
  const productsImportInputRef = useRef(null);
  const productsImportImagesInputRef = useRef(null);
  const productImageInputRef = useRef(null);
  const sessionExpiredRef = useRef(false);

  const handleSessionExpired = useCallback(async () => {
    if (sessionExpiredRef.current) return;
    sessionExpiredRef.current = true;
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setLoading(true);
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      if (activeTab === 'users' || activeTab === 'admins') {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_USERS), { headers });
        if (res.ok) {
          const allUsers = await res.json();
          setData(prev => ({ ...prev, admins: allUsers.filter(u => u.role === 'admin'), users: allUsers.filter(u => u.role === 'customer') }));
        }
      } else if (activeTab === 'orders' || activeTab === 'invoices') {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_ORDERS), { headers });
        if (res.ok) {
          const d = await res.json();
          setData(prev => ({ ...prev, orders: d }));
        }
      } else if (activeTab === 'settings') {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.SETTINGS));
        if (res.ok) {
          const d = await res.json();
          setData(prev => ({ ...prev, settings: d }));
        }
      } else if (activeTab === 'customOrders') {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_CUSTOM_ORDERS), { headers });
        if (res.ok) {
          const d = await res.json();
          setData(prev => ({ ...prev, customOrders: d }));
        }
      } else if (activeTab === 'shipping') {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_SHIPPING), { headers });
        if (res.ok) {
          const d = await res.json();
          setData(prev => ({ ...prev, shipping: d }));
        }
      } else if (activeTab === 'banks') {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_BANKS), { headers });
        if (res.ok) {
          const d = await res.json();
          setData(prev => ({ ...prev, banks: d }));
        }
      } else if (activeTab === 'products') {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.PRODUCTS));
        if (res.ok) {
          const d = await res.json();
          setData(prev => ({ ...prev, products: d }));
        }
      } else if (activeTab === 'materials') {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.MATERIALS));
        if (res.ok) {
          const d = await res.json();
          setData(prev => ({ ...prev, materials: d }));
        }
      } else if (activeTab === 'coupons') {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_COUPONS), { headers });
        if (res.ok) {
          const d = await res.json();
          setData(prev => ({ ...prev, coupons: d }));
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const updateCustomOrderQuote = async (id, quoteValue, options = {}) => {
    const { refresh = true } = options;
    const token = localStorage.getItem('token');

    const numericQuote = Number(quoteValue);
    if (!Number.isFinite(numericQuote) || numericQuote <= 0) {
      setFeedback({ type: 'error', title: 'تسعير غير صالح', message: 'الرجاء إدخال سعر صحيح أكبر من صفر.' });
      return false;
    }

    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_CUSTOM_ORDER_QUOTE(id)), {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceQuote: numericQuote })
      });

      if (res.ok) {
        setFeedback({ type: 'success', title: 'تمت إضافة التسعير', message: 'تم حفظ سعر الطلب المخصص بنجاح.' });
        if (refresh) {
          fetchData();
        }
        return true;
      }

      const errorData = await res.json().catch(() => ({}));
      setFeedback({ type: 'error', title: 'تعذر إضافة التسعير', message: errorData.error || 'حدث خطأ أثناء حفظ التسعير.' });
      return false;
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', title: 'تعذر إضافة التسعير', message: 'حدث خطأ أثناء حفظ التسعير.' });
      return false;
    }
  };

  const handleQuoteUpdate = async (id, quoteValue) => {
    await updateCustomOrderQuote(id, quoteValue);
  };

  const openCustomOrderDetails = (customOrder) => {
    const mediaCandidates = [
      customOrder.attachmentUrl,
      ...extractUrlsFromText(customOrder.attachmentText),
      ...extractUrlsFromText(customOrder.details),
    ].filter(Boolean);

    const uniqueMedia = Array.from(new Set(mediaCandidates));
    const likelyImageMedia = uniqueMedia.filter(isLikelyImageUrl);

    setSelectedCustomOrder({
      ...customOrder,
      imageUrls: likelyImageMedia,
      mediaUrls: uniqueMedia,
    });
    setDetailsQuoteValue(customOrder.priceQuote != null ? String(customOrder.priceQuote) : '');

    setDialog({
      open: true,
      title: `تفاصيل الطلب #${customOrder.id}`,
      content: '',
      mode: 'custom-order-details',
      confirmLabel: '',
      onConfirm: null,
    });
    setPreviewImageUrl('');
    setDialogText('');
  };

  const returnCustomOrderToClient = async (id, options = {}) => {
    const { refresh = true } = options;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_CUSTOM_ORDER_RETURN_TO_CLIENT(id)), {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setFeedback({ type: 'success', title: 'تم إرجاع الطلب', message: 'تمت إعادة الطلب للعميل بنجاح.' });
        if (refresh) {
          fetchData();
        }
        return true;
      }

      const errorData = await res.json().catch(() => ({}));
      setFeedback({
        type: 'error',
        title: 'تعذر إرجاع الطلب',
        message: errorData.error || 'حدث خطأ أثناء إرجاع الطلب للعميل.'
      });
      return false;
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', title: 'تعذر إرجاع الطلب', message: 'حدث خطأ أثناء الاتصال بالخادم.' });
      return false;
    }
  };

  const handleReturnCustomOrderToClient = async (customOrder) => {
    setDialog({
      open: true,
      title: 'إرجاع الطلب للعميل',
      content: `هل تريد إعادة الطلب #${customOrder.id} للعميل؟ سيعود إلى حالة "بانتظار موافقة العميل".`,
      mode: 'confirm',
      confirmLabel: 'إرجاع',
      onConfirm: async () => {
        await returnCustomOrderToClient(customOrder.id);
      }
    });
  };

  const handleQuoteUpdateFromDetails = async () => {
    if (!selectedCustomOrder) return;

    setDetailsActionLoading(true);
    try {
      const saved = await updateCustomOrderQuote(selectedCustomOrder.id, detailsQuoteValue, { refresh: false });
      if (!saved) return;

      const numericQuote = Number(detailsQuoteValue);
      setSelectedCustomOrder((prev) => prev ? { ...prev, priceQuote: numericQuote, status: 'priced' } : prev);
      fetchData();
    } finally {
      setDetailsActionLoading(false);
    }
  };

  const handleReturnToClientFromDetails = async () => {
    if (!selectedCustomOrder || selectedCustomOrder.status !== 'accepted') return;

    const confirmed = window.confirm(`هل تريد إعادة الطلب #${selectedCustomOrder.id} للعميل؟`);
    if (!confirmed) return;

    setDetailsActionLoading(true);
    try {
      const returned = await returnCustomOrderToClient(selectedCustomOrder.id, { refresh: false });
      if (!returned) return;

      setSelectedCustomOrder((prev) => prev ? { ...prev, status: 'priced' } : prev);
      fetchData();
    } finally {
      setDetailsActionLoading(false);
    }
  };

  const previewableImageUrls = selectedCustomOrder?.imageUrls || [];
  const previewImageIndex = previewableImageUrls.indexOf(previewImageUrl);

  const showNextPreviewImage = useCallback(() => {
    if (!previewableImageUrls.length) return;
    if (previewImageIndex < 0) return;
    const nextIndex = (previewImageIndex + 1) % previewableImageUrls.length;
    setPreviewImageUrl(previewableImageUrls[nextIndex]);
  }, [previewImageIndex, previewableImageUrls]);

  const showPreviousPreviewImage = useCallback(() => {
    if (!previewableImageUrls.length) return;
    if (previewImageIndex < 0) return;
    const prevIndex = (previewImageIndex - 1 + previewableImageUrls.length) % previewableImageUrls.length;
    setPreviewImageUrl(previewableImageUrls[prevIndex]);
  }, [previewImageIndex, previewableImageUrls]);

  const handleSaveImage = useCallback(async (imageUrl) => {
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error('download_failed');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = imageUrl.split('/').pop()?.split('?')[0] || `custom-order-${Date.now()}`;

      link.href = objectUrl;
      link.download = safeName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      setFeedback({ type: 'success', title: 'تم حفظ الصورة', message: 'تم تنزيل الصورة على جهازك.' });
    } catch (error) {
      window.open(imageUrl, '_blank', 'noopener,noreferrer');
      setFeedback({ type: 'error', title: 'تنزيل مباشر غير متاح', message: 'تم فتح الصورة في تبويب جديد. استخدم حفظ الصورة من المتصفح.' });
    }
  }, []);

  const handlePreviewImageClick = useCallback((event) => {
    event.stopPropagation();
    if (previewableImageUrls.length <= 1) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const clickedX = event.clientX - bounds.left;
    const isRightSide = clickedX >= bounds.width / 2;

    if (isRightSide) {
      showNextPreviewImage();
    } else {
      showPreviousPreviewImage();
    }
  }, [previewableImageUrls.length, showNextPreviewImage, showPreviousPreviewImage]);

  useEffect(() => {
    if (!previewImageUrl) return;

    const handlePreviewKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPreviewImageUrl('');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        showNextPreviewImage();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showPreviousPreviewImage();
      }
    };

    window.addEventListener('keydown', handlePreviewKeyDown);
    return () => window.removeEventListener('keydown', handlePreviewKeyDown);
  }, [previewImageUrl, showNextPreviewImage, showPreviousPreviewImage]);

  const handleOrderStatusUpdate = async (id, status) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_ORDER_STATUS(id)), {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setFeedback({ type: 'success', title: 'تم تحديث الحالة', message: 'تم تغيير حالة الطلب بنجاح.' });
        fetchData();
      }
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', title: 'تعذر تحديث الحالة', message: 'حدث خطأ أثناء تحديث حالة الطلب.' });
    }
  };


  const handleDeleteOrder = async (id) => {
    const confirmed = window.confirm('هل أنت متأكد من حذف هذا الطلب نهائيًا؟ سيتم حذف الإيصال المرتبط به أيضًا إن وجد.');
    if (!confirmed) return;

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_ORDER_DELETE(id)), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        fetchData();
        setFeedback({ type: 'success', title: 'تم حذف الطلب', message: 'تم حذف الطلب بنجاح.' });
      } else {
        const errorData = await res.json().catch(() => ({}));
        setFeedback({ type: 'error', title: 'تعذر الحذف', message: errorData.error || 'لم يتم حذف الطلب.' });
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      setFeedback({ type: 'error', title: 'تعذر الحذف', message: 'حدث خطأ أثناء حذف الطلب.' });
    }
  };

  const handleDeleteCustomOrder = async (id) => {
    const confirmed = window.confirm('هل أنت متأكد من حذف هذا الطلب المخصص نهائيًا؟ سيتم حذف المرفق المرتبط به أيضًا إن وجد.');
    if (!confirmed) return;

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_CUSTOM_ORDER_DELETE(id)), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        fetchData();
        setFeedback({ type: 'success', title: 'تم حذف الطلب المخصص', message: 'تم حذف الطلب المخصص بنجاح.' });
      } else {
        const errorData = await res.json().catch(() => ({}));
        setFeedback({ type: 'error', title: 'تعذر الحذف', message: errorData.error || 'لم يتم حذف الطلب المخصص.' });
      }
    } catch (error) {
      console.error('Error deleting custom order:', error);
      setFeedback({ type: 'error', title: 'تعذر الحذف', message: 'حدث خطأ أثناء حذف الطلب المخصص.' });
    }
  };
  // --- Admin Management ---
  const [newAdmin, setNewAdmin] = useState({ username: '', email: '', password: '' });
  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_CREATE_ADMIN), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(newAdmin)
      });
      if (res.ok) {
        setNewAdmin({ username: '', email: '', password: '' });
        fetchData();
        setFeedback({ type: 'success', title: 'تمت إضافة المشرف', message: 'تم إنشاء حساب مشرف جديد بنجاح.' });
      } else {
        const errorData = await res.json();
        setFeedback({ type: 'error', title: 'تعذر إضافة المشرف', message: errorData.error || 'حدث خطأ أثناء إنشاء المشرف.' });
      }
    } catch (error) {
      console.error('Error creating admin:', error);
      setFeedback({ type: 'error', title: 'تعذر إضافة المشرف', message: 'حدث خطأ أثناء الاتصال بالخادم.' });
    }
  };

  const handleToggleAdminActive = async (id) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_TOGGLE_USER_ACTIVE(id)), {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchData();
    } catch (error) {
      console.error('Error toggling admin status:', error);
    }
  };

  const handleDeleteAdmin = async (admin) => {
    if (user?.id === admin.id) {
      setFeedback({ type: 'error', title: 'غير مسموح', message: 'لا يمكنك مسح حسابك الإداري الحالي.' });
      return;
    }

    setDialog({
      open: true,
      title: 'تأكيد مسح المشرف',
      content: `هل أنت متأكد من مسح المشرف ${admin.username}؟`,
      mode: 'confirm',
      confirmLabel: 'مسح',
      onConfirm: async () => {
        const token = localStorage.getItem('token');
        try {
          const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_USER_DELETE(admin.id)), {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (res.ok) {
            setFeedback({ type: 'success', title: 'تم مسح المشرف', message: 'تم حذف حساب المشرف بنجاح.' });
            fetchData();
            return;
          }

          const errorData = await res.json().catch(() => ({}));
          setFeedback({ type: 'error', title: 'تعذر مسح المشرف', message: errorData.error || 'لم يتم حذف حساب المشرف.' });
        } catch (error) {
          console.error('Error deleting admin:', error);
          setFeedback({ type: 'error', title: 'تعذر مسح المشرف', message: 'حدث خطأ أثناء الاتصال بالخادم.' });
        }
      }
    });
  };

  const handleChangeAdminPassword = async (id) => {
    setPasswordTargetId(String(id));
    setPasswordInput('');
    setDialog({
      open: true,
      title: 'تغيير كلمة المرور',
      content: 'أدخل كلمة المرور الجديدة للمستخدم ثم أكد العملية.',
      mode: 'password'
    });
  };

  const handleConfirmAdminPassword = async () => {
    const targetId = passwordTargetId;
    const token = localStorage.getItem('token');

    if (!passwordInput.trim()) {
      setFeedback({ type: 'error', title: 'كلمة المرور مطلوبة', message: 'الرجاء إدخال كلمة المرور الجديدة.' });
      return;
    }

    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_USER_PASSWORD(targetId)), {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput })
      });
      if (res.ok) {
        setFeedback({ type: 'success', title: 'تم تغيير كلمة المرور', message: 'تم تحديث كلمة المرور بنجاح.' });
      } else {
        setFeedback({ type: 'error', title: 'تعذر تغيير كلمة المرور', message: 'لم يتم حفظ كلمة المرور الجديدة.' });
      }
    } catch (error) {
      console.error('Error changing admin password:', error);
      setFeedback({ type: 'error', title: 'تعذر تغيير كلمة المرور', message: 'حدث خطأ أثناء الاتصال بالخادم.' });
    } finally {
      setDialog((prev) => ({ ...prev, open: false, onConfirm: null, confirmLabel: '' }));
    }
  };

  const handleDialogConfirm = async () => {
    const confirmAction = dialog.onConfirm;
    try {
      if (confirmAction) {
        await confirmAction();
      }
    } finally {
      setDialog((prev) => ({ ...prev, open: false, onConfirm: null, confirmLabel: '' }));
    }
  };

  // --- Settings Management ---
  const [settingsForm, setSettingsForm] = useState({
    whatsappNumber: '',
    whatsappToken: '',
    snapchatUrl: '',
    instagramUrl: ''
  });
  const [storageHealth, setStorageHealth] = useState(null);
  const [checkingStorageHealth, setCheckingStorageHealth] = useState(false);
  const [storageLastCheckedAt, setStorageLastCheckedAt] = useState(null);
  useEffect(() => {
    if (data.settings) {
      setSettingsForm({
        whatsappNumber: data.settings.whatsappNumber || '',
        whatsappToken: data.settings.whatsappToken || '',
        snapchatUrl: data.settings.snapchatUrl || '',
        instagramUrl: data.settings.instagramUrl || ''
      });
    }
  }, [data.settings]);

  const fetchStorageHealth = useCallback(async (showLoading = true) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    if (showLoading) {
      setCheckingStorageHealth(true);
    }

    const urlsToTry = [buildApiUrl(API_ENDPOINTS.ADMIN_STORAGE_HEALTH)];
    if (typeof window !== 'undefined') {
      const sameOriginUrl = new URL(API_ENDPOINTS.ADMIN_STORAGE_HEALTH, window.location.origin).toString();
      if (!urlsToTry.includes(sameOriginUrl)) {
        urlsToTry.push(sameOriginUrl);
      }
    }

    let lastError = null;

    try {
      for (const targetUrl of urlsToTry) {
        try {
          const res = await fetch(targetUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          const contentType = res.headers.get('content-type') || '';
          let result = {};

          if (contentType.includes('application/json')) {
            result = await res.json();
          } else {
            const text = await res.text();
            if (text) {
              result = { message: text };
            }
          }

          if (!res.ok) {
            const isAuthError = res.status === 401 || res.status === 403;
            const rawErrorMessage = String(result.message || result.error || '').toLowerCase();
            const tokenExpired = isAuthError && rawErrorMessage.includes('jwt expired');
            setStorageHealth({
              ok: false,
              mode: result.mode || 'api-error',
              provider: result.provider || '-',
              maxUploadSizeMb: result.maxUploadSizeMb || null,
              message: isAuthError
                ? 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.'
                : (result.message || `فشل فحص التخزين (HTTP ${res.status})`),
              error: result.error || null,
              statusCode: res.status,
              source: targetUrl
            });
            setStorageLastCheckedAt(new Date());

            if (tokenExpired) {
              await handleSessionExpired();
            }
            return;
          }

          setStorageHealth({ ...result, statusCode: res.status, source: targetUrl });
          setStorageLastCheckedAt(new Date());
          return;
        } catch (error) {
          lastError = error;
        }
      }

      setStorageHealth({
        ok: false,
        mode: 'request-failed',
        provider: 'local',
        maxUploadSizeMb: 10,
        message: 'تعذر الاتصال بخدمة فحص التخزين',
        error: lastError?.message || `تعذر الاتصال بأي مسار API متاح (${API_BASE_URL})`,
        statusCode: 0,
        source: 'none'
      });
      setStorageLastCheckedAt(new Date());
    } finally {
      if (showLoading) {
        setCheckingStorageHealth(false);
      }
    }
  }, [handleSessionExpired]);

  useEffect(() => {
    fetchStorageHealth(false);
  }, [fetchStorageHealth]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchStorageHealth(false);
    }, 60000);

    return () => clearInterval(intervalId);
  }, [fetchStorageHealth]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_SETTINGS), {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm)
      });
      if (res.ok) {
        setFeedback({ type: 'success', title: 'تم حفظ الإعدادات', message: 'تم تحديث إعدادات المتجر بنجاح.' });
        fetchData();
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setFeedback({ type: 'error', title: 'تعذر حفظ الإعدادات', message: 'حدث خطأ أثناء حفظ الإعدادات.' });
    }
  };

  const handleCheckStorageHealth = async () => {
    await fetchStorageHealth(true);
  };

  // --- Export Excel ---
  const exportUsersToExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('العملاء');

      // Define columns
      sheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'الاسم', key: 'username', width: 30 },
        { header: 'الإيميل', key: 'email', width: 30 },
        { header: 'رقم الجوال', key: 'phone', width: 20 },
        { header: 'العنوان', key: 'address', width: 40 },
        { header: 'استلام رسائل واتساب', key: 'receiveWhatsApp', width: 15 },
        { header: 'تاريخ التسجيل', key: 'createdAt', width: 20 }
      ];

      // Add rows
      data.users.forEach(u => {
        sheet.addRow({
          id: u.id,
          username: u.username,
          email: u.email,
          phone: u.phone || '',
          address: u.address || '',
          receiveWhatsApp: u.receiveWhatsApp ? 'نعم' : 'لا',
          createdAt: new Date(u.createdAt).toLocaleDateString()
        });
      });

      // Generate buffer and trigger download in browser
      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'customers.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting users to Excel:', err);
      setFeedback({ type: 'error', title: 'فشل التصدير', message: 'حدث خطأ أثناء تصدير ملف Excel.' });
    }
  };

  // --- Print Invoice ---
  const handlePrintInvoice = async (order) => {
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
          
          if (!order.invoicePrinted) {
            const token = localStorage.getItem('token');
            await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_ORDER_INVOICE_PRINTED(order.id)), {
              method: 'PUT',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchData();
          }
        } catch (err) {
          console.error("Error generating PDF:", err);
          setFeedback({ type: 'error', title: 'فشل الطباعة', message: 'حدث خطأ أثناء تجهيز الفاتورة للطباعة.' });
        }
      }
      setPrintingOrder(null);
    }, 100);
  };

  const handleDeleteUser = async (id) => {
    setDialog({
      open: true,
      title: 'تأكيد مسح العميل',
      content: 'هل أنت متأكد من مسح هذا العميل؟ سيتم مسح جميع طلباته أيضاً.',
      mode: 'confirm',
      confirmLabel: 'مسح',
      onConfirm: async () => {
        const token = localStorage.getItem('token');
        try {
          const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_USER_DELETE(id)), {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            setFeedback({ type: 'success', title: 'تم مسح العميل', message: 'تم حذف العميل وبياناته بنجاح.' });
            fetchData();
          } else {
            setFeedback({ type: 'error', title: 'تعذر مسح العميل', message: 'لم يتم حذف العميل.' });
          }
        } catch {
          setFeedback({ type: 'error', title: 'تعذر الاتصال', message: 'حدث خطأ أثناء الاتصال بالخادم.' });
        }
      }
    });
  };

  const downloadJsonFile = (payload, fileName) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const readJsonFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        resolve(parsed);
      } catch {
        reject(new Error('الملف ليس JSON صالح'));
      }
    };
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.readAsText(file);
  });

  const exportShippingToJson = () => {
    if (!data.shipping.length) {
      setFeedback({ type: 'info', title: 'لا توجد بيانات', message: 'لا توجد بيانات شحن للتصدير.' });
      return;
    }

    const payload = {
      type: 'shipping-methods',
      exportedAt: new Date().toISOString(),
      count: data.shipping.length,
      items: data.shipping.map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        estimatedDays: s.estimatedDays,
        logoUrl: s.logoUrl || null
      }))
    };

    downloadJsonFile(payload, `shipping-methods-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const exportBanksToJson = () => {
    if (!data.banks.length) {
      setFeedback({ type: 'info', title: 'لا توجد بيانات', message: 'لا توجد بيانات بنوك للتصدير.' });
      return;
    }

    const payload = {
      type: 'bank-accounts',
      exportedAt: new Date().toISOString(),
      count: data.banks.length,
      items: data.banks.map((b) => ({
        id: b.id,
        bankName: b.bankName,
        accountName: b.accountName,
        accountNumber: b.accountNumber,
        iban: b.iban,
        logoUrl: b.logoUrl || null
      }))
    };

    downloadJsonFile(payload, `bank-accounts-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const exportProductsToExcel = async () => {
    if (!data.products.length) {
      setFeedback({ type: 'info', title: 'لا توجد بيانات', message: 'لا توجد منتجات للتصدير.' });
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Products');

      sheet.columns = [
        { header: 'id', key: 'id', width: 10 },
        { header: 'nameAr', key: 'nameAr', width: 24 },
        { header: 'nameEn', key: 'nameEn', width: 24 },
        { header: 'price', key: 'price', width: 14 },
        { header: 'offerPrice', key: 'offerPrice', width: 14 },
        { header: 'offerMinQuantity', key: 'offerMinQuantity', width: 18 },
        { header: 'offerEndsAt', key: 'offerEndsAt', width: 24 },
        { header: 'category', key: 'category', width: 18 },
        { header: 'descriptionAr', key: 'descriptionAr', width: 34 },
        { header: 'descriptionEn', key: 'descriptionEn', width: 34 },
        { header: 'image', key: 'image', width: 40 }
      ];

      data.products.forEach((p) => {
        sheet.addRow({
          id: p.id,
          nameAr: p.nameAr,
          nameEn: p.nameEn,
          price: p.price,
          offerPrice: p.offerPrice ?? '',
          offerMinQuantity: p.offerMinQuantity ?? '',
          offerEndsAt: p.offerEndsAt || '',
          category: p.category,
          descriptionAr: p.descriptionAr,
          descriptionEn: p.descriptionEn,
          image: p.image || ''
        });
      });

      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setFeedback({ type: 'error', title: 'فشل التصدير', message: 'حدث خطأ أثناء تصدير ملف Excel للمنتجات.' });
    }
  };

  const importShippingFromJson = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setFeedback({ type: 'error', title: 'تسجيل الدخول مطلوب', message: 'يرجى تسجيل الدخول مرة أخرى.' });
      return;
    }

    try {
      const parsed = await readJsonFile(file);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];

      if (!items.length) {
        setFeedback({ type: 'error', title: 'ملف غير صالح', message: 'الملف لا يحتوي على بيانات شحن.' });
        return;
      }

      const existingById = new Map(data.shipping.map((s) => [Number(s.id), s]));
      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const item of items) {
        const normalized = {
          name: String(item?.name || '').trim(),
          price: Number(item?.price || 0),
          estimatedDays: String(item?.estimatedDays || '').trim(),
          logoUrl: item?.logoUrl ? String(item.logoUrl).trim() : null
        };

        if (!normalized.name || !normalized.estimatedDays || !Number.isFinite(normalized.price) || normalized.price < 0) {
          skipped += 1;
          continue;
        }

        const parsedId = Number(item?.id);
        const hasExisting = Number.isFinite(parsedId) && existingById.has(parsedId);
        const method = hasExisting ? 'PUT' : 'POST';
        const endpoint = hasExisting
          ? API_ENDPOINTS.ADMIN_SHIPPING_DETAIL(parsedId)
          : API_ENDPOINTS.ADMIN_SHIPPING;

        const res = await fetch(buildApiUrl(endpoint), {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(normalized)
        });

        if (res.ok) {
          if (hasExisting) updated += 1;
          else created += 1;
        } else {
          skipped += 1;
        }
      }

      await fetchData();
      setFeedback({ type: 'success', title: 'تم استيراد الشحن', message: `مضاف: ${created} | محدث: ${updated} | متجاوز: ${skipped}` });
    } catch (error) {
      setFeedback({ type: 'error', title: 'فشل استيراد الشحن', message: error.message || 'فشل استيراد بيانات الشحن.' });
    }
  };

  const importBanksFromJson = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setFeedback({ type: 'error', title: 'تسجيل الدخول مطلوب', message: 'يرجى تسجيل الدخول مرة أخرى.' });
      return;
    }

    try {
      const parsed = await readJsonFile(file);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];

      if (!items.length) {
        setFeedback({ type: 'error', title: 'ملف غير صالح', message: 'الملف لا يحتوي على بيانات بنوك.' });
        return;
      }

      const existingById = new Map(data.banks.map((b) => [Number(b.id), b]));
      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const item of items) {
        const normalized = {
          bankName: String(item?.bankName || '').trim(),
          accountName: String(item?.accountName || '').trim(),
          accountNumber: String(item?.accountNumber || '').trim(),
          iban: String(item?.iban || '').trim(),
          logoUrl: item?.logoUrl ? String(item.logoUrl).trim() : null
        };

        if (!normalized.bankName || !normalized.accountName || !normalized.accountNumber || !normalized.iban) {
          skipped += 1;
          continue;
        }

        const parsedId = Number(item?.id);
        const hasExisting = Number.isFinite(parsedId) && existingById.has(parsedId);
        const method = hasExisting ? 'PUT' : 'POST';
        const endpoint = hasExisting
          ? API_ENDPOINTS.ADMIN_BANKS_DETAIL(parsedId)
          : API_ENDPOINTS.ADMIN_BANKS;

        const res = await fetch(buildApiUrl(endpoint), {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(normalized)
        });

        if (res.ok) {
          if (hasExisting) updated += 1;
          else created += 1;
        } else {
          skipped += 1;
        }
      }

      await fetchData();
      setFeedback({ type: 'success', title: 'تم استيراد البنوك', message: `مضاف: ${created} | محدث: ${updated} | متجاوز: ${skipped}` });
    } catch (error) {
      setFeedback({ type: 'error', title: 'فشل استيراد البنوك', message: error.message || 'فشل استيراد بيانات البنوك.' });
    }
  };

  const importProductsFromExcel = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setFeedback({ type: 'error', title: 'تسجيل الدخول مطلوب', message: 'يرجى تسجيل الدخول مرة أخرى.' });
      return;
    }

    const importImageFilesByName = new Map();
    const importImageFilesByStem = new Map();
    const importImageFilesByCanonical = new Map();
    const uploadedImportImageCache = new Map();

    const toLookupName = (value) => String(value || '').trim().toLowerCase();
    const toFileName = (value) => String(value || '').split(/[\\/]/).pop()?.trim() || '';
    const removeFileExtension = (value) => String(value || '').replace(/\.[^.]+$/, '');
    const toCanonicalFileToken = (value) => toLookupName(removeFileExtension(value)).replace(/[\s._-]+/g, '');
    const isRemoteImageReference = (value) => /^(https?:\/\/|data:image\/)/i.test(String(value || '').trim());

    for (const imageFile of productsImportImageFiles) {
      const rawName = String(imageFile?.name || '').trim();
      const normalizedName = toLookupName(rawName);
      const normalizedStem = toLookupName(removeFileExtension(rawName));

      if (normalizedName && !importImageFilesByName.has(normalizedName)) {
        importImageFilesByName.set(normalizedName, imageFile);
      }

      if (normalizedStem && !importImageFilesByStem.has(normalizedStem)) {
        importImageFilesByStem.set(normalizedStem, imageFile);
      }

      const canonicalName = toCanonicalFileToken(rawName);
      if (canonicalName && !importImageFilesByCanonical.has(canonicalName)) {
        importImageFilesByCanonical.set(canonicalName, imageFile);
      }
    }

    const uploadImportImageFile = async (imageFile) => {
      const cacheKey = `${imageFile.name}-${imageFile.size}-${imageFile.lastModified}`;
      const cached = uploadedImportImageCache.get(cacheKey);
      if (cached) return cached;

      const uploadData = await uploadFileDirect({ token, file: imageFile, applyWatermark: productImageApplyWatermark });
      uploadedImportImageCache.set(cacheKey, uploadData.url);
      return uploadData.url;
    };

    const resolveImportedImageReferences = async (imageCellValue) => {
      const candidates = parseProductImageUrls(imageCellValue);
      const resolvedUrls = [];
      const missingReferences = [];

      for (const candidate of candidates) {
        if (isRemoteImageReference(candidate)) {
          resolvedUrls.push(candidate);
          continue;
        }

        const fileName = toFileName(candidate);
        const normalizedFileName = toLookupName(fileName);
        const normalizedStem = toLookupName(removeFileExtension(fileName));
        const canonicalToken = toCanonicalFileToken(fileName);
        const matchedFile = importImageFilesByName.get(normalizedFileName)
          || importImageFilesByStem.get(normalizedStem)
          || importImageFilesByCanonical.get(canonicalToken);

        if (!matchedFile) {
          missingReferences.push(candidate);
          continue;
        }

        const uploadedUrl = await uploadImportImageFile(matchedFile);
        resolvedUrls.push(uploadedUrl);
      }

      return {
        urls: Array.from(new Set(resolvedUrls)),
        missingReferences
      };
    };

    const normalizeProduct = (item) => {
      const nameAr = String(item?.nameAr || '').trim();
      const nameEn = String(item?.nameEn || '').trim();
      const descriptionAr = String(item?.descriptionAr || '').trim();
      const descriptionEn = String(item?.descriptionEn || '').trim();
      const category = String(item?.category || '').trim();
      const image = item?.image ? String(item.image).trim() : '';
      const price = Number(item?.price);

      if (!nameAr || !nameEn || !descriptionAr || !descriptionEn || !category) {
        return null;
      }

      const normalizedCategory = normalizeProductCategory(category);

      if (!Number.isFinite(price) || price <= 0) {
        return null;
      }

      const hasOfferPrice = item?.offerPrice !== undefined && item?.offerPrice !== null && String(item.offerPrice).trim() !== '';
      const offerPrice = hasOfferPrice ? Number(item.offerPrice) : null;

      if (hasOfferPrice && (!Number.isFinite(offerPrice) || offerPrice <= 0 || offerPrice >= price)) {
        return null;
      }

      const hasOfferMinQuantity = item?.offerMinQuantity !== undefined && item?.offerMinQuantity !== null && String(item.offerMinQuantity).trim() !== '';
      const offerMinQuantity = hasOfferMinQuantity ? Number(item.offerMinQuantity) : null;

      if (hasOfferMinQuantity && (!Number.isFinite(offerMinQuantity) || offerMinQuantity < 2)) {
        return null;
      }

      if (!hasOfferPrice && (hasOfferMinQuantity || item?.offerEndsAt)) {
        return null;
      }

      let offerEndsAt = null;
      if (item?.offerEndsAt) {
        const parsedDate = new Date(item.offerEndsAt);
        if (Number.isNaN(parsedDate.getTime())) {
          return null;
        }
        offerEndsAt = parsedDate.toISOString();
      }

      return {
        nameAr,
        nameEn,
        price,
        offerPrice,
        offerMinQuantity,
        offerEndsAt,
        category: normalizedCategory,
        descriptionAr,
        descriptionEn,
        image
      };
    };

    const toText = (value) => {
      if (value === null || value === undefined) return '';
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'object') {
        if (typeof value.text === 'string') return value.text;
        if (value.result !== undefined && value.result !== null) return String(value.result);
      }
      return String(value);
    };

    const excelSerialToIso = (serial) => {
      const normalized = Number(serial);
      if (!Number.isFinite(normalized)) return '';
      const ms = Math.round((normalized - 25569) * 86400 * 1000);
      const date = new Date(ms);
      return Number.isNaN(date.getTime()) ? '' : date.toISOString();
    };

    const toIsoDate = (value) => {
      if (!value && value !== 0) return '';
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'number') return excelSerialToIso(value);

      const asText = toText(value).trim();
      if (!asText) return '';
      const parsed = new Date(asText);
      return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
    };

    try {
      setLastMissingImageDetails([]);

      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);
      const sheet = workbook.worksheets[0];

      if (!sheet) {
        setFeedback({ type: 'error', title: 'ملف غير صالح', message: 'ملف Excel لا يحتوي على أي ورقة.' });
        return;
      }

      const headerRow = sheet.getRow(1);
      const headerMap = new Map();
      headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const key = toText(cell.value).trim().toLowerCase();
        if (key) {
          headerMap.set(key, colNumber);
        }
      });

      const getColumnIndex = (aliases) => {
        for (const alias of aliases) {
          const idx = headerMap.get(alias.toLowerCase());
          if (idx) return idx;
        }
        return null;
      };

      const columnIndexes = {
        id: getColumnIndex(['id']),
        nameAr: getColumnIndex(['namear', 'name_ar', 'الاسم (عربي)', 'الاسم العربي']),
        nameEn: getColumnIndex(['nameen', 'name_en', 'الاسم (إنجليزي)', 'الاسم الانجليزي']),
        price: getColumnIndex(['price', 'السعر']),
        offerPrice: getColumnIndex(['offerprice', 'offer_price', 'سعر العرض', 'سعر العرض (اختياري)']),
        offerMinQuantity: getColumnIndex(['offerminquantity', 'offer_min_quantity', 'الكمية لتفعيل العرض']),
        offerEndsAt: getColumnIndex(['offerendsat', 'offer_ends_at', 'وقت انتهاء العرض', 'offer ends at']),
        category: getColumnIndex(['category', 'القسم']),
        descriptionAr: getColumnIndex(['descriptionar', 'description_ar', 'الوصف (عربي)']),
        descriptionEn: getColumnIndex(['descriptionen', 'description_en', 'الوصف (إنجليزي)', 'الوصف (انجليزي)']),
        image: getColumnIndex(['image', 'الصورة'])
      };

      const items = [];
      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);

        const item = {
          __rowNumber: rowNumber,
          id: columnIndexes.id ? toText(row.getCell(columnIndexes.id).value).trim() : '',
          nameAr: columnIndexes.nameAr ? toText(row.getCell(columnIndexes.nameAr).value).trim() : '',
          nameEn: columnIndexes.nameEn ? toText(row.getCell(columnIndexes.nameEn).value).trim() : '',
          price: columnIndexes.price ? toText(row.getCell(columnIndexes.price).value).trim() : '',
          offerPrice: columnIndexes.offerPrice ? toText(row.getCell(columnIndexes.offerPrice).value).trim() : '',
          offerMinQuantity: columnIndexes.offerMinQuantity ? toText(row.getCell(columnIndexes.offerMinQuantity).value).trim() : '',
          offerEndsAt: columnIndexes.offerEndsAt ? toIsoDate(row.getCell(columnIndexes.offerEndsAt).value) : '',
          category: columnIndexes.category ? toText(row.getCell(columnIndexes.category).value).trim() : '',
          descriptionAr: columnIndexes.descriptionAr ? toText(row.getCell(columnIndexes.descriptionAr).value).trim() : '',
          descriptionEn: columnIndexes.descriptionEn ? toText(row.getCell(columnIndexes.descriptionEn).value).trim() : '',
          image: columnIndexes.image ? toText(row.getCell(columnIndexes.image).value).trim() : ''
        };

        const hasAnyValue = Object.values(item).some((value) => String(value || '').trim() !== '');
        if (hasAnyValue) {
          items.push(item);
        }
      }

      if (!items.length) {
        setFeedback({ type: 'error', title: 'ملف غير صالح', message: 'ملف Excel لا يحتوي على منتجات.' });
        return;
      }

      const existingById = new Map(data.products.map((p) => [Number(p.id), p]));
      let created = 0;
      let updated = 0;
      let skipped = 0;
      let missingImageRows = 0;
      let importedWithMissingImages = 0;
      const missingImageDetails = [];

      for (const item of items) {
        const normalized = normalizeProduct(item);
        if (!normalized) {
          skipped += 1;
          continue;
        }

        let resolvedImage;
        try {
          resolvedImage = await resolveImportedImageReferences(normalized.image);
        } catch {
          skipped += 1;
          continue;
        }

        if (resolvedImage.missingReferences.length) {
          missingImageRows += 1;
          missingImageDetails.push({
            rowNumber: item.__rowNumber,
            nameAr: normalized.nameAr,
            nameEn: normalized.nameEn,
            refs: resolvedImage.missingReferences
          });

          if (importSkipRowsWithMissingImages) {
            skipped += 1;
            continue;
          }

          importedWithMissingImages += 1;
        }

        const parsedId = Number(item?.id);
        const hasExisting = Number.isFinite(parsedId) && existingById.has(parsedId);
        const method = hasExisting ? 'PUT' : 'POST';
        const endpoint = hasExisting
          ? API_ENDPOINTS.ADMIN_PRODUCTS_DETAIL(parsedId)
          : API_ENDPOINTS.ADMIN_PRODUCTS;

        const payload = {
          ...normalized,
          image: serializeProductImageUrls(resolvedImage.urls)
        };

        const res = await fetch(buildApiUrl(endpoint), {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          if (hasExisting) updated += 1;
          else created += 1;
        } else {
          skipped += 1;
        }
      }

      await fetchData();
      if (missingImageDetails.length) {
        setLastMissingImageDetails(missingImageDetails);
        downloadMissingImagesCsv(missingImageDetails);
      } else {
        setLastMissingImageDetails([]);
      }

      const missingImageRowsText = missingImageRows ? ` | صور غير مطابقة: ${missingImageRows}` : '';
      const importedWithMissingImagesText = importedWithMissingImages ? ` | مستورد بدون بعض الصور: ${importedWithMissingImages}` : '';
      const missingImagePreview = missingImageDetails
        .slice(0, 5)
        .map((item) => `سطر ${item.rowNumber}: ${item.refs.join(', ')}`)
        .join(' | ');
      const missingImagePreviewText = missingImagePreview ? ` | التفاصيل: ${missingImagePreview}` : '';

      setFeedback({ type: 'success', title: 'تم استيراد المنتجات', message: `من Excel - مضاف: ${created} | محدث: ${updated} | متجاوز: ${skipped}${missingImageRowsText}${importedWithMissingImagesText}${missingImagePreviewText}` });

      if (productsImportImagesInputRef.current) {
        productsImportImagesInputRef.current.value = '';
      }
      setProductsImportImageFiles([]);
    } catch (error) {
      setFeedback({ type: 'error', title: 'فشل استيراد المنتجات', message: error.message || 'فشل استيراد بيانات Excel للمنتجات.' });
    }
  };

  const [newShipping, setNewShipping] = useState({ name: '', price: '', estimatedDays: '', logoUrl: '' });
  const [editingShippingId, setEditingShippingId] = useState(null);
  const [shippingLogoFile, setShippingLogoFile] = useState(null);

  const handleEditShipping = (shipping) => {
    setNewShipping({ name: shipping.name, price: shipping.price, estimatedDays: shipping.estimatedDays, logoUrl: shipping.logoUrl || '' });
    setEditingShippingId(shipping.id);
  };

  const handleCancelEditShipping = () => {
    setNewShipping({ name: '', price: '', estimatedDays: '', logoUrl: '' });
    setEditingShippingId(null);
    setShippingLogoFile(null);
  };

  const handleSaveShipping = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    
    let finalLogoUrl = newShipping.logoUrl;
    if (shippingLogoFile) {
      try {
        const uploadData = await uploadFileDirect({ token, file: shippingLogoFile });
        finalLogoUrl = uploadData.url;
      } catch {
        setFeedback({ type: 'error', title: 'فشل الرفع', message: 'حدث خطأ أثناء رفع شعار الشحن.' });
        return;
      }
    }

    try {
      const method = editingShippingId ? 'PUT' : 'POST';
      const url = editingShippingId
        ? buildApiUrl(API_ENDPOINTS.ADMIN_SHIPPING_DETAIL(editingShippingId))
        : buildApiUrl(API_ENDPOINTS.ADMIN_SHIPPING);

      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newShipping, logoUrl: finalLogoUrl })
      });
      if (res.ok) {
        handleCancelEditShipping();
        fetchData();
      }
    } catch (error) {
      console.error('Error saving shipping:', error);
      setFeedback({ type: 'error', title: 'تعذر حفظ الشحن', message: 'حدث خطأ أثناء حفظ بيانات الشحن.' });
    }
  };

  const [newMaterial, setNewMaterial] = useState({ nameAr: '', nameEn: '' });
  const [editingMaterialId, setEditingMaterialId] = useState(null);

  const handleEditMaterial = (material) => {
    setNewMaterial({ nameAr: material.nameAr, nameEn: material.nameEn });
    setEditingMaterialId(material.id);
  };

  const handleCancelEditMaterial = () => {
    setNewMaterial({ nameAr: '', nameEn: '' });
    setEditingMaterialId(null);
  };

  const handleSaveMaterial = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const method = editingMaterialId ? 'PUT' : 'POST';
      const url = editingMaterialId
        ? buildApiUrl(API_ENDPOINTS.ADMIN_MATERIALS_DETAIL(editingMaterialId))
        : buildApiUrl(API_ENDPOINTS.ADMIN_MATERIALS);

      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(newMaterial)
      });
      if (res.ok) {
        handleCancelEditMaterial();
        fetchData();
        setFeedback({ type: 'success', title: 'تم حفظ المادة', message: 'تمت إضافة/تحديث نوع المادة بنجاح.' });
      }
    } catch (error) {
      console.error('Error saving material:', error);
      setFeedback({ type: 'error', title: 'تعذر حفظ المادة', message: 'حدث خطأ أثناء حفظ نوع المادة.' });
    }
  };

  const handleDeleteMaterial = async (id) => {
    setDialog({
      open: true,
      title: 'تأكيد حذف المادة',
      content: 'هل أنت متأكد من حذف هذه المادة؟',
      mode: 'confirm',
      confirmLabel: 'حذف',
      onConfirm: async () => {
        const token = localStorage.getItem('token');
        try {
          const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_MATERIALS_DETAIL(id)), {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            fetchData();
            setFeedback({ type: 'success', title: 'تم حذف المادة', message: 'تم حذف نوع المادة بنجاح.' });
          }
        } catch (error) {
          console.error('Error deleting material:', error);
          setFeedback({ type: 'error', title: 'تعذر حذف المادة', message: 'حدث خطأ أثناء حذف المادة.' });
        }
      }
    });
  };

  const [newBank, setNewBank] = useState({ bankName: '', accountName: '', accountNumber: '', iban: '' });
  const [bankLogoFile, setBankLogoFile] = useState(null);
  const [editingBankId, setEditingBankId] = useState(null);

  const [newProduct, setNewProduct] = useState(createEmptyProductForm());
  const [productImageFiles, setProductImageFiles] = useState([]);
  const [productsImportImageFiles, setProductsImportImageFiles] = useState([]);
  const [importSkipRowsWithMissingImages, setImportSkipRowsWithMissingImages] = useState(true);
  const [lastMissingImageDetails, setLastMissingImageDetails] = useState([]);
  const [productImagePreviewUrls, setProductImagePreviewUrls] = useState([]);
  const [productImageApplyWatermark, setProductImageApplyWatermark] = useState(true);
  const [editingProductId, setEditingProductId] = useState(null);
  const [newCoupon, setNewCoupon] = useState(createEmptyCouponForm());
  const [editingCouponId, setEditingCouponId] = useState(null);

  const downloadMissingImagesCsv = useCallback((rows) => {
    if (!rows.length) return;

    const escapeCsvValue = (value) => {
      const text = String(value ?? '');
      if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const headers = ['rowNumber', 'nameAr', 'nameEn', 'missingImageRefs'];
    const csvLines = [headers.join(',')];

    for (const row of rows) {
      const lineValues = [
        row.rowNumber,
        row.nameAr,
        row.nameEn,
        row.refs.join(' | ')
      ].map(escapeCsvValue);

      csvLines.push(lineValues.join(','));
    }

    const csvContent = `\uFEFF${csvLines.join('\n')}`;
    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const csvUrl = URL.createObjectURL(csvBlob);
    const link = document.createElement('a');

    link.href = csvUrl;
    link.download = `missing-product-images-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(csvUrl);
  }, []);

  const handleDownloadLastMissingImagesReport = useCallback(() => {
    downloadMissingImagesCsv(lastMissingImageDetails);
  }, [downloadMissingImagesCsv, lastMissingImageDetails]);

  useEffect(() => {
    if (productImageFiles.length) {
      const previewObjectUrls = productImageFiles.map((file) => URL.createObjectURL(file));
      setProductImagePreviewUrls(previewObjectUrls);

      return () => {
        previewObjectUrls.forEach((previewObjectUrl) => URL.revokeObjectURL(previewObjectUrl));
      };
    }

    setProductImagePreviewUrls(parseProductImageUrls(newProduct.image));
  }, [productImageFiles, newProduct.image]);

  const handleEditProduct = (prod) => {
    const productImageUrls = parseProductImageUrls(prod.image);

    setNewProduct({
      nameAr: prod.nameAr,
      nameEn: prod.nameEn,
      price: prod.price,
      offerPrice: prod.offerPrice ?? '',
      offerMinQuantity: prod.offerMinQuantity ?? '',
      offerEndsAt: toDateTimeLocalValue(prod.offerEndsAt),
      category: prod.category,
      descriptionAr: prod.descriptionAr,
      descriptionEn: prod.descriptionEn,
      image: productImageUrls.join('\n')
    });
    setProductImageFiles([]);
    if (productImageInputRef.current) {
      productImageInputRef.current.value = '';
    }
    setEditingProductId(prod.id);
  };

  const handleCancelEditProduct = () => {
    setNewProduct(createEmptyProductForm());
    setProductImageFiles([]);
    if (productImageInputRef.current) {
      productImageInputRef.current.value = '';
    }
    setEditingProductId(null);
  };

  const handleDeleteProduct = async (id) => {
    setDialog({
      open: true,
      title: 'تأكيد حذف المنتج',
      content: 'هل أنت متأكد من حذف هذا المنتج؟',
      mode: 'confirm',
      confirmLabel: 'حذف',
      onConfirm: async () => {
        const token = localStorage.getItem('token');
        try {
          const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_PRODUCTS_DETAIL(id)), {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            fetchData();
          }
        } catch (error) {
          console.error('Error deleting product:', error);
        }
      }
    });
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    if (!newProduct.offerPrice && (newProduct.offerEndsAt || newProduct.offerMinQuantity)) {
      setFeedback({ type: 'error', title: 'بيانات العرض غير مكتملة', message: 'أدخل سعر العرض أولاً ثم أضف وقت الانتهاء أو حد الكمية إذا رغبت.' });
      return;
    }

    if (newProduct.offerPrice && Number(newProduct.offerPrice) >= Number(newProduct.price)) {
      setFeedback({ type: 'error', title: 'سعر العرض غير صحيح', message: 'سعر العرض يجب أن يكون أقل من السعر الأساسي.' });
      return;
    }

    if (newProduct.offerMinQuantity && Number(newProduct.offerMinQuantity) <= 1) {
      setFeedback({ type: 'error', title: 'حد الكمية غير صحيح', message: 'حد الكمية يجب أن يكون 2 أو أكثر.' });
      return;
    }

    const imageUrls = parseProductImageUrls(newProduct.image);

    if (productImageFiles.length) {
      try {
        const uploadedImageUrls = await Promise.all(productImageFiles.map(async (file) => {
          const uploadData = await uploadFileDirect({ token, file, applyWatermark: productImageApplyWatermark });
          return uploadData.url;
        }));

        imageUrls.push(...uploadedImageUrls);
      } catch {
        setFeedback({ type: 'error', title: 'فشل الرفع', message: 'حدث خطأ أثناء رفع صورة المنتج.' });
        return;
      }
    }

    const imageValue = serializeProductImageUrls(imageUrls);

    try {
      const method = editingProductId ? 'PUT' : 'POST';
      const url = editingProductId
        ? buildApiUrl(API_ENDPOINTS.ADMIN_PRODUCTS_DETAIL(editingProductId))
        : buildApiUrl(API_ENDPOINTS.ADMIN_PRODUCTS);

      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProduct,
          image: imageValue,
          offerPrice: newProduct.offerPrice === '' ? null : Number(newProduct.offerPrice),
          offerMinQuantity: newProduct.offerMinQuantity === '' ? null : Number(newProduct.offerMinQuantity),
          offerEndsAt: newProduct.offerEndsAt || null
        })
      });
      if (res.ok) {
        handleCancelEditProduct();
        fetchData();
      }
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleEditCoupon = (coupon) => {
    setNewCoupon({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderAmount: coupon.minOrderAmount ?? '',
      maxDiscount: coupon.maxDiscount ?? '',
      expiresAt: toCouponDateTimeLocalValue(coupon.expiresAt),
      isActive: coupon.isActive,
    });
    setEditingCouponId(coupon.id);
  };

  const handleCancelEditCoupon = () => {
    setNewCoupon(createEmptyCouponForm());
    setEditingCouponId(null);
  };

  const handleSaveCoupon = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    const normalizedCode = normalizeCouponCode(newCoupon.code);
    if (!normalizedCode) {
      setFeedback({ type: 'error', title: 'كود الكوبون مطلوب', message: 'الرجاء إدخال كود صالح.' });
      return;
    }

    if (!newCoupon.discountValue || Number(newCoupon.discountValue) <= 0) {
      setFeedback({ type: 'error', title: 'قيمة الخصم غير صالحة', message: 'أدخل قيمة خصم أكبر من صفر.' });
      return;
    }

    if (newCoupon.discountType === 'percent' && Number(newCoupon.discountValue) > 100) {
      setFeedback({ type: 'error', title: 'نسبة الخصم غير صحيحة', message: 'لا يمكن أن تتجاوز نسبة الخصم 100%.' });
      return;
    }

    try {
      const method = editingCouponId ? 'PUT' : 'POST';
      const url = editingCouponId
        ? buildApiUrl(API_ENDPOINTS.ADMIN_COUPON_DETAIL(editingCouponId))
        : buildApiUrl(API_ENDPOINTS.ADMIN_COUPONS);

      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCoupon,
          code: normalizedCode,
          discountValue: Number(newCoupon.discountValue),
          minOrderAmount: newCoupon.minOrderAmount === '' ? null : Number(newCoupon.minOrderAmount),
          maxDiscount: newCoupon.maxDiscount === '' ? null : Number(newCoupon.maxDiscount),
          expiresAt: newCoupon.expiresAt || null,
        })
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: 'error', title: 'تعذر حفظ الكوبون', message: result.error || 'فشل حفظ الكوبون.' });
        return;
      }

      handleCancelEditCoupon();
      fetchData();
      setFeedback({ type: 'success', title: 'تم حفظ الكوبون', message: 'تمت إضافة/تحديث الكوبون بنجاح.' });
    } catch (error) {
      console.error('Error saving coupon:', error);
      setFeedback({ type: 'error', title: 'تعذر حفظ الكوبون', message: 'حدث خطأ أثناء حفظ الكوبون.' });
    }
  };

  const handleDeleteCoupon = async (id) => {
    setDialog({
      open: true,
      title: 'تأكيد حذف الكوبون',
      content: 'هل أنت متأكد من حذف هذا الكوبون؟',
      mode: 'confirm',
      confirmLabel: 'حذف',
      onConfirm: async () => {
        const token = localStorage.getItem('token');
        try {
          const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_COUPON_DETAIL(id)), {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            fetchData();
            setFeedback({ type: 'success', title: 'تم حذف الكوبون', message: 'تم حذف الكوبون بنجاح.' });
          }
        } catch (error) {
          console.error('Error deleting coupon:', error);
          setFeedback({ type: 'error', title: 'تعذر حذف الكوبون', message: 'حدث خطأ أثناء حذف الكوبون.' });
        }
      }
    });
  };

  const handleEditBank = (bank) => {
    setNewBank({ bankName: bank.bankName, accountName: bank.accountName, accountNumber: bank.accountNumber, iban: bank.iban });
    setBankLogoFile(null);
    setEditingBankId(bank.id);
  };

  const handleCancelEditBank = () => {
    setNewBank({ bankName: '', accountName: '', accountNumber: '', iban: '' });
    setBankLogoFile(null);
    setEditingBankId(null);
  };

  const handleSaveBank = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    let logoUrl = null;
    if (bankLogoFile) {
      try {
        const uploadData = await uploadFileDirect({ token, file: bankLogoFile });
        logoUrl = uploadData.url;
      } catch {
        setFeedback({ type: 'error', title: 'فشل الرفع', message: 'حدث خطأ أثناء رفع شعار البنك.' });
        return;
      }
    }

    const existingBank = data.banks.find(b => b.id === editingBankId);
    const finalLogoUrl = logoUrl || (existingBank ? existingBank.logoUrl : null);

    try {
      const method = editingBankId ? 'PUT' : 'POST';
      const url = editingBankId
        ? buildApiUrl(API_ENDPOINTS.ADMIN_BANKS_DETAIL(editingBankId))
        : buildApiUrl(API_ENDPOINTS.ADMIN_BANKS);

      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newBank, logoUrl: finalLogoUrl })
      });
      if (res.ok) {
        setNewBank({ bankName: '', accountName: '', accountNumber: '', iban: '' });
        setBankLogoFile(null);
        setEditingBankId(null);
        fetchData();
        setFeedback({ type: 'success', title: 'تم حفظ البنك', message: 'تمت إضافة/تحديث بيانات البنك بنجاح.' });
      }
    } catch (error) {
      console.error('Error saving bank:', error);
      setFeedback({ type: 'error', title: 'تعذر حفظ البنك', message: 'حدث خطأ أثناء حفظ بيانات البنك.' });
    }
  };

  return (
    <div style={{ padding: '2rem', minHeight: '80vh', background: '#f8fafc' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', background: 'white', padding: '2rem', borderRadius: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0 }}>لوحة تحكم الإدارة</h2>
            <span
              title={storageHealth ? `Storage: ${storageHealth.ok ? 'OK' : 'Error'}` : 'Storage: Checking'}
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                display: 'inline-block',
                background: !storageHealth ? '#f59e0b' : (storageHealth.ok ? '#16a34a' : '#dc2626')
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => navigate('/admin/shipping-settings')} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>
              إعدادات الشحن التقديري
            </button>
            <button onClick={() => navigate('/admin/desktop-program')} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>
              برنامج الكمبيوتر
            </button>
            <button onClick={handleLogout} className="btn-solid" style={{ background: '#ef4444', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
              تسجيل الخروج
            </button>
          </div>

          <ActionBanner
            type={feedback?.type}
            title={feedback?.title}
            message={feedback?.message}
            onClose={() => setFeedback(null)}
          />
        </div>

        {storageHealth && (
          <div
            className="storage-health-card"
            style={{
              marginBottom: '16px',
              border: `1px solid ${storageHealth.ok ? '#bbf7d0' : '#fecaca'}`,
              background: storageHealth.ok ? '#f0fdf4' : '#fef2f2',
              borderRadius: '10px',
              padding: '12px 14px',
            }}
          >
            <div className="storage-health-copy" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <strong>حالة التخزين: {storageHealth.ok ? 'جاهز' : 'يوجد مشكلة'}</strong>
              <span style={{ fontSize: '0.9rem' }}>
                الوضع: {storageHealth.mode || '-'} | المزود: {storageHealth.provider || '-'} | الحد الأقصى: {storageHealth.maxUploadSizeMb ? `${storageHealth.maxUploadSizeMb}MB` : '-'}
              </span>
              <span style={{ fontSize: '0.9rem' }}>{storageHealth.message || '-'}</span>
              {storageLastCheckedAt && (
                <span style={{ fontSize: '0.85rem', color: '#374151' }}>
                  آخر فحص: {storageLastCheckedAt.toLocaleTimeString()}
                </span>
              )}
              {storageHealth.mode === 'local-fallback' && (
                <span style={{ color: '#b45309', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  تنبيه: النظام يعمل حالياً بالتخزين المحلي. فعّل متغيرات Supabase للإنتاج.
                </span>
              )}
            </div>
            <button type="button" className="btn-secondary storage-health-action" onClick={handleCheckStorageHealth} disabled={checkingStorageHealth} style={{ padding: '8px 16px' }}>
              {checkingStorageHealth ? 'جاري الفحص...' : 'تحديث الحالة'}
            </button>
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button className={activeTab === 'users' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('users')}>سجل العملاء</button>
          <button className={activeTab === 'admins' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('admins')}>إدارة المشرفين</button>
          <button className={activeTab === 'orders' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('orders')}>مراحل الطلبات</button>
          <button className={activeTab === 'invoices' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('invoices')}>الفواتير</button>
          <button className={activeTab === 'customOrders' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('customOrders')}>الطلبات المخصصة</button>
          <button className={activeTab === 'products' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('products')}>المنتجات</button>
          <button className={activeTab === 'coupons' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('coupons')}>الكوبونات</button>
          <button className={activeTab === 'materials' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('materials')}>أنواع المواد</button>
          <button className={activeTab === 'shipping' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('shipping')}>طرق الشحن</button>
          <button className={activeTab === 'banks' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('banks')}>البنوك</button>
          <button className={activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('settings')}>الإعدادات</button>
        </div>

        {loading ? <p>جاري التحميل...</p> : (
          <div>
            {activeTab === 'users' && (
              <div>
                <div style={{ marginBottom: '10px' }}>
                  <button className="btn-primary" onClick={exportUsersToExcel}>تصدير إلى Excel</button>
                </div>
                <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ddd' }}>
                      <th>ID</th><th>الاسم</th><th>الإيميل</th><th>الدور</th><th>الواتساب</th><th>تاريخ التسجيل</th><th>إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #ddd' }}>
                        <td>{u.id}</td><td>{u.username}</td><td>{u.email}</td><td>{u.role}</td>
                        <td>
                          {u.phone ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
                              <a href={`https://wa.me/${u.phone}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.9rem', color: 'var(--accent-main)', textDecoration: 'none', fontWeight: 'bold' }} title="مراسلة عبر الواتساب">
                                <span dir="ltr">{u.phone}</span>
                              </a>
                              <span style={{fontSize: '0.75rem', color: u.receiveWhatsApp ? 'green' : 'red', fontWeight: 'bold'}}>
                                {u.receiveWhatsApp ? 'موافق على الاستلام' : 'غير موافق'}
                              </span>
                            </div>
                          ) : '-'}
                        </td>
                        <td>
                          <button className="btn-danger" onClick={() => handleDeleteUser(u.id)} style={{padding: '5px 10px', fontSize: '0.8rem', borderRadius: '4px'}}>مسح</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'admins' && (
              <div>
                <form onSubmit={handleCreateAdmin} style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
                  <input type="text" placeholder="اسم المشرف" required value={newAdmin.username} onChange={e => setNewAdmin({...newAdmin, username: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="email" placeholder="البريد الإلكتروني" required value={newAdmin.email} onChange={e => setNewAdmin({...newAdmin, email: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="password" placeholder="كلمة المرور" required value={newAdmin.password} onChange={e => setNewAdmin({...newAdmin, password: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <button type="submit" className="btn-primary" style={{ padding: '8px 16px' }}>إضافة مشرف</button>
                </form>
                <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ddd' }}>
                      <th>ID</th><th>الاسم</th><th>الإيميل</th><th>الحالة</th><th>إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.admins.map(a => (
                      <tr key={a.id} style={{ borderBottom: '1px solid #ddd' }}>
                        <td>{a.id}</td><td>{a.username}</td><td>{a.email}</td>
                        <td>{a.isActive ? 'مفعل' : 'معطل'}</td>
                        <td>
                          <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.9rem', marginRight: '5px' }} onClick={() => handleToggleAdminActive(a.id)}>{a.isActive ? 'تعطيل' : 'تفعيل'}</button>
                          <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.9rem', marginRight: '5px' }} onClick={() => handleChangeAdminPassword(a.id)}>تغيير الرقم السري</button>
                          <button className="btn-solid" style={{ padding: '4px 8px', fontSize: '0.9rem', background: user?.id === a.id ? '#94a3b8' : 'red', color: 'white', border: 'none', cursor: user?.id === a.id ? 'not-allowed' : 'pointer' }} onClick={() => handleDeleteAdmin(a)} disabled={user?.id === a.id}>مسح</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'settings' && (
              <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px' }}>
                <h3>إعدادات المتجر</h3>
                <input type="text" placeholder="رقم الواتساب (مثال: 966500000000)" value={settingsForm.whatsappNumber} onChange={e => setSettingsForm({...settingsForm, whatsappNumber: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                <input type="text" placeholder="توكن الواتساب (API Token)" value={settingsForm.whatsappToken} onChange={e => setSettingsForm({...settingsForm, whatsappToken: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                <input type="text" placeholder="رابط السناب شات" value={settingsForm.snapchatUrl} onChange={e => setSettingsForm({...settingsForm, snapchatUrl: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                <input type="text" placeholder="رابط الانستغرام" value={settingsForm.instagramUrl} onChange={e => setSettingsForm({...settingsForm, instagramUrl: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ margin: 0 }}>صفحة تعديل الشحن التقديري</h4>
                  <span style={{ color: '#475569', fontSize: '0.9rem' }}>تم نقل إعدادات الشحن التقديري إلى صفحة مستقلة لتسهيل الإدارة.</span>
                  <div>
                    <button type="button" className="btn-secondary" onClick={() => navigate('/admin/shipping-settings')}>
                      فتح صفحة إعدادات الشحن التقديري
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="submit" className="btn-primary" style={{ padding: '8px 16px', width: 'fit-content' }}>حفظ الإعدادات</button>
                  <button type="button" className="btn-secondary" onClick={handleCheckStorageHealth} disabled={checkingStorageHealth} style={{ padding: '8px 16px' }}>
                    {checkingStorageHealth ? 'جاري الفحص...' : 'فحص حالة التخزين'}
                  </button>
                </div>
                {storageHealth && (
                  <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px', background: storageHealth.ok ? '#ecfdf5' : '#fef2f2', color: '#111827' }}>
                    <div><strong>الحالة:</strong> {storageHealth.ok ? 'جاهز' : 'يوجد مشكلة'}</div>
                    <div><strong>الوضع:</strong> {storageHealth.mode || '-'}</div>
                    <div><strong>المزود:</strong> {storageHealth.provider || '-'}</div>
                    <div><strong>الحاوية:</strong> {storageHealth.bucket || '-'}</div>
                    <div><strong>الحد الأقصى:</strong> {storageHealth.maxUploadSizeMb ? `${storageHealth.maxUploadSizeMb}MB` : '-'}</div>
                    <div><strong>رسالة:</strong> {storageHealth.message || '-'}</div>
                    {storageHealth.error && <div><strong>الخطأ:</strong> {storageHealth.error}</div>}
                  </div>
                )}
              </form>
            )}

            {activeTab === 'products' && (
              <div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '10px' }}>
                  <button
                    type="button"
                    onClick={exportProductsToExcel}
                    style={{ background: '#0f766e', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 14px', cursor: 'pointer', fontWeight: 700 }}
                  >
                    تصدير المنتجات (Excel)
                  </button>
                  <button
                    type="button"
                    onClick={() => productsImportInputRef.current?.click()}
                    style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 14px', cursor: 'pointer', fontWeight: 700 }}
                  >
                    استيراد المنتجات (Excel)
                  </button>
                  <button
                    type="button"
                    onClick={() => productsImportImagesInputRef.current?.click()}
                    style={{ background: '#0f766e', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 14px', cursor: 'pointer', fontWeight: 700 }}
                  >
                    اختيار صور الاستيراد
                  </button>
                  {productsImportImageFiles.length ? (
                    <button
                      type="button"
                      onClick={() => {
                        setProductsImportImageFiles([]);
                        if (productsImportImagesInputRef.current) {
                          productsImportImagesInputRef.current.value = '';
                        }
                      }}
                      style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 14px', cursor: 'pointer', fontWeight: 700 }}
                    >
                      مسح صور الاستيراد ({productsImportImageFiles.length})
                    </button>
                  ) : null}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7c2d12', fontSize: '0.88rem', fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={importSkipRowsWithMissingImages}
                      onChange={(e) => setImportSkipRowsWithMissingImages(e.target.checked)}
                    />
                    تجاوز الصف إذا صورة غير مطابقة
                  </label>
                  {lastMissingImageDetails.length ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={handleDownloadLastMissingImagesReport}
                        style={{ background: '#1e3a8a', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 14px', cursor: 'pointer', fontWeight: 700 }}
                      >
                        تنزيل آخر تقرير الصور غير المطابقة ({lastMissingImageDetails.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setLastMissingImageDetails([])}
                        style={{ background: '#475569', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 14px', cursor: 'pointer', fontWeight: 700 }}
                      >
                        مسح آخر تقرير
                      </button>
                    </div>
                  ) : null}
                  <span style={{ color: '#9a3412', fontSize: '0.9rem', fontWeight: 700 }}>خيارات إدارة المنتجات بالجملة</span>
                  <span style={{ color: '#075985', fontSize: '0.84rem', fontWeight: 700 }}>ضع في Excel اسم ملف الصورة مثل product-1.jpg ثم اختر الصور من جهازك</span>
                  <input
                    ref={productsImportInputRef}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={importProductsFromExcel}
                    style={{ display: 'none' }}
                  />
                  <input
                    ref={productsImportImagesInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setProductsImportImageFiles(Array.from(e.target.files || []))}
                    style={{ display: 'none' }}
                  />
                </div>
                <form onSubmit={handleSaveProduct} style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center', background: '#f0f4f8', padding: '15px', borderRadius: '8px' }}>
                  <input type="text" placeholder="الاسم (عربي)" required value={newProduct.nameAr} onChange={e => setNewProduct({...newProduct, nameAr: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="text" placeholder="الاسم (إنجليزي)" required value={newProduct.nameEn} onChange={e => setNewProduct({...newProduct, nameEn: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="number" placeholder="السعر" required value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100px' }} />
                  <input type="number" placeholder="سعر العرض (اختياري)" value={newProduct.offerPrice} onChange={e => setNewProduct({...newProduct, offerPrice: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '160px' }} />
                  <input type="number" min="2" placeholder="الكمية لتفعيل العرض" value={newProduct.offerMinQuantity} onChange={e => setNewProduct({...newProduct, offerMinQuantity: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '170px' }} />
                  <input type="datetime-local" value={newProduct.offerEndsAt} onChange={e => setNewProduct({...newProduct, offerEndsAt: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                    <option value="">اختر القسم</option>
                    {PRODUCT_CATEGORIES.map((category) => (
                      <option key={category.key} value={category.key}>{category.labelAr}</option>
                    ))}
                  </select>
                  <div style={{ width: '100%', color: '#92400e', fontSize: '0.9rem', fontWeight: 700 }}>
                    يمكن ربط العرض بوقت انتهاء، أو بحد كمية، أو بالاثنين معاً. إذا انتهى الوقت يختفي من قسم العروض تلقائياً.
                  </div>
                  <textarea placeholder="الوصف (عربي)" required value={newProduct.descriptionAr} onChange={e => setNewProduct({...newProduct, descriptionAr: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', minHeight: '60px' }} />
                  <textarea placeholder="الوصف (إنجليزي)" required value={newProduct.descriptionEn} onChange={e => setNewProduct({...newProduct, descriptionEn: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', minHeight: '60px' }} />
                  <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1.2fr 170px', gap: '12px', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <textarea
                        placeholder="روابط الصور (اختياري، سطر لكل صورة)"
                        value={newProduct.image}
                        onChange={e => setNewProduct({...newProduct, image: e.target.value})}
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '92px', width: '100%', resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span>أو ارفع صور متعددة:</span>
                        <input ref={productImageInputRef} type="file" accept="image/*" multiple onChange={e => setProductImageFiles(Array.from(e.target.files || []))} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>الوتر مارك:</span>
                        <button
                          type="button"
                          onClick={() => setProductImageApplyWatermark(prev => !prev)}
                          style={{ background: productImageApplyWatermark ? '#1d4ed8' : '#e2e8f0', color: productImageApplyWatermark ? '#fff' : '#334155', border: 'none', borderRadius: '6px', padding: '6px 18px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', transition: 'background 0.2s' }}
                        >
                          {productImageApplyWatermark ? '✔ مفعّل' : '✗ معطّل'}
                        </button>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>يمكنك كتابة أكثر من رابط أو اختيار أكثر من ملف، وسيتم حفظها كلها كمعرض للمنتج.</div>
                    </div>
                    <div style={{ border: '1px dashed #94a3b8', borderRadius: '8px', background: '#fff', overflow: 'hidden', minHeight: '110px', padding: '8px' }}>
                      {productImagePreviewUrls.length ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px' }}>
                          {productImagePreviewUrls.slice(0, 4).map((previewUrl, index) => (
                            <img key={`${previewUrl}-${index}`} src={previewUrl} alt={`معاينة ${index + 1}`} style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '6px' }} />
                          ))}
                          {productImagePreviewUrls.length > 4 ? (
                            <div style={{ gridColumn: '1 / -1', fontSize: '0.8rem', color: '#475569', fontWeight: 700, textAlign: 'center' }}>
                              +{productImagePreviewUrls.length - 4} صور إضافية
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div style={{ minHeight: '94px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>معاينة الصور</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ width: '100%', marginTop: '10px' }}>
                    <button type="submit" className="btn-primary" style={{ padding: '8px 16px', marginRight: '10px' }}>{editingProductId ? 'تحديث المنتج' : 'إضافة المنتج'}</button>
                    <button type="button" style={{ background: '#0f766e', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', marginRight: '10px', cursor: 'pointer', fontWeight: 700 }} onClick={exportProductsToExcel}>تصدير المنتجات (Excel)</button>
                    <button type="button" style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', marginRight: '10px', cursor: 'pointer', fontWeight: 700 }} onClick={() => productsImportInputRef.current?.click()}>استيراد المنتجات (Excel)</button>
                    <button type="button" style={{ background: '#0f766e', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', marginRight: '10px', cursor: 'pointer', fontWeight: 700 }} onClick={() => productsImportImagesInputRef.current?.click()}>اختيار صور الاستيراد</button>
                    {editingProductId && <button type="button" className="btn-secondary" style={{ padding: '8px 16px' }} onClick={handleCancelEditProduct}>إلغاء</button>}
                  </div>
                </form>
                <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '2px solid #ddd' }}><th>الصورة</th><th>الاسم (ع)</th><th>السعر</th><th>العرض</th><th>القسم</th><th>إجراء</th></tr></thead>
                  <tbody>
                    {data.products.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #ddd' }}>
                        <td>{getProductPrimaryImage(p.image) ? <img src={getProductPrimaryImage(p.image)} alt={p.nameAr} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} /> : '-'}</td>
                        <td>{p.nameAr}</td>
                        <td>{p.price}</td>
                        <td>
                          {p.offerPrice ? (
                            <span style={{ color: isOfferActive(p) ? '#166534' : '#b45309', fontWeight: 700 }}>
                              {isOfferActive(p) ? `نشط: ${p.offerPrice} ر.س` : `منتهٍ: ${p.offerPrice} ر.س`}
                              {p.offerMinQuantity ? <><br /><span style={{ color: '#92400e', fontWeight: 700 }}>من {p.offerMinQuantity} قطع</span></> : null}
                              {p.offerEndsAt ? <><br /><span style={{ color: '#64748b', fontWeight: 400 }}>{formatOfferEndsAt(p.offerEndsAt, 'ar-SA')}</span></> : null}
                            </span>
                          ) : '-'}
                        </td>
                        <td>{getProductCategoryLabel(p.category, true)}</td>
                        <td>
                          <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.9rem', marginRight: '5px' }} onClick={() => handleEditProduct(p)}>تعديل</button>
                          <button className="btn-solid" style={{ padding: '4px 8px', fontSize: '0.9rem', background: 'red', color: 'white', border: 'none' }} onClick={() => handleDeleteProduct(p.id)}>حذف</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'coupons' && (
              <div>
                <form onSubmit={handleSaveCoupon} style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center', background: '#f0f4f8', padding: '15px', borderRadius: '8px' }}>
                  <input type="text" placeholder="كود الكوبون" required value={newCoupon.code} onChange={e => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <select value={newCoupon.discountType} onChange={e => setNewCoupon({ ...newCoupon, discountType: e.target.value })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                    <option value="percent">نسبة مئوية %</option>
                    <option value="fixed">خصم ثابت (ر.س)</option>
                  </select>
                  <input type="number" placeholder="قيمة الخصم" required value={newCoupon.discountValue} onChange={e => setNewCoupon({ ...newCoupon, discountValue: e.target.value })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '130px' }} />
                  <input type="number" placeholder="حد أدنى للسلة (اختياري)" value={newCoupon.minOrderAmount} onChange={e => setNewCoupon({ ...newCoupon, minOrderAmount: e.target.value })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '190px' }} />
                  <input type="number" placeholder="أقصى خصم (اختياري)" value={newCoupon.maxDiscount} onChange={e => setNewCoupon({ ...newCoupon, maxDiscount: e.target.value })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '170px' }} />
                  <input type="datetime-local" value={newCoupon.expiresAt} onChange={e => setNewCoupon({ ...newCoupon, expiresAt: e.target.value })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="checkbox" checked={newCoupon.isActive} onChange={e => setNewCoupon({ ...newCoupon, isActive: e.target.checked })} />
                    مفعل
                  </label>
                  <div style={{ width: '100%', marginTop: '10px' }}>
                    <button type="submit" className="btn-primary" style={{ padding: '8px 16px', marginRight: '10px' }}>{editingCouponId ? 'تحديث الكوبون' : 'إضافة الكوبون'}</button>
                    {editingCouponId && <button type="button" className="btn-secondary" style={{ padding: '8px 16px' }} onClick={handleCancelEditCoupon}>إلغاء</button>}
                  </div>
                </form>

                <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ddd' }}>
                      <th>الكود</th><th>النوع</th><th>القيمة</th><th>الحد الأدنى</th><th>الحد الأقصى</th><th>الانتهاء</th><th>الحالة</th><th>إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.coupons.map(coupon => (
                      <tr key={coupon.id} style={{ borderBottom: '1px solid #ddd' }}>
                        <td>{coupon.code}</td>
                        <td>{coupon.discountType === 'percent' ? 'نسبة %' : 'ثابت'}</td>
                        <td>{coupon.discountValue}</td>
                        <td>{coupon.minOrderAmount ?? '-'}</td>
                        <td>{coupon.maxDiscount ?? '-'}</td>
                        <td>{coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleString('ar-SA') : '-'}</td>
                        <td style={{ color: coupon.isActive ? '#166534' : '#b91c1c', fontWeight: 700 }}>{coupon.isActive ? 'مفعل' : 'معطل'}</td>
                        <td>
                          <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.9rem', marginRight: '5px' }} onClick={() => handleEditCoupon(coupon)}>تعديل</button>
                          <button className="btn-solid" style={{ padding: '4px 8px', fontSize: '0.9rem', background: 'red', color: 'white', border: 'none' }} onClick={() => handleDeleteCoupon(coupon.id)}>حذف</button>
                        </td>
                      </tr>
                    ))}
                    {data.coupons.length === 0 && (
                      <tr><td colSpan="8" style={{ padding: '12px', textAlign: 'center' }}>لا توجد كوبونات حالياً.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'orders' && (
              <div>
                {['pending', 'execution', 'ready', 'shipped', 'delivered'].map(phase => (
                  <div key={phase} style={{ marginBottom: '30px' }}>
                    <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
                      {phase === 'pending' && 'مرحلة توثيق التحويل'}
                      {phase === 'execution' && 'مرحلة التنفيذ'}
                      {phase === 'ready' && 'مرحلة جاهز للشحن أو الاستلام'}
                      {phase === 'shipped' && 'مرحلة الشحن'}
                      {phase === 'delivered' && 'مرحلة تم التسليم'}
                    </h3>
                    <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', marginTop: '10px' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #ddd', background: '#f9f9f9' }}>
                          <th>ID</th><th>العميل</th><th>المبلغ</th><th>الخصم</th><th>الإيصال</th><th>التاريخ</th><th>إجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.orders.filter(o => o.status === phase).map(o => (
                          <tr key={o.id} style={{ borderBottom: '1px solid #ddd' }}>
                            <td>{o.id}</td><td>{o.user?.username}</td><td>{o.totalAmount}</td>
                            <td>
                              {o.couponCode ? (
                                <span style={{ color: '#166534', fontWeight: 700 }}>
                                  {o.couponCode}
                                  <br />
                                  <span style={{ color: '#334155', fontWeight: 500 }}>-{Number(o.discountAmount || 0).toFixed(2)} ر.س</span>
                                </span>
                              ) : '-'}
                            </td>
                            <td>
                              {o.receiptUrl && <a href={o.receiptUrl} target="_blank" rel="noreferrer" style={{marginRight: '5px'}}>صورة</a>}
                              {o.receiptText && <button className="btn-secondary" style={{padding: '2px 5px', fontSize: '0.8rem', marginRight: '5px'}} onClick={() => { setDialog({ open: true, title: `نص الإيصال #${o.id}`, content: o.receiptText, mode: 'text' }); setDialogText(o.receiptText); }}>نص</button>}
                              {(o.shippingProvider === 'aramex' || o.shippingProvider === 'smsa') && o.receiverName && (
                                <button
                                  className="btn-secondary"
                                  style={{padding: '2px 5px', fontSize: '0.8rem', marginRight: '5px'}}
                                  onClick={() => {
                                    const providerLabel = o.shippingProvider === 'smsa' ? 'سمسا' : 'أرامكس';
                                    const details = [
                                      `شركة الشحن: ${providerLabel}`,
                                      `الاسم المستلم: ${o.receiverName || '-'}`,
                                      `الجوال: ${o.receiverPhone || '-'}`,
                                      `المدينة: ${o.receiverCity || '-'}`,
                                      `الحي: ${o.receiverDistrict || '-'}`,
                                      `الشارع: ${o.receiverStreet || '-'}`,
                                      `معلم قريب: ${o.receiverNearbyLandmark || '-'}`
                                    ].join('\n');
                                    setDialog({ open: true, title: `بيانات المستلم #${o.id}`, content: details, mode: 'text' });
                                    setDialogText(details);
                                  }}
                                >
                                  بيانات المستلم
                                </button>
                              )}
                              {!o.receiptUrl && !o.receiptText && !(o.shippingProvider === 'aramex' || o.shippingProvider === 'smsa') && '-'}
                            </td>
                            <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                {phase === 'pending' && (
                                  <>
                                    <button className="btn-primary" style={{ padding: '5px 10px', background: 'green', border: 'none' }} onClick={() => handleOrderStatusUpdate(o.id, 'execution')}>اعتماد وتوثيق</button>
                                    <button className="btn-solid" style={{ padding: '5px 10px', background: 'red', border: 'none', color: 'white' }} onClick={() => handleOrderStatusUpdate(o.id, 'rejected')}>رفض</button>
                                  </>
                                )}
                                {phase === 'execution' && (
                                  <button className="btn-primary" style={{ padding: '5px 10px' }} onClick={() => handleOrderStatusUpdate(o.id, 'ready')}>تأكيد الانتهاء</button>
                                )}
                                {phase === 'ready' && (
                                  <button className="btn-primary" style={{ padding: '5px 10px' }} onClick={() => handleOrderStatusUpdate(o.id, 'delivered')}>تم التسليم</button>
                                )}
                                <button type="button" className="btn-secondary" style={{ padding: '5px 10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c' }} onClick={() => handleDeleteOrder(o.id)}>حذف</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'invoices' && (
              <div>
                <h3>الفواتير غير المطبوعة</h3>
                <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', marginBottom: '30px' }}>
                  <thead><tr style={{ borderBottom: '2px solid #ddd' }}><th>رقم الفاتورة</th><th>رقم الطلب</th><th>العميل</th><th>المبلغ</th><th>إجراء</th></tr></thead>
                  <tbody>
                    {data.orders.filter(o => o.invoiceNumber && !o.invoicePrinted).map(o => (
                      <tr key={o.id} style={{ borderBottom: '1px solid #ddd' }}>
                        <td>{o.invoiceNumber}</td><td>{o.id}</td><td>{o.user?.username}</td><td>{o.totalAmount}</td>
                        <td><button className="btn-primary" onClick={() => handlePrintInvoice(o)}>طباعة</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h3>الفواتير المطبوعة</h3>
                <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '2px solid #ddd' }}><th>رقم الفاتورة</th><th>رقم الطلب</th><th>العميل</th><th>المبلغ</th><th>إجراء</th></tr></thead>
                  <tbody>
                    {data.orders.filter(o => o.invoiceNumber && o.invoicePrinted).map(o => (
                      <tr key={o.id} style={{ borderBottom: '1px solid #ddd' }}>
                        <td>{o.invoiceNumber}</td><td>{o.id}</td><td>{o.user?.username}</td><td>{o.totalAmount}</td>
                        <td><button className="btn-secondary" onClick={() => handlePrintInvoice(o)}>إعادة طباعة</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'customOrders' && (
              <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd' }}>
                    <th>ID</th><th>العميل</th><th>المادة</th><th>الملف/النص</th><th>الحالة</th><th>التسعير</th><th>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {data.customOrders.map(co => (
                    <tr key={co.id} style={{ borderBottom: '1px solid #ddd' }}>
                      <td>{co.id}</td><td>{co.user?.username}</td><td>{co.material}</td>
                      <td>
                        {co.attachmentUrl && <a href={co.attachmentUrl} target="_blank" rel="noreferrer" style={{marginRight: '5px'}}>ملف</a>}
                        {co.attachmentText && <button className="btn-secondary" style={{padding: '2px 5px', fontSize: '0.8rem', marginRight: '5px'}} onClick={() => { setDialog({ open: true, title: `نص الطلب #${co.id}`, content: co.attachmentText, mode: 'text' }); setDialogText(co.attachmentText); }}>نص</button>}
                        {!co.attachmentUrl && !co.attachmentText && '-'}
                      </td>
                      <td>{co.status}</td>
                      <td>{co.priceQuote || 'بانتظار التسعير'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          <button className="btn-secondary" style={{ padding: '5px 10px' }} onClick={() => openCustomOrderDetails(co)}>تفاصيل</button>
                          {!co.priceQuote && (
                            <input id={`quote-${co.id}`} type="number" placeholder="السعر" style={{ width: '80px', padding: '5px' }} />
                          )}
                          {!co.priceQuote && (
                            <button className="btn-primary" style={{ padding: '5px 10px' }} onClick={() => handleQuoteUpdate(co.id, document.getElementById(`quote-${co.id}`).value)}>تسعير</button>
                          )}
                          {co.status === 'accepted' && (
                            <button
                              className="btn-solid"
                              style={{ padding: '5px 10px', background: '#b91c1c', border: 'none', color: 'white' }}
                              onClick={() => handleReturnCustomOrderToClient(co)}
                            >
                              إرجاع للعميل
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '5px 10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c' }}
                            onClick={() => handleDeleteCustomOrder(co.id)}
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'shipping' && (
              <div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-secondary" onClick={exportShippingToJson}>تصدير الشحن (JSON)</button>
                  <button type="button" className="btn-secondary" onClick={() => shippingImportInputRef.current?.click()}>استيراد الشحن (JSON)</button>
                  <input
                    ref={shippingImportInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={importShippingFromJson}
                    style={{ display: 'none' }}
                  />
                </div>
                <form onSubmit={handleSaveShipping} style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
                  <input type="text" placeholder="اسم الشركة" required value={newShipping.name} onChange={e => setNewShipping({...newShipping, name: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="number" placeholder="السعر" required value={newShipping.price} onChange={e => setNewShipping({...newShipping, price: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="text" placeholder="المدة المتوقعة" required value={newShipping.estimatedDays} onChange={e => setNewShipping({...newShipping, estimatedDays: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="file" accept="image/*" onChange={e => setShippingLogoFile(e.target.files[0])} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} title="شعار الشحن (اختياري)" />
                  <button type="submit" className="btn-primary" style={{ padding: '8px 16px' }}>{editingShippingId ? 'تحديث الشحن' : 'إضافة'}</button>
                  <button type="button" className="btn-secondary" style={{ padding: '8px 16px' }} onClick={exportShippingToJson}>تصدير JSON</button>
                  <button type="button" className="btn-secondary" style={{ padding: '8px 16px' }} onClick={() => shippingImportInputRef.current?.click()}>استيراد JSON</button>
                  {editingShippingId && <button type="button" className="btn-secondary" style={{ padding: '8px 16px' }} onClick={handleCancelEditShipping}>إلغاء</button>}
                </form>
                <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '2px solid #ddd' }}><th>ID</th><th>الشعار</th><th>الشركة</th><th>السعر</th><th>المدة المتوقعة</th><th>إجراء</th></tr></thead>
                  <tbody>
                    {data.shipping.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #ddd' }}>
                        <td>{s.id}</td>
                        <td>{s.logoUrl ? <img src={s.logoUrl} alt={s.name} style={{ width: '40px', height: '40px', objectFit: 'contain' }} /> : '-'}</td>
                        <td>{s.name}</td><td>{s.price} ر.س</td><td>{s.estimatedDays}</td>
                        <td><button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.9rem' }} onClick={() => handleEditShipping(s)}>تعديل</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'materials' && (
              <div>
                <form onSubmit={handleSaveMaterial} style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
                  <input type="text" placeholder="الاسم (عربي)" required value={newMaterial.nameAr} onChange={e => setNewMaterial({...newMaterial, nameAr: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="text" placeholder="الاسم (إنجليزي)" required value={newMaterial.nameEn} onChange={e => setNewMaterial({...newMaterial, nameEn: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <button type="submit" className="btn-primary" style={{ padding: '8px 16px' }}>{editingMaterialId ? 'تحديث المادة' : 'إضافة'}</button>
                  {editingMaterialId && <button type="button" className="btn-secondary" style={{ padding: '8px 16px' }} onClick={handleCancelEditMaterial}>إلغاء</button>}
                </form>
                <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '2px solid #ddd' }}><th>ID</th><th>الاسم (عربي)</th><th>الاسم (إنجليزي)</th><th>إجراء</th></tr></thead>
                  <tbody>
                    {data.materials.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid #ddd' }}>
                        <td>{m.id}</td><td>{m.nameAr}</td><td>{m.nameEn}</td>
                        <td>
                          <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.9rem', marginRight: '5px' }} onClick={() => handleEditMaterial(m)}>تعديل</button>
                          <button className="btn-solid" style={{ padding: '4px 8px', fontSize: '0.9rem', background: 'red', color: 'white', border: 'none' }} onClick={() => handleDeleteMaterial(m.id)}>حذف</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'banks' && (
              <div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-secondary" onClick={exportBanksToJson}>تصدير البنوك (JSON)</button>
                  <button type="button" className="btn-secondary" onClick={() => banksImportInputRef.current?.click()}>استيراد البنوك (JSON)</button>
                  <input
                    ref={banksImportInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={importBanksFromJson}
                    style={{ display: 'none' }}
                  />
                </div>
                <form onSubmit={handleSaveBank} style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input type="text" placeholder="اسم البنك" required value={newBank.bankName} onChange={e => setNewBank({...newBank, bankName: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="text" placeholder="اسم الحساب" required value={newBank.accountName} onChange={e => setNewBank({...newBank, accountName: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="text" placeholder="رقم الحساب" required value={newBank.accountNumber} onChange={e => setNewBank({...newBank, accountNumber: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="text" placeholder="الآيبان IBAN" required value={newBank.iban} onChange={e => setNewBank({...newBank, iban: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '250px' }} />
                  <input type="file" accept="image/*" onChange={e => setBankLogoFile(e.target.files[0])} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} title="شعار البنك (اختياري لتغييره)" />
                  <button type="submit" className="btn-primary" style={{ padding: '8px 16px' }}>{editingBankId ? 'تحديث البنك' : 'إضافة'}</button>
                  <button type="button" className="btn-secondary" style={{ padding: '8px 16px' }} onClick={exportBanksToJson}>تصدير JSON</button>
                  <button type="button" className="btn-secondary" style={{ padding: '8px 16px' }} onClick={() => banksImportInputRef.current?.click()}>استيراد JSON</button>
                  {editingBankId && <button type="button" className="btn-secondary" style={{ padding: '8px 16px' }} onClick={handleCancelEditBank}>إلغاء</button>}
                </form>
                <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '2px solid #ddd' }}><th>ID</th><th>الشعار</th><th>البنك</th><th>اسم الحساب</th><th>رقم الحساب</th><th>الآيبان</th><th>إجراء</th></tr></thead>
                  <tbody>
                    {data.banks.map(b => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #ddd' }}>
                        <td>{b.id}</td>
                        <td>{b.logoUrl ? <img src={b.logoUrl} alt={b.bankName} style={{ width: '50px', height: '50px', objectFit: 'contain' }} /> : '-'}</td>
                        <td>{b.bankName}</td>
                        <td>{b.accountName}</td>
                        <td>{b.accountNumber}</td>
                        <td style={{ direction: 'ltr', textAlign: 'right' }}>{b.iban}</td>
                        <td>
                          <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.9rem' }} onClick={() => handleEditBank(b)}>تعديل</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        open={dialog.open}
        title={dialog.title}
        onClose={() => {
          setDialog((prev) => ({ ...prev, open: false, onConfirm: null, confirmLabel: '' }));
          setSelectedCustomOrder(null);
          setPreviewImageUrl('');
        }}
        actions={dialog.mode === 'password' ? [
          <button key="cancel" type="button" className="btn-secondary" onClick={() => { setDialog((prev) => ({ ...prev, open: false, onConfirm: null, confirmLabel: '' })); setSelectedCustomOrder(null); setPreviewImageUrl(''); }}>إلغاء</button>,
          <button key="confirm" type="button" className="btn-primary" onClick={handleConfirmAdminPassword}>حفظ كلمة المرور</button>
        ] : dialog.mode === 'confirm' ? [
          <button key="cancel" type="button" className="btn-secondary" onClick={() => { setDialog((prev) => ({ ...prev, open: false, onConfirm: null, confirmLabel: '' })); setSelectedCustomOrder(null); setPreviewImageUrl(''); }}>إلغاء</button>,
          <button key="confirm" type="button" className="btn-primary" onClick={handleDialogConfirm}>{dialog.confirmLabel || 'تأكيد'}</button>
        ] : [
          <button key="close" type="button" className="btn-primary" onClick={() => { setDialog((prev) => ({ ...prev, open: false, onConfirm: null, confirmLabel: '' })); setSelectedCustomOrder(null); setPreviewImageUrl(''); }}>إغلاق</button>
        ]}
      >
        {dialog.mode === 'password' ? (
          <input
            type="password"
            value={passwordInput}
            onChange={(event) => setPasswordInput(event.target.value)}
            placeholder="أدخل كلمة المرور الجديدة"
            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
          />
        ) : dialog.mode === 'custom-order-details' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
              <div><strong>رقم الطلب:</strong> #{selectedCustomOrder?.id || '-'}</div>
              <div><strong>العميل:</strong> {selectedCustomOrder?.user?.username || '-'}</div>
              <div><strong>البريد الإلكتروني:</strong> {selectedCustomOrder?.user?.email || '-'}</div>
              <div><strong>رقم الجوال:</strong> {selectedCustomOrder?.user?.phone || '-'}</div>
              <div><strong>العنوان:</strong> {selectedCustomOrder?.user?.address || '-'}</div>
              <div><strong>المادة:</strong> {selectedCustomOrder?.material || '-'}</div>
              <div><strong>الحالة:</strong> {selectedCustomOrder?.status || '-'}</div>
              <div><strong>السعر:</strong> {selectedCustomOrder?.priceQuote != null ? `${selectedCustomOrder.priceQuote} ر.س` : 'بانتظار التسعير'}</div>
              <div><strong>تاريخ الإنشاء:</strong> {selectedCustomOrder?.createdAt ? new Date(selectedCustomOrder.createdAt).toLocaleString() : '-'}</div>
            </div>

            <div>
              <strong>تفاصيل الطلب:</strong>
              <p style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{selectedCustomOrder?.details || '-'}</p>
            </div>

            <div>
              <strong>النص المرفق من العميل:</strong>
              <p style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{selectedCustomOrder?.attachmentText || '-'}</p>
            </div>

            <div>
              <strong>الصور والمرفقات:</strong>
              {(selectedCustomOrder?.mediaUrls?.length || 0) > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginTop: '8px' }}>
                  {selectedCustomOrder.mediaUrls.map((mediaUrl, index) => (
                    <div key={`${mediaUrl}-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <a href={mediaUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', fontSize: '0.85rem' }}>فتح المرفق {index + 1}</a>
                        <button
                          type="button"
                          onClick={() => handleSaveImage(mediaUrl)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#0f766e',
                            fontSize: '0.85rem',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            padding: 0
                          }}
                        >
                          حفظ الصورة
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewImageUrl(mediaUrl)}
                        style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'zoom-in' }}
                        title="تكبير الصورة"
                      >
                        <img
                          src={mediaUrl}
                          alt={`مرفق الطلب ${index + 1}`}
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                          style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #dbe2ea', cursor: 'zoom-in' }}
                        />
                      </button>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setPreviewImageUrl(mediaUrl)}
                          style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                        >
                          تكبير
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => handleSaveImage(mediaUrl)}
                          style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                        >
                          حفظ الصورة
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: '6px 0 0' }}>لا توجد صور مرفقة.</p>
              )}
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <strong>إجراءات من نفس الصفحة:</strong>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="السعر"
                  value={detailsQuoteValue}
                  onChange={(event) => setDetailsQuoteValue(event.target.value)}
                  style={{ width: '130px', padding: '7px 8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleQuoteUpdateFromDetails}
                  disabled={detailsActionLoading}
                  style={{ padding: '7px 10px' }}
                >
                  {detailsActionLoading ? 'جاري...' : 'حفظ التسعير'}
                </button>
                {selectedCustomOrder?.status === 'accepted' && (
                  <button
                    type="button"
                    className="btn-solid"
                    onClick={handleReturnToClientFromDetails}
                    disabled={detailsActionLoading}
                    style={{ padding: '7px 10px', background: '#b91c1c', border: 'none', color: 'white' }}
                  >
                    إرجاع للعميل
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{dialogText || dialog.content}</p>
        )}
      </Modal>

      {previewImageUrl && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.85)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 9999,
            padding: '24px'
          }}
          onClick={() => setPreviewImageUrl('')}
        >
          <img
            src={previewImageUrl}
            alt="معاينة مكبرة"
            style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 18px 60px rgba(0,0,0,0.45)' }}
            onClick={handlePreviewImageClick}
          />
          {previewableImageUrls.length > 1 && (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={(event) => { event.stopPropagation(); showPreviousPreviewImage(); }}
                style={{ position: 'fixed', top: '50%', left: '20px', transform: 'translateY(-50%)' }}
              >
                السابق
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={(event) => { event.stopPropagation(); showNextPreviewImage(); }}
                style={{ position: 'fixed', top: '50%', right: '20px', transform: 'translateY(-50%)' }}
              >
                التالي
              </button>
              <div
                style={{
                  position: 'fixed',
                  bottom: '24px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color: 'white',
                  background: 'rgba(15, 23, 42, 0.55)',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  fontSize: '0.9rem'
                }}
              >
                {previewImageIndex + 1} / {previewableImageUrls.length}
              </div>
            </>
          )}
          <div style={{ position: 'fixed', top: '20px', right: '20px', display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={(event) => { event.stopPropagation(); handleSaveImage(previewImageUrl); }}
            >
              حفظ الصورة
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPreviewImageUrl('')}
            >
              إغلاق
            </button>
          </div>
        </div>,
        document.body
      )}

      {printingOrder && <InvoiceTemplate order={printingOrder} ref={invoiceRef} />}
    </div>
  );
};

export default AdminDashboard;
