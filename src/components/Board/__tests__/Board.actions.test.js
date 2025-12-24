import * as actions from '../Board.actions';
import * as types from '../Board.constants';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import defaultBoards from '../../../api/boards.json';
import API from '../../../api/api';

jest.mock('../../../api/api', () => ({
  updateBoard: jest.fn(),
  createBoard: jest.fn(),
  deleteBoard: jest.fn(),
  getMyBoards: jest.fn(),
  getBoard: jest.fn(),
  getProfiles: jest.fn(),
  createCommunicator: jest.fn().mockResolvedValue({ id: 'cboard_default' })
}));

// Board.actions.js imports API from '../../api' (which re-exports './api'),
// so we also need to mock that module to point to the same mocked API.
jest.mock('../../api', () => require('../../../api/api'));

const mockStore = configureMockStore([thunk]);

const mockBoard = {
  name: 'tewt',
  id: '12345678901234567',
  tiles: [{ id: '1234567890123456', loadBoard: '456456456456456456456' }],
  isPublic: false,
  email: 'asd@qwe.com',
  markToUpdate: true
};
const mockComm = {
  id: 'cboard_default',
  name: "Cboard's Communicator",
  description: "Cboard's default communicator",
  author: 'Cboard Team',
  email: 'support@cboard.io',
  rootBoard: '12345678901234567',
  boards: ['root', '12345678901234567']
};

const [...boards] = defaultBoards.advanced;
const initialState = {
  board: {
    boards: [mockBoard],
    output: [],
    activeBoardId: null,
    navHistory: [],
    isFetching: false
  },
  communicator: {
    activeCommunicatorId: mockComm.id,
    communicators: [mockComm]
  },
  app: {
    userData: {
      email: 'asd@qwe.com'
    },
    navigationSettings: {
      improvePhraseActive: false
    }
  }
};

