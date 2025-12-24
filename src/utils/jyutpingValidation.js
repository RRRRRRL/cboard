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

/**
 * Check if a final can be used without an initial (standalone finals)
 * @param {string} final - Final to check
 * @returns {boolean}
 */
export function canFinalStandalone(final) {
  if (!final) return false;
  // Finals that can be used without an initial
  // NOTE: 'm' and 'ng' are intentionally excluded here so they are only used as initials
  const standaloneFinals = ['aa', 'a', 'e', 'i', 'o', 'u', 'yu', 'oe'];
  return standaloneFinals.includes(final.toLowerCase());
}

/**
 * Extract initial from Jyutping input
 * @param {string} input - Jyutping input
 * @returns {string|null} Initial consonant or null
 */
export function extractInitial(input) {
  if (!input) return null;
  
  const inputLower = input.toLowerCase();
  
  // Check for two-character initials first
  const twoCharInitials = ['gw', 'kw', 'ng'];
  for (const initial of twoCharInitials) {
    if (inputLower.startsWith(initial)) {
      return initial;
    }
  }
  
  // Check for single-character initials
  const singleCharInitials = ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 
                              'g', 'k', 'h', 'w', 'z', 'c', 's', 'j'];
  for (const initial of singleCharInitials) {
    if (inputLower.startsWith(initial)) {
      return initial;
    }
  }
  
  return null;
}

/**
 * Valid initial-final combinations in Jyutping
 * This is a comprehensive list based on actual Jyutping rules
 */
