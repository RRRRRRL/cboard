# 部署检查清单

## 部署前检查

### 1. 代码完整性检查 ✅

#### API 路由检查
- [x] `backend/api/routes/user.php` - 用户管理
- [x] `backend/api/routes/board.php` - 看板管理
- [x] `backend/api/routes/communicator.php` - 沟通者管理
- [x] `backend/api/routes/settings.php` - 设置管理
- [x] `backend/api/routes/media.php` - 媒体文件
- [x] `backend/api/routes/profile.php` - 个人资料
- [x] `backend/api/routes/card.php` - 卡片管理
- [x] `backend/api/routes/profile-card.php` - 个人资料卡片
- [x] `backend/api/routes/action-log.php` - 操作日志
- [x] `backend/api/routes/tts.php` - 文本转语音
- [x] `backend/api/routes/scanning.php` - 扫描功能
- [x] `backend/api/routes/devices.php` - 设备管理
- [x] `backend/api/routes/jyutping.php` - 粤拼功能
- [x] `backend/api/routes/transfer.php` - 个人资料转移
- [x] `backend/api/routes/ai.php` - AI 功能
- [x] `backend/api/routes/games.php` - 学习游戏
- [x] `backend/api/routes/ocr.php` - OCR 翻译
- [x] `backend/api/routes/admin.php` - 管理员面板

#### 路由注册检查
所有路由已在 `backend/api/index.php` 中正确注册：
- [x] `handleUserRoutes`
- [x] `handleBoardRoutes`
- [x] `handleCommunicatorRoutes`
- [x] `handleSettingsRoutes`
- [x] `handleMediaRoutes`
- [x] `handleProfileRoutes`
- [x] `handleCardRoutes`
- [x] `handleProfileCardRoutes`
- [x] `handleActionLogRoutes`
- [x] `handleTTSRoutes`
- [x] `handleScanningRoutes`
- [x] `handleDevicesRoutes`
- [x] `handleJyutpingRoutes`
- [x] `handleTransferRoutes`
- [x] `handleAIRoutes`
- [x] `handleGamesRoutes`
- [x] `handleOCRRoutes`
- [x] `handleAdminRoutes`

### 2. 数据库 Schema 检查

#### 必需的表
- [x] `users` - 用户表（包含 role 字段）
- [x] `profiles` - 个人资料表
- [x] `cards` - 卡片表
- [x] `profile_cards` - 个人资料卡片关联表
- [x] `boards` - 看板表
- [x] `jyutping_dictionary` - 粤拼字典表
- [x] `jyutping_learning_log` - 粤拼学习日志表
- [x] `action_logs` - 操作日志表
- [x] `profile_transfer_tokens` - 个人资料转移令牌表
- [x] `ocr_history` - OCR 历史表
- [x] `games_results` - 游戏结果表
- [x] `ai_cache` - AI 缓存表
- [x] `settings` - 设置表
- [x] `media` - 媒体文件表
- [ ] `rate_limit_logs` - **需要添加**（速率限制日志表）

### 3. 前端构建检查

- [ ] 运行 `npm run build` 或 `yarn build`
- [ ] 检查 `build/` 目录是否生成
- [ ] 检查所有静态资源是否正确构建

### 4. 环境变量检查

确保 `.env` 文件包含：
- [ ] `DB_HOST` - 数据库主机
- [ ] `DB_NAME` - 数据库名称（cboard）
- [ ] `DB_USER` - 数据库用户
- [ ] `DB_PASS` - 数据库密码
- [ ] `JWT_SECRET` - JWT 密钥
- [ ] `REACT_APP_API_URL` - API URL（https://aac.uplifor.org/api）
- [ ] `APP_ENV` - 环境（production/development）

## 部署步骤

### 步骤 1: 运行部署脚本

```powershell
.\deploy-to-server.ps1
```

### 步骤 2: 更新数据库

在服务器上运行数据库更新脚本：

```bash
ssh root@r77.igt.com.hk
cd /var/www/aac.uplifor.org
mysql -h r77.igt.com.hk -u root -pyyTTr437 cboard < backend/database/update_schema.sql
```

或通过 phpMyAdmin：
1. 访问 https://r77.igt.com.hk/phpmyadmin/
2. 选择 `cboard` 数据库
3. 导入 `backend/database/update_schema.sql`

### 步骤 3: 验证部署

#### API 端点测试

```bash
# 健康检查
curl https://aac.uplifor.org/api

# 测试登录
curl -X POST https://aac.uplifor.org/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# 测试新功能端点
curl https://aac.uplifor.org/api/games/spelling?difficulty=medium&limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN"

curl https://aac.uplifor.org/api/ai/suggestions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"context":"hello","profile_id":1}'
```

#### 前端验证

1. 访问 https://aac.uplifor.org/
2. 测试登录功能
3. 测试新功能：
   - [ ] 眼球追踪（摄像头）
   - [ ] 学习游戏
   - [ ] OCR 翻译
   - [ ] AI 功能
   - [ ] 个人资料转移
   - [ ] 操作日志查看器
   - [ ] 管理员面板

### 步骤 4: 检查日志

```bash
# PHP-FPM 错误日志
tail -f /var/log/php-fpm/error.log
# 或
tail -f /var/log/php8.1-fpm/error.log

# Nginx 错误日志
tail -f /var/log/nginx/error.log

# Nginx 访问日志
tail -f /var/log/nginx/access.log
```

## 已知问题和解决方案

### 问题 1: CORS 错误
**解决方案**: 已在 `backend/api/index.php` 和 `backend/router.php` 中配置 CORS

### 问题 2: 速率限制错误
**解决方案**: 确保 `rate_limit_logs` 表已创建

### 问题 3: 摄像头眼球追踪不工作
**解决方案**: 确保 WebGazer.js 已加载（在 `public/index.html` 中）

### 问题 4: 数据库连接失败
**解决方案**: 检查 `.env` 文件中的数据库凭据

## 回滚计划

如果部署出现问题：

1. **恢复文件**:
   ```bash
   cd /var/www/aac.uplifor.org
   git checkout HEAD -- .
   ```

2. **恢复数据库**:
   ```bash
   mysql -h r77.igt.com.hk -u root -pyyTTr437 cboard < backend/database/backup-schema.sql
   ```

3. **重启服务**:
   ```bash
   systemctl restart php-fpm
   systemctl restart nginx
   ```

## 部署后验证清单

- [ ] 前端可以正常访问
- [ ] 用户可以登录
- [ ] 所有 API 端点响应正常
- [ ] 数据库查询正常
- [ ] 文件上传功能正常
- [ ] 眼球追踪功能正常（摄像头）
- [ ] 学习游戏功能正常
- [ ] OCR 翻译功能正常
- [ ] AI 功能正常
- [ ] 个人资料转移功能正常
- [ ] 操作日志查看器正常
- [ ] 管理员面板正常（仅管理员可见）
- [ ] 速率限制正常工作
- [ ] CORS 配置正确

## 联系信息

如有问题，请检查：
- 服务器日志：`/var/log/nginx/error.log`
- PHP 日志：`/var/log/php-fpm/error.log`
- 数据库连接：检查 `.env` 文件

