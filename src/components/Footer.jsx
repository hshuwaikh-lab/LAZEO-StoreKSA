import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';
import './Footer.css';

const Footer = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState({});

  useEffect(() => {
    fetch(buildApiUrl(API_ENDPOINTS.SETTINGS))
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(err => console.error(err));
  }, []);

  return (
    <footer className="footer glass">
      <div className="container footer-content">
        <div className="footer-brand">
          <img src="/logo.png" alt="LAZEO Logo" style={{height: '60px', width: 'auto', objectFit: 'contain', marginBottom: '1rem'}} />
          <p>{t('hero_subtitle')}</p>
          <div style={{ display: 'flex', gap: '15px', marginTop: '1rem', justifyContent: 'center' }}>
            {settings.whatsappNumber && (
              <a href={`https://wa.me/${settings.whatsappNumber}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-main)', textDecoration: 'none', fontWeight: 'bold' }}>
                WhatsApp
              </a>
            )}
            {settings.snapchatUrl && (
              <a href={settings.snapchatUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-main)', textDecoration: 'none', fontWeight: 'bold' }}>
                Snapchat
              </a>
            )}
            {settings.instagramUrl && (
              <a href={settings.instagramUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-main)', textDecoration: 'none', fontWeight: 'bold' }}>
                Instagram
              </a>
            )}
          </div>
        </div>
        <div className="footer-bottom">
          <p>{t('footer_text')}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
