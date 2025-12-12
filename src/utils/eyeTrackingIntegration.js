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
    this.cameraStream = null; // Keep reference to camera stream
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

    // Cleanup any existing tracker before initializing new one
    this.cleanup();

    try {
      // Detect and setup device based on type
      const deviceType = settings.deviceType || 'tobii';
      console.log('Initializing eye tracking with device type:', deviceType);
      
      switch (deviceType) {
        case 'tobii':
          await this.initializeTobii();
          break;
        case 'eyetribe':
          await this.initializeEyeTribe();
          break;
        case 'pupil':
          await this.initializePupil();
          break;
        case 'camera':
          await this.initializeCamera();
          break;
        default:
          console.warn('Unsupported eye tracking device type:', deviceType);
          // If device type is not recognized but enabled, try camera as fallback
          if (this.isEnabled) {
            console.log('Attempting to use camera as fallback...');
            await this.initializeCamera();
          }
      }
    } catch (error) {
      console.error('Failed to initialize eye tracking:', error);
      // Re-throw error so caller can handle it
      throw error;
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

  async initializeCamera() {
    try {
      // Wait for WebGazer to be loaded (since it's loaded with defer)
      let retries = 0;
      const maxRetries = 50; // Wait up to 5 seconds (50 * 100ms)
      
      while (typeof window.webgazer === 'undefined' && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }

      if (typeof window.webgazer === 'undefined') {
        console.error('WebGazer.js not loaded. Please include WebGazer.js library.');
        throw new Error('WebGazer.js library not found. Please refresh the page.');
      }

      // Get available cameras to prefer front-facing camera
      let videoConstraints = {
        video: {
          facingMode: 'user', // Prefer front-facing camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      // Try to get front camera, fallback to any camera
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        // Try to find front-facing camera
        const frontCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('front') || 
          device.label.toLowerCase().includes('facing') ||
          device.label.toLowerCase().includes('user')
        );

        if (frontCamera) {
          videoConstraints.video.deviceId = { exact: frontCamera.deviceId };
          console.log('Using front-facing camera:', frontCamera.label);
        } else if (videoDevices.length > 0) {
          // Use first available camera
          videoConstraints.video.deviceId = { exact: videoDevices[0].deviceId };
          console.log('Using camera:', videoDevices[0].label);
        }
      } catch (err) {
        console.warn('Could not enumerate devices, using default constraints:', err);
      }

      // Register device first
      try {
        await API.registerEyeTrackingDevice({
          device_type: 'camera',
          device_name: 'Web Camera Eye Tracker',
          device_id: 'camera_' + Date.now()
        });
        console.log('Camera device registered');
      } catch (e) {
        console.log('Device registration:', e.message);
      }

      // Configure WebGazer with camera settings
      // WebGazer will request camera access itself
      window.webgazer
        .setRegression('ridge') // Use ridge regression for better accuracy
        .setGazeListener((data, elapsedTime) => {
          if (data == null) {
            return;
          }
          
          // WebGazer returns gaze position in screen coordinates
          const x = data.x;
          const y = data.y;
          
          // Only process valid coordinates
          if (x >= 0 && y >= 0 && x <= window.innerWidth && y <= window.innerHeight) {
            this.handleGaze(x, y);
          }
        })
        .saveDataAcrossSessions(false) // Don't save calibration data
        .showVideoPreview(false) // Hide video preview by default (can be enabled for debugging)
        .showPredictionPoints(false) // Hide prediction points by default
        .begin()
        .then(() => {
          console.log('WebGazer camera eye tracking initialized successfully');
          this.tracker = window.webgazer;
          
          // Wait a bit for WebGazer to set up the video element
          setTimeout(() => {
            // Get the video element that WebGazer creates to access the stream
            const videoElement = document.getElementById('webgazerVideoFeed');
            if (videoElement) {
              if (videoElement.srcObject) {
                this.cameraStream = videoElement.srcObject;
                console.log('Camera stream active:', this.cameraStream.active);
                
                // Verify camera is actually streaming
                const tracks = this.cameraStream.getVideoTracks();
                if (tracks.length > 0) {
                  console.log('Camera track active:', {
                    label: tracks[0].label,
                    enabled: tracks[0].enabled,
                    readyState: tracks[0].readyState
                  });
                }
              }
              
              // Log video element status
              console.log('WebGazer video element:', {
                videoWidth: videoElement.videoWidth,
                videoHeight: videoElement.videoHeight,
                playing: !videoElement.paused,
                readyState: videoElement.readyState
              });
            } else {
              console.warn('WebGazer video element not found - camera may not be active');
            }
          }, 2000); // Wait 2 seconds for WebGazer to initialize
        })
        .catch(error => {
          console.error('WebGazer initialization error:', error);
          throw new Error('Failed to initialize WebGazer: ' + error.message);
        });

    } catch (error) {
      console.error('Camera eye tracking initialization error:', error);
      throw error;
    }
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
    if (this.tracker) {
      // Handle different tracker types
      if (this.tracker.off) {
        // Tobii/EyeTribe style
        this.tracker.off('gaze');
      } else if (this.tracker.pause) {
        // WebGazer style
        this.tracker.pause();
      } else if (this.tracker.end) {
        // WebGazer alternative
        this.tracker.end();
      }
    }
    
    // Stop camera stream if it exists
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => {
        track.stop();
        console.log('Camera track stopped:', track.kind);
      });
      this.cameraStream = null;
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

