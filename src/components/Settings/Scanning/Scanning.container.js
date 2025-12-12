import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { injectIntl, intlShape } from 'react-intl';
import Scanning from './Scanning.component';
import { updateScannerSettings } from '../../../providers/ScannerProvider/ScannerProvider.actions';
import API from '../../../api';

export class ScanningContainer extends PureComponent {
  static propTypes = {
    intl: intlShape.isRequired,
    history: PropTypes.object,
    scanningSettings: PropTypes.object,
    updateScannerSettings: PropTypes.func.isRequired
  };

  state = {
    accessibilitySettings: null,
    loading: true,
    error: null
  };

  componentDidMount() {
    this.loadAccessibilitySettings();
  }

  loadAccessibilitySettings = async () => {
    try {
      const data = await API.getAccessibilitySettings();
      this.setState({
        accessibilitySettings: data.accessibility || {},
        loading: false
      });
    } catch (e) {
      console.error('Failed to load accessibility settings:', e);
      this.setState({
        accessibilitySettings: {},
        loading: false,
        error: e.message
      });
    }
  };

  updateScannerSettings = async (accessibilitySettings, legacySettings = {}) => {
    try {
      // Save to new Sprint 5 API
      await API.updateAccessibilitySettings(accessibilitySettings);
      
      // Also update legacy settings for backward compatibility
      if (Object.keys(legacySettings).length > 0) {
        try {
          await API.updateSettings({ scanning: legacySettings });
        } catch (e) {
          console.warn('Failed to update legacy scanning settings:', e);
        }
      }
      
      // Update Redux store
      this.props.updateScannerSettings(legacySettings);
      
      // Reload settings to get latest from server
      await this.loadAccessibilitySettings();
    } catch (e) {
      console.error('Failed to update accessibility settings:', e);
      throw e;
    }
  };

  render() {
    const { history, scanningSettings, intl } = this.props;
    const { accessibilitySettings, loading } = this.state;

    if (loading) {
      return <div>Loading...</div>;
    }

    return (
      <Scanning
        onClose={history.goBack}
        updateScannerSettings={this.updateScannerSettings}
        scanningSettings={scanningSettings}
        accessibilitySettings={accessibilitySettings}
        intl={intl}
      />
    );
  }
}

ScanningContainer.propTypes = {
  history: PropTypes.object,
  updateScannerSettings: PropTypes.func.isRequired,
  scanningSettings: PropTypes.object.isRequired
};

const mapStateToProps = ({ scanner: scanningSettings }) => ({
  scanningSettings
});

const mapDispatchToProps = {
  updateScannerSettings
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(injectIntl(ScanningContainer));
