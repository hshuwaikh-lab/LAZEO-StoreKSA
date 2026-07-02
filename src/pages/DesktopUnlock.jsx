import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DESKTOP_PASSWORD = 'Hus@270021';

const DesktopUnlock = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();

    if (password === DESKTOP_PASSWORD) {
      sessionStorage.setItem('lazeo_desktop_unlocked', 'true');
      navigate('/admin/desktop-program', { replace: true });
      return;
    }

    setError('كلمة المرور غير صحيحة');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)', padding: '24px' }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '420px', background: 'rgba(255,255,255,0.95)', borderRadius: '20px', padding: '28px', boxShadow: '0 24px 80px rgba(15, 23, 42, 0.35)' }}>
        <div style={{ marginBottom: '18px' }}>
          <h1 style={{ margin: 0, fontSize: '2rem', color: '#0f172a' }}>LAZEO Store</h1>
          <p style={{ margin: '8px 0 0', color: '#475569' }}>أدخل كلمة المرور لفتح البرنامج المستقل.</p>
        </div>

        <label htmlFor="desktop-password" style={{ display: 'block', marginBottom: '8px', color: '#0f172a', fontWeight: 700 }}>كلمة المرور</label>
        <input
          id="desktop-password"
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError('');
          }}
          placeholder="أدخل كلمة المرور"
          autoFocus
          style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1rem', marginBottom: '12px' }}
        />

        {error && <div style={{ color: '#b91c1c', marginBottom: '12px', fontWeight: 700 }}>{error}</div>}

        <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px 16px' }}>
          فتح البرنامج
        </button>
      </form>
    </div>
  );
};

export default DesktopUnlock;
