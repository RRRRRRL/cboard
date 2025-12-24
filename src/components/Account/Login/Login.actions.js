import API from '../../../api';
import { LOGIN_SUCCESS, LOGOUT } from './Login.constants';
import { addBoards, switchBoard } from '../../Board/Board.actions';
import { updateScannerSettings } from '../../../providers/ScannerProvider/ScannerProvider.actions';
import {
  changeVoice,
  changePitch,
  changeRate,
  changeElevenLabsApiKey,
  getVoices
} from '../../../providers/SpeechProvider/SpeechProvider.actions';
import {
  disableTour,
  setUnloggedUserLocation,
  updateUnloggedUserLocation,
  enableAllTours,
  updateNavigationSettings
} from '../../App/App.actions';
import { getVoiceURI } from '../../../i18n';
import { isCordova, isElectron } from '../../../cordova-util';
import tts from '../../../providers/SpeechProvider/tts';
import { getEyeTrackingInstance } from '../../../utils/eyeTrackingIntegration';

export function loginSuccess(payload) {
  return dispatch => {
    dispatch({
      type: LOGIN_SUCCESS,
      payload
    });
    if (payload.isFirstLogin) firstLoginActions(dispatch, payload);

    if (isCordova() && !isElectron()) {
      try {
        window.FirebasePlugin.setUserId(payload.id);
      } catch (err) {
        console.error(err);
      }
    }
    if (!isCordova() && typeof window?.gtag === 'function')
      window.gtag('set', { user_id: payload.id });
  };
}

async function firstLoginActions(dispatch, payload) {
  try {
    await API.updateUser({ ...payload, isFirstLogin: false });
  } catch (err) {
    console.error(err);
  }
  dispatch(enableAllTours());
}

export function logout() {
  // Cleanup eye tracking immediately on logout
  try {
    const eyeTrackingInstance = getEyeTrackingInstance();
    if (eyeTrackingInstance) {
      console.log('[Logout] Cleaning up eye tracking...');
      eyeTrackingInstance.cleanup();
    }
  } catch (err) {
    console.warn('[Logout] Error cleaning up eye tracking:', err);
  }

  if (isCordova() && !isElectron())
    try {
      window.FirebasePlugin.setUserId(undefined);
    } catch (err) {
      console.error(err);
    }

  if (!isCordova() && typeof window?.gtag === 'function') {
    window.gtag('set', { user_id: null });
  }

  return async dispatch => {
    // Ensure scanning is fully disabled on logout
    try {
      dispatch(updateScannerSettings({ active: false }));
    } catch (e) {
      console.warn('[Logout] Failed to reset scanner settings:', e);
    }

    dispatch(updateNavigationSettings({ improvePhraseActive: false }));
    dispatch(setUnloggedUserLocation(null));
    dispatch(updateUnloggedUserLocation());
    dispatch(logoutSuccess());
  };
}

function logoutSuccess() {
  return {
    type: LOGOUT
  };
}

