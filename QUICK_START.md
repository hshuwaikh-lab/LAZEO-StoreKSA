# Quick Start - نشر سريع 🚀

## الخيار 1: نشر GitHub Pages (واجهة أمامية فقط)

**الوقت المتوقع**: 5 دقائق
**المتطلبات**: لا شيء (npm مثبت بالفعل)

```bash
# 1. البناء
npm run build

# 2. النشر
npm run deploy

# ✅ تمت! الموقع متاح على:
# https://hshuwaikh-lab.github.io/LAZEO-StoreKSA/
```

**ملاحظة**: الـ API ستشير إلى `localhost:5000` (يجب تشغيل Express محلياً)

---

## الخيار 2: نشر Firebase (الكامل - API + واجهة)

**الوقت المتوقع**: 10-15 دقيقة
**المتطلبات**: حساب Google

### 2.1 التثبيت الأولي

```bash
# 1. تثبيت Firebase CLI
npm install -g firebase-tools

# 2. تسجيل الدخول (سيفتح متصفح)
firebase login

# 3. تثبيت حزم Cloud Functions
cd functions
npm install
cd ..
```

### 2.2 النشر

```bash
# 1. البناء
npm run build

# 2. النشر (تطبيق كامل)
firebase deploy

# ✅ تمت! ستشاهد:
# Hosting URL: https://hshuwaikh-lab.github.io/LAZEO-StoreKSA/
# Function URL: https://us-central1-laszeo-store-ksa.cloudfunctions.net/api
```

### 2.3 تحديث الـ API URL

```bash
# حرّر .env.production وغيّر:
VITE_API_BASE_URL=https://us-central1-laszeo-store-ksa.cloudfunctions.net/api

# أعد البناء والنشر
npm run build
firebase deploy
```

---

## الاختبار المحلي (اختياري)

```bash
# طريقة 1: Express Backend محلي
cd server
npm install
npm start
# API على: http://localhost:5000

# في terminal منفصل:
npm run dev
# Front على: http://localhost:5173
```

---

## حل مشاكل شائعة

### ❌ "firebase command not found"
```bash
# قد تحتاج لإعادة فتح terminal أو PowerShell
# أو استخدم npm directly:
npx firebase deploy
```

### ❌ "VITE_API_BASE_URL غير معرّف"
```bash
# تأكد من وجود .env.production
cat .env.production
# يجب أن يحتوي على VITE_API_BASE_URL
```

### ❌ "لا يمكن الوصول إلى API"
```bash
# تحقق من أن API URL صحيح:
curl https://us-central1-laszeo-store-ksa.cloudfunctions.net/api/settings

# أو بدّل إلى localhost للاختبار:
VITE_API_BASE_URL=http://localhost:5000
npm run build
```

---

## الخطوات التالية

✅ **تم**: نشر الواجهة الأمامية
✅ **تم**: إنشاء Cloud Functions
⏳ **التالي**: تفعيل Cloud Storage للتحميلات

---

## للمزيد من المعلومات

- `DEPLOYMENT_GUIDE.md` - دليل شامل
- `CLOUD_FUNCTIONS_DEPLOYMENT.md` - تفاصيل تقنية
- `functions/README.md` - توثيق API
- `README.md` - نظرة عامة المشروع
