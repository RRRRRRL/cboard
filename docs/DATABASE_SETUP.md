# 数据库设置指南

## 问题诊断

如果遇到 `Access denied for user 'cboard_user'@'localhost'` 错误，说明数据库用户配置有问题。

## 解决方案

### 方案 1: 创建新的数据库用户（推荐）

**SSH 到服务器**:
```bash
ssh root@r77.igt.com.hk
```

**登录 MySQL**:
```bash
mysql -u root -p
```

**执行以下 SQL 命令**:
```sql
-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS cboard 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

-- 创建用户（如果不存在）
CREATE USER IF NOT EXISTS 'cboard_user'@'localhost' IDENTIFIED BY 'your_secure_password';

-- 授予权限
GRANT ALL PRIVILEGES ON cboard.* TO 'cboard_user'@'localhost';

-- 刷新权限
FLUSH PRIVILEGES;

-- 验证用户
SELECT user, host FROM mysql.user WHERE user = 'cboard_user';

-- 退出
EXIT;
```

**更新 .env 文件**:
```bash
cd /var/www/aac.uplifor.org/backend
nano .env
```

确保以下配置正确：
```env
DB_HOST=127.0.0.1
DB_NAME=cboard
DB_USER=cboard_user
DB_PASS=your_secure_password
```

### 方案 2: 使用现有的 MySQL root 用户

**编辑 .env 文件**:
```bash
cd /var/www/aac.uplifor.org/backend
nano .env
```

更新为：
```env
DB_HOST=127.0.0.1
DB_NAME=cboard
DB_USER=root
DB_PASS=your_root_password
```

**注意**: 使用 root 用户在生产环境中不推荐，仅用于测试。

### 方案 3: 重置数据库用户密码

**如果用户已存在但密码错误**:
```bash
mysql -u root -p
```

```sql
-- 重置密码
ALTER USER 'cboard_user'@'localhost' IDENTIFIED BY 'new_secure_password';
FLUSH PRIVILEGES;
EXIT;
```

然后更新 `.env` 文件中的 `DB_PASS`。

## 导入数据库架构

**创建数据库表**:
```bash
cd /var/www/aac.uplifor.org/backend
mysql -u cboard_user -p cboard < database/schema.sql
```

**验证表已创建**:
```bash
mysql -u cboard_user -p cboard -e "SHOW TABLES;"
```

应该看到以下表：
- users
- profiles
- boards
- cards
- settings
- 等等...

## 测试数据库连接

**运行诊断脚本**:
```bash
cd /var/www/aac.uplifor.org/backend
php scripts/check-server-api.php
```

**或手动测试**:
```bash
mysql -u cboard_user -p cboard -e "SELECT 1"
```

如果成功，应该看到：
```
+---+
| 1 |
+---+
| 1 |
+---+
```

## 常见问题

### 问题 1: "Access denied" 错误

**原因**: 用户名或密码错误

**解决**:
1. 检查 `.env` 文件中的 `DB_USER` 和 `DB_PASS`
2. 确认 MySQL 用户存在且有正确权限
3. 测试连接: `mysql -u <DB_USER> -p<DB_PASS> <DB_NAME>`

### 问题 2: "Unknown database" 错误

**原因**: 数据库不存在

**解决**:
```sql
CREATE DATABASE cboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 问题 3: "Table doesn't exist" 错误

**原因**: 数据库表未创建

**解决**:
```bash
mysql -u cboard_user -p cboard < /var/www/aac.uplifor.org/backend/database/schema.sql
```

## 安全建议

1. **使用强密码**: 数据库密码应该至少 16 个字符，包含大小写字母、数字和特殊字符
2. **限制权限**: 只授予应用需要的权限（SELECT, INSERT, UPDATE, DELETE）
3. **不要使用 root**: 为应用创建专用数据库用户
4. **保护 .env 文件**: 确保 `.env` 文件权限为 600，只有所有者可读
   ```bash
   chmod 600 /var/www/aac.uplifor.org/backend/.env
   ```

## 快速修复命令

```bash
# 1. SSH 到服务器
ssh root@r77.igt.com.hk

# 2. 登录 MySQL
mysql -u root -p

# 3. 创建用户和数据库（在 MySQL 中）
CREATE DATABASE IF NOT EXISTS cboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'cboard_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON cboard.* TO 'cboard_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# 4. 更新 .env 文件
cd /var/www/aac.uplifor.org/backend
nano .env  # 更新 DB_USER 和 DB_PASS

# 5. 导入数据库架构
mysql -u cboard_user -p cboard < database/schema.sql

# 6. 测试连接
php scripts/check-server-api.php
```

