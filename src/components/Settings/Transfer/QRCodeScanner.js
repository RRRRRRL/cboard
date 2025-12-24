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

// Load jsQR library for QR code scanning fallback
let jsQR = null;
if (typeof window !== 'undefined') {
  if (!window.jsQR) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    script.async = true;
    document.head.appendChild(script);
    script.onload = () => {
      jsQR = window.jsQR;
    };
  } else {
    jsQR = window.jsQR;
  }
}

// Simple shared camera stream manager to avoid "busy" errors across features
if (typeof window !== 'undefined' && !window.__sharedCamera) {
  window.__sharedCamera = { stream: null, refs: 0 };
}

const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

async function pickCameraConstraints() {
  // Try to prefer back camera if available
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(d => d.kind === 'videoinput');

    // Prefer any device with 'back'/'rear'/'environment' in label
    const back = videoInputs.find(d => /back|rear|environment/i.test(d.label));
    if (back) {
      return { video: { deviceId: { exact: back.deviceId } } };
    }
    // Fall back to first camera
    if (videoInputs[0]) {
      return { video: { deviceId: { exact: videoInputs[0].deviceId } } };
    }
  } catch {
    // ignore; will use generic constraint
  }
  // Generic fallback
  return { video: { facingMode: { ideal: 'environment' } } };
}

