import React from 'react';
import PropTypes from 'prop-types';
import { injectIntl, FormattedMessage } from 'react-intl';
import TextField from '@material-ui/core/TextField';
import IconButton from '@material-ui/core/IconButton';
import ClearIcon from '@material-ui/icons/Clear';
import DeleteIcon from '@material-ui/icons/Delete';
import VolumeUpIcon from '@material-ui/icons/VolumeUp';
import './JyutpingKeyboard.css';
import messages from './JyutpingKeyboard.messages';

const JyutpingTextEditor = ({
  jyutpingInput,
  textOutput,
  onClear,
  onBackspace,
  onTextChange,
  onPlayback,
  validationError,
  isPlayingAudio,
  intl
}) => {
  return (
    <div className="JyutpingTextEditor">
      {/* Jyutping Input Display - Always show when there's input */}
      <div className="JyutpingTextEditor__input-display">
        <span className="JyutpingTextEditor__input-label">
          <FormattedMessage {...messages.jyutpingLabel} />
        </span>
        <span 
          className={`JyutpingTextEditor__input-text ${
            validationError ? 'JyutpingTextEditor__input-text--error' : ''
          }`}
        >
          {jyutpingInput || (
            <span className="JyutpingTextEditor__placeholder">
              <FormattedMessage {...messages.typeJyutping} />
            </span>
          )}
        </span>
        {jyutpingInput && (
          <IconButton
            size="small"
            onClick={onBackspace}
            className="JyutpingTextEditor__backspace-button"
            title={intl.formatMessage(messages.deleteLastCharacter)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </div>
      
      {/* Validation Error Display */}
      {validationError && (
        <div className="JyutpingTextEditor__error">
          {validationError}
        </div>
      )}

      {/* Text Output Editor */}
      <div className="JyutpingTextEditor__output-wrapper">
        <TextField
          multiline
          minRows={4}
          fullWidth
          value={textOutput}
          placeholder={intl.formatMessage(messages.typeUsingKeyboard)}
          variant="outlined"
          className="JyutpingTextEditor__output"
          InputProps={{
            readOnly: false,
            className: 'JyutpingTextEditor__output-input',
            endAdornment: textOutput && (
              <IconButton
                size="small"
                onClick={onPlayback}
                disabled={isPlayingAudio}
                className="JyutpingTextEditor__playback-button"
                title={intl.formatMessage(messages.playText)}
              >
                <VolumeUpIcon fontSize="small" />
              </IconButton>
            )
          }}
          onChange={e => {
            if (onTextChange) {
              onTextChange(e.target.value);
            }
          }}
          inputProps={{
            readOnly: false
          }}
        />
      </div>

      {/* Action Buttons */}
      <div className="JyutpingTextEditor__actions">
        <IconButton
          onClick={onClear}
          disabled={!textOutput && !jyutpingInput}
          size="small"
          title={intl.formatMessage(messages.clearAll)}
        >
          <ClearIcon />
        </IconButton>
      </div>
    </div>
  );
};

JyutpingTextEditor.propTypes = {
  jyutpingInput: PropTypes.string,
  textOutput: PropTypes.string,
  onClear: PropTypes.func.isRequired,
  onBackspace: PropTypes.func.isRequired,
  onTextChange: PropTypes.func,
  onPlayback: PropTypes.func,
  validationError: PropTypes.string,
  isPlayingAudio: PropTypes.bool,
  intl: PropTypes.object.isRequired
};

JyutpingTextEditor.defaultProps = {
  jyutpingInput: '',
  textOutput: '',
  isPlayingAudio: false
};

export default injectIntl(JyutpingTextEditor);
