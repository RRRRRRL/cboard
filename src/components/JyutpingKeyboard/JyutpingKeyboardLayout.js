import React from 'react';
import PropTypes from 'prop-types';
import { injectIntl } from 'react-intl';
import Button from '@material-ui/core/Button';
import BackspaceIcon from '@material-ui/icons/Backspace';
import SpaceBarIcon from '@material-ui/icons/SpaceBar';
import KeyboardReturnIcon from '@material-ui/icons/KeyboardReturn';
import './JyutpingKeyboard.css';
import messages from './JyutpingKeyboard.messages';

// Jyutping Layout 1 (All 19 initials + 56 finals properly organized)
// Initials (19): b, p, m, f, d, t, n, l, g, k, ng, h, gw, kw, w, z, c, s, j
// Finals (56): aa, ai, aai, au, aau, am, aam, an, aan, ang, aang, ap, aap, at, aat, ak, aak, 
//              e, ei, eu, em, eng, ep, ek, i, iu, im, in, ing, ip, it, ik, 
//              o, oi, ou, on, ong, ot, ok, oe, oeng, oek, 
//              eoi, eon, eot, u, ui, un, ung, ut, uk, 
//              yu, yun, yut, m, ng
const JYUTPING_1_LAYOUT = [
  // Row 1: Initials (8)
  ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l'],
  // Row 2: Initials (6) + special initials (5)
  ['g', 'k', 'ng', 'h', 'gw', 'kw', 'w', 'z'],
  // Row 3: Initials (3) + basic vowels (5)
  ['c', 's', 'j', 'aa', 'e', 'i', 'o', 'u'],
  // Row 4: Basic vowels (2) + common finals
  ['yu', 'oe', 'ai', 'aai', 'au', 'aau', 'am', 'aam'],
  // Row 5: Finals with 'a' base
  ['an', 'aan', 'ang', 'aang', 'ap', 'aap', 'at', 'aat'],
  // Row 6: Finals with 'a' base (continued) + 'e' base
  ['ak', 'aak', 'ei', 'eu', 'em', 'eng', 'ep', 'ek'],
  // Row 7: Finals with 'i' base
  ['iu', 'im', 'in', 'ing', 'ip', 'it', 'ik'],
  // Row 8: Finals with 'o' base
  ['oi', 'ou', 'on', 'ong', 'ot', 'ok', 'oe', 'oeng'],
  // Row 9: Finals with 'o' base (continued) + 'eoi' series
  ['oek', 'eoi', 'eon', 'eot', 'ui', 'un', 'ung', 'ut'],
  // Row 10: Finals with 'u' base + 'yu' series (M/NG removed from finals)
  ['uk', 'yun', 'yut', '1', '2', '3'],
  // Row 11: Tone numbers
  ['4', '5', '6', '7', '8', '9', '0']
];

// Jyutping Layout 2 (Alternative arrangement: vowels first)
const JYUTPING_2_LAYOUT = [
  // Row 1: Basic vowels (8)
  ['aa', 'e', 'i', 'o', 'u', 'yu', 'oe'],
  // Row 2: Initials (8)
  ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l'],
  // Row 3: Initials (6) + special initials (5)
  ['g', 'k', 'ng', 'h', 'gw', 'kw', 'w', 'z'],
  // Row 4: Initials (3) + common finals
  ['c', 's', 'j', 'ai', 'aai', 'au', 'aau', 'am'],
  // Row 5: Finals with 'a' base
  ['aam', 'an', 'aan', 'ang', 'aang', 'ap', 'aap', 'at'],
  // Row 6: Finals with 'a' base (continued) + 'e' base
  ['aat', 'ak', 'aak', 'ei', 'eu', 'em', 'eng', 'ep'],
  // Row 7: Finals with 'e' base (continued) + 'i' base
  ['ek', 'iu', 'im', 'in', 'ing', 'ip', 'it', 'ik'],
  // Row 8: Finals with 'o' base
  ['oi', 'ou', 'on', 'ong', 'ot', 'ok', 'oe', 'oeng'],
  // Row 9: Finals with 'o' base (continued) + 'eoi' series
  ['oek', 'eoi', 'eon', 'eot', 'ui', 'un', 'ung', 'ut'],
  // Row 10: Finals with 'u' base + 'yu' series (M/NG removed from finals)
  ['uk', 'yun', 'yut', '1', '2', '3'],
  // Row 11: Tone numbers
  ['4', '5', '6', '7', '8', '9', '0']
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
  onClear,
  disabledKeys = new Set(),
  intl
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
              // Check if key is disabled
              // disabledKeys is a Set, so we check if it has the key
              // BUT: 'm' and 'ng' can be both initials and finals
              // If they're in VALID_INITIALS, they should be enabled even if disabled as finals
              const VALID_INITIALS = new Set([
                'b', 'p', 'm', 'f', 'd', 't', 'n', 'l',
                'g', 'k', 'ng', 'h', 'gw', 'kw', 'w',
                'z', 'c', 's', 'j'
              ]);
              // If key is 'm' or 'ng' and it's a valid initial, don't disable it
              const isInitial = VALID_INITIALS.has(key);
              const isDisabled = disabledKeys instanceof Set && disabledKeys.has(key) && !isInitial;
              
              return (
                <Button
                  key={keyIndex}
                  className="JyutpingKeyboardLayout__key"
                  onClick={() => !isDisabled && handleKeyClick(key)}
                  variant="outlined"
                  size="small"
                  disabled={isDisabled}
                  style={{
                    opacity: isDisabled ? 0.4 : 1,
                    cursor: isDisabled ? 'not-allowed' : 'pointer'
                  }}
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
          {intl.formatMessage(messages.space)}
        </Button>
        <Button
          className="JyutpingKeyboardLayout__special-key"
          onClick={onEnter}
          variant="outlined"
          startIcon={<KeyboardReturnIcon />}
        >
          {intl.formatMessage(messages.enter)}
        </Button>
        <Button
          className="JyutpingKeyboardLayout__special-key"
          onClick={onBackspace}
          variant="outlined"
          startIcon={<BackspaceIcon />}
        >
          {intl.formatMessage(messages.backspace)}
        </Button>
        <Button
          className="JyutpingKeyboardLayout__special-key"
          onClick={onClear}
          variant="outlined"
          color="secondary"
        >
          {intl.formatMessage(messages.clear)}
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
  onClear: PropTypes.func.isRequired,
  disabledKeys: PropTypes.object,
  intl: PropTypes.object.isRequired
};

export default injectIntl(JyutpingKeyboardLayout);
