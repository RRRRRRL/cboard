import { EyeTrackingDetector } from './deviceDetection';
import API from '../api';
import { initializeModelConfig } from './webgazerModelConfig';
import EyeTrackingScanner from './eyeTrackingScanner';

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
    this.gazeIndicator = null;
    this.gazeIndicatorFadeTimer = null;
    
    // Eye-tracking driven scanning properties
    this.eyeTrackingScanner = new EyeTrackingScanner();
    this.scanningSettings = null;
    this.scanningTiles = [];
    this.scanningNavigationData = null;
    // Row/Column scanning state
    this.scanningSubState = 'row_col'; // 'row_col' or 'cards' - tracks if we're scanning rows/cols or cards within a row/col
    this.selectedRowCol = null; // row/col selection state
    this.selectedRowColBounds = null; // { minX, maxX, minY, maxY } for restricting gaze indicator
    this.rowColOverlay = null; // DOM overlay for visualizing whole row/column
    // Row/Column overlay for visual feedback
    this.rowColOverlay = null;
    this.selectedRowColBounds = null; // { minX, maxX, minY, maxY } for restricting gaze indicator

    // Global listener: when settings page disables eye tracking, clean up immediately
    if (typeof window !== 'undefined' && !window.__cboardEyeTrackingDisableListenerAdded) {
      window.addEventListener('cboard:eyeTrackingDisabled', () => {
        if (this.isEnabled) {
          console.log('[EyeTracking] Global disable event received, cleaning up...');
          this.cleanup();
        }
      });
      window.__cboardEyeTrackingDisableListenerAdded = true;
    }
  }

  /**
   * Initialize eye tracking
   * @param {Object} settings - Eye tracking settings { enabled, deviceType, dwellTime, device }
   * @param {Function} onDwell - Callback when dwell time is reached
   * @param {Function} onGaze - Optional callback for gaze position updates
   */
  async initialize(settings, onDwell, onGaze = null) {
    const shouldBeEnabled = settings.enabled || false;
    this.dwellTime = settings.dwellTime || 1000;
    this.onDwellCallback = onDwell;
    this.onGazeCallback = onGaze;

    // If disabled, immediately cleanup and return - do NOT start camera
    if (!shouldBeEnabled) {
      console.log('[EyeTracking] Eye tracking is disabled, cleaning up and NOT starting camera');
      // Only set isEnabled to false if we're actually disabling
      this.isEnabled = false;
      await this.cleanup();
      return;
    }

    // Cleanup any existing tracker before initializing new one
    // Save the enabled state before cleanup (cleanup sets isEnabled to false)
    const wasEnabled = this.isEnabled;
    await this.cleanup();
    
    // Restore enabled state after cleanup
    this.isEnabled = shouldBeEnabled;
    console.log('[EyeTracking] After cleanup, isEnabled set to:', this.isEnabled);
    
    // Create gaze indicator when eye tracking is enabled
    this.createGazeIndicator();

    try {
      // Try to automatically detect and use saved device configuration
      let deviceType = settings.deviceType || 'tobii';
      let deviceId = settings.device || settings.device_id || null;
      
      // If we have a saved device ID, try to verify it's still connected
      if (deviceId && settings.device) {
        console.log('[EyeTracking] Found saved device configuration, verifying device connection...');
        const deviceConnected = await this.verifySavedDevice(deviceType, deviceId);
        
        if (deviceConnected) {
          console.log('[EyeTracking] ✓ Saved device is connected, using saved configuration');
          // Device is connected, use saved configuration
        } else {
          console.log('[EyeTracking] Saved device not found, will attempt auto-detection');
          // Try to auto-detect any connected device
          const detectedDevice = await this.autoDetectDevice();
          if (detectedDevice) {
            deviceType = detectedDevice.deviceType;
            deviceId = detectedDevice.deviceId;
            console.log('[EyeTracking] Auto-detected device:', deviceType);
          }
        }
      } else {
        // No saved device, try to auto-detect
        console.log('[EyeTracking] No saved device configuration, attempting auto-detection...');
        const detectedDevice = await this.autoDetectDevice();
        if (detectedDevice) {
          deviceType = detectedDevice.deviceType;
          deviceId = detectedDevice.deviceId;
          console.log('[EyeTracking] Auto-detected device:', deviceType);
        }
      }
      
      console.log('[EyeTracking] Initializing eye tracking with device type:', deviceType);
      
      switch (deviceType) {
        case 'tobii':
          await this.initializeTobii(deviceId);
          break;
        case 'eyetribe':
          await this.initializeEyeTribe(deviceId);
          break;
        case 'pupil':
          await this.initializePupil(deviceId);
          break;
        case 'camera':
          await this.initializeCamera(deviceId);
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

  /**
   * Verify if a saved device is still connected
   * @param {string} deviceType - Device type (tobii, camera, etc.)
   * @param {string} deviceId - Saved device ID
   * @returns {Promise<boolean>} - True if device is connected
   */
  async verifySavedDevice(deviceType, deviceId) {
    try {
      if (deviceType === 'tobii') {
        if (typeof window.Tobii === 'undefined') {
          return false;
        }
        const deviceInfo = await EyeTrackingDetector.detectTobiiDevice();
        return deviceInfo && (deviceInfo.device_id === deviceId || !deviceId);
      } else if (deviceType === 'camera') {
        // For camera, check if any camera is available (camera IDs can change)
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        return videoDevices.length > 0;
      } else if (deviceType === 'eyetribe') {
        return typeof window.EyeTribe !== 'undefined' || typeof window.eyetribe !== 'undefined';
      }
      return false;
    } catch (error) {
      console.debug('[EyeTracking] Error verifying saved device:', error);
      return false;
    }
  }

  /**
   * Auto-detect any connected eye tracking device
   * @returns {Promise<Object|null>} - Detected device info or null
   */
  async autoDetectDevice() {
    try {
      // Try Tobii first
      if (typeof window.Tobii !== 'undefined') {
        const tobiiDevice = await EyeTrackingDetector.detectTobiiDevice();
        if (tobiiDevice) {
          return {
            deviceType: 'tobii',
            deviceId: tobiiDevice.device_id,
            deviceName: tobiiDevice.device_name
          };
        }
      }
      
      // Try camera
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        if (videoDevices.length > 0) {
          return {
            deviceType: 'camera',
            deviceId: videoDevices[0].deviceId || 'camera_default',
            deviceName: videoDevices[0].label || 'Web Camera'
          };
        }
      } catch (err) {
        // Camera detection failed, continue
      }
      
      // Try EyeTribe
      if (typeof window.EyeTribe !== 'undefined' || typeof window.eyetribe !== 'undefined') {
        return {
          deviceType: 'eyetribe',
          deviceId: 'eyetribe_default',
          deviceName: 'EyeTribe Tracker'
        };
      }
      
      return null;
    } catch (error) {
      console.debug('[EyeTracking] Error in auto-detection:', error);
      return null;
    }
  }

  async initializeTobii(savedDeviceId = null) {
    try {
      const deviceInfo = await EyeTrackingDetector.detectTobiiDevice();
      if (!deviceInfo) {
        console.warn('Tobii device not detected');
        return;
      }

      // Register device if not already registered (or update if device ID changed)
      // This ensures the device is recognized for next time
      try {
        await API.registerEyeTrackingDevice({
          device_type: 'tobii',
          device_name: deviceInfo.device_name,
          device_id: deviceInfo.device_id || savedDeviceId
        });
        console.log('[EyeTracking] ✓ Tobii device registered/recognized for future use');
      } catch (e) {
        // Device might already be registered - this is fine
        const isNetworkError = e.code === 'ERR_NETWORK' || e.message === 'Network Error';
        if (!isNetworkError) {
          console.log('[EyeTracking] Device registration status:', e.message);
        }
      }

      // Setup gaze tracking
      if (window.Tobii && window.Tobii.createTracker) {
        this.tracker = await window.Tobii.createTracker();
        EyeTrackingDetector.setupGazeTracking(
          this.tracker,
          this.handleGaze.bind(this),
          this.handleDwell.bind(this)
        );
        console.log('[EyeTracking] ✓ Tobii eye tracking initialized');
      }
    } catch (error) {
      console.error('Tobii initialization error:', error);
    }
  }

  async initializeEyeTribe(savedDeviceId = null) {
    // Placeholder for EyeTribe integration
    console.warn('EyeTribe integration not yet implemented');
    // TODO: Implement EyeTribe device registration
    try {
      await API.registerEyeTrackingDevice({
        device_type: 'eyetribe',
        device_name: 'EyeTribe Tracker',
        device_id: savedDeviceId || 'eyetribe_default'
      });
    } catch (e) {
      console.log('[EyeTracking] EyeTribe device registration:', e.message);
    }
  }

  async initializePupil(savedDeviceId = null) {
    // Placeholder for Pupil Labs integration
    console.warn('Pupil Labs integration not yet implemented');
    // TODO: Implement Pupil device registration
    try {
      await API.registerEyeTrackingDevice({
        device_type: 'pupil',
        device_name: 'Pupil Labs Tracker',
        device_id: savedDeviceId || 'pupil_default'
      });
    } catch (e) {
      console.log('[EyeTracking] Pupil device registration:', e.message);
    }
  }

  async initializeCamera(savedDeviceId = null) {
    // Double-check that eye tracking is still enabled before starting camera
    // This prevents camera from starting if user disables it during initialization
    if (!this.isEnabled) {
      console.log('[EyeTracking] Eye tracking disabled during camera initialization, aborting');
      await this.cleanup();
      return;
    }
    console.log('[EyeTracking] ===== Starting camera initialization =====');
    try {
      // Configure TensorFlow.js to use local models (before WebGazer loads them)
      console.log('[EyeTracking] Step 0: Configuring local model URLs...');
      try {
        initializeModelConfig();
        // Wait a bit for TensorFlow.js to be ready (if it's still loading)
        // This helps prevent "Requested texture size [0x0] is invalid" errors
        if (typeof window.tf === 'undefined') {
          console.log('[EyeTracking] Waiting for TensorFlow.js to load...');
          let tfRetries = 0;
          const maxTfRetries = 30; // Wait up to 3 seconds
          while (typeof window.tf === 'undefined' && tfRetries < maxTfRetries) {
            await new Promise(resolve => setTimeout(resolve, 100));
            tfRetries++;
          }
          if (typeof window.tf !== 'undefined') {
            console.log('[EyeTracking] ✓ TensorFlow.js loaded');
          } else {
            console.warn('[EyeTracking] ⚠️ TensorFlow.js not loaded after 3 seconds, proceeding anyway');
          }
        }
      } catch (configError) {
        console.warn('[EyeTracking] Model configuration warning:', configError.message);
        // Continue anyway - WebGazer may still work with cached models
      }
      
      // Wait for WebGazer to be loaded (local file, should load quickly)
      // WebGazer.js is loaded from public/webgazer.js (not from CDN)
      console.log('[EyeTracking] Step 1: Checking if WebGazer.js is loaded...');
      let retries = 0;
      const maxRetries = 50; // Wait up to 5 seconds (50 * 100ms) - local file loads faster
      
      // Check if script tag exists in DOM
      const webgazerScript = document.querySelector('script[src*="webgazer.js"]');
      if (!webgazerScript) {
        console.warn('[EyeTracking] ⚠️ WebGazer.js script tag not found in HTML. Please check public/index.html');
      } else {
        console.log('[EyeTracking] ✓ WebGazer.js script tag found in HTML');
      }
      
      console.log('[EyeTracking] Waiting for window.webgazer to be available...');
      while (typeof window.webgazer === 'undefined' && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
        if (retries % 10 === 0) {
          console.log(`[EyeTracking] Still waiting for WebGazer... (${retries * 100}ms)`);
        }
      }

      if (typeof window.webgazer === 'undefined') {
        console.error('[EyeTracking] ❌ WebGazer.js not loaded after', maxRetries * 100, 'ms.');
        console.error('[EyeTracking] Please check:');
        console.error('[EyeTracking] 1. webgazer.js exists in public/ folder');
        console.error('[EyeTracking] 2. Script tag is present in public/index.html');
        console.error('[EyeTracking] 3. Browser console for any loading errors');
        throw new Error('WebGazer.js library not found. Please ensure webgazer.js is in the public folder and refresh the page.');
      }
      
      console.log('[EyeTracking] ✓ WebGazer.js loaded successfully from local file');

      // Verify camera is available before registering
      console.log('[EyeTracking] Step 2: Verifying camera availability...');
      let cameraVerified = false;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log(`[EyeTracking] Found ${videoDevices.length} video input device(s)`);
        if (videoDevices.length === 0) {
          console.warn('[EyeTracking] ⚠️ No camera devices found - skipping device registration');
        } else {
          // Try to access camera to verify it's actually working
          console.log('[EyeTracking] Testing camera access...');
          const testStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const tracks = testStream.getVideoTracks();
          if (tracks.length > 0 && tracks[0].readyState === 'live') {
            cameraVerified = true;
            console.log('[EyeTracking] ✓ Camera verified and working');
            // Stop the test stream
            tracks.forEach(track => track.stop());
          } else {
            console.warn('[EyeTracking] ⚠️ Camera stream not active - skipping device registration');
          }
        }
      } catch (err) {
        console.warn('[EyeTracking] ⚠️ Camera verification failed - skipping device registration:', err.message);
      }

      // Register device only if camera is verified
      // Use saved device ID if available, otherwise generate new one
      if (cameraVerified) {
        // Set timeout for device registration (5 seconds)
        Promise.race([
          API.registerEyeTrackingDevice({
            device_type: 'camera',
            device_name: 'Web Camera Eye Tracker',
            device_id: savedDeviceId || 'camera_' + Date.now()
          }).catch(error => {
            // Suppress network errors - device registration is not critical for WebGazer to work
            const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error';
            const isVerificationError = error.message && error.message.includes('connection verification');
            if (!isNetworkError || navigator.onLine) {
              if (isVerificationError) {
                console.warn('Device registration skipped - camera not verified:', error.message);
              } else {
                console.warn('Device registration failed (non-critical):', error.message || error);
              }
            }
            // Don't throw - allow WebGazer to continue initializing
            return null;
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Device registration timeout')), 5000)
          )
        ]).catch(() => {
          // Timeout is not critical - WebGazer can work without registration
          console.log('Device registration timed out - continuing with WebGazer initialization');
        });
      } else {
        console.log('Camera not verified - skipping device registration');
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
      // Note: We need to request permission first before we can enumerate devices with labels
      try {
        // First, request basic permission to enumerate devices with labels
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach(track => track.stop());
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length > 0) {
          // Try to find front-facing camera
          const frontCamera = videoDevices.find(device => {
            const label = device.label.toLowerCase();
            return label.includes('front') || 
                   label.includes('facing') ||
                   label.includes('user') ||
                   label.includes('integrated');
          });

          if (frontCamera && frontCamera.deviceId) {
            // Use ideal instead of exact to allow fallback
            videoConstraints.video.deviceId = { ideal: frontCamera.deviceId };
            console.log('Preferring front-facing camera:', frontCamera.label || frontCamera.deviceId);
          } else if (videoDevices[0] && videoDevices[0].deviceId) {
            // Use first available camera with ideal constraint
            videoConstraints.video.deviceId = { ideal: videoDevices[0].deviceId };
            console.log('Using camera:', videoDevices[0].label || videoDevices[0].deviceId);
          }
        }
      } catch (err) {
        console.warn('Could not enumerate devices, using default constraints:', err.message);
        // Continue with default constraints (facingMode: 'user')
      }

      // Request camera access with proper error handling
      console.log('[EyeTracking] Step 3: Requesting camera access...');
      
      // Check again before requesting camera - user might have disabled it
      if (!this.isEnabled) {
        console.log('[EyeTracking] Eye tracking disabled before camera request, aborting');
        await this.cleanup();
        return;
      }
      
      let userMediaStream = null;
      let cameraPermissionGranted = false;
      
      try {
        console.log('[EyeTracking] Requesting camera access with constraints:', JSON.stringify(videoConstraints, null, 2));
        userMediaStream = await navigator.mediaDevices.getUserMedia(videoConstraints);
        
        // Check again after camera access is granted - user might have disabled it during request
        if (!this.isEnabled) {
          console.log('[EyeTracking] Eye tracking disabled after camera access granted, stopping camera');
          userMediaStream.getTracks().forEach(track => track.stop());
          await this.cleanup();
          return;
        }
        
        console.log('[EyeTracking] ✓ Camera access request successful');
        
        const tracks = userMediaStream.getVideoTracks();
        if (tracks.length === 0) {
          throw new Error('No video tracks in stream');
        }
        
        const track = tracks[0];
        if (track.readyState !== 'live') {
          throw new Error(`Camera track not live: ${track.readyState}`);
        }
        
        console.log('[EyeTracking] ✓ Camera access granted:', {
          active: userMediaStream.active,
          tracks: tracks.length,
          trackLabel: track.label || 'Unknown',
          trackReadyState: track.readyState,
          trackEnabled: track.enabled
        });
        
        cameraPermissionGranted = true;
        
        // Store the stream reference but don't stop it yet
        // WebGazer will need camera access, so we'll pass the stream or let it request its own
        this.cameraStream = userMediaStream;
        console.log('[EyeTracking] Camera stream stored. Will keep it active for WebGazer initialization.');
        
        // Note: We keep the stream active for now. WebGazer may reuse it or request its own.
        // If WebGazer requests its own, we'll stop this one.
        
      } catch (mediaError) {
        console.error('[EyeTracking] ❌ Camera access error occurred');
        const errorName = mediaError.name || 'UnknownError';
        const errorMessage = mediaError.message || String(mediaError);
        
        console.error('❌ Failed to get camera access:', {
          name: errorName,
          message: errorMessage,
          constraints: videoConstraints
        });
        
        // Provide user-friendly error messages
        let userMessage = 'Camera access failed';
        if (errorName === 'NotAllowedError' || errorMessage.includes('permission')) {
          userMessage = 'Camera permission denied. Please allow camera access in your browser settings.';
        } else if (errorName === 'NotFoundError' || errorMessage.includes('no device')) {
          userMessage = 'No camera found. Please connect a camera and try again.';
        } else if (errorName === 'NotReadableError' || errorMessage.includes('busy')) {
          userMessage = 'Camera is busy or already in use by another application.';
        } else if (errorName === 'OverconstrainedError') {
          userMessage = 'Camera constraints not supported. Trying with default settings...';
          // Try again with simpler constraints
          try {
            const simpleConstraints = { video: true };
            console.log('Retrying with simple constraints:', simpleConstraints);
            userMediaStream = await navigator.mediaDevices.getUserMedia(simpleConstraints);
            cameraPermissionGranted = true;
            this.cameraStream = userMediaStream;
            console.log('✓ Camera access granted with simple constraints');
          } catch (retryError) {
            throw new Error(`${userMessage} (Retry also failed: ${retryError.message})`);
          }
        } else {
          throw new Error(`${userMessage}: ${errorMessage}`);
        }
        
        if (!cameraPermissionGranted) {
          throw new Error(userMessage);
        }
      }

      // Configure WebGazer with camera settings
      // WebGazer will request camera access itself
      console.log('[EyeTracking] Step 4: Starting WebGazer initialization...');
      return new Promise((resolve, reject) => {
        // Set timeout for WebGazer initialization (20 seconds)
        const initTimeout = setTimeout(() => {
          console.warn('[EyeTracking] ⚠️ WebGazer initialization timeout - continuing anyway');
          // Don't reject, just resolve to allow app to continue
          resolve();
        }, 20000);

        try {
          // Check if webgazer is available (should be loaded from local file)
          if (!window.webgazer) {
            clearTimeout(initTimeout);
            console.error('[EyeTracking] ❌ WebGazer is not available. Check browser console for loading errors.');
            reject(new Error('WebGazer is not loaded. Please ensure webgazer.js is in the public folder and refresh the page.'));
            return;
          }
          
          console.log('[EyeTracking] Initializing WebGazer from local file...');

          // Configure WebGazer according to official documentation
          // Reference: https://webgazer.cs.brown.edu/
          // Important: Method chaining order matters - setGazeListener must be before begin()
          // Wrap in try-catch to handle any initialization errors gracefully
          try {
            // Don't stop the camera stream yet - let WebGazer initialize first
            // WebGazer will request its own stream, and we'll stop our test stream after WebGazer is ready
            console.log('Starting WebGazer initialization...');
            if (this.cameraStream && this.cameraStream.active) {
              console.log('Test camera stream is active - WebGazer will request its own stream');
            }
            
            // Ensure video element exists and has explicit dimensions before WebGazer begins
            // This prevents "Requested texture size [0x0] is invalid" errors
            const ensureVideoElementReady = () => {
              return new Promise((resolveVideo) => {
                // Wait for WebGazer to create the video element
                const checkVideo = setInterval(() => {
                  const videoElement = document.getElementById('webgazerVideoFeed');
                  if (videoElement) {
                    clearInterval(checkVideo);
                    
                    // Set explicit width and height attributes (not just CSS)
                    // This ensures TFJS can read valid dimensions
                    const defaultWidth = 640;
                    const defaultHeight = 480;
                    videoElement.width = defaultWidth;
                    videoElement.height = defaultHeight;
                    
                    // Also set CSS dimensions
                    videoElement.style.width = `${defaultWidth}px`;
                    videoElement.style.height = `${defaultHeight}px`;
                    videoElement.style.display = 'block';
                    videoElement.style.visibility = 'visible';
                    
                    console.log('[EyeTracking] Video element prepared with default dimensions:', {
                      width: videoElement.width,
                      height: videoElement.height,
                      videoWidth: videoElement.videoWidth,
                      videoHeight: videoElement.videoHeight,
                      readyState: videoElement.readyState
                    });
                    
                    // Wait for video metadata to load AND ensure we have valid dimensions
                    const waitForValidDimensions = () => {
                      // Check if we already have valid dimensions
                      const hasValidDimensions = 
                        videoElement.videoWidth > 0 && 
                        videoElement.videoHeight > 0 &&
                        videoElement.width > 0 &&
                        videoElement.height > 0;
                      
                      if (hasValidDimensions) {
                        // Update width/height attributes to match actual video dimensions
                        videoElement.width = videoElement.videoWidth;
                        videoElement.height = videoElement.videoHeight;
                        
                        console.log('[EyeTracking] Video element has valid dimensions:', {
                          videoWidth: videoElement.videoWidth,
                          videoHeight: videoElement.videoHeight,
                          width: videoElement.width,
                          height: videoElement.height
                        });
                        
                        resolveVideo();
                        return true;
                      }
                      return false;
                    };
                    
                    // Check immediately if metadata is already loaded
                    if (videoElement.readyState >= 1) {
                      if (waitForValidDimensions()) {
                        return; // Already resolved
                      }
                    }
                    
                    // Wait for metadata to load
                    const metadataHandler = () => {
                      if (waitForValidDimensions()) {
                        return; // Resolved
                      }
                      // If still no valid dimensions, use defaults and proceed
                      console.warn('[EyeTracking] Video metadata loaded but dimensions still invalid, using defaults');
                      videoElement.width = defaultWidth;
                      videoElement.height = defaultHeight;
                      resolveVideo();
                    };
                    
                    videoElement.addEventListener('loadedmetadata', metadataHandler, { once: true });
                    
                    // Also check periodically in case metadata loads but dimensions are still 0
                    let dimensionCheckCount = 0;
                    const dimensionCheckInterval = setInterval(() => {
                      dimensionCheckCount++;
                      if (waitForValidDimensions()) {
                        clearInterval(dimensionCheckInterval);
                        return;
                      }
                      // After 20 checks (2 seconds), give up and use defaults
                      if (dimensionCheckCount >= 20) {
                        clearInterval(dimensionCheckInterval);
                        console.warn('[EyeTracking] Video dimensions still invalid after 2 seconds, using defaults');
                        videoElement.width = defaultWidth;
                        videoElement.height = defaultHeight;
                        resolveVideo();
                      }
                    }, 100);
                    
                    // Timeout after 5 seconds
                    setTimeout(() => {
                      clearInterval(dimensionCheckInterval);
                      console.warn('[EyeTracking] Video metadata load timeout, using defaults');
                      videoElement.width = defaultWidth;
                      videoElement.height = defaultHeight;
                      resolveVideo();
                    }, 5000);
                  }
                }, 100);
                
                // Timeout after 10 seconds
                setTimeout(() => {
                  clearInterval(checkVideo);
                  console.warn('[EyeTracking] Video element not found after 10 seconds, proceeding anyway');
                  resolveVideo();
                }, 10000);
              });
            };
            
            // Suppress WebGazer texture errors by wrapping in error handler
            // These errors occur when video element dimensions are 0x0
            const originalConsoleError = console.error;
            const suppressedErrors = new Set();
            console.error = function(...args) {
              const errorString = args.join(' ');
              // Suppress texture size errors from WebGazer/TensorFlow.js
              if (errorString.includes('Requested texture size') || 
                  (errorString.includes('texture size') && errorString.includes('[0x0]')) ||
                  (errorString.includes('texture size') && errorString.includes('invalid'))) {
                // Only log once to avoid spam
                if (!suppressedErrors.has('texture-size-error')) {
                  suppressedErrors.add('texture-size-error');
                  console.debug('[EyeTracking] WebGazer texture error suppressed (video not ready yet):', errorString.substring(0, 100));
                }
                return; // Suppress this error
              }
              // Log other errors normally
              originalConsoleError.apply(console, args);
            };
            
            // Also catch uncaught errors from TensorFlow.js
            const originalWindowError = window.onerror;
            window.onerror = function(message, source, lineno, colno, error) {
              if (message && typeof message === 'string' && 
                  (message.includes('Requested texture size') || 
                   message.includes('texture size [0x0]'))) {
                // Suppress this error
                if (!suppressedErrors.has('window-texture-error')) {
                  suppressedErrors.add('window-texture-error');
                  console.debug('[EyeTracking] Suppressed window error for texture size:', message.substring(0, 100));
                }
                return true; // Suppress the error
              }
              // Call original handler for other errors
              if (originalWindowError) {
                return originalWindowError(message, source, lineno, colno, error);
              }
              return false;
            };
            
            // Restore console.error and window.onerror after initialization
            const restoreErrorHandlers = () => {
              console.error = originalConsoleError;
              window.onerror = originalWindowError;
            };
            
            // Configure WebGazer (but don't call begin() yet)
            window.webgazer
              .setRegression('ridge') // Use ridge regression for better accuracy
              .saveDataAcrossSessions(false) // Don't save calibration data between sessions
              .showVideoPreview(true) // Show video preview so user knows camera is active
              .showPredictionPoints(false) // Disable WebGazer built-in red dot (we use custom indicator)
              .setGazeListener((data, elapsedTime) => {
                if (data == null) {
                  // Log null data occasionally to debug
                  if (!this._nullDataCount) {
                    this._nullDataCount = 0;
                  }
                  this._nullDataCount++;
                  if (this._nullDataCount === 1 || this._nullDataCount % 100 === 0) {
                    console.debug(`[EyeTracking] Gaze listener received null data (count: ${this._nullDataCount})`);
                  }
                  return;
                }
                
                // WebGazer returns gaze position in screen coordinates (relative to viewport)
                // According to docs: "these x coordinates are relative to the viewport"
                const x = data.x;
                const y = data.y;
                
                // Debug: Log first few gaze events
                if (!this._listenerLogCount) {
                  this._listenerLogCount = 0;
                  console.log('[EyeTracking] ✓ Gaze listener is active and receiving data');
                }
                if (this._listenerLogCount < 5) {
                  console.log(`[EyeTracking] Gaze data received: x=${Math.round(x)}, y=${Math.round(y)}, elapsedTime=${elapsedTime}ms`);
                  this._listenerLogCount++;
                }
                
                // Validate coordinates are numbers before processing
                // handleGaze will do additional validation and clamping
                if (typeof x === 'number' && typeof y === 'number' && 
                    !isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y)) {
                  this.handleGaze(x, y);
                } else {
                  // Log invalid coordinates occasionally
                  if (!this._invalidCoordCount) {
                    this._invalidCoordCount = 0;
                  }
                  this._invalidCoordCount++;
                  if (this._invalidCoordCount === 1 || this._invalidCoordCount % 50 === 0) {
                    console.debug(`[EyeTracking] Invalid coordinates from WebGazer: x=${x} (${typeof x}), y=${y} (${typeof y}), viewport=${window.innerWidth}x${window.innerHeight} (count: ${this._invalidCoordCount})`);
                  }
                }
              });
            
            // WebGazer creates the video element when begin() is called
            // So we need to call begin() first, then wait for the video element to appear
            console.log('[EyeTracking] Calling webgazer.begin() to create video element...');
            
            // Call begin() first - this will create the video element
            window.webgazer.begin()
            .then(() => {
              // After begin() resolves, wait for video element to appear and ensure it has valid dimensions
              return new Promise((resolveBegin) => {
                const checkVideoAfterBegin = setInterval(() => {
                  const videoElement = document.getElementById('webgazerVideoFeed');
                  if (videoElement) {
                    clearInterval(checkVideoAfterBegin);

                    // CRITICAL: Set explicit dimensions IMMEDIATELY to prevent 0x0 texture errors
                    // TensorFlow.js uses these attributes for texture creation
                    if (!videoElement.width || videoElement.width === 0) {
                      videoElement.width = 640;
                    }
                    if (!videoElement.height || videoElement.height === 0) {
                      videoElement.height = 480;
                    }

                    console.log('[EyeTracking] Video element found and dimensions set:', {
                      width: videoElement.width,
                      height: videoElement.height,
                      videoWidth: videoElement.videoWidth,
                      videoHeight: videoElement.videoHeight
                    });

                    // Now wait for video metadata to load and update to actual dimensions if available
                    const waitForVideoDimensions = () => {
                      return new Promise((resolveDims) => {
                        // Check if metadata is already loaded and has valid dimensions
                        if (videoElement.readyState >= 1 && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                          videoElement.width = videoElement.videoWidth;
                          videoElement.height = videoElement.videoHeight;
                          console.log('[EyeTracking] Updated to actual video dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
                          resolveDims();
                          return;
                        }

                        // Wait for loadedmetadata event
                        const metadataHandler = () => {
                          if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                            videoElement.width = videoElement.videoWidth;
                            videoElement.height = videoElement.videoHeight;
                            console.log('[EyeTracking] Updated to actual video dimensions after metadata:', videoElement.videoWidth, 'x', videoElement.videoHeight);
                            resolveDims();
                          } else {
                            // Keep the defaults we set earlier
                            console.warn('[EyeTracking] Video metadata loaded but dimensions still 0, keeping defaults');
                            resolveDims();
                          }
                        };

                        videoElement.addEventListener('loadedmetadata', metadataHandler, { once: true });

                        // Timeout after 2 seconds - resolve with current dimensions
                        setTimeout(() => {
                          if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                            videoElement.width = videoElement.videoWidth;
                            videoElement.height = videoElement.videoHeight;
                            console.log('[EyeTracking] Updated to actual video dimensions after timeout:', videoElement.videoWidth, 'x', videoElement.videoHeight);
                          } else {
                            console.log('[EyeTracking] Keeping default dimensions after timeout');
                          }
                          resolveDims();
                        }, 2000);
                      });
                    };

                    // Wait for dimensions to be finalized, but don't block WebGazer startup
                    waitForVideoDimensions().then(() => {
                      console.log('[EyeTracking] Video element fully ready:', {
                        width: videoElement.width,
                        height: videoElement.height,
                        videoWidth: videoElement.videoWidth,
                        videoHeight: videoElement.videoHeight
                      });
                    });

                    // Resolve immediately now that dimensions are set
                    resolveBegin();
                  }
                }, 100);

                // Timeout after 5 seconds
                setTimeout(() => {
                  clearInterval(checkVideoAfterBegin);
                  const videoElement = document.getElementById('webgazerVideoFeed');
                  if (videoElement) {
                    // Ensure dimensions are set
                    if (!videoElement.width || videoElement.width === 0) {
                      videoElement.width = 640;
                    }
                    if (!videoElement.height || videoElement.height === 0) {
                      videoElement.height = 480;
                    }
                    console.warn('[EyeTracking] Video element found but setup timeout, using defaults');
                    resolveBegin();
                  } else {
                    console.warn('[EyeTracking] Video element not found after begin() timeout, but continuing anyway');
                    resolveBegin(); // Continue anyway - WebGazer may still work
                  }
                }, 5000);
              });
            })
            .then(() => {
              clearTimeout(initTimeout);
              restoreErrorHandlers(); // Restore error handlers after initialization
              
              // WebGazer initialized - set tracker and create gaze indicator
              console.log('✓ WebGazer camera eye tracking initialized successfully');
              this.tracker = window.webgazer;
              
              // Stop test camera stream if it exists
              if (this.cameraStream && this.cameraStream.active) {
                const testTracks = this.cameraStream.getVideoTracks();
                testTracks.forEach(track => track.stop());
                this.cameraStream = null;
              }
              
              // Create custom gaze indicator
              if (!this.gazeIndicator) {
                this.createGazeIndicator();
              }
              
              // Style video element when it becomes available (non-blocking, no checks)
              // Ensure it has explicit dimensions to prevent texture size errors
              setTimeout(() => {
                try {
                  const videoElement = document.getElementById('webgazerVideoFeed');
                  if (videoElement) {
                    // Get actual video dimensions if available, otherwise use defaults
                    const actualWidth = videoElement.videoWidth || 640;
                    const actualHeight = videoElement.videoHeight || 480;
                    
                    // CRITICAL: Ensure width/height attributes are set (required for TFJS)
                    // These attributes (not just CSS) are what TFJS reads for texture dimensions
                    if (!videoElement.width || videoElement.width === 0) {
                      videoElement.width = actualWidth;
                    }
                    if (!videoElement.height || videoElement.height === 0) {
                      videoElement.height = actualHeight;
                    }
                    
                    // Calculate display size (responsive, for visual appearance)
                    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
                    let displayWidth = 240;
                    let displayHeight = 180;
                    if (vw && vw < 768) {
                      displayWidth = Math.round(vw * 0.35);
                      displayHeight = Math.round(displayWidth * (actualHeight / actualWidth));
                    }
                    displayWidth = Math.min(displayWidth, 320);
                    displayHeight = Math.min(displayHeight, 240);

                    // Set CSS for display (visual size - can be different from width/height attributes)
                    videoElement.style.cssText = `
                      position: fixed !important;
                      top: 12px !important;
                      right: 12px !important;
                      width: ${displayWidth}px !important;
                      height: ${displayHeight}px !important;
                      max-width: 40vw !important;
                      max-height: 30vh !important;
                      border: 3px solid #4CAF50 !important;
                      border-radius: 8px !important;
                      z-index: 10000 !important;
                      background: #000 !important;
                      object-fit: cover !important;
                      display: block !important;
                      visibility: visible !important;
                      opacity: 1 !important;
                      box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
                    `;
                    
                    console.log('[EyeTracking] Video element styled with explicit dimensions:', {
                      widthAttr: videoElement.width,
                      heightAttr: videoElement.height,
                      videoWidth: videoElement.videoWidth,
                      videoHeight: videoElement.videoHeight,
                      displayWidth: displayWidth,
                      displayHeight: displayHeight
                    });
                    
                    if (videoElement.srcObject) {
                      this.cameraStream = videoElement.srcObject;
                    }
                  }
                } catch (e) {
                  console.warn('[EyeTracking] Error styling video element:', e);
                }
              }, 500);
              
              resolve();
            })
            .catch(error => {
              clearTimeout(initTimeout);
              restoreErrorHandlers(); // Restore error handlers even on error
              
              // Suppress CORS and fetch errors from WebGazer.js model loading
              // These errors are expected and don't prevent WebGazer from working
              // WebGazer will fall back to alternative model loading methods or use cached models
              const errorMessage = error?.message || error?.toString() || '';
              const errorStack = error?.stack || '';
              const errorString = JSON.stringify(error) || '';
              
              // Check if this is a WebGazer-related error that can be safely ignored
              const isWebGazerModelError = 
                errorMessage.includes('CORS') || 
                errorMessage.includes('Failed to fetch') ||
                errorMessage.includes('TypeError: Failed to fetch') ||
                errorMessage.includes('NetworkError') ||
                // Google Storage CORS errors - comprehensive detection
                errorMessage.includes('storage.googleapis.com') ||
                errorMessage.includes('googleapis.com') ||
                errorMessage.includes('tfhub.dev') ||
                errorMessage.includes('kagglesdsdata') ||
                errorMessage.includes('kaggleusercontent') ||
                errorMessage.includes('googleusercontent') ||
                errorMessage.includes('blocked by CORS policy') ||
                errorMessage.includes('Access-Control-Allow-Origin') ||
                errorMessage.includes('CORS policy') ||
                errorMessage.includes('Requested texture size') ||
                errorMessage.includes('[0x0]') ||
                errorStack.includes('face-landmarks-detection') ||
                errorStack.includes('facemesh') ||
                errorStack.includes('webgazer') ||
                errorStack.includes('loadWeights') ||
                errorStack.includes('@mediapipe') ||
                errorStack.includes('createUnsignedBytesMatrixTexture') ||
                errorString.includes('webgazer') ||
                errorString.includes('facemesh') ||
                errorString.includes('texture size');
              
              if (isWebGazerModelError) {
                // These are non-critical model loading errors - WebGazer can still work
                // Simply set tracker and continue without additional checks
                if (window.webgazer) {
                  this.tracker = window.webgazer;
                }
                if (!this.gazeIndicator) {
                  this.createGazeIndicator();
                }
                resolve();
                return;
              }
              
              // For other errors, log the full error for debugging
              console.error('❌ WebGazer initialization error:', error);
              console.error('Error details:', {
                message: errorMessage,
                stack: errorStack.substring(0, 500),
                name: error?.name
              });
              
              // Still resolve to allow app to continue, but log the error
              resolve();
            });
          } catch (initError) {
            clearTimeout(initTimeout);
            // Catch any synchronous errors during initialization
            const errorMessage = initError?.message || initError?.toString() || '';
            console.warn('WebGazer initialization exception (non-critical):', errorMessage.substring(0, 200));
            // Resolve to allow app to continue
            resolve();
          }
        } catch (outerError) {
          clearTimeout(initTimeout);
          const errorMessage = outerError?.message || outerError?.toString() || '';
          console.warn('WebGazer setup error (non-critical):', errorMessage.substring(0, 200));
          // Resolve to allow app to continue
          resolve();
        }
      });
    } catch (finalError) {
      const errorMessage = finalError?.message || finalError?.toString() || '';
      console.warn('WebGazer initialization outer error (non-critical):', errorMessage.substring(0, 200));
      // Return resolved promise to allow app to continue
      return Promise.resolve();
    }
  }

  handleGaze(x, y) {
    // Validate and clamp coordinates to prevent runtime errors
    // Ensure coordinates are valid numbers and within viewport bounds
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    
    // Check if coordinates are valid numbers (not NaN, Infinity, null, undefined)
    if (typeof x !== 'number' || typeof y !== 'number' || 
        isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
      // Invalid coordinates - skip processing
      if (!this._invalidCoordCount) {
        this._invalidCoordCount = 0;
      }
      this._invalidCoordCount++;
      if (this._invalidCoordCount === 1 || this._invalidCoordCount % 50 === 0) {
        console.debug(`[EyeTracking] Invalid coordinate types: x=${x} (${typeof x}), y=${y} (${typeof y})`);
      }
      return;
    }
    
    // Clamp coordinates to viewport bounds to prevent errors in elementFromPoint, scrollTo, etc.
    x = Math.max(0, Math.min(viewportWidth, Math.round(x)));
    y = Math.max(0, Math.min(viewportHeight, Math.round(y)));
    
    // Debug: Log first few gaze events to verify it's working
    if (!this._gazeLogCount) {
      this._gazeLogCount = 0;
    }
    if (this._gazeLogCount < 5) {
      console.log(`[EyeTracking] Gaze detected: x=${x}, y=${y}`);
      this._gazeLogCount++;
    }
    
    // Update visual gaze indicator (red ball) with validated coordinates
    this.updateGazeIndicator(x, y);

    // Optional external callback
    if (this.onGazeCallback) {
      this.onGazeCallback(x, y);
    }

    // =============================
    // Scroll page when gaze at top/bottom (works with or without scanning)
    // =============================
    try {
      const viewportHeightScroll = window.innerHeight || document.documentElement.clientHeight;
      const scrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight || 0;

      const topThreshold = viewportHeightScroll * 0.08;      // top 8% area
      const bottomThreshold = viewportHeightScroll * 0.92;   // bottom 8% area
      const canScrollUp = scrollTop > 0;
      const canScrollDown = scrollTop + viewportHeightScroll < scrollHeight - 2;

      // Simple throttle so we don't scroll too fast
      if (!this.lastScrollTime) this.lastScrollTime = 0;
      const nowScroll = Date.now();
      const SCROLL_COOLDOWN = 200; // ms

      if (nowScroll - this.lastScrollTime >= SCROLL_COOLDOWN) {
        const scrollStep = Math.round(viewportHeightScroll * 0.15); // ~15% of screen

        if (y <= topThreshold && canScrollUp) {
          window.scrollTo({
            top: Math.max(0, scrollTop - scrollStep),
            behavior: 'smooth'
          });
          this.lastScrollTime = nowScroll;
        } else if (y >= bottomThreshold && canScrollDown) {
          window.scrollTo({
            top: Math.min(scrollHeight - viewportHeightScroll, scrollTop + scrollStep),
            behavior: 'smooth'
          });
          this.lastScrollTime = nowScroll;
        }
      }
    } catch (scrollError) {
      // Don't let scroll errors break main gaze handling
    }

    // If scanning is not enabled, do not select anything via eye tracking
    // (just show gaze indicator and allow scrolling)
    if (!this.scanningSettings || !this.scanningSettings.enabled) {
      return;
    }

    // =============================
    // Eye-tracking driven scanning: red highlight box follows the red dot (gaze)
    // When scanning is enabled AND strategy is "eye_tracking", the highlight moves to wherever the user is looking
    // Supports: single card mode, row/column modes, operation buttons, and output bar
    // If strategy is "automatic", let react-scannable handle the scanning (don't interfere)
    // =============================
    if (this.scanningSettings && this.scanningSettings.enabled) {
      // Check if scanning strategy is "eye_tracking" - only then should we control the highlight
      const scanningStrategy = this.scanningSettings.strategy || 'automatic';
      if (scanningStrategy !== 'eye_tracking') {
        // Automatic scanning mode - let react-scannable handle it, don't interfere
        // Just allow scrolling when gaze is at top/bottom
        // (scrolling logic is below, after the scanning block)
        return; // Exit early, don't process eye-tracking scanning
      }
      // Find the element at the gaze position - could be a tile, output button, or other scannable element
      const element = document.elementFromPoint(x, y);
      if (element) {
        // Check for output bar elements first (playback button, delete button, etc.)
        const outputElement = element.closest('.SymbolOutput') || 
                             element.closest('[data-output-action]') ||
                             (element.closest('button') && element.closest('.SymbolOutput__controls')) ||
                             (element.closest('button') && element.closest('.BackspaceButton')) ||
                             (element.closest('button') && element.closest('.ClearButton'));
        
        if (outputElement) {
          // Handle output bar scanning
          const outputButton = element.closest('button') || outputElement;
          const actionId = outputButton.dataset?.outputAction || 
                          outputButton.id || 
                          (outputButton.classList.contains('BackspaceButton') ? 'output-backspace' : null) ||
                          (outputButton.classList.contains('ClearButton') ? 'output-clear' : null) ||
                          (outputButton.onClick ? 'output-play' : null);
          
          if (actionId) {
            // Remove highlight from all other elements
            const allHighlighted = document.querySelectorAll('.scanner__focused');
            allHighlighted.forEach(el => el.classList.remove('scanner__focused'));
            
            // Add highlight to the output element
            if (!outputButton.classList.contains('scanner__focused')) {
              outputButton.classList.add('scanner__focused');
              
              // Trigger highlight callback for audio feedback
              if (this.onScanningHighlightCallback) {
                this.onScanningHighlightCallback(actionId, outputButton);
              }
            }
            
            // Check if we're still gazing at the same element for dwell time
            const scanningDwellTime = (this.scanningSettings?.speed || 2.0) * 1000;
            
            if (this.currentGazeTarget === actionId) {
              const dwellDuration = Date.now() - this.dwellStartTime;
              if (dwellDuration >= scanningDwellTime) {
                // Trigger the output action
                if (this.onScanningSelectCallback) {
                  this.onScanningSelectCallback(actionId, outputButton);
                } else {
                  // Fallback: try to click the button
                  try {
                    outputButton.click();
                  } catch (e) {
                    console.debug('[EyeTracking] Could not click output button:', e);
                  }
                }
                this.resetDwell();
                return;
              }
            } else {
              // New element, start dwell timer
              this.currentGazeTarget = actionId;
              this.dwellStartTime = Date.now();
            }
            return;
          }
        }
        
        // Check for regular tiles
        const tileElement = element.closest('.Tile');
        if (tileElement) {
          const tileId = tileElement.dataset?.tileId || tileElement.id;
          if (tileId) {
            const scanningMode = this.scanningSettings?.mode || 'single';
            
            // Handle row/column scanning modes based on visual layout (DOM positions)
            if (scanningMode === 'row' || scanningMode === 'column') {
              const allTileElements = Array.from(document.querySelectorAll('.Tile[data-tile-id]'));
              if (!allTileElements.length) {
                // Fallback to regular single-card behavior below
              } else {
                const targetRect = tileElement.getBoundingClientRect();
                
                // Row or column selection phase
                if (this.scanningSubState === 'row_col') {
                  // Remove previous highlights and overlay
                  const allHighlighted = document.querySelectorAll('.scanner__focused, .scanner__row_highlighted, .scanner__col_highlighted');
                  allHighlighted.forEach(el => {
                    el.classList.remove('scanner__focused', 'scanner__row_highlighted', 'scanner__col_highlighted');
                  });
                  this.removeRowColOverlay();
                  
                  let tilesToHighlight = [];
                  if (scanningMode === 'row') {
                    const baseTop = targetRect.top;
                    const threshold = targetRect.height * 0.5;
                    tilesToHighlight = allTileElements.filter(el => {
                      const rect = el.getBoundingClientRect();
                      return Math.abs(rect.top - baseTop) <= threshold;
                    });
                  } else {
                    const baseCenterX = targetRect.left + targetRect.width / 2;
                    const threshold = targetRect.width * 0.5;
                    tilesToHighlight = allTileElements.filter(el => {
                      const rect = el.getBoundingClientRect();
                      const centerX = rect.left + rect.width / 2;
                      return Math.abs(centerX - baseCenterX) <= threshold;
                    });
                  }
                  
                  // Apply row/col highlight to all tiles in this row/column
                  const tileIdsInGroup = [];
                  tilesToHighlight.forEach(el => {
                    const tId = el.dataset?.tileId || el.id;
                    if (!tId) return;
                    tileIdsInGroup.push(String(tId));
                    el.classList.add(scanningMode === 'row' ? 'scanner__row_highlighted' : 'scanner__col_highlighted');
                    el.classList.add('scanner__focused');
                  });
                  
                  // Trigger highlight callback using a synthetic key
                  const targetKey = `${scanningMode}_${tileIdsInGroup.join('_')}`;
                  if (this.onScanningHighlightCallback) {
                    this.onScanningHighlightCallback(targetKey, tileElement);
                  }
                  
                  // Create/update rectangular overlay for row/column
                  this.updateRowColOverlay(tilesToHighlight, scanningMode);
                  
                  // Dwell to confirm row/column
                  const scanningDwellTime = (this.scanningSettings?.speed || 2.0) * 1000;
                  if (this.currentGazeTarget === targetKey) {
                    const dwellDuration = Date.now() - this.dwellStartTime;
                    if (dwellDuration >= scanningDwellTime) {
                      // Calculate bounds for restricting gaze indicator
                      const bounds = this.calculateRowColBounds(tilesToHighlight);
                      this.selectedRowColBounds = bounds;
                      
                      // Save allowed tile ids in this row/column
                      this.selectedRowCol = {
                        type: scanningMode,
                        tileIds: tileIdsInGroup
                      };
                      this.scanningSubState = 'cards';
                      
                      // Add extra delay after row/col selection for stability (0.5 seconds)
                      this.resetDwell();
                      this.dwellStartTime = Date.now() + 500; // Add 500ms delay
                      return;
                    }
                  } else {
                    this.currentGazeTarget = targetKey;
                    this.dwellStartTime = Date.now();
                  }
                  return;
                } else if (this.scanningSubState === 'cards' && this.selectedRowCol) {
                  // We are selecting a specific card within the selected row/column
                  const { tileIds = [] } = this.selectedRowCol;
                  const isInSelectedGroup = tileIds.includes(String(tileId));
                  
                  if (isInSelectedGroup) {
                    const allHighlighted = document.querySelectorAll('.scanner__focused');
                    allHighlighted.forEach(el => el.classList.remove('scanner__focused'));
                    
                    if (!tileElement.classList.contains('scanner__focused')) {
                      tileElement.classList.add('scanner__focused');
                      
                      if (this.onScanningHighlightCallback) {
                        this.onScanningHighlightCallback(tileId, tileElement);
                      }
                    }
                    
                    // Add extra delay after row/col selection (check if we just entered card mode)
                    const baseDwellTime = (this.scanningSettings?.speed || 2.0) * 1000;
                    const extraDelay = 500; // 0.5 seconds extra for stability
                    const scanningDwellTime = baseDwellTime + extraDelay;
                    
                    if (this.currentGazeTarget === tileId) {
                      const dwellDuration = Date.now() - this.dwellStartTime;
                      if (dwellDuration >= scanningDwellTime) {
                        if (this.onScanningSelectCallback) {
                          this.onScanningSelectCallback(tileId, tileElement);
                        } else {
                          this.handleDwell(tileId, x, y, dwellDuration);
                        }
                        this.scanningSubState = 'row_col';
                        this.selectedRowCol = null;
                        this.selectedRowColBounds = null;
                        this.removeRowColOverlay();
                        this.resetDwell();
                        return;
                      }
                    } else {
                      this.currentGazeTarget = tileId;
                      this.dwellStartTime = Date.now();
                    }
                    return;
                  } else {
                    // Tile not in selected row/column, ignore
                    return;
                  }
                }
              }
            }
            
            // Single card mode (original behavior)
            // Remove highlight from all other elements
            const allHighlighted = document.querySelectorAll('.scanner__focused');
            allHighlighted.forEach(el => el.classList.remove('scanner__focused'));
            
            // Add highlight to the tile at gaze position
            if (!tileElement.classList.contains('scanner__focused')) {
              tileElement.classList.add('scanner__focused');
              
              // Trigger highlight callback for audio feedback
              if (this.onScanningHighlightCallback) {
                this.onScanningHighlightCallback(tileId, tileElement);
              }
            }
            
            // Check if we're still gazing at the same tile for dwell time
            // Use scanning speed (in seconds) converted to milliseconds for dwell time
            const scanningDwellTime = (this.scanningSettings?.speed || 2.0) * 1000; // Convert seconds to ms
            
            if (this.currentGazeTarget === tileId) {
              const dwellDuration = Date.now() - this.dwellStartTime;
              if (dwellDuration >= scanningDwellTime) {
                // Use scanning select callback if available, otherwise use regular dwell
                if (this.onScanningSelectCallback) {
                  this.onScanningSelectCallback(tileId, tileElement);
                } else {
                  this.handleDwell(tileId, x, y, dwellDuration);
                }
                this.resetDwell();
                return; // Selection handled
              }
            } else {
              // New tile, start dwell timer
              this.currentGazeTarget = tileId;
              this.dwellStartTime = Date.now();
            }
            return; // Scanning active, don't process regular tile detection
          }
        }
      }
      // If no scannable element found at gaze position, remove all highlights
      const allHighlighted = document.querySelectorAll('.scanner__focused');
      allHighlighted.forEach(el => el.classList.remove('scanner__focused'));
      this.resetDwell();
      return;
    }

    // Regular tile detection (when scanning is not enabled or gaze is not on highlighted tile)
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

  /**
   * Create and update visual gaze indicator (red ball)
   * This is a custom indicator in addition to WebGazer's built-in prediction points
   */
  createGazeIndicator() {
    // Remove existing indicator if any
    this.removeGazeIndicator();
    
    const indicator = document.createElement('div');
    indicator.id = 'eye-tracking-gaze-indicator';
    indicator.style.cssText = `
      position: fixed;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background-color: #f44336;
      border: 3px solid white;
      box-shadow: 0 2px 12px rgba(244, 67, 54, 0.6), 0 0 0 4px rgba(244, 67, 54, 0.2);
      z-index: 99999;
      pointer-events: none;
      transform: translate(-50%, -50%);
      transition: opacity 0.15s ease-out, transform 0.1s ease-out;
      opacity: 0;
      will-change: transform, opacity;
    `;
    
    // Add pulse animation style if not already added
    if (!document.getElementById('eye-tracking-indicator-style')) {
      const style = document.createElement('style');
      style.id = 'eye-tracking-indicator-style';
      style.textContent = `
        @keyframes eyeTrackingPulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.9;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.15);
            opacity: 1;
          }
        }
        #eye-tracking-gaze-indicator {
          animation: eyeTrackingPulse 2s infinite;
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(indicator);
    this.gazeIndicator = indicator;
    console.log('✓ Custom gaze indicator created');
  }

  /**
   * Update gaze indicator position
   */
  updateGazeIndicator(x, y) {
    // Validate coordinates before using them in CSS
    if (typeof x !== 'number' || typeof y !== 'number' || 
        isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
      return; // Skip update if coordinates are invalid
    }
    
    // If we're in card selection mode and have selected row/col bounds, restrict gaze to that area
    if (this.scanningSubState === 'cards' && this.selectedRowColBounds) {
      const bounds = this.selectedRowColBounds;
      x = Math.max(bounds.minX, Math.min(bounds.maxX, x));
      y = Math.max(bounds.minY, Math.min(bounds.maxY, y));
    }
    
    // Clamp to viewport bounds
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    x = Math.max(0, Math.min(viewportWidth, Math.round(x)));
    y = Math.max(0, Math.min(viewportHeight, Math.round(y)));
    
    if (!this.gazeIndicator) {
      this.createGazeIndicator();
    }
    
    if (this.gazeIndicator) {
      // Update position smoothly with validated coordinates
      this.gazeIndicator.style.left = `${x}px`;
      this.gazeIndicator.style.top = `${y}px`;
      this.gazeIndicator.style.opacity = '1';
      
      // Reset opacity fade timer
      if (this.gazeIndicatorFadeTimer) {
        clearTimeout(this.gazeIndicatorFadeTimer);
      }
      
      // Fade out if no updates for 1 second (longer timeout for better visibility)
      this.gazeIndicatorFadeTimer = setTimeout(() => {
        if (this.gazeIndicator) {
          this.gazeIndicator.style.opacity = '0.7';
        }
      }, 1000);
    }
  }

  /**
   * Remove gaze indicator
   */
  removeGazeIndicator() {
    if (this.gazeIndicator) {
      this.gazeIndicator.remove();
      this.gazeIndicator = null;
    }
    if (this.gazeIndicatorFadeTimer) {
      clearTimeout(this.gazeIndicatorFadeTimer);
      this.gazeIndicatorFadeTimer = null;
    }
    // Remove style if exists
    const style = document.getElementById('eye-tracking-indicator-style');
    if (style) {
      style.remove();
    }
  }

  /**
   * Calculate bounding box for a group of tile elements
   */
  calculateRowColBounds(tileElements) {
    if (!tileElements || !tileElements.length) {
      return null;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    tileElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      minX = Math.min(minX, rect.left);
      maxX = Math.max(maxX, rect.right);
      minY = Math.min(minY, rect.top);
      maxY = Math.max(maxY, rect.bottom);
    });

    // Add small padding for better UX
    const padding = 10;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

    return {
      minX: Math.max(0, minX - padding),
      maxX: Math.min(viewportWidth, maxX + padding),
      minY: Math.max(0, minY - padding),
      maxY: Math.min(viewportHeight, maxY + padding)
    };
  }

  /**
   * Calculate bounds from elements (alias to keep code clear)
   */
  calculateRowColBoundsFromElements(tileElements) {
    return this.calculateRowColBounds(tileElements);
  }

  /**
   * Create or update rectangular overlay for row/column highlighting
   */
  updateRowColOverlay(bounds) {
    if (!bounds) {
      this.removeRowColOverlay();
      return;
    }

    if (!this.rowColOverlay) {
      this.rowColOverlay = document.createElement('div');
      this.rowColOverlay.id = 'scanner-row-col-overlay';
      this.rowColOverlay.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 99998;
        border: 4px solid rgba(255, 0, 0, 0.8);
        background-color: rgba(255, 0, 0, 0.12);
        box-shadow: 0 0 16px rgba(255, 0, 0, 0.5);
        transition: all 0.15s ease-out;
      `;
      document.body.appendChild(this.rowColOverlay);
    }

    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    this.rowColOverlay.style.left = `${bounds.minX}px`;
    this.rowColOverlay.style.top = `${bounds.minY}px`;
    this.rowColOverlay.style.width = `${width}px`;
    this.rowColOverlay.style.height = `${height}px`;
    this.rowColOverlay.style.display = 'block';
  }

  /**
   * Remove row/column overlay
   */
  removeRowColOverlay() {
    if (this.rowColOverlay) {
      try {
        this.rowColOverlay.remove();
      } catch (e) {
        // ignore
      }
      this.rowColOverlay = null;
    }
    this.selectedRowColBounds = null;
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

    // Log selection to backend (non-blocking, don't fail if network is unavailable)
    try {
      API.selectCardViaEyeTracking({
        card_id: tileId,
        gaze_x: x,
        gaze_y: y,
        dwell_time: dwellDuration / 1000 // Convert to seconds
      }).catch(err => {
        // Only log non-network errors to reduce console noise
        const isNetworkError = err.code === 'ERR_NETWORK' || err.message === 'Network Error';
        if (!isNetworkError || navigator.onLine) {
          console.warn('Failed to log eye tracking selection:', err.message || err);
        }
      });
    } catch (error) {
      // Only log non-network errors
      const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error';
      if (!isNetworkError || navigator.onLine) {
        console.warn('Error logging eye tracking selection:', error.message || error);
      }
    }
  }

  resetDwell() {
    this.currentGazeTarget = null;
    this.dwellStartTime = null;
  }

  /**
   * Create status indicator overlay on video element
   */
  createStatusIndicator(videoElement) {
    // Remove existing indicator if any
    this.removeStatusIndicator();
    
    // Create status indicator
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'webgazer-status-indicator';
    statusIndicator.style.cssText = `
      position: absolute;
      top: 5px;
      left: 5px;
      background: rgba(0,0,0,0.8);
      color: #fff;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-family: Arial, sans-serif;
      font-weight: bold;
      z-index: 10001;
      pointer-events: none;
      border: 1px solid rgba(255,255,255,0.3);
    `;
    statusIndicator.textContent = 'Initializing...';
    
    // Wrap video in container if needed
    let container = videoElement.parentElement;
    if (!container || container.id !== 'webgazer-video-container') {
      container = document.createElement('div');
      container.id = 'webgazer-video-container';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 200px;
        height: 150px;
        z-index: 10000;
      `;
      videoElement.parentNode.insertBefore(container, videoElement);
      container.appendChild(videoElement);
    }
    
    container.style.position = 'relative';
    container.appendChild(statusIndicator);
  }

  /**
   * Show camera status indicator
   */
  showCameraStatus(isActive, cameraLabel = '') {
    const statusIndicator = document.getElementById('webgazer-status-indicator');
    if (statusIndicator) {
      if (isActive) {
        statusIndicator.textContent = `✓ Camera Active${cameraLabel ? ': ' + cameraLabel : ''}`;
        statusIndicator.style.background = 'rgba(76, 175, 80, 0.9)';
        statusIndicator.style.borderColor = 'rgba(76, 175, 80, 0.5)';
      } else {
        statusIndicator.textContent = `✗ Camera Inactive${cameraLabel ? ': ' + cameraLabel : ''}`;
        statusIndicator.style.background = 'rgba(244, 67, 54, 0.9)';
        statusIndicator.style.borderColor = 'rgba(244, 67, 54, 0.5)';
      }
    }
  }

  /**
   * Create fallback indicator if video element not found
   */
  createFallbackIndicator() {
    const existing = document.getElementById('webgazer-fallback-indicator');
    if (existing) return;
    
    const indicator = document.createElement('div');
    indicator.id = 'webgazer-fallback-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 200px;
      height: 150px;
      background: rgba(244, 67, 54, 0.9);
      border: 3px solid #f44336;
      border-radius: 8px;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-family: Arial, sans-serif;
      font-size: 14px;
      text-align: center;
      padding: 20px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    `;
    indicator.innerHTML = `
      <div>
        <div style="font-size: 24px; margin-bottom: 10px;">⚠</div>
        <div>Camera not detected</div>
        <div style="font-size: 11px; margin-top: 10px; opacity: 0.8;">Please check camera permissions</div>
      </div>
    `;
    document.body.appendChild(indicator);
  }

  /**
   * Remove status indicator
   */
  removeStatusIndicator() {
    const indicator = document.getElementById('webgazer-status-indicator');
    if (indicator) {
      indicator.remove();
    }
    const fallback = document.getElementById('webgazer-fallback-indicator');
    if (fallback) {
      fallback.remove();
    }
  }

  /**
   * Setup eye-tracking driven scanning
   * @param {Object} scanningSettings - Scanning settings { enabled, mode, speed, loop, loop_count }
   * @param {Array} tiles - Array of tile objects
   * @param {Object} navigationData - Navigation data from API
   * @param {Function} onHighlight - Callback when highlight changes
   * @param {Function} onSelect - Callback when item is selected
   */
  setupScanning(scanningSettings, tiles, navigationData, onHighlight, onSelect) {
    this.scanningSettings = scanningSettings;
    this.scanningTiles = tiles || [];
    this.scanningNavigationData = navigationData;
    this.onScanningHighlightCallback = onHighlight;
    this.onScanningSelectCallback = onSelect;
    
    // Reset row/col scanning state
    this.scanningSubState = 'row_col';
    this.selectedRowCol = null;
    
    if (scanningSettings && scanningSettings.enabled) {
      this.eyeTrackingScanner.initialize(
        scanningSettings,
        this.scanningTiles,
        navigationData,
        onHighlight,
        onSelect
      );
    } else {
      this.eyeTrackingScanner.stop();
    }
  }

  /**
   * Update scanning settings
   */
  updateScanningSettings(scanningSettings) {
    this.scanningSettings = scanningSettings;
    if (this.eyeTrackingScanner) {
      this.eyeTrackingScanner.updateSettings(scanningSettings);
    }
    
    // If scanning is disabled, immediately remove all highlights
    if (!scanningSettings.enabled) {
      const allHighlighted = document.querySelectorAll('.scanner__focused, .scanner__row_highlighted, .scanner__col_highlighted');
      allHighlighted.forEach(el => el.classList.remove('scanner__focused', 'scanner__row_highlighted', 'scanner__col_highlighted'));
      this.removeRowColOverlay();
      this.resetDwell();
      // Reset row/col scanning state
      this.scanningSubState = 'row_col';
      this.selectedRowCol = null;
      this.selectedRowColBounds = null;
    }
  }

  async cleanup() {
    console.log('[EyeTracking] ===== Starting cleanup =====');
    
    // Set enabled to false immediately to prevent any new operations
    this.isEnabled = false;
    
    // Remove status indicators
    this.removeStatusIndicator();
    
    // Remove gaze indicator
    this.removeGazeIndicator();
    
    // Hide and stop WebGazer video element
    const videoElement = document.getElementById('webgazerVideoFeed');
    if (videoElement) {
      console.log('[EyeTracking] Hiding and stopping video element...');
      
      // CRITICAL: Stop all video tracks BEFORE hiding/removing
      // This ensures the camera is actually turned off
      if (videoElement.srcObject) {
        const stream = videoElement.srcObject;
        if (stream && stream.getTracks) {
          stream.getTracks().forEach(track => {
            if (track && track.stop) {
              track.stop();
              console.log('[EyeTracking] Video track stopped from videoElement.srcObject:', track.kind, track.label);
            }
          });
        }
        videoElement.srcObject = null;
      }
      
      // Also check if there's a stream stored in our reference
      if (this.cameraStream && this.cameraStream.getTracks) {
        this.cameraStream.getTracks().forEach(track => {
          if (track && track.stop && track.readyState !== 'ended') {
            track.stop();
            console.log('[EyeTracking] Camera track stopped from this.cameraStream:', track.kind, track.label);
          }
        });
        this.cameraStream = null;
      }
      
      // Hide the video element immediately with multiple methods
      videoElement.style.display = 'none';
      videoElement.style.visibility = 'hidden';
      videoElement.style.opacity = '0';
      videoElement.style.width = '0';
      videoElement.style.height = '0';
      videoElement.style.position = 'fixed';
      videoElement.style.top = '-9999px';
      videoElement.style.left = '-9999px';
      
      // Pause video if playing
      if (!videoElement.paused) {
        videoElement.pause();
      }
      
      // Remove video element from DOM completely
      try {
        videoElement.remove();
        console.log('[EyeTracking] Video element removed from DOM');
      } catch (e) {
        console.warn('[EyeTracking] Error removing video element:', e);
      }
    }
    
    // Remove video container if exists
    const videoContainer = document.getElementById('webgazer-video-container');
    if (videoContainer) {
      try {
        videoContainer.remove();
        console.log('[EyeTracking] Video container removed from DOM');
      } catch (e) {
        console.warn('[EyeTracking] Error removing video container:', e);
      }
    }
    
    // Stop WebGazer tracker
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
    
    // Stop WebGazer if it's running - with improved error handling
    if (window.webgazer) {
      try {
        // Check if WebGazer is actually initialized before trying to stop it
        // WebGazer might be in a partially initialized state
        let webgazerState = null;
        try {
          webgazerState = window.webgazer.getState ? window.webgazer.getState() : null;
        } catch (stateError) {
          // getState might throw if WebGazer is not fully initialized
          console.log('[EyeTracking] Could not get WebGazer state, proceeding with cleanup');
        }
        
        // Try pause first (less destructive)
        if (typeof window.webgazer.pause === 'function') {
          try {
            window.webgazer.pause();
            console.log('[EyeTracking] WebGazer paused');
            // Small delay to ensure pause completes
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (pauseError) {
            // Ignore pause errors - WebGazer might already be paused or in invalid state
            if (!pauseError?.message?.includes('null') && !pauseError?.message?.includes('remove')) {
              console.warn('[EyeTracking] Error pausing WebGazer:', pauseError);
            }
          }
        }
        
        // Then try end (more thorough cleanup)
        if (typeof window.webgazer.end === 'function') {
          try {
            window.webgazer.end();
            console.log('[EyeTracking] WebGazer ended');
            // Small delay to ensure end() completes
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // After WebGazer.end(), check and stop any remaining video tracks
            // WebGazer might have created streams that need to be stopped
            const videoElement = document.getElementById('webgazerVideoFeed');
            if (videoElement && videoElement.srcObject) {
              const stream = videoElement.srcObject;
              if (stream && stream.getTracks) {
                stream.getTracks().forEach(track => {
                  if (track && track.stop && track.readyState !== 'ended') {
                    track.stop();
                    console.log('[EyeTracking] Video track stopped after WebGazer.end():', track.kind);
                  }
                });
                videoElement.srcObject = null;
              }
            }
          } catch (endError) {
            // This is expected if WebGazer is already cleaned up or in an invalid state
            // The null reference error is common when WebGazer's internal DOM elements are already removed
            if (!endError?.message?.includes('null') && 
                !endError?.message?.includes('remove') &&
                !endError?.message?.includes('Cannot read properties')) {
              console.warn('[EyeTracking] Error ending WebGazer:', endError);
            } else {
              console.log('[EyeTracking] WebGazer already cleaned up or in invalid state (expected)');
            }
          }
        }
      } catch (e) {
        // Catch any other errors during WebGazer cleanup
        // This is non-critical - the important thing is that we've stopped the camera
        if (!e?.message?.includes('null') && 
            !e?.message?.includes('remove') &&
            !e?.message?.includes('Cannot read properties')) {
          console.warn('[EyeTracking] Error stopping WebGazer:', e);
        } else {
          console.log('[EyeTracking] WebGazer cleanup encountered expected error (already cleaned up)');
        }
      }
    }
    
    // Stop camera stream if it exists (fallback - should already be stopped above)
    if (this.cameraStream) {
      try {
        this.cameraStream.getTracks().forEach(track => {
          if (track && track.stop && track.readyState !== 'ended') {
            track.stop();
            console.log('[EyeTracking] Camera track stopped (fallback):', track.kind, track.label);
          }
        });
      } catch (e) {
        console.warn('[EyeTracking] Error stopping camera stream:', e);
      }
      this.cameraStream = null;
    }
    
    // Additional safety: Stop ALL video tracks from any video elements
    // This ensures camera is truly off even if WebGazer didn't clean up properly
    try {
      const videoElements = document.querySelectorAll('video');
      videoElements.forEach(video => {
        if (video.srcObject && video.srcObject instanceof MediaStream) {
          const stream = video.srcObject;
          if (stream && stream.getTracks) {
            stream.getTracks().forEach(track => {
              if (track && track.stop && track.readyState !== 'ended') {
                track.stop();
                console.log('[EyeTracking] Additional video track stopped:', track.kind, track.label);
              }
            });
          }
          video.srcObject = null;
        }
      });
    } catch (e) {
      console.warn('[EyeTracking] Error stopping additional video tracks:', e);
    }
    
    // Additional safety: Stop ALL media tracks in the system that might be from WebGazer
    // This is a last resort to ensure camera is off
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // Enumerate all media devices and check for active tracks
        // Note: This doesn't stop them directly, but helps identify if any are still active
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        if (videoDevices.length > 0) {
          console.log('[EyeTracking] Video devices found:', videoDevices.length);
          // The tracks should already be stopped above, but log for debugging
        }
      }
    } catch (e) {
      // Ignore errors in this cleanup step
      console.debug('[EyeTracking] Error enumerating devices during cleanup:', e);
    }
    
    this.tracker = null;
    this.resetDwell();
    
    // Cleanup eye tracking scanner
    if (this.eyeTrackingScanner) {
      this.eyeTrackingScanner.cleanup();
    }
    
    // Remove row/col overlay
    this.removeRowColOverlay();
    
    this.scanningSettings = null;
    this.scanningTiles = [];
  }

  /**
   * Calibrate WebGazer at a specific point
   * @param {number} x - X coordinate (0-1 or pixel value)
   * @param {number} y - Y coordinate (0-1 or pixel value)
   * @param {boolean} isNormalized - Whether coordinates are normalized (0-1) or pixels
   * @returns {Promise} Promise that resolves when calibration is complete
   */
  async calibrate(x, y, isNormalized = true) {
    if (!this.tracker || !window.webgazer) {
      console.warn('[EyeTracking] Cannot calibrate: WebGazer not initialized');
      return Promise.reject(new Error('WebGazer not initialized'));
    }

    try {
      // Validate input coordinates
      if (typeof x !== 'number' || typeof y !== 'number' || 
          isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
        console.warn(`[EyeTracking] Invalid calibration coordinates: x=${x}, y=${y}`);
        return Promise.reject(new Error('Invalid calibration coordinates'));
      }
      
      // Convert normalized coordinates to pixels if needed
      let pixelX = x;
      let pixelY = y;
      
      if (isNormalized) {
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        pixelX = x * viewportWidth;
        pixelY = y * viewportHeight;
      }
      
      // Clamp to viewport bounds to prevent errors
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      pixelX = Math.max(0, Math.min(viewportWidth, Math.round(pixelX)));
      pixelY = Math.max(0, Math.min(viewportHeight, Math.round(pixelY)));

      console.log(`[EyeTracking] Calibrating at (${pixelX}, ${pixelY})`);
      
      // WebGazer calibrate method: webgazer.calibrate(x, y)
      // This records the user's gaze at the specified point
      if (typeof window.webgazer.calibrate === 'function') {
        await window.webgazer.calibrate(pixelX, pixelY);
        console.log(`[EyeTracking] ✓ Calibration point recorded at (${pixelX}, ${pixelY})`);
        return Promise.resolve();
      } else {
        console.warn('[EyeTracking] WebGazer.calibrate method not available');
        return Promise.reject(new Error('Calibration method not available'));
      }
    } catch (error) {
      console.error('[EyeTracking] Calibration error:', error);
      return Promise.reject(error);
    }
  }

  /**
   * Check if WebGazer is ready for calibration
   * @returns {boolean}
   */
  isReadyForCalibration() {
    // For WebGazer (camera), check if tracker is set and calibrate method exists
    if (this.tracker && this.tracker === window.webgazer) {
      return typeof window.webgazer?.calibrate === 'function';
    }
    // For other devices, check if tracker exists
    return !!this.tracker;
  }

  async updateSettings(settings) {
    const wasEnabled = this.isEnabled;
    this.isEnabled = settings.enabled || false;
    this.dwellTime = settings.dwellTime || 1000;

    // If disabled, immediately cleanup to stop camera and tracking
    if (!this.isEnabled) {
      console.log('[EyeTracking] Eye tracking disabled via updateSettings, immediately cleaning up');
      await this.cleanup();
    } else if (wasEnabled !== this.isEnabled && this.isEnabled) {
      // If re-enabled, the caller should call initialize() separately
      // Don't auto-initialize here to avoid unexpected camera activation
      console.log('[EyeTracking] Eye tracking enabled via updateSettings, but initialization should be done separately');
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
