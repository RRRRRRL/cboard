import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { injectIntl } from 'react-intl';
import { Tooltip, IconButton } from '@material-ui/core';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import VisibilityIcon from '@material-ui/icons/Visibility';
import SettingsInputComponentIcon from '@material-ui/icons/SettingsInputComponent';
import API from '../../../api/api';
import messages from '../../Board/Board.messages';
import './DeviceConnectionStatus.css';

class DeviceConnectionStatus extends Component {
  static propTypes = {
    className: PropTypes.string,
    intl: PropTypes.object
  };

  constructor(props) {
    super(props);
    this.state = {
      eyeTrackingConnected: false,
      switchConnected: false,
      eyeTrackingDevice: null,
      switchDevice: null,
      isChecking: false,
      lastCheckTime: null,
      hasAnyDeviceConfigured: false
    };
    this.checkInterval = null;
  }

  componentDidMount() {
    this.checkDeviceStatus();
    // Check device status every 10 seconds
    this.checkInterval = setInterval(() => {
      this.checkDeviceStatus();
    }, 10000);
  }

  componentWillUnmount() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  checkDeviceStatus = async () => {
    // Skip check if already checking
    if (this.state.isChecking) return;

    this.setState({ isChecking: true });

    try {
      const devices = await API.getDevicesList();
      
      // Check eye tracking devices
      const eyeTrackingDevices = devices.eye_tracking || [];
      const activeEyeTracking = eyeTrackingDevices.find(
        device => device.is_active && device.connection_verified
      );
      
      // Check switch devices
      const switchDevices = devices.switch || [];
      const activeSwitch = switchDevices.find(
        device => device.is_active && device.connection_verified
      );

      // Additional verification for eye tracking
      let eyeTrackingVerified = false;
      if (activeEyeTracking) {
        eyeTrackingVerified = await this.verifyEyeTrackingConnection(
          activeEyeTracking.device_type
        );
      }

      // Additional verification for switch
      let switchVerified = false;
      if (activeSwitch) {
        switchVerified = await this.verifySwitchConnection(
          activeSwitch.connection_type
        );
      }

      const hasAnyDevice = !!activeEyeTracking || !!activeSwitch;
      
      this.setState({
        eyeTrackingConnected: eyeTrackingVerified && !!activeEyeTracking,
        switchConnected: switchVerified && !!activeSwitch,
        eyeTrackingDevice: activeEyeTracking,
        switchDevice: activeSwitch,
        hasAnyDeviceConfigured: hasAnyDevice,
        lastCheckTime: Date.now()
      });
    } catch (error) {
      // Handle authentication errors gracefully
      if (error.response?.status === 401 || error.message?.includes('authenticated')) {
        // User not authenticated, hide indicator
        this.setState({
          hasAnyDeviceConfigured: false,
          eyeTrackingConnected: false,
          switchConnected: false,
          eyeTrackingDevice: null,
          switchDevice: null,
          isChecking: false
        });
        return;
      }
      
      console.warn('[DeviceConnectionStatus] Failed to check device status:', error);
      // On error, keep previous state but mark as disconnected
      // Only update if we have devices configured to avoid showing indicator when no devices exist
      this.setState(prevState => ({
        eyeTrackingConnected: false,
        switchConnected: false,
        lastCheckTime: Date.now(),
        // Keep device info if we had it before, so we still show the indicator
        hasAnyDeviceConfigured: prevState.hasAnyDeviceConfigured || false,
        isChecking: false
      }));
    }
  };

  verifyEyeTrackingConnection = async (deviceType) => {
    try {
      if (deviceType === 'camera') {
        // Check if camera is accessible
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        return videoDevices.length > 0;
      } else if (deviceType === 'tobii') {
        return typeof window.Tobii !== 'undefined' || typeof window.tobii !== 'undefined';
      } else if (deviceType === 'eyetribe') {
        return typeof window.EyeTribe !== 'undefined' || typeof window.eyetribe !== 'undefined';
      } else if (deviceType === 'pupil') {
        // Pupil connects via WebSocket, assume connected if device type is set
        return true;
      }
      return false;
    } catch (error) {
      console.warn('[DeviceConnectionStatus] Eye tracking verification failed:', error);
      return false;
    }
  };

