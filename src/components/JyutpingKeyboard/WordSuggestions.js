import React from 'react';
import PropTypes from 'prop-types';
import Chip from '@material-ui/core/Chip';
import CircularProgress from '@material-ui/core/CircularProgress';
import './JyutpingKeyboard.css';

const WordSuggestions = ({ suggestions, onSelect, isLoading }) => {
  if (isLoading) {
    return (
      <div className="WordSuggestions WordSuggestions__loading">
        <CircularProgress size={24} />
        <span className="WordSuggestions__loading-text">Searching...</span>
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="WordSuggestions">
      <div className="WordSuggestions__label">Suggestions:</div>
      <div className="WordSuggestions__list">
        {suggestions.map((suggestion, index) => {
          const displayText =
            suggestion.hanzi ||
            suggestion.word ||
            suggestion.jyutping_code ||
            '';
          const jyutping = suggestion.jyutping_code || '';

          return (
            <Chip
              key={index}
              label={`${displayText} (${jyutping})`}
              onClick={() => onSelect(suggestion)}
              className="WordSuggestions__chip"
              color="primary"
              variant="outlined"
            />
          );
        })}
      </div>
    </div>
  );
};

WordSuggestions.propTypes = {
  suggestions: PropTypes.arrayOf(
    PropTypes.shape({
      jyutping_code: PropTypes.string,
      hanzi: PropTypes.string,
      word: PropTypes.string,
      frequency: PropTypes.number
    })
  ),
  onSelect: PropTypes.func.isRequired,
  isLoading: PropTypes.bool
};

WordSuggestions.defaultProps = {
  suggestions: [],
  isLoading: false
};

export default WordSuggestions;
