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
import ColorSelect from '../../UI/ColorSelect';
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
      width: 400,
      height: 400,
      backgroundColor: '#FFFFFF',
      textColor: '#000000',
      fontSize: 24,
      isGenerating: false,
      error: null
    };
    // Store original defaults for reset
    this.defaults = {
      width: 400,
      height: 400,
      fontSize: 24
    };
  }

  componentDidUpdate(prevProps) {
    // Reset form when dialog opens
    if (this.props.open && !prevProps.open) {
      this.setState({
        text: '',
        width: 400,
        height: 400,
        backgroundColor: '#FFFFFF',
        textColor: '#000000',
        fontSize: 24,
        isGenerating: false,
        error: null
      });
    }
  }

  handleTextChange = event => {
    this.setState({ text: event.target.value });
  };

  handleWidthChange = event => {
    const inputValue = event.target.value;
    // Allow empty string while typing
    if (inputValue === '') {
      this.setState({ width: '' });
      return;
    }
    // Only parse if it's a valid number
    const value = parseInt(inputValue, 10);
    if (!isNaN(value)) {
      this.setState({ width: Math.max(100, Math.min(2000, value)) });
    }
  };

  handleWidthBlur = event => {
    // Validate and set default on blur if empty or invalid
    const value = parseInt(event.target.value, 10);
    if (isNaN(value) || value < 100) {
      this.setState({ width: 400 });
    } else if (value > 2000) {
      this.setState({ width: 2000 });
    }
  };

  handleHeightChange = event => {
    const inputValue = event.target.value;
    // Allow empty string while typing
    if (inputValue === '') {
      this.setState({ height: '' });
      return;
    }
    // Only parse if it's a valid number
    const value = parseInt(inputValue, 10);
    if (!isNaN(value)) {
      this.setState({ height: Math.max(100, Math.min(2000, value)) });
    }
  };

  handleHeightBlur = event => {
    // Validate and set default on blur if empty or invalid
    const value = parseInt(event.target.value, 10);
    if (isNaN(value) || value < 100) {
      this.setState({ height: 400 });
    } else if (value > 2000) {
      this.setState({ height: 2000 });
    }
  };

  handleFontSizeChange = event => {
    const inputValue = event.target.value;
    // Allow empty string while typing
    if (inputValue === '' || inputValue === null || inputValue === undefined) {
      this.setState({ fontSize: '' });
      return;
    }
    // Allow typing numbers - don't restrict while typing
    // Store as string to allow partial input like "2" before "24"
    this.setState({ fontSize: inputValue });
  };

  handleFontSizeBlur = event => {
    // Validate and set default on blur if empty or invalid
    const inputValue = event.target.value;
    if (inputValue === '' || inputValue === null || inputValue === undefined) {
      this.setState({ fontSize: 24 });
      return;
    }
    const value = parseInt(inputValue, 10);
    if (isNaN(value) || value < 10) {
      this.setState({ fontSize: 24 });
    } else if (value > 200) {
      this.setState({ fontSize: 200 });
    } else {
      // Ensure it's stored as a number for consistency
      this.setState({ fontSize: value });
    }
  };

  handleBackgroundColorChange = event => {
    this.setState({ backgroundColor: event.target.value });
  };

  handleTextColorChange = event => {
    this.setState({ textColor: event.target.value });
  };

  handleGenerate = async () => {
    let { text, width, height, backgroundColor, textColor, fontSize } = this.state;
    const { onImageGenerated, onClose } = this.props;

    if (!text || text.trim().length === 0) {
      this.setState({ error: 'Text is required' });
      return;
    }

    // Ensure numeric values are numbers (handle string inputs)
    width = typeof width === 'string' ? (width === '' ? 400 : parseInt(width, 10) || 400) : width || 400;
    height = typeof height === 'string' ? (height === '' ? 400 : parseInt(height, 10) || 400) : height || 400;
    fontSize = typeof fontSize === 'string' ? (fontSize === '' ? 24 : parseInt(fontSize, 10) || 24) : fontSize || 24;
    
    // Clamp values to valid ranges
    width = Math.max(100, Math.min(2000, width));
    height = Math.max(100, Math.min(2000, height));
    fontSize = Math.max(10, Math.min(200, fontSize));

    this.setState({ isGenerating: true, error: null });

    try {
      const imageUrl = await API.generateTextToImage({
        text: text.trim(),
        width,
        height,
        backgroundColor,
        textColor,
        fontSize
      });

      // Convert relative URL to absolute if needed
      // Backend returns: "uploads/user_1/filename.png" (no leading slash)
      // We need: "http://localhost:8000/uploads/user_1/filename.png"
      let fullUrl = imageUrl;
      if (!imageUrl.startsWith('http')) {
        // Remove any leading slash
        const cleanUrl = imageUrl.replace(/^\/+/, '');
        
        // For uploads, serve directly from backend root (not through /api)
        if (cleanUrl.startsWith('uploads/')) {
          // Extract just the protocol and host from API_URL
          // API_URL is "http://localhost:8000/api" or "http://localhost:8000/api/"
          // We want: "http://localhost:8000"
          try {
            const apiUrlObj = new URL(API_URL);
            const baseUrl = `${apiUrlObj.protocol}//${apiUrlObj.host}`;
            fullUrl = `${baseUrl}/${cleanUrl}`;
          } catch (e) {
            // Fallback: remove /api and trailing slashes
            const baseUrl = API_URL.replace(/\/api.*$/, '').replace(/\/+$/, '');
            fullUrl = `${baseUrl}/${cleanUrl}`;
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
      this.setState({
        error:
          error.response?.data?.message ||
          error.message ||
          'Failed to generate image. Please try again.',
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
      width,
      height,
      backgroundColor,
      textColor,
      fontSize,
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
                multiline
                minRows={3}
                placeholder={intl.formatMessage(messages.textPlaceholder)}
                variant="outlined"
                disabled={isGenerating}
              />
            </Grid>

            <Grid item xs={6}>
              <TextField
                label={intl.formatMessage(messages.widthLabel)}
                type="number"
                value={width}
                onChange={this.handleWidthChange}
                onBlur={this.handleWidthBlur}
                fullWidth
                variant="outlined"
                inputProps={{ min: 100, max: 2000 }}
                disabled={isGenerating}
              />
            </Grid>

            <Grid item xs={6}>
              <TextField
                label={intl.formatMessage(messages.heightLabel)}
                type="number"
                value={height}
                onChange={this.handleHeightChange}
                onBlur={this.handleHeightBlur}
                fullWidth
                variant="outlined"
                inputProps={{ min: 100, max: 2000 }}
                disabled={isGenerating}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label={intl.formatMessage(messages.fontSizeLabel)}
                type="number"
                value={fontSize === '' ? '' : fontSize}
                onChange={this.handleFontSizeChange}
                onBlur={this.handleFontSizeBlur}
                fullWidth
                variant="outlined"
                inputProps={{ min: 10, max: 200, step: 1 }}
                disabled={isGenerating}
              />
            </Grid>

            <Grid item xs={6}>
              <Typography variant="body2" gutterBottom>
                <FormattedMessage {...messages.backgroundColorLabel} />
              </Typography>
              <ColorSelect
                selectedColor={backgroundColor}
                defaultColor="#FFFFFF"
                onChange={this.handleBackgroundColorChange}
              />
            </Grid>

            <Grid item xs={6}>
              <Typography variant="body2" gutterBottom>
                <FormattedMessage {...messages.textColorLabel} />
              </Typography>
              <ColorSelect
                selectedColor={textColor}
                defaultColor="#000000"
                onChange={this.handleTextColorChange}
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

