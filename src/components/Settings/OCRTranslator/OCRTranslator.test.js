import React from 'react';
import { shallowMatchSnapshot } from '../../../common/test_utils';
import OCRTranslator from './OCRTranslator.component';

jest.mock('./OCRTranslator.messages', () => {
  return {
    ocrTranslator: {
      id: 'cboard.components.Settings.OCRTranslator.ocrTranslator',
      defaultMessage: 'OCR Translator'
    },
    ocr: {
      id: 'cboard.components.Settings.OCRTranslator.ocr',
      defaultMessage: 'OCR'
    },
    history: {
      id: 'cboard.components.Settings.OCRTranslator.history',
      defaultMessage: 'History'
    }
  };
});

jest.mock('../../../api', () => ({
  recognizeImage: jest.fn(),
  convertToJyutping: jest.fn(),
  getOCRHistory: jest.fn(),
  deleteOCRHistory: jest.fn()
}));

const COMPONENT_PROPS = {
  onClose: jest.fn(),
  loading: false,
  ocrResult: null,
  translationHistory: [],
  onRecognizeImage: jest.fn(),
  onConvertToJyutping: jest.fn(),
  onGetHistory: jest.fn(),
  onDeleteHistory: jest.fn(),
  intl: {
    formatMessage: msg => msg.defaultMessage || msg.id
  },
  classes: {
    tabPanel: 'tabPanel',
    uploadArea: 'uploadArea',
    imagePreview: 'imagePreview',
    resultArea: 'resultArea'
  }
};

describe('OCRTranslator tests', () => {
  test('default renderer', () => {
    shallowMatchSnapshot(<OCRTranslator {...COMPONENT_PROPS} />);
  });

  test('renders with OCR result', () => {
    const props = {
      ...COMPONENT_PROPS,
      ocrResult: {
        recognized_text: '你好世界'
      }
    };
    shallowMatchSnapshot(<OCRTranslator {...props} />);
  });

  test('renders with translation history', () => {
    const props = {
      ...COMPONENT_PROPS,
      translationHistory: [
        {
          id: 1,
          recognized_text: '你好',
          created_at: '2024-01-01T00:00:00Z'
        }
      ]
    };
    shallowMatchSnapshot(<OCRTranslator {...props} />);
  });
});

