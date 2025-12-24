import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Dialog from '@material-ui/core/Dialog';
import Alert from '@material-ui/lab/Alert';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import TextField from '@material-ui/core/TextField';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import CircularProgress from '@material-ui/core/CircularProgress';
import Divider from '@material-ui/core/Divider';
import Typography from '@material-ui/core/Typography';
import { FormattedMessage } from 'react-intl';
import CopyIcon from '@material-ui/icons/FilterNone';
import CloseIcon from '@material-ui/icons/Close';
import ShareIcon from '@material-ui/icons/Share';
import CameraAltIcon from '@material-ui/icons/CameraAlt';
import IconButton from '../../UI/IconButton';
import Button from '@material-ui/core/Button';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { useTheme } from '@material-ui/core/styles';
import {
  FacebookShareButton,
  FacebookIcon,
  TwitterShareButton,
  TwitterIcon,
  EmailShareButton,
  EmailIcon,
  WhatsappShareButton,
  WhatsappIcon,
  RedditShareButton,
  RedditIcon
} from 'react-share';
import messages from './BoardShare.messages';
import transferMessages from '../../Settings/Transfer/Transfer.messages';
import QRCodeScanner from '../../Settings/Transfer/QRCodeScanner';
import './BoardShare.css';
import { isAndroid } from '../../../cordova-util';
import PremiumFeature from '../../PremiumFeature';

