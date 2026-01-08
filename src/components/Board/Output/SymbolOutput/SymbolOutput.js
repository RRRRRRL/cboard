import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import ClearIcon from '@material-ui/icons/Clear';
import PaletteIcon from '@material-ui/icons/Palette';
import IconButton from '@material-ui/core/IconButton';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import Popover from '@material-ui/core/Popover';

import Symbol from '../../Symbol';
import BackspaceButton from './BackspaceButton';
import ClearButton from './ClearButton';
import messages from '../../Board.messages';
import PhraseShare from '../PhraseShare';
import Scroll from './Scroll';
import './SymbolOutput.css';
import { injectIntl } from 'react-intl';

class SymbolOutput extends PureComponent {
  constructor(props) {
    super(props);
    this.scrollContainerRef = React.createRef();
    this.colorPickerAnchorRef = React.createRef();
    this.state = {
      openPhraseShareDialog: false,
      colorPickerOpen: false,
      selectedBarColor: this.loadBarColor()
    };
  }

  onShareClick = () => {
    this.setState({ openPhraseShareDialog: true });
  };

  onShareClose = () => {
    this.setState({ openPhraseShareDialog: false });
  };

  loadBarColor = () => {
    try {
      const savedColor = localStorage.getItem('symbolOutputBarColor');
      return savedColor || '#fff';
    } catch (e) {
      return '#fff';
    }
  };

  saveBarColor = (color) => {
    try {
      localStorage.setItem('symbolOutputBarColor', color);
    } catch (e) {
      // Ignore localStorage errors
    }
  };

  handleColorPickerOpen = () => {
    this.setState({ colorPickerOpen: true });
  };

  handleColorPickerClose = () => {
    this.setState({ colorPickerOpen: false });
  };

  handleColorSelect = (color) => {
    this.setState({ selectedBarColor: color });
    this.saveBarColor(color);
    this.handleColorPickerClose();
  };

  static propTypes = {
    /**
     * Symbols to output
     */
    symbols: PropTypes.arrayOf(
      PropTypes.shape({
        /**
         * Image to display
         */
        image: PropTypes.string,
        /**
         * Label to display
         */
        label: PropTypes.oneOfType([PropTypes.string, PropTypes.node])
      })
    )
  };

  static defaultProps = {
    symbols: []
  };

  scrollToLastSymbol = () => {
    try {
      const lastOutputSymbol = this.scrollContainerRef.current
        ?.lastElementChild;

      if (lastOutputSymbol && lastOutputSymbol.scrollIntoView)
        lastOutputSymbol.scrollIntoView({
          inline: 'end'
        });
    } catch (err) {
      console.error('Error during autoScroll of output bar', err);
    }
  };

  componentDidMount() {
    this.scrollToLastSymbol();
  }

  componentDidUpdate(prevProps) {
    const { symbols } = this.props;
    if (prevProps.symbols.length < symbols.length) this.scrollToLastSymbol();
  }

