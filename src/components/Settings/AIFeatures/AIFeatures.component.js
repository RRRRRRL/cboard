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
import CardActions from '@material-ui/core/CardActions';
import CardMedia from '@material-ui/core/CardMedia';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Checkbox from '@material-ui/core/Checkbox';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FullScreenDialog from '../../UI/FullScreenDialog';
import { normalizeImageUrl } from '../../../utils/imageUrlTransformer';
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
  savingSuggestionId,
  learningStats,
  onGetSuggestions,
  onAddSuggestionAsCard,
  onGetLearningStats,
  onGetLearningSuggestions,
  classes,
  intl
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [context, setContext] = useState('');
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [cardVocalizations, setCardVocalizations] = useState({});

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleGetSuggestions = async () => {
    if (!selectedProfile || !context) return;
    await onGetSuggestions(context, selectedProfile, 10);
  };

  const renderCardSuggestions = () => {
    const buildImageUrl = (card) => {
      const raw = card.image_path || card.image_url || null;
      if (!raw) return null;
      // Use normalizeImageUrl to ensure correct backend URL (localhost:8000 instead of localhost:3000)
      return normalizeImageUrl(raw);
    };

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
          minRows={3}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <Typography variant="h6">
                <FormattedMessage {...messages.suggestions} />
              </Typography>
              {suggestions.some(card => card.source === 'photocen') && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={async () => {
                    const selectedCardsArray = Array.from(selectedCards).map(key => {
                      const card = suggestions.find(c => {
                        const cardKey = c.id || c.image_path || c.title || '';
                        return String(cardKey) === String(key);
                      });
                      if (card) {
                        return { card, key, vocalization: cardVocalizations[key] || '' };
                      }
                      return null;
                    }).filter(Boolean);
                    if (selectedCardsArray.length > 0 && selectedProfile) {
                      // Add cards one by one to show progress
                      // Only refresh after the last card is added
                      for (let i = 0; i < selectedCardsArray.length; i++) {
                        const { card, vocalization } = selectedCardsArray[i];
                        const isLast = i === selectedCardsArray.length - 1;
                        await onAddSuggestionAsCard(card, selectedProfile, vocalization, isLast);
                      }
                      setSelectedCards(new Set());
                      setCardVocalizations({});
                    }
                  }}
                  disabled={loading || selectedCards.size === 0 || !selectedProfile}
                >
                  <FormattedMessage {...(messages.addSelectedCards || {
                    id: 'cboard.components.AIFeatures.addSelectedCards',
                    defaultMessage: `Add Selected (${selectedCards.size})`
                  })} />
                </Button>
              )}
            </div>
            {suggestions.map((card, index) => {
              const isPhotocen = card.source === 'photocen';
              const imgUrl = buildImageUrl(card);
              const key = card.id || card.image_path || card.title || index;
              const isSaving = savingSuggestionId && savingSuggestionId === key;
              const isSelected = selectedCards.has(key);
              const vocalization = cardVocalizations[key] || '';

              return (
                <Card key={key} className={classes.suggestionCard} style={{
                  border: isSelected ? '2px solid #1976d2' : '1px solid #e0e0e0',
                  marginBottom: '16px'
                }}>
                  {imgUrl && (
                    <CardMedia
                      component="img"
                      height="140"
                      image={imgUrl}
                      title={card.title || card.label_text || ''}
                    />
                  )}
                  <CardContent>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      {isPhotocen && (
                        <Checkbox
                          checked={isSelected}
                          onChange={(e) => {
                            const newSelected = new Set(selectedCards);
                            if (e.target.checked) {
                              newSelected.add(key);
                            } else {
                              newSelected.delete(key);
                              const newVocalizations = { ...cardVocalizations };
                              delete newVocalizations[key];
                              setCardVocalizations(newVocalizations);
                            }
                            setSelectedCards(newSelected);
                          }}
                          color="primary"
                        />
                      )}
                      <Typography variant="h6" style={{ flex: 1 }}>
                        {card.title || card.label_text}
                      </Typography>
                    </div>
                    {card.keyword && isPhotocen && (
                      <Typography variant="caption" color="textSecondary" style={{ display: 'block', marginBottom: '4px' }}>
                        {/* Display translated title instead of English keyword */}
                        {card.title || card.label_text}
                      </Typography>
                    )}
                    {isPhotocen && isSelected && (
                      <TextField
                        fullWidth
                        label={<FormattedMessage {...(messages.vocalization || {
                          id: 'cboard.components.AIFeatures.vocalization',
                          defaultMessage: 'Vocalization (optional)'
                        })} />}
                        value={vocalization}
                        onChange={(e) => {
                          setCardVocalizations({
                            ...cardVocalizations,
                            [key]: e.target.value
                          });
                        }}
                        size="small"
                        style={{ marginTop: '8px' }}
                        placeholder={card.title || card.label_text || ''}
                      />
                    )}
                  </CardContent>
                  {isPhotocen && typeof onAddSuggestionAsCard === 'function' && !isSelected && (
                    <CardActions>
                      <Button
                        size="small"
                        color="primary"
                        onClick={() => onAddSuggestionAsCard(card, selectedProfile, '')}
                        disabled={loading || isSaving}
                      >
                        {isSaving ? (
                          <CircularProgress size={18} />
                        ) : (
                          <FormattedMessage
                            {...(messages.addSuggestionAsCard || {
                              id: 'cboard.components.AIFeatures.addSuggestionAsCard',
                              defaultMessage: 'Add as new card'
                            })}
                          />
                        )}
                      </Button>
                    </CardActions>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderLearningStats = () => {
    return (
      <div className={classes.tabPanel}>
        <FormControl className={classes.formControl} fullWidth style={{ marginBottom: '16px' }}>
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

        <Button
          variant="contained"
          color="primary"
          onClick={() => onGetLearningStats(selectedProfile || null)}
          disabled={loading}
          style={{ marginBottom: '16px', marginRight: '8px' }}
        >
          {loading ? <CircularProgress size={24} /> : <FormattedMessage {...messages.loadStats} />}
        </Button>

        <Button
          variant="contained"
          color="secondary"
          onClick={() => onGetLearningSuggestions(selectedProfile || null)}
          disabled={loading}
          style={{ marginBottom: '16px' }}
        >
          {loading ? <CircularProgress size={24} /> : <FormattedMessage {...messages.getAISuggestions} />}
        </Button>

        {learningStats && (
          <Paper style={{ padding: '16px', marginBottom: '16px' }}>
            <Typography variant="h6" gutterBottom>
              <FormattedMessage {...messages.learningStatistics} />
            </Typography>
            <Typography variant="body1">
              <FormattedMessage {...messages.totalAttempts} />: {learningStats.total_attempts || 0}
            </Typography>
            <Typography variant="body1">
              <FormattedMessage {...messages.avgAccuracy} />: {learningStats.avg_accuracy || 0}%
            </Typography>
            {learningStats.recommended_difficulty && (
              <Typography variant="body1" style={{ marginTop: '8px', fontWeight: 'bold', color: '#1976d2' }}>
                <FormattedMessage {...messages.recommendedDifficulty} />: {learningStats.recommended_difficulty}
              </Typography>
            )}
          </Paper>
        )}

        {learningStats && learningStats.ai_suggestions && (
          <Paper style={{ padding: '16px', marginTop: '16px', backgroundColor: '#f5f5f5' }}>
            <Typography variant="h6" gutterBottom>
              <FormattedMessage {...messages.aiLearningSuggestions} />
            </Typography>
            <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }}>
              {learningStats.ai_suggestions}
            </Typography>
          </Paper>
        )}

        {learningStats && learningStats.common_mistakes && learningStats.common_mistakes.length > 0 && (
          <Paper style={{ padding: '16px', marginTop: '16px' }}>
            <Typography variant="h6" gutterBottom>
              <FormattedMessage {...messages.commonMistakes} />
            </Typography>
            {learningStats.common_mistakes.map((mistake, index) => (
              <Typography key={index} variant="body2" style={{ marginBottom: '8px' }}>
                <strong>{mistake.jyutping_code}</strong>: <FormattedMessage {...messages.correctAnswerIs} /> <strong>{mistake.hanzi_expected}</strong>，<FormattedMessage {...messages.butYouSelected} /> <strong>{mistake.hanzi_selected}</strong> (<FormattedMessage {...messages.mistakeCount} values={{ count: mistake.mistake_count }} />)
              </Typography>
            ))}
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
            <Tab label={<FormattedMessage {...messages.learningStats} />} />
          </Tabs>

          {activeTab === 0 && renderCardSuggestions()}
          {activeTab === 1 && renderLearningStats()}
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
  learningStats: PropTypes.object,
  onGetSuggestions: PropTypes.func.isRequired,
  onGetLearningStats: PropTypes.func.isRequired,
  onGetLearningSuggestions: PropTypes.func,
  classes: PropTypes.object.isRequired,
  intl: intlShape.isRequired
};

export default withStyles(styles)(AIFeatures);
