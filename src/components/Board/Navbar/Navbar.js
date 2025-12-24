import React from 'react';
import PropTypes from 'prop-types';
import { Link, withRouter } from 'react-router-dom';
import classNames from 'classnames';
import { Scannable } from 'react-scannable';
import { IconButton } from '@material-ui/core';
import ScannerDeactivateIcon from '@material-ui/icons/ExploreOff';
import KeyboardIcon from '@material-ui/icons/Keyboard';
import BoardShare from '../BoardShare';
import FullScreenButton from '../../UI/FullScreenButton';
import PrintBoardButton from '../../UI/PrintBoardButton';
import UserIcon from '../../UI/UserIcon';
import LockToggle from '../../UI/LockToggle';
import BackButton from '../../UI/BackButton';
import HelpButton from '../../UI/HelpButton';
import SettingsButton from '../../UI/SettingsButton';
import DeviceConnectionStatus from '../../UI/DeviceConnectionStatus/DeviceConnectionStatus.component';
import messages from '../Board.messages';
import { isCordova, isAndroid } from '../../../cordova-util';
import './Navbar.css';
import { injectIntl } from 'react-intl';

export class Navbar extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      backButton: false,
      openShareDialog: false,
      deactivateScannerButton: false
    };
  }

  onShareClick = () => {
    this.setState({ openShareDialog: true });
  };

  onShareClose = () => {
    this.setState({ openShareDialog: false });
  };

  publishBoard = () => {
    this.props.publishBoard();
  };

  handleCopyLink = async () => {
    const { intl, showNotification } = this.props;
    try {
      if (isAndroid()) {
        await window.cordova.plugins.clipboard.copy(this.getBoardToShare());
      } else {
        await navigator.clipboard.writeText(this.getBoardToShare());
      }
      showNotification(intl.formatMessage(messages.copyMessage));
    } catch (err) {
      showNotification(intl.formatMessage(messages.failedToCopy));
      console.log(err.message);
    }
  };

  onScannableFocus = property => () => {
    if (!this.state[property]) {
      this.setState({ [property]: true });
    }
  };

  onScannableBlur = property => () => {
    if (this.state[property]) {
      this.setState({ [property]: false });
    }
  };

  onUserIconClick = () => {
    const { userData, isLocked, intl, history } = this.props;
    if (isLocked) {
      const userLock = intl.formatMessage(messages.userProfileLocked);
      this.props.showNotification(userLock);
    } else {
      if (userData.name && userData.email) {
        history.push('/settings/people');
      } else {
        history.push('/login-signup');
      }
    }
  };


  getBoardToShare = () => {
    const { board } = this.props;
    if (isCordova()) {
      return 'https://app.cboard.io/board/' + board.id;
    } else {
      return window.location.href;
    }
  };

  render() {
    const {
      className,
      intl,
      board,
      userData,
      title,
      disabled,
      isLocked,
      isScannerActive,
      onBackClick,
      onDeactivateScannerClick,
      onLockClick,
      onLockNotify,
      onJyutpingKeyboardClick
    } = this.props;

    const isPublic = board && board.isPublic;
    const isOwnBoard = board && board.email === userData.email;
    const isLogged = userData && userData.name && userData.email;

    return (
      <div className={classNames('Navbar', className)}>
        {isLocked && <h2 className="Navbar__title">{title}</h2>}
        <div className="Navbar__group Navbar__group--start">
          <div className={this.state.backButton ? 'scanner__focused' : ''}>
            <Scannable
              disabled={disabled}
              onFocus={this.onScannableFocus('backButton')}
              onBlur={this.onScannableBlur('backButton')}
            >
              <BackButton disabled={disabled} onClick={onBackClick} />
            </Scannable>
          </div>
          {isScannerActive && (
            <div
              className={
                this.state.deactivateScannerButton ? 'scanner__focused' : ''
              }
            >
              <IconButton
                className="Navbar__deactivateScanner"
                onClick={onDeactivateScannerClick}
              >
                <ScannerDeactivateIcon />
              </IconButton>
            </div>
          )}
          {!isLocked && <HelpButton component={Link} to="/settings/help" />}
        </div>
        <div className="Navbar__group Navbar__group--end">
          {!isLocked && (
            <React.Fragment>
              {/* Device Connection Status Indicator */}
              <DeviceConnectionStatus intl={intl} />
              <PrintBoardButton />
              {!isCordova() && <FullScreenButton />}
              <SettingsButton component={Link} to="/settings" />
              <BoardShare
                label={intl.formatMessage(messages.share)}
                intl={this.props.intl}
                isPublic={isPublic}
                isOwnBoard={isOwnBoard}
                isLogged={isLogged}
                onShareClick={this.onShareClick}
                onShareClose={this.onShareClose}
                publishBoard={this.publishBoard}
                onCopyLink={this.handleCopyLink}
                open={this.state.openShareDialog}
                url={this.getBoardToShare()}
                fullScreen={false}
                profiles={this.props.profiles || []}
                onGenerateQR={this.props.onGenerateQR}
                onGenerateCloudCode={this.props.onGenerateCloudCode}
                onGenerateEmail={this.props.onGenerateEmail}
                onRedeemCode={this.props.onRedeemCode}
              />
            </React.Fragment>
          )}
          <div className={'personal__account'}>
            <UserIcon onClick={this.onUserIconClick} />
          </div>
          {onJyutpingKeyboardClick && (
            <div className={'jyutping__keyboard'}>
              <IconButton
                onClick={() => {
                  onJyutpingKeyboardClick();
                }}
                disabled={false}
                title={intl.formatMessage(messages.jyutpingKeyboard)}
                style={{ color: '#fff' }}
              >
                <KeyboardIcon />
              </IconButton>
            </div>
          )}
          <div className={'open__lock'}>
            <LockToggle
              locked={isLocked}
              onLockTick={onLockNotify}
              onClick={onLockClick}
            />
          </div>
        </div>
      </div>
    );
  }
}

Navbar.propTypes = {
  /**
   * @ignore
   */
  className: PropTypes.string,
  /**
   * Bar title
   */
  title: PropTypes.string,
  /**
   * If disabled, navigation is disabled
   */
  disabled: PropTypes.bool,
  /**
   * If enabled, navigation bar is locked Todo: shouldn't be here - mixing concerns
   */
  isLocked: PropTypes.bool,
  /**
   * Callback fired when clicking on back button
   */
  onBackClick: PropTypes.func,
  /**
   * Callback fired when clicking on lock button
   */
  onLockClick: PropTypes.func,
  isScannerActive: PropTypes.bool,
  onDeactivateScannerClick: PropTypes.func,
  history: PropTypes.object.isRequired,
  profiles: PropTypes.array,
  onGenerateQR: PropTypes.func,
  onGenerateCloudCode: PropTypes.func,
  onGenerateEmail: PropTypes.func,
  onRedeemCode: PropTypes.func,
  onJyutpingKeyboardClick: PropTypes.func,
  showNotification: PropTypes.func
};

export default withRouter(injectIntl(Navbar));
