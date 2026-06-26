import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X, ShoppingCart, Globe, User } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';
import './Navbar.css';

const Navbar = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const { totalItems } = useCart();
  const { user, logout } = useContext(AuthContext);

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');
  };

  const navLinks = [
    { path: '/', label: t('home') },
    { path: '/custom-order', label: t('custom_order') }
  ];

  return (
    <header className="navbar glass">
      <div className="container nav-container">
        {/* Logo */}
        <Link to="/" className="brand-logo">
          <img 
             src="/logo.png" 
             alt="LAZEO Logo" 
             style={{height: '90px', width: 'auto', objectFit: 'contain'}} 
             onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} 
          />
          <h2 style={{display: 'none'}}>LAZEO <span>StoreKSA</span></h2>
        </Link>

        {/* Desktop Nav */}
        <nav className="desktop-nav">
          <ul className="nav-list">
            {navLinks.map((link) => (
              <li key={link.path}>
                <Link 
                  to={link.path} 
                  className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Actions */}
        <div className="nav-actions">
          <button className="lang-toggle" onClick={toggleLang} title={t('language')} aria-label={t('language')}>
            <Globe size={20} />
            <span className="lang-text">{i18n.language === 'ar' ? 'EN' : 'عربي'}</span>
          </button>
          
          <button className="cart-btn" aria-label={t('cart')} onClick={() => { navigate('/cart'); setIsOpen(false); }}>
            <ShoppingCart size={20} />
            {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
          </button>

          {user ? (
            <div className="user-dropdown" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {user.role === 'admin' ? (
                 <Link to="/admin" className="btn-outline" style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                   <User size={18} /> لوحة الإدارة
                 </Link>
              ) : (
                <Link to="/profile" style={{ fontWeight: '500', color: '#333', textDecoration: 'none', display: 'flex', gap: '5px', alignItems: 'center' }}>
                  <User size={18} /> {user.username}
                </Link>
              )}
              <button onClick={logout} className="btn-solid" style={{ padding: '0.4rem 0.8rem', background: '#ef4444', color: 'white' }}>خروج</button>
            </div>
          ) : (
            <Link to="/login" className="btn-solid" style={{ display: 'flex', gap: '5px', alignItems: 'center', padding: '0.4rem 1rem' }}>
              <User size={18} /> دخول
            </Link>
          )}

          <button className="mobile-menu-btn" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`mobile-menu ${isOpen ? 'open' : ''}`}>
        <ul className="mobile-nav-list">
          {navLinks.map((link) => (
            <li key={link.path}>
              <Link 
                to={link.path} 
                className={`mobile-nav-link ${location.pathname === link.path ? 'active' : ''}`}
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
};

export default Navbar;
