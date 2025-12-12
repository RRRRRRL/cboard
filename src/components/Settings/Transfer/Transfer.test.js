import React from 'react';
import { shallowMatchSnapshot } from '../../../common/test_utils';
import Transfer from './Transfer.component';

jest.mock('./Transfer.messages', () => {
  return {
    transfer: {
      id: 'cboard.components.Settings.Transfer.transfer',
      defaultMessage: 'Profile Transfer'
    },
    export: {
      id: 'cboard.components.Settings.Transfer.export',
      defaultMessage: 'Export'
    },
    import: {
      id: 'cboard.components.Settings.Transfer.import',
      defaultMessage: 'Import'
    }
  };
});

jest.mock('../../../api', () => ({
  exportProfile: jest.fn(),
  importProfile: jest.fn(),
  generateQRCode: jest.fn(),
  redeemQRToken: jest.fn(),
  generateCloudCode: jest.fn(),
  redeemCloudCode: jest.fn(),
  generateEmailTransfer: jest.fn()
}));

const COMPONENT_PROPS = {
  history: {
    goBack: jest.fn()
  },
  intl: {
    formatMessage: msg => msg.defaultMessage || msg.id
  },
  profiles: [
    { id: 1, name: 'Test Profile' }
  ],
  onExportProfile: jest.fn(),
  onImportProfile: jest.fn(),
  onGenerateQRCode: jest.fn(),
  onRedeemQRToken: jest.fn(),
  onGenerateCloudCode: jest.fn(),
  onRedeemCloudCode: jest.fn(),
  onGenerateEmailTransfer: jest.fn()
};

describe('Transfer tests', () => {
  test('default renderer', () => {
    shallowMatchSnapshot(<Transfer {...COMPONENT_PROPS} />);
  });

  test('renders with profiles', () => {
    const props = {
      ...COMPONENT_PROPS,
      profiles: [
        { id: 1, name: 'Profile 1' },
        { id: 2, name: 'Profile 2' }
      ]
    };
    shallowMatchSnapshot(<Transfer {...props} />);
  });
});

