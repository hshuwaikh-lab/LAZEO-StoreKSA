# LAZEO StoreKSA 🛍️

متجر إلكتروني حديث بـ React + Vite مع Firebase Cloud Functions كواجهة برمجية.

## 🎯 المميزات الرئيسية

- ✅ واجهة مستخدم حديثة مع React 19 و Vite 8
- ✅ نظام مصادقة مع Firebase Authentication
- ✅ API مركزية في Cloud Functions
- ✅ نشر سهل إلى GitHub Pages
- ✅ دعم اللغة العربية
- ✅ نظام الطلبات والفواتير

## 🏗️ بنية المشروع

```
LAZEO-StoreKSA/
├── src/                          # كود React الأساسي
│   ├── config/
│   │   ├── api.js               # ⭐ API Configuration (نقطة مركزية)
│   │   ├── firebase.js          # Firebase Initialization
│   │   └── firebaseAuth.js      # Firebase Auth Functions
│   ├── context/
│   │   ├── AuthContext.jsx      # إدارة المصادقة
│   │   └── CartContext.jsx      # إدارة السلة
│   ├── components/              # المكونات المشتركة
│   └── pages/                   # صفحات التطبيق
├── server/                       # ⚠️ Express Backend (Legacy)
│   └── index.js                 # يتم استبداله بـ Cloud Functions
├── functions/                    # ⭐ Firebase Cloud Functions
│   ├── index.js                 # API Routes
│   └── package.json
├── public/                       # الأصول الثابتة
├── .env.production              # متغيرات الإنتاج
├── DEPLOYMENT_GUIDE.md          # 📖 دليل النشر الشامل
└── CLOUD_FUNCTIONS_DEPLOYMENT.md # 📖 دليل Cloud Functions

```

## 🚀 البدء السريع

### المتطلبات
- Node.js 18+
- حساب Firebase (اختياري للاختبار المحلي)
- Git

### التثبيت

```bash
# استنساخ المستودع
git clone https://github.com/hshuwaikh-lab/LAZEO-StoreKSA.git
cd LAZEO-StoreKSA

# تثبيت الحزم
npm install

# للـ Cloud Functions
cd functions
npm install
cd ..
```

### التطوير المحلي

```bash
# تشغيل خادم Vite
npm run dev

# سيفتح على: http://localhost:5173
```

### البناء للإنتاج

```bash
npm run build
```

---

## 🔌 بنية API

### المركزية 🎯

جميع استدعاءات API تمر عبر `src/config/api.js`:

```javascript
// ❌ لا تستخدم:
fetch('http://localhost:5000/api/products')

// ✅ استخدم:
import { buildApiUrl, API_ENDPOINTS } from '../config/api';
fetch(buildApiUrl(API_ENDPOINTS.PRODUCTS))
```

### النقاط النهائية الرئيسية

**المصادقة**
- `POST /api/auth/register` - إنشاء حساب
- `POST /api/auth/login` - تسجيل الدخول
- `POST /api/auth/social-login` - تسجيل عبر Google/Apple

**المنتجات**
- `GET /api/products` - قائمة المنتجات
- `GET /api/products/:id` - تفاصيل المنتج
- `POST /api/admin/products` - إضافة منتج (Admin)

**الطلبات**
- `POST /api/orders` - إنشاء طلب
- `GET /api/user/orders` - طلبات المستخدم
- `GET /api/admin/orders` - جميع الطلبات (Admin)

**المزيد في:**
- `functions/README.md` - التوثيق الكامل للـ API
- `CLOUD_FUNCTIONS_DEPLOYMENT.md` - دليل النشر

---

## 📲 قاعدة البيانات

### التطوير المحلي (SQLite)
```bash
cd server
npm install
npm start
# API على: http://localhost:5000
```

### الإنتاج (Firestore)
تُستخدم Firebase Firestore تلقائياً عند النشر إلى Cloud Functions.