export function login({ email, password, activatedData }, type = 'local') {
  const setAVoice = async ({ loginData, dispatch, getState }) => {
    const elevenLabsApiKey = loginData?.settings?.speech?.elevenLabsApiKey;

    if (elevenLabsApiKey) {
      dispatch(changeElevenLabsApiKey(elevenLabsApiKey));
      tts.initElevenLabsInstance(elevenLabsApiKey);
      await dispatch(getVoices());
    }

    const {
      language: { lang: appLang },
      speech: {
        voices,
        options: { lang: deviceVoiceLang, voiceURI: deviceVoiceUri }
      }
    } = getState(); //ATENTION speech options on DB is under Speech directly. on state is under options
    const emptyVoiceString = 'empty voices';
    const appLanguageCode = appLang?.substring(0, 2);
    const deviceVoiceLanguageCode = deviceVoiceLang?.substring(0, 2);

    if (voices.length) {
      const uris = voices.map(v => {
        return v.voiceURI;
      });

      if (loginData.settings?.speech) {
        const userVoiceUri = loginData.settings.speech.voiceURI; //ATENTION speech options on DB is under Speech directly. on state is under options

        const userVoiceLanguage = voices.filter(
          voice => voice.voiceURI === userVoiceUri
        )[0]?.lang;

        const userVoiceLanguageCode = userVoiceLanguage?.substring(0, 2);

        if (
          userVoiceUri &&
          appLanguageCode === userVoiceLanguageCode &&
          uris.includes(userVoiceUri)
        ) {
          if (userVoiceUri !== deviceVoiceUri) {
            dispatch(changeVoice(userVoiceUri, userVoiceLanguage));
          }
          if (loginData.settings.speech.pitch) {
            dispatch(changePitch(loginData.settings.speech.pitch));
          }
          if (loginData.settings.speech.rate) {
            dispatch(changeRate(loginData.settings.speech.rate));
          }
          return;
        }
      }

      if (
        deviceVoiceUri &&
        deviceVoiceLanguageCode === appLanguageCode &&
        uris.includes(deviceVoiceUri)
      ) {
        return;
      }

      const defaultVoiceUri = getVoiceURI(appLang, voices);

      if (defaultVoiceUri === emptyVoiceString) {
        dispatch(changeVoice(emptyVoiceString, ''));
        return;
      }
      //if the api stored voice is unavailable. Set default voice
      const defaultVoiceLanguage = voices.filter(
        voice => voice.voiceURI === defaultVoiceUri
      )[0]?.lang;
      dispatch(changeVoice(defaultVoiceUri, defaultVoiceLanguage));
      return;
    }
    if (deviceVoiceLang === null) {
      dispatch(changeVoice(emptyVoiceString, ''));
      return;
    }
  };

  return async (dispatch, getState) => {
    try {
      const apiMethod = type === 'local' ? 'login' : 'oAuthLogin';
      const loginData = activatedData
        ? activatedData
        : await API[apiMethod](email, password);
      const { communicator, board } = getState();

      const activeCommunicatorId = communicator.activeCommunicatorId;
      let currentCommunicator = communicator.communicators.find(
        communicator => communicator.id === activeCommunicatorId
      );

      if (loginData.communicators && loginData.communicators.length) {
        const lastRemoteSavedCommunicatorIndex =
          loginData.communicators.length - 1;
        currentCommunicator =
          loginData.communicators[lastRemoteSavedCommunicatorIndex]; //use the latest communicator
      }

      const localBoardsIds = [];
      // Ensure currentCommunicator exists and has boards array
      // Convert all IDs to strings for consistent comparison
      if (currentCommunicator && currentCommunicator.boards) {
        const communicatorBoardIds = (currentCommunicator.boards || []).map(id => String(id || ''));
        board.boards.forEach(board => {
          const boardIdStr = String(board.id || '');
          if (communicatorBoardIds.includes(boardIdStr)) {
            localBoardsIds.push(boardIdStr);
          }
        });
      }

      const apiBoardsIds =
        currentCommunicator && currentCommunicator.boards
          ? currentCommunicator.boards
              .map(id => String(id || ''))
              .filter(id => id && !localBoardsIds.includes(id))
          : [];

      // Also check loginData.boards for board IDs
      // Extract board IDs from loginData.boards (they have both 'id' and 'board_id' fields)
      // In profile-centric model, loginData.boards contains profiles (which are boards)
      const loginBoardsIds = loginData.boards && Array.isArray(loginData.boards)
        ? loginData.boards
            .map(b => {
              // Try board_id first, then id (both should be profile IDs now)
              const boardId = b.board_id || b.id;
              return boardId ? String(boardId) : null;
            })
            .filter(id => id && id.length > 0)
            .filter(id => !localBoardsIds.includes(id) && !apiBoardsIds.includes(id))
        : [];

      // Verify login was successful and authToken exists
      if (!loginData || !loginData.authToken) {
        console.error('Login - No authToken in loginData, cannot fetch boards');
        // Still dispatch loginSuccess even if no token (for error handling)
        dispatch(loginSuccess(loginData || {}));
        return;
      }
      
      // Dispatch loginSuccess FIRST to ensure authToken is available in Redux state
      // This is needed because getBoard() reads authToken from Redux state
      dispatch(loginSuccess(loginData));
      
      const allApiBoardsIds = [...new Set([...apiBoardsIds, ...loginBoardsIds])];
      
      console.log('Login - Loading boards:', {
        currentCommunicator: currentCommunicator ? { id: currentCommunicator.id, boards: currentCommunicator.boards } : null,
        localBoardsIds,
        apiBoardsIds,
        loginBoardsIds,
        allApiBoardsIds,
        loginDataBoards: loginData.boards,
        loginDataBoardsCount: loginData.boards ? loginData.boards.length : 0,
        hasAuthToken: !!loginData.authToken
      });
      
      if (allApiBoardsIds.length === 0) {
        console.warn('Login - No boards to load! This might be a problem.');
      }

      // Only fetch boards if we have authToken
      const apiBoards = await Promise.all(
        allApiBoardsIds
          .map(async id => {
            let board = null;
            try {
              console.log('Login - Fetching board/profile:', id, 'with authToken:', !!loginData.authToken);
              // Pass loginData.authToken directly to getBoard since Redux state might not be updated yet
              board = await API.getBoard(id, loginData.authToken);
              
              // Normalize tiles: 移除 null/undefined，但不再因「全為 null」就標記為損壞
              // 在 profile-centric 架構下，某些列表接口可能暫時返回虛擬 tiles（全 null），
              // 這種情況會在進入板面時由 BoardContainer 再次從後端補齊真實 tiles。
              if (board && board.tiles && Array.isArray(board.tiles)) {
                const validTiles = board.tiles.filter(tile => 
                  tile !== null && tile !== undefined && typeof tile === 'object'
                );
                board.tiles = validTiles;
              }
              
              console.log('Login - Board fetched:', { id, name: board?.name, tilesCount: board?.tiles?.length || 0 });
            } catch (e) {
              console.error('Login - Error fetching board:', id, e);
              // If board not found (404), skip it
              if (e?.response?.status === 404) {
                console.warn('Login - Board not found (404), skipping:', id);
                return null;
              }
            }
            return board;
          })
          .filter(b => b !== null && b !== undefined)
      );

      console.log('Login - Loaded boards:', apiBoards.length, apiBoards.map(b => ({ id: b.id, name: b.name, tilesCount: b.tiles?.length || 0 })));
      dispatch(addBoards(apiBoards));
      
      // loginSuccess was already dispatched above to ensure authToken is available for getBoard()
      // 登錄後應該使用用戶設置的 rootBoard 作為活動板
      if (apiBoards.length > 0) {
        const { board: boardState, communicator } = getState();
        const currentActiveBoardId = boardState.activeBoardId;
        const activeCommunicatorId = communicator.activeCommunicatorId;
        const currentCommunicator = communicator.communicators.find(
          c => c.id === activeCommunicatorId
        );
        const rootBoardId = currentCommunicator?.rootBoard;
        
        // 如果 communicator 有設置 rootBoard，優先使用它
        if (rootBoardId) {
          const rootBoardExists = apiBoards.some(b => String(b.id) === String(rootBoardId));
          if (rootBoardExists) {
            console.log(
              'Login - Setting active board to rootBoard:',
              rootBoardId
            );
            dispatch(switchBoard(rootBoardId));
            return; // 使用 rootBoard，不需要其他邏輯
          } else {
            console.warn('Login - rootBoard not found in loaded boards:', rootBoardId);
          }
        }
        
        // 如果沒有 rootBoard 或 rootBoard 不存在，檢查當前活動板是否有效
        const activeBoardStillDefault =
          !currentActiveBoardId ||
          currentActiveBoardId === 'root' ||
          !apiBoards.some(b => String(b.id) === String(currentActiveBoardId));
        
        if (activeBoardStillDefault) {
          // 如果沒有 rootBoard，選擇最早建立的板作為默認
          const sortedBoards = [...apiBoards].sort((a, b) => {
            const getCreated = board => {
              if (board.created_at) return new Date(board.created_at);
              if (board.createdAt) return new Date(board.createdAt);
              const idNum = parseInt(String(board.id), 10);
              return isNaN(idNum) ? new Date(0) : new Date(idNum * 1000);
            };
            const aDate = getCreated(a);
            const bDate = getCreated(b);
            return aDate - bDate;
          });
          
          const oldestBoard = sortedBoards[0];
          if (oldestBoard && oldestBoard.id) {
            console.log(
              'Login - No rootBoard set, using oldest user board:',
              oldestBoard.id
            );
            dispatch(switchBoard(oldestBoard.id));
          }
        } else {
          console.log(
            'Login - Keeping existing activeBoardId after login:',
            currentActiveBoardId
          );
        }
      }
      if (type === 'local') {
        dispatch(
          disableTour({
            isRootBoardTourEnabled: false,
            isUnlockedTourEnabled: false,
            isSettingsTourEnabled: false,
            isAnalyticsTourEnabled: false,
            isSymbolSearchTourEnabled: false
          })
        );
      }
      // Debug logging in development
      if (process.env.NODE_ENV !== 'production') {
        console.log('Login successful, dispatching loginSuccess with:', {
          hasAuthToken: !!loginData.authToken,
          hasId: !!loginData.id,
          hasEmail: !!loginData.email,
          loginDataKeys: Object.keys(loginData)
        });
      }
      await setAVoice({ loginData, dispatch, getState });
    } catch (e) {
      if (e.response != null) {
        return Promise.reject(e.response.data);
      }
      var disonnected = {
        message: 'Unable to contact server. Try in a moment'
      };
      return Promise.reject(disonnected);
    }
  };
}
