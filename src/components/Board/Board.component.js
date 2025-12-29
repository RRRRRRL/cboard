import React, { Component } from 'react';
import PropTypes from 'prop-types';
import keycode from 'keycode';
import classNames from 'classnames';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import { Scanner, Scannable } from 'react-scannable';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Alert from '@material-ui/lab/Alert';

import FixedGrid from '../FixedGrid';
import Grid from '../Grid';
import Symbol from './Symbol';
import OutputContainer from './Output';
import Navbar from './Navbar';
import EditToolbar from './EditToolbar';
import Tile from './Tile';
import EmptyBoard from './EmptyBoard';
import CommunicatorToolbar from '../Communicator/CommunicatorToolbar';
import { DISPLAY_SIZE_GRID_COLS } from '../Settings/Display/Display.constants';
import NavigationButtons from '../NavigationButtons';
import EditGridButtons from '../EditGridButtons';
import { DEFAULT_ROWS_NUMBER, DEFAULT_COLUMNS_NUMBER } from './Board.constants';
import { SCANNING_METHOD_EYE_TRACKING } from '../Settings/Scanning/Scanning.constants';

import { Link } from 'react-router-dom';

import messages from './Board.messages';

import './Board.css';
import BoardTour from './BoardTour/BoardTour';
import ScrollButtons from '../ScrollButtons';
import { NAVIGATION_BUTTONS_STYLE_SIDES } from '../Settings/Navigation/Navigation.constants';
import ImprovePhraseOutput from './ImprovePhraseOutput';
import { resolveTileLabel, resolveBoardName } from '../../helpers';

