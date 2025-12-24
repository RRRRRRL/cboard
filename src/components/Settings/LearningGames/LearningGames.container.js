import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { injectIntl } from 'react-intl';
import { showNotification } from '../../Notifications/Notifications.actions';
import LearningGames from './LearningGames.component';
import API from '../../../api';

const mapStateToProps = (state) => {
  const activeBoardId = state.board?.activeBoardId;
  const currentBoard = activeBoardId 
    ? state.board?.boards?.find(board => board.id === activeBoardId) 
    : null;
  return {
    board: currentBoard
  };
};

export class LearningGamesContainer extends PureComponent {
  static propTypes = {
    history: PropTypes.object.isRequired,
    intl: PropTypes.object.isRequired,
    showNotification: PropTypes.func.isRequired,
    board: PropTypes.object
  };

  state = {
    profiles: [],
    gameData: null,
    loading: false,
    gameHistory: [],
    historyLoading: false
  };

  async componentDidMount() {
    // Load user profiles (communication profiles) for game association
    try {
      const profiles = await API.getProfiles();
      this.setState({ profiles });
    } catch (error) {
      console.error('Get profiles error (LearningGames):', error);
    }
  }

  handleStartGame = async (gameType, options = {}) => {
    this.setState({ loading: true });
    try {
      // Get AI-recommended difficulty if not explicitly provided
      let difficulty = options.difficulty;
      const profileId = options.profileId || null;
      if (!difficulty) {
        try {
          const currentBoardId = this.props.board?.id || this.props.boardId || null;
          const difficultyData = await API.getDifficultyAdjustment(currentBoardId, gameType);
          difficulty = difficultyData?.recommended_difficulty || 'medium';
          console.log('[LearningGames] AI recommended difficulty:', difficulty, difficultyData);
        } catch (error) {
          console.warn('[LearningGames] Failed to get AI difficulty adjustment, using default:', error);
          difficulty = 'medium';
        }
      }
      
      let result;
      if (gameType === 'spelling') {
        // 傳入 profileId，方便後端按使用者/語言做個人化
        result = await API.getSpellingGame(difficulty, 10, profileId);
      } else if (gameType === 'matching') {
        // Options: { matchType, difficulty, profileId }
        const rawMatchType = options.matchType;
        const matchType =
          rawMatchType === 'word-picture' || rawMatchType === 'jyutping-picture'
            ? rawMatchType
            : 'word-picture';

        // Map difficulty to number of pairs
        let limit = 8;
        if (difficulty === 'easy') limit = 4;
        else if (difficulty === 'hard') limit = 12;
        
        // Get current board ID from props if available
        const currentBoardId = this.props.board?.id || this.props.boardId || null;
        // 傳入 profileId，讓後端可以根據使用者語言與檔案過濾/優先卡片
        result = await API.getMatchingGame(matchType, limit, currentBoardId, profileId);
        
        // Transform image path to full URL for matching game using formatSrc logic
        if (result && result.pairs) {
          const { normalizeImageUrl } = require('../../../utils/imageUrlTransformer');
          result.pairs = result.pairs.map(pair => {
            let imageUrl = pair.image || pair.image_path;
            if (imageUrl) {
              // Use the same URL transformation logic as Symbol component
              imageUrl = normalizeImageUrl(imageUrl);
            }
            return {
              ...pair,
              image: imageUrl || null
            };
          });
          
          // Shuffle options for better game experience
          if (result.options) {
            result.options = [...result.options].sort(() => Math.random() - 0.5);
          }
        }
      }
      this.setState({ gameData: result, loading: false });
      return result;
    } catch (error) {
      console.error('Start game error:', error);
      this.setState({ loading: false });
      
      // Handle network errors gracefully
      const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error';
      if (isNetworkError && !navigator.onLine) {
        // Return empty game data for offline mode
        const emptyGameData = { pairs: [], options: [] };
        this.setState({ gameData: emptyGameData });
        this.props.showNotification(
          this.props.intl.formatMessage({
            id: 'cboard.components.Settings.LearningGames.offlineMode',
            defaultMessage: 'You are currently offline. Please check your connection.'
          }),
          'warning'
        );
        return emptyGameData;
      }
      
      throw error;
    }
  };

  handleSubmitGame = async (gameType, score, totalQuestions, timeSpent, difficulty, profileId = null, questions = null) => {
    try {
      await API.submitGameResult(gameType, score, totalQuestions, timeSpent, difficulty, profileId, questions);
      this.props.showNotification(
        this.props.intl.formatMessage({ 
          id: 'cboard.components.Settings.LearningGames.gameSubmitted', 
          defaultMessage: 'Game result saved!' 
        })
      );
    } catch (error) {
      console.error('Submit game error:', error);
      throw error;
    }
  };

  handleLoadHistory = async (gameType = null, limit = 20, profileId = null) => {
    this.setState({ historyLoading: true });
    try {
      const result = await API.getGameHistory(gameType, limit, profileId);
      this.setState({
        gameHistory: result.history || [],
        historyLoading: false
      });
      return result;
    } catch (error) {
      console.error('Load game history error:', error);
      this.setState({ historyLoading: false });
      this.props.showNotification(
        this.props.intl.formatMessage({
          id: 'cboard.components.Settings.LearningGames.historyError',
          defaultMessage: 'Failed to load game history.'
        }),
        'error'
      );
      throw error;
    }
  };

  render() {
    const { history, intl } = this.props;
    const { profiles, gameData, loading, gameHistory, historyLoading } = this.state;

    return (
      <LearningGames
        onClose={history.goBack}
        loading={loading}
        gameData={gameData}
        onStartGame={this.handleStartGame}
        onSubmitGame={this.handleSubmitGame}
        gameHistory={gameHistory}
        historyLoading={historyLoading}
        onLoadHistory={this.handleLoadHistory}
        profiles={profiles}
        intl={intl}
      />
    );
  }
}

const mapDispatchToProps = {
  showNotification
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(injectIntl(LearningGamesContainer));

