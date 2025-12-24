import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, intlShape } from 'react-intl';
import { withStyles } from '@material-ui/core/styles';
import Switch from '@material-ui/core/Switch';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import Slider from '@material-ui/core/Slider';
import Paper from '@material-ui/core/Paper';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import FullScreenDialog from '../../UI/FullScreenDialog';
import messages from './EyeTracking.messages';
import {
  EYE_TRACKING_DEVICE_TYPES,
  MIN_DWELL_TIME,
  MAX_DWELL_TIME,
  DEFAULT_DWELL_TIME,
  DWELL_TIME_STEP,
  CALIBRATION_POINTS
} from './EyeTracking.constants';
import {
  SCANNING_MODE_SINGLE,
  SCANNING_MODE_ROW,
  SCANNING_MODE_COLUMN,
  SCANNING_MODE_OPERATION,
  SCANNING_METHOD_AUTOMATIC,
  SCANNING_METHOD_MANUAL,
  LOOP_FINITE,
  LOOP_INFINITE,
  AUDIO_GUIDE_OFF,
  AUDIO_GUIDE_BEEP,
  AUDIO_GUIDE_CARD_AUDIO,
  MIN_SCANNING_SPEED,
  MAX_SCANNING_SPEED,
  SCANNING_SPEED_INCREMENT,
  MIN_LOOP_COUNT,
  MAX_LOOP_COUNT,
  DEFAULT_LOOP_COUNT
} from '../Scanning/Scanning.constants';
import scanningMessages from '../Scanning/Scanning.messages';
import CalibrationOverlay from './CalibrationOverlay.component';
import { getEyeTrackingInstance } from '../../../utils/eyeTrackingIntegration';

import './EyeTracking.css';

const propTypes = {
  onClose: PropTypes.func,
  updateEyeTrackingSettings: PropTypes.func,
  eyeTrackingSettings: PropTypes.object,
  registeredDevice: PropTypes.object,
  registeredDevices: PropTypes.array,
  scanningSettings: PropTypes.object,
  accessibilitySettings: PropTypes.object,
  onRegisterDevice: PropTypes.func,
  onCalibrate: PropTypes.func,
  onUpdateScanningSettings: PropTypes.func,
  classes: PropTypes.object.isRequired,
  intl: intlShape.isRequired
};

const styles = theme => ({
  sliderContainer: {
    padding: '0 16px',
    marginTop: '8px'
  }
});

