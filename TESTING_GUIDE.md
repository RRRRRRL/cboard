# Testing Guide for Sprint 8-12 Features

This document provides comprehensive testing instructions for all new features implemented in Sprints 8-12.

## Test Structure

The codebase uses two types of tests:
1. **Unit Tests** - Jest with snapshot testing (following Cboard patterns)
2. **E2E Tests** - Playwright for end-to-end testing

## Unit Tests

### Running Unit Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- Transfer.test.js
```

### Test Files Created

All new components have corresponding test files following the Cboard pattern:

- `src/components/Settings/Transfer/Transfer.test.js`
- `src/components/Settings/LearningGames/LearningGames.test.js`
- `src/components/Settings/OCRTranslator/OCRTranslator.test.js`
- `src/components/Settings/AIFeatures/AIFeatures.test.js`
- `src/components/Settings/AdminPanel/AdminPanel.test.js`
- `src/components/Settings/LogViewer/LogViewer.test.js`

### Test Patterns

All tests follow the existing Cboard pattern:

```javascript
import React from 'react';
import { shallowMatchSnapshot } from '../../../common/test_utils';
import Component from './Component.component';

jest.mock('./Component.messages', () => {
  return {
    // Mock messages
  };
});

const COMPONENT_PROPS = {
  // Required props
};

describe('Component tests', () => {
  test('default renderer', () => {
    shallowMatchSnapshot(<Component {...COMPONENT_PROPS} />);
  });
});
```

## E2E Tests

### Running E2E Tests

```bash
# Install Playwright browsers
npm run test:e2e:install

# Run all E2E tests
npm run test:e2e

# Run in headed mode
npm run test:e2e:headed

# Run in debug mode
npm run test:e2e:debug

# Run with UI mode
npm run test:e2e:ui
```

### E2E Test Coverage

#### 1. Profile Transfer Tests

**File:** `tests/settings/transfer.spec.js` (to be created)

**Test Cases:**
- [ ] Export profile as JSON
- [ ] Export profile as OBF
- [ ] Generate QR code for transfer
- [ ] Scan QR code to import profile
- [ ] Generate cloud code
- [ ] Redeem cloud code
- [ ] Generate email transfer
- [ ] Import profile from file

**Example:**
```javascript
test('should export profile as JSON', async ({ page }) => {
  await page.goto('/settings/transfer');
  await page.click('text=Export');
  await page.selectOption('select[name="profile"]', '1');
  await page.selectOption('select[name="format"]', 'json');
  await page.click('button:has-text("Export")');
  await expect(page.locator('.success-message')).toBeVisible();
});
```

#### 2. Learning Games Tests

**File:** `tests/settings/learning-games.spec.js` (to be created)

**Test Cases:**
- [ ] Start spelling game
- [ ] Answer questions correctly
- [ ] Complete game and view score
- [ ] Play again functionality
- [ ] Difficulty selection

**Example:**
```javascript
test('should complete spelling game', async ({ page }) => {
  await page.goto('/settings/learning-games');
  await page.click('text=Spelling Game');
  await page.selectOption('select[name="difficulty"]', 'medium');
  await page.click('button:has-text("Start Game")');
  // Answer questions
  await page.click('button:has-text("nei5")'); // Correct answer
  await page.click('button:has-text("Next")');
  // Continue until game finished
  await expect(page.locator('text=Game Finished')).toBeVisible();
});
```

#### 3. OCR Translator Tests

**File:** `tests/settings/ocr-translator.spec.js` (to be created)

**Test Cases:**
- [ ] Upload image for OCR
- [ ] Recognize text from image
- [ ] Convert Chinese to Jyutping
- [ ] View translation history
- [ ] Delete history item

**Example:**
```javascript
test('should recognize text and convert to Jyutping', async ({ page }) => {
  await page.goto('/settings/ocr-translator');
  await page.setInputFiles('input[type="file"]', 'test-image.png');
  await page.click('button:has-text("Recognize Text")');
  await expect(page.locator('text=你好')).toBeVisible();
  await page.click('button:has-text("Convert to Jyutping")');
  await expect(page.locator('text=nei5 hou2')).toBeVisible();
});
```

#### 4. AI Features Tests

**File:** `tests/settings/ai-features.spec.js` (to be created)

**Test Cases:**
- [ ] Get card suggestions
- [ ] Typing prediction
- [ ] Jyutping prediction
- [ ] View learning statistics

**Example:**
```javascript
test('should get card suggestions', async ({ page }) => {
  await page.goto('/settings/ai-features');
  await page.selectOption('select[name="profile"]', '1');
  await page.fill('textarea[name="context"]', 'greeting');
  await page.click('button:has-text("Get Suggestions")');
  await expect(page.locator('.suggestion-card')).toBeVisible();
});
```

#### 5. Admin Panel Tests

**File:** `tests/settings/admin-panel.spec.js` (to be created)

**Test Cases:**
- [ ] View user list (admin only)
- [ ] Search users
- [ ] Filter by role
- [ ] Edit user
- [ ] Delete user
- [ ] View statistics

**Example:**
```javascript
test('should list users as admin', async ({ page }) => {
  // Login as admin first
  await page.goto('/settings/admin');
  await expect(page.locator('table')).toBeVisible();
  await expect(page.locator('tr')).toHaveCount(/* expected count */);
});
```

#### 6. Log Viewer Tests

**File:** `tests/settings/log-viewer.spec.js` (to be created)

**Test Cases:**
- [ ] View action logs
- [ ] Filter by profile
- [ ] Filter by action type
- [ ] Filter by date range
- [ ] Export logs to Excel

**Example:**
```javascript
test('should filter logs by profile', async ({ page }) => {
  await page.goto('/settings/log-viewer');
  await page.selectOption('select[name="profile"]', '1');
  await page.click('button:has-text("Apply Filters")');
  await expect(page.locator('table tbody tr')).toBeVisible();
});
```

## Manual Testing Checklist

### Profile Transfer
- [ ] Export profile in JSON format
- [ ] Export profile in OBF format
- [ ] Generate QR code and scan with camera
- [ ] Generate cloud code and redeem
- [ ] Send email transfer and receive ZIP
- [ ] Import profile from file
- [ ] Import profile via QR code
- [ ] Import profile via cloud code

### Learning Games
- [ ] Start spelling game with easy difficulty
- [ ] Start spelling game with medium difficulty
- [ ] Start spelling game with hard difficulty
- [ ] Complete game and view score
- [ ] Play again functionality
- [ ] Game history tracking

### OCR Translator
- [ ] Upload image with Chinese text
- [ ] Recognize text from image
- [ ] Edit recognized text
- [ ] Convert Chinese to Jyutping
- [ ] View character details
- [ ] View translation history
- [ ] Delete history item

### AI Features
- [ ] Get card suggestions based on context
- [ ] Typing prediction for English
- [ ] Typing prediction for Jyutping
- [ ] View learning statistics
- [ ] Adaptive learning updates

### Admin Panel
- [ ] Access admin panel (admin only)
- [ ] View all users
- [ ] Search users
- [ ] Filter by role
- [ ] Filter by status
- [ ] Edit user details
- [ ] Change user role
- [ ] Deactivate user
- [ ] View statistics

### Log Viewer
- [ ] View all action logs
- [ ] Filter by profile
- [ ] Filter by action type
- [ ] Filter by date range
- [ ] Export logs to CSV/Excel
- [ ] Pagination works correctly

## Integration Testing

### API Endpoint Testing

Use the `TEST_BACKEND_ROUTES.md` guide to test all backend endpoints:

```bash
# Test transfer endpoints
curl -X POST http://localhost/api/transfer/qr/generate \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"profile_id": 1, "expires_in": 24}'

