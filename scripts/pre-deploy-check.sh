#!/bin/bash

echo "🔍 Pre-Deployment Checklist"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if .env.local exists
if [ -f .env.local ]; then
    echo "✅ .env.local found"
else
    echo "❌ .env.local not found"
fi

# Check if .gitignore includes .env files
if grep -q ".env" .gitignore 2>/dev/null; then
    echo "✅ .env files are in .gitignore"
else
    echo "⚠️  .env files not in .gitignore - add them!"
fi

# Check for required environment variables
echo ""
echo "📋 Required Environment Variables:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

required_vars=(
    "DATABASE_URL"
    "DIRECT_URL"
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
)

for var in "${required_vars[@]}"; do
    if grep -q "^$var=" .env.local 2>/dev/null; then
        echo "✅ $var"
    else
        echo "❌ $var - MISSING"
    fi
done

echo ""
echo "📦 Optional Integration Variables:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

optional_vars=(
    "XERO_CLIENT_ID"
    "XERO_CLIENT_SECRET"
    "MERCURY_API_KEY"
    "ENCRYPTION_KEY"
)

for var in "${optional_vars[@]}"; do
    if grep -q "^$var=" .env.local 2>/dev/null; then
        echo "✅ $var"
    else
        echo "⚠️  $var - Not set (ok if not using this integration)"
    fi
done

echo ""
echo "🔨 Build Test:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Running build to check for errors..."
npm run build > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed - fix errors before deploying"
    echo "   Run: npm run build"
fi

echo ""
echo "🌳 Git Status:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git status --short

echo ""
echo "📊 Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "If all checks pass above, you're ready to deploy!"
echo ""
