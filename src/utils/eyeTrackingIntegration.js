import { EyeTrackingDetector } from './deviceDetection';
import API from '../api';

/**
 * Eye Tracking Integration Utility
 * Handles initialization and gaze tracking for eye tracking devices
 */

class EyeTrackingIntegration {
  constructor() {
    this.tracker = null;
    this.isEnabled = false;
    this.dwellTime = 1000; // milliseconds
    this.currentGazeTarget = null;
    this.dwellStartTime = null;
    this.onDwellCallback = null;
    this.onGazeCallback = null;
  }

  /**
   * Initialize eye tracking
   * @param {Object} settings - Eye tracking settings { enabled, deviceType, dwellTime }
   * @param {Function} onDwell - Callback when dwell time is reached
   * @param {Function} onGaze - Optional callback for gaze position updates
   */
  async initialize(settings, onDwell, onGaze = null) {
    this.isEnabled = settings.enabled || false;
    this.dwellTime = settings.dwellTime || 1000;
    this.onDwellCallback = onDwell;
    this.onGazeCallback = onGaze;

    if (!this.isEnabled) {
      this.cleanup();
      return;
    }

    try {
      // Detect and setup device based on type
      switch (settings.deviceType) {
        case 'tobii':
          await this.initializeTobii();
          break;
        case 'eyetribe':
          await this.initializeEyeTribe();
          break;
        case 'pupil':
          await this.initializePupil();
          break;
        default:
          console.warn('Unsupported eye tracking device type:', settings.deviceType);
      }
    } catch (error) {
      console.error('Failed to initialize eye tracking:', error);
    }
  }

  async initializeTobii() {
    try {
      const deviceInfo = await EyeTrackingDetector.detectTobiiDevice();
      if (!deviceInfo) {
        console.warn('Tobii device not detected');
        return;
      }

      // Register device if not already registered
      try {
        await API.registerEyeTrackingDevice({
          device_type: 'tobii',
          device_name: deviceInfo.device_name,
          device_id: deviceInfo.device_id
        });
      } catch (e) {
        // Device might already be registered
        console.log('Device registration:', e.message);
      }

      // Setup gaze tracking
      if (window.Tobii && window.Tobii.createTracker) {
        this.tracker = await window.Tobii.createTracker();
        EyeTrackingDetector.setupGazeTracking(
          this.tracker,
          this.handleGaze.bind(this),
          this.handleDwell.bind(this)
        );
        console.log('Tobii eye tracking initialized');
      }
    } catch (error) {
      console.error('Tobii initialization error:', error);
    }
  }

  async initializeEyeTribe() {
    // Placeholder for EyeTribe integration
    console.warn('EyeTribe integration not yet implemented');
  }

  async initializePupil() {
    // Placeholder for Pupil Labs integration
    console.warn('Pupil Labs integration not yet implemented');
  }

  handleGaze(x, y) {
    if (this.onGazeCallback) {
      this.onGazeCallback(x, y);
    }

    // Detect which tile is being gazed at
    const element = document.elementFromPoint(x, y);
    if (!element) {
      this.resetDwell();
      return;
    }

    const tileElement = element.closest('.Tile');
    if (!tileElement) {
      this.resetDwell();
      return;
    }

    const tileId = tileElement.dataset?.tileId || tileElement.id;
    if (!tileId) {
      this.resetDwell();
      return;
    }

    // Check if we're still gazing at the same tile
    if (this.currentGazeTarget === tileId) {
      const dwellDuration = Date.now() - this.dwellStartTime;
      if (dwellDuration >= this.dwellTime) {
        this.handleDwell(tileId, x, y, dwellDuration);
        this.resetDwell();
      }
    } else {
      // New tile, start dwell timer
      this.currentGazeTarget = tileId;
      this.dwellStartTime = Date.now();
    }
  }

  handleDwell(tileId, x, y, dwellDuration) {
    if (this.onDwellCallback) {
      this.onDwellCallback({
        tileId,
        x,
        y,
        dwellDuration
      });
    }

    // Log selection to backend
    try {
      API.selectCardViaEyeTracking({
        card_id: tileId,
        gaze_x: x,
        gaze_y: y,
        dwell_time: dwellDuration / 1000 // Convert to seconds
      }).catch(err => {
        console.error('Failed to log eye tracking selection:', err);
      });
    } catch (error) {
      console.error('Error logging eye tracking selection:', error);
    }
  }

  resetDwell() {
    this.currentGazeTarget = null;
    this.dwellStartTime = null;
  }

  cleanup() {
    if (this.tracker && this.tracker.off) {
      this.tracker.off('gaze');
    }
    this.tracker = null;
    this.resetDwell();
  }

  updateSettings(settings) {
    this.isEnabled = settings.enabled || false;
    this.dwellTime = settings.dwellTime || 1000;

    if (!this.isEnabled) {
      this.cleanup();
    }
  }
}

// Singleton instance
let eyeTrackingInstance = null;

export function getEyeTrackingInstance() {
  if (!eyeTrackingInstance) {
    eyeTrackingInstance = new EyeTrackingIntegration();
  }
  return eyeTrackingInstance;
}

export default EyeTrackingIntegration;

