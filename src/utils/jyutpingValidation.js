/**
 * Jyutping Input Validation Rules
 * 
 * Strict matching rules for Jyutping input:
 * - Valid Jyutping syllables follow specific patterns
 * - Exceptions for common variations and edge cases
 */

// Valid Jyutping initials (consonants) - reserved for future strict validation
// const VALID_INITIALS = [
//   'b', 'p', 'm', 'f', 'd', 't', 'n', 'l',
//   'g', 'k', 'ng', 'h', 'gw', 'kw', 'w',
//   'z', 'c', 's', 'j'
// ];

// Valid Jyutping finals (vowels) - reserved for future strict validation
// const VALID_FINALS = [
//   'aa', 'a', 'e', 'i', 'o', 'u', 'yu', 'oe',
//   'aai', 'ai', 'aau', 'au', 'aam', 'am', 'aan', 'an',
//   'aang', 'ang', 'aap', 'ap', 'aat', 'at', 'aak', 'ak',
//   'ei', 'eu', 'eoi', 'eong', 'eot', 'eok',
//   'iu', 'im', 'in', 'ing', 'ip', 'it', 'ik',
//   'oi', 'ou', 'on', 'ong', 'ot', 'ok',
//   'ui', 'un', 'ung', 'ut', 'uk',
//   'yun', 'yut',
//   'oei', 'oen', 'oeng', 'oet', 'oek',
//   'm', 'ng'
// ];

// Valid tone numbers (1-6, plus 0 for neutral/entering tone) - reserved for future strict validation
// const VALID_TONES = ['0', '1', '2', '3', '4', '5', '6'];

// Common exceptions and variations
const EXCEPTIONS = [
  // Common abbreviations
  'ngo', 'nei', 'keoi', 'm', 'ng',
  // Common words that don't follow strict rules
  'hai', 'ge', 'di', 'lei', 'lei',
  // Numbers as standalone
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  // Punctuation
  '.', ',', '!', '?', ';', ':'
];

/**
 * Check if a character is a valid Jyutping character
 * @param {string} char - Single character to validate
 * @returns {boolean}
 */
export function isValidJyutpingChar(char) {
  if (!char || char.length === 0) return false;
  
  // Allow lowercase letters, numbers, and common punctuation
  const charCode = char.charCodeAt(0);
  return (
    (charCode >= 97 && charCode <= 122) || // a-z
    (charCode >= 48 && charCode <= 57) ||  // 0-9
    char === '.' || char === ',' || char === '!' || char === '?' ||
    char === ';' || char === ':' || char === ' ' || char === '\n'
  );
}

/**
 * Validate if input follows Jyutping pattern
 * @param {string} input - Input string to validate
 * @returns {Object} { isValid: boolean, error: string, suggestions: string[] }
 */
export function validateJyutpingInput(input) {
  if (!input || input.length === 0) {
    return { isValid: true, error: null, suggestions: [] };
  }

  // Check each character
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (!isValidJyutpingChar(char)) {
      return {
        isValid: false,
        error: `Invalid character: "${char}"`,
        suggestions: []
      };
    }
  }

  // Check if input matches a valid Jyutping pattern or exception
  const normalizedInput = input.toLowerCase().trim();
  
  // Check exceptions first
  if (EXCEPTIONS.includes(normalizedInput)) {
    return { isValid: true, error: null, suggestions: [] };
  }

  // Check if it's a number (valid for tones)
  if (/^\d+$/.test(normalizedInput)) {
    return { isValid: true, error: null, suggestions: [] };
  }

  // Check if it follows Jyutping syllable pattern
  // Pattern: [initial][final][tone]
  // Examples: nei5, ngo5, hai2, ge3
  const jyutpingPattern = /^([bpmfdtnlgkhwzcsj]|gw|kw|ng)?([aeiouy]+[aeiouy]*[mnptk]?|m|ng)([0-6])?$/i;
  
  if (jyutpingPattern.test(normalizedInput)) {
    return { isValid: true, error: null, suggestions: [] };
  }

  // If it doesn't match strict pattern, still allow it (might be partial input)
  // But provide suggestions
  const suggestions = getSuggestionsForInput(normalizedInput);
  
  return {
    isValid: true, // Allow partial input
    error: null,
    suggestions
  };
}

/**
 * Get suggestions for invalid or partial input
 * @param {string} input - Input string
 * @returns {string[]} Array of suggestion strings
 */
function getSuggestionsForInput(input) {
  const suggestions = [];
  
  // If input ends with a number, suggest removing it or keeping it
  if (/\d$/.test(input)) {
    const withoutTone = input.replace(/\d+$/, '');
    if (withoutTone.length > 0) {
      suggestions.push(withoutTone);
    }
  }
  
  // If input doesn't have a tone, suggest adding common tones
  if (!/\d$/.test(input) && input.length > 0) {
    for (let tone of ['1', '2', '3', '4', '5', '6']) {
      suggestions.push(input + tone);
    }
  }
  
  return suggestions;
}

/**
 * Check if input is a complete Jyutping syllable (has tone number)
 * @param {string} input - Input string
 * @returns {boolean}
 */
export function isCompleteJyutping(input) {
  if (!input || input.length === 0) return false;
  return /\d$/.test(input.trim());
}

/**
 * Extract tone number from Jyutping input
 * @param {string} input - Jyutping input
 * @returns {number|null} Tone number (1-6) or null
 */
export function extractTone(input) {
  if (!input) return null;
  const match = input.match(/(\d)$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Remove tone number from Jyutping input
 * @param {string} input - Jyutping input
 * @returns {string} Input without tone number
 */
export function removeTone(input) {
  if (!input) return '';
  return input.replace(/\d+$/, '');
}

/**
 * Format Jyutping for display (add tone marker if missing)
 * @param {string} input - Jyutping input
 * @returns {string} Formatted Jyutping
 */
export function formatJyutpingForDisplay(input) {
  if (!input) return '';
  
  // If it already has a tone, return as is
  if (/\d$/.test(input)) {
    return input;
  }
  
  // Otherwise, highlight that tone is missing
  return input + '?';
}

