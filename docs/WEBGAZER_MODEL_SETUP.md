# WebGazer 模型自托管设置指南

## 问题说明

WebGazer 依赖 TensorFlow.js 模型（facemesh、iris、blazeface）来检测面部和眼球位置。默认情况下，这些模型从 `tfhub.dev` 和 `storage.googleapis.com` 加载，但由于 CORS 策略限制，浏览器会阻止这些请求，导致 "Failed to fetch" 和 CORS 错误。

## 解决方案

通过自托管这些模型文件，可以完全避免 CORS 问题，因为模型将从同一源（`http://localhost:3000/models/...`）加载。

## 步骤 1: 下载模型文件

### 方法 1: 使用 PowerShell 脚本（Windows）

```powershell
.\scripts\download-webgazer-models.ps1
```

### 方法 2: 使用 Bash 脚本（Linux/WSL/Mac）

```bash
chmod +x scripts/download-webgazer-models.sh
bash scripts/download-webgazer-models.sh
```

### 方法 3: 手动下载

如果脚本无法运行，可以手动下载以下文件：

#### Facemesh 模型
- URL: `https://tfhub.dev/mediapipe/tfjs-model/facemesh/1/default/1/model.json`
- 保存到: `public/models/facemesh/model.json`
- URL: `https://tfhub.dev/mediapipe/tfjs-model/facemesh/1/default/1/group1-shard1of1.bin`
- 保存到: `public/models/facemesh/group1-shard1of1.bin`

#### Iris 模型
- URL: `https://tfhub.dev/mediapipe/tfjs-model/iris/1/default/2/model.json`
- 保存到: `public/models/iris/model.json`
- URL: `https://tfhub.dev/mediapipe/tfjs-model/iris/1/default/2/group1-shard1of1.bin`
- 保存到: `public/models/iris/group1-shard1of1.bin`

#### Blazeface 模型
- URL: `https://tfhub.dev/tensorflow/tfjs-model/blazeface/1/default/1/model.json`
- 保存到: `public/models/blazeface/model.json`
- URL: `https://tfhub.dev/tensorflow/tfjs-model/blazeface/1/default/1/group1-shard1of1.bin`
- 保存到: `public/models/blazeface/group1-shard1of1.bin`

## 步骤 2: 验证文件结构

下载完成后，确保文件结构如下：

```
public/
  models/
    facemesh/
      model.json
      group1-shard1of1.bin
    iris/
      model.json
      group1-shard1of1.bin
    blazeface/
      model.json
      group1-shard1of1.bin
```

## 步骤 3: 代码已自动配置

代码已经更新为自动使用本地模型。`src/utils/webgazerModelConfig.js` 会在 WebGazer 初始化前配置 TensorFlow.js 使用本地模型 URL。

## 步骤 4: 重启开发服务器

下载模型后，重启开发服务器：

```bash
npm start
```

## 验证

1. 打开浏览器开发者工具（F12）
2. 导航到 Network 标签
3. 启用眼动追踪功能
4. 检查是否有对 `/models/facemesh/model.json`、`/models/iris/model.json` 等的请求
5. 确认没有 CORS 错误

## 故障排除

### 问题: 模型文件下载失败

**解决方案:**
- 检查网络连接
- 尝试使用 VPN 或代理（某些地区可能无法访问 tfhub.dev）
- 手动下载文件（见方法 3）

### 问题: 模型仍然从 tfhub.dev 加载

**解决方案:**
1. 确认模型文件已正确下载到 `public/models/` 目录
2. 清除浏览器缓存
3. 重启开发服务器
4. 检查浏览器控制台是否有错误

### 问题: 404 错误（模型文件未找到）

**解决方案:**
1. 确认文件路径正确：`public/models/[model-name]/model.json`
2. 确认文件名正确（区分大小写）
3. 确认开发服务器已重启
4. 检查 `public` 文件夹是否在项目根目录

## 生产环境部署

在生产环境中，确保：

1. 模型文件已包含在构建输出中（`build/models/`）
2. Web 服务器配置正确，可以提供这些文件
3. 如果使用 CDN，确保 CDN 也包含这些文件

## 文件大小

- Facemesh: ~2-3 MB
- Iris: ~1-2 MB
- Blazeface: ~1-2 MB

总计约 4-7 MB，这些文件会被浏览器缓存，不会影响后续加载速度。

## 注意事项

- 模型文件较大，首次下载可能需要一些时间
- 确保有足够的磁盘空间（至少 10 MB）
- 这些模型文件是公开的，可以安全地包含在项目中

