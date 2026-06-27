import React, { useState, useEffect, useRef, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import InvoiceTemplate from '../components/InvoiceTemplate';
import { AuthContext } from '../context/AuthContext';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';

const Profile = () => {
  useTranslation();
  const [activeTab, setActiveTab] = useState('info'); // info, orders, customOrders, password
  const [profile, setProfile] = useState({ username: '', email: '', phone: '', address: '', receiveWhatsApp: true });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [orders, setOrders] = useState([]);
  const [customOrders, setCustomOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [printingOrder, setPrintingOrder] = useState(null);
  const invoiceRef = useRef(null);
  const { updateUser } = useContext(AuthContext);

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
        alert('تم تحديث البيانات بنجاح');
        if (updateUser) {
          updateUser({ username: profile.username });
        }
      }
    } catch (error) {
      console.error('Error updating profile:', error);
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
        alert('تم تغيير كلمة المرور بنجاح');
        setPasswordForm({ currentPassword: '', newPassword: '' });
      } else {
        const errorData = await res.json();
        alert(errorData.error);
      }
    } catch (error) {
      console.error('Error changing password:', error);
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
          alert('حدث خطأ أثناء طباعة الفاتورة');
        }
      }
      setPrintingOrder(null);
    }, 100);
  };

  if (loading) return <div className="container section text-center">جاري التحميل...</div>;

  return (
    <div className="container section">
      <h1 className="text-center" style={{ marginBottom: '40px', color: 'var(--accent-main)' }}>الملف الشخصي</h1>
      
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
            {customOrders.length === 0 ? <p className="text-center">لا توجد طلبات مخصصة.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th>رقم الطلب</th>
                    <th>التاريخ</th>
                    <th>المادة</th>
                    <th>التسعير</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {customOrders.map(co => (
                    <tr key={co.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px' }}>#{co.id}</td>
                      <td style={{ padding: '10px' }}>{new Date(co.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '10px' }}>{co.material}</td>
                      <td style={{ padding: '10px' }}>{co.priceQuote ? `${co.priceQuote} ر.س` : 'بانتظار التسعير'}</td>
                      <td style={{ padding: '10px' }}>{co.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
      
      {printingOrder && <InvoiceTemplate order={printingOrder} ref={invoiceRef} />}
    </div>
  );
};

export default Profile;