# Test AI endpoints
curl -X POST http://localhost/api/ai/suggest-cards \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"context": "hello", "profile_id": 1, "limit": 10}'
```

## Performance Testing

### Key Metrics to Test

1. **Response Times**
   - API endpoints should respond in < 500ms
   - UI interactions should feel instant (< 100ms)

2. **Load Testing**
   - Test with multiple concurrent users
   - Test with large datasets (1000+ logs, 100+ users)

3. **Memory Usage**
   - Monitor memory usage during long sessions
   - Check for memory leaks in games and OCR

## Accessibility Testing

### WCAG Compliance

- [ ] Keyboard navigation works for all features
- [ ] Screen reader compatibility
- [ ] ARIA labels present
- [ ] Color contrast meets WCAG AA standards
- [ ] Focus indicators visible

### Test with Assistive Technologies

- [ ] Test with screen readers (NVDA, JAWS, VoiceOver)
- [ ] Test with keyboard-only navigation
- [ ] Test with switch scanning devices

## Browser Compatibility

Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Chrome
- [ ] Mobile Safari

## Known Issues and Limitations

1. **Matching Game**: Backend implementation pending
2. **Image Annotation Download**: Download feature pending
3. **Word-by-word Playback**: TTS integration pending
4. **Data Retention Policy**: UI for retention settings pending
5. **Website Pages**: Not implemented yet

## Test Data Setup

### Required Test Data

1. **Users**
   - Admin user
   - Teacher user
   - Therapist user
   - Parent user
   - Student user

2. **Profiles**
   - At least 3 test profiles
   - Profiles with different card counts

3. **Action Logs**
   - Generate logs for different action types
   - Logs across different date ranges

4. **Game Data**
   - Questions for spelling game
   - Different difficulty levels

## Continuous Integration

Tests should run automatically in CI/CD:

```yaml
# Example GitHub Actions workflow
- name: Run unit tests
  run: npm test -- --coverage

- name: Run E2E tests
  run: npm run test:e2e
```

## Reporting Issues

When reporting test failures:
1. Include test name and file
2. Include error message
3. Include browser/environment
4. Include steps to reproduce
5. Include screenshots if applicable

