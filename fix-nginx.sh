#!/bin/bash
# Fix Nginx configuration for aac.uplifor.org

PHP_SOCK=$(find /var/run/php -name '*.sock' 2>/dev/null | head -1)
if [ -z "$PHP_SOCK" ]; then
    PHP_SOCK="127.0.0.1:9000"
fi

echo "Using PHP socket: $PHP_SOCK"

# Update Nginx config with correct PHP socket
sed -i "s|unix:/var/run/php/php8.1-fpm.sock|$PHP_SOCK|g" /etc/nginx/sites-available/aac.uplifor.org

# Test and reload
if nginx -t; then
    systemctl reload nginx
    echo "[OK] Nginx configured and reloaded"
else
    echo "[!] Nginx configuration has errors"
    exit 1
fi

