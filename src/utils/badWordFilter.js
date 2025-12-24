/**
 * Bad Word Filter for Jyutping Keyboard
 * Filters inappropriate words from suggestions and output
 */

// List of inappropriate words in Chinese (both Traditional and Simplified)
// Single characters only - any word containing these characters will be filtered
// Using Set to automatically prevent duplicates and infinite loops
const BAD_WORDS_SET = new Set([
  // User's original single characters
  '撚',
  '屌',
  '閪',
  '柒',
  '老母',
  '老味',
  '鳩',
  '戇',
  '仆',
  '冚',
  '屄',
  '肏',
  '頂你個肺',
  
]);

// Convert Set to Array for iteration (automatically removes duplicates)
const BAD_WORDS = Array.from(BAD_WORDS_SET);

/**
 * Check if a word contains inappropriate content
 * @param {string} word - Word to check (can be hanzi, word, or jyutping)
 * @returns {boolean} True if word is inappropriate
 */
export function isBadWord(word) {
  if (!word || typeof word !== 'string') return false;
  
  const wordLower = word.toLowerCase().trim();
  
  // Check against bad words list
  for (const badWord of BAD_WORDS) {
    if (wordLower.includes(badWord.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

/**
 * Filter out bad words from an array of suggestions
 * @param {Array} suggestions - Array of suggestion objects
 * @returns {Array} Filtered array without bad words
 */
export function filterBadWords(suggestions) {
  if (!Array.isArray(suggestions)) return [];
  
  return suggestions.filter(suggestion => {
    const hanzi = (suggestion.hanzi || '').trim();
    const word = (suggestion.word || '').trim();
    
    // Check both hanzi and word fields
    if (hanzi && isBadWord(hanzi)) return false;
    if (word && isBadWord(word)) return false;
    
    return true;
  });
}

/**
 * Check if text output contains inappropriate content
 * @param {string} text - Text to check
 * @returns {boolean} True if text contains inappropriate content
 */
export function containsBadWords(text) {
  if (!text || typeof text !== 'string') return false;
  
  const words = text.split(/\s+/);
  for (const word of words) {
    if (isBadWord(word)) {
      return true;
    }
  }
  
  return false;
}
