import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { FormattedMessage, injectIntl } from 'react-intl';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Link from '@material-ui/core/Link';

import messages from './WelcomeScreen.messages';
import { finishFirstVisit } from '../App/App.actions';
import { getUser } from '../App/App.selectors';
import Login from '../Account/Login';
import SignUp from '../Account/SignUp';
import ResetPassword from '../Account/ResetPassword';
import CboardLogo from './CboardLogo/CboardLogo.component';
import history from '../../history';
import { getEyeTrackingInstance } from '../../utils/eyeTrackingIntegration';
import './WelcomeScreen.css';
import {
  isCordova,
  isAndroid,
  isIOS,
  manageKeyboardEvents
} from '../../cordova-util';

// Cordova path cannot be absolute
const backgroundImage = isCordova()
  ? './images/bg/waves.png'
  : '/images/bg/waves.png';

const styles = theme => ({
  root: {},
  WelcomeScreen: {
    height: '100%',
    padding: '1.5rem',
    position: 'relative',
    color: '#eceff1',
    overflow: 'auto',
    backgroundColor:
      'linear-gradient(to right, rgb(45, 22, 254), rgb(141, 92, 255))',
    background: `url(${backgroundImage}) no-repeat center center fixed, linear-gradient(to right, rgb(45, 22, 254), rgb(141, 92, 255))`,
    backgroundSize: 'cover'
  }
});

export class WelcomeScreen extends Component {
  state = {
    activeView: '',
    keyboard: { isKeyboardOpen: false, keyboardHeight: undefined },
    dialogWithKeyboardStyle: {
      dialogStyle: {},
      dialogContentStyle: {}
    }
  };

  static propTypes = {
    finishFirstVisit: PropTypes.func.isRequired,
    heading: PropTypes.string,
    text: PropTypes.string,
    onClose: PropTypes.func,
    classes: PropTypes.object.isRequired,
    user: PropTypes.object
  };

  handleKeyboardDidShow = event => {
    this.setState({
      keyboard: { isKeyboardOpen: true, keyboardHeight: event.keyboardHeight }
    });
  };

  handleKeyboardDidHide = () => {
    this.setState({
      keyboard: { isKeyboardOpen: false, keyboardHeight: null }
    });
  };

  handleActiveView = activeView => {
    this.setState({
      activeView
    });
  };

  onResetPasswordClick = () => {
    this.resetActiveView();
    this.handleActiveView('forgot');
  };

  resetActiveView = () => {
    this.setState({
      activeView: ''
    });
  };

  handleContinueAsGuest = () => {
    const { finishFirstVisit } = this.props;
    console.log('[WelcomeScreen] Continue as Guest clicked');
    
    // Dispatch action to finish first visit
    finishFirstVisit();
    
    // Force navigation to home page
    // Use setTimeout to ensure Redux state updates before navigation
    setTimeout(() => {
      history.push('/');
      // Force a page reload if navigation doesn't work
      if (window.location.pathname === '/login-signup' || window.location.pathname === '/') {
        window.location.href = '/';
      }
    }, 100);
  };


  updateDialogStyle() {
    if (!(isAndroid() || isIOS())) return;
    const { isKeyboardOpen, keyboardHeight } = this.state.keyboard;
    if (isKeyboardOpen) {
      const KEYBOARD_MARGIN_TOP = 30;
      const DEFAULT_KEYBOARD_SPACE = 310;
      const keyboardSpace = keyboardHeight
        ? keyboardHeight + KEYBOARD_MARGIN_TOP
        : DEFAULT_KEYBOARD_SPACE;
      return {
        dialogStyle: {
          marginBottom: `${keyboardSpace}px`
        },
        dialogContentStyle: {
          maxHeight: `calc(92vh - ${keyboardSpace}px)`,
          overflow: 'scroll'
        }
      };
    }
    return null;
  }

  componentDidUpdate(prevProps, prevState) {
    // Close login dialog if user becomes logged in
    const { user } = this.props;
    const wasLoggedIn =
      prevProps.user && Object.keys(prevProps.user).length > 0;
    const isLoggedIn = user && Object.keys(user).length > 0;

    if (!wasLoggedIn && isLoggedIn && this.state.activeView === 'login') {
      // User just logged in, close the dialog
      this.resetActiveView();
    }

    // Handle keyboard events (existing logic)
    if (!(isAndroid() || isIOS())) return;
    const { isKeyboardOpen: wasKeyboardOpen } = prevState.keyboard;
    const { isKeyboardOpen } = this.state.keyboard;
    if (wasKeyboardOpen !== isKeyboardOpen) {
      this.setState({
        dialogWithKeyboardStyle: this.updateDialogStyle()
      });
    }
  }

