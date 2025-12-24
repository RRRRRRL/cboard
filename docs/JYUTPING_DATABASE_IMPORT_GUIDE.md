# 粤拼数据库导入指南

本指南帮助您从开源数据库导入粤拼数据到 Cboard 项目。

## 快速开始

### 方法 1: 使用 CSV 导入（推荐）

1. **准备 CSV 文件**

   - 文件路径: `backend/database/jyutping_pycantonese_input.csv`
   - 格式要求:
     ```csv
     jyutping_code,hanzi,word,frequency,tags
     nei5,你,你,1000,daily,greeting
     hou2,好,好,950,daily,greeting
     ```

2. **运行导入脚本**
   ```bash
   php backend/scripts/seed-jyutping-from-csv.php
   ```

### 方法 2: 使用 pycantonese 生成数据

1. **安装依赖**

   ```bash
   pip install pycantonese
   ```

2. **准备输入 CSV** (`backend/database/jyutping_pycantonese_input.csv`)

   ```csv
   hanzi,word,frequency,tags
   你,你,1000,daily,greeting
   好,好,950,daily,greeting
   ```

3. **生成 SQL 文件**

   ```bash
   python backend/scripts/generate-jyutping-from-pycantonese.py
   ```

4. **导入到数据库**
   ```bash
   mysql -u USER -p cboard < backend/database/seed-jyutping-from-pycantonese.sql
   ```

## 推荐的开源数据库

### 1. Jyut Dictionary (最推荐)

- **GitHub**: https://github.com/aaronhktan/jyut-dict
- **数据量**: 30 万+ 词汇
- **特点**: 完整、开源、维护活跃

### 2. CC-CANTO

- **来源**: CC-CEDICT 的粤语扩展
- **格式**: 文本/CSV
- **特点**: 免费、标准格式

### 3. pycantonese 内置数据

- **GitHub**: https://github.com/jacksonllee/pycantonese
- **特点**: Python 库，包含常用词汇

## 数据格式转换示例

如果您从其他来源获取数据，需要转换为以下格式：

**输入格式** (其他数据库):

```
汉字 | 粤拼 | 词频
你   | nei5 | 1000
```

**输出格式** (Cboard):

```csv
jyutping_code,hanzi,word,frequency,tags
nei5,你,你,1000,daily,greeting
```

## 验证导入

运行检查脚本：

```bash
php backend/scripts/check-jyutping-data.php
```

## 注意事项

- 确保 CSV 文件使用 UTF-8 编码
- frequency 值越大，优先级越高
- tags 用于分类，多个标签用逗号分隔
- 重复的 jyutping_code 会自动更新（保留更高的 frequency）
