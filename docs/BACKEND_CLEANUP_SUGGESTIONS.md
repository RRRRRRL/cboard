# Backend 目录清理建议

## 文件分类

### 1. 迁移脚本（如果迁移已完成，可考虑删除）

这些脚本用于从旧架构迁移到新架构，如果迁移已完成，可以删除：

- `backend/scripts/migrate-boards-to-profiles.php` - 旧版本迁移脚本
- `backend/scripts/migrate-boards-to-profiles-v2.php` - 新版本迁移脚本
- `backend/scripts/fix-migration-issues-safe.php` - 迁移修复脚本
- `backend/scripts/fix-migration-issues.sql` - 迁移修复SQL
- `backend/scripts/recreate-user-root-profile-from-boards.php` - 一次性修复脚本

**建议**: 如果迁移已完成且系统稳定运行，可以删除这些脚本。但建议先备份。

### 2. 临时修复脚本（特定问题的一次性修复）

这些脚本用于修复特定问题，如果问题已解决，可以删除：

- `backend/scripts/delete-corrupted-profile.php` - 删除损坏profile
- `backend/scripts/delete-corrupted-profile.sql` - 对应的SQL脚本
- `backend/scripts/delete-all-profiles.php` - 危险脚本，可能只是测试用

**建议**: 如果不再需要，可以删除。但 `delete-all-profiles.php` 应该保留作为管理工具。

### 3. 数据导入/转换脚本（如果数据已导入）

这些脚本用于导入和转换数据，如果数据已导入，可以删除：

- `backend/scripts/convert-cc-canto-to-csv.php` - CC-Canto转换脚本
- `backend/scripts/convert-jyut-dict-to-csv.php` - Jyut字典转换脚本
- `backend/scripts/extract-jyut-dict-from-sqlite.php` - SQLite提取脚本
- `backend/scripts/generate-from-pycantonese.py` - PyCantonese生成脚本
- `backend/scripts/generate-jyutping-from-pycantonese.py` - Jyutping生成脚本
- `backend/scripts/clear-jyutping-dictionary.php` - 清空字典脚本（如果不再需要）
- `backend/scripts/remove-bad-words-from-jyutping.php` - 移除不当词汇（如果已执行）
- `backend/scripts/remove-duplicate-jyutping.php` - 移除重复（如果已执行）
- `backend/scripts/verify-no-duplicates.php` - 验证脚本（如果不再需要）

**建议**: 如果数据已导入且不再需要重新导入，可以删除转换脚本。但验证脚本可能还有用。

### 4. 数据文件（如果已导入数据库）

- `backend/database/cccanto-webdist.txt` - CC-Canto原始数据文件（34,000+行）
- `backend/database/jyutping_cc-canto.csv` - 如果已导入
- `backend/database/jyutping_pycantonese_input.csv` - 如果已导入
- `backend/database/jyutping_pycantonese_input_from_boards.csv` - 如果已导入

**建议**: 如果数据已导入数据库，可以删除这些文件以节省空间。但建议先备份。

### 5. 迁移文档（如果迁移已完成）

- `backend/database/MIGRATION_STATUS.md` - 迁移状态文档
- `backend/database/MIGRATION_GUIDE.md` - 迁移指南
- `backend/database/ARCHITECTURE_SUMMARY.md` - 架构总结（可能已过时，提到boards表）

**建议**: 如果迁移已完成，可以删除迁移文档。但 `ARCHITECTURE_SUMMARY.md` 可能需要更新而不是删除。

## 需要保留的文件

### 重要脚本（应该保留）

- `backend/scripts/backup-database.sh` - 数据库备份
- `backend/scripts/restore-database.sh` - 数据库恢复
- `backend/scripts/import-database-to-server.sh` / `.ps1` - 数据库导入
- `backend/scripts/cleanup-old-logs.php` - 日志清理（定期使用）
- `backend/scripts/seed-*.php` - 数据种子脚本（可能需要重新运行）
- `backend/scripts/check-*.php` - 检查脚本（用于维护）

### 重要文档（应该保留）

- `backend/database/README-IMPORT.md` - 导入指南
- `backend/database/schema.sql` / `schema-v2.sql` - 数据库架构
- `backend/database/seed-*.sql` - 种子数据SQL

## 清理建议

### 安全清理（推荐）

1. **删除已完成的迁移脚本**（如果迁移已完成）：
   - `migrate-boards-to-profiles.php`
   - `migrate-boards-to-profiles-v2.php`
   - `fix-migration-issues-safe.php`
   - `fix-migration-issues.sql`
   - `recreate-user-root-profile-from-boards.php`

2. **删除特定问题的修复脚本**（如果问题已解决）：
   - `delete-corrupted-profile.php`
   - `delete-corrupted-profile.sql`

3. **删除数据转换脚本**（如果数据已导入）：
   - `convert-cc-canto-to-csv.php`
   - `convert-jyut-dict-to-csv.php`
   - `extract-jyut-dict-from-sqlite.php`
   - `generate-from-pycantonese.py`
   - `generate-jyutping-from-pycantonese.py`

4. **删除大型数据文件**（如果已导入数据库）：
   - `cccanto-webdist.txt` (34,000+ 行)

5. **删除迁移文档**（如果迁移已完成）：
   - `MIGRATION_STATUS.md`
   - `MIGRATION_GUIDE.md`

### 谨慎清理（需要确认）

1. **数据清理脚本** - 确认是否还需要：
   - `clear-jyutping-dictionary.php`
   - `remove-bad-words-from-jyutping.php`
   - `remove-duplicate-jyutping.php`
   - `verify-no-duplicates.php`

2. **CSV数据文件** - 确认是否还需要重新导入：
   - `jyutping_cc-canto.csv`
   - `jyutping_pycantonese_input.csv`
   - `jyutping_pycantonese_input_from_boards.csv`

3. **架构文档** - 可能需要更新而不是删除：
   - `ARCHITECTURE_SUMMARY.md` - 更新以反映当前架构

## 清理后的好处

1. **减少项目大小** - 删除大型数据文件可以显著减少仓库大小
2. **提高可维护性** - 减少过时脚本和文档的混淆
3. **更清晰的代码库** - 只保留当前需要的文件

## 注意事项

⚠️ **在删除之前**：
1. 确保迁移已完成且系统稳定运行
2. 备份重要文件（特别是数据文件）
3. 确认不再需要这些脚本
4. 考虑将重要脚本移到 `archive/` 目录而不是直接删除