// QR Code Display Component
const QRCodeDisplay = ({ token }) => {
  const [qrCodeUrl, setQrCodeUrl] = React.useState(null);

  React.useEffect(() => {
    const size = 256;
    const encodedToken = encodeURIComponent(token);
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedToken}`;
    setQrCodeUrl(url);
  }, [token]);

  if (!qrCodeUrl) {
    return <CircularProgress size={40} />;
  }

  return (
    <div style={{ 
      padding: '16px', 
      backgroundColor: '#ffffff', 
      borderRadius: '8px',
      display: 'inline-block',
      marginBottom: '16px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <img 
        src={qrCodeUrl} 
        alt="QR Code" 
        style={{ 
          width: '256px', 
          height: '256px',
          display: 'block'
        }}
      />
    </div>
  );
};

function shareBoardOnFacebook(url, intl) {
  const shareData = {
    method: 'share',
    href: url,
    hashtag: '#Cboard',
    quote: intl.formatMessage(messages.subject)
  };

  const errorFunction = msg => {
    if (msg.errorCode !== '4201')
      alert(intl.formatMessage(messages.cannotShare));
  };

  window.facebookConnectPlugin.logout(
    function succcesFunction(msg) {},
    function(msg) {
      console.log('error facebook disconnect msg' + msg);
    }
  );

  window.facebookConnectPlugin.login(
    ['email'],
    function succesLogin(userData) {
      window.facebookConnectPlugin.showDialog(
        shareData,
        function succcesFunction() {},
        msg => errorFunction(msg)
      );
    },
    msg => errorFunction(msg)
  );
}

const BoardShare = ({
  label,
  url,
  intl,
  disabled,
  open,
  isOwnBoard,
  isPublic,
  isLogged,
  fullScreen: fullScreenProp,
  onShareClick,
  onShareClose,
  publishBoard,
  onCopyLink,
  profiles = [],
  onGenerateQR,
  onGenerateCloudCode,
  onGenerateEmail,
  onRedeemCode
}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm')) || fullScreenProp;
  const [activeTab, setActiveTab] = useState(0);
  const [transferSubTab, setTransferSubTab] = useState(0);
  
  // Transfer state
  const [selectedProfile, setSelectedProfile] = useState('');
  const [qrData, setQrData] = useState(null);
  const [cloudCode, setCloudCode] = useState(null);
  const [email, setEmail] = useState('');
  const [redeemCode, setRedeemCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showQRScanner, setShowQRScanner] = useState(false);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setError(null);
  };

  const handleGenerateQR = async () => {
    if (!selectedProfile) {
      setError(intl.formatMessage(transferMessages.selectProfile));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await onGenerateQR(selectedProfile);
      setQrData(result);
    } catch (err) {
      setError(err.message || intl.formatMessage(transferMessages.error));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCloudCode = async () => {
    if (!selectedProfile) {
      setError(intl.formatMessage(transferMessages.selectProfile));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await onGenerateCloudCode(selectedProfile);
      setCloudCode(result);
    } catch (err) {
      setError(err.message || intl.formatMessage(transferMessages.error));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateEmail = async () => {
    if (!selectedProfile) {
      setError(intl.formatMessage(transferMessages.selectProfile));
      return;
    }
    if (!email || !email.includes('@')) {
      setError(intl.formatMessage(transferMessages.invalidEmail));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onGenerateEmail(selectedProfile, email);
      setError(null);
      alert(intl.formatMessage(transferMessages.emailSent));
    } catch (err) {
      setError(err.message || intl.formatMessage(transferMessages.error));
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemCode = async () => {
    if (!redeemCode) {
      setError(intl.formatMessage(transferMessages.enterCode));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onRedeemCode(redeemCode);
      alert(intl.formatMessage(transferMessages.profileImported));
      setRedeemCode('');
    } catch (err) {
      setError(err.message || intl.formatMessage(transferMessages.invalidCode));
    } finally {
      setLoading(false);
    }
  };
  
  return (
  <React.Fragment>
    <IconButton
      label={label}
      disabled={disabled || open}
      onClick={onShareClick}
    >
      <ShareIcon />
    </IconButton>

    <Dialog
      open={open}
      onClose={onShareClose}
      fullScreen={fullScreen}
      className="ShareDialog__container"
    >
      <DialogTitle className="ShareDialog__title">
        <FormattedMessage {...messages.title} />

        <IconButton
          label={intl.formatMessage(messages.close)}
          onClick={onShareClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent className="ShareDialog__content">
        <Tabs value={activeTab} onChange={handleTabChange} style={{ marginBottom: '16px' }}>
          <Tab label={<FormattedMessage {...messages.shareTab} />} />
          <Tab label={<FormattedMessage {...transferMessages.transfer} />} />
        </Tabs>

        {/* Share Tab */}
        {activeTab === 0 && (
          <>
        <div className="ShareDialog__content__publish">
          {isLogged ? (
            <PremiumFeature>
              <Button
                color="primary"
                variant={isPublic ? 'outlined' : 'contained'}
                onClick={publishBoard}
              >
                {!isPublic ? (
                  <FormattedMessage {...messages.publishBoard} />
                ) : (
                  <FormattedMessage {...messages.unpublishBoard} />
                )}
              </Button>
            </PremiumFeature>
          ) : (
            <React.Fragment>
              <Alert severity="warning">
                <FormattedMessage {...messages.unregisteredWarning} />
              </Alert>
              <Button
                color="primary"
                variant="contained"
                component={Link}
                to="/login-signup"
              >
                <FormattedMessage {...messages.loginSignUp} />
              </Button>
            </React.Fragment>
          )}
        </div>
        {isLogged && (
          <div className="ShareDialog__socialIcons">
            <PremiumFeature>
              <Button disabled={!isPublic} onClick={onCopyLink} color="primary">
                <div className="ShareDialog__socialIcons__copyAction">
                  <div>
                    <CopyIcon />
                  </div>
                  <FormattedMessage {...messages.copyLink} />
                </div>
              </Button>
              <Button disabled={!isPublic}>
                <EmailShareButton
                  subject={intl.formatMessage(messages.subject)}
                  body={intl.formatMessage(messages.body, { url: url })}
                  url={url}
                >
                  <EmailIcon round />
                  <FormattedMessage id="email" {...messages.email} />
                </EmailShareButton>
              </Button>

              {!isAndroid() ? (
                <Button disabled={!isPublic}>
                  <FacebookShareButton
                    quote={intl.formatMessage(messages.subject)}
                    url={url}
                  >
                    <FacebookIcon round />
                    <FormattedMessage id="facebook" {...messages.facebook} />
                  </FacebookShareButton>
                </Button>
              ) : (
                <Button
                  disabled={!isPublic}
                  onClick={() => shareBoardOnFacebook(url, intl)}
                >
                  <div>
                    <FacebookIcon round />
                    <FormattedMessage id="facebook" {...messages.facebook} />
                  </div>
                </Button>
              )}

              <Button disabled={!isPublic}>
                <TwitterShareButton
                  title={intl.formatMessage(messages.subject)}
                  hashtags={['cboard', 'AAC']}
                  url={url}
                >
                  <TwitterIcon round />
                  <FormattedMessage id="twitter" {...messages.twitter} />
                </TwitterShareButton>
              </Button>
              <Button disabled={!isPublic}>
                <WhatsappShareButton
                  title={intl.formatMessage(messages.subject)}
                  url={url}
                >
                  <WhatsappIcon round />
                  <FormattedMessage id="whatsapp" {...messages.whatsapp} />
                </WhatsappShareButton>
              </Button>
              <Button disabled={!isPublic}>
                <RedditShareButton
                  title={intl.formatMessage(messages.subject)}
                  url={url}
                >
                  <RedditIcon round />
                  <FormattedMessage id="reddit" {...messages.reddit} />
                </RedditShareButton>
              </Button>
            </PremiumFeature>
          </div>
        )}
          </>
        )}

        {/* Transfer Tab */}
        {activeTab === 1 && (
          <div style={{ padding: '16px' }}>
            {error && (
              <Alert severity="error" style={{ marginBottom: '16px' }}>
                {error}
              </Alert>
            )}

            <Tabs value={transferSubTab} onChange={(e, val) => setTransferSubTab(val)} style={{ marginBottom: '16px' }}>
              <Tab label={<FormattedMessage {...transferMessages.export} />} />
              <Tab label={<FormattedMessage {...transferMessages.import} />} />
            </Tabs>

            {/* Export Sub-tab */}
            {activeTab === 1 && transferSubTab === 0 && (
              <div>
                <FormControl fullWidth style={{ marginBottom: '16px' }}>
                  <InputLabel>
                    <FormattedMessage {...transferMessages.selectProfile} />
                  </InputLabel>
                  <Select
                    value={selectedProfile}
                    onChange={e => setSelectedProfile(e.target.value)}
                  >
                    {profiles.map(profile => (
                      <MenuItem key={profile.id} value={profile.id}>
                        {profile.name || profile.display_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <div style={{ marginTop: '24px' }}>
                  <Typography variant="h6" gutterBottom>
                    <FormattedMessage {...transferMessages.qrCode} />
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleGenerateQR}
                    disabled={loading || !selectedProfile}
                    style={{ marginBottom: '16px' }}
                  >
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      <FormattedMessage {...transferMessages.generateQR} />
                    )}
                  </Button>

                  {qrData && (
                    <div style={{ textAlign: 'center', padding: '16px' }}>
                      <Typography variant="body1" gutterBottom>
                        <FormattedMessage {...transferMessages.qrCodeTitle} />
                      </Typography>
                      <QRCodeDisplay token={qrData.token} />
                      <Typography variant="body2" style={{ marginTop: '16px' }}>
                        <FormattedMessage {...transferMessages.qrExpires} />{' '}
                        {new Date(qrData.expires_at).toLocaleString()}
                      </Typography>
                    </div>
                  )}
                </div>

                <Divider style={{ margin: '24px 0' }} />

                <div>
                  <Typography variant="h6" gutterBottom>
                    <FormattedMessage {...transferMessages.cloudCode} />
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleGenerateCloudCode}
                    disabled={loading || !selectedProfile}
                    style={{ marginBottom: '16px' }}
                  >
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      <FormattedMessage {...transferMessages.generateCloudCode} />
                    )}
                  </Button>

                  {cloudCode && (
                    <div>
                      <Typography variant="body1" gutterBottom>
                        <FormattedMessage {...transferMessages.yourCode} />
                      </Typography>
                      <div style={{
                        padding: '16px',
                        margin: '16px 0',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '4px',
                        textAlign: 'center',
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        fontFamily: 'monospace'
                      }}>
                        {cloudCode.code}
                      </div>
                      <Typography variant="body2" color="textSecondary">
                        <FormattedMessage {...transferMessages.codeExpires} />{' '}
                        {new Date(cloudCode.expires_at).toLocaleString()}
                      </Typography>
                    </div>
                  )}
                </div>

                <Divider style={{ margin: '24px 0' }} />

                <div>
                  <Typography variant="h6" gutterBottom>
                    <FormattedMessage {...transferMessages.emailTransfer} />
                  </Typography>
                  <TextField
                    fullWidth
                    label={<FormattedMessage {...transferMessages.recipientEmail} />}
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={{ marginBottom: '16px' }}
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleGenerateEmail}
                    disabled={loading || !selectedProfile || !email}
                  >
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      <FormattedMessage {...transferMessages.sendEmail} />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Import Sub-tab */}
            {activeTab === 1 && transferSubTab === 1 && (
              <div>
                <Typography variant="h6" gutterBottom>
                  <FormattedMessage {...transferMessages.redeemCode} />
                </Typography>
                
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => setShowQRScanner(true)}
                  fullWidth
                  style={{ marginBottom: '16px' }}
                  startIcon={<CameraAltIcon />}
                >
                  <FormattedMessage {...transferMessages.scanQRCode} />
                </Button>

                <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center' }}>
                  <Divider style={{ flex: 1 }} />
                  <Typography variant="body2" color="textSecondary" style={{ margin: '0 16px' }}>
                    <FormattedMessage {...transferMessages.enterCodeManually} />
                  </Typography>
                  <Divider style={{ flex: 1 }} />
                </div>

                <TextField
                  fullWidth
                  label={<FormattedMessage {...transferMessages.enterCode} />}
                  value={redeemCode}
                  onChange={e => setRedeemCode(e.target.value.toUpperCase())}
                  placeholder="ABC-123-XYZ"
                  style={{ marginBottom: '16px' }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleRedeemCode}
                  disabled={loading || !redeemCode}
                  fullWidth
                >
                  {loading ? (
                    <CircularProgress size={24} />
                  ) : (
                    <FormattedMessage {...transferMessages.importProfile} />
                  )}
                </Button>
              </div>
            )}

            {/* QR Scanner Dialog */}
            <QRCodeScanner
              open={showQRScanner}
              onClose={() => setShowQRScanner(false)}
              onScan={async (token) => {
                setShowQRScanner(false);
                if (token && token.length > 0) {
                  setRedeemCode(token);
                  setLoading(true);
                  setError(null);
                  try {
                    await onRedeemCode(token);
                    alert(intl.formatMessage(transferMessages.profileImported));
                    setRedeemCode('');
                  } catch (err) {
                    setError(err.message || intl.formatMessage(transferMessages.invalidCode));
                  } finally {
                    setLoading(false);
                  }
                }
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  </React.Fragment>
  );
};

BoardShare.defaultProps = {
  open: false,
  disabled: false,
  onShareClose: () => {},
  onCopyLink: () => {}
};

BoardShare.propTypes = {
  open: PropTypes.bool,
  intl: PropTypes.object.isRequired,
  url: PropTypes.string.isRequired,
  onShareClose: PropTypes.func,
  onShareClick: PropTypes.func.isRequired,
  onCopyLink: PropTypes.func.isRequired,
  profiles: PropTypes.array,
  onGenerateQR: PropTypes.func,
  onGenerateCloudCode: PropTypes.func,
  onGenerateEmail: PropTypes.func,
  onRedeemCode: PropTypes.func
};

export default BoardShare;
