@echo off
echo ======================================
echo Manufacturing ERP - Windows Setup
echo ======================================
echo.
echo Step 1: Creating database directory...
if not exist "backend\db" mkdir backend\db
echo Created: backend\db
echo.
echo Step 2: Installing dependencies...
call npm install
echo.
echo Step 3: Starting server (database schema and admin login are created automatically on first run)...
echo.
echo Server will be available at: http://localhost:3000
echo Login: admin / admin123
echo.
pause
call node server.js
