#!/bin/bash
echo "======================================"
echo "Manufacturing ERP - Setup"
echo "======================================"
echo ""
echo "Step 1: Creating database directory..."
mkdir -p backend/db
echo "Created: backend/db"
echo ""
echo "Step 2: Installing dependencies..."
npm install
echo ""
echo "Step 3: Starting server (database schema and admin login are created automatically on first run)..."
echo ""
echo "Server will be available at: http://localhost:3000"
echo "Login: admin / admin123"
echo ""
node server.js
