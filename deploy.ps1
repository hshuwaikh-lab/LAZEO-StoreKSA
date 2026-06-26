#!/usr/bin/env pwsh

Write-Host "========================================" -ForegroundColor Green
Write-Host "LAZEO StoreKSA - Firebase Deployment" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if npm is available
try {
    $npmVersion = npm --version
    Write-Host "npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: npm is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if firebase-tools is installed globally
Write-Host ""
Write-Host "Checking Firebase CLI..." -ForegroundColor Yellow
$firebaseCheck = npm list -g firebase-tools 2>&1
if ($firebaseCheck -match "not installed") {
    Write-Host "Installing Firebase CLI globally..." -ForegroundColor Yellow
    npm install -g firebase-tools
}

Write-Host ""
Write-Host "Step 1: Install Cloud Functions dependencies..." -ForegroundColor Yellow
Set-Location "functions"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install functions dependencies" -ForegroundColor Red
    exit 1
}
Set-Location ".."

Write-Host ""
Write-Host "Step 2: Build frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to build frontend" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 3: Deploy to Firebase..." -ForegroundColor Yellow
Write-Host "Please login to Firebase when prompted." -ForegroundColor Cyan
Write-Host ""
firebase deploy

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Check your Firebase console for the Cloud Functions URL" -ForegroundColor Cyan
Write-Host "2. Update .env.production with the new VITE_API_BASE_URL" -ForegroundColor Cyan
Write-Host "3. Run 'npm run build && npm run deploy' to deploy frontend" -ForegroundColor Cyan
Write-Host ""
