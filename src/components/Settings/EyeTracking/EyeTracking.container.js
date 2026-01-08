import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { injectIntl, intlShape } from 'react-intl';
import EyeTracking from './EyeTracking.component';
import API from '../../../api';
import { showNotification } from '../../Notifications/Notifications.actions';
import { updateScannerSettings } from '../../../providers/ScannerProvider/ScannerProvider.actions';

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
    registeredDevices: [], // List of all registered devices
    loading: true,
    error: null,
    // Scanning settings (merged)
    accessibilitySettings: {},
    scanningSettings: {}
  };

  _isMounted = false;
  // optional: debounce handle
  _updateTimer = null;

  componentDidMount() {
    this._isMounted = true;
    this.loadSettings();
    this.loadRegisteredDevices(); // Load all devices for dropdown
    this.loadAccessibilitySettings(); // Load scanning settings
  }

  componentWillUnmount() {
    this._isMounted = false;
    if (this._updateTimer) clearTimeout(this._updateTimer);
  }

  safeSetState = (updater, callback) => {
    if (!this._isMounted) return;
    // support function updater to avoid stale state reads
    if (typeof updater === 'function') {
      this.setState(prev => updater(prev), callback);
    } else {
      this.setState(updater, callback);
    }
  };

  loadSettings = async () => {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        const err = new Error('Settings load timeout');
        err.name = 'TimeoutError';
        setTimeout(() => reject(err), 10000);
      });

      const settings = await Promise.race([API.getSettings(), timeoutPromise]);
      const eyeTrackingSettings = settings.eyeTracking || this.state.eyeTrackingSettings;

      this.safeSetState({
        eyeTrackingSettings,
        loading: false,
        error: null
      });
    } catch (e) {
      const hasNavigator = typeof navigator !== 'undefined';
      const isNetworkError =
        e.code === 'ERR_NETWORK' ||
        e.message === 'Network Error' ||
        e.name === 'TimeoutError' ||
        e.message === 'Settings load timeout';

      if (!isNetworkError || (hasNavigator && navigator.onLine)) {
        console.warn('Failed to load eye tracking settings:', e);
      }

      this.safeSetState(prev => ({
        loading: false,
        error: isNetworkError ? null : e.message,
        eyeTrackingSettings: prev.eyeTrackingSettings
      }));
    }
  };

  loadRegisteredDevices = async () => {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        const err = new Error('Device load timeout');
        err.name = 'TimeoutError';
        setTimeout(() => reject(err), 10000);
      });

      const devices = await Promise.race([API.getDevicesList(), timeoutPromise]);
      const eyeTrackingDevices = devices.eye_tracking || [];
      const activeDevice = eyeTrackingDevices.find(d => d.is_active) || null;

      this.safeSetState({ 
        registeredDevices: eyeTrackingDevices,
        registeredDevice: activeDevice 
      });
    } catch (e) {
      const hasNavigator = typeof navigator !== 'undefined';
      const isNetworkError =
        e.code === 'ERR_NETWORK' ||
        e.message === 'Network Error' ||
        e.name === 'TimeoutError' ||
        e.message === 'Device load timeout';

      if (!isNetworkError || (hasNavigator && navigator.onLine)) {
        console.warn('Failed to load registered devices:', e);
      }
      this.safeSetState({ registeredDevices: [], registeredDevice: null });
    }
  };

  loadAccessibilitySettings = async () => {
    try {
      const data = await API.getAccessibilitySettings();
      this.safeSetState({
        accessibilitySettings: data.accessibility || {},
        scanningSettings: data.accessibility?.scanning || {}
      });
    } catch (error) {
      
      this.safeSetState({
        accessibilitySettings: {},
        scanningSettings: {}
      });
    }
  };

  updateEyeTrackingSettings = async (settings) => {
    // optimistic local update
    this.safeSetState(prev => ({
      eyeTrackingSettings: { ...prev.eyeTrackingSettings, ...settings }
    }));

    const willDisable = settings && settings.enabled === false;

    // debounce/merge rapid updates
    if (this._updateTimer) clearTimeout(this._updateTimer);
    this._updateTimer = setTimeout(async () => {
      try {
        const latest = this.state.eyeTrackingSettings;
        await API.updateSettings({ eyeTracking: latest });

        // If we just disabled eye tracking, broadcast a global event so any active board can cleanup immediately
        if (willDisable && typeof window !== 'undefined') {
          try {
            const event = new CustomEvent('cboard:eyeTrackingDisabled');
            window.dispatchEvent(event);
          } catch (e) {
            
          }
        }
      } catch (e) {
        const hasNavigator = typeof navigator !== 'undefined';
        const isNetworkError = e.code === 'ERR_NETWORK' || e.message === 'Network Error';
        if (!isNetworkError || (hasNavigator && navigator.onLine)) {
          console.warn('Failed to update eye tracking settings:', e);
        }
        this.props.showNotification(
          this.props.intl.formatMessage({
            id: 'cboard.components.Settings.EyeTracking.updateFailed',
            defaultMessage: 'Failed to update settings'
          }),
          'error'
        );
      }
    }, 300); // debounce 300ms
  };

  handleRegisterDevice = async (deviceData) => {
    try {
      const deviceType = deviceData.device_type || '';
      let verificationMessage = '';

      if (deviceType === 'camera') {
        const hasNavigator = typeof navigator !== 'undefined';
        if (!hasNavigator || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
          this.props.showNotification(
            this.props.intl.formatMessage({
              id: 'cboard.components.Settings.EyeTracking.deviceNotConnected',
              defaultMessage: 'Media devices API not available. Use a secure context (HTTPS) and a supported browser.'
            }),
            'error'
          );
          throw new Error('MediaDevices API unavailable');
        }
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(d => d.kind === 'videoinput');
          if (videoDevices.length === 0) throw new Error('No camera devices found');

          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          const tracks = stream.getVideoTracks();
          if (!tracks.length) throw new Error('Camera stream has no video tracks');
          if (tracks[0].readyState !== 'live') throw new Error('Camera track is not live');
          tracks.forEach(t => t.stop());
          verificationMessage = `Camera verified: ${videoDevices[0].label || 'Default camera'}`;
        } catch (err) {
          const msg = err && err.name === 'NotAllowedError'
            ? 'Camera permission denied'
            : err && err.name === 'NotFoundError'
            ? 'No camera devices found'
            : err && err.name === 'SecurityError'
            ? 'Camera access requires HTTPS'
            : `Camera not connected or accessible: ${err.message}`;
          this.props.showNotification(
            this.props.intl.formatMessage({
              id: 'cboard.components.Settings.EyeTracking.deviceNotConnected',
              defaultMessage: msg
            }),
            'error'
          );
          throw new Error(`Camera connection verification failed: ${err.message}`);
        }
      } else if (deviceType === 'tobii') {
        const hasWindow = typeof window !== 'undefined';
        if (!hasWindow || (typeof window.Tobii === 'undefined' && typeof window.tobii === 'undefined')) {
          this.props.showNotification(
            this.props.intl.formatMessage({
              id: 'cboard.components.Settings.EyeTracking.deviceNotConnected',
              defaultMessage: 'Tobii SDK not loaded. Please ensure Tobii device is connected and drivers are installed.'
            }),
            'error'
          );
          throw new Error('Tobii device not connected');
        }
        verificationMessage = 'Tobii device verified';
      } else if (deviceType === 'eyetribe') {
        const hasWindow = typeof window !== 'undefined';
        if (!hasWindow || (typeof window.EyeTribe === 'undefined' && typeof window.eyetribe === 'undefined')) {
          this.props.showNotification(
            this.props.intl.formatMessage({
              id: 'cboard.components.Settings.EyeTracking.deviceNotConnected',
              defaultMessage: 'EyeTribe SDK not loaded. Please ensure EyeTribe device is connected and drivers are installed.'
            }),
            'error'
          );
          throw new Error('EyeTribe device not connected');
        }
        verificationMessage = 'EyeTribe device verified';
      } else if (deviceType === 'pupil') {
        verificationMessage = 'Pupil device connection assumed';
      } else {
        verificationMessage = 'Device connection verified';
      }

      const result = await API.registerEyeTrackingDevice(deviceData);

      const updatedSettings = {
        ...this.state.eyeTrackingSettings,
        deviceType: deviceData.device_type || this.state.eyeTrackingSettings.deviceType
      };

      this.safeSetState({ eyeTrackingSettings: updatedSettings });

      try {
        await API.updateSettings({ eyeTracking: updatedSettings });
        console.log('[EyeTrackingContainer] ✓ Device type updated after device registration');
      } catch (updateError) {
        console.warn('[EyeTrackingContainer] Failed to update device type:', updateError);
      }

      this.props.showNotification(
        this.props.intl.formatMessage({
          id: 'cboard.components.Settings.EyeTracking.deviceRegisteredSuccess',
          defaultMessage: 'Device registered successfully'
        }) + (verificationMessage ? ` (${verificationMessage})` : '') + '. Please enable eye tracking manually.',
        'success'
      );

      await this.loadRegisteredDevices();
      return result;
    } catch (e) {
      console.error('Failed to register device:', e);
      const isVerificationError = e.message && (
        e.message.includes('connection verification') ||
        e.message.includes('not connected') ||
        e.message.includes('not accessible')
      );
      if (!isVerificationError) {
        this.props.showNotification(
          this.props.intl.formatMessage({
            id: 'cboard.components.Settings.EyeTracking.deviceRegisterFailed',
            defaultMessage: 'Failed to register device'
          }),
          'error'
        );
      }
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
      await this.loadRegisteredDevices();
      return result;
    } catch (e) {
      console.error('Failed to calibrate device:', e);
      this.props.showNotification(
        this.props.intl.formatMessage({
          id: 'cboard.components.Settings.EyeTracking.calibrationFailed',
          defaultMessage: 'Calibration failed'
        }),
        'error'
      );
      throw e;
    }
  };

  handleUpdateScanningSettings = async (scanningSettings) => {
    try {
      // Extract audio_guide from scanningSettings if provided
      const audioGuide = scanningSettings.audio_guide || this.state.accessibilitySettings.audio_guide || 'off';
      const cleanScanningSettings = { ...scanningSettings };
      delete cleanScanningSettings.audio_guide; // Remove audio_guide from scanning settings

      const accessibilitySettings = {
        ...this.state.accessibilitySettings,
        scanning: cleanScanningSettings,
        audio_guide: audioGuide
      };
      await API.updateAccessibilitySettings(accessibilitySettings);
      this.safeSetState({
        scanningSettings: cleanScanningSettings,
        accessibilitySettings
      });
      
      // Also update legacy scanner settings for backward compatibility
      // This ensures react-scannable Scanner component works correctly
      if (this.props.updateScannerSettings) {
        this.props.updateScannerSettings({
          active: cleanScanningSettings.enabled || false,
          delay: (cleanScanningSettings.speed || 2.0) * 1000, // Convert seconds to ms
          strategy: cleanScanningSettings.strategy || 'automatic'
        });
      }
    } catch (error) {
      console.error('Failed to update scanning settings:', error);
      this.props.showNotification(
        this.props.intl.formatMessage({
          id: 'cboard.components.Settings.EyeTracking.updateFailed',
          defaultMessage: 'Failed to update settings'
        }),
        'error'
      );
    }
  };

  render() {
    const { history, intl } = this.props;
    const { eyeTrackingSettings, registeredDevice, registeredDevices, loading, scanningSettings, accessibilitySettings } = this.state;

    if (loading) return <div>Loading...</div>;

    return (
      <EyeTracking
        onClose={history?.goBack ? history.goBack : () => {}}
        updateEyeTrackingSettings={this.updateEyeTrackingSettings}
        eyeTrackingSettings={eyeTrackingSettings}
        registeredDevice={registeredDevice}
        registeredDevices={registeredDevices}
        scanningSettings={scanningSettings}
        accessibilitySettings={accessibilitySettings}
        onRegisterDevice={this.handleRegisterDevice}
        onCalibrate={this.handleCalibrate}
        onUpdateScanningSettings={this.handleUpdateScanningSettings}
        intl={intl}
      />
    );
  }
}

// Remove the duplicate propTypes block below to avoid overriding the static definition.
// EyeTrackingContainer.propTypes = { ... }  // ← delete this

const mapDispatchToProps = { 
  showNotification,
  updateScannerSettings
};

export default connect(null, mapDispatchToProps)(injectIntl(EyeTrackingContainer));