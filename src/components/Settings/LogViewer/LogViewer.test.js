import React from 'react';
import { shallowMatchSnapshot } from '../../../common/test_utils';
import LogViewer from './LogViewer.component';

jest.mock('./LogViewer.messages', () => {
  return {
    logViewer: {
      id: 'cboard.components.Settings.LogViewer.logViewer',
      defaultMessage: 'Action Log Viewer'
    },
    profile: {
      id: 'cboard.components.Settings.LogViewer.profile',
      defaultMessage: 'Profile'
    },
    actionType: {
      id: 'cboard.components.Settings.LogViewer.actionType',
      defaultMessage: 'Action Type'
    }
  };
});

jest.mock('../../../api', () => ({
  getLogs: jest.fn(),
  exportLogs: jest.fn()
}));

const COMPONENT_PROPS = {
  onClose: jest.fn(),
  profiles: [],
  logs: [],
  pagination: null,
  loading: false,
  onLoadLogs: jest.fn(),
  onExportLogs: jest.fn(),
  intl: {
    formatMessage: msg => msg.defaultMessage || msg.id
  },
  classes: {
    tableContainer: 'tableContainer',
    filterSection: 'filterSection',
    formControl: 'formControl',
    exportButton: 'exportButton'
  }
};

describe('LogViewer tests', () => {
  test('default renderer', () => {
    shallowMatchSnapshot(<LogViewer {...COMPONENT_PROPS} />);
  });

  test('renders with logs', () => {
    const props = {
      ...COMPONENT_PROPS,
      logs: [
        {
          id: 1,
          profile_id: 1,
          profile_name: 'Test Profile',
          action_type: 'card_click',
          card_id: 1,
          card_title: 'Hello',
          created_at: '2024-01-01T00:00:00Z',
          metadata: {}
        }
      ],
      pagination: {
        total: 1,
        page: 1,
        limit: 100
      }
    };
    shallowMatchSnapshot(<LogViewer {...props} />);
  });

  test('renders with profiles', () => {
    const props = {
      ...COMPONENT_PROPS,
      profiles: [
        { id: 1, name: 'Profile 1' },
        { id: 2, name: 'Profile 2' }
      ]
    };
    shallowMatchSnapshot(<LogViewer {...props} />);
  });
});

