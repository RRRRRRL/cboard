import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import shortid from 'shortid';
import { resize } from 'mathjs';
import { isEqual } from 'lodash';
import { injectIntl, intlShape } from 'react-intl';
import isMobile from 'ismobilejs';
import domtoimage from 'dom-to-image';
import CircularProgress from '@material-ui/core/CircularProgress';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import Slide from '@material-ui/core/Slide';
import {
  showNotification,
  hideNotification
} from '../Notifications/Notifications.actions';
import { deactivateScanner } from '../../providers/ScannerProvider/ScannerProvider.actions';
import {
  speak,
  cancelSpeech
} from '../../providers/SpeechProvider/SpeechProvider.actions';
import { getTilesListForNewOrder, moveOrderItem } from '../FixedGrid/utils';
import {
  addBoards,
  changeBoard,
  replaceBoard,
  previousBoard,
  toRootBoard,
  createBoard,
  updateBoard,
  switchBoard,
  createTile,
  deleteTiles,
  editTiles,
  focusTile,
  clickSymbol,
  changeOutput,
  historyRemoveBoard,
  updateApiObjects,
  updateApiObjectsNoChild,
  getApiObjects,
  downloadImages,
  createApiBoard,
  upsertApiBoard,
  changeDefaultBoard,
  updateApiBoard
} from './Board.actions';
import {
  addBoardCommunicator,
  verifyAndUpsertCommunicator
} from '../Communicator/Communicator.actions';
import { disableTour } from '../App/App.actions';
import TileEditor from './TileEditor';
import JyutpingKeyboard from '../JyutpingKeyboard';
import JyutpingRulesConfig from './JyutpingRulesConfig';
import messages from './Board.messages';
import Board from './Board.component';
import API from '../../api';
import {
  SCANNING_METHOD_AUTOMATIC,
  SCANNING_METHOD_MANUAL
} from '../Settings/Scanning/Scanning.constants';
import { NOTIFICATION_DELAY } from '../Notifications/Notifications.constants';
import { EMPTY_VOICES } from '../../providers/SpeechProvider/SpeechProvider.constants';
import {
  DEFAULT_ROWS_NUMBER,
  DEFAULT_COLUMNS_NUMBER,
  SHORT_ID_MAX_LENGTH
} from './Board.constants';
import PremiumFeature from '../PremiumFeature';
import {
  IS_BROWSING_FROM_APPLE_TOUCH,
  IS_BROWSING_FROM_SAFARI
} from '../../constants';
import LoadingIcon from '../UI/LoadingIcon';
import { resolveTileLabel, DEFAULT_BOARDS } from '../../helpers';
import { getEyeTrackingInstance } from '../../utils/eyeTrackingIntegration';
//import { isAndroid } from '../../cordova-util';

