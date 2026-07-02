import React, { useState, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';
import ActionBanner from '../components/ActionBanner';
import Modal from '../components/Modal';
import './Login.css';

const Login = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');

  const { login, register } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (isRegistering) {
        await register(username, email, password, 'customer', phone);
        navigate(from);
      } else {
        const user = await login(email, password);
        if (user.role === 'admin') {
          navigate('/admin');
        } else {
          navigate(from);
        }
      }
    } catch (err) {
      setError(err?.message || err || 'حدث خطأ غير معروف');
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) {
      setFeedback({ type: 'error', title: 'البيان مطلوب', message: 'أدخل رقم الجوال أو البريد الإلكتروني المسجل.' });
      return;
    }
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.FORGOT_PASSWORD), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: forgotIdentifier, email: forgotIdentifier })
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', title: 'تمت الاستعادة', message: 'تم إرسال كلمة المرور الجديدة إلى وسيلة التواصل المسجلة.' });
        setForgotOpen(false);
      } else {
        setFeedback({ type: 'error', title: 'تعذر الاستعادة', message: data.error || 'حدث خطأ أثناء استعادة كلمة المرور.' });
      }
    } catch {
      setFeedback({ type: 'error', title: 'خطأ في الاتصال', message: 'حدث خطأ أثناء الاتصال بالخادم.' });
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>{isRegistering ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}</h2>
        
        {error && <div className="error-message">{error}</div>}
        <ActionBanner
          type={feedback?.type}
          title={feedback?.title}
          message={feedback?.message}
          onClose={() => setFeedback(null)}
        />

        <form onSubmit={handleSubmit} className="login-form">
          {isRegistering && (
            <>
            <div className="input-group">
              <label>الاسم الكامل</label>
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                required 
              />
            </div>
            <div className="input-group">
              <label>رقم الجوال</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05xxxxxxxx"
              />
            </div>
            </>
          )}

          <div className="input-group">
            <label>البريد الإلكتروني أو رقم الجوال</label>
            <input 
              type="text" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>
          
          <div className="input-group password-group">
            <label>كلمة المرور</label>
            <div className="password-field">
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'عرض كلمة المرور'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {!isRegistering && (
            <div className="forgot-password">
              <a href="#forgot" onClick={(e) => { e.preventDefault(); setForgotIdentifier(''); setForgotOpen(true); }}>
                هل نسيت كلمة المرور؟
              </a>
            </div>
          )}

          <button type="submit" className="btn-solid primary-btn w-full">
            {isRegistering ? 'تسجيل' : 'دخول'}
          </button>
        </form>

        <div className="toggle-register">
          {isRegistering ? 'تتملك حساب مسبقاً؟ ' : 'ليس لديك حساب بعد؟ '}
          <span className="toggle-link" onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
          </span>
        </div>

        <Modal
          open={forgotOpen}
          title="استعادة كلمة المرور"
          onClose={() => setForgotOpen(false)}
          actions={[
            <button key="cancel" type="button" className="btn-secondary" onClick={() => setForgotOpen(false)}>إلغاء</button>,
            <button key="confirm" type="button" className="btn-primary" onClick={handleForgotPassword}>إرسال</button>
          ]}
        >
          <p style={{ marginTop: 0 }}>أدخل رقم الجوال أو البريد الإلكتروني المسجل لاستعادة كلمة المرور.</p>
          <input
            type="text"
            value={forgotIdentifier}
            onChange={(event) => setForgotIdentifier(event.target.value)}
            placeholder="رقم الجوال أو البريد الإلكتروني"
            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
          />
        </Modal>
      </div>
    </div>
  );
};

export default Login;
