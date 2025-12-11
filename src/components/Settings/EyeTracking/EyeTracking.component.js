import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, intlShape } from 'react-intl';
import { withStyles } from '@material-ui/core/styles';
import Switch from '@material-ui/core/Switch';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import Slider from '@material-ui/core/Slider';
import Paper from '@material-ui/core/Paper';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import Button from '@material-ui/core/Button';
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
import CalibrationOverlay from './CalibrationOverlay.component';

import './EyeTracking.css';

const propTypes = {
  onClose: PropTypes.func,
  updateEyeTrackingSettings: PropTypes.func,
  eyeTrackingSettings: PropTypes.object,
  registeredDevice: PropTypes.object,
  onRegisterDevice: PropTypes.func,
  onCalibrate: PropTypes.func,
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
  onRegisterDevice,
  onCalibrate,
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

  const handleStartCalibration = () => {
    setIsCalibrating(true);
    setCalibrationStep(0);
  };

  const handleCalibrationPointComplete = async () => {
    if (calibrationStep < CALIBRATION_POINTS.length - 1) {
      setCalibrationStep(calibrationStep + 1);
    } else {
      // Calibration complete
      try {
        if (registeredDevice && registeredDevice.device_id) {
          await onCalibrate(registeredDevice.device_id, {
            calibration_points: CALIBRATION_POINTS,
            completed_at: new Date().toISOString()
          });
        }
        setIsCalibrating(false);
        setCalibrationStep(0);
      } catch (error) {
        console.error('Calibration failed:', error);
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

            <ListItem>
              <ListItemText
                primary={<FormattedMessage {...messages.deviceType} />}
                secondary={
                  <FormattedMessage {...messages.deviceTypeSecondary} />
                }
              />
              <ListItemSecondaryAction>
                <Select
                  value={deviceType}
                  onChange={handleDeviceTypeChange}
                  disabled={!enabled}
                >
                  <MenuItem value={EYE_TRACKING_DEVICE_TYPES.TOBII}>
                    <FormattedMessage {...messages.tobii} />
                  </MenuItem>
                  <MenuItem value={EYE_TRACKING_DEVICE_TYPES.EYETRIBE}>
                    <FormattedMessage {...messages.eyetribe} />
                  </MenuItem>
                  <MenuItem value={EYE_TRACKING_DEVICE_TYPES.PUPIL}>
                    <FormattedMessage {...messages.pupil} />
                  </MenuItem>
                  <MenuItem value={EYE_TRACKING_DEVICE_TYPES.CUSTOM}>
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
                    : intl.formatMessage(messages.deviceNotRegistered)
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

            {registeredDevice && (
              <ListItem>
                <ListItemText
                  primary={<FormattedMessage {...messages.calibrate} />}
                  secondary={
                    registeredDevice.calibrated
                      ? intl.formatMessage(messages.calibrationComplete)
                      : intl.formatMessage(messages.calibrationFailed)
                  }
                />
                <ListItemSecondaryAction>
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={handleStartCalibration}
                    disabled={!enabled || !registeredDevice}
                  >
                    <FormattedMessage {...messages.startCalibration} />
                  </Button>
                </ListItemSecondaryAction>
              </ListItem>
            )}
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

