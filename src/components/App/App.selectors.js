import isEmpty from 'lodash/isEmpty';

export const getUser = state => state.app.userData;
export const isLogged = state => {
  const userData = getUser(state);
  const logged = !isEmpty(userData);

  // Debug logging in development
  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    // Only log once per state change to avoid spam
    if (!window._lastIsLoggedCheck || window._lastIsLoggedCheck !== logged) {
      console.log('isLogged check:', {
        userData,
        isEmpty: isEmpty(userData),
        isLogged: logged,
        userDataKeys: userData ? Object.keys(userData) : []
      });
      window._lastIsLoggedCheck = logged;
    }
  }

  return logged;
};
export const isFirstVisit = state => state.app.isFirstVisit;
