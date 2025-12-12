import React from 'react';
import { shallowMatchSnapshot } from '../../../common/test_utils';
import LearningGames from './LearningGames.component';

jest.mock('./LearningGames.messages', () => {
  return {
    learningGames: {
      id: 'cboard.components.Settings.LearningGames.learningGames',
      defaultMessage: 'Learning Games'
    },
    spellingGame: {
      id: 'cboard.components.Settings.LearningGames.spellingGame',
      defaultMessage: 'Spelling Game'
    },
    matchingGame: {
      id: 'cboard.components.Settings.LearningGames.matchingGame',
      defaultMessage: 'Matching Game'
    }
  };
});

jest.mock('../../../api', () => ({
  getSpellingGame: jest.fn(),
  getMatchingGame: jest.fn(),
  submitGameResult: jest.fn()
}));

const COMPONENT_PROPS = {
  onClose: jest.fn(),
  loading: false,
  gameData: null,
  onStartGame: jest.fn(),
  onAnswerQuestion: jest.fn(),
  onSubmitGame: jest.fn(),
  intl: {
    formatMessage: msg => msg.defaultMessage || msg.id
  },
  classes: {
    tabPanel: 'tabPanel',
    gameCard: 'gameCard',
    questionCard: 'questionCard',
    optionButton: 'optionButton',
    scoreDisplay: 'scoreDisplay'
  }
};

describe('LearningGames tests', () => {
  test('default renderer', () => {
    shallowMatchSnapshot(<LearningGames {...COMPONENT_PROPS} />);
  });

  test('renders with game data', () => {
    const props = {
      ...COMPONENT_PROPS,
      gameData: {
        questions: [
          {
            character: '你',
            meaning: 'you',
            options: ['nei5', 'lei5', 'nei4', 'lei4'],
            correct_answer: 'nei5'
          }
        ]
      }
    };
    shallowMatchSnapshot(<LearningGames {...props} />);
  });

  test('renders loading state', () => {
    const props = {
      ...COMPONENT_PROPS,
      loading: true
    };
    shallowMatchSnapshot(<LearningGames {...props} />);
  });
});

