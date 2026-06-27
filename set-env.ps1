#!/usr/bin/env pwsh

# Set Vercel environment variables for production
$env_vars = @{
    "VITE_FIREBASE_API_KEY" = "AIzaSyCnFRivCXPgIHJfgqjHuCENZCCOQK49hFY"
    "VITE_FIREBASE_AUTH_DOMAIN" = "laszeo-store-ksa.firebaseapp.com"
    "VITE_FIREBASE_PROJECT_ID" = "laszeo-store-ksa"
    "VITE_FIREBASE_STORAGE_BUCKET" = "laszeo-store-ksa.firebasestorage.app"
    "VITE_FIREBASE_MESSAGING_SENDER_ID" = "111955440984"
    "VITE_FIREBASE_APP_ID" = "1:111955440984:web:aa196a06c398e3688c212d"
    "VITE_FIREBASE_MEASUREMENT_ID" = "G-2ND5W5GNKJ"
    "VITE_API_BASE_URL" = "http://localhost:5000"
}

Write-Host "Setting Vercel environment variables..." -ForegroundColor Green

foreach ($key in $env_vars.Keys) {
    $value = $env_vars[$key]
    Write-Host "Setting $key..." -ForegroundColor Blue
    
    # Use echo to pipe value to vercel env add
    $value | npx vercel env add $key --yes 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ $key set successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠ $key may need manual setup" -ForegroundColor Yellow
    }
}

Write-Host "`nDone! Now deploying to production..." -ForegroundColor Green
