# LAZEO StoreKSA - النشر والاختبار

## ملخص الحالة الحالية

✅ **API Centralization**: جميع استدعاءات `localhost:5000` تم استبدالها بـ `src/config/api.js`
✅ **Cloud Functions**: تم إنشاء جميع endpoints في Firebase Cloud Functions
✅ **Firestore Database**: جاهز للاستخدام (بدون حاجة لتثبيت محلي)
⏳ **Deployment**: جاهز للنشر

---

## الخطوة 1️⃣: الاختبار المحلي (اختياري)

إذا كنت تريد اختبار Cloud Functions محلياً قبل النشر:

### 1.1 تثبيت Firebase Emulator

```bash
# تثبيت Firebase CLI بشكل عام
npm install -g firebase-tools

# أو إذا لم تتمكن من التثبيت العام:
npx firebase-tools --version
```

### 1.2 تسجيل الدخول إلى Firebase

```bash
firebase login
```

سيفتح نافذة متصفح لتسجيل الدخول إلى حسابك في Google.

### 1.3 بدء Firebase Emulator

```bash
# من مجلد المشروع الجذر
firebase emulators:start --only functions,firestore
```

سيظهر output مشابه لهذا:
```
✔  functions[api(us-central1)]: http function initialized (http://localhost:5001/laszeo-store-ksa/us-central1/api)
✔  firestore: listening on 127.0.0.1:8080
```

### 1.4 تحديث .env للاختبار المحلي

في `.env.local` أو `.env.development`:
```
VITE_API_BASE_URL=http://localhost:5001/laszeo-store-ksa/us-central1/api
```

### 1.5 بدء خادم التطوير

في terminal منفصل:
```bash
npm run dev
```

### 1.6 اختبار النقاط النهائية

```bash
# تسجيل مستخدم جديد
curl -X POST http://localhost:5001/laszeo-store-ksa/us-central1/api/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username":"test_user",
    "email":"test@example.com",
    "password":"password123"
  }'

# تسجيل الدخول
curl -X POST http://localhost:5001/laszeo-store-ksa/us-central1/api/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"password123"
  }'

# الحصول على المنتجات
curl http://localhost:5001/laszeo-store-ksa/us-central1/api/api/products

# الحصول على الإعدادات
curl http://localhost:5001/laszeo-store-ksa/us-central1/api/api/settings
```

### 1.7 عرض البيانات في Firestore

في browser، انتقل إلى:
```
http://localhost:4000
```

ستجد Firestore Emulator UI حيث يمكنك رؤية جميع المجموعات والمستندات.

---

## الخطوة 2️⃣: النشر إلى Firebase Production

### 2.1 تثبيت Firebase CLI

```bash
npm install -g firebase-tools
```

أو إذا واجهت مشاكل في الأمان (PowerShell):
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
npm install -g firebase-tools
```

### 2.2 تسجيل الدخول إلى Firebase

```bash
firebase login
```

### 2.3 تثبيت حزم Cloud Functions

```bash
cd functions
npm install
cd ..
```

### 2.4 إنشاء ملف .env للـ Functions (اختياري)

```bash
cd functions
cp .env.example .env
# عدّل .env وأضف:
# JWT_SECRET=your_secure_secret_key_here
```

للإنتاج، قم بتعيين المتغيرات عبر Firebase:
```bash
firebase functions:config:set jwt.secret="your_secure_secret_key"
```

### 2.5 بناء التطبيق الأمامي

```bash
npm run build
```

سينشئ مجلد `dist/` بالأصول المُجمعة.

### 2.6 نشر كل شيء إلى Firebase

```bash
firebase deploy
```

**ملاحظة**: قد تُطالب بإدخال تفاصيل المشروع. اختر `laszeo-store-ksa`.

### 2.7 الحصول على عنوان URL الخاص بالـ Functions

بعد النشر بنجاح، سترى output يشبه هذا:

```
Function URL (api(us-central1)): 
https://us-central1-laszeo-store-ksa.cloudfunctions.net/api

Hosting URL: https://hshuwaikh-lab.github.io/LAZEO-StoreKSA/
```

### 2.8 تحديث ملف .env.production

تحديث `VITE_API_BASE_URL` بـ URL الفعلي:

```
VITE_API_BASE_URL=https://us-central1-laszeo-store-ksa.cloudfunctions.net/api
```

### 2.9 إعادة البناء والنشر

```bash
# إعادة البناء بـ API URL الصحيح
npm run build

