import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import InvoiceTemplate from '../components/InvoiceTemplate';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';
import { uploadFileDirect } from '../utils/directUpload';

const statusLabels = {
  pending: 'توثيق التحويل',
  execution: 'قيد التنفيذ',
  ready: 'جاهز للتسليم/الشحن',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  rejected: 'مرفوض',
};

const AdminDesktopProgram = () => {
  const navigate = useNavigate();
  const invoiceRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [printingOrderId, setPrintingOrderId] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [data, setData] = useState({ orders: [], products: [], materials: [] });
  const [renderingOrder, setRenderingOrder] = useState(null);

  const [newProduct, setNewProduct] = useState({
    nameAr: '',
    nameEn: '',
    price: '',
    category: '',
    descriptionAr: '',
    descriptionEn: '',
    image: '',
  });
  const [productImageFile, setProductImageFile] = useState(null);

  const fetchProgramData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [ordersRes, productsRes, materialsRes] = await Promise.all([
        fetch(buildApiUrl(API_ENDPOINTS.ADMIN_ORDERS), { headers }),
        fetch(buildApiUrl(API_ENDPOINTS.PRODUCTS)),
        fetch(buildApiUrl(API_ENDPOINTS.MATERIALS)),
      ]);

      if (ordersRes.status === 401 || ordersRes.status === 403) {
        navigate('/login');
        return;
      }

      const [orders, products, materials] = await Promise.all([
        ordersRes.ok ? ordersRes.json() : [],
        productsRes.ok ? productsRes.json() : [],
        materialsRes.ok ? materialsRes.json() : [],
      ]);

      setData({
        orders: Array.isArray(orders) ? orders : [],
        products: Array.isArray(products) ? products : [],
        materials: Array.isArray(materials) ? materials : [],
      });
    } catch (error) {
      console.error('Failed to load desktop program data:', error);
      alert('تعذر تحميل البيانات. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchProgramData();
  }, [fetchProgramData]);

  const filteredOrders = useMemo(() => {
    if (selectedStatus === 'all') return data.orders;
    return data.orders.filter((order) => order.status === selectedStatus);
  }, [data.orders, selectedStatus]);

  const markInvoicePrinted = useCallback(async (orderId) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_ORDER_INVOICE_PRINTED(orderId)), {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error('Failed to mark invoice as printed:', error);
    }
  }, []);

  const generateInvoicePdf = useCallback(async (order, autoPrint = false) => {
    setRenderingOrder(order);

    // Wait a frame so the hidden invoice template is mounted before capture.
    await new Promise((resolve) => setTimeout(resolve, 120));

    if (!invoiceRef.current) {
      throw new Error('Invoice template is not ready');
    }

    const canvas = await html2canvas(invoiceRef.current, { scale: 2, useCORS: true });
    const imageData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = (canvas.height * pageWidth) / canvas.width;

    pdf.addImage(imageData, 'PNG', 0, 0, pageWidth, pageHeight);

    if (autoPrint) {
      pdf.autoPrint();
      window.open(pdf.output('bloburl'), '_blank');
    } else {
      pdf.save(`Invoice_${order.invoiceNumber || order.id}.pdf`);
    }

    setRenderingOrder(null);
  }, []);

  const handleInvoiceAction = async (order, action) => {
    setPrintingOrderId(order.id);

    try {
      await generateInvoicePdf(order, action === 'print');
      if (!order.invoicePrinted) {
        await markInvoicePrinted(order.id);
      }
      await fetchProgramData();
    } catch (error) {
      console.error('Failed to print/download invoice:', error);
      alert('حدث خطأ أثناء تجهيز الفاتورة.');
    } finally {
      setPrintingOrderId(null);
    }
  };

  const handleSaveProduct = async (event) => {
    event.preventDefault();

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    setSavingProduct(true);

    try {
      let imageUrl = newProduct.image;

      if (productImageFile) {
        const uploadData = await uploadFileDirect({ token, file: productImageFile });
        imageUrl = uploadData.url;
      }

      const response = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_PRODUCTS), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...newProduct, image: imageUrl }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'فشل رفع المنتج');
      }

      setNewProduct({
        nameAr: '',
        nameEn: '',
        price: '',
        category: '',
        descriptionAr: '',
        descriptionEn: '',
        image: '',
      });
      setProductImageFile(null);
      await fetchProgramData();
      alert('تم رفع المنتج بنجاح.');
    } catch (error) {
      console.error('Failed to upload product:', error);
      alert(error.message || 'حدث خطأ أثناء رفع المنتج');
    } finally {
      setSavingProduct(false);
    }
  };

  return (
    <div style={{ padding: '2rem 1rem', background: '#f8fafc', minHeight: '80vh' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', background: '#fff', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '18px' }}>
          <div>
            <h2 style={{ margin: 0 }}>برنامج الكمبيوتر لإدارة الطلبات والمنتجات</h2>
            <p style={{ margin: '6px 0 0', color: '#475569' }}>واجهة سريعة للطباعة ورفع المنتجات من المكتب.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={() => navigate('/admin')}>العودة للوحة الإدارة</button>
        </div>

        {loading ? (
          <p>جاري تحميل البيانات...</p>
        ) : (
          <>
            <section style={{ marginBottom: '26px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: '0 0 10px' }}>عرض وطباعة الطلبات</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label htmlFor="order-status-filter">حالة الطلب</label>
                  <select id="order-status-filter" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <option value="all">الكل</option>
                    <option value="pending">توثيق التحويل</option>
                    <option value="execution">قيد التنفيذ</option>
                    <option value="ready">جاهز</option>
                    <option value="shipped">تم الشحن</option>
                    <option value="delivered">تم التسليم</option>
                    <option value="rejected">مرفوض</option>
                  </select>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ textAlign: 'right', padding: '10px' }}>رقم الطلب</th>
                      <th style={{ textAlign: 'right', padding: '10px' }}>العميل</th>
                      <th style={{ textAlign: 'right', padding: '10px' }}>الحالة</th>
                      <th style={{ textAlign: 'right', padding: '10px' }}>المبلغ</th>
                      <th style={{ textAlign: 'right', padding: '10px' }}>تاريخ الطلب</th>
                      <th style={{ textAlign: 'right', padding: '10px' }}>الفاتورة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px' }}>#{order.id}</td>
                        <td style={{ padding: '10px' }}>{order.user?.username || 'عميل'}</td>
                        <td style={{ padding: '10px' }}>{statusLabels[order.status] || order.status || '-'}</td>
                        <td style={{ padding: '10px' }}>{order.totalAmount} ر.س</td>
                        <td style={{ padding: '10px' }}>{new Date(order.createdAt).toLocaleDateString('en-GB')}</td>
                        <td style={{ padding: '10px' }}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => handleInvoiceAction(order, 'print')}
                              disabled={printingOrderId === order.id}
                            >
                              {printingOrderId === order.id ? 'جاري التجهيز...' : 'طباعة مباشرة'}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => handleInvoiceAction(order, 'download')}
                              disabled={printingOrderId === order.id}
                            >
                              تنزيل PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filteredOrders.length && (
                      <tr>
                        <td colSpan="6" style={{ padding: '14px', textAlign: 'center', color: '#64748b' }}>
                          لا توجد طلبات مطابقة للحالة المحددة.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 style={{ marginTop: 0 }}>رفع المنتجات</h3>
              <form onSubmit={handleSaveProduct} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <input type="text" required placeholder="الاسم (عربي)" value={newProduct.nameAr} onChange={(e) => setNewProduct((prev) => ({ ...prev, nameAr: e.target.value }))} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                <input type="text" required placeholder="الاسم (إنجليزي)" value={newProduct.nameEn} onChange={(e) => setNewProduct((prev) => ({ ...prev, nameEn: e.target.value }))} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                <input type="number" required placeholder="السعر" value={newProduct.price} onChange={(e) => setNewProduct((prev) => ({ ...prev, price: e.target.value }))} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                <select required value={newProduct.category} onChange={(e) => setNewProduct((prev) => ({ ...prev, category: e.target.value }))} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <option value="">اختر نوع المادة</option>
                  {data.materials.map((material) => (
                    <option key={material.id} value={material.id.toString()}>
                      {material.nameAr} ({material.nameEn})
                    </option>
                  ))}
                </select>
                <textarea required placeholder="الوصف (عربي)" value={newProduct.descriptionAr} onChange={(e) => setNewProduct((prev) => ({ ...prev, descriptionAr: e.target.value }))} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '84px', gridColumn: '1 / -1' }} />
                <textarea required placeholder="الوصف (إنجليزي)" value={newProduct.descriptionEn} onChange={(e) => setNewProduct((prev) => ({ ...prev, descriptionEn: e.target.value }))} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '84px', gridColumn: '1 / -1' }} />
                <input type="text" placeholder="رابط الصورة (اختياري)" value={newProduct.image} onChange={(e) => setNewProduct((prev) => ({ ...prev, image: e.target.value }))} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                <input type="file" accept="image/*" onChange={(e) => setProductImageFile(e.target.files?.[0] || null)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                <button type="submit" className="btn-primary" disabled={savingProduct} style={{ width: 'fit-content', paddingInline: '16px' }}>
                  {savingProduct ? 'جاري الرفع...' : 'رفع المنتج'}
                </button>
              </form>

              <div style={{ marginTop: '12px', overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ textAlign: 'right', padding: '10px' }}>الصورة</th>
                      <th style={{ textAlign: 'right', padding: '10px' }}>الاسم</th>
                      <th style={{ textAlign: 'right', padding: '10px' }}>السعر</th>
                      <th style={{ textAlign: 'right', padding: '10px' }}>التصنيف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.slice(0, 20).map((product) => (
                      <tr key={product.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px' }}>
                          {product.image ? (
                            <img src={product.image} alt={product.nameAr} style={{ width: '42px', height: '42px', borderRadius: '6px', objectFit: 'cover' }} />
                          ) : (
                            '-'
                          )}
                        </td>
                        <td style={{ padding: '10px' }}>{product.nameAr}</td>
                        <td style={{ padding: '10px' }}>{product.price} ر.س</td>
                        <td style={{ padding: '10px' }}>{product.category}</td>
                      </tr>
                    ))}
                    {!data.products.length && (
                      <tr>
                        <td colSpan="4" style={{ padding: '14px', textAlign: 'center', color: '#64748b' }}>
                          لا توجد منتجات حالياً.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>

      {renderingOrder && <InvoiceTemplate order={renderingOrder} ref={invoiceRef} />}
    </div>
  );
};

export default AdminDesktopProgram;