const VALID_COMBINATIONS = {
  // b + finals
  'b': ['aa', 'aai', 'aak', 'aan', 'aang', 'aat', 'ai', 'ak', 'am', 'an', 'ang', 'ap', 'at', 'ei', 'ik', 'in', 'ing', 'it', 'iu', 'o', 'oi', 'ok', 'ong', 'ou', 'uk', 'ung', 'ut'],
  // p + finals
  'p': ['aa', 'aai', 'aak', 'aan', 'aang', 'aat', 'ai', 'ak', 'am', 'an', 'ang', 'ap', 'at', 'ei', 'ik', 'in', 'ing', 'it', 'iu', 'o', 'oi', 'ok', 'ong', 'ou', 'uk', 'ung', 'ut'],
  // m + finals
  'm': ['aa', 'aai', 'aak', 'aan', 'aang', 'aat', 'ai', 'ak', 'am', 'an', 'ang', 'ap', 'at', 'e', 'ei', 'ik', 'in', 'ing', 'it', 'iu', 'o', 'ou', 'ui', 'uk', 'ung', 'ut'],
  // f + finals
  'f': ['aa', 'aai', 'aak', 'aan', 'aang', 'aat', 'ai', 'an', 'ang', 'at', 'e', 'ei', 'ik', 'o', 'oi', 'ok', 'ong', 'u', 'ui', 'uk', 'ung', 'ut'],
  // d + finals
  'd': ['aa', 'aai', 'aak', 'aan', 'aang', 'aat', 'ai', 'ak', 'am', 'an', 'ang', 'ap', 'at', 'e', 'ei', 'ek', 'eng', 'eoi', 'eon', 'eot', 'ik', 'im', 'in', 'ing', 'ip', 'it', 'iu', 'o', 'oe', 'oek', 'oeng', 'oi', 'ok', 'ong', 'ou', 'uk', 'ung', 'ut'],
  // t + finals
  't': ['aa', 'aai', 'aak', 'aan', 'aang', 'aat', 'ai', 'ak', 'am', 'an', 'ang', 'ap', 'at', 'e', 'ei', 'ek', 'eng', 'eoi', 'eon', 'eot', 'ik', 'im', 'in', 'ing', 'ip', 'it', 'iu', 'o', 'oe', 'oek', 'oeng', 'oi', 'ok', 'ong', 'ou', 'uk', 'ung', 'ut'],
  // n + finals
  'n': ['aa', 'aai', 'aak', 'aan', 'aang', 'aat', 'ai', 'ak', 'am', 'an', 'ang', 'ap', 'at', 'e', 'ei', 'ek', 'eng', 'eoi', 'eon', 'eot', 'ik', 'im', 'in', 'ing', 'ip', 'it', 'iu', 'o', 'oe', 'oek', 'oeng', 'oi', 'ok', 'ong', 'ou', 'uk', 'ung', 'ut'],
  // l + finals
  'l': ['aa', 'aai', 'aak', 'aan', 'aang', 'aat', 'ai', 'ak', 'am', 'an', 'ang', 'ap', 'at', 'e', 'ei', 'ek', 'eng', 'eoi', 'eon', 'eot', 'ik', 'im', 'in', 'ing', 'ip', 'it', 'iu', 'o', 'oe', 'oek', 'oeng', 'oi', 'ok', 'ong', 'ou', 'uk', 'ung', 'ut'],
  // g + finals
  'g': ['aa', 'aai', 'aak', 'aan', 'aang', 'aat', 'ai', 'ak', 'am', 'an', 'ang', 'ap', 'at', 'e', 'ei', 'ek', 'eng', 'eoi', 'eon', 'eot', 'ik', 'im', 'in', 'ing', 'ip', 'it', 'iu', 'o', 'oe', 'oek', 'oeng', 'oi', 'ok', 'ong', 'ou', 'uk', 'ung', 'ut'],
  // k + finals
  'k': ['aa', 'aai', 'aak', 'aan', 'aang', 'aat', 'ai', 'ak', 'am', 'an', 'ang', 'ap', 'at', 'e', 'ei', 'ek', 'eng', 'eoi', 'eon', 'eot', 'ik', 'im', 'in', 'ing', 'ip', 'it', 'iu', 'o', 'oe', 'oek', 'oeng', 'oi', 'ok', 'ong', 'ou', 'uk', 'ung', 'ut'],
  // ng + finals (limited)
  'ng': ['aa', 'aai', 'aak', 'aan', 'aang', 'aat', 'ai', 'ak', 'am', 'an', 'ang', 'ap', 'at'],
  // h + finals
  'h': ['aa', 'aai', 'aak', 'aan', 'aang', 'aat', 'ai', 'ak', 'am', 'an', 'ang', 'ap', 'at', 'e', 'ei', 'ek', 'eng', 'eoi', 'eon', 'eot', 'ik', 'im', 'in', 'ing', 'ip', 'it', 'iu', 'o', 'oe', 'oek', 'oeng', 'oi', 'ok', 'ong', 'ou', 'uk', 'ung', 'ut'],
  // gw + finals (limited)
  'gw': ['aa', 'aai', 'aak', 'aan', 'aang', 'aat', 'ai', 'ak', 'an', 'ang', 'at', 'o', 'ok', 'ong', 'u', 'ui', 'un', 'ung', 'ut', 'uk'],
  // kw + finals (limited)
  'kw': ['aa', 'aai', 'aak', 'aan', 'aang', 'aat', 'ai', 'ak', 'an', 'ang', 'at', 'o', 'ok', 'ong', 'u', 'ui', 'un', 'ung', 'ut', 'uk'],
  // w + finals
  'w': ['aa', 'aai', 'aak', 'aan', 'aang', 'aat', 'ai', 'ak', 'an', 'ang', 'at', 'e', 'ui', 'un', 'ut'],
  // z + finals
  'z': ['aa', 'aai', 'aak', 'aan', 'aang', 'aat', 'ai', 'ak', 'am', 'an', 'ang', 'ap', 'at', 'e', 'ei', 'ek', 'eng', 'eoi', 'eon', 'eot', 'ik', 'im', 'in', 'ing', 'ip', 'it', 'iu', 'o', 'oe', 'oek', 'oeng', 'oi', 'ok', 'ong', 'ou', 'uk', 'ung', 'ut'],
  // c + finals
  'c': ['aa', 'aai', 'aak', 'aan', 'aang', 'aat', 'ai', 'ak', 'am', 'an', 'ang', 'ap', 'at', 'e', 'ei', 'ek', 'eng', 'eoi', 'eon', 'eot', 'ik', 'im', 'in', 'ing', 'ip', 'it', 'iu', 'o', 'oe', 'oek', 'oeng', 'oi', 'ok', 'ong', 'ou', 'uk', 'ung', 'ut'],
  // s + finals
  's': ['aa', 'aai', 'aak', 'aan', 'aang', 'aat', 'ai', 'ak', 'am', 'an', 'ang', 'ap', 'at', 'e', 'ei', 'ek', 'eng', 'eoi', 'eon', 'eot', 'ik', 'im', 'in', 'ing', 'ip', 'it', 'iu', 'o', 'oe', 'oek', 'oeng', 'oi', 'ok', 'ong', 'ou', 'uk', 'ung', 'ut'],
  // j + finals
  'j': ['aa', 'aai', 'aak', 'aan', 'aang', 'aat', 'ai', 'ak', 'am', 'an', 'ang', 'ap', 'at', 'e', 'ei', 'ek', 'eng', 'eoi', 'eon', 'eot', 'ik', 'im', 'in', 'ing', 'ip', 'it', 'iu', 'o', 'oe', 'oek', 'oeng', 'oi', 'ok', 'ong', 'ou', 'uk', 'ung', 'ut']
};

/**
 * Check if an initial + final combination is valid in Jyutping
 * @param {string} initial - Initial consonant (can be null for standalone finals)
 * @param {string} final - Final
 * @returns {boolean}
 */