const QRCodeScanner = ({ open, onClose, onScan }) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('camera'); // 'camera' or 'upload'

  const videoRef = useRef(null);
  const ownedStreamRef = useRef(false); // whether we created the stream
  const startingRef = useRef(false);    // prevent double start in StrictMode
  const startedOnceRef = useRef(false); // only auto-start once per open
  const scanIntervalRef = useRef(null);
  const fileInputRef = useRef(null);

  // Reset per-open state
  useEffect(() => {
    if (!open) {
      stopCamera();
      startedOnceRef.current = false;
      setMode('camera');
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-start camera only when dialog is open + camera mode + visible,
  // but avoid double-initialization in StrictMode.
  useEffect(() => {
    if (!open || mode !== 'camera') return;

    // If dialog is opening, ensure it's visible before starting
    const tryStart = async () => {
      if (startingRef.current || scanning) return;
      if (document.visibilityState !== 'visible') return;
      startingRef.current = true;
      try {
        await startCamera();
        startedOnceRef.current = true;
      } finally {
        startingRef.current = false;
      }
    };

    // On iOS/Safari, prefer user gesture (button) to startCamera
    if (isIOS() && !startedOnceRef.current) {
      // Do not auto-start; wait for user to click "Use Camera"
      return;
    }

    const t = setTimeout(tryStart, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  async function getSharedStreamOrNew(constraints) {
    const shared = window.__sharedCamera;
    if (shared.stream && shared.stream.getVideoTracks().some(t => t.readyState === 'live')) {
      shared.refs += 1;
      ownedStreamRef.current = false;
      return shared.stream;
    }
    // Request new stream
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    shared.stream = stream;
    shared.refs = 1;
    ownedStreamRef.current = true;
    return stream;
  }

  const startCamera = async () => {
    try {
      setError(null);
      setScanning(true);

      // Many mobile browsers require HTTPS or localhost for camera access.
      // If we're on an insecure origin (e.g. http://192.168.x.x), getUserMedia
      // may fail immediately without showing a permission prompt.
      const isLocalhost =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1');
      const isSecureOrigin =
        (typeof window !== 'undefined' && window.isSecureContext) ||
        (typeof window !== 'undefined' && window.location.protocol === 'https:') ||
        isLocalhost;

      if (!isSecureOrigin) {
        setScanning(false);
        setError(
          'Camera access on mobile devices requires HTTPS or localhost. ' +
          'Please open this page with a secure (https://) URL or use image upload instead.'
        );
        return;
      }

      // Choose constraints robustly
      let constraints = await pickCameraConstraints();

      let stream;
      try {
        stream = await getSharedStreamOrNew(constraints);
      } catch (err) {
        // Retry with generic constraint
        constraints = { video: true };
        stream = await getSharedStreamOrNew(constraints);
      }

      const tracks = stream.getVideoTracks();
      if (!tracks.length) throw new Error('No video tracks in stream');

      const track = tracks[0];
      if (track.readyState !== 'live') throw new Error(`Camera track not live: ${track.readyState}`);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Important for autoplay reliability
        videoRef.current.muted = true;
        videoRef.current.setAttribute('playsInline', 'true');
        try {
          await videoRef.current.play();
        } catch (playError) {
          // On iOS, require user gesture
          if (isIOS()) {
            setError('Tap "Use Camera" to start scanning.');
          } else {
            console.warn('Video play error:', playError);
          }
        }
      }

      // Wait until metadata is ready (dimensions known)
      await new Promise((resolve, reject) => {
        const v = videoRef.current;
        if (!v) return reject(new Error('Video element not available'));
        if (v.readyState >= 2 && v.videoWidth && v.videoHeight) return resolve();
        const timeout = setTimeout(() => reject(new Error('Video ready timeout')), 6000);
        const onMeta = () => {
          if (v.videoWidth && v.videoHeight) {
            clearTimeout(timeout);
            resolve();
          }
        };
        v.addEventListener('loadedmetadata', onMeta, { once: true });
      });

      // Start scanning (BarcodeDetector if available; otherwise jsQR)
      if ('BarcodeDetector' in window) {
        try {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          scanIntervalRef.current = setInterval(async () => {
            const v = videoRef.current;
            if (!v || v.readyState < 2) return;
            try {
              const codes = await detector.detect(v);
              if (codes && codes.length > 0) {
                const qrData = codes[0].rawValue;
                onScan(qrData);
                stopCamera();
              }
            } catch {
              // ignore detection errors
            }
          }, 350);
        } catch (e) {
          console.warn('BarcodeDetector init failed; falling back to jsQR', e);
          startJSQRScanning();
        }
      } else {
        startJSQRScanning();
      }
    } catch (err) {
      console.error('❌ QR Scanner camera error:', err);
      let userErrorMessage = 'Camera access denied. Please use image upload or enter code manually.';
      const name = err?.name || '';
      const msg = String(err?.message || err || '');

      if (name === 'NotAllowedError' || /permission/i.test(msg)) {
        userErrorMessage = 'Camera permission denied. Allow camera access in your browser settings and try again.';
      } else if (name === 'NotFoundError' || /no device/i.test(msg)) {
        userErrorMessage = 'No camera found. Connect a camera or use image upload.';
      } else if (name === 'NotReadableError' || /busy|in use/i.test(msg)) {
        userErrorMessage = 'Camera is busy in another app/tab. Close other uses (e.g., eye tracking) and try again.';
      } else if (name === 'OverconstrainedError') {
        userErrorMessage = 'Requested camera not available. Switching to another camera may help.';
      } else if (/timeout/i.test(msg)) {
        userErrorMessage = 'Camera initialization timeout. Try again.';
      }
      setError(userErrorMessage);
      setScanning(false);
    }
  };

  const startJSQRScanning = () => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    scanIntervalRef.current = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.readyState < 2 || !v.videoWidth || !v.videoHeight) return;
      try {
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        context.drawImage(v, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

        const qrLib = jsQR || window.jsQR;
        if (qrLib) {
          const qr = qrLib(imageData.data, imageData.width, imageData.height);
          if (qr) {
            onScan(qr.data);
            stopCamera();
          }
        }
      } catch {
        // ignore per-frame errors
      }
    }, 300);
  };

  const releaseSharedStream = () => {
    const shared = window.__sharedCamera;
    if (!shared.stream) return;

    shared.refs = Math.max(0, (shared.refs || 0) - 1);
    if (ownedStreamRef.current && shared.refs === 0) {
      try {
        shared.stream.getTracks().forEach(t => t.stop());
      } catch {}
      shared.stream = null;
    }
    ownedStreamRef.current = false;
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch {}
    }
    releaseSharedStream();
    setScanning(false);
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      setScanning(true);

      const img = new Image();
      const reader = new FileReader();

      reader.onload = () => {
        img.src = reader.result;
        img.onload = async () => {
          try {
            let qrData = null;

            if ('BarcodeDetector' in window) {
              try {
                const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
                const codes = await detector.detect(img);
                if (codes.length > 0) {
                  qrData = codes[0].rawValue;
                }
              } catch (e) {
                console.warn('BarcodeDetector (image) failed; using jsQR', e);
              }
            }

            if (!qrData && (jsQR || window.jsQR)) {
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.width = img.width;
              canvas.height = img.height;
              context.drawImage(img, 0, 0, canvas.width, canvas.height);
              const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
              const qr = (jsQR || window.jsQR)(imageData.data, imageData.width, imageData.height);
              if (qr) qrData = qr.data;
            }

            if (qrData) {
              onScan(qrData);
            } else {
              setError('No QR code found in image. Try another image or enter code manually.');
            }
          } catch (e) {
            console.error('QR detection error:', e);
            setError('Failed to detect QR code. Try another image.');
          } finally {
            setScanning(false);
          }
        };
      };

      reader.readAsDataURL(file);
    } catch (e) {
      console.error('Image upload error:', e);
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
              onClick={async () => {
                setMode('camera');
                setError(null);
                // On iOS, start camera on explicit user gesture
                if (isIOS() && open && !scanning && !startingRef.current) {
                  startingRef.current = true;
                  try {
                    await startCamera();
                    startedOnceRef.current = true;
                  } finally {
                    startingRef.current = false;
                  }
                }
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
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                autoPlay
                playsInline
                muted
              />
              {scanning && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#fff' }}>
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

          {error && (
            <Typography variant="body2" color="error" style={{ marginTop: '8px' }}>
              {error}
            </Typography>
          )}

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