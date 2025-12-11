# 紧急清理指南

## 情况说明

当前部署正在上传大量不必要的 Visual Studio 调试文件（.dll, .exe 等），这些文件：

- 占用大量空间（可能几百 MB）
- 对服务器运行没有用处
- 不应该被部署

## 立即操作步骤

### 1. 终止当前上传

**在 PowerShell 窗口中按 `Ctrl+C`** 或直接关闭窗口

### 2. 清理服务器上的文件

运行清理脚本：

```powershell
.\cleanup-server-files.ps1
```

这会删除：

- Visual Studio 调试文件（.dll, .exe, .pdb 等）
- IDE 文件（.vscode, .idea, .vs）
- 开发脚本
- 测试文件
- 临时文件

### 3. 重新部署（使用更新后的脚本）

```powershell
.\deploy-to-server.ps1
```

新的脚本已经更新，会自动排除：

- `.vs/` 目录
- 所有 `.dll`, `.exe` 文件
- Visual Studio 项目文件（.vcxproj, .sln 等）
- 调试器文件

## 手动清理（如果脚本无法运行）

SSH 到服务器并手动删除：

```bash
ssh root@r77.igt.com.hk
cd /var/www/aac.uplifor.org

# 删除 Visual Studio 目录
find . -type d -name ".vs" -exec rm -rf {} + 2>/dev/null

# 删除所有 .dll 文件
find . -name "*.dll" -type f -delete 2>/dev/null

# 删除所有 .exe 文件
find . -name "*.exe" -type f -delete 2>/dev/null

# 删除 Visual Studio 项目文件
find . -name "*.vcxproj" -type f -delete 2>/dev/null
find . -name "*.sln" -type f -delete 2>/dev/null
find . -name "*.vstemplate" -type f -delete 2>/dev/null

# 检查剩余文件大小
du -sh .
```

## 验证清理

```bash
# 检查文件数量
find . -type f | wc -l

# 检查磁盘使用
df -h /var/www/aac.uplifor.org
```

## 预防措施

已更新的文件：

- ✅ `.deployignore` - 添加了 Visual Studio 文件排除规则
- ✅ `deploy-to-server.ps1` - 更新了排除列表
- ✅ `cleanup-server-files.ps1` - 添加了清理规则

下次部署会自动排除这些文件。
