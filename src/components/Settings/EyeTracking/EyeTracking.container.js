import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { injectIntl, intlShape } from 'react-intl';
import EyeTracking from './EyeTracking.component';
import API from '../../../api';
import { showNotification } from '../../Notifications/Notifications.actions';

export class EyeTrackingContainer extends PureComponent {
  static propTypes = {
    intl: intlShape.isRequired,
    history: PropTypes.object,
    showNotification: PropTypes.func.isRequired
  };

  state = {
    eyeTrackingSettings: {
      enabled: false,
      deviceType: 'tobii',
      dwellTime: 1000
    },
    registeredDevice: null,
    loading: true,
    error: null
  };

  componentDidMount() {
    this.loadSettings();
    this.loadRegisteredDevice();
  }

  loadSettings = async () => {
    try {
      // Load from user settings or use defaults
      const settings = await API.getSettings();
      const eyeTrackingSettings = settings.eyeTracking || this.state.eyeTrackingSettings;
      this.setState({
        eyeTrackingSettings,
        loading: false
      });
    } catch (e) {
      console.error('Failed to load eye tracking settings:', e);
      this.setState({
        loading: false,
        error: e.message
      });
    }
  };

  loadRegisteredDevice = async () => {
    try {
      const devices = await API.getDevicesList();
      const eyeTrackingDevice = devices.eye_tracking?.find(d => d.is_active);
      this.setState({
        registeredDevice: eyeTrackingDevice || null
      });
    } catch (e) {
      console.error('Failed to load registered device:', e);
    }
  };

  updateEyeTrackingSettings = async settings => {
    try {
      this.setState({
        eyeTrackingSettings: { ...this.state.eyeTrackingSettings, ...settings }
      });
      
      // Save to backend
      await API.updateSettings({
        eyeTracking: { ...this.state.eyeTrackingSettings, ...settings }
      });
    } catch (e) {
      console.error('Failed to update eye tracking settings:', e);
      this.props.showNotification(
        this.props.intl.formatMessage({
          id: 'cboard.components.Settings.EyeTracking.updateFailed',
          defaultMessage: 'Failed to update settings'
        })
      );
    }
  };

  handleRegisterDevice = async deviceData => {
    try {
      const result = await API.registerEyeTrackingDevice(deviceData);
      this.props.showNotification(
        this.props.intl.formatMessage({
          id: 'cboard.components.Settings.EyeTracking.deviceRegisteredSuccess',
          defaultMessage: 'Device registered successfully'
        })
      );
      await this.loadRegisteredDevice();
      return result;
    } catch (e) {
      console.error('Failed to register device:', e);
      this.props.showNotification(
        this.props.intl.formatMessage({
          id: 'cboard.components.Settings.EyeTracking.deviceRegisterFailed',
          defaultMessage: 'Failed to register device'
        })
      );
      throw e;
    }
  };

  handleCalibrate = async (deviceId, calibrationData) => {
    try {
      const result = await API.calibrateEyeTrackingDevice(deviceId, calibrationData);
      this.props.showNotification(
        this.props.intl.formatMessage({
          id: 'cboard.components.Settings.EyeTracking.calibrationComplete',
          defaultMessage: 'Calibration complete'
        })
      );
      await this.loadRegisteredDevice();
      return result;
    } catch (e) {
      console.error('Failed to calibrate device:', e);
      this.props.showNotification(
        this.props.intl.formatMessage({
          id: 'cboard.components.Settings.EyeTracking.calibrationFailed',
          defaultMessage: 'Calibration failed'
        })
      );
      throw e;
    }
  };

  render() {
    const { history, intl } = this.props;
    const { eyeTrackingSettings, registeredDevice, loading } = this.state;

    if (loading) {
      return <div>Loading...</div>;
    }

    return (
      <EyeTracking
        onClose={history.goBack}
        updateEyeTrackingSettings={this.updateEyeTrackingSettings}
        eyeTrackingSettings={eyeTrackingSettings}
        registeredDevice={registeredDevice}
        onRegisterDevice={this.handleRegisterDevice}
        onCalibrate={this.handleCalibrate}
        intl={intl}
      />
    );
  }
}

EyeTrackingContainer.propTypes = {
  history: PropTypes.object,
  showNotification: PropTypes.func.isRequired
};

const mapDispatchToProps = {
  showNotification
};

export default connect(
  null,
  mapDispatchToProps
)(injectIntl(EyeTrackingContainer));

