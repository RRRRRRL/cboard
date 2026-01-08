/**
 * Eye Tracking Driven Scanner
 * Controls scanning highlight movement based on eye gaze position
 * Replaces manual keyboard/switch input with eye tracking
 */

class EyeTrackingScanner {
  constructor() {
    this.isActive = false;
    this.scanningMode = 'single'; // 'single', 'row', 'column', 'operation'
    this.scanningSpeed = 2000; // milliseconds (adaptive)
    this.currentHighlightedTile = null;
    this.scanningNavigation = null;
    this.currentIndex = 0;
    this.gazeThreshold = 100; // pixels - distance threshold for gaze detection
    this.lastGazeTime = 0;
    this.scanningState = 'idle'; // 'idle', 'scanning', 'selecting'
    this.onHighlightCallback = null;
    this.onSelectCallback = null;
    this.allTiles = [];
    this.navigationData = null;
  }

  /**
   * Initialize scanning with settings
   * @param {Object} settings - Scanning settings { enabled, mode, speed, loop, loop_count }
   * @param {Array} tiles - Array of tile objects with id, position info
   * @param {Object} navigationData - Navigation data from API (for row/column modes)
   * @param {Function} onHighlight - Callback when highlight changes
   * @param {Function} onSelect - Callback when item is selected
   */
  initialize(settings, tiles, navigationData, onHighlight, onSelect) {
    this.isActive = settings.enabled || false;
    this.scanningMode = settings.mode || 'single';
    this.scanningSpeed = (settings.speed || 2.0) * 1000; // Convert seconds to ms
    this.allTiles = tiles || [];
    this.navigationData = navigationData;
    this.onHighlightCallback = onHighlight;
    this.onSelectCallback = onSelect;
    
    if (this.isActive) {
      this.start();
    } else {
      this.stop();
    }
  }

  /**
   * Start scanning
   */
  start() {
    this.isActive = true;
    this.scanningState = 'scanning';
    this.currentIndex = 0;
    this.highlightNext();
  }

  /**
   * Stop scanning
   */
  stop() {
    this.isActive = false;
    this.scanningState = 'idle';
    this.removeHighlight();
    this.currentHighlightedTile = null;
  }

  /**
   * Update scanning settings
   */
  updateSettings(settings) {
    if (settings.enabled !== undefined) {
      if (settings.enabled && !this.isActive) {
        this.start();
      } else if (!settings.enabled && this.isActive) {
        this.stop();
      }
    }
    if (settings.mode) {
      this.scanningMode = settings.mode;
    }
    if (settings.speed !== undefined) {
      this.scanningSpeed = settings.speed * 1000; // Convert to ms
    }
  }

  /**
   * Handle eye gaze position to control scanning highlight
   * @param {number} x - Gaze x coordinate
   * @param {number} y - Gaze y coordinate
   */
  handleGaze(x, y) {
    if (!this.isActive || this.scanningState !== 'scanning') {
      return;
    }

    const now = Date.now();
    
    // Throttle gaze updates to prevent excessive processing
    if (now - this.lastGazeTime < 100) { // Update at most every 100ms
      return;
    }
    this.lastGazeTime = now;

    // Find the tile closest to the gaze position
    const gazedTile = this.findTileAtPosition(x, y);
    
    if (gazedTile && gazedTile !== this.currentHighlightedTile) {
      // Move highlight to the gazed tile
      this.highlightTile(gazedTile);
    }
  }

  /**
   * Find tile at or near the gaze position
   * @param {number} x - Gaze x coordinate
   * @param {number} y - Gaze y coordinate
   * @returns {Object|null} - Tile element or null
   */
  findTileAtPosition(x, y) {
    try {
      const element = document.elementFromPoint(x, y);
      if (!element) return null;

      const tileElement = element.closest('.Tile');
      if (!tileElement) return null;

      const tileId = tileElement.dataset?.tileId || tileElement.id;
      if (!tileId) return null;

      return tileElement;
    } catch (error) {
      
      return null;
    }
  }

