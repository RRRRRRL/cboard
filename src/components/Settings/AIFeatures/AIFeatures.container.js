import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { injectIntl } from 'react-intl';
import { showNotification } from '../../Notifications/Notifications.actions';
import { addBoards } from '../../Board/Board.actions';
import AIFeatures from './AIFeatures.component';
import API from '../../../api';
import messages from './AIFeatures.messages';

export class AIFeaturesContainer extends PureComponent {
  static propTypes = {
    history: PropTypes.object.isRequired,
    intl: PropTypes.object.isRequired,
    showNotification: PropTypes.func.isRequired,
    addBoards: PropTypes.func.isRequired
  };

  state = {
    profiles: [],
    suggestions: [],
    predictions: [],
    learningStats: null,
    loading: false,
    savingSuggestionId: null,
    pendingSuggestionImages: [] // Track Photocen images to clean up if not accepted
  };

  async componentDidMount() {
    // 載入目前使用者的溝通 profiles（來自 /profiles 表，而不是 boards 或 communicators）
    this.setState({ loading: true });
    try {
      const profiles = await API.getProfiles();
      this.setState({ profiles, loading: false });
    } catch (error) {
      console.error('Get profiles error (AI Features):', error);
      this.setState({ loading: false });
    }
  }

  async componentWillUnmount() {
    // Clean up any remaining unaccepted suggestions when dialog closes
    await this.cleanupPendingSuggestions();
  }

  cleanupPendingSuggestions = async () => {
    const { pendingSuggestionImages } = this.state;
    if (pendingSuggestionImages.length === 0) {
      return;
    }

    console.log('[AI FEATURES] Cleaning up', pendingSuggestionImages.length, 'unaccepted suggestion images');
    try {
      await API.cleanupAISuggestionImages(pendingSuggestionImages);
      this.setState({ pendingSuggestionImages: [] });
      console.log('[AI FEATURES] ✓ Cleanup completed');
    } catch (error) {
      console.error('[AI FEATURES] Cleanup error:', error);
      // Non-fatal, don't block user workflow
    }
  };

  // context + boardId (板 = 沟通 profile)
  handleGetSuggestions = async (context, boardId, limit) => {
    console.log('[AI FEATURES] ===== Starting AI suggestion request =====');
    console.log('[AI FEATURES] Context:', context);
    console.log('[AI FEATURES] Profile/Board ID:', boardId);
    console.log('[AI FEATURES] Limit:', limit);
    
    // Clean up previous pending suggestions before generating new ones
    await this.cleanupPendingSuggestions();
    
    const startTime = Date.now();
    this.setState({ loading: true });
    
    try {
      console.log('[AI FEATURES] Sending request to API...');
      const result = await API.getAISuggestions(context, boardId, limit);
      const duration = Date.now() - startTime;
      
      console.log('[AI FEATURES] ✓ Request completed in', duration, 'ms');
      console.log('[AI FEATURES] Response:', result);
      console.log('[AI FEATURES] Suggestions count:', result.suggestions?.length || 0);
      
      if (result.suggestions && result.suggestions.length > 0) {
        result.suggestions.forEach((suggestion, index) => {
          console.log(`[AI FEATURES] Suggestion ${index + 1}:`, {
            title: suggestion.title,
            keyword: suggestion.keyword,
            source: suggestion.source,
            hasImage: !!suggestion.image_path
          });
        });
      }
      
      // Extract Photocen image paths for cleanup tracking
      const photocenImages = (result.suggestions || []).filter(s => s.source === 'photocen' && s.image_path).map(s => s.image_path);
      this.setState({ 
        suggestions: result.suggestions || [], 
        pendingSuggestionImages: photocenImages,
        loading: false 
      });
      console.log('[AI FEATURES] ===== AI suggestion request completed =====');
      console.log('[AI FEATURES] Tracking', photocenImages.length, 'Photocen images for cleanup');
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[AI FEATURES] ✗✗✗ Request failed after', duration, 'ms');
      console.error('[AI FEATURES] Error details:', error);
      console.error('[AI FEATURES] Error message:', error.message);
      console.error('[AI FEATURES] Error response:', error.response?.data);
      this.setState({ loading: false });
      console.log('[AI FEATURES] ===== AI suggestion request failed =====');
    }
  };