  componentDidMount() {
    // Cleanup eye tracking when login/welcome screen is shown
    try {
      const eyeTrackingInstance = getEyeTrackingInstance();
      if (eyeTrackingInstance) {
        console.log('[WelcomeScreen] Cleaning up eye tracking on mount...');
        eyeTrackingInstance.cleanup();
      }
      
      // Also ensure WebGazer video element is removed if it exists
      const videoElement = document.getElementById('webgazerVideoFeed');
      if (videoElement) {
        videoElement.style.display = 'none';
        videoElement.style.visibility = 'hidden';
        videoElement.style.opacity = '0';
        videoElement.style.width = '0';
        videoElement.style.height = '0';
        videoElement.style.position = 'fixed';
        videoElement.style.top = '-9999px';
        videoElement.style.left = '-9999px';
        try {
          videoElement.remove();
        } catch (e) {
          console.warn('[WelcomeScreen] Error removing video element:', e);
        }
      }
      
      // Remove video container
      const videoContainer = document.getElementById('webgazer-video-container');
      if (videoContainer) {
        try {
          videoContainer.remove();
        } catch (e) {
          console.warn('[WelcomeScreen] Error removing video container:', e);
        }
      }
    } catch (err) {
      console.warn('[WelcomeScreen] Error cleaning up eye tracking:', err);
    }

    if (!(isAndroid() || isIOS())) return;
    manageKeyboardEvents({
      onShow: this.handleKeyboardDidShow,
      onHide: this.handleKeyboardDidHide
    });
  }
  componentWillUnmount() {
    // Ensure eye tracking is cleaned up when component unmounts
    try {
      const eyeTrackingInstance = getEyeTrackingInstance();
      if (eyeTrackingInstance) {
        eyeTrackingInstance.cleanup();
      }
    } catch (err) {
      console.warn('[WelcomeScreen] Error cleaning up eye tracking on unmount:', err);
    }

    if (!(isAndroid() || isIOS())) return;
    manageKeyboardEvents({
      onShow: this.handleKeyboardDidShow,
      onHide: this.handleKeyboardDidHide,
      removeEvent: true
    });
  }

  render() {
    const { finishFirstVisit, onClose, classes } = this.props;
    const { activeView, dialogWithKeyboardStyle } = this.state;

    return (
      <div className={classes.WelcomeScreen}>
        <div className="WelcomeScreen__container">
          <div className="WelcomeScreen__logo">
            <CboardLogo />
          </div>
          <footer className="WelcomeScreen__footer">
            <Button
              className="WelcomeScreen__button WelcomeScreen__button--login"
              variant="contained"
              onClick={() => this.handleActiveView('login')}
            >
              <FormattedMessage {...messages.login} />
            </Button>
            <Button
              className="WelcomeScreen__button WelcomeScreen__button--signup"
              variant="contained"
              color="primary"
              onClick={() => this.handleActiveView('signup')}
            >
              <FormattedMessage {...messages.signUp} />
            </Button>

            <Button
              className="WelcomeScreen__button WelcomeScreen__button--guest"
              onClick={this.handleContinueAsGuest}
              style={{
                color: '#fff',
                margin: '1em auto 0 auto',
                textShadow: '0px 0px 6px black'
              }}
            >
              <FormattedMessage {...messages.continueAsGuest} />
            </Button>
          </footer>
          <div className="WelcomeScreen__links">
            <Link
              href="https://www.cboard.io/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              color="inherit"
            >
              <FormattedMessage {...messages.privacy} />
            </Link>
            <Link
              href="https://www.cboard.io/terms-of-use/"
              target="_blank"
              rel="noopener noreferrer"
              color="inherit"
            >
              <FormattedMessage {...messages.terms} />
            </Link>
          </div>
        </div>
        <Login
          isDialogOpen={activeView === 'login'}
          onResetPasswordClick={this.onResetPasswordClick}
          onClose={this.resetActiveView}
          dialogWithKeyboardStyle={dialogWithKeyboardStyle}
        />
        <ResetPassword
          isDialogOpen={activeView === 'forgot'}
          onClose={this.resetActiveView}
        />
        <SignUp
          isDialogOpen={activeView === 'signup'}
          onClose={this.resetActiveView}
          dialogWithKeyboardStyle={dialogWithKeyboardStyle}
        />
      </div>
    );
  }
}

const mapStateToProps = state => ({
  user: getUser(state)
});

const mapDispatchToProps = {
  finishFirstVisit
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(injectIntl(withStyles(styles, { withTheme: true })(WelcomeScreen)));
