import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { injectIntl, FormattedMessage } from 'react-intl';
import IconButton from '@material-ui/core/IconButton';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import ShareIcon from '@material-ui/icons/Share';
import VolumeUpIcon from '@material-ui/icons/VolumeUp';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';

import JyutpingTextEditor from './JyutpingTextEditor';
import JyutpingKeyboardLayout from './JyutpingKeyboardLayout';
import WordSuggestions from './WordSuggestions';
import API from '../../api/api';
import messages from './JyutpingKeyboard.messages';
import {
  validateJyutpingInput,
  removeTone,
  extractInitial,
  canFinalStandalone,
  isValidInitialFinalCombination,
  extractLastSyllable
} from '../../utils/jyutpingValidation';
import { filterBadWords } from '../../utils/badWordFilter';
import './JyutpingKeyboard.css';

const LAYOUT_TYPES = {
  JYUTPING_1: 'jyutping1',
  JYUTPING_2: 'jyutping2',
  QWERTY: 'qwerty',
  NUMERIC: 'numeric'
};

class JyutpingKeyboard extends Component {
  static propTypes = {
    open: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    intl: PropTypes.object.isRequired
  };

  static defaultProps = {
    open: false
  };

  constructor(props) {
    super(props);
    this.state = {
      currentLayout: LAYOUT_TYPES.JYUTPING_1,
      jyutpingInput: '',
      textOutput: '',
      jyutpingOutput: '', // Display Jyutping pronunciation below text output
      suggestions: [],
      relatedWords: [], // Related word suggestions
      isSearching: false,
      isTranslating: false,
      isPlayingAudio: false,
      validationError: null,
      lastSelectedWord: null, // Track last selected word for related suggestions
      isMobile: window.innerWidth <= 566,
      // Voice & playback settings for batch pronunciation (4.4.6)
      speechProfile: 'cantonese_1',
      speechRate: 1.0
    };
    this.searchTimeout = null;
    this.relatedWordsTimeout = null; // Debounce timer for related words when output box changes
    this.audioCache = new Map();
    this.handleResize = this.handleResize.bind(this);
  }

