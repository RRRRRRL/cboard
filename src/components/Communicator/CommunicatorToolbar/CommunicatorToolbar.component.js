import React from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, intlShape } from 'react-intl';
import classNames from 'classnames';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import ListItem from '@material-ui/core/ListItem';
import Menu from '@material-ui/core/Menu';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import Avatar from '@material-ui/core/Avatar';
import LayersIcon from '@material-ui/icons/Layers';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import ViewModuleIcon from '@material-ui/icons/ViewModule';
import AddCircleIcon from '@material-ui/icons/AddCircle';

import FormDialog from '../../UI/FormDialog';
import messages from './CommunicatorToolbar.messages';
import './CommunicatorToolbar.css';
import { isCordova } from '../../../cordova-util';
import DefaultBoardSelector from './DefaultBoardSelector';
import API from '../../../api';
import { getEyeTrackingInstance } from '../../../utils/eyeTrackingIntegration';

class CommunicatorToolbar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      boardsMenu: null,
      openTitleDialog: false,
      titleDialogValue:
        this.props.currentCommunicator?.displayName ||
        this.props.currentCommunicator?.name ||
        this.props.currentCommunicator?.id ||
        ''
    };
    this.eyeTrackingDwellHandler = null;
    this.eyeTrackingInstance = null;
  }

  async openMenu(e) {
    // When opening the menu, refresh boards from API to ensure we have the latest data
    // This prevents showing deleted profiles in the dropdown
    // Note: Menu anchor is set in handleCommunicatorTitleClick, so we don't set it here again
    if (this.props.isLoggedIn && this.props.userData && this.props.userData.id) {
      try {
        console.log('[CommunicatorToolbar] Opening menu, refreshing boards from API...');
        const freshBoards = await API.getMyBoards({
          limit: 1000, // Get all boards
          page: 1,
          search: ''
        });
        
        console.log('[CommunicatorToolbar] Fetched boards from API:', {
          total: freshBoards?.total || 0,
          dataLength: freshBoards?.data?.length || 0,
          boards: freshBoards?.data?.map(b => ({ id: b.id, name: b.name, user_id: b.user_id, email: b.email, is_public: b.is_public })) || []
        });
        
        // Update Redux store with fresh board data
        // Mark as complete refresh so deleted boards are removed
        if (freshBoards && freshBoards.data && freshBoards.data.length > 0) {
          this.props.addBoards(freshBoards.data, true); // true = isCompleteRefresh
          console.log('[CommunicatorToolbar] Updated Redux store with', freshBoards.data.length, 'boards');
        } else {
          // Even if no boards, mark as complete refresh to remove all user boards
          this.props.addBoards([], true);
          console.warn('[CommunicatorToolbar] No boards returned from API');
        }
      } catch (refreshError) {
        console.error('[CommunicatorToolbar] Failed to refresh boards when opening menu:', refreshError);
        // Continue with existing data if refresh fails
      }
    } else {
      console.warn('[CommunicatorToolbar] Cannot refresh boards - not logged in or no userData:', {
        isLoggedIn: this.props.isLoggedIn,
        hasUserData: !!this.props.userData,
        userId: this.props.userData?.id
      });
    }

    // Setup eye tracking for profile selection when menu opens
    this.setupEyeTrackingForMenu();
  }

  setupEyeTrackingForMenu = () => {
    try {
      this.eyeTrackingInstance = getEyeTrackingInstance();
      if (this.eyeTrackingInstance && this.eyeTrackingInstance.isEnabled) {
        // Store original callback
        this.originalDwellCallback = this.eyeTrackingInstance.onDwellCallback;
        
        // Create a wrapper that checks for menu items first, then falls back to original callback
        const menuDwellWrapper = ({ tileId, x, y, dwellDuration }) => {
          // Check if menu is open
          if (!this.state.boardsMenu) {
            // Menu is closed, use original callback
            if (this.originalDwellCallback) {
              this.originalDwellCallback({ tileId, x, y, dwellDuration });
            }
            return;
          }

          // Menu is open, check if gaze is on a menu item
          try {
            const elementAtPoint = document.elementFromPoint(x, y);
            if (!elementAtPoint) {
              // No element at point, use original callback
              if (this.originalDwellCallback) {
                this.originalDwellCallback({ tileId, x, y, dwellDuration });
              }
              return;
            }

            // Find the closest menu item (ListItem) with data-profile-id
            const menuItem = elementAtPoint.closest('[data-profile-id]');
            if (!menuItem) {
              // Not a menu item, use original callback
              if (this.originalDwellCallback) {
                this.originalDwellCallback({ tileId, x, y, dwellDuration });
              }
              return;
            }

            const profileId = menuItem.getAttribute('data-profile-id');
            if (!profileId) {
              // No profile ID, use original callback
              if (this.originalDwellCallback) {
                this.originalDwellCallback({ tileId, x, y, dwellDuration });
              }
              return;
            }

            // Found a menu item, select it
            const board = this.props.boards.find(b => String(b.id) === String(profileId));
            if (board) {
              console.log('[CommunicatorToolbar] Eye tracking selected profile:', profileId);
              this.switchBoard(board);
              // Don't call original callback for menu selection
              return;
            }
          } catch (error) {
            console.warn('[CommunicatorToolbar] Error in menu dwell handler:', error);
          }

          // Fallback to original callback if menu item selection failed
          if (this.originalDwellCallback) {
            this.originalDwellCallback({ tileId, x, y, dwellDuration });
          }
        };

        // Set the wrapper as the new callback
        this.eyeTrackingInstance.onDwellCallback = menuDwellWrapper;
      }
    } catch (error) {
      console.warn('[CommunicatorToolbar] Failed to setup eye tracking for menu:', error);
    }
  }

  cleanupEyeTrackingForMenu = () => {
    try {
      if (this.eyeTrackingInstance && this.originalDwellCallback !== undefined) {
        // Restore original dwell callback
        this.eyeTrackingInstance.onDwellCallback = this.originalDwellCallback;
        this.originalDwellCallback = undefined;
      }
    } catch (error) {
      console.warn('[CommunicatorToolbar] Failed to cleanup eye tracking for menu:', error);
    }
  }

  closeMenu() {
    this.setState({ boardsMenu: null });
    // Cleanup eye tracking when menu closes
    this.cleanupEyeTrackingForMenu();
  }

  componentWillUnmount() {
    // Cleanup eye tracking on unmount
    this.cleanupEyeTrackingForMenu();
  }

  async switchBoard(board) {
    // Verify the board still exists before switching
    try {
      await API.getBoard(board.id);
      this.closeMenu();
      this.props.switchBoard(board.id);
      this.props.history.replace(`/profile/${board.id}`);
    } catch (err) {
      // Board doesn't exist (deleted), refresh the menu
      console.warn('[CommunicatorToolbar] Board no longer exists, refreshing menu:', board.id);
      this.closeMenu();
      // Refresh boards and reopen menu
      if (this.props.isLoggedIn && this.props.userData && this.props.userData.id) {
        try {
          const freshBoards = await API.getMyBoards({
            limit: 1000,
            page: 1,
            search: ''
          });
          if (freshBoards && freshBoards.data && freshBoards.data.length > 0) {
            this.props.addBoards(freshBoards.data);
          }
        } catch (refreshError) {
          console.error('[CommunicatorToolbar] Failed to refresh boards:', refreshError);
        }
      }
      this.props.showNotification(
        this.props.intl.formatMessage({
          id: 'cboard.components.CommunicatorToolbar.boardNotFound',
          defaultMessage: 'This board no longer exists. Please select another board.'
        }),
        'error'
      );
    }
  }

  handleCommunicatorTitleClick = async (e) => {
    if (!this.props.isLoggedIn) {
      return false;
    }

    // If boards menu is already open, close it and open title dialog
    if (this.state.boardsMenu) {
      this.closeMenu();
      this.setState({
        openTitleDialog: true,
        titleDialogValue:
          this.props.currentCommunicator?.displayName ||
          this.props.currentCommunicator?.name ||
          this.props.currentCommunicator?.id ||
          ''
      });
    } else {
      // First click: open boards menu to switch boards
      // Set menu anchor immediately, then refresh boards
      this.setState({ boardsMenu: e.currentTarget });
      await this.openMenu(e);
    }
  };

  handleCommunicatorTitleChange = event => {
    const { value: titleDialogValue } = event.target;
    this.setState({ titleDialogValue });
  };

  handleCommunicatorTitleSubmit = async () => {
    if (this.state.titleDialogValue.length) {
      try {
        await this.props.editCommunicatorTitle(this.state.titleDialogValue);
      } catch (e) {}
    }
    this.handleCommunicatorTitleClose();
  };

  handleCommunicatorTitleClose = () => {
    this.setState({
      openTitleDialog: false,
      titleDialogValue:
        this.props.currentCommunicator?.displayName ||
        this.props.currentCommunicator?.name ||
        this.props.currentCommunicator?.id ||
        ''
    });
  };

  handleNewBoardClick = () => {};

  boardCaption = board => {
    // Cordova path cannot be absolute
    if (isCordova() && board.caption && board.caption.search('/') === 0) {
      return `.${board.caption}`;
    } else {
      return board.caption;
    }
  };

  render() {
    const {
      intl,
      className,
      boards,
      isSelecting,
      openCommunicatorDialog,
      isDark,
      changeDefaultBoard
    } = this.props;
    
    // Debug: Log boards prop
    if (process.env.NODE_ENV === 'development') {
      console.log('[CommunicatorToolbar] Render - boards prop:', {
        boardsLength: boards?.length || 0,
        boards: boards?.map(b => ({ id: b?.id, name: b?.name, user_id: b?.user_id, email: b?.email, is_public: b?.is_public })) || []
      });
    }

    const communicatorTitle = 
      this.props.currentCommunicator?.displayName ||
      this.props.currentCommunicator?.name ||
      this.props.currentCommunicator?.id ||
      intl.formatMessage(messages.boards);

    return (
      <div className={classNames('CommunicatorToolbar', className)}>
        <Button
          className={classNames('Communicator__title', {
            'logged-in': this.props.isLoggedIn
          })}
          id="boards-button"
          disabled={isSelecting}
          onClick={this.props.isLoggedIn ? this.handleCommunicatorTitleClick : this.openMenu.bind(this)}
        >
          <ArrowDropDownIcon />
          {communicatorTitle}
        </Button>
        <Menu
          id="boards-menu"
          className="CommunicatorToolbar__menu"
          anchorEl={this.state.boardsMenu}
          open={Boolean(this.state.boardsMenu)}
          onClose={this.closeMenu.bind(this)}
        >
          {(() => {
            // Debug: Log menu rendering
            if (process.env.NODE_ENV === 'development') {
              console.log('[CommunicatorToolbar] Rendering menu:', {
                isOpen: Boolean(this.state.boardsMenu),
                boardsLength: boards?.length || 0,
                boards: boards?.map(b => ({ id: b?.id, name: b?.name })) || []
              });
            }
            return null;
          })()}
          {boards && boards.length > 0 ? boards.map(board => {
            // Debug: Log each board being rendered
            if (process.env.NODE_ENV === 'development') {
              console.log('[CommunicatorToolbar] Rendering board item:', {
                id: board?.id,
                name: board?.name,
                hasId: !!board?.id,
                hasName: !!board?.name
              });
            }
            return (
            <ListItem
              className="CommunicatorToolbar__menuitem CommunicatorToolbar__menuitem--eye-tracking"
              key={board.id}
              onClick={this.switchBoard.bind(this, board)}
              data-profile-id={board.id}
            >
              <ListItemAvatar>
                {this.boardCaption(board) ? (
                  <Avatar src={this.boardCaption(board)} />
                ) : (
                  <Avatar>
                    <ViewModuleIcon />
                  </Avatar>
                )}
              </ListItemAvatar>
              <ListItemText
                inset
                primary={
                  board.name ||
                  (board.nameKey &&
                    intl.formatMessage({
                      id: board.nameKey,
                      defaultMessage: board.id
                    }))
                }
                secondary={intl.formatMessage(messages.tiles, {
                  qty: board.tiles_count || board.tilesCount || (board.tiles && Array.isArray(board.tiles) 
                    ? board.tiles.filter(tile => tile !== null && tile !== undefined && typeof tile === 'object').length 
                    : 0)
                })}
              />
            </ListItem>
            );
          }) : (
            <ListItem>
              <ListItemText
                primary={intl.formatMessage({
                  id: 'cboard.components.CommunicatorToolbar.noBoards',
                  defaultMessage: 'No boards available'
                })}
              />
            </ListItem>
          )}
        </Menu>
        <FormDialog
          open={this.state.openTitleDialog}
          title={<FormattedMessage {...messages.editTitle} />}
          onSubmit={this.handleCommunicatorTitleSubmit}
          onClose={this.handleCommunicatorTitleClose}
        >
          <TextField
            autoFocus
            margin="dense"
            label={<FormattedMessage {...messages.communicatorTitle} />}
            value={this.state.titleDialogValue}
            type="text"
            onChange={this.handleCommunicatorTitleChange}
            fullWidth
            required
          />
        </FormDialog>

        <div className="CommunicatorToolbar__group CommunicatorToolbar__group--start">
          <Button
            className={'edit__communicator'}
            disabled={isSelecting}
            onClick={openCommunicatorDialog}
          >
            <LayersIcon className="CommunicatorToolbar__group CommunicatorToolbar__group--start--button" />
            {intl.formatMessage(messages.editCommunicator)}
          </Button>
        </div>
        <div className="CommunicatorToolbar__group CommunicatorToolbar__group--end">
          {false && (
            <div>
              <Button
                label={intl.formatMessage(messages.addBoardButton)}
                onClick={this.handleNewBoardClick}
                //TODO: need to implement function
                disabled={isSelecting}
                color="inherit"
              >
                {intl.formatMessage(messages.addBoardButton)}
                <AddCircleIcon />
              </Button>
            </div>
          )}
          <DefaultBoardSelector
            isDarkMode={isDark}
            changeDefaultBoard={changeDefaultBoard}
          />
        </div>
      </div>
    );
  }
}

CommunicatorToolbar.defaultProps = {
  className: '',
  boards: [],
  isSelecting: false,
  switchBoard: () => {},
  showNotification: () => {},
  openCommunicatorDialog: () => {},
  changeDefaultBoard: () => {}
};

CommunicatorToolbar.propTypes = {
  className: PropTypes.string,
  intl: intlShape.isRequired,
  boards: PropTypes.array,
  currentCommunicator: PropTypes.object,
  isSelecting: PropTypes.bool,
  showNotification: PropTypes.func,
  switchBoard: PropTypes.func,
  openCommunicatorDialog: PropTypes.func,
  editCommunicatorTitle: PropTypes.func,
  isDark: PropTypes.bool,
  changeDefaultBoard: PropTypes.func,
  addBoards: PropTypes.func,
  userData: PropTypes.object,
  showNotification: PropTypes.func
};

export default CommunicatorToolbar;