  handleAddSuggestionAsCard = async (card, boardId, vocalization = '', shouldRefresh = true) => {
    const { intl } = this.props;
    if (!card || !boardId) {
      return;
    }

    try {
      this.setState({ savingSuggestionId: card.id || card.image_path || card.title || null });

      // Build payload for backend /cards
      const title = (card.title || card.label_text || '').trim() || intl.formatMessage(messages.untitledCard);
      const labelText = (card.label_text || card.title || '').trim() || title;

      const payload = {
        title,
        label_text: labelText,
        image_path: card.image_path || card.image_url || null,
        category: card.category || null,
        audio_path: vocalization || null // Store vocalization as audio_path if provided
      };

      const created = await API.createCardFromAISuggestion(payload);
      
      if (!created || !created.id) {
        throw new Error('Card creation failed: No card ID returned');
      }

      console.log('[AI FEATURES] Card created:', created.id);
      
      // Link this new card to the selected profile
      // Try to add at position (0,0,0), if that fails, try other positions
      console.log('[AI FEATURES] Linking card to profile:', { cardId: created.id, profileId: boardId });
      
      let linked = false;
      const positionsToTry = [
        { row: 0, col: 0, page: 0 },
        { row: 0, col: 1, page: 0 },
        { row: 0, col: 2, page: 0 },
        { row: 1, col: 0, page: 0 },
        { row: 1, col: 1, page: 0 },
        { row: 2, col: 0, page: 0 },
        { row: 0, col: 3, page: 0 },
        { row: 1, col: 2, page: 0 }
      ];
      
      for (const pos of positionsToTry) {
        try {
          await API.addCardToProfile(boardId, created.id, {
            rowIndex: pos.row,
            colIndex: pos.col,
            pageIndex: pos.page,
            isVisible: 1
          });
          console.log(`[AI FEATURES] ✓ Card successfully linked to profile at (${pos.row},${pos.col},${pos.page})`);
          linked = true;
          break;
        } catch (linkError) {
          // If it's a 409 (already exists) or other error, try next position
          if (linkError.response?.status === 409) {
            console.log(`[AI FEATURES] Position (${pos.row},${pos.col},${pos.page}) occupied, trying next...`);
            continue;
          }
          // For other errors, log and continue
          console.warn(`[AI FEATURES] Error at position (${pos.row},${pos.col},${pos.page}):`, linkError.message);
        }
      }
      
      if (!linked) {
        console.error('[AI FEATURES] ✗ Failed to link card to profile after trying all positions');
        // Card was created but not linked - show warning but don't fail
        this.props.showNotification(
          intl.formatMessage(messages.cardCreatedButNotLinked || {
            id: 'cboard.components.AIFeatures.cardCreatedButNotLinked',
            defaultMessage: 'Card created but could not be added to profile. Please add it manually.'
          }),
          'warning'
        );
        return false; // Return false to indicate failure
      } else {
        // Card was successfully linked - refresh the profile board in Redux store (only if shouldRefresh is true)
        if (shouldRefresh) {
          console.log('[AI FEATURES] Refreshing profile board in Redux store...');
          try {
            const refreshedBoard = await API.getBoard(boardId);
            if (refreshedBoard) {
              console.log('[AI FEATURES] ✓ Profile board refreshed:', {
                profileId: boardId,
                tilesCount: refreshedBoard.tiles?.length || 0
              });
              // Update Redux store with refreshed board data
              this.props.addBoards([refreshedBoard]);
            }
          } catch (refreshError) {
            console.error('[AI FEATURES] Failed to refresh profile board:', refreshError);
            // Don't fail the whole operation if refresh fails
          }
        }
      }

      // Remove this image from pending cleanup since it was accepted
      const acceptedImagePath = card.image_path;
      if (acceptedImagePath) {
        this.setState(prev => ({
          pendingSuggestionImages: prev.pendingSuggestionImages.filter(path => path !== acceptedImagePath)
        }));
        console.log('[AI FEATURES] Removed accepted image from cleanup list:', acceptedImagePath);
      }

      this.props.showNotification(
        intl.formatMessage(messages.cardCreatedFromAISuggestion),
        'success'
      );
      return true; // Return true to indicate success

      // After creation, keep suggestions list, but you could also remove this suggestion if desired
    } catch (error) {
      console.error('Add AI suggestion as card error:', error);
      this.props.showNotification(
        intl.formatMessage(messages.cardCreateErrorFromAISuggestion),
        'error'
      );
    } finally {
      this.setState({ savingSuggestionId: null });
    }
  };