export class Board extends Component {
  static propTypes = {
    board: PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      tiles: PropTypes.arrayOf(PropTypes.object)
    }),
    /**
     * @ignore
     */
    className: PropTypes.string,
    /**
     *
     */
    disableBackButton: PropTypes.bool,
    /**
     * Callback fired when board tiles are deleted
     */
    onDeleteClick: PropTypes.func,
    /**
     * Callback fired when a board tile is focused
     */
    onFocusTile: PropTypes.func,
    /**
     * Callback fired when a board tile is clicked
     */
    onTileClick: PropTypes.func,
    onSaveBoardClick: PropTypes.func,
    editBoardTitle: PropTypes.func,
    /**
     *
     */
    onLockNotify: PropTypes.func,
    onScannerActive: PropTypes.func,
    /**
     * Callback fired when requesting to load previous board
     */
    onRequestPreviousBoard: PropTypes.func,
    /**
     * Callback fired when requesting to travel and load root board
     */
    onRequestToRootBoard: PropTypes.func,
    /**
     *
     */
    selectedTileIds: PropTypes.arrayOf(PropTypes.string),
    displaySettings: PropTypes.object,
    navigationSettings: PropTypes.object,
    scannerSettings: PropTypes.object,
    userData: PropTypes.object,
    deactivateScanner: PropTypes.func,
    navHistory: PropTypes.arrayOf(PropTypes.string),
    emptyVoiceAlert: PropTypes.bool,
    offlineVoiceAlert: PropTypes.bool,
    onBoardTypeChange: PropTypes.func,
    isFixedBoard: PropTypes.bool,
    onAddRemoveColumn: PropTypes.func,
    onAddRemoveRow: PropTypes.func,
    onLayoutChange: PropTypes.func,
    isRootBoardTourEnabled: PropTypes.bool,
    isUnlockedTourEnabled: PropTypes.bool,
    disableTour: PropTypes.func,
    copiedTiles: PropTypes.arrayOf(PropTypes.object),
    setIsScroll: PropTypes.func,
    isScroll: PropTypes.bool,
    totalRows: PropTypes.number,
    isJyutpingEnabled: PropTypes.bool,
    audioGuideMode: PropTypes.string
  };

  static defaultProps = {
    displaySettings: {
      uiSize: 'Standard',
      labelPosition: 'Below',
      shareShowActive: false,
      hideOutputActive: false
    },
    navigationSettings: {},
    scannerSettings: { active: false, delay: 2000, strategy: 'automatic' },
    selectedTileIds: [],
    emptyVoiceAlert: false,
    userData: {},
    // Scanning highlight audio guide mode: 'off' | 'beep' | 'card_audio'
    audioGuideMode: 'off'
  };

  constructor(props) {
    super(props);

    // Ensure titleDialogValue is always a string, never undefined
    const boardName = (props.board && props.board.name) ? props.board.name : '';
    this.state = {
      openTitleDialog: false,
      titleDialogValue: boardName
    };

    this.boardContainerRef = React.createRef();
    this.fixedBoardContainerRef = React.createRef();

    // Track last scanner‑focused element to avoid repeating sounds
    this.lastScannerFocusedElement = null;
  }

  componentDidMount() {
    if (this.props.scannerSettings.active && this.props.onScannerActive) {
      this.props.onScannerActive();
    }

    // Initial check for scanner highlight audio feedback
    this.handleScannerHighlightAudio();

    // NEW: poll for scanner highlight changes while scanner is active
    this._scannerHighlightInterval = setInterval(() => {
      if (this.props.scannerSettings.active) {
        this.handleScannerHighlightAudio();
      }
    }, 80); // 50–100 ms is fine
  }

  componentDidUpdate(prevProps) {
    // When scanner activation state or audio guide mode changes,
    // re‑evaluate highlight audio feedback
    const scannerJustActivated =
      !prevProps.scannerSettings.active && this.props.scannerSettings.active;
    const audioGuideChanged =
      prevProps.audioGuideMode !== this.props.audioGuideMode;

    if (
      scannerJustActivated ||
      audioGuideChanged ||
      this.props.scannerSettings.active
    ) {
      // Schedule audio check for next tick to avoid render conflicts
      if (this._audioCheckTimeout) {
        clearTimeout(this._audioCheckTimeout);
      }
      this._audioCheckTimeout = setTimeout(() => {
        this.handleScannerHighlightAudio();
        this._audioCheckTimeout = null;
      }, 100); // Small delay to ensure DOM is stable
    }
  }

  componentWillUnmount() {
    // Clean up any pending timeouts
    if (this._audioCheckTimeout) {
      clearTimeout(this._audioCheckTimeout);
      this._audioCheckTimeout = null;
    }
  }

  /**
   * Play audio feedback when scanner highlight moves to a new item.
   * Modes:
   * - off: no sound
   * - beep: short confirmation tone
   * - card_audio: speak tile label or use recorded sound if available
   */
  handleScannerHighlightAudio = () => {
    const { scannerSettings, audioGuideMode, board } = this.props;
    if (!scannerSettings || !scannerSettings.active) {
      this.lastScannerFocusedElement = null;
      return;
    }
    if (!audioGuideMode || audioGuideMode === 'off') {
      return;
    }

    let focusedElement = null;
    try {
      focusedElement =
        document.querySelector('.Tile.scanner__focused') ||
        document.querySelector('.scanner__focused');
    } catch (e) {
      // DOM errors are non‑critical
      return;
    }

    if (!focusedElement || focusedElement === this.lastScannerFocusedElement) {
      return;
    }

    this.lastScannerFocusedElement = focusedElement;

    if (audioGuideMode === 'beep') {
      console.log('[ScannerHighlight] mode=beep, playing beep sound');
      this.playScannerBeep();
      return;
    }

    if (audioGuideMode === 'card_audio' && board && Array.isArray(board.tiles)) {
      const tileId =
        focusedElement.dataset?.tileId || focusedElement.id || null;
      console.log('[ScannerHighlight] mode=card_audio, elementId=', focusedElement.id, 'tileId=', tileId);

      if (!tileId) {
        console.log('[ScannerHighlight] no tileId found, skipping');
        return;
      }

      const tile = board.tiles.find(
        t => t && String(t.id) === String(tileId)
      );

      if (tile) {
        console.log('[ScannerHighlight] tile found:', { id: tile.id, label: tile.label, labelKey: tile.labelKey, sound: !!tile.sound });
        this.playScannerTileAudio(tile);
      } else {
        console.log('[ScannerHighlight] tile not found in board.tiles, falling back to beep');
        this.playScannerBeep();
      }
    }
  };

  playScannerBeep = () => {
    try {
      const AudioContextImpl =
        window.AudioContext || window.webkitAudioContext || null;
      if (!AudioContextImpl) {
        return;
      }
      const ctx = new AudioContextImpl();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5 tone

      gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.25,
        ctx.currentTime + 0.01
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + 0.15
      );

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.18);

      oscillator.onended = () => {
        try {
          ctx.close();
        } catch (e) {
          // ignore
        }
      };
    } catch (e) {
      // Fallback: do nothing if Web Audio is unavailable
    }
  };

  playScannerTileAudio = tile => {
    // Prefer recorded sound if available
    if (tile.sound) {
      try {
        const audio = new Audio(tile.sound);
        audio.play().catch(() => {
          // Ignore playback errors (e.g., user gesture required)
        });
        return;
      } catch (e) {
        // Fallback to TTS below
      }
    }

    // Fallback: speak tile label using browser TTS
    // Resolve the label using the same logic as renderTiles
    const resolvedLabel = resolveTileLabel(tile, this.props.intl);
    if (!resolvedLabel || !('speechSynthesis' in window)) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(resolvedLabel);
      utterance.lang = 'zh-HK';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      // Non‑critical
    }
  };

  handleTileClick = tile => {
    const { onTileClick, isSelecting } = this.props;

    if (tile.loadBoard && !isSelecting) {
      const boardComponentRef = this.props.board.isFixed
        ? 'fixedBoardContainerRef'
        : 'boardContainerRef';
      this[boardComponentRef].current.scrollTop = 0;
    }
    onTileClick(tile);
  };

  handleTileFocus = tileId => {
    const { onFocusTile, board } = this.props;
    onFocusTile(tileId, board.id);
  };

  handleBoardKeyUp = event => {
    const { onRequestPreviousBoard } = this.props;

    if (event.keyCode === keycode('esc')) {
      onRequestPreviousBoard();
    }
  };

  handleBoardTitleClick = () => {
    if (!this.props.userData.email) {
      return false;
    }
    const boardName = (this.props.board && this.props.board.name) ? this.props.board.name : '';
    this.setState({
      openTitleDialog: true,
      titleDialogValue: boardName
    });
  };

  handleBoardTitleChange = event => {
    const { value: titleDialogValue } = event.target;
    // Ensure value is always a string, never undefined
    this.setState({ titleDialogValue: titleDialogValue || '' });
  };

  handleBoardTitleSubmit = async () => {
    if (this.state.titleDialogValue.length) {
      try {
        await this.props.editBoardTitle(this.state.titleDialogValue);
      } catch (e) { }
    }
    this.handleBoardTitleClose();
  };

  handleBoardTitleClose = () => {
    const boardName = (this.props.board && this.props.board.name) ? this.props.board.name : '';
    const boardId = (this.props.board && this.props.board.id) ? this.props.board.id : '';
    this.setState({
      openTitleDialog: false,
      titleDialogValue: boardName || boardId || ''
    });
  };

  renderTiles(tiles) {
    const {
      isSelecting,
      isSaving,
      selectedTileIds,
      displaySettings
    } = this.props;

    // Ensure tiles is an array
    if (!tiles || !Array.isArray(tiles)) {
      return null;
    }

    // Filter out null/undefined tiles (virtual tiles from list view)
    const validTiles = tiles.filter(tile =>
      tile !== null && tile !== undefined && typeof tile === 'object' && tile.id
    );

    return validTiles
      .filter(tileToRender => tileToRender && tileToRender.id) // Additional safety check
      .map(tileToRender => {
        const tile = {
          ...tileToRender,
          label: resolveTileLabel(tileToRender, this.props.intl)
        };
        const isSelected = selectedTileIds && Array.isArray(selectedTileIds) && selectedTileIds.includes(tile.id);
        const variant = Boolean(tile.loadBoard) ? 'folder' : 'button';

        return (
          <div key={tile.id}>
            <Tile
              backgroundColor={tile.backgroundColor}
              borderColor={tile.borderColor}
              variant={variant}
              onClick={e => {
                e.stopPropagation();
                // Add visual feedback animation
                const tileElement = e.currentTarget;
                tileElement.classList.add('clicked');
                setTimeout(() => {
                  tileElement.classList.remove('clicked');
                }, 300);
                this.handleTileClick(tile);
              }}
              onFocus={() => {
                this.handleTileFocus(tile.id);
              }}
              data-tile-id={tile.id}
            >
              <Symbol
                image={tile.image}
                label={tile.label}
                keyPath={tile.keyPath}
                labelpos={displaySettings.labelPosition}
              />

              {isSelecting && !isSaving && (
                <div className="CheckCircle">
                  {isSelected && (
                    <CheckCircleIcon className="CheckCircle__icon" />
                  )}
                </div>
              )}
            </Tile>
          </div>
        );
      });
  }

  renderTileFixedBoard = tileToRender => {
    const tile = {
      ...tileToRender,
      label: resolveTileLabel(tileToRender, this.props.intl)
    };
    const {
      isSelecting,
      isSaving,
      selectedTileIds,
      displaySettings
    } = this.props;

    const isSelected = selectedTileIds.includes(tile.id);
    const variant = Boolean(tile.loadBoard) ? 'folder' : 'button';

    return (
      <Tile
        backgroundColor={tile.backgroundColor}
        borderColor={tile.borderColor}
        variant={variant}
        onClick={e => {
          e.stopPropagation();
          this.handleTileClick(tile);
        }}
        onFocus={() => {
          this.handleTileFocus(tile.id);
        }}
        id={tile.id}
      >
        <Symbol
          image={tile.image}
          label={tile.label}
          keyPath={tile.keyPath}
          labelpos={displaySettings.labelPosition}
        />

        {isSelecting && !isSaving && (
          <div className="CheckCircle">
            {isSelected && <CheckCircleIcon className="CheckCircle__icon" />}
          </div>
        )}
      </Tile>
    );
  };

  render() {
    const {
      board,
      intl,
      userData,
      disableBackButton,
      isLocked,
      isSaving,
      isSelectAll,
      isSelecting,
      isFixedBoard,
      onAddClick,
      onDeleteClick,
      onEditClick,
      onSaveBoardClick,
      onSelectAllToggle,
      onSelectClick,
      onLockClick,
      onLockNotify,
      onRequestPreviousBoard,
      onRequestToRootBoard,
      onBoardTypeChange,
      selectedTileIds,
      navigationSettings,
      deactivateScanner,
      publishBoard,
      emptyVoiceAlert,
      offlineVoiceAlert,
      onAddRemoveRow,
      onAddRemoveColumn,
      onTileDrop,
      onLayoutChange,
      isRootBoardTourEnabled,
      isUnlockedTourEnabled,
      disableTour,
      onCopyTiles,
      onPasteTiles,
      setIsScroll,
      isScroll,
      totalRows,
      changeDefaultBoard,
      improvedPhrase,
      speak
    } = this.props;

    const tiles = this.renderTiles(board?.tiles || []);
    const cols = DISPLAY_SIZE_GRID_COLS[this.props.displaySettings.uiSize];
    const isLoggedIn = !!userData.email;
    const isNavigationButtonsOnTheSide =
      navigationSettings.navigationButtonsStyle === undefined ||
      navigationSettings.navigationButtonsStyle ===
      NAVIGATION_BUTTONS_STYLE_SIDES;

    // Only render Scanner component when not using eye-tracking
    const isEyeTracking = this.props.scannerSettings.strategy === SCANNING_METHOD_EYE_TRACKING;
    const scannerActive = !isEyeTracking && this.props.scannerSettings.active;

    return (
      <Scanner
        active={scannerActive}
        iterationInterval={this.props.scannerSettings.delay}
        strategy={this.props.scannerSettings.strategy}
        onDeactivation={deactivateScanner}
      >
        <div
          className={classNames('Board', {
            'is-locked': this.props.isLocked
          })}
        >
          <BoardTour
            isLocked={isLocked}
            isRootBoardTourEnabled={isRootBoardTourEnabled}
            isUnlockedTourEnabled={isUnlockedTourEnabled}
            disableTour={disableTour}
            intl={intl}
            onDefaultBoardOptionClick={changeDefaultBoard}
          />
          <div
            className={classNames('Board__output', {
              hidden: this.props.displaySettings.hideOutputActive
            })}
            data-output-section="true"
          >
            <OutputContainer />
          </div>

          <Navbar
            className="Board__navbar"
            disabled={disableBackButton || isSelecting || isSaving}
            isLocked={isLocked}
            isScannerActive={this.props.scannerSettings.active}
            onBackClick={onRequestPreviousBoard}
            onLockClick={onLockClick}
            onDeactivateScannerClick={deactivateScanner}
            onLockNotify={onLockNotify}
            title={resolveBoardName(board, intl)}
            board={board}
            userData={userData}
            publishBoard={publishBoard}
            showNotification={this.props.showNotification}
            profiles={this.props.profiles || []}
            onGenerateQR={this.props.onGenerateQR}
            onGenerateCloudCode={this.props.onGenerateCloudCode}
            onGenerateEmail={this.props.onGenerateEmail}
            onRedeemCode={this.props.onRedeemCode}
            onJyutpingKeyboardClick={this.props.onJyutpingKeyboardClick}
            isJyutpingEnabled={this.props.isJyutpingEnabled}
          />
          {emptyVoiceAlert && (
            <Alert variant="filled" severity="error">
              {intl.formatMessage(messages.emptyVoiceAlert)}
            </Alert>
          )}
          {offlineVoiceAlert && (
            <Alert
              variant="filled"
              severity="warning"
              action={
                <Button
                  size="small"
                  variant="outlined"
                  style={{ color: 'white', borderColor: 'white' }}
                  component={Link}
                  to="/settings/speech"
                >
                  {intl.formatMessage(messages.offlineChangeVoice)}
                </Button>
              }
            >
              {intl.formatMessage(messages.offlineVoiceAlert)}
            </Alert>
          )}

          <CommunicatorToolbar
            className="Board__communicator-toolbar"
            isSelecting={isSelecting || isSaving}
          />

          <EditToolbar
            board={board}
            onBoardTitleClick={this.handleBoardTitleClick}
            className="Board__edit-toolbar"
            isSelectAll={isSelectAll}
            isSelecting={isSelecting}
            isSaving={isSaving}
            isLoggedIn={isLoggedIn}
            isLocked={isLocked}
            onAddClick={onAddClick}
            isFixedBoard={isFixedBoard}
            onDeleteClick={onDeleteClick}
            onEditClick={onEditClick}
            onSaveBoardClick={onSaveBoardClick}
            onSelectAllToggle={onSelectAllToggle}
            onSelectClick={onSelectClick}
            selectedItemsCount={selectedTileIds.length}
            onBoardTypeChange={onBoardTypeChange}
            onCopyTiles={onCopyTiles}
            onPasteTiles={onPasteTiles}
            copiedTiles={this.props.copiedTiles}
            onJyutpingRulesClick={this.props.onJyutpingRulesClick}
          />
          <div className="BoardSideButtonsContainer">
            {navigationSettings.caBackButtonActive && (
              <NavigationButtons
                active={
                  navigationSettings.caBackButtonActive &&
                  !isSelecting &&
                  (!isSaving || isNavigationButtonsOnTheSide) &&
                  !this.props.scannerSettings.active
                }
                navHistory={this.props.navHistory}
                previousBoard={onRequestPreviousBoard}
                toRootBoard={onRequestToRootBoard}
                isSaving={isSaving}
                isNavigationButtonsOnTheSide={isNavigationButtonsOnTheSide}
              />
            )}
            <Scannable>
              <div
                id="BoardTilesContainer"
                className={classNames('Board__tiles', {
                  ScrollButtonsOnTheSides:
                    navigationSettings.bigScrollButtonsActive &&
                    isNavigationButtonsOnTheSide
                })}
                onKeyUp={this.handleBoardKeyUp}
                ref={this.boardContainerRef}
              >
                {!board.isFixed &&
                  (tiles.length ? (
                    <Grid
                      board={board}
                      edit={isSelecting && !isSaving}
                      cols={cols}
                      onLayoutChange={onLayoutChange}
                      setIsScroll={setIsScroll}
                      isBigScrollBtns={
                        navigationSettings.bigScrollButtonsActive
                      }
                    >
                      {tiles}
                    </Grid>
                  ) : (
                    <EmptyBoard />
                  ))}

                {board.isFixed && (
                  <FixedGrid
                    order={board.grid ? board.grid.order : []}
                    items={board.tiles}
                    columns={
                      board.grid ? board.grid.columns : DEFAULT_COLUMNS_NUMBER
                    }
                    rows={board.grid ? board.grid.rows : DEFAULT_ROWS_NUMBER}
                    dragAndDropEnabled={isSelecting}
                    renderItem={this.renderTileFixedBoard}
                    onItemDrop={onTileDrop}
                    fixedRef={this.fixedBoardContainerRef}
                    setIsScroll={setIsScroll}
                    isBigScrollBtns={navigationSettings.bigScrollButtonsActive}
                    isNavigationButtonsOnTheSide={isNavigationButtonsOnTheSide}
                  />
                )}

                <EditGridButtons
                  active={
                    isFixedBoard && isSelecting && !isSaving ? true : false
                  }
                  columns={
                    board.grid ? board.grid.columns : DEFAULT_COLUMNS_NUMBER
                  }
                  rows={board.grid ? board.grid.rows : DEFAULT_ROWS_NUMBER}
                  onAddRemoveRow={onAddRemoveRow}
                  onAddRemoveColumn={onAddRemoveColumn}
                  moveColsButtonToLeft={
                    navigationSettings.bigScrollButtonsActive &&
                    isNavigationButtonsOnTheSide
                  }
                />
              </div>
            </Scannable>

            {navigationSettings.bigScrollButtonsActive && (
              <ScrollButtons
                active={
                  navigationSettings.bigScrollButtonsActive &&
                  (!isSaving || isNavigationButtonsOnTheSide) &&
                  !this.props.scannerSettings.active &&
                  (isScroll || isNavigationButtonsOnTheSide)
                }
                isScroll={isScroll}
                isSaving={isSaving}
                boardContainer={
                  board.isFixed
                    ? this.fixedBoardContainerRef
                    : this.boardContainerRef
                }
                totalRows={totalRows}
                boardId={board.id}
                isNavigationButtonsOnTheSide={isNavigationButtonsOnTheSide}
              />
            )}
          </div>
          {navigationSettings.improvePhraseActive && (
            <ImprovePhraseOutput
              improvedPhrase={improvedPhrase}
              speak={speak}
            />
          )}
          <Dialog
            open={this.state.openTitleDialog}
            aria-labelledby="board-dialog-title"
            onSubmit={this.handleBoardTitleSubmit}
            onClose={this.handleBoardTitleClose}
          >
            <DialogTitle id="board-dialog-title">
              {intl.formatMessage(messages.editTitle)}
            </DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                id="board title"
                label={intl.formatMessage(messages.boardTitle)}
                type="text"
                fullWidth
                value={this.state.titleDialogValue || ''}
                onChange={this.handleBoardTitleChange}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={this.handleBoardTitleClose} color="primary">
                {intl.formatMessage(messages.boardEditTitleCancel)}
              </Button>
              <Button
                onClick={this.handleBoardTitleSubmit}
                color="primary"
                variant="contained"
              >
                {intl.formatMessage(messages.boardEditTitleAccept)}
              </Button>
            </DialogActions>
          </Dialog>
        </div>
      </Scanner>
    );
  }
}

export default Board;
