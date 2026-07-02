import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { buildApiUrl, API_ENDPOINTS, API_BASE_URL } from '../config/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import InvoiceTemplate from '../components/InvoiceTemplate';
import { uploadFileDirect } from '../utils/directUpload';

const AdminDashboard = () => {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('orders'); // users, orders, customOrders, shipping, banks, products, materials, admins, settings, invoices
  const [data, setData] = useState({ users: [], orders: [], customOrders: [], shipping: [], banks: [], products: [], materials: [], admins: [], settings: {} });
  const [loading, setLoading] = useState(true);
  const [printingOrder, setPrintingOrder] = useState(null);
  const invoiceRef = useRef(null);
  const shippingImportInputRef = useRef(null);
  const banksImportInputRef = useRef(null);
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

  const handleQuoteUpdate = async (id, quoteValue) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_CUSTOM_ORDER_QUOTE(id)), {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceQuote: quoteValue })
      });
      if (res.ok) {
        alert('تم إضافة التسعير بنجاح');
        fetchData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleOrderStatusUpdate = async (id, status) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_ORDER_STATUS(id)), {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        alert('تم تحديث حالة الطلب بنجاح');
        fetchData();
      }
    } catch (error) {
      console.error(error);
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
        alert('تم إضافة المشرف بنجاح');
      } else {
        const errorData = await res.json();
        alert(errorData.error);
      }
    } catch (error) {
      console.error('Error creating admin:', error);
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

  const handleChangeAdminPassword = async (id) => {
    const newPassword = prompt('أدخل كلمة المرور الجديدة:');
    if (!newPassword) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_USER_PASSWORD(id)), {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });
      if (res.ok) alert('تم تغيير كلمة المرور');
    } catch (error) {
      console.error('Error changing admin password:', error);
    }
  };

  // --- Settings Management ---
  const [settingsForm, setSettingsForm] = useState({ whatsappNumber: '', whatsappToken: '', snapchatUrl: '', instagramUrl: '' });
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
        alert('تم حفظ الإعدادات بنجاح');
        fetchData();
      }
    } catch (error) {
      console.error('Error saving settings:', error);
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
      alert('حدث خطأ أثناء تصدير الملف');
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
          alert('حدث خطأ أثناء طباعة الفاتورة');
        }
      }
      setPrintingOrder(null);
    }, 100);
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('هل أنت متأكد من مسح هذا العميل؟ سيتم مسح جميع طلباته أيضاً.')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_USER_DELETE(id)), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert('تم مسح العميل بنجاح');
        fetchData();
      } else {
        alert('فشل مسح العميل');
      }
    } catch {
      alert('حدث خطأ أثناء الاتصال');
    }
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
      } catch (error) {
        reject(new Error('الملف ليس JSON صالح'));
      }
    };
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.readAsText(file);
  });

  const exportShippingToJson = () => {
    if (!data.shipping.length) {
      alert('لا توجد بيانات شحن للتصدير');
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
      alert('لا توجد بيانات بنوك للتصدير');
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

  const importShippingFromJson = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const token = localStorage.getItem('token');
    if (!token) {
      alert('يرجى تسجيل الدخول مرة أخرى');
      return;
    }

    try {
      const parsed = await readJsonFile(file);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];

      if (!items.length) {
        alert('الملف لا يحتوي على بيانات شحن');
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
      alert(`تم استيراد بيانات الشحن بنجاح\nمضاف: ${created}\nمحدث: ${updated}\nمتجاوز: ${skipped}`);
    } catch (error) {
      alert(error.message || 'فشل استيراد بيانات الشحن');
    }
  };

  const importBanksFromJson = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const token = localStorage.getItem('token');
    if (!token) {
      alert('يرجى تسجيل الدخول مرة أخرى');
      return;
    }

    try {
      const parsed = await readJsonFile(file);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];

      if (!items.length) {
        alert('الملف لا يحتوي على بيانات بنوك');
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
      alert(`تم استيراد بيانات البنوك بنجاح\nمضاف: ${created}\nمحدث: ${updated}\nمتجاوز: ${skipped}`);
    } catch (error) {
      alert(error.message || 'فشل استيراد بيانات البنوك');
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
        alert('حدث خطأ أثناء الرفع');
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
      }
    } catch (error) {
      console.error('Error saving material:', error);
    }
  };

  const handleDeleteMaterial = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المادة؟')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_MATERIALS_DETAIL(id)), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting material:', error);
    }
  };

  const [newBank, setNewBank] = useState({ bankName: '', accountName: '', accountNumber: '', iban: '' });
  const [bankLogoFile, setBankLogoFile] = useState(null);
  const [editingBankId, setEditingBankId] = useState(null);

  const [newProduct, setNewProduct] = useState({ nameAr: '', nameEn: '', price: '', category: 'wood', descriptionAr: '', descriptionEn: '', image: '' });
  const [productImageFile, setProductImageFile] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);

  const handleEditProduct = (prod) => {
    setNewProduct({ nameAr: prod.nameAr, nameEn: prod.nameEn, price: prod.price, category: prod.category, descriptionAr: prod.descriptionAr, descriptionEn: prod.descriptionEn, image: prod.image || '' });
    setProductImageFile(null);
    setEditingProductId(prod.id);
  };

  const handleCancelEditProduct = () => {
    setNewProduct({ nameAr: '', nameEn: '', price: '', category: 'wood', descriptionAr: '', descriptionEn: '', image: '' });
    setProductImageFile(null);
    setEditingProductId(null);
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
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
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    let imageUrl = newProduct.image;
    if (productImageFile) {
      try {
        const uploadData = await uploadFileDirect({ token, file: productImageFile });
        imageUrl = uploadData.url;
      } catch {
        alert('حدث خطأ أثناء الرفع');
        return;
      }
    }

    try {
      const method = editingProductId ? 'PUT' : 'POST';
      const url = editingProductId
        ? buildApiUrl(API_ENDPOINTS.ADMIN_PRODUCTS_DETAIL(editingProductId))
        : buildApiUrl(API_ENDPOINTS.ADMIN_PRODUCTS);

      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newProduct, image: imageUrl })
      });
      if (res.ok) {
        handleCancelEditProduct();
        fetchData();
      }
    } catch (error) {
      console.error('Error saving product:', error);
    }
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
        alert('حدث خطأ أثناء الرفع');
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
      }
    } catch (error) {
      console.error('Error saving bank:', error);
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
          <button onClick={handleLogout} className="btn-solid" style={{ background: '#ef4444', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
            تسجيل الخروج
          </button>
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
                        <td>{new Date(u.createdAt).toLocaleDateString()}</td>
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
                          <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.9rem' }} onClick={() => handleChangeAdminPassword(a.id)}>تغيير الرقم السري</button>
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
                <form onSubmit={handleSaveProduct} style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center', background: '#f0f4f8', padding: '15px', borderRadius: '8px' }}>
                  <input type="text" placeholder="الاسم (عربي)" required value={newProduct.nameAr} onChange={e => setNewProduct({...newProduct, nameAr: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="text" placeholder="الاسم (إنجليزي)" required value={newProduct.nameEn} onChange={e => setNewProduct({...newProduct, nameEn: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="number" placeholder="السعر" required value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100px' }} />
                  <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                    <option value="">اختر القسم (المادة)</option>
                    {data.materials?.map(m => (
                      <option key={m.id} value={m.id.toString()}>{m.nameAr} ({m.nameEn})</option>
                    ))}
                  </select>
                  <textarea placeholder="الوصف (عربي)" required value={newProduct.descriptionAr} onChange={e => setNewProduct({...newProduct, descriptionAr: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', minHeight: '60px' }} />
                  <textarea placeholder="الوصف (إنجليزي)" required value={newProduct.descriptionEn} onChange={e => setNewProduct({...newProduct, descriptionEn: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', minHeight: '60px' }} />
                  <div style={{ width: '100%', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input type="text" placeholder="رابط الصورة (اختياري إذا تم رفع ملف)" value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', flex: 1 }} />
                    <span>أو ارفع صورة:</span>
                    <input type="file" accept="image/*" onChange={e => setProductImageFile(e.target.files[0])} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  </div>
                  <div style={{ width: '100%', marginTop: '10px' }}>
                    <button type="submit" className="btn-primary" style={{ padding: '8px 16px', marginRight: '10px' }}>{editingProductId ? 'تحديث المنتج' : 'إضافة المنتج'}</button>
                    {editingProductId && <button type="button" className="btn-secondary" style={{ padding: '8px 16px' }} onClick={handleCancelEditProduct}>إلغاء</button>}
                  </div>
                </form>
                <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '2px solid #ddd' }}><th>الصورة</th><th>الاسم (ع)</th><th>السعر</th><th>القسم</th><th>إجراء</th></tr></thead>
                  <tbody>
                    {data.products.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #ddd' }}>
                        <td>{p.image ? <img src={p.image} alt={p.nameAr} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} /> : '-'}</td>
                        <td>{p.nameAr}</td>
                        <td>{p.price}</td>
                        <td>{p.category}</td>
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
                          <th>ID</th><th>العميل</th><th>المبلغ</th><th>الإيصال</th><th>التاريخ</th><th>إجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.orders.filter(o => o.status === phase).map(o => (
                          <tr key={o.id} style={{ borderBottom: '1px solid #ddd' }}>
                            <td>{o.id}</td><td>{o.user?.username}</td><td>{o.totalAmount}</td>
                            <td>
                              {o.receiptUrl && <a href={o.receiptUrl} target="_blank" rel="noreferrer" style={{marginRight: '5px'}}>صورة</a>}
                              {o.receiptText && <button className="btn-secondary" style={{padding: '2px 5px', fontSize: '0.8rem', marginRight: '5px'}} onClick={() => alert(o.receiptText)}>نص</button>}
                              {!o.receiptUrl && !o.receiptText && '-'}
                            </td>
                            <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                            <td>
                              {phase === 'pending' && (
                                <div style={{ display: 'flex', gap: '5px' }}>
                                  <button className="btn-primary" style={{ padding: '5px 10px', background: 'green', border: 'none' }} onClick={() => handleOrderStatusUpdate(o.id, 'execution')}>اعتماد وتوثيق</button>
                                  <button className="btn-solid" style={{ padding: '5px 10px', background: 'red', border: 'none', color: 'white' }} onClick={() => handleOrderStatusUpdate(o.id, 'rejected')}>رفض</button>
                                </div>
                              )}
                              {phase === 'execution' && (
                                <button className="btn-primary" style={{ padding: '5px 10px' }} onClick={() => handleOrderStatusUpdate(o.id, 'ready')}>تأكيد الانتهاء</button>
                              )}
                              {phase === 'ready' && (
                                <button className="btn-primary" style={{ padding: '5px 10px' }} onClick={() => handleOrderStatusUpdate(o.id, 'delivered')}>تم التسليم</button>
                              )}
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
                        {co.attachmentText && <button className="btn-secondary" style={{padding: '2px 5px', fontSize: '0.8rem', marginRight: '5px'}} onClick={() => alert(co.attachmentText)}>نص</button>}
                        {!co.attachmentUrl && !co.attachmentText && '-'}
                      </td>
                      <td>{co.status}</td>
                      <td>{co.priceQuote || 'بانتظار التسعير'}</td>
                      <td>
                        {!co.priceQuote && (
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <input id={`quote-${co.id}`} type="number" placeholder="السعر" style={{ width: '80px', padding: '5px' }} />
                            <button className="btn-primary" style={{ padding: '5px 10px' }} onClick={() => handleQuoteUpdate(co.id, document.getElementById(`quote-${co.id}`).value)}>تسعير</button>
                          </div>
                        )}
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

      {printingOrder && <InvoiceTemplate order={printingOrder} ref={invoiceRef} />}
    </div>
  );
};

export default AdminDashboard;
