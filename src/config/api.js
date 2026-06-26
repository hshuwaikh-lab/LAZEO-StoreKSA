// API Configuration
// This file centralizes all API endpoints and can be easily updated

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

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
  
  // Products
  PRODUCTS: '/api/products',
  PRODUCT_DETAIL: (id) => `/api/products/${id}`,
  
  // Settings
  SETTINGS: '/api/settings',
  
  // Materials
  MATERIALS: '/api/materials',
  
  // Upload
  UPLOAD: '/api/upload',
  
  // Custom Orders
  CUSTOM_ORDERS: '/api/custom-order',
  
  // Checkout
  BANKS: '/api/banks',
  ORDERS: '/api/orders',
  
  // Shipping
  SHIPPING: '/api/shipping',
  
  // Admin
  ADMIN_USERS: '/api/admin/users',
  ADMIN_ORDERS: '/api/admin/orders',
  ADMIN_CUSTOM_ORDERS: '/api/admin/custom-orders',
  ADMIN_CUSTOM_ORDER_QUOTE: (id) => `/api/admin/custom-orders/${id}/quote`,
  ADMIN_SHIPPING: '/api/admin/shipping',
  ADMIN_BANKS: '/api/admin/banks',
  ADMIN_PRODUCTS: '/api/admin/products',
  ADMIN_MATERIALS: '/api/admin/materials',
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
