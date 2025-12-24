import API from '../../api';
import {
  FINISH_FIRST_VISIT,
  UPDATE_DISPLAY_SETTINGS,
  UPDATE_NAVIGATION_SETTINGS,
  UPDATE_USER_DATA,
  DISABLE_TOUR,
  ENABLE_ALL_TOURS,
  SET_UNLOGGED_USER_LOCATION,
  UPDATE_SYMBOLS_SETTINGS,
  UPDATE_CONNECTIVITY
} from './App.constants';

import { updateIsInFreeCountry } from '../../providers/SubscriptionProvider/SubscriptionProvider.actions';
import { changeElevenLabsApiKey } from '../../providers/SpeechProvider/SpeechProvider.actions';
import tts from '../../providers/SpeechProvider/tts';
import { addBoards, switchBoard } from '../Board/Board.actions';
import { DEFAULT_BOARDS } from '../../helpers';

export function updateConnectivity({ isConnected = false }) {
  return {
    type: UPDATE_CONNECTIVITY,
    payload: isConnected
  };
}

export function updateDisplaySettings(payload = {}) {
  return {
    type: UPDATE_DISPLAY_SETTINGS,
    payload
  };
}

export function updateNavigationSettings(payload = {}) {
  return {
    type: UPDATE_NAVIGATION_SETTINGS,
    payload
  };
}

export function updateSymbolsSettings(payload = {}) {
  return {
    type: UPDATE_SYMBOLS_SETTINGS,
    payload
  };
}

export function finishFirstVisit() {
  return {
    type: FINISH_FIRST_VISIT
  };
}

export function disableTour(payload = {}) {
  return {
    type: DISABLE_TOUR,
    payload
  };
}

export function enableAllTours() {
  return {
    type: ENABLE_ALL_TOURS
  };
}

export function updateUserData(userData) {
  return {
    type: UPDATE_USER_DATA,
    userData
  };
}

export function setUnloggedUserLocation(location) {
  return {
    type: SET_UNLOGGED_USER_LOCATION,
    location
  };
}

export function updateLoggedUserLocation() {
  return async (dispatch, getState) => {
    const {
      app: { userData }
    } = getState();
    if (!userData) return;
    try {
      const { id, location } = userData;
      const APIGetAndUpdateLocation = async () => {
        const { location: userLocation } = await API.updateUser({
          id: id,
          location: {}
        });
        return userLocation;
      };

      if (location) return;
      const userLocation = await APIGetAndUpdateLocation();
      if (userLocation) {
        dispatch(updateUserData({ ...userData, location: userLocation }));
        dispatch(updateIsInFreeCountry());
        return;
      }
      // Location is optional - don't throw error if null
    } catch (error) {
      // Only log non-network errors (location is optional, network errors are expected)
      const isNetworkError = error?.code === 'ERR_NETWORK' || 
                            error?.message === 'Network Error' ||
                            error?.code === 'ECONNABORTED' ||
                            error?.message?.includes('timeout');
      if (!isNetworkError) {
        // Log only unexpected errors (not network/timeout errors)
        console.warn('Error during localization of the logged user (non-critical):', error);
      }
      // Silently fail for network errors - location is optional
    }
  };
}

