import React from 'react';
import { shallowMatchSnapshot } from '../../../common/test_utils';
import AdminPanel from './AdminPanel.component';

jest.mock('./AdminPanel.messages', () => {
  return {
    adminPanel: {
      id: 'cboard.components.Settings.AdminPanel.adminPanel',
      defaultMessage: 'Admin Panel'
    },
    email: {
      id: 'cboard.components.Settings.AdminPanel.email',
      defaultMessage: 'Email'
    },
    name: {
      id: 'cboard.components.Settings.AdminPanel.name',
      defaultMessage: 'Name'
    }
  };
});

jest.mock('../../../api', () => ({
  getAdminUsers: jest.fn(),
  getAdminUser: jest.fn(),
  updateAdminUser: jest.fn(),
  deleteAdminUser: jest.fn(),
  getAdminStatistics: jest.fn()
}));

const COMPONENT_PROPS = {
  onClose: jest.fn(),
  users: [],
  pagination: null,
  loading: false,
  statistics: null,
  onLoadUsers: jest.fn(),
  onLoadStatistics: jest.fn(),
  onUpdateUser: jest.fn(),
  onDeleteUser: jest.fn(),
  intl: {
    formatMessage: msg => msg.defaultMessage || msg.id
  },
  classes: {
    tableContainer: 'tableContainer',
    filterSection: 'filterSection',
    statsSection: 'statsSection',
    statCard: 'statCard',
    roleChip: 'roleChip',
    formControl: 'formControl'
  }
};

describe('AdminPanel tests', () => {
  test('default renderer', () => {
    shallowMatchSnapshot(<AdminPanel {...COMPONENT_PROPS} />);
  });

  test('renders with users', () => {
    const props = {
      ...COMPONENT_PROPS,
      users: [
        {
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          role: 'teacher',
          is_active: 1,
          created_at: '2024-01-01T00:00:00Z'
        }
      ],
      pagination: {
        total: 1,
        page: 1,
        limit: 20
      }
    };
    shallowMatchSnapshot(<AdminPanel {...props} />);
  });

  test('renders with statistics', () => {
    const props = {
      ...COMPONENT_PROPS,
      statistics: {
        total_users: 100,
        active_users: 80,
        total_profiles: 200,
        recent_registrations: 10
      }
    };
    shallowMatchSnapshot(<AdminPanel {...props} />);
  });

  test('renders loading state', () => {
    const props = {
      ...COMPONENT_PROPS,
      loading: true
    };
    shallowMatchSnapshot(<AdminPanel {...props} />);
  });
});

