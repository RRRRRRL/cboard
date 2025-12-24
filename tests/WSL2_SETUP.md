# WSL2 环境设置指南

本指南帮助您在 WSL2 (Windows Subsystem for Linux 2) 环境中设置和运行 Cboard 增强项目。

---

## 📋 前置要求

### 1. WSL2 安装

确保已安装 WSL2：

```bash
# 检查 WSL 版本
wsl --list --verbose

# 如果未安装 WSL2，在 PowerShell (管理员) 中运行:
wsl --install
```

### 2. 更新系统

```bash
sudo apt update
sudo apt upgrade -y
```

---

## 🔧 环境配置

### 1. 安装 Node.js

```bash
# 使用 nvm 安装 Node.js (推荐)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# 安装 Node.js LTS 版本
nvm install --lts
nvm use --lts

# 验证安装
node --version
npm --version
```

### 2. 安装 PHP

```bash
# 安装 PHP 和必要扩展
sudo apt install php php-cli php-mysql php-json php-mbstring php-xml php-curl -y

# 验证安装
php --version
```

### 3. 安装 MySQL

```bash
# 安装 MySQL
sudo apt install mysql-server -y

# 启动 MySQL 服务
sudo service mysql start

# 设置 root 密码 (首次安装时)
sudo mysql_secure_installation

# 验证安装
mysql --version
```

### 4. 安装其他工具

```bash
# 安装 Git
sudo apt install git -y

# 安装 curl (用于 API 测试)
sudo apt install curl -y
```

---

## 📦 项目设置

### 1. 克隆/进入项目目录

```bash
# 如果项目在 Windows 文件系统中
cd /mnt/c/Users/wongchaksan/Desktop/cboard

# 或者如果项目在 WSL2 文件系统中
cd ~/cboard
```

### 2. 安装前端依赖

```bash
npm install
```

### 3. 配置后端

```bash
# 复制配置文件模板
cd backend
cp config/config.example.php config/config.php

# 编辑配置文件
nano config/config.php
# 或使用其他编辑器
```

在 `config.php` 中设置：

```php
<?php
// 数据库配置
define('DB_HOST', 'localhost');
define('DB_NAME', 'cboard');
define('DB_USER', 'root');
define('DB_PASS', 'your_password');
```

### 4. 创建数据库

```bash
# 登录 MySQL
mysql -u root -p

# 在 MySQL 中运行
CREATE DATABASE IF NOT EXISTS cboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

### 5. 运行数据库迁移

```bash
# 运行主架构
mysql -u root -p cboard < backend/database/schema-v2.sql

# 运行数据保留策略迁移
mysql -u root -p cboard < backend/database/migrations/add-data-retention-policy.sql
```

---

## 🚀 运行项目

### 1. 启动后端服务器

在 WSL2 终端中：

```bash
cd backend
php -S localhost:8000 -t . router.php
```

后端将在 `http://localhost:8000` 运行。

### 2. 启动前端服务器

在新的 WSL2 终端中：

```bash
# 在项目根目录
npm start
```

前端将在 `http://localhost:3000` 运行。

### 3. 从 Windows 访问

由于 WSL2 使用虚拟网络，您需要：

1. **获取 WSL2 IP 地址**:
   ```bash
   ip addr show eth0 | grep "inet\b" | awk '{print $2}' | cut -d/ -f1
   ```

2. **在 Windows 浏览器中访问**:
   - 前端: `http://<WSL2_IP>:3000`
   - 后端 API: `http://<WSL2_IP>:8000/api`

3. **或者使用端口转发** (推荐):
   ```powershell
   # 在 Windows PowerShell (管理员) 中运行
   netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=<WSL2_IP>
   netsh interface portproxy add v4tov4 listenport=8000 listenaddress=0.0.0.0 connectport=8000 connectaddress=<WSL2_IP>
   ```
   
   然后可以在 Windows 中访问:
   - 前端: `http://localhost:3000`
   - 后端: `http://localhost:8000`

---

## 🧪 运行测试

### 1. 给测试脚本添加执行权限

```bash
chmod +x tests/run-tests.sh
```

### 2. 运行测试套件

```bash
./tests/run-tests.sh
```

### 3. 运行特定测试

```bash
# 单元测试
npm test

# 带覆盖率
npm test -- --coverage

# 监视模式
npm test -- --watch
```

---

## 🔍 故障排除

### 问题 1: 端口已被占用

```bash
# 检查端口占用
sudo netstat -tulpn | grep :8000
sudo netstat -tulpn | grep :3000

# 杀死占用进程
sudo kill -9 <PID>
```

### 问题 2: MySQL 连接失败

```bash
# 检查 MySQL 服务状态
sudo service mysql status

# 启动 MySQL 服务
sudo service mysql start

# 检查 MySQL 用户权限
mysql -u root -p
SELECT user, host FROM mysql.user;
```

### 问题 3: 权限问题

```bash
# 修复文件权限
sudo chown -R $USER:$USER .
chmod +x tests/run-tests.sh
```

### 问题 4: Node 模块问题

```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
```

### 问题 5: PHP 扩展缺失

```bash
# 安装常用扩展
sudo apt install php-mysql php-json php-mbstring php-xml php-curl php-zip -y

# 重启 PHP (如果使用 PHP-FPM)
sudo service php-fpm restart
```

---

## 📝 常用命令

### 开发命令

```bash
# 启动后端 (后台运行)
cd backend && nohup php -S localhost:8000 -t . router.php > ../backend.log 2>&1 &

# 启动前端
npm start

# 查看后端日志
tail -f backend.log
```

### 数据库命令

```bash
# 备份数据库
mysqldump -u root -p cboard > backup.sql

# 恢复数据库
mysql -u root -p cboard < backup.sql

# 查看数据库
mysql -u root -p cboard -e "SHOW TABLES;"
```

### 测试命令

```bash
# 运行所有测试
./tests/run-tests.sh

# 运行单元测试
npm test

# 检查代码风格
npm run lint
```

---

## 🔗 有用的链接

- [WSL2 官方文档](https://docs.microsoft.com/en-us/windows/wsl/)
- [Node.js 文档](https://nodejs.org/docs/)
- [PHP 文档](https://www.php.net/docs.php)
- [MySQL 文档](https://dev.mysql.com/doc/)

---

## 💡 提示

1. **性能优化**: 将项目放在 WSL2 文件系统中 (`~/cboard`) 而不是 Windows 文件系统 (`/mnt/c/...`) 以获得更好的性能。

2. **端口转发**: 使用 Windows 端口转发可以更方便地从 Windows 浏览器访问 WSL2 中的服务。

3. **自动启动**: 可以创建 systemd 服务或使用 `crontab` 自动启动后端服务器。

4. **日志管理**: 使用 `nohup` 或 `screen`/`tmux` 来管理长时间运行的进程。

---

**最后更新**: 2025-01-20  
**维护者**: 开发团队

