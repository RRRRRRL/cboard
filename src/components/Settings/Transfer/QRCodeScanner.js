import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import Typography from '@material-ui/core/Typography';
import CircularProgress from '@material-ui/core/CircularProgress';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import CameraAltIcon from '@material-ui/icons/CameraAlt';
import PhotoLibraryIcon from '@material-ui/icons/PhotoLibrary';
import messages from './Transfer.messages';

const QRCodeScanner = ({ open, onClose, onScan }) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('camera'); // 'camera' or 'upload'
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const scanIntervalRef = useRef(null);

  useEffect(() => {
    if (open && mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  const startCamera = async () => {
    try {
      setError(null);
      setScanning(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera on mobile
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Start scanning with BarcodeDetector API if available
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new window.BarcodeDetector({
          formats: ['qr_code']
        });

        scanIntervalRef.current = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState === 4) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const qrData = barcodes[0].rawValue;
                stopCamera();
                onScan(qrData);
              }
            } catch (err) {
              // Continue scanning
            }
          }
        }, 500);
      } else {
        // Fallback: Use QR code library or manual input
        setError('QR code scanning not supported. Please use image upload or enter code manually.');
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Camera access denied. Please use image upload or enter code manually.');
      setMode('upload');
    } finally {
      setScanning(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setError(null);
      setScanning(true);

      // Create image element
      const img = new Image();
      const reader = new FileReader();

      reader.onload = async (e) => {
        img.src = e.target.result;
        img.onload = async () => {
          try {
            // Use BarcodeDetector API if available
            if ('BarcodeDetector' in window) {
              const barcodeDetector = new window.BarcodeDetector({
                formats: ['qr_code']
              });
              const barcodes = await barcodeDetector.detect(img);
              
              if (barcodes.length > 0) {
                const qrData = barcodes[0].rawValue;
                onScan(qrData);
              } else {
                setError('No QR code found in image. Please try another image.');
              }
            } else {
              // Fallback: Use canvas and QR code library
              // For now, show error
              setError('QR code detection not supported in this browser. Please enter code manually.');
            }
          } catch (err) {
            console.error('QR detection error:', err);
            setError('Failed to detect QR code. Please try another image or enter code manually.');
          } finally {
            setScanning(false);
          }
        };
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Image upload error:', err);
      setError('Failed to process image. Please try again.');
      setScanning(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <FormattedMessage {...messages.scanQRCode} />
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </div>
      </DialogTitle>
      <DialogContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Mode Selection */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <Button
              variant={mode === 'camera' ? 'contained' : 'outlined'}
              color="primary"
              startIcon={<CameraAltIcon />}
              onClick={() => {
                setMode('camera');
                setError(null);
              }}
            >
              <FormattedMessage {...messages.useCamera} />
            </Button>
            <Button
              variant={mode === 'upload' ? 'contained' : 'outlined'}
              color="primary"
              startIcon={<PhotoLibraryIcon />}
              onClick={() => {
                setMode('upload');
                setError(null);
                stopCamera();
                fileInputRef.current?.click();
              }}
            >
              <FormattedMessage {...messages.uploadImage} />
            </Button>
          </div>

          {/* Camera View */}
          {mode === 'camera' && (
            <div style={{ position: 'relative', width: '100%', paddingBottom: '75%', backgroundColor: '#000' }}>
              <video
                ref={videoRef}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
                playsInline
                muted
              />
              {scanning && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: '#fff'
                }}>
                  <CircularProgress size={40} />
                </div>
              )}
            </div>
          )}

          {/* Upload View */}
          {mode === 'upload' && (
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />
              <PhotoLibraryIcon style={{ fontSize: 64, color: '#ccc', marginBottom: '16px' }} />
              <Typography variant="body2" color="textSecondary">
                <FormattedMessage {...messages.selectImageFile} />
              </Typography>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <Typography variant="body2" color="error" style={{ marginTop: '8px' }}>
              {error}
            </Typography>
          )}

          {/* Instructions */}
          <Typography variant="caption" color="textSecondary" style={{ marginTop: '8px' }}>
            <FormattedMessage {...messages.qrScanInstructions} />
          </Typography>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          <FormattedMessage {...messages.cancel} />
        </Button>
      </DialogActions>
    </Dialog>
  );
};

QRCodeScanner.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onScan: PropTypes.func.isRequired
};

export default QRCodeScanner;

