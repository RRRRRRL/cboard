# 部署修复指南

## 当前问题

1. **Mixed Content 错误**: 前端仍然请求 `http://192.168.62.41/api`
2. **WebGazer 模型 CORS 错误**: 模型仍然从 `storage.googleapis.com` 加载

## 解决方案

### 1. 修复硬编码 IP 问题

**原因**: 构建文件中仍然包含硬编码的本地 IP

**解决步骤**:

1. **清理本地环境**:
   ```bash
   # 删除或注释 .env 中的 REACT_APP_DEV_API_URL
   # 确保没有设置本地 IP
   ```

2. **重新构建**:
   ```bash
   # 确保 NODE_ENV=production
   NODE_ENV=production npm run build
   ```

3. **验证构建**:
   ```bash
   # 检查构建文件中是否还有硬编码 IP
   grep -r "192.168.62.41" build/static/js/*.js
   # 应该没有输出
   ```

4. **重新部署**:
   ```bash
   bash deploy-wsl.sh
   ```

5. **清除浏览器缓存**:
   - 硬刷新: Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac)
   - 或清除浏览器缓存

### 2. 修复 WebGazer 模型 CORS 问题

**原因**: 模型文件没有部署到服务器，或拦截逻辑没有生效

**解决步骤**:

1. **确认模型文件存在**:
   ```bash
   # 检查本地模型文件
   ls -la public/models/facemesh/
   ls -la public/models/iris/
   ls -la public/models/blazeface/
   ```

2. **部署模型文件**:
   ```bash
   # deploy-wsl.sh 已更新，会自动上传 public/models/
   bash deploy-wsl.sh
   ```

3. **验证服务器上的模型文件**:
   ```bash
   ssh root@r77.igt.com.hk
   ls -la /var/www/aac.uplifor.org/build/models/
   # 应该看到 facemesh/, iris/, blazeface/ 目录
   ```

4. **检查 Nginx 配置**:
   确保 Nginx 可以访问 `/models/` 路径：
   ```nginx
   location /models {
       alias /var/www/aac.uplifor.org/build/models;
       add_header Access-Control-Allow-Origin *;
   }
   ```

### 3. 验证修复

**检查 API URL**:
1. 访问 `https://aac.uplifor.org`
2. 打开浏览器控制台
3. 查看 `[API Config]` 日志，应该显示: `API URL constructed: /api/`
4. 检查网络请求，应该指向: `https://aac.uplifor.org/api/`

**检查模型加载**:
1. 打开浏览器控制台
2. 查看 `[ModelInterceptor]` 日志
3. 应该看到模型重定向到本地路径: `/models/facemesh/model.json`
4. 不应该看到 CORS 错误

## 常见问题

### Q: 为什么仍然看到硬编码 IP？

A: 可能原因：
1. 使用了旧的构建文件
2. 浏览器缓存了旧的 JavaScript
3. 构建时 `REACT_APP_DEV_API_URL` 仍然在环境变量中

**解决**: 清除浏览器缓存，重新构建并部署

### Q: 为什么模型仍然从外部 CDN 加载？

A: 可能原因：
1. 模型文件没有部署到服务器
2. 拦截逻辑没有在 WebGazer 加载之前执行
3. Nginx 没有正确配置 `/models/` 路径

**解决**: 
1. 确认模型文件已部署
2. 检查 `src/index.js` 中的拦截逻辑
3. 检查 Nginx 配置

### Q: 如何确认修复成功？

A: 
1. 检查浏览器控制台，不应该有 Mixed Content 错误
2. 检查网络请求，API 应该使用相对路径 `/api/`
3. 检查模型加载，应该从 `/models/` 加载，而不是外部 CDN
4. 不应该有 CORS 错误

## 部署检查清单

- [ ] 删除 `.env` 中的 `REACT_APP_DEV_API_URL`（或设置为空）
- [ ] 使用 `NODE_ENV=production` 构建
- [ ] 验证构建文件中没有硬编码 IP
- [ ] 确认 `public/models/` 目录存在
- [ ] 部署所有文件（包括模型文件）
- [ ] 验证服务器上的模型文件
- [ ] 清除浏览器缓存
- [ ] 测试 API 请求（应该使用相对路径）
- [ ] 测试模型加载（应该从本地加载）