const ogv = require('ogv');
ogv.OGVLoader.base = process.env.PUBLIC_URL + '/ogv';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export class BoardContainer extends Component {
  static propTypes = {
    /**
     * @ignore
     */
    intl: intlShape.isRequired,
    /**
     * Board history navigation stack
     */
    navHistory: PropTypes.arrayOf(PropTypes.string),
    /**
     * Board to display
     */
    board: PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      tiles: PropTypes.arrayOf(PropTypes.object)
    }),
    /**
     * Board output
     */
    output: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string,
        image: PropTypes.string,
        vocalization: PropTypes.string
      })
    ),
    /**
     * Add boards from API
     */
    addBoards: PropTypes.func,
    /**
     * Load board
     */
    changeBoard: PropTypes.func,
    /**
     * Load previous board
     */
    previousBoard: PropTypes.func,
    /**
     * Load root board
     */
    toRootBoard: PropTypes.func,
    historyRemoveBoard: PropTypes.func,
    /**
     * Create board
     */
    createBoard: PropTypes.func,
    updateBoard: PropTypes.func,
    /**
     * Create tile
     */
    createTile: PropTypes.func,
    /**
     * Edit tiles
     */
    editTiles: PropTypes.func,
    /**
     * Delete tiles
     */
    deleteTiles: PropTypes.func,
    /**
     * Focuses a board tile
     */
    focusTile: PropTypes.func,
    /**
     * Change output
     */
    changeOutput: PropTypes.func,
    /**
     * Show notification
     */
    showNotification: PropTypes.func,
    /**
     * Deactivate Scanner
     */
    deactivateScanner: PropTypes.func,
    /**
     * Show display Settings
     */
    displaySettings: PropTypes.object,
    /**
     * Show navigationSettings
     */
    navigationSettings: PropTypes.object,
    /**
     * Show userData
     */
    userData: PropTypes.object,
    /**
     * Scanner Settings
     */
    scannerSettings: PropTypes.object,
    /**
     * Adds a Board to the Active Communicator
     */
    addBoardCommunicator: PropTypes.func.isRequired,
    downloadImages: PropTypes.func,
    lang: PropTypes.string,
    isRootBoardTourEnabled: PropTypes.bool,
    isSymbolSearchTourEnabled: PropTypes.bool,
    disableTour: PropTypes.func,
    isLiveMode: PropTypes.bool,
    changeDefaultBoard: PropTypes.func
  };

  state = {
    selectedTileIds: [],
    isSaving: false,
    isSelectAll: false,
    isSelecting: false,
    isLocked: true,
    isJyutpingKeyboardOpen: false,
    isJyutpingRulesConfigOpen: false,
    tileEditorOpen: false,
    isGettingApiObjects: false,
    copyPublicBoard: false,
    blockedPrivateBoard: false,
    isFixedBoard: false,
    copiedTiles: [],
    isScroll: false,
    totalRows: null,
    isCbuilderBoard: false,
    profiles: [],
    // Audio guide mode for scanning highlight feedback: 'off' | 'beep' | 'card_audio'
    audioGuideMode: 'off'
  };
  
  constructor(props) {
    super(props);
    this.boardRef = React.createRef();
    this._isMounted = false;
  }

  // 判斷一個 board 是否只有「虛擬 tiles」（例如列表接口返回的全 null），需要再從後端補拉真實版面
  hasOnlyVirtualTiles(board) {
    if (!board || !Array.isArray(board.tiles)) {
      return true;
    }
    if (board.tiles.length === 0) {
      return true;
    }
    const hasRealTileObject = board.tiles.some(
      tile => tile && typeof tile === 'object'
    );
    return !hasRealTileObject;
  }

  async componentDidMount() {
    console.log('[BoardContainer] ===== componentDidMount called =====');
    this._isMounted = true;
    
    // Load user profiles for transfer functionality
    if (this.props.userData && this.props.userData.id) {
      this.loadProfiles();
    }

    // Load accessibility settings (including audio guide mode) for scanning feedback
    this.loadAccessibilityAudioGuide().catch(error => {
      console.debug('[BoardContainer] Failed to load accessibility audio guide settings:', error.message || error);
    });
    
    // Add window focus listener to re-check eye tracking and refresh board when user returns from settings
    this._windowFocusHandler = async () => {
      if (!this._isMounted) return;
      
      console.log('[BoardContainer] Window focused - re-checking eye tracking settings and refreshing board...');
      
      // Refresh current board if it's a profile (numeric ID)
      const { board } = this.props;
      if (board && board.id) {
        const boardIdStr = String(board.id);
        const isNumericId = /^\d+$/.test(boardIdStr);
        
        if (isNumericId) {
          // This is a profile, refresh it to get latest data (e.g., newly added cards)
          console.log('[BoardContainer] Refreshing profile board:', boardIdStr);
          try {
            const refreshedBoard = await API.getBoard(boardIdStr);
            if (refreshedBoard && this._isMounted) {
              console.log('[BoardContainer] ✓ Profile board refreshed:', {
                profileId: boardIdStr,
                tilesCount: refreshedBoard.tiles?.length || 0
              });
              this.props.addBoards([refreshedBoard]);
            }
          } catch (refreshError) {
            console.error('[BoardContainer] Failed to refresh profile board on focus:', refreshError);
          }
        }
      }
      
      // Only check eye tracking if it's enabled
      API.getSettings().then(settings => {
        if (!this._isMounted) return;
        
        const eyeTrackingSettings = settings.eyeTracking || { enabled: false };
        if (eyeTrackingSettings.enabled) {
          this.setupEyeTracking().catch(error => {
            if (error && !error.message?.includes('disabled')) {
              console.debug('[BoardContainer] Eye tracking check on focus:', error.message);
            }
          });
        }
      }).catch(() => {
        // Guest user or settings unavailable, skip
      });
    };
    window.addEventListener('focus', this._windowFocusHandler);
    
    const {
      match
    } = this.props;
    const id = match?.params?.id;

    const {
      board,
      boards,
      communicator,
      changeBoard,
      userData,
      history,
      getApiObjects
      //downloadImages
    } = this.props;

    // Loggedin user?
    if ('name' in userData && 'email' in userData && window.navigator.onLine) {
      //synchronize communicator and boards with API
      if (this._isMounted) {
        this.setState({ isGettingApiObjects: true });
      }
      getApiObjects().then(() => {
        if (this._isMounted) {
          this.setState({ isGettingApiObjects: false });
        }
      }).catch(() => {
        if (this._isMounted) {
          this.setState({ isGettingApiObjects: false });
        }
      });
    }

    // Setup swipe navigation and long-press detection
    this.setupSwipeDetection();
    this.setupLongPressDetection();
    
    // Setup eye tracking if enabled
    // Only setup eye tracking if it's enabled in settings
    // Check settings first to avoid unnecessary API calls
    console.log('[BoardContainer] Checking eye tracking settings before setup...');
    API.getSettings().then(settings => {
      if (!this._isMounted) return;
      
      const eyeTrackingSettings = settings.eyeTracking || { enabled: false };
      if (eyeTrackingSettings.enabled) {
        console.log('[BoardContainer] Eye tracking is enabled, setting up...');
        this.setupEyeTracking().catch(error => {
          console.error('[BoardContainer] Unhandled error in setupEyeTracking:', error);
        });
      } else {
        console.log('[BoardContainer] Eye tracking is disabled, skipping setup');
      }
    }).catch(error => {
      // If settings can't be loaded (e.g., guest user), assume disabled
      console.log('[BoardContainer] Could not load settings (guest mode?), skipping eye tracking setup');
    });

    // Ensure all IDs are strings for consistent comparison
    const normalizedId = id ? String(id) : null;
    const normalizedBoardId = board?.id ? String(board.id) : null;
    const normalizedRootBoardId = communicator?.rootBoard ? String(communicator.rootBoard) : null;

    let boardExists = null;

    if (normalizedId && board && normalizedId === normalizedBoardId) {
      //active board = requested board, use that board
      boardExists = boards.find(b => String(b.id) === normalizedBoardId);
    } else if (normalizedId && board && normalizedId !== normalizedBoardId) {
      //active board != requested board, use requested if exist otherwise use active
      boardExists = boards.find(b => String(b.id) === normalizedId);
      if (!boardExists) {
        try {
          const remoteBoard = await this.tryRemoteBoard(normalizedId);
          if (remoteBoard) {
            // Add the remote board to the boards list to prevent duplicates
            this.props.addBoards([remoteBoard]);
            boardExists = remoteBoard;
          } else {
            // Board not found or corrupted, try to use active board or redirect to root
            boardExists = boards.find(b => String(b.id) === normalizedBoardId);
            if (!boardExists) {
              // Active board also doesn't exist, will redirect to root board below
              boardExists = null;
            }
          }
        } catch (err) {
          console.warn('[BoardContainer] Error fetching remote board:', err);
          // If board not found (404), try active board or redirect to root
          if (err?.response?.status === 404) {
            boardExists = boards.find(b => String(b.id) === normalizedBoardId);
            if (!boardExists) {
              boardExists = null;
            }
          } else {
            boardExists = boards.find(b => String(b.id) === normalizedBoardId);
            if (!boardExists) {
              boardExists = null;
            }
          }
        }
      }
    } else if (normalizedId && !board) {
      //no active board but requested board, use requested
      boardExists = boards.find(b => String(b.id) === normalizedId);
      if (!boardExists) {
        try {
          const remoteBoard = await this.tryRemoteBoard(normalizedId);
          if (remoteBoard) {
            // Add the remote board to the boards list to prevent duplicates
            this.props.addBoards([remoteBoard]);
            boardExists = remoteBoard;
          } else {
            // Board not found or corrupted, redirect to root board
            console.warn('[BoardContainer] Remote board not found or corrupted:', normalizedId);
            boardExists = null;
          }
        } catch (err) {
          console.warn('[BoardContainer] Error fetching remote board:', err);
          // If board not found (404) or corrupted, redirect to root board
          if (err?.response?.status === 404 || (err.message && err.message.includes('corrupted'))) {
            boardExists = null;
          } else {
            boardExists = null;
          }
        }
      }
    } else if (!normalizedId && !!board) {
      //no requested board, use active board
      boardExists = boards.find(b => String(b.id) === normalizedBoardId);
    } else {
      //neither requested nor active board, use communicator root board
      boardExists = boards.find(b => String(b.id) === normalizedRootBoardId);
    }

    // 如果找到的 board 只有虛擬 tiles（例如從 /board/my 列表來的全 null tiles），
    // 需要再從後端 /profiles/{id}/board 補拉一次真實版面。
    if (boardExists && this.hasOnlyVirtualTiles(boardExists)) {
      try {
        console.log(
          '[BoardContainer] Found board with only virtual/empty tiles, hydrating from API...',
          boardExists.id
        );
        const hydratedBoard = await this.tryRemoteBoard(String(boardExists.id));
        if (hydratedBoard) {
          this.props.addBoards([hydratedBoard]);
          boardExists = hydratedBoard;
        }
      } catch (err) {
        console.warn(
          '[BoardContainer] Failed to hydrate board, will continue with existing data:',
          boardExists.id,
          err
        );
      }
    }

    if (!boardExists) {
      // try the root board
      boardExists = boards.find(b => String(b.id) === normalizedRootBoardId);
      if (!boardExists) {
        boardExists = boards.find(b => b.id && String(b.id) !== '');
      }
    }
    
    // Prevent creating new boards - if board doesn't exist, redirect to root board
    if (!boardExists) {
      console.warn('[BoardContainer] No board found, redirecting to root board');
      // Try to load root board
      const rootBoard = DEFAULT_BOARDS.advanced?.[0];
      if (rootBoard) {
        // Ensure root board is in the boards list
        const rootBoardExists = boards.find(b => String(b.id) === String(rootBoard.id));
        if (!rootBoardExists) {
          this.props.addBoards([rootBoard]);
        }
        // Switch to root board
        this.props.switchBoard(rootBoard.id);
        history.replace(`/profile/${rootBoard.id}`);
        console.log('[BoardContainer] Redirected to root board:', rootBoard.id);
        return;
      } else {
        console.error('[BoardContainer] No root board available, cannot proceed');
        return;
      }
    }
    
    const boardId = String(boardExists.id);
    changeBoard(boardId);
    // Ensure URL matches the board ID exactly
    const targetUrl = `/profile/${boardId}`;
    if (history.location.pathname !== targetUrl) {
      history.replace(targetUrl);
    }

    //set board type
    this.setState({ isFixedBoard: !!boardExists.isFixed });

    // if (isAndroid()) downloadImages();
  }

  /**
   * Load accessibility settings and store audio guide mode for scanning highlight
   */
  loadAccessibilityAudioGuide = async () => {
    try {
      const data = await API.getAccessibilitySettings();
      const accessibility = data.accessibility || {};
      const audioGuide = accessibility.audio_guide || 'off';
      if (this._isMounted) {
        this.setState({ audioGuideMode: audioGuide });
      }
    } catch (error) {
      // Guest users or network errors are non‑critical for audio guide
      throw error;
    }
  };

  UNSAFE_componentWillReceiveProps(nextProps) {
    const currentId = this.props.match?.params?.id;
    const nextId = nextProps.match?.params?.id;
    
    // Ensure IDs are strings for comparison
    const normalizedCurrentId = currentId ? String(currentId) : null;
    const normalizedNextId = nextId ? String(nextId) : null;
    
    if (normalizedCurrentId !== normalizedNextId) {
      const {
        navHistory,
        boards,
        changeBoard,
        previousBoard,
        historyRemoveBoard,
        board,
        history
      } = this.props;

      if (!normalizedNextId) {
        return; // No board ID in next props, skip
      }

      // Find board with normalized ID comparison
      const boardExists = boards.find(b => String(b.id) === normalizedNextId);
      
      if (boardExists) {
        // Check if this is a browser back action
        const isBackAction = navHistory.length >= 2 && 
          String(navHistory[navHistory.length - 2]) === normalizedNextId;
        
        if (isBackAction) {
          // Browser back action - use previous board logic
          changeBoard(normalizedNextId);
          previousBoard();
          this.scrollToTop();
        } else {
          // Normal route change - switch to the requested board
          // Only switch if it's different from current board
          const currentBoardId = board?.id ? String(board.id) : null;
          if (currentBoardId !== normalizedNextId) {
            console.log('[BoardContainer] Route changed, switching to board:', normalizedNextId);
            changeBoard(normalizedNextId);
            // Ensure URL matches the board ID
            history.replace(`/profile/${normalizedNextId}`);
          }
        }
      } else {
        // Board not found in local boards, try to fetch it
        console.log('[BoardContainer] Board not found locally, attempting to fetch:', normalizedNextId);
        this.tryRemoteBoard(normalizedNextId).then(remoteBoard => {
          if (!this._isMounted) return;
          
          if (remoteBoard) {
            this.props.addBoards([remoteBoard]);
            changeBoard(normalizedNextId);
            history.replace(`/profile/${normalizedNextId}`);
          } else {
            // Board not found, check if it's a back action
            const isBackAction = navHistory.length >= 2 && 
              String(navHistory[navHistory.length - 2]) === normalizedNextId;
            if (isBackAction) {
              //board is invalid so we remove from navigation history
              historyRemoveBoard(normalizedNextId);
            } else {
              // Redirect to root board if board not found
              const rootBoard = DEFAULT_BOARDS.advanced?.[0];
              if (rootBoard) {
                const rootBoardExists = boards.find(b => String(b.id) === String(rootBoard.id));
                if (!rootBoardExists) {
                  this.props.addBoards([rootBoard]);
                }
                this.props.switchBoard(rootBoard.id);
                history.replace(`/profile/${rootBoard.id}`);
              }
            }
          }
        }).catch(err => {
          console.warn('[BoardContainer] Error fetching board in route change:', err);
          // Redirect to root board on error
          const rootBoard = DEFAULT_BOARDS.advanced?.[0];
          if (rootBoard) {
            const rootBoardExists = boards.find(b => String(b.id) === String(rootBoard.id));
            if (!rootBoardExists) {
              this.props.addBoards([rootBoard]);
            }
            this.props.switchBoard(rootBoard.id);
            history.replace(`/profile/${rootBoard.id}`);
          }
        });
      }
    }
  }

  componentDidUpdate(prevProps) {
    // Check for scanning settings changes from multiple sources
    // 1. Legacy scannerSettings.active
    // 2. Accessibility settings (new format)
    const prevScanningEnabled = prevProps.scannerSettings?.active || 
                                this.state?.accessibilitySettings?.scanning?.enabled || false;
    const currentScanningEnabled = this.props.scannerSettings?.active || 
                                   this.state?.accessibilitySettings?.scanning?.enabled || false;
    
    if (prevScanningEnabled !== currentScanningEnabled) {
      if (this.eyeTrackingInstance) {
        if (currentScanningEnabled) {
          this.setupEyeTrackingScanning().catch(error => {
            console.debug('[BoardContainer] Error updating eye tracking scanning:', error);
          });
        } else {
          // Scanning disabled - immediately stop scanning
          this.eyeTrackingInstance.updateScanningSettings({ enabled: false });
          // Remove all highlights
          const allHighlighted = document.querySelectorAll('.scanner__focused');
          allHighlighted.forEach(el => el.classList.remove('scanner__focused'));
        }
      }
    }
    const { board, boards, userData, changeBoard } = this.props;
    
    // Re-setup eye tracking if board changed (user might have enabled it in settings)
    const boardChanged = prevProps.board?.id !== board?.id;
    if (boardChanged) {
      console.log('[BoardContainer] Board changed, re-setting up eye tracking...');
      // Only setup eye tracking if it's enabled
      API.getSettings().then(settings => {
        const eyeTrackingSettings = settings.eyeTracking || { enabled: false };
        if (eyeTrackingSettings.enabled) {
          this.setupEyeTracking().catch(error => {
            console.error('[BoardContainer] Unhandled error in setupEyeTracking (after board change):', error);
          });
        }
      }).catch(() => {
        // Guest user or settings unavailable, skip
      });
      
      // Refresh board when it changes (e.g., navigating to a profile)
      if (board && board.id) {
        const boardIdStr = String(board.id);
        const isNumericId = /^\d+$/.test(boardIdStr);
        
        if (isNumericId) {
          // This is a profile, refresh it to get latest data
          console.log('[BoardContainer] Board changed to profile, refreshing:', boardIdStr);
          API.getBoard(boardIdStr).then(refreshedBoard => {
            if (refreshedBoard && this._isMounted) {
              console.log('[BoardContainer] ✓ Profile board refreshed on change:', {
                profileId: boardIdStr,
                tilesCount: refreshedBoard.tiles?.length || 0
              });
              this.props.addBoards([refreshedBoard]);
            }
          }).catch(refreshError => {
            console.error('[BoardContainer] Failed to refresh profile board on change:', refreshError);
          });
        }
      }
    }
    
    // Re-check eye tracking settings periodically ONLY if eye tracking is enabled
    // NOTE: This interval is intentionally slow and self-stopping to avoid spamming logs
    // and repeated WebGazer initializations that can cause texture size errors.
    // Only start periodic check if eye tracking is actually enabled
    if (!this._eyeTrackingCheckInterval && this.eyeTrackingInstance && this.eyeTrackingInstance.isEnabled) {
      let attempts = 0;
      const maxAttempts = 3; // Only re-check a few times
      this._eyeTrackingCheckInterval = setInterval(() => {
        attempts += 1;
        // Stop checking if we've tried enough times or tracking is already enabled
        if (attempts > maxAttempts || (this.eyeTrackingInstance && this.eyeTrackingInstance.isEnabled)) {
          clearInterval(this._eyeTrackingCheckInterval);
          this._eyeTrackingCheckInterval = null;
          return;
        }
        // Only check if eye tracking is enabled
        if (this.eyeTrackingInstance && this.eyeTrackingInstance.isEnabled) {
          console.log('[BoardContainer] Periodic check: Re-checking eye tracking settings...');
          this.setupEyeTracking().catch(error => {
            // Silently handle - this is just a periodic check
            if (error && !error.message?.includes('disabled')) {
              console.debug('[BoardContainer] Periodic eye tracking check:', error.message);
            }
          });
        } else {
          // Eye tracking disabled, stop checking
          clearInterval(this._eyeTrackingCheckInterval);
          this._eyeTrackingCheckInterval = null;
        }
      }, 30000); // Check every 30 seconds, and only a few times
    }
    
    // Handle board type change
    if (board && prevProps.board && board.isFixed !== prevProps.board.isFixed) {
      this.setState({ isFixedBoard: board.isFixed });
    }
    
    // If user boards were just loaded and we're on root board, switch to user's most recent board
    if (userData && userData.email && boards && prevProps.boards) {
      const prevBoardsCount = prevProps.boards.length;
      const currentBoardsCount = boards.length;
      
      // Check if new boards were added
      if (currentBoardsCount > prevBoardsCount) {
        const newBoards = boards.filter(b => {
          // Check if this is a new user board
          const wasInPrev = prevProps.boards.some(pb => pb.id === b.id);
          if (wasInPrev) return false;
          
          // Check if it's a user board (has email or long ID)
          return b.email === userData.email || (b.id && b.id.length > 14);
        });
        
        if (newBoards.length > 0) {
          // Check if current board is root or default board
          const currentBoard = board;
          const isRootBoard = !currentBoard || 
                             currentBoard.id === 'root' || 
                             (currentBoard.id && currentBoard.id.length < 14);
          
          if (isRootBoard) {
            // Find oldest user board (not most recent) to avoid switching to newly added temporary boards
            // Only consider permanent IDs (numeric), not temporary shortids
            const permanentBoards = newBoards.filter(b => {
              if (!b || !b.id) return false;
              const bIdStr = String(b.id);
              // Only consider permanent IDs (numeric), not temporary shortids
              return /^\d+$/.test(bIdStr);
            });
            
            if (permanentBoards.length > 0) {
              // Sort by created_at (oldest first) to get the oldest board
              const sortedBoards = [...permanentBoards].sort((a, b) => {
                const aDate = a.created_at ? new Date(a.created_at) : new Date(0);
                const bDate = b.created_at ? new Date(b.created_at) : new Date(0);
                return aDate - bDate;
              });
              const oldestBoard = sortedBoards[0];
              
              if (oldestBoard && oldestBoard.id) {
                console.log('Board component - Switching to oldest user board:', oldestBoard.id);
                changeBoard(oldestBoard.id);
                this.props.history.replace(`/profile/${oldestBoard.id}`);
              }
            } else {
              console.warn('Board component - No permanent user boards found, keeping current board');
            }
          }
        }
      }
    }
  }

  toggleSelectMode() {
    this.setState(prevState => ({
      isSelecting: !prevState.isSelecting,
      isSelectAll: false,
      selectedTileIds: []
    }));
  }

  selectAllTiles() {
    const { board } = this.props;
    const allTileIds = board.tiles.map(tile => tile.id);

    this.setState({
      selectedTileIds: allTileIds
    });
  }

  selectTile(tileId) {
    this.setState({
      selectedTileIds: [...this.state.selectedTileIds, tileId]
    });
  }

  deselectTile(tileId) {
    const [...selectedTileIds] = this.state.selectedTileIds;
    const tileIndex = selectedTileIds.indexOf(tileId);
    selectedTileIds.splice(tileIndex, 1);
    this.setState({ selectedTileIds });
  }

  toggleTileSelect(tileId) {
    if (this.state.selectedTileIds.includes(tileId)) {
      this.deselectTile(tileId);
    } else {
      this.selectTile(tileId);
    }
  }

  async tryRemoteBoard(boardId) {
    const { userData, location } = this.props;

    const queryParams = new URLSearchParams(location.search);
    const isCbuilderBoard = queryParams.get('cbuilder');
    if (this._isMounted) {
      this.setState({ isCbuilderBoard });
    }

    try {
      const remoteBoard = isCbuilderBoard
        ? await API.getCbuilderBoard(boardId)
        : await API.getBoard(boardId);

      // Check if component is still mounted after async operation
      if (!this._isMounted) {
        return null;
      }

      // 這裡只做簡單的 null 過濾，不再把「全為 null」當成損壞板強制拋錯，
      // 避免正常的 profile / board 因為暫時性的虛擬 tiles 也被重定向回 root。
      if (remoteBoard && remoteBoard.tiles && Array.isArray(remoteBoard.tiles)) {
        const validTiles = remoteBoard.tiles.filter(tile => 
          tile !== null && tile !== undefined && typeof tile === 'object'
        );
        remoteBoard.tiles = validTiles;
      }

      // Cboard 本地 profile 模型下：
      // - /profiles/{id}/board 已經在後端做了 user_id / is_public 檢查
      // - 能成功拿到 remoteBoard，就說明當前用戶有權訪問這個板
      // 只有 Cboard Cloud (cbuilder) 的情況，才需要沿用原來的「複製公共板 / 阻止私有板」邏輯。
      if (isCbuilderBoard) {
        // 舊的 Cboard 雲端邏輯：公共板需要提示複製
        if (this._isMounted) {
          if (remoteBoard.isPublic) {
            this.setState({ copyPublicBoard: remoteBoard });
          } else {
            this.setState({ blockedPrivateBoard: true });
          }
        }
        return null;
      }

      // 本地 profile 後端：直接返回板資料，前端當作自己的板使用
      return remoteBoard;
    } catch (err) {
      if (this._isMounted) {
        if (
          isCbuilderBoard &&
          (err?.response?.status === 401 || err?.cause === 401)
        ) {
          this.setState({ blockedPrivateBoard: true });
        }
      }
      
      // If board not found (404) or corrupted, show message and redirect to root board
      if (err?.response?.status === 404 || (err.message && err.message.includes('corrupted'))) {
        if (this.props.showNotification && this.props.intl) {
          this.props.showNotification(
            this.props.intl.formatMessage({
              id: 'cboard.components.Board.boardNotFoundOrCorrupted',
              defaultMessage: 'Board not found or corrupted. Redirecting to root board.'
            }),
            'error'
          );
        }
        // Redirect to root board
        const rootBoard = DEFAULT_BOARDS.advanced?.[0];
        if (rootBoard) {
          const { boards } = this.props;
          const rootBoardExists = boards.find(b => String(b.id) === String(rootBoard.id));
          if (!rootBoardExists) {
            this.props.addBoards([rootBoard]);
          }
          this.props.switchBoard(rootBoard.id);
          this.props.history.replace(`/profile/${rootBoard.id}`);
          console.log('[BoardContainer] Redirected to root board after board not found/corrupted');
          return null; // Return null to indicate board not found
        }
      }
      
      throw new Error('Cannot get the remote board');
    }
  }

  async captureBoardScreenshot() {
    const node = document.getElementById('BoardTilesContainer').firstChild;
    let dataURL = null;
    try {
      dataURL = await domtoimage.toPng(node);
    } catch (e) {}

    return dataURL;
  }

  async playAudio(src) {
    const safariNeedHelp =
      (IS_BROWSING_FROM_SAFARI || IS_BROWSING_FROM_APPLE_TOUCH) &&
      src.endsWith('.ogg');
    const audio = safariNeedHelp ? new ogv.OGVPlayer() : new Audio();
    audio.src = src;
    await audio.play();
  }

  handleEditBoardTitle = name => {
    const { board, updateBoard } = this.props;
    const titledBoard = {
      ...board,
      name: name
    };
    const processedBoard = this.updateIfFeaturedBoard(titledBoard);
    updateBoard(processedBoard);
    this.saveApiBoardOperation(processedBoard);
  };

  saveApiBoardOperation = async board => {
    const {
      userData,
      communicator,
      replaceBoard,
      updateApiObjectsNoChild,
      lang,
      verifyAndUpsertCommunicator
    } = this.props;

    var createBoard = false;
    // Loggedin user?
    if ('name' in userData && 'email' in userData) {
      this.setState({ isSaving: true });
      try {
        //prepare board
        let boardData = {
          ...board,
          author: userData.name,
          email: userData.email,
          hidden: false,
          locale: lang
        };
        //check if user has an own communicator
        if (communicator.email !== userData.email) {
          const communicatorData = {
            ...communicator,
            boards: boardData.id === 'root' ? ['root'] : ['root', boardData.id],
            rootBoard: 'root'
          };
          verifyAndUpsertCommunicator(communicatorData);
        }
        //check if we have to create a copy of the board (legacy Cboard logic)
        // In the new profile-centric model:
        // - Template/root boards use short, non-numeric IDs like "root" → CREATE
        // - Persisted profiles use numeric IDs like "62" → UPDATE
        const boardIdStr = String(boardData.id || '');
        const isNumericId = /^\d+$/.test(boardIdStr);

        if (!isNumericId && boardIdStr.length < SHORT_ID_MAX_LENGTH) {
          createBoard = true;
          boardData = {
            ...boardData,
            isPublic: false
          };
        } else {
          //update the board
          updateBoard(boardData);
        }
        //api updates
        const boardId = await updateApiObjectsNoChild(
          boardData,

          createBoard
        );
        if (createBoard) {
          replaceBoard({ ...boardData }, { ...boardData, id: boardId });
        }
        this.historyReplaceBoardId(boardId);
      } catch (err) {
        console.log(err.message);
      } finally {
        this.setState({ isSaving: false });
      }
    }
  };

  // Update profile metadata only (isPublic, name, description, etc.) without touching tiles
  // This prevents accidental deletion of cards when publishing/unpublishing
  updateProfileMetadataOnly = async (boardData) => {
    const {
      userData,
      updateApiBoard
    } = this.props;

    // Loggedin user?
    if ('name' in userData && 'email' in userData) {
      this.setState({ isSaving: true });
      try {
        // Prepare minimal board data with ONLY metadata fields
        // Explicitly exclude tiles to prevent deletion
        // Create a completely new object to avoid any reference issues
        const metadataOnly = {};
        
        // Only copy metadata fields, explicitly exclude tiles and grid
        if (boardData.id) metadataOnly.id = boardData.id;
        if (boardData.profileId || boardData.id) metadataOnly.profileId = boardData.profileId || boardData.id;
        if (boardData.name) metadataOnly.name = boardData.name;
        if (boardData.description !== undefined) metadataOnly.description = boardData.description;
        if (boardData.isPublic !== undefined) metadataOnly.isPublic = boardData.isPublic;
        if (boardData.layout_type || boardData.layoutType) metadataOnly.layout_type = boardData.layout_type || boardData.layoutType;
        if (boardData.language || boardData.locale) metadataOnly.language = boardData.language || boardData.locale;
        if (userData.name) metadataOnly.author = userData.name;
        if (userData.email) metadataOnly.email = userData.email;
        metadataOnly.hidden = false;
        if (userData.locale) metadataOnly.locale = userData.locale;
        else if (boardData.locale) metadataOnly.locale = boardData.locale;
        else metadataOnly.locale = 'en';
        
        // Explicitly ensure tiles and grid are NOT included
        // Double-check by deleting them if they somehow got in
        delete metadataOnly.tiles;
        delete metadataOnly.grid;
        delete metadataOnly.tiles_count;
        delete metadataOnly.tilesCount;
        
        console.log('[updateProfileMetadataOnly] Updating metadata only:', {
          profileId: metadataOnly.profileId,
          isPublic: metadataOnly.isPublic,
          hasTiles: 'tiles' in metadataOnly,
          hasGrid: 'grid' in metadataOnly,
          keys: Object.keys(metadataOnly),
          inputBoardDataKeys: Object.keys(boardData),
          inputHasTiles: 'tiles' in boardData
        });
        
        await updateApiBoard(metadataOnly);
      } catch (err) {
        console.error('[updateProfileMetadataOnly] Error:', err);
        throw err;
      } finally {
        this.setState({ isSaving: false });
      }
    }
  };

  handleEditClick = () => {
    this.setState({ tileEditorOpen: true });
  };

  handleBoardTypeChange = async () => {
    const { board, updateBoard } = this.props;

    this.setState({ isFixedBoard: !this.state.isFixedBoard });
    const newBoard = {
      ...board,
      isFixed: !this.state.isFixedBoard
    };
    if (!board.grid) {
      const defaultGrid = {
        rows: DEFAULT_ROWS_NUMBER,
        columns: DEFAULT_COLUMNS_NUMBER,
        order: this.getDefaultOrdering(board.tiles)
      };
      newBoard.grid = defaultGrid;
    }
    const processedBoard = this.updateIfFeaturedBoard(newBoard);
    await updateBoard(processedBoard);
    this.saveApiBoardOperation(processedBoard);
  };

  getDefaultOrdering = (tiles, grid = null) => {
    const rows = grid?.rows || DEFAULT_ROWS_NUMBER;
    const columns = grid?.columns || DEFAULT_COLUMNS_NUMBER;
    let order = [];
    let tilesIndex = 0;
    for (var i = 0; i < rows; i++) {
      order[i] = [];
      for (var j = 0; j < columns; j++) {
        if (tilesIndex < tiles.length && tiles[tilesIndex]) {
          // Use id if available, otherwise generate a temporary id
          const tileId = tiles[tilesIndex].id || `temp_${tilesIndex}_${Date.now()}`;
          order[i][j] = tileId;
        } else {
          order[i][j] = null;
        }
        tilesIndex++;
      }
    }
    return order;
  };

  handleTileEditorCancel = () => {
    this.setState({ tileEditorOpen: false });
  };

  handleEditTileEditorSubmit = tiles => {
    const { board, editTiles, userData } = this.props;
    this.updateIfFeaturedBoard(board);
    editTiles(tiles, board.id);

    // Loggedin user?
    if ('name' in userData && 'email' in userData) {
      this.handleApiUpdates(null, null, tiles);
    }
    this.toggleSelectMode();
  };

  handleAddTileEditorSubmit = async tile => {
    const {
      userData,
      createTile,
      board,
      createBoard,
      switchBoard,
      addBoardCommunicator,
      history
    } = this.props;
    
    // IMPORTANT: In profile-centric architecture (board = profile),
    // folders are part of the same profile, not separate boards
    const currentBoardIdStr = String(board.id || '');
    const isNumericCurrentId = /^\d+$/.test(currentBoardIdStr);
    
    // IMPORTANT: User requirements - new folders should create new profiles
    // When a folder is created, it should get its own profile ID
    // The folder will be saved with this profile ID, and clicking it will open that profile
    if (tile.loadBoard && !tile.linkedBoard && isNumericCurrentId) {
      // Current board is a user profile - new folder should create a new profile
      const loadBoardIdStr = String(tile.loadBoard || '');
      const isNumericLoadBoard = /^\d+$/.test(loadBoardIdStr);
      
      if (!isNumericLoadBoard) {
        // loadBoard is a random ID (shortid) - this is a NEW folder
        // Create a new profile for this folder
        // The profile will be created in handleApiUpdates when saving
        // For now, just prepare the folder data
        console.log('[handleAddTileEditorSubmit] New folder in profile, will create new profile on save');
        // The loadBoard will be updated to the new profile ID after creation
      } else {
        // loadBoard is numeric - it's pointing to an existing profile
        // This means the folder is linked to an existing board/profile
        // No need to create a new board, it's already linked
        console.log('[handleAddTileEditorSubmit] Folder linked to existing profile:', loadBoardIdStr);
      }
    } else if (tile.loadBoard && !tile.linkedBoard && !isNumericCurrentId) {
      // Current board is a template/root board - create new child board (legacy behavior)
      const boardData = {
        id: tile.loadBoard,
        name: tile.label,
        nameKey: tile.labelKey,
        hidden: false,
        tiles: [],
        isPublic: false,
        email: userData.email ? userData.email : board.email,
        author: userData.name ? userData.name : board.author
      };
      createBoard(boardData);
      //TODO use verifyAndUpsertCommunicator before addBoardCommunicator
      addBoardCommunicator(boardData.id);
    }

    if (tile.type !== 'board') {
      this.updateIfFeaturedBoard(board);
      createTile(tile, board.id);
    }

    // Loggedin user?
    if ('name' in userData && 'email' in userData) {
      await this.handleApiUpdates(tile); // this function could mutate tthe tile
      return;
    }

    //if not and is adding an emptyBoard
    if (tile.type === 'board' && tile.loadBoard) {
      switchBoard(tile.loadBoard);
      history.replace(`/profile/${tile.loadBoard}`, []);
    }
  };

  updateIfFeaturedBoard = board => {
    const { userData, updateBoard, intl, lang } = this.props;
    let boardData = {
      ...board
    };
    if (
      'name' in userData &&
      'email' in userData &&
      board.email !== userData.email
    ) {
      boardData = {
        ...boardData,
        name:
          board.name ||
          this.nameFromKey(board) ||
          intl.formatMessage(messages.myBoardTitle),
        author: userData.name,
        email: userData.email,
        hidden: false,
        isPublic: false,
        locale: lang
      };
      updateBoard(boardData);
    }
    return boardData;
  };

  nameFromKey = board => {
    let nameFromKey = undefined;
    if (board.nameKey) {
      const nameKeyArray = board.nameKey.split('.');
      nameFromKey = nameKeyArray[nameKeyArray.length - 1];
    }
    return nameFromKey;
  };

  handleAddClick = () => {
    this.setState({
      tileEditorOpen: true,
      selectedTileIds: [],
      isSelecting: false
    });
  };

  handleAddRemoveRow = async (isAdd, isLeftOrTop) => {
    const { board, updateBoard } = this.props;
    if ((!isAdd && board.grid.rows > 1) || (isAdd && board.grid.rows < 12)) {
      let newOrder = [];
      const newRows = isAdd ? board.grid.rows + 1 : board.grid.rows - 1;
      if (Array.isArray(board.grid.order) && board.grid.order.length) {
        newOrder = resize(
          board.grid.order,
          [newRows, board.grid.columns],
          null
        );
      } else {
        newOrder = this.getDefaultOrdering(board.tiles);
      }
      const tilesForNewOrder = getTilesListForNewOrder({
        tileItems: board.tiles,
        order: newOrder
      });

      const newBoard = {
        ...board,
        tiles: tilesForNewOrder,
        grid: {
          ...board.grid,
          rows: newRows,
          order: newOrder
        }
      };
      const processedBoard = this.updateIfFeaturedBoard(newBoard);
      updateBoard(processedBoard);
      this.saveApiBoardOperation(processedBoard);
    }
  };

  handleAddRemoveColumn = async (isAdd, isLeftOrTop) => {
    const { board, updateBoard } = this.props;
    if (
      (!isAdd && board.grid.columns > 1) ||
      (isAdd && board.grid.columns < 12)
    ) {
      let newOrder = [];
      const newColumns = isAdd
        ? board.grid.columns + 1
        : board.grid.columns - 1;
      if (Array.isArray(board.grid.order) && board.grid.order.length) {
        newOrder = resize(
          board.grid.order,
          [board.grid.rows, newColumns],
          null
        );
      } else {
        newOrder = this.getDefaultOrdering(board.tiles);
      }
      const tilesForNewOrder = getTilesListForNewOrder({
        tileItems: board.tiles,
        order: newOrder
      });
      const newBoard = {
        ...board,
        tiles: tilesForNewOrder,
        grid: {
          ...board.grid,
          columns: newColumns,
          order: newOrder
        }
      };
      const processedBoard = this.updateIfFeaturedBoard(newBoard);
      updateBoard(processedBoard);
      this.saveApiBoardOperation(processedBoard);
    }
  };

  handleLayoutChange = (currentLayout, layouts) => {
    const { updateBoard, replaceBoard, board, navigationSettings } = this.props;
    currentLayout.sort((a, b) => {
      if (a.y === b.y) {
        return a.x - b.x;
      } else if (a.y > b.y) {
        return 1;
      }
      return -1;
    });

    const tilesIds = currentLayout.map(gridTile => gridTile.i);
    const tiles = tilesIds.map(t => {
      return board.tiles.find(tile => {
        if (!tile) {
          return false;
        }
        return tile.id === t || Number(tile.id) === Number(t);
      });
    });

    if (navigationSettings.bigScrollButtonsActive) {
      const cols =
        currentLayout.reduce(function(valorAnterior, item) {
          if (item.x > valorAnterior) return item.x;
          return valorAnterior;
        }, 0) + 1;
      const rows = 3;
      const isScroll = currentLayout.length / cols > rows ? true : false;
      const totalRows = Math.ceil(currentLayout.length / cols);
      this.setIsScroll(isScroll, totalRows);
    }

    const newBoard = { ...board, tiles };
    replaceBoard(board, newBoard);
    if (!isEqual(board.tiles, tiles)) {
      const processedBoard = this.updateIfFeaturedBoard(newBoard);
      updateBoard(processedBoard);
      this.saveApiBoardOperation(processedBoard);
    }
  };

  setIsScroll = (bool, totalRows = 0) => {
    this.setState({ isScroll: bool, totalRows: totalRows });
  };

  handleTileDrop = async (tile, position) => {
    const { board, updateBoard } = this.props;
    const newOrder = moveOrderItem(tile.id, position, board.grid.order);

    const newBoard = {
      ...board,
      grid: {
        ...board.grid,
        order: newOrder
      }
    };
    const processedBoard = this.updateIfFeaturedBoard(newBoard);
    updateBoard(processedBoard);
    this.saveApiBoardOperation(processedBoard);
  };

  handleLockClick = () => {
    this.setState((state, props) => ({
      isLocked: !state.isLocked,
      isSaving: false,
      isSelecting: false,
      selectedTileIds: []
    }));
  };

  handleSelectClick = () => {
    this.toggleSelectMode();
  };

  handleSelectAllToggle = () => {
    if (this.state.isSelectAll) {
      this.setState({ selectedTileIds: [] });
    } else {
      this.selectAllTiles();
    }

    this.setState(prevState => ({
      isSelectAll: !prevState.isSelectAll
    }));
  };

  handleTileClick = async clickedTile => {
    const tile = {
      ...clickedTile,
      label: resolveTileLabel(clickedTile, this.props.intl)
    };
    if (this.state.isSelecting) {
      this.toggleTileSelect(tile.id);
      return;
    }

    const {
      changeBoard,
      changeOutput,
      clickSymbol,
      speak,
      intl,
      boards,
      board,
      showNotification,
      navigationSettings,
      isLiveMode
    } = this.props;
    const hasAction = tile.action && tile.action.startsWith('+');

    const say = () => {
      if (tile.sound) {
        this.playAudio(tile.sound);
      } else {
        const toSpeak = !hasAction ? tile.vocalization || tile.label : null;
        if (toSpeak) {
          speak(toSpeak);
        }
      }
    };

    if (tile.loadBoard) {
      // In profile-centric architecture, folders are part of the same profile
      // If loadBoard is the same as current board.id (profile ID), it's a folder within the profile
      const currentBoardIdStr = String(board.id || '');
      const loadBoardIdStr = String(tile.loadBoard || '');
      const isNumericCurrentId = /^\d+$/.test(currentBoardIdStr);
      
      // If both are numeric and same, it's a folder in the same profile
      if (isNumericCurrentId && currentBoardIdStr === loadBoardIdStr) {
        // This is a folder tile pointing to the same profile - should not happen
        // But if it does, treat it as a regular tile (no navigation)
        console.warn('[handleTileClick] Folder tile points to same profile, treating as regular tile');
        clickSymbol(tile.label);
        if (!navigationSettings.quietBuilderMode) {
          say();
        }
        return;
      }
      
      // Try to find board in local boards list
      let nextBoard = boards.find(b => String(b.id) === loadBoardIdStr) ||
        // If the board id is invalid, try falling back to a board with the right name
        boards.find(b => b.name === tile.label);
      
      // If not found locally, try to fetch from API (for newly created folders)
      if (!nextBoard && loadBoardIdStr) {
        try {
          console.log('[handleTileClick] Board not found locally, fetching from API:', loadBoardIdStr);
          const { API } = require('../../api/api');
          const fetchedBoard = await API.getBoard(loadBoardIdStr);
          if (fetchedBoard) {
            // Add fetched board to boards list
            this.props.addBoards([fetchedBoard]);
            nextBoard = fetchedBoard;
          }
        } catch (err) {
          console.error('[handleTileClick] Error fetching board from API:', err);
          // If it's a profile ID (numeric), it might be a folder within the same profile
          // In profile-centric architecture, folders don't create separate boards
          if (isNumericCurrentId && /^\d+$/.test(loadBoardIdStr)) {
            console.log('[handleTileClick] loadBoard is a profile ID, treating as folder in same profile');
            // Don't navigate, just treat as regular tile
            clickSymbol(tile.label);
            if (!navigationSettings.quietBuilderMode) {
              say();
            }
            return;
          }
        }
      }
      
      if (nextBoard) {
        changeBoard(nextBoard.id);
        this.props.history.push(`/profile/${nextBoard.id}`);
        if (navigationSettings.vocalizeFolders) {
          say();
        }
      } else {
        // If loadBoard is a numeric ID (profile ID) and current board is also a profile
        // This might be a folder that should be part of the same profile
        if (isNumericCurrentId && /^\d+$/.test(loadBoardIdStr)) {
          console.log('[handleTileClick] Folder with profile ID, treating as regular tile');
          clickSymbol(tile.label);
          if (!navigationSettings.quietBuilderMode) {
            say();
          }
        } else {
          showNotification(intl.formatMessage(messages.boardMissed));
        }
      }
    } else {
      clickSymbol(tile.label);
      if (!navigationSettings.quietBuilderMode) {
        say();
      }
      if (isLiveMode) {
        const liveTile = {
          backgroundColor: 'rgb(255, 241, 118)',
          id: shortid.generate(),
          image: '',
          label: '',
          labelKey: '',
          type: 'live'
        };
        changeOutput([...this.props.output, tile, liveTile]);
      } else {
        changeOutput([...this.props.output, tile]);
      }
    }
  };

  handleAddTile = (tile, boardId) => {
    const { intl, createTile, showNotification } = this.props;
    createTile(tile, boardId);
    showNotification(intl.formatMessage(messages.tilesCreated));
  };

  handleDeleteClick = () => {
    const { intl, deleteTiles, showNotification, board, userData } = this.props;
    this.updateIfFeaturedBoard(board);
    deleteTiles(this.state.selectedTileIds, board.id);

    // Loggedin user?
    if ('name' in userData && 'email' in userData) {
      this.handleApiUpdates(null, this.state.selectedTileIds, null);
    }

    this.setState({
      selectedTileIds: []
    });
    showNotification(intl.formatMessage(messages.tilesDeleted));
    this.toggleSelectMode();
  };

  handleLockNotify = countdown => {
    const { intl, showNotification, hideNotification } = this.props;
    const quickUnlockActive = this.props.navigationSettings?.quickUnlockActive;

    if (quickUnlockActive) {
      hideNotification();
      this.handleLockClick();
      return;
    }
    if (countdown > 3) {
      return;
    }

    if (!countdown) {
      hideNotification();
      return;
    }

    const clicksToUnlock = `${countdown} ${intl.formatMessage(
      messages.clicksToUnlock
    )}`;

    hideNotification();
    // HACK: refactor Notification container
    setTimeout(() => {
      showNotification(clicksToUnlock);
    });
  };

  handleScannerStrategyNotification = () => {
    const {
      scannerSettings,
      showNotification,
      intl
    } = this.props;
    
    // Safely get strategy with fallback to automatic
    const strategy = scannerSettings?.strategy || SCANNING_METHOD_AUTOMATIC;
    
    const messagesKeyMap = {
      [SCANNING_METHOD_MANUAL]: messages.scannerManualStrategy,
      [SCANNING_METHOD_AUTOMATIC]: messages.scannerAutomaticStrategy,
      // When using eye-tracking driven scanning, reuse the manual strategy message
      eye_tracking: messages.scannerManualStrategy
    };

    const messageDescriptor = messagesKeyMap[strategy];
    if (messageDescriptor) {
      showNotification(intl.formatMessage(messageDescriptor));
    } else {
      // Fallback to automatic strategy message if strategy is unknown
      console.warn('[BoardContainer] Unknown scanning strategy:', strategy, 'falling back to automatic');
      showNotification(intl.formatMessage(messages.scannerAutomaticStrategy));
    }

    if (!isMobile.any) {
      setTimeout(() => {
        showNotification(intl.formatMessage(messages.scannerHowToDeactivate));
      }, NOTIFICATION_DELAY);
    }

    // Refresh audio guide settings when scanner becomes active
    this.loadAccessibilityAudioGuide().catch(error => {
      console.debug('[BoardContainer] Failed to refresh audio guide settings on scanner activation:', error.message || error);
    });
  };

  async uploadTileSound(tile) {
    if (tile && tile.sound && tile.sound.startsWith('data')) {
      const { userData } = this.props;
      try {
        var blob = new Blob([this.convertDataURIToBinary(tile.sound)], {
          type: 'audio/mp3; codecs=opus'
        });
        const audioUrl = await API.uploadFile(blob, userData.email + '.mp3');
        tile.sound = audioUrl;
      } catch (err) {
        console.log(err.message);
      }
    }
    return tile;
  }

  convertDataURIToBinary(dataURI) {
    var BASE64_MARKER = ';base64,';
    var base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
    var base64 = dataURI.substring(base64Index);
    var raw = window.atob(base64);
    var rawLength = raw.length;
    var array = new Uint8Array(new ArrayBuffer(rawLength));

    for (let i = 0; i < rawLength; i++) {
      array[i] = raw.charCodeAt(i);
    }
    return array;
  }

  handleApiUpdates = async (
    tile = null,
    deletedTilesiIds = null,
    editedTiles = null,
    processedBoard = null
  ) => {
    const {
      userData,
      communicator,
      board,
      intl,
      verifyAndUpsertCommunicator,
      updateApiObjectsNoChild,
      updateApiObjects,
      replaceBoard,
      updateBoard,
      switchBoard,
      lang
    } = this.props;
    // Loggedin user?
    if ('name' in userData && 'email' in userData) {
      this.setState({
        isSaving: true
      });

      if (tile && tile.sound && tile.sound.startsWith('data')) {
        tile = await this.uploadTileSound(tile);
      }
      if (editedTiles) {
        let _editedTiles = [];
        for (let _tile of editedTiles) {
          _editedTiles.push(await this.uploadTileSound(_tile));
        }
        editedTiles = _editedTiles;
      }

      var createParentBoard = false;
      var createChildBoard = false;
      var childBoardData = null;

      // Ensure board.tiles is an array
      const boardTiles = Array.isArray(board.tiles) ? board.tiles : [];
      
      let uTiles = [];
      if (deletedTilesiIds) {
        uTiles = boardTiles.filter(
          cTile => cTile && cTile.id && !deletedTilesiIds.includes(cTile.id)
        );
      } else if (editedTiles) {
        // IMPORTANT: Check if any edited tile is a default Cboard tile (non-numeric ID)
        // If so, we need to create a new profile for the modified folder/card
        const processedEditedTiles = [];
        for (const editedTile of editedTiles) {
          if (!editedTile || !editedTile.id) {
            processedEditedTiles.push(editedTile);
            continue;
          }
          
          const originalTile = boardTiles.find(t => t && t.id === editedTile.id);
          if (!originalTile) {
            processedEditedTiles.push(editedTile);
            continue;
          }
          
          const tileIdStr = String(editedTile.id || '');
          const isDefaultTile = !/^\d+$/.test(tileIdStr) && tileIdStr.length < SHORT_ID_MAX_LENGTH && tileIdStr !== 'root';
          
          // If this is a default Cboard tile (non-numeric ID) and it's a folder that was modified
          if (isDefaultTile && editedTile.loadBoard && !editedTile.linkedBoard) {
            // Modified default folder - will create new profile for it
            // The loadBoard will be updated after profile creation
            console.log('[handleApiUpdates] Modified default folder detected:', {
              originalId: editedTile.id,
              label: editedTile.label,
              loadBoard: editedTile.loadBoard
            });
          }
          
          processedEditedTiles.push(editedTile);
        }
        
        uTiles = boardTiles.map(
          cTile => {
            if (!cTile || !cTile.id) return cTile;
            return processedEditedTiles.find(s => s && s.id === cTile.id) || cTile;
          }
        );
      } else if (tile && tile.type !== 'board') {
        const existingTile = boardTiles.find(t => t && t.id === tile.id);
        uTiles = existingTile ? [...boardTiles] : [...boardTiles, tile];
      } else if (tile && tile.type === 'board') {
        uTiles = [...boardTiles];
      } else {
        uTiles = [...boardTiles];
      }

      // Filter out null/undefined tiles before saving to prevent corruption
      // IMPORTANT: Allow tiles without id (newly created tiles) but ensure they have essential data
      const validTiles = (uTiles || []).filter(tile => {
        if (!tile || typeof tile !== 'object') return false;
        // Allow tiles without id if they have label/image/loadBoard (newly created tiles)
        if (!tile.id) {
          return !!(tile.label || tile.image || tile.loadBoard);
        }
        return true;
      });
      
      // If processedBoard exists, ensure its tiles are also filtered
      let finalProcessedBoard = processedBoard;
      if (processedBoard && processedBoard.tiles) {
        finalProcessedBoard = {
          ...processedBoard,
          tiles: Array.isArray(processedBoard.tiles) 
            ? processedBoard.tiles.filter(t => t !== null && t !== undefined && typeof t === 'object' && t.id)
            : []
        };
      }
      
      // Ensure grid.order is included for proper position tracking
      // Use existing grid.order if available, otherwise build from tiles
      const gridOrder = board.grid?.order || this.getDefaultOrdering(validTiles, board.grid);
      
      let parentBoardData = finalProcessedBoard
        ? {
            ...finalProcessedBoard,
            grid: finalProcessedBoard.grid || {
              ...board.grid,
              order: gridOrder
            }
          }
        : {
            ...board,
            name:
              board.name ||
              this.nameFromKey(board) ||
              intl.formatMessage(messages.myBoardTitle),
            tiles: validTiles,
            grid: {
              ...board.grid,
              rows: board.grid?.rows || 4,
              columns: board.grid?.columns || 6,
              order: gridOrder
            },
            author: userData.name,
            email: userData.email,
            hidden: false,
            locale: lang
          };
      //check if user has an own communicator
      if (communicator.email !== userData.email) {
        verifyAndUpsertCommunicator(communicator);
      }
      //check if we have to create a copy of the parent
      const parentIdStr = String(parentBoardData.id || '');
      const isNumericParentId = /^\d+$/.test(parentIdStr);
      
      // IMPORTANT: User requirements:
      // 1. Default Cboard (non-numeric ID) is read-only, for initialization
      // 2. First change creates new user profile (numeric ID)
      // 3. Modifications to default folders/cards create new profiles and replace them
      // 4. Modifications within user profile update the same profile
      
      const currentBoardIdStr = String(board.id || '');
      const isNumericCurrentBoardId = /^\d+$/.test(currentBoardIdStr);
      const isDefaultCboard = !isNumericCurrentBoardId && currentBoardIdStr.length < SHORT_ID_MAX_LENGTH && currentBoardIdStr !== 'root';
      
      // Check if this is the first change (default Cboard being modified)
      if (isDefaultCboard) {
        // First change - will create new user profile
        // Don't override parentBoardData.id yet, let it create new profile
        console.log('[handleApiUpdates] First change detected - default Cboard being modified, will create new user profile');
      } else if (isNumericCurrentBoardId) {
        // Current board is a user profile (numeric ID) - all edits should update this profile
        // Override parentBoardData.id to use the profile ID
        parentBoardData = {
          ...parentBoardData,
          id: currentBoardIdStr, // Use profile ID (board = profile)
          profileId: currentBoardIdStr // Also set profileId for API
        };
        console.log('[handleApiUpdates] Board = Profile: Using profile ID for all updates:', currentBoardIdStr);
      }
      
      // Re-check parent ID after potential update
      const updatedParentIdStr = String(parentBoardData.id || '');
      const updatedIsNumericParentId = /^\d+$/.test(updatedParentIdStr);
      const updatedIsDefaultCboard = !updatedIsNumericParentId && updatedParentIdStr.length < SHORT_ID_MAX_LENGTH && updatedParentIdStr !== 'root';
      
      //check for a new own board
      // IMPORTANT: User requirements - new folders should create new profiles
      // When a folder is created, it should get its own profile ID
      // The folder will be saved with this profile ID, and clicking it will open that profile
      if (tile && tile.loadBoard && !tile.linkedBoard) {
        const loadBoardIdStr = String(tile.loadBoard || '');
        const isNumericLoadBoard = /^\d+$/.test(loadBoardIdStr);
        
        if (!updatedIsNumericParentId) {
          // Parent is a template/root board, create new child board (legacy behavior)
          const boardData = {
            id: tile.loadBoard,
            name: tile.label,
            nameKey: tile.labelKey,
            hidden: false,
            tiles: [],
            isPublic: false,
            author: userData.name,
            email: userData.email,
            locale: lang,
            caption: tile.image
          };
          childBoardData = { ...boardData };
          createChildBoard = true;
          updateBoard(childBoardData);
        } else if (!isNumericLoadBoard) {
          // Parent is a profile AND loadBoard is a random shortid (new folder)
          // Create a new profile for this folder
          // This profile will appear in "All My Boards" and can be opened
          const folderBoardData = {
            id: tile.loadBoard, // Temporary ID, will be replaced with actual profile ID
            name: tile.label || 'New Folder',
            nameKey: tile.labelKey,
            hidden: false,
            tiles: [], // Empty folder, user can add content later
            isPublic: false,
            author: userData.name,
            email: userData.email,
            locale: lang,
            caption: tile.image
          };
          childBoardData = { ...folderBoardData };
          createChildBoard = true;
          updateBoard(childBoardData);
          console.log('[handleApiUpdates] New folder in profile, will create new profile:', tile.label);
        } else {
          // Parent is a profile AND loadBoard is numeric (existing profile)
          // Folder is linked to an existing profile, no need to create new one
          console.log('[handleApiUpdates] Folder linked to existing profile:', loadBoardIdStr);
        }
      }

      // IMPORTANT: User requirements logic:
      // 1. Default Cboard (non-numeric ID) → First change creates new user profile
      // 2. User profile (numeric ID) → Updates same profile
      // 3. Modified default folders/cards → Create new profiles, replace in same position
      
      if (updatedIsDefaultCboard) {
        // Parent is default Cboard (non-numeric ID) - FIRST CHANGE: create new user profile
        createParentBoard = true;
        parentBoardData = {
          ...parentBoardData,
          isPublic: false
        };
        console.log('[handleApiUpdates] Creating new user profile from default Cboard');
      } else if (updatedIsNumericParentId) {
        // Parent is an existing user profile (numeric ID) - UPDATE, do NOT create new profile
        createParentBoard = false; // Explicitly set to false for existing profiles
        //update the parent (which is the profile in profile-centric architecture)
        updateBoard(parentBoardData);
        console.log('[handleApiUpdates] Updating existing user profile:', updatedParentIdStr);
      } else {
        // Fallback: update the parent
        updateBoard(parentBoardData);
      }
      
      // Handle modified default folders/cards - create new profiles for them
      // This happens AFTER the main board is saved, so we can update tile references
      if (editedTiles && updatedIsNumericParentId) {
        // We're editing within a user profile
        // Check if any edited tiles are default Cboard tiles that need new profiles
        for (const editedTile of editedTiles) {
          if (!editedTile || !editedTile.id) continue;
          
          const tileIdStr = String(editedTile.id || '');
          const isDefaultTile = !/^\d+$/.test(tileIdStr) && tileIdStr.length < SHORT_ID_MAX_LENGTH && tileIdStr !== 'root';
          
          // If this is a modified default folder, create new profile for it
          if (isDefaultTile && editedTile.loadBoard && !editedTile.linkedBoard) {
            console.log('[handleApiUpdates] Modified default folder detected, will create new profile after main board save:', {
              originalId: editedTile.id,
              label: editedTile.label
            });
            // Note: The actual profile creation for modified folders will be handled
            // after the main board is saved, in the success callback
            // We'll need to create the profile and update the tile reference
          }
        }
      }
      // Untill here all is with shorts ids
      //api updates
      if (tile && tile.type === 'board') {
        //child becomes parent
        updateApiObjectsNoChild(childBoardData, true)
          .then(parentBoardId => {
            switchBoard(parentBoardId);
            this.props.history.replace(`/profile/${parentBoardId}`, []);
            this.setState({ isSaving: false });
          })
          .catch(e => {
            this.setState({ isSaving: false });
          });
      } else {
        if (!createChildBoard) {
          // Add debug logging
          console.log('handleApiUpdates - Saving board:', {
            boardId: parentBoardData.id,
            boardName: parentBoardData.name,
            tilesCount: parentBoardData.tiles?.length || 0,
            createParentBoard,
            userEmail: userData.email
          });
          
          // Store modified default folders before saving (for post-save processing)
          const modifiedDefaultFolders = [];
          if (editedTiles && updatedIsNumericParentId) {
            for (const editedTile of editedTiles) {
              if (!editedTile || !editedTile.id) continue;
              const tileIdStr = String(editedTile.id || '');
              const isDefaultTile = !/^\d+$/.test(tileIdStr) && tileIdStr.length < SHORT_ID_MAX_LENGTH && tileIdStr !== 'root';
              if (isDefaultTile && editedTile.loadBoard && !editedTile.linkedBoard) {
                modifiedDefaultFolders.push(editedTile);
              }
            }
          }
          
          updateApiObjectsNoChild(parentBoardData, createParentBoard)
            .then(async parentBoardId => {
              // Check if component is still mounted before updating state
              if (!this._isMounted) {
                console.log('[handleApiUpdates] Component unmounted, skipping state update');
                return;
              }
              
              console.log('handleApiUpdates - Board saved successfully:', {
                originalId: parentBoardData.id,
                newId: parentBoardId,
                tilesCount: parentBoardData.tiles?.length || 0,
                createParentBoard,
                isProfile: updatedIsNumericParentId,
                modifiedDefaultFoldersCount: modifiedDefaultFolders.length
              });
              
              // IMPORTANT: In profile-centric architecture (board = profile),
              // if we're updating an existing profile (numeric ID), do NOT replace the board
              // because it's the same profile, just updated. Only replace if we created a NEW profile.
              if (createParentBoard && !updatedIsNumericParentId) {
                // Only replace board if we created a new one (non-numeric ID → numeric ID)
                // This happens when saving a template/root board for the first time
                const newIdStr = String(parentBoardId || '');
                const isNumericNewId = /^\d+$/.test(newIdStr);
                if (isNumericNewId) {
                  // New profile was created, replace the board
                  replaceBoard(
                    { ...parentBoardData },
                    { ...parentBoardData, id: parentBoardId }
                  );
                }
              }
              
              // Handle modified default folders - create new profiles for them
              if (modifiedDefaultFolders.length > 0 && updatedIsNumericParentId && this._isMounted) {
                console.log('[handleApiUpdates] Processing modified default folders:', modifiedDefaultFolders.length);
                
                // Get the updated board to modify tile references
                let updatedBoard = { ...parentBoardData, id: parentBoardId };
                try {
                  const { API } = require('../../api/api');
                  const fetchedBoard = await API.getBoard(parentBoardId);
                  if (fetchedBoard && this._isMounted) {
                    updatedBoard = fetchedBoard;
                  }
                } catch (err) {
                  console.error('[handleApiUpdates] Error fetching updated board:', err);
                }
                
                // Check again if component is still mounted before processing folders
                if (!this._isMounted) {
                  console.log('[handleApiUpdates] Component unmounted during folder processing, aborting');
                  return;
                }
                
                // Create new profiles for each modified default folder
                const { API } = require('../../api/api');
                
                for (const modifiedFolder of modifiedDefaultFolders) {
                  // Check if component is still mounted before each iteration
                  if (!this._isMounted) {
                    console.log('[handleApiUpdates] Component unmounted, stopping folder processing');
                    break;
                  }
                  
                  try {
                    // Create a new profile for the modified folder
                    // The folder content should be loaded from the default Cboard's loadBoard
                    const folderBoardData = {
                      id: modifiedFolder.loadBoard, // Original folder ID from default Cboard
                      name: modifiedFolder.label || 'Modified Folder',
                      tiles: [], // Will be populated from default Cboard if needed
                      isPublic: false,
                      author: userData.name,
                      email: userData.email,
                      locale: lang
                    };
                    
                    // Try to load the original folder content from default Cboard
                    try {
                      const originalFolderBoard = await API.getBoard(modifiedFolder.loadBoard);
                      if (originalFolderBoard && originalFolderBoard.tiles && this._isMounted) {
                        folderBoardData.tiles = originalFolderBoard.tiles;
                      }
                    } catch (err) {
                      console.warn('[handleApiUpdates] Could not load original folder content:', modifiedFolder.loadBoard);
                      // Continue with empty tiles - user can add content later
                    }
                    
                    // Check again before creating profile
                    if (!this._isMounted) {
                      console.log('[handleApiUpdates] Component unmounted before creating folder profile');
                      break;
                    }
                    
                    // Create new profile for the folder using API.createBoard
                    const createdFolderBoard = await API.createBoard(folderBoardData);
                    const newFolderProfileId = createdFolderBoard.id;
                    console.log('[handleApiUpdates] Created new profile for modified folder:', {
                      originalId: modifiedFolder.id,
                      newProfileId: newFolderProfileId,
                      label: modifiedFolder.label
                    });
                    
                    // Check again before updating board
                    if (!this._isMounted) {
                      console.log('[handleApiUpdates] Component unmounted before updating board');
                      break;
                    }
                    
                    // Update the main board's tile to reference the new profile ID
                    const updatedTiles = (updatedBoard.tiles || []).map(tile => {
                      if (tile && tile.id === modifiedFolder.id) {
                        return {
                          ...tile,
                          id: modifiedFolder.id, // Keep original ID for reference
                          loadBoard: String(newFolderProfileId) // Update to new profile ID
                        };
                      }
                      return tile;
                    });
                    
                    // Save the updated board with new folder reference
                    const updatedBoardData = {
                      ...updatedBoard,
                      tiles: updatedTiles,
                      profileId: parentBoardId
                    };
                    
                    await API.updateBoard(updatedBoardData);
                    console.log('[handleApiUpdates] Updated main board with new folder profile reference');
                    
                    // Check again before updating Redux state
                    if (this._isMounted) {
                      // Refresh the board in Redux state
                      this.props.updateBoard(updatedBoardData);
                    }
                  } catch (err) {
                    console.error('[handleApiUpdates] Error creating profile for modified folder:', err);
                  }
                }
              }
              
              // Check if component is still mounted before final state update
              if (!this._isMounted) {
                console.log('[handleApiUpdates] Component unmounted, skipping final state update');
                return;
              }
              
              // For existing profiles (numeric ID), parentBoardId should be the same as parentBoardData.id
              // No need to replace board - it's the same profile, just updated
              this.historyReplaceBoardId(parentBoardId);
              this.setState({ isSaving: false });
            })
            .catch(e => {
              // Check if component is still mounted before updating state on error
              if (this._isMounted) {
                console.error('handleApiUpdates - Error saving board:', e);
                this.setState({ isSaving: false });
              } else {
                console.log('[handleApiUpdates] Component unmounted, skipping error state update');
              }
            })
            .catch(e => {
              console.error('handleApiUpdates - Error saving board:', e);
              this.setState({ isSaving: false });
            });
        } else {
          // createChildBoard is true - we're creating a new profile for a folder
          // updateApiObjects will:
          // 1. Create the child profile (folder)
          // 2. Update the parent board's tile to reference the new profile ID
          // 3. Return the parent board ID
          updateApiObjects(childBoardData, parentBoardData, createParentBoard)
            .then(parentBoardId => {
              if (!this._isMounted) {
                console.log('[handleApiUpdates] Component unmounted, skipping state update');
                return;
              }
              
              // updateApiObjects already updated the parent board's tile.loadBoard
              // to reference the new child profile ID, so we don't need to do it here
              
              if (createParentBoard) {
                /* Here the parentBoardData is not updated with the values
                that updatedApiObjects store on the API. Inside the boards are already updated
                an the value is not replaced because the oldboard Id was replaced on the updateApiObjects inside createApiBoardSuccess */
                replaceBoard(
                  { ...parentBoardData },
                  { ...parentBoardData, id: parentBoardId }
                );
              }
              this.historyReplaceBoardId(parentBoardId);
              this.setState({ isSaving: false });
            })
            .catch(e => {
              if (this._isMounted) {
                console.error('[handleApiUpdates] Error saving board with folder:', e);
                this.setState({ isSaving: false });
              }
            });
        }
      }
    }
  };

  historyReplaceBoardId(boardId) {
    this.props.history.replace(`/profile/${boardId}`);
  }

  handleSwitchBoard = (boardId) => {
    const { switchBoard, history } = this.props;
    if (boardId) {
      switchBoard(boardId);
      history.replace(`/profile/${boardId}`);
    }
  };

  onRequestPreviousBoard = () => {
    this.props.previousBoard();
    this.scrollToTop();
  };

  onRequestToRootBoard = () => {
    this.props.toRootBoard();
    this.scrollToTop();
  };

  scrollToTop = () => {
    if (this.boardRef && !this.state.isSelecting) {
      const boardComponentRef = this.props.board.isFixed
        ? 'fixedBoardContainerRef'
        : 'boardContainerRef';
      this.boardRef.current[boardComponentRef].current.scrollTop = 0;
    }
  };

  handleCopyRemoteBoard = async () => {
    const { intl, showNotification, history, switchBoard } = this.props;
    try {
      this.setState({
        isSaving: true
      });
      const copiedBoard = await this.createBoardsRecursively(
        this.state.copyPublicBoard
      );
      if (!copiedBoard?.id) {
        throw new Error('Board not copied correctly');
      }
      switchBoard(copiedBoard.id);
      history.replace(`/profile/${copiedBoard.id}`, []);
      this.setState({
        copyPublicBoard: false,
        blockedPrivateBoard: false
      });
      showNotification(intl.formatMessage(messages.boardCopiedSuccessfully));
    } catch (err) {
      console.log(err.message);
      showNotification(intl.formatMessage(messages.boardCopyError));
      this.handleCloseDialog();
    }
    this.setState({
      isSaving: false
    });
  };

  async createBoardsRecursively(board, records) {
    const {
      createBoard,
      addBoardCommunicator,
      communicator,
      userData,
      updateApiObjectsNoChild,
      boards,
      intl,
      verifyAndUpsertCommunicator
    } = this.props;

    //prevent shit
    if (!board) {
      return null;
    }
    if (records) {
      //get the list of next boards in records
      let nextBoardsRecords = records.map(entry => entry.next);
      if (nextBoardsRecords.includes(board.id)) {
        return null;
      }
    }

    let newBoard = {
      ...board,
      isPublic: false,
      id: shortid.generate(),
      hidden: false,
      author: '',
      email: ''
    };
    if (!newBoard.name) {
      newBoard.name = newBoard.nameKey
        ? intl.formatMessage({ id: newBoard.nameKey })
        : intl.formatMessage(messages.noTitle);
    }
    if ('name' in userData && 'email' in userData) {
      newBoard = {
        ...newBoard,
        author: userData.name,
        email: userData.email
      };
    }
    createBoard(newBoard);
    if (!records) {
      verifyAndUpsertCommunicator(communicator);
      addBoardCommunicator(newBoard.id);
    }

    if (!records) {
      records = [{ prev: board.id, next: newBoard.id }];
    } else {
      records.push({ prev: board.id, next: newBoard.id });
    }
    this.updateBoardReferences(board, newBoard, records);

    // Loggedin user?
    if ('name' in userData && 'email' in userData) {
      try {
        const boardId = await updateApiObjectsNoChild(newBoard, true);
        newBoard = {
          ...newBoard,
          id: boardId
        };
      } catch (err) {
        console.log(err.message);
      }
    }

    if (board.tiles.length < 1) {
      return newBoard;
    }

    //return condition
    for (const tile of board.tiles) {
      if (tile.loadBoard && !tile.linkedBoard) {
        try {
          const nextBoard = await API.getBoard(tile.loadBoard);
          await this.createBoardsRecursively(nextBoard, records);
        } catch (err) {
          if (!err.respose || err.response?.status === 404) {
            //look for this board in available boards
            const localBoard = boards.find(b => b.id === tile.loadBoard);
            if (localBoard) {
              await this.createBoardsRecursively(localBoard, records);
            }
          }
        }
      }
    }
    return newBoard;
  }

  updateBoardReferences(board, newBoard, records) {
    const { boards, updateBoard } = this.props;
    //get the list of prev boards in records, but remove the current board
    let prevBoardsRecords = records.map(entry => entry.prev);
    prevBoardsRecords = prevBoardsRecords.filter(id => id !== newBoard.id);
    //look for reference to the original board id
    boards.forEach(b => {
      b.tiles.forEach((tile, index) => {
        if (
          //general case: tile can contains reference to the board
          tile &&
          tile.loadBoard &&
          tile.loadBoard === board.id
        ) {
          b.tiles.splice(index, 1, {
            ...tile,
            loadBoard: newBoard.id
          });
          try {
            updateBoard(b);
          } catch (err) {
            console.log(err.message);
          }
        }
        if (
          //special case: tile can contains reference to a prev board in records!
          tile &&
          tile.loadBoard &&
          prevBoardsRecords.includes(tile.loadBoard)
        ) {
          const el = records.find(e => e.prev === tile.loadBoard);
          b.tiles.splice(index, 1, {
            ...tile,
            loadBoard: el.next
          });
          try {
            updateBoard(b);
          } catch (err) {
            console.log(err.message);
          }
        }
      });
    });
  }

  handleCloseDialog = (event, reason) => {
    const { isSaving } = this.state;
    if (isSaving) return;
    this.setState({
      copyPublicBoard: false,
      blockedPrivateBoard: false,
      isCbuilderBoard: false
    });
  };

  publishBoard = async () => {
    const { board, updateBoard, showNotification, intl } = this.props;
    
    // Check if board has tiles
    const tilesCount = board.tiles?.length || 0;
    const hasTiles = tilesCount > 0;
    
    // Create a minimal board object with ONLY metadata fields for publishing
    // DO NOT include tiles array to prevent accidental deletion of cards
    const newBoard = {
      id: board.id,
      profileId: board.profileId || board.id,
      name: board.name,
      description: board.description,
      isPublic: !board.isPublic,
      layout_type: board.layout_type || board.layoutType,
      language: board.language || board.locale,
      // Explicitly DO NOT include tiles array - backend will preserve existing tiles
      // Only include metadata fields that need to be updated
    };
    
    console.log('[publishBoard] Toggling isPublic (metadata only):', {
      boardId: board.id,
      boardName: board.name,
      currentIsPublic: board.isPublic,
      newIsPublic: newBoard.isPublic,
      tilesCount: tilesCount,
      hasTiles: hasTiles,
      hasTilesInRequest: 'tiles' in newBoard,
      warning: !hasTiles && newBoard.isPublic ? 'Board has no tiles, will not appear in public list' : null
    });
    
    // Warn user if trying to publish empty board
    if (!hasTiles && newBoard.isPublic && showNotification && intl) {
      showNotification(
        intl.formatMessage({
          id: 'cboard.components.BoardShare.emptyBoardWarning',
          defaultMessage: 'Warning: This board has no cards. It will not appear in the Public Boards list until you add cards.'
        }),
        'warning'
      );
    }
    
    // Don't use updateIfFeaturedBoard for metadata-only updates - it might add unwanted fields
    // Just pass the minimal newBoard directly
    // Update Redux state with new isPublic value
    updateBoard({
      ...board,
      isPublic: newBoard.isPublic
    });
    
    try {
      // Use a special method that only updates metadata, not tiles
      // Pass newBoard directly (not processedBoard) to ensure no tiles are included
      await this.updateProfileMetadataOnly(newBoard);
      
      // Show success notification
      if (showNotification && intl) {
        const message = newBoard.isPublic
          ? intl.formatMessage({
              id: 'cboard.components.BoardShare.boardPublished',
              defaultMessage: 'Board published successfully! It will now appear in the Public Boards tab.'
            })
          : intl.formatMessage({
              id: 'cboard.components.BoardShare.boardUnpublished',
              defaultMessage: 'Board unpublished successfully. It will no longer appear in the Public Boards tab.'
            });
        showNotification(message, 'success');
      }
      
      // Trigger event to refresh public boards list if CommunicatorDialog is open
      const eventDetail = { 
        boardId: board.id, 
        boardName: board.name,
        profileId: board.profileId || board.id
      };
      
      if (newBoard.isPublic) {
        console.log('[publishBoard] Dispatching boardPublished event:', eventDetail);
        window.dispatchEvent(new CustomEvent('boardPublished', {
          detail: eventDetail
        }));
      } else {
        console.log('[publishBoard] Dispatching boardUnpublished event:', eventDetail);
        window.dispatchEvent(new CustomEvent('boardUnpublished', {
          detail: eventDetail
        }));
      }
    } catch (err) {
      console.error('[publishBoard] Error publishing board:', err);
      if (showNotification && intl) {
        showNotification(
          intl.formatMessage({
            id: 'cboard.components.BoardShare.publishError',
            defaultMessage: 'Failed to publish board. Please try again.'
          }),
          'error'
        );
      }
    }
  };

  loadProfiles = async () => {
    try {
      const profiles = await API.getProfiles();
      this.setState({ profiles: profiles || [] });
    } catch (error) {
      console.error('Load profiles error:', error);
      this.setState({ profiles: [] });
    }
  };

  handleGenerateQR = async (profileId) => {
    try {
      const response = await API.generateQRCode(profileId, 24);
      const result = response?.data || response;
      if (result?.token) {
        this.props.showNotification(
          this.props.intl.formatMessage({
            id: 'cboard.components.Settings.Transfer.qrGenerated',
            defaultMessage: 'QR code generated successfully'
          }),
          'success'
        );
        return result;
      } else {
        throw new Error(result?.message || 'Failed to generate QR code');
      }
    } catch (error) {
      console.error('Generate QR code error:', error);
      const errorMessage = error.response?.data?.data?.message || 
                          error.response?.data?.message || 
                          error.message ||
                          this.props.intl.formatMessage({
                            id: 'cboard.components.Settings.Transfer.error',
                            defaultMessage: 'An error occurred'
                          });
      this.props.showNotification(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  handleGenerateCloudCode = async (profileId) => {
    try {
      const result = await API.generateCloudCode(profileId, 168);
      this.props.showNotification(
        this.props.intl.formatMessage({
          id: 'cboard.components.Settings.Transfer.cloudCodeGenerated',
          defaultMessage: 'Cloud code generated successfully'
        }),
        'success'
      );
      return result;
    } catch (error) {
      console.error('Generate cloud code error:', error);
      throw new Error(
        error.response?.data?.error ||
          this.props.intl.formatMessage({
            id: 'cboard.components.Settings.Transfer.error',
            defaultMessage: 'An error occurred'
          })
      );
    }
  };

  handleGenerateEmail = async (profileId, email) => {
    try {
      const result = await API.generateEmailTransfer(profileId, email, 168);
      this.props.showNotification(
        this.props.intl.formatMessage({
          id: 'cboard.components.Settings.Transfer.emailSent',
          defaultMessage: 'Profile transfer email sent successfully'
        }),
        'success'
      );
      return result;
    } catch (error) {
      console.error('Generate email transfer error:', error);
      throw new Error(
        error.response?.data?.error ||
          this.props.intl.formatMessage({
            id: 'cboard.components.Settings.Transfer.error',
            defaultMessage: 'An error occurred'
          })
      );
    }
  };

  handleRedeemCode = async (code) => {
    try {
      // Try cloud code first
      try {
        const response = await API.redeemCloudCode(code);
        const result = response?.data || response;
        if (result?.success !== false) {
          this.props.showNotification(
            this.props.intl.formatMessage({
              id: 'cboard.components.Settings.Transfer.profileImported',
              defaultMessage: 'Profile imported successfully'
            }),
            'success'
          );
          // Reload profiles after import
          await this.loadProfiles();
          window.location.reload();
          return result;
        } else {
          throw new Error(result?.message || 'Cloud code redemption failed');
        }
      } catch (cloudError) {
        // If cloud code fails, try QR token
        try {
          const response = await API.redeemQRToken(code);
          const result = response?.data || response;
          if (result?.success !== false) {
            this.props.showNotification(
              this.props.intl.formatMessage({
                id: 'cboard.components.Settings.Transfer.profileImported',
                defaultMessage: 'Profile imported successfully'
              }),
              'success'
            );
            // Reload profiles after import
            await this.loadProfiles();
            window.location.reload();
            return result;
          } else {
            throw new Error(result?.message || 'QR token redemption failed');
          }
        } catch (qrError) {
          throw cloudError;
        }
      }
    } catch (error) {
      console.error('Redeem code error:', error);
      const errorMessage = error.response?.data?.data?.message || 
                          error.response?.data?.message || 
                          error.message ||
                          this.props.intl.formatMessage({
                            id: 'cboard.components.Settings.Transfer.invalidCode',
                            defaultMessage: 'Invalid or expired code'
                          });
      this.props.showNotification(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  handleCopyTiles = () => {
    const { intl, showNotification } = this.props;
    const copiedTiles = this.selectedTiles();
    this.setState({
      copiedTiles: copiedTiles
    });
    showNotification(intl.formatMessage(messages.tilesCopiedSuccessfully));
  };

  handlePasteTiles = async () => {
    const { board, intl, createTile, showNotification } = this.props;
    try {
      this.setState({ isSaving: true });
      for await (const tile of this.state.copiedTiles) {
        const newTile = {
          ...tile,
          id: shortid.generate()
        };
        if (tile.loadBoard) {
          createTile(newTile, board.id);
          await this.pasteBoardsRecursively(newTile, board.id, tile.loadBoard);
        } else {
          await this.handleAddTileEditorSubmit(newTile);
        }
      }
      showNotification(intl.formatMessage(messages.tilesPastedSuccessfully));
    } catch (err) {
      showNotification(intl.formatMessage(messages.tilesPastedError));
      console.error(err.message);
    } finally {
      this.setState({ isSaving: false });
    }
  };

  async pasteBoardsRecursively(folderTile, parentBoardId, firstPastedFolderId) {
    const {
      createBoard,
      userData,
      updateBoard,
      createApiBoard,
      boards,
      intl
    } = this.props;

    //prevent shit
    if (!folderTile || !folderTile.loadBoard) {
      return;
    }

    let newBoard = {
      ...boards.find(b => b.id === folderTile.loadBoard),
      isPublic: false,
      id: shortid.generate(),
      hidden: false,
      author: '',
      email: ''
    };

    const tilesWithFatherRemoved = newBoard.tiles?.reduce((newTiles, tile) => {
      if (firstPastedFolderId !== tile.loadBoard) newTiles.push(tile);
      return newTiles;
    }, []);

    newBoard.tiles = tilesWithFatherRemoved;

    if (!newBoard.name) {
      newBoard.name = newBoard.nameKey
        ? intl.formatMessage({ id: newBoard.nameKey })
        : intl.formatMessage(messages.noTitle);
    }
    if ('name' in userData && 'email' in userData) {
      newBoard = {
        ...newBoard,
        author: userData.name,
        email: userData.email
      };
    }
    // Prevent creating a board without the tiles property
    if (newBoard.tiles) createBoard(newBoard);
    // Loggedin user?
    if ('name' in userData && 'email' in userData) {
      try {
        newBoard = await createApiBoard(newBoard, newBoard.id);
      } catch (err) {
        console.error(err.message);
      }
    }
    const parentBoard = boards.find(b => b.id === parentBoardId);
    const newTiles = parentBoard.tiles.map(tile =>
      tile && tile.id === folderTile.id
        ? { ...tile, loadBoard: newBoard.id }
        : tile
    );
    const boardData = { ...parentBoard, tiles: newTiles };
    updateBoard(boardData);
    // Loggedin user?
    if ('name' in userData && 'email' in userData) {
      try {
        let newParentBoard = {
          ...boardData,
          hidden: false,
          author: userData.name,
          email: userData.email
        };
        if (!newParentBoard.name) {
          newParentBoard.name = newParentBoard.nameKey
            ? intl.formatMessage({ id: newParentBoard.nameKey })
            : intl.formatMessage(messages.noTitle);
        }
        await this.handleApiUpdates('', '', '', newParentBoard);
      } catch (err) {
        console.error(err.message);
      }
    }

    //return condition
    for await (const tile of newBoard.tiles) {
      if (tile && tile.loadBoard && !tile.linkedBoard) {
        //look for this board in available boards
        const newBoardToCopy = boards.find(b => b.id === tile.loadBoard);
        if (newBoardToCopy) {
          await this.pasteBoardsRecursively(
            tile,
            newBoard.id,
            firstPastedFolderId
          );
        }
      }
    }
    return;
  }

  selectedTiles = () => {
    return this.state.selectedTileIds
      ? this.state.selectedTileIds.map(selectedTileId => {
          const tiles = this.props.board.tiles.filter(tile => {
            return tile.id === selectedTileId;
          })[0];

          return tiles;
        })
      : [];
  };

  handleAddApiBoard = async boardId => {
    if (!this.props.boards.find(board => board.id === boardId)) {
      try {
        const board = await API.getBoard(boardId);
        this.props.addBoards([board]);
      } catch (err) {
        console.log(err.message);
      }
    }
  };

  render() {
    const {
      navHistory,
      board,
      focusTile,
      isPremiumRequiredModalOpen,
      improvedPhrase,
      speak
    } = this.props;
    const { isCbuilderBoard } = this.state;

    if (!this.props.board) {
      return (
        <div className="Board__loading">
          <CircularProgress size={60} thickness={5} color="inherit" />
        </div>
      );
    }

    const disableBackButton = navHistory.length === 1;
    const editingTiles = this.state.tileEditorOpen
      ? this.state.selectedTileIds.map(selectedTileId => {
          const tiles = board.tiles.filter(tile => {
            return tile.id === selectedTileId;
          })[0];

          return tiles;
        })
      : [];

    return (
      <Fragment>
        <Board
          board={board}
          intl={this.props.intl}
          scannerSettings={this.props.scannerSettings}
          deactivateScanner={this.props.deactivateScanner}
          disableBackButton={disableBackButton}
          userData={this.props.userData}
          isLocked={this.state.isLocked}
          isSaving={this.state.isSaving}
          isSelecting={this.state.isSelecting}
          isSelectAll={this.state.isSelectAll}
          isFixedBoard={this.state.isFixedBoard}
          isRootBoardTourEnabled={this.props.isRootBoardTourEnabled}
          isSymbolSearchTourEnabled={this.props.isSymbolSearchTourEnabled}
          isUnlockedTourEnabled={this.props.isUnlockedTourEnabled}
          //updateBoard={this.handleUpdateBoard}
          onAddClick={this.handleAddClick}
          onDeleteClick={this.handleDeleteClick}
          onEditClick={this.handleEditClick}
          onSelectAllToggle={this.handleSelectAllToggle}
          onFocusTile={focusTile}
          onLockClick={this.handleLockClick}
          onLockNotify={this.handleLockNotify}
          // We no longer show the old scanning demo/notification when scanning becomes active,
          // because scanning is now driven by eye tracking and the tip is confusing.
          // onScannerActive={this.handleScannerStrategyNotification}
          onRequestPreviousBoard={this.onRequestPreviousBoard}
          onRequestToRootBoard={this.onRequestToRootBoard}
          onSelectClick={this.handleSelectClick}
          onTileClick={this.handleTileClick}
          onBoardTypeChange={this.handleBoardTypeChange}
          editBoardTitle={this.handleEditBoardTitle}
          selectedTileIds={this.state.selectedTileIds}
          onJyutpingKeyboardClick={() =>
            this.setState({ isJyutpingKeyboardOpen: true })
          }
          onJyutpingRulesClick={() =>
            this.setState({ isJyutpingRulesConfigOpen: true })
          }
          displaySettings={this.props.displaySettings}
          navigationSettings={this.props.navigationSettings}
          navHistory={this.props.navHistory}
          publishBoard={this.publishBoard}
          showNotification={this.props.showNotification}
          emptyVoiceAlert={this.props.emptyVoiceAlert}
          profiles={this.state.profiles}
          onGenerateQR={this.handleGenerateQR}
          onGenerateCloudCode={this.handleGenerateCloudCode}
          onGenerateEmail={this.handleGenerateEmail}
          onRedeemCode={this.handleRedeemCode}
          offlineVoiceAlert={this.props.offlineVoiceAlert}
          onAddRemoveColumn={this.handleAddRemoveColumn}
          onAddRemoveRow={this.handleAddRemoveRow}
          onTileDrop={this.handleTileDrop}
          onLayoutChange={this.handleLayoutChange}
          disableTour={this.props.disableTour}
          onCopyTiles={this.handleCopyTiles}
          onPasteTiles={this.handlePasteTiles}
          copiedTiles={this.state.copiedTiles}
          setIsScroll={this.setIsScroll}
          isScroll={this.state.isScroll}
          totalRows={this.state.totalRows}
          ref={this.boardRef}
          changeDefaultBoard={this.props.changeDefaultBoard}
          improvedPhrase={improvedPhrase}
          speak={speak}
          onSwitchBoard={this.handleSwitchBoard}
        />
        <Dialog
          open={!!this.state.copyPublicBoard && !isPremiumRequiredModalOpen}
          TransitionComponent={Transition}
          keepMounted
          onClose={this.handleCloseDialog}
          aria-labelledby="dialog-copy-title"
          aria-describedby="dialog-copy-desc"
        >
          <DialogTitle id="dialog-copy-board-title">
            {this.props.intl.formatMessage(
              isCbuilderBoard
                ? messages.importCbuilderBoardTitle
                : messages.copyPublicBoardTitle
            )}
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="dialog-copy-board-desc">
              {this.props.intl.formatMessage(
                isCbuilderBoard
                  ? messages.importCbuilderBoardDesc
                  : messages.copyPublicBoardDesc
              )}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={this.handleCloseDialog}
              color="primary"
              disabled={this.state.isSaving}
            >
              {this.props.intl.formatMessage(messages.boardCopyCancel)}
            </Button>
            <PremiumFeature>
              <Button
                onClick={this.handleCopyRemoteBoard}
                color="primary"
                variant="contained"
                disabled={this.state.isSaving}
              >
                {this.state.isSaving ? (
                  <LoadingIcon />
                ) : (
                  this.props.intl.formatMessage(messages.boardCopyAccept)
                )}
              </Button>
            </PremiumFeature>
          </DialogActions>
        </Dialog>
        <Dialog
          open={this.state.blockedPrivateBoard}
          TransitionComponent={Transition}
          keepMounted
          onClose={this.handleCloseDialog}
          aria-labelledby="dialog-blocked-title"
          aria-describedby="dialog-blocked-desc"
        >
          <DialogTitle id="dialog-blocked-board-title">
            {this.props.intl.formatMessage(
              isCbuilderBoard
                ? messages.importCbuilderBoardTitle
                : messages.blockedPrivateBoardTitle
            )}
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="dialog-blocked-board-desc">
              {this.props.intl.formatMessage(
                isCbuilderBoard
                  ? messages.loginToImport
                  : messages.blockedPrivateBoardDesc
              )}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={this.handleCloseDialog}
              color="primary"
              variant="contained"
            >
              {this.props.intl.formatMessage(messages.boardCopyAccept)}
            </Button>
          </DialogActions>
        </Dialog>
        <TileEditor
          editingTiles={editingTiles}
          open={this.state.tileEditorOpen}
          onClose={this.handleTileEditorCancel}
          onEditSubmit={this.handleEditTileEditorSubmit}
          onAddSubmit={this.handleAddTileEditorSubmit}
          boards={this.props.boards.filter(
            board =>
              board !== null &&
              board.id !== null &&
              this.props.communicator &&
              this.props.communicator.boards &&
              Array.isArray(this.props.communicator.boards) &&
              this.props.communicator.boards.includes(board.id)
          )}
          userData={this.props.userData}
          folders={this.props.boards}
          onAddApiBoard={this.handleAddApiBoard}
          isSymbolSearchTourEnabled={this.props.isSymbolSearchTourEnabled}
          disableTour={this.props.disableTour}
        />
        <JyutpingKeyboard
          open={this.state.isJyutpingKeyboardOpen}
          onClose={() => this.setState({ isJyutpingKeyboardOpen: false })}
        />
        <JyutpingRulesConfig
          open={this.state.isJyutpingRulesConfigOpen || false}
          onClose={() => this.setState({ isJyutpingRulesConfigOpen: false })}
          userId={this.getCurrentProfileUserId()}
          profileId={this.getCurrentProfileId()}
        />
      </Fragment>
    );
  }

  getCurrentProfileUserId = () => {
    // Get user_id from current profile
    // If board has profileId, get profile's user_id
    const { board } = this.props;
    if (board && board.profileId) {
      const profile = this.state.profiles?.find(p => String(p.id) === String(board.profileId));
      const userId = profile?.user_id;
      return userId ? parseInt(userId, 10) : null;
    }
    // If no profile, return current user's id (for teacher/therapist managing their own rules)
    const userId = this.props.userData?.id;
    return userId ? parseInt(userId, 10) : null;
  };

  getCurrentProfileId = () => {
    const { board } = this.props;
    return board?.profileId ? parseInt(board.profileId) : null;
  }

  componentWillUnmount() {
    this._isMounted = false;
    
    // Cleanup window focus listener
    if (this._windowFocusHandler) {
      window.removeEventListener('focus', this._windowFocusHandler);
      this._windowFocusHandler = null;
    }
    
    // Cleanup swipe and long-press listeners
    if (this.swipeCleanup) {
      this.swipeCleanup();
    }
    if (this.longPressCleanup) {
      this.longPressCleanup();
    }
    
    // Cleanup eye tracking
    if (this.eyeTrackingInstance) {
      this.eyeTrackingInstance.cleanup();
    }
  }

  setupSwipeDetection = () => {
    const { navigationSettings } = this.props;
    
    // Check if swipe navigation is enabled
    if (!navigationSettings?.swipeEnabled) {
      return;
    }

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let mouseStartX = 0;
    let mouseStartY = 0;
    let isMouseDown = false;

    const boardElement = this.boardRef?.current || document.querySelector('.Board');
    if (!boardElement) return;

    const handleTouchStart = (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    };

    const handleTouchEnd = (e) => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      this.handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
    };

    const handleMouseDown = (e) => {
      isMouseDown = true;
      mouseStartX = e.screenX;
      mouseStartY = e.screenY;
    };

    const handleMouseUp = (e) => {
      if (isMouseDown) {
        touchEndX = e.screenX;
        touchEndY = e.screenY;
        this.handleSwipe(mouseStartX, mouseStartY, touchEndX, touchEndY);
        isMouseDown = false;
      }
    };

    boardElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    boardElement.addEventListener('touchend', handleTouchEnd, { passive: true });
    boardElement.addEventListener('mousedown', handleMouseDown);
    boardElement.addEventListener('mouseup', handleMouseUp);
    boardElement.addEventListener('mouseleave', () => { isMouseDown = false; });

    this.swipeCleanup = () => {
      boardElement.removeEventListener('touchstart', handleTouchStart);
      boardElement.removeEventListener('touchend', handleTouchEnd);
      boardElement.removeEventListener('mousedown', handleMouseDown);
      boardElement.removeEventListener('mouseup', handleMouseUp);
      boardElement.removeEventListener('mouseleave', () => { isMouseDown = false; });
    };
  };

  handleSwipe = (startX, startY, endX, endY) => {
    const { navigationSettings } = this.props;
    
    if (!navigationSettings?.swipeEnabled) {
      return;
    }

    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const minSwipeDistance = 50;

    // Horizontal swipe (left/right)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0) {
        // Swipe right - go to previous board
        this.onRequestPreviousBoard();
      }
      
      // Log swipe action
      this.logSwipeAction(deltaX > 0 ? 'right' : 'left');
    }
  };

  logSwipeAction = async (direction) => {
    try {
      const profileId = this.props.communicator?.activeCommunicatorId || null;
      await API.logAction({
        action_type: 'navigation_swipe',
        metadata: {
          direction: direction,
          profile_id: profileId
        }
      });
    } catch (error) {
      console.error('Failed to log swipe action:', error);
    }
  };

  setupEyeTracking = async () => {
    console.log('[BoardContainer] ===== setupEyeTracking called =====');
    try {
      // Cleanup existing instance first
      if (this.eyeTrackingInstance) {
        console.log('[BoardContainer] Cleaning up existing eye tracking instance...');
        this.eyeTrackingInstance.cleanup();
        this.eyeTrackingInstance = null;
      }
      
      // Load eye tracking settings
      console.log('[BoardContainer] Loading eye tracking settings from API...');
      let eyeTrackingSettings = { enabled: false, deviceType: 'tobii', dwellTime: 1000 };
      
      try {
      const settings = await API.getSettings();
        eyeTrackingSettings = settings.eyeTracking || { enabled: false, deviceType: 'tobii', dwellTime: 1000 };
        console.log('[BoardContainer] Eye tracking settings loaded:', eyeTrackingSettings);
      } catch (error) {
        // Handle 401 (Unauthorized) - user is guest or token expired
        if (error.response?.status === 401 || error.code === 'ERR_BAD_REQUEST') {
          console.log('[BoardContainer] User not authenticated (guest mode) - using default eye tracking settings (disabled)');
          eyeTrackingSettings = { enabled: false, deviceType: 'tobii', dwellTime: 1000 };
        } else {
          // For other errors, log but continue with default settings
          console.warn('[BoardContainer] Failed to load eye tracking settings, using defaults:', error.message);
          eyeTrackingSettings = { enabled: false, deviceType: 'tobii', dwellTime: 1000 };
        }
      }
      
      if (!eyeTrackingSettings.enabled) {
        console.log('[BoardContainer] Eye tracking is disabled in settings');
        return;
      }
      
      console.log('[BoardContainer] Setting up eye tracking with device type:', eyeTrackingSettings.deviceType);
      
      // Get eye tracking instance
      this.eyeTrackingInstance = getEyeTrackingInstance();
      console.log('[BoardContainer] Eye tracking instance obtained');
      
      // Initialize with settings and callback
      console.log('[BoardContainer] Calling initialize() on eye tracking instance...');
      console.log('[BoardContainer] Eye tracking settings being passed:', JSON.stringify(eyeTrackingSettings));
      // Ensure enabled is explicitly set
      const settingsToPass = {
        ...eyeTrackingSettings,
        enabled: eyeTrackingSettings.enabled === true || eyeTrackingSettings.enabled === 'true' || eyeTrackingSettings.enabled === 1
      };
      console.log('[BoardContainer] Normalized settings:', JSON.stringify(settingsToPass));
      await this.eyeTrackingInstance.initialize(
        settingsToPass,
        this.handleEyeTrackingDwell.bind(this)
      );
      
      // Setup eye-tracking driven scanning if scanning is enabled
      await this.setupEyeTrackingScanning();
      
      console.log('[BoardContainer] ✓ Eye tracking initialized successfully');
    } catch (error) {
      console.error('[BoardContainer] ❌ Error in setupEyeTracking:', error);
      console.error('[BoardContainer] Error details:', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack?.substring(0, 500)
      });
      
      // Suppress error logging for expected network errors
      const isNetworkError = error?.code === 'ERR_NETWORK' || error?.message === 'Network Error';
      if (!isNetworkError || navigator.onLine) {
        console.error('[BoardContainer] Failed to setup eye tracking:', error);
      }
      // Show user-friendly error message
      if (error.message && error.message.includes('Camera')) {
        console.warn('[BoardContainer] ⚠️ Camera access may be required. Please check browser permissions.');
      }
    }
  };

  /**
   * Setup eye-tracking driven scanning
   */
  setupEyeTrackingScanning = async () => {
    if (!this.eyeTrackingInstance) {
      return;
    }

    try {
      // Get scanning/accessibility settings
      const accessibilityData = await API.getAccessibilitySettings();
      const scanningSettings = accessibilityData?.accessibility?.scanning || {};
      
      if (scanningSettings.enabled) {
        const { board, communicator } = this.props;
        const tiles = board?.tiles || [];
        
        // Get scanning navigation data if needed (for row/column modes)
        let navigationData = null;
        const profileId = communicator?.activeCommunicatorId || null;
        if (profileId && (scanningSettings.mode === 'row' || scanningSettings.mode === 'column')) {
          try {
            const navData = await API.getScanningNavigation(
              profileId,
              null,
              scanningSettings.mode
            );
            navigationData = navData?.navigation || null;
          } catch (error) {
            console.debug('[BoardContainer] Could not get scanning navigation:', error);
          }
        }

        // Setup scanning with callbacks
        // Include strategy from scannerSettings (Redux) for backward compatibility
        const scanningStrategy = scanningSettings.strategy || 
                                 this.props.scannerSettings?.strategy || 
                                 'automatic';
        const scanningSettingsWithStrategy = {
          ...scanningSettings,
          strategy: scanningStrategy
        };
        
        this.eyeTrackingInstance.setupScanning(
          scanningSettingsWithStrategy,
          tiles,
          navigationData,
          this.handleScanningHighlight.bind(this),
          this.handleScanningSelect.bind(this)
        );
        
        console.log('[BoardContainer] ✓ Eye-tracking scanning setup complete');
      } else {
        // Disable scanning
        this.eyeTrackingInstance.updateScanningSettings({ enabled: false });
      }
    } catch (error) {
      console.debug('[BoardContainer] Error setting up eye-tracking scanning:', error);
    }
  };

  /**
   * Handle scanning highlight change (for audio feedback, etc.)
   */
  handleScanningHighlight = (elementId, element) => {
    // Trigger audio feedback when highlight changes
    const { audioGuideMode, board } = this.state;
    
    if (!audioGuideMode || audioGuideMode === 'off') {
      return;
    }

    // Use a small delay to avoid too frequent audio triggers
    if (this._highlightAudioTimeout) {
      clearTimeout(this._highlightAudioTimeout);
    }

    this._highlightAudioTimeout = setTimeout(() => {
      if (audioGuideMode === 'beep') {
        this.playScanningBeep();
      } else if (audioGuideMode === 'card_audio') {
        // Check if it's a tile (not output bar element)
        if (!elementId.startsWith('output-') && board && Array.isArray(board.tiles)) {
          const tile = board.tiles.find(t => t && String(t.id) === String(elementId));
          if (tile) {
            this.playScanningTileAudio(tile);
          }
        } else {
          // For output bar elements, just play beep
          this.playScanningBeep();
        }
      }
    }, 100); // Small delay to debounce rapid highlight changes
  };

  /**
   * Play beep sound for scanning highlight
   */
  playScanningBeep = () => {
    try {
      const AudioContextImpl = window.AudioContext || window.webkitAudioContext || null;
      if (!AudioContextImpl) {
        return;
      }
      const ctx = new AudioContextImpl();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5 tone

      gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.18);

      oscillator.onended = () => {
        try {
          ctx.close();
        } catch (e) {
          // ignore
        }
      };
    } catch (e) {
      // Fallback: do nothing if Web Audio is unavailable
    }
  };

  /**
   * Play tile audio for scanning highlight
   */
  playScanningTileAudio = (tile) => {
    // Prefer recorded sound if available
    if (tile.sound) {
      try {
        const audio = new Audio(tile.sound);
        audio.play().catch(() => {
          // Ignore playback errors (e.g., user gesture required)
        });
        return;
      } catch (e) {
        // Fallback to speech if audio fails
      }
    }

    // Fallback to speech if no sound available
    if (tile.label && this.props.speak) {
      this.props.speak(tile.label);
    }
  };

  /**
   * Handle scanning selection - supports both tiles and output bar elements
   */
  handleScanningSelect = (elementId, element) => {
    // Handle output bar actions first
    if (elementId && (elementId.startsWith('output-') || elementId === 'play' || elementId === 'remove')) {
      if (elementId === 'output-backspace' || elementId === 'backspace') {
        // Trigger backspace
        const backspaceButton = document.querySelector('button[data-output-action="backspace"], .BackspaceButton button');
        if (backspaceButton) {
          backspaceButton.click();
        } else if (this.props.changeOutput && this.props.output && this.props.output.length > 0) {
          // Fallback: directly call popOutput
          const output = [...this.props.output];
          output.pop();
          this.props.changeOutput(output);
        }
      } else if (elementId === 'output-clear' || elementId === 'clear') {
        // Trigger clear
        const clearButton = document.querySelector('button[data-output-action="clear"], .ClearButton button');
        if (clearButton) {
          clearButton.click();
        } else if (this.props.changeOutput) {
          // Fallback: directly call clearOutput
          this.props.changeOutput([]);
        }
      } else if (elementId === 'output-play' || elementId === 'play') {
        // Trigger playback - click on the output container
        const outputContainer = document.querySelector('.Board__output, [data-output-section="true"]');
        if (outputContainer) {
          outputContainer.click();
        }
      } else if (elementId === 'output-remove' || elementId === 'remove') {
        // Handle remove button on individual symbols
        if (element && element.closest) {
          const symbolValue = element.closest('.SymbolOutput__value, .LiveSymbolOutput__value');
          if (symbolValue) {
            const index = Array.from(symbolValue.parentElement?.children || []).indexOf(symbolValue);
            if (index >= 0 && this.props.changeOutput) {
              const output = [...this.props.output];
              output.splice(index, 1);
              this.props.changeOutput(output);
            }
          }
        }
      } else if (element && element.click) {
        // Generic button click
        element.click();
      }
      return;
    }
    
    // Handle regular tile selection
    const { board } = this.props;
    if (!board || !board.tiles) {
      return;
    }

    const tile = board.tiles.find(t => t && String(t.id) === String(elementId));
    if (tile) {
      this.handleTileClick(tile);
    }
  };

  handleEyeTrackingDwell = ({ tileId, x, y, dwellDuration }) => {
    // When eye-tracking scanning is active, selection is handled by handleScanningSelect
    // This method is only used when scanning is NOT enabled
    const { board } = this.props;
    if (!board || !board.tiles) {
      return;
    }

    // Check if scanning is enabled - if so, selection is handled by scanning system
    try {
      const focusedElement = document.querySelector('.Tile.scanner__focused');
      if (focusedElement) {
        // Scanning is active, selection is handled by handleScanningSelect
        return;
      }
    } catch (e) {
      // Continue with regular selection
    }

    // Regular selection (no scanning)
    const tile = board.tiles.find(t => t && String(t.id) === String(tileId));
    if (!tile) {
      return;
    }
    
    // Trigger tile click
    this.handleTileClick(tile);
  };

  setupLongPressDetection = () => {
    let pressTimer = null;
    const longPressThreshold = 1500; // 1.5 seconds

    const handlePressStart = (e) => {
      const tile = e.target.closest('.Tile');
      if (!tile) return;
      const tileId = tile.dataset.tileId || tile.id;
      
      pressTimer = setTimeout(() => {
        this.handleLongPress(e, tile, tileId);
      }, longPressThreshold);
    };

    const handlePressEnd = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    document.addEventListener('mousedown', handlePressStart);
    document.addEventListener('mouseup', handlePressEnd);
    document.addEventListener('mouseleave', handlePressEnd);
    document.addEventListener('touchstart', handlePressStart, { passive: true });
    document.addEventListener('touchend', handlePressEnd, { passive: true });
    document.addEventListener('touchcancel', handlePressEnd, { passive: true });

    this.longPressCleanup = () => {
      document.removeEventListener('mousedown', handlePressStart);
      document.removeEventListener('mouseup', handlePressEnd);
      document.removeEventListener('mouseleave', handlePressEnd);
      document.removeEventListener('touchstart', handlePressStart);
      document.removeEventListener('touchend', handlePressEnd);
      document.removeEventListener('touchcancel', handlePressEnd);
    };
  };

  handleLongPress = async (e, tileElement, tileId) => {
    e.preventDefault();
    e.stopPropagation();

    const tile = this.props.board?.tiles?.find(t => t.id === tileId);
    if (!tile) return;

    // Activate operation button scanning mode
    try {
      const profileId = this.props.communicator?.activeCommunicatorId || null;
      const response = await API.handleSwitchLongPress({
        profile_id: profileId,
        duration: 1.5,
        action: 'operation_scan',
        tile_id: tileId
      });

      if (response.scanning_mode) {
        this.setState({
          isOperationScanning: true,
          operationScanningItems: response.operation_items || []
        });
      }
    } catch (error) {
      console.error('Long press error:', error);
    }
  };
}

