import React from 'react';
import ReactDOM from 'react-dom';
import 'fontsource-roboto';
import { Provider } from 'react-redux';
import { BrowserRouter, HashRouter, Route } from 'react-router-dom';
import { TouchBackend } from 'react-dnd-touch-backend';
import { DndProvider } from 'react-dnd';
import { PersistGate } from 'redux-persist/es/integration/react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';

import App from './components/App';
import { isCordova, onCordovaReady, initCordovaPlugins } from './cordova-util';
import './index.css';
import './polyfills';
import './env';
import LanguageProvider from './providers/LanguageProvider';
import SpeechProvider from './providers/SpeechProvider';
import ThemeProvider from './providers/ThemeProvider';
import configureStore, { getStore } from './store';
import SubscriptionProvider from './providers/SubscriptionProvider';
import { PAYPAL_CLIENT_ID } from './constants';
import { initializeAppInsights } from './appInsights';
import './utils/debugLogin'; // Load debug utility
import './utils/cleanupTemporaryProfiles'; // Load cleanup utility

// Intercept TensorFlow.js and fetch API to redirect model loading to local files
// This must be done BEFORE WebGazer.js loads, as WebGazer starts loading models on page load
if (typeof window !== 'undefined') {
  // Intercept fetch API to redirect tfhub.dev requests to local models
  // This must be done BEFORE WebGazer.js loads models on page load
  const originalFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    // Convert URL to string if it's a Request object
    let urlString = '';
    let isRequestObject = false;
    
    if (typeof url === 'string') {
      urlString = url;
    } else if (url instanceof Request) {
      urlString = url.url;
      isRequestObject = true;
    } else {
      urlString = url.toString();
    }
    
    // Check if this is a TensorFlow model request
    // Also check for redirected URLs from storage.googleapis.com/kagglesdsdata
    // Match ANY storage.googleapis.com URL that contains model IDs or kagglesdsdata
    if (urlString && (
      urlString.includes('tfhub.dev') ||
      urlString.includes('storage.googleapis.com') ||
      urlString.includes('kagglesdsdata') ||
      urlString.includes('kaggleusercontent') ||
      urlString.includes('googleusercontent') ||
      urlString.includes('mediapipe/tfjs-model') ||
      urlString.includes('tensorflow/tfjs-model') ||
      urlString.includes('models/2341') || // facemesh model ID
      urlString.includes('models/2379') || // blazeface model ID
      urlString.includes('models/2479')    // iris model ID
    )) {
      // Map to local model URLs
      let localUrl = urlString;
      let redirected = false;
      
      // Check for model.json or .bin files
      const isBinFile = urlString.includes('group1-shard') || urlString.includes('.bin');
      
      // Match by model path or redirected storage URL pattern
      // Check for facemesh model (ID 2341)
      if (urlString.includes('mediapipe/tfjs-model/facemesh') || 
          urlString.includes('models/2341') || 
          urlString.includes('2341/3130') ||
          (urlString.includes('kagglesdsdata') && urlString.includes('2341')) ||
          (urlString.includes('storage.googleapis.com') && urlString.includes('2341'))) {
        if (isBinFile) {
          localUrl = `${window.location.origin}/models/facemesh/group1-shard1of1.bin`;
        } else {
          localUrl = `${window.location.origin}/models/facemesh/model.json`;
        }
        redirected = true;
        console.log('[ModelInterceptor] Redirecting facemesh:', urlString.substring(0, 120), '->', localUrl);
      } else if (urlString.includes('mediapipe/tfjs-model/iris') || 
                 urlString.includes('models/2479') || 
                 urlString.includes('2479/3326') ||
                 (urlString.includes('kagglesdsdata') && urlString.includes('2479')) ||
                 (urlString.includes('storage.googleapis.com') && urlString.includes('2479'))) {
        if (isBinFile) {
          localUrl = `${window.location.origin}/models/iris/group1-shard1of1.bin`;
        } else {
          localUrl = `${window.location.origin}/models/iris/model.json`;
        }
        redirected = true;
        console.log('[ModelInterceptor] Redirecting iris:', urlString.substring(0, 120), '->', localUrl);
      } else if (urlString.includes('tensorflow/tfjs-model/blazeface') || 
                 urlString.includes('models/2379') || 
                 urlString.includes('2379/3196') ||
                 (urlString.includes('kagglesdsdata') && urlString.includes('2379')) ||
                 (urlString.includes('storage.googleapis.com') && urlString.includes('2379'))) {
        if (isBinFile) {
          localUrl = `${window.location.origin}/models/blazeface/group1-shard1of1.bin`;
        } else {
          localUrl = `${window.location.origin}/models/blazeface/model.json`;
        }
        redirected = true;
        console.log('[ModelInterceptor] Redirecting blazeface:', urlString.substring(0, 120), '->', localUrl);
      }
      
      // Use the local URL instead if redirected
      if (redirected) {
        if (typeof url === 'string') {
          return originalFetch.call(this, localUrl, options);
        } else if (isRequestObject) {
          // If it's a Request object, create a new one with the local URL
          const newRequest = new Request(localUrl, {
            method: url.method || options.method || 'GET',
            headers: url.headers || options.headers || {},
            body: url.body || options.body,
            mode: url.mode || options.mode || 'cors',
            credentials: url.credentials || options.credentials || 'same-origin',
            cache: url.cache || options.cache || 'default',
            redirect: url.redirect || options.redirect || 'follow',
            referrer: url.referrer || options.referrer || 'client',
            integrity: url.integrity || options.integrity
          });
          return originalFetch.call(this, newRequest, options);
        }
      }
    }
    
    // For all other requests, use original fetch
    return originalFetch.apply(this, arguments);
  };
  
  // Intercept TensorFlow.js loadGraphModel when it becomes available
  // This is a backup in case fetch interception doesn't catch everything
  const setupTensorFlowInterception = () => {
    if (window.tf && window.tf.loadGraphModel && !window.tf.loadGraphModel._intercepted) {
        const originalLoadGraphModel = window.tf.loadGraphModel;
        window.tf.loadGraphModel = function(url, options = {}) {
          let localUrl = url;
          
          if (typeof url === 'string') {
            const isBinFile = url.includes('group1-shard') || url.includes('.bin');
            
            if (url.includes('mediapipe/tfjs-model/facemesh')) {
              if (isBinFile) {
                localUrl = `${window.location.origin}/models/facemesh/group1-shard1of1.bin`;
              } else {
                localUrl = `${window.location.origin}/models/facemesh/model.json`;
              }
              console.log('[ModelInterceptor] tf.loadGraphModel: Redirecting facemesh to:', localUrl);
            } else if (url.includes('mediapipe/tfjs-model/iris')) {
              if (isBinFile) {
                localUrl = `${window.location.origin}/models/iris/group1-shard1of1.bin`;
              } else {
                localUrl = `${window.location.origin}/models/iris/model.json`;
              }
              console.log('[ModelInterceptor] tf.loadGraphModel: Redirecting iris to:', localUrl);
            } else if (url.includes('tensorflow/tfjs-model/blazeface')) {
              if (isBinFile) {
                localUrl = `${window.location.origin}/models/blazeface/group1-shard1of1.bin`;
              } else {
                localUrl = `${window.location.origin}/models/blazeface/model.json`;
              }
              console.log('[ModelInterceptor] tf.loadGraphModel: Redirecting blazeface to:', localUrl);
            }
          }
          
          return originalLoadGraphModel.call(this, localUrl, options);
        };
      window.tf.loadGraphModel._intercepted = true;
      console.log('[ModelInterceptor] TensorFlow.js loadGraphModel intercepted');
    }
  };
  
  // Try to set up TensorFlow interception immediately
  setupTensorFlowInterception();
  
  // Also set up when TensorFlow.js loads (in case it loads after this script)
  const checkTensorFlow = setInterval(() => {
    if (window.tf) {
      setupTensorFlowInterception();
    }
  }, 100);
  
  // Stop checking after 10 seconds
  setTimeout(() => {
    clearInterval(checkTensorFlow);
  }, 10000);
  
  console.log('[ModelInterceptor] Fetch API and TensorFlow.js interception configured');
}

