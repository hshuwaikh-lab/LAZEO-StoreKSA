import React, { useState, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, register, loginWithGoogle, loginWithApple } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (isRegistering) {
        await register(username, email, password);
        // Switch to login after successful register, or auto-login
        await login(email, password);
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
    const phoneOrEmail = prompt('أدخل رقم الجوال أو البريد الإلكتروني المسجل لاستعادة كلمة المرور:');
    if (!phoneOrEmail) return;
    try {
      const res = await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneOrEmail })
      });
      const data = await res.json();
      if (res.ok) {
        alert('تم إرسال كلمة المرور الجديدة إلى الواتساب المسجل بنجاح.');
      } else {
        alert(data.error || 'حدث خطأ');
      }
    } catch (err) {
      alert('حدث خطأ أثناء الاتصال بالخادم');
    }
  };

  const handleSocialLogin = async (provider) => {
    setError(null);
    try {
      const user = provider === 'google'
        ? await loginWithGoogle()
        : await loginWithApple();

      if (user?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate(from);
      }
    } catch (err) {
      setError(err?.message || err || 'حدث خطأ أثناء تسجيل الدخول الاجتماعي');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>{isRegistering ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}</h2>
        
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          {isRegistering && (
            <div className="input-group">
              <label>الاسم الكامل</label>
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                required 
              />
            </div>
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
              <a href="#forgot" onClick={handleForgotPassword}>
                هل نسيت كلمة المرور؟
              </a>
            </div>
          )}

          <button type="submit" className="btn-solid primary-btn w-full">
            {isRegistering ? 'تسجيل' : 'دخول'}
          </button>
        </form>

        <div className="divider">أو</div>

        <button className="btn-outline google-btn w-full" type="button" onClick={() => handleSocialLogin('google')}>
          <img src="https://img.icons8.com/color/24/000000/google-logo.png" alt="Google" />
          الدخول / التسجيل باستخدام Google
        </button>

        <button className="btn-outline apple-btn w-full" type="button" onClick={() => handleSocialLogin('apple')}>
          <img src="https://img.icons8.com/ios-filled/24/000000/apple-logo.png" alt="Apple" />
          الدخول / التسجيل باستخدام Apple
        </button>

        <div className="toggle-register">
          {isRegistering ? 'تتملك حساب مسبقاً؟ ' : 'ليس لديك حساب بعد؟ '}
          <span className="toggle-link" onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Login;