export function loadUserBoardsOnStartup() {
  return async (dispatch, getState) => {
    const {
      app: { userData },
      board
    } = getState();
    
    if (!userData || !userData.email) {
      console.log('App startup - No user data, skipping profile/board load');
      return;
    }
    
    try {
      console.log('App startup - Loading user profiles/boards for:', userData.email);
      
      // Get user's profiles from API（後端 /board/my 已經返回 profiles）
      const boardsResponse = await API.getMyBoards({ page: 1, limit: 50 });
      
      // Handle different response formats（新格式：{ data: profiles, total, ... }）
      let boardsList = [];
      if (Array.isArray(boardsResponse)) {
        boardsList = boardsResponse;
      } else if (boardsResponse?.profiles && Array.isArray(boardsResponse.profiles)) {
        boardsList = boardsResponse.profiles;
      } else if (boardsResponse?.data && Array.isArray(boardsResponse.data)) {
        boardsList = boardsResponse.data;
      } else if (boardsResponse?.boards && Array.isArray(boardsResponse.boards)) {
        // 兼容舊格式
        boardsList = boardsResponse.boards;
      } else if (boardsResponse?.data?.boards && Array.isArray(boardsResponse.data.boards)) {
        boardsList = boardsResponse.data.boards;
      }
      
      if (!boardsList || boardsList.length === 0) {
        console.log('App startup - No profiles/boards found for user');
        // Check if current activeBoardId points to a valid board
        const currentActiveBoardId = getState().board.activeBoardId;
        const currentBoardExists = currentActiveBoardId 
          ? board.boards.find(b => String(b.id) === String(currentActiveBoardId))
          : null;
        
        // If activeBoardId exists but board doesn't exist (deleted), clear it
        if (currentActiveBoardId && currentActiveBoardId !== 'root' && !currentBoardExists) {
          console.log('App startup - Current activeBoardId points to deleted board, clearing it:', currentActiveBoardId);
          dispatch(switchBoard(null));
        }
        
        // Always load root board if no user boards found
        console.log('App startup - No user profiles found, loading root board');
        const rootBoard = DEFAULT_BOARDS.advanced?.[0];
        if (rootBoard) {
          // Ensure root board is in the boards list
          const rootBoardExists = board.boards.find(b => String(b.id) === String(rootBoard.id));
          if (!rootBoardExists) {
            dispatch(addBoards([rootBoard]));
          }
          // Switch to root board
          dispatch(switchBoard(rootBoard.id));
          console.log('App startup - Loaded root board:', rootBoard.id);
        }
        return;
      }
      
      console.log('App startup - Found profile/board metadata:', boardsList.length);
      
      // 注意：/board/my 返回的 tiles 多數是虛擬的 [null, ...]（只用來表示數量），
      // 不能再用「全部為 null」來判斷為損壞，否則會把正常 profile 當成壞數據過濾掉，
      // 導致用戶剛保存的 profile 立刻「消失」，再訪問就被重定向到 root。
      const validProfiles = boardsList;
      
      console.log('App startup - Valid profiles (no corruption filter):', validProfiles.length, 'out of', boardsList.length);
      
      // Extract profile IDs（新模型下：id 即 profileId）
      // Ensure all IDs are strings for consistent comparison
      const boardIds = validProfiles
        .map(b => String(b.id || ''))
        .filter(id => id && id.length > 0);
      
      if (boardIds.length === 0) {
        console.log('App startup - No valid board IDs found after corruption check');
        // Try to load root board if no valid profiles
        const { communicator } = getState();
        const currentCommunicator = communicator.communicators.find(
          c => c.id === communicator.activeCommunicatorId
        );
        const rootBoardId = currentCommunicator?.rootBoard;
        
        if (rootBoardId) {
          console.log('App startup - No valid profiles, loading root board:', rootBoardId);
          const rootBoard = DEFAULT_BOARDS.advanced?.[0];
          if (rootBoard) {
            const rootBoardExists = board.boards.find(b => String(b.id) === String(rootBoard.id));
            if (!rootBoardExists) {
              dispatch(addBoards([rootBoard]));
            }
            dispatch(switchBoard(rootBoard.id));
            console.log('App startup - Loaded root board:', rootBoard.id);
          }
        } else {
          // No root board either, load default root board
          console.log('App startup - No root board, loading default root board');
          const rootBoard = DEFAULT_BOARDS.advanced?.[0];
          if (rootBoard) {
            const rootBoardExists = board.boards.find(b => String(b.id) === String(rootBoard.id));
            if (!rootBoardExists) {
              dispatch(addBoards([rootBoard]));
            }
            dispatch(switchBoard(rootBoard.id));
            console.log('App startup - Loaded default root board:', rootBoard.id);
          }
        }
        return;
      }
      
      // Get local boards to avoid duplicates - ensure all IDs are strings
      const localBoardsIds = (board.boards || []).map(b => String(b.id || '')).filter(Boolean);
      const boardsToFetch = boardIds.filter(id => !localBoardsIds.includes(id));
      
      console.log('App startup - Loading boards:', {
        totalBoards: boardIds.length,
        boardsToFetch: boardsToFetch.length,
        alreadyLoaded: boardIds.length - boardsToFetch.length,
        localBoardsCount: localBoardsIds.length
      });
      
      if (boardsToFetch.length === 0) {
        console.log('App startup - All boards already loaded');
        // Still check if we need to set active board
        const currentActiveBoardId = getState().board.activeBoardId;
        if (!currentActiveBoardId || currentActiveBoardId === 'root') {
          const userBoards = (board.boards || []).filter(b => 
            b.email === userData.email
          );
          if (userBoards.length > 0) {
            const sortedBoards = [...userBoards].sort((a, b) => {
              const aDate = a.lastEdited ? new Date(a.lastEdited) : new Date(0);
              const bDate = b.lastEdited ? new Date(b.lastEdited) : new Date(0);
              return bDate - aDate;
            });
            const mostRecentBoard = sortedBoards[0];
            console.log('App startup - Setting active board to most recent existing:', mostRecentBoard.id);
            dispatch(switchBoard(mostRecentBoard.id));
          }
        }
        return;
      }
      
      // Fetch boards that aren't already loaded
      const apiBoards = await Promise.all(
        boardsToFetch.map(async id => {
          let boardData = null;
          try {
            console.log('App startup - Fetching board:', id);
            boardData = await API.getBoard(id);
            
            // 只簡單過濾掉 null/undefined tiles，不再把「全為 null」視為損壞板，
            // 由後端數據為準，避免啟動時誤判導致板被丟棄。
            if (boardData && boardData.tiles && Array.isArray(boardData.tiles)) {
              boardData.tiles = boardData.tiles.filter(tile => 
                tile !== null && tile !== undefined && typeof tile === 'object'
              );
            }
            
            console.log('App startup - Board fetched:', { 
              id, 
              name: boardData?.name, 
              tilesCount: boardData?.tiles?.length || 0 
            });
          } catch (e) {
            console.error('App startup - Error fetching board:', id, e.message);
            // If it's a corruption error, try to get user's other profiles
            if (e.message && e.message.includes('corrupted')) {
              console.log('App startup - Corrupted board detected, will try to load user profiles');
            }
          }
          return boardData;
        })
      );
      
      const validBoards = apiBoards.filter(b => b !== null && b !== undefined);
      
      if (validBoards.length > 0) {
        console.log('App startup - Loaded boards:', validBoards.length, 
          validBoards.map(b => ({ id: b.id, name: b.name, tilesCount: b.tiles?.length || 0 })));
        dispatch(addBoards(validBoards));
        
        // Check if current activeBoardId points to a valid board
        const currentActiveBoardId = getState().board.activeBoardId;
        const currentBoardExists = currentActiveBoardId 
          ? validBoards.find(b => String(b.id) === String(currentActiveBoardId)) || 
            board.boards.find(b => String(b.id) === String(currentActiveBoardId))
          : null;
        
        // If activeBoardId exists but board doesn't exist (deleted), clear it and load most recent
        if (currentActiveBoardId && currentActiveBoardId !== 'root' && !currentBoardExists) {
          console.log('App startup - Current activeBoardId points to deleted board, clearing it:', currentActiveBoardId);
          dispatch(switchBoard(null));
        }
        
        // 如果沒有活動板，或當前活動板是 root / 不存在，則選擇「最早建立的」使用者板作為默認
        if (!currentActiveBoardId || currentActiveBoardId === 'root' || !currentBoardExists) {
          const sortedBoards = [...validBoards].sort((a, b) => {
            const getCreated = board => {
              if (board.created_at) return new Date(board.created_at);
              if (board.createdAt) return new Date(board.createdAt);
              const idNum = parseInt(String(board.id), 10);
              return isNaN(idNum) ? new Date(0) : new Date(idNum * 1000);
            };
            const aDate = getCreated(a);
            const bDate = getCreated(b);
            return aDate - bDate; // 最舊的在前面
          });
          const oldestBoard = sortedBoards[0];
          if (oldestBoard && oldestBoard.id) {
            console.log(
              'App startup - Setting active board to oldest user board:',
              oldestBoard.id,
              'with',
              oldestBoard.tiles?.length || 0,
              'tiles'
            );
            dispatch(switchBoard(oldestBoard.id));
          } else {
            // No valid boards, load root board
            console.log('App startup - No valid user boards, loading root board');
            const rootBoard = DEFAULT_BOARDS.advanced?.[0];
            if (rootBoard) {
              const rootBoardExists = board.boards.find(b => String(b.id) === String(rootBoard.id));
              if (!rootBoardExists) {
                dispatch(addBoards([rootBoard]));
              }
              dispatch(switchBoard(rootBoard.id));
              console.log('App startup - Loaded root board:', rootBoard.id);
            }
          }
        }
      } else {
        console.warn('App startup - No valid boards were fetched');
        // If no valid boards, try to load root board
        const { communicator } = getState();
        const currentCommunicator = communicator.communicators.find(
          c => c.id === communicator.activeCommunicatorId
        );
        const rootBoardId = currentCommunicator?.rootBoard;
        
        if (rootBoardId) {
          console.log('App startup - No valid boards, loading root board:', rootBoardId);
          const rootBoard = DEFAULT_BOARDS.advanced?.[0];
          if (rootBoard) {
            const rootBoardExists = board.boards.find(b => String(b.id) === String(rootBoard.id));
            if (!rootBoardExists) {
              dispatch(addBoards([rootBoard]));
            }
            dispatch(switchBoard(rootBoard.id));
            console.log('App startup - Loaded root board:', rootBoard.id);
          }
        } else {
          // No root board either, load default root board
          console.log('App startup - No root board, loading default root board');
          const rootBoard = DEFAULT_BOARDS.advanced?.[0];
          if (rootBoard) {
            const rootBoardExists = board.boards.find(b => String(b.id) === String(rootBoard.id));
            if (!rootBoardExists) {
              dispatch(addBoards([rootBoard]));
            }
            dispatch(switchBoard(rootBoard.id));
            console.log('App startup - Loaded default root board:', rootBoard.id);
          }
        }
      }
    } catch (error) {
      console.error('App startup - Error loading boards:', error);
      // Don't throw - allow app to continue even if board loading fails
    }
  };
}

