import React from 'react';
import { connect } from 'react-redux';
import CommunicatorDialog from './CommunicatorDialog.component';
import { TAB_INDEXES } from './CommunicatorDialog.constants';
import { injectIntl } from 'react-intl';
import shortid from 'shortid';
import API from '../../../api';
import {
  deleteBoardCommunicator,
  addBoardCommunicator,
  verifyAndUpsertCommunicator,
  upsertApiCommunicator,
  replaceBoardCommunicator
} from '../Communicator.actions';
import { deleteBoard, deleteApiBoard } from '../../Board/Board.actions';
import { showNotification } from '../../Notifications/Notifications.actions';
import {
  addBoards,
  replaceBoard,
  createBoard,
  updateBoard,
  updateApiObjectsNoChild,
  updateApiBoard,
  switchBoard
} from '../../Board/Board.actions';
import history from '../../../history';
import { disableTour } from '../../App/App.actions';
import messages from './CommunicatorDialog.messages';

const BOARDS_PAGE_LIMIT = 10;
const INITIAL_STATE = {
  page: 0,
  total: 0,
  search: '',
  data: []
};

const findBoards = (boards, criteria, page, search = '') => {
  let result = boards;
  for (let [key, value] of Object.entries(criteria)) {
    result = result.filter(
      board =>
        (board.hasOwnProperty(key) && board[key] === value) ||
        !board.hasOwnProperty(key)
    );
  }
  if (search) {
    let re = new RegExp(search);
    result = result.filter(
      board => re.test(board.name) || re.test(board.author)
    );
  }
  return {
    limit: BOARDS_PAGE_LIMIT,
    offset: 0,
    search: search,
    page: page,
    total: result.length,
    data: result.slice((page - 1) * BOARDS_PAGE_LIMIT, page * BOARDS_PAGE_LIMIT)
  };
};

