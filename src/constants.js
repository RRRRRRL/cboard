import { isCordova } from './cordova-util';

const DEV_API_URL = process.env.REACT_APP_DEV_API_URL || null;
export const ARASAAC_BASE_PATH_API = 'https://api.arasaac.org/api/';
export const GLOBALSYMBOLS_BASE_PATH_API = 'https://globalsymbols.com/api/v1/';

// Detect production environment more reliably
// Check both build-time NODE_ENV and runtime hostname
const isProductionBuild = process.env.NODE_ENV === 'production';
const isProductionHost = window.location.hostname === 'aac.uplifor.org' || 
                         window.location.hostname === 'www.aac.uplifor.org' ||
                         (window.location.protocol === 'https:' && 
                          !window.location.hostname.includes('localhost') && 
                          !window.location.hostname.match(/^192\.168\./) &&
                          !window.location.hostname.match(/^127\.0\.0\.1$/));
// In production build OR when running on production host, use relative path
const isProduction = isProductionBuild || isProductionHost;

// Detect if running on local network (for mobile access)
// If accessing via IP address (192.168.x.x), use relative path to avoid hardcoded URLs
// The proxy (setupProxy.js) will handle forwarding /api requests to the backend port
const isLocalNetwork = window.location.hostname.match(/^192\.168\.\d+\.\d+$/) || 
                       window.location.hostname.match(/^10\.\d+\.\d+\.\d+$/) ||
                       window.location.hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/);

// Check if DEV_API_URL contains local network IP or port (should use relative path instead)
// This prevents hardcoded URLs in resource paths (images, etc.)
const devApiUrlHasLocalNetwork = DEV_API_URL && (
  DEV_API_URL.match(/192\.168\.\d+\.\d+/) ||
  DEV_API_URL.match(/10\.\d+\.\d+\.\d+/) ||
  DEV_API_URL.match(/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+/) ||
  DEV_API_URL.includes(':8000') || // If it includes port 8000, use proxy instead
  DEV_API_URL.includes(':3000')    // If it includes port 3000, use proxy instead
);

// Construct API URL based on environment
// 
// LOCAL DEVELOPMENT:
//   - Frontend: yarn start → http://localhost:3000
//   - Backend: php -S localhost:8000 router.php → http://localhost:8000/api
//   - If DEV_API_URL is set, use it; otherwise default to http://localhost:8000/api
//
// PRODUCTION (Server):
//   - Frontend: https://aac.uplifor.org/
//   - Backend: https://aac.uplifor.org/api (via Nginx proxy)
//   - ALWAYS use relative path /api (ignores DEV_API_URL to prevent hardcoding)
const RAW_API_URL = isCordova()
  ? 'https://api.app.cboard.io/'
  : (isProduction || isLocalNetwork || devApiUrlHasLocalNetwork
      ? '/api'  // Production, local network, or DEV_API_URL with local IP/port: Use relative path (proxy will handle port forwarding)
      : (DEV_API_URL || 'http://localhost:8000/api'));  // Development on localhost: Use DEV_API_URL or default to localhost:8000/api
const RAW_API_URL_LAST_CHAR = RAW_API_URL.length - 1;
export const API_URL =
  RAW_API_URL[RAW_API_URL_LAST_CHAR] === '/' ? RAW_API_URL : `${RAW_API_URL}/`;

// Debug: Log API URL (only once to avoid spam)
// Enable this temporarily to verify the correct API URL is being used
if (!window._apiUrlLogged) {
  console.log('[API Config] API URL constructed:', API_URL);
  console.log('[API Config] DEV_API_URL from .env:', DEV_API_URL);
  console.log('[API Config] Window location:', window.location.href);
  console.log('[API Config] isProductionBuild:', isProductionBuild);
  console.log('[API Config] isProductionHost:', isProductionHost);
  console.log('[API Config] isProduction:', isProduction);
  console.log('[API Config] isLocalNetwork:', isLocalNetwork);
  console.log('[API Config] devApiUrlHasLocalNetwork:', devApiUrlHasLocalNetwork);
  console.log('[API Config] NODE_ENV:', process.env.NODE_ENV);
  window._apiUrlLogged = true;
}

// Azure related constants
export const AZURE_INST_KEY =
  process.env.REACT_APP_AZURE_INST_KEY ||
  '874487ac-304c-4160-b8f3-a221541eab61';
export const AZURE_SPEECH_SUBSCR_KEY =
  process.env.REACT_APP_AZURE_SPEECH_KEY || '910a3256e6aa4b4daf631cd0f550c995';
export const AZURE_SPEECH_SERVICE_REGION =
  process.env.REACT_APP_AZURE_SPEECH_SERVICE_REGION || 'eastus';
export const AZURE_VOICES_BASE_PATH_API =
  'https://' +
  AZURE_SPEECH_SERVICE_REGION +
  '.tts.speech.microsoft.com/cognitiveservices/voices/';

// AdSense constants
export const NODE_ENV = process.env.NODE_ENV;
const HOSTNAME = window.location.hostname;
export const ADSENSE_ON_PRODUCTION =
  HOSTNAME === 'app.cboard.io' && NODE_ENV === 'production';
export const ADTEST_AVAILABLE =
  HOSTNAME === 'app.dev.cboard.io' || HOSTNAME === 'app.qa.cboard.io';
export const ADSENSE_CLIENT = 'ca-pub-7162313874228987';
export const ADD_SLOT_SETTINGS_TOP = '5250438005';

// Apple & iOS related constants
const userAgent = navigator.userAgent;
export const IS_BROWSING_FROM_APPLE = /iPad|iPhone|iPod|Mac/.test(userAgent);
export const IS_BROWSING_FROM_APPLE_TOUCH =
  IS_BROWSING_FROM_APPLE && 'ontouchend' in document;
export const IS_BROWSING_FROM_SAFARI =
  userAgent.indexOf('Safari') > -1 &&
  userAgent.indexOf('Chrome') === -1 &&
  !navigator.userAgent.match(/crios/i) &&
  !navigator.userAgent.match(/fxios/i) &&
  !navigator.userAgent.match(/Opera|OPT\//);

// PayPal related constants
export const PAYPAL_CLIENT_ID =
  HOSTNAME === 'app.cboard.io' && NODE_ENV === 'production'
    ? 'AVQiWeMc55uBVqvgXY2yifS6v9Pt2jYxtJhA3JV0UEhLiV4Mf5W9Hanxoix8542FYACVizlyU8M0yO0S'
    : 'AZ2vK0luRWMX9zzwLs-Ko_B_TJxeHYvIFCgXWcNBt50wmj7oZcUw8n4cf11GgdClTVnYMuEs5vRnxVEk';
// Google related constants
export const GOOGLE_FIREBASE_WEB_CLIENT_ID =
  process.env.REACT_APP_GOOGLE_FIREBASE_WEB_CLIENT_ID ||
  '772840497386-4m51j455n7aqi54uhfm7ub6p645or2ed.apps.googleusercontent.com';

// ElevenLabs related constants
export const ELEVENLABS_API_BASE_URL = 'https://api.elevenlabs.io';
export const ELEVENLABS_DEFAULT_TIMEOUT = 10000;
