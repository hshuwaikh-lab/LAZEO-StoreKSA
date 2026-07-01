const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || 'lazeo_super_secret_key_123';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'lazeo-uploads';
const MAX_UPLOAD_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10', 10);
const isSupabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const maxUploadSizeBytes = Number.isNaN(MAX_UPLOAD_SIZE_MB)
  ? 10 * 1024 * 1024
  : Math.max(MAX_UPLOAD_SIZE_MB, 1) * 1024 * 1024;
const allowedUploadMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain'
]);

const supabase = isSupabaseEnabled
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'lazeo-storeksa-api' });
});

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadSizeBytes },
  fileFilter: (req, file, cb) => {
    if (!allowedUploadMimeTypes.has(file.mimetype)) {
      return cb(new Error('نوع الملف غير مدعوم'));
    }
    return cb(null, true);
  }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

function buildSafeFileName(originalName) {
  const extension = path.extname(originalName || '').toLowerCase();
  const baseName = path
    .basename(originalName || 'file', extension)
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);

  return `${Date.now()}-${baseName || 'file'}${extension}`;
}

function shouldFallbackToLocalStorage(error) {
  if (!error) return false;

  const statusCode = String(error.statusCode || error.status || '');
  const message = String(error.message || '').toLowerCase();
  return statusCode === '404' || message.includes('bucket not found') || message.includes('not found');
}

async function uploadFileToLocal(req, fileName) {
  const localPath = path.join(uploadsDir, fileName);
  await fs.promises.writeFile(localPath, req.file.buffer);
  const localUrl = `${req.protocol}://${req.get('host')}/uploads/${fileName}`;
  return localUrl;
}

function extractSupabaseStoragePath(fileUrl) {
  if (!isSupabaseEnabled || !fileUrl) return null;

  try {
    const parsed = new URL(fileUrl);
    const marker = `/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/`;
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) {
      return null;
    }

    return parsed.pathname.slice(markerIndex + marker.length);
  } catch (error) {
    return null;
  }
}

async function deleteSupabaseFileByUrl(fileUrl) {
  const storagePath = extractSupabaseStoragePath(fileUrl);
  if (!storagePath) {
    return;
  }

  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error('Failed to delete Supabase file:', error.message);
  }
}

async function ensureAdminUser() {
  const adminEmail = 'admin@lazeo.com';
  const adminUsername = 'Admin Lazeo';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  try {
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await prisma.user.create({
        data: {
          username: adminUsername,
          email: adminEmail,
          password: hashedPassword,
          role: 'admin',
          isActive: true
        }
      });
      console.log(`Admin account created: ${adminEmail}`);
    } else if (existingAdmin.role !== 'admin' || !existingAdmin.isActive) {
      await prisma.user.update({
        where: { email: adminEmail },
        data: { role: 'admin', isActive: true }
      });
      console.log(`Admin account updated for: ${adminEmail}`);
    }
  } catch (error) {
    console.error('Error ensuring admin user exists:', error);
  }
}

async function logDatabaseConnectionStatus() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database connectivity check: OK');
  } catch (error) {
    console.error('Database connectivity check failed:', {
      name: error?.name,
      code: error?.code,
      message: error?.message,
      meta: error?.meta,
      clientVersion: error?.clientVersion
    });
  }
}