  handleGetPredictions = async (input, language, limit) => {
    this.setState({ loading: true });
    try {
      // Only handle typing predictions (English and other languages)
      // Jyutping predictions are now handled by the dedicated Jyutping Keyboard component
      console.log('[AIFeatures] Requesting typing predictions:', { input, language, limit });
      const result = await API.getTypingPredictions(input, language, limit);
      this.setState({ predictions: result.predictions || [], loading: false });
      console.log('[AIFeatures] Predictions response:', result);
    } catch (error) {
      console.error('Get predictions error:', error);
      this.setState({ loading: false });
    }
  };

  handleGetLearningStats = async (profileId) => {
    this.setState({ loading: true });
    try {
      const [statsResult, difficultyResult] = await Promise.all([
        API.getLearningStats(profileId),
        API.getDifficultyAdjustment(profileId, 'spelling')
      ]);
      
      this.setState({ 
        learningStats: {
          ...(statsResult.stats || {}),
          recommended_difficulty: difficultyResult.recommended_difficulty || null
        }, 
        loading: false 
      });
    } catch (error) {
      console.error('Get learning stats error:', error);
      this.setState({ loading: false });
    }
  };

  handleGetLearningSuggestions = async (profileId) => {
    this.setState({ loading: true });
    try {
      // Get user's selected language from intl
      let userLocale = this.props.intl?.locale || 'zh-CN';
      
      // Normalize generic 'zh' to specific variant
      // Check Redux state for language preference
      const languageState = this.props.language;
      if (languageState && languageState.lang) {
        const langFromState = languageState.lang;
        // If state has specific variant, use it
        if (langFromState === 'zh-TW' || langFromState === 'zh-HK' || langFromState === 'zh-Hant') {
          userLocale = 'zh-TW';
        } else if (langFromState === 'zh-CN' || langFromState === 'zh-Hans' || langFromState === 'zh') {
          userLocale = 'zh-CN';
        } else if (langFromState) {
          userLocale = langFromState;
        }
      }
      
      // Normalize intl.locale if it's generic 'zh'
      if (userLocale === 'zh') {
        // Default to Simplified Chinese, but check if we can determine Traditional
        userLocale = 'zh-CN';
      }
      
      console.log('[AI Features] Using locale for learning suggestions:', userLocale);
      const result = await API.getLearningSuggestions(profileId, userLocale);
      this.setState({ 
        learningStats: {
          ...this.state.learningStats,
          ai_suggestions: result.ai_suggestions || null,
          common_mistakes: result.common_mistakes || []
        }, 
        loading: false 
      });
    } catch (error) {
      console.error('Get learning suggestions error:', error);
      this.setState({ loading: false });
    }
  };

  render() {
    const { history, intl } = this.props;
    const { profiles, suggestions, predictions, learningStats, loading, savingSuggestionId } = this.state;

    return (
      <AIFeatures
        profiles={profiles}
        onClose={history.goBack}
        loading={loading}
        suggestions={suggestions}
        savingSuggestionId={savingSuggestionId}
        predictions={predictions}
        learningStats={learningStats}
        onGetSuggestions={this.handleGetSuggestions}
        onAddSuggestionAsCard={this.handleAddSuggestionAsCard}
        onGetPredictions={this.handleGetPredictions}
        onGetLearningStats={this.handleGetLearningStats}
        onGetLearningSuggestions={this.handleGetLearningSuggestions}
        intl={intl}
      />
    );
  }
}

const mapStateToProps = state => ({
  language: state.language
});

const mapDispatchToProps = {
  showNotification,
  addBoards
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(injectIntl(AIFeaturesContainer));

