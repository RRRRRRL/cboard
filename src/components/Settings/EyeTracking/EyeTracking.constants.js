export const EYE_TRACKING_DEVICE_TYPES = {
  TOBII: 'tobii',
  EYETRIBE: 'eyetribe',
  PUPIL: 'pupil',
  CAMERA: 'camera', // WebGazer.js - browser camera-based eye tracking
  CUSTOM: 'custom'
};

export const MIN_DWELL_TIME = 500; // milliseconds
export const MAX_DWELL_TIME = 5000; // milliseconds
export const DEFAULT_DWELL_TIME = 1000; // milliseconds
export const DWELL_TIME_STEP = 100; // milliseconds

export const CALIBRATION_POINTS = [
  { x: 0.1, y: 0.1 }, // Top-left
  { x: 0.5, y: 0.1 }, // Top-center
  { x: 0.9, y: 0.1 }, // Top-right
  { x: 0.1, y: 0.5 }, // Middle-left
  { x: 0.5, y: 0.5 }, // Center
  { x: 0.9, y: 0.5 }, // Middle-right
  { x: 0.1, y: 0.9 }, // Bottom-left
  { x: 0.5, y: 0.9 }, // Bottom-center
  { x: 0.9, y: 0.9 }  // Bottom-right
];

