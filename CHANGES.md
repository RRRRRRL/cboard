# Changes Log

## 2025-12-29: AI Features and Jyutping Keyboard Updates

### 1. Removed Typing Prediction from AI Features Settings
- **File Modified**: `src/components/Settings/AIFeatures/AIFeatures.component.js`
- **Changes**:
  - Removed "Typing Prediction" tab from AI Features settings
  - Removed `renderTypingPredictions()` function
  - Removed unused props: `predictions`, `onGetPredictions`
  - Removed unused state variables: `typingInput`
  - Updated tab navigation to only show "Card Suggestions" and "Learning Stats"
  - Cleaned up PropTypes to reflect removed functionality

### 2. Jyutping Keyboard Validation Rules
- **Status**: Already using local validation rules (no database dependency)
- **Files**:
  - `src/utils/jyutpingValidation.js` - Contains all validation rules embedded in code
  - `src/components/JyutpingKeyboard/JyutpingKeyboard.component.js` - Uses local validation
- **Validation Features**:
  - All initial-final combination rules are hardcoded in `VALID_COMBINATIONS` object
  - Key enabling/disabling logic uses `isValidInitialFinalCombination()` from local validation utils
  - No database calls for validation rules
  - Database is only used for word suggestions (hanzi lookup), not for validation rules
- **Note**: The jyutping keyboard in the navbar already uses local validation rules and does not depend on an external database for determining which keys should be enabled or disabled during input.

## Summary
✅ Typing prediction feature removed from AI Features settings
✅ Jyutping keyboard validation rules confirmed to be using local rules (no database dependency for validation)
