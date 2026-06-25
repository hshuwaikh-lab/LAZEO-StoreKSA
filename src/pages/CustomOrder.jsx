import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const CustomOrder = () => {
  const { t, i18n } = useTranslation();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [materials, setMaterials] = useState([]);
  const [formData, setFormData] = useState({
    material: '',
    details: ''
  });

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/materials');
        if (res.ok) {
          const data = await res.json();
          setMaterials(data);
          if (data.length > 0) {
            setFormData(prev => ({ ...prev, material: data[0].nameAr }));
          }
        }
      } catch (error) {
        console.error('Error fetching materials:', error);
      }
    };
    fetchMaterials();
  }, []);
  const [inputType, setInputType] = useState('image');
  const [file, setFile] = useState(null);
  const [attachmentText, setAttachmentText] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('الرجاء تسجيل الدخول أولاً لتقديم طلب مخصص');
      navigate('/login');
      return;
    }

    let finalAttachmentUrl = null;
    let finalAttachmentText = null;
    const token = localStorage.getItem('token');

    if (inputType === 'image') {
      if (!file) {
        alert('الرجاء إرفاق صورة التصميم');
        return;
      }
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      try {
        const uploadRes = await fetch('http://localhost:5000/api/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formDataUpload
        });
        if (!uploadRes.ok) throw new Error('Upload failed');
        const uploadData = await uploadRes.json();
        finalAttachmentUrl = uploadData.url;
      } catch (err) {
        alert('حدث خطأ أثناء رفع الصورة');
        return;
      }
    } else {
      if (!attachmentText.trim()) {
        alert('الرجاء إدخال رابط أو نص التصميم');
        return;
      }
      finalAttachmentText = attachmentText;
    }

    try {
      const res = await fetch('http://localhost:5000/api/custom-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          attachmentUrl: finalAttachmentUrl,
          attachmentText: finalAttachmentText
        })
      });
      if (res.ok) {
        alert('تم إرسال طلبك بنجاح! يمكنك متابعة حالة الطلب من ملفك الشخصي.');
        navigate('/profile');
      } else {
        alert('حدث خطأ أثناء إرسال الطلب');
      }
    } catch (error) {
      console.error(error);
      alert('حدث خطأ في الاتصال بالخادم');
    }
  };

  return (
    <div className="container section" style={{ maxWidth: '800px' }}>
      <h1 className="text-center" style={{marginBottom: '40px', fontSize: '2.5rem', color: 'var(--accent-main)'}}>
        {t('custom_order')}
      </h1>
      
      <div className="glass" style={{ padding: '40px', borderRadius: '12px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label htmlFor="material" style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>نوع المادة (Material)</label>
            <select id="material" value={formData.material} onChange={(e) => setFormData({...formData, material: e.target.value})} style={{ padding: '12px', borderRadius: '6px', background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
              {materials.length === 0 && <option value="">جاري التحميل...</option>}
              {materials.map(m => (
                <option key={m.id} value={i18n.language === 'ar' ? m.nameAr : m.nameEn}>
                  {i18n.language === 'ar' ? m.nameAr : m.nameEn}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>إرفاق التصميم</label>
            <div style={{ display: 'flex', gap: '15px' }}>
              <label>
                <input type="radio" value="image" checked={inputType === 'image'} onChange={() => setInputType('image')} /> رفع ملف التصميم
              </label>
              <label>
                <input type="radio" value="text" checked={inputType === 'text'} onChange={() => setInputType('text')} /> إدخال رابط أو نص
              </label>
            </div>
            {inputType === 'image' ? (
              <input type="file" accept="image/*,.pdf,.svg,.eps" onChange={e => setFile(e.target.files[0])} style={{ padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: '6px', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
            ) : (
              <input type="text" placeholder="رابط درايف، أو نص..." value={attachmentText} onChange={e => setAttachmentText(e.target.value)} style={{ padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: '6px', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label htmlFor="details" style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>تفاصيل إضافية</label>
            <textarea id="details" rows="5" value={formData.details} onChange={(e) => setFormData({...formData, details: e.target.value})} style={{ padding: '12px', borderRadius: '6px', background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', resize: 'vertical' }} required></textarea>
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '20px' }}>إرسال طلب التسعير</button>
        </form>
      </div>
    </div>
  );
};

export default CustomOrder;
