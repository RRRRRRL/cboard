import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, injectIntl } from 'react-intl';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import CircularProgress from '@material-ui/core/CircularProgress';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import API from '../../../api';
import { API_URL } from '../../../constants';
import messages from './TextToImage.messages';

class TextToImage extends Component {
  static propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onImageGenerated: PropTypes.func.isRequired,
    intl: PropTypes.object.isRequired
  };

  constructor(props) {
    super(props);
    this.state = {
      text: '',
      isGenerating: false,
      error: null
    };
  }

  componentDidUpdate(prevProps) {
    // Reset form when dialog opens
    if (this.props.open && !prevProps.open) {
      this.setState({
        text: '',
        isGenerating: false,
        error: null
      });
    }
  }

  handleTextChange = event => {
    this.setState({ text: event.target.value });
  };

  handleGenerate = async () => {
    const { text } = this.state;
    const { onImageGenerated, onClose } = this.props;

    if (!text || text.trim().length === 0) {
      this.setState({ error: 'Keywords are required' });
      return;
    }

    this.setState({ isGenerating: true, error: null });

    try {
      const imageUrl = await API.generateTextToImage({
        query: text.trim()
      });

      // Convert relative URL to absolute if needed
      // Backend returns: "api/uploads/user_1/filename.png" or "uploads/user_1/filename.png"
      // We need: "http://192.168.62.37/api/uploads/user_1/filename.png" (through nginx)
      let fullUrl = imageUrl;
      if (!imageUrl.startsWith('http')) {
        // Remove any leading slash
        const cleanUrl = imageUrl.replace(/^\/+/, '');
        
        // For uploads, construct URL properly
        if (cleanUrl.startsWith('api/uploads/') || cleanUrl.startsWith('uploads/')) {
          // Extract base URL from API_URL
          // API_URL is "http://192.168.62.37/api" or "http://192.168.62.37/api/"
          // We want: "http://192.168.62.37"
          try {
            const apiUrlObj = new URL(API_URL);
            const baseUrl = `${apiUrlObj.protocol}//${apiUrlObj.host}`;
            
            // If cleanUrl already starts with 'api/uploads/', use it directly
            // If it starts with 'uploads/', add 'api/' prefix
            let urlPath = cleanUrl;
            if (urlPath.startsWith('uploads/') && !urlPath.startsWith('api/uploads/')) {
              urlPath = 'api/' + urlPath;
            }
            
            // baseUrl is "http://192.168.62.37", urlPath is "api/uploads/..."
            fullUrl = `${baseUrl}/${urlPath}`;
          } catch (e) {
            // Fallback: use API_URL and append cleanUrl
            // API_URL is "http://192.168.62.37/api/" (with trailing slash)
            // If cleanUrl already starts with 'api/uploads/', remove 'api/' from it first
            // because API_URL already contains '/api'
            let urlPath = cleanUrl;
            if (urlPath.startsWith('api/uploads/')) {
              // Remove 'api/' prefix since API_URL already has '/api'
              urlPath = urlPath.replace(/^api\//, '');
            } else if (urlPath.startsWith('uploads/')) {
              // Keep as is, API_URL will provide the '/api' prefix
              // urlPath stays as 'uploads/...'
            }
            
            // API_URL already ends with '/', so just append urlPath
            fullUrl = `${API_URL.replace(/\/+$/, '')}/${urlPath}`;
          }
        } else {
          // For other URLs, use API_URL
          fullUrl = `${API_URL}${cleanUrl.startsWith('/') ? cleanUrl : '/' + cleanUrl}`;
        }
      }
      
      // Debug: log the URL construction
      console.log('Text-to-image URL construction:', {
        original: imageUrl,
        cleanUrl: imageUrl.replace(/^\/+/, ''),
        fullUrl: fullUrl,
        API_URL: API_URL
      });

      onImageGenerated(fullUrl);
      onClose();
    } catch (error) {
      console.error('Text-to-image generation error:', error);
      
      // Extract error message from response
      let errorMessage = 'Failed to generate image. Please try again.';
      
      if (error.response?.data) {
        // Backend returned structured error
        if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Provide more helpful messages based on status code
      if (error.response?.status === 503) {
        errorMessage = errorMessage || 'The image search service is currently unavailable. Please try again later or use a different search term.';
      } else if (error.response?.status === 500) {
        errorMessage = errorMessage || 'An error occurred on the server. Please try again later.';
      }
      
      this.setState({
        error: errorMessage,
        isGenerating: false
      });
    }
  };

  handleCancel = () => {
    this.props.onClose();
  };

  render() {
    const { open, intl } = this.props;
    const {
      text,
      isGenerating,
      error
    } = this.state;

    return (
      <Dialog open={open} onClose={this.handleCancel} maxWidth="sm" fullWidth>
        <DialogTitle>
          <FormattedMessage {...messages.title} />
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                label={intl.formatMessage(messages.textLabel)}
                value={text}
                onChange={this.handleTextChange}
                fullWidth
                placeholder={intl.formatMessage(messages.textPlaceholder)}
                variant="outlined"
                disabled={isGenerating}
                helperText={intl.formatMessage(messages.helperText)}
              />
            </Grid>

            {error && (
              <Grid item xs={12}>
                <Typography color="error" variant="body2">
                  {error}
                </Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={this.handleCancel} disabled={isGenerating}>
            <FormattedMessage {...messages.cancel} />
          </Button>
          <Button
            onClick={this.handleGenerate}
            color="primary"
            variant="contained"
            disabled={isGenerating || !text || text.trim().length === 0}
            startIcon={isGenerating ? <CircularProgress size={20} /> : null}
          >
            {isGenerating ? (
              <FormattedMessage {...messages.generating} />
            ) : (
              <FormattedMessage {...messages.generate} />
            )}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
}

export default injectIntl(TextToImage);

