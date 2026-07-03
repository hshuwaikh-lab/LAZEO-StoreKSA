import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { decorateProductPricing } from '../utils/offers';
import { calculateCouponDiscount } from '../utils/coupons';

// Create a context for the shopping cart
const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  // Try to load cart from local storage, else empty array
  const [cartItems, setCartItems] = useState(() => {
    try {
      const savedCart = localStorage.getItem('lazeo_cart');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (e) {
      console.error('Failed to parse cart from local storage', e);
      return [];
    }
  });

  // Save cart to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem('lazeo_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  const [shippingMethod, setShippingMethod] = useState(null);
  const [appliedCoupon, setAppliedCoupon] = useState(() => {
    try {
      const savedCoupon = localStorage.getItem('lazeo_coupon');
      return savedCoupon ? JSON.parse(savedCoupon) : null;
    } catch (e) {
      console.error('Failed to parse coupon from local storage', e);
      return null;
    }
  });

  const pricedCartItems = cartItems.map((item) => decorateProductPricing(item, { quantity: item.quantity }));

  const addToCart = (product, quantity = 1, note = '') => {
    setCartItems(prevItems => {
      // Find item with same id AND same note
      const existingItem = prevItems.find(item => item.id === product.id && (item.note || '') === note);
      if (existingItem) {
        return prevItems.map(item =>
          (item.cartItemId || item.id) === (existingItem.cartItemId || existingItem.id)
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prevItems, { ...product, quantity, note, cartItemId: Date.now().toString() + Math.random() }];
    });
  };

  const removeFromCart = (cartItemId) => {
    setCartItems(prevItems => prevItems.filter(item => (item.cartItemId || item.id) !== cartItemId));
  };

  const updateQuantity = (cartItemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setCartItems(prevItems =>
      prevItems.map(item =>
        (item.cartItemId || item.id) === cartItemId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const applyCoupon = useCallback((coupon) => {
    setAppliedCoupon(coupon || null);
  }, []);

  const clearCoupon = useCallback(() => {
    setAppliedCoupon(null);
  }, []);

  const currentTotal = pricedCartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  const couponDiscount = calculateCouponDiscount({ subtotal: currentTotal, coupon: appliedCoupon });
  const discountedSubtotal = Math.max(0, Number((currentTotal - couponDiscount).toFixed(2)));
  const shippingCost = shippingMethod ? parseFloat(shippingMethod.price) : 0;
  const finalTotal = discountedSubtotal + shippingCost;
  const totalItems = pricedCartItems.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    localStorage.setItem('lazeo_coupon', JSON.stringify(appliedCoupon));
  }, [appliedCoupon]);

  const value = {
    cartItems: pricedCartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    appliedCoupon,
    applyCoupon,
    clearCoupon,
    currentTotal,
    couponDiscount,
    discountedSubtotal,
    shippingMethod,
    setShippingMethod,
    shippingCost,
    finalTotal,
    totalItems
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
