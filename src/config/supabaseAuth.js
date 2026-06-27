import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isPlaceholderAnonKey = !supabaseAnonKey || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY';
const isLikelyJwt = Boolean(supabaseAnonKey && supabaseAnonKey.includes('.'));

export const isSupabaseAuthConfigured = Boolean(supabaseUrl && !isPlaceholderAnonKey && isLikelyJwt);

export const supabase = isSupabaseAuthConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const getSupabaseAuthConfigError = () => {
  if (!supabaseUrl) {
    return 'VITE_SUPABASE_URL غير مضبوط.';
  }

  if (isPlaceholderAnonKey || !isLikelyJwt) {
    return 'VITE_SUPABASE_ANON_KEY غير صالح أو ما زال قيمة مؤقتة.';
  }

  return null;
};

export const getSocialRedirectUrl = (path = '/login') => {
  if (typeof window === 'undefined') return undefined;

  const basePath = import.meta.env.BASE_URL || '/';
  const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;

  return `${window.location.origin}${normalizedBasePath}${normalizedPath}`;
};
