# Supabase Storage Setup (LAZEO StoreKSA)

This guide configures image/file uploads for the backend endpoint `POST /api/upload`.

## Optional: Google Drive as Storage Provider

You can now use Google Drive as an optional provider from Admin Settings.

### Required backend env vars (server/.env)

```env
# local | supabase | gdrive
STORAGE_PROVIDER=local

# Google Drive target folder (required for gdrive mode)
GOOGLE_DRIVE_FOLDER_ID=your_folder_id_here

# Option A: full JSON as one line (preferred)
GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# Option B: split credentials
# GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
# GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Google Drive setup checklist

1. Create a Google Cloud project and enable Google Drive API.
2. Create a Service Account and generate key JSON.
3. Create/choose a Drive folder for uploads.
4. Share that folder with the service account email as Editor.
5. Put the folder ID in `GOOGLE_DRIVE_FOLDER_ID`.
6. Set storage provider from Admin Dashboard -> Settings -> Storage Provider.

### Runtime behavior

- `gdrive`: uploads via backend to Google Drive, files made public-read (`anyone`).
- `supabase`: signed upload + public URL flow.
- `local`: stored in `/server/uploads`.
- If selected provider is misconfigured, API falls back to local mode and reports warning in storage health.

## 1) Create Storage Bucket

1. Open Supabase project dashboard.
2. Go to Storage.
3. Create a new bucket named `lazeo-uploads`.
4. Set bucket to Public if you want direct public URLs.

If you choose a different bucket name, update backend env:

- `SUPABASE_STORAGE_BUCKET=your-bucket-name`

## 2) Add Backend Environment Variables

In `server/.env` add:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=lazeo-uploads
MAX_UPLOAD_SIZE_MB=10
```

If you want to move Prisma to Supabase Postgres, use:

```env
DATABASE_URL=postgresql://postgres:YOUR_REAL_PASSWORD@db.hslolngigrxwviklahme.supabase.co:5432/postgres
```

Then update `server/prisma/schema.prisma` datasource provider from `sqlite` to `postgresql`, run Prisma generate/db push, and restart the server.

Notes:

- Use `SUPABASE_SERVICE_ROLE_KEY` on backend only.
- Never expose service role key in frontend files.

## 3) (Optional) RLS Policies for Public Bucket

If you keep bucket public and upload through backend (service role), this is usually enough.
You can still add policies for clarity.

Run in Supabase SQL editor:

```sql
-- Allow public read for objects in lazeo-uploads
create policy if not exists "Public read lazeo uploads"
on storage.objects for select
using (bucket_id = 'lazeo-uploads');
```

## 4) Private Bucket Alternative

If you want private files:

1. Keep bucket private.
2. Replace `getPublicUrl` in backend with signed URLs (`createSignedUrl`).
3. Return signed URL with an expiry time.

## 5) Restart Backend

After saving env vars, restart backend:

```bash
cd server
npm start
```

## 6) Verify Upload Flow

1. Open Admin Dashboard.
2. Upload product image or shipping/bank logo.
3. Confirm URL host is Supabase storage host.
4. Update image and verify old object gets removed.
5. Delete product and verify image gets removed.

## 8) Storage Health Check Endpoint

Use admin token and call:

```http
GET /api/admin/storage/health
Authorization: Bearer <admin-jwt-token>
```

Expected response includes:

- `ok`: storage connectivity status.
- `provider`: active runtime provider (`supabase`, `gdrive`, or `local`).
- `preferredProvider`: selected provider from settings/env.
- `mode`: provider mode (`supabase`, `gdrive`, `local`, or `local-fallback`).
- `maxUploadSizeMb`: active upload size limit.

You can also run this check directly from Admin Dashboard -> Settings via the "فحص حالة التخزين" button.

Admin Dashboard now also checks storage health automatically on load and every 60 seconds,
and shows a top status indicator with a local-fallback warning when Supabase is not active.

## 9) Upload Validation Rules

Backend upload currently allows:

- `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- `application/pdf`, `text/plain`

Files larger than `MAX_UPLOAD_SIZE_MB` are rejected.

## 7) Current Cleanup Behavior

The backend now removes old Supabase files in these cases:

- Product image changed.
- Product deleted.
- Shipping logo changed.
- Bank logo changed.
- User deleted: related receipt and custom-order attachment files are removed.
