# 服务器故障排查指南

## 快速诊断步骤

### 1. 运行诊断脚本

**在服务器上**:
```bash
ssh root@r77.igt.com.hk
cd /var/www/aac.uplifor.org/backend
php scripts/check-server-api.php
```

如果脚本不存在，手动上传：
```bash
# 从本地
scp backend/scripts/check-server-api.php root@r77.igt.com.hk:/var/www/aac.uplifor.org/backend/scripts/
```

### 2. 检查常见问题

#### 问题 1: 数据库连接失败

**检查**:
```bash
# 查看 .env 文件
cat /var/www/aac.uplifor.org/backend/.env

# 测试数据库连接
mysql -h <DB_HOST> -u <DB_USER> -p<DB_PASS> <DB_NAME> -e "SELECT 1"
```

**解决**:
- 确认数据库配置正确
- 确认数据库服务正在运行: `systemctl status mysql`
- 确认数据库用户权限

#### 问题 2: 数据库表不存在

**检查**:
```bash
mysql -h <DB_HOST> -u <DB_USER> -p<DB_PASS> <DB_NAME> -e "SHOW TABLES LIKE 'users'"
```

**解决**:
```bash
# 导入数据库架构
mysql -h <DB_HOST> -u <DB_USER> -p<DB_PASS> <DB_NAME> < /var/www/aac.uplifor.org/backend/database/schema.sql
```

#### 问题 3: PHP 扩展缺失

**检查**:
```bash
php -m | grep -E "pdo|pdo_mysql|json|mbstring"
```

**解决**:
```bash
apt-get update
apt-get install php8.3-mysql php8.3-mbstring
systemctl reload php8.3-fpm
```

#### 问题 4: 文件权限问题

**检查**:
```bash
ls -la /var/www/aac.uplifor.org/backend/api/auth.php
ls -la /var/www/aac.uplifor.org/backend/.env
```

**解决**:
```bash
chmod 644 /var/www/aac.uplifor.org/backend/api/auth.php
chmod 644 /var/www/aac.uplifor.org/backend/.env
chown -R www-data:www-data /var/www/aac.uplifor.org/backend
```

### 3. 查看错误日志

**PHP-FPM 日志**:
```bash
tail -50 /var/log/php8.3-fpm.log
```

**Nginx 错误日志**:
```bash
tail -50 /var/log/nginx/error.log
```

**应用错误日志** (如果配置了):
```bash
tail -50 /var/www/aac.uplifor.org/backend/logs/error.log
```

### 4. 测试 API 端点

**使用 curl**:
```bash
# 健康检查
curl https://aac.uplifor.org/api

# 测试注册
curl -X POST https://aac.uplifor.org/api/user \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User"}'
```

### 5. 重新部署

如果文件缺失，重新部署：
```bash
# 从本地运行
bash deploy-wsl.sh
```

## 常见错误和解决方案

### 错误: "Database connection failed"

**原因**: 数据库配置错误或服务未运行

**解决**:
1. 检查 `.env` 文件中的数据库配置
2. 确认 MySQL/MariaDB 服务正在运行
3. 测试数据库连接

### 错误: "Class 'Password' not found"

**原因**: `auth.php` 文件未正确加载

**解决**:
1. 确认 `backend/api/auth.php` 文件存在
2. 确认 `backend/api/routes/user.php` 中有 `require_once __DIR__ . '/../auth.php';`
3. 检查文件权限

### 错误: "Table 'cboard.users' doesn't exist"

**原因**: 数据库表未创建

**解决**:
1. 运行 `schema.sql` 创建数据库表
2. 确认数据库名称正确

### 错误: 500 Internal Server Error

**原因**: 多种可能（数据库、类加载、权限等）

**解决**:
1. 运行诊断脚本
2. 查看错误日志
3. 检查所有配置项

## 快速修复命令

```bash
# 1. 重新部署后端
bash deploy-wsl.sh

# 2. SSH 到服务器检查
ssh root@r77.igt.com.hk
cd /var/www/aac.uplifor.org/backend

# 3. 运行诊断
php scripts/check-server-api.php

# 4. 检查 PHP-FPM
systemctl status php8.3-fpm
systemctl reload php8.3-fpm

# 5. 检查 Nginx
nginx -t
systemctl reload nginx
```

