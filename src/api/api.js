import axios from 'axios';
import history from '../history';
import { alpha2ToAlpha3T } from '@cospired/i18n-iso-languages';
import {
  API_URL,
  ARASAAC_BASE_PATH_API,
  GLOBALSYMBOLS_BASE_PATH_API,
  AZURE_VOICES_BASE_PATH_API,
  AZURE_SPEECH_SUBSCR_KEY
} from '../constants';
import { getStore } from '../store';
import { dataURLtoFile } from '../helpers';
import { logout } from '../components/Account/Login/Login.actions.js';
import { isAndroid } from '../cordova-util';
import {
  cacheApiResponse,
  getCachedApiResponse,
  isOnline,
  initOfflineStorage
} from '../utils/offlineStorage';

const BASE_URL = API_URL;
const LOCAL_COMMUNICATOR_ID = 'cboard_default';
export let improvePhraseAbortController;

const getUserData = () => {
  const store = getStore();
  const {
    app: { userData }
  } = store.getState();

  return userData;
};

const getSubscriberId = () => {
  const store = getStore();
  const {
    subscription: { subscriberId }
  } = store.getState();
  return subscriberId;
};

const getAuthToken = () => {
  const userData = getUserData() || {};
  return userData.authToken || null;
};

const getQueryParameters = (obj = {}) => {
  return Object.keys(obj)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(obj[k])}`)
    .join('&');
};

class API {
  constructor(config = {}) {
    this.axiosInstance = axios.create({
      baseURL: BASE_URL,
      timeout: 30000, // 30 second default timeout for all requests
      ...config
    });
    this.axiosInstance.interceptors.response.use(
      response => response,
      error => {
        if (
          error.response?.status === 403 &&
          error.config?.baseURL === BASE_URL
        ) {
          if (isAndroid()) {
            window.FirebasePlugin.unregister();
            window.facebookConnectPlugin.logout(
              function (msg) {
                console.log('disconnect facebook msg' + msg);
              },
              function (msg) {
                console.log('error facebook disconnect msg' + msg);
              }
            );
          }
          getStore().dispatch(logout());
          history.push('/login-signup/');
        }
        return Promise.reject(error);
      }
    );

    // Initialize offline storage
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      initOfflineStorage().catch(err => {
        console.warn('Failed to initialize offline storage:', err);
      });
    }
  }

  /**
   * Make API request with offline support
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} url - API endpoint URL
   * @param {object} config - Axios config
   * @param {object} cacheConfig - Cache configuration { enabled: true, maxAge: 3600000 }
   */
  async requestWithOfflineSupport(method, url, config = {}, cacheConfig = { enabled: true, maxAge: 60 * 60 * 1000 }) {
    const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
    const params = config.params || {};

    // Try to get from cache first if offline or cache is enabled
    if (cacheConfig.enabled && !isOnline()) {
      const cachedData = await getCachedApiResponse(fullUrl, params);
      if (cachedData !== null) {
        // Suppress offline cache logs to reduce console noise
        // console.log('Using cached data for offline request:', url);
        return { data: cachedData, fromCache: true };
      }
    }

    try {
      // Make network request
      const response = await this.axiosInstance.request({
        method,
        url,
        ...config
      });

      // Cache successful GET requests
      if (cacheConfig.enabled && method.toUpperCase() === 'GET' && response.status === 200) {
        await cacheApiResponse(fullUrl, params, response.data, cacheConfig.maxAge);
      }

      return { ...response, fromCache: false };
    } catch (error) {
      // If network fails and we're offline, try cache
      if (cacheConfig.enabled && (!isOnline() || error.code === 'ERR_NETWORK')) {
        const cachedData = await getCachedApiResponse(fullUrl, params);
        if (cachedData !== null) {
          // Suppress offline cache logs to reduce console noise
          // console.log('Network failed, using cached data:', url);
          return { data: cachedData, fromCache: true, error: null };
        }
      }
      throw error;
    }
  }

  async getLanguage(lang) {
    try {
      const response = await this.requestWithOfflineSupport(
        'GET',
        `/languages/${lang}`,
        {},
        { enabled: true, maxAge: 24 * 60 * 60 * 1000 } // Cache for 24 hours
      );
      if (response.data) return response.data;
      return null;
    } catch (err) {
      // Try cache as fallback
      const cachedData = await getCachedApiResponse(`${BASE_URL}/languages/${lang}`, {});
      return cachedData || null;
    }
  }

  async getAzureVoices() {
    const azureVoicesListPath = `${AZURE_VOICES_BASE_PATH_API}list`;
    const headers = {
      'Ocp-Apim-Subscription-Key': AZURE_SPEECH_SUBSCR_KEY
    };
    try {
      const { status, data } = await this.axiosInstance.get(
        azureVoicesListPath,
        { headers }
      );
      if (status === 200) return data;
      return [];
    } catch (err) {
      console.error(err.message);
      return [];
    }
  }

  async arasaacPictogramsSearch(locale, searchText) {
    const pictogSearchTextPath = `${ARASAAC_BASE_PATH_API}pictograms/${locale}/search/${searchText}`;
    try {
      const { status, data } = await this.axiosInstance.get(
        pictogSearchTextPath
      );
      if (status === 200) return data;
      return [];
    } catch (err) {
      return [];
    }
  }
  async arasaacPictogramsGetImageUrl(pictogGetTextPath) {
    try {
      const { status, data } = await this.axiosInstance.get(pictogGetTextPath);
      if (status === 200) return data.image;
      return '';
    } catch (err) {
      return '';
    }
  }

  async globalsymbolsPictogramsSearch(locale, searchText) {
    let language = 'eng';
    if (locale.length === 3) {
      language = locale;
    }
    if (locale.length === 2) {
      language = alpha2ToAlpha3T(locale);
    }
    const pictogSearchTextPath = `${GLOBALSYMBOLS_BASE_PATH_API}labels/search/?query=${searchText}&language=${language}&language_iso_format=639-3&limit=20`;
    try {
      const { status, data } = await this.axiosInstance.get(
        pictogSearchTextPath
      );
      if (status === 200) return data;
      return [];
    } catch (err) {
      return [];
    }
  }

  async login(email, password) {
    try {
      // Login requests should not use offline support - they need real-time authentication
      const response = await this.axiosInstance.post('/user/login', {
        email,
        password
      }, {
        timeout: 30000 // 30 second timeout for login
      });

      // Handle response - backend returns {id, authToken, communicators, boards, settings, ...}
      const data = response.data;

      // If response has 'user' object (registration format), extract it
      if (data.user && data.user.authToken) {
        return data.user;
      }

      // Otherwise return data directly (login format)
      return data;
    } catch (error) {
      // Provide better error messages for login failures
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        throw new Error('Connection timeout. Please check your network connection and try again.');
      }
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        throw new Error('Unable to connect to server. Please check your network connection.');
      }
      // Re-throw other errors (like 401, 403, etc.) as-is
      throw error;
    }
  }

  async forgot(email) {
    try {
      const { data } = await this.axiosInstance.post('/user/forgot', {
        email
      }, {
        timeout: 30000 // 30 second timeout
      });
      return data;
    } catch (error) {
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        throw new Error('Connection timeout. Please check your network connection and try again.');
      }
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        throw new Error('Unable to connect to server. Please check your network connection.');
      }
      throw error;
    }
  }

  async storePassword(userid, password, url) {
    const { data } = await this.axiosInstance.post('/user/store-password', {
      userid: userid,
      token: url,
      password: password
    });

    return data;
  }

  async oAuthLogin(type, query) {
    if (type === 'apple' || type === 'apple-web') {
      const authCode = query?.substring(1);
      const { data } = await this.axiosInstance.post(
        `/login/${type}/callback`,
        {
          state: 'cordova',
          code: authCode
        }
      );
      return data;
    }
    const { data } = await this.axiosInstance.get(
      `/login/${type}/callback${query}`
    );
    return data;
  }

  async getUserData(userId) {
    const authToken = getAuthToken();
    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    const { data } = await this.axiosInstance.get(`/user/${userId}`, {
      headers
    });
    return data;
  }

  // 已廢棄：舊的「board 列表」，現在其實是「公開 profiles 列表」包一層。
  // 建議前端直接改用 getPublicProfiles（如果有）或 getPublicBoardsProfiles 之類的新方法。
  async getBoards({
    page = 1,
    limit = 10,
    offset = 0,
    sort = '-_id',
    search = ''
  } = {}) {
    const query = getQueryParameters({ page, limit, offset, sort, search });
    const url = `/board?${query}`;
    const { data } = await this.axiosInstance.get(url);
    return data;
  }

  // 已廢棄：舊的「公開 boards」，後端現在返回的是 profiles。
  // 這裡做一層轉換，保持 Communicator 等舊代碼暫時可用。
  async getPublicBoards({
    page = 1,
    limit = 10,
    offset = 0,
    sort = '-_id',
    search = ''
  } = {}) {
    const normalizeProfilesToBoards = (profiles, page, limit, total) => {
      if (!Array.isArray(profiles)) {
        return { data: [], total: total || 0, page, limit };
      }
      const { transformBoardsImageUrls } = require('../utils/imageUrlTransformer');
      const normalized = profiles.map(p => ({
        ...p,
        id: String(p.id),
        // 舊代碼使用 board.name，這裡用 display_name 做兼容
        name: p.display_name || p.name || '',
        // 作者名稱：後端對 /board/my 已提供 author / author_name，public 可為空
        author: p.author || p.author_name || '',
        // 封面圖片
        caption: p.caption || p.cover_image || null,
        // 語言代碼
        locale: p.locale || p.language || null,
        // 公開標記
        isPublic: !!p.is_public,
        // tiles_count 用於顯示和過濾
        tiles_count: p.tiles_count || (Array.isArray(p.tiles) ? p.tiles.length : 0),
        tilesCount: p.tiles_count || (Array.isArray(p.tiles) ? p.tiles.length : 0)
      }));
      // Transform image URLs in all boards
      const transformed = transformBoardsImageUrls(normalized);
      return {
        data: transformed,
        total: total || transformed.length,
        page,
        limit
      };
    };

    const query = getQueryParameters({ page, limit, offset, sort, search });
    const url = `/board/public?${query}`;
    console.log('[API getPublicBoards] Requesting:', { url, page, limit, search });
    const { data } = await this.axiosInstance.get(url);
    console.log('[API getPublicBoards] Response received:', {
      hasData: !!data,
      isArray: Array.isArray(data),
      hasProfiles: !!(data && data.profiles),
      profilesCount: data?.profiles?.length || data?.length || 0,
      total: data?.total || 0
    });

    // 後端（PHP）目前返回格式：{ profiles: [...], total, page, limit }
    // 舊 Cboard 雲端可能返回：{ boards: [...], total, page, limit } 或 { data: [...] }
    // CommunicatorDialogContainer 期望：{ data: [...], total }
    if (Array.isArray(data)) {
      return normalizeProfilesToBoards(data, page, limit, data.length);
    }

    if (data && Array.isArray(data.profiles)) {
      return normalizeProfilesToBoards(
        data.profiles,
        data.page || page,
        data.limit || limit,
        data.total
      );
    }

    if (data && Array.isArray(data.boards)) {
      return normalizeProfilesToBoards(
        data.boards,
        data.page || page,
        data.limit || limit,
        data.total
      );
    }

    if (data && Array.isArray(data.data)) {
      return normalizeProfilesToBoards(
        data.data,
        data.page || page,
        data.limit || limit,
        data.total
      );
    }

    return { data: [], total: 0, page, limit };
  }

  // 已廢棄：舊的「我的 boards」，現在後端返回的是我的 profiles。
  // 這裡轉成 { data: [...] } 給現有代碼用；新代碼請直接用 getProfiles。
  async getMyBoards({
    page = 1,
    limit = 10,
    offset = 0,
    sort = '-_id',
    search = ''
  } = {}) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    const query = getQueryParameters({ page, limit, offset, sort, search });
    // Use token-based endpoint instead of email-based (more secure, no email in URL)
    const url = `/board/my?${query}`;

    const normalize = (raw) => {
      const { transformBoardsImageUrls } = require('../utils/imageUrlTransformer');

      // Helper function to filter out corrupted profiles (all tiles are null)
      // IMPORTANT: Don't filter out profiles with virtual tiles (null arrays)
      // These are normal responses from /board/my endpoint
      const filterCorruptedProfiles = (profiles) => {
        if (!Array.isArray(profiles)) return profiles;

        // Don't filter - all profiles from /board/my are valid
        // Virtual tiles arrays (filled with null) are intentional for metadata display
        return profiles;
      };

      const normalizeProfilesToBoards = (profiles, pageArg, limitArg, total) => {
        if (!Array.isArray(profiles)) {
          return { data: [], total: total || 0, page: pageArg, limit: limitArg };
        }
        const filteredProfiles = filterCorruptedProfiles(profiles);
        // 映射為舊的 board 結構，供 Communicator / Board 列表使用
        const boardsLike = filteredProfiles.map(p => ({
          ...p,
          id: String(p.id),
          name: p.display_name || p.name || '',
          author: p.author || p.author_name || '',
          caption: p.caption || p.cover_image || null,
          locale: p.locale || p.language || null,
          isPublic: !!p.is_public,
          // tiles_count 用於顯示和過濾
          tiles_count: p.tiles_count || (Array.isArray(p.tiles) ? p.tiles.length : 0),
          tilesCount: p.tiles_count || (Array.isArray(p.tiles) ? p.tiles.length : 0)
        }));
        return {
          data: transformBoardsImageUrls(boardsLike),
          total: total || boardsLike.length,
          page: pageArg,
          limit: limitArg
        };
      };

      if (Array.isArray(raw)) {
        return normalizeProfilesToBoards(raw, page, limit, raw.length);
      }

      if (raw?.profiles && Array.isArray(raw.profiles)) {
        return normalizeProfilesToBoards(
          raw.profiles,
          raw.page || page,
          raw.limit || limit,
          raw.total
        );
      }

      return { data: [], total: 0, page, limit };
    };

    try {
      const response = await this.requestWithOfflineSupport(
        'GET',
        url,
        { headers },
        { enabled: true, maxAge: 5 * 60 * 1000 } // Cache for 5 minutes
      );

      return normalize(response.data);
    } catch (error) {
      // If it's a network error and we're offline, try to return cached data
      if (
        (error.code === 'ERR_NETWORK' || error.message === 'Network Error') &&
        !isOnline()
      ) {
        const cachedData = await getCachedApiResponse(`${BASE_URL}${url}`, {
          page,
          limit,
          offset,
          sort,
          search
        });
        if (cachedData) {
          return normalize(cachedData);
        }
        return { data: [], total: 0, page, limit }; // Return empty result when offline
      }
      // Suppress network errors when offline to reduce console noise
      const isNetworkError =
        error.code === 'ERR_NETWORK' || error.message === 'Network Error';
      if (isNetworkError && !navigator.onLine) {
        // Silently handle offline network errors
        throw error;
      }
      // Only log non-network errors or network errors when online
      if (!isNetworkError || navigator.onLine) {
        console.error('getMyBoards error:', error);
      }
      throw error;
    }
  }

  async getCommunicators({
    page = 1,
    limit = 10,
    offset = 0,
    sort = '-_id',
    search = ''
  } = {}) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    const query = getQueryParameters({ page, limit, offset, sort, search });
    // Use token-based endpoint instead of email-based (more secure, no email in URL)
    const url = `/communicator/my?${query}`;

    try {
      const { data } = await this.axiosInstance.get(url, { headers });
      return data;
    } catch (error) {
      console.error('getCommunicators error:', error);
      // If it's a network error, provide more helpful message
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        console.error('Network error - check API base URL and CORS settings');
        throw new Error('Cannot connect to server. Please check your connection and API configuration.');
      }
      throw error;
    }
  }

  // 新版：從 profile 入口讀主板
  // id 現在應理解為 profileId（兼容舊代碼仍叫 "board id"）
  // token: optional auth token (useful during login before Redux state is updated)
  async getBoard(id, token = null) {
    // Use provided token, or get from Redux state, or try to get from loginData
    const authToken = token || getAuthToken();
    const headers = authToken ? {
      Authorization: `Bearer ${authToken}`
    } : {};

    console.log('[API GET BOARD] Requesting board data:', {
      profileId: id,
      hasAuthToken: !!authToken,
      endpoint: `/profiles/${id}/board`
    });

    try {
      const response = await this.requestWithOfflineSupport(
        'GET',
        `/profiles/${id}/board`,
        { headers },
        { enabled: true, maxAge: 60 * 60 * 1000 } // Cache for 1 hour
      );

      if (response.data) {
        console.log('[API GET BOARD] Raw response received:', {
          profileId: id,
          boardId: response.data.id,
          boardName: response.data.name,
          tilesCount: response.data.tiles?.length || 0,
          gridRows: response.data.grid?.rows,
          gridColumns: response.data.grid?.columns
        });

        const { transformBoardImageUrls } = require('../utils/imageUrlTransformer');
        const boardData = transformBoardImageUrls(response.data);

        // Filter out null/undefined tiles, but不要再把「全為 null」視為損壞板，
        // 否則在 profile->board 過程中任何暫時為 null 的情況都會把板攔住。
        if (boardData.tiles && Array.isArray(boardData.tiles)) {
          const validTiles = boardData.tiles.filter(tile =>
            tile !== null && tile !== undefined && typeof tile === 'object'
          );
          boardData.tiles = validTiles;

          console.log('[API GET BOARD] Tiles filtered:', {
            profileId: id,
            originalTilesCount: response.data.tiles?.length || 0,
            validTilesCount: validTiles.length,
            first3Tiles: validTiles.slice(0, 3).map(t => ({
              id: t.id,
              label: t.label,
              labelKey: t.labelKey,
              position: `row=${t.row}, col=${t.col}`
            }))
          });
        }

        console.log('[API GET BOARD] Returning board data:', {
          profileId: id,
          boardId: boardData.id,
          boardName: boardData.name,
          finalTilesCount: boardData.tiles?.length || 0
        });

        return boardData;
      }

      return response.data;
    } catch (error) {
      // If offline and no cache, return null or empty board structure
      if (!isOnline()) {
        console.warn('Offline: Could not load profile board', id);
        return null;
      }
      throw error;
    }
  }

  async getCbuilderBoard(id) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request', {
        cause: 401
      });
    }
    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    // 新模型下，cbuilder 也透過 profile 主板接口獲取資料
    const { data } = await this.axiosInstance.get(`/profiles/${id}/board`, {
      headers
    });

    if (data) {
      const { transformBoardImageUrls } = require('../utils/imageUrlTransformer');
      return transformBoardImageUrls(data);
    }

    return data;
  }

  async getSettings() {
    const authToken = getAuthToken();

    // Default settings for guest users or when not authenticated
    const defaultSettings = {
      settings: {
        speech: {
          voice: 'en-US-Neural-A',
          language: 'en',
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0
        },
        accessibility: {
          scanning: {
            mode: 'single',
            speed: 1.0,
            loop: 'finite',
            loop_count: 3
          },
          audio_guide: 'off',
          switch: {
            type: null,
            device_id: null
          },
          eye_tracking: {
            enabled: false,
            device: null
          }
        },
        eyeTracking: {
          enabled: false,
          deviceType: 'tobii',
          dwellTime: 1000
        }
      },
      eyeTracking: {
        enabled: false,
        deviceType: 'tobii',
        dwellTime: 1000
      }
    };

    // If no auth token, return default settings (guest mode)
    if (!(authToken && authToken.length)) {
      console.log('[API] getSettings - No auth token, returning default settings (guest mode)');
      return defaultSettings.settings;
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.requestWithOfflineSupport('GET', `/settings`, { headers }, { enabled: true, maxAge: 5 * 60 * 1000 });
      const data = response.data || response;

      // Normalize settings structure - backend uses accessibility.eye_tracking, frontend uses eyeTracking
      const settings = data.settings || data;

      // Convert backend format (accessibility.eye_tracking) to frontend format (eyeTracking)
      let eyeTrackingSettings = settings.eyeTracking;
      if (!eyeTrackingSettings && settings.accessibility && settings.accessibility.eye_tracking) {
        const backendSettings = settings.accessibility.eye_tracking;
        eyeTrackingSettings = {
          enabled: backendSettings.enabled || false,
          deviceType: backendSettings.device_type || backendSettings.deviceType || 'tobii',
          dwellTime: backendSettings.dwell_time || backendSettings.dwellTime || 1000,
          device: backendSettings.device || null
        };
      }

      // Return normalized settings - ensure eyeTracking is always available
      const normalized = {
        ...settings,
        eyeTracking: eyeTrackingSettings || { enabled: false, deviceType: 'tobii', dwellTime: 1000 }
      };

      // Log for debugging
      console.log('[API] getSettings - Normalized eye tracking settings:', normalized.eyeTracking);

      return normalized;
    } catch (error) {
      // Return default settings if offline
      if (!isOnline() || error.code === 'ERR_NETWORK') {
        console.log('[API] getSettings - Offline, returning default settings');
        return defaultSettings.settings;
      }

      // For other errors, rethrow so callers can handle (e.g., force re-login on 401)
      throw error;
    }
  }

  async updateSettings(newSettings = {}) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    // Convert frontend format (eyeTracking) to backend format (accessibility.eye_tracking) if needed
    let settingsToSave = { ...newSettings };

    // If eyeTracking is being updated, also update accessibility.eye_tracking for backend compatibility
    if (newSettings.eyeTracking) {
      // Get existing settings to merge properly
      try {
        const existing = await this.getSettings();
        const existingSettings = existing.settings || existing;

        settingsToSave = {
          ...existingSettings,
          ...newSettings,
          // Ensure both formats are saved
          eyeTracking: newSettings.eyeTracking,
          accessibility: {
            ...(existingSettings.accessibility || {}),
            eye_tracking: {
              ...(existingSettings.accessibility?.eye_tracking || {}),
              enabled: newSettings.eyeTracking.enabled || false,
              device_type: newSettings.eyeTracking.deviceType || existingSettings.accessibility?.eye_tracking?.device_type || 'tobii',
              dwell_time: newSettings.eyeTracking.dwellTime || existingSettings.accessibility?.eye_tracking?.dwell_time || 1000,
              device: newSettings.eyeTracking.device || existingSettings.accessibility?.eye_tracking?.device || null
            }
          }
        };

        console.log('[API] updateSettings - Saving eye tracking settings:', {
          eyeTracking: settingsToSave.eyeTracking,
          accessibility_eye_tracking: settingsToSave.accessibility?.eye_tracking
        });
      } catch (e) {
        // If getSettings fails, create new structure
        console.warn('[API] Failed to get existing settings for merge:', e);
        settingsToSave = {
          ...newSettings,
          accessibility: {
            eye_tracking: {
              enabled: newSettings.eyeTracking?.enabled || false,
              device_type: newSettings.eyeTracking?.deviceType || 'tobii',
              dwell_time: newSettings.eyeTracking?.dwellTime || 1000,
              device: newSettings.eyeTracking?.device || null
            }
          }
        };
      }
    }

    const { data } = await this.axiosInstance.post(`/settings`, settingsToSave, {
      headers
    });

    return data;
  }

  // Sprint 4: Speech settings
  async getSpeechSettings() {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    const { data } = await this.axiosInstance.get(`/settings/speech`, {
      headers
    });
    return data;
  }

  async updateSpeechSettings(speechSettings = {}) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    const { data } = await this.axiosInstance.post(
      `/settings/speech`,
      speechSettings,
      {
        headers
      }
    );
    return data;
  }

  // Sprint 5: Accessibility/Scanning settings
  async getAccessibilitySettings() {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    const { data } = await this.axiosInstance.get(`/settings/accessibility`, {
      headers
    });
    return data;
  }

  async updateAccessibilitySettings(accessibilitySettings = {}) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    const { data } = await this.axiosInstance.post(
      `/settings/accessibility`,
      accessibilitySettings,
      {
        headers
      }
    );
    return data;
  }

  // Sprint 5: Scanning endpoints
  async getScanningState() {
    const { data } = await this.axiosInstance.get(`/scanning/state`);
    return data;
  }

  async startScanning(scanningData = {}) {
    const { data } = await this.axiosInstance.post(
      `/scanning/start`,
      scanningData
    );
    return data;
  }

  async stopScanning(scanningData = {}) {
    const { data } = await this.axiosInstance.post(
      `/scanning/stop`,
      scanningData
    );
    return data;
  }

  async selectScanningItem(selectionData = {}) {
    const { data } = await this.axiosInstance.post(
      `/scanning/select`,
      selectionData
    );
    return data;
  }

  async getScanningNavigation(profileId, pageIndex = null, mode = 'single') {
    const params = { profile_id: profileId, mode };
    if (pageIndex !== null) {
      params.page_index = pageIndex;
    }
    const { data } = await this.axiosInstance.get(`/scanning/navigation`, {
      params
    });
    return data;
  }

  // Sprint 4: TTS endpoints
  async getTTSVoices(language = 'en') {
    const { data } = await this.axiosInstance.get(`/tts/voices`, {
      params: { language }
    });
    return data;
  }

  async speakText(text, options = {}) {
    const { data } = await this.axiosInstance.post(`/tts/speak`, {
      text,
      language: options.language || 'en',
      voice_id: options.voice_id || 'en-US-Neural-A',
      rate: options.rate || 1.0,
      pitch: options.pitch || 1.0
    });
    return data;
  }

  // Sprint 4: Public profiles
  /**
   * Get current user's profiles (communication profiles).
   * Backend: GET /profiles
   */
  async getProfiles() {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    const { data } = await this.axiosInstance.get('/profiles', { headers });
    // Backend returns { profiles, total, page, limit }
    if (data && Array.isArray(data.profiles)) {
      return data.profiles;
    }
    return Array.isArray(data) ? data : [];
  }

  // Sprint 4: Action logging
  async logAction(actionData = {}) {
    try {
      // Action logs can be created anonymously (for view-only mode)
      const authToken = getAuthToken();
      const headers = {};
      if (authToken && authToken.length) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const { data } = await this.axiosInstance.post(
        `/action-logs`,
        actionData,
        { headers }
      );
      return data;
    } catch (err) {
      console.error('Action log error:', err);
      // Don't throw - logging failures shouldn't break the app
      return { success: false, error: err.message };
    }
  }

  // Sprint 6: Device management
  async getDevicesList() {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.requestWithOfflineSupport('GET', `/devices/list`, { headers }, { enabled: true, maxAge: 5 * 60 * 1000 });
      return response.data || response;
    } catch (error) {
      // Return empty devices list if offline
      if (!isOnline() || error.code === 'ERR_NETWORK') {
        return { eye_tracking: [], switch: [] };
      }
      throw error;
    }
  }

  async registerSwitchDevice(deviceData = {}) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    const { data } = await this.axiosInstance.post(
      `/devices/switch/register`,
      deviceData,
      {
        headers
      }
    );
    return data;
  }

  async activateSwitchDevice(deviceId) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    const { data } = await this.axiosInstance.post(
      `/devices/switch/activate`,
      {
        device_id: deviceId
      },
      { headers }
    );
    return data;
  }

  async handleSwitchLongPress(longPressData = {}) {
    const { data } = await this.axiosInstance.post(
      `/devices/switch/longpress`,
      longPressData
    );
    return data;
  }

  async registerEyeTrackingDevice(deviceData = {}) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    // Verify device connection before registering
    const deviceType = deviceData.device_type || '';
    let deviceConnected = false;

    try {
      if (deviceType === 'camera') {
        // Verify camera is available
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          if (videoDevices.length === 0) {
            throw new Error('No camera devices found');
          }

          // Try to access camera to verify it's actually working
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          const tracks = stream.getVideoTracks();
          if (tracks.length === 0) {
            throw new Error('Camera stream has no video tracks');
          }

          // Check if track is actually active
          if (!tracks[0].readyState || tracks[0].readyState !== 'live') {
            throw new Error('Camera track is not live');
          }

          // Stop the test stream
          tracks.forEach(track => track.stop());
          deviceConnected = true;
        } catch (err) {
          throw new Error(`Camera not connected or accessible: ${err.message}`);
        }
      } else if (deviceType === 'tobii') {
        // Verify Tobii device is available
        if (typeof window.Tobii === 'undefined' && typeof window.tobii === 'undefined') {
          throw new Error('Tobii SDK not loaded. Please ensure Tobii device is connected and drivers are installed.');
        }
        // Additional verification can be added here if Tobii SDK provides connection check
        deviceConnected = true;
      } else if (deviceType === 'eyetribe') {
        // Verify EyeTribe device is available
        if (typeof window.EyeTribe === 'undefined' && typeof window.eyetribe === 'undefined') {
          throw new Error('EyeTribe SDK not loaded. Please ensure EyeTribe device is connected and drivers are installed.');
        }
        // Additional verification can be added here if EyeTribe SDK provides connection check
        deviceConnected = true;
      } else if (deviceType === 'pupil') {
        // Verify Pupil device is available
        // Pupil typically connects via WebSocket, so we'd need to check connection
        // For now, assume it's connected if the type is specified
        deviceConnected = true;
      } else {
        // For custom devices, assume connected if device type is provided
        deviceConnected = true;
      }
    } catch (err) {
      // Device verification failed
      const verificationError = new Error(`Device connection verification failed: ${err.message}`);
      verificationError.originalError = err;
      verificationError.deviceType = deviceType;
      throw verificationError;
    }

    if (!deviceConnected) {
      throw new Error(`Device type "${deviceType}" is not connected or accessible`);
    }

    // Device is verified, proceed with registration
    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      // Add timeout to prevent hanging on network errors
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 5000)
      );

      // Include connection verification status in registration data
      const registrationData = {
        ...deviceData,
        connection_verified: true,
        verified_at: new Date().toISOString()
      };

      const requestPromise = this.axiosInstance.post(
        `/devices/eyetracking/register`,
        registrationData,
        {
          headers,
          timeout: 5000 // 5 second timeout
        }
      );

      const response = await Promise.race([requestPromise, timeoutPromise]);
      return response.data;
    } catch (error) {
      // Handle network errors gracefully
      const isNetworkError = error.code === 'ERR_NETWORK' ||
        error.message === 'Network Error' ||
        error.message === 'Request timeout';
      if (isNetworkError) {
        // Return a soft error that won't break initialization
        const networkError = new Error('Network error during device registration');
        networkError.code = 'ERR_NETWORK';
        networkError.isNetworkError = true;
        throw networkError;
      }
      throw error;
    }
  }

  async calibrateEyeTrackingDevice(deviceId, calibrationData = {}) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    const { data } = await this.axiosInstance.post(
      `/devices/eyetracking/calibrate`,
      {
        device_id: deviceId,
        ...calibrationData
      },
      { headers }
    );
    return data;
  }

  async selectCardViaEyeTracking(selectionData = {}) {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 3000)
      );

      const requestPromise = this.axiosInstance.post(
        `/devices/eyetracking/select`,
        selectionData,
        {
          timeout: 3000 // 3 second timeout for logging
        }
      );

      const response = await Promise.race([requestPromise, timeoutPromise]);
      return response.data;
    } catch (error) {
      // Don't throw errors for logging - it's non-critical
      const isNetworkError = error.code === 'ERR_NETWORK' ||
        error.message === 'Network Error' ||
        error.message === 'Request timeout';
      if (isNetworkError) {
        // Silently fail for network errors - logging is not critical
        return null;
      }
      // For other errors, still don't throw but log
      console.warn('Eye tracking selection log failed:', error.message || error);
      return null;
    }
  }

  // ============================================================================
  // JYUTPING KEYBOARD API (Sprint 7)
  // ============================================================================

  async searchJyutping(code) {
    try {
      const authToken = getAuthToken();
      const headers = {};

      // Attach token if logged in, so backend can load per-user rules
      if (authToken && authToken.length) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const { data } = await this.axiosInstance.get(`/jyutping/search`, {
        params: { code },
        // Only send headers if we actually have any
        headers: Object.keys(headers).length ? headers : undefined
      });
      return data;
    } catch (err) {
      console.error('Jyutping search error:', err);
      throw err;
    }
  }

  async getJyutpingSuggestions(input, limit = 10) {
    try {
      const authToken = getAuthToken();
      const headers = {};

      if (authToken && authToken.length) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const { data } = await this.axiosInstance.get(`/jyutping/suggestions`, {
        params: { input, limit },
        headers: Object.keys(headers).length ? headers : undefined
      });
      return data;
    } catch (err) {
      console.error('Jyutping suggestions error:', err);
      throw err;
    }
  }

  async translateToJyutping(text) {
    try {
      const authToken = getAuthToken();
      const headers = {
        'Content-Type': 'application/json'
      };

      if (authToken && authToken.length) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const { data } = await this.axiosInstance.post(`/jyutping/translate`, {
        text
      }, {
        headers: Object.keys(headers).length ? headers : undefined
      });
      return data;
    } catch (err) {
      console.error('Jyutping translation error:', err);
      throw err;
    }
  }


  async generateJyutpingAudio(audioData) {
    // Audio endpoint doesn't require authentication for basic playback
    // Authentication is optional for logging purposes
    const authToken = getAuthToken();
    const headers = {};

    if (authToken && authToken.length) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    try {
      const { data } = await this.axiosInstance.post(
        `/jyutping/audio`,
        audioData,
        {
          headers: Object.keys(headers).length > 0 ? headers : undefined
        }
      );
      return data;
    } catch (err) {
      // Silently fail for audio - it's optional logging
      console.log('Jyutping audio logging failed (non-critical):', err.message);
      return null;
    }
  }

  async logJyutpingLearning(learningData) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const { data } = await this.axiosInstance.post(
        `/jyutping/learning-log`,
        learningData,
        {
          headers
        }
      );
      return data;
    } catch (err) {
      console.error('Jyutping learning log error:', err);
      throw err;
    }
  }

  async getRelatedWords(hanzi, jyutping, context = '') {
    try {
      const { data } = await this.axiosInstance.get(`/jyutping/related`, {
        params: { hanzi, jyutping, context }
      });
      return data;
    } catch (err) {
      console.error('Related words error:', err);
      throw err;
    }
  }

  /**
   * Get Jyutping matching rules for a student
   * @param {number} userId - Student user ID
   * @param {number|null} profileId - Optional profile ID
   * @returns {Promise<Object>} Matching rules
   */
  async getJyutpingMatchingRules(userId, profileId = null) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const params = profileId ? { profile_id: profileId } : {};
      const response = await this.axiosInstance.get(`/jyutping/rules/matching/${userId}`, {
        headers,
        params
      });
      return response.data;
    } catch (error) {
      console.error('Get matching rules error:', error);
      throw error;
    }
  }

  /**
   * Get Jyutping exception rules for a student
   * @param {number} userId - Student user ID
   * @param {number|null} profileId - Optional profile ID
   * @returns {Promise<Object>} Exception rules
   */
  async getJyutpingExceptionRules(userId, profileId = null) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const params = profileId ? { profile_id: profileId } : {};
      const response = await this.axiosInstance.get(`/jyutping/rules/exceptions/${userId}`, {
        headers,
        params
      });
      return response.data;
    } catch (error) {
      console.error('Get exception rules error:', error);
      throw error;
    }
  }

  /**
   * Update Jyutping matching rules for a student
   * @param {number} userId - Student user ID
   * @param {Object} rules - Matching rules to update
   * @param {number|null} profileId - Optional profile ID
   * @returns {Promise<Object>} Response
   */
  async updateJyutpingMatchingRules(userId, rules, profileId = null) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.put(`/jyutping/rules/matching/${userId}`, {
        ...rules,
        profile_id: profileId
      }, { headers });
      return response.data;
    } catch (error) {
      console.error('Update matching rules error:', error);
      throw error;
    }
  }

  /**
   * Update exception rules for a student
   * @param {number} userId - Student user ID
   * @param {Array} rules - Array of {rule_id, enabled}
   * @param {number|null} profileId - Optional profile ID
   * @returns {Promise<Object>} Response
   */
  async updateJyutpingExceptionRules(userId, rules, profileId = null) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.put(`/jyutping/rules/exceptions/${userId}`, {
        rules,
        profile_id: profileId
      }, { headers });
      return response.data;
    } catch (error) {
      console.error('Update exception rules error:', error);
      throw error;
    }
  }

  async updateUser(user) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    const { data } = await this.axiosInstance.put(`/user/${user.id}`, user, {
      headers
    });

    return data;
  }

  async createBoard(board) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }
    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    // 在 profile 模型下，「建立 board」等於為 user 建立一個 profile + 初始主板
    // 這裡假設前端已經準備好 profile 基本資訊在 board.profile 中（若沒有，先用簡單預設）
    // 優先使用 board.profile，然後使用 board 上的 layout_type/language，最後才用默認值
    const profilePayload = board.profile || {
      display_name: board.name || 'New Profile',
      description: board.description || '',
      layout_type: board.layout_type || board.layoutType || '4x6',
      language: board.language || board.locale || 'en',
      is_public: false
    };

    console.log('[API CREATE BOARD] Step 1: Creating profile:', {
      profilePayload,
      boardId: board.id,
      boardName: board.name,
      tilesCount: board.tiles?.filter(t => t && typeof t === 'object').length || 0
    });

    // 1) 先建立 profile
    const profileRes = await this.axiosInstance.post(
      `/profiles`,
      profilePayload,
      { headers }
    );

    const createdProfile = profileRes.data || profileRes;
    const profileId = createdProfile.id;

    // Validate profileId
    if (!profileId || (typeof profileId !== 'number' && typeof profileId !== 'string')) {
      throw new Error(`Invalid profile ID returned from creation: ${profileId}`);
    }

    // Ensure profileId is a string for URL construction
    const profileIdStr = String(profileId);

    console.log('[API CREATE BOARD] Step 2: Profile created:', {
      profileId,
      profileIdStr,
      profileIdType: typeof profileId,
      createdProfile,
      userBound: true // Profile is bound to user via auth token
    });

    // 2) 再把這次傳進來的 board 結構存成這個 profile 的主板
    const boardPayload = {
      ...board,
      profileId: profileIdStr
    };

    console.log('[API CREATE BOARD] Step 3: Saving board data to profile:', {
      profileId: profileIdStr,
      boardPayload: {
        ...boardPayload,
        tiles: boardPayload.tiles?.slice(0, 3) // Log first 3 tiles only
      }
    });

    const { data } = await this.axiosInstance.put(
      `/profiles/${profileIdStr}/board`,
      boardPayload,
      { headers }
    );

    console.log('[API CREATE BOARD] Step 4: Board saved successfully:', {
      profileId,
      returnedData: {
        id: data.id,
        name: data.name,
        tilesCount: data.tiles?.length || 0
      }
    });

    return data;
  }

  async updateBoard(board) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    // 現在從 profile 入口更新主板：board.id 在新的模型下視為 profileId
    const profileId = board.profileId || board.id;

    // Check if this is a metadata-only update (no tiles in request)
    const isMetadataOnlyUpdate = !('tiles' in board);

    // For metadata-only updates, create a clean payload without tiles
    let payload = board;
    if (isMetadataOnlyUpdate) {
      // Create a clean object with only metadata fields
      payload = {
        id: board.id,
        profileId: board.profileId || board.id,
        name: board.name,
        description: board.description,
        isPublic: board.isPublic,
        layout_type: board.layout_type || board.layoutType,
        language: board.language || board.locale,
        author: board.author,
        email: board.email,
        hidden: board.hidden,
        locale: board.locale
        // Explicitly exclude tiles, grid, and other board structure fields
      };
      // Remove any tiles that might have been accidentally included
      delete payload.tiles;
      delete payload.grid;
      delete payload.tiles_count;
      delete payload.tilesCount;
    }

    console.log('[API updateBoard] Sending update request:', {
      profileId,
      boardId: payload.id,
      isPublic: payload.isPublic,
      hasIsPublic: 'isPublic' in payload,
      hasTiles: 'tiles' in payload,
      tilesCount: payload.tiles?.length || 0,
      boardKeys: Object.keys(payload),
      isMetadataOnly: isMetadataOnlyUpdate,
      originalHasTiles: 'tiles' in board
    });

    const { data } = await this.axiosInstance.put(
      `/profiles/${profileId}/board`,
      payload,
      { headers }
    );

    console.log('[API updateBoard] Update response received:', {
      profileId: data.id,
      isPublic: data.isPublic
    });

    return data;
  }

  async deleteBoard(boardId) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    // 在 profile 模型下，刪板 = 刪 profile
    console.log('[API] deleteBoard called with boardId:', boardId, 'Type:', typeof boardId);
    console.log('[API] DELETE request to:', `/profiles/${boardId}`);

    try {
      const { data } = await this.axiosInstance.delete(`/profiles/${boardId}`, {
        headers
      });
      console.log('[API] deleteBoard success, response:', data);
      return data;
    } catch (error) {
      console.error('[API] deleteBoard error:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        url: error?.config?.url
      });
      throw error;
    }
  }

  async boardReport(reportedBoardData) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    // 報告資料裡仍然帶 board/profile 的 id，後端再決定如何處理
    const { data } = await this.axiosInstance.post(
      `/profiles/report`,
      reportedBoardData,
      { headers }
    );
    return data;
  }

  async uploadFromDataURL(dataURL, filename, checkExtension = false) {
    const file = dataURLtoFile(dataURL, filename, checkExtension);

    let url = null;
    try {
      url = await this.uploadFile(file, filename);
    } catch (e) { }

    return url;
  }

  async uploadFile(file, filename) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'multipart/form-data'
    };

    const formData = new FormData();
    formData.append('file', file, filename);
    const response = await this.axiosInstance.post('media', formData, {
      headers
    });

    let imageUrl = response.data.url;

    // Ensure the URL has /api/ prefix if it's an upload path
    if (imageUrl && typeof imageUrl === 'string') {
      // If it's a relative path like "uploads/..." or "api/uploads/..."
      if (imageUrl.startsWith('uploads/') && !imageUrl.startsWith('api/uploads/')) {
        imageUrl = 'api/' + imageUrl;
      }
      // If it's already a full URL without /api/, add it
      else if (imageUrl.includes('/uploads/') && !imageUrl.includes('/api/uploads/')) {
        imageUrl = imageUrl.replace('/uploads/', '/api/uploads/');
      }
    }

    return imageUrl;
  }

  async generateTextToImage({
    query,
    text // Support 'text' for backward compatibility, but prefer 'query'
  }) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    // Use 'query' if provided, otherwise fallback to 'text'
    const searchQuery = query || text;
    if (!searchQuery) {
      throw new Error('query is required');
    }

    const response = await this.axiosInstance.post(
      'media/text-to-image',
      {
        query: searchQuery
      },
      { headers }
    );

    return response.data.url;
  }

  /**
   * Create a new card from an AI / Photocen suggestion.
   * This is a thin wrapper around POST /cards, but kept separate for clarity.
   * @param {Object} payload - { title, label_text, image_path, category, card_data? }
   */
  async createCardFromAISuggestion(payload) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    const { data } = await this.axiosInstance.post('/cards', payload, {
      headers
    });

    return data;
  }

  async createCommunicator(communicator) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    let data = {};
    let response = {};
    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    const communicatorToPost = { ...communicator };
    delete communicatorToPost.id;
    const { name, email } = getUserData();
    communicatorToPost.email = email;
    communicatorToPost.author = name;
    response = await this.axiosInstance.post(
      `/communicator`,
      communicatorToPost,
      { headers }
    );
    data = response.data.communicator;
    return data;
  }

  async updateCommunicator(communicator) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    let data = {};
    let response = {};
    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    const isLocalCommunicator =
      communicator.id && communicator.id === LOCAL_COMMUNICATOR_ID;

    if (isLocalCommunicator) {
      const communicatorToPost = { ...communicator };
      delete communicatorToPost.id;
      const { name, email } = getUserData();
      communicatorToPost.email = email;
      communicatorToPost.author = name;
      response = await this.axiosInstance.post(
        `/communicator`,
        communicatorToPost,
        { headers }
      );
      data = response.data.communicator;
    } else {
      response = await this.axiosInstance.put(
        `/communicator/${communicator.id}`,
        communicator,
        { headers }
      );
      data = response.data;
    }

    return data;
  }

  async analyticsReport(report) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }
    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    const { data } = await this.axiosInstance.post(
      `/analytics/batchGet`,
      report,
      {
        headers
      }
    );
    return data;
  }

  async getUserLocation() {
    try {
      // Location is not critical, use timeout and handle errors gracefully
      const { data } = await this.axiosInstance.get(`/location`, {
        timeout: 5000 // 5 second timeout for location
      });
      return data;
    } catch (error) {
      // Location is not critical - fail silently
      // Network errors are expected and shouldn't block the app
      const isNetworkError = error.code === 'ERR_NETWORK' ||
        error.message === 'Network Error' ||
        error.code === 'ECONNABORTED' ||
        error.message.includes('timeout');
      if (isNetworkError) {
        // Return null for network errors - location is optional
        return null;
      }
      // Re-throw other errors (like 404, 500, etc.)
      throw error;
    }
  }

  async getSubscriber(userId = getUserData().id, requestOrigin = 'unknown') {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }
    const headers = {
      Authorization: `Bearer ${authToken}`,
      requestOrigin,
      purchaseVersion: '1.0.0'
    };

    try {
      const response = await this.requestWithOfflineSupport('GET', `/subscriber/${userId}`, { headers }, { enabled: true, maxAge: 5 * 60 * 1000 });
      const data = response.data || response;

      if (data && !data.success) {
        throw data;
      }

      return data;
    } catch (error) {
      // If offline, throw a specific error that can be handled
      if (!isOnline() || error.code === 'ERR_NETWORK') {
        const networkError = new Error('Network Error');
        networkError.code = 'ERR_NETWORK';
        networkError.isNetworkError = true;
        throw networkError;
      }
      throw error;
    }
  }

  async createSubscriber(subscriber = {}) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };
    const { data } = await this.axiosInstance.post(`/subscriber`, subscriber, {
      headers
    });
    return data;
  }

  async cancelPlan(subscriptionId = '') {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }
    const data = { reason: 'User cancelled the subscription' };

    const headers = {
      Authorization: `Bearer ${authToken}`
    };
    const res = await this.axiosInstance.post(
      `/subscriber/cancel/${subscriptionId}`,
      { data },
      { headers }
    );
    return res;
  }

  async postTransaction(transaction = {}) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };
    const subscriberId = getSubscriberId();
    if (!subscriberId) throw new Error('No subscriber id supplied');

    const { data } = await this.axiosInstance.post(
      `/subscriber/${subscriberId}/transaction`,
      transaction,
      {
        headers
      }
    );
    return data;
  }

  async updateSubscriber(subscriber = {}) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };
    const subscriberId = getSubscriberId();
    if (!subscriberId) throw new Error('No subscriber id supplied');

    const { data } = await this.axiosInstance.patch(
      `/subscriber/${subscriberId}`,
      subscriber,
      {
        headers
      }
    );
    return data;
  }

  async listSubscriptions() {
    try {
      const response = await this.requestWithOfflineSupport('GET', `/subscription/list`, {}, { enabled: true, maxAge: 10 * 60 * 1000 });
      return response.data || response;
    } catch (error) {
      // Return empty subscriptions list if offline
      if (!isOnline() || error.code === 'ERR_NETWORK') {
        return [];
      }
      throw error;
    }
  }

  async deleteAccount() {
    const userId = getUserData().id;
    if (userId) {
      const authToken = getAuthToken();
      if (!(authToken && authToken.length)) {
        throw new Error('Need to be authenticated to perform this request');
      }

      const headers = {
        Authorization: `Bearer ${authToken}`
      };
      const { data } = await this.axiosInstance.delete(`/account/${userId}`, {
        headers
      });
      return data;
    }
  }

  async improvePhrase({ phrase, language }) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    try {
      const headers = {
        Authorization: `Bearer ${authToken}`
      };
      improvePhraseAbortController = new AbortController();
      const { data } = await this.axiosInstance.post(
        `/gpt/edit`,
        { phrase, language },
        {
          headers,
          signal: improvePhraseAbortController.signal
        }
      );
      return data;
    } catch (error) {
      if (error.message !== 'canceled') console.error(error);
      return { phrase: '' };
    }
  }

  // ============================================================================
  // PROFILE TRANSFER (Sprint 8)
  // ============================================================================

  /**
   * Export profile to JSON/OBF format
   * @param {number} profileId - Profile ID to export
   * @param {string} format - Export format ('json' or 'obf')
   * @returns {Promise<Object>} Export data
   */
  async exportProfile(profileId, format = 'json') {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post(
        '/transfer/export',
        { profile_id: profileId, format },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Export profile error:', error);
      throw error;
    }
  }

  /**
   * Import profile from JSON/OBF format
   * @param {Object} importData - Profile data to import
   * @param {string} format - Import format ('json' or 'obf')
   * @returns {Promise<Object>} Import result
   */
  async importProfile(importData, format = 'json') {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post(
        '/transfer/import',
        { data: importData, format },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Import profile error:', error);
      throw error;
    }
  }

  /**
   * Generate QR code for profile transfer
   * @param {number} profileId - Profile ID to transfer
   * @param {number} expiresIn - Expiration in hours (default 24)
   * @returns {Promise<Object>} QR code data
   */
  async generateQRCode(profileId, expiresIn = 24) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post(
        '/transfer/qr/generate',
        { profile_id: profileId, expires_in: expiresIn },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Generate QR code error:', error);
      throw error;
    }
  }

  /**
   * Redeem QR token to import profile
   * @param {string} token - QR token
   * @returns {Promise<Object>} Import result
   */
  async redeemQRToken(token) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post(
        '/transfer/qr/redeem',
        { token },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Redeem QR token error:', error);
      throw error;
    }
  }

  /**
   * Generate cloud code for profile transfer
   * @param {number} profileId - Profile ID to transfer
   * @param {number} expiresIn - Expiration in hours (default 168 = 7 days)
   * @returns {Promise<Object>} Cloud code
   */
  async generateCloudCode(profileId, expiresIn = 168) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post(
        '/transfer/cloud/generate',
        { profile_id: profileId, expires_in: expiresIn },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Generate cloud code error:', error);
      throw error;
    }
  }

  /**
   * Redeem cloud code to import profile
   * @param {string} code - Cloud code (e.g., "ABC-123-XYZ")
   * @returns {Promise<Object>} Import result
   */
  async redeemCloudCode(code) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post(
        '/transfer/cloud/redeem',
        { code },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Redeem cloud code error:', error);
      throw error;
    }
  }

  /**
   * Generate email ZIP transfer
   * @param {number} profileId - Profile ID to transfer
   * @param {string} email - Recipient email
   * @param {number} expiresIn - Expiration in hours (default 168 = 7 days)
   * @returns {Promise<Object>} Transfer result
   */
  async generateEmailTransfer(profileId, email, expiresIn = 168) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post(
        '/transfer/email/generate',
        { profile_id: profileId, email, expires_in: expiresIn },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Generate email transfer error:', error);
      throw error;
    }
  }

  /**
   * Validate transfer token
   * @param {string} token - Transfer token
   * @returns {Promise<Object>} Validation result
   */
  async validateTransferToken(token) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.get(
        `/transfer/validate/${token}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Validate transfer token error:', error);
      throw error;
    }
  }

  // ============================================================================
  // ACTION LOGS (Sprint 12)
  // ============================================================================

  /**
   * Get action logs with filters
   * @param {Object} filters - Filter options (profile_id, action_type, start_date, end_date, limit, offset)
   * @returns {Promise<Object>} Logs data
   */
  async getLogs(filters = {}) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key] !== null && filters[key] !== undefined) {
          params.append(key, filters[key]);
        }
      });

      const response = await this.requestWithOfflineSupport(
        'GET',
        `/action-logs?${params.toString()}`,
        { headers },
        { enabled: true, maxAge: 2 * 60 * 1000 } // Cache for 2 minutes
      );
      return response.data;
    } catch (error) {
      // If offline, return empty logs instead of throwing
      if (!isOnline() || error.code === 'ERR_NETWORK') {
        // Suppress error logging for expected offline behavior
        return { logs: [], total: 0 };
      }
      // Only log unexpected errors
      console.error('Get logs error:', error);
      throw error;
    }
  }

  /**
   * Export action logs to Excel/CSV
   * @param {Object} filters - Filter options (profile_id, start_date, end_date)
   * @returns {Promise<Blob>} Excel/CSV file blob
   */
  async exportLogs(filters = {}) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key] !== null && filters[key] !== undefined) {
          params.append(key, filters[key]);
        }
      });

      const response = await this.axiosInstance.get(
        `/action-logs/export?${params.toString()}`,
        { headers, responseType: 'blob' }
      );
      return response.data;
    } catch (error) {
      console.error('Export logs error:', error);
      throw error;
    }
  }

  // ============================================================================
  // AI FUNCTIONALITY (Sprint 9-10)
  // ============================================================================

  /**
   * Get AI card suggestions
   * @param {string} context - Context text
   * @param {string} profileIdOrBoardId - Profile ID (preferred) or Board ID
   * @param {number} limit - Number of suggestions
   * @returns {Promise<Object>} Suggestions data
   */
  async getAISuggestions(context, profileIdOrBoardId, limit = 10) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      // IMPORTANT: AI 请求可能很慢，这里单独把超时时间调高（不影响其他 API）
      console.log('[API] getAISuggestions - sending request with extended timeout (120000 ms)', {
        contextPreview: typeof context === 'string' ? context.substring(0, 100) : null,
        profileIdOrBoardId,
        limit
      });

      const response = await this.axiosInstance.post(
        'ai/suggest-cards',
        // 後端同時支援 profile_id 與 board_id，這裡保持名稱中性
        { context, profile_id: profileIdOrBoardId, limit },
        {
          headers,
          timeout: 120000 // 120s，确保前端不会在后端完成前先超时
        }
      );
      console.log('[API] getAISuggestions - response received', {
        status: response.status,
        hasData: !!response.data,
        suggestionsCount: response.data?.suggestions?.length
      });
      return response.data;
    } catch (error) {
      console.error('Get AI suggestions error:', error);
      throw error;
    }
  }

  /**
   * Get typing predictions
   * @param {string} input - Current typed text
   * @param {string} language - Language code
   * @param {number} limit - Number of predictions
   * @param {Object} context - Optional context (previous words, user history, etc.)
   * @returns {Promise<Object>} Predictions data
   */
  async getTypingPredictions(input, language = 'en', limit = 5, context = {}) {
    // Typing prediction endpoint supports both authenticated and guest users.
    // Attach token if available, but do not require it.
    const authToken = getAuthToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    if (authToken && authToken.length) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    try {
      const response = await this.axiosInstance.post(
        'ai/typing-prediction',
        { input, language, limit, context },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get typing predictions error:', error);
      throw error;
    }
  }

  /**
   * Get Jyutping predictions
   * @param {string} input - Partial Jyutping input
   * @param {number} limit - Number of predictions
   * @returns {Promise<Object>} Predictions data
   */
  async getJyutpingPredictions(input, limit = 10) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post(
        'ai/jyutping-prediction',
        { input, limit },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get Jyutping predictions error:', error);
      throw error;
    }
  }

  /**
   * Update adaptive learning data
   * @param {number} profileId - Profile ID
   * @param {number} cardId - Card ID
   * @param {string} difficulty - Difficulty level
   * @param {string} performance - Performance ('correct', 'incorrect', 'skipped')
   * @returns {Promise<Object>} Update result
   */
  async updateAdaptiveLearning(profileId, cardId, difficulty, performance) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post(
        'ai/adaptive-learning',
        { profile_id: profileId, card_id: cardId, difficulty, performance },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Update adaptive learning error:', error);
      throw error;
    }
  }

  /**
   * Get learning statistics
   * @param {number} profileId - Optional profile ID
   * @returns {Promise<Object>} Learning stats
   */
  async getLearningStats(profileId = null) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const params = profileId ? { profile_id: profileId } : {};
      const response = await this.axiosInstance.get('ai/learning-stats', {
        headers,
        params
      });
      return response.data;
    } catch (error) {
      console.error('Get learning stats error:', error);
      throw error;
    }
  }

  /**
   * Get user-level learning model (common mistakes tracking)
   * @param {number} profileId - Optional profile ID
   * @param {number} limit - Limit of results (default 20)
   * @returns {Promise<Object>} Learning model data
   */
  async getLearningModel(profileId = null, limit = 20) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const params = { limit };
      if (profileId) {
        params.profile_id = profileId;
      }
      const response = await this.axiosInstance.get('ai/learning-model', {
        headers,
        params
      });
      return response.data;
    } catch (error) {
      console.error('Get learning model error:', error);
      throw error;
    }
  }

  // ============================================================================
  // ADMIN PARENT-CHILD RELATIONSHIP MANAGEMENT
  // ============================================================================

  /**
   * Get all parent-child relationships (admin only)
   * @returns {Promise<Object>} Relationships data
   */
  async getAdminParentChildRelationships() {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.get('/admin/parent-child', { headers });
      return response.data;
    } catch (error) {
      console.error('Get parent-child relationships error:', error);
      throw error;
    }
  }

  /**
   * Create parent-child relationship (admin only)
   * @param {Object} relationshipData - Relationship data
   * @returns {Promise<Object>} Created relationship
   */
  async createAdminParentChildRelationship(relationshipData) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post('/admin/parent-child', relationshipData, { headers });
      return response.data;
    } catch (error) {
      console.error('Create parent-child relationship error:', error);
      throw error;
    }
  }

  /**
   * Update parent-child relationship (admin only)
   * @param {number} relationshipId - Relationship ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated relationship
   */
  async updateAdminParentChildRelationship(relationshipId, updateData) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.put(`/admin/parent-child/${relationshipId}`, updateData, { headers });
      return response.data;
    } catch (error) {
      console.error('Update parent-child relationship error:', error);
      throw error;
    }
  }

  /**
   * Delete parent-child relationship (admin only)
   * @param {number} relationshipId - Relationship ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteAdminParentChildRelationship(relationshipId) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.delete(`/admin/parent-child/${relationshipId}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Delete parent-child relationship error:', error);
      throw error;
    }
  }

  /**
   * Get recommended difficulty adjustment for learning games
   * @param {number} profileId - Optional profile ID
   * @param {string} gameType - Game type (default 'spelling')
   * @returns {Promise<Object>} Difficulty adjustment recommendations
   */
  async getDifficultyAdjustment(profileId = null, gameType = 'spelling') {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const params = { game_type: gameType };
      if (profileId) {
        params.profile_id = profileId;
      }
      const response = await this.axiosInstance.get('ai/difficulty-adjustment', {
        headers,
        params
      });
      return response.data;
    } catch (error) {
      console.error('Get difficulty adjustment error:', error);
      throw error;
    }
  }

  /**
   * Get personalized Jyutping assistant recommendations
   * @param {number} profileId - Optional profile ID
   * @param {number} limit - Limit of recommendations (default 10)
   * @returns {Promise<Object>} Personalized recommendations
   */
  async getJyutpingAssistant(profileId = null, limit = 10) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const params = { limit };
      if (profileId) {
        params.profile_id = profileId;
      }
      const response = await this.axiosInstance.get('ai/jyutping-assistant', {
        headers,
        params
      });
      return response.data;
    } catch (error) {
      console.error('Get Jyutping assistant error:', error);
      throw error;
    }
  }

  /**
   * Get AI-generated learning suggestions based on common mistakes
   * @param {string|number|null} profileId - Optional profile ID
   * @param {string} locale - User's selected language locale (e.g., 'zh-CN', 'zh-TW', 'en')
   * @returns {Promise<Object>} Learning suggestions with AI-generated advice
   */
  async getLearningSuggestions(profileId = null, locale = 'zh-CN') {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const params = new URLSearchParams();
      if (profileId) {
        params.append('profile_id', profileId);
      }
      if (locale) {
        params.append('locale', locale);
      }

      // AI 建議有時需要較長時間生成，單獨提高此請求的 timeout（例如 90 秒）
      const url = params.toString()
        ? `ai/learning-suggestions?${params.toString()}`
        : 'ai/learning-suggestions';

      const response = await this.axiosInstance.get(url, {
        headers,
        timeout: 90000 // 90 秒，只影響 learning-suggestions 這一個請求
      });
      return response.data;
    } catch (error) {
      console.error('Get learning suggestions error:', error);
      throw error;
    }
  }

  // Legacy method - keeping for backward compatibility
  async getLearningStatsOld(profileId = null) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const params = profileId ? `?profile_id=${profileId}` : '';
      const response = await this.axiosInstance.get(
        `/ai/learning-stats${params}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get learning stats error:', error);
      throw error;
    }
  }

  // ============================================================================
  // LEARNING GAMES (Sprint 11)
  // ============================================================================

  /**
   * Get spelling game questions
   * @param {string} difficulty - Difficulty level ('easy', 'medium', 'hard')
   * @param {number} limit - Number of questions
   * @returns {Promise<Object>} Game questions
   */
  async getSpellingGame(difficulty = 'medium', limit = 10, profileId = null) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      let url = `/games/spelling?difficulty=${encodeURIComponent(difficulty)}&limit=${encodeURIComponent(
        String(limit)
      )}`;
      if (profileId) {
        url += `&profile_id=${encodeURIComponent(profileId)}`;
      }
      const response = await this.axiosInstance.get(url, { headers });
      return response.data;
    } catch (error) {
      console.error('Get spelling game error:', error);
      throw error;
    }
  }

  /**
   * Get matching game
   * @param {string} type - Game type ('word-picture' or 'jyutping-picture')
   * @param {number} limit - Number of pairs
   * @returns {Promise<Object>} Game data
   */
  async getMatchingGame(type = 'word-picture', limit = 8, boardId = null, profileId = null) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      let url = `/games/matching?type=${encodeURIComponent(type)}&limit=${encodeURIComponent(
        String(limit)
      )}`;
      if (boardId) {
        url += `&board_id=${encodeURIComponent(boardId)}`;
      }
      if (profileId) {
        url += `&profile_id=${encodeURIComponent(profileId)}`;
      }

      const response = await this.requestWithOfflineSupport(
        'GET',
        url,
        { headers },
        { enabled: true, maxAge: 5 * 60 * 1000 } // Cache for 5 minutes
      );
      return response.data;
    } catch (error) {
      // If offline, return empty game data instead of throwing
      if (!isOnline() || error.code === 'ERR_NETWORK') {
        // Suppress error logging for expected offline behavior
        return { pairs: [], options: [] };
      }
      // Only log unexpected errors
      console.error('Get matching game error:', error);
      throw error;
    }
  }

  /**
   * Submit game result
   * @param {string} gameType - Game type
   * @param {number} score - Score achieved
   * @param {number} totalQuestions - Total questions
   * @param {number} timeSpent - Time spent in seconds
   * @param {string} difficulty - Difficulty level
   * @param {string|number|null} profileId - Optional profile ID to associate the result
   * @param {Array|null} questions - Optional array of question results for detailed logging
   * @returns {Promise<Object>} Submit result
   */
  async submitGameResult(gameType, score, totalQuestions, timeSpent, difficulty = 'medium', profileId = null, questions = null) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const payload = {
        game_type: gameType,
        score,
        total_questions: totalQuestions,
        time_spent: timeSpent,
        difficulty,
        profile_id: profileId || undefined
      };

      if (questions && Array.isArray(questions)) {
        payload.questions = questions;
      }

      const response = await this.axiosInstance.post(
        '/games/submit',
        payload,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Submit game result error:', error);
      throw error;
    }
  }

  /**
   * Get game history
   * @param {string} gameType - Optional game type filter
   * @param {number} limit - Number of records
   * @param {string|number|null} profileId - Optional profile filter
   * @returns {Promise<Object>} Game history
   */
  async getGameHistory(gameType = null, limit = 20, profileId = null) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const qs = new URLSearchParams();
      if (gameType) qs.append('game_type', gameType);
      if (profileId) qs.append('profile_id', profileId);
      qs.append('limit', limit);
      const response = await this.axiosInstance.get(
        `/games/history?${qs.toString()}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get game history error:', error);
      throw error;
    }
  }

  // ============================================================================
  // OCR TRANSLATOR (Sprint 11)
  // ============================================================================

  /**
   * Recognize text from image using OCR
   * @param {string} imageData - Base64 encoded image or image URL
   * @param {string} imageUrl - Alternative: image URL
   * @returns {Promise<Object>} OCR result
   */
  async recognizeImage(imageData = null, imageUrl = null) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post(
        '/ocr/recognize',
        { image: imageData, image_url: imageUrl },
        { headers }
      );
      return response.data;
    } catch (error) {
      // Suppress error logging for expected network errors (frontend will use client-side OCR)
      const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error';
      if (!isNetworkError || navigator.onLine) {
        console.error('OCR recognize error:', error);
      }
      throw error;
    }
  }

  /**
   * Convert Chinese text to Jyutping
   * @param {string} text - Chinese text
   * @returns {Promise<Object>} Conversion result
   */
  async convertToJyutping(text) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post(
        '/ocr/convert-to-jyutping',
        { text },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Convert to Jyutping error:', error);
      throw error;
    }
  }

  /**
   * Annotate image with Jyutping
   * @param {string} imageData - Base64 encoded image or image URL
   * @param {string} imageUrl - Alternative: image URL
   * @param {Array} annotations - Array of annotation objects
   * @returns {Promise<Object>} Annotation result
   */
  async annotateImage(imageData = null, imageUrl = null, annotations = []) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post(
        '/ocr/annotate',
        { image: imageData, image_url: imageUrl, annotations },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Annotate image error:', error);
      throw error;
    }
  }

  /**
   * Get OCR translation history
   * @param {number} limit - Number of records
   * @param {number} offset - Offset for pagination
   * @returns {Promise<Object>} History data
   */
  async getOCRHistory(limit = 20, offset = 0) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.get(
        `/ocr/history?limit=${limit}&offset=${offset}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      // Suppress error logging for expected network errors
      const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error';
      if (!isNetworkError || navigator.onLine) {
        console.error('Get OCR history error:', error);
      }
      throw error;
    }
  }

  /**
   * Delete OCR history entry
   * @param {number} historyId - History entry ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteOCRHistory(historyId) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.delete(
        `/ocr/history/${historyId}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      // Suppress error logging for expected network errors
      const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error';
      if (!isNetworkError || navigator.onLine) {
        console.error('Delete OCR history error:', error);
      }
      throw error;
    }
  }

  // ============================================================================
  // ADMIN PANEL (User Management)
  // ============================================================================

  /**
   * Get teacher students (teacher view)
   * @param {Object} filters - Optional filters (organization_id, class_id)
   * @returns {Promise<Object>} Students list
   */
  async getTeacherStudents(filters = {}) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key] !== null && filters[key] !== undefined) {
          params.append(key, filters[key]);
        }
      });

      const response = await this.axiosInstance.get(
        `/teacher/students?${params.toString()}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get teacher students error:', error);
      throw error;
    }
  }

  /**
   * Get available students for teacher assignment
   * @returns {Promise<Object>} Available students list
   */
  async getTeacherAvailableStudents() {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.get(
        '/teacher/available-students',
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get teacher available students error:', error);
      throw error;
    }
  }

  /**
   * Assign a student to the current teacher
   * @param {number} studentId - Student ID to assign
   * @param {number|null} organizationId - Optional organization ID
   * @param {number|null} classId - Optional class ID
   * @returns {Promise<Object>} Assignment result
   */
  async assignStudentToTeacher(studentId, organizationId = null, classId = null) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post(
        '/teacher/assign-student',
        {
          student_id: studentId,
          organization_id: organizationId,
          class_id: classId
        },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Assign student to teacher error:', error);
      throw error;
    }
  }

  /**
   * Unassign a student from the current teacher
   * @param {number} studentId - Student ID to unassign
   * @returns {Promise<Object>} Unassignment result
   */
  async unassignStudentFromTeacher(studentId) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.delete(
        `/teacher/unassign-student/${studentId}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Unassign student from teacher error:', error);
      throw error;
    }
  }

  /**
   * Get all users (admin only)
   * @param {Object} filters - Filter options (page, limit, search, role, is_active)
   * @returns {Promise<Object>} Users data with pagination
   */
  async getAdminUsers(filters = {}) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key] !== null && filters[key] !== undefined) {
          params.append(key, filters[key]);
        }
      });

      const response = await this.axiosInstance.get(
        `/admin/users?${params.toString()}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get admin users error:', error);
      throw error;
    }
  }

  /**
   * Get user details (admin only)
   * @param {number} userId - User ID
   * @returns {Promise<Object>} User details
   */
  async getAdminUser(userId) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.get(
        `/admin/users/${userId}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get admin user error:', error);
      throw error;
    }
  }

  /**
   * Update user (admin only)
   * @param {number} userId - User ID
   * @param {Object} userData - User data to update (name, role, is_active, is_verified, password)
   * @returns {Promise<Object>} Update result
   */
  async updateAdminUser(userId, userData) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.put(
        `/admin/users/${userId}`,
        userData,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Update admin user error:', error);
      throw error;
    }
  }

  /**
   * Delete/deactivate user (admin only)
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteAdminUser(userId) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.delete(
        `/admin/users/${userId}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Delete admin user error:', error);
      throw error;
    }
  }

  /**
   * Get admin dashboard data (system admin only)
   * @returns {Promise<Object>} Dashboard data
   */
  async getAdminDashboard() {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.get(
        '/admin/dashboard',
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get admin dashboard error:', error);
      throw error;
    }
  }

  /**
   * Get admin statistics (admin only)
   * @returns {Promise<Object>} Statistics data
   */
  async getAdminStatistics() {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.get(
        '/admin/statistics',
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get admin statistics error:', error);
      throw error;
    }
  }

  // ============================================================================
  // ROLE-BASED ADMIN PANEL
  // ============================================================================

  /**
   * Get organizations (system admin only)
   * @returns {Promise<Object>} Organizations list
   */
  async getAdminOrganizations() {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.get(
        '/admin/organizations',
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get admin organizations error:', error);
      throw error;
    }
  }

  /**
   * Get organizations (system admin only) - alias for backward compatibility
   * @returns {Promise<Object>} Organizations list
   */
  async getOrganizations() {
    return this.getAdminOrganizations();
  }

  /**
   * Create organization (system admin only)
   * @param {Object} orgData - Organization data
   * @returns {Promise<Object>} Created organization
   */
  async createOrganization(orgData) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post(
        '/admin/organizations',
        orgData,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Create organization error:', error);
      throw error;
    }
  }

  /**
   * Get organization classes (org admin or system admin)
   * @param {number} orgId - Organization ID
   * @returns {Promise<Object>} Classes list
   */
  async getOrganizationClasses(orgId) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.get(
        `/admin/organizations/${orgId}/classes`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get organization classes error:', error);
      throw error;
    }
  }

  /**
   * Create class in organization
   * @param {number} orgId - Organization ID
   * @param {Object} classData - Class data
   * @returns {Promise<Object>} Created class
   */
  async createOrganizationClass(orgId, classData) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post(
        `/admin/organizations/${orgId}/classes`,
        classData,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Create organization class error:', error);
      throw error;
    }
  }

  /**
   * Get organization users
   * @param {number} orgId - Organization ID
   * @returns {Promise<Object>} Users list
   */
  async getOrganizationUsers(orgId) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.get(
        `/admin/organizations/${orgId}/users`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get organization users error:', error);
      throw error;
    }
  }

  /**
   * Assign user to organization
   * @param {number} orgId - Organization ID
   * @param {Object} assignmentData - Assignment data (user_id, role, class_id)
   * @returns {Promise<Object>} Assignment result
   */
  async assignUserToOrganization(orgId, assignmentData) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post(
        `/admin/organizations/${orgId}/users`,
        assignmentData,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Assign user to organization error:', error);
      throw error;
    }
  }



  /**
   * Get parent children (parent view)
   * @returns {Promise<Object>} Children list
   */
  async getParentChildren() {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.get(
        '/parent/children',
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get parent children error:', error);
      throw error;
    }
  }

  /**
   * Get parent messages and available teachers (parent view)
   * @returns {Promise<Object>} Messages and teachers list
   */
  async getParentMessages() {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.get(
        '/parent/messages',
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get parent messages error:', error);
      throw error;
    }
  }

  /**
   * Get parent progress reports (parent view)
   * @returns {Promise<Object>} Progress reports list
   */
  async getParentProgressReports() {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.get(
        '/parent/progress-reports',
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get parent progress reports error:', error);
      throw error;
    }
  }

  /**
   * Get detailed progress for a specific child
   * @param {number} childId - Child user ID
   * @returns {Promise<Object>} Child progress data
   */
  async getParentChildProgress(childId) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.get(
        `/parent/child-progress/${childId}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get parent child progress error:', error);
      throw error;
    }
  }

  /**
   * Send message from parent to teacher
   * @param {Object} messageData - Message data (recipient_id, student_id, subject, message)
   * @returns {Promise<Object>} Send result
   */
  async sendParentMessage(messageData) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post(
        '/parent/send-message',
        messageData,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Send parent message error:', error);
      throw error;
    }
  }

  // ============================================================================
  // PARENT-TEACHER MESSAGING
  // ============================================================================

  /**
   * Get teacher messages and available parents
   * @returns {Promise<Object>} Messages and parents data
   */
  async getTeacherMessages() {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.get('/teacher/messages', { headers });
      return response.data;
    } catch (error) {
      console.error('Get teacher messages error:', error);
      throw error;
    }
  }

  /**
   * Get messaging contacts for the current user
   * @returns {Promise<Object>} Contacts list
   */
  async getMessagingContacts() {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.get('/messaging/contacts', { headers });
      return response.data;
    } catch (error) {
      console.error('Get messaging contacts error:', error);
      throw error;
    }
  }

  /**
   * Get message conversations for the current user
   * @param {Object} filters - Optional filters (page, limit)
   * @returns {Promise<Object>} Conversations list
   */
  async getMessageConversations(filters = {}) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    const params = new URLSearchParams();
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);

    try {
      const response = await this.axiosInstance.get(
        `/messaging/conversations?${params.toString()}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get message conversations error:', error);
      throw error;
    }
  }

  /**
   * Get messages with a specific user
   * @param {number} otherUserId - The other user's ID
   * @param {number|null} studentId - Optional student ID to filter messages
   * @returns {Promise<Object>} Messages list
   */
  async getMessagesWithUser(otherUserId, studentId = null) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    const params = new URLSearchParams();
    if (studentId) params.append('student_id', studentId);

    try {
      const response = await this.axiosInstance.get(
        `/messaging/messages/${otherUserId}?${params.toString()}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get messages with user error:', error);
      throw error;
    }
  }

  /**
   * Send a message
   * @param {Object} messageData - Message data (recipient_user_id, subject, message_body, student_user_id, priority)
   * @returns {Promise<Object>} Send result
   */
  async sendMessage(messageData) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post('/messaging/send', messageData, { headers });
      return response.data;
    } catch (error) {
      console.error('Send message error:', error);
      throw error;
    }
  }

  /**
   * Mark a message as read
   * @param {number} messageId - Message ID to mark as read
   * @returns {Promise<Object>} Mark read result
   */
  async markMessageAsRead(messageId) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.put(`/messaging/mark-read/${messageId}`, {}, { headers });
      return response.data;
    } catch (error) {
      console.error('Mark message as read error:', error);
      throw error;
    }
  }

  /**
   * Delete a message
   * @param {number} messageId - Message ID to delete
   * @returns {Promise<Object>} Delete result
   */
  async deleteMessage(messageId) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.delete(`/messaging/messages/${messageId}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Delete message error:', error);
      throw error;
    }
  }

  // ============================================================================
  // CHILD SETTINGS MANAGEMENT
  // ============================================================================

  /**
   * Get child settings managed by parent
   * @param {number} childUserId - Child user ID
   * @returns {Promise<Object>} Child settings
   */
  async getChildSettings(childUserId) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.get(`/messaging/child-settings/${childUserId}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Get child settings error:', error);
      throw error;
    }
  }

  /**
   * Save child settings managed by parent
   * @param {Object} settingsData - Settings data with child_user_id and settings_data
   * @returns {Promise<Object>} Save result
   */
  async saveChildSettings(settingsData) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post('/messaging/child-settings', settingsData, { headers });
      return response.data;
    } catch (error) {
      console.error('Save child settings error:', error);
      throw error;
    }
  }

  // ============================================================================
  // PROGRESS REPORTING SYSTEM
  // ============================================================================

  /**
   * Get progress reports for a child
   * @param {number} childUserId - Child user ID
   * @returns {Promise<Object>} Progress reports list
   */
  async getProgressReports(childUserId) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.get(`/messaging/progress-reports/${childUserId}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Get progress reports error:', error);
      throw error;
    }
  }

  /**
   * Generate a new progress report
   * @param {Object} reportData - Report generation data
   * @returns {Promise<Object>} Generated report
   */
  async generateProgressReport(reportData) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.post('/messaging/progress-reports', reportData, { headers });
      return response.data;
    } catch (error) {
      console.error('Generate progress report error:', error);
      throw error;
    }
  }

  /**
   * Get student progress (for teachers/parents)
   * @param {number} studentId - Student user ID
   * @returns {Promise<Object>} Student progress data
   */
  async getStudentProgress(studentId) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      // Try teacher endpoint first, fallback to admin if needed
      const response = await this.axiosInstance.get(
        `/teacher/student-progress/${studentId}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      // If teacher endpoint fails, try admin endpoint
      if (error.response?.status === 403 || error.response?.status === 404) {
        try {
          const response = await this.axiosInstance.get(
            `/admin/student/progress/${studentId}`,
            { headers }
          );
          return response.data;
        } catch (adminError) {
          console.error('Get student progress error (both teacher and admin):', adminError);
          throw adminError;
        }
      }
      console.error('Get student progress error:', error);
      throw error;
    }
  }

  /**
   * Create learning objective (for teachers)
   * @param {Object} objectiveData - Objective data
   * @returns {Promise<Object>} Created objective
   */
  async createLearningObjective(objectiveData) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      // Try teacher endpoint first for teachers, fallback to admin endpoint
      const response = await this.axiosInstance.post(
        '/teacher/learning-objectives',
        objectiveData,
        { headers }
      );
      return response.data;
    } catch (error) {
      // If teacher endpoint fails (403/404), try admin endpoint
      if (error.response?.status === 403 || error.response?.status === 404) {
        try {
          const adminResponse = await this.axiosInstance.post(
            '/admin/learning-objectives',
            objectiveData,
            { headers }
          );
          return adminResponse.data;
        } catch (adminError) {
          console.error('Create learning objective error (both teacher and admin):', adminError);
          throw adminError;
        }
      }
      console.error('Create learning objective error:', error);
      throw error;
    }
  }

  /**
   * Update learning objective (for teachers)
   * @param {number} objectiveId - Objective ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated objective
   */
  async updateLearningObjective(objectiveId, updateData) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.put(
        `/admin/learning-objectives/${objectiveId}`,
        updateData,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Update learning objective error:', error);
      throw error;
    }
  }

  /**
   * Delete learning objective (for teachers)
   * @param {number} objectiveId - Objective ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteLearningObjective(objectiveId) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.delete(
        `/admin/learning-objectives/${objectiveId}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Delete learning objective error:', error);
      throw error;
    }
  }


  // ============================================================================
  // DATA RETENTION POLICY
  // ============================================================================

  /**
   * Get data retention policy settings
   * @returns {Promise<Object>} Retention settings
   */
  async getDataRetentionSettings() {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.get(
        'data-retention',
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Get data retention settings error:', error);
      throw error;
    }
  }

  /**
   * Update data retention policy settings
   * @param {Object} settings - Retention settings (action_logs_retention_days, learning_logs_retention_days, ocr_history_retention_days)
   * @returns {Promise<Object>} Updated settings
   */
  async updateDataRetentionSettings(settings) {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.axiosInstance.put(
        'data-retention',
        settings,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Update data retention settings error:', error);
      throw error;
    }
  }

  /**
   * Manually trigger data retention cleanup
   * @returns {Promise<Object>} Cleanup statistics
   */
  async runDataRetentionCleanup() {
    const authToken = getAuthToken();
    if (!(authToken && authToken.length)) {
      throw new Error('Need to be authenticated to perform this request');
    }

    const headers = {
      Authorization: `Bearer ${authToken}`
    };

    try {
      const response = await this.axiosInstance.post(
        'data-retention/cleanup',
        {},
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Run data retention cleanup error:', error);
      throw error;
    }
  }
}

const API_INSTANCE = new API({});

export default API_INSTANCE;
