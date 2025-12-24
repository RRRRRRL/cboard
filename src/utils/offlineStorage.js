/**
 * Offline Storage Utility
 * Provides IndexedDB-based caching for API responses to support offline mode
 */

const DB_NAME = 'cboard-offline-db';
const DB_VERSION = 1;
const STORE_NAME = 'api-cache';

let dbInstance = null;

/**
 * Initialize IndexedDB
 */
export function initOfflineStorage() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Generate cache key from URL and params
 */
function generateCacheKey(url, params = {}) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${JSON.stringify(params[key])}`)
    .join('&');
  return `${url}${sortedParams ? `?${sortedParams}` : ''}`;
}

/**
 * Store API response in cache
 */
export async function cacheApiResponse(url, params, data, maxAge = 60 * 60 * 1000) {
  try {
    const db = await initOfflineStorage();
    const key = generateCacheKey(url, params);
    const timestamp = Date.now();

    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await store.put({
      key,
      url,
      params,
      data,
      timestamp,
      maxAge
    });

    // Clean up old entries
    cleanupOldEntries(db);
  } catch (error) {
    console.warn('Failed to cache API response:', error);
  }
}

/**
 * Get cached API response
 */
export async function getCachedApiResponse(url, params) {
  try {
    const db = await initOfflineStorage();
    const key = generateCacheKey(url, params);

    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        // Check if cache is still valid
        const age = Date.now() - result.timestamp;
        if (age > result.maxAge) {
          // Cache expired, delete it
          deleteCachedResponse(db, key);
          resolve(null);
          return;
        }

        resolve(result.data);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn('Failed to get cached API response:', error);
    return null;
  }
}

/**
 * Delete cached response
 */
async function deleteCachedResponse(db, key) {
  try {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await store.delete(key);
  } catch (error) {
    console.warn('Failed to delete cached response:', error);
  }
}

/**
 * Clean up old cache entries
 */
async function cleanupOldEntries(db) {
  try {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const now = Date.now();

    const request = index.openCursor();
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const entry = cursor.value;
        const age = now - entry.timestamp;
        if (age > entry.maxAge) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  } catch (error) {
    console.warn('Failed to cleanup old entries:', error);
  }
}

/**
 * Clear all cached API responses
 */
export async function clearApiCache() {
  try {
    const db = await initOfflineStorage();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await store.clear();
  } catch (error) {
    console.warn('Failed to clear API cache:', error);
  }
}

/**
 * Check if we're online
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Get cache size estimate
 */
export async function getCacheSize() {
  try {
    if (!navigator.storage || !navigator.storage.estimate) {
      return null;
    }
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0
    };
  } catch (error) {
    console.warn('Failed to get cache size:', error);
    return null;
  }
}

