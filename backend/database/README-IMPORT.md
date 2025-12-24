# 数据库导入指南

本指南说明如何将项目数据库导入到服务器。

## 方法 1: 使用 PowerShell 脚本（Windows）

### 前置要求
- 已安装 MySQL 客户端（包含 `mysql` 命令）
- 已配置服务器数据库访问权限

### 使用步骤

1. **打开 PowerShell**，导航到项目根目录：
   ```powershell
   cd C:\Users\wongchaksan\Desktop\cboard
   ```

2. **设置数据库连接参数**（可选，如果与默认值不同）：
   ```powershell
   $env:DB_HOST="r77.igt.com.hk"
   $env:DB_USER="root"
   $env:DB_PASS="your_password"
   $env:DB_NAME="cboard"
   ```

3. **运行导入脚本**：
   ```powershell
   .\backend\scripts\import-database-to-server.ps1
   ```

   或者直接指定参数：
   ```powershell
   .\backend\scripts\import-database-to-server.ps1 -DB_HOST "r77.igt.com.hk" -DB_USER "root" -DB_PASS "your_password"
   ```

## 方法 2: 使用 Bash 脚本（Linux/WSL）

### 前置要求
- 已安装 MySQL 客户端
- 已配置服务器数据库访问权限

### 使用步骤

1. **在 WSL 或 Linux 终端中**，导航到项目根目录：
   ```bash
   cd /mnt/c/Users/wongchaksan/Desktop/cboard
   ```

2. **设置执行权限**：
   ```bash
   chmod +x backend/scripts/import-database-to-server.sh
   ```

3. **设置数据库连接参数**（可选）：
   ```bash
   export DB_HOST="r77.igt.com.hk"
   export DB_USER="root"
   export DB_PASS="your_password"
   export DB_NAME="cboard"
   ```

4. **运行导入脚本**：
   ```bash
   bash backend/scripts/import-database-to-server.sh
   ```

## 方法 3: 通过 SSH 直接导入（推荐）

### 步骤

1. **将数据库文件上传到服务器**：
   ```bash
   scp -r backend/database root@r77.igt.com.hk:/tmp/cboard-database
   ```

2. **SSH 连接到服务器**：
   ```bash
   ssh root@r77.igt.com.hk
   ```

3. **在服务器上运行导入**：
   ```bash
   cd /tmp/cboard-database
   
   # 创建数据库
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS cboard DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci;"
   
   # 导入架构
   mysql -u root -p cboard < schema.sql
   
   # 导入种子数据（按顺序）
   mysql -u root -p cboard < seed-system-user.sql
   mysql -u root -p cboard < seed-preset-profiles.sql
   mysql -u root -p cboard < seed-jyutping-dictionary.sql
   mysql -u root -p cboard < seed-jyutping-dictionary-extended.sql
   
   # 创建管理员账户
   mysql -u root -p cboard < create-admin-user.sql
   ```

## 方法 4: 使用 MySQL Workbench 或其他 GUI 工具

1. **连接到服务器数据库**
2. **打开并执行以下 SQL 文件**（按顺序）：
   - `backend/database/schema.sql` - 创建表结构
   - `backend/database/seed-system-user.sql` - 系统用户
   - `backend/database/seed-preset-profiles.sql` - 预设配置文件
   - `backend/database/seed-jyutping-dictionary.sql` - 粤拼字典
   - `backend/database/seed-jyutping-dictionary-extended.sql` - 扩展粤拼字典
   - `backend/database/create-admin-user.sql` - 管理员账户

## 导入的文件说明

| 文件 | 说明 | 是否必需 |
|------|------|----------|
| `schema.sql` | 数据库架构（表结构） | ✅ 必需 |
| `seed-system-user.sql` | 系统用户数据 | ⚠️ 建议 |
| `seed-preset-profiles.sql` | 预设配置文件 | ⚠️ 建议 |
| `seed-jyutping-dictionary.sql` | 基础粤拼字典 | ⚠️ 建议 |
| `seed-jyutping-dictionary-extended.sql` | 扩展粤拼字典 | ⚪ 可选 |
| `create-admin-user.sql` | 创建管理员账户 | ⚠️ 建议 |

## 验证导入

导入完成后，可以运行以下 SQL 查询验证：

```sql
-- 检查表数量
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'cboard';

-- 检查用户数量
SELECT COUNT(*) as user_count FROM users;

-- 检查配置文件数量
SELECT COUNT(*) as profile_count FROM profiles;

-- 检查板数量
SELECT COUNT(*) as board_count FROM boards;

-- 检查粤拼字典条目数量
SELECT COUNT(*) as jyutping_count FROM jyutping_dictionary;
```

## 默认管理员账户

导入 `create-admin-user.sql` 后，会创建以下管理员账户：

- **邮箱**: `admin@aac.uplifor.org`
- **密码**: `Admin123!`
- **角色**: `admin`

⚠️ **重要**: 首次登录后请立即更改密码！

## 故障排除

### 错误: "Access denied for user"
- 检查数据库用户名和密码是否正确
- 确认用户有创建数据库和表的权限

### 错误: "Table already exists"
- 如果表已存在，可以：
  1. 删除现有数据库：`DROP DATABASE cboard;`
  2. 重新运行导入脚本
  3. 或者使用 `CREATE TABLE IF NOT EXISTS`（已在 schema.sql 中使用）

### 错误: "Unknown database"
- 确保先创建数据库，或使用 `CREATE DATABASE IF NOT EXISTS`

### 连接超时
- 检查服务器 IP 地址是否正确
- 确认防火墙允许 MySQL 端口（默认 3306）
- 检查 MySQL 是否允许远程连接

## 更新后端配置

导入数据库后，确保 `backend/.env` 文件包含正确的数据库配置：

```env
DB_HOST=r77.igt.com.hk
DB_PORT=3306
DB_NAME=cboard
DB_USER=root
DB_PASS=your_password
```

## 需要帮助？

如果遇到问题，请检查：
1. MySQL 客户端是否正确安装
2. 服务器数据库访问权限
3. 网络连接是否正常
4. SQL 文件是否存在且完整

