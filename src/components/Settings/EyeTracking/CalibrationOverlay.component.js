import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  // phase: 'idle' | 'countdown' | 'calibrating'
  const [phase, setPhase] = useState('idle');
  const [countdown, setCountdown] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  const pointStyle = useMemo(
    () => ({
      left: `${calibrationPoint.x * 100}%`,
      top: `${calibrationPoint.y * 100}%`
    }),
    [calibrationPoint.x, calibrationPoint.y]
  );

  // Reset state when step changes (and clean up timers)
  useEffect(() => {
    // Clear any running timers when moving to a new step
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPhase('idle');
    setCountdown(0);
    setHasStarted(false);
  }, [step]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleStartCalibration = () => {
    if (phase !== 'idle') return; // guard against double-start
    setHasStarted(true);
    setPhase('countdown');
    setCountdown(3); // Collect for 3 seconds

    // Countdown timer
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // End countdown and enter calibrating phase
          clearInterval(intervalRef.current);
          intervalRef.current = null;

          setPhase('calibrating');

          // Show "Calibrating..." briefly, then auto-complete
          timeoutRef.current = setTimeout(() => {
            timeoutRef.current = null;
            setPhase('idle'); // Reset local phase before moving on
            onComplete();
          }, 500);

          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const isCollecting = phase === 'countdown' || phase === 'calibrating';

  return (
    <div className="EyeTracking__calibration-overlay">
      <div>
        <div className="EyeTracking__calibration-instructions" aria-live="polite">
          <FormattedMessage
            id="cboard.components.Settings.EyeTracking.calibrationInstructions"
            defaultMessage="Look at the blue dot. Step {step} of {total}"
            values={{ step, total: totalSteps }}
          />
          {phase === 'countdown' && countdown > 0 && (
            <div style={{ marginTop: '16px', fontSize: '24px', fontWeight: 'bold' }}>
              {countdown}
            </div>
          )}
          {phase === 'calibrating' && (
            <div style={{ marginTop: '16px', fontSize: '18px' }}>
              <FormattedMessage
                id="cboard.components.Settings.EyeTracking.calibrating"
                defaultMessage="Calibrating..."
              />
            </div>
          )}
        </div>

        <div className="EyeTracking__calibration-point" style={pointStyle} />

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          {phase === 'idle' && !hasStarted && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleStartCalibration}
              style={{ marginRight: '8px' }}
            >
              <FormattedMessage
                id="cboard.components.Settings.EyeTracking.startPointCalibration"
                defaultMessage="Start Calibration"
              />
            </Button>
          )}

          {/* Optional manual completion after start, when not actively collecting */}
          {phase === 'idle' && hasStarted && (
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
          )}

          {/* Cancel only when not collecting to match original behavior */}
          {!isCollecting && (
            <Button variant="outlined" onClick={onCancel}>
              <FormattedMessage
                id="cboard.components.Settings.EyeTracking.cancel"
                defaultMessage="Cancel"
              />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

CalibrationOverlay.propTypes = propTypes;

export default CalibrationOverlay;