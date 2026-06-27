import React, { createContext, useState, useEffect, useContext } from 'react';

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

  const currentTotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  const shippingCost = shippingMethod ? parseFloat(shippingMethod.price) : 0;
  const finalTotal = currentTotal + shippingCost;
  const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    currentTotal,
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
