# Migration Status: Boards to Profiles

## ✅ Completed

### 1. New Database Schema (`schema-v2.sql`)
- ✅ Removed `boards` table
- ✅ Removed `profiles.root_board_id` column
- ✅ Removed `profiles.name` column (keeping only `display_name`)
- ✅ Removed `profiles.is_default` column
- ✅ Follows AAC System MySQL Schema specification

### 2. Migration Script (`migrate-boards-to-profiles-v2.php`)
- ✅ Extracts tiles from `board_data` JSON
- ✅ Creates `cards` for each tile
- ✅ Creates `profile_cards` links with positions
- ✅ Removes `root_board_id` from profiles
- ✅ Optionally drops `boards` table

### 3. Backend Code Updates (`profile.php`)
- ✅ **GET /profiles/{id}/board**: Now builds board data from `profile_cards` + `cards` (no `boards` table)
- ✅ **PUT /profiles/{id}/board**: Now saves to `profile_cards` + `cards` (no `boards` table)
- ✅ **DELETE /profiles/{id}**: Removed `boards` table deletion (profile_cards auto-deleted via CASCADE)
- ✅ Removed all references to `root_board_id` in queries
- ✅ Removed all references to `name` column (using only `display_name`)
- ✅ Removed all references to `is_default` column
- ✅ Updated `getPublicProfilesHelper()` to not select removed columns

## ⚠️ Pending Actions

### 1. Run Migration Script
```bash
cd backend/scripts
php migrate-boards-to-profiles-v2.php
```

### 2. Update Database Schema
After migration, run these SQL commands:

```sql
-- Remove root_board_id column
ALTER TABLE profiles DROP COLUMN root_board_id;

-- Remove name column
ALTER TABLE profiles DROP COLUMN name;

-- Remove is_default column
ALTER TABLE profiles DROP COLUMN is_default;

-- Drop boards table (if migration script didn't do it)
DROP TABLE IF EXISTS boards;
```

### 3. Test API Endpoints
- [ ] `GET /profiles/{id}/board` - Should return board from profile_cards
- [ ] `PUT /profiles/{id}/board` - Should save to profile_cards
- [ ] `GET /board/my` - Should return profiles
- [ ] `GET /board/public` - Should return public profiles
- [ ] `DELETE /profiles/{id}` - Should delete profile and cascade delete profile_cards

### 4. Check Other Files
Search for remaining references to:
- `boards` table
- `root_board_id`
- `profiles.name` (should use `display_name`)
- `profiles.is_default`

```bash
# Search for remaining references
grep -r "root_board_id" backend/
grep -r "FROM boards" backend/
grep -r "profiles.name" backend/
grep -r "is_default" backend/
```

## 📋 Migration Checklist

- [ ] **Backup database** before migration
- [ ] Run migration script
- [ ] Verify all profiles have cards migrated
- [ ] Update database schema (remove columns)
- [ ] Test all API endpoints
- [ ] Check frontend still works
- [ ] Remove old migration scripts (optional)
- [ ] Update documentation

## 🔍 Verification Queries

```sql
-- Check profiles without cards (should be empty or intentional)
SELECT p.id, p.display_name, COUNT(pc.id) as card_count
FROM profiles p
LEFT JOIN profile_cards pc ON p.id = pc.profile_id
GROUP BY p.id
HAVING card_count = 0;

-- Check for remaining root_board_id (should be 0)
SELECT COUNT(*) FROM profiles WHERE root_board_id IS NOT NULL;

-- Check for remaining name column (should fail if column removed)
SELECT name FROM profiles LIMIT 1;

-- Check for remaining is_default column (should fail if column removed)
SELECT is_default FROM profiles LIMIT 1;

-- Check boards table exists (should fail if table dropped)
SELECT COUNT(*) FROM boards;
```

## 📝 Notes

- The migration is **one-way** - once `boards` table is dropped, rollback requires database backup
- All card data (images, audio, labels) is preserved
- Layout positions (row, col, page) are preserved
- Profile metadata (display_name, description, is_public) is preserved