// Register Endpoint
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, role, receiveWhatsApp, phone } = req.body;
  try {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';

    if (!normalizedEmail) {
      return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
    }

    if (normalizedPhone) {
      const existingPhoneUser = await prisma.user.findFirst({ where: { phone: normalizedPhone } });
      if (existingPhoneUser) {
        return res.status(400).json({ error: 'رقم الجوال مسجل مسبقاً' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    let userRole = 'customer';
    if (role === 'admin') {
      if (req.body.adminSecret !== 'LazeoAdmin2026') {
        return res.status(403).json({ error: 'رمز الإدارة السري غير صحيح' });
      }
      userRole = 'admin';
    }

    const newUser = await prisma.user.create({
      data: {
        username,
        email: normalizedEmail,
        phone: normalizedPhone || null,
        password: hashedPassword,
        role: userRole,
        receiveWhatsApp: receiveWhatsApp !== undefined ? receiveWhatsApp : true
      }
    });

    res.status(201).json({ message: 'تم إنشاء الحساب بنجاح', user: { id: newUser.id, role: newUser.role } });
  } catch (error) {
    console.error('Login endpoint error:', error);
    res.status(500).json({
      error: 'حدث خطأ في السيرفر',
      detail: error?.code || error?.name || 'UnknownError',
      ...(process.env.NODE_ENV !== 'production' ? { message: error?.message } : {})
    });
  }
});

// Login Endpoint
app.post('/api/auth/login', async (req, res) => {
  const { email, phone, password } = req.body;
  try {
    const identifier = typeof (email || phone) === 'string' ? (email || phone).trim() : '';
    if (!identifier || !password) {
      return res.status(400).json({ error: 'أدخل البريد الإلكتروني أو رقم الجوال وكلمة المرور' });
    }

    const normalizedEmail = identifier.includes('@') ? identifier.toLowerCase() : identifier;
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { phone: identifier }
        ]
      }
    });
    if (!user) {
      return res.status(400).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'الحساب غير مفعل. يرجى التواصل مع الإدارة.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, SECRET_KEY, { expiresIn: '1d' });
    res.json({ message: 'تم تسجيل الدخول بنجاح', token, user: { id: user.id, username: user.username, role: user.role, email: user.email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});

// Social Login Endpoint
app.post('/api/auth/social-login', async (req, res) => {
  const { provider, providerId, email, username } = req.body;
  if (!provider || !providerId || !email) {
    return res.status(400).json({ error: 'بيانات تسجيل الدخول الاجتماعي غير مكتملة' });
  }

  try {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-16);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      user = await prisma.user.create({
        data: {
          username: username || email.split('@')[0],
          email,
          password: hashedPassword,
          role: 'customer',
          provider,
          providerId,
          isActive: true
        }
      });
    } else if (!user.provider || !user.providerId) {
      await prisma.user.update({
        where: { email },
        data: { provider, providerId }
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'الحساب غير مفعل. يرجى التواصل مع الإدارة.' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, SECRET_KEY, { expiresIn: '1d' });
    res.json({ message: 'تم تسجيل الدخول بنجاح', token, user: { id: user.id, username: user.username, role: user.role, email: user.email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});

// Forgot Password Endpoint
app.post('/api/auth/forgot-password', async (req, res) => {
  const { phone, email } = req.body;
  try {
    const identifier = typeof (phone || email) === 'string' ? (phone || email).trim() : '';
    if (!identifier) {
      return res.status(400).json({ error: 'أدخل رقم الجوال أو البريد الإلكتروني' });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: identifier },
          { email: identifier.toLowerCase() }
        ]
      }
    });

    if (!user) return res.status(404).json({ error: 'رقم الجوال أو البريد الإلكتروني غير مسجل' });
    
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });
    
    // TODO: Send tempPassword via WhatsApp/Email provider integration
    console.log(`Password reset for ${identifier}: كلمة المرور الجديدة الخاصة بك هي: ${tempPassword}`);
    
    res.json({ message: 'تم إرسال كلمة المرور الجديدة إلى الواتساب الخاص بك' });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Change Password Endpoint
app.put('/api/user/password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    });
    
    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      console.error("JWT Verification failed:", err.message);
      return res.status(403).send("Forbidden: " + err.message);
    }
    req.user = user;
    next();
  });
};

// Middleware to check admin role
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  next();
};

