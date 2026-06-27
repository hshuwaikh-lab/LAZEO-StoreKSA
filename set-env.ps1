#!/usr/bin/env pwsh

# Set Vercel environment variables for production
$env_vars = @{
    "VITE_API_BASE_URL" = "https://lazeo-storeksa.onrender.com"
    "VITE_SUPABASE_URL" = "https://hslolngigrxwviklahme.supabase.co"
    "VITE_SUPABASE_ANON_KEY" = "YOUR_SUPABASE_ANON_KEY"
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
