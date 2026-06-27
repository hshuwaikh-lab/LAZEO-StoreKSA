// Vercel API Handler
// This is a lightweight API gateway for Vercel Serverless Functions

export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Mock auth endpoints
  if (req.url === '/api/auth/register' && req.method === 'POST') {
    return res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح',
      user: { id: 1, role: 'customer' }
    });
  }

  if (req.url === '/api/auth/login' && req.method === 'POST') {
    const { email } = req.body;
    return res.status(200).json({
      message: 'تم تسجيل الدخول بنجاح',
      token: 'mock_token_' + Date.now(),
      user: {
        id: 1,
        username: 'User',
        role: 'customer',
        email: email || 'user@example.com'
      }
    });
  }

  if (req.url === '/api/products' && req.method === 'GET') {
    return res.status(200).json([
      {
        id: 1,
        name: 'منتج 1',
        price: 100,
        description: 'وصف المنتج'
      }
    ]);
  }

  // Default 404
  res.status(404).json({ error: 'Endpoint not found' });
}
