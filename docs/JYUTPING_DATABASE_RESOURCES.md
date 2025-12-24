# 开源粤拼数据库资源

本文档列出了可用于 Cboard 项目的开源粤拼数据库资源。

## 可用的开源数据库

### 1. **Jyut Dictionary** (推荐)

- **GitHub**: https://github.com/aaronhktan/jyut-dict
- **官网**: https://jyutdictionary.com
- **数据量**: 超过 30 万个词汇和表达
- **格式**: 支持多种输入方式（繁体/简体中文、粤拼、拼音、英语）
- **许可证**: 开源
- **特点**:
  - 包含完整的粤拼数据
  - 支持离线使用
  - 跨平台（Windows、Mac、Linux）

### 2. **CC-CANTO**

- **来源**: 基于 CC-CEDICT 的粤语扩展
- **数据量**: 大量粤语词汇
- **格式**: 文本/CSV
- **特点**:
  - 与 CC-CEDICT 兼容
  - 包含粤拼标注
  - 免费使用

### 3. **PyJyutping**

- **GitHub**: https://github.com/MacroYau/PyJyutping
- **PyPI**: https://pypi.org/project/pyjyutping/
- **特点**:
  - Python 库，包含粤拼转换数据
  - 基于官方粤语发音列表
  - 使用 JSON 格式的罗马化表

### 4. **pinyin-jyutping**

- **GitHub**: https://github.com/Vocab-Apps/pinyin-jyutping
- **特点**:
  - Python 模块
  - 支持简体/繁体中文转粤拼
  - 包含完整的转换数据

### 5. **Yue Phonetic Database (CJK Dictionary Institute)**

- **官网**: https://www.cjk.org/data/chinese/nlp/yue-phonetic-database/
- **数据量**: 超过 30 万个粤语词汇
- **特点**:
  - 专业的语言学数据库
  - 包含标准的粤拼罗马化
  - 可能需要联系获取

### 6. **pycantonese**

- **GitHub**: https://github.com/jacksonllee/pycantonese
- **特点**:
  - Python 库，包含粤语语料库数据
  - 支持粤拼转换
  - 包含常用词汇数据

## 项目中的导入工具

项目已经包含了导入 CSV 格式数据的脚本：

### CSV 导入脚本

- **文件**: `backend/scripts/seed-jyutping-from-csv.php`
- **用法**:
  ```bash
  php backend/scripts/seed-jyutping-from-csv.php
  ```
- **CSV 格式要求**:
  - 列名: `jyutping_code`, `hanzi`, `word`, `frequency`, `tags`
  - 文件路径: `backend/database/jyutping_pycantonese_input.csv`

### 数据库表结构

