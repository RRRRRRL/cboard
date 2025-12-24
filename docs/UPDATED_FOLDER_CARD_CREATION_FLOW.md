# Updated Folder and Card Creation Flow - Based on User Requirements

## User Requirements Summary

1. **Initial State**: User logs in → sees default Cboard (read-only, for initialization)
2. **First Change**: When user makes ANY change → creates NEW profile bound to user (becomes user's main board)
3. **Folder/Card Creation**: 
   - Adds to the main board (29 tiles → 30 tiles)
   - Folders can contain multiple cards
   - Folders are linked to the main board
4. **Modification Logic**:
   - If user modifies a default folder/card (e.g., "animals" with ID "ry1eFpwhDp-")
   - Creates a NEW profile for that folder (e.g., profile ID 99)
   - This new profile REPLACES the default folder in the same position (row 2, col 3)
   - The new profile appears in "All My Boards"
   - System Cboard (default) is NOT affected

## Key Concepts

### Default Cboard vs User Profile
- **Default Cboard**: Read-only, for initialization only
- **User Profile**: Created on first change, bound to user
- **Modified Folders**: Get new profile IDs, replace default folders in same position

### Profile ID Types
- **Non-numeric IDs** (e.g., "ry1eFpwhDp-", "root"): Default Cboard tiles
- **Numeric IDs** (e.g., "99", "123"): User-created profiles

### Replacement Logic
- When a default folder/card is modified:
  1. Create new profile with numeric ID
  2. Update main board's tile to reference new profile ID
  3. Keep same position (row/col)
  4. New profile appears in "All My Boards"

## Current Flow Issues

### Issue 1: First Change Detection
**Problem**: System doesn't detect when user makes first change to create user profile
**Location**: `handleApiUpdates` in `Board.container.js`
**Fix Needed**: Detect if current board is default Cboard (non-numeric ID), create new profile on first change

### Issue 2: Folder Modification Detection
**Problem**: System doesn't detect when a default folder is modified
**Location**: `handleEditTileEditorSubmit` and `handleApiUpdates`
**Fix Needed**: 
- Detect if edited tile has non-numeric ID (default Cboard)
- Create new profile for the modified folder
- Update main board to reference new profile ID

### Issue 3: Folder Creation
**Problem**: New folders get random shortid, not linked properly
**Location**: `TileEditor.component.js` and `handleAddTileEditorSubmit`
**Fix Needed**: 
- New folders should be part of main board
- If folder is later modified, create new profile

## Required Changes

### 1. Detect First Change and Create User Profile
**File**: `src/components/Board/Board.container.js`
**Function**: `handleApiUpdates`
**Logic**:
```javascript
// Check if current board is default Cboard (non-numeric ID)
const isDefaultCboard = !isNumericCurrentBoardId && currentBoardIdStr.length < SHORT_ID_MAX_LENGTH;

if (isDefaultCboard) {
  // First change - create new user profile
  createParentBoard = true;
  // This will create a new profile bound to user
}
```

### 2. Detect Modified Default Folders/Cards
**File**: `src/components/Board/Board.container.js`
**Function**: `handleApiUpdates` (when `editedTiles` is provided)
**Logic**:
```javascript
// Check each edited tile
for (const editedTile of editedTiles) {
  const tileIdStr = String(editedTile.id || '');
  const isDefaultTile = !/^\d+$/.test(tileIdStr) && tileIdStr.length < SHORT_ID_MAX_LENGTH;
  
  if (isDefaultTile && editedTile.loadBoard) {
    // Modified default folder - create new profile
    // Create new profile for the folder
    // Update tile.loadBoard to new profile ID
    // Update main board to reference new profile ID
  }
}
```

### 3. Handle Folder Creation
**File**: `src/components/Board/Board.container.js`
**Function**: `handleAddTileEditorSubmit`
**Logic**:
```javascript
// New folder in user's profile
if (tile.loadBoard && !tile.linkedBoard && isNumericCurrentId) {
  // Folder is part of main board
  // If folder is later modified, it will get its own profile
  // For now, just save as part of main board
}
```

### 4. Update Backend to Support Profile Replacement
**File**: `backend/api/routes/profile.php`
**Logic**:
- When saving board, check if tile has non-numeric ID (default)
- If tile is modified and has new profile ID, update the tile reference
- Keep same position (row/col)

## Implementation Plan

### Phase 1: First Change Detection
1. Modify `handleApiUpdates` to detect default Cboard
2. Create new profile on first change
3. Update board reference

### Phase 2: Modified Folder/Card Detection
1. Detect when default tile is edited
2. Create new profile for modified folder/card
3. Update main board tile reference
4. Ensure new profile appears in "All My Boards"

### Phase 3: Folder Creation Fix
1. Fix folder creation to work with main board
2. Ensure folders can be opened
3. Handle folder modification correctly

### Phase 4: Testing
1. Test first change creates user profile
2. Test folder creation adds to main board
3. Test folder modification creates new profile
4. Test card creation adds to main board
5. Test modified folders appear in "All My Boards"

