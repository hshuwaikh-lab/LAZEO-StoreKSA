const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
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
const watermarkEligibleMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const storeLogoPath = path.join(__dirname, '..', 'public', 'logo.png');
const FORGOT_PASSWORD_RATE_WINDOW_MS = Math.max(parseInt(process.env.FORGOT_PASSWORD_RATE_WINDOW_MS || '900000', 10) || 900000, 10000);
const FORGOT_PASSWORD_RATE_MAX_ATTEMPTS = Math.max(parseInt(process.env.FORGOT_PASSWORD_RATE_MAX_ATTEMPTS || '5', 10) || 5, 1);
const forgotPasswordAttempts = new Map();

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

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown-ip';
}

function isForgotPasswordRateLimited(req, identifier) {
  const now = Date.now();
  const normalizedIdentifier = String(identifier || '').trim().toLowerCase();
  const key = `${getClientIp(req)}|${normalizedIdentifier}`;
  const attempts = forgotPasswordAttempts.get(key) || [];

  const recentAttempts = attempts.filter((ts) => now - ts < FORGOT_PASSWORD_RATE_WINDOW_MS);
  if (recentAttempts.length >= FORGOT_PASSWORD_RATE_MAX_ATTEMPTS) {
    forgotPasswordAttempts.set(key, recentAttempts);
    return true;
  }

  recentAttempts.push(now);
  forgotPasswordAttempts.set(key, recentAttempts);
  return false;
}

function shouldFallbackToLocalStorage(error) {
  if (!error) return false;

  const statusCode = String(error.statusCode || error.status || '');
  const message = String(error.message || '').toLowerCase();
  return statusCode === '404' || message.includes('bucket not found') || message.includes('not found');
}

function isAllowedUpload(contentType, fileSize) {
  const normalizedType = String(contentType || '').toLowerCase();
  const normalizedSize = Number(fileSize || 0);

  if (!allowedUploadMimeTypes.has(normalizedType)) {
    return { ok: false, error: 'نوع الملف غير مدعوم' };
  }

  if (!Number.isFinite(normalizedSize) || normalizedSize <= 0) {
    return { ok: false, error: 'حجم الملف غير صالح' };
  }

  if (normalizedSize > maxUploadSizeBytes) {
    return {
      ok: false,
      error: `حجم الملف أكبر من الحد المسموح (${Math.round(maxUploadSizeBytes / (1024 * 1024))}MB)`
    };
  }

  return { ok: true };
}

async function uploadFileToLocal(req, fileName, fileBuffer) {
  const localPath = path.join(uploadsDir, fileName);
  await fs.promises.writeFile(localPath, fileBuffer);
  const localUrl = `${req.protocol}://${req.get('host')}/uploads/${fileName}`;
  return localUrl;
}

function isImageUpload(contentType) {
  return String(contentType || '').toLowerCase().startsWith('image/');
}

function normalizeProductImageUrls(imageValue) {
  if (Array.isArray(imageValue)) {
    return imageValue.flatMap(normalizeProductImageUrls).filter(Boolean);
  }

  if (typeof imageValue !== 'string') {
    return [];
  }

  const trimmed = imageValue.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.flatMap(normalizeProductImageUrls).filter(Boolean);
    }

    if (typeof parsed === 'string') {
      return [parsed.trim()].filter(Boolean);
    }
  } catch {
    // Support legacy newline/comma-delimited values and plain URLs.
  }

  return trimmed
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getRemovedProductImageUrls(previousValue, nextValue) {
  const previousUrls = normalizeProductImageUrls(previousValue);
  const nextUrls = new Set(normalizeProductImageUrls(nextValue));

  return previousUrls.filter((url) => !nextUrls.has(url));
}

