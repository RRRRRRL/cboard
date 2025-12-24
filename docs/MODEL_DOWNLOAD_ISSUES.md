# WebGazer 模型下载问题解决指南

## 问题

如果模型文件下载后大小异常（只有几 KB 而不是几 MB），可能是下载了错误页面而不是实际的模型文件。

## 解决方案

### 方法 1: 使用浏览器手动下载

由于 TensorFlow Hub 可能有访问限制或重定向问题，可以手动下载：

1. **Facemesh 模型**:

   - 打开: `https://tfhub.dev/mediapipe/tfjs-model/facemesh/1/default/1/model.json`
   - 保存为: `public/models/facemesh/model.json`
   - 打开: `https://tfhub.dev/mediapipe/tfjs-model/facemesh/1/default/1/group1-shard1of1.bin`
   - 保存为: `public/models/facemesh/group1-shard1of1.bin`

2. **Iris 模型**:

   - 打开: `https://tfhub.dev/mediapipe/tfjs-model/iris/1/default/2/model.json`
   - 保存为: `public/models/iris/model.json`
   - 打开: `https://tfhub.dev/mediapipe/tfjs-model/iris/1/default/2/group1-shard1of1.bin`
   - 保存为: `public/models/iris/group1-shard1of1.bin`

3. **Blazeface 模型**:
   - 打开: `https://tfhub.dev/tensorflow/tfjs-model/blazeface/1/default/1/model.json`
   - 保存为: `public/models/blazeface/model.json`
   - 打开: `https://tfhub.dev/tensorflow/tfjs-model/blazeface/1/default/1/group1-shard1of1.bin`
   - 保存为: `public/models/blazeface/group1-shard1of1.bin`

### 方法 2: 使用 curl 或 wget

如果浏览器下载有问题，可以使用命令行工具：

**PowerShell (使用 curl):**

```powershell
# Facemesh
curl -L "https://tfhub.dev/mediapipe/tfjs-model/facemesh/1/default/1/model.json" -o "public/models/facemesh/model.json"
curl -L "https://tfhub.dev/mediapipe/tfjs-model/facemesh/1/default/1/group1-shard1of1.bin" -o "public/models/facemesh/group1-shard1of1.bin"

# Iris
curl -L "https://tfhub.dev/mediapipe/tfjs-model/iris/1/default/2/model.json" -o "public/models/iris/model.json"
curl -L "https://tfhub.dev/mediapipe/tfjs-model/iris/1/default/2/group1-shard1of1.bin" -o "public/models/iris/group1-shard1of1.bin"

# Blazeface
curl -L "https://tfhub.dev/tensorflow/tfjs-model/blazeface/1/default/1/model.json" -o "public/models/blazeface/model.json"
curl -L "https://tfhub.dev/tensorflow/tfjs-model/blazeface/1/default/1/group1-shard1of1.bin" -o "public/models/blazeface/group1-shard1of1.bin"
```

### 方法 3: 验证文件

下载后，验证文件大小：

- `model.json` 文件应该至少有 1-2 KB（JSON 文本）
- `group1-shard1of1.bin` 文件应该至少有 1-3 MB（二进制权重文件）

如果文件太小（< 10 KB），可能是错误页面，需要重新下载。

## 验证

运行验证脚本：

```powershell
.\scripts\verify-models.ps1
```

或者手动检查：

```powershell
Get-ChildItem public\models -Recurse -File | Select-Object FullName, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB,2)}}
```

## 注意事项

- 某些地区可能无法直接访问 `tfhub.dev`，需要使用 VPN 或代理
- 如果下载的是 HTML 错误页面，检查网络连接和防火墙设置
- 确保有足够的磁盘空间（至少 10 MB）