```sql
CREATE TABLE `jyutping_dictionary` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `jyutping_code` VARCHAR(50) NOT NULL,  -- e.g., 'nei5', 'hou2'
    `hanzi` VARCHAR(10) NULL,  -- Single character
    `word` VARCHAR(50) NULL,  -- Optional multi-character word
    `frequency` INT DEFAULT 0,  -- Usage frequency for ranking
    `tags` VARCHAR(191) NULL,  -- e.g., 'daily,school'
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_jyutping_code` (`jyutping_code`),
    INDEX `idx_hanzi` (`hanzi`),
    INDEX `idx_word` (`word`),
    INDEX `idx_frequency` (`frequency`)
);
```

## 推荐的数据获取和导入流程

### 方案 1: 使用 CC-CANTO（推荐 - 无版权问题）

**CC-CANTO 使用 CC-BY-SA 4.0 许可证，可以安全使用。**

1. **下载 CC-CANTO**

   - 访问: https://cantonese.org/download.html
   - 下载最新版本的文件

2. **转换为 CSV 格式**

   ```bash
   php backend/scripts/convert-cc-canto-to-csv.php <cc-canto-file>
   ```

3. **导入到数据库**
   ```bash
   php backend/scripts/seed-jyutping-from-csv.php
   ```

详细说明请参考: `docs/CC_CANTO_IMPORT_GUIDE.md`

### 方案 2: 使用 pycantonese 生成数据（推荐 - 无版权问题）

1. **安装 pycantonese**

   ```bash
   pip install pycantonese
   ```

2. **生成数据**

   ```bash
   python backend/scripts/generate-from-pycantonese.py
   ```

3. **导入到数据库**
   ```bash
   php backend/scripts/seed-jyutping-from-csv.php
   ```

### 方案 3: 使用项目现有卡片数据（最安全）

项目中的卡片数据可以转换为 Jyutping 数据：

```bash
php backend/scripts/seed-jyutping-from-default-boards.php
```

### 方案 4: 使用 Jyut Dictionary（不推荐 - 可能有版权问题）

**重要**: Jyut Dictionary 不直接提供 CSV 文件，但您可以从应用程序中提取数据。

#### 方法 A: 从应用程序提取（最简单）

1. **下载并安装 Jyut Dictionary**

   - 访问: https://jyutdictionary.com
   - 下载适合您操作系统的版本
   - 安装并运行一次应用程序（这会创建数据库文件）

2. **找到 dict.db 文件**

   - **Windows**: `%APPDATA%\jyut-dict\dict.db` 或 `C:\Users\<用户名>\AppData\Roaming\jyut-dict\dict.db`
   - **Mac**: `/Applications/jyut-dict.app/Contents/Resources/dict.db` 或 `~/Library/Application Support/jyut-dict/dict.db`
   - **Linux**: `~/.local/share/jyut-dict/dict.db`

3. **提取数据到 CSV**

   ```bash
   php backend/scripts/extract-jyut-dict-from-sqlite.php "路径\到\dict.db"
   ```

4. **导入到数据库**
   ```bash
   php backend/scripts/seed-jyutping-from-csv.php
   ```

#### 方法 B: 从 GitHub 仓库构建

1. **克隆仓库**

   ```bash
   git clone https://github.com/aaronhktan/jyut-dict.git
   cd jyut-dict
   ```

2. **下载数据源**（需要从以下网站下载）:

   - CC-CEDICT: https://cc-cedict.org/wiki/
   - CC-CANTO: https://www.cantonese.org/download.html
   - words.hk 粵典: https://words.hk/static/download/

3. **运行构建脚本**（查看 `src/dictionaries/` 目录）

   - 这会生成 `dict.db` 文件

4. **使用方法 A 的步骤 3-4** 提取和导入数据

**详细说明**: 请参考 `docs/JYUT_DICTIONARY_EXTRACTION_GUIDE.md`

### 方案 2: 使用 pycantonese

1. 安装 pycantonese: `pip install pycantonese`
2. 使用项目中的 `generate-jyutping-from-pycantonese.py` 脚本
3. 生成 CSV 文件
4. 运行导入脚本

### 方案 3: 使用 CC-CANTO

1. 下载 CC-CANTO 数据文件
2. 转换为项目所需的 CSV 格式
3. 导入数据库

## CSV 格式示例

```csv
jyutping_code,hanzi,word,frequency,tags
nei5,你,你,1000,daily,greeting
hou2,好,好,950,daily,greeting
m4goi1,,唔該,800,daily,polite
sik6,食,食,600,daily,verb
```

## 注意事项

1. **数据格式**: 确保 CSV 文件使用 UTF-8 编码
2. **频率值**: frequency 字段用于排序，数值越大优先级越高
3. **标签**: tags 字段用于分类，多个标签用逗号分隔
4. **去重**: 脚本会自动处理重复数据（基于 jyutping_code）
5. **性能**: 大量数据导入可能需要一些时间

## 数据转换工具

项目提供了数据转换脚本：

### convert-jyut-dict-to-csv.php

将各种格式的数据转换为 Cboard 所需的 CSV 格式。

**支持的输入格式**:

- JSON (来自 Jyut Dictionary)
- TSV/TAB 分隔文件
- CSV (自动检测列名)

**用法**:

```bash
php backend/scripts/convert-jyut-dict-to-csv.php <input_file> [output_file]
```

**示例**:

```bash
# 从 JSON 转换
php backend/scripts/convert-jyut-dict-to-csv.php jyut-dict-data.json

# 从 TSV 转换
php backend/scripts/convert-jyut-dict-to-csv.php data.tsv jyutping_pycantonese_input.csv
```

## 下一步

1. **选择一个开源数据库** (推荐: Jyut Dictionary)
2. **下载数据文件** (JSON, TSV, 或 CSV)
3. **转换为 CSV 格式** (使用 convert-jyut-dict-to-csv.php)
4. **导入数据库** (使用 seed-jyutping-from-csv.php)
5. **验证数据** (使用 check-jyutping-data.php)

## 快速导入流程

```bash
# 1. 下载数据 (例如从 Jyut Dictionary)
git clone https://github.com/aaronhktan/jyut-dict.git

# 2. 转换数据格式
php backend/scripts/convert-jyut-dict-to-csv.php jyut-dict/data.json

# 3. 导入到数据库
php backend/scripts/seed-jyutping-from-csv.php

# 4. 验证导入
php backend/scripts/check-jyutping-data.php
```
