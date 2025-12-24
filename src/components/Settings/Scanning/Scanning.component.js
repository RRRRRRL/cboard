import React from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, intlShape } from 'react-intl';
import { withStyles } from '@material-ui/core/styles';
import Switch from '@material-ui/core/Switch';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import Slider from '@material-ui/core/Slider';
import Paper from '@material-ui/core/Paper';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import FullScreenDialog from '../../UI/FullScreenDialog';
import messages from './Scanning.messages';
import {
  SCANNING_METHOD_AUTOMATIC,
  SCANNING_METHOD_MANUAL,
  SCANNING_MODE_SINGLE,
  SCANNING_MODE_ROW,
  SCANNING_MODE_COLUMN,
  SCANNING_MODE_OPERATION,
  LOOP_FINITE,
  LOOP_INFINITE,
  AUDIO_GUIDE_OFF,
  AUDIO_GUIDE_BEEP,
  AUDIO_GUIDE_CARD_AUDIO,
  MIN_SCANNING_SPEED,
  MAX_SCANNING_SPEED,
  SCANNING_SPEED_INCREMENT,
  MIN_LOOP_COUNT,
  MAX_LOOP_COUNT,
  DEFAULT_LOOP_COUNT
} from './Scanning.constants';

import './Scanning.css';

const propTypes = {
  /**
   * Callback fired when clicking the back button
   */
  onClose: PropTypes.func,
  updateScannerSettings: PropTypes.func,
  scanningSettings: PropTypes.object,
  accessibilitySettings: PropTypes.object,
  classes: PropTypes.object.isRequired,
  intl: intlShape.isRequired
};

const SCANNER_MESSAGES_KEYMAP = {
  [SCANNING_METHOD_MANUAL]: messages.scannerManualStrategy,
  [SCANNING_METHOD_AUTOMATIC]: messages.scannerAutomaticStrategy
};

const styles = theme => ({
  container: {
    display: 'flex',
    position: 'relative',
    justifyContent: 'center',
    flex: '0 0 40%',
    minWidth: '150px',
    [theme.breakpoints.up('sm')]: {
      flex: '0 0 50%',
      minWidth: '200px'
    }
  },
  loopCountInput: {
    width: '80px'
  }
});

class Scanning extends React.Component {
  constructor(props) {
    super(props);

    // Map old format to new Sprint 5 format
    const oldSettings = props.scanningSettings || {};
    const accessibilitySettings = props.accessibilitySettings || {};
    const scanning = accessibilitySettings.scanning || {};

    this.state = {
      // Legacy settings (for backward compatibility)
      active: oldSettings.active || scanning.enabled || false,
      delay: oldSettings.delay || scanning.speed * 1000 || 2000, // Convert seconds to ms
      strategy: oldSettings.strategy || SCANNING_METHOD_AUTOMATIC,
      
      // Sprint 5 new settings
      enabled: scanning.enabled !== undefined ? scanning.enabled : (oldSettings.active || false),
      mode: scanning.mode || SCANNING_MODE_SINGLE,
      speed: scanning.speed || (oldSettings.delay ? oldSettings.delay / 1000 : 2.0), // Convert ms to seconds
      loop: scanning.loop || LOOP_FINITE,
      loop_count: scanning.loop_count || DEFAULT_LOOP_COUNT,
      audio_guide: accessibilitySettings.audio_guide || AUDIO_GUIDE_OFF
    };
  }

  toggleScanner = () => {
    const enabled = !this.state.enabled;
    this.setState({
      enabled,
      active: enabled // Keep legacy active in sync
    });
  };

  changeSelect = property => event => {
    this.setState({
      [property]: event.target.value
    });
  };

  handleSpeedChange = (event, value) => {
    this.setState({
      speed: value,
      delay: value * 1000 // Keep legacy delay in sync (convert to ms)
    });
  };

  handleLoopTypeChange = event => {
    const loop = event.target.value;
    this.setState({
      loop,
      loop_count: loop === LOOP_FINITE ? (this.state.loop_count || DEFAULT_LOOP_COUNT) : undefined
    });
  };

  handleLoopCountChange = event => {
    let value = parseInt(event.target.value, 10);
    if (isNaN(value)) value = DEFAULT_LOOP_COUNT;
    value = Math.max(MIN_LOOP_COUNT, Math.min(MAX_LOOP_COUNT, value));
    this.setState({
      loop_count: value
    });
  };

  onSubmit = () => {
    // Convert to Sprint 5 format
    const scanningSettings = {
      enabled: this.state.enabled,
      mode: this.state.mode,
      speed: this.state.speed,
      loop: this.state.loop,
      loop_count: this.state.loop === LOOP_FINITE ? this.state.loop_count : undefined
    };

    const accessibilitySettings = {
      scanning: scanningSettings,
      audio_guide: this.state.audio_guide
    };

    this.props.updateScannerSettings(accessibilitySettings, {
      // Legacy format for backward compatibility
      active: this.state.enabled,
      delay: this.state.delay,
      strategy: this.state.strategy
    });
  };

