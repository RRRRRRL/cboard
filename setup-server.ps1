# Setup script to build frontend and configure Nginx
# Usage: .\setup-server.ps1

$SERVER_HOST = "r77.igt.com.hk"
$SERVER_USER = "root"
$SERVER_PASS = "yyTTr437"
$SERVER_PATH = "/var/www/aac.uplifor.org"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Server Setup - Build Frontend & Configure Nginx" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$setupScript = @"
#!/bin/bash
set -e
cd $SERVER_PATH

echo "[*] Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "   Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs npm
fi

# Install npm if missing
if ! command -v npm &> /dev/null; then
    echo "   Installing npm..."
    apt-get install -y npm
fi

echo "[*] Node.js version:"
node --version || echo "Node.js not found"
npm --version || echo "npm not found"

echo "[*] Installing dependencies..."
if [ -f "package.json" ]; then
    npm install --legacy-peer-deps
else
    echo "   [!] package.json not found"
    exit 1
fi

echo "[*] Building frontend..."
npm run build

if [ ! -d "build" ]; then
    echo "   [!] Build failed - build directory not created"
    exit 1
fi

echo "[OK] Frontend built successfully"
echo "   Build directory size:"
du -sh build

echo ""
echo "[*] Configuring Nginx..."

# Create Nginx config
cat > /tmp/aac.uplifor.org.conf << 'NGINXEOF'
server {
    listen 80;
    listen [::]:80;
    server_name aac.uplifor.org;
    
    root /var/www/aac.uplifor.org/build;
    index index.html;
    
    access_log /var/log/nginx/aac.uplifor.org.access.log;
    error_log /var/log/nginx/aac.uplifor.org.error.log;
    
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    location /api {
        try_files `$uri =404;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME /var/www/aac.uplifor.org/backend/api/index.php;
        fastcgi_param PATH_INFO `$fastcgi_path_info;
        fastcgi_param QUERY_STRING `$query_string;
        include fastcgi_params;
        fastcgi_param HTTP_HOST `$host;
        fastcgi_param REQUEST_URI `$request_uri;
        fastcgi_connect_timeout 60s;
        fastcgi_send_timeout 60s;
        fastcgi_read_timeout 60s;
    }
    
    location / {
        try_files `$uri `$uri/ /index.html;
    }
    
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot|map)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    location ~ /\. {
        deny all;
    }
}
NGINXEOF

# Copy config to Nginx
cp /tmp/aac.uplifor.org.conf /etc/nginx/sites-available/aac.uplifor.org

# Create symlink if it doesn't exist
if [ ! -L /etc/nginx/sites-enabled/aac.uplifor.org ]; then
    ln -s /etc/nginx/sites-available/aac.uplifor.org /etc/nginx/sites-enabled/
fi

# Test Nginx config
if nginx -t; then
    echo "[OK] Nginx configuration valid"
    systemctl reload nginx
    echo "[OK] Nginx reloaded"
else
    echo "[!] Nginx configuration has errors"
    exit 1
fi

echo ""
echo "[OK] Setup complete!"
echo "   Frontend: https://aac.uplifor.org/"
echo "   API: https://aac.uplifor.org/api"
"@

Write-Host "[*] Uploading and executing setup script..." -ForegroundColor Cyan

if (Get-Command plink -ErrorAction SilentlyContinue) {
    # Save script to temp file
    $tempScript = [System.IO.Path]::GetTempFileName()
    $setupScript | Out-File -FilePath $tempScript -Encoding ASCII -NoNewline
    $content = Get-Content $tempScript -Raw
    $content = $content -replace "`r`n", "`n"
    [System.IO.File]::WriteAllText($tempScript, $content, [System.Text.UTF8Encoding]::new($false))
    
    # Upload and execute
    & pscp -pw $SERVER_PASS $tempScript "${SERVER_USER}@${SERVER_HOST}:/tmp/setup.sh"
    & plink -pw $SERVER_PASS "${SERVER_USER}@${SERVER_HOST}" "chmod +x /tmp/setup.sh && bash /tmp/setup.sh"
    
    Remove-Item $tempScript
} else {
    Write-Host "   Please SSH to server and run:" -ForegroundColor Yellow
    Write-Host "   ssh root@r77.igt.com.hk" -ForegroundColor White
    Write-Host "   Then paste the setup script manually" -ForegroundColor White
}

Write-Host ""
Write-Host "[OK] Setup script executed!" -ForegroundColor Green

