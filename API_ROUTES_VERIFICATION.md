# API 路由验证清单

## 所有已实现的 API 路由

### 用户管理 (`/api/user`)
- [x] `POST /api/user/register` - 用户注册
- [x] `POST /api/user/login` - 用户登录
- [x] `GET /api/user/{id}` - 获取用户信息
- [x] `PUT /api/user/{id}` - 更新用户信息
- [x] `POST /api/user/logout` - 用户登出

### 看板管理 (`/api/board`)
- [x] `GET /api/board/my` - 获取我的看板（基于 token）
- [x] `GET /api/board/byemail/{email}` - 获取用户看板（已弃用，保留向后兼容）
- [x] `GET /api/board/{id}` - 获取看板详情
- [x] `POST /api/board` - 创建看板
- [x] `PUT /api/board/{id}` - 更新看板
- [x] `DELETE /api/board/{id}` - 删除看板

### 沟通者管理 (`/api/communicator`)
- [x] `GET /api/communicator/my` - 获取我的沟通者（基于 token）
- [x] `GET /api/communicator/byemail/{email}` - 获取用户沟通者（已弃用）
- [x] `GET /api/communicator/{id}` - 获取沟通者详情
- [x] `POST /api/communicator` - 创建沟通者
- [x] `PUT /api/communicator/{id}` - 更新沟通者
- [x] `DELETE /api/communicator/{id}` - 删除沟通者

### 个人资料管理 (`/api/profile`)
- [x] `GET /api/profile` - 获取所有个人资料
- [x] `GET /api/profile/{id}` - 获取个人资料详情
- [x] `POST /api/profile` - 创建个人资料
- [x] `PUT /api/profile/{id}` - 更新个人资料
- [x] `DELETE /api/profile/{id}` - 删除个人资料

### 卡片管理 (`/api/card`)
- [x] `GET /api/card` - 获取所有卡片
- [x] `GET /api/card/{id}` - 获取卡片详情
- [x] `POST /api/card` - 创建卡片
- [x] `PUT /api/card/{id}` - 更新卡片
- [x] `DELETE /api/card/{id}` - 删除卡片

### 个人资料转移 (`/api/transfer`)
- [x] `POST /api/transfer/export` - 导出个人资料
- [x] `POST /api/transfer/import` - 导入个人资料
- [x] `POST /api/transfer/qr/generate` - 生成 QR 码令牌
- [x] `POST /api/transfer/cloud/generate` - 生成云代码
- [x] `POST /api/transfer/email/generate` - 生成电子邮件转移
- [x] `GET /api/transfer/validate/{token}` - 验证转移令牌
- [x] `POST /api/transfer/redeem` - 兑换转移令牌

### AI 功能 (`/api/ai`)
- [x] `POST /api/ai/suggestions` - 获取卡片建议
- [x] `POST /api/ai/typing-predictions` - 获取输入预测
- [x] `POST /api/ai/jyutping-predictions` - 获取粤拼预测
- [x] `POST /api/ai/adaptive-learning` - 更新自适应学习数据
- [x] `GET /api/ai/learning-stats` - 获取学习统计

### 学习游戏 (`/api/games`)
- [x] `GET /api/games/spelling` - 获取拼写游戏
- [x] `GET /api/games/matching` - 获取匹配游戏
- [x] `POST /api/games/submit` - 提交游戏结果
- [x] `GET /api/games/history` - 获取游戏历史

### OCR 翻译 (`/api/ocr`)
- [x] `POST /api/ocr/recognize` - 识别图像中的文本
- [x] `POST /api/ocr/convert-to-jyutping` - 转换为粤拼
- [x] `POST /api/ocr/annotate` - 图像标注
- [x] `GET /api/ocr/history` - 获取 OCR 历史
- [x] `DELETE /api/ocr/history/{id}` - 删除 OCR 历史记录

### 操作日志 (`/api/action-logs`)
- [x] `GET /api/action-logs` - 获取操作日志
- [x] `POST /api/action-logs` - 创建操作日志
- [x] `GET /api/action-logs/export` - 导出操作日志（CSV）

