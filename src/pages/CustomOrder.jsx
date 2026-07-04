import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';
import { uploadFileDirect } from '../utils/directUpload';
import ActionBanner from '../components/ActionBanner';

const CustomOrder = () => {
  const { t, i18n } = useTranslation();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [materials, setMaterials] = useState([]);
  const [formData, setFormData] = useState({
    material: '',
    details: ''
  });

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.MATERIALS));
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

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const project = searchParams.get('project');

    if (project) {
      setFormData(prev => {
        if (prev.details.trim()) {
          return prev;
        }

        return {
          ...prev,
          details: `أرغب في تنفيذ مشروع مشابه لـ ${project}.`,
        };
      });
    }
  }, [location.search]);
  const [inputType, setInputType] = useState('image');
  const [file, setFile] = useState(null);
  const [attachmentText, setAttachmentText] = useState('');
  const [feedback, setFeedback] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setFeedback({ type: 'error', title: 'تسجيل الدخول مطلوب', message: 'الرجاء تسجيل الدخول أولًا لتقديم طلب مخصص.' });
      navigate('/login');
      return;
    }

    let finalAttachmentUrl = null;
    let finalAttachmentText = null;
    const token = localStorage.getItem('token');

    if (inputType === 'image') {
      if (!file) {
        setFeedback({ type: 'error', title: 'صورة التصميم مطلوبة', message: 'الرجاء إرفاق ملف التصميم قبل الإرسال.' });
        return;
      }
      try {
        const uploadData = await uploadFileDirect({ token, file });
        finalAttachmentUrl = uploadData.url;
      } catch {
        setFeedback({ type: 'error', title: 'فشل رفع الملف', message: 'حدث خطأ أثناء رفع صورة التصميم.' });
        return;
      }
    } else {
      if (!attachmentText.trim()) {
        setFeedback({ type: 'error', title: 'النص مطلوب', message: 'الرجاء إدخال رابط أو نص التصميم قبل المتابعة.' });
        return;
      }
      finalAttachmentText = attachmentText;
    }

    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.CUSTOM_ORDERS), {
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
        setFeedback({ type: 'success', title: 'تم إرسال الطلب', message: 'تم إرسال طلب التسعير بنجاح. يمكنك متابعة الحالة من ملفك الشخصي.' });
        setTimeout(() => navigate('/profile'), 900);
      } else {
        setFeedback({ type: 'error', title: 'تعذر الإرسال', message: 'حدث خطأ أثناء إرسال الطلب. حاول مرة أخرى.' });
      }
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', title: 'خطأ في الاتصال', message: 'تعذر الاتصال بالخادم. تحقق من الشبكة ثم أعد المحاولة.' });
    }
  };

  return (
    <div className="container section" style={{ maxWidth: '800px' }}>
      <h1 className="text-center" style={{marginBottom: '40px', fontSize: '2.5rem', color: 'var(--accent-main)'}}>
        {t('custom_order')}
      </h1>
      
      <div className="glass" style={{ padding: '40px', borderRadius: '12px' }}>
        <ActionBanner
          type={feedback?.type}
          title={feedback?.title}
          message={feedback?.message}
          onClose={() => setFeedback(null)}
        />

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