  render() {
    const { onClose, classes, intl } = this.props;
    const { enabled, mode, speed, loop, loop_count, audio_guide, strategy } = this.state;

    return (
      <div className="Scanning">
        <FullScreenDialog
          open
          title={<FormattedMessage {...messages.scanning} />}
          onClose={onClose}
          onSubmit={this.onSubmit}
        >
          <Paper>
            <List>
              {/* Enable Scanning */}
              <ListItem>
                <ListItemText
                  className="Scanning__ListItemText"
                  primary={<FormattedMessage {...messages.enable} />}
                  secondary={<FormattedMessage {...messages.enableSecondary} />}
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={enabled}
                    onChange={this.toggleScanner}
                    value="enabled"
                    color="secondary"
                  />
                </ListItemSecondaryAction>
              </ListItem>

              {/* Scanning Mode */}
              <ListItem divider>
                <ListItemText
                  className="Scanning__ListItemText"
                  primary={<FormattedMessage {...messages.mode} />}
                  secondary={<FormattedMessage {...messages.modeSecondary} />}
                />
                <ListItemSecondaryAction>
                  <Select
                    value={mode}
                    onChange={this.changeSelect('mode')}
                    inputProps={{
                      name: 'mode',
                      id: 'scanning-mode'
                    }}
                  >
                    <MenuItem value={SCANNING_MODE_SINGLE}>
                      <FormattedMessage {...messages.modeSingle} />
                    </MenuItem>
                    <MenuItem value={SCANNING_MODE_ROW}>
                      <FormattedMessage {...messages.modeRow} />
                    </MenuItem>
                    <MenuItem value={SCANNING_MODE_COLUMN}>
                      <FormattedMessage {...messages.modeColumn} />
                    </MenuItem>
                    <MenuItem value={SCANNING_MODE_OPERATION}>
                      <FormattedMessage {...messages.modeOperation} />
                    </MenuItem>
                  </Select>
                </ListItemSecondaryAction>
              </ListItem>

              {/* Scanning Speed */}
              <ListItem
                divider
                aria-label={intl.formatMessage(messages.speed)}
              >
                <ListItemText
                  className="Scanning__ListItemText"
                  primary={<FormattedMessage {...messages.speed} />}
                  secondary={<FormattedMessage {...messages.speedSecondary} />}
                />
                <div className={classes.container}>
                  <Slider
                    color="secondary"
                    value={speed}
                    min={MIN_SCANNING_SPEED}
                    max={MAX_SCANNING_SPEED}
                    step={SCANNING_SPEED_INCREMENT}
                    onChange={this.handleSpeedChange}
                    valueLabelDisplay="auto"
                    valueLabelFormat={value => `${value}s`}
                  />
                </div>
              </ListItem>

              {/* Loop Type */}
              <ListItem divider>
                <ListItemText
                  className="Scanning__ListItemText"
                  primary={<FormattedMessage {...messages.loop} />}
                  secondary={<FormattedMessage {...messages.loopSecondary} />}
                />
                <ListItemSecondaryAction>
                  <Select
                    value={loop}
                    onChange={this.handleLoopTypeChange}
                    inputProps={{
                      name: 'loop',
                      id: 'scanning-loop'
                    }}
                  >
                    <MenuItem value={LOOP_FINITE}>
                      <FormattedMessage {...messages.finite} />
                    </MenuItem>
                    <MenuItem value={LOOP_INFINITE}>
                      <FormattedMessage {...messages.infinite} />
                    </MenuItem>
                  </Select>
                </ListItemSecondaryAction>
              </ListItem>

              {/* Loop Count (only show for finite loops) */}
              {loop === LOOP_FINITE && (
                <ListItem divider>
                  <ListItemText
                    className="Scanning__ListItemText"
                    primary={<FormattedMessage {...messages.loopCount} />}
                    secondary={<FormattedMessage {...messages.loopCountSecondary} />}
                  />
                  <ListItemSecondaryAction>
                    <TextField
                      type="number"
                      value={loop_count}
                      onChange={this.handleLoopCountChange}
                      inputProps={{
                        min: MIN_LOOP_COUNT,
                        max: MAX_LOOP_COUNT,
                        step: 1
                      }}
                      className={classes.loopCountInput}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              )}

              {/* Audio Guide */}
              <ListItem divider>
                <ListItemText
                  className="Scanning__ListItemText"
                  primary={<FormattedMessage {...messages.audioGuide} />}
                  secondary={<FormattedMessage {...messages.audioGuideSecondary} />}
                />
                <ListItemSecondaryAction>
                  <Select
                    value={audio_guide}
                    onChange={this.changeSelect('audio_guide')}
                    inputProps={{
                      name: 'audio_guide',
                      id: 'scanning-audio-guide'
                    }}
                  >
                    <MenuItem value={AUDIO_GUIDE_OFF}>
                      <FormattedMessage {...messages.audioGuideOff} />
                    </MenuItem>
                    <MenuItem value={AUDIO_GUIDE_BEEP}>
                      <FormattedMessage {...messages.audioGuideBeep} />
                    </MenuItem>
                    <MenuItem value={AUDIO_GUIDE_CARD_AUDIO}>
                      <FormattedMessage {...messages.audioGuideCardAudio} />
                    </MenuItem>
                  </Select>
                </ListItemSecondaryAction>
              </ListItem>

              {/* Legacy: Scan Method removed - only eye tracking and automatic mode now */}
            </List>
          </Paper>
        </FullScreenDialog>
      </div>
    );
  }
}

Scanning.propTypes = propTypes;

export default withStyles(styles)(Scanning);
