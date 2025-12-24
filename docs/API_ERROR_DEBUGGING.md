# API 500 错误调试指南

## 问题诊断

如果遇到 `POST /api/user 500 (Internal Server Error)`，请按以下步骤排查：

## 1. 检查服务器日志

**SSH 到服务器**:
```bash
ssh root@r77.igt.com.hk
```

**查看 PHP 错误日志**:
```bash
# Nginx/PHP-FPM 错误日志
tail -f /var/log/nginx/error.log
tail -f /var/log/php8.3-fpm.log

# 或系统日志
tail -f /var/log/syslog | grep php
```

**查看应用错误日志**:
```bash
# 如果配置了应用日志
tail -f /var/www/aac.uplifor.org/backend/logs/error.log
```

## 2. 运行诊断脚本

**在服务器上运行**:
```bash
cd /var/www/aac.uplifor.org/backend
php scripts/check-server-api.php
```

这将检查：
- PHP 版本和扩展
- 数据库连接
- 环境变量配置
- 必要的类和文件
- 文件权限

## 3. 常见原因和解决方案

### 原因 1: 数据库连接失败

**症状**: 日志显示 "Database connection failed"

**检查**:
```bash
# 检查数据库配置
cat /var/www/aac.uplifor.org/backend/.env | grep DB_

# 测试数据库连接
mysql -h <DB_HOST> -u <DB_USER> -p<DB_PASS> <DB_NAME> -e "SELECT 1"
```

**解决**:
- 确认 `.env` 文件中的数据库配置正确
- 确认数据库服务正在运行
- 确认数据库用户有正确的权限

### 原因 2: 数据库表不存在

**症状**: 日志显示 "Table 'cboard.users' doesn't exist"

**检查**:
```bash
mysql -h <DB_HOST> -u <DB_USER> -p<DB_PASS> <DB_NAME> -e "SHOW TABLES LIKE 'users'"
```

**解决**:
```bash
# 导入数据库架构
mysql -h <DB_HOST> -u <DB_USER> -p<DB_PASS> <DB_NAME> < /var/www/aac.uplifor.org/backend/database/schema.sql
```

### 原因 3: Password 或 JWT 类未加载

**症状**: 日志显示 "Class 'Password' not found" 或 "Class 'JWT' not found"

**检查**:
```bash
# 检查 auth.php 文件是否存在
ls -la /var/www/aac.uplifor.org/backend/api/auth.php

# 检查文件权限
ls -l /var/www/aac.uplifor.org/backend/api/auth.php
```

**解决**:
- 确认 `backend/api/auth.php` 文件存在
- 确认文件权限正确 (644)
- 确认 `require_once __DIR__ . '/../auth.php';` 在 `user.php` 中正确

### 原因 4: 环境变量未设置

**症状**: 日志显示配置错误

**检查**:
```bash
cd /var/www/aac.uplifor.org/backend
php -r "require 'config/env-loader.php'; echo 'DB_HOST: ' . getenv('DB_HOST') . PHP_EOL;"
```

**解决**:
- 确认 `.env` 文件存在
- 确认 `.env` 文件包含所有必要的变量
- 确认 PHP-FPM 可以读取 `.env` 文件

### 原因 5: PHP 扩展缺失

**症状**: 日志显示扩展相关错误

**检查**:
```bash
php -m | grep -E "pdo|pdo_mysql|json|mbstring"
```

**解决**:
```bash
# 安装缺失的扩展
apt-get update
apt-get install php8.3-mysql php8.3-mbstring
systemctl reload php8.3-fpm
```

## 4. 临时启用详细错误信息

**修改 `backend/api/index.php`**:
```php
// 临时启用（仅用于调试）
ini_set('display_errors', 1);
error_reporting(E_ALL);
```

**或设置环境变量**:
```bash
# 在 .env 文件中
APP_DEBUG=true
```

**注意**: 调试完成后，记得关闭详细错误信息！

## 5. 测试 API 端点

**使用 curl 测试**:
```bash
curl -X POST https://aac.uplifor.org/api/user \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User"}'
```

**检查响应**:
- 如果返回 500，查看响应中的错误信息
- 如果返回 400，检查请求数据格式
- 如果返回 201，注册成功

## 6. 验证修复

修复后，重新测试注册功能：
1. 访问 `https://aac.uplifor.org`
2. 尝试注册新用户
3. 检查浏览器控制台和网络请求
4. 检查服务器日志确认没有错误

## 7. 快速检查清单

- [ ] 数据库服务正在运行
- [ ] `.env` 文件存在且配置正确
- [ ] 数据库表已创建（运行 `schema.sql`）
- [ ] PHP 扩展已安装（pdo, pdo_mysql, json, mbstring）
- [ ] 文件权限正确（`backend/api/` 目录可读）
- [ ] `auth.php` 文件存在
- [ ] PHP-FPM 已重新加载
- [ ] Nginx 已重新加载

## 8. 获取帮助

如果问题仍然存在，请提供：
1. 服务器诊断脚本输出
2. PHP 错误日志相关部分
3. 数据库连接测试结果
4. `.env` 文件配置（隐藏敏感信息）

