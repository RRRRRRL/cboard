import moment from 'moment';

import { DEFAULT_BOARDS, deepCopy } from '../../helpers';

import {
  IMPORT_BOARDS,
  ADD_BOARDS,
  CHANGE_BOARD,
  SWITCH_BOARD,
  PREVIOUS_BOARD,
  TO_ROOT_BOARD,
  CREATE_BOARD,
  UPDATE_BOARD,
  DELETE_BOARD,
  CREATE_TILE,
  DELETE_TILES,
  EDIT_TILES,
  FOCUS_TILE,
  CHANGE_OUTPUT,
  CHANGE_IMPROVED_PHRASE,
  REPLACE_BOARD,
  HISTORY_REMOVE_BOARD,
  UNMARK_BOARD,
  CHANGE_LIVE_MODE,
  CREATE_API_BOARD_SUCCESS,
  CREATE_API_BOARD_FAILURE,
  CREATE_API_BOARD_STARTED,
  UPDATE_API_BOARD_SUCCESS,
  UPDATE_API_BOARD_FAILURE,
  UPDATE_API_BOARD_STARTED,
  DELETE_API_BOARD_SUCCESS,
  DELETE_API_BOARD_FAILURE,
  DELETE_API_BOARD_STARTED,
  GET_API_MY_BOARDS_SUCCESS,
  GET_API_MY_BOARDS_FAILURE,
  GET_API_MY_BOARDS_STARTED,
  DOWNLOAD_IMAGES_STARTED,
  DOWNLOAD_IMAGE_SUCCESS,
  DOWNLOAD_IMAGE_FAILURE,
  SET_PROFILES,
  UNMARK_SHOULD_CREATE_API_BOARD,
  SHORT_ID_MAX_LENGTH
} from './Board.constants';
import { LOGOUT, LOGIN_SUCCESS } from '../Account/Login/Login.constants';

const initialBoardsState = [
  ...DEFAULT_BOARDS.advanced,
  ...DEFAULT_BOARDS.picSeePal
];

const initialState = {
  boards: deepCopy(initialBoardsState),
  output: [],
  activeBoardId: null,
  navHistory: [],
  isFetching: false,
  images: [],
  isFixed: false,
  isLiveMode: false,
  improvedPhrase: '',
  profiles: []
};

function hasRealTiles(board) {
  if (!board || !Array.isArray(board.tiles)) return false;
  if (board.tiles.length === 0) return false;
  // 視為「有真實 tiles」的前提：至少有一個元素是 object（而不是純 null / primitive）
  return board.tiles.some(tile => tile && typeof tile === 'object');
}

function reconcileBoards(localBoard, remoteBoard) {
  // 別把「全是 null 的虛擬 tiles（列表用）」當成有 tiles
  const localHasTiles = hasRealTiles(localBoard);
  const remoteHasTiles = hasRealTiles(remoteBoard);
  
  if (localHasTiles && !remoteHasTiles) {
    return localBoard;
  }
  if (!localHasTiles && remoteHasTiles) {
    return remoteBoard;
  }
  
  // If both have tiles or both don't have tiles, use lastEdited to decide
  if (localBoard.lastEdited && remoteBoard.lastEdited) {
    if (moment(localBoard.lastEdited).isSameOrAfter(remoteBoard.lastEdited)) {
      return localBoard;
    }
    if (moment(localBoard.lastEdited).isBefore(remoteBoard.lastEdited)) {
      return remoteBoard;
    }
  }
  
  // If remote board has more tiles, prefer it (for cases where tiles were added)
  if (remoteHasTiles && localHasTiles) {
    const localTilesCount = localBoard.tiles.length;
    const remoteTilesCount = remoteBoard.tiles.length;
    if (remoteTilesCount > localTilesCount) {
      return remoteBoard;
    }
  }
  
  return localBoard;
}

