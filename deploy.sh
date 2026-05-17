#!/bin/bash

# EcoPro - GitHub & Vercel Deployment Script
# This script helps you push your project to GitHub and deploy on Vercel

echo "🚀 EcoPro Deployment Guide"
echo "=========================="
echo ""

# Step 1: Initialize Git
echo "📦 Step 1: Initializing Git repository..."
git init
echo "✅ Git initialized"
echo ""

# Step 2: Add files
echo "📝 Step 2: Adding files to git..."
git add .
echo "✅ Files staged"
echo ""

# Step 3: Create initial commit
echo "💾 Step 3: Creating initial commit..."
git commit -m "Initial commit: Multi-vendor storefront"
echo "✅ Initial commit created"
echo ""

# Step 4: Instructions for GitHub
echo "🔗 Step 4: Push to GitHub"
echo "------------------------"
echo ""
echo "1. Go to https://github.com and create a new repository"
echo "2. Copy your repository URL (e.g., https://github.com/YOUR_USERNAME/ecopro.git)"
echo ""
read -p "Paste your GitHub repository URL here: " REPO_URL
echo ""

if [ -n "$REPO_URL" ]; then
    echo "Adding remote origin..."
    git remote add origin "$REPO_URL"
    echo ""
    echo "🌐 Pushing to GitHub..."
    git branch -M main
    git push -u origin main
    echo "✅ Code pushed to GitHub!"
else
    echo "⚠️  No URL provided. You can push manually later with:"
    echo "   git remote add origin YOUR_REPO_URL"
    echo "   git branch -M main"
    echo "   git push -u origin main"
fi

echo ""
echo "🎉 Step 5: Deploy on Vercel"
echo "------------------------"
echo ""
echo "1. Go to https://vercel.com"
echo "2. Click 'Add New' → 'Project'"
echo "3. Import your GitHub repository"
echo "4. Vercel will auto-detect settings from vercel.json"
echo "5. Click 'Deploy'"
echo ""
echo "⚡ Your store will be live in ~2 minutes!"
echo ""
echo "📚 Important Notes:"
echo "   • Main store: https://your-app.vercel.app/store"
echo "   • Vendor dashboard: https://your-app.vercel.app/vendor/:id/dashboard"
echo "   • Admin panel: https://your-app.vercel.app/admin"
echo ""
echo "🔧 After deployment, the data will be shared across all users!"
echo "   (Currently using in-memory storage - consider adding a database for production)"
echo ""
echo "✨ Done! Your project is ready for deployment."
