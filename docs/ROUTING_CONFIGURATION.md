# 路由和 API 配置指南

## 环境配置

### 本地开发环境

**前端**:
- 启动: `yarn start` 或 `npm start`
- URL: `http://localhost:3000`
- 开发服务器: React Dev Server (port 3000)

**后端**:
- 启动: `php -S localhost:8000 router.php` (在 `backend/` 目录)
- URL: `http://localhost:8000/api`
- 服务器: PHP Built-in Server (port 8000)

**配置**:
- 在项目根目录创建 `.env` 文件（可选）:
  ```env
  REACT_APP_DEV_API_URL=http://localhost:8000/api
  ```
- 如果不设置 `REACT_APP_DEV_API_URL`，前端会自动使用 `http://localhost:8000/api`

### 服务器生产环境

**前端**:
- URL: `https://aac.uplifor.org/`
- 服务器: Nginx 提供静态文件服务

**后端**:
- URL: `https://aac.uplifor.org/api`
- 服务器: Nginx 代理到 PHP-FPM

**配置**:
- **不要**在 `.env` 中设置 `REACT_APP_DEV_API_URL`（或设置为空）
- 前端会自动使用相对路径 `/api`
- 这确保 API 请求始终指向当前域名

## API URL 构建逻辑

### `src/constants.js` 的逻辑

```javascript
// 生产环境检测
const isProduction = isProductionBuild || isProductionHost;

// API URL 构建
const RAW_API_URL = isCordova()
  ? 'https://api.app.cboard.io/'  // Cordova 应用
  : (isProduction
      ? '/api'  // 生产环境：相对路径
      : (DEV_API_URL || 'http://localhost:8000/api'));  // 开发环境：使用 DEV_API_URL 或默认 localhost:8000
```

### 环境判断

**生产环境** (`isProduction = true`):
- `NODE_ENV === 'production'` (构建时)
- 或 `hostname === 'aac.uplifor.org'` (运行时)
- 或 `hostname === 'www.aac.uplifor.org'` (运行时)
- 或 HTTPS 协议且不是 localhost/127.0.0.1/192.168.x.x

**开发环境** (`isProduction = false`):
- `NODE_ENV !== 'production'` 且不在生产域名上

## 后端路由配置

### `backend/router.php`

用于 PHP Built-in Server (`php -S localhost:8000 router.php`):

1. **处理上传文件**: `/uploads/` 或 `/api/uploads/`
2. **路由 API 请求**: `/api/*` → `backend/api/index.php`
3. **CORS 配置**: 允许来自 `localhost:3000` 和 `aac.uplifor.org` 的请求

### `backend/api/index.php`

主 API 入口点:

1. **CORS 处理**: 设置允许的源和凭证
2. **路由分发**: 根据路径分发到不同的路由处理器
3. **认证**: 处理 JWT 令牌验证
4. **限流**: 应用速率限制中间件

### API 路由结构

所有 API 路由都以 `/api` 开头:

- `/api` → 健康检查
- `/api/user` → 用户相关路由
- `/api/board` → 看板相关路由
- `/api/settings` → 设置相关路由
- `/api/ai` → AI 功能路由
- `/api/uploads/...` → 上传的文件

## Nginx 配置（服务器）

服务器上的 Nginx 配置应该类似：

```nginx
server {
    listen 443 ssl;
    server_name aac.uplifor.org;

    # 前端静态文件
    root /var/www/aac.uplifor.org/build;
    index index.html;

    # API 代理
    location /api {
        try_files $uri $uri/ @api;
    }

    location @api {
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /var/www/aac.uplifor.org/backend/api/index.php;
        fastcgi_param REQUEST_URI $request_uri;
    }

    # 前端路由（SPA）
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 故障排查

### 问题 1: 本地开发时 API 请求失败

**症状**: 前端运行在 `localhost:3000`，但 API 请求失败

**检查**:
1. 确认后端服务器正在运行: `php -S localhost:8000 router.php`
2. 检查 `.env` 文件中的 `REACT_APP_DEV_API_URL`
3. 检查浏览器控制台的 `[API Config]` 日志

**解决**:
```bash
# 在 backend/ 目录
php -S localhost:8000 router.php

# 在项目根目录
yarn start
```

### 问题 2: 服务器上 API 请求失败

**症状**: 生产环境 API 请求返回 404 或 CORS 错误

**检查**:
1. 确认 Nginx 配置正确
2. 确认 PHP-FPM 正在运行
3. 检查浏览器控制台的 `[API Config]` 日志，应该显示 `/api/`

**解决**:
```bash
# SSH 到服务器
ssh root@r77.igt.com.hk

# 检查 Nginx 配置
nginx -t

# 检查 PHP-FPM
systemctl status php8.3-fpm

# 重新加载服务
systemctl reload php8.3-fpm
systemctl reload nginx
```

### 问题 3: API URL 仍然使用本地 IP

**症状**: 生产环境仍然请求 `http://192.168.62.41/api`

**检查**:
1. 检查 `.env` 文件是否包含 `REACT_APP_DEV_API_URL`
2. 检查构建输出是否包含硬编码 IP
3. 清除浏览器缓存

**解决**:
```bash
# 删除 .env 中的 REACT_APP_DEV_API_URL
# 重新构建
NODE_ENV=production npm run build

# 重新部署
bash deploy-wsl.sh
```

## 验证步骤

### 本地开发验证

1. 启动后端:
   ```bash
   cd backend
   php -S localhost:8000 router.php
   ```

2. 启动前端:
   ```bash
   yarn start
   ```

3. 打开浏览器: `http://localhost:3000`
4. 打开控制台，查看 `[API Config]` 日志
5. 应该看到: `API URL constructed: http://localhost:8000/api/`

### 生产环境验证

1. 访问: `https://aac.uplifor.org`
2. 打开控制台，查看 `[API Config]` 日志
3. 应该看到: `API URL constructed: /api/`
4. 检查网络请求，应该指向 `https://aac.uplifor.org/api/`

## 总结

- **本地开发**: 使用 `http://localhost:8000/api`（可通过 `.env` 配置）
- **生产环境**: 使用相对路径 `/api`（自动适配当前域名）
- **不要**在生产构建时设置 `REACT_APP_DEV_API_URL`
- **确保**后端路由正确配置（`router.php` 用于本地，Nginx 用于生产）

