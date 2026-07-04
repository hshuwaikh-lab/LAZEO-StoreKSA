import React, { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Layout from './components/Layout';
import Home from './pages/Home';
import Shop from './pages/Shop';
import OurWorks from './pages/OurWorks';
import CustomOrder from './pages/CustomOrder';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import AdminDesktopProgram from './pages/AdminDesktopProgram';
import DesktopUnlock from './pages/DesktopUnlock';
import Profile from './pages/Profile';
import Checkout from './pages/Checkout';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';

function App() {
  const { i18n } = useTranslation();
  const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
  const RouterComponent = isFileProtocol ? HashRouter : BrowserRouter;
  const routerProps = isFileProtocol ? {} : { basename: import.meta.env.BASE_URL };
  const desktopUnlocked = !isFileProtocol || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('lazeo_desktop_unlocked') === 'true');

  useEffect(() => {
    // Set Document Direction
    document.body.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <AuthProvider>
      <CartProvider>
        <RouterComponent {...routerProps}>
          <ScrollToTop />
          <Layout>
            <Routes>
              {isFileProtocol && !desktopUnlocked ? (
                <Route path="*" element={<DesktopUnlock />} />
              ) : null}
              <Route path="/unlock" element={<DesktopUnlock />} />
              <Route path="/" element={<Home />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/our-works" element={<OurWorks />} />
              <Route path="/custom-order" element={<CustomOrder />} />
              <Route path="/product/:id" element={<ProductDetails />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/login" element={<Login />} />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="/checkout" element={
                <ProtectedRoute>
                  <Checkout />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/desktop-program" element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminDesktopProgram />
                </ProtectedRoute>
              } />
            </Routes>
          </Layout>
        </RouterComponent>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
