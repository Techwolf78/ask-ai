#!/usr/bin/env powershell

# Ask AI API - Production Deployment Script
# Run this script to deploy to production

Write-Host "🚀 Ask AI API - Production Deployment" -ForegroundColor Green

# Check if Vercel CLI is installed
if (!(Get-Command "vercel" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Red
    npm install -g vercel
}

# Check for required files
$requiredFiles = @("api/ask-ai.js", "package.json", "vercel.json")
foreach ($file in $requiredFiles) {
    if (!(Test-Path $file)) {
        Write-Host "❌ Missing required file: $file" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ All required files present" -ForegroundColor Green

# Check environment variables
if (!(Test-Path ".env")) {
    Write-Host "⚠️  No .env file found. You'll need to set GROQ_API_KEY in Vercel dashboard" -ForegroundColor Yellow
} else {
    Write-Host "✅ Environment file found" -ForegroundColor Green
}

# Deploy to production
Write-Host "🚀 Deploying to Vercel..." -ForegroundColor Blue
vercel --prod

Write-Host ""
Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Post-Deployment Checklist:" -ForegroundColor Yellow
Write-Host "1. Set GROQ_API_KEY in Vercel dashboard"
Write-Host "2. Test API endpoints using the Postman collection"
Write-Host "3. Verify CORS is working for cross-origin requests"
Write-Host "4. Test with sales team queries"
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "- README.md - Quick start guide"
Write-Host "- PRODUCTION-DEPLOYMENT.md - Detailed deployment info"
Write-Host "- production-validation.postman_collection.json - API tests"
Write-Host ""
Write-Host "🎯 Ready for Sales Teams!" -ForegroundColor Green
