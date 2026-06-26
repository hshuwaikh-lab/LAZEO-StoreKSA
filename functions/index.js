const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Create Express app
const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

const SECRET_KEY = process.env.JWT_SECRET || 'lazeo_super_secret_key_123';

// --- Auth Middleware ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      console.error("JWT Verification failed:", err.message);
      return res.status(403).json({ error: "Forbidden: " + err.message });
    }
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  next();
}

// --- Helper Functions ---
async function ensureAdminUser() {
  const adminEmail = 'admin@lazeo.com';
  const adminUsername = 'Admin Lazeo';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  try {
    const adminDoc = await db.collection('users').where('email', '==', adminEmail).get();
    if (adminDoc.empty) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await db.collection('users').add({
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Admin account created: ${adminEmail}`);
    }
  } catch (error) {
    console.error('Error ensuring admin user exists:', error);
  }
}

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, role, receiveWhatsApp } = req.body;
  try {
    const existingUser = await db.collection('users').where('email', '==', email).get();
    if (!existingUser.empty) {
      return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    let userRole = 'customer';
    if (role === 'admin') {
      if (req.body.adminSecret !== 'LazeoAdmin2026') {
        return res.status(403).json({ error: 'رمز الإدارة السري غير صحيح' });
      }
      userRole = 'admin';
    }

    const newUser = {
      username,
      email,
      password: hashedPassword,
      role: userRole,
      receiveWhatsApp: receiveWhatsApp !== undefined ? receiveWhatsApp : true,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('users').add(newUser);
    res.status(201).json({ message: 'تم إنشاء الحساب بنجاح', user: { id: docRef.id, role: userRole } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userSnapshot = await db.collection('users').where('email', '==', email).get();
    if (userSnapshot.empty) {
      return res.status(400).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const userDoc = userSnapshot.docs[0];
    const user = userDoc.data();

    if (!user.isActive) {
      return res.status(403).json({ error: 'الحساب غير مفعل. يرجى التواصل مع الإدارة.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const token = jwt.sign(
      { id: userDoc.id, role: user.role, username: user.username },
      SECRET_KEY,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: {
        id: userDoc.id,
        username: user.username,
        role: user.role,
        email: user.email
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});

app.post('/api/auth/social-login', async (req, res) => {
  const { provider, providerId, email, username } = req.body;
  if (!provider || !providerId || !email) {
    return res.status(400).json({ error: 'بيانات تسجيل الدخول الاجتماعي غير مكتملة' });
  }

  try {
    let userSnapshot = await db.collection('users').where('email', '==', email).get();
    let user, userId;

    if (userSnapshot.empty) {
      const randomPassword = Math.random().toString(36).slice(-16);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      const newUserData = {
        username: username || email.split('@')[0],
        email,
        password: hashedPassword,
        role: 'customer',
        provider,
        providerId,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      const docRef = await db.collection('users').add(newUserData);
      userId = docRef.id;
      user = newUserData;
    } else {
      const userDoc = userSnapshot.docs[0];
      userId = userDoc.id;
      user = userDoc.data();

      if (!user.provider || !user.providerId) {
        await db.collection('users').doc(userId).update({
          provider,
          providerId
        });
        user.provider = provider;
        user.providerId = providerId;
      }
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'الحساب غير مفعل. يرجى التواصل مع الإدارة.' });
    }

    const token = jwt.sign(
      { id: userId, role: user.role, username: user.username },
      SECRET_KEY,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: {
        id: userId,
        username: user.username,
        role: user.role,
        email: user.email
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});

// --- Products Routes ---
app.get('/api/products', async (req, res) => {
  try {
    const snapshot = await db.collection('products').orderBy('createdAt', 'desc').get();
    const products = [];
    snapshot.forEach(doc => {
      products.push({ id: doc.id, ...doc.data() });
    });
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const doc = await db.collection('products').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Product not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/products', authenticateToken, requireAdmin, async (req, res) => {
  const { nameAr, nameEn, price, image, descriptionAr, descriptionEn, category } = req.body;
  try {
    const newProduct = {
      nameAr,
      nameEn,
      price: parseFloat(price),
      image,
      descriptionAr,
      descriptionEn,
      category,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    const docRef = await db.collection('products').add(newProduct);
    res.status(201).json({ id: docRef.id, ...newProduct });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Materials Routes ---
app.get('/api/materials', async (req, res) => {
  try {
    const snapshot = await db.collection('materials').orderBy('createdAt', 'desc').get();
    const materials = [];
    snapshot.forEach(doc => {
      materials.push({ id: doc.id, ...doc.data() });
    });
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/materials', authenticateToken, requireAdmin, async (req, res) => {
  const { nameAr, nameEn } = req.body;
  try {
    const newMaterial = {
      nameAr,
      nameEn,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    const docRef = await db.collection('materials').add(newMaterial);
    res.status(201).json({ id: docRef.id, ...newMaterial });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Shipping Routes ---
app.get('/api/shipping', async (req, res) => {
  try {
    const snapshot = await db.collection('shippingMethods').get();
    const shipping = [];
    snapshot.forEach(doc => {
      shipping.push({ id: doc.id, ...doc.data() });
    });
    res.json(shipping);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/shipping', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('shippingMethods').get();
    const shipping = [];
    snapshot.forEach(doc => {
      shipping.push({ id: doc.id, ...doc.data() });
    });
    res.json(shipping);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/shipping', authenticateToken, requireAdmin, async (req, res) => {
  const { name, price, estimatedDays, logoUrl } = req.body;
  try {
    const newMethod = {
      name,
      price: parseFloat(price),
      estimatedDays,
      logoUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    const docRef = await db.collection('shippingMethods').add(newMethod);
    res.status(201).json({ id: docRef.id, ...newMethod });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Banks Routes ---
app.get('/api/banks', async (req, res) => {
  try {
    const snapshot = await db.collection('bankAccounts').get();
    const banks = [];
    snapshot.forEach(doc => {
      banks.push({ id: doc.id, ...doc.data() });
    });
    res.json(banks);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/banks', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('bankAccounts').get();
    const banks = [];
    snapshot.forEach(doc => {
      banks.push({ id: doc.id, ...doc.data() });
    });
    res.json(banks);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/banks', authenticateToken, requireAdmin, async (req, res) => {
  const { bankName, accountName, accountNumber, iban, logoUrl } = req.body;
  try {
    const newBank = {
      bankName,
      accountName,
      accountNumber,
      iban,
      logoUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    const docRef = await db.collection('bankAccounts').add(newBank);
    res.status(201).json({ id: docRef.id, ...newBank });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Orders Routes ---
app.get('/api/user/orders', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('orders')
      .where('userId', '==', req.user.id)
      .orderBy('createdAt', 'desc')
      .get();
    
    const orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/orders', authenticateToken, async (req, res) => {
  const { items, totalAmount, bankId, receiptUrl, receiptText } = req.body;
  try {
    const newOrder = {
      userId: req.user.id,
      items: JSON.stringify(items),
      totalAmount: parseFloat(totalAmount),
      bankId,
      receiptUrl,
      receiptText,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    const docRef = await db.collection('orders').add(newOrder);
    res.status(201).json({ id: docRef.id, ...newOrder });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('orders')
      .orderBy('createdAt', 'desc')
      .get();
    
    const orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Custom Orders Routes ---
app.post('/api/custom-order', authenticateToken, async (req, res) => {
  const { material, details, attachmentUrl, attachmentText } = req.body;
  try {
    const newOrder = {
      userId: req.user.id,
      material,
      details,
      attachmentUrl,
      attachmentText,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    const docRef = await db.collection('customOrders').add(newOrder);
    res.status(201).json({ id: docRef.id, ...newOrder });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/user/custom-orders', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('customOrders')
      .where('userId', '==', req.user.id)
      .orderBy('createdAt', 'desc')
      .get();
    
    const orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/custom-orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('customOrders')
      .orderBy('createdAt', 'desc')
      .get();
    
    const orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/custom-orders/:id/quote', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { priceQuote } = req.body;
  try {
    await db.collection('customOrders').doc(id).update({
      priceQuote: parseFloat(priceQuote),
      status: 'priced'
    });
    const updated = await db.collection('customOrders').doc(id).get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Settings Routes ---
app.get('/api/settings', async (req, res) => {
  try {
    const doc = await db.collection('storeSettings').doc('config').get();
    if (!doc.exists) {
      // Return default settings if not found
      return res.json({
        whatsappNumber: '',
        whatsappToken: '',
        snapchatUrl: '',
        instagramUrl: ''
      });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
  const { whatsappNumber, whatsappToken, snapchatUrl, instagramUrl } = req.body;
  try {
    const settingsData = {
      whatsappNumber,
      whatsappToken,
      snapchatUrl,
      instagramUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('storeSettings').doc('config').set(settingsData, { merge: true });
    res.json({ id: 'config', ...settingsData });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Upload Route (Placeholder) ---
app.post('/api/upload', authenticateToken, async (req, res) => {
  // In production, use Firebase Storage or Cloud Storage
  // For now, return a placeholder URL
  res.json({
    url: 'https://storage.googleapis.com/laszeo-store-ksa.appspot.com/placeholder.jpg',
    message: 'Upload functionality needs to be configured with Cloud Storage'
  });
});

// --- Admin Users Routes ---
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const users = [];
    snapshot.forEach(doc => {
      const user = doc.data();
      users.push({
        id: doc.id,
        username: user.username,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        createdAt: user.createdAt,
        isActive: user.isActive,
        receiveWhatsApp: user.receiveWhatsApp
      });
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Export the Cloud Function
exports.api = functions.https.onRequest(app);
