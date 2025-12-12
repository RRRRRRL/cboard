import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { injectIntl } from 'react-intl';
import { showNotification } from '../../Notifications/Notifications.actions';
import AIFeatures from './AIFeatures.component';
import API from '../../../api';

export class AIFeaturesContainer extends PureComponent {
  static propTypes = {
    profiles: PropTypes.array.isRequired,
    history: PropTypes.object.isRequired,
    intl: PropTypes.object.isRequired,
    showNotification: PropTypes.func.isRequired
  };

  state = {
    suggestions: [],
    predictions: [],
    learningStats: null,
    loading: false
  };

  handleGetSuggestions = async (context, profileId, limit) => {
    this.setState({ loading: true });
    try {
      const result = await API.getAISuggestions(context, profileId, limit);
      this.setState({ suggestions: result.suggestions || [], loading: false });
    } catch (error) {
      console.error('Get AI suggestions error:', error);
      this.setState({ loading: false });
    }
  };

  handleGetPredictions = async (input, language, limit) => {
    this.setState({ loading: true });
    try {
      let result;
      if (language === 'yue') {
        result = await API.getJyutpingPredictions(input, limit);
        this.setState({ predictions: result.predictions || [], loading: false });
      } else {
        result = await API.getTypingPredictions(input, language, limit);
        this.setState({ predictions: result.predictions || [], loading: false });
      }
    } catch (error) {
      console.error('Get predictions error:', error);
      this.setState({ loading: false });
    }
  };

  handleGetLearningStats = async (profileId) => {
    this.setState({ loading: true });
    try {
      const result = await API.getLearningStats(profileId);
      this.setState({ learningStats: result.stats || null, loading: false });
    } catch (error) {
      console.error('Get learning stats error:', error);
      this.setState({ loading: false });
    }
  };

  render() {
    const { profiles, history, intl } = this.props;
    const { suggestions, predictions, learningStats, loading } = this.state;

    return (
      <AIFeatures
        profiles={profiles}
        onClose={history.goBack}
        loading={loading}
        suggestions={suggestions}
        predictions={predictions}
        learningStats={learningStats}
        onGetSuggestions={this.handleGetSuggestions}
        onGetPredictions={this.handleGetPredictions}
        onGetLearningStats={this.handleGetLearningStats}
        intl={intl}
      />
    );
  }
}

const mapStateToProps = state => ({
  profiles: state.communicator.communicators || []
});

const mapDispatchToProps = {
  showNotification
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(injectIntl(AIFeaturesContainer));

