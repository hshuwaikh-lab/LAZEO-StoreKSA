# Firebase Cloud Functions Deployment Guide

## Overview

LAZEO StoreKSA is transitioning from a local Express.js server to **Firebase Cloud Functions** for automatic scaling and reduced infrastructure costs.

## Architecture

```
Frontend (React + Vite)
    ↓
API Layer (src/config/api.js)
    ↓
Firebase Cloud Functions
    ↓
Firestore Database
    ↓
Firebase Authentication
```

## Step 1: Prepare for Deployment

### 1.1 Install Firebase CLI
```bash
npm install -g firebase-tools
```

### 1.2 Login to Firebase
```bash
firebase login
```

### 1.3 Initialize Firebase Project
The project already has `firebase.json`, but verify it's configured correctly:
```bash
firebase init
```

When prompted:
- Select project: `laszeo-store-ksa`
- Hosting: Yes (already set up)
- Functions: Yes
- Functions language: JavaScript
- ESLint: No (optional)

## Step 2: Configure Cloud Functions

### 2.1 Set Environment Variables

For local testing, create `functions/.env`:
```bash
cd functions
cp .env.example .env
# Edit .env with:
JWT_SECRET=your_secure_jwt_secret
ADMIN_PASSWORD=your_secure_admin_password
```

For production, set using Firebase CLI:
```bash
firebase functions:config:set jwt.secret="your_secure_jwt_secret"
firebase functions:config:set admin.password="your_secure_admin_password"
```

### 2.2 Install Function Dependencies
```bash
cd functions
npm install
cd ..
```

## Step 3: Test Locally

### 3.1 Start Firebase Emulator
```bash
firebase emulators:start --only functions,firestore
```

The API will be available at: `http://localhost:5001/laszeo-store-ksa/us-central1/api`

### 3.2 Update Frontend .env for Local Testing
```bash
VITE_API_BASE_URL=http://localhost:5001/laszeo-store-ksa/us-central1/api
```

### 3.3 Start Frontend Dev Server
```bash
npm run dev
```

### 3.4 Test API Endpoints
```bash
# Test registration
curl -X POST http://localhost:5001/laszeo-store-ksa/us-central1/api/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username":"test",
    "email":"test@example.com",
    "password":"test123"
  }'

# Test login
curl -X POST http://localhost:5001/laszeo-store-ksa/us-central1/api/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"test123"
  }'

# Test get products
curl http://localhost:5001/laszeo-store-ksa/us-central1/api/api/products
```

## Step 4: Deploy to Production

### 4.1 Build Frontend
```bash
npm run build
```

### 4.2 Deploy Everything
```bash
firebase deploy
```

This will deploy:
- Cloud Functions (API)
- Frontend to Firebase Hosting

### 4.3 Get Production URLs

After deployment, you'll see:
```
Function URL (api(us-central1)): https://us-central1-laszeo-store-ksa.cloudfunctions.net/api
Hosting URL: https://hshuwaikh-lab.github.io/LAZEO-StoreKSA/
```

### 4.4 Update Frontend Configuration

Update `.env.production`:
```bash
VITE_API_BASE_URL=https://us-central1-laszeo-store-ksa.cloudfunctions.net/api
```

### 4.5 Rebuild and Deploy
```bash
npm run build
npm run deploy
```

## Step 5: Verify Deployment

### 5.1 Check Function Logs
```bash
firebase functions:log
```

### 5.2 Test API Endpoints
```bash
# Test registration
curl -X POST https://us-central1-laszeo-store-ksa.cloudfunctions.net/api/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username":"test",
    "email":"test@example.com",
    "password":"test123"
  }'
```

### 5.3 Test in Browser
Visit: https://hshuwaikh-lab.github.io/LAZEO-StoreKSA/login

Try:
- Create new account
- Login with email/password
- View products
- Try social login

## Troubleshooting

### CORS Errors
If you get CORS errors:
1. Check that CORS is enabled in `functions/index.js` (it is by default)
2. Verify the frontend URL is allowed
3. Make sure Authorization headers are properly formatted

### Authentication Fails
- Verify JWT_SECRET is consistent between local and production
- Check that tokens are being sent in Authorization header
- Use `firebase functions:log` to debug

### Database Issues
- Verify Firestore collections exist in Firebase Console
- Check that database rules allow public read/write for testing (production should be more restrictive)
- Ensure user has Firestore access

### Upload Endpoint
The upload endpoint (`/api/upload`) currently returns a placeholder. To enable file uploads:

1. Set up Cloud Storage in Firebase
2. Update the upload handler in `functions/index.js` to use `@google-cloud/storage`
3. Get signed URLs from Cloud Storage

## Database Initialization

The first time the API runs, it will create the default admin user:
- Email: `admin@lazeo.com`
- Password: `admin123` (from ADMIN_PASSWORD env var)

To change this after deployment:
```bash
firebase functions:config:set admin.password="your_new_password"
firebase deploy --only functions
```

## Monitoring

View function metrics and logs in Firebase Console:
1. Go to https://console.firebase.google.com/
2. Select `laszeo-store-ksa` project
3. Go to Functions tab
4. View logs and metrics

## Cost Management

Cloud Functions charges are based on:
- Number of invocations
- Compute time
- Memory used
- Networking (first 5GB free per month)

For typical usage:
- Lightweight API calls are very cheap
- Always-free tier covers small projects
- Monitor functions:log to optimize performance

## Migration Path

If needed to migrate back to Express:
1. Keep the same API endpoints
2. Update `VITE_API_BASE_URL` to point to Express server
3. No frontend code changes needed (thanks to `src/config/api.js`)

## Next Steps

1. ✅ Complete API migration (already done)
2. ✅ Create Cloud Functions (done in this step)
3. ⏳ Test locally with Firebase Emulator
4. ⏳ Deploy to Firebase
5. ⏳ Verify all endpoints working in production
6. ⏳ Set up Cloud Storage for file uploads
7. ⏳ Optimize and monitor functions
