# How to Fork This Project

## Option 1: Fork on GitHub (Recommended)

1. **Go to GitHub and Fork the Repository:**
   - Visit: https://github.com/cboard-org/cboard
   - Click the "Fork" button in the top right
   - This creates a copy in your GitHub account

2. **After forking on GitHub, update your local repository:**
   ```bash
   # Replace YOUR_USERNAME with your actual GitHub username
   git remote set-url origin https://github.com/YOUR_USERNAME/cboard.git
   
   # Verify the change
   git remote -v
   ```

3. **Push your changes to your fork:**
   ```bash
   git push origin master
   ```
   
   If you get an error about diverged branches, use:
   ```bash
   git push origin master --force
   ```
   (Only use --force if you're sure you want to overwrite your fork)

## Option 2: Create a New Repository and Push

1. **Create a New Repository on GitHub:**
   - Go to GitHub and create a new repository (e.g., `cboard-enhanced`)
   - Don't initialize it with README, .gitignore, or license

2. **Update Remote and Push:**
   ```bash
   # Remove current origin
   git remote remove origin
   
   # Add your new repository as origin
   git remote add origin https://github.com/YOUR_USERNAME/cboard-enhanced.git
   
   # Push all branches
   git push -u origin master
   ```

## Option 3: Keep Original and Add Your Fork

```bash
# Keep original as 'upstream'
git remote rename origin upstream

# Add your fork as 'origin'
git remote add origin https://github.com/YOUR_USERNAME/cboard.git

# Push to your fork
git push -u origin master
```

## Current Status

- **Current Remote:** `origin` → https://github.com/cboard-org/cboard.git
- **Current Branch:** `master`
- **Status:** You have uncommitted changes

## Recommended Steps

1. **Commit your current changes first:**
   ```bash
   git add .
   git commit -m "Sprint 1-7 implementation: PHP/MySQL backend, Jyutping keyboard, and enhancements"
   ```

2. **Create a fork on GitHub** (Option 1) or **create a new repository** (Option 2)

3. **Update your remote** and push

## Note

If you want to keep contributing to the original cboard project while maintaining your enhanced version, use Option 3 to keep both remotes.

