import languageProviderReducer from '../LanguageProvider.reducer';
import { CHANGE_LANG, SET_LANGS } from '../LanguageProvider.constants';
import { LOGIN_SUCCESS } from '../../../components/Account/Login/Login.constants';
import { APP_LANGS } from '../../../components/App/App.constants';
import { getDefaultLang } from '../../../i18n';
let mockLanguage, initialState;

describe('reducer', () => {
  beforeEach(() => {
    initialState = {
      lang: getDefaultLang(APP_LANGS),
      dir: 'ltr',
      langs: [],
      localLangs: [],
      langsFetched: false,
      downloadingLang: {
        isdownloading: false
      }
    };
    mockLanguage = {
      lang: '',
      dir: '',
      langs: []
    };
  });
  it('should return the initial state', () => {
    expect(languageProviderReducer(undefined, {})).toEqual(initialState);
  });
  it('should handle login ', () => {
    const login = {
      type: LOGIN_SUCCESS,
      payload: initialState
    };
    expect(languageProviderReducer(initialState, login)).toEqual({
      ...initialState,
      dir: 'ltr'
    });
  });
  it('should handle setLangs ', () => {
    const setLangs = {
      type: SET_LANGS,
      langs: ['de-DE', 'en-GB', 'en-US']
    };
    expect(languageProviderReducer(initialState, setLangs)).toEqual({
      ...initialState,
      langsFetched: true,
      langs: ['de-DE', 'en-GB', 'en-US']
    });
  });
  it('should handle changeLang ', () => {
    const changeLang = {
      type: CHANGE_LANG,
      lang: 'de-DE'
    };
    expect(languageProviderReducer(initialState, changeLang)).toEqual({
      ...initialState,
      lang: 'de-DE',
      dir: 'ltr'
    });
  });
});
