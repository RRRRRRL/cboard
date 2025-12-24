import React from 'react';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import { injectIntl } from 'react-intl';
import CommunicatorToolbar from './CommunicatorToolbar.component';
import CommunicatorDialog from '../CommunicatorDialog';
import {
  switchBoard,
  replaceBoard,
  changeDefaultBoard,
  addBoards
} from '../../Board/Board.actions';
import { showNotification } from '../../Notifications/Notifications.actions';
import {
  importCommunicator,
  deleteCommunicator,
  verifyAndUpsertCommunicator
} from '../Communicator.actions';

class CommunicatorContainer extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      openDialog: false
    };
  }

  openCommunicatorDialog() {
    this.setState({ openDialog: true });
  }

  closeCommunicatorDialog() {
    this.setState({ openDialog: false });
  }

  editCommunicatorTitle = async name => {
    const {
      currentCommunicator,
      verifyAndUpsertCommunicator,
      upsertApiCommunicator,
      userData
    } = this.props;

    const updatedCommunicatorData = {
      ...currentCommunicator,
      name
    };

    const upsertedCommunicator = verifyAndUpsertCommunicator(
      updatedCommunicatorData
    );

    if ('name' in userData && 'email' in userData) {
      try {
        await upsertApiCommunicator(upsertedCommunicator);
      } catch (err) {
        console.error('Error upserting communicator', err);
      }
    }
  };

  render() {
    const toolbarProps = {
      ...this.props,
      isLoggedIn: !!this.props.userData.email,
      editCommunicatorTitle: this.editCommunicatorTitle,
      openCommunicatorDialog: this.openCommunicatorDialog.bind(this)
    };

    return (
      <React.Fragment>
        <CommunicatorToolbar {...toolbarProps} />
        {this.state.openDialog && (
          <CommunicatorDialog
            open={this.state.openDialog}
            onClose={this.closeCommunicatorDialog.bind(this)}
          />
        )}
      </React.Fragment>
    );
  }
}

const mapStateToProps = (
  { board, communicator, app: { userData, displaySettings } },
  ownProps
) => {
  const activeCommunicatorId = communicator.activeCommunicatorId;
  const currentCommunicator = communicator.communicators.find(
    communicator => communicator.id === activeCommunicatorId
  );
  const activeBoardId = board.activeBoardId;
  
  // In profile-centric architecture, show all user's profiles in the dropdown.
  // Use all boards loaded in Redux, excluding system templates and public profiles.
  let boards = [];
  if (userData && userData.id && board.boards && Array.isArray(board.boards)) {
    // Debug: Log all boards before filtering
    if (process.env.NODE_ENV === 'development') {
      console.log('[CommunicatorToolbar] mapStateToProps - All boards in Redux:', {
        totalBoards: board.boards.length,
        userData: { id: userData.id, email: userData.email },
        boards: board.boards.map(b => ({
          id: b?.id,
          name: b?.name,
          user_id: b?.user_id,
          email: b?.email,
          is_public: b?.is_public,
          isPublic: b?.isPublic
        }))
      });
    }
    
    boards = board.boards.filter(b => {
      if (!b || !b.id) return false;
      
      // Filter out system templates
      if (b.email === 'support@cboard.io') return false;
      
      // Filter out public profiles
      if (b.is_public === true || b.isPublic === true) return false;
      
      // Show if user_id matches
      if (b.user_id && String(b.user_id) === String(userData.id)) return true;
      
      // Show if email matches
      if (b.email && userData.email && b.email === userData.email) return true;
      
      // If no user_id or email, but also not public, assume it's user's (for backward compatibility)
      if (!b.user_id && !b.email && !b.is_public && !b.isPublic) return true;
      
      return false;
    });
    
    // Debug: Log filtered boards
    if (process.env.NODE_ENV === 'development') {
      console.log('[CommunicatorToolbar] mapStateToProps - Filtered boards:', {
        filteredCount: boards.length,
        boards: boards.map(b => ({ id: b?.id, name: b?.name }))
      });
    }
  } else {
    // Debug: Log why boards array is empty
    if (process.env.NODE_ENV === 'development') {
      console.warn('[CommunicatorToolbar] mapStateToProps - Boards array is empty:', {
        hasUserData: !!userData,
        userId: userData?.id,
        hasBoardBoards: !!board.boards,
        isArray: Array.isArray(board.boards),
        boardBoardsLength: board.boards?.length || 0
      });
    }
  }
  const currentBoard = boards.find(board => String(board.id) === String(activeBoardId));
  
  // Get rootBoard object to use its name as communicator title
  const rootBoardId = currentCommunicator?.rootBoard;
  const rootBoard = rootBoardId 
    ? board.boards.find(b => String(b.id) === String(rootBoardId))
    : null;
  
  // Use rootBoard name if available, otherwise fall back to communicator name or id
  const communicatorDisplayName = rootBoard?.name || currentCommunicator?.name || currentCommunicator?.id || '';

  return {
    communicators: communicator.communicators,
    boards,
    currentCommunicator: currentCommunicator ? {
      ...currentCommunicator,
      displayName: communicatorDisplayName
    } : null,
    currentBoard,
    userData,
    isDark: displaySettings.darkThemeActive,
    ...ownProps
  };
};

const mapDispatchToProps = {
  importCommunicator,
  verifyAndUpsertCommunicator,
  deleteCommunicator,
  showNotification,
  switchBoard,
  replaceBoard,
  changeDefaultBoard,
  addBoards
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(injectIntl(withRouter(CommunicatorContainer)));
