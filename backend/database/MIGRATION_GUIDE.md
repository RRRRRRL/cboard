# Migration Guide: Boards to Profiles (Complete Migration)

## Overview

This guide will help you migrate from the old `boards` table structure to the new profile-centric structure that follows the AAC System MySQL Schema.

## Prerequisites

1. **Backup your database** before starting migration:
   ```bash
   mysqldump -u username -p cboard > backup_before_migration.sql
   ```

2. Ensure you have PHP CLI access and MySQL/MariaDB command line access.

## Migration Steps

### Step 1: Review New Schema

The new schema (`schema-v2.sql`) removes:
- `boards` table (completely removed)
- `profiles.root_board_id` column
- `profiles.name` column (keeping only `display_name`)
- `profiles.is_default` column

The new structure uses:
- `profiles` - core entity (one profile = one board)
- `cards` - symbolic cards
- `profile_cards` - links cards to profiles with layout positions

### Step 2: Run Migration Script

```bash
cd backend/scripts
php migrate-boards-to-profiles-v2.php
```

This script will:
1. Find all profiles with `root_board_id`
2. Extract tiles from `board_data` JSON in `boards` table
3. Create `cards` for each tile
4. Create `profile_cards` links with positions
5. Remove `root_board_id` from profiles
6. Optionally drop the `boards` table

### Step 3: Update Database Schema

After migration, update your database schema:

```sql
-- Remove root_board_id column
ALTER TABLE profiles DROP COLUMN root_board_id;

-- Remove name column (if exists)
ALTER TABLE profiles DROP COLUMN name;

-- Remove is_default column (if exists)
ALTER TABLE profiles DROP COLUMN is_default;

-- Drop boards table (if migration script didn't do it)
DROP TABLE IF EXISTS boards;
```

Or apply the new schema:

```bash
mysql -u username -p cboard < backend/database/schema-v2.sql
```

**Note**: This will create tables if they don't exist. For existing databases, you may need to manually alter tables.

### Step 4: Update Backend Code

Replace `backend/api/routes/profile.php` with the profile-centric version that:
- Uses `buildBoardDataFromProfile()` instead of reading from `boards` table
- Uses `saveBoardDataToProfile()` instead of saving to `boards` table
- Removes all references to `root_board_id`

Key changes needed in `profile.php`:

1. **GET /profiles/{id}/board**:
   ```php
   // OLD: Read from boards table
   // NEW: Use buildBoardDataFromProfile($db, $profileId)
   ```

2. **PUT /profiles/{id}/board**:
   ```php
   // OLD: Save to boards table
   // NEW: Use saveBoardDataToProfile($db, $profileId, $data)
   ```

3. **DELETE /profiles/{id}**:
   ```php
   // OLD: Delete from boards table
   // NEW: profile_cards are auto-deleted via CASCADE
   ```

4. **All queries**: Remove references to `root_board_id`, `name`, `is_default` columns

### Step 5: Verify Migration

1. Check that all profiles have cards:
   ```sql
   SELECT p.id, p.display_name, COUNT(pc.id) as card_count
   FROM profiles p
   LEFT JOIN profile_cards pc ON p.id = pc.profile_id
   GROUP BY p.id
   HAVING card_count = 0;
   ```
   This should return no rows (or only profiles that intentionally have no cards).

2. Check that no profiles have root_board_id:
   ```sql
   SELECT COUNT(*) FROM profiles WHERE root_board_id IS NOT NULL;
   ```
   This should return 0.

3. Test API endpoints:
   - `GET /profiles/{id}/board` - should return board data from profile_cards
   - `PUT /profiles/{id}/board` - should save to profile_cards
   - `GET /board/my` - should return profiles
   - `GET /board/public` - should return public profiles

## Rollback Plan

If you need to rollback:

1. Restore database backup:
   ```bash
   mysql -u username -p cboard < backup_before_migration.sql
   ```

2. Revert code changes to use `boards` table again

## Post-Migration Cleanup

After successful migration and verification:

1. Remove old migration scripts (if desired)
2. Update documentation
3. Remove any remaining references to `boards` table in code
4. Consider adding database constraints to prevent accidental use of old structure

## Troubleshooting

### Issue: Some tiles are missing after migration

**Solution**: Check the migration script logs. Some tiles might have been skipped if they had no `label` or `title`. You may need to manually review and fix these.

### Issue: Profile has no cards after migration

**Possible causes**:
- Original board had no tiles
- Tiles had invalid data
- Migration script encountered errors

**Solution**: Check migration logs and manually verify the original board_data JSON.

### Issue: API returns empty board

**Solution**: Ensure `buildBoardDataFromProfile()` is being called correctly and that `profile_cards` exist for the profile.

## Notes

- The migration preserves all card data (images, audio, labels)
- Layout positions (row, col, page) are preserved
- Profile metadata (name, description, is_public) is preserved
- The migration is **one-way** - once boards table is dropped, you cannot rollback without a backup

