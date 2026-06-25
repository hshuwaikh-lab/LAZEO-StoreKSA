import React, { forwardRef } from 'react';

const InvoiceTemplate = forwardRef(({ order }, ref) => {
  if (!order) return null;

  let items = [];
  try {
    items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  } catch (e) {
    console.error("Error parsing items", e);
  }

  return (
    <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
      <div 
        ref={ref} 
        style={{
          width: '800px',
          padding: '40px',
          backgroundColor: '#fff',
          color: '#000',
          fontFamily: 'Arial, Helvetica, sans-serif',
          direction: 'rtl',
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '20px', marginBottom: '30px' }}>
          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img src="/logo.png" alt="LAZEO Logo" style={{ height: '70px', objectFit: 'contain' }} crossOrigin="anonymous" />
            <div>
              <h1 style={{ margin: 0, fontSize: '28px', color: '#000', fontWeight: 'bold' }}>LAZEO StoreKSA</h1>
              <p style={{ margin: '5px 0', fontSize: '14px', color: '#555' }}>متجر متخصص في أعمال القص بالليزر</p>
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ margin: 0, fontSize: '22px', color: '#000' }}>فاتورة طلب</h2>
            <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>رقم الفاتورة:</strong> <span dir="ltr">{order.invoiceNumber || 'N/A'}</span></p>
            <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>رقم الطلب:</strong> <span dir="ltr">#{order.id}</span></p>
            <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>التاريخ:</strong> {new Date(order.createdAt).toLocaleDateString('en-GB')}</p>
          </div>
        </div>

        {/* Customer Info */}
        <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#000', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>بيانات العميل</h3>
          <table style={{ width: '100%', border: 'none' }}>
            <tbody>
              <tr>
                <td style={{ padding: '5px', width: '50%' }}><strong>الاسم:</strong> {order.user?.username || 'عميل'}</td>
                <td style={{ padding: '5px', width: '50%' }}><strong>الجوال:</strong> <span dir="ltr">{order.user?.phone || 'غير متوفر'}</span></td>
              </tr>
              <tr>
                <td style={{ padding: '5px' }}><strong>الإيميل:</strong> {order.user?.email || 'غير متوفر'}</td>
                <td style={{ padding: '5px' }}><strong>العنوان:</strong> {order.user?.address || 'غير متوفر'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Products Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
          <thead>
            <tr style={{ backgroundColor: '#eee' }}>
              <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #ccc', fontSize: '16px', width: '60px' }}>صورة</th>
              <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #ccc', fontSize: '16px' }}>المنتج</th>
              <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #ccc', fontSize: '16px', width: '80px' }}>الكمية</th>
              <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #ccc', fontSize: '16px', width: '120px' }}>سعر الوحدة</th>
              <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #ccc', fontSize: '16px', width: '120px' }}>المجموع</th>
            </tr>
          </thead>
          <tbody>
            {items && items.length > 0 ? items.map((item, idx) => (
              <tr key={idx}>
                <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #ccc' }}>
                  {item.image ? (
                    <img src={item.image} alt={item.nameAr || 'Product'} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} crossOrigin="anonymous" />
                  ) : (
                    <span style={{ fontSize: '12px', color: '#999' }}>لا توجد صورة</span>
                  )}
                </td>
                <td style={{ padding: '12px', border: '1px solid #ccc', fontSize: '15px' }}>
                  <strong>{item.nameAr || item.nameEn || 'منتج'}</strong>
                  {item.note && <div style={{ fontSize: '13px', color: '#666', marginTop: '5px' }}>ملاحظة: {item.note}</div>}
                </td>
                <td style={{ padding: '12px', textAlign: 'center', border: '1px solid #ccc', fontSize: '15px' }}>{item.quantity}</td>
                <td style={{ padding: '12px', textAlign: 'center', border: '1px solid #ccc', fontSize: '15px' }} dir="ltr">{item.price} SAR</td>
                <td style={{ padding: '12px', textAlign: 'center', border: '1px solid #ccc', fontSize: '15px' }} dir="ltr">{(item.price * item.quantity).toFixed(2)} SAR</td>
              </tr>
            )) : (
              <tr><td colSpan="5" style={{ padding: '12px', textAlign: 'center', border: '1px solid #ccc' }}>لا يوجد منتجات مسجلة</td></tr>
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '300px', backgroundColor: '#f9f9f9', padding: '15px', border: '1px solid #ccc', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px' }}>
              <span>الإجمالي الكلي:</span>
              <span dir="ltr">{order.totalAmount} SAR</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '50px', paddingTop: '20px', borderTop: '2px solid #eee', textAlign: 'center', fontSize: '14px', color: '#666' }}>
          <p style={{ margin: '5px 0', fontWeight: 'bold', color: '#000' }}>شكراً لتسوقكم من LAZEO</p>
          <p style={{ margin: '5px 0' }}>البضاعة المباعة لا ترد ولا تستبدل إلا في حال وجود عيب مصنعي</p>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', marginTop: '15px', direction: 'ltr', fontSize: '13px', color: '#000' }}>
            <span>🌐 www.lazeostore.com</span>
            <span>📱 WhatsApp</span>
            <span>📸 Instagram</span>
            <span>👻 Snapchat</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default InvoiceTemplate;