  render() {
    const {
      intl,
      onBackspaceClick,
      onClearClick,
      getPhraseToShare,
      onCopyClick,
      onRemoveClick,
      onSwitchLiveMode,
      onWriteSymbol,
      symbols,
      navigationSettings,
      phrase,
      isLiveMode,
      increaseOutputButtons,
      onClick: onOutputClick,
      ...other
    } = this.props;

    const clearButtonStyle = {
      visibility: symbols.length ? 'visible' : 'hidden'
    };

    const copyButtonStyle = {
      visibility: symbols.length ? 'visible' : 'hidden'
    };

    const removeButtonStyle = {
      visibility: navigationSettings.removeOutputActive ? 'visible' : 'hidden'
    };

    const backspaceButtonStyle = {
      visibility: navigationSettings.removeOutputActive ? 'hidden' : 'visible'
    };

    const colorOptions = [
      '#ffffff', '#f8f9fa', '#e9ecef', '#dee2e6',
      '#fff3cd', '#d1ecf1', '#d4edda', '#f8d7da',
      '#cce5ff', '#d1c4e9', '#bbdefb', '#c8e6c9',
      '#fff176', '#81c784', '#4caf50', '#2196f3',
      '#ff9800', '#ff5722', '#f44336', '#9c27b0'
    ];

    return (
      <div
        className="SymbolOutput"
        style={{ backgroundColor: this.state.selectedBarColor }}
      >
        <Scroll scrollContainerReference={this.scrollContainerRef} {...other}>
          {symbols.slice(0, 30).map(({ image, label, type, keyPath }, index) => (
            <div
              className={
                type === 'live'
                  ? 'LiveSymbolOutput__value'
                  : 'SymbolOutput__value'
              }
              key={index}
              data-output-action="play"
              onClick={!isLiveMode ? onOutputClick : undefined}
            >
              <Symbol
                className="SymbolOutput__symbol"
                image={image}
                keyPath={keyPath}
                label={label}
                type={type}
                labelpos="Below"
                onWrite={onWriteSymbol(index)}
                intl={intl}
              />
              <div className="SymbolOutput__value__IconButton">
                <IconButton
                  color="inherit"
                  size={'small'}
                  onClick={onRemoveClick(index)}
                  disabled={!navigationSettings.removeOutputActive}
                  style={removeButtonStyle}
                  data-output-action="remove"
                >
                  <ClearIcon />
                </IconButton>
              </div>
            </div>
          ))}
        </Scroll>
        <div
          style={{
            display: 'flex',
            marginLeft: 'auto',
            minWidth: 'fit-content'
          }}
        >
          {navigationSettings.shareShowActive && (
            <PhraseShare
              label={intl.formatMessage(messages.share)}
              intl={this.props.intl}
              onShareClick={this.onShareClick}
              onShareClose={this.onShareClose}
              publishBoard={this.publishBoard}
              onCopyPhrase={onCopyClick}
              open={this.state.openPhraseShareDialog}
              phrase={this.props.phrase}
              style={copyButtonStyle}
              hidden={!symbols.length}
              increaseOutputButtons={increaseOutputButtons}
            />
          )}

          {!navigationSettings.removeOutputActive && (
            <BackspaceButton
              color="inherit"
              onClick={onBackspaceClick}
              style={backspaceButtonStyle}
              hidden={navigationSettings.removeOutputActive}
              increaseOutputButtons={increaseOutputButtons}
              data-output-action="backspace"
            />
          )}
          <div
            className={
              increaseOutputButtons
                ? 'SymbolOutput__right__btns__lg'
                : 'SymbolOutput__right__btns'
            }
          >
            {navigationSettings.liveMode && (
              <FormControlLabel
                value="bottom"
                className={increaseOutputButtons ? 'Live__switch_lg' : null}
                control={
                  <Switch
                    size="small"
                    checked={isLiveMode}
                    color="primary"
                    onChange={onSwitchLiveMode}
                  />
                }
                label={intl.formatMessage(messages.live)}
                labelPlacement="bottom"
              />
            )}
            <ClearButton
              color="inherit"
              onClick={onClearClick}
              style={clearButtonStyle}
              hidden={!symbols.length}
              increaseOutputButtons={increaseOutputButtons}
              data-output-action="clear"
            />
            <IconButton
              ref={this.colorPickerAnchorRef}
              color="inherit"
              onClick={this.handleColorPickerOpen}
              size={increaseOutputButtons ? 'large' : 'small'}
              style={{
                marginLeft: '8px',
                backgroundColor: this.state.selectedBarColor,
                border: '1px solid rgba(0, 0, 0, 0.12)'
              }}
              data-output-action="color-picker"
            >
              <PaletteIcon />
            </IconButton>
          </div>
        </div>
        <Popover
          open={this.state.colorPickerOpen}
          anchorEl={this.colorPickerAnchorRef.current}
          onClose={this.handleColorPickerClose}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'center',
          }}
          transformOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
          }}
        >
          <div style={{
            padding: '16px 24px 16px 16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            maxWidth: '200px'
          }}>
            {colorOptions.map((color) => (
              <button
                key={color}
                onClick={() => this.handleColorSelect(color)}
                style={{
                  width: '40px',
                  height: '40px',
                  border: this.state.selectedBarColor === color ? '2px solid #2196f3' : '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: color,
                  cursor: 'pointer',
                  outline: 'none'
                }}
                title={`Select color ${color}`}
              />
            ))}
          </div>
        </Popover>
      </div>
    );
  }
}

export default injectIntl(SymbolOutput);
