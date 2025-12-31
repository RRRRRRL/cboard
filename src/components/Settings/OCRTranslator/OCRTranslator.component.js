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
  const [ocrJobId, setOcrJobId] = useState(null);
  const [ocrStatusUrl, setOcrStatusUrl] = useState(null);
  const [ocrTimeout, setOcrTimeout] = useState(false);
  const [ocrStatusCheck, setOcrStatusCheck] = useState(null);
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

    console.log('[OCR DEBUG] Starting OCR recognition for file:', imageFile.name, 'Size:', imageFile.size, 'bytes');

    // Reset states
    setRecognizedText('');
    setOcrJobId(null);
    setOcrStatusUrl(null);
    setOcrTimeout(false);
    if (ocrStatusCheck) {
      clearInterval(ocrStatusCheck);
      setOcrStatusCheck(null);
    }

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Image = e.target.result;
          console.log('[OCR DEBUG] Image converted to base64, length:', base64Image.length, 'characters');

          // Try backend OCR first - according to API docs, this is a blocking request (up to 2 minutes)
          let result;
          try {
            console.log('[OCR DEBUG] Starting backend OCR request (blocking, up to 2 minutes)...');
            result = await onRecognizeImage(base64Image);
            console.log('[OCR DEBUG] Backend OCR response received:', result);

            // Check if it's a timeout response with status URL
            if (result?.error && result?.check_status_url) {
              console.log('OCR timed out, status URL provided:', result.check_status_url);
              setOcrJobId(result.job_id);
              setOcrStatusUrl(result.check_status_url);
              setOcrTimeout(true);

              // Start polling the status URL
              const statusInterval = setInterval(async () => {
                try {
                  console.log('Checking OCR job status...');
                  const statusResponse = await fetch(result.check_status_url);
                  const statusData = await statusResponse.json();

                  if (statusData.status === 'completed' && statusData.original_text) {
                    console.log('OCR job completed:', statusData);
                    setRecognizedText(statusData.original_text);
                    setOcrTimeout(false);
                    setOcrJobId(null);
                    setOcrStatusUrl(null);
                    clearInterval(statusInterval);
                    setOcrStatusCheck(null);
                  } else if (statusData.status === 'failed') {
                    console.error('OCR job failed');
                    setOcrTimeout(false);
                    setOcrJobId(null);
                    setOcrStatusUrl(null);
                    clearInterval(statusInterval);
                    setOcrStatusCheck(null);
                    // Fall back to client-side OCR
                    throw new Error('OCR job failed');
                  }
                  // Continue polling if still processing
                } catch (statusError) {
                  console.error('Error checking OCR status:', statusError);
                }
              }, 5000); // Check every 5 seconds

              setOcrStatusCheck(statusInterval);
              return; // Exit early, status checking will handle the result
            }
          } catch (backendError) {
            console.warn('Backend OCR failed:', backendError);
            // Continue to client-side fallback
          }

          // Handle successful backend OCR response
          let text = result?.recognized_text || result?.data?.recognized_text || result?.original_text || result?.text || '';

          if (text) {
            setRecognizedText(text);
            return; // Success, no need for fallback
          }

          // If backend OCR didn't return text, try client-side OCR (Tesseract.js)
          console.log('Backend OCR returned no text, trying client-side OCR...');

          if (!window.Tesseract) {
            console.warn('Tesseract.js not available for client-side OCR');
            setRecognizedText('');
            return;
          }

          try {
            console.log('Attempting client-side OCR with Tesseract.js...');

            // Priority: Traditional Chinese > English > Simplified Chinese
            // Try multiple configurations for best results
            const recognitionAttempts = [
              {
                lang: 'chi_tra+eng+chi_sim', // Traditional Chinese first
                psm: '6', // Uniform block of text
                description: 'Traditional Chinese + English + Simplified (PSM 6)'
              },
              {
                lang: 'chi_tra+eng', // Traditional Chinese + English only
                psm: '6',
                description: 'Traditional Chinese + English (PSM 6)'
              },
              {
                lang: 'chi_tra+eng+chi_sim',
                psm: '11', // Sparse text
                description: 'Traditional Chinese + English + Simplified (PSM 11)'
              },
              {
                lang: 'chi_tra', // Traditional Chinese only
                psm: '6',
                description: 'Traditional Chinese only (PSM 6)'
              }
            ];

            let bestResult = '';
            let bestConfidence = 0;

            for (const attempt of recognitionAttempts) {
              try {
                console.log(`Trying OCR with: ${attempt.description}`);
                const ocrResult = await window.Tesseract.recognize(
                  base64Image,
                  attempt.lang,
                  {
                    logger: m => {
                      if (m.status === 'recognizing text') {
                        console.log(`OCR progress: ${Math.round(m.progress * 100)}%`);
                      }
                    },
                    tessedit_pageseg_mode: attempt.psm,
                    tessedit_ocr_engine_mode: '1', // Neural nets LSTM engine only
                    // Optimize for Traditional Chinese characters
                    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz\u4e00-\u9fff\u3400-\u4dbf\u20000-\u2a6df\u2a700-\u2b73f\u2b740-\u2b81f\u2b820-\u2ceaf',
                  }
                );

                const recognizedText = ocrResult.data.text.trim();
                const confidence = ocrResult.data.confidence || 0;

                // Prefer results with higher confidence and more text
                if (recognizedText.length > 0 && (confidence > bestConfidence || recognizedText.length > bestResult.length)) {
                  bestResult = recognizedText;
                  bestConfidence = confidence;
                  console.log(`Better result found: ${recognizedText.substring(0, 50)}... (confidence: ${confidence})`);
                }

                // If we got a good result, we can stop early
                if (confidence > 80 && recognizedText.length > 5) {
                  break;
                }
              } catch (attemptError) {
                console.warn(`OCR attempt failed: ${attempt.description}`, attemptError);
                continue;
              }
            }

            if (bestResult) {
              text = bestResult;
              console.log(`Final OCR result: ${text.substring(0, 100)}... (confidence: ${bestConfidence})`);
            } else {
              // Final fallback: simplified Chinese
              console.log('Trying final fallback with Simplified Chinese...');
              const { data: { text: fallbackText } } = await window.Tesseract.recognize(
                base64Image,
                'chi_sim+eng',
                { tessedit_pageseg_mode: '6' }
              );
              text = fallbackText.trim();
              console.log('Fallback OCR result:', text);
            }

            setRecognizedText(text || '');
          } catch (tesseractError) {
            console.error('Tesseract.js OCR error:', tesseractError);
            setRecognizedText('');
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

        {(recognizedText || imageFile || ocrTimeout) && (
          <Paper className={classes.resultArea}>
            <Typography variant="h6" gutterBottom>
              <FormattedMessage {...messages.recognizedText} />
            </Typography>

            {ocrTimeout && (
              <Typography variant="body2" color="textSecondary" style={{ marginBottom: '8px', padding: '8px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
                <FormattedMessage
                  id="cboard.components.Settings.OCRTranslator.processing"
                  defaultMessage="OCR is being processed in the background. The result will appear here when ready..."
                />
                {ocrJobId && (
                  <span style={{ display: 'block', marginTop: '4px', fontSize: '0.8rem' }}>
                    Job ID: {ocrJobId}
                  </span>
                )}
              </Typography>
            )}

            {!recognizedText && !ocrTimeout && (
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
              disabled={ocrTimeout}
            />

            <Button
              variant="contained"
              color="primary"
              onClick={handleConvert}
              disabled={loading || !recognizedText || ocrTimeout}
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
    const getDisplayRecognizedText = (item) => {
      // Helper: try to parse a JSON string safely
      const tryParseJson = (value) => {
        if (!value || typeof value !== 'string') return null;
        const trimmed = value.trim();
        if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return null;
        try {
          return JSON.parse(trimmed);
        } catch (e) {
          return null;
        }
      };

      const looksLikeJson = (value) => {
        if (!value || typeof value !== 'string') return false;
        const t = value.trim();
        return (t.startsWith('{') || t.startsWith('['));
      };

      // 1) Backend recognized_text (只有在「不是 JSON」時直接用)
      if (item.recognized_text && typeof item.recognized_text === 'string' && !looksLikeJson(item.recognized_text)) {
        return item.recognized_text;
      }

      // 2) annotations 字段：可能是已解析的陣列，或是 JSON 字串
      let annotations = null;
      if (Array.isArray(item.annotations)) {
        annotations = item.annotations;
      } else {
        const parsed = tryParseJson(item.annotations);
        if (parsed) {
          // 可能是 { annotations: [...] } 或直接是陣列
          if (Array.isArray(parsed)) {
            annotations = parsed;
          } else if (parsed.annotations && Array.isArray(parsed.annotations)) {
            annotations = parsed.annotations;
          }
        }
      }

      if (annotations && annotations.length) {
        // 只取每個 annotation 的 text 欄位，不顯示 x,y,type 等資訊
        const textFromAnnotations = annotations
          .map(a => (a && typeof a.text === 'string' ? a.text : ''))
          .join('')
          .trim();
        if (textFromAnnotations) {
          return textFromAnnotations;
        }
      }

      // 3) extracted_text 可能是純文字，也可能是 JSON（包含坐標）
      if (item.extracted_text && typeof item.extracted_text === 'string') {
        const parsed = tryParseJson(item.extracted_text);
        if (parsed) {
          // 如果是 JSON，嘗試用 annotations 規則重新組合文字
          if (Array.isArray(parsed)) {
            const compact = parsed
              .map(a => (a && typeof a.text === 'string' ? a.text : ''))
              .join('')
              .trim();
            if (compact) return compact;
          } else if (parsed.annotations && Array.isArray(parsed.annotations)) {
            const compact = parsed.annotations
              .map(a => (a && typeof a.text === 'string' ? a.text : ''))
              .join('')
              .trim();
            if (compact) return compact;
          }
          // 如果是其他 JSON 結構，就不要顯示，避免把整個物件 dump 出來
          return '';
        }

        // 非 JSON，看成乾淨文字顯示
        return item.extracted_text;
      }

      return '';
    };

    return (
      <div className={classes.tabPanel}>
        {loading ? (
          <CircularProgress />
        ) : translationHistory && translationHistory.length > 0 ? (
          <List>
            {translationHistory.map(item => {
              const imagePath = item.image_path || item.source_image_path;
              let imageSrc = null;
              if (imagePath && typeof imagePath === 'string') {
                if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
                  // Already full URL
                  imageSrc = imagePath;
                } else {
                  // Relative path from backend (e.g. "api/uploads/user_1/ocr/xxx.png" or "uploads/...")
                  const clean = imagePath.replace(/^\/+/, '');
                  imageSrc = `${window.location.origin}/${clean}`;
                }
              }

              const recognized = getDisplayRecognizedText(item) || '-';
              if (!recognized) {
                recognized = '-';
              }
              const jyutping = item.jyutping_result || '';

              return (
                <ListItem key={item.id} alignItems="flex-start">
                  {imageSrc && (
                    <div style={{ marginRight: 12 }}>
                      <img
                        src={imageSrc}
                        alt="OCR source"
                        style={{
                          width: 80,
                          height: 80,
                          objectFit: 'cover',
                          borderRadius: 4,
                          border: '1px solid #ddd'
                        }}
                      />
                    </div>
                  )}
                  <ListItemText
                    primary={
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                          {new Date(item.created_at).toLocaleString()}
                        </div>
                        <div>
                          <strong>
                            <FormattedMessage {...messages.recognizedText} />:
                          </strong>{' '}
                          {recognized || '-'}
                        </div>
                        {jyutping && (
                          <div style={{ marginTop: 4 }}>
                            <strong>
                              <FormattedMessage {...messages.jyutpingResult} />:
                            </strong>{' '}
                            {jyutping}
                          </div>
                        )}
                      </div>
                    }
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
              );
            })}
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
