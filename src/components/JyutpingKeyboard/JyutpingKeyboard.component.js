import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { injectIntl } from 'react-intl';
import IconButton from '@material-ui/core/IconButton';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import ShareIcon from '@material-ui/icons/Share';
import VolumeUpIcon from '@material-ui/icons/VolumeUp';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';

import JyutpingTextEditor from './JyutpingTextEditor';
import JyutpingKeyboardLayout from './JyutpingKeyboardLayout';
import WordSuggestions from './WordSuggestions';
import API from '../../api/api';
import './JyutpingKeyboard.css';

const LAYOUT_TYPES = {
  JYUTPING_1: 'jyutping1',
  JYUTPING_2: 'jyutping2',
  QWERTY: 'qwerty',
  NUMERIC: 'numeric'
};

class JyutpingKeyboard extends Component {
  static propTypes = {
    open: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    intl: PropTypes.object.isRequired
  };

  static defaultProps = {
    open: false
  };

  constructor(props) {
    super(props);
    this.state = {
      currentLayout: LAYOUT_TYPES.JYUTPING_1,
      jyutpingInput: '',
      textOutput: '',
      suggestions: [],
      isSearching: false,
      isPlayingAudio: false
    };
    this.searchTimeout = null;
    this.audioCache = new Map();
  }

  componentWillUnmount() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  handleLayoutChange = (event, newValue) => {
    this.setState({ currentLayout: newValue });
  };

  handleKeyPress = async key => {
    const { jyutpingInput } = this.state;
    const newInput = jyutpingInput + key;

    this.setState({ jyutpingInput: newInput });

    // Play audio for the key
    await this.playKeyAudio(key);

    // Search for matches immediately (no debounce for better UX)
    // Show all suggestions - let user choose manually
    await this.searchJyutping(newInput);
  };


  searchJyutping = async code => {
    if (!code || code.length === 0) {
      this.setState({ suggestions: [], isSearching: false });
      return;
    }

    this.setState({ isSearching: true });

    try {
      // First, try exact/partial match search
      const response = await API.searchJyutping(code);
      console.log('Jyutping search response:', response);
      
      // API returns {code, matches, match_type} format
      const matches = response.matches || [];

      if (matches && matches.length > 0) {
        // Filter out matches without valid hanzi/word
        const validMatches = matches.filter(
          m => (m.hanzi && m.hanzi.trim()) || (m.word && m.word.trim())
        );

        console.log('Valid matches found:', validMatches.length);

        // Show all matches (up to 15 for better selection)
        this.setState({
          suggestions: validMatches.slice(0, 15),
          isSearching: false
        });
      } else {
        // If no matches from search, try suggestions API
        // This handles cases like typing "nei" to show all "nei*" matches
        console.log('No matches from search, trying suggestions API...');
        const suggestionsResponse = await API.getJyutpingSuggestions(code, 15);
        console.log('Suggestions response:', suggestionsResponse);
        
        // API returns {input, suggestions, count} format
        const suggestions = suggestionsResponse.suggestions || [];

        if (suggestions && suggestions.length > 0) {
          // Filter out matches without valid hanzi/word
          const validSuggestions = suggestions.filter(
            m => (m.hanzi && m.hanzi.trim()) || (m.word && m.word.trim())
          );
          console.log('Valid suggestions found:', validSuggestions.length);
          
          this.setState({
            suggestions: validSuggestions,
            isSearching: false
          });
        } else {
          console.log('No suggestions found');
          this.setState({ suggestions: [], isSearching: false });
        }
      }
    } catch (error) {
      console.error('Jyutping search error:', error);
      console.error('Error details:', error.response?.data || error.message);
      // Ensure we clear loading state and show empty suggestions on error
      this.setState({ 
        suggestions: [], 
        isSearching: false 
      });
    }
  };

  handleSuggestionSelect = async suggestion => {
    const hanzi =
      (suggestion.hanzi && suggestion.hanzi.trim()) ||
      (suggestion.word && suggestion.word.trim()) ||
      '';
    const jyutping = suggestion.jyutping_code || '';

    if (!hanzi) {
      // No valid hanzi, don't add anything
      return;
    }

    // Add to text output
    const { textOutput } = this.state;
    const newText = textOutput + hanzi;

    this.setState({
      textOutput: newText,
      jyutpingInput: '', // Clear input after selection
      suggestions: []
    });

    // Play audio for the selected character/word
    await this.playCharacterAudio(hanzi, jyutping);

    // Log learning (if authenticated)
    try {
      await API.logJyutpingLearning({
        jyutping_code: jyutping,
        hanzi_expected: hanzi,
        hanzi_selected: hanzi,
        profile_id: null
      });
    } catch (error) {
      // Silently fail if not authenticated
      console.log('Learning log not saved (not authenticated)');
    }
  };

  handleBackspace = async () => {
    const { jyutpingInput, textOutput } = this.state;

    if (jyutpingInput.length > 0) {
      // Remove last character from input
      const newInput = jyutpingInput.slice(0, -1);
      this.setState({ jyutpingInput: newInput });
      
      // Immediately search for updated suggestions
      await this.searchJyutping(newInput);
    } else if (textOutput.length > 0) {
      // Remove last character from output
      this.setState({ textOutput: textOutput.slice(0, -1) });
    }
  };

