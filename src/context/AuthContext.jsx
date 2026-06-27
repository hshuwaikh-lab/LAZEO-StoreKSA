import React, { createContext, useState, useEffect } from 'react';
import { apiCall, API_ENDPOINTS } from '../config/api';
import {
  getSocialRedirectUrl,
  getSupabaseAuthConfigError,
  isSupabaseAuthConfigured,
  supabase,
} from '../config/supabaseAuth';

const mapAuthError = (error) => {
  const code = typeof error === 'string' ? error : error?.code;
  const message = typeof error === 'string' ? error : error?.message;

  if (code === 'auth/network-request-failed') {
    return 'تعذر الاتصال بخدمة المصادقة. تحقق من اتصال الإنترنت ومن إعدادات Supabase Auth.';
  }

  if (message && /network|failed to fetch|fetch/i.test(message)) {
    return 'تعذر الاتصال بالخادم. تحقق من VITE_API_BASE_URL وأن واجهة API تعمل ومتاحة من نفس البيئة.';
  }

  if (message) return message;
  return 'حدث خطأ في المصادقة';
};

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistAuthState = (authToken, authUser) => {
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(authUser));
    sessionStorage.setItem('token', authToken);
    sessionStorage.setItem('user', JSON.stringify(authUser));
  };

  const clearAuthState = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
  };

  useEffect(() => {
    const storedToken = sessionStorage.getItem('token') || localStorage.getItem('token');
    const storedUser = sessionStorage.getItem('user') || localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error parsing stored user data:', error);
      }
    }

    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await apiCall(API_ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'فشل تسجيل الدخول');
      }

      setToken(data.token);
      setUser(data.user);
      persistAuthState(data.token, data.user);

      return data.user;
    } catch (error) {
      throw new Error(mapAuthError(error));
    }
  };

  const register = async (username, email, password, role = 'customer') => {
    try {
      const response = await apiCall(API_ENDPOINTS.REGISTER, {
        method: 'POST',
        body: JSON.stringify({ username, email, password, role }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'فشل إنشاء الحساب');
      }

      return await login(email, password);
    } catch (error) {
      throw new Error(mapAuthError(error));
    }
  };

  const startSocialLogin = async (provider) => {
    if (!isSupabaseAuthConfigured || !supabase) {
      const configError = getSupabaseAuthConfigError() || 'إعدادات Supabase Auth غير مكتملة.';
      throw new Error(`${configError} أضف القيم الصحيحة في متغيرات البيئة ثم أعد النشر.`);
    }

    const redirectTo = getSocialRedirectUrl('/login');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });

    if (error) {
      throw error;
    }
  };

  const completeSocialLogin = async () => {
    if (!isSupabaseAuthConfigured || !supabase) {
      return null;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw sessionError;
    }

    const session = sessionData?.session;
    const supabaseUser = session?.user;
    if (!supabaseUser?.email) {
      return null;
    }

    const provider = supabaseUser.app_metadata?.provider;
    if (provider !== 'google' && provider !== 'apple') {
      return null;
    }

    const email = supabaseUser.email;
    const username =
      supabaseUser.user_metadata?.full_name ||
      supabaseUser.user_metadata?.name ||
      email.split('@')[0];

    let response;
    let data;
    try {
      response = await apiCall(API_ENDPOINTS.SOCIAL_LOGIN, {
        method: 'POST',
        body: JSON.stringify({
          provider,
          providerId: supabaseUser.id,
          email,
          username,
        }),
      });

      data = await response.json();
    } catch {
      throw new Error(
        'تمت المصادقة مع مزود الدخول لكن تعذر الوصول إلى خادم التطبيق. تحقق من VITE_API_BASE_URL وأن واجهة API متاحة.'
      );
    }

    if (!response.ok) {
      throw new Error(data?.error || 'فشل تسجيل الدخول الاجتماعي');
    }

    setToken(data.token);
    setUser(data.user);
    persistAuthState(data.token, data.user);

    try {
      await supabase.auth.signOut();
    } catch {
      // noop
    }

    return data.user;
  };

  const updateUser = (updates) => {
    setUser((prevUser) => {
      const nextUser = { ...prevUser, ...updates };
      if (token) {
        persistAuthState(token, nextUser);
      }
      return nextUser;
    });
  };

  const logout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // noop
      }
    }

    setUser(null);
    setToken(null);
    clearAuthState();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        updateUser,
        startSocialLogin,
        completeSocialLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