**المجموعات**:
- `users` - حسابات المستخدمين
- `products` - المنتجات
- `orders` - الطلبات
- `customOrders` - الطلبات المخصصة
- `shippingMethods` - طرق الشحن
- `bankAccounts` - حسابات البنوك

---

## 🔐 المصادقة

### Firebase Authentication

```javascript
import { loginUser, registerUser } from '../config/firebaseAuth';

// التسجيل
const result = await registerUser(email, password);

// تسجيل الدخول
const result = await loginUser(email, password);
```

### بيانات الاعتماد الافتراضية (بيئة التطوير)

```
Email: admin@lazeo.com
Password: admin123
```

للإنتاج: غيّر في Firebase Console

---

## 🌐 النشر

### الخيار 1: GitHub Pages (الواجهة الأمامية فقط)

```bash
npm run build
npm run deploy
# تُنشر على: https://hshuwaikh-lab.github.io/LAZEO-StoreKSA/
```

### الخيار 2: Firebase (الكامل - الواجهة + API)

```bash
# 1. تثبيت Firebase CLI
npm install -g firebase-tools

# 2. تسجيل الدخول
firebase login

# 3. النشر
firebase deploy

# API على: https://us-central1-laszeo-store-ksa.cloudfunctions.net/api
```

**📖 دليل النشر الشامل**: انظر `DEPLOYMENT_GUIDE.md`

---

## 🛠️ الأدوات والتقنيات

| الفئة | التقنيات |
|------|---------|
| **الواجهة الأمامية** | React 19, Vite, React Router |
| **الأسلوب** | CSS3, Tailwind (اختياري) |
| **المصادقة** | Firebase Authentication |
| **قاعدة البيانات** | Firestore (Cloud), SQLite (Local) |
| **الخادم** | Express.js (Local), Cloud Functions (Production) |
| **الموارد** | Google Cloud Storage |

---

## 📚 التوثيق

- **DEPLOYMENT_GUIDE.md** - دليل شامل لجميع خطوات النشر
- **CLOUD_FUNCTIONS_DEPLOYMENT.md** - تفاصيل Cloud Functions
- **functions/README.md** - توثيق API الكاملة
- **SECURITY.md** - معلومات الأمان والخصوصية

---

## 🐛 استكشاف الأخطاء

### API غير متاح

```bash
# تحقق من VITE_API_BASE_URL في .env.production
# أو استخدم المحلي:
VITE_API_BASE_URL=http://localhost:5000
```

### أخطاء CORS

- تأكد من تفعيل CORS في `functions/index.js`
- التحقق من قائمة البيض للنطاقات المسموحة

### مشاكل في المصادقة

```bash
# تحقق من سجلات Firebase
firebase functions:log
```

---

## 📊 الإحصائيات

- **المنتجات**: +50 منتج متاح
- **المستخدمون**: نظام إدارة مستخدمين كامل
- **الفواتير**: طباعة وتصدير تلقائي
- **الشحن**: تكامل مع طرق شحن متعددة

---

## 🤝 المساهمة

نرحب بالمساهمات! يرجى:
1. Fork المشروع
2. إنشاء فرع للميزة (`git checkout -b feature/amazing`)
3. Commit التغييرات (`git commit -m 'Add amazing feature'`)
4. Push إلى الفرع (`git push origin feature/amazing`)
5. فتح Pull Request

---

## 📄 الترخيص

هذا المشروع مرخص تحت MIT License

---

## 📞 الدعم

للمساعدة والأسئلة:
- GitHub Issues
- البريد الإلكتروني: support@lazeo.com

---

## 🎯 الخطوات التالية

- [ ] اختبار محلي شامل
- [ ] النشر إلى Firebase
- [ ] تفعيل Cloud Storage للتحميلات
- [ ] إعداد قواعس الأمان
- [ ] المراقبة والتحسينات

**ابدأ الآن**: اتبع `DEPLOYMENT_GUIDE.md` 🚀