class CommunicatorDialogContainer extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: false,
      boards: props.communicatorBoards, // First time => Communicator Boards Tab
      total: props.communicatorBoards.length,
      selectedTab: TAB_INDEXES.COMMUNICATOR_BOARDS,
      totalPages: Math.ceil(
        props.communicatorBoards.length / BOARDS_PAGE_LIMIT
      ),
      page: 1,
      search: '',
      isSearchOpen: false,
      communicatorBoards: findBoards(props.communicatorBoards, {}, 1)
    };
    this._isMounted = false;
  }

  componentDidMount() {
    this._isMounted = true;
    
    // Listen for board publish/unpublish events to refresh public boards list
    this.handleBoardPublished = (event) => {
      console.log('[CommunicatorDialog] Board published event received:', event.detail);
      const { boardId, boardName } = event.detail || {};
      
      // Always refresh public boards list if dialog is open
      console.log('[CommunicatorDialog] Refreshing public boards list after publish:', {
        boardId,
        boardName,
        currentTab: this.state.selectedTab,
        isPublicTab: this.state.selectedTab === TAB_INDEXES.PUBLIC_BOARDS
      });
      
      this.doSearch(this.state.search, 1, TAB_INDEXES.PUBLIC_BOARDS).then(tabData => {
        console.log('[CommunicatorDialog] Public boards refreshed:', {
          total: tabData.total,
          boardsCount: tabData.boards?.length || 0,
          publishedBoardId: boardId,
          publishedBoardInList: tabData.boards?.some(b => b.id === String(boardId)) || false,
          allBoardIds: tabData.boards?.map(b => b.id) || []
        });
        
        // Always update state to ensure UI reflects the latest data
        // If user is on public boards tab, they'll see the update immediately
        // If user is on another tab, the data will be ready when they switch
        this.safeSetState({
          ...tabData,
          loading: false
        });
        
        // If user is currently viewing public boards tab, show a message
        if (this.state.selectedTab === TAB_INDEXES.PUBLIC_BOARDS) {
          console.log('[CommunicatorDialog] Public boards tab is active, UI updated with new board');
        } else {
          console.log('[CommunicatorDialog] Public boards refreshed in background, data ready when user switches to tab');
        }
      }).catch(err => {
        console.error('[CommunicatorDialog] Error refreshing public boards after publish:', err);
      });
    };
    
    this.handleBoardUnpublished = (event) => {
      console.log('[CommunicatorDialog] Board unpublished event received:', event.detail);
      const { boardId, boardName } = event.detail || {};
      
      // Always refresh public boards list if dialog is open
      console.log('[CommunicatorDialog] Refreshing public boards list after unpublish:', {
        boardId,
        boardName,
        currentTab: this.state.selectedTab
      });
      
      this.doSearch(this.state.search, 1, TAB_INDEXES.PUBLIC_BOARDS).then(tabData => {
        console.log('[CommunicatorDialog] Public boards refreshed after unpublish:', {
          total: tabData.total,
          boardsCount: tabData.boards?.length || 0,
          unpublishedBoardId: boardId,
          unpublishedBoardRemoved: !tabData.boards?.some(b => b.id === String(boardId)),
          allBoardIds: tabData.boards?.map(b => b.id) || []
        });
        
        // Always update state to ensure UI reflects the latest data
        this.safeSetState({
          ...tabData,
          loading: false
        });
      }).catch(err => {
        console.error('[CommunicatorDialog] Error refreshing public boards after unpublish:', err);
      });
    };
    
    window.addEventListener('boardPublished', this.handleBoardPublished);
    window.addEventListener('boardUnpublished', this.handleBoardUnpublished);
  }

  componentWillUnmount() {
    this._isMounted = false;
    
    // Remove event listeners
    if (this.handleBoardPublished) {
      window.removeEventListener('boardPublished', this.handleBoardPublished);
    }
    if (this.handleBoardUnpublished) {
      window.removeEventListener('boardUnpublished', this.handleBoardUnpublished);
    }
  }

  safeSetState(updates) {
    if (this._isMounted) {
      this.setState(updates);
    }
  }

  // Helper to check if board only has virtual tiles (all null) from list views
  hasOnlyVirtualTiles(board) {
    if (!board || !Array.isArray(board.tiles)) return true;
    if (board.tiles.length === 0) return true;
    return !board.tiles.some(tile => tile && typeof tile === 'object');
  }

  async onTabChange(event, selectedTab = TAB_INDEXES.COMMUNICATOR_BOARDS) {
    this.setState({ selectedTab, loading: true });
    
    // Refresh data when switching tabs to ensure latest data is shown
    // This is especially important after adding cards from AI suggestions
    const tabData = await this.doSearch('', 1, selectedTab);
    
    // If switching to COMMUNICATOR_BOARDS or MY_BOARDS tab, refresh boards from API
    if (selectedTab === TAB_INDEXES.COMMUNICATOR_BOARDS || selectedTab === TAB_INDEXES.MY_BOARDS) {
      try {
        // Fetch fresh data from API to ensure tiles_count is correct
        const freshBoards = await API.getMyBoards({
          limit: 1000, // Get all boards to refresh
          page: 1,
          search: ''
        });
        
        // Update Redux store with fresh board data
        // Mark as complete refresh since getMyBoards returns all user boards
        if (freshBoards && freshBoards.data && freshBoards.data.length > 0) {
          this.props.addBoards(freshBoards.data, true); // true = isCompleteRefresh
          console.log('[CommunicatorDialog] Refreshed boards on tab change:', {
            tab: selectedTab === TAB_INDEXES.COMMUNICATOR_BOARDS ? 'COMMUNICATOR_BOARDS' : 'MY_BOARDS',
            boardsCount: freshBoards.data.length
          });
        } else {
          // Even if no boards, mark as complete refresh to remove all user boards
          this.props.addBoards([], true);
        }
      } catch (refreshError) {
        console.error('[CommunicatorDialog] Failed to refresh boards on tab change:', refreshError);
        // Continue with existing data if refresh fails
      }
    }
    
    this.setState({
      ...tabData,
      selectedTab,
      page: 1,
      search: '',
      isSearchOpen: false,
      loading: false
    });
  }

  componentDidUpdate(prevProps) {
    // If communicatorBoards changed and we're on COMMUNICATOR_BOARDS tab, refresh
    if (
      this.props.communicatorBoards !== prevProps.communicatorBoards &&
      this.state.selectedTab === TAB_INDEXES.COMMUNICATOR_BOARDS
    ) {
      this.doSearch(this.state.search, this.state.page, TAB_INDEXES.COMMUNICATOR_BOARDS)
        .then(tabData => {
          this.setState({
            ...tabData,
            loading: false
          });
        });
    }
  }

  async loadNextPage() {
    this.setState({ nextPageLoading: true });
    const page = this.state.page + 1;
    const { search, selectedTab, boards } = this.state;
    const tabData = await this.doSearch(search, page, selectedTab);
    this.setState({
      ...tabData,
      boards: boards.concat(tabData.boards),
      page: page,
      loading: false,
      nextPageLoading: false
    });
  }

  async doSearch(
    search = this.state.search,
    page = this.state.page,
    selectedTab = this.state.selectedTab
  ) {
    let boards = [];
    let totalPages = 1;
    let total = 0;

    switch (selectedTab) {
      case TAB_INDEXES.COMMUNICATOR_BOARDS:
        // For COMMUNICATOR_BOARDS tab, show all user's profiles (same as MY_BOARDS)
        // The original "BOARDS, my communicator" semantics is now "all my boards"
        let commBoardsResponse = INITIAL_STATE;
        try {
          // Fetch all user's profiles from API (same as MY_BOARDS)
          commBoardsResponse = await API.getMyBoards({
            limit: BOARDS_PAGE_LIMIT,
            page,
            search
          });
          
          // Update Redux store with fresh data to ensure consistency
          if (commBoardsResponse.data && commBoardsResponse.data.length > 0) {
            this.props.addBoards(commBoardsResponse.data);
          }
        } catch (err) {
          // Fallback to local boards if API fails
          commBoardsResponse = findBoards(
            this.props.communicatorBoards && this.props.communicatorBoards.length > 0
              ? this.props.communicatorBoards
              : this.props.availableBoards,
            {},
            page,
            search
          );
        }
        boards = boards.concat(commBoardsResponse.data);
        total = commBoardsResponse.total;
        totalPages = Math.ceil(commBoardsResponse.total / BOARDS_PAGE_LIMIT);
        break;
      case TAB_INDEXES.PUBLIC_BOARDS:
        let externalState = INITIAL_STATE;
        try {
          console.log('[CommunicatorDialog] Fetching public boards:', { page, search, limit: BOARDS_PAGE_LIMIT });
          // 現在後端 /board/public 返回的是 profiles，getPublicBoards 會轉成 { data: profiles }
          externalState = await API.getPublicBoards({
            limit: BOARDS_PAGE_LIMIT,
            page,
            search
          });
          
          // IMPORTANT: Save the original total from backend BEFORE filtering
          // This is needed for correct pagination calculation
          const originalTotal = externalState.total || 0;
          
          console.log('[CommunicatorDialog] Public boards fetched:', {
            total: originalTotal,
            dataCount: externalState.data?.length || 0,
            firstBoard: externalState.data?.[0] ? {
              id: externalState.data[0].id,
              name: externalState.data[0].name,
              isPublic: externalState.data[0].isPublic,
              tilesCount: externalState.data[0].tiles_count || externalState.data[0].tilesCount
            } : null,
            allBoardIds: externalState.data?.map(b => b.id) || []
          });
          
          // 過濾掉 tiles_count = 0 的 profiles（空板不顯示在公開列表中）
          // Note: Backend already filters by HAVING tiles_count > 0, but we double-check here
          const beforeFilter = externalState.data?.length || 0;
          externalState.data = externalState.data.filter(
            board => (board.tiles_count || board.tilesCount || 0) > 0
          );
          const afterFilter = externalState.data?.length || 0;
          if (beforeFilter !== afterFilter) {
            console.warn('[CommunicatorDialog] Filtered out', beforeFilter - afterFilter, 'empty boards from public list');
          }
          
          // IMPORTANT: Keep the original total from backend for pagination calculation
          // Don't update total to filtered length, as backend may have more pages
          // The filtered data.length only affects current page display, not totalPages calculation
          externalState.total = originalTotal; // Use original total, not filtered count
          
          console.log('[CommunicatorDialog] Public boards pagination:', {
            originalTotal: originalTotal,
            filteredCount: externalState.data.length,
            currentPage: page,
            limit: BOARDS_PAGE_LIMIT,
            calculatedTotalPages: Math.ceil(originalTotal / BOARDS_PAGE_LIMIT),
            hasMorePages: page < Math.ceil(originalTotal / BOARDS_PAGE_LIMIT)
          });
        } catch (err) {
          externalState = findBoards(
            this.props.availableBoards,
            {
              isPublic: true,
              hidden: false
            },
            page,
            search
          );
          // 同樣過濾空板
          externalState.data = externalState.data.filter(
            board => {
              const tilesCount = board.tiles_count || board.tilesCount || (Array.isArray(board.tiles) ? board.tiles.filter(t => t !== null && t !== undefined).length : 0);
              return tilesCount > 0;
            }
          );
          // For fallback, use filtered length as total (no backend pagination info)
          externalState.total = externalState.data.length;
        }
        boards = boards.concat(externalState.data);
        total = externalState.total;
        totalPages = Math.ceil(externalState.total / BOARDS_PAGE_LIMIT);
        break;
      case TAB_INDEXES.MY_BOARDS:
        let myBoardsResponse = INITIAL_STATE;
        try {
          // 現在後端 /board/my 返回的是我的 profiles，getMyBoards 會轉成 { data: profiles }
          myBoardsResponse = await API.getMyBoards({
            limit: BOARDS_PAGE_LIMIT,
            page,
            search
          });
        } catch (err) {
          myBoardsResponse = findBoards(
            this.props.availableBoards,
            {
              email: this.props.userData.email,
              hidden: false
            },
            page,
            search
          );
        }
        boards = boards.concat(myBoardsResponse.data);
        total = myBoardsResponse.total;
        totalPages = Math.ceil(myBoardsResponse.total / BOARDS_PAGE_LIMIT);
        break;
      default:
        break;
    }
    return {
      boards,
      totalPages,
      total
    };
  }

  async onSearch(search = this.state.search) {
    this.setState({
      search,
      boards: [],
      loading: true,
      page: 1,
      totalPages: 1
    });
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(async () => {
      const { boards, totalPages, total } = await this.doSearch(search);
      this.setState({
        boards,
        page: 1,
        total,
        totalPages,
        loading: false
      });
    }, 500);
  }

  async addOrRemoveBoard(board) {
    const BOARD_ACTIONS_MAP = {
      [TAB_INDEXES.COMMUNICATOR_BOARDS]: 'communicatorBoardsAction',
      [TAB_INDEXES.PUBLIC_BOARDS]: 'addOrRemoveAction',
      [TAB_INDEXES.MY_BOARDS]: 'addOrRemoveAction'
    };
    const action = BOARD_ACTIONS_MAP[this.state.selectedTab];
    await this[action](board);
  }

  async communicatorBoardsAction(board) {
    // If Communicator Tab is selected, the board should be removed from the Communicator
    const boardIdStr = String(board.id || '');
    const communicatorBoards = this.props.communicatorBoards.filter(
      cb => String(cb.id || '') !== boardIdStr
    );
    await this.updateCommunicatorBoards(communicatorBoards);
    // Update local state to trigger re-render
    this.setState({ boards: communicatorBoards });
    // Force component to re-render by updating the search results
    if (this.state.selectedTab === TAB_INDEXES.COMMUNICATOR_BOARDS) {
      await this.doSearch(this.state.search, this.state.page, this.state.selectedTab);
    }
  }

  async copyBoard(board) {
    const { intl, showNotification } = this.props;
    try {
      // If board only has virtual tiles (from list view), fetch full board data first
      let boardToCopy = board;
      if (this.hasOnlyVirtualTiles(board)) {
        try {
          const fullBoardData = await API.getBoard(board.id);
          if (fullBoardData) {
            boardToCopy = fullBoardData;
            // Don't add the public profile to user's boards - it's public, not user-owned
            // Only the copy created by createBoardsRecursively should be added
          }
        } catch (e) {
          console.warn('Failed to fetch full board data before copying:', board.id, e);
          // Continue with existing board data if fetch fails
        }
      }
      
      // Create the public profile as a new user-owned profile (independent profile)
      const newProfileId = await this.createBoardsRecursively(boardToCopy);
      
      // Refresh the newly created profile from API to ensure it has correct tiles / tiles_count
      // 只刷新有效的數字 ID，不刷新臨時 shortid
      // Only refresh if component is still mounted
      if (this._isMounted && newProfileId && /^\d+$/.test(String(newProfileId))) {
        try {
          const newProfile = await API.getBoard(String(newProfileId));
          
          // Check again if component is still mounted after async operation
          if (!this._isMounted) {
            console.log('[COPY BOARD] Component unmounted, skipping profile refresh');
            return;
          }
          
          if (newProfile) {
            // Update Redux store with the new profile data
            this.props.addBoards([newProfile]);
            console.log('[COPY BOARD] Refreshed new profile after creation:', {
              profileId: newProfileId,
              tilesCount: newProfile.tiles_count || newProfile.tiles?.filter(t => t && typeof t === 'object').length || 0
            });
          }
        } catch (refreshErr) {
          // Only log if component is still mounted
          if (this._isMounted) {
            console.warn('[COPY BOARD] Failed to refresh new profile after creation:', {
              profileId: newProfileId,
              error: refreshErr.message,
              status: refreshErr.response?.status
            });
            // 如果刷新失敗，可能是 profile 創建失敗，不應該繼續
            if (refreshErr.response?.status === 404) {
              throw new Error(`Profile ${newProfileId} was not created successfully`);
            }
          }
        }
      } else if (newProfileId && this._isMounted) {
        console.warn('[COPY BOARD] Invalid profile ID returned, cannot refresh:', newProfileId);
      }
      
      // Refresh the current tab to show the new profile
      // Only refresh if component is still mounted
      if (this._isMounted && (this.state.selectedTab === TAB_INDEXES.COMMUNICATOR_BOARDS || this.state.selectedTab === TAB_INDEXES.MY_BOARDS)) {
        await this.doSearch(this.state.search, this.state.page, this.state.selectedTab);
      }
      
      // After successfully adding a public profile, switch to root board instead of the newly added profile
      // This prevents issues with loading the new profile and provides a better UX
      if (this._isMounted) {
        let targetBoardId = null;
        
        // First, try to use root board if it exists and is a valid permanent ID
        if (this.props.currentCommunicator?.rootBoard) {
          const rootBoardId = String(this.props.currentCommunicator.rootBoard);
          // Only use root board if it's a permanent ID (numeric), not a temporary ID
          if (/^\d+$/.test(rootBoardId)) {
            targetBoardId = rootBoardId;
            console.log('[COPY BOARD] Switching to root board after adding public profile:', targetBoardId);
          } else {
            console.warn('[COPY BOARD] Root board is a temporary ID, ignoring:', rootBoardId);
          }
        }
        
        // If no valid root board, find the oldest user board (not the newly added one)
        if (!targetBoardId) {
          const boards = this.props.availableBoards || [];
          const userBoards = boards.filter(b => {
            if (!b || !b.id) return false;
            const bIdStr = String(b.id);
            // Only consider permanent IDs (numeric)
            if (!/^\d+$/.test(bIdStr)) return false;
            // Exclude the newly added profile
            if (bIdStr === String(newProfileId)) return false;
            // Only user's own boards
            if (userData && userData.id && b.user_id && String(b.user_id) === String(userData.id)) {
              return true;
            }
            return false;
          });
          
          // Sort by created_at (oldest first) to get the oldest board
          const sortedBoards = userBoards.sort((a, b) => {
            const aDate = a.created_at ? new Date(a.created_at) : new Date(0);
            const bDate = b.created_at ? new Date(b.created_at) : new Date(0);
            return aDate - bDate;
          });
          
          if (sortedBoards.length > 0) {
            targetBoardId = String(sortedBoards[0].id);
            console.log('[COPY BOARD] No root board set, switching to oldest user board:', targetBoardId);
          } else {
            console.log('[COPY BOARD] No root board and no other user boards, keeping current board');
          }
        }
        
        // Switch to target board if found
        if (targetBoardId) {
          this.props.switchBoard(targetBoardId);
          // Navigate to target board
          if (history) {
            history.replace(`/profile/${targetBoardId}`);
          }
        }
      }
      
      showNotification(intl.formatMessage(messages.boardAddedToCommunicator));
    } catch (err) {
      console.error('[COPY BOARD] Copy board error:', {
        error: err.message,
        stack: err.stack,
        boardId: board?.id,
        boardName: board?.name
      });
      
      // 顯示更具體的錯誤消息
      let errorMessage = intl.formatMessage(messages.boardCopyError);
      if (err.message && err.message.includes('404')) {
        errorMessage = intl.formatMessage({
          id: 'cboard.components.CommunicatorDialog.boardCopyError404',
          defaultMessage: 'Failed to save board. Please try again.'
        });
      } else if (err.message && err.message.includes('not created')) {
        errorMessage = intl.formatMessage({
          id: 'cboard.components.CommunicatorDialog.boardCopyErrorNotCreated',
          defaultMessage: 'Board creation failed. Please try again.'
        });
      }
      
      showNotification(errorMessage);
      // Stop loading state if component is still mounted
      if (this.state.loading) {
        this.setState({ loading: false });
      }
    }
  }

  async createBoardsRecursively(board, records) {
    const {
      createBoard,
      addBoardCommunicator,
      verifyAndUpsertCommunicator,
      currentCommunicator,
      userData,
      updateApiObjectsNoChild,
      availableBoards,
      intl
    } = this.props;

    //防呆：沒有 board 直接返回
    if (!board) {
      return;
    }
    if (records) {
      // 防止遞迴時重複處理同一個 board
      let nextBoardsRecords = records.map(entry => entry.next);
      if (nextBoardsRecords.includes(board.id)) {
        return;
      }
    }

    // 如果來自後端 /board/public 的「公共 profile 列表」，tiles 可能是全 null 的虛擬陣列
    // 這裡檢查是否只有虛擬 tiles，如果是，就先用 API.getBoard(board.id) 拿到完整板面資料
    let sourceBoard = board;
    try {
      const hasOnlyVirtualTiles =
        !Array.isArray(board.tiles) ||
        board.tiles.length === 0 ||
        !board.tiles.some(t => t && typeof t === 'object');

      if (hasOnlyVirtualTiles && board.id) {
        console.log('[COPY BOARD] Board has only virtual tiles, fetching full board from API...', {
          sourceBoardId: board.id,
          sourceBoardName: board.name
        });
        const fullBoard = await API.getBoard(board.id);
        if (fullBoard && Array.isArray(fullBoard.tiles) && fullBoard.tiles.some(t => t && typeof t === 'object')) {
          sourceBoard = {
            ...board,
            ...fullBoard,
            id: String(fullBoard.id || board.id)
          };
          console.log('[COPY BOARD] Full board loaded for copy:', {
            sourceBoardId: sourceBoard.id,
            tilesCount: sourceBoard.tiles.filter(t => t && typeof t === 'object').length || 0
          });
        } else {
          console.warn('[COPY BOARD] Full board loaded but still has no real tiles, will skip children copy.', {
            sourceBoardId: board.id
          });
        }
      }
    } catch (e) {
      console.error('[COPY BOARD] Failed to load full board for copy, fallback to original listing data:', e);
    }

    // 從 sourceBoard 提取版面和語言資訊
    const grid = sourceBoard.grid || {};
    const layoutType =
      sourceBoard.layout_type ||
      sourceBoard.layoutType ||
      `${grid.rows || 4}x${grid.columns || 6}`;
    const language = sourceBoard.language || sourceBoard.locale || 'en';
    
    console.log('[COPY BOARD] Creating new board from public board:', {
      sourceBoardId: sourceBoard.id,
      sourceBoardName: sourceBoard.name,
      layoutType,
      language,
      tilesCount: sourceBoard.tiles?.filter(t => t && typeof t === 'object').length || 0
    });
    
    let newBoard = {
      ...sourceBoard,
      isPublic: false,
      id: shortid.generate(),
      hidden: false,
      author: '',
      email: '',
      // Ensure layout_type and language are preserved for profile creation
      layout_type: layoutType,
      layoutType: layoutType,
      language: language,
      locale: language
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
    
    // Prepare profile data for API.createBoard
    // This ensures the profile is created with correct layout_type and language
    newBoard.profile = {
      display_name: newBoard.name,
      description: newBoard.description || '',
      layout_type: layoutType,
      language: language,
      is_public: false
    };
    
    console.log('[COPY BOARD] New board object prepared:', {
      newBoardId: newBoard.id,
      newBoardName: newBoard.name,
      profile: newBoard.profile,
      userData: {
        id: userData.id,
        name: userData.name,
        email: userData.email
      }
    });
    createBoard(newBoard);
    if (!records) {
      verifyAndUpsertCommunicator({ ...currentCommunicator });
      addBoardCommunicator(newBoard.id);
    }

    if (!records) {
      records = [{ prev: board.id, next: newBoard.id }];
    } else {
      records.push({ prev: board.id, next: newBoard.id });
    }
    this.updateBoardReferences(board, newBoard, records);

    // Loggedin user?
    let boardId = null;
    if ('name' in userData && 'email' in userData) {
      try {
        console.log('[COPY BOARD] Calling updateApiObjectsNoChild to save board:', {
          newBoardId: newBoard.id,
          newBoardName: newBoard.name,
          profile: newBoard.profile,
          tilesCount: newBoard.tiles?.filter(t => t && typeof t === 'object').length || 0
        });
        
        // 保存前的臨時 ID（shortid），用於之後更新 communicator 裡的引用
        const tempBoardId = newBoard.id;

        boardId = await updateApiObjectsNoChild(newBoard, true);
        
        console.log('[COPY BOARD] Board saved successfully:', {
          originalId: newBoard.id,
          newProfileId: boardId,
          profile: newBoard.profile
        });
        
        // 驗證 boardId 是否為有效的數字 ID
        if (!boardId || (typeof boardId === 'string' && !/^\d+$/.test(boardId))) {
          throw new Error(`Invalid profile ID returned: ${boardId}`);
        }
        
        newBoard = {
          ...newBoard,
          id: String(boardId)
        };

        // 將 communicator 中引用的舊 boardId（shortid）替換為後端返回的真正 profileId（數字）
        if (tempBoardId && boardId && tempBoardId !== String(boardId)) {
          this.props.replaceBoardCommunicator(String(tempBoardId), String(boardId));
        }
        
        // 從 Redux 中移除臨時 board（如果存在）
        // Use availableBoards from props (mapped from Redux state)
        const boards = this.props.availableBoards || [];
        const tempBoardInRedux = boards.find(b => String(b.id) === String(tempBoardId));
        if (tempBoardInRedux && String(tempBoardId) !== String(boardId)) {
          console.log('[COPY BOARD] Removing temporary board from Redux:', tempBoardId);
          // 臨時 board 會被新的 board 替換，不需要手動刪除
        }
      } catch (err) {
        // 詳細記錄錯誤信息
        const errorDetails = {
          message: err?.message || 'Unknown error',
          stack: err?.stack,
          newBoardId: newBoard.id,
          responseStatus: err?.response?.status,
          responseData: err?.response?.data,
          responseStatusText: err?.response?.statusText,
          requestUrl: err?.config?.url,
          requestMethod: err?.config?.method
        };
        console.error('[COPY BOARD] Error saving board:', JSON.stringify(errorDetails, null, 2));
        
        // 創建失敗時，清理臨時數據
        const tempBoardId = newBoard.id;
        console.warn('[COPY BOARD] Cleaning up temporary board after failure:', tempBoardId);
        
        // 只在組件仍然掛載時清理
        if (this._isMounted) {
          // 從 communicator 中移除臨時 board
          try {
            this.props.deleteBoardCommunicator(tempBoardId);
          } catch (cleanupErr) {
            console.warn('[COPY BOARD] Failed to cleanup communicator:', cleanupErr);
          }
        }
        
        // 重新拋出錯誤，讓上層處理
        throw err;
      }
    }

    // Filter out null/undefined tiles before processing（使用 sourceBoard 的真實 tiles）
    const validTiles = (sourceBoard.tiles || []).filter(
      tile => tile !== null && tile !== undefined && typeof tile === 'object'
    );
    
    if (validTiles.length < 1) {
      // Return the new profile ID even if no tiles
      // 只返回有效的數字 ID，不返回臨時 shortid
      if (boardId && /^\d+$/.test(String(boardId))) {
        return String(boardId);
      }
      // 如果沒有有效的 boardId，拋出錯誤
      throw new Error('Board creation failed: No valid profile ID returned');
    }
    
    //return condition
    for (const tile of validTiles) {
      if (tile.loadBoard && !tile.linkedBoard) {
        try {
          const nextBoard = await API.getBoard(tile.loadBoard);
          await this.createBoardsRecursively(nextBoard, records);
        } catch (err) {
          console.error('Error loading board for tile:', tile.loadBoard, err);
          if (!err.response || err.response?.status === 404) {
            //look for this board in available boards
            const localBoard = availableBoards.find(
              b => String(b.id) === String(tile.loadBoard)
            );
            if (localBoard) {
              await this.createBoardsRecursively(localBoard, records);
            } else {
              // If board not found, throw error to stop the process
              throw new Error(`Board ${tile.loadBoard} not found`);
            }
          } else {
            // For other errors, re-throw to stop the process
            throw err;
          }
        }
      }
    }
    
    // Return the new profile ID (the main board's ID after creation)
    // Always return permanent ID (boardId) if available, never return temporary ID
    if (boardId && /^\d+$/.test(String(boardId))) {
      return String(boardId);
    }
    // If no valid permanent ID, throw error instead of returning temporary ID
    throw new Error('Board creation failed: No valid permanent profile ID returned');
  }

  updateBoardReferences(board, newBoard, records) {
    const { availableBoards, updateBoard } = this.props;
    //get the list of prev boards in records, but remove the current board
    let prevBoardsRecords = records.map(entry => entry.prev);
    prevBoardsRecords = prevBoardsRecords.filter(id => id !== newBoard.id);
    //look for reference to the original board id
    availableBoards.forEach(b => {
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

  async addOrRemoveAction(board) {
    // If All My Boards Tab is selected, the board should be added/removed to/from the Communicator
    let communicatorBoards = [...this.props.communicatorBoards];
    const boardIdStr = String(board.id || '');
    const boardIndex = communicatorBoards.findIndex(b => String(b.id || '') === boardIdStr);
    if (boardIndex >= 0) {
      communicatorBoards.splice(boardIndex, 1);
      this.props.showNotification(
        this.props.intl.formatMessage(messages.boardRemovedFromCommunicator)
      );
    } else {
      communicatorBoards.push(board);
      this.props.showNotification(
        this.props.intl.formatMessage(messages.boardAddedToCommunicator)
      );
    }

    await this.updateCommunicatorBoards(communicatorBoards);

    // Need to fetch board if its not locally available OR if it only has virtual tiles
    if (boardIndex < 0) {
      const existingBoard = this.props.availableBoards.find(b => String(b.id || '') === boardIdStr);
      
      // Check if board needs to be fetched:
      // 1. Board doesn't exist locally, OR
      // 2. Board exists but only has virtual tiles (all null) - common for list views
      const needsFetch = !existingBoard || this.hasOnlyVirtualTiles(existingBoard);
      
      if (needsFetch) {
        let boards = [];
        try {
          const boardData = await API.getBoard(board.id);
          if (boardData) {
            boards.push(boardData);
            this.props.addBoards(boards);
          }
        } catch (e) {
          console.warn('Failed to fetch board data when adding to communicator:', board.id, e);
        }
      }
    }
    
    // Force re-render by updating search results if on MY_BOARDS tab
    if (this.state.selectedTab === TAB_INDEXES.MY_BOARDS) {
      await this.doSearch(this.state.search, this.state.page, this.state.selectedTab);
    }
  }

  async updateCommunicatorBoards(boards) {
    const {
      userData,
      currentCommunicator,
      verifyAndUpsertCommunicator,
      upsertApiCommunicator
    } = this.props;

    // Ensure all board IDs are strings for consistency
    const boardIds = boards.map(cb => String(cb.id || '')).filter(Boolean);

    const updatedCommunicatorData = {
      ...currentCommunicator,
      boards: boardIds
    };

    const upsertedCommunicator = verifyAndUpsertCommunicator(
      updatedCommunicatorData
    );

    if ('name' in userData && 'email' in userData) {
      try {
        await upsertApiCommunicator(upsertedCommunicator);
      } catch (err) {
        console.error('Error upserting communicator', err);
      }
    }
    
    // Force re-render by updating local state if needed
    // The Redux state should already be updated by verifyAndUpsertCommunicator
    // but we can trigger a re-render by updating the boards list in state
    if (this.state.boards) {
      this.setState({ boards });
    }
  }

  async publishBoard(board) {
    const { userData, replaceBoard, showNotification, intl } = this.props;
    const boardData = {
      ...board,
      isPublic: !board.isPublic
    };
    const sBoards = this.state.boards;
    const index = sBoards.findIndex(b => board.id === b.id);
    sBoards.splice(index, 1, boardData);
    replaceBoard(board, boardData);
    this.setState({
      boards: sBoards
    });
    boardData.isPublic
      ? showNotification(intl.formatMessage(messages.boardPublished))
      : showNotification(intl.formatMessage(messages.boardUnpublished));

    // Loggedin user?
    if ('name' in userData && 'email' in userData) {
      try {
        const boardResponse = await API.updateBoard(boardData);
        replaceBoard(boardData, boardResponse);
      } catch (err) {}
    }
  }

  async boardReport(reportedBoardData) {
    const {
      language: { lang }
    } = this.props;
    reportedBoardData.whistleblower.language = lang;
    await API.boardReport(reportedBoardData);
    return;
  }

  async setRootBoard(board) {
    const {
      userData,
      currentCommunicator,
      verifyAndUpsertCommunicator,
      upsertApiCommunicator
    } = this.props;

    const updatedCommunicatorData = {
      ...currentCommunicator,
      rootBoard: board.id
    };
    const upsertedCommunicator = verifyAndUpsertCommunicator(
      updatedCommunicatorData
    );
    try {
      if ('name' in userData && 'email' in userData) {
        await upsertApiCommunicator(upsertedCommunicator);
      }
    } catch (err) {
      console.error('Error upserting communicator', err);
    }
  }

  openSearchBar() {
    this.setState({ isSearchOpen: true });
  }

  async deleteMyBoard(board) {
    const {
      showNotification,
      deleteBoard,
      communicators,
      verifyAndUpsertCommunicator,
      deleteApiBoard,
      userData,
      intl,
      upsertApiCommunicator,
      activeBoardId,
      deleteBoardCommunicator,
      addBoards
    } = this.props;
    
    // Prevent deleting the current active board
    const boardIdStr = String(board.id || '');
    const activeBoardIdStr = String(activeBoardId || '');
    
    if (boardIdStr === activeBoardIdStr) {
      showNotification(
        intl.formatMessage({
          id: 'cboard.components.CommunicatorDialog.cannotDeleteActiveBoard',
          defaultMessage: 'Cannot delete the board you are currently viewing. Please switch to another board first.'
        }),
        'error'
      );
      return;
    }
    
    // Helper function to check if an ID is a shortid (temporary ID)
    const isShortId = (id) => {
      const idStr = String(id || '');
      // shortid typically contains letters and is 9-11 characters long
      // Numeric IDs are permanent database IDs
      return idStr.length > 0 && !/^\d+$/.test(idStr);
    };
    
    // Find all related IDs (both temporary shortid and permanent numeric ID)
    // boardIdStr is already declared above
    const isTemporaryId = isShortId(board.id);
    let allIdsToDelete = [boardIdStr];
    
    // Get current communicator to check for related IDs
    const currentCommunicator = this.props.currentCommunicator;
    const boards = this.props.availableBoards || [];
    
    if (isTemporaryId) {
      // If deleting a temporary ID, find the corresponding permanent ID
      // Match by name and user_id since temporary boards are created with the same name
      const permanentBoard = boards.find(b => {
        if (!b || !b.id) return false;
        const bIdStr = String(b.id);
        // Must be a permanent ID (numeric) and match name/user
        return /^\d+$/.test(bIdStr) && 
               bIdStr !== boardIdStr && 
               b.name === board.name &&
               (b.user_id === board.user_id || 
                (b.user_id && board.user_id && String(b.user_id) === String(board.user_id)));
      });
      if (permanentBoard) {
        allIdsToDelete.push(String(permanentBoard.id));
        console.log('[CommunicatorDialog] Found permanent ID for temporary board:', {
          temporaryId: boardIdStr,
          permanentId: permanentBoard.id,
          boardName: board.name
        });
      }
    } else {
      // If deleting a permanent ID, check communicator for any temporary IDs
      // that might correspond to this board (by matching name)
      if (currentCommunicator && currentCommunicator.boards && Array.isArray(currentCommunicator.boards)) {
        currentCommunicator.boards.forEach(bId => {
          const bIdStr = String(bId || '');
          if (isShortId(bIdStr) && bIdStr !== boardIdStr) {
            // Check if this temporary ID's board matches the permanent board we're deleting
            const tempBoard = boards.find(b => String(b.id) === bIdStr);
            if (tempBoard && tempBoard.name === board.name &&
                (tempBoard.user_id === board.user_id || 
                 (tempBoard.user_id && board.user_id && String(tempBoard.user_id) === String(board.user_id)))) {
              allIdsToDelete.push(bIdStr);
              console.log('[CommunicatorDialog] Found temporary ID in communicator for permanent board:', {
                permanentId: boardIdStr,
                temporaryId: bIdStr,
                boardName: board.name
              });
            }
          }
        });
      }
    }
    
    console.log('[CommunicatorDialog] Deleting board with all related IDs:', {
      boardId: boardIdStr,
      isTemporaryId,
      allIdsToDelete,
      boardName: board.name
    });
    
    // Remove from Redux store immediately for responsive UI
    allIdsToDelete.forEach(id => {
      deleteBoard(id);
    });
    
    // Also remove from communicator immediately (all related IDs)
    allIdsToDelete.forEach(id => {
      deleteBoardCommunicator(id);
    });

    // Loggedin user?
    if ('name' in userData && 'email' in userData) {
      try {
        console.log('[CommunicatorDialog] Deleting board/profile:', board.id, 'Type:', typeof board.id);
        const result = await deleteApiBoard(board.id);
        console.log('[CommunicatorDialog] Board/profile deleted successfully:', board.id, 'Result:', result);
        
        // Refresh boards list from API to ensure consistency
        // This ensures the dropdown menu and other components see the updated list
        // Only refresh if component is still mounted
        if (this._isMounted) {
          try {
            const freshBoards = await API.getMyBoards({
              limit: 1000,
              page: 1,
              search: ''
            });
            
            // Check again if component is still mounted after async operation
            if (!this._isMounted) {
              console.log('[CommunicatorDialog] Component unmounted, skipping board refresh after delete');
              return;
            }
            
            console.log('[CommunicatorDialog] Refreshing boards after delete:', {
              deletedBoardId: board.id,
              freshBoardsCount: freshBoards?.data?.length || 0,
              freshBoardIds: freshBoards?.data?.map(b => b.id) || []
            });
            
            if (freshBoards && freshBoards.data) {
              // Filter out the deleted board from the fresh list before updating Redux
              // This ensures it won't be re-added even if it somehow appears in the API response
              const deletedBoardIdStr = String(board.id);
              const filteredBoards = freshBoards.data.filter(b => String(b.id) !== deletedBoardIdStr);
              
              console.log('[CommunicatorDialog] Filtered boards after delete:', {
                deletedBoardId: board.id,
                originalCount: freshBoards.data.length,
                filteredCount: filteredBoards.length,
                wasDeletedBoardInList: freshBoards.data.some(b => String(b.id) === deletedBoardIdStr)
              });
              
              // Update Redux store with filtered boards list
              // This will replace/add boards from the API response and remove the deleted one
              // Mark as complete refresh since getMyBoards returns all user boards
              addBoards(filteredBoards, true); // true = isCompleteRefresh
              
              // Double-check: ensure the deleted board is not in Redux after update
              // This is a safety measure in case ADD_BOARDS didn't properly remove it
              // Use availableBoards from props (mapped from Redux state)
              const deletedBoardStillInRedux = this.props.availableBoards?.some(b => String(b.id) === deletedBoardIdStr);
              if (deletedBoardStillInRedux) {
                console.warn('[CommunicatorDialog] Deleted board still in Redux after refresh, removing it explicitly:', board.id);
                deleteBoard(board.id);
              }
            } else {
              // If API returns empty or no data, the deleteBoard call above already removed it
              console.log('[CommunicatorDialog] No boards returned from API after delete, deleted board already removed from Redux');
            }
          } catch (refreshError) {
            // Only log if component is still mounted
            if (this._isMounted) {
              console.warn('[CommunicatorDialog] Failed to refresh boards after delete:', refreshError);
            }
            // Even if refresh fails, deleted board is already removed from Redux above
          }
        }
        
        // Refresh the current tab to update the display
        if (this.state.selectedTab === TAB_INDEXES.COMMUNICATOR_BOARDS || this.state.selectedTab === TAB_INDEXES.MY_BOARDS) {
          await this.doSearch(this.state.search, this.state.page, this.state.selectedTab);
        }
        
        showNotification(
          intl.formatMessage({
            id: 'cboard.components.CommunicatorDialog.boardDeleted',
            defaultMessage: 'Board was permanently deleted.'
          }),
          'success'
        );
      } catch (err) {
        console.error('[CommunicatorDialog] Error deleting board/profile:', board.id, err);
        console.error('[CommunicatorDialog] Error details:', {
          message: err?.message,
          response: err?.response?.data,
          status: err?.response?.status,
          statusText: err?.response?.statusText
        });
        showNotification(
          intl.formatMessage(messages.boardDeleteError || { 
            id: 'cboard.components.CommunicatorDialog.boardDeleteError', 
            defaultMessage: 'Failed to delete board' 
          }),
          'error'
        );
        // Re-throw error so handleBoardDelete can catch it
        throw err;
      }
    } else {
      console.log('[CommunicatorDialog] User not logged in, skipping API delete');
    }
    // Update all communicators that reference this board
    // Ensure ID comparison uses strings
    const boardIdToDelete = String(board.id || '');
    for await (const comm of communicators) {
      if (Array.isArray(comm.boards)) {
        // Check if this communicator includes the board to delete
        const hasBoard = comm.boards.some(b => String(b || '') === boardIdToDelete);
        if (hasBoard) {
          const filteredCommunicator = {
            ...comm,
            boards: comm.boards
              .map(b => String(b || ''))
              .filter(b => b !== boardIdToDelete)
          };

          const upsertedCommunicator = verifyAndUpsertCommunicator(
            filteredCommunicator
          );

          if ('name' in userData && 'email' in userData) {
            try {
              await upsertApiCommunicator(upsertedCommunicator);
            } catch (err) {
              console.error('Error upserting communicator', err);
            }
          }
        }
      }
    }

    const sBoards = this.state.boards;
    const index = sBoards.findIndex(b => board.id === b.id);
    sBoards.splice(index, 1);
    this.setState({
      boards: sBoards
    });
    showNotification(intl.formatMessage(messages.boardDeleted));
  }

  async updateMyBoard(board) {
    const { updateBoard, updateApiBoard, userData } = this.props;
    updateBoard(board);
    const sBoards = this.state.boards;
    const index = sBoards.findIndex(b => board.id === b.id);
    sBoards.splice(index, 1, board);
    this.setState({
      boards: sBoards
    });

    // Loggedin user?
    if ('name' in userData && 'email' in userData) {
      try {
        await updateApiBoard(board);
      } catch (err) {}
    }
  }

  render() {
    const limit = this.state.page * BOARDS_PAGE_LIMIT;
    // Ensure all IDs are strings for PropTypes validation
    const communicatorBoardsIds = this.props.communicatorBoards.map(b => String(b.id || ''));
    const dialogProps = {
      ...this.props,
      ...this.state,
      limit,
      communicator: this.props.currentCommunicator,
      communicatorBoardsIds,
      addOrRemoveBoard: this.addOrRemoveBoard.bind(this),
      deleteMyBoard: this.deleteMyBoard.bind(this),
      updateMyBoard: this.updateMyBoard.bind(this),
      publishBoard: this.publishBoard.bind(this),
      setRootBoard: this.setRootBoard.bind(this),
      copyBoard: this.copyBoard.bind(this),
      boardReport: this.boardReport.bind(this),
      loadNextPage: this.loadNextPage.bind(this),
      onTabChange: this.onTabChange.bind(this),
      onSearch: this.onSearch.bind(this),
      openSearchBar: this.openSearchBar.bind(this),
      disableTour: this.props.disableTour
    };

    return <CommunicatorDialog {...dialogProps} />;
  }
}

const mapStateToProps = ({ board, communicator, language, app }, ownProps) => {
  const activeCommunicatorId = communicator.activeCommunicatorId;
  const currentCommunicator = communicator.communicators.find(
    communicator => communicator.id === activeCommunicatorId
  );

  const { userData, displaySettings } = app;

  // 當還沒有選定 activeCommunicator（例如正在建立新板）時，currentCommunicator 可能為 undefined
  // 此時 communicatorBoards 應該為空，而不是觸發「Cannot read properties of undefined (reading 'indexOf')」
  // Ensure board IDs are strings for comparison
  // IMPORTANT: In profile-centric architecture, communicatorBoards should ALWAYS show all user's profiles
  // The first tab (BOARDS) should display all user profiles, not just the ones in communicator.boards
  let communicatorBoards = [];
  
  if (userData && userData.id) {
    // Always show all user's profiles in the first tab (BOARDS)
    // This is the profile-centric architecture behavior
    communicatorBoards = board.boards.filter(b => {
      if (!b || b.id == null) return false;
      
      // Filter out system templates
      if (b.email === 'support@cboard.io') {
        return false;
      }
      
      // Only show user's own profiles
      if (userData.id && b.user_id && String(b.user_id) === String(userData.id)) {
        return true;
      }
      
      // Also check by email for backward compatibility
      if (b.email && userData.email && b.email === userData.email) {
        return true;
      }
      
      return false;
    });
  }
  
  // IMPORTANT: Normalize boards to ensure tiles_count is set correctly
  // This ensures consistent tile display across all tabs
  communicatorBoards = communicatorBoards.map(b => {
    // If board has tiles_count, use it
    if (typeof b.tiles_count === 'number') {
      return b;
    }
    // If board has tilesCount, map it to tiles_count
    if (typeof b.tilesCount === 'number') {
      return { ...b, tiles_count: b.tilesCount };
    }
    // If board has tiles array, calculate real tiles count
    if (b.tiles && Array.isArray(b.tiles)) {
      const realTiles = b.tiles.filter(
        tile => tile !== null && tile !== undefined && typeof tile === 'object'
      );
      return { ...b, tiles_count: realTiles.length };
    }
    // Default to 0 if no tiles information
    return { ...b, tiles_count: 0 };
  });

  // 系統 Cboard 預設板（供某些地方需要顯示原始模板用），不在 communicatorBoards 內顯示
  const cboardBoards = board.boards.filter(
    b => b && b.email === 'support@cboard.io'
  );
  const communicatorTour = app.liveHelp.communicatorTour || {
    isCommBoardsEnabled: true,
    isPublicBoardsEnabled: true,
    isAllMyBoardsEnabled: true
  };

  return {
    ...ownProps,
    communicators: communicator.communicators,
    currentCommunicator,
    communicatorBoards,
    cboardBoards,
    availableBoards: board.boards,
    userData,
    language,
    activeBoardId: board.activeBoardId ? String(board.activeBoardId) : null,
    dark: displaySettings.darkThemeActive,
    communicatorTour,
    isSymbolSearchTourEnabled: app.liveHelp.isSymbolSearchTourEnabled
  };
};

const mapDispatchToProps = {
  addBoards,
  replaceBoard,
  showNotification,
  deleteBoard,
  deleteApiBoard,
  deleteBoardCommunicator,
  createBoard,
  updateBoard,
  addBoardCommunicator,
   replaceBoardCommunicator,
  updateApiObjectsNoChild,
  updateApiBoard,
  disableTour,
  verifyAndUpsertCommunicator,
  upsertApiCommunicator,
  switchBoard
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(injectIntl(CommunicatorDialogContainer));
