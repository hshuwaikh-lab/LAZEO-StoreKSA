import React, { createContext, useState, useEffect } from 'react';
import { auth } from '../config/firebase';
import { deleteUser, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { loginUser, registerUser, signInWithGoogle, signInWithApple } from '../config/firebaseAuth';
import { apiCall, API_ENDPOINTS } from '../config/api';

const mapFirebaseAuthError = (error) => {
  const code = typeof error === 'string' ? error : error?.code;
  if (!code) return (error && error.message) || 'حدث خطأ في المصادقة';
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Firebase Error: تسجيل البريد/كلمة المرور غير مفعل. فعّل Email/Password في Firebase Console.';
    case 'auth/email-already-in-use':
      return 'هذا البريد الإلكتروني مسجل بالفعل في Firebase.';
    case 'auth/invalid-email':
      return 'البريد الإلكتروني غير صالح.';
    case 'auth/wrong-password':
      return 'كلمة المرور غير صحيحة.';
    case 'auth/user-not-found':
      return 'المستخدم غير موجود.';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة، استخدم 6 أحرف أو أكثر.';
    case 'auth/invalid-credential':
      return 'بيانات الاعتماد غير صحيحة. تأكد من البريد أو كلمة المرور أو أعد تحميل الصفحة.';
    case 'auth/too-many-requests':
      return 'تم حظر المحاولة مؤقتاً بسبب عدة محاولات فاشلة، حاول مرة أخرى بعد قليل.';
    default:
      return typeof error === 'string' ? error : (error && error.message) || 'حدث خطأ في Firebase Auth';
  }
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
      } catch (e) {
        console.error('Error parsing stored user data');
      }
    }

    // Only set up auth listener if auth is available
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (!firebaseUser) {
          setUser(null);
          setToken(null);
          clearAuthState();
        }
        setLoading(false);
      });

      return unsubscribe;
    } else {
      // If Firebase is not available, just mark loading as false
      setLoading(false);
    }
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

      const firebaseResult = await loginUser(email, password);
      if (!firebaseResult.success) {
        if (firebaseResult.error === 'auth/user-not-found') {
          const createResult = await registerUser(email, password);
          if (!createResult.success && createResult.error !== 'auth/email-already-in-use') {
            throw createResult.error;
          }
        } else {
          console.warn('Firebase sync failed after backend login:', firebaseResult.error);
        }
      }

      setToken(data.token);
      setUser(data.user);
      persistAuthState(data.token, data.user);

      return data.user;
    } catch (error) {
      throw new Error(mapFirebaseAuthError(error));
    }
  };

  const register = async (username, email, password, role = 'customer') => {
    try {
      const firebaseResult = await registerUser(email, password);
      if (!firebaseResult.success) {
        throw firebaseResult.error;
      }

      const response = await apiCall(API_ENDPOINTS.REGISTER, {
        method: 'POST',
        body: JSON.stringify({ username, email, password, role }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (auth.currentUser) {
          try {
            await deleteUser(auth.currentUser);
          } catch (deleteError) {
            console.warn('Failed to remove Firebase user after backend registration failure:', deleteError);
          }
        }
        await firebaseSignOut(auth);
        throw new Error(data.error || 'فشل إنشاء الحساب');
      }

      return await login(email, password);
    } catch (error) {
      throw new Error(mapFirebaseAuthError(error));
    }
  };

  const socialLogin = async (provider) => {
    try {
      let firebaseResult;
      if (provider === 'google') {
        firebaseResult = await signInWithGoogle();
      } else if (provider === 'apple') {
        firebaseResult = await signInWithApple();
      } else {
        throw new Error('الموفر غير مدعوم.');
      }

      if (!firebaseResult.success) {
        throw firebaseResult.error;
      }

      const firebaseUser = firebaseResult.user;
      if (!firebaseUser || !firebaseUser.email) {
        throw new Error('تعذر الحصول على البريد الإلكتروني من الموفر.');
      }

      const email = firebaseUser.email;
      const username = firebaseUser.displayName || email.split('@')[0];
      const response = await apiCall(API_ENDPOINTS.SOCIAL_LOGIN, {
        method: 'POST',
        body: JSON.stringify({
          provider,
          providerId: firebaseResult.providerId,
          email,
          username,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (auth.currentUser) {
          await firebaseSignOut(auth);
        }
        throw new Error(data.error || 'فشل تسجيل الدخول الاجتماعي');
      }

      setToken(data.token);
      setUser(data.user);
      persistAuthState(data.token, data.user);
      return data.user;
    } catch (error) {
      if (auth.currentUser) {
        try {
          await firebaseSignOut(auth);
        } catch (signOutError) {
          console.warn('Failed to sign out after social login error:', signOutError);
        }
      }
      throw new Error(mapFirebaseAuthError(error));
    }
  };

  const loginWithGoogle = () => socialLogin('google');
  const loginWithApple = () => socialLogin('apple');

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
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.warn('Firebase sign out failed:', error);
    }
    setUser(null);
    setToken(null);
    clearAuthState();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, loginWithGoogle, loginWithApple, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
