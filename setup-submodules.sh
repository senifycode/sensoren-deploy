#!/bin/bash

# Setup script for initializing Git submodules in sensoren-deploy repository
# This script adds all 4 service repositories as Git submodules

echo "🚀 Setting up Sensoren-Deploy submodules..."
echo ""

# GitHub organization/user - UPDATE THIS!
GITHUB_ORG="YOUR_GITHUB_USERNAME_OR_ORG"

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo "❌ Error: Not a git repository. Run 'git init' first."
    exit 1
fi

echo "📦 Adding service submodules..."
echo ""

# Add sensoren-server
echo "Adding sensoren-server..."
git submodule add https://github.com/${GITHUB_ORG}/Sensoren-Server.git sensoren-server
if [ $? -eq 0 ]; then
    echo "✅ sensoren-server added"
else
    echo "⚠️  sensoren-server may already exist or failed to add"
fi

# Add broker-service
echo "Adding broker-service..."
git submodule add https://github.com/${GITHUB_ORG}/broker-service.git broker-service
if [ $? -eq 0 ]; then
    echo "✅ broker-service added"
else
    echo "⚠️  broker-service may already exist or failed to add"
fi

# Add websocket-service
echo "Adding websocket-service..."
git submodule add https://github.com/${GITHUB_ORG}/websocket-service.git websocket-service
if [ $? -eq 0 ]; then
    echo "✅ websocket-service added"
else
    echo "⚠️  websocket-service may already exist or failed to add"
fi

# Add backup-service
echo "Adding backup-service..."
git submodule add https://github.com/${GITHUB_ORG}/backup-service.git backup-service
if [ $? -eq 0 ]; then
    echo "✅ backup-service added"
else
    echo "⚠️  backup-service may already exist or failed to add"
fi

echo ""
echo "📥 Initializing nested submodules (shared-utils)..."
git submodule update --init --recursive

echo ""
echo "✅ Submodule setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Review .gitmodules file"
echo "2. Commit the changes: git add . && git commit -m 'Add service submodules'"
echo "3. Push to remote: git push origin main"
echo ""
echo "To update all submodules to latest: git submodule update --remote --merge"