  handleClear = () => {
    this.setState({
      jyutpingInput: '',
      textOutput: '',
      suggestions: []
    });
  };

  handleSpace = () => {
    const { textOutput } = this.state;
    this.setState({ textOutput: textOutput + ' ' });
  };

  handleEnter = () => {
    // Add newline
    const { textOutput } = this.state;
    this.setState({ textOutput: textOutput + '\n' });
  };

  playKeyAudio = async key => {
    // Use browser's speech API directly for key audio
    // The backend audio endpoint is for future TTS integration
    if ('speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(key);
        utterance.lang = 'zh-HK';
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error('Speech synthesis error:', error);
      }
    }

    // Optionally call backend for logging (non-blocking)
    try {
      await API.generateJyutpingAudio({
        text: key,
        jyutping: key,
        type: 'character'
      });
    } catch (error) {
      // Silently fail - audio playback already handled above
    }
  };

  playCharacterAudio = async (text, jyutping) => {
    // Use browser's speech API directly for character/word audio
    // The backend audio endpoint is for future TTS integration
    if ('speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-HK';
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error('Speech synthesis error:', error);
      }
    }

    // Optionally call backend for logging (non-blocking)
    try {
      await API.generateJyutpingAudio({
        text: text,
        jyutping: jyutping,
        type: 'word'
      });
    } catch (error) {
      // Silently fail - audio playback already handled above
    }
  };

  handleBatchPronunciation = async () => {
    const { textOutput } = this.state;
    if (!textOutput) return;

    this.setState({ isPlayingAudio: true });

    try {
      // Play each character/word
      const characters = textOutput.split('');
      for (const char of characters) {
        if (char.trim()) {
          await this.playCharacterAudio(char, '');
          // Small delay between characters
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    } catch (error) {
      console.error('Batch pronunciation error:', error);
    } finally {
      this.setState({ isPlayingAudio: false });
    }
  };

  handleShare = async () => {
    const { textOutput } = this.state;
    if (!textOutput) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Jyutping Text',
          text: textOutput
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Share error:', error);
        }
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(textOutput);
        alert('Text copied to clipboard!');
      } catch (error) {
        console.error('Clipboard error:', error);
      }
    }
  };

  render() {
    const { open, onClose } = this.props;
    const {
      currentLayout,
      jyutpingInput,
      textOutput,
      suggestions,
      isSearching,
      isPlayingAudio
    } = this.state;

    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        className="JyutpingKeyboard__dialog"
      >
        <DialogTitle className="JyutpingKeyboard__header">
          <div className="JyutpingKeyboard__header-content">
            <IconButton
              onClick={onClose}
              className="JyutpingKeyboard__close-button"
            >
              <ArrowBackIcon />
            </IconButton>
            <span className="JyutpingKeyboard__title">Jyutping Keyboard</span>
            <div className="JyutpingKeyboard__actions">
              <IconButton
                onClick={this.handleBatchPronunciation}
                disabled={!textOutput || isPlayingAudio}
                title="Batch Pronunciation"
              >
                <VolumeUpIcon />
              </IconButton>
              <IconButton
                onClick={this.handleShare}
                disabled={!textOutput}
                title="Share"
              >
                <ShareIcon />
              </IconButton>
            </div>
          </div>
        </DialogTitle>

        <DialogContent className="JyutpingKeyboard__content">
          {/* Text Editor */}
          <JyutpingTextEditor
            jyutpingInput={jyutpingInput}
            textOutput={textOutput}
            onClear={this.handleClear}
            onBackspace={this.handleBackspace}
            onTextChange={text => this.setState({ textOutput: text })}
          />

          {/* Word Suggestions - Always show (handles empty state internally) */}
          <WordSuggestions
            suggestions={suggestions}
            onSelect={this.handleSuggestionSelect}
            isLoading={isSearching}
          />

          {/* Layout Tabs */}
          <Tabs
            value={currentLayout}
            onChange={this.handleLayoutChange}
            variant="scrollable"
            scrollButtons="auto"
            className="JyutpingKeyboard__tabs"
          >
            <Tab label="Jyutping 1" value={LAYOUT_TYPES.JYUTPING_1} />
            <Tab label="Jyutping 2" value={LAYOUT_TYPES.JYUTPING_2} />
            <Tab label="QWERTY" value={LAYOUT_TYPES.QWERTY} />
            {/* Numeric tab removed - numbers now integrated into other layouts */}
          </Tabs>

          {/* Keyboard Layout */}
          <JyutpingKeyboardLayout
            layoutType={currentLayout}
            onKeyPress={this.handleKeyPress}
            onBackspace={this.handleBackspace}
            onSpace={this.handleSpace}
            onEnter={this.handleEnter}
            onClear={this.handleClear}
          />
        </DialogContent>
      </Dialog>
    );
  }
}

export default injectIntl(JyutpingKeyboard);