// Suppress console warnings and errors from third-party libraries
if (typeof window !== 'undefined') {
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // Override console.error to suppress known warnings
  console.error = function(...args) {
    const first = args[0];
    const fullMessage = args.map(a => {
      if (a && a.message && typeof a.message === 'string') return a.message;
      return String(a);
    }).join(' ');
    
    // Derive a text string to inspect (handle both Error objects and strings)
    const textToCheck =
      (first && first.message && typeof first.message === 'string')
        ? first.message
        : fullMessage;
    
    if (typeof textToCheck === 'string') {
      
      // Suppress warnings from react-grid-layout library
      if (textToCheck.includes('componentWillReceiveProps') ||
          textToCheck.includes('componentWillMount') ||
          textToCheck.includes('ReactGridLayout') ||
          textToCheck.includes('ResponsiveReactGridLayout') ||
          textToCheck.includes('has been renamed') ||
          textToCheck.includes('is not recommended')) {
        return;
      }
      // Suppress WebGazer.js CORS errors (these are expected and don't affect functionality)
      // Check for all variations of CORS errors from Google Storage and TensorFlow Hub
      if ((textToCheck.includes('Access to fetch') ||
           textToCheck.includes('CORS policy') ||
           textToCheck.includes('blocked by CORS') ||
           textToCheck.includes('Access-Control-Allow-Origin') ||
           textToCheck.includes('CORS') ||
           textToCheck.includes('has been blocked by CORS policy')) &&
          (textToCheck.includes('storage.googleapis.com') || 
           textToCheck.includes('googleapis.com') ||
           textToCheck.includes('tfhub.dev') ||
           textToCheck.includes('kagglesdsdata') ||
           textToCheck.includes('kaggleusercontent') ||
           textToCheck.includes('googleusercontent'))) {
        return;
      }
      // Suppress any fetch errors related to Google Storage (broader catch)
      if (textToCheck.includes('failed to fetch') &&
          (textToCheck.includes('storage.googleapis.com') || 
           textToCheck.includes('googleapis.com') ||
           textToCheck.includes('kagglesdsdata') ||
           textToCheck.includes('kaggleusercontent'))) {
        return;
      }
      // Suppress WebGazer texture size errors (video element not ready yet)
      if (textToCheck.includes('Requested texture size') || 
          (textToCheck.includes('[0x0]') && textToCheck.includes('is invalid')) ||
          textToCheck.includes('createUnsignedBytesMatrixTexture') ||
          (textToCheck.includes('webgazer') && textToCheck.includes('texture'))) {
        return;
      }
      // Suppress WebGazer video element null errors (video not ready yet)
      // Check for any null property access related to video
      if ((textToCheck.includes('Cannot read properties of null') || 
           textToCheck.includes('Cannot read property') ||
           textToCheck.includes('reading \'videoWidth\'') ||
           textToCheck.includes('reading \'videoHeight\'')) && 
          (textToCheck.includes('videoWidth') || textToCheck.includes('videoHeight') || 
           textToCheck.includes('webgazer.js'))) {
        return;
      }
      // Suppress WebGazer drawImage errors (video element not ready yet)
      if (textToCheck.includes('Failed to execute \'drawImage\'') ||
          textToCheck.includes('Failed to execute "drawImage"') ||
          (textToCheck.includes('drawImage') && textToCheck.includes('not of type')) ||
          (textToCheck.includes('drawimage') && textToCheck.includes('not of type'))) {
        return;
      }
    }
    originalError.apply(console, args);
  };
  
  // Override console.warn to suppress known warnings
  console.warn = function(...args) {
    const message = args[0];
    if (typeof message === 'string') {
      // Suppress React lifecycle warnings
      if (message.includes('componentWillReceiveProps') || 
          message.includes('componentWillMount') ||
          message.includes('ReactGridLayout') ||
          message.includes('ResponsiveReactGridLayout') ||
          message.includes('has been renamed') ||
          message.includes('is not recommended')) {
        return;
      }
      // Suppress tracking prevention warnings (PayPal, WebGazer, etc.)
      if (message.includes('Tracking Prevention blocked access to storage') ||
          message.includes('Tracking Prevention') ||
          message.includes('blocked access to storage')) {
        return;
      }
      // Suppress WebGazer.js CORS warnings - all variations
      if ((message.includes('Access to fetch') ||
           message.includes('CORS policy') ||
           message.includes('blocked by CORS') ||
           message.includes('Access-Control-Allow-Origin') ||
           message.includes('CORS') ||
           message.includes('has been blocked by CORS policy') ||
           message.includes('failed to fetch')) &&
          (message.includes('storage.googleapis.com') || 
           message.includes('googleapis.com') ||
           message.includes('tfhub.dev') ||
           message.includes('kagglesdsdata') ||
           message.includes('kaggleusercontent') ||
           message.includes('googleusercontent'))) {
        return;
      }
    }
    originalWarn.apply(console, args);
  };

  // Comprehensive error suppression for WebGazer.js CORS and fetch errors
  // WebGazer tries to load ML models from external URLs which causes CORS errors
  // These errors are non-critical and can be safely suppressed
  
  // Hard override of window.onerror / window.onunhandledrejection to stop
  // CRA/React error overlay from treating WebGazer texture errors as fatal.
  // Returning true from window.onerror marks the error as handled.
  // This must be set BEFORE React initializes to catch errors early
  const previousOnError = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    const msg = (message && message.toString()) || '';
    const src = (source && source.toString()) || '';
    const stack = (error && error.stack) || '';
    const combined = `${msg} ${src} ${stack}`.toLowerCase();

    // If error comes from webgazer.js, check if it's a known non-critical error
    const isFromWebGazer = src.includes('webgazer.js') || stack.includes('webgazer') || stack.includes('webgazer.js');
    
    const isWebGazerSuppressedError =
      // Texture size / WebGL issues - check all variations
      combined.includes('requested texture size') ||
      combined.includes('[0x0]') ||
      combined.includes('0x0') ||
      combined.includes('createunsignedbytesmatrixture') ||
      combined.includes('createunsignedbytesmatrixtexture') ||
      combined.includes('acquiretexture') ||
      combined.includes('gettexture') ||
      combined.includes('uploadtogpu') ||
      // Video element null errors (video not ready yet) - check all variations
      combined.includes('videowidth') ||
      combined.includes('videoheight') ||
      (combined.includes('cannot read properties of null') && 
       (combined.includes('videowidth') || combined.includes('videoheight') || 
        combined.includes('reading') || isFromWebGazer)) ||
      (combined.includes('cannot read property') && 
       (combined.includes('videowidth') || combined.includes('videoheight') || 
        combined.includes('null') || isFromWebGazer)) ||
      // If error is from webgazer.js and mentions null/video, suppress it (broad catch)
      (isFromWebGazer && (combined.includes('null') || combined.includes('videowidth') || combined.includes('videoheight'))) ||
      // Canvas drawImage errors (video element not ready yet)
      (combined.includes('failed to execute') && combined.includes('drawimage')) ||
      (combined.includes('drawimage') && combined.includes('not of type')) ||
      // WebGazer source file - if error comes from webgazer.js, likely WebGazer-related
      src.includes('webgazer.js') ||
      src.includes('webgazer') ||
      // Stack trace patterns - WebGazer and TensorFlow.js model loading
      stack.includes('webgazer') ||
      stack.includes('webgazer.js') ||
      stack.includes('face-landmarks-detection') ||
      stack.includes('facemesh') ||
      stack.includes('blazeface') ||
      stack.includes('iris') ||
      stack.includes('tfhub.dev') ||
      stack.includes('loadWeights') ||
      stack.includes('weights_loader') ||
      stack.includes('graph_model') ||
      stack.includes('GR(') ||
      stack.includes('ZR.createUnsignedBytesMatrixTexture') ||
      stack.includes('KA.acquireTexture') ||
      stack.includes('uF.acquireTexture') ||
      stack.includes('uF.uploadToGPU') ||
      stack.includes('uF.getTexture') ||
      stack.includes('Object.kernelFunc') ||
      stack.includes('HTMLVideoElement') ||
      // Fetch / CORS / model loading failures from WebGazer / tf.js
      combined.includes('failed to fetch') ||
      combined.includes('typeerror: failed to fetch') ||
      // Google Storage CORS errors - comprehensive detection
      combined.includes('storage.googleapis.com') ||
      combined.includes('googleapis.com') ||
      combined.includes('kagglesdsdata') ||
      combined.includes('kaggleusercontent') ||
      combined.includes('googleusercontent') ||
      // CORS policy errors
      (combined.includes('cors') && (
        combined.includes('policy') ||
        combined.includes('blocked') ||
        combined.includes('access-control-allow-origin') ||
        combined.includes('storage.googleapis.com') ||
        combined.includes('googleapis.com') ||
        combined.includes('tfhub.dev')
      )) ||
      (combined.includes('webgazer') && (
        combined.includes('loadweights') ||
        combined.includes('face-landmarks') ||
        combined.includes('facemesh') ||
        combined.includes('tfhub.dev') ||
        combined.includes('storage.googleapis.com') ||
        combined.includes('googleapis.com') ||
        combined.includes('fetch')
      ));

    if (isWebGazerSuppressedError) {
      // Suppress completely – do not forward to previous handler
      // This prevents React error overlay from showing
      if (process.env.NODE_ENV === 'development') {
        
      }
      return true; // mark as handled - prevents default error handling
    }

    if (typeof previousOnError === 'function') {
      return previousOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  const previousOnUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = function(event) {
    const reason = event && event.reason;
    const msg = (reason && (reason.message || reason.toString())) || '';
    const stack = (reason && reason.stack) || '';
    const combined = `${msg} ${stack}`.toLowerCase();

    const isWebGazerSuppressedError =
      // Texture size / WebGL issues - check all variations
      combined.includes('requested texture size') ||
      combined.includes('[0x0]') ||
      combined.includes('0x0') ||
      combined.includes('createunsignedbytesmatrixture') ||
      combined.includes('createunsignedbytesmatrixtexture') ||
      combined.includes('acquiretexture') ||
      combined.includes('gettexture') ||
      combined.includes('uploadtogpu') ||
      // Video element null errors (video not ready yet) - check all variations
      combined.includes('videowidth') ||
      combined.includes('videoheight') ||
      (combined.includes('cannot read properties of null') && 
       (combined.includes('videowidth') || combined.includes('videoheight') || 
        combined.includes('reading') || stack.includes('webgazer'))) ||
      (combined.includes('cannot read property') && 
       (combined.includes('videowidth') || combined.includes('videoheight') || 
        combined.includes('null') || stack.includes('webgazer'))) ||
      // Canvas drawImage errors (video element not ready yet)
      (combined.includes('failed to execute') && combined.includes('drawimage')) ||
      (combined.includes('drawimage') && combined.includes('not of type')) ||
      // Stack trace patterns
      stack.includes('webgazer') ||
      stack.includes('webgazer.js') ||
      stack.includes('GR(') ||
      stack.includes('ZR.createUnsignedBytesMatrixTexture') ||
      stack.includes('KA.acquireTexture') ||
      stack.includes('uF.acquireTexture') ||
      stack.includes('uF.uploadToGPU') ||
      stack.includes('uF.getTexture') ||
      stack.includes('Object.kernelFunc') ||
      stack.includes('HTMLVideoElement') ||
      // Fetch / CORS / model loading failures from WebGazer / tf.js
      combined.includes('failed to fetch') ||
      combined.includes('typeerror: failed to fetch') ||
      // Google Storage CORS errors - comprehensive detection
      combined.includes('storage.googleapis.com') ||
      combined.includes('googleapis.com') ||
      combined.includes('kagglesdsdata') ||
      combined.includes('kaggleusercontent') ||
      combined.includes('googleusercontent') ||
      // CORS policy errors
      (combined.includes('cors') && (
        combined.includes('policy') ||
        combined.includes('blocked') ||
        combined.includes('access-control-allow-origin') ||
        combined.includes('storage.googleapis.com') ||
        combined.includes('googleapis.com') ||
        combined.includes('tfhub.dev')
      )) ||
      (combined.includes('webgazer') && (
        combined.includes('loadweights') ||
        combined.includes('face-landmarks') ||
        combined.includes('facemesh') ||
        combined.includes('tfhub.dev') ||
        combined.includes('storage.googleapis.com') ||
        combined.includes('googleapis.com') ||
        combined.includes('fetch')
      ));

    if (isWebGazerSuppressedError) {
      event.preventDefault();
      event.stopPropagation();
      if (process.env.NODE_ENV === 'development') {
        
      }
      return true;
    }

    if (typeof previousOnUnhandledRejection === 'function') {
      return previousOnUnhandledRejection(event);
    }
    return false;
  };

  // Single unified handler for unhandled promise rejections
  if (!window._webgazerErrorHandlerAttached) {
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;
      const errorMessage = error?.message || error?.toString() || '';
      const errorStack = error?.stack || '';
      const errorString = JSON.stringify(error) || '';
      
      // Suppress WebGazer.js CORS-related errors and model loading failures
      const isWebGazerError = 
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('TypeError: Failed to fetch') ||
        errorMessage.includes('CORS') ||
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
        errorMessage.includes('is invalid') ||
        errorMessage.includes('createUnsignedBytesMatrixTexture') ||
        // Video element null errors (video not ready yet) - check all variations
        errorMessage.includes('videoWidth') ||
        errorMessage.includes('videoHeight') ||
        (errorMessage.includes('Cannot read properties of null') && 
         (errorMessage.includes('videoWidth') || errorMessage.includes('videoHeight') || 
          errorMessage.includes('reading') || errorStack.includes('webgazer'))) ||
        (errorMessage.includes('Cannot read property') && 
         (errorMessage.includes('videoWidth') || errorMessage.includes('videoHeight') || 
          errorMessage.includes('null') || errorStack.includes('webgazer'))) ||
        // Canvas drawImage errors (video element not ready yet)
        (errorMessage.includes('Failed to execute') && errorMessage.includes('drawImage')) ||
        (errorMessage.includes('drawImage') && errorMessage.includes('not of type')) ||
        errorStack.includes('face-landmarks-detection') ||
        errorStack.includes('facemesh') ||
        errorStack.includes('blazeface') ||
        errorStack.includes('iris') ||
        errorStack.includes('tfhub.dev') ||
        errorStack.includes('webgazer') ||
        errorStack.includes('webgazer.js') ||
        errorStack.includes('loadWeights') ||
        errorStack.includes('weights_loader') ||
        errorStack.includes('graph_model') ||
        errorStack.includes('@mediapipe') ||
        errorStack.includes('createUnsignedBytesMatrixTexture') ||
        errorStack.includes('acquireTexture') ||
        errorStack.includes('getTexture') ||
        errorStack.includes('uploadToGPU') ||
        errorStack.includes('HTMLVideoElement') ||
        errorString.includes('webgazer') ||
        errorString.includes('facemesh') ||
        errorString.includes('texture size') ||
        errorString.includes('[0x0]') ||
        (errorString.includes('videowidth') || errorString.includes('videoheight')) ||
        errorString.includes('drawimage');
      
      if (isWebGazerError) {
        event.preventDefault(); // Suppress the error
        // Optionally log in development mode only
        if (process.env.NODE_ENV === 'development') {
          
        }
        return false;
      }
    });
    window._webgazerErrorHandlerAttached = true;
  }

  // Single unified handler for global errors
  // This must run in capture phase to catch errors before React error overlay
  if (!window._webgazerGlobalErrorHandlerAttached) {
    window.addEventListener('error', (event) => {
      const errorMessage = (event.message || '').toLowerCase();
      const errorSource = ((event.filename || event.source || '').toString()).toLowerCase();
      const errorString = JSON.stringify(event).toLowerCase();
      const errorStack = ((event.error?.stack || '').toString()).toLowerCase();
      
      // Suppress WebGazer.js CORS and fetch errors (model loading failures are non-critical)
      // Check all variations and patterns from the error stack trace
      const isWebGazerError = 
        errorMessage.includes('cors') ||
        errorMessage.includes('failed to fetch') ||
        errorMessage.includes('typeerror: failed to fetch') ||
        errorMessage.includes('networkerror') ||
        // Google Storage CORS errors - comprehensive detection
        errorMessage.includes('storage.googleapis.com') ||
        errorMessage.includes('googleapis.com') ||
        errorMessage.includes('tfhub.dev') ||
        errorMessage.includes('kagglesdsdata') ||
        errorMessage.includes('kaggleusercontent') ||
        errorMessage.includes('googleusercontent') ||
        errorMessage.includes('blocked by cors policy') ||
        errorMessage.includes('access-control-allow-origin') ||
        errorMessage.includes('cors policy') ||
        errorMessage.includes('requested texture size') ||
        errorMessage.includes('[0x0]') ||
        errorMessage.includes('0x0') ||
        errorMessage.includes('is invalid') ||
        errorMessage.includes('createunsignedbytesmatrixtexture') ||
        // Video element null errors (video not ready yet) - check all variations
        errorMessage.includes('videowidth') ||
        errorMessage.includes('videoheight') ||
        (errorMessage.includes('cannot read properties of null') && 
         (errorMessage.includes('videowidth') || errorMessage.includes('videoheight') || 
          errorMessage.includes('reading') || errorSource.includes('webgazer.js') || errorStack.includes('webgazer'))) ||
        (errorMessage.includes('cannot read property') && 
         (errorMessage.includes('videowidth') || errorMessage.includes('videoheight') || 
          errorMessage.includes('null') || errorSource.includes('webgazer.js') || errorStack.includes('webgazer'))) ||
        // Canvas drawImage errors (video element not ready yet)
        (errorMessage.includes('failed to execute') && errorMessage.includes('drawimage')) ||
        (errorMessage.includes('drawimage') && errorMessage.includes('not of type')) ||
        errorSource.includes('facemesh') ||
        errorSource.includes('webgazer') ||
        errorSource.includes('@mediapipe') ||
        errorSource.includes('webgazer.js') ||
        errorStack.includes('webgazer') ||
        errorStack.includes('webgazer.js') ||
        errorStack.includes('face-landmarks-detection') ||
        errorStack.includes('facemesh') ||
        errorStack.includes('blazeface') ||
        errorStack.includes('iris') ||
        errorStack.includes('tfhub.dev') ||
        errorStack.includes('loadweights') ||
        errorStack.includes('weights_loader') ||
        errorStack.includes('graph_model') ||
        errorStack.includes('gr(') ||
        errorStack.includes('zr.createunsignedbytesmatrixtexture') ||
        errorStack.includes('ka.acquiretexture') ||
        errorStack.includes('uf.acquiretexture') ||
        errorStack.includes('uf.uploadtogpu') ||
        errorStack.includes('uf.gettexture') ||
        errorStack.includes('object.kernelfunc') ||
        errorStack.includes('htmlvideoelement') ||
        errorStack.includes('createunsignedbytesmatrixtexture') ||
        errorStack.includes('acquiretexture') ||
        errorStack.includes('gettexture') ||
        errorStack.includes('uploadtogpu') ||
        errorString.includes('webgazer') ||
        errorString.includes('facemesh') ||
        errorString.includes('blazeface') ||
        errorString.includes('iris') ||
        errorString.includes('tfhub.dev') ||
        errorString.includes('texture size') ||
        errorString.includes('[0x0]') ||
        errorString.includes('0x0') ||
        (errorString.includes('videowidth') || errorString.includes('videoheight')) ||
        errorString.includes('drawimage');
      
      if (isWebGazerError) {
        event.preventDefault(); // Suppress the error
        event.stopPropagation(); // Stop event propagation
        event.stopImmediatePropagation(); // Stop all other handlers
        // Optionally log in development mode only
        if (process.env.NODE_ENV === 'development') {
          
        }
        return false;
      }
    }, true); // Use capture phase to catch errors early, before React error overlay
    
    window._webgazerGlobalErrorHandlerAttached = true;
  }
  
  // Suppress React error overlay for WebGazer errors
  // Override React's error overlay by intercepting error reporting
  if (typeof window !== 'undefined' && !window._reactErrorOverlaySuppressed) {
    // Try to suppress React error overlay directly
    const originalConsoleError = console.error;
    console.error = function(...args) {
      const errorStr = args.map(a => String(a)).join(' ').toLowerCase();
      if (errorStr.includes('requested texture size') ||
          errorStr.includes('[0x0]') ||
          errorStr.includes('webgazer.js') ||
          errorStr.includes('createunsignedbytesmatrixtexture') ||
          errorStr.includes('acquiretexture') ||
          errorStr.includes('uploadtogpu') ||
          // Video element null errors - check all variations
          errorStr.includes('videowidth') ||
          errorStr.includes('videoheight') ||
          (errorStr.includes('cannot read properties of null') && 
           (errorStr.includes('videowidth') || errorStr.includes('videoheight') || 
            errorStr.includes('reading') || errorStr.includes('webgazer.js'))) ||
          (errorStr.includes('cannot read property') && 
           (errorStr.includes('videowidth') || errorStr.includes('videoheight') || 
            errorStr.includes('null') || errorStr.includes('webgazer.js'))) ||
          // Canvas drawImage errors
          (errorStr.includes('failed to execute') && errorStr.includes('drawimage')) ||
          (errorStr.includes('drawimage') && errorStr.includes('not of type'))) {
        // Suppress this error from console.error
        return;
      }
      originalConsoleError.apply(console, args);
    };
    window._reactErrorOverlaySuppressed = true;
  }
}

