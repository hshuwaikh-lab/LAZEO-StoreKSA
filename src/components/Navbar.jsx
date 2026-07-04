import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X, ShoppingCart, Globe, User } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';
import logo from '/logo.png';
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
    { path: '/', label: t('home'), order: 1 },
    { path: '/shop', label: t('shop'), order: 2 },
    { path: '/custom-order', label: t('custom_order'), order: 3 },
    { path: '/our-works', label: t('our_works'), order: 4 }
  ];

  return (
    <header className="navbar glass">
      <div className="container nav-container">
        {/* Logo */}
        <Link to="/" className="brand-logo">
          <img 
             src={logo} 
             alt="LAZEO Logo" 
             style={{height: '90px', width: 'auto', objectFit: 'contain'}} 
             onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} 
          />
          <h2>LAZEO <span>StoreKSA</span></h2>
        </Link>

        {/* Desktop Nav */}
        <nav className="desktop-nav">
          <ul className="nav-list">
            {navLinks.map((link) => (
              <li key={link.path} style={{ order: link.order }}>
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
                <>
                  <Link to="/profile" className="btn-outline" style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                    <User size={18} /> الملف الشخصي
                  </Link>
                  <Link to="/admin" className="btn-outline" style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                    <User size={18} /> لوحة الإدارة
                  </Link>
                </>
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
            <li key={link.path} style={{ order: link.order }}>
              <Link 
                to={link.path} 
                className={`mobile-nav-link ${location.pathname === link.path ? 'active' : ''}`}
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            </li>
          ))}
          {user && (
            <>
              <li>
                <Link
                  to="/profile"
                  className={`mobile-nav-link ${location.pathname === '/profile' ? 'active' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  <User size={18} /> الملف الشخصي
                </Link>
              </li>
              {user.role === 'admin' && (
                <>
                  <li>
                    <Link
                      to="/admin"
                      className={`mobile-nav-link ${location.pathname === '/admin' ? 'active' : ''}`}
                      onClick={() => setIsOpen(false)}
                    >
                      <User size={18} /> لوحة الإدارة
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/admin/desktop-program"
                      className={`mobile-nav-link ${location.pathname === '/admin/desktop-program' ? 'active' : ''}`}
                      onClick={() => setIsOpen(false)}
                    >
                      <User size={18} /> برنامج المكتب
                    </Link>
                  </li>
                </>
              )}
              <li>
                <button
                  type="button"
                  onClick={() => { logout(); setIsOpen(false); }}
                  className="mobile-nav-link"
                  style={{ width: '100%', textAlign: 'right', background: 'transparent', border: 'none', padding: 0 }}
                >
                  خروج
                </button>
              </li>
            </>
          )}
        </ul>
      </div>
    </header>
  );
};

export default Navbar;