  componentDidMount() {
    window.addEventListener('resize', this.handleResize);
    this.handleResize(); // Initial check
    // Load common words when interface opens
    this.loadCommonWords();

    // Load voices when component mounts (voices may not be available immediately)
    if ('speechSynthesis' in window) {
      // Some browsers need voices to be loaded
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.addEventListener('voiceschanged', () => {
          // Force re-render to update voice options
          this.forceUpdate();
        });
      }
    }
  }

  loadCommonWords = async () => {
    try {
      // Load common daily usage words (high frequency words)
      const response = await API.getJyutpingSuggestions('', 20);
      if (response && response.suggestions) {
        // Filter and sort by frequency
        const commonWords = response.suggestions
          .filter(s => s.frequency && s.frequency > 0)
          .sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
          .slice(0, 15);

        // Remove duplicates
        const uniqueWords = [];
        const seen = new Set();
        for (const word of commonWords) {
          const key = (word.hanzi || word.word || '').trim();
          if (key && !seen.has(key)) {
            seen.add(key);
            uniqueWords.push(word);
          }
        }

        this.setState({ suggestions: uniqueWords });
      }
    } catch (error) {
      console.error('Error loading common words:', error);
    }
  }

  // Translate text output to Jyutping - database first, AI fallback
  translateTextOutput = async (text) => {
    if (!text || text.trim().length === 0) {
      this.setState({ jyutpingOutput: '', isTranslating: false });
      return;
    }

    this.setState({ isTranslating: true });

    try {
      // First try database translation
      const dbResult = await API.translateToJyutping(text.trim());

      if (dbResult && dbResult.jyutping && dbResult.coverage > 0) {
        // Database translation successful
        this.setState({
          jyutpingOutput: dbResult.jyutping,
          isTranslating: false
        });
        return;
      }

      // If database doesn't have full coverage, try AI fallback

      // For AI fallback, we'll use the AI helper to get Jyutping predictions
      // This is a simplified approach - in production you'd want more sophisticated AI integration
      const aiResult = await this.getAIJyutpingFallback(text.trim());

      this.setState({
        jyutpingOutput: aiResult || 'Translation unavailable',
        isTranslating: false
      });

    } catch (error) {
      console.error('Translation error:', error);
      this.setState({
        jyutpingOutput: 'Translation error',
        isTranslating: false
      });
    }
  }

  // AI fallback for Jyutping translation when database doesn't have matches
  getAIJyutpingFallback = async (text) => {
    try {
      const characters = text.split('');
      const jyutpingParts = [];

      // For multi-character text, process character by character to ensure complete translation
      for (const char of characters) {
        // First try database lookup for individual character
        try {
          const dbResult = await API.translateToJyutping(char);
          if (dbResult && dbResult.jyutping) {
            jyutpingParts.push(dbResult.jyutping);
          } else {
            // Try AI prediction for single character
            const aiResult = await API.getJyutpingPredictions(char, 1);
            if (aiResult && aiResult.predictions && aiResult.predictions.length > 0) {
              jyutpingParts.push(aiResult.predictions[0].jyutping_code || aiResult.predictions[0].jyutping);
            } else {
              jyutpingParts.push('?'); // Still unknown
            }
          }
        } catch (error) {
          jyutpingParts.push('?'); // Error
        }
      }

      const result = jyutpingParts.join(' ');

      // If we got a complete result (no ? marks), return it
      if (!result.includes('?') && jyutpingParts.length === characters.length) {
        return result;
      }

      // If we have ? marks, try AI prediction for the full text as a last resort
      // Sometimes AI works better for full phrases
      try {
        const fullTextResult = await API.getJyutpingPredictions(text, 1);
        if (fullTextResult && fullTextResult.predictions && fullTextResult.predictions.length > 0) {
          const aiPrediction = fullTextResult.predictions[0].jyutping_code || fullTextResult.predictions[0].jyutping;
          if (aiPrediction && !aiPrediction.includes('?')) {
            return aiPrediction;
          }
        }
      } catch (error) {
        // Ignore AI full-text prediction errors
      }

      // Return character-by-character result even if it has ? marks
      return result;

    } catch (error) {
      console.error('AI fallback error:', error);
      return text.split('').map(() => '?').join(' '); // Return ? for each character
    }
  }

  handleResize = () => {
    const isMobile = window.innerWidth <= 566;
    if (this.state.isMobile !== isMobile) {
      this.setState({ isMobile });
    }
  };

  componentWillUnmount() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    if (this.relatedWordsTimeout) {
      clearTimeout(this.relatedWordsTimeout);
    }
    window.removeEventListener('resize', this.handleResize);
  }

  // Voice profiles for batch playback & key feedback (4.4.6)
  resolveSpeechProfile = profileKey => {
    // Get available voices from browser
    const voices = window.speechSynthesis?.getVoices() || [];

    // Find Cantonese/Hong Kong voices - prioritize different voices
    const cantoneseVoices = voices.filter(v =>
      v.lang.toLowerCase().includes('hk') ||
      v.lang.toLowerCase().includes('zh') ||
      v.name.toLowerCase().includes('cantonese') ||
      v.name.toLowerCase().includes('hong kong')
    );

    // Try to find distinct voices by name (some browsers have multiple HK voices)
    // Sort by name to get consistent ordering
    const sortedVoices = [...cantoneseVoices].sort((a, b) => a.name.localeCompare(b.name));

    // Get unique voices (by name) to ensure different voices for each profile
    const uniqueVoices = [];
    const seenNames = new Set();
    for (const voice of sortedVoices) {
      if (!seenNames.has(voice.name)) {
        seenNames.add(voice.name);
        uniqueVoices.push(voice);
      }
    }

    // If we have multiple unique voices, use them; otherwise use pitch to differentiate
    const voice1 = uniqueVoices[0] || cantoneseVoices[0];
    const voice2 = uniqueVoices[1] || uniqueVoices[0] || cantoneseVoices[0];
    const voice3 = uniqueVoices[2] || uniqueVoices[1] || uniqueVoices[0] || cantoneseVoices[0];

    const PROFILES = {
      cantonese_1: {
        lang: 'zh-HK',
        pitch: 1.0,
        voiceURI: voice1?.voiceURI || null,
        voiceName: voice1?.name || null,
        voice: voice1 || null
      },
      cantonese_2: {
        lang: 'zh-HK',
        pitch: 0.8, // Lower pitch for different voice
        voiceURI: voice2?.voiceURI || null,
        voiceName: voice2?.name || null,
        voice: voice2 || null
      },
      cantonese_3: {
        lang: 'zh-HK',
        pitch: 1.2, // Higher pitch for different voice
        voiceURI: voice3?.voiceURI || null,
        voiceName: voice3?.name || null,
        voice: voice3 || null
      },
      mandarin: { lang: 'zh-CN', pitch: 1.0 },
      english_female: { lang: 'en-US', pitch: 1.2 },
      english_male: { lang: 'en-US', pitch: 0.9 }
    };
    return PROFILES[profileKey] || PROFILES.cantonese_1;
  };

  handleLayoutChange = (event, newValue) => {
    this.setState({ currentLayout: newValue });
  };

  handleKeyPress = async key => {
    const { jyutpingInput } = this.state;
    const newInput = jyutpingInput + key;

    // Validate input with strict matching rules
    const validation = validateJyutpingInput(newInput);

    if (!validation.isValid) {
      this.setState({
        validationError: validation.error,
        jyutpingInput: newInput // Still allow typing, but show error
      });
      return;
    }

    this.setState({
      jyutpingInput: newInput,
      validationError: null
    });

    // Play audio for the key
    await this.playKeyAudio(key);

    // Search for matches immediately (no debounce for better UX)
    // Show all suggestions - let user choose manually
    await this.searchJyutping(newInput);
  };


  searchJyutping = async code => {
    // If input is empty, show common words instead of clearing suggestions
    if (!code || code.length === 0) {
      // Load common words when input is empty
      await this.loadCommonWords();
      this.setState({ isSearching: false });
      return;
    }

    this.setState({ isSearching: true });

    try {
      // First, try exact / strict match search
      const response = await API.searchJyutping(code);
      const rules = response.rules || {}; // new

      // API returns {code, matches, match_type} format
      const matches = response.matches || [];
      const matchType = response.match_type || '';

      const variantsUsed = Array.isArray(response.variants_used)
        ? response.variants_used
        : [code];


      if (matches && matches.length > 0) {
        // Filter out matches without valid hanzi/word
        let validMatches = matches.filter(
          m => (m.hanzi && m.hanzi.trim()) || (m.word && m.word.trim())
        );
        // Valid matches found

        // Determine if we should apply strict matching
        // Strict matching: only show exact syllable matches (e.g., "baa" only shows "baa", not "baai")
        // Apply strict matching only if we have exact matches (match_type === 'exact' or 'tone_variant')
        // Normalize phonological variants for strict matching to mirror backend rules

        // Normalization functions to mirror backend phonological rules
        const normalizeNngFinal = base => {
          // Match something like [letters] + (an|ang) at the end
          const m = base.match(/^([a-z]+)(an|ang)$/);
          if (!m) return base;
          const stem = m[1];
          // We normalize to 'an' as canonical (backend does the same)
          return stem + 'an';
        };

        const normalizeTkFinal = base => {
          // Match something like [letters] + (at|ak) at the end
          const m = base.match(/^([a-z]+)(at|ak)$/);
          if (!m) return base;
          const stem = m[1];
          // We normalize to 'at' as canonical (backend does the same)
          return stem + 'at';
        };

        const normalizeNlInitial = base => {
          // Match something like (n|l) + [letters] at the start
          const m = base.match(/^(n|l)(.+)$/);
          if (!m) return base;
          const rest = m[2];
          // We normalize to 'n' as canonical (backend does the same)
          return 'n' + rest;
        };

        const normalizeNgZeroInitial = base => {
          // Match something like ng[letters] or just [letters] (zero initial)
          if (base.startsWith('ng')) {
            // Remove 'ng' prefix to normalize to zero initial
            return base.substring(2);
          }
          // For zero initial words, add 'ng' prefix for comparison
          // But since we're normalizing for strict matching, we need to check both forms
          return base; // Keep as-is for now, handle in comparison logic
        };

        // Get phonological rules from backend response
        const rules = response.rules || {};

        // Create normalization function that applies all enabled rules
        const normalizeBase = base => {
          let b = base;

          if (rules.merge_n_ng_finals) {
            b = normalizeNngFinal(b);
          }
          if (rules.allow_coda_simplification) {
            b = normalizeTkFinal(b);
          }
          if (rules.allow_n_l_confusion) {
            b = normalizeNlInitial(b);
          }
          if (rules.allow_ng_zero_confusion) {
            b = normalizeNgZeroInitial(b);
          }

          return b;
        };

        const baseInputRaw = removeTone((code || '').toLowerCase().trim());

        // Existing hard-coded equivalence (lei/nei) if you still want it
        const STATIC_EQUIV = {
          lei: ['nei'],
          nei: ['lei']
        };

        // Start with baseInputRaw and static equivalents
        const allowedBases = new Set([
          baseInputRaw,
          ...(STATIC_EQUIV[baseInputRaw] || [])
        ]);

        // Apply phonological normalization to input and allowed bases
        const normalizedInputBase = normalizeBase(baseInputRaw);
        const normalizedAllowedBases = new Set([
          normalizedInputBase,
          ...Array.from(allowedBases).map(b => normalizeBase(b))
        ]);

        // For ng/zero confusion, we need to check both forms
        if (rules.allow_ng_zero_confusion) {
          if (baseInputRaw.startsWith('ng')) {
            normalizedAllowedBases.add(baseInputRaw.substring(2)); // ngaa -> aa
          } else {
            normalizedAllowedBases.add('ng' + baseInputRaw); // aa -> ngaa
          }
        }

        const variantsSet = new Set(
          variantsUsed.map(v => removeTone((v || '').toLowerCase().trim()))
        );

        const hasExactMatches = validMatches.some(m => {
          const jy = (m.jyutping_code || m.jyutping || '').toLowerCase().trim();
          if (!jy) return false;
          const base = removeTone(jy);
          const normBase = normalizeBase(base);

          // Treat all variants as equivalent bases
          if (variantsSet.has(base) || variantsSet.has(normBase)) return true;

          return normalizedAllowedBases.has(normBase) || normalizedAllowedBases.has(base);
        });


        let filteredMatches;

        if (hasExactMatches && (matchType === 'exact' || matchType === 'tone_variant')) {
          filteredMatches = validMatches.filter(m => {
            const jy = (m.jyutping_code || m.jyutping || '').toLowerCase().trim();
            if (!jy) return false;
            const base = removeTone(jy);
            const normBase = normalizeBase(base);

            if (variantsSet.has(base) || variantsSet.has(normBase)) return true;

            if (normalizedAllowedBases.has(normBase)) return true;
            if (rules.allow_ng_zero_confusion && normalizedAllowedBases.has(base)) return true;

            return allowedBases.has(base);
          });
          // Strict matching applied with phonological normalization
        } else {
          // No exact matches or partial input: show all matches (including partial matches)
          // e.g., "ba" can show "baa", "baai", "baat", etc.
          filteredMatches = validMatches;
          // Partial matching applied, showing all matches
        }

        // Remove duplicates based on hanzi/word
        const uniqueMatches = [];
        const seen = new Set();
        for (const match of filteredMatches) {
          const key = (match.hanzi || match.word || '').trim();
          if (key && !seen.has(key)) {
            seen.add(key);
            uniqueMatches.push(match);
          }
        }

        // Filter out bad words
        const filteredUniqueMatches = filterBadWords(uniqueMatches);

        // 4.4.5: Word selection with priority ordering.
        // Sort by frequency/priority if provided by backend.
        uniqueMatches.sort((a, b) => {
          const aScore =
            (typeof a.priority === 'number' ? a.priority : 0) ||
            (typeof a.frequency === 'number' ? a.frequency : 0);
          const bScore =
            (typeof b.priority === 'number' ? b.priority : 0) ||
            (typeof b.frequency === 'number' ? b.frequency : 0);
          return bScore - aScore;
        });

        this.setState({
          suggestions: filteredUniqueMatches.slice(0, 15),
          isSearching: false
        });
      } else {
        // If no matches from search, try suggestions API
        // This handles cases like typing "nei" to show all "nei*" matches
        const suggestionsResponse = await API.getJyutpingSuggestions(code, 15);

        // API returns {input, suggestions, count} format
        const suggestions = suggestionsResponse.suggestions || [];

        if (suggestions && suggestions.length > 0) {
          // Filter out matches without valid hanzi/word
          let validSuggestions = suggestions.filter(
            m => (m.hanzi && m.hanzi.trim()) || (m.word && m.word.trim())
          );
          // Valid suggestions found

          // For suggestions API, we show all matches (partial matching)
          // since the input didn't have exact matches
          // e.g., "ba" can show "baa", "baai", "baat", etc.
          let filteredSuggestions = validSuggestions;

          // Remove duplicates
          const uniqueSuggestions = [];
          const seen = new Set();
          for (const suggestion of filteredSuggestions) {
            const key = (suggestion.hanzi || suggestion.word || '').trim();
            if (key && !seen.has(key)) {
              seen.add(key);
              uniqueSuggestions.push(suggestion);
            }
          }

          // Filter out bad words
          const filteredUniqueSuggestions = filterBadWords(uniqueSuggestions);

          filteredUniqueSuggestions.sort((a, b) => {
            const aScore =
              (typeof a.priority === 'number' ? a.priority : 0) ||
              (typeof a.frequency === 'number' ? a.frequency : 0);
            const bScore =
              (typeof b.priority === 'number' ? b.priority : 0) ||
              (typeof b.frequency === 'number' ? b.frequency : 0);
            return bScore - aScore;
          });

          this.setState({
            suggestions: filteredUniqueSuggestions.slice(0, 15),
            isSearching: false
          });
        } else {
          this.setState({ suggestions: [], isSearching: false });
        }
      }
    } catch (error) {
      console.error('Jyutping search error:', error);
      console.error('Error details:', error.response?.data || error.message);
      // Ensure we clear loading state and show empty suggestions on error
      this.setState({
        suggestions: [],
        isSearching: false
      });
    }
  };

  handleSuggestionSelect = async suggestion => {
    const hanzi =
      (suggestion.hanzi && suggestion.hanzi.trim()) ||
      (suggestion.word && suggestion.word.trim()) ||
      '';
    const jyutping = suggestion.jyutping_code || '';

    if (!hanzi) {
      // No valid hanzi, don't add anything
      return;
    }

    // Add to text output
    const { textOutput, lastSelectedWord } = this.state;

    // Check if the suggestion contains the last selected word
    // If so, only add the part that comes after it
    let textToAdd = hanzi;
    if (lastSelectedWord && lastSelectedWord.hanzi) {
      const lastWord = lastSelectedWord.hanzi.trim();
      // If suggestion starts with the last selected word, remove it
      if (hanzi.startsWith(lastWord)) {
        textToAdd = hanzi.substring(lastWord.length);
      }
      // Also check if suggestion contains the last word in the middle or end
      // and remove everything up to and including it
      const lastWordIndex = hanzi.indexOf(lastWord);
      if (lastWordIndex > 0) {
        // Last word is in the middle, take everything after it
        textToAdd = hanzi.substring(lastWordIndex + lastWord.length);
      } else if (lastWordIndex === 0 && hanzi.length > lastWord.length) {
        // Last word is at the start, take everything after it
        textToAdd = hanzi.substring(lastWord.length);
      }
    }

    // Also check if textOutput already ends with part of the suggestion
    // to avoid duplication
    if (textOutput && textOutput.trim()) {
      const outputEnd = textOutput.trim();
      // If suggestion starts with the end of output, remove that part
      if (textToAdd.startsWith(outputEnd)) {
        textToAdd = textToAdd.substring(outputEnd.length);
      }
      // Check if output ends with any part of the suggestion
      for (let i = 1; i <= Math.min(textToAdd.length, outputEnd.length); i++) {
        const suffix = textToAdd.substring(0, i);
        if (outputEnd.endsWith(suffix)) {
          textToAdd = textToAdd.substring(i);
        }
      }
    }

    // If nothing left to add, don't add anything
    if (!textToAdd || textToAdd.trim().length === 0) {
      return;
    }

    const newText = textOutput + textToAdd;

    this.setState({
      textOutput: newText,
      jyutpingInput: '', // Clear input after selection
      suggestions: [],
      lastSelectedWord: { hanzi, jyutping } // Store for related words
    });

    // Play audio for the selected character/word
    await this.playCharacterAudio(hanzi, jyutping);

    // Fetch related word suggestions based on the UPDATED output box content
    // Pass newText to ensure we use the latest output, not stale state
    await this.fetchRelatedWords(hanzi, jyutping, newText);

    // Log learning (if authenticated)
    try {
      await API.logJyutpingLearning({
        jyutping_code: jyutping,
        hanzi_expected: hanzi,
        hanzi_selected: hanzi,
        profile_id: null
      });
    } catch (error) {
      // Silently fail if not authenticated
    }
  };

  handleBackspace = async () => {
    const { jyutpingInput, textOutput } = this.state;

    if (jyutpingInput.length > 0) {
      let newInput = jyutpingInput;

      // 1) 如果最后一个字符是声调数字，只删除声调
      const lastChar = jyutpingInput.slice(-1);
      if (/[0-9]/.test(lastChar)) {
        newInput = jyutpingInput.slice(0, -1);
      } else {
        // 2) 基于最后一个完整音节进行删除（先删除韵母，再删除声母）
        const lastSyllable = extractLastSyllable(jyutpingInput);

        if (lastSyllable && lastSyllable.syllable) {
          const syllable = lastSyllable.syllable;
          const remaining = lastSyllable.remaining;

          // 分离声调
          const toneMatch = syllable.match(/([0-9])$/);
          const hasTone = !!toneMatch;
          const core = hasTone ? syllable.slice(0, -1) : syllable;

          // 提取该音节的声母
          const initial = extractInitial(core);
          let newSyllable = '';

          if (hasTone) {
            // 先只删声调，保留声母+韵母
            newSyllable = core;
          } else if (initial) {
            // 有声母：initial 之后的就是韵母部分
            const finalPart = core.slice(initial.length);
            if (finalPart && finalPart.length > 0) {
              // 删除整个韵母，只保留声母
              newSyllable = initial;
            } else {
              // 只剩声母，再按一次就删掉整个音节
              newSyllable = '';
            }
          } else {
            // 无声母（独立韵母），直接删掉这个音节
            newSyllable = '';
          }

          newInput = remaining + newSyllable;
        } else {
          // 解析失败时，退回到删除最后一个字符
          newInput = jyutpingInput.slice(0, -1);
        }
      }

      this.setState({ jyutpingInput: newInput });

      // Immediately search for updated suggestions
      await this.searchJyutping(newInput);
    } else if (textOutput.length > 0) {
      // Remove last character from output and update translation
      const newText = textOutput.slice(0, -1);
      this.setState({ textOutput: newText });

      // Update translation for the new text
      this.translateTextOutput(newText);
    }
  };

  handleClear = () => {
    this.setState({
      jyutpingInput: '',
      textOutput: '',
      jyutpingOutput: '',
      suggestions: []
    });
  };

  handleSpace = () => {
    const { textOutput } = this.state;
    this.setState({ textOutput: textOutput + ' ' });
  };

  handleEnter = async () => {
    const { jyutpingInput, textOutput } = this.state;

    // If there's jyutping input, perform strict match and add to output
    if (jyutpingInput && jyutpingInput.trim()) {
      try {
        // Perform strict exact match search
        const response = await API.searchJyutping(jyutpingInput.trim());
        const matches = response.matches || [];

        // Filter for exact match only (strict matching)
        const exactMatches = matches.filter(m => {
          const jy = (m.jyutping_code || m.jyutping || '').toLowerCase().trim();
          return jy === jyutpingInput.toLowerCase().trim();
        });

        // If exact match found, add the first one to output
        if (exactMatches.length > 0) {
          const match = exactMatches[0];
          const hanzi = (match.hanzi || match.word || '').trim();
          if (hanzi) {
            const newText = textOutput + hanzi;
            this.setState({
              textOutput: newText,
              jyutpingInput: '', // Clear input
              suggestions: [] // Clear suggestions
            });

            // Play audio for the selected character
            await this.playCharacterAudio(hanzi, match.jyutping_code || '');

            // Fetch related words based on the UPDATED output box content
            await this.fetchRelatedWords(hanzi, match.jyutping_code || '', newText);

            return; // Don't add newline
          }
        }

        // If no exact match, clear input but don't add anything
        this.setState({
          jyutpingInput: '',
          suggestions: []
        });
      } catch (error) {
        console.error('Strict match error:', error);
        // On error, just clear input
        this.setState({
          jyutpingInput: '',
          suggestions: []
        });
      }
    } else {
      // No input, add newline
      this.setState({ textOutput: textOutput + '\n' });
    }
  };

  /**
   * 4.4.1 / 4.4.2
   * Disable vowel/diphthong/final keys only when they cannot form valid combinations.
   * A final is enabled if:
   * 1. It can stand alone (like 'm', 'ng', 'aa', etc.), OR
   * 2. There's an initial in the current input that can combine with it
   */
  getDisabledKeysForLayout = (layoutType, jyutpingInput) => {
    // Apply rule only for Jyutping‑specific layouts; QWERTY / numeric remain free
    if (
      layoutType !== LAYOUT_TYPES.JYUTPING_1 &&
      layoutType !== LAYOUT_TYPES.JYUTPING_2
    ) {
      return new Set();
    }

    const disabledKeys = new Set();

    // Valid initials (19 only): b, p, m, f, d, t, n, l, g, k, ng, h, gw, kw, w, z, c, s, j
    const VALID_INITIALS = new Set([
      'b', 'p', 'm', 'f', 'd', 't', 'n', 'l',
      'g', 'k', 'ng', 'h', 'gw', 'kw', 'w',
      'z', 'c', 's', 'j'
    ]);

    // All possible finals in the keyboard layouts
    // Note: 'm' and 'ng' are also initials, so they should be handled separately
    const ALL_FINALS = [
      // Basic vowels
      'aa', 'a', 'e', 'i', 'o', 'u', 'yu', 'oe',
      // Diphthongs and compound finals
      'aai', 'ai', 'aau', 'au', 'aam', 'am', 'aan', 'an',
      'aang', 'ang', 'aap', 'ap', 'aat', 'at', 'aak', 'ak',
      'ei', 'eu', 'em', 'eng', 'ep', 'ek', // Fixed: em, eng, ep, ek
      'eoi', 'eon', 'eot', 'eok', // Fixed: eon
      'iu', 'im', 'in', 'ing', 'ip', 'it', 'ik',
      'oi', 'ou', 'on', 'ong', 'ot', 'ok',
      'ui', 'un', 'ung', 'ut', 'uk',
      'yun', 'yut',
      'oei', 'oen', 'oeng', 'oet', 'oek',
      // 'm' and 'ng' are handled separately as they can be both initials and finals
    ];

    // Tone numbers
    const TONE_NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

    // If input is empty, disable ALL finals (even those that can stand alone)
    // This ensures no finals are enabled at the start, even if they have word matches
    // BUT: 'm' and 'ng' are also initials, so they should remain enabled as initials
    if (!jyutpingInput || jyutpingInput.trim().length === 0) {
      for (const final of ALL_FINALS) {
        disabledKeys.add(final);
      }
      // 'm' and 'ng' are in ALL_FINALS, so they get disabled as finals
      // But we need to remove them from disabledKeys so they remain enabled as initials
      // The layout will check if they're in VALID_INITIALS and enable them accordingly
      disabledKeys.delete('m');
      disabledKeys.delete('ng');
      // Also disable tone numbers when input is empty
      for (const tone of TONE_NUMBERS) {
        disabledKeys.add(tone);
      }
      // Only enable valid initials when input is empty (including 'm' and 'ng' as initials)
      // We'll disable any keys that are not in VALID_INITIALS, ALL_FINALS, or TONE_NUMBERS
      // This is handled by the layout itself - we only need to disable finals and tones here
      return disabledKeys;
    }

    // Extract initial from current input
    const currentInitial = extractInitial(jyutpingInput);
    const inputWithoutTone = removeTone(jyutpingInput);
    const hasInitial = !!currentInitial;

    // Check if input already contains a final
    // We need to check if the input (after initial) matches any final
    // Sort finals by length (longest first) to match longer finals first (e.g., "aang" before "aa")
    const sortedFinals = [...ALL_FINALS].sort((a, b) => b.length - a.length);

    let hasFinal = false;
    let matchedFinal = null;
    let remainingAfterFinal = '';

    if (hasInitial && currentInitial) {
      const afterInitial = inputWithoutTone.substring(currentInitial.length).toLowerCase();
      // Check if what's after initial is a valid final (try longest matches first)
      for (const final of sortedFinals) {
        const finalLower = final.toLowerCase();
        if (afterInitial === finalLower) {
          hasFinal = true;
          matchedFinal = final;
          remainingAfterFinal = '';
          break;
        } else if (afterInitial.startsWith(finalLower)) {
          // Partial match - might be typing a longer final
          hasFinal = true;
          matchedFinal = final;
          remainingAfterFinal = afterInitial.substring(finalLower.length);
          break;
        }
      }
    } else {
      // No initial - check if input itself is a final or starts with a final
      const inputLower = inputWithoutTone.toLowerCase();
      for (const final of sortedFinals) {
        const finalLower = final.toLowerCase();
        if (inputLower === finalLower) {
          hasFinal = true;
          matchedFinal = final;
          remainingAfterFinal = '';
          break;
        } else if (inputLower.startsWith(finalLower)) {
          hasFinal = true;
          matchedFinal = final;
          remainingAfterFinal = inputLower.substring(finalLower.length);
          break;
        }
      }
    }

    if (hasFinal) {
      // If there's already a final
      if (remainingAfterFinal.length === 0) {
        // Final is complete - disable all other finals
        for (const final of ALL_FINALS) {
          if (final !== matchedFinal) {
            disabledKeys.add(final);
          }
        }
      } else {
        // There's remaining input - might be typing a longer final (e.g., "baa" -> "baai")
        // Only allow finals that start with the matched final
        for (const final of ALL_FINALS) {
          if (!final.toLowerCase().startsWith(matchedFinal.toLowerCase())) {
            disabledKeys.add(final);
          }
        }
      }
    } else {
      // No final yet - disable finals that can't form valid combinations with current initial
      // IMPORTANT: Always disable 'm' and 'ng' as finals - they should only be used as initials
      for (const final of ALL_FINALS) {
        // Always disable 'm' and 'ng' as finals
        if (final === 'm' || final === 'ng') {
          disabledKeys.add(final);
          continue;
        }
        if (!isValidInitialFinalCombination(currentInitial, final)) {
          disabledKeys.add(final);
        }
      }
    }

    // Disable tone numbers if there's no valid syllable yet (no final and no standalone final)
    // BUT: 'm' and 'ng' should NOT be considered as standalone finals when used as initials
    // They should only be enabled as initials, not as finals
    let hasValidSyllable = hasFinal;
    if (!hasFinal) {
      // Check if input is a standalone final, but exclude 'm' and 'ng' as finals
      // 'm' and 'ng' should only be used as initials, not as standalone finals
      const inputLower = inputWithoutTone.toLowerCase();
      if (inputLower !== 'm' && inputLower !== 'ng') {
        hasValidSyllable = canFinalStandalone(inputWithoutTone);
      }
    }
    if (!hasValidSyllable) {
      for (const tone of TONE_NUMBERS) {
        disabledKeys.add(tone);
      }
    }

    // After typing an initial, disable other initials until a final is selected
    // This prevents typing multiple initials in a row
    if (hasInitial && currentInitial && !hasFinal) {
      const allPossibleInitials = [
        'b', 'p', 'm', 'f', 'd', 't', 'n', 'l',
        'g', 'k', 'ng', 'h', 'gw', 'kw', 'w',
        'z', 'c', 's', 'j'
      ];

      for (const initial of allPossibleInitials) {
        // Don't disable the current initial or its continuation (for multi-char initials like gw, kw, ng)
        if (initial !== currentInitial &&
          !currentInitial.startsWith(initial) &&
          !initial.startsWith(currentInitial)) {
          disabledKeys.add(initial);
        }
      }
    }

    return disabledKeys;
  };

  handleSpeechProfileChange = event => {
    this.setState({ speechProfile: event.target.value });
  };

  handleSpeechRateChange = event => {
    const value = parseFloat(event.target.value);
    if (Number.isNaN(value)) return;
    this.setState({
      speechRate: Math.max(0.5, Math.min(2.0, value))
    });
  };

  playKeyAudio = async key => {
    // Stop any currently playing audio to avoid overlap
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Use browser's speech API directly for key audio
    // The backend audio endpoint is for future TTS integration
    if ('speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(key);
        const { speechProfile, speechRate } = this.state;
        const profile = this.resolveSpeechProfile(speechProfile);
        utterance.lang = profile.lang;
        utterance.rate = speechRate;
        utterance.pitch = profile.pitch;
        utterance.volume = 0.7; // Slightly quieter for key feedback

        // Set specific voice if available (for different Cantonese voices)
        // Priority: voice object > voiceURI > voiceName
        if (profile.voice) {
          utterance.voice = profile.voice;
        } else if (profile.voiceURI) {
          utterance.voiceURI = profile.voiceURI;
        } else if (profile.voiceName) {
          // Fallback: try to find voice by name
          const voices = window.speechSynthesis.getVoices();
          const voice = voices.find(v => v.name === profile.voiceName);
          if (voice) {
            utterance.voice = voice;
          }
        }

        // Play audio (non-blocking for key presses)
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error('Speech synthesis error:', error);
      }
    }

    // Optionally call backend for logging (non-blocking, don't wait)
    API.generateJyutpingAudio({
      text: key,
      jyutping: key,
      type: 'character'
    }).catch(() => {
      // Silently fail - audio playback already handled above
    });
  };

  playCharacterAudio = async (text, jyutping) => {
    // Stop any currently playing audio
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Use browser's speech API directly for character/word audio
    // The backend audio endpoint is for future TTS integration
    if ('speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        const { speechProfile, speechRate } = this.state;
        const profile = this.resolveSpeechProfile(speechProfile);
        utterance.lang = profile.lang;
        // Use global speechRate but clamp for clarity on words
        utterance.rate = Math.max(0.5, Math.min(2.0, speechRate));
        utterance.pitch = profile.pitch;
        utterance.volume = 1.0;

        // Set specific voice if available (for different Cantonese voices)
        // Priority: voice object > voiceURI > voiceName
        if (profile.voice) {
          utterance.voice = profile.voice;
        } else if (profile.voiceURI) {
          utterance.voiceURI = profile.voiceURI;
        } else if (profile.voiceName) {
          // Fallback: try to find voice by name
          const voices = window.speechSynthesis.getVoices();
          const voice = voices.find(v => v.name === profile.voiceName);
          if (voice) {
            utterance.voice = voice;
          }
        }

        // Wait for audio to finish before resolving
        await new Promise((resolve, reject) => {
          utterance.onend = resolve;
          utterance.onerror = reject;
          window.speechSynthesis.speak(utterance);
        });
      } catch (error) {
        console.error('Speech synthesis error:', error);
      }
    }

    // Optionally call backend for logging (non-blocking)
    try {
      await API.generateJyutpingAudio({
        text: text,
        jyutping: jyutping,
        type: 'word'
      });
    } catch (error) {
      // Silently fail - audio playback already handled above
    }
  };

  fetchRelatedWords = async (hanzi, jyutping, currentTextOutput = null) => {
    try {
      // Use the provided currentTextOutput (from output box) or fall back to state
      // This ensures we always use the LATEST output box content, not stale state
      // The output box is the source of truth for related word suggestions
      const textOutput = currentTextOutput !== null ? currentTextOutput : this.state.textOutput;
      const fullContext = textOutput.trim();

      // Call API with full context for ollama prediction
      // The backend will use the full context to predict logical next words
      // For example: "你想去" -> "邊", "去" -> "學校", "醫院", "屋企"
      const response = await API.getRelatedWords(hanzi, jyutping, fullContext);

      if (response && response.related_words && response.related_words.length > 0) {
        // Remove duplicates
        const uniqueWords = [];
        const seen = new Set();
        for (const word of response.related_words) {
          const key = (word.hanzi || word.word || '').trim();
          if (key && !seen.has(key)) {
            seen.add(key);
            uniqueWords.push(word);
          }
        }
        this.setState({ relatedWords: uniqueWords });
      } else {
        this.setState({ relatedWords: [] });
      }
    } catch (error) {
      console.error('Error fetching related words:', error);
      this.setState({ relatedWords: [] });
    }
  };

  handleBatchPronunciation = async () => {
    const { textOutput } = this.state;
    if (!textOutput) return;

    this.setState({ isPlayingAudio: true });

    try {
      // Play the complete sentence as a whole, not word by word
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(textOutput);
        const { speechProfile, speechRate } = this.state;
        const profile = this.resolveSpeechProfile(speechProfile);
        utterance.lang = profile.lang;
        utterance.rate = Math.max(0.5, Math.min(2.0, speechRate));
        utterance.pitch = profile.pitch;
        utterance.volume = 1.0;

        // Set specific voice if available (for different Cantonese voices)
        // Priority: voice object > voiceURI > voiceName
        if (profile.voice) {
          utterance.voice = profile.voice;
        } else if (profile.voiceURI) {
          utterance.voiceURI = profile.voiceURI;
        } else if (profile.voiceName) {
          // Fallback: try to find voice by name
          const voices = window.speechSynthesis.getVoices();
          const voice = voices.find(v => v.name === profile.voiceName);
          if (voice) {
            utterance.voice = voice;
          }
        }

        // Wait for audio to finish
        await new Promise((resolve, reject) => {
          utterance.onend = resolve;
          utterance.onerror = reject;
          window.speechSynthesis.speak(utterance);
        });
      }
    } catch (error) {
      console.error('Batch pronunciation error:', error);
    } finally {
      this.setState({ isPlayingAudio: false });
    }
  };

  handleShare = async () => {
    const { textOutput } = this.state;
    const { intl } = this.props;
    if (!textOutput) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: intl.formatMessage(messages.shareTitle),
          text: textOutput
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Share error:', error);
        }
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(textOutput);
        alert(intl.formatMessage(messages.textCopied));
      } catch (error) {
        console.error('Clipboard error:', error);
      }
    }
  };

  render() {
    const { open, onClose, intl } = this.props;
    const {
      currentLayout,
      jyutpingInput,
      textOutput,
      jyutpingOutput,
      suggestions,
      relatedWords,
      isSearching,
      isTranslating,
      isPlayingAudio,
      validationError,
      speechProfile,
      speechRate
    } = this.state;

    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        fullScreen={this.state.isMobile}
        className="JyutpingKeyboard__dialog"
      >
        <DialogTitle className="JyutpingKeyboard__header">
          <div className="JyutpingKeyboard__header-content">
            <IconButton
              onClick={onClose}
              className="JyutpingKeyboard__close-button"
            >
              <ArrowBackIcon />
            </IconButton>
            <span className="JyutpingKeyboard__title">
              <FormattedMessage {...messages.title} />
            </span>
            <div className="JyutpingKeyboard__actions">
              <IconButton
                onClick={this.handleShare}
                disabled={!textOutput}
                title={intl.formatMessage(messages.share)}
              >
                <ShareIcon />
              </IconButton>
            </div>
          </div>
        </DialogTitle>

        <DialogContent className="JyutpingKeyboard__content">
          {/* Text Editor */}
          <JyutpingTextEditor
            jyutpingInput={jyutpingInput}
            textOutput={textOutput}
            jyutpingOutput={jyutpingOutput}
            onClear={this.handleClear}
            onBackspace={this.handleBackspace}
            onTextChange={text => {
              this.setState({ textOutput: text });
              // Translate text output to Jyutping in real-time
              this.translateTextOutput(text);
              // Update related words based on the new output box content
              // Use debounce to avoid too many API calls while user is typing
              if (this.relatedWordsTimeout) {
                clearTimeout(this.relatedWordsTimeout);
              }
              this.relatedWordsTimeout = setTimeout(() => {
                // Use the complete output box content as context for related words
                // The backend will use the full context to predict next words
                const trimmed = text.trim();
                if (trimmed.length > 0) {
                  // Extract last Chinese word/character for hanzi parameter
                  // This helps backend understand what was just typed
                  const lastWordMatch = trimmed.match(/[\u4e00-\u9fff]+$/);
                  const lastWord = lastWordMatch ? lastWordMatch[0] : '';

                  // Fetch related words based on the COMPLETE output box content
                  // Pass the full text as context, and last word as hanzi
                  // Backend will use context as primary input for AI prediction
                  this.fetchRelatedWords(lastWord || '', '', trimmed);
                } else {
                  // Empty output, clear related words
                  this.setState({ relatedWords: [] });
                }
              }, 500); // 500ms debounce delay
            }}
            onPlayback={this.handleBatchPronunciation}
            validationError={validationError}
            isPlayingAudio={isPlayingAudio}
            isTranslating={isTranslating}
          />

          {/* Voice type + speed controls for batch playback */}
          <div className="JyutpingKeyboard__voice-controls">
            <div className="JyutpingKeyboard__voice-select">
              <label className="JyutpingKeyboard__voice-label">
                <FormattedMessage {...messages.voice} />:
                <select
                  value={speechProfile}
                  onChange={this.handleSpeechProfileChange}
                  className="JyutpingKeyboard__voice-select-input"
                >
                  <option value="cantonese_1">
                    {intl.formatMessage(messages.cantonese1)}
                  </option>
                  <option value="cantonese_2">
                    {intl.formatMessage(messages.cantonese2)}
                  </option>
                  <option value="cantonese_3">
                    {intl.formatMessage(messages.cantonese3)}
                  </option>
                  <option value="mandarin">
                    {intl.formatMessage(messages.mandarin)}
                  </option>
                  <option value="english_female">
                    {intl.formatMessage(messages.englishFemale)}
                  </option>
                  <option value="english_male">
                    {intl.formatMessage(messages.englishMale)}
                  </option>
                </select>
              </label>
            </div>
            <div className="JyutpingKeyboard__rate-control">
              <label className="JyutpingKeyboard__voice-label">
                <FormattedMessage {...messages.speed} />:
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={speechRate}
                  onChange={this.handleSpeechRateChange}
                  className="JyutpingKeyboard__rate-slider"
                />
                <span className="JyutpingKeyboard__rate-value">
                  {speechRate.toFixed(1)}x
                </span>
              </label>
            </div>
          </div>

          {/* Word Suggestions - Always show (handles empty state internally) */}
          <WordSuggestions
            suggestions={suggestions}
            onSelect={this.handleSuggestionSelect}
            isLoading={isSearching}
            title={intl.formatMessage(messages.suggestions)}
          />

          {/* Related Words Suggestions */}
          {relatedWords && relatedWords.length > 0 && (
            <WordSuggestions
              suggestions={relatedWords}
              onSelect={this.handleSuggestionSelect}
              isLoading={false}
              title={intl.formatMessage(messages.relatedWords)}
            />
          )}

          {/* Layout Tabs */}
          <Tabs
            value={currentLayout}
            onChange={this.handleLayoutChange}
            variant="scrollable"
            scrollButtons="auto"
            className="JyutpingKeyboard__tabs"
          >
            <Tab
              label={intl.formatMessage(messages.jyutping1)}
              value={LAYOUT_TYPES.JYUTPING_1}
            />
            <Tab
              label={intl.formatMessage(messages.jyutping2)}
              value={LAYOUT_TYPES.JYUTPING_2}
            />
            <Tab
              label={intl.formatMessage(messages.qwerty)}
              value={LAYOUT_TYPES.QWERTY}
            />
            <Tab
              label={intl.formatMessage(messages.numeric)}
              value={LAYOUT_TYPES.NUMERIC}
            />
          </Tabs>

          {/* Keyboard Layout */}
          <JyutpingKeyboardLayout
            layoutType={currentLayout}
            onKeyPress={this.handleKeyPress}
            onBackspace={this.handleBackspace}
            onSpace={this.handleSpace}
            onEnter={this.handleEnter}
            onClear={this.handleClear}
            // 4.4.1 / 4.4.2: Disable vowel/final keys until an initial consonant is selected
            disabledKeys={this.getDisabledKeysForLayout(currentLayout, jyutpingInput)}
          />
        </DialogContent>
      </Dialog>
    );
  }
}

export default injectIntl(JyutpingKeyboard);
