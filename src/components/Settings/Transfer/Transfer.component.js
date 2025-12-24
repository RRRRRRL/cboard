import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, intlShape } from 'react-intl';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import CircularProgress from '@material-ui/core/CircularProgress';
import Divider from '@material-ui/core/Divider';
import CameraAltIcon from '@material-ui/icons/CameraAlt';
import FullScreenDialog from '../../UI/FullScreenDialog';
import QRCodeScanner from './QRCodeScanner';
import messages from './Transfer.messages';
import './Transfer.css';

// QR Code Component using CDN API (no npm install required)
const QRCodeDisplay = ({ token }) => {
  const [qrCodeUrl, setQrCodeUrl] = React.useState(null);

  React.useEffect(() => {
    // Use QR Server API (free, no installation needed)
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

const propTypes = {
  onClose: PropTypes.func,
  profiles: PropTypes.array.isRequired,
  onGenerateQR: PropTypes.func.isRequired,
  onGenerateCloudCode: PropTypes.func.isRequired,
  onGenerateEmail: PropTypes.func.isRequired,
  onRedeemCode: PropTypes.func.isRequired,
  classes: PropTypes.object.isRequired,
  intl: intlShape.isRequired
};

const styles = theme => ({
  tabPanel: {
    padding: theme.spacing(3)
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 200
  },
  qrCodeContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: theme.spacing(2)
  },
  codeDisplay: {
    padding: theme.spacing(2),
    margin: theme.spacing(2),
    backgroundColor: theme.palette.grey[100],
    borderRadius: theme.shape.borderRadius,
    textAlign: 'center',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    fontFamily: 'monospace'
  }
});

function Transfer({
  onClose,
  profiles,
  onGenerateQR,
  onGenerateCloudCode,
  onGenerateEmail,
  onRedeemCode,
  classes,
  intl
}) {
  const [activeTab, setActiveTab] = useState(0);
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
      setError(intl.formatMessage(messages.selectProfile));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await onGenerateQR(selectedProfile);
      setQrData(result);
    } catch (err) {
      setError(err.message || intl.formatMessage(messages.error));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCloudCode = async () => {
    if (!selectedProfile) {
      setError(intl.formatMessage(messages.selectProfile));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await onGenerateCloudCode(selectedProfile);
      setCloudCode(result);
    } catch (err) {
      setError(err.message || intl.formatMessage(messages.error));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateEmail = async () => {
    if (!selectedProfile) {
      setError(intl.formatMessage(messages.selectProfile));
      return;
    }

    if (!email || !email.includes('@')) {
      setError(intl.formatMessage(messages.invalidEmail));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onGenerateEmail(selectedProfile, email);
      setError(null);
      alert(intl.formatMessage(messages.emailSent));
    } catch (err) {
      setError(err.message || intl.formatMessage(messages.error));
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemCode = async () => {
    if (!redeemCode) {
      setError(intl.formatMessage(messages.enterCode));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onRedeemCode(redeemCode);
      alert(intl.formatMessage(messages.profileImported));
      setRedeemCode('');
    } catch (err) {
      setError(err.message || intl.formatMessage(messages.invalidCode));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FullScreenDialog
      open
      title={<FormattedMessage {...messages.transfer} />}
      onClose={onClose}
    >
      <div className="Transfer">
        <Paper>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label={<FormattedMessage {...messages.export} />} />
            <Tab label={<FormattedMessage {...messages.import} />} />
          </Tabs>

          {error && (
            <Typography color="error" style={{ padding: '16px' }}>
              {error}
            </Typography>
          )}

          {/* Export Tab */}
          {activeTab === 0 && (
            <div className={classes.tabPanel}>
              <FormControl className={classes.formControl} fullWidth>
                <InputLabel>
                  <FormattedMessage {...messages.selectProfile} />
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
                  <FormattedMessage {...messages.qrCode} />
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
                    <FormattedMessage {...messages.generateQR} />
                  )}
                </Button>

                {qrData && (
                  <div className={classes.qrCodeContainer}>
                    <Typography variant="body1" gutterBottom>
                      <FormattedMessage {...messages.qrCodeTitle} />
                    </Typography>
                    <QRCodeDisplay token={qrData.token} />
                    <Typography variant="body2" style={{ marginTop: '16px' }}>
                      <FormattedMessage {...messages.qrExpires} />{' '}
                      {new Date(qrData.expires_at).toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="textSecondary" style={{ marginTop: '8px' }}>
                      <FormattedMessage {...messages.qrInstructions} />
                    </Typography>
                  </div>
                )}
              </div>

              <Divider style={{ margin: '24px 0' }} />

              <div>
                <Typography variant="h6" gutterBottom>
                  <FormattedMessage {...messages.cloudCode} />
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
                    <FormattedMessage {...messages.generateCloudCode} />
                  )}
                </Button>

                {cloudCode && (
                  <div>
                    <Typography variant="body1" gutterBottom>
                      <FormattedMessage {...messages.yourCode} />
                    </Typography>
                    <div className={classes.codeDisplay}>
                      {cloudCode.code}
                    </div>
                    <Typography variant="body2" color="textSecondary">
                      <FormattedMessage {...messages.codeExpires} />{' '}
                      {new Date(cloudCode.expires_at).toLocaleString()}
                    </Typography>
                  </div>
                )}
              </div>

              <Divider style={{ margin: '24px 0' }} />

              <div>
                <Typography variant="h6" gutterBottom>
                  <FormattedMessage {...messages.emailTransfer} />
                </Typography>
                <TextField
                  fullWidth
                  label={<FormattedMessage {...messages.recipientEmail} />}
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
                    <FormattedMessage {...messages.sendEmail} />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Import Tab */}
          {activeTab === 1 && (
            <div className={classes.tabPanel}>
              <Typography variant="h6" gutterBottom>
                <FormattedMessage {...messages.redeemCode} />
              </Typography>
              
              <div style={{ marginBottom: '16px' }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => setShowQRScanner(true)}
                  fullWidth
                  style={{ marginBottom: '16px' }}
                  startIcon={<CameraAltIcon />}
                >
                  <FormattedMessage {...messages.scanQRCode} />
                </Button>
              </div>

              <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center' }}>
                <Divider style={{ flex: 1 }} />
                <Typography variant="body2" color="textSecondary" style={{ margin: '0 16px' }}>
                  <FormattedMessage {...messages.enterCodeManually} />
                </Typography>
                <Divider style={{ flex: 1 }} />
              </div>

              <TextField
                fullWidth
                label={<FormattedMessage {...messages.enterCode} />}
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
                  <FormattedMessage {...messages.importProfile} />
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
                // Auto-redeem the token
                setLoading(true);
                setError(null);
                try {
                  await onRedeemCode(token);
                  alert(intl.formatMessage(messages.profileImported));
                  setRedeemCode('');
                } catch (err) {
                  setError(err.message || intl.formatMessage(messages.invalidCode));
                } finally {
                  setLoading(false);
                }
              }
            }}
          />
        </Paper>
      </div>
    </FullScreenDialog>
  );
}

Transfer.propTypes = propTypes;

export default withStyles(styles)(Transfer);