  verifySwitchConnection = async (connectionType) => {
    try {
      // For USB switches, we can't directly verify, but if device is registered and active, assume connected
      // For Bluetooth switches, we could check Bluetooth API if available
      // For now, if device is registered and active, assume it's connected
      return true;
    } catch (error) {
      console.warn('[DeviceConnectionStatus] Switch verification failed:', error);
      return false;
    }
  };

  getStatusTooltip = () => {
    const { eyeTrackingConnected, switchConnected, eyeTrackingDevice, switchDevice } = this.state;
    const { intl } = this.props;
    
    const parts = [];
    
    if (eyeTrackingConnected && eyeTrackingDevice) {
      const deviceName = eyeTrackingDevice.device_name || eyeTrackingDevice.device_type || '';
      const status = intl.formatMessage(messages.deviceStatusEyeTrackingConnected);
      parts.push(deviceName ? `${deviceName} - ${status}` : status);
    } else {
      parts.push(intl.formatMessage(messages.deviceStatusEyeTrackingDisconnected));
    }
    
    if (switchConnected && switchDevice) {
      const deviceName = switchDevice.device_name || switchDevice.connection_type || '';
      const status = intl.formatMessage(messages.deviceStatusSwitchConnected);
      parts.push(deviceName ? `${deviceName} - ${status}` : status);
    } else {
      parts.push(intl.formatMessage(messages.deviceStatusSwitchDisconnected));
    }
    
    return parts.join('\n');
  };

  render() {
    const { className } = this.props;
    const { eyeTrackingConnected, switchConnected, hasAnyDeviceConfigured } = this.state;
    
    // Show indicator only if at least one device is configured
    if (!hasAnyDeviceConfigured) {
      return null;
    }
    
    const allConnected = eyeTrackingConnected && switchConnected;
    const someConnected = eyeTrackingConnected || switchConnected;

    const statusColor = allConnected 
      ? '#4CAF50' // Green - all connected
      : someConnected 
        ? '#FF9800' // Orange - partial connection
        : '#F44336'; // Red - disconnected

    return (
      <Tooltip title={this.getStatusTooltip()} arrow>
        <div className={`DeviceConnectionStatus ${className || ''}`}>
          <IconButton
            size="small"
            className="DeviceConnectionStatus__button"
            style={{ padding: '4px' }}
          >
            <div className="DeviceConnectionStatus__icons">
              {eyeTrackingConnected ? (
                <VisibilityIcon 
                  className="DeviceConnectionStatus__icon DeviceConnectionStatus__icon--connected"
                  style={{ fontSize: '18px', marginRight: '4px' }}
                />
              ) : (
                <VisibilityIcon 
                  className="DeviceConnectionStatus__icon DeviceConnectionStatus__icon--disconnected"
                  style={{ fontSize: '18px', marginRight: '4px', opacity: 0.4 }}
                />
              )}
              {switchConnected ? (
                <SettingsInputComponentIcon 
                  className="DeviceConnectionStatus__icon DeviceConnectionStatus__icon--connected"
                  style={{ fontSize: '18px' }}
                />
              ) : (
                <SettingsInputComponentIcon 
                  className="DeviceConnectionStatus__icon DeviceConnectionStatus__icon--disconnected"
                  style={{ fontSize: '18px', opacity: 0.4 }}
                />
              )}
            </div>
            <FiberManualRecordIcon
              className="DeviceConnectionStatus__status-dot"
              style={{ 
                fontSize: '8px', 
                color: statusColor,
                marginLeft: '4px',
                verticalAlign: 'middle'
              }}
            />
          </IconButton>
        </div>
      </Tooltip>
    );
  }
}

export default injectIntl(DeviceConnectionStatus);

