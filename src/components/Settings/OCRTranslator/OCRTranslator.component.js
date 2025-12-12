import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, intlShape } from 'react-intl';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import CircularProgress from '@material-ui/core/CircularProgress';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import IconButton from '@material-ui/core/IconButton';
import DeleteIcon from '@material-ui/icons/Delete';
import PhotoLibraryIcon from '@material-ui/icons/PhotoLibrary';
import GetAppIcon from '@material-ui/icons/GetApp';
import FullScreenDialog from '../../UI/FullScreenDialog';
import messages from './OCRTranslator.messages';
import './OCRTranslator.css';

const styles = theme => ({
  tabPanel: {
    padding: theme.spacing(3)
  },
  uploadArea: {
    border: '2px dashed #ccc',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(4),
    textAlign: 'center',
    cursor: 'pointer',
    marginBottom: theme.spacing(2)
  },
  imagePreview: {
    maxWidth: '100%',
    maxHeight: 400,
    margin: theme.spacing(2),
    borderRadius: theme.shape.borderRadius
  },
  resultArea: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2)
  }
});

function OCRTranslator({
  onClose,
  loading,
  ocrResult,
  translationHistory,
  onRecognizeImage,
  onConvertToJyutping,
  onAnnotateImage,
  onGetHistory,
  onDeleteHistory,
  classes,
  intl
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [recognizedText, setRecognizedText] = useState('');
  const [jyutpingResult, setJyutpingResult] = useState(null);
  const [annotatedImageUrl, setAnnotatedImageUrl] = useState(null);
  const fileInputRef = useRef(null);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    if (newValue === 1) {
      onGetHistory();
    }
  };

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRecognize = async () => {
    if (!imageFile) return;
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Image = e.target.result;
          
          // Try backend OCR first
          let result;
          try {
            result = await onRecognizeImage(base64Image);
            console.log('Backend OCR result:', result);
          } catch (backendError) {
            console.warn('Backend OCR failed, trying client-side:', backendError);
            result = null;
          }
          
          // Handle different possible response structures
          let text = result?.recognized_text || result?.data?.recognized_text || result?.text || '';
          
          // If backend OCR didn't return text, try client-side OCR (Tesseract.js)
          if (!text && window.Tesseract) {
            try {
              console.log('Attempting client-side OCR with Tesseract.js...');
              const { data: { text: ocrText } } = await window.Tesseract.recognize(
                base64Image,
                'chi_sim+eng', // Chinese Simplified + English
                {
                  logger: m => {
                    if (m.status === 'recognizing text') {
                      console.log(`OCR progress: ${Math.round(m.progress * 100)}%`);
                    }
                  }
                }
              );
              text = ocrText.trim();
              console.log('Client-side OCR result:', text);
            } catch (tesseractError) {
              console.error('Tesseract.js OCR error:', tesseractError);
            }
          }
          
          if (text) {
            setRecognizedText(text);
          } else {
            console.warn('No text recognized from image');
            // Show message to user that they can manually enter text
            setRecognizedText('');
            // Optionally show a notification that manual input is available
          }
        } catch (error) {
          console.error('OCR recognize error:', error);
          setRecognizedText('');
        }
      };
      reader.readAsDataURL(imageFile);
    } catch (error) {
      console.error('File read error:', error);
      setRecognizedText('');
    }
  };

  const handleConvert = async () => {
    if (!recognizedText) return;
    
    try {
      const result = await onConvertToJyutping(recognizedText);
      setJyutpingResult(result);
      
      // Create annotations for image
      if (result.characters && imageFile) {
        handleAnnotateImage(result.characters);
      }
    } catch (error) {
      console.error('Convert to Jyutping error:', error);
    }
  };

  const handleAnnotateImage = async (characters) => {
    if (!imageFile || !characters) return;
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Image = e.target.result;
        const annotations = characters.map((char, index) => ({
          x: 50 + (index % 5) * 100,
          y: 50 + Math.floor(index / 5) * 50,
          text: char.character,
          jyutping: char.jyutping || ''
        }));
        
        const result = await onAnnotateImage(base64Image, null, annotations);
        setAnnotatedImageUrl(result.annotated_image_url);
      };
      reader.readAsDataURL(imageFile);
    } catch (error) {
      console.error('Annotate image error:', error);
    }
  };

  const handleDownloadAnnotatedImage = async () => {
    if (!annotatedImageUrl) return;
    
    try {
      const response = await fetch(annotatedImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `annotated-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const renderOCR = () => {
    return (
      <div className={classes.tabPanel}>
        <div
          className={classes.uploadArea}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageSelect}
          />
          {imagePreview ? (
            <img src={imagePreview} alt="Preview" className={classes.imagePreview} />
          ) : (
            <>
              <PhotoLibraryIcon style={{ fontSize: 64, color: '#ccc' }} />
              <Typography variant="body1" style={{ marginTop: '16px' }}>
                <FormattedMessage {...messages.selectImage} />
              </Typography>
            </>
          )}
        </div>

        {imageFile && (
          <Button
            variant="contained"
            color="primary"
            onClick={handleRecognize}
            disabled={loading}
            fullWidth
          >
            {loading ? <CircularProgress size={24} /> : <FormattedMessage {...messages.recognizeText} />}
          </Button>
        )}

        {(recognizedText || imageFile) && (
          <Paper className={classes.resultArea}>
            <Typography variant="h6" gutterBottom>
              <FormattedMessage {...messages.recognizedText} />
            </Typography>
            {!recognizedText && (
              <Typography variant="body2" color="textSecondary" style={{ marginBottom: '8px' }}>
                <FormattedMessage 
                  id="cboard.components.Settings.OCRTranslator.noTextRecognized"
                  defaultMessage="No text was recognized. Please enter the text manually below."
                />
              </Typography>
            )}
            <TextField
              fullWidth
              multiline
              minRows={4}
              value={recognizedText}
              onChange={e => setRecognizedText(e.target.value)}
              variant="outlined"
              placeholder={intl.formatMessage({
                id: 'cboard.components.Settings.OCRTranslator.enterTextManually',
                defaultMessage: 'Enter text manually if OCR did not recognize it...'
              })}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleConvert}
              disabled={loading || !recognizedText}
              fullWidth
              style={{ marginTop: '16px' }}
            >
              <FormattedMessage {...messages.convertToJyutping} />
            </Button>
          </Paper>
        )}

            {jyutpingResult && (
          <Paper className={classes.resultArea}>
            <Typography variant="h6" gutterBottom>
              <FormattedMessage {...messages.jyutpingResult} />
            </Typography>
            <Typography variant="body1" style={{ fontSize: '1.2rem', marginBottom: '16px' }}>
              {jyutpingResult.jyutping}
            </Typography>
            {jyutpingResult.characters && (
              <div>
                <Typography variant="subtitle2" gutterBottom>
                  <FormattedMessage {...messages.characterDetails} />
                </Typography>
                {jyutpingResult.characters.map((char, index) => (
                  <div key={index} style={{ marginBottom: '8px' }}>
                    <strong>{char.character}</strong>: {char.jyutping} 
                    {char.meaning && ` (${char.meaning})`}
                  </div>
                ))}
              </div>
            )}
            {annotatedImageUrl && (
              <div style={{ marginTop: '16px' }}>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<GetAppIcon />}
                  onClick={handleDownloadAnnotatedImage}
                  fullWidth
                >
                  <FormattedMessage {...messages.downloadAnnotated} />
                </Button>
              </div>
            )}
          </Paper>
        )}
      </div>
    );
  };

  const renderHistory = () => {
    return (
      <div className={classes.tabPanel}>
        {loading ? (
          <CircularProgress />
        ) : translationHistory && translationHistory.length > 0 ? (
          <List>
            {translationHistory.map((item) => (
              <ListItem key={item.id}>
                <ListItemText
                  primary={item.recognized_text || '-'}
                  secondary={new Date(item.created_at).toLocaleString()}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() => onDeleteHistory(item.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body1">
            <FormattedMessage {...messages.noHistory} />
          </Typography>
        )}
      </div>
    );
  };

  return (
    <FullScreenDialog
      open
      title={<FormattedMessage {...messages.ocrTranslator} />}
      onClose={onClose}
    >
      <div className="OCRTranslator">
        <Paper>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label={<FormattedMessage {...messages.ocr} />} />
            <Tab label={<FormattedMessage {...messages.history} />} />
          </Tabs>

          {activeTab === 0 && renderOCR()}
          {activeTab === 1 && renderHistory()}
        </Paper>
      </div>
    </FullScreenDialog>
  );
}

OCRTranslator.propTypes = {
  onClose: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  ocrResult: PropTypes.object,
  translationHistory: PropTypes.array,
  onRecognizeImage: PropTypes.func.isRequired,
  onConvertToJyutping: PropTypes.func.isRequired,
  onAnnotateImage: PropTypes.func.isRequired,
  onGetHistory: PropTypes.func.isRequired,
  onDeleteHistory: PropTypes.func.isRequired,
  classes: PropTypes.object.isRequired,
  intl: intlShape.isRequired
};

export default withStyles(styles)(OCRTranslator);