export function isValidInitialFinalCombination(initial, final) {
  if (!final) return false;
  
  // IMPORTANT: 'm' and 'ng' should NOT be used as finals
  // They should only be used as initials
  if (final === 'm' || final === 'ng') {
    return false;
  }
  
  // If no initial, check if final can stand alone
  // BUT: exclude 'm' and 'ng' as they should only be initials
  if (!initial) {
    if (final === 'm' || final === 'ng') {
      return false;
    }
    return canFinalStandalone(final);
  }
  
  const initialLower = initial.toLowerCase();
  const finalLower = final.toLowerCase();
  
  // Check if this combination exists in our valid combinations list
  if (VALID_COMBINATIONS[initialLower]) {
    // Check if the final (or a prefix of it) is in the list
    // This handles cases like "aang" matching "aang" or "aa"
    const compatibleFinals = VALID_COMBINATIONS[initialLower];
    return compatibleFinals.some(f => finalLower === f || finalLower.startsWith(f));
  }
  
  // If initial not in list, return false (strict validation)
  return false;
}

// All finals list for syllable parsing
const ALL_FINALS = [
  'aa', 'ai', 'aai', 'au', 'aau', 'am', 'aam', 'an', 'aan', 
  'ang', 'aang', 'ap', 'aap', 'at', 'aat', 'ak', 'aak', 
  'e', 'ei', 'eu', 'em', 'eng', 'ep', 'ek', 
  'i', 'iu', 'im', 'in', 'ing', 'ip', 'it', 'ik', 
  'o', 'oi', 'ou', 'on', 'ong', 'ot', 'ok', 
  'oe', 'oeng', 'oek', 
  'eoi', 'eon', 'eot', 
  'u', 'ui', 'un', 'ung', 'ut', 'uk', 
  'yu', 'yun', 'yut', 
  'm', 'ng'
];

/**
 * Extract the last complete syllable from Jyutping input
 * @param {string} input - Jyutping input
 * @returns {Object} { syllable: string, remaining: string } or null
 */
export function extractLastSyllable(input) {
  if (!input || input.length === 0) return null;
  
  const inputLower = input.toLowerCase();
  
  // Remove tone from the end if present
  const toneMatch = inputLower.match(/([0-6])$/);
  const hasTone = !!toneMatch;
  const tone = hasTone ? toneMatch[1] : '';
  const inputWithoutTone = hasTone ? inputLower.slice(0, -1) : inputLower;
  
  if (inputWithoutTone.length === 0) {
    // Only tone number, remove it
    return { syllable: tone, remaining: input.slice(0, -1) };
  }
  
  // Sort finals by length (longest first) to match longer finals first
  const sortedFinals = [...ALL_FINALS].sort((a, b) => b.length - a.length);
  
  // Try to find a final at the end of the input
  let matchedFinal = null;
  let finalStartIndex = -1;
  
  for (const final of sortedFinals) {
    const finalLower = final.toLowerCase();
    if (inputWithoutTone.endsWith(finalLower)) {
      matchedFinal = final;
      finalStartIndex = inputWithoutTone.length - finalLower.length;
      break;
    }
  }
  
  if (matchedFinal && finalStartIndex >= 0) {
    // Found a final, now check for initial before it
    const beforeFinal = inputWithoutTone.substring(0, finalStartIndex);
    
    if (beforeFinal.length === 0) {
      // No initial, just a standalone final
      const syllable = input.substring(finalStartIndex);
      const remaining = input.substring(0, finalStartIndex);
      return { syllable, remaining };
    }
    
    // Check for initial before the final
    // Try two-character initials first
    const twoCharInitials = ['gw', 'kw', 'ng'];
    for (const initial of twoCharInitials) {
      if (beforeFinal.endsWith(initial)) {
        const syllableStart = beforeFinal.length - initial.length;
        const syllable = input.substring(syllableStart);
        const remaining = input.substring(0, syllableStart);
        return { syllable, remaining };
      }
    }
    
    // Try single-character initials
    const singleCharInitials = ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 
                                'g', 'k', 'h', 'w', 'z', 'c', 's', 'j'];
    for (const initial of singleCharInitials) {
      if (beforeFinal.endsWith(initial)) {
        const syllableStart = beforeFinal.length - initial.length;
        const syllable = input.substring(syllableStart);
        const remaining = input.substring(0, syllableStart);
        return { syllable, remaining };
      }
    }
    
    // If no valid initial found, the final might be standalone
    // Return the final part
    const syllable = input.substring(finalStartIndex);
    const remaining = input.substring(0, finalStartIndex);
    return { syllable, remaining };
  }
  
  // If no final found, try to remove just the last character
  // This handles cases where user is typing mid-syllable
  return null;
}

