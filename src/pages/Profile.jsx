import React, { useState, useEffect, useRef, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import InvoiceTemplate from '../components/InvoiceTemplate';
import ActionBanner from '../components/ActionBanner';
import { AuthContext } from '../context/AuthContext';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

const Profile = () => {
  useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('info'); // info, orders, customOrders, password
  const [profile, setProfile] = useState({ username: '', email: '', phone: '', address: '', receiveWhatsApp: true });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [orders, setOrders] = useState([]);
  const [customOrders, setCustomOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [printingOrder, setPrintingOrder] = useState(null);
  const [processingCustomOrderId, setProcessingCustomOrderId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const invoiceRef = useRef(null);
  const { updateUser, user } = useContext(AuthContext);

  useEffect(() => {
    fetchData();
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

      if (profileRes.ok) setProfile(await profileRes.json());
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (customRes.ok) setCustomOrders(await customRes.json());
    } catch (error) {
      console.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
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

      await fetchData();
      navigate('/checkout', {
        state: {
          customOrder: {
            id: customOrder.id,
            material: customOrder.material,
            details: customOrder.details,
            priceQuote: customOrder.priceQuote,
          }
        }
      });
    } catch (error) {
      console.error('Error accepting custom order:', error);
      setFeedback({ type: 'error', title: 'تعذر الموافقة', message: error.message || 'حدث خطأ أثناء الموافقة على السعر.' });
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
            <button type="submit" className="btn-primary">حفظ التعديلات</button>
          </form>
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
              <div style={{ marginTop: '6px', color: 'var(--text-light)' }}>بعد التسعير من الإدارة يظهر زر الموافقة هنا. بعد الموافقة تنتقل مباشرة إلى صفحة الدفع لتحويل المبلغ.</div>
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
                        {co.priceQuote && co.status === 'priced' && (
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleAcceptCustomOrder(co)}
                            disabled={processingCustomOrderId === co.id}
                          >
                            {processingCustomOrderId === co.id ? 'جاري...' : 'موافقة والدفع'}
                          </button>
                        )}
                        {co.status === 'accepted' && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => navigate('/checkout', { state: { customOrder: co } })}
                          >
                            إتمام الدفع
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
