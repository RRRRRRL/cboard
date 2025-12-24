/**
 * WebGazer Model Configuration
 * 
 * This module configures WebGazer to use self-hosted TensorFlow.js models
 * instead of loading from tfhub.dev, which causes CORS issues.
 * 
 * Models should be placed in:
 *   - public/models/facemesh/model.json
 *   - public/models/facemesh/group1-shard1of1.bin
 *   - public/models/iris/model.json
 *   - public/models/iris/group1-shard1of1.bin
 *   - public/models/blazeface/model.json
 *   - public/models/blazeface/group1-shard1of1.bin
 */

/**
 * Get the base URL for local models
 */
export function getModelBaseUrl() {
  // Use relative path for same-origin requests (no CORS issues)
  return `${window.location.origin}/models`;
}

/**
 * Configure TensorFlow.js to use local models
 * This should be called before WebGazer initialization
 */
export function configureTensorFlowModels() {
  if (typeof window === 'undefined' || !window.tf) {
    console.warn('[WebGazerModelConfig] TensorFlow.js not loaded yet');
    return;
  }

  const modelBaseUrl = getModelBaseUrl();
  
  // Override TensorFlow.js model loading to use local URLs
  // This intercepts requests to tfhub.dev and redirects to local models
  // Only override if not already overridden (to avoid double interception)
  if (window.tf.loadGraphModel._originalLoadGraphModel) {
    console.log('[WebGazerModelConfig] TensorFlow.js already intercepted');
    return;
  }
  
  const originalLoadGraphModel = window.tf.loadGraphModel;
  window.tf.loadGraphModel._originalLoadGraphModel = originalLoadGraphModel;
  
  window.tf.loadGraphModel = function(url, options = {}) {
    // Check if URL is from tfhub.dev and map to local model
    let localUrl = url;
    
    if (typeof url === 'string') {
      // Facemesh model
      if (url.includes('mediapipe/tfjs-model/facemesh')) {
        if (url.includes('group1-shard')) {
          localUrl = `${modelBaseUrl}/facemesh/group1-shard1of1.bin`;
        } else {
          localUrl = `${modelBaseUrl}/facemesh/model.json`;
        }
        console.log('[WebGazerModelConfig] Redirecting facemesh model to:', localUrl);
      }
      // Iris model
      else if (url.includes('mediapipe/tfjs-model/iris')) {
        if (url.includes('group1-shard')) {
          localUrl = `${modelBaseUrl}/iris/group1-shard1of1.bin`;
        } else {
          localUrl = `${modelBaseUrl}/iris/model.json`;
        }
        console.log('[WebGazerModelConfig] Redirecting iris model to:', localUrl);
      }
      // Blazeface model
      else if (url.includes('tensorflow/tfjs-model/blazeface')) {
        if (url.includes('group1-shard')) {
          localUrl = `${modelBaseUrl}/blazeface/group1-shard1of1.bin`;
        } else {
          localUrl = `${modelBaseUrl}/blazeface/model.json`;
        }
        console.log('[WebGazerModelConfig] Redirecting blazeface model to:', localUrl);
      }
    }
    
    // Call original function with local URL
    return originalLoadGraphModel.call(this, localUrl, options);
  };
  
  console.log('[WebGazerModelConfig] TensorFlow.js model loading configured to use local models');
}

/**
 * Configure face-landmarks-detection library to use local models
 * This is used by WebGazer internally
 */
export function configureFaceLandmarksDetection() {
  if (typeof window === 'undefined' || !window.faceLandmarksDetection) {
    console.warn('[WebGazerModelConfig] face-landmarks-detection not loaded yet');
    return;
  }

  const modelBaseUrl = getModelBaseUrl();
  
  // Override model URLs in face-landmarks-detection
  // The library uses these URLs internally
  const originalCreateDetector = window.faceLandmarksDetection.createDetector;
  
  window.faceLandmarksDetection.createDetector = async function(model, detectorConfig = {}) {
    // Override detector model URL if not specified
    if (!detectorConfig.detectorModelUrl) {
      detectorConfig.detectorModelUrl = `${modelBaseUrl}/blazeface/model.json`;
    }
    
    // Override landmark model URL if not specified
    if (!detectorConfig.landmarkModelUrl) {
      detectorConfig.landmarkModelUrl = `${modelBaseUrl}/facemesh/model.json`;
    }
    
    console.log('[WebGazerModelConfig] Configuring face-landmarks-detection with local models');
    return originalCreateDetector.call(this, model, detectorConfig);
  };
  
  console.log('[WebGazerModelConfig] face-landmarks-detection configured to use local models');
}

/**
 * Initialize model configuration
 * Call this before WebGazer initialization
 */
export function initializeModelConfig() {
  // Wait for TensorFlow.js to load
  if (typeof window !== 'undefined' && window.tf) {
    configureTensorFlowModels();
  } else {
    // Wait for TensorFlow.js to load
    const checkTensorFlow = setInterval(() => {
      if (window.tf) {
        clearInterval(checkTensorFlow);
        configureTensorFlowModels();
      }
    }, 100);
    
    // Timeout after 5 seconds
    setTimeout(() => {
      clearInterval(checkTensorFlow);
      console.warn('[WebGazerModelConfig] TensorFlow.js not loaded after 5 seconds');
    }, 5000);
  }
  
  // Wait for face-landmarks-detection to load (if available)
  if (typeof window !== 'undefined' && window.faceLandmarksDetection) {
    configureFaceLandmarksDetection();
  }
}

export default {
  getModelBaseUrl,
  configureTensorFlowModels,
  configureFaceLandmarksDetection,
  initializeModelConfig
};

