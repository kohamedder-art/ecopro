#!/bin/bash

# Git Configuration and Deployment Helper
echo "🔧 Git Configuration"
echo "==================="
echo ""

# Configure Git user
read -p "Enter your name for Git commits: " GIT_NAME
read -p "Enter your email for Git commits: " GIT_EMAIL

git config user.name "$GIT_NAME"
git config user.email "$GIT_EMAIL"

echo ""
echo "✅ Git configured with:"
echo "   Name: $GIT_NAME"
echo "   Email: $GIT_EMAIL"
echo ""

# Create initial commit
echo "💾 Creating initial commit..."
git commit -m "Initial commit: Multi-vendor marketplace with VIP system

Features:
- Multi-vendor marketplace platform
- Individual vendor storefronts with unique URLs
- Product management dashboard
- VIP subscription system
- Dual visibility controls (private vs marketplace)
- API backend with Express
- Responsive design with dark mode
- RTL Arabic support"

echo ""
echo "✅ Initial commit created!"
echo ""
echo "📋 Next steps:"
echo "-------------"
echo ""
echo "1. Create a new repository on GitHub:"
echo "   → Go to https://github.com/new"
echo "   → Repository name: ecopro (or your choice)"
echo "   → Keep it Public or Private"
echo "   → DO NOT initialize with README"
echo "   → Click 'Create repository'"
echo ""
echo "2. Copy the repository URL from GitHub"
echo ""
read -p "3. Paste your GitHub repository URL here: " REPO_URL

if [ -n "$REPO_URL" ]; then
    echo ""
    echo "🔗 Adding remote and pushing..."
    git remote add origin "$REPO_URL"
    git push -u origin main
    
    echo ""
    echo "🎉 Success! Your code is on GitHub!"
    echo ""
    echo "🚀 Final step: Deploy on Vercel"
    echo "------------------------------"
    echo "1. Go to https://vercel.com"
    echo "2. Sign in with your GitHub account"
    echo "3. Click 'Add New' → 'Project'"
    echo "4. Select your 'ecopro' repository"
    echo "5. Click 'Deploy' (Vercel auto-detects settings)"
    echo ""
    echo "⏱️  Wait ~2 minutes for deployment..."
    echo ""
    echo "✨ Your marketplace will be live!"
    echo "   Share the Vercel URL with all 3 users"
else
    echo ""
    echo "⚠️  Skipped GitHub push. Run these commands manually:"
    echo ""
    echo "   git remote add origin YOUR_GITHUB_URL"
    echo "   git push -u origin main"
fi

echo ""
echo "📖 See DEPLOYMENT.md for detailed instructions"
