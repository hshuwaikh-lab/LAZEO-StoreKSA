# Firebase Cloud Functions for LAZEO StoreKSA

This directory contains the Firebase Cloud Functions that serve as the backend API for LAZEO StoreKSA.

## Setup

### Prerequisites
- Node.js 18+
- Firebase CLI installed globally: `npm install -g firebase-tools`
- Firebase project (laszeo-store-ksa)

### Installation

1. Install dependencies:
```bash
cd functions
npm install
```

2. Create `.env` file with environment variables:
```bash
cp .env.example .env
# Edit .env and set JWT_SECRET and other variables
```

### Local Development

To test locally using Firebase Emulator:

```bash
npm run serve
```

This will start Firebase Functions emulator at `http://localhost:5000`.

### Testing the API

Once running, you can test endpoints:

```bash
# Health check
curl http://localhost:5000/api/settings

# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"test123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

## Deployment

### Deploy to Firebase

```bash
npm run deploy
```

Or deploy both frontend and functions:

```bash
cd ..
npm run deploy
```

This will deploy Cloud Functions to Google Cloud Platform.

### Get the Function URL

After deployment, your API will be available at:
```
https://us-central1-laszeo-store-ksa.cloudfunctions.net/api
```

Add this to your frontend `.env.production`:
```
VITE_API_BASE_URL=https://us-central1-laszeo-store-ksa.cloudfunctions.net/api
```

## Database Structure

This implementation uses Firestore as the database. Collections:

- **users** - User accounts with authentication
- **products** - Store products
- **materials** - Custom order materials
- **orders** - Customer orders
- **customOrders** - Custom order requests
- **shippingMethods** - Shipping options
- **bankAccounts** - Bank transfer details
- **storeSettings** - Store configuration

## API Endpoints

All endpoints match the original Express API:

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/social-login` - Social media login

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product details
- `POST /api/admin/products` - Create product (admin only)

### Orders & Checkout
- `POST /api/orders` - Create order
- `GET /api/user/orders` - Get user orders
- `GET /api/shipping` - Get shipping methods
- `GET /api/banks` - Get bank accounts

### Custom Orders
- `POST /api/custom-order` - Create custom order request
- `GET /api/user/custom-orders` - Get user custom orders
- `GET /api/admin/custom-orders` - Get all custom orders (admin)
- `PUT /api/admin/custom-orders/:id/quote` - Set quote for custom order (admin)

### Materials
- `GET /api/materials` - Get all materials
- `POST /api/admin/materials` - Create material (admin only)

### Admin
- `GET /api/admin/users` - Get all users (admin only)
- `GET /api/admin/orders` - Get all orders (admin only)
- `GET /api/admin/shipping` - Get shipping methods (admin)
- `POST /api/admin/shipping` - Create shipping method (admin)
- `GET /api/admin/banks` - Get banks (admin)
- `POST /api/admin/banks` - Create bank (admin)

### Settings
- `GET /api/settings` - Get store settings
- `PUT /api/admin/settings` - Update settings (admin only)

## Notes

- JWT tokens expire after 1 day
- Admin secret for registration: `LazeoAdmin2026`
- Default admin: `admin@lazeo.com` / `admin123`
- File uploads currently use a placeholder. Configure Cloud Storage for production.

## Troubleshooting

If you get CORS errors, ensure:
1. The frontend URL is properly configured
2. CORS is enabled in the functions (it is by default)

If authentication fails:
1. Ensure JWT_SECRET is consistent
2. Check token expiration time
3. Verify Authorization header format: `Authorization: Bearer <token>`