describe('actions', () => {
  it('should create an action to REPLACE_ME', () => {
    const boards = {};
    const expectedAction = {
      type: types.IMPORT_BOARDS,
      boards
    };
    expect(actions.importBoards(boards)).toEqual(expectedAction);
  });

  it('should create an action to REPLACE_ME', () => {
    const boards = {};
    const expectedAction = {
      type: types.ADD_BOARDS,
      boards,
      isCompleteRefresh: false
    };
    expect(actions.addBoards(boards)).toEqual(expectedAction);
  });

  it('should create an action to REPLACE_ME', () => {
    const prev = {};
    const current = {};

    const expectedAction = {
      type: types.REPLACE_BOARD,
      payload: { prev, current }
    };

    expect(actions.replaceBoard(prev, current)).toEqual(expectedAction);
  });

  it('should create an action to REPLACE_ME', () => {
    const boardData = {};
    const expectedAction = {
      type: types.CREATE_BOARD,
      boardData
    };
    expect(actions.createBoard(boardData)).toEqual(expectedAction);
  });

  it('should create an action to REPLACE_ME', () => {
    const boardData = {};
    const expectedAction = {
      type: types.UPDATE_BOARD,
      boardData
    };
    expect(actions.updateBoard(boardData)).toEqual(expectedAction);
  });

  it('should create an action to REPLACE_ME', () => {
    const boardId = '123';
    const expectedAction = {
      type: types.DELETE_BOARD,
      boardId
    };
    expect(actions.deleteBoard(boardId)).toEqual(expectedAction);
  });

  it('should create an action to REPLACE_ME', () => {
    const boardId = '123';
    const expectedAction = {
      type: types.SWITCH_BOARD,
      boardId
    };
    expect(actions.switchBoard(boardId)).toEqual(expectedAction);
  });

  it('should create an action to REPLACE_ME', () => {
    const boardId = '123';
    const expectedAction = {
      type: types.CHANGE_BOARD,
      boardId
    };
    expect(actions.changeBoard(boardId)).toEqual(expectedAction);
  });

  it('should create an action to REPLACE_ME', () => {
    const store = mockStore(() => initialState);
    const expectedAction = {
      type: types.PREVIOUS_BOARD
    };
    store.dispatch(actions.previousBoard());
    const dispatchedActions = store.getActions();
    expect(dispatchedActions).toEqual([expectedAction]);
  });

  it('should create an action to REPLACE_ME', () => {
    const store = mockStore(() => initialState);
    const expectedActions = [{ type: types.TO_ROOT_BOARD }];
    store.dispatch(actions.toRootBoard());
    const dispatchedActions = store.getActions();
    expect(dispatchedActions).toEqual(expectedActions);
  });

  it('should create an action to REPLACE_ME', () => {
    const boardId = '123';
    const expectedAction = {
      type: types.HISTORY_REMOVE_BOARD,
      removedBoardId: boardId
    };
    expect(actions.historyRemoveBoard(boardId)).toEqual(expectedAction);
  });

  it('should create an action to REPLACE_ME', () => {
    const boardId = '123';
    const expectedAction = {
      type: types.UNMARK_BOARD,
      boardId
    };
    expect(actions.unmarkBoard(boardId)).toEqual(expectedAction);
  });

  it('should create an action to REPLACE_ME', () => {
    const tile = {};
    const boardId = '123';
    const expectedAction = {
      type: types.CREATE_TILE,
      tile,
      boardId
    };
    expect(actions.createTile(tile, boardId)).toEqual(expectedAction);
  });

  it('should create an action to REPLACE_ME', () => {
    const tiles = [{}, {}];
    const boardId = '123';
    const expectedAction = {
      type: types.DELETE_TILES,
      tiles,
      boardId
    };
    expect(actions.deleteTiles(tiles, boardId)).toEqual(expectedAction);
  });

  it('should create an action to REPLACE_ME', () => {
    const tiles = [{}, {}];
    const boardId = '123';
    const expectedAction = {
      type: types.EDIT_TILES,
      tiles,
      boardId
    };
    expect(actions.editTiles(tiles, boardId)).toEqual(expectedAction);
  });

  it('should create an action to REPLACE_ME', () => {
    const tileId = '10';
    const boardId = '123';
    const expectedAction = {
      type: types.FOCUS_TILE,
      tileId,
      boardId
    };
    expect(actions.focusTile(tileId, boardId)).toEqual(expectedAction);
  });

  it('should create an action to REPLACE_ME', () => {
    const output = [{}, {}];
    const expectedActions = [
      {
        type: types.CHANGE_OUTPUT,
        output
      }
    ];

    const store = mockStore(initialState);
    store.dispatch(actions.changeOutput(output));
    const dispatchedActions = store.getActions();
    expect(dispatchedActions).toEqual(expectedActions);
  });

  it('should create an action to REPLACE_ME', () => {
    const boards = [{}];
    const expectedAction = {
      type: types.GET_API_MY_BOARDS_SUCCESS,
      boards
    };
    expect(actions.getApiMyBoardsSuccess(boards)).toEqual(expectedAction);
  });

  it('should create an action to REPLACE_ME', () => {
    const expectedAction = {
      type: types.GET_API_MY_BOARDS_STARTED
    };
    expect(actions.getApiMyBoardsStarted()).toEqual(expectedAction);
  });

  it('should create an action to REPLACE_ME', () => {
    const message = 'dummy message';
    const expectedAction = {
      type: types.GET_API_MY_BOARDS_FAILURE,
      message
    };
    expect(actions.getApiMyBoardsFailure(message)).toEqual(expectedAction);
  });

  it('should create an action to REPLACE_ME', () => {
    const board = {};
    const expectedAction = {
      type: types.CREATE_API_BOARD_SUCCESS,
      board
    };
    expect(actions.createApiBoardSuccess(board)).toEqual(expectedAction);
  });
  it('should create an action to UPDATE_API_BOARD_SUCCESS', () => {
    const board = { isLocalUpdateNeeded: false, name: 'test' };
    const store = mockStore(initialState);

    const expectedActions = [
      {
        type: types.UPDATE_API_BOARD_SUCCESS,
        boardData: { name: 'test' }
      }
    ];

    store.dispatch(actions.updateApiBoardSuccess(board));
    const dispatchedActions = store.getActions();
    expect(dispatchedActions).toEqual(expectedActions);
  });
  it('should dispatch UPDATE_BOARD and UPDATE_API_BOARD_SUCCESS when isLocalUpdateNeeded is true', () => {
    const board = { isLocalUpdateNeeded: true, name: 'test' };
    const store = mockStore(initialState);

    const expectedActions = [
      {
        type: types.UPDATE_BOARD,
        boardData: { name: 'test' }
      },
      {
        type: types.UPDATE_API_BOARD_SUCCESS,
        boardData: { name: 'test' }
      }
    ];

    store.dispatch(actions.updateApiBoardSuccess(board));
    const dispatchedActions = store.getActions();
    expect(dispatchedActions).toEqual(expectedActions);
  });
  it('should create an action to REPLACE_ME', () => {
    const expectedAction = {
      type: types.UPDATE_API_BOARD_STARTED
    };
    expect(actions.updateApiBoardStarted()).toEqual(expectedAction);
  });
  it('should create an action to REPLACE_ME', () => {
    const message = 'dummy message';
    const expectedAction = {
      type: types.UPDATE_API_BOARD_FAILURE,
      message
    };
    expect(actions.updateApiBoardFailure(message)).toEqual(expectedAction);
  });
  it('should create an action to REPLACE_ME', () => {
    const board = {};
    const expectedAction = {
      type: types.DELETE_API_BOARD_SUCCESS,
      board
    };
    expect(actions.deleteApiBoardSuccess(board)).toEqual(expectedAction);
  });
  it('should create an action to REPLACE_ME', () => {
    const expectedAction = {
      type: types.DELETE_API_BOARD_STARTED
    };
    expect(actions.deleteApiBoardStarted()).toEqual(expectedAction);
  });
  it('should create an action to REPLACE_ME', () => {
    const message = {};
    const expectedAction = {
      type: types.DELETE_API_BOARD_FAILURE,
      message
    };
    expect(actions.deleteApiBoardFailure(message)).toEqual(expectedAction);
  });
  it('check getApiObjects', async () => {
    API.getMyBoards.mockResolvedValue([]);
    const store = mockStore(initialState);
    const data = await store.dispatch(actions.getApiObjects());
    // current implementation does not return a value, just ensure no error is thrown
    expect(data).toBeUndefined();
  });
  it('check updateApiMarkedBoards', async () => {
    API.updateBoard.mockResolvedValue(mockBoard);
    const store = mockStore(initialState);
    await store.dispatch(actions.updateApiMarkedBoards());
    // Test passes if no error is thrown
  });
  it('check getApiMyBoards', async () => {
    API.getMyBoards.mockResolvedValue([mockBoard]);
    const store = mockStore(initialState);
    await store.dispatch(actions.getApiMyBoards());
    const dispatchedActions = store.getActions();
    expect(dispatchedActions[0]).toEqual({ type: types.GET_API_MY_BOARDS_STARTED });
  });
  it('check createApiBoard', async () => {
    API.createBoard.mockResolvedValue(mockBoard);
    const store = mockStore(initialState);
    
    const data = await store.dispatch(actions.createApiBoard(mockBoard, '12345678901234567'));
    const dispatchedActions = store.getActions();
    const dataResp = {
      board: mockBoard,
      boardId: '12345678901234567',
      type: 'cboard/Board/CREATE_API_BOARD_SUCCESS'
    };
    expect(dispatchedActions[1]).toEqual(dataResp);
    expect(data).toEqual(mockBoard);
  });
  it('check createApiBoard error', async () => {
    const error = { message: 'error' };
    API.createBoard.mockRejectedValue(error);
    const store = mockStore(initialState);
    
    try {
      await store.dispatch(actions.createApiBoard({ error: 'error' }, '12345678901234567'));
      throw new Error('An error was expected');
    } catch (e) {
      const dispatchedActions = store.getActions();
      const dataResp = {
        message: 'error',
        type: 'cboard/Board/CREATE_API_BOARD_FAILURE'
      };
      expect(dispatchedActions[1]).toEqual(dataResp);
    }
  });
  it('check updateApiBoard', async () => {
    API.updateBoard.mockResolvedValue(mockBoard);
    const store = mockStore(initialState);
    
    const result = await store.dispatch(actions.updateApiBoard(mockBoard));
    expect(result).toEqual(mockBoard);
    
    const dispatchedActions = store.getActions();
    expect(dispatchedActions[0]).toEqual({ type: types.UPDATE_API_BOARD_STARTED });
    expect(dispatchedActions[1]).toEqual({
      type: types.UPDATE_API_BOARD_SUCCESS,
      boardData: mockBoard
    });
  });
  it('check updateApiBoard error', async () => {
    const error = { message: 'error' };
    API.updateBoard.mockRejectedValue(error);
    const store = mockStore(initialState);
    
    try {
      await store.dispatch(actions.updateApiBoard({ error: 'error' }));
      throw new Error('An error was expected');
    } catch (e) {
      const dispatchedActions = store.getActions();
      expect(dispatchedActions[0]).toEqual({ type: types.UPDATE_API_BOARD_STARTED });
      expect(dispatchedActions[1]).toEqual({
        type: types.UPDATE_API_BOARD_FAILURE,
        message: 'error'
      });
    }
  });
  it('check deleteApiBoard', async () => {
    API.deleteBoard.mockResolvedValue(mockBoard);
    const store = mockStore(initialState);
    
    const data = await store.dispatch(actions.deleteApiBoard('12345678901234567'));
    expect(data).toEqual(mockBoard);
  });
  it('check deleteApiBoard error', async () => {
    const error = { message: 'error' };
    API.deleteBoard.mockRejectedValue(error);
    const store = mockStore(initialState);
    
    try {
      await store.dispatch(actions.deleteApiBoard('error'));
      throw new Error('An error was expected');
    } catch (e) {
      const dispatchedActions = store.getActions();
      const dataResp = {
        message: 'error',
        type: 'cboard/Board/DELETE_API_BOARD_FAILURE'
      };
      expect(dispatchedActions[1]).toEqual(dataResp);
    }
  });
  it('check updateApiObjectsNoChild', async () => {
    API.updateBoard.mockResolvedValue(mockBoard);
    const store = mockStore(initialState);
    const data = await store.dispatch(actions.updateApiObjectsNoChild(mockBoard));
    expect(data).toEqual('12345678901234567');
  });
  it('check updateApiObjectsNoChild true / false', async () => {
    API.updateBoard.mockResolvedValue(mockBoard);
    const store = mockStore(initialState);
    const data = await store.dispatch(actions.updateApiObjectsNoChild(mockBoard, true));
    expect(data).toEqual('12345678901234567');
  });
  it('check updateApiObjectsNoChild true / true', async () => {
    API.updateBoard.mockResolvedValue(mockBoard);
    const store = mockStore(initialState);
    const data = await store.dispatch(actions.updateApiObjectsNoChild(mockBoard, true, true));
    expect(data).toEqual('12345678901234567');
  });
  it('check updateApiObjects', async () => {
    API.updateBoard.mockResolvedValue(mockBoard);
    const store = mockStore(initialState);
    const data = await store.dispatch(actions.updateApiObjects(mockBoard, mockBoard));
    expect(data).toEqual('12345678901234567');
  });
  it('check updateApiObjects true / false', async () => {
    API.updateBoard.mockResolvedValue(mockBoard);
    const store = mockStore(initialState);
    const data = await store.dispatch(actions.updateApiObjects(mockBoard, mockBoard, true));
    expect(data).toEqual('12345678901234567');
  });
  it('check updateApiObjects true / true', async () => {
    API.updateBoard.mockResolvedValue(mockBoard);
    const store = mockStore(initialState);
    const data = await store.dispatch(actions.updateApiObjects(mockBoard, mockBoard, true, true));
    expect(data).toEqual('12345678901234567');
  });
});