async function applyStoreLogoWatermark(fileBuffer, contentType) {
  const normalizedType = String(contentType || '').toLowerCase();

  if (!watermarkEligibleMimeTypes.has(normalizedType)) {
    return { buffer: fileBuffer, contentType: normalizedType || contentType };
  }

  if (!fs.existsSync(storeLogoPath)) {
    console.warn('Store logo not found, skipping image watermark. Expected at:', storeLogoPath);
    return { buffer: fileBuffer, contentType: normalizedType };
  }

  const source = sharp(fileBuffer, { failOn: 'none' }).rotate();
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height) {
    return { buffer: fileBuffer, contentType: normalizedType };
  }

  const targetLogoWidth = Math.max(Math.min(Math.round(metadata.width * 0.2), 280), 90);
  const logoBuffer = await sharp(storeLogoPath)
    .resize({ width: targetLogoWidth, withoutEnlargement: true })
    .png()
    .toBuffer();

  let output = source.composite([{ input: logoBuffer, gravity: 'southeast' }]);
  if (normalizedType === 'image/jpeg') {
    output = output.jpeg({ quality: 90 });
  } else if (normalizedType === 'image/gif') {
    output = output.gif();
  } else if (normalizedType === 'image/webp') {
    output = output.webp({ quality: 90 });
  } else {
    output = output.png();
  }

  return {
    buffer: await output.toBuffer(),
    contentType: normalizedType,
  };
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
    console.error('Register endpoint error:', error);
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

    if (isForgotPasswordRateLimited(req, identifier)) {
      return res.status(429).json({ error: 'تم تجاوز عدد المحاولات المسموح. يرجى المحاولة لاحقاً.' });
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
    // Never log the temporary password to avoid leaking credentials into logs.
    console.log(`Password reset requested for user ${user.id} via identifier ${identifier}`);

    res.json({ message: 'تم إنشاء كلمة مرور مؤقتة وإرسالها عبر وسيلة التواصل المسجلة' });
  } catch (error) {
    console.error('Forgot password endpoint error:', error);
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
    let finalBuffer = req.file.buffer;
    let finalContentType = req.file.mimetype;

    if (isImageUpload(req.file.mimetype)) {
      try {
        const processed = await applyStoreLogoWatermark(req.file.buffer, req.file.mimetype);
        finalBuffer = processed.buffer;
        finalContentType = processed.contentType;
      } catch (watermarkError) {
        console.error('Image watermark processing failed, proceeding without watermark:', watermarkError.message);
      }
    }

    if (isSupabaseEnabled) {
      const filePath = `uploads/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(filePath, finalBuffer, {
          contentType: finalContentType,
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

    const localUrl = await uploadFileToLocal(req, fileName, finalBuffer);
    return res.json({ url: localUrl });
  } catch (error) {
    if (shouldFallbackToLocalStorage(error)) {
      try {
        const localUrl = await uploadFileToLocal(req, fileName, req.file.buffer);
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

app.post('/api/upload/signed-url', authenticateToken, async (req, res) => {
  const { fileName, contentType, fileSize } = req.body || {};

  if (!isSupabaseEnabled) {
    return res.status(503).json({
      error: 'Supabase Storage غير مفعل على الخادم',
      mode: 'local-fallback'
    });
  }

  if (!fileName) {
    return res.status(400).json({ error: 'اسم الملف مطلوب' });
  }

  const validation = isAllowedUpload(contentType, fileSize);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  const safeName = buildSafeFileName(fileName);
  const storagePath = `uploads/${safeName}`;

  try {
    const { data, error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error) {
      return res.status(500).json({ error: 'تعذر إنشاء رابط الرفع الموقّع', detail: error.message });
    }

    const { data: publicData } = supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    return res.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path || storagePath,
      publicUrl: publicData.publicUrl,
      bucket: SUPABASE_STORAGE_BUCKET,
      provider: 'supabase'
    });
  } catch (error) {
    return res.status(500).json({ error: 'فشل إنشاء رابط الرفع الموقّع', detail: error.message });
  }
});

// --- User Profile Routes ---
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, username: true, email: true, phone: true, address: true, role: true, receiveWhatsApp: true } });
    res.json(user);
  } catch (error) {
    console.error('User profile endpoint error:', error);
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

app.put('/api/user/custom-orders/:id/accept', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const customOrder = await prisma.customOrder.findFirst({
      where: { id: parseInt(id), userId: req.user.id }
    });

    if (!customOrder) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    if (customOrder.priceQuote == null) {
      return res.status(400).json({ error: 'لم يتم تسعير الطلب بعد' });
    }

    const updated = await prisma.customOrder.update({
      where: { id: parseInt(id) },
      data: { status: 'accepted' }
    });

    res.json(updated);
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
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    if (req.user.id === userId) {
      return res.status(400).json({ error: 'لا يمكنك مسح حسابك الإداري الحالي' });
    }

    if (targetUser.role === 'admin') {
      const adminsCount = await prisma.user.count({ where: { role: 'admin' } });
      if (adminsCount <= 1) {
        return res.status(400).json({ error: 'لا يمكن مسح آخر مشرف في النظام' });
      }
    }

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
    res.json({ message: targetUser.role === 'admin' ? 'تم مسح المشرف بنجاح' : 'تم مسح العميل بنجاح' });
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

app.post('/api/coupons/validate', async (req, res) => {
  const { code, subtotal } = req.body || {};

  try {
    const resolved = await resolveValidCoupon({ code, subtotal });
    if (!resolved.valid) {
      return res.status(400).json({ valid: false, error: resolved.reason });
    }

    return res.json({
      valid: true,
      coupon: {
        id: resolved.coupon.id,
        code: resolved.coupon.code,
        discountType: resolved.coupon.discountType,
        discountValue: resolved.coupon.discountValue,
        minOrderAmount: resolved.coupon.minOrderAmount,
        maxDiscount: resolved.coupon.maxDiscount,
        expiresAt: resolved.coupon.expiresAt,
      },
      discountAmount: resolved.discountAmount,
      finalSubtotal: resolved.finalSubtotal,
    });
  } catch (error) {
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
});

app.post('/api/orders', authenticateToken, async (req, res) => {
  const { items, totalAmount, bankId, receiptUrl, receiptText, couponCode, discountAmount } = req.body;
  try {
    const normalizedItems = Array.isArray(items) ? items : [];
    const subtotalBeforeShipping = normalizedItems
      .filter((item) => !item?.isShipping)
      .reduce((sum, item) => {
        const linePrice = Number(item?.price || 0);
        const lineQuantity = Number(item?.quantity || 0);
        return sum + (linePrice * lineQuantity);
      }, 0);

    let resolvedCouponCode = null;
    let resolvedDiscountAmount = 0;

    if (couponCode) {
      const resolved = await resolveValidCoupon({
        code: couponCode,
        subtotal: subtotalBeforeShipping,
      });

      if (!resolved.valid) {
        return res.status(400).json({ error: resolved.reason });
      }

      resolvedCouponCode = resolved.coupon.code;
      resolvedDiscountAmount = Number(resolved.discountAmount || 0);
    } else if (discountAmount && Number(discountAmount) > 0) {
      return res.status(400).json({ error: 'لا يمكن إرسال خصم بدون كوبون صالح' });
    }

    const newOrder = await prisma.order.create({
      data: {
        userId: req.user.id,
        items: JSON.stringify(normalizedItems),
        totalAmount: parseFloat(totalAmount),
        couponCode: resolvedCouponCode,
        discountAmount: resolvedDiscountAmount,
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
const parseOptionalOfferPrice = (value) => {
  if (value === '' || value === null || typeof value === 'undefined') {
    return null;
  }

  const parsedValue = parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const parseOptionalOfferMinQuantity = (value) => {
  if (value === '' || value === null || typeof value === 'undefined') {
    return null;
  }

  const parsedValue = parseInt(value, 10);
  if (!Number.isInteger(parsedValue) || parsedValue <= 1) {
    return null;
  }

  return parsedValue;
};

const parseOptionalOfferEndsAt = (value) => {
  if (!value) {
    return null;
  }

  const parsedValue = new Date(value);
  return Number.isNaN(parsedValue.getTime()) ? null : parsedValue;
};

const normalizeCouponCode = (value = '') => String(value).trim().toUpperCase();

const parseCouponExpiry = (value) => {
  if (!value) {
    return null;
  }

  const parsedValue = new Date(value);
  return Number.isNaN(parsedValue.getTime()) ? null : parsedValue;
};

const calculateCouponDiscount = ({ coupon, subtotal }) => {
  const normalizedSubtotal = Number(subtotal || 0);
  if (!coupon || normalizedSubtotal <= 0) {
    return 0;
  }

  if (coupon.minOrderAmount && normalizedSubtotal < Number(coupon.minOrderAmount)) {
    return 0;
  }

  let discount = 0;
  if (coupon.discountType === 'percent') {
    discount = normalizedSubtotal * (Number(coupon.discountValue || 0) / 100);
  } else {
    discount = Number(coupon.discountValue || 0);
  }

  if (coupon.maxDiscount && discount > Number(coupon.maxDiscount)) {
    discount = Number(coupon.maxDiscount);
  }

  if (discount > normalizedSubtotal) {
    discount = normalizedSubtotal;
  }

  return Number(discount.toFixed(2));
};

const resolveValidCoupon = async ({ code, subtotal }) => {
  const normalizedCode = normalizeCouponCode(code);
  const normalizedSubtotal = Number(subtotal || 0);

  if (!normalizedCode) {
    return { valid: false, reason: 'كود الخصم مطلوب' };
  }

  if (!Number.isFinite(normalizedSubtotal) || normalizedSubtotal <= 0) {
    return { valid: false, reason: 'قيمة السلة غير صالحة' };
  }

  const coupon = await prisma.coupon.findUnique({ where: { code: normalizedCode } });
  if (!coupon || !coupon.isActive) {
    return { valid: false, reason: 'كود الخصم غير صالح أو غير مفعل' };
  }

  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= Date.now()) {
    return { valid: false, reason: 'انتهت صلاحية كود الخصم' };
  }

  if (coupon.minOrderAmount && normalizedSubtotal < Number(coupon.minOrderAmount)) {
    return {
      valid: false,
      reason: `الحد الأدنى لتفعيل الكوبون هو ${Number(coupon.minOrderAmount).toFixed(2)} ر.س`
    };
  }

  const discountAmount = calculateCouponDiscount({ coupon, subtotal: normalizedSubtotal });
  if (discountAmount <= 0) {
    return { valid: false, reason: 'لا يمكن تطبيق الكوبون على السلة الحالية' };
  }

  return {
    valid: true,
    coupon,
    discountAmount,
    finalSubtotal: Number((normalizedSubtotal - discountAmount).toFixed(2))
  };
};

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
  const { nameAr, nameEn, price, offerPrice, offerMinQuantity, offerEndsAt, image, descriptionAr, descriptionEn, category } = req.body;
  try {
    const newProduct = await prisma.product.create({
      data: {
        nameAr,
        nameEn,
        price: parseFloat(price),
        offerPrice: parseOptionalOfferPrice(offerPrice),
        offerMinQuantity: parseOptionalOfferMinQuantity(offerMinQuantity),
        offerEndsAt: parseOptionalOfferEndsAt(offerEndsAt),
        image,
        descriptionAr,
        descriptionEn,
        category,
      }
    });
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nameAr, nameEn, price, offerPrice, offerMinQuantity, offerEndsAt, image, descriptionAr, descriptionEn, category } = req.body;
  try {
    const existingProduct = await prisma.product.findUnique({ where: { id: parseInt(id) } });
    const updatedProduct = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        nameAr,
        nameEn,
        price: parseFloat(price),
        offerPrice: parseOptionalOfferPrice(offerPrice),
        offerMinQuantity: parseOptionalOfferMinQuantity(offerMinQuantity),
        offerEndsAt: parseOptionalOfferEndsAt(offerEndsAt),
        image,
        descriptionAr,
        descriptionEn,
        category,
      }
    });

    const removedImageUrls = getRemovedProductImageUrls(existingProduct?.image, image);
    if (removedImageUrls.length) {
      await Promise.all(removedImageUrls.map((imageUrl) => deleteSupabaseFileByUrl(imageUrl)));
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
    await Promise.all(normalizeProductImageUrls(product?.image).map((imageUrl) => deleteSupabaseFileByUrl(imageUrl)));
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

app.get('/api/admin/coupons', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/coupons', authenticateToken, requireAdmin, async (req, res) => {
  const { code, discountType, discountValue, minOrderAmount, maxDiscount, expiresAt, isActive } = req.body || {};
  const normalizedCode = normalizeCouponCode(code);

  if (!normalizedCode) {
    return res.status(400).json({ error: 'كود الكوبون مطلوب' });
  }

  if (!['percent', 'fixed'].includes(discountType)) {
    return res.status(400).json({ error: 'نوع الخصم غير صالح' });
  }

  const normalizedValue = Number(discountValue);
  if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
    return res.status(400).json({ error: 'قيمة الخصم غير صالحة' });
  }

  if (discountType === 'percent' && normalizedValue > 100) {
    return res.status(400).json({ error: 'نسبة الخصم يجب أن تكون بين 1 و 100' });
  }

  try {
    const coupon = await prisma.coupon.create({
      data: {
        code: normalizedCode,
        discountType,
        discountValue: normalizedValue,
        minOrderAmount: minOrderAmount ? Number(minOrderAmount) : null,
        maxDiscount: maxDiscount ? Number(maxDiscount) : null,
        expiresAt: parseCouponExpiry(expiresAt),
        isActive: isActive !== false,
      }
    });
    res.status(201).json(coupon);
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(400).json({ error: 'كود الكوبون موجود مسبقاً' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/coupons/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { code, discountType, discountValue, minOrderAmount, maxDiscount, expiresAt, isActive } = req.body || {};
  const normalizedCode = normalizeCouponCode(code);

  if (!normalizedCode) {
    return res.status(400).json({ error: 'كود الكوبون مطلوب' });
  }

  if (!['percent', 'fixed'].includes(discountType)) {
    return res.status(400).json({ error: 'نوع الخصم غير صالح' });
  }

  const normalizedValue = Number(discountValue);
  if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
    return res.status(400).json({ error: 'قيمة الخصم غير صالحة' });
  }

  if (discountType === 'percent' && normalizedValue > 100) {
    return res.status(400).json({ error: 'نسبة الخصم يجب أن تكون بين 1 و 100' });
  }

  try {
    const coupon = await prisma.coupon.update({
      where: { id: parseInt(id, 10) },
      data: {
        code: normalizedCode,
        discountType,
        discountValue: normalizedValue,
        minOrderAmount: minOrderAmount ? Number(minOrderAmount) : null,
        maxDiscount: maxDiscount ? Number(maxDiscount) : null,
        expiresAt: parseCouponExpiry(expiresAt),
        isActive: Boolean(isActive),
      }
    });
    res.json(coupon);
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(400).json({ error: 'كود الكوبون موجود مسبقاً' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/coupons/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.coupon.delete({ where: { id: parseInt(id, 10) } });
    res.json({ message: 'Coupon deleted' });
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
