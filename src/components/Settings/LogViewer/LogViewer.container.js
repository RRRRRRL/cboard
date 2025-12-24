import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { injectIntl } from 'react-intl';
import { showNotification } from '../../Notifications/Notifications.actions';
import LogViewer from './LogViewer.component';
import API from '../../../api';
import messages from './LogViewer.messages';

export class LogViewerContainer extends PureComponent {
  static propTypes = {
    history: PropTypes.object.isRequired,
    intl: PropTypes.object.isRequired,
    showNotification: PropTypes.func.isRequired
  };

  state = {
    profiles: [],
    logs: [],
    loading: false
  };

  async componentDidMount() {
    // Load communication profiles for filtering logs
    try {
      const profiles = await API.getProfiles();
      this.setState({ profiles });
    } catch (error) {
      console.error('Get profiles error (LogViewer):', error);
    }
  }

  handleLoadLogs = async (filters = {}) => {
    this.setState({ loading: true });
    try {
      const result = await API.getLogs(filters);
      this.setState({ logs: result.logs || [] });
      
      // Show offline message if no logs and offline
      if ((!result.logs || result.logs.length === 0) && !navigator.onLine) {
        this.props.showNotification(
          this.props.intl.formatMessage(messages.offlineMode),
          'info'
        );
      }
    } catch (error) {
      console.error('Load logs error:', error);
      const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error';
      const message = isNetworkError && !navigator.onLine
        ? this.props.intl.formatMessage(messages.offlineMode)
        : this.props.intl.formatMessage(messages.loadError);
      this.props.showNotification(message, isNetworkError ? 'warning' : 'error');
      
      // Set empty logs on network error to prevent UI issues
      if (isNetworkError) {
        this.setState({ logs: [] });
      }
    } finally {
      this.setState({ loading: false });
    }
  };

  handleExportLogs = async (filters = {}) => {
    try {
      const blob = await API.exportLogs(filters);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `action_logs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      this.props.showNotification(
        this.props.intl.formatMessage({ id: 'cboard.components.Settings.LogViewer.exportSuccess', defaultMessage: 'Logs exported successfully' })
      );
    } catch (error) {
      console.error('Export logs error:', error);
      throw error;
    }
  };

  render() {
    const { history, intl, userData } = this.props;
    const { profiles, logs, loading } = this.state;

    return (
      <LogViewer
        profiles={profiles}
        onClose={history.goBack}
        logs={logs}
        loading={loading}
        onLoadLogs={this.handleLoadLogs}
        onExportLogs={this.handleExportLogs}
        userData={userData}
        intl={intl}
      />
    );
  }
}

const mapStateToProps = (state) => ({
  userData: state.app.userData || {}
});

const mapDispatchToProps = {
  showNotification
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(injectIntl(LogViewerContainer));

