# Jyut Dictionary 数据提取指南

本指南帮助您从 Jyut Dictionary 应用程序中提取粤拼数据。

## 方法 1: 从应用程序提取 dict.db（推荐）

### 步骤 1: 下载并安装 Jyut Dictionary

1. 访问: https://jyutdictionary.com
2. 下载适合您操作系统的版本（Windows/Mac/Linux）
3. 安装应用程序

### 步骤 2: 找到 dict.db 文件

**Windows:**
```
%APPDATA%\jyut-dict\dict.db
或
C:\Users\<用户名>\AppData\Roaming\jyut-dict\dict.db
```

**Mac:**
```
/Applications/jyut-dict.app/Contents/Resources/dict.db
或
~/Library/Application Support/jyut-dict/dict.db
```

**Linux:**
```
~/.local/share/jyut-dict/dict.db
或
/usr/share/jyut-dict/dict.db
```

### 步骤 3: 提取数据

使用项目提供的脚本：

```bash
php backend/scripts/extract-jyut-dict-from-sqlite.php "路径\到\dict.db"
```

示例：
```bash
# Windows
php backend/scripts/extract-jyut-dict-from-sqlite.php "C:\Users\用户名\AppData\Roaming\jyut-dict\dict.db"

# Mac/Linux
php backend/scripts/extract-jyut-dict-from-sqlite.php ~/.local/share/jyut-dict/dict.db
```

### 步骤 4: 导入到 Cboard 数据库

```bash
php backend/scripts/seed-jyutping-from-csv.php
```

## 方法 2: 从 GitHub 仓库构建

### 步骤 1: 克隆仓库

```bash
git clone https://github.com/aaronhktan/jyut-dict.git
cd jyut-dict
```

### 步骤 2: 下载数据源

根据仓库说明，需要下载以下数据源：

1. **CC-CEDICT**: https://cc-cedict.org/wiki/
2. **CC-CANTO**: https://www.cantonese.org/download.html
3. **words.hk 粵典**: https://words.hk/static/download/

### 步骤 3: 运行构建脚本

查看 `src/dictionaries/` 目录中的 Python 脚本，运行相应的脚本来生成 `dict.db`。

### 步骤 4: 提取数据

使用步骤 3 中生成的 `dict.db` 文件，按照方法 1 的步骤 3 提取数据。

## 方法 3: 使用 SQLite 工具直接导出

如果您有 SQLite 工具（如 DB Browser for SQLite），可以：

1. 打开 `dict.db` 文件
2. 查看表结构
3. 导出为 CSV 格式
4. 使用 `convert-jyut-dict-to-csv.php` 转换格式

## 常见问题

### Q: 找不到 dict.db 文件？
A: 
- 确保已安装并运行过 Jyut Dictionary 应用程序
- 检查应用程序的安装目录
- 在 Windows 上，检查 `%APPDATA%` 文件夹

### Q: SQLite 扩展未加载？
A: 
- Windows: 编辑 `php.ini`，取消注释 `extension=pdo_sqlite`
- Linux: 安装 `php-sqlite3` 或 `php-pdo-sqlite`
- Mac: 通常已包含，如未包含则安装 `php-sqlite3`

### Q: 表结构不匹配？
A: 
- 查看 `extract-jyut-dict-from-sqlite.php` 脚本
- 根据实际的表结构修改脚本中的列映射
- 或使用 SQLite 工具手动导出

## 验证数据

导入后，运行验证脚本：

```bash
php backend/scripts/check-jyutping-data.php
```

## 下一步

数据导入后，您的粤拼键盘将拥有完整的词汇数据库，支持：
- 精确匹配搜索
- 常用词优先显示
- 关联词建议
- 完整的学习功能

