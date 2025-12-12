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
      throw new Error('unable to get location');
    } catch {
      console.error('error during localization of the logged user');
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
      console.log('App startup - No user data, skipping board load');
      return;
    }
    
    try {
      console.log('App startup - Loading user boards for:', userData.email);
      
      // Get user's boards from API
      const boardsResponse = await API.getMyBoards({ page: 1, limit: 50 });
      
      // Handle different response formats
      let boardsList = [];
      if (Array.isArray(boardsResponse)) {
        boardsList = boardsResponse;
      } else if (boardsResponse?.boards && Array.isArray(boardsResponse.boards)) {
        boardsList = boardsResponse.boards;
      } else if (boardsResponse?.data?.boards && Array.isArray(boardsResponse.data.boards)) {
        boardsList = boardsResponse.data.boards;
      }
      
      if (!boardsList || boardsList.length === 0) {
        console.log('App startup - No boards found for user');
        // Still check if we need to set active board from existing boards
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
      
      console.log('App startup - Found boards metadata:', boardsList.length);
      
      // Extract board IDs
      const boardIds = boardsList
        .map(b => b.board_id || b.id)
        .filter(id => id && typeof id === 'string' && id.length > 0);
      
      if (boardIds.length === 0) {
        console.log('App startup - No valid board IDs found');
        return;
      }
      
      // Get local boards to avoid duplicates
      const localBoardsIds = (board.boards || []).map(b => b.id).filter(Boolean);
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
            console.log('App startup - Board fetched:', { 
              id, 
              name: boardData?.name, 
              tilesCount: boardData?.tiles?.length || 0 
            });
          } catch (e) {
            console.error('App startup - Error fetching board:', id, e.message);
          }
          return boardData;
        })
      );
      
      const validBoards = apiBoards.filter(b => b !== null && b !== undefined);
      
      if (validBoards.length > 0) {
        console.log('App startup - Loaded boards:', validBoards.length, 
          validBoards.map(b => ({ id: b.id, name: b.name, tilesCount: b.tiles?.length || 0 })));
        dispatch(addBoards(validBoards));
        
        // If no active board is set or active board is root, set the most recently edited one as active
        const currentActiveBoardId = getState().board.activeBoardId;
        if (!currentActiveBoardId || currentActiveBoardId === 'root') {
          const sortedBoards = [...validBoards].sort((a, b) => {
            const aDate = a.lastEdited ? new Date(a.lastEdited) : new Date(0);
            const bDate = b.lastEdited ? new Date(b.lastEdited) : new Date(0);
            return bDate - aDate;
          });
          const mostRecentBoard = sortedBoards[0];
          if (mostRecentBoard && mostRecentBoard.id) {
            console.log('App startup - Setting active board to most recent:', mostRecentBoard.id, 'with', mostRecentBoard.tiles?.length || 0, 'tiles');
            dispatch(switchBoard(mostRecentBoard.id));
          }
        }
      } else {
        console.warn('App startup - No valid boards were fetched');
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
      console.error(error);
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
      throw new Error('unable to get location');
    } catch {
      console.error('error during localization of the unlogged user');
    }
  };
}
