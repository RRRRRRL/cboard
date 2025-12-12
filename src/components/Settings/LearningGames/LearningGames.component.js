import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, intlShape } from 'react-intl';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import CircularProgress from '@material-ui/core/CircularProgress';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import FullScreenDialog from '../../UI/FullScreenDialog';
import messages from './LearningGames.messages';
import './LearningGames.css';

const styles = theme => ({
  tabPanel: {
    padding: theme.spacing(3)
  },
  gameCard: {
    margin: theme.spacing(2),
    minHeight: 200
  },
  questionCard: {
    margin: theme.spacing(2),
    padding: theme.spacing(2)
  },
  optionButton: {
    margin: theme.spacing(1),
    minWidth: 120
  },
  scoreDisplay: {
    textAlign: 'center',
    padding: theme.spacing(2)
  }
});

function LearningGames({
  onClose,
  loading,
  gameData,
  onStartGame,
  onAnswerQuestion,
  onSubmitGame,
  classes,
  intl
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [matchingGameType, setMatchingGameType] = useState('word-picture');
  const [difficulty, setDifficulty] = useState('medium');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [matchedPairs, setMatchedPairs] = useState([]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    resetGame();
  };

  const resetGame = () => {
    setGameStarted(false);
    setGameFinished(false);
    setCurrentQuestion(0);
    setScore(0);
    setSelectedAnswer('');
    setMatchedPairs([]);
    setSelectedImage(null);
    setSelectedOption(null);
  };

  const handleStartGame = async () => {
    try {
      const gameTypeToUse = activeTab === 0 ? 'spelling' : matchingGameType;
      await onStartGame(gameTypeToUse, difficulty);
      setGameStarted(true);
      setStartTime(Date.now());
      setCurrentQuestion(0);
      setScore(0);
    } catch (error) {
      console.error('Start game error:', error);
    }
  };

  const handleAnswer = (answer) => {
    setSelectedAnswer(answer);
    const question = gameData?.questions?.[currentQuestion];
    if (question && answer === question.correct_answer) {
      setScore(score + 1);
    }
  };

  const handleNext = () => {
    if (currentQuestion < (gameData?.questions?.length || 0) - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer('');
    } else {
      handleFinishGame();
    }
  };

  const handleFinishGame = async () => {
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    const totalQuestions = gameData?.questions?.length || 0;
    
    try {
      const gameTypeToSubmit = activeTab === 0 ? 'spelling' : matchingGameType;
      await onSubmitGame(gameTypeToSubmit, score, totalQuestions, timeSpent, difficulty);
      setGameFinished(true);
    } catch (error) {
      console.error('Submit game error:', error);
    }
  };

  const renderSpellingGame = () => {
    if (!gameStarted) {
      return (
        <div className={classes.tabPanel}>
          <FormControl className={classes.formControl} fullWidth>
            <InputLabel><FormattedMessage {...messages.difficulty} /></InputLabel>
            <Select
              value={difficulty}
              onChange={e => setDifficulty(e.target.value)}
            >
              <MenuItem value="easy"><FormattedMessage {...messages.easy} /></MenuItem>
              <MenuItem value="medium"><FormattedMessage {...messages.medium} /></MenuItem>
              <MenuItem value="hard"><FormattedMessage {...messages.hard} /></MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            color="primary"
            onClick={handleStartGame}
            disabled={loading}
            fullWidth
            style={{ marginTop: '16px' }}
          >
            {loading ? <CircularProgress size={24} /> : <FormattedMessage {...messages.startGame} />}
          </Button>
        </div>
      );
    }

    if (gameFinished) {
      const totalQuestions = gameData?.questions?.length || 0;
      const accuracy = totalQuestions > 0 ? ((score / totalQuestions) * 100).toFixed(1) : 0;
      
      return (
        <div className={classes.tabPanel}>
          <Paper className={classes.scoreDisplay}>
            <Typography variant="h4"><FormattedMessage {...messages.gameFinished} /></Typography>
            <Typography variant="h5">
              <FormattedMessage {...messages.score} />: {score} / {totalQuestions}
            </Typography>
            <Typography variant="h6">
              <FormattedMessage {...messages.accuracy} />: {accuracy}%
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                resetGame();
                handleStartGame();
              }}
              style={{ marginTop: '16px' }}
            >
              <FormattedMessage {...messages.playAgain} />
            </Button>
          </Paper>
        </div>
      );
    }

    const question = gameData?.questions?.[currentQuestion];
    if (!question) return null;

    return (
      <div className={classes.tabPanel}>
        <Paper className={classes.questionCard}>
          <Typography variant="h5" gutterBottom>
            <FormattedMessage {...messages.question} /> {currentQuestion + 1} / {gameData?.questions?.length}
          </Typography>
          <Typography variant="h4" gutterBottom>
            {question.character}
          </Typography>
          {question.meaning && (
            <Typography variant="body1" color="textSecondary">
              {question.meaning}
            </Typography>
          )}
          <div style={{ marginTop: '24px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {question.options?.map((option, index) => (
              <Button
                key={index}
                variant={selectedAnswer === option ? 'contained' : 'outlined'}
                color={selectedAnswer === option ? 'primary' : 'default'}
                className={classes.optionButton}
                onClick={() => handleAnswer(option)}
              >
                {option}
              </Button>
            ))}
          </div>
          <Button
            variant="contained"
            color="primary"
            onClick={handleNext}
            disabled={!selectedAnswer}
            fullWidth
            style={{ marginTop: '24px' }}
          >
            <FormattedMessage {...messages.next} />
          </Button>
        </Paper>
      </div>
    );
  };

  const renderMatchingGame = () => {
    if (!gameStarted) {
      return (
        <div className={classes.tabPanel}>
          <FormControl className={classes.formControl} fullWidth>
            <InputLabel><FormattedMessage {...messages.gameType} /></InputLabel>
            <Select
              value={matchingGameType}
              onChange={e => setMatchingGameType(e.target.value)}
            >
              <MenuItem value="word-picture"><FormattedMessage {...messages.wordPicture} /></MenuItem>
              <MenuItem value="jyutping-picture"><FormattedMessage {...messages.jyutpingPicture} /></MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleStartGame('matching', matchingGameType)}
            disabled={loading}
            fullWidth
            style={{ marginTop: '16px' }}
          >
            {loading ? <CircularProgress size={24} /> : <FormattedMessage {...messages.startGame} />}
          </Button>
        </div>
      );
    }

    if (gameFinished) {
      const totalPairs = gameData?.pairs?.length || 0;
      const accuracy = totalPairs > 0 ? ((score / totalPairs) * 100).toFixed(1) : 0;
      
      return (
        <div className={classes.tabPanel}>
          <Paper className={classes.scoreDisplay}>
            <Typography variant="h4"><FormattedMessage {...messages.gameFinished} /></Typography>
            <Typography variant="h5">
              <FormattedMessage {...messages.score} />: {score} / {totalPairs}
            </Typography>
            <Typography variant="h6">
              <FormattedMessage {...messages.accuracy} />: {accuracy}%
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                resetGame();
                handleStartGame('matching', matchingGameType);
              }}
              style={{ marginTop: '16px' }}
            >
              <FormattedMessage {...messages.playAgain} />
            </Button>
          </Paper>
        </div>
      );
    }

    const pairs = gameData?.pairs || [];
    const options = gameData?.options || [];

    const handleImageSelect = (pairId) => {
      if (matchedPairs.includes(pairId)) return;
      if (selectedImage === pairId) {
        setSelectedImage(null);
        return;
      }
      setSelectedImage(pairId);
      if (selectedOption) {
        checkMatch(pairId, selectedOption);
      }
    };

    const handleOptionSelect = (option) => {
      const isAlreadyMatched = matchedPairs.some(p => {
        const pair = pairs.find(pr => pr.id === p);
        return (matchingGameType === 'word-picture' && pair?.title === option) ||
               (matchingGameType === 'jyutping-picture' && (pair?.jyutping === option || pair?.title === option));
      });
      if (isAlreadyMatched) return;
      
      if (selectedOption === option) {
        setSelectedOption(null);
        return;
      }
      
      setSelectedOption(option);
      if (selectedImage) {
        checkMatch(selectedImage, option);
      }
    };

    const checkMatch = (pairId, option) => {
      const pair = pairs.find(p => p.id === pairId);
      const isMatch = (matchingGameType === 'word-picture' && pair?.title === option) ||
                     (matchingGameType === 'jyutping-picture' && (pair?.jyutping === option || pair?.title === option));
      
      if (isMatch) {
        const newScore = score + 1;
        setScore(newScore);
        const newMatchedPairs = [...matchedPairs, pairId];
        setMatchedPairs(newMatchedPairs);
        
        if (newMatchedPairs.length >= pairs.length) {
          setTimeout(() => handleFinishGame(), 500);
        }
      }
      
      setSelectedImage(null);
      setSelectedOption(null);
    };

    return (
      <div className={classes.tabPanel}>
        <Typography variant="h5" gutterBottom>
          <FormattedMessage {...messages.matchPairs} />
        </Typography>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px', marginTop: '24px' }}>
          {pairs.map((pair) => (
            <Card
              key={pair.id}
              className={classes.gameCard}
              style={{
                opacity: matchedPairs.includes(pair.id) ? 0.5 : 1,
                cursor: matchedPairs.includes(pair.id) ? 'default' : 'pointer',
                border: selectedImage === pair.id ? '3px solid #1976d2' : '1px solid #ccc'
              }}
              onClick={() => handleImageSelect(pair.id)}
            >
              <CardContent style={{ textAlign: 'center', padding: '8px' }}>
                <div style={{ position: 'relative', minHeight: '100px' }}>
                  {pair.image ? (
                    <img 
                      src={pair.image} 
                      alt={pair.title || ''} 
                      style={{ width: '100%', height: '100px', objectFit: 'contain' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const fallback = e.target.parentElement.querySelector('.image-fallback');
                        if (fallback) {
                          fallback.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <Typography 
                    variant="body1" 
                    className="image-fallback"
                    style={{ 
                      padding: '20px', 
                      minHeight: '100px', 
                      display: pair.image ? 'none' : 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      position: pair.image ? 'absolute' : 'relative',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0
                    }}
                  >
                    {pair.title || 'No Image'}
                  </Typography>
                </div>
                {matchedPairs.includes(pair.id) && (
                  <Typography variant="body2" style={{ marginTop: '8px', color: '#4caf50' }}>
                    ✓
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        <div style={{ marginTop: '24px' }}>
          <Typography variant="h6" gutterBottom>
            <FormattedMessage {...messages.selectOption} />
          </Typography>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {options.map((option, index) => {
              const isMatched = matchedPairs.some(p => {
                const pair = pairs.find(pr => pr.id === p);
                return (matchingGameType === 'word-picture' && pair.title === option) ||
                       (matchingGameType === 'jyutping-picture' && (pair.jyutping === option || pair.title === option));
              });
              return (
                <Button
                  key={index}
                  variant={selectedOption === option ? 'contained' : (isMatched ? 'outlined' : 'outlined')}
                  color={selectedOption === option ? 'primary' : (isMatched ? 'default' : 'default')}
                  className={classes.optionButton}
                  onClick={() => handleOptionSelect(option)}
                  disabled={isMatched}
                  style={{ opacity: isMatched ? 0.5 : 1 }}
                >
                  {option}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <FullScreenDialog
      open
      title={<FormattedMessage {...messages.learningGames} />}
      onClose={onClose}
    >
      <div className="LearningGames">
        <Paper>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label={<FormattedMessage {...messages.spellingGame} />} />
            <Tab label={<FormattedMessage {...messages.matchingGame} />} />
          </Tabs>

          {activeTab === 0 && renderSpellingGame()}
          {activeTab === 1 && renderMatchingGame()}
        </Paper>
      </div>
    </FullScreenDialog>
  );
}

LearningGames.propTypes = {
  onClose: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  gameData: PropTypes.object,
  onStartGame: PropTypes.func.isRequired,
  onAnswerQuestion: PropTypes.func,
  onSubmitGame: PropTypes.func.isRequired,
  classes: PropTypes.object.isRequired,
  intl: intlShape.isRequired
};

export default withStyles(styles)(LearningGames);

