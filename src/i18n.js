import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translations
const resources = {
  ar: {
    translation: {
      "home": "الرئيسية",
      "shop": "تسوق",
      "custom_order": "طلب مخصص",
      "cart": "السلة",
      "hero_title": "أناقة الحفر الفاخر",
      "hero_subtitle": "نحول أفكارك إلى تحف فنية متقنة باستخدام أحدث تقنيات الحفر بالليزر",
      "shop_now": "تسوق الآن",
      "request_custom": "اطلب تصميمك",
      "footer_text": "© 2026 LAZEO StoreKSA. جميع الحقوق محفوظة.",
      "language": "English",
      "featured_products": "أحدث المنتجات",
      "add_to_cart": "أضف للسلة",
      "view_details": "التفاصيل",
      "cart_empty": "سلة المشتريات فارغة",
      "cart_empty_desc": "يبدو أنك لم تضف أي منتجات إلى سلتك حتى الآن.",
      "shopping_cart": "سلة المشتريات",
      "remove_item": "إزالة المنتج",
      "order_summary": "ملخص الطلب",
      "subtotal": "المجموع الفرعي",
      "shipping": "الشحن",
      "calculated_at_checkout": "يحسب عند الدفع",
      "total": "الإجمالي",
      "checkout_soon": "سيتم تفعيل الدفع قريباً!",
      "proceed_to_checkout": "إتمام الطلب",
      "product_not_found": "المنتج غير موجود",
      "back_to_shop": "العودة للمتجر",
      "quantity": "الكمية",
      "added_to_cart": "تمت الإضافة!",
      "view_cart": "عرض السلة",
      "currency": "ر.س",
      "product_note": "ملاحظة",
      "add_note_optional": "أضف ملاحظة (اختياري)",
      "login_required_checkout": "يجب تسجيل الدخول لإتمام الطلب"
    }
  },
  en: {
    translation: {
      "home": "Home",
      "shop": "Shop",
      "custom_order": "Custom Order",
      "cart": "Cart",
      "hero_title": "Premium Laser Engraving",
      "hero_subtitle": "We turn your ideas into masterpieces using state-of-the-art laser technology",
      "shop_now": "Shop Now",
      "request_custom": "Request Custom",
      "footer_text": "© 2026 LAZEO StoreKSA. All rights reserved.",
      "language": "العربية",
      "featured_products": "Featured Products",
      "add_to_cart": "Add to Cart",
      "view_details": "View Details",
      "cart_empty": "Your Cart is Empty",
      "cart_empty_desc": "Looks like you haven't added any items to your cart yet.",
      "shopping_cart": "Shopping Cart",
      "remove_item": "Remove Item",
      "order_summary": "Order Summary",
      "subtotal": "Subtotal",
      "shipping": "Shipping",
      "calculated_at_checkout": "Calculated at checkout",
      "total": "Total",
      "checkout_soon": "Checkout flow coming soon!",
      "proceed_to_checkout": "Proceed to Checkout",
      "product_not_found": "Product not found",
      "back_to_shop": "Back to Shop",
      "quantity": "Quantity",
      "added_to_cart": "Added to Cart!",
      "view_cart": "View Cart",
      "currency": "SAR",
      "product_note": "Note",
      "add_note_optional": "Add a note (optional)",
      "login_required_checkout": "You must log in to proceed to checkout"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "ar", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
