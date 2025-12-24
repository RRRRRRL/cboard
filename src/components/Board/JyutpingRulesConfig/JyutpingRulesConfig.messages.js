import { defineMessages } from 'react-intl';

export default defineMessages({
  title: {
    id: 'cboard.components.Board.JyutpingRulesConfig.title',
    defaultMessage: 'Jyutping Matching Rules Configuration'
  },
  matchingRules: {
    id: 'cboard.components.Board.JyutpingRulesConfig.matchingRules',
    defaultMessage: 'Matching Rules'
  },
  exceptionRules: {
    id: 'cboard.components.Board.JyutpingRulesConfig.exceptionRules',
    defaultMessage: 'Exception Rules'
  },
  enableMatchingRules: {
    id: 'cboard.components.Board.JyutpingRulesConfig.enableMatchingRules',
    defaultMessage: 'Enable Custom Matching Rules'
  },
  frequencyThreshold: {
    id: 'cboard.components.Board.JyutpingRulesConfig.frequencyThreshold',
    defaultMessage: 'Frequency Threshold'
  },
  frequencyThresholdHelp: {
    id: 'cboard.components.Board.JyutpingRulesConfig.frequencyThresholdHelp',
    defaultMessage: 'Minimum word frequency to include in matching (higher = more common words only)'
  },
  allowExactMatch: {
    id: 'cboard.components.Board.JyutpingRulesConfig.allowExactMatch',
    defaultMessage: 'Allow Exact Match'
  },
  allowSubstringMatch: {
    id: 'cboard.components.Board.JyutpingRulesConfig.allowSubstringMatch',
    defaultMessage: 'Allow Substring Match'
  },
  allowSingleCharMatch: {
    id: 'cboard.components.Board.JyutpingRulesConfig.allowSingleCharMatch',
    defaultMessage: 'Allow Single Character Match'
  },
  requireAICorrection: {
    id: 'cboard.components.Board.JyutpingRulesConfig.requireAICorrection',
    defaultMessage: 'Require AI Correction for Low Confidence'
  },
  aiConfidenceThreshold: {
    id: 'cboard.components.Board.JyutpingRulesConfig.aiConfidenceThreshold',
    defaultMessage: 'AI Confidence Threshold'
  },
  aiConfidenceThresholdHelp: {
    id: 'cboard.components.Board.JyutpingRulesConfig.aiConfidenceThresholdHelp',
    defaultMessage: 'Minimum confidence (0.0-1.0) to trigger AI correction'
  },
  exceptionRulesHelp: {
    id: 'cboard.components.Board.JyutpingRulesConfig.exceptionRulesHelp',
    defaultMessage: 'Enable or disable specific matching rules for this student'
  },
  save: {
    id: 'cboard.components.Board.JyutpingRulesConfig.save',
    defaultMessage: 'Save'
  },
  cancel: {
    id: 'cboard.components.Board.JyutpingRulesConfig.cancel',
    defaultMessage: 'Cancel'
  },
  saveError: {
    id: 'cboard.components.Board.JyutpingRulesConfig.saveError',
    defaultMessage: 'Failed to save rules. Please try again.'
  },
  phonologicalRules: {
    id: 'cboard.components.Board.JyutpingRulesConfig.phonologicalRules',
    defaultMessage: 'Phonological Adaptation Rules'
  },
  phonologicalRulesHelp: {
    id: 'cboard.components.Board.JyutpingRulesConfig.phonologicalRulesHelp',
    defaultMessage: 'These rules adapt "standard Jyutping" to the student\'s actual speech and phonological level.'
  },
  mergeNngFinals: {
    id: 'cboard.components.Board.JyutpingRulesConfig.mergeNngFinals',
    defaultMessage: 'Merge -n and -ng finals (e.g., san matches sang)'
  },
  allowCodaSimplification: {
    id: 'cboard.components.Board.JyutpingRulesConfig.allowCodaSimplification',
    defaultMessage: 'Allow coda simplification (-t and -k interchangeable)'
  },
  ignoreTones: {
    id: 'cboard.components.Board.JyutpingRulesConfig.ignoreTones',
    defaultMessage: 'Ignore tones completely (for beginners)'
  },
  allowFuzzyTones: {
    id: 'cboard.components.Board.JyutpingRulesConfig.allowFuzzyTones',
    defaultMessage: 'Allow fuzzy tones (e.g., 2↔5, 3↔6)'
  },
  fuzzyTonePairs: {
    id: 'cboard.components.Board.JyutpingRulesConfig.fuzzyTonePairs',
    defaultMessage: 'Fuzzy Tone Pairs'
  },
  fuzzyTonePairsHelp: {
    id: 'cboard.components.Board.JyutpingRulesConfig.fuzzyTonePairsHelp',
    defaultMessage: 'Format: tone1,tone2|tone3,tone4 (e.g., 2,5|3,6)'
  },
  allowNgZeroConfusion: {
    id: 'cboard.components.Board.JyutpingRulesConfig.allowNgZeroConfusion',
    defaultMessage: 'Allow ng-zero initial confusion (ng- and zero initial match)'
  },
  allowNLConfusion: {
    id: 'cboard.components.Board.JyutpingRulesConfig.allowNLConfusion',
    defaultMessage: 'Allow n/l confusion (l matches n syllables and vice versa)'
  }
});

