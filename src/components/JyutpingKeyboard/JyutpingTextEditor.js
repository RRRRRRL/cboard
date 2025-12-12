import React from 'react';
import PropTypes from 'prop-types';
import TextField from '@material-ui/core/TextField';
import IconButton from '@material-ui/core/IconButton';
import ClearIcon from '@material-ui/icons/Clear';
import DeleteIcon from '@material-ui/icons/Delete';
import './JyutpingKeyboard.css';

const JyutpingTextEditor = ({
  jyutpingInput,
  textOutput,
  onClear,
  onBackspace,
  onTextChange,
  validationError
}) => {
  return (
    <div className="JyutpingTextEditor">
      {/* Jyutping Input Display - Always show when there's input */}
      <div className="JyutpingTextEditor__input-display">
        <span className="JyutpingTextEditor__input-label">Jyutping:</span>
        <span 
          className={`JyutpingTextEditor__input-text ${
            validationError ? 'JyutpingTextEditor__input-text--error' : ''
          }`}
        >
          {jyutpingInput || <span className="JyutpingTextEditor__placeholder">Type Jyutping...</span>}
        </span>
        {jyutpingInput && (
          <IconButton
            size="small"
            onClick={onBackspace}
            className="JyutpingTextEditor__backspace-button"
            title="Delete last character"
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
      <TextField
        multiline
        minRows={4}
        fullWidth
        value={textOutput}
        placeholder="Type using Jyutping keyboard..."
        variant="outlined"
        className="JyutpingTextEditor__output"
        InputProps={{
          readOnly: false,
          className: 'JyutpingTextEditor__output-input'
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

      {/* Action Buttons */}
      <div className="JyutpingTextEditor__actions">
        <IconButton
          onClick={onClear}
          disabled={!textOutput && !jyutpingInput}
          size="small"
          title="Clear all"
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
  validationError: PropTypes.string
};

JyutpingTextEditor.defaultProps = {
  jyutpingInput: '',
  textOutput: ''
};

export default JyutpingTextEditor;