function resolveLastEdited(oldBoard, newBoard) {
  const oldDate = oldBoard?.lastEdited ? moment(oldBoard.lastEdited) : null;
  const newDate = newBoard?.lastEdited ? moment(newBoard.lastEdited) : null;

  if (newDate && (!oldDate || oldDate.isBefore(newDate))) {
    return newDate.format();
  }
  return moment().format();
}

function tileReducer(board, action) {
  switch (action.type) {
    case CREATE_TILE:
      return {
        ...board,
        tiles: [...board.tiles, { ...action.tile }]
        /* some times when a tile folder is created here the last tile change loadBoard to a long Id with no reason
      action tile before this copy has a short ID*/
      };
    case DELETE_TILES:
      return {
        ...board,
        tiles: board.tiles.filter(tile => action.tiles.indexOf(tile.id) === -1)
      };
    case EDIT_TILES:
      return {
        ...board,
        tiles: board.tiles.map(
          tile => action.tiles.find(s => s.id === tile.id) || tile
        )
      };
    default:
      return board;
  }
}

function boardReducer(state = initialState, action) {
  //fix to prevent for null board
  state.boards = state.boards.filter(board => board !== null);
  switch (action.type) {
    case LOGIN_SUCCESS:
      // Don't override activeBoardId if it's already set to a user board
      // The login action will set it to the most recent user board after this
      let activeBoardId = state.activeBoardId;
      const userCommunicators = action.payload.communicators || [];
      const activeCommunicator = userCommunicators.length
        ? userCommunicators[userCommunicators.length - 1]
        : null;

      // Only set rootBoard if activeBoardId is not already set
      // This allows the login action to set it to a user board instead
      if (activeCommunicator && !activeBoardId) {
        activeBoardId =
          activeCommunicator.rootBoard || initialState.activeBoardId;
      }

      return {
        ...state,
        activeBoardId,
        navHistory: activeBoardId ? [activeBoardId] : []
      };

    case LOGOUT:
      // On logout, reset to initial state and ensure we only have default boards
      // This prevents issues where user-modified root boards (with numeric IDs like 59)
      // remain in the boards array after logout, causing data corruption
      return { 
        ...initialState, 
        boards: deepCopy(initialBoardsState),
        activeBoardId: null,
        navHistory: []
      };

    case IMPORT_BOARDS:
      return {
        ...state,
        boards: action.boards
      };
    case ADD_BOARDS:
      // Support both a single board object or an array of boards
      const incoming = action.boards;
      const newBoardsArray = Array.isArray(incoming) ? incoming : (incoming ? [incoming] : []);

      // Reconcile boards: replace existing boards with same ID, add new ones
      const existingBoards = [...state.boards];
      const newBoards = newBoardsArray;

      // Determine if this is a complete refresh of user boards
      // If all new boards have the same user_id (and it's not a system user), 
      // we should remove user boards that are no longer in the new list
      const newBoardUserIds = new Set(
        newBoards
          .filter(Boolean)
          .map(b => b.user_id || b.email)
          .filter(id => id && id !== 'support@cboard.io' && id !== 1)
      );
      // Also check if action explicitly indicates this is a complete refresh
      const isCompleteUserRefresh = (action.isCompleteRefresh === true) || 
        (newBoardUserIds.size === 1 && newBoardUserIds.size > 0);
      
      // For each new board, either replace existing or add new
      // Ensure all IDs are strings for consistent comparison
      const newBoardIds = new Set();
      newBoards.forEach(newBoard => {
        if (!newBoard) return;
        const newBoardId = String(newBoard.id || '');
        if (!newBoardId) {
          return;
        }
        newBoardIds.add(newBoardId);
        const existingIndex = existingBoards.findIndex(b => String(b.id || '') === newBoardId);
        if (existingIndex >= 0) {
          // Replace existing board with new one (which has tiles from server)
          existingBoards[existingIndex] = reconcileBoards(existingBoards[existingIndex], newBoard);
        } else {
          // Add new board only if it doesn't already exist (prevent duplicates)
          const alreadyExists = existingBoards.some(b => String(b.id || '') === newBoardId);
          if (!alreadyExists) {
            existingBoards.push(newBoard);
          }
        }
      });
      
      // If this is a complete refresh of user boards, remove user boards that are no longer in the API response
      // But keep system boards and public profiles
      let finalBoards = existingBoards;
      if (isCompleteUserRefresh && newBoardUserIds.size > 0) {
        const userIdToKeep = Array.from(newBoardUserIds)[0];
        finalBoards = existingBoards.filter(board => {
          // Keep the board if:
          // 1. It's in the new boards list (already added/replaced above)
          // 2. It's a system board (support@cboard.io or user_id = 1)
          // 3. It's a public profile (is_public = true)
          // 4. It doesn't belong to the user being refreshed
          const boardIdStr = String(board.id || '');
          if (newBoardIds.has(boardIdStr)) {
            return true; // Keep boards in the new list
          }
          if (board.email === 'support@cboard.io' || board.user_id === 1) {
            return true; // Keep system boards
          }
          if (board.is_public === true || board.isPublic === true) {
            return true; // Keep public profiles
          }
          // Remove user boards that are no longer in the API response
          const boardUserId = board.user_id || board.email;
          if (boardUserId && String(boardUserId) === String(userIdToKeep)) {
            return false; // Remove user board that's no longer in API
          }
          return true; // Keep other boards (backward compatibility)
        });
      }
      
      console.log('ADD_BOARDS - Boards after reconciliation:', {
        totalBoards: finalBoards.length,
        boardsWithTiles: finalBoards.filter(b => b.tiles && b.tiles.length > 0).length,
        boardIds: finalBoards.map(b => ({ id: b.id, tilesCount: b.tiles?.length || 0 })),
        isCompleteUserRefresh,
        removedCount: existingBoards.length - finalBoards.length
      });
      
      return {
        ...state,
        boards: finalBoards
      };
    case CHANGE_BOARD:
      const taBoards = [...state.boards];
      const taBoard = taBoards.find(item => item.id === action.boardId);
      if (!taBoard) {
        return { ...state };
      }
      const fixed = taBoard.isFixed || false;
      return {
        ...state,
        navHistory: Array.from(new Set([...state.navHistory, action.boardId])),
        activeBoardId: action.boardId,
        isFixed: fixed
      };
    case UPDATE_BOARD:
      const updateBoards = [...state.boards];
      const oldBoard = updateBoards.find(
        item => item.id === action.boardData.id
      );
      const index = updateBoards.indexOf(oldBoard);
      if (index !== -1) {
        const nextBoard = {
          ...action.boardData,
          lastEdited: resolveLastEdited(oldBoard, action.boardData)
        };
        updateBoards.splice(index, 1, nextBoard);
        return {
          ...state,
          boards: updateBoards
        };
      }
      return {
        ...state
      };

    case REPLACE_BOARD:
      const nH = [...state.navHistory];
      const { prev, current } = action.payload;
      let boards = [...state.boards];

      if (prev.id !== current.id) {
        const boardIndex = boards.findIndex(b => b.id === prev.id);
        /* On create a parent board the prev board doesn't exist with a short Id
        because is already replaced by a long one */
        if (boardIndex >= 0) {
          boards[boardIndex] = current;
        }
        const nhIndex = nH.findIndex(bId => bId === prev.id);
        if (nhIndex >= 0) {
          nH[nhIndex] = current.id;
        }
      } else {
        const boardIndex = boards.findIndex(b => b.id === current.id);
        if (boardIndex >= 0) {
          boards[boardIndex] = current;
        }
      }

      return {
        ...state,
        boards,
        navHistory: nH,
        activeBoardId:
          state.activeBoardId === prev.id ? current.id : state.activeBoardId
      };

    case SWITCH_BOARD:
      return {
        ...state,
        navHistory: [action.boardId],
        activeBoardId: action.boardId
      };
    case PREVIOUS_BOARD:
      const [...navHistory] = state.navHistory;
      if (navHistory.length === 1) {
        return state;
      }
      navHistory.pop();
      return {
        ...state,
        navHistory,
        activeBoardId: navHistory[navHistory.length - 1]
      };
    case TO_ROOT_BOARD:
      const [...navigationHistory] = state.navHistory;
      if (navigationHistory.length <= 1) {
        return state;
      }
      return {
        ...state,
        navHistory: [navigationHistory[0]],
        activeBoardId: navigationHistory[0]
      };
    case HISTORY_REMOVE_BOARD:
      const dnavHistory = [...state.navHistory];
      if (dnavHistory.length < 2) {
        return state;
      }
      for (var i = 0; i < dnavHistory.length; i++) {
        if (dnavHistory[i] === action.removedBoardId) {
          dnavHistory.splice(i, 1);
        }
      }
      return {
        ...state,
        navHistory: dnavHistory
      };
    case CREATE_BOARD:
      const nextBoards = [...state.boards];
      nextBoards.push({
        ...action.boardData,
        lastEdited: moment().format()
      });
      return {
        ...state,
        boards: nextBoards
      };
    case DELETE_BOARD:
      // boardId can be a string or number, convert to string for comparison
      const boardIdToDelete = String(action.boardId);
      return {
        ...state,
        boards: state.boards.filter(
          board => String(board.id) !== boardIdToDelete
        )
      };

    case CREATE_TILE:
      return {
        ...state,
        boards: state.boards.map(board =>
          board.id !== action.boardId ? board : tileReducer(board, action)
        )
      };
    case DELETE_TILES:
      return {
        ...state,
        boards: state.boards.map(board =>
          board.id !== action.boardId ? board : tileReducer(board, action)
        )
      };
    case EDIT_TILES:
      return {
        ...state,
        boards: state.boards.map(board =>
          board.id !== action.boardId ? board : tileReducer(board, action)
        )
      };
    case FOCUS_TILE:
      return {
        ...state,
        boards: state.boards.map(board =>
          board.id !== action.boardId
            ? board
            : { ...board, focusedTileId: action.tileId }
        )
      };
    case UNMARK_BOARD:
      return {
        ...state,
        boards: state.boards.map(board =>
          board.id !== action.boardId
            ? board
            : { ...board, markToUpdate: false }
        )
      };
    case UNMARK_SHOULD_CREATE_API_BOARD:
      return {
        ...state,
        boards: state.boards.map(board =>
          board.id !== action.boardId
            ? board
            : { ...board, shouldCreateBoard: false }
        )
      };
    case CHANGE_OUTPUT:
      return {
        ...state,
        output: [...action.output]
      };
    case CHANGE_LIVE_MODE:
      return {
        ...state,
        isLiveMode: !state.isLiveMode
      };
    case CREATE_API_BOARD_SUCCESS:
      const creadBoards = [...state.boards];
      const tilesToUpdateIds = [];
      const boardsToMarkForCreation = [];
      for (let i = 0; i < creadBoards.length; i++) {
        let tiles = creadBoards[i].tiles;
        if (tiles) {
          for (let j = 0; j < tiles.length; j++) {
            if (tiles[j] != null && tiles[j].loadBoard === action.boardId) {
              creadBoards[i].tiles[j].loadBoard = action.board.id;
              if (
                creadBoards[i].id.length > 14 &&
                creadBoards[i].hasOwnProperty('email')
              ) {
                creadBoards[i].markToUpdate = true;
                const tileUpdatedId = creadBoards[i].tiles[j].id;
                tilesToUpdateIds.push(tileUpdatedId);
              }

              const shouldCreateBoard =
                creadBoards[i].id.length < SHORT_ID_MAX_LENGTH;
              if (shouldCreateBoard) {
                boardsToMarkForCreation.push(creadBoards[i]);
              }
            }
          }
        }
      }
      boardsToMarkForCreation.forEach(board => {
        //if the tile id is already in a api board, we don't need to create it
        const boardTileIds = board.tiles.map(tile => tile.id);
        const boardIsAlreadyCreatedOnDb = boardTileIds.some(tileId =>
          tilesToUpdateIds.includes(tileId)
        );
        if (!boardIsAlreadyCreatedOnDb) board.shouldCreateBoard = true;
      });
      return {
        ...state,
        isFetching: false,
        boards: creadBoards.map(board =>
          board.id === action.boardId
            ? { ...board, id: action.board.id }
            : board
        )
      };
    case CREATE_API_BOARD_FAILURE:
      return {
        ...state,
        isFetching: false
      };
    case CREATE_API_BOARD_STARTED:
      return {
        ...state,
        isFetching: true
      };
    case UPDATE_API_BOARD_SUCCESS:
      return {
        ...state,
        isFetching: false
      };
    case UPDATE_API_BOARD_FAILURE:
      return {
        ...state,
        isFetching: false
      };
    case UPDATE_API_BOARD_STARTED:
      return {
        ...state,
        isFetching: true
      };
    case GET_API_MY_BOARDS_SUCCESS:
      let flag = false;
      const myBoards = [...state.boards];
      // Handle different response formats: {data: [...]} or [...] or {boards: [...]}
      let boardsArray =
        action.boards?.data || action.boards?.boards || action.boards || [];
      if (!Array.isArray(boardsArray)) {
        console.warn(
          'GET_API_MY_BOARDS_SUCCESS: Expected array but got:',
          boardsArray
        );
        return {
          ...state,
          isFetching: false
        };
      }
      
      // Transform image URLs to use current backend address (in case not already transformed in API)
      const { transformBoardsImageUrls } = require('../../utils/imageUrlTransformer');
      boardsArray = transformBoardsImageUrls(boardsArray);
      
      for (let i = 0; i < boardsArray.length; i++) {
        for (let j = 0; j < myBoards.length; j++) {
          if (myBoards[j].id === boardsArray[i].id) {
            myBoards[j] = reconcileBoards(myBoards[j], boardsArray[i]);
            flag = true;
            break;
          }
        }
        if (!flag) {
          myBoards.push(boardsArray[i]);
        }
        flag = false;
      }
      return {
        ...state,
        isFetching: false,
        boards: myBoards
      };
    case GET_API_MY_BOARDS_FAILURE:
      return {
        ...state,
        isFetching: false
      };
    case GET_API_MY_BOARDS_STARTED:
      return {
        ...state,
        isFetching: true
      };
    case DELETE_API_BOARD_SUCCESS:
      return {
        ...state,
        isFetching: false,
        boards: state.boards.filter(board => board.id !== action.board.id)
      };
    case DELETE_API_BOARD_FAILURE:
      return {
        ...state,
        isFetching: false
      };
    case DELETE_API_BOARD_STARTED:
      return {
        ...state,
        isFetching: true
      };
    case DOWNLOAD_IMAGES_STARTED:
      if (!Array.isArray(state.images)) {
        return {
          ...state,
          images: []
        };
      }
      return state;
    case DOWNLOAD_IMAGE_SUCCESS:
      const imgs = [...state.images];
      imgs.push(action.element);
      return {
        ...state,
        images: imgs
      };
    case DOWNLOAD_IMAGE_FAILURE:
      return {
        ...state
      };
    case CHANGE_IMPROVED_PHRASE:
      return {
        ...state,
        improvedPhrase: action.improvedPhrase
      };
    case SET_PROFILES:
      return {
        ...state,
        profiles: action.profiles || []
      };
    default:
      return state;
  }
}

export default boardReducer;