export function updateUserDataFromAPI() {
  return async (dispatch, getState) => {
    const {
      app: { userData }
    } = getState();
    if (!userData) return;
    try {
      const { id } = userData;
      const newUserData = await API.getUserData(id);
      dispatch(updateUserData({ ...userData, ...newUserData }));

      if (newUserData.settings?.speech?.elevenLabsApiKey) {
        dispatch(
          changeElevenLabsApiKey(newUserData.settings.speech.elevenLabsApiKey)
        );
        tts.initElevenLabsInstance(
          newUserData.settings.speech.elevenLabsApiKey
        );
      }
      
      // Load user boards if user is already logged in
      await dispatch(loadUserBoardsOnStartup());
    } catch (error) {
      // Only log non-network errors to reduce console noise
      const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error';
      if (!isNetworkError || navigator.onLine) {
        console.error(error);
      }
      //could show an alert and offer the posibility of rerun de update.
    }
  };
}

export function updateUnloggedUserLocation() {
  return async (dispatch, getState) => {
    const {
      app: { unloggedUserLocation }
    } = getState();
    try {
      if (unloggedUserLocation) return;
      const location = await API.getUserLocation();
      if (location) {
        dispatch(setUnloggedUserLocation(location));
        dispatch(updateIsInFreeCountry());
        return;
      }
      // Location is optional - don't throw error if null
      // This can happen when offline or when location service is unavailable
    } catch (error) {
      // Only log non-network errors (location is optional, network errors are expected)
      const isNetworkError = error?.code === 'ERR_NETWORK' || 
                            error?.message === 'Network Error' ||
                            error?.code === 'ECONNABORTED' ||
                            error?.message?.includes('timeout');
      if (!isNetworkError) {
        // Log only unexpected errors (not network/timeout errors)
        console.warn('Error during localization of the unlogged user (non-critical):', error);
      }
      // Silently fail for network errors - location is optional
    }
  };
}
