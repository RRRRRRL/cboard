import {
  FINISH_FIRST_VISIT,
  UPDATE_CONNECTIVITY,
  UPDATE_DISPLAY_SETTINGS,
  UPDATE_NAVIGATION_SETTINGS,
  UPDATE_SYMBOLS_SETTINGS,
  UPDATE_USER_DATA,
  DISABLE_TOUR,
  ENABLE_ALL_TOURS,
  SET_UNLOGGED_USER_LOCATION,
  USER_DATA_PROPERTIES
} from './App.constants';
import { LOGIN_SUCCESS, LOGOUT } from '../Account/Login/Login.constants';
import {
  DISPLAY_SIZE_STANDARD,
  LABEL_POSITION_BELOW
} from '../Settings/Display/Display.constants';

import { DEFAULT_FONT_FAMILY } from './../../providers/ThemeProvider/ThemeProvider.constants';
import { NAVIGATION_BUTTONS_STYLE_SIDES } from '../Settings/Navigation/Navigation.constants';

const initialState = {
  isConnected: true,
  isFirstVisit: true,
  liveHelp: {
    isRootBoardTourEnabled: true,
    isUnlockedTourEnabled: true,
    isSettingsTourEnabled: true,
    communicatorTour: {
      isCommBoardsEnabled: true,
      isPublicBoardsEnabled: true,
      isAllMyBoardsEnabled: true
    },
    isAnalyticsTourEnabled: true,
    isSymbolSearchTourEnabled: true
  },
  displaySettings: {
    uiSize: DISPLAY_SIZE_STANDARD,
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: DISPLAY_SIZE_STANDARD,
    hideOutputActive: false,
    increaseOutputButtons: false,
    labelPosition: LABEL_POSITION_BELOW,
    darkThemeActive: false
  },
  navigationSettings: {
    active: false,
    shareShowActive: false,
    bigScrollButtonsActive: false,
    navigationButtonsStyle: NAVIGATION_BUTTONS_STYLE_SIDES,
    caBackButtonActive: false,
    quickUnlockActive: false,
    removeOutputActive: false,
    vocalizeFolders: false,
    quietBuilderMode: false,
    liveMode: false,
    improvePhraseActive: false
  },
  symbolsSettings: {
    arasaacActive: false
  },
  userData: {}
};

const getKeysFromApiUserDataResponse = payload => {
  const newUser = {};
  if (!payload) {
    console.warn('getKeysFromApiUserDataResponse: payload is null/undefined');
    return newUser;
  }

  // Debug logging in development
  if (process.env.NODE_ENV !== 'production') {
    console.log('getKeysFromApiUserDataResponse: Processing payload', {
      hasAuthToken: !!payload.authToken,
      hasId: !!payload.id,
      hasEmail: !!payload.email,
      payloadKeys: Object.keys(payload)
    });
  }

  USER_DATA_PROPERTIES.forEach(prop => {
    if (payload[prop] !== undefined) {
      // Convert id to string if it's the id property (frontend expects string)
      if (prop === 'id') {
        newUser[prop] = String(payload[prop]);
      } else {
        newUser[prop] = payload[prop];
      }
    }
  });

  // Debug logging in development
  if (process.env.NODE_ENV !== 'production') {
    console.log('getKeysFromApiUserDataResponse: Result', {
      hasAuthToken: !!newUser.authToken,
      hasId: !!newUser.id,
      hasEmail: !!newUser.email,
      resultKeys: Object.keys(newUser)
    });
  }

  return newUser;
};

function appReducer(state = initialState, action) {
  let displaySettings = { ...state.displaySettings };
  let navigationSettings = { ...state.navigationSettings };
  let symbolsSettings = { ...state.symbolsSettings };

  switch (action.type) {
    case UPDATE_DISPLAY_SETTINGS:
      displaySettings = {
        ...state.displaySettings,
        ...action.payload
      };
      return {
        ...state,
        displaySettings
      };
    case UPDATE_NAVIGATION_SETTINGS:
      navigationSettings = {
        ...state.navigationSettings,
        ...action.payload
      };
      return {
        ...state,
        navigationSettings
      };
    case UPDATE_SYMBOLS_SETTINGS:
      symbolsSettings = {
        ...state.symbolsSettings,
        ...action.payload
      };
      return {
        ...state,
        symbolsSettings
      };
    case UPDATE_CONNECTIVITY:
      return {
        ...state,
        isConnected: action.payload
      };
    case FINISH_FIRST_VISIT:
      return {
        ...state,
        isFirstVisit: false
      };
    case DISABLE_TOUR:
      return {
        ...state,
        liveHelp: {
          ...state.liveHelp,
          ...action.payload
        }
      };
    case ENABLE_ALL_TOURS:
      return {
        ...state,
        liveHelp: {
          isRootBoardTourEnabled: true,
          isUnlockedTourEnabled: true,
          isSettingsTourEnabled: true,
          communicatorTour: {
            isCommBoardsEnabled: true,
            isPublicBoardsEnabled: true,
            isAllMyBoardsEnabled: true
          },
          isAnalyticsTourEnabled: true,
          isSymbolSearchTourEnabled: true
        }
      };

    case LOGIN_SUCCESS:
      const settings = action.payload.settings || {};
      const { display, navigation } = settings;

      displaySettings = { ...state.displaySettings };
      navigationSettings = { ...state.navigationSettings };

      if (display) {
        displaySettings = { ...displaySettings, ...display };
      }

      if (navigation) {
        navigationSettings = { ...navigationSettings, ...navigation };
      }

      const newUserData = getKeysFromApiUserDataResponse(action.payload);

      // Debug logging in development
      if (process.env.NODE_ENV !== 'production') {
        console.log('LOGIN_SUCCESS reducer: Setting userData', {
          userDataKeys: Object.keys(newUserData),
          hasAuthToken: !!newUserData.authToken,
          hasId: !!newUserData.id,
          userData: newUserData
        });
      }

      return {
        ...state,
        isFirstVisit: false,
        displaySettings,
        navigationSettings,
        userData: newUserData
      };
    case LOGOUT:
      return {
        ...state,
        userData: {}
      };
    case UPDATE_USER_DATA:
      return {
        ...state,
        userData: action.userData
          ? getKeysFromApiUserDataResponse(action.userData)
          : state.userData
      };
    case SET_UNLOGGED_USER_LOCATION:
      return {
        ...state,
        unloggedUserLocation: action.location
      };
    default:
      return state;
  }
}

export default appReducer;
