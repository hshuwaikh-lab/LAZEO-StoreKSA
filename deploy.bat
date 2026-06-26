@echo off
REM Firebase Cloud Functions Deployment Script for LAZEO StoreKSA

echo ========================================
echo LAZEO StoreKSA - Firebase Deployment
echo ========================================
echo.

REM Check if npm is available
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm is not installed or not in PATH
    exit /b 1
)

REM Check if firebase-tools is installed globally
npm list -g firebase-tools >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Installing Firebase CLI globally...
    npm install -g firebase-tools
)

echo.
echo Step 1: Install Cloud Functions dependencies...
cd functions
call npm install
cd ..

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install functions dependencies
    exit /b 1
)

echo.
echo Step 2: Build frontend...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to build frontend
    exit /b 1
)

echo.
echo Step 3: Deploy to Firebase...
echo Please login to Firebase when prompted.
echo.
call firebase deploy

echo.
echo ========================================
echo Deployment Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Check your Firebase console for the Cloud Functions URL
echo 2. Update .env.production with the new VITE_API_BASE_URL
echo 3. Run "npm run build && npm run deploy" to deploy frontend
echo.
pause
