// API Configuration
// This file centralizes all API endpoints and can be easily updated

const getDefaultApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:5000';
  }

  const { hostname } = window.location;
  if (hostname.includes('github.io')) {
    return 'https://lazeo-storeksa-1.onrender.com';
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }

  return 'https://lazeo-storeksa-1.onrender.com';
};

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || getDefaultApiBaseUrl();

// Helper function to build API URLs
export const buildApiUrl = (endpoint) => {
  return `${API_BASE_URL}${endpoint}`;
};

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  SOCIAL_LOGIN: '/api/auth/social-login',
  FORGOT_PASSWORD: '/api/auth/forgot-password',

  // User
  USER_PROFILE: '/api/user/profile',
  USER_LOCATIONS: '/api/user/locations',
  USER_LOCATION_DETAIL: (id) => `/api/user/locations/${id}`,
  USER_ORDERS: '/api/user/orders',
  USER_CUSTOM_ORDERS: '/api/user/custom-orders',
  USER_PASSWORD: '/api/user/password',
  
  // Products
  PRODUCTS: '/api/products',
  PRODUCT_DETAIL: (id) => `/api/products/${id}`,
  
  // Settings
  SETTINGS: '/api/settings',
  
  // Materials
  MATERIALS: '/api/materials',
  
  // Upload
  UPLOAD: '/api/upload',
  UPLOAD_SIGNED_URL: '/api/upload/signed-url',
  
  // Custom Orders
  CUSTOM_ORDERS: '/api/custom-order',
  USER_CUSTOM_ORDER_ACCEPT: (id) => `/api/user/custom-orders/${id}/accept`,
  
  // Checkout
  BANKS: '/api/banks',
  ORDERS: '/api/orders',
  COUPON_VALIDATE: '/api/coupons/validate',
  
  // Shipping
  SHIPPING: '/api/shipping',
  SHIPPING_ESTIMATE: '/api/shipping/estimate',
  
  // Admin
  ADMIN_USERS: '/api/admin/users',
  ADMIN_USER_DELETE: (id) => `/api/admin/users/${id}`,
  ADMIN_CREATE_ADMIN: '/api/admin/create-admin',
  ADMIN_TOGGLE_USER_ACTIVE: (id) => `/api/admin/users/${id}/toggle-active`,
  ADMIN_USER_PASSWORD: (id) => `/api/admin/users/${id}/password`,
  ADMIN_ORDERS: '/api/admin/orders',
  ADMIN_ORDER_STATUS: (id) => `/api/admin/orders/${id}/status`,
  ADMIN_ORDER_INVOICE_PRINTED: (id) => `/api/admin/orders/${id}/invoice-printed`,
  ADMIN_CUSTOM_ORDERS: '/api/admin/custom-orders',
  ADMIN_CUSTOM_ORDER_QUOTE: (id) => `/api/admin/custom-orders/${id}/quote`,
  ADMIN_CUSTOM_ORDER_RETURN_TO_CLIENT: (id) => `/api/admin/custom-orders/${id}/return-to-client`,
  ADMIN_SHIPPING: '/api/admin/shipping',
  ADMIN_SHIPPING_DETAIL: (id) => `/api/admin/shipping/${id}`,
  ADMIN_BANKS: '/api/admin/banks',
  ADMIN_BANKS_DETAIL: (id) => `/api/admin/banks/${id}`,
  ADMIN_PRODUCTS: '/api/admin/products',
  ADMIN_PRODUCTS_DETAIL: (id) => `/api/admin/products/${id}`,
  ADMIN_MATERIALS: '/api/admin/materials',
  ADMIN_MATERIALS_DETAIL: (id) => `/api/admin/materials/${id}`,
  ADMIN_SETTINGS: '/api/admin/settings',
  ADMIN_STORAGE_HEALTH: '/api/admin/storage/health',
  ADMIN_COUPONS: '/api/admin/coupons',
  ADMIN_COUPON_DETAIL: (id) => `/api/admin/coupons/${id}`,
};

// Helper function for API calls
export const apiCall = async (endpoint, options = {}) => {
  const url = buildApiUrl(endpoint);
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    return response;
  } catch (error) {
    console.error(`API call failed for ${endpoint}:`, error);
    throw error;
  }
};

export default {
  API_BASE_URL,
  buildApiUrl,
  API_ENDPOINTS,
  apiCall,
};