function EyeTracking({
  onClose,
  updateEyeTrackingSettings,
  eyeTrackingSettings = {},
  registeredDevice,
  registeredDevices = [],
  scanningSettings = {},
  accessibilitySettings = {},
  onRegisterDevice,
  onCalibrate,
  onUpdateScanningSettings,
  classes,
  intl
}) {
  const [dwellTime, setDwellTime] = useState(
    eyeTrackingSettings.dwellTime || DEFAULT_DWELL_TIME
  );
  const [deviceType, setDeviceType] = useState(
    eyeTrackingSettings.deviceType || EYE_TRACKING_DEVICE_TYPES.TOBII
  );
  const [enabled, setEnabled] = useState(
    eyeTrackingSettings.enabled || false
  );
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState(0);

  // Scanning settings state
  const [scanningEnabled, setScanningEnabled] = useState(scanningSettings?.enabled || false);
  const [scanningMode, setScanningMode] = useState(scanningSettings?.mode || SCANNING_MODE_SINGLE);
  const [scanningSpeed, setScanningSpeed] = useState(scanningSettings?.speed || 2.0);
  const [scanningMethod, setScanningMethod] = useState(scanningSettings?.strategy || SCANNING_METHOD_AUTOMATIC);
  const [loopType, setLoopType] = useState(scanningSettings?.loop || LOOP_INFINITE);
  const [loopCount, setLoopCount] = useState(scanningSettings?.loop_count || DEFAULT_LOOP_COUNT);
  const [audioGuide, setAudioGuide] = useState(accessibilitySettings?.audio_guide || AUDIO_GUIDE_OFF);

  // Sync scanning settings from props
  useEffect(() => {
    if (scanningSettings?.enabled !== undefined) {
      setScanningEnabled(scanningSettings.enabled);
    }
    if (scanningSettings?.mode !== undefined) {
      setScanningMode(scanningSettings.mode);
    }
    if (scanningSettings?.speed !== undefined) {
      setScanningSpeed(scanningSettings.speed);
    }
    if (scanningSettings?.strategy !== undefined) {
      setScanningMethod(scanningSettings.strategy);
    }
    if (scanningSettings?.loop !== undefined) {
      setLoopType(scanningSettings.loop);
    }
    if (scanningSettings?.loop_count !== undefined) {
      setLoopCount(scanningSettings.loop_count);
    }
    if (accessibilitySettings?.audio_guide !== undefined) {
      setAudioGuide(accessibilitySettings.audio_guide);
    }
  }, [scanningSettings, accessibilitySettings]);

  // Derived guards
  // Calibration should be available whenever the device type is CAMERA.
  // 我们不再强制要求已在后端注册设备，以免因设备列表不同步而锁死校准按钮。
  const canCalibrate = useMemo(
    () => deviceType === EYE_TRACKING_DEVICE_TYPES.CAMERA,
    [deviceType]
  );

  // Sync local state with props when settings change (e.g., after device registration)
  useEffect(() => {
    if (eyeTrackingSettings.enabled !== undefined && eyeTrackingSettings.enabled !== enabled) {
      console.log('[EyeTracking] Settings changed - enabled:', eyeTrackingSettings.enabled);
      setEnabled(eyeTrackingSettings.enabled);
    }
    if (eyeTrackingSettings.deviceType !== undefined && eyeTrackingSettings.deviceType !== deviceType) {
      setDeviceType(eyeTrackingSettings.deviceType);
    }
    if (eyeTrackingSettings.dwellTime !== undefined && eyeTrackingSettings.dwellTime !== dwellTime) {
      setDwellTime(eyeTrackingSettings.dwellTime || DEFAULT_DWELL_TIME);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eyeTrackingSettings.enabled, eyeTrackingSettings.deviceType, eyeTrackingSettings.dwellTime]);

  // If calibration is in progress and settings change, cancel safely
  useEffect(() => {
    if (isCalibrating && !enabled) {
      console.warn('[EyeTracking] Disabled during calibration; cancelling.');
      setIsCalibrating(false);
      setCalibrationStep(0);
    }
  }, [enabled, isCalibrating]);

  useEffect(() => {
    if (isCalibrating && deviceType !== EYE_TRACKING_DEVICE_TYPES.CAMERA) {
      console.warn('[EyeTracking] Device type changed away from CAMERA; cancelling calibration.');
      setIsCalibrating(false);
      setCalibrationStep(0);
    }
  }, [deviceType, isCalibrating]);

  const handleDwellTimeChange = (event, newValue) => {
    setDwellTime(newValue);
    updateEyeTrackingSettings({
      ...eyeTrackingSettings,
      dwellTime: newValue
    });
  };

  const handleDeviceTypeChange = event => {
    const newType = event.target.value;
    setDeviceType(newType);
    updateEyeTrackingSettings({
      ...eyeTrackingSettings,
      deviceType: newType
    });
  };

  const handleEnabledChange = event => {
    const newEnabled = event.target.checked;
    setEnabled(newEnabled);
    updateEyeTrackingSettings({
      ...eyeTrackingSettings,
      enabled: newEnabled
    });

    // Immediately update runtime eye tracking instance so that
    // the red indicator and tracking stop as soon as the user
    // disables eye tracking in settings (no need to wait for
    // board reload or periodic checks).
    try {
      const eyeTracking = getEyeTrackingInstance();
      if (eyeTracking && typeof eyeTracking.updateSettings === 'function') {
        eyeTracking.updateSettings({
          enabled: newEnabled,
          dwellTime
        });
      }
    } catch (e) {
      // Fail silently if instance is not available in this context
      // (e.g., board not mounted). This should not block the UI.
      // console.debug('EyeTracking instance update failed:', e);
    }
  };

  const handleRegisterDevice = async () => {
    try {
      await onRegisterDevice({
        device_type: deviceType,
        device_name: `${deviceType} Eye Tracker`
      });
    } catch (error) {
      console.error('Failed to register device:', error);
    }
  };

  const handleStartCalibration = async () => {
    // Only allow calibration for camera-based eye tracking (WebGazer)
    if (!canCalibrate) {
      console.warn('Calibration is only available for camera-based eye tracking (WebGazer) with a registered device.');
      return;
    }
    if (isCalibrating) {
      // guard against double-start
      return;
    }

    try {
      const eyeTracking = getEyeTrackingInstance();
      // Initialize WebGazer for calibration if not ready yet
      if (eyeTracking && typeof eyeTracking.isReadyForCalibration === 'function') {
        if (!eyeTracking.isReadyForCalibration()) {
          console.log('[EyeTracking] Initializing WebGazer for calibration from settings page...');
          await eyeTracking.initialize(
            {
              enabled: true,
              deviceType: EYE_TRACKING_DEVICE_TYPES.CAMERA,
              dwellTime
            },
            () => {} // No dwell callback needed during calibration
          );
          console.log('[EyeTracking] ✓ WebGazer initialized for calibration');
        } else {
          console.log('[EyeTracking] WebGazer already ready for calibration');
        }
      }
    } catch (err) {
      console.warn('[EyeTracking] Failed to initialize WebGazer for calibration:', err?.message || err);
      // Continue to show calibration overlay; user can retry if needed
    }

    setIsCalibrating(true);
    setCalibrationStep(0);
  };

  const handleCalibrationPointComplete = async () => {
    // Guard against out-of-range access
    if (calibrationStep < 0 || calibrationStep >= CALIBRATION_POINTS.length) {
      console.warn('[EyeTracking] Calibration step out of range; resetting.');
      setIsCalibrating(false);
      setCalibrationStep(0);
      return;
    }

    const currentPoint = CALIBRATION_POINTS[calibrationStep];

    // For WebGazer (camera-based), call WebGazer's calibrate method
    if (deviceType === EYE_TRACKING_DEVICE_TYPES.CAMERA) {
      try {
        const eyeTracking = getEyeTrackingInstance();
        if (eyeTracking && typeof eyeTracking.isReadyForCalibration === 'function' && eyeTracking.isReadyForCalibration()) {
          // Convert normalized coordinates (0-1) to pixels
          const pixelX = currentPoint.x * window.innerWidth;
          const pixelY = currentPoint.y * window.innerHeight;

          if (typeof eyeTracking.calibrate === 'function') {
            // false = already in pixels
            await eyeTracking.calibrate(pixelX, pixelY, false);
            console.log(`[EyeTracking] Calibrated point ${calibrationStep + 1}/${CALIBRATION_POINTS.length}`);
          } else {
            console.warn('[EyeTracking] calibrate() not available on eyeTracking instance');
          }
        } else {
          console.warn('[EyeTracking] WebGazer not ready for calibration');
        }
      } catch (error) {
        console.error('[EyeTracking] WebGazer calibration error:', error);
        // Continue with calibration flow even if WebGazer calibration fails
      }
    }

    // Move to next point or complete calibration
    if (calibrationStep < CALIBRATION_POINTS.length - 1) {
      setCalibrationStep(prev => prev + 1);
    } else {
      // Calibration complete - save to backend
      try {
        if (registeredDevice && registeredDevice.device_id) {
          await onCalibrate(registeredDevice.device_id, {
            calibration_points: CALIBRATION_POINTS,
            completed_at: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Calibration save failed:', error);
      } finally {
        setIsCalibrating(false);
        setCalibrationStep(0);
      }
    }
  };

  const handleCancelCalibration = () => {
    setIsCalibrating(false);
    setCalibrationStep(0);
  };

  return (
    <FullScreenDialog
      open
      title={<FormattedMessage {...messages.eyeTracking} />}
      onClose={onClose}
    >
      <div className="EyeTracking">
        <Paper className="EyeTracking__section">
          <List>
            <ListItem>
              <ListItemText
                primary={<FormattedMessage {...messages.enable} />}
                secondary={<FormattedMessage {...messages.enableSecondary} />}
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={enabled}
                  onChange={handleEnabledChange}
                  color="primary"
                />
              </ListItemSecondaryAction>
            </ListItem>

            {/* Device Selection Dropdown - Show registered devices */}
            <ListItem>
              <ListItemText
                primary={<FormattedMessage {...messages.selectDevice} />}
                secondary={
                  registeredDevices.length > 0
                    ? <FormattedMessage {...messages.selectDeviceSecondary} />
                    : <FormattedMessage {...messages.deviceTypeSecondary} />
                }
              />
              <ListItemSecondaryAction>
                <Select
                  value={registeredDevice?.id || `type_${deviceType}` || ''}
                  onChange={(event) => {
                    const selectedValue = event.target.value;
                    // Check if it's a registered device (has id) or device type (starts with "type_")
                    if (selectedValue.startsWith('type_')) {
                      const selectedType = selectedValue.replace('type_', '');
                      handleDeviceTypeChange({ target: { value: selectedType } });
                      updateEyeTrackingSettings({
                        ...eyeTrackingSettings,
                        deviceType: selectedType,
                        device: null // Clear device when using type
                      });
                    } else {
                      // It's a registered device ID
                      const selectedDevice = registeredDevices.find(d => d.id === selectedValue);
                      if (selectedDevice) {
                        handleDeviceTypeChange({ target: { value: selectedDevice.type } });
                        updateEyeTrackingSettings({
                          ...eyeTrackingSettings,
                          deviceType: selectedDevice.type,
                          device: selectedDevice.id
                        });
                      }
                    }
                  }}
                  disabled={!enabled}
                >
                  {registeredDevices.map((device) => (
                    <MenuItem key={device.id} value={device.id}>
                      {device.name || device.device_name || `${device.type} Device`}
                    </MenuItem>
                  ))}
                  <MenuItem value={`type_${EYE_TRACKING_DEVICE_TYPES.TOBII}`}>
                    <FormattedMessage {...messages.tobii} />
                  </MenuItem>
                  <MenuItem value={`type_${EYE_TRACKING_DEVICE_TYPES.EYETRIBE}`}>
                    <FormattedMessage {...messages.eyetribe} />
                  </MenuItem>
                  <MenuItem value={`type_${EYE_TRACKING_DEVICE_TYPES.PUPIL}`}>
                    <FormattedMessage {...messages.pupil} />
                  </MenuItem>
                  <MenuItem value={`type_${EYE_TRACKING_DEVICE_TYPES.CAMERA}`}>
                    <FormattedMessage {...messages.camera} />
                  </MenuItem>
                  <MenuItem value={`type_${EYE_TRACKING_DEVICE_TYPES.CUSTOM}`}>
                    <FormattedMessage {...messages.custom} />
                  </MenuItem>
                </Select>
              </ListItemSecondaryAction>
            </ListItem>

            <ListItem>
              <ListItemText
                primary={<FormattedMessage {...messages.dwellTime} />}
                secondary={
                  <FormattedMessage {...messages.dwellTimeSecondary} />
                }
              />
            </ListItem>

            <div className={classes.sliderContainer}>
              <Slider
                value={dwellTime}
                onChange={handleDwellTimeChange}
                min={MIN_DWELL_TIME}
                max={MAX_DWELL_TIME}
                step={DWELL_TIME_STEP}
                disabled={!enabled}
                valueLabelDisplay="auto"
                valueLabelFormat={value =>
                  intl.formatMessage(messages.milliseconds, { value })
                }
              />
            </div>
          </List>
        </Paper>

        <Paper className="EyeTracking__section">
          <List>
            <ListItem>
              <ListItemText
                primary={
                  registeredDevice
                    ? intl.formatMessage(messages.deviceRegistered)
                    : intl.formatMessage(messages.deviceNotRegistered)
                }
                secondary={
                  registeredDevice
                    ? `${intl.formatMessage(messages.deviceName)}: ${
                        registeredDevice.device_name || 'Unknown'
                      }`
                    : intl.formatMessage(messages.calibrationRequiresDevice)
                }
              />
              <ListItemSecondaryAction>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleRegisterDevice}
                  disabled={!enabled}
                >
                  <FormattedMessage {...messages.registerDevice} />
                </Button>
              </ListItemSecondaryAction>
            </ListItem>

            <ListItem>
              <ListItemText
                primary={<FormattedMessage {...messages.calibrate} />}
                secondary={
                  registeredDevice
                    ? registeredDevice.calibrated
                      ? intl.formatMessage(messages.calibrationComplete)
                      : intl.formatMessage(messages.calibrationNeeded)
                    : intl.formatMessage(messages.calibrationRequiresDevice)
                }
              />
              <ListItemSecondaryAction>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={handleStartCalibration}
                  disabled={!canCalibrate}
                >
                  <FormattedMessage {...messages.startCalibration} />
                </Button>
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </Paper>

        {/* Scanning Settings Section (merged) */}
        <Paper className="EyeTracking__section">
          <List>
            <ListItem>
              <ListItemText
                primary={<FormattedMessage {...scanningMessages.enable} />}
                secondary={<FormattedMessage {...scanningMessages.enableSecondary} />}
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={scanningEnabled}
                  onChange={(event) => {
                    const newEnabled = event.target.checked;
                    setScanningEnabled(newEnabled);
                    if (onUpdateScanningSettings) {
                      onUpdateScanningSettings({
                        ...scanningSettings,
                        enabled: newEnabled
                      });
                    }
                  }}
                  color="primary"
                />
              </ListItemSecondaryAction>
            </ListItem>

            {/* Scanning Method (Automatic or Eye Tracking) */}
            <ListItem divider>
              <ListItemText
                primary={<FormattedMessage {...messages.scanningMethod} />}
                secondary={<FormattedMessage {...messages.scanningMethodSecondary} />}
              />
              <ListItemSecondaryAction>
                <Select
                  value={scanningMethod}
                  onChange={(event) => {
                    const newMethod = event.target.value;
                    setScanningMethod(newMethod);
                    if (onUpdateScanningSettings) {
                      onUpdateScanningSettings({
                        ...scanningSettings,
                        strategy: newMethod
                      });
                    }
                  }}
                  disabled={!scanningEnabled}
                >
                  <MenuItem value={SCANNING_METHOD_AUTOMATIC}>
                    <FormattedMessage {...messages.scanningMethodAutomatic} />
                  </MenuItem>
                  <MenuItem value="eye_tracking">
                    <FormattedMessage {...messages.scanningMethodEyeTracking} />
                  </MenuItem>
                </Select>
              </ListItemSecondaryAction>
            </ListItem>

            {/* Scanning Mode */}
            <ListItem divider>
              <ListItemText
                primary={<FormattedMessage {...scanningMessages.mode} />}
                secondary={<FormattedMessage {...scanningMessages.modeSecondary} />}
              />
              <ListItemSecondaryAction>
                <Select
                  value={scanningMode}
                  onChange={(event) => {
                    const newMode = event.target.value;
                    setScanningMode(newMode);
                    if (onUpdateScanningSettings) {
                      onUpdateScanningSettings({
                        ...scanningSettings,
                        mode: newMode
                      });
                    }
                  }}
                  disabled={!scanningEnabled}
                >
                  <MenuItem value={SCANNING_MODE_SINGLE}>
                    <FormattedMessage {...scanningMessages.modeSingle} />
                  </MenuItem>
                  <MenuItem value={SCANNING_MODE_ROW}>
                    <FormattedMessage {...scanningMessages.modeRow} />
                  </MenuItem>
                  <MenuItem value={SCANNING_MODE_COLUMN}>
                    <FormattedMessage {...scanningMessages.modeColumn} />
                  </MenuItem>
                  <MenuItem value={SCANNING_MODE_OPERATION}>
                    <FormattedMessage {...scanningMessages.modeOperation} />
                  </MenuItem>
                </Select>
              </ListItemSecondaryAction>
            </ListItem>

            {/* Scanning Speed */}
            <ListItem divider>
              <ListItemText
                primary={<FormattedMessage {...scanningMessages.speed} />}
                secondary={<FormattedMessage {...scanningMessages.speedSecondary} />}
              />
              <ListItemSecondaryAction>
                <TextField
                  type="number"
                  value={scanningSpeed}
                  onChange={(event) => {
                    const newValue = parseFloat(event.target.value) || MIN_SCANNING_SPEED;
                    const clampedValue = Math.max(MIN_SCANNING_SPEED, Math.min(MAX_SCANNING_SPEED, newValue));
                    setScanningSpeed(clampedValue);
                    if (onUpdateScanningSettings) {
                      onUpdateScanningSettings({
                        ...scanningSettings,
                        speed: clampedValue
                      });
                    }
                  }}
                  inputProps={{
                    min: MIN_SCANNING_SPEED,
                    max: MAX_SCANNING_SPEED,
                    step: SCANNING_SPEED_INCREMENT
                  }}
                  disabled={!scanningEnabled}
                  style={{ width: '80px', marginRight: '16px' }}
                />
              </ListItemSecondaryAction>
            </ListItem>
            <div className={classes.sliderContainer}>
              <Slider
                value={scanningSpeed}
                onChange={(event, newValue) => {
                  setScanningSpeed(newValue);
                  if (onUpdateScanningSettings) {
                    onUpdateScanningSettings({
                      ...scanningSettings,
                      speed: newValue
                    });
                  }
                }}
                min={MIN_SCANNING_SPEED}
                max={MAX_SCANNING_SPEED}
                step={SCANNING_SPEED_INCREMENT}
                disabled={!scanningEnabled}
                valueLabelDisplay="auto"
                valueLabelFormat={value => `${value}s`}
              />
            </div>

            {/* Loop Type */}
            <ListItem divider>
              <ListItemText
                primary={<FormattedMessage {...scanningMessages.loop} />}
                secondary={<FormattedMessage {...scanningMessages.loopSecondary} />}
              />
              <ListItemSecondaryAction>
                <Select
                  value={loopType}
                  onChange={(event) => {
                    const newLoop = event.target.value;
                    setLoopType(newLoop);
                    if (onUpdateScanningSettings) {
                      onUpdateScanningSettings({
                        ...scanningSettings,
                        loop: newLoop,
                        loop_count: newLoop === LOOP_FINITE ? loopCount : undefined
                      });
                    }
                  }}
                  disabled={!scanningEnabled}
                >
                  <MenuItem value={LOOP_FINITE}>
                    <FormattedMessage {...scanningMessages.finite} />
                  </MenuItem>
                  <MenuItem value={LOOP_INFINITE}>
                    <FormattedMessage {...scanningMessages.infinite} />
                  </MenuItem>
                </Select>
              </ListItemSecondaryAction>
            </ListItem>

            {/* Loop Count (only show for finite loops) */}
            {loopType === LOOP_FINITE && (
              <ListItem divider>
                <ListItemText
                  primary={<FormattedMessage {...scanningMessages.loopCount} />}
                  secondary={<FormattedMessage {...scanningMessages.loopCountSecondary} />}
                />
                <ListItemSecondaryAction>
                  <TextField
                    type="number"
                    value={loopCount}
                    onChange={(event) => {
                      const newCount = parseInt(event.target.value, 10) || DEFAULT_LOOP_COUNT;
                      setLoopCount(newCount);
                      if (onUpdateScanningSettings) {
                        onUpdateScanningSettings({
                          ...scanningSettings,
                          loop_count: newCount
                        });
                      }
                    }}
                    inputProps={{
                      min: MIN_LOOP_COUNT,
                      max: MAX_LOOP_COUNT,
                      step: 1
                    }}
                    disabled={!scanningEnabled}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            )}

            {/* Audio Guide */}
            <ListItem divider>
              <ListItemText
                primary={<FormattedMessage {...scanningMessages.audioGuide} />}
                secondary={<FormattedMessage {...scanningMessages.audioGuideSecondary} />}
              />
              <ListItemSecondaryAction>
                <Select
                  value={audioGuide}
                  onChange={(event) => {
                    const newAudioGuide = event.target.value;
                    setAudioGuide(newAudioGuide);
                    // Update accessibility settings with audio guide
                    const updatedAccessibility = {
                      ...accessibilitySettings,
                      audio_guide: newAudioGuide
                    };
                    // Update both scanning and accessibility settings
                    if (onUpdateScanningSettings) {
                      // The container will handle updating accessibility settings
                      onUpdateScanningSettings({
                        ...scanningSettings,
                        audio_guide: newAudioGuide
                      });
                    }
                  }}
                  disabled={!scanningEnabled}
                >
                  <MenuItem value={AUDIO_GUIDE_OFF}>
                    <FormattedMessage {...scanningMessages.audioGuideOff} />
                  </MenuItem>
                  <MenuItem value={AUDIO_GUIDE_BEEP}>
                    <FormattedMessage {...scanningMessages.audioGuideBeep} />
                  </MenuItem>
                  <MenuItem value={AUDIO_GUIDE_CARD_AUDIO}>
                    <FormattedMessage {...scanningMessages.audioGuideCardAudio} />
                  </MenuItem>
                </Select>
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </Paper>
      </div>

      {isCalibrating && (
        <CalibrationOverlay
          calibrationPoint={CALIBRATION_POINTS[calibrationStep]}
          onComplete={handleCalibrationPointComplete}
          onCancel={handleCancelCalibration}
          step={calibrationStep + 1}
          totalSteps={CALIBRATION_POINTS.length}
        />
      )}
    </FullScreenDialog>
  );
}

EyeTracking.propTypes = propTypes;

export default withStyles(styles)(EyeTracking);