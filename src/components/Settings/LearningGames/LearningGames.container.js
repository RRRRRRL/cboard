import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { injectIntl } from 'react-intl';
import { showNotification } from '../../Notifications/Notifications.actions';
import LearningGames from './LearningGames.component';
import API from '../../../api';
import { API_URL } from '../../../constants';

export class LearningGamesContainer extends PureComponent {
  static propTypes = {
    history: PropTypes.object.isRequired,
    intl: PropTypes.object.isRequired,
    showNotification: PropTypes.func.isRequired
  };

  state = {
    gameData: null,
    loading: false
  };

  handleStartGame = async (gameType, difficulty) => {
    this.setState({ loading: true });
    try {
      let result;
      if (gameType === 'spelling') {
        result = await API.getSpellingGame(difficulty, 10);
      } else if (gameType === 'matching') {
        // Get matching type from difficulty parameter (which is actually the match type)
        const matchType = difficulty === 'word-picture' || difficulty === 'jyutping-picture' 
          ? difficulty 
          : 'word-picture';
        result = await API.getMatchingGame(matchType, 8);
        
        // Transform image path to full URL for matching game
        if (result && result.pairs) {
          const baseUrl = API_URL.replace('/api/', '').replace('/api', '');
          result.pairs = result.pairs.map(pair => {
            let imageUrl = pair.image || pair.image_path;
            if (imageUrl && !imageUrl.startsWith('http')) {
              // Convert relative path to absolute URL
              imageUrl = imageUrl.startsWith('/') 
                ? `${baseUrl}${imageUrl}` 
                : `${baseUrl}/${imageUrl}`;
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
      } else {
        result = await API.getMatchingGame('word-picture', 8);
        if (result && result.pairs) {
          const baseUrl = API_URL.replace('/api/', '').replace('/api', '');
          result.pairs = result.pairs.map(pair => {
            let imageUrl = pair.image || pair.image_path;
            if (imageUrl && !imageUrl.startsWith('http')) {
              // Convert relative path to absolute URL
              imageUrl = imageUrl.startsWith('/') 
                ? `${baseUrl}${imageUrl}` 
                : `${baseUrl}/${imageUrl}`;
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
      throw error;
    }
  };

  handleSubmitGame = async (gameType, score, totalQuestions, timeSpent, difficulty) => {
    try {
      await API.submitGameResult(gameType, score, totalQuestions, timeSpent, difficulty);
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

  render() {
    const { history, intl } = this.props;
    const { gameData, loading } = this.state;

    return (
      <LearningGames
        onClose={history.goBack}
        loading={loading}
        gameData={gameData}
        onStartGame={this.handleStartGame}
        onSubmitGame={this.handleSubmitGame}
        intl={intl}
      />
    );
  }
}

const mapDispatchToProps = {
  showNotification
};

export default connect(
  null,
  mapDispatchToProps
)(injectIntl(LearningGamesContainer));

