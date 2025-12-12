import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { injectIntl } from 'react-intl';
import { showNotification } from '../../Notifications/Notifications.actions';
import LogViewer from './LogViewer.component';
import API from '../../../api';

export class LogViewerContainer extends PureComponent {
  static propTypes = {
    profiles: PropTypes.array.isRequired,
    history: PropTypes.object.isRequired,
    intl: PropTypes.object.isRequired,
    showNotification: PropTypes.func.isRequired
  };

  state = {
    logs: [],
    loading: false
  };

  handleLoadLogs = async (filters = {}) => {
    this.setState({ loading: true });
    try {
      const result = await API.getLogs(filters);
      this.setState({ logs: result.logs || [] });
    } catch (error) {
      console.error('Load logs error:', error);
      this.props.showNotification(
        this.props.intl.formatMessage({ id: 'cboard.components.Settings.LogViewer.loadError', defaultMessage: 'Failed to load logs' })
      );
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
    const { profiles, history, intl } = this.props;
    const { logs, loading } = this.state;

    return (
      <LogViewer
        profiles={profiles}
        onClose={history.goBack}
        logs={logs}
        loading={loading}
        onLoadLogs={this.handleLoadLogs}
        onExportLogs={this.handleExportLogs}
        intl={intl}
      />
    );
  }
}

const mapStateToProps = state => ({
  profiles: state.communicator.communicators || []
});

const mapDispatchToProps = {
  showNotification
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(injectIntl(LogViewerContainer));

