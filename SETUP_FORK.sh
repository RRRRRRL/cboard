#!/bin/bash
# Script to help fork the cboard project
# Run this after you've forked the repository on GitHub

echo "=========================================="
echo "Setting up Fork for Cboard Project"
echo "=========================================="
echo ""

# Check if git is configured
if [ -z "$(git config user.name)" ] || [ -z "$(git config user.email)" ]; then
    echo "⚠️  Git user information not configured"
    echo ""
    read -p "Enter your GitHub username: " GITHUB_USERNAME
    read -p "Enter your email: " GITHUB_EMAIL
    
    git config user.name "$GITHUB_USERNAME"
    git config user.email "$GITHUB_EMAIL"
    echo "✅ Git configured"
    echo ""
fi

# Show current remote
echo "Current remote:"
git remote -v
echo ""

# Ask for fork URL
echo "Please provide your fork URL:"
echo "  Format: https://github.com/YOUR_USERNAME/cboard.git"
read -p "Enter your fork URL: " FORK_URL

if [ -z "$FORK_URL" ]; then
    echo "❌ No URL provided. Exiting."
    exit 1
fi

# Update remote
echo ""
echo "Updating remote to point to your fork..."
git remote set-url origin "$FORK_URL"

echo ""
echo "✅ Remote updated!"
echo ""
echo "New remote:"
git remote -v
echo ""

# Stage all changes
echo "Staging all changes..."
git add .
echo "✅ Changes staged"
echo ""

# Commit
echo "Committing changes..."
git commit -m "Sprint 1-7: PHP/MySQL backend, Jyutping keyboard, and enhancements

- Sprint 1: Environment setup & base architecture
- Sprint 2: User profiles & database backbone  
- Sprint 3: Card editing mode
- Sprint 4: Communication mode with TTS
- Sprint 5: Accessibility - Scanning engine
- Sprint 6: External switch + Eye tracking
- Sprint 7: Jyutping keyboard (frontend + backend)"

if [ $? -eq 0 ]; then
    echo "✅ Changes committed"
    echo ""
    echo "Ready to push! Run:"
    echo "  git push origin master"
    echo ""
    echo "If you get an error about diverged branches, use:"
    echo "  git push origin master --force"
else
    echo "❌ Commit failed. Please check the error above."
    exit 1
fi