  /**
   * Highlight a specific tile
   * @param {HTMLElement} tileElement - Tile element to highlight
   */
  highlightTile(tileElement) {
    if (!tileElement) return;

    // Remove highlight from previous tile
    this.removeHighlight();

    // Add highlight to new tile
    tileElement.classList.add('scanner__focused');
    this.currentHighlightedTile = tileElement;

    const tileId = tileElement.dataset?.tileId || tileElement.id;
    
    // Callback for highlight change (e.g., for audio feedback)
    if (this.onHighlightCallback) {
      this.onHighlightCallback(tileId, tileElement);
    }
  }

  /**
   * Remove highlight from current tile
   */
  removeHighlight() {
    if (this.currentHighlightedTile) {
      this.currentHighlightedTile.classList.remove('scanner__focused');
      this.currentHighlightedTile = null;
    }

    // Also remove from any other elements that might have the class
    const allHighlighted = document.querySelectorAll('.scanner__focused');
    allHighlighted.forEach(el => el.classList.remove('scanner__focused'));
  }

  /**
   * Highlight next item based on scanning mode
   */
  highlightNext() {
    if (!this.isActive) return;

    let nextTile = null;

    if (this.scanningMode === 'single') {
      nextTile = this.getNextTileInSingleMode();
    } else if (this.scanningMode === 'row') {
      nextTile = this.getNextTileInRowMode();
    } else if (this.scanningMode === 'column') {
      nextTile = this.getNextTileInColumnMode();
    }

    if (nextTile) {
      this.highlightTile(nextTile);
    }
  }

  /**
   * Get next tile in single mode (sequential)
   */
  getNextTileInSingleMode() {
    if (!this.allTiles || this.allTiles.length === 0) return null;

    const tile = this.allTiles[this.currentIndex];
    if (!tile) {
      // Wrap around if we've reached the end
      this.currentIndex = 0;
      return this.allTiles[0] ? this.getTileElement(this.allTiles[0].id) : null;
    }

    this.currentIndex = (this.currentIndex + 1) % this.allTiles.length;
    return this.getTileElement(tile.id);
  }

  /**
   * Get next tile in row mode
   */
  getNextTileInRowMode() {
    // For row mode, navigation is controlled by eye gaze
    // This is handled in handleGaze method
    return this.currentHighlightedTile;
  }

  /**
   * Get next tile in column mode
   */
  getNextTileInColumnMode() {
    // For column mode, navigation is controlled by eye gaze
    // This is handled in handleGaze method
    return this.currentHighlightedTile;
  }

  /**
   * Get tile DOM element by ID
   */
  getTileElement(tileId) {
    try {
      return document.querySelector(`[data-tile-id="${tileId}"]`) ||
             document.getElementById(tileId) ||
             document.querySelector(`.Tile[data-tile-id="${tileId}"]`);
    } catch (error) {
      
      return null;
    }
  }

  /**
   * Handle dwell time on highlighted tile (selection)
   */
  handleDwell(tileId, x, y, dwellDuration) {
    if (!this.isActive || !this.currentHighlightedTile) return;

    const currentTileId = this.currentHighlightedTile.dataset?.tileId || this.currentHighlightedTile.id;
    if (String(currentTileId) === String(tileId)) {
      // Dwell on highlighted tile = selection
      this.selectCurrentTile();
    }
  }

  /**
   * Select the currently highlighted tile
   */
  selectCurrentTile() {
    if (!this.currentHighlightedTile) return;

    const tileId = this.currentHighlightedTile.dataset?.tileId || this.currentHighlightedTile.id;
    
    if (this.onSelectCallback) {
      this.onSelectCallback(tileId, this.currentHighlightedTile);
    }

    // After selection, reset to start of scanning cycle
    if (this.scanningMode === 'single') {
      this.currentIndex = 0;
      // Continue scanning after selection
      setTimeout(() => {
        if (this.isActive) {
          this.highlightNext();
        }
      }, 500);
    } else {
      // For row/column modes, scanning continues based on gaze
      // Highlight remains active for next selection
    }
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.stop();
    this.allTiles = [];
    this.navigationData = null;
    this.onHighlightCallback = null;
    this.onSelectCallback = null;
  }
}

export default EyeTrackingScanner;
