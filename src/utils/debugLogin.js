/**
 * Debug utility to check login state
 * Use in browser console: window.debugLogin()
 */

export function debugLogin() {
  console.log('=== LOGIN STATE DEBUG ===\n');

  // Check localStorage
  const persisted = localStorage.getItem('persist:root');
  if (persisted) {
    try {
      const state = JSON.parse(persisted);
      const app = JSON.parse(state.app || '{}');
      const userData = app.userData || {};

      console.log('✅ Redux state found in localStorage');
      console.log('User Data:', userData);
      console.log(
        'Auth Token:',
        userData.authToken
          ? `✅ Present (${userData.authToken.substring(0, 20)}...)`
          : '❌ Missing'
      );
      console.log('User ID:', userData.id || '❌ Missing');
      console.log('Email:', userData.email || '❌ Missing');
      console.log(
        'Is Logged (based on userData):',
        Object.keys(userData).length > 0 ? '✅ Yes' : '❌ No'
      );

      // Check if isEmpty would return true
      const isEmpty = obj => {
        if (obj == null) return true;
        if (Object.keys(obj).length === 0) return true;
        return false;
      };
      console.log(
        'Is Logged (isEmpty check):',
        !isEmpty(userData) ? '✅ Yes' : '❌ No'
      );
    } catch (e) {
      console.error('❌ Error parsing state:', e);
    }
  } else {
    console.log('❌ No Redux state found in localStorage');
    console.log('This means either:');
    console.log('  1. User has not logged in yet');
    console.log('  2. Redux-persist is not working');
    console.log('  3. localStorage was cleared');
  }

  // Check if store is available
  if (window.__REDUX_STORE__) {
    const store = window.__REDUX_STORE__;
    const state = store.getState();
    console.log('\n✅ Redux store accessible');
    console.log('Current userData:', state.app?.userData);
    console.log(
      'Current isLogged:',
      state.app?.userData && Object.keys(state.app.userData).length > 0
    );
  } else {
    console.log('\n⚠️  Redux store not accessible via window.__REDUX_STORE__');
  }

  console.log('\n=== NEXT STEPS ===');
  console.log('1. Check Network tab for /api/user/login request');
  console.log('2. Verify response contains authToken');
  console.log('3. Check if LOGIN_SUCCESS action was dispatched');
  console.log('4. Verify userData is being stored in Redux');
}

// Make it available globally
if (typeof window !== 'undefined') {
  window.debugLogin = debugLogin;
}
