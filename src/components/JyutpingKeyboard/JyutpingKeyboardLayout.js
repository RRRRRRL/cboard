import React from 'react';
import PropTypes from 'prop-types';
import Button from '@material-ui/core/Button';
import BackspaceIcon from '@material-ui/icons/Backspace';
import SpaceBarIcon from '@material-ui/icons/SpaceBar';
import KeyboardReturnIcon from '@material-ui/icons/KeyboardReturn';
import './JyutpingKeyboard.css';

// Jyutping Layout 1 (Common consonants and vowels with numbers integrated)
const JYUTPING_1_LAYOUT = [
  ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l'],
  ['g', 'k', 'ng', 'h', 'gw', 'kw', 'w', ''],
  ['z', 'c', 's', 'j', ''],
  ['aa', 'a', 'e', 'i', 'o', 'u', 'yu', ''],
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
];

// Jyutping Layout 2 (Alternative arrangement with numbers integrated)
const JYUTPING_2_LAYOUT = [
  ['aa', 'a', 'e', 'i', 'o', 'u', 'yu', 'oe'],
  ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l'],
  ['g', 'k', 'ng', 'h', 'gw', 'kw', 'w', ''],
  ['z', 'c', 's', 'j', ''],
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
];

// QWERTY Layout with numbers integrated
const QWERTY_LAYOUT = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
];

// Numeric Layout
const NUMERIC_LAYOUT = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['0', '.', ',']
];

const JyutpingKeyboardLayout = ({
  layoutType,
  onKeyPress,
  onBackspace,
  onSpace,
  onEnter,
  onClear
}) => {
  const getLayout = () => {
    switch (layoutType) {
      case 'jyutping1':
        return JYUTPING_1_LAYOUT;
      case 'jyutping2':
        return JYUTPING_2_LAYOUT;
      case 'qwerty':
        return QWERTY_LAYOUT;
      case 'numeric':
        return NUMERIC_LAYOUT;
      default:
        return JYUTPING_1_LAYOUT;
    }
  };

  const layout = getLayout();

  const handleKeyClick = key => {
    if (key && key.trim()) {
      onKeyPress(key);
    }
  };

  return (
    <div className="JyutpingKeyboardLayout">
      <div className="JyutpingKeyboardLayout__keys">
        {layout.map((row, rowIndex) => (
          <div key={rowIndex} className="JyutpingKeyboardLayout__row">
            {row.map((key, keyIndex) => {
              if (!key || key.trim() === '') {
                return (
                  <div
                    key={keyIndex}
                    className="JyutpingKeyboardLayout__key-spacer"
                  />
                );
              }
              return (
                <Button
                  key={keyIndex}
                  className="JyutpingKeyboardLayout__key"
                  onClick={() => handleKeyClick(key)}
                  variant="outlined"
                  size="small"
                >
                  {key}
                </Button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Special Keys Row */}
      <div className="JyutpingKeyboardLayout__special-keys">
        <Button
          className="JyutpingKeyboardLayout__special-key"
          onClick={onSpace}
          variant="contained"
          color="primary"
          startIcon={<SpaceBarIcon />}
        >
          Space
        </Button>
        <Button
          className="JyutpingKeyboardLayout__special-key"
          onClick={onEnter}
          variant="outlined"
          startIcon={<KeyboardReturnIcon />}
        >
          Enter
        </Button>
        <Button
          className="JyutpingKeyboardLayout__special-key"
          onClick={onBackspace}
          variant="outlined"
          startIcon={<BackspaceIcon />}
        >
          Backspace
        </Button>
        <Button
          className="JyutpingKeyboardLayout__special-key"
          onClick={onClear}
          variant="outlined"
          color="secondary"
        >
          Clear
        </Button>
      </div>
    </div>
  );
};

JyutpingKeyboardLayout.propTypes = {
  layoutType: PropTypes.oneOf(['jyutping1', 'jyutping2', 'qwerty', 'numeric'])
    .isRequired,
  onKeyPress: PropTypes.func.isRequired,
  onBackspace: PropTypes.func.isRequired,
  onSpace: PropTypes.func.isRequired,
  onEnter: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired
};

export default JyutpingKeyboardLayout;
