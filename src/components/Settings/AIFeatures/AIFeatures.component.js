import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, intlShape } from 'react-intl';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import CircularProgress from '@material-ui/core/CircularProgress';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import FullScreenDialog from '../../UI/FullScreenDialog';
import messages from './AIFeatures.messages';
import './AIFeatures.css';

const styles = theme => ({
  tabPanel: {
    padding: theme.spacing(3)
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 200
  },
  suggestionCard: {
    margin: theme.spacing(1),
    cursor: 'pointer'
  },
  predictionChip: {
    margin: theme.spacing(0.5),
    cursor: 'pointer'
  }
});

function AIFeatures({
  onClose,
  profiles,
  loading,
  suggestions,
  predictions,
  learningStats,
  onGetSuggestions,
  onGetPredictions,
  onGetLearningStats,
  classes,
  intl
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [context, setContext] = useState('');
  const [typingInput, setTypingInput] = useState('');
  const [jyutpingInput, setJyutpingInput] = useState('');

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleGetSuggestions = async () => {
    if (!selectedProfile || !context) return;
    await onGetSuggestions(context, selectedProfile, 10);
  };

  const handleGetTypingPredictions = async () => {
    if (!typingInput) return;
    await onGetPredictions(typingInput, 'en', 5);
  };

  const handleGetJyutpingPredictions = async () => {
    if (!jyutpingInput) return;
    await onGetPredictions(jyutpingInput, 'yue', 10);
  };

  const renderCardSuggestions = () => {
    return (
      <div className={classes.tabPanel}>
        <FormControl className={classes.formControl} fullWidth>
          <InputLabel><FormattedMessage {...messages.selectProfile} /></InputLabel>
          <Select
            value={selectedProfile}
            onChange={e => setSelectedProfile(e.target.value)}
          >
            {profiles.map(profile => (
              <MenuItem key={profile.id} value={profile.id}>
                {profile.name || profile.display_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          fullWidth
          label={<FormattedMessage {...messages.context} />}
          value={context}
          onChange={e => setContext(e.target.value)}
          multiline
          rows={3}
          style={{ marginTop: '16px' }}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleGetSuggestions}
          disabled={loading || !selectedProfile || !context}
          fullWidth
          style={{ marginTop: '16px' }}
        >
          {loading ? <CircularProgress size={24} /> : <FormattedMessage {...messages.getSuggestions} />}
        </Button>
        {suggestions && suggestions.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <Typography variant="h6" gutterBottom>
              <FormattedMessage {...messages.suggestions} />
            </Typography>
            {suggestions.map((card, index) => (
              <Card key={index} className={classes.suggestionCard}>
                <CardContent>
                  <Typography variant="h6">{card.title || card.label_text}</Typography>
                  {card.category && (
                    <Typography variant="body2" color="textSecondary">
                      {card.category}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTypingPredictions = () => {
    return (
      <div className={classes.tabPanel}>
        <TextField
          fullWidth
          label={<FormattedMessage {...messages.typeText} />}
          value={typingInput}
          onChange={e => {
            setTypingInput(e.target.value);
            if (e.target.value) {
              handleGetTypingPredictions();
            }
          }}
          style={{ marginBottom: '16px' }}
        />
        {predictions && predictions.length > 0 && (
          <div>
            <Typography variant="h6" gutterBottom>
              <FormattedMessage {...messages.predictions} />
            </Typography>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {predictions.map((pred, index) => (
                <Button
                  key={index}
                  variant="outlined"
                  className={classes.predictionChip}
                  onClick={() => setTypingInput(pred.text)}
                >
                  {pred.text}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderJyutpingPredictions = () => {
    return (
      <div className={classes.tabPanel}>
        <TextField
          fullWidth
          label={<FormattedMessage {...messages.typeJyutping} />}
          value={jyutpingInput}
          onChange={e => {
            setJyutpingInput(e.target.value);
            if (e.target.value) {
              handleGetJyutpingPredictions();
            }
          }}
          style={{ marginBottom: '16px' }}
        />
        {predictions && predictions.length > 0 && (
          <div>
            <Typography variant="h6" gutterBottom>
              <FormattedMessage {...messages.predictions} />
            </Typography>
            {predictions.map((pred, index) => (
              <Card key={index} className={classes.suggestionCard}>
                <CardContent>
                  <Typography variant="h5">{pred.character}</Typography>
                  <Typography variant="body1">{pred.jyutping}</Typography>
                  {pred.meaning && (
                    <Typography variant="body2" color="textSecondary">
                      {pred.meaning}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderLearningStats = () => {
    return (
      <div className={classes.tabPanel}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => onGetLearningStats(selectedProfile || null)}
          disabled={loading}
          style={{ marginBottom: '16px' }}
        >
          {loading ? <CircularProgress size={24} /> : <FormattedMessage {...messages.loadStats} />}
        </Button>
        {learningStats && (
          <Paper style={{ padding: '16px' }}>
            <Typography variant="h6" gutterBottom>
              <FormattedMessage {...messages.learningStatistics} />
            </Typography>
            <Typography variant="body1">
              <FormattedMessage {...messages.totalCards} />: {learningStats.total_cards || 0}
            </Typography>
            <Typography variant="body1">
              <FormattedMessage {...messages.totalAttempts} />: {learningStats.total_attempts || 0}
            </Typography>
            <Typography variant="body1">
              <FormattedMessage {...messages.avgAccuracy} />: {learningStats.avg_accuracy || 0}%
            </Typography>
            <Typography variant="body1">
              <FormattedMessage {...messages.avgDifficulty} />: {learningStats.avg_difficulty || 0}
            </Typography>
          </Paper>
        )}
      </div>
    );
  };

  return (
    <FullScreenDialog
      open
      title={<FormattedMessage {...messages.aiFeatures} />}
      onClose={onClose}
    >
      <div className="AIFeatures">
        <Paper>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label={<FormattedMessage {...messages.cardSuggestions} />} />
            <Tab label={<FormattedMessage {...messages.typingPrediction} />} />
            <Tab label={<FormattedMessage {...messages.jyutpingPrediction} />} />
            <Tab label={<FormattedMessage {...messages.learningStats} />} />
          </Tabs>

          {activeTab === 0 && renderCardSuggestions()}
          {activeTab === 1 && renderTypingPredictions()}
          {activeTab === 2 && renderJyutpingPredictions()}
          {activeTab === 3 && renderLearningStats()}
        </Paper>
      </div>
    </FullScreenDialog>
  );
}

AIFeatures.propTypes = {
  onClose: PropTypes.func.isRequired,
  profiles: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
  suggestions: PropTypes.array,
  predictions: PropTypes.array,
  learningStats: PropTypes.object,
  onGetSuggestions: PropTypes.func.isRequired,
  onGetPredictions: PropTypes.func.isRequired,
  onGetLearningStats: PropTypes.func.isRequired,
  classes: PropTypes.object.isRequired,
  intl: intlShape.isRequired
};

export default withStyles(styles)(AIFeatures);