# نشر إلى GitHub Pages
npm run deploy
```

---

## الخطوة 3️⃣: التحقق من النشر

### 3.1 فحص سجلات الـ Functions

```bash
firebase functions:log
```

### 3.2 اختبار نقطة نهائية إنتاجية

```bash
# التحقق من الإعدادات
curl https://us-central1-laszeo-store-ksa.cloudfunctions.net/api/api/settings

# محاولة تسجيل مستخدم
curl -X POST https://us-central1-laszeo-store-ksa.cloudfunctions.net/api/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username":"test",
    "email":"test@example.com",
    "password":"test123"
  }'
```

### 3.3 اختبار في المتصفح

زر: https://hshuwaikh-lab.github.io/LAZEO-StoreKSA/

جرب:
- إنشاء حساب جديد
- تسجيل الدخول
- عرض المنتجات
- جميع المميزات الأخرى

---

## الخطوة 4️⃣: تكوين Cloud Storage للتحميلات (اختياري)

الـ `/api/upload` endpoint حالياً يعيد placeholder. لتفعيل تحميل الملفات فعلياً:

### 4.1 تفعيل Cloud Storage في Firebase Console

1. انتقل إلى: https://console.firebase.google.com/
2. اختر `laszeo-store-ksa`
3. انتقل إلى Storage → بدء البدء
4. اقبل القواعس الافتراضية

### 4.2 تثبيت حزم Storage

```bash
cd functions
npm install @google-cloud/storage
cd ..
```

### 4.3 تحديث handlers التحميل

في `functions/index.js`، استبدل placeholder upload handler بـ:

```javascript
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucket = storage.bucket('laszeo-store-ksa.appspot.com');

app.post('/api/upload', authenticateToken, async (req, res) => {
  try {
    // استخدم multer مع Cloud Storage adapter
    // أو استخدم Firebase Admin SDK
    const file = bucket.file(`uploads/${Date.now()}-${req.file.originalname}`);
    
    const fileUrl = `https://storage.googleapis.com/laszeo-store-ksa.appspot.com/uploads/${Date.now()}-${req.file.originalname}`;
    res.json({ url: fileUrl });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});
```

---

## استكشاف الأخطاء والمشاكل

### مشكلة: أخطاء CORS

**الحل**:
- تأكد من تفعيل CORS في `functions/index.js` (مفعل بالفعل)
- تحقق من console logs للأخطاء الفعلية

### مشكلة: فشل المصادقة

**الحل**:
- تحقق من أن `JWT_SECRET` متسق بين المحلي والإنتاج
- استخدم `firebase functions:log` للتصحيح

### مشكلة: Firestore غير قابل للوصول

**الحل**:
- تحقق من قواعس Firestore في Firebase Console
- للاختبار: اسمح بقراءة/كتابة عامة مؤقتاً

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // للاختبار فقط!
    }
  }
}
```

للإنتاج: استخدم قواعس أكثر أماناً:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // السماح للمستخدمين المصرح بهم فقط
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }
    match /products/{document=**} {
      allow read: if true;
      allow write: if request.auth.token.role == 'admin';
    }
    match /orders/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

### مشكلة: عدم تحديث الـ API URL

**الحل**:
1. تحديث `.env.production` بـ URL الصحيح
2. تشغيل `npm run build` لإعادة البناء
3. تشغيل `npm run deploy` لنشر الأصول الجديدة

---

## المراقبة والسجلات

### عرض وظائف السجلات

```bash
firebase functions:log
```

### عرض مقاييس الأداء

في Firebase Console:
1. انتقل إلى Functions
2. اختر الدالة
3. انظر إلى التكاليف والمقاييس

---

## إدارة التكاليف

**الطبقة المجانية تشمل**:
- 2 مليون invocation شهرياً
- 400000 GB-seconds من الحساب
- 5GB من نقل البيانات

لتقليل التكاليف:
- حسّن وقت تنفيذ الوظائف
- استخدم caching
- قلل حجم الكود

---

## الخطوات التالية

✅ API Centralization
✅ Cloud Functions Created  
⏳ **Deploy to Firebase** (أنت هنا)
⏳ Configure Storage
⏳ Optimize & Monitor

---

## ملفات مساعدة

- `deploy.bat` - Script نشر سريع (Windows)
- `deploy.ps1` - Script نشر (PowerShell)
- `CLOUD_FUNCTIONS_DEPLOYMENT.md` - دليل تفصيلي آخر
- `functions/README.md` - توثيق الوظائف
