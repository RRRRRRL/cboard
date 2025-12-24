/**
 * Image URL Transformer
 * 
 * Transforms image URLs in board data to use the correct backend address
 * from .env configuration. This ensures that old boards with hardcoded
 * IP addresses are updated to use the current backend.
 */

import { API_URL } from '../constants';

/**
 * Extract base URL from API_URL
 * For images, use relative paths (without port) so they work with proxy
 * @returns {string} Base URL (protocol + host) from API_URL, or empty string for relative paths
 */
function getBaseUrl() {
  try {
    if (API_URL) {
      // Check if API_URL is a relative path (starts with /)
      if (API_URL.startsWith('/')) {
        // Relative path - return empty string to use relative paths for images
        // The proxy (setupProxy.js) will handle forwarding /api requests to backend
        console.log(`[ImageURL] API_URL is relative path, using relative paths for images`);
        return '';
      } else {
        // Absolute URL - extract base URL (includes port if specified)
        const apiUrlObj = new URL(API_URL);
        const baseUrl = `${apiUrlObj.protocol}//${apiUrlObj.host}`;
        console.log(`[ImageURL] Base URL extracted from API_URL: ${baseUrl} (API_URL: ${API_URL})`);
        return baseUrl;
      }
    }
  } catch (e) {
    console.warn('Failed to extract base URL from API_URL:', e);
  }
  // Fallback: use empty string for relative paths
  console.log(`[ImageURL] Using relative paths (no base URL)`);
  return '';
}

/**
 * Normalize image URL to use current backend address
 * @param {string} imageUrl - The image URL to normalize
 * @returns {string} Normalized image URL
 */
export function normalizeImageUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return imageUrl;
  }
  
  // Skip if already a data URI or blob URL
  if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
    return imageUrl;
  }
  
  const baseUrl = getBaseUrl();
  
  // Handle full URLs (http:// or https://) - check if it's an upload path from our backend
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    // Check if it's an upload path from our backend (contains /uploads/ or /api/uploads/)
    if (imageUrl.includes('/uploads/') || imageUrl.includes('/api/uploads/')) {
      try {
        const urlObj = new URL(imageUrl);
        let path = urlObj.pathname;
        
        // Ensure /api/uploads/ prefix is present (add if missing)
        if (path.startsWith('/uploads/') && !path.startsWith('/api/uploads/')) {
          path = '/api' + path;
        }
        
        // If baseUrl is empty (relative path mode), return path as-is
        // Otherwise, reconstruct with current base URL
        const normalizedUrl = baseUrl ? `${baseUrl}${path}` : path;
        console.log(`[ImageURL] Transforming: ${imageUrl} → ${normalizedUrl}`);
        return normalizedUrl;
      } catch (e) {
        // If URL parsing fails, try to extract path manually
        const match = imageUrl.match(/(\/uploads\/.*)$/);
        if (match) {
          let path = match[1];
          // Ensure /api/uploads/ prefix
          if (!path.startsWith('/api/uploads/')) {
            path = '/api' + path;
          }
          const normalizedUrl = baseUrl ? `${baseUrl}${path}` : path;
          console.log(`[ImageURL] Transforming (manual): ${imageUrl} → ${normalizedUrl}`);
          return normalizedUrl;
        }
      }
    }
    // For other external URLs, return as-is
    return imageUrl;
  }
  
  // Handle relative paths (uploads/... or api/uploads/...)
  // Also handle paths starting with / (e.g., /uploads/... or /api/uploads/...)
  if (imageUrl.startsWith('uploads/') || imageUrl.startsWith('api/uploads/') ||
      imageUrl.startsWith('/uploads/') || imageUrl.startsWith('/api/uploads/')) {
    let imagePath = imageUrl;
    
    // Ensure path starts with /
    if (!imagePath.startsWith('/')) {
      imagePath = '/' + imagePath;
    }
    
    // Ensure '/api/uploads/' prefix is present
    if (imagePath.startsWith('/uploads/') && !imagePath.startsWith('/api/uploads/')) {
      imagePath = '/api' + imagePath;
    }
    
    // If baseUrl is empty (relative path mode), return path as-is
    // Otherwise, prepend baseUrl
    const normalizedUrl = baseUrl ? `${baseUrl}${imagePath}` : imagePath;
    console.log(`[ImageURL] Transforming relative: ${imageUrl} → ${normalizedUrl}`);
    return normalizedUrl;
  }
  
  return imageUrl;
}

/**
 * Transform image URLs in a tile object
 * @param {Object} tile - Tile object with potential image URL
 * @returns {Object} Tile with normalized image URL
 */
