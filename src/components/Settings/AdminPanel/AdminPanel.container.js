import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { injectIntl } from 'react-intl';
import { showNotification } from '../../Notifications/Notifications.actions';
import AdminPanel from './AdminPanel.component';
import API from '../../../api';

export class AdminPanelContainer extends PureComponent {
  static propTypes = {
    history: PropTypes.object.isRequired,
    intl: PropTypes.object.isRequired,
    showNotification: PropTypes.func.isRequired,
    user: PropTypes.object
  };

  state = {
    users: [],
    pagination: null,
    loading: false,
    statistics: null
  };

  componentDidMount() {
    this.loadUsers();
    this.loadStatistics();
  }

  loadUsers = async (filters = {}) => {
    this.setState({ loading: true });
    try {
      const result = await API.getAdminUsers(filters);
      this.setState({ 
        users: result.users || [], 
        pagination: result.pagination || null 
      });
    } catch (error) {
      console.error('Load users error:', error);
      if (error.response?.status === 403) {
        this.props.showNotification(
          this.props.intl.formatMessage({ 
            id: 'cboard.components.Settings.AdminPanel.accessDenied', 
            defaultMessage: 'Admin access required' 
          })
        );
        this.props.history.goBack();
      } else {
        this.props.showNotification(
          this.props.intl.formatMessage({ 
            id: 'cboard.components.Settings.AdminPanel.loadError', 
            defaultMessage: 'Failed to load users' 
          })
        );
      }
    } finally {
      this.setState({ loading: false });
    }
  };

  loadStatistics = async () => {
    try {
      const result = await API.getAdminStatistics();
      this.setState({ statistics: result.statistics });
    } catch (error) {
      console.error('Load statistics error:', error);
    }
  };

  handleUpdateUser = async (userId, userData) => {
    try {
      await API.updateAdminUser(userId, userData);
      this.props.showNotification(
        this.props.intl.formatMessage({ 
          id: 'cboard.components.Settings.AdminPanel.updateSuccess', 
          defaultMessage: 'User updated successfully' 
        })
      );
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  };

  handleDeleteUser = async (userId) => {
    try {
      await API.deleteAdminUser(userId);
      this.props.showNotification(
        this.props.intl.formatMessage({ 
          id: 'cboard.components.Settings.AdminPanel.deleteSuccess', 
          defaultMessage: 'User deactivated successfully' 
        })
      );
    } catch (error) {
      console.error('Delete user error:', error);
      throw error;
    }
  };

  render() {
    const { history, intl } = this.props;
    const { users, pagination, loading, statistics } = this.state;

    return (
      <AdminPanel
        onClose={history.goBack}
        users={users}
        pagination={pagination}
        loading={loading}
        statistics={statistics}
        onLoadUsers={this.loadUsers}
        onLoadStatistics={this.loadStatistics}
        onUpdateUser={this.handleUpdateUser}
        onDeleteUser={this.handleDeleteUser}
        intl={intl}
      />
    );
  }
}

const mapStateToProps = state => ({
  user: state.app?.userData || null
});

const mapDispatchToProps = {
  showNotification
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(injectIntl(AdminPanelContainer));

