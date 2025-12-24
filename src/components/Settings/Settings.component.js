import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, intlShape } from 'react-intl';
import { Link } from 'react-router-dom';
import Button from '@material-ui/core/Button';
import LanguageIcon from '@material-ui/icons/Language';
import RecordVoiceOverIcon from '@material-ui/icons/RecordVoiceOver';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import CloudDownloadIcon from '@material-ui/icons/CloudDownload';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import VisibilityIcon from '@material-ui/icons/Visibility';
import ScanningIcon from '@material-ui/icons/CenterFocusStrong';
import NavigationIcon from '@material-ui/icons/ChevronRight';
import RemoveRedEyeIcon from '@material-ui/icons/RemoveRedEye';
import FeedbackIcon from '@material-ui/icons/Feedback';
import PersonIcon from '@material-ui/icons/Person';
import MonetizationOnIcon from '@material-ui/icons/MonetizationOn';
import HelpIcon from '@material-ui/icons/Help';
import IconButton from '../UI/IconButton';
import LiveHelpIcon from '@material-ui/icons/LiveHelp';
import SymbolsIcon from '@material-ui/icons/EmojiSymbols';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';
import ListIcon from '@material-ui/icons/List';
import AdminPanelIcon from '@material-ui/icons/Security';
import GamesIcon from '@material-ui/icons/Games';
import CameraAltIcon from '@material-ui/icons/CameraAlt';
import MemoryIcon from '@material-ui/icons/Memory';
import InfoIcon from '@material-ui/icons/Info';

import messages from './Settings.messages';
import SettingsSection from './SettingsSection.component';
import FullScreenDialog from '../UI/FullScreenDialog';
import Paper from '@material-ui/core/Paper';
import UserIcon from '../UI/UserIcon';
import SettingsTour from './SettingsTour.component';
import { isCordova, isAndroid } from '../../cordova-util';

import './Settings.css';
import { CircularProgress } from '@material-ui/core';

import { Adsense } from '@ctrl/react-adsense';
import {
  ADSENSE_ON_PRODUCTION,
  ADSENSE_CLIENT,
  ADD_SLOT_SETTINGS_TOP
} from '../../constants';

const propTypes = {
  isLogged: PropTypes.bool.isRequired,
  logout: PropTypes.func.isRequired,
  user: PropTypes.object.isRequired,
  intl: intlShape.isRequired,
  isDownloadingLang: PropTypes.bool
};

export class Settings extends PureComponent {
  getSettingsSections() {
    const { isLogged, logout, user, isInFreeCountry, userData } = this.props;

    function handleLogOutClick() {
      if (isAndroid()) {
        window.FirebasePlugin.unregister();
        window.facebookConnectPlugin.logout(
          function(msg) {
            console.log('disconnect facebook msg' + msg);
          },
          function(msg) {
            console.log('error facebook disconnect msg' + msg);
          }
        );
      }
      logout();
    }

    const peopleSettings = [
      {
        icon: (
          <div className="Settings__UserIcon__Container">
            <UserIcon link={false} accountIcon={PersonIcon} />
          </div>
        ),
        secondary: isLogged ? user.name : null,
        text: isLogged ? messages.username : messages.guest,
        url: '/settings/people',
        rightContent: isLogged ? (
          <Button
            color="primary"
            onClick={handleLogOutClick}
            variant="outlined"
          >
            <FormattedMessage {...messages.logout} />
          </Button>
        ) : (
          <Button
            color="primary"
            variant="outlined"
            component={Link}
            to="/login-signup"
          >
            <FormattedMessage {...messages.loginSignup} />
          </Button>
        )
      }
    ];

    if (!isInFreeCountry) {
      const subscribeSection = {
        icon: <MonetizationOnIcon />,
        text: messages.subscribe,
        url: '/settings/subscribe'
      };
      peopleSettings.push(subscribeSection);
    }

    const systemSettings = [
      {
        icon: <CloudUploadIcon />,
        text: messages.export,
        url: '/settings/export'
      },
      {
        icon: <CloudDownloadIcon />,
        text: messages.import,
        url: '/settings/import'
      },
      {
        icon: <SymbolsIcon />,
        text: messages.symbols,
        url: '/settings/symbols'
      },
      {
        icon: <VisibilityIcon />,
        text: messages.display,
        url: '/settings/display'
      },
      {
        icon: <NavigationIcon />,
        text: messages.navigation,
        url: '/settings/navigation'
      },
      {
        icon: <RemoveRedEyeIcon />,
        text: messages.eyeTracking,
        url: '/settings/eyetracking'
      },
      {
        icon: <ListIcon />,
        text: messages.logViewer,
        url: '/settings/log-viewer'
      },
      {
        icon: <GamesIcon />,
        text: messages.learningGames,
        url: '/settings/learning-games'
      },
      {
        icon: <CameraAltIcon />,
        text: messages.ocrTranslator,
        url: '/settings/ocr-translator'
      },
      {
        icon: <MemoryIcon />,
        text: messages.aiFeatures,
        url: '/settings/ai-features'
      }
    ];

    // Add admin panel if user is admin
    const currentUser = userData || user;
    if (isLogged && currentUser && (currentUser.role === 'admin' || (user && user.role === 'admin'))) {
      systemSettings.push({
        icon: <AdminPanelIcon />,
        text: messages.adminPanel,
        url: '/settings/admin'
      });
    }

    return [
      {
        subheader: messages.people,
        settings: peopleSettings
      },
      {
        subheader: messages.language,
        settings: [
          {
            icon: <LanguageIcon />,
            text: messages.language,
            url: '/settings/language'
          },
          {
            icon: <RecordVoiceOverIcon />,
            text: messages.speech,
            url: '/settings/speech'
          }
        ]
      },
      {
        subheader: messages.system,
        settings: systemSettings
      },
      {
        subheader: messages.help,
        settings: [
          {
            icon: <InfoIcon />,
            text: messages.intro,
            url: '/settings/intro'
          },
          {
            icon: <HelpIcon />,
            text: messages.userHelp,
            url: '/settings/help'
          },
          {
            icon: <ListIcon />,
            text: messages.news,
            url: '/settings/news'
          },
          {
            icon: <InfoOutlinedIcon />,
            text: messages.about,
            url: '/settings/about'
          },
          {
            icon: <MonetizationOnIcon />,
            text: messages.donate,
            onClick: this.handleDonateClick
          },
          {
            icon: <FeedbackIcon />,
            text: messages.feedback,
            onClick: this.handleFeedbackClick
          }
        ]
      }
    ];
  }

