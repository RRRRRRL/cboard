# 安全的粤拼数据库选项

本文档列出所有**无版权问题**的粤拼数据库选项。

## ✅ 推荐选项（无版权问题）

### 1. CC-CANTO（最推荐）

- **许可证**: CC-BY-SA 4.0（可自由使用）
- **来源**: https://cantonese.org/download.html
- **特点**: 
  - 基于 CC-CEDICT，专门为粤语设计
  - 包含粤拼标注
  - 完全开源

**使用方法**:
```bash
# 1. 下载 CC-CANTO 文件
# 2. 转换为 CSV
php backend/scripts/convert-cc-canto-to-csv.php cc-canto.txt

# 3. 导入数据库
php backend/scripts/seed-jyutping-from-csv.php
```

### 2. pycantonese 库数据

- **许可证**: 开源（MIT 或类似）
- **GitHub**: https://github.com/jacksonllee/pycantonese
- **特点**: Python 库，包含常用词汇数据

**使用方法**:
```bash
# 1. 安装 pycantonese
pip install pycantonese

# 2. 生成数据
python backend/scripts/generate-from-pycantonese.py

# 3. 导入数据库
php backend/scripts/seed-jyutping-from-csv.php
```

### 3. 项目现有卡片数据

- **许可证**: 项目自有数据
- **特点**: 最安全，使用项目已有的卡片数据

**使用方法**:
```bash
php backend/scripts/seed-jyutping-from-default-boards.php
```

### 4. PyJyutping 转换数据

- **许可证**: 开源
- **GitHub**: https://github.com/MacroYau/PyJyutping
- **特点**: 基于官方粤语发音列表

可以编写脚本使用 PyJyutping 将常用汉字转换为粤拼。

## ❌ 不推荐（可能有版权问题）

- **Jyut Dictionary**: 包含第三方数据，可能违反版权
- **其他商业词典**: 通常有版权限制

## 快速开始

### 选项 A: 使用 CC-CANTO（推荐）

1. 下载 CC-CANTO: https://cantonese.org/download.html
2. 运行转换脚本
3. 导入数据库

### 选项 B: 使用 pycantonese（最简单）

1. 安装: `pip install pycantonese`
2. 运行: `python backend/scripts/generate-from-pycantonese.py`
3. 导入: `php backend/scripts/seed-jyutping-from-csv.php`

### 选项 C: 使用现有数据（最安全）

直接运行:
```bash
php backend/scripts/seed-jyutping-from-default-boards.php
```

## 验证数据

导入后运行:
```bash
php backend/scripts/check-jyutping-data.php
```