export function transformTileImageUrl(tile) {
  if (!tile || typeof tile !== 'object') {
    return tile;
  }
  
  const transformed = { ...tile };
  
  // Transform image URL if present
  if (transformed.image) {
    transformed.image = normalizeImageUrl(transformed.image);
  }
  
  // Transform sound URL if present
  if (transformed.sound) {
    transformed.sound = normalizeImageUrl(transformed.sound);
  }
  
  return transformed;
}

/**
 * Transform image URLs in board data (recursively processes all tiles)
 * @param {Object} board - Board object with tiles array
 * @returns {Object} Board with normalized image URLs in all tiles
 */
export function transformBoardImageUrls(board) {
  if (!board || typeof board !== 'object') {
    return board;
  }
  
  const transformed = { ...board };
  
  // Transform tiles if present
  if (Array.isArray(transformed.tiles)) {
    transformed.tiles = transformed.tiles.map(tile => transformTileImageUrl(tile));
  }
  
  // Transform caption if present (board image)
  if (transformed.caption) {
    transformed.caption = normalizeImageUrl(transformed.caption);
  }
  
  // Also transform cover_image if present (used in public boards)
  if (transformed.cover_image) {
    transformed.cover_image = normalizeImageUrl(transformed.cover_image);
  }
  
  return transformed;
}

/**
 * Transform image URLs in an array of boards
 * @param {Array} boards - Array of board objects
 * @returns {Array} Array of boards with normalized image URLs
 */
export function transformBoardsImageUrls(boards) {
  if (!Array.isArray(boards)) {
    return boards;
  }
  
  return boards.map(board => transformBoardImageUrls(board));
}

/**
 * Convert full URL to relative path for storage
 * @param {string} imageUrl - The image URL to convert
 * @returns {string} Relative path (e.g., "uploads/user_X/image.png")
 */
export function convertUrlToRelativePath(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return imageUrl;
  }
  
  // Skip if already a data URI or blob URL
  if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
    return imageUrl;
  }
  
  // If already a relative path, return as-is
  if (imageUrl.startsWith('uploads/') || imageUrl.startsWith('api/uploads/')) {
    // Remove 'api/' prefix if present for consistency
    if (imageUrl.startsWith('api/uploads/')) {
      return imageUrl.replace(/^api\//, '');
    }
    return imageUrl;
  }
  
  // Handle full URLs (http:// or https://)
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    // Check if it's an upload path from our backend
    if (imageUrl.includes('/uploads/') || imageUrl.includes('/api/uploads/')) {
      try {
        const urlObj = new URL(imageUrl);
        let path = urlObj.pathname;
        
        // Remove leading slash and /api prefix if present
        path = path.replace(/^\/+/, ''); // Remove leading slashes
        if (path.startsWith('api/uploads/')) {
          path = path.replace(/^api\//, '');
        }
        
        console.log(`[ImageURL] Converting to relative: ${imageUrl} → ${path}`);
        return path;
      } catch (e) {
        // If URL parsing fails, try to extract path manually
        const match = imageUrl.match(/(?:^https?:\/\/[^/]+)?\/?(uploads\/.*)$/);
        if (match) {
          const path = match[1].replace(/^api\//, '');
          console.log(`[ImageURL] Converting to relative (manual): ${imageUrl} → ${path}`);
          return path;
        }
      }
    }
    // For other external URLs, return as-is (might be external image)
    return imageUrl;
  }
  
  return imageUrl;
}

/**
 * Convert image URLs in a tile object to relative paths
 * @param {Object} tile - Tile object with potential image URL
 * @returns {Object} Tile with relative path URLs
 */
export function convertTileUrlsToRelative(tile) {
  if (!tile || typeof tile !== 'object') {
    return tile;
  }
  
  const converted = { ...tile };
  
  // Convert image URL if present
  if (converted.image) {
    converted.image = convertUrlToRelativePath(converted.image);
  }
  
  // Convert sound URL if present
  if (converted.sound) {
    converted.sound = convertUrlToRelativePath(converted.sound);
  }
  
  return converted;
}

/**
 * Convert image URLs in board data to relative paths (for storage)
 * @param {Object} board - Board object with tiles array
 * @returns {Object} Board with relative path URLs in all tiles
 */
export function convertBoardUrlsToRelative(board) {
  if (!board || typeof board !== 'object') {
    return board;
  }
  
  const converted = { ...board };
  
  // Convert tiles if present
  if (Array.isArray(converted.tiles)) {
    converted.tiles = converted.tiles.map(tile => convertTileUrlsToRelative(tile));
  }
  
  // Convert caption if present (board image)
  if (converted.caption) {
    converted.caption = convertUrlToRelativePath(converted.caption);
  }
  
  return converted;
}