  handleFeedbackClick = () => {
    window.location.href = 'mailto:support@cboard.io?subject=Cboard feedback';
  };
  handleDonateClick = () => {
    window.open('https://opencollective.com/cboard#backer', '_blank');
  };

  handleGoBack = () => {
    const { history, isDownloadingLang } = this.props;
    if (isDownloadingLang) return; //prevent goBack during downloading
    history.replace('/');
  };

  enableTour = () => {
    const { disableTour } = this.props;
    disableTour({ isSettingsTourEnabled: true });
  };

  AddSense = () => {
    return (
      !isCordova() && (
        <Paper className="Settings__section">
          <Adsense
            client={ADSENSE_CLIENT}
            slot={ADD_SLOT_SETTINGS_TOP}
            data-adtest={ADSENSE_ON_PRODUCTION ? 'off' : 'on'}
            format="none"
            className="adSense__marker"
          />
        </Paper>
      )
    );
  };

  render() {
    const {
      intl,
      disableTour,
      isSettingsTourEnabled,
      location,
      isDownloadingLang
    } = this.props;
    const isSettingsLocation = location.pathname === '/settings';
    return (
      <FullScreenDialog
        className="Settings"
        open
        title={<FormattedMessage {...messages.settings} />}
        onClose={this.handleGoBack}
        buttons={
          isSettingsLocation &&
          !isSettingsTourEnabled &&
          !isDownloadingLang && (
            <div className="Settings_EnableTour_Button">
              <IconButton
                label={intl.formatMessage(messages.enableTour)}
                onClick={this.enableTour} //Enable tour
              >
                <LiveHelpIcon />
              </IconButton>
            </div>
          )
        }
      >
        {/*<this.AddSense />*/}
        {(isDownloadingLang && (
          <div className="Settings__spinner-container">
            <CircularProgress
              size={60}
              className="Settings__loading-Spinner"
              thickness={4}
            />
          </div>
        )) ||
          this.getSettingsSections().map(({ subheader, settings }, index) => (
            <SettingsSection
              subheader={subheader}
              settings={settings}
              key={index}
            />
          ))}
        {isSettingsLocation && isSettingsTourEnabled && (
          <SettingsTour
            intl={intl}
            disableTour={disableTour}
            isSettingsTourEnabled={isSettingsTourEnabled}
          />
        )}
      </FullScreenDialog>
    );
  }
}

Settings.propTypes = propTypes;

export default Settings;
