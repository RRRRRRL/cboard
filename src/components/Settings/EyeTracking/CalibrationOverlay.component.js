import React from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import Button from '@material-ui/core/Button';
import './EyeTracking.css';

const propTypes = {
  calibrationPoint: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired
  }).isRequired,
  onComplete: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  step: PropTypes.number.isRequired,
  totalSteps: PropTypes.number.isRequired
};

function CalibrationOverlay({
  calibrationPoint,
  onComplete,
  onCancel,
  step,
  totalSteps
}) {
  const pointStyle = {
    left: `${calibrationPoint.x * 100}%`,
    top: `${calibrationPoint.y * 100}%`
  };

  return (
    <div className="EyeTracking__calibration-overlay">
      <div>
        <div className="EyeTracking__calibration-instructions">
          <FormattedMessage
            id="cboard.components.Settings.EyeTracking.calibrationInstructions"
            defaultMessage="Look at the blue dot. Step {step} of {total}"
            values={{ step, total: totalSteps }}
          />
        </div>
        <div className="EyeTracking__calibration-point" style={pointStyle} />
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={onComplete}
            style={{ marginRight: '8px' }}
          >
            <FormattedMessage
              id="cboard.components.Settings.EyeTracking.pointComplete"
              defaultMessage="Point Complete"
            />
          </Button>
          <Button variant="outlined" onClick={onCancel}>
            <FormattedMessage
              id="cboard.components.Settings.EyeTracking.cancel"
              defaultMessage="Cancel"
            />
          </Button>
        </div>
      </div>
    </div>
  );
}

CalibrationOverlay.propTypes = propTypes;

export default CalibrationOverlay;