const mapStateToProps = ({
  board,
  communicator,
  speech,
  scanner,
  app: { displaySettings, navigationSettings, userData, isConnected, liveHelp },
  language: { lang },
  subscription: { premiumRequiredModalState }
}) => {
  const activeCommunicatorId = communicator.activeCommunicatorId;
  const currentCommunicator = communicator.communicators.find(
    communicator => communicator.id === activeCommunicatorId
  );
  const activeBoardId = board.activeBoardId;
  const emptyVoiceAlert =
    speech.voices.length > 0 && speech.options.voiceURI !== EMPTY_VOICES
      ? false
      : true;
  const offlineVoiceAlert = !isConnected && speech.options.isCloud;
  // Find the active board and ensure id is string
  const activeBoard = board.boards.find(board => {
    // Convert both to string for comparison (profile id might be number)
    return String(board.id) === String(activeBoardId);
  });
  
  // Ensure board.id is string and board.tiles exists
  const normalizedBoard = activeBoard ? {
    ...activeBoard,
    id: String(activeBoard.id),
    tiles: activeBoard.tiles || []
  } : null;
  
  // Convert navHistory ids to strings (profile ids might be numbers)
  const normalizedNavHistory = (board.navHistory || []).map(id => String(id));
  
  return {
    communicator: currentCommunicator,
    board: normalizedBoard,
    boards: board.boards.map(b => ({
      ...b,
      id: String(b.id),
      tiles: b.tiles || []
    })),
    output: board.output,
    isLiveMode: board.isLiveMode,
    scannerSettings: scanner,
    navHistory: normalizedNavHistory,
    displaySettings,
    navigationSettings,
    userData,
    emptyVoiceAlert,
    lang,
    offlineVoiceAlert,
    isRootBoardTourEnabled: liveHelp.isRootBoardTourEnabled,
    isSymbolSearchTourEnabled: liveHelp.isSymbolSearchTourEnabled,
    isUnlockedTourEnabled: liveHelp.isUnlockedTourEnabled,
    isPremiumRequiredModalOpen: premiumRequiredModalState?.open,
    improvedPhrase: board.improvedPhrase
  };
};

const mapDispatchToProps = {
  addBoards,
  changeBoard,
  replaceBoard,
  previousBoard,
  toRootBoard,
  historyRemoveBoard,
  createBoard,
  updateBoard,
  switchBoard,
  createTile,
  deleteTiles,
  editTiles,
  focusTile,
  clickSymbol,
  changeOutput,
  speak,
  cancelSpeech,
  showNotification,
  hideNotification,
  deactivateScanner,
  addBoardCommunicator,
  updateApiObjects,
  updateApiObjectsNoChild,
  getApiObjects,
  downloadImages,
  disableTour,
  createApiBoard,
  upsertApiBoard,
  changeDefaultBoard,
  updateApiBoard,
  verifyAndUpsertCommunicator
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(injectIntl(BoardContainer));

