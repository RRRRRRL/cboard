# 环境变量配置指南

## 问题诊断

如果服务器仍然使用本地端点，请检查以下配置：

## 1. 前端环境变量 (.env)

**位置**: 项目根目录 `.env` 文件

**检查项**:
- ❌ **不要设置** `REACT_APP_DEV_API_URL` 为本地 IP（如 `http://192.168.62.41/api`）
- ✅ **生产环境**: 完全删除 `REACT_APP_DEV_API_URL` 行，或设置为空
- ✅ **开发环境**: 可以设置为 `http://localhost:3000/api` 或本地 IP

**正确的 .env 配置（生产构建）**:
```env
# 生产构建时，不要设置 REACT_APP_DEV_API_URL
# 或者设置为空：
# REACT_APP_DEV_API_URL=
```

## 2. 后端环境变量 (backend/.env)

**位置**: `backend/.env` 文件（服务器上）

**检查项**:
- `API_BASE_URL` 应该设置为生产 URL 或留空（使用相对路径）
- `APP_ENV` 应该设置为 `production`

**正确的 backend/.env 配置（服务器）**:
```env
APP_ENV=production
APP_DEBUG=false
API_BASE_URL=https://aac.uplifor.org/api
# 或者留空，使用相对路径
# API_BASE_URL=
```

## 3. 部署脚本检查

**deploy-wsl.sh** 已经包含以下保护措施：
- ✅ 自动检测并临时移除 `.env` 中的 `REACT_APP_DEV_API_URL`（如果包含本地 IP）
- ✅ 构建时设置 `NODE_ENV=production`
- ✅ 构建时清除 `REACT_APP_DEV_API_URL` 环境变量
- ✅ 验证构建输出中不包含硬编码 IP

## 4. 服务器后端配置检查

**SSH 到服务器检查**:
```bash
ssh root@r77.igt.com.hk
cd /var/www/aac.uplifor.org/backend
cat .env | grep -E "API|APP_ENV"
```

**应该看到**:
```env
APP_ENV=production
API_BASE_URL=https://aac.uplifor.org/api
# 或者
# API_BASE_URL=  (留空)
```

## 5. 前端代码逻辑

**src/constants.js** 的逻辑：
- 如果 `NODE_ENV === 'production'` → 使用相对路径 `/api`
- 如果 `REACT_APP_DEV_API_URL` 未设置 → 使用相对路径 `/api`（生产环境）或当前主机（开发环境）
- 如果运行在 `aac.uplifor.org` → 使用相对路径 `/api`

## 6. 验证步骤

### 步骤 1: 检查本地 .env 文件
```bash
# Windows PowerShell
Get-Content .env | Select-String "REACT_APP_DEV_API_URL|192\.168"
```

### 步骤 2: 检查构建输出
```bash
# 在 WSL 中
cd /mnt/c/Users/wongchaksan/Desktop/cboard
grep -r "192.168.62.41" build/static/js/*.js 2>/dev/null
```

### 步骤 3: 检查服务器上的 .env
```bash
ssh root@r77.igt.com.hk
cat /var/www/aac.uplifor.org/backend/.env
```

### 步骤 4: 检查浏览器控制台
打开 `https://aac.uplifor.org`，查看控制台：
- 应该看到 `API URL constructed: /api/`（相对路径）
- 不应该看到 `http://192.168.62.41/api`

## 7. 修复步骤

如果发现问题：

1. **清理本地 .env**:
   ```bash
   # 删除或注释掉 REACT_APP_DEV_API_URL
   ```

2. **重新构建**:
   ```bash
   # 确保 NODE_ENV=production
   NODE_ENV=production npm run build
   ```

3. **重新部署**:
   ```bash
   bash deploy-wsl.sh
   ```

4. **检查服务器 .env**:
   ```bash
   ssh root@r77.igt.com.hk
   # 编辑 /var/www/aac.uplifor.org/backend/.env
   # 确保 APP_ENV=production
   ```

5. **清除浏览器缓存**:
   - 硬刷新: Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac)
   - 或清除浏览器缓存

## 8. 常见问题

### Q: 为什么部署后仍然使用本地 IP？
A: 可能原因：
1. 构建时 `REACT_APP_DEV_API_URL` 仍然在环境变量中
2. 使用了旧的构建文件
3. 浏览器缓存了旧的 JavaScript 文件

### Q: 如何确保使用相对路径？
A: 
1. 删除 `.env` 中的 `REACT_APP_DEV_API_URL`
2. 确保 `NODE_ENV=production` 构建
3. 验证 `src/constants.js` 中的 `isProduction` 逻辑

### Q: 服务器上的 .env 需要设置什么？
A: 后端 `.env` 主要用于数据库配置和 JWT 密钥，API URL 由前端决定（使用相对路径）。

