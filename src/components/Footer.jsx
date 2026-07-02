import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';
import './Footer.css';

const WhatsAppLogo = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
    <path d="M20.52 3.48A11.87 11.87 0 0 0 12.06 0C5.49 0 .12 5.35.12 11.94c0 2.1.55 4.15 1.6 5.97L0 24l6.28-1.64a11.9 11.9 0 0 0 5.78 1.47h.01c6.57 0 11.94-5.35 11.94-11.94 0-3.19-1.24-6.18-3.49-8.41Zm-8.46 18.34h-.01a9.9 9.9 0 0 1-5.05-1.39l-.36-.22-3.73.97 1-3.64-.24-.38a9.93 9.93 0 0 1 1.52-12.33 9.95 9.95 0 0 1 14.08 0 9.87 9.87 0 0 1 2.9 7.05c0 5.5-4.48 9.94-9.95 9.94Zm5.45-7.45c-.3-.15-1.75-.86-2.02-.95-.27-.1-.47-.15-.67.15-.2.3-.77.95-.94 1.14-.17.2-.35.22-.65.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.74-1.65-2.03-.17-.3-.02-.46.12-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.08-.8.37-.27.3-1.05 1.02-1.05 2.48s1.08 2.87 1.23 3.07c.15.2 2.13 3.25 5.16 4.56.72.31 1.28.5 1.72.65.72.23 1.37.2 1.88.12.57-.08 1.75-.72 2-1.42.25-.7.25-1.3.18-1.42-.07-.13-.27-.2-.57-.35Z" />
  </svg>
);

const SnapchatLogo = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
    <path d="M12 1.5c-3.66 0-6.63 2.9-6.63 6.48 0 1.3.4 2.88.95 4.08-.25.4-.72.77-1.34.99-.52.18-.61.86-.14 1.18.64.44 1.49.72 2.42.8.28.49.65.93 1.08 1.3l-.3 1.5c-.07.35.26.64.6.53l1.72-.58c.64.19 1.31.3 1.99.3s1.35-.11 1.99-.3l1.72.58c.34.11.67-.18.6-.53l-.3-1.5c.43-.37.8-.81 1.08-1.3.93-.08 1.78-.36 2.42-.8.47-.32.38-1-.14-1.18-.62-.22-1.09-.59-1.34-.99.55-1.2.95-2.78.95-4.08C18.63 4.4 15.66 1.5 12 1.5Zm3.4 12.36-.43.04-.18.4a3.87 3.87 0 0 1-1.24 1.54l-.29.2.23 1.15-1.11-.38-.33.1c-.66.2-1.44.2-2.1 0l-.33-.1-1.11.38.23-1.15-.29-.2a3.87 3.87 0 0 1-1.24-1.54l-.18-.4-.43-.04a4.9 4.9 0 0 1-1.18-.24c.55-.42.98-.94 1.25-1.53l.16-.36-.18-.35c-.52-1-.92-2.52-.92-3.8 0-2.47 2.05-4.48 4.58-4.48s4.58 2.01 4.58 4.48c0 1.28-.4 2.8-.92 3.8l-.18.35.16.36c.27.59.7 1.11 1.25 1.53-.38.13-.78.22-1.18.24Z" />
  </svg>
);

const InstagramLogo = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
    <path d="M7.75 2h8.5A5.76 5.76 0 0 1 22 7.75v8.5A5.76 5.76 0 0 1 16.25 22h-8.5A5.76 5.76 0 0 1 2 16.25v-8.5A5.76 5.76 0 0 1 7.75 2Zm0 1.8A3.95 3.95 0 0 0 3.8 7.75v8.5a3.95 3.95 0 0 0 3.95 3.95h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95h-8.5Zm8.95 1.35a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z" />
  </svg>
);

const Footer = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState({});
  const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

  const normalizedWhatsapp = String(settings.whatsappNumber || '').replace(/[^\d]/g, '');

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
          <img src={logoUrl} alt="LAZEO Logo" style={{height: '60px', width: 'auto', objectFit: 'contain', marginBottom: '1rem'}} />
          <p>{t('hero_subtitle')}</p>
          <div className="social-links" aria-label="روابط التواصل الاجتماعي">
            {normalizedWhatsapp && (
              <a
                href={`https://wa.me/${normalizedWhatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="social-link"
                aria-label="WhatsApp"
                title="WhatsApp"
              >
                <WhatsAppLogo />
              </a>
            )}
            {settings.snapchatUrl && (
              <a
                href={settings.snapchatUrl}
                target="_blank"
                rel="noreferrer"
                className="social-link"
                aria-label="Snapchat"
                title="Snapchat"
              >
                <SnapchatLogo />
              </a>
            )}
            {settings.instagramUrl && (
              <a
                href={settings.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="social-link"
                aria-label="Instagram"
                title="Instagram"
              >
                <InstagramLogo />
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
