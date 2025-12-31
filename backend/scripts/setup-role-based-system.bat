@echo off
REM Role-Based Access Control System Setup Script for Windows
REM This batch file runs the PHP setup script for the Cboard role-based system

echo === Cboard Role-Based Access Control System Setup ===
echo.

REM Check if PHP is available
php --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: PHP is not installed or not in PATH
    echo.
    echo Please install PHP and ensure it's in your PATH, or run the setup script manually:
    echo.
    echo Method 1 - Direct PHP execution:
    echo   php backend/scripts/setup-role-based-system.php
    echo.
    echo Method 2 - If you have a local PHP installation:
    echo   "C:\path\to\php\php.exe" backend/scripts/setup-role-based-system.php
    echo.
    echo Method 3 - Using a web server (recommended for production):
    echo   Access the setup script via your web browser at:
    echo   http://localhost/your-cboard-backend/scripts/setup-role-based-system.php
    echo.
    pause
    exit /b 1
)

echo ✓ PHP found, running setup script...
echo.

REM Run the PHP setup script
php scripts/setup-role-based-system.php

if %errorlevel% equ 0 (
    echo.
    echo ✓ Setup completed successfully!
    echo.
    echo Next steps:
    echo 1. Start your Cboard application
    echo 2. Login with sample accounts to test role-based features
    echo 3. Assign users to organizations via admin dashboard
    echo.
) else (
    echo.
    echo ❌ Setup failed! Check the error messages above.
    echo.
)

echo Press any key to continue...
pause >nul
