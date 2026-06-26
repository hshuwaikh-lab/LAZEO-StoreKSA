# Pre-Deployment Checklist ✅

تحقق من جميع العناصر قبل النشر للإنتاج.

---

## ✅ كود الواجهة الأمامية

- [ ] جميع الملفات المحلية تم حفظها (Ctrl+S)
- [ ] لا توجد أخطاء في console (F12)
- [ ] جميع الصور تحميل بشكل صحيح
- [ ] الاستجابة تعمل على جميع الأجهزة (موبايل/تابلت)
- [ ] جميع الروابط تعمل بشكل صحيح
- [ ] لا توجد typos أو أخطاء إملائية

---

## ✅ الـ API والإعدادات

- [ ] `src/config/api.js` يحتوي على جميع الـ endpoints
- [ ] `VITE_API_BASE_URL` معرّف في `.env.production`
- [ ] جميع استدعاءات `fetch` تستخدم `buildApiUrl(API_ENDPOINTS.XXX)`
- [ ] لا توجد hardcoded URLs في الكود

---

## ✅ Firebase وAuthentication

- [ ] `src/config/firebase.js` تم تحديثه بـ بيانات صحيحة
- [ ] `.env.production` يحتوي على جميع `VITE_FIREBASE_*` variables
- [ ] Firebase Authentication مفعّل في Firebase Console
- [ ] جميع providers مفعّلة (Email/Password, Google, Apple)

---

## ✅ Cloud Functions

- [ ] `functions/index.js` يحتوي على جميع endpoints
- [ ] `functions/package.json` يحتوي على جميع dependencies
- [ ] `.env` في مجلد functions معرّف (JWT_SECRET)
- [ ] جميع الـ imports صحيحة في functions

---

## ✅ البناء والنشر

- [ ] تم تشغيل `npm run build` بنجاح
- [ ] مجلد `dist/` موجود وليس فارغ
- [ ] `.gitignore` يستبعد الملفات الحساسة
- [ ] `firebase.json` معرّف بشكل صحيح

---

## ✅ قاعدة البيانات

- [ ] Firestore مفعّل في Firebase Project
- [ ] قواعس قاعدة البيانات معرّفة (للأمان)
- [ ] المجموعات المطلوبة موجودة أو ستُنشأ تلقائياً

---

## ✅ الأمان والخصوصية

- [ ] JWT_SECRET قوي ومختلف عن القيمة الافتراضية
- [ ] كلمات المرور مشفّرة (bcryptjs)
- [ ] لا توجد بيانات حساسة في الكود العام
- [ ] `.env.production` في `.gitignore`
- [ ] Firebase rules تحمي البيانات الحساسة

---

## ✅ الاختبار الأساسي

قبل النشر النهائي:

```bash
# اختبر البناء
npm run build

# تحقق من عدم وجود أخطاء
npm run lint  # إذا كان معرّفاً

# اختبر التطبيق محلياً
npm run dev
# تفحص جميع الصفحات في http://localhost:5173
```

### نقاط الاختبار:
- [ ] الصفحة الرئيسية تحمل بشكل صحيح
- [ ] يمكن إنشاء حساب جديد
- [ ] يمكن تسجيل الدخول
- [ ] المنتجات تحمل من API
- [ ] يمكن إضافة إلى السلة
- [ ] يمكن عرض ملف الشخصي
- [ ] Admin dashboard يعمل

---

## ✅ قبل GitHub Pages Deployment

```bash
# تحقق من اسم المستخدم صحيح
# في package.json:
# "homepage": "https://hshuwaikh-lab.github.io/LAZEO-StoreKSA/"
# (ليس hshuwaith أو غيره)

# النشر
npm run deploy
```

---

## ✅ قبل Firebase Deployment

```bash
# تسجيل الدخول
firebase login

# اختبر محلياً (اختياري)
firebase emulators:start --only functions,firestore

# في terminal منفصل:
npm run dev
# Test endpoints

# نشر فعلي
firebase deploy
```

---

## 🚨 أشياء يجب تجنبها

❌ **لا تفعل**:
- عدم البناء قبل النشر
- نشر بدون اختبار شامل
- hardcoding URLs في الكود
- حفظ بيانات حساسة في الـ frontend
- نسيان تحديث `.env.production`
- نشر بدون `.gitignore` مناسب

✅ **افعل**:
- اختبر جميع الميزات محلياً أولاً
- تحقق من Console logs للأخطاء
- استخدم المتغيرات المركزية
- احفظ كل شيء آمناً
- عدّل البيئات المختلفة
- تتبع التغييرات بـ Git

---

## خطوات نشر سريعة

```bash
# 1. البناء
npm run build

# 2. GitHub Pages (اختياري)
npm run deploy

# 3. Firebase (الكامل)
firebase deploy

# 4. التحقق
firebase functions:log
```

---

## بعد النشر

- [ ] تحقق من الموقع المنشور في المتصفح
- [ ] اختبر تسجيل الدخول
- [ ] تحقق من سجلات Functions
- [ ] راقب الأداء في Firebase Console
- [ ] اطلب من أشخاص آخرين اختبار الموقع

---

## معلومات الاتصال النهائية

**Hostname**: laszeo-store-ksa
**GitHub**: https://github.com/hshuwaikh-lab/LAZEO-StoreKSA
**Live Site**: https://hshuwaikh-lab.github.io/LAZEO-StoreKSA/
**API**: https://us-central1-laszeo-store-ksa.cloudfunctions.net/api

---

✨ **جاهز للنشر!** اتبع الخطوات فوق وستكون جاهزاً.
