import React from 'react';
import { shallowMatchSnapshot } from '../../../common/test_utils';
import AIFeatures from './AIFeatures.component';

jest.mock('./AIFeatures.messages', () => {
  return {
    aiFeatures: {
      id: 'cboard.components.Settings.AIFeatures.aiFeatures',
      defaultMessage: 'AI Features'
    },
    cardSuggestions: {
      id: 'cboard.components.Settings.AIFeatures.cardSuggestions',
      defaultMessage: 'Card Suggestions'
    },
    typingPrediction: {
      id: 'cboard.components.Settings.AIFeatures.typingPrediction',
      defaultMessage: 'Typing Prediction'
    }
  };
});

jest.mock('../../../api', () => ({
  getAISuggestions: jest.fn(),
  getTypingPredictions: jest.fn(),
  getLearningStats: jest.fn()
}));

const COMPONENT_PROPS = {
  onClose: jest.fn(),
  profiles: [
    { id: 1, name: 'Test Profile' }
  ],
  loading: false,
  suggestions: [],
  predictions: [],
  learningStats: null,
  onGetSuggestions: jest.fn(),
  onGetPredictions: jest.fn(),
  onGetLearningStats: jest.fn(),
  intl: {
    formatMessage: msg => msg.defaultMessage || msg.id
  },
  classes: {
    tabPanel: 'tabPanel',
    formControl: 'formControl',
    suggestionCard: 'suggestionCard',
    predictionChip: 'predictionChip'
  }
};

describe('AIFeatures tests', () => {
  test('default renderer', () => {
    shallowMatchSnapshot(<AIFeatures {...COMPONENT_PROPS} />);
  });

  test('renders with suggestions', () => {
    const props = {
      ...COMPONENT_PROPS,
      suggestions: [
        { id: 1, title: 'Hello', category: 'Greetings' },
        { id: 2, title: 'Goodbye', category: 'Greetings' }
      ]
    };
    shallowMatchSnapshot(<AIFeatures {...props} />);
  });

  test('renders with predictions', () => {
    const props = {
      ...COMPONENT_PROPS,
      predictions: [
        { text: 'hello', confidence: 0.9 },
        { text: 'help', confidence: 0.8 }
      ]
    };
    shallowMatchSnapshot(<AIFeatures {...props} />);
  });

  test('renders with learning stats', () => {
    const props = {
      ...COMPONENT_PROPS,
      learningStats: {
        total_cards: 100,
        total_attempts: 500,
        avg_accuracy: 85.5,
        avg_difficulty: 2.3
      }
    };
    shallowMatchSnapshot(<AIFeatures {...props} />);
  });
});