initializeAppInsights();
const { persistor } = configureStore();
const store = getStore();

// Make store available globally for debugging
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  window.__REDUX_STORE__ = store;
}
const dndOptions = {
  enableTouchEvents: true,
  enableMouseEvents: true,
  enableKeyboardEvents: true
};

// When running in Cordova, must use the HashRouter
const PlatformRouter = isCordova() ? HashRouter : BrowserRouter;

// PayPal configuration
const paypalOptions = {
  'client-id': PAYPAL_CLIENT_ID,
  currency: 'USD',
  vault: true,
  intent: 'subscription',
  // Suppress tracking prevention warnings
  'data-namespace': 'paypal-sdk',
  'data-sdk-integration-source': 'button-factory'
};

const renderApp = () => {
  if (isCordova()) {
    initCordovaPlugins();
  }
  ReactDOM.render(
    <Provider store={store}>
      <PersistGate persistor={persistor}>
        <PayPalScriptProvider options={paypalOptions}>
          <SpeechProvider>
            <LanguageProvider>
              <ThemeProvider>
                <SubscriptionProvider>
                  <PlatformRouter>
                    <DndProvider backend={TouchBackend} options={dndOptions}>
                      <Route path="/" component={App} />
                    </DndProvider>
                  </PlatformRouter>
                </SubscriptionProvider>
              </ThemeProvider>
            </LanguageProvider>
          </SpeechProvider>
        </PayPalScriptProvider>
      </PersistGate>
    </Provider>,
    document.getElementById('root')
  );
};

isCordova() ? onCordovaReady(renderApp) : renderApp();
