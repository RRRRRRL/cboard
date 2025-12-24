import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { injectIntl } from 'react-intl';
import { showNotification } from '../../Notifications/Notifications.actions';
import DataRetention from './DataRetention.component';
import API from '../../../api';
import messages from './DataRetention.messages';

export class DataRetentionContainer extends PureComponent {
  static propTypes = {
    history: PropTypes.object.isRequired,
    intl: PropTypes.object.isRequired,
    showNotification: PropTypes.func.isRequired
  };

  state = {
    settings: null,
    cleanupStats: null,
    loading: false
  };

  componentDidMount() {
    this.handleLoadSettings();
  }

  handleLoadSettings = async () => {
    this.setState({ loading: true });
    try {
      const result = await API.getDataRetentionSettings();
      this.setState({ settings: result.settings || null, loading: false });
    } catch (error) {
      console.error('Load data retention settings error:', error);
      this.setState({ loading: false });
    }
  };

  handleSaveSettings = async (settings) => {
    this.setState({ loading: true });
    try {
      await API.updateDataRetentionSettings(settings);
      this.props.showNotification(
        this.props.intl.formatMessage(messages.saveSuccess),
        'success'
      );
      // Reload settings to get updated values
      await this.handleLoadSettings();
    } catch (error) {
      console.error('Save data retention settings error:', error);
      this.props.showNotification(
        this.props.intl.formatMessage(messages.saveError),
        'error'
      );
      this.setState({ loading: false });
    }
  };

  handleRunCleanup = async () => {
    this.setState({ loading: true });
    try {
      const result = await API.runDataRetentionCleanup();
      this.props.showNotification(
        this.props.intl.formatMessage(messages.cleanupSuccess),
        'success'
      );
      this.setState({ 
        cleanupStats: result.stats || null,
        loading: false 
      });
    } catch (error) {
      console.error('Run cleanup error:', error);
      this.props.showNotification(
        this.props.intl.formatMessage(messages.cleanupError),
        'error'
      );
      this.setState({ loading: false });
    }
  };

  render() {
    const { history, intl } = this.props;
    const { settings, cleanupStats, loading } = this.state;

    return (
      <DataRetention
        onClose={history.goBack}
        loading={loading}
        settings={settings}
        cleanupStats={cleanupStats}
        onLoadSettings={this.handleLoadSettings}
        onSaveSettings={this.handleSaveSettings}
        onRunCleanup={this.handleRunCleanup}
        intl={intl}
      />
    );
  }
}

const mapStateToProps = () => ({});

const mapDispatchToProps = {
  showNotification
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(injectIntl(DataRetentionContainer));