app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'لم يتم إرفاق ملف' });
  }

  const fileName = buildSafeFileName(req.file.originalname);

  try {
    if (isSupabaseEnabled) {
      const filePath = `uploads/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .getPublicUrl(filePath);

      return res.json({ url: data.publicUrl });
    }

    const localUrl = await uploadFileToLocal(req, fileName);
    return res.json({ url: localUrl });
  } catch (error) {
    if (shouldFallbackToLocalStorage(error)) {
      try {
        const localUrl = await uploadFileToLocal(req, fileName);
        return res.json({
          url: localUrl,
          storageMode: 'local-fallback',
          warning: 'تعذر الرفع إلى Supabase Storage، تم الحفظ محلياً.'
        });
      } catch (localError) {
        console.error('Local fallback upload failed:', localError);
      }
    }

    console.error('Upload failed:', error);
    return res.status(500).json({ error: 'فشل رفع الملف' });
  }
});

// --- User Profile Routes ---
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, username: true, email: true, phone: true, address: true, role: true, receiveWhatsApp: true } });
    res.json(user);
  } catch (error) {
    console.error('Settings endpoint error:', error);
    res.status(500).json({
      error: 'Server error',
      detail: error?.code || error?.name || 'UnknownError',
      ...(process.env.NODE_ENV !== 'production' ? { message: error?.message } : {})
    });
  }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
  const { username, phone, address, receiveWhatsApp } = req.body;
  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { username, phone, address, receiveWhatsApp },
      select: { id: true, username: true, email: true, phone: true, address: true, role: true, receiveWhatsApp: true }
    });
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Orders Routes ---
app.get('/api/user/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({ where: { userId: req.user.id }, include: { user: { select: { username: true, email: true, phone: true, address: true } } }, orderBy: { createdAt: 'desc' } });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Custom Orders Routes ---
app.post('/api/custom-order', authenticateToken, async (req, res) => {
  const { material, details, attachmentUrl, attachmentText } = req.body;
  try {
    const newOrder = await prisma.customOrder.create({
      data: { userId: req.user.id, material, details, attachmentUrl, attachmentText }
    });
    res.status(201).json(newOrder);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/user/custom-orders', authenticateToken, async (req, res) => {
  try {
    const customOrders = await prisma.customOrder.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
    res.json(customOrders);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Admin Dashboard Routes ---
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, username: true, email: true, role: true, phone: true, address: true, createdAt: true, isActive: true, receiveWhatsApp: true } });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/users/:id/toggle-active', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: parseInt(req.params.id) } });
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: !user.isActive }
    });
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/users/:id/password', authenticateToken, requireAdmin, async (req, res) => {
  const { password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: { password: hashedPassword }
    });
    res.json({ message: 'تم تغيير كلمة المرور' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);
  try {
    const [orders, customOrders] = await Promise.all([
      prisma.order.findMany({ where: { userId }, select: { receiptUrl: true } }),
      prisma.customOrder.findMany({ where: { userId }, select: { attachmentUrl: true } })
    ]);

    const fileUrls = [
      ...orders.map((order) => order.receiptUrl).filter(Boolean),
      ...customOrders.map((order) => order.attachmentUrl).filter(Boolean)
    ];

    await Promise.all(fileUrls.map((url) => deleteSupabaseFileByUrl(url)));

    await prisma.order.deleteMany({ where: { userId } });
    await prisma.customOrder.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    res.json({ message: 'تم مسح العميل بنجاح' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/storage/health', authenticateToken, requireAdmin, async (req, res) => {
  const baseStatus = {
    provider: isSupabaseEnabled ? 'supabase' : 'local',
    bucket: SUPABASE_STORAGE_BUCKET,
    maxUploadSizeMb: Math.round(maxUploadSizeBytes / (1024 * 1024))
  };

  if (!isSupabaseEnabled) {
    return res.json({
      ...baseStatus,
      ok: true,
      mode: 'local-fallback',
      message: 'Supabase غير مفعل. الرفع المحلي يعمل حالياً.'
    });
  }

  try {
    const { data, error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .list('uploads', { limit: 1 });

    if (error) {
      return res.status(500).json({
        ...baseStatus,
        ok: false,
        mode: 'supabase',
        message: 'فشل التحقق من Supabase Storage',
        error: error.message
      });
    }

    return res.json({
      ...baseStatus,
      ok: true,
      mode: 'supabase',
      message: 'Supabase Storage متصل وجاهز',
      sampleObjectCount: data?.length || 0
    });
  } catch (error) {
    return res.status(500).json({
      ...baseStatus,
      ok: false,
      mode: 'supabase',
      message: 'خطأ غير متوقع أثناء فحص Supabase Storage',
      error: error.message
    });
  }
});

app.post('/api/admin/create-admin', authenticateToken, requireAdmin, async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = await prisma.user.create({
      data: { username, email, password: hashedPassword, role: 'admin' }
    });
    res.status(201).json(newAdmin);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({ include: { user: { select: { username: true, email: true, phone: true, address: true } } }, orderBy: { createdAt: 'desc' } });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/custom-orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const customOrders = await prisma.customOrder.findMany({ include: { user: { select: { username: true, email: true } } }, orderBy: { createdAt: 'desc' } });
    res.json(customOrders);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/custom-orders/:id/quote', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { priceQuote } = req.body;
  try {
    const updated = await prisma.customOrder.update({
      where: { id: parseInt(id) },
      data: { priceQuote: parseFloat(priceQuote), status: 'priced' }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/shipping', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const shippingMethods = await prisma.shippingMethod.findMany();
    res.json(shippingMethods);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/shipping', authenticateToken, requireAdmin, async (req, res) => {
  const { name, price, estimatedDays, logoUrl } = req.body;
  try {
    const newMethod = await prisma.shippingMethod.create({ data: { name, price: parseFloat(price), estimatedDays, logoUrl } });
    res.status(201).json(newMethod);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/shipping/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, price, estimatedDays, logoUrl } = req.body;
  try {
    const existingShipping = await prisma.shippingMethod.findUnique({ where: { id: parseInt(id) } });
    const updatedShipping = await prisma.shippingMethod.update({
      where: { id: parseInt(id) },
      data: { name, price: parseFloat(price), estimatedDays, logoUrl }
    });

    if (existingShipping?.logoUrl && logoUrl && existingShipping.logoUrl !== logoUrl) {
      await deleteSupabaseFileByUrl(existingShipping.logoUrl);
    }

    res.json(updatedShipping);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/banks', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const banks = await prisma.bankAccount.findMany();
    res.json(banks);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/banks', authenticateToken, requireAdmin, async (req, res) => {
  const { bankName, accountName, accountNumber, iban, logoUrl } = req.body;
  try {
    const newBank = await prisma.bankAccount.create({ data: { bankName, accountName, accountNumber, iban, logoUrl } });
    res.status(201).json(newBank);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/banks/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { bankName, accountName, accountNumber, iban, logoUrl } = req.body;
  try {
    const existingBank = await prisma.bankAccount.findUnique({ where: { id: parseInt(id) } });
    const updatedBank = await prisma.bankAccount.update({
      where: { id: parseInt(id) },
      data: { bankName, accountName, accountNumber, iban, logoUrl }
    });

    if (existingBank?.logoUrl && logoUrl && existingBank.logoUrl !== logoUrl) {
      await deleteSupabaseFileByUrl(existingBank.logoUrl);
    }

    res.json(updatedBank);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Checkout & Orders ---
app.get('/api/shipping', async (req, res) => {
  try {
    const shippingMethods = await prisma.shippingMethod.findMany();
    res.json(shippingMethods);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/banks', async (req, res) => {
  try {
    const banks = await prisma.bankAccount.findMany();
    res.json(banks);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/orders', authenticateToken, async (req, res) => {
  const { items, totalAmount, bankId, receiptUrl, receiptText } = req.body;
  try {
    const newOrder = await prisma.order.create({
      data: {
        userId: req.user.id,
        items: JSON.stringify(items),
        totalAmount: parseFloat(totalAmount),
        bankId: parseInt(bankId),
        receiptUrl,
        receiptText,
        status: 'pending' // pending review
      }
    });
    res.status(201).json(newOrder);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/orders/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const orderData = { status };
    
    // If status is execution, generate invoice number if not exists
    if (status === 'execution') {
      const order = await prisma.order.findUnique({ where: { id: parseInt(id) } });
      if (!order.invoiceNumber) {
        orderData.invoiceNumber = `INV-${Date.now()}-${id}`;
      }
    }
    
    const updated = await prisma.order.update({
      where: { id: parseInt(id) },
      data: orderData,
      include: { user: true }
    });

    // TODO: Send WhatsApp notification based on status
    if (updated.user.receiveWhatsApp && updated.user.phone) {
      console.log(`WhatsApp to ${updated.user.phone}: تم تحديث حالة طلبك رقم ${id} إلى ${status}`);
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/orders/:id/invoice-printed', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await prisma.order.update({
      where: { id: parseInt(id) },
      data: { invoicePrinted: true }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Products Routes ---
app.get('/api/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/products', authenticateToken, requireAdmin, async (req, res) => {
  const { nameAr, nameEn, price, image, descriptionAr, descriptionEn, category } = req.body;
  try {
    const newProduct = await prisma.product.create({
      data: { nameAr, nameEn, price: parseFloat(price), image, descriptionAr, descriptionEn, category }
    });
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nameAr, nameEn, price, image, descriptionAr, descriptionEn, category } = req.body;
  try {
    const existingProduct = await prisma.product.findUnique({ where: { id: parseInt(id) } });
    const updatedProduct = await prisma.product.update({
      where: { id: parseInt(id) },
      data: { nameAr, nameEn, price: parseFloat(price), image, descriptionAr, descriptionEn, category }
    });

    if (existingProduct?.image && image && existingProduct.image !== image) {
      await deleteSupabaseFileByUrl(existingProduct.image);
    }

    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const product = await prisma.product.findUnique({ where: { id: parseInt(id) } });
    await prisma.product.delete({ where: { id: parseInt(id) } });
    await deleteSupabaseFileByUrl(product?.image);
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Materials Routes ---
app.get('/api/materials', async (req, res) => {
  try {
    const materials = await prisma.material.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/materials', authenticateToken, requireAdmin, async (req, res) => {
  const { nameAr, nameEn } = req.body;
  try {
    const newMaterial = await prisma.material.create({
      data: { nameAr, nameEn }
    });
    res.status(201).json(newMaterial);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/materials/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nameAr, nameEn } = req.body;
  try {
    const updatedMaterial = await prisma.material.update({
      where: { id: parseInt(id) },
      data: { nameAr, nameEn }
    });
    res.json(updatedMaterial);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/materials/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.material.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Material deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Store Settings Routes ---
app.get('/api/settings', async (req, res) => {
  try {
    let settings = await prisma.storeSettings.findFirst();
    if (!settings) {
      settings = await prisma.storeSettings.create({ data: {} });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
  const { whatsappNumber, whatsappToken, snapchatUrl, instagramUrl } = req.body;
  try {
    let settings = await prisma.storeSettings.findFirst();
    if (settings) {
      settings = await prisma.storeSettings.update({
        where: { id: settings.id },
        data: { whatsappNumber, whatsappToken, snapchatUrl, instagramUrl }
      });
    } else {
      settings = await prisma.storeSettings.create({
        data: { whatsappNumber, whatsappToken, snapchatUrl, instagramUrl }
      });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: `حجم الملف أكبر من الحد المسموح (${Math.round(maxUploadSizeBytes / (1024 * 1024))}MB)`
    });
  }

  if (err && err.message === 'نوع الملف غير مدعوم') {
    return res.status(400).json({ error: err.message });
  }

  return next(err);
});

ensureAdminUser().then(() => {
  logDatabaseConnectionStatus();
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to initialize server:', err);
  process.exit(1);
});