### 管理员面板 (`/api/admin`)
- [x] `GET /api/admin/users` - 获取所有用户（仅管理员）
- [x] `GET /api/admin/users/{id}` - 获取用户详情（仅管理员）
- [x] `PUT /api/admin/users/{id}` - 更新用户（仅管理员）
- [x] `DELETE /api/admin/users/{id}` - 删除用户（仅管理员）
- [x] `GET /api/admin/statistics` - 获取系统统计（仅管理员）

### 设备管理 (`/api/devices`)
- [x] `POST /api/devices/switch/register` - 注册开关设备
- [x] `POST /api/devices/switch/activate` - 激活开关设备
- [x] `POST /api/devices/switch/longpress` - 处理长按事件
- [x] `POST /api/devices/eyetracking/register` - 注册眼球追踪设备
- [x] `POST /api/devices/eyetracking/calibrate` - 校准眼球追踪设备
- [x] `POST /api/devices/eyetracking/select` - 眼球追踪选择卡片
- [x] `GET /api/devices/list` - 获取所有设备

### 粤拼功能 (`/api/jyutping`)
- [x] `GET /api/jyutping/dictionary` - 获取粤拼字典
- [x] `POST /api/jyutping/convert` - 转换中文到粤拼
- [x] `GET /api/jyutping/learning-log` - 获取学习日志

### 文本转语音 (`/api/tts`)
- [x] `POST /api/tts/speak` - 文本转语音

### 扫描功能 (`/api/scanning`)
- [x] `POST /api/scanning/start` - 开始扫描
- [x] `POST /api/scanning/stop` - 停止扫描
- [x] `POST /api/scanning/select` - 扫描选择

### 设置管理 (`/api/settings`)
- [x] `GET /api/settings` - 获取设置
- [x] `PUT /api/settings` - 更新设置

### 媒体管理 (`/api/media`)
- [x] `POST /api/media/upload` - 上传媒体文件
- [x] `GET /api/media/{id}` - 获取媒体文件

## 路由注册验证

所有路由处理函数已在 `backend/api/index.php` 中注册：

```php
// 第 98-116 行：加载路由文件
require_once __DIR__ . '/routes/user.php';
require_once __DIR__ . '/routes/board.php';
// ... 等等

// 第 232-358 行：路由处理
if ($route === 'user') {
    return handleUserRoutes($method, $pathParts, $data, $authToken);
}
// ... 等等
```

## 测试命令

### 健康检查
```bash
curl https://aac.uplifor.org/api
```

### 测试新功能端点
```bash
# 学习游戏
curl "https://aac.uplifor.org/api/games/spelling?difficulty=medium&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# AI 建议
curl -X POST "https://aac.uplifor.org/api/ai/suggestions" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"context":"hello","profile_id":1}'

# OCR 识别
curl -X POST "https://aac.uplifor.org/api/ocr/recognize" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@test.jpg"

# 操作日志
curl "https://aac.uplifor.org/api/action-logs" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 管理员用户列表
curl "https://aac.uplifor.org/api/admin/users" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 已知问题

### 1. 速率限制表缺失
**状态**: 已修复
**解决方案**: 运行 `backend/database/update_schema.sql` 创建 `rate_limit_logs` 表

### 2. CORS 配置
**状态**: 已配置
**位置**: `backend/api/index.php` 和 `backend/router.php`

### 3. 数据库列名不匹配
**状态**: 已修复
**说明**: 
- `jyutping_dictionary` 使用 `hanzi`, `jyutping_code`, `word`
- `ocr_history` 使用 `source_image_path`, `extracted_text`, `jyutping_result`

## 部署后验证

部署后，请验证以下端点：

1. **基础功能**:
   - [ ] `GET /api` - 健康检查
   - [ ] `POST /api/user/login` - 登录

2. **新功能**:
   - [ ] `GET /api/games/spelling` - 拼写游戏
   - [ ] `GET /api/games/matching` - 匹配游戏
   - [ ] `POST /api/ai/suggestions` - AI 建议
   - [ ] `POST /api/ocr/recognize` - OCR 识别
   - [ ] `GET /api/action-logs` - 操作日志
   - [ ] `GET /api/admin/users` - 管理员用户列表

3. **设备功能**:
   - [ ] `POST /api/devices/eyetracking/register` - 注册眼球追踪设备（包括摄像头）

