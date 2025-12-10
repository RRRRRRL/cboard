#!/bin/bash
# Fix Docker Permissions in WSL2
# Run this script to fix "permission denied" errors

echo "========================================"
echo "Fixing Docker Permissions"
echo "========================================"
echo ""

# Check if user is already in docker group
if groups | grep -q docker; then
    echo "✓ User is already in docker group"
    echo "If you still get permission errors, try: newgrp docker"
    exit 0
fi

echo "Adding user to docker group..."
sudo usermod -aG docker $USER

echo ""
echo "✓ User added to docker group"
echo ""
echo "IMPORTANT: You need to either:"
echo "  1. Log out and log back in to WSL2"
echo "  2. Or run: newgrp docker"
echo ""
echo "After that, verify with:"
echo "  docker ps"
echo ""

# Try to activate new group without logout
echo "Attempting to activate docker group..."
newgrp docker << EOF
echo "Testing Docker access..."
docker ps > /dev/null 2>&1
if [ \$? -eq 0 ]; then
    echo "✓ Docker access working!"
else
    echo "⚠ Still having issues. Please log out and back in."
fi
EOF

echo ""
echo "If docker ps works now, you can continue with:"
echo "  ./setup.sh"
echo ""

