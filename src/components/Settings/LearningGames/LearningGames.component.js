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
  gameHistory,
  historyLoading,
  onLoadHistory,
  profiles,
  classes,
  intl
}) {
  const [activeTab, setActiveTab] = useState(0); // 0=Spelling, 1=Matching, 2=History
  const [matchingGameType, setMatchingGameType] = useState('word-picture');
  const [difficulty, setDifficulty] = useState('medium'); // Shared difficulty for both games
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [matchedPairs, setMatchedPairs] = useState([]);
  const [answerFeedback, setAnswerFeedback] = useState(null); // 'correct' or 'incorrect'
  const [lastAnsweredQuestion, setLastAnsweredQuestion] = useState(null);
  const [lastMatchResult, setLastMatchResult] = useState(null); // { pairId, option, isCorrect }
  const [answeredQuestions, setAnsweredQuestions] = useState(new Set()); // Track which questions have been answered
  const [questionAnswers, setQuestionAnswers] = useState(new Map()); // Track selected answer for each question index
  const [failedMatches, setFailedMatches] = useState(new Set()); // Track failed match attempts (pairId-option combinations)
  const [attemptedPairs, setAttemptedPairs] = useState(new Set()); // Track which pairs have been attempted (matched or failed)
  const [historyGameType, setHistoryGameType] = useState('all');
  const [historyDifficulty, setHistoryDifficulty] = useState('all');
  const [selectedProfileId, setSelectedProfileId] = useState('');

  const handleTabChange = async (event, newValue) => {
    setActiveTab(newValue);
    // Reset game state when switching between game tabs
    if (newValue === 0 || newValue === 1) {
      resetGame();
    }
    // When switching to history tab, load history once
    if (newValue === 2 && typeof onLoadHistory === 'function') {
      try {
        // Load game history for selected profile (if any)
        await onLoadHistory(null, 20, selectedProfileId || null);
      } catch (e) {
        // Error already handled in container
      }
    }
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
    setAnswerFeedback(null);
    setLastAnsweredQuestion(null);
    setLastMatchResult(null);
    setAnsweredQuestions(new Set());
    setQuestionAnswers(new Map());
    setFailedMatches(new Set());
    setAttemptedPairs(new Set());
  };

  const handleStartGame = async () => {
    try {
      if (!selectedProfileId) {
        // Require selecting a profile before starting
        return;
      }

      if (activeTab === 0) {
        // Spelling game
        await onStartGame('spelling', { difficulty, profileId: selectedProfileId });
      } else {
        // Matching game - pass match type and difficulty
        await onStartGame('matching', { matchType: matchingGameType, difficulty, profileId: selectedProfileId });
      }
      setGameStarted(true);
      setStartTime(Date.now());
      setCurrentQuestion(0);
      setScore(0);
    } catch (error) {
      console.error('Start game error:', error);
    }
  };

  const handleAnswer = (answer) => {
    // Prevent re-selecting if this question has already been answered
    if (answeredQuestions.has(currentQuestion)) {
      return;
    }
    
    setSelectedAnswer(answer);
    const question = gameData?.questions?.[currentQuestion];
    if (question) {
      const isCorrect = answer === question.correct_answer;
      if (isCorrect) {
        setScore(score + 1);
        setAnswerFeedback('correct');
      } else {
        setAnswerFeedback('incorrect');
      }
      setLastAnsweredQuestion(currentQuestion);
      
      // Mark this question as answered and store the answer
      setAnsweredQuestions(new Set([...answeredQuestions, currentQuestion]));
      setQuestionAnswers(new Map([...questionAnswers, [currentQuestion, answer]]));
      
      // Don't clear feedback - keep it visible like correct answers
    }
  };

  const handleNext = () => {
    // Only allow next if current question has been answered
    if (!answeredQuestions.has(currentQuestion)) {
      return;
    }
    
    if (currentQuestion < (gameData?.questions?.length || 0) - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer('');
      setAnswerFeedback(null);
      setLastAnsweredQuestion(null);
    } else {
      handleFinishGame();
    }
  };

  const handleFinishGame = async () => {
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    const totalQuestions = gameData?.questions?.length || 0;
    
    try {
      const gameTypeToSubmit = activeTab === 0 ? 'spelling' : matchingGameType;
      
      // For spelling game, collect detailed question results
      let questions = null;
      if (activeTab === 0 && gameData?.questions) {
        questions = gameData.questions.map((q, idx) => {
          const selectedAnswer = questionAnswers.get(idx) || null;
          const isCorrect = selectedAnswer === q.correct_answer;
          
          return {
            jyutping_code: q.correct_jyutping || q.jyutping,
            hanzi_expected: q.correct_answer,
            hanzi_selected: selectedAnswer,
            selected_answer: selectedAnswer,
            is_correct: isCorrect
          };
        });
      }
      
      await onSubmitGame(
        gameTypeToSubmit,
        score,
        totalQuestions,
        timeSpent,
        difficulty,
        selectedProfileId || null,
        questions
      );
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
            <InputLabel><FormattedMessage {...messages.selectProfile} /></InputLabel>
            <Select
              value={selectedProfileId}
              onChange={e => setSelectedProfileId(e.target.value)}
            >
              {Array.isArray(profiles) && profiles.map(profile => (
                <MenuItem key={profile.id} value={profile.id}>
                  {profile.display_name || profile.name || `#${profile.id}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

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
            disabled={loading || !selectedProfileId}
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
          <Typography variant="h4" gutterBottom style={{ fontFamily: 'monospace', fontSize: '2.5rem' }}>
            {question.jyutping || question.character}
          </Typography>
          <Typography variant="body1" color="textSecondary" style={{ marginTop: '8px' }}>
            <FormattedMessage {...messages.selectCorrectHanzi} defaultMessage="选择正确的汉字" />
          </Typography>
          <div style={{ marginTop: '24px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {question.options?.map((option, index) => {
              const isSelected = selectedAnswer === option;
              const isCorrect = option === question.correct_answer;
              const showFeedback = answerFeedback && lastAnsweredQuestion === currentQuestion;
              const isAnswered = answeredQuestions.has(currentQuestion);
              
              // Determine button color based on feedback - keep colors persistent after answering
              let buttonColor = 'default';
              let buttonVariant = 'outlined';
              
              // If question is answered, apply persistent colors
              if (isAnswered) {
                if (isSelected && answerFeedback === 'correct' && isCorrect) {
                  buttonColor = 'primary';
                  buttonVariant = 'contained';
                } else if (isSelected && answerFeedback === 'incorrect' && !isCorrect) {
                  buttonColor = 'secondary'; // Red for incorrect - keep it
                  buttonVariant = 'contained';
                } else if (isCorrect && answerFeedback === 'incorrect') {
                  // Show correct answer in green when wrong answer is selected
                  buttonColor = 'primary';
                  buttonVariant = 'contained';
                }
              } else if (isSelected) {
                // Before answering, show selected state
                buttonColor = 'primary';
                buttonVariant = 'contained';
              }
              
              // Apply green/red styling - keep colors persistent after feedback
              const buttonStyle = {};
              if (isAnswered && isSelected && answerFeedback === 'correct' && isCorrect) {
                buttonStyle.backgroundColor = '#4caf50'; // Green - keep it
                buttonStyle.color = '#fff';
              } else if (isAnswered && isSelected && answerFeedback === 'incorrect' && !isCorrect) {
                buttonStyle.backgroundColor = '#f44336'; // Red - keep it (don't fade)
                buttonStyle.color = '#fff';
              } else if (isAnswered && isCorrect && answerFeedback === 'incorrect') {
                buttonStyle.backgroundColor = '#4caf50'; // Green for correct answer when wrong is selected
                buttonStyle.color = '#fff';
                buttonStyle.border = '2px solid #4caf50';
              }
              
              return (
                <Button
                  key={index}
                  variant={buttonVariant}
                  color={buttonColor}
                  className={classes.optionButton}
                  onClick={() => handleAnswer(option)}
                  disabled={isAnswered} // Disable all buttons once question is answered
                  style={{ ...buttonStyle, fontSize: '1.5rem', minHeight: '60px' }}
                >
                  {option}
                </Button>
              );
            })}
          </div>
          {answeredQuestions.has(currentQuestion) && lastAnsweredQuestion === currentQuestion && (
            <Typography 
              variant="body1" 
              style={{ 
                marginTop: '16px', 
                textAlign: 'center',
                color: answerFeedback === 'correct' ? '#4caf50' : '#f44336',
                fontWeight: 'bold',
                fontSize: '1.2rem'
              }}
            >
              {answerFeedback === 'correct' ? '✓ 正确！' : '✗ 错误'}
            </Typography>
          )}
          <Button
            variant="contained"
            color="primary"
            onClick={handleNext}
            disabled={!answeredQuestions.has(currentQuestion)}
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
          {/* 選擇使用者（與拼寫遊戲一致） */}
          <FormControl className={classes.formControl} fullWidth>
            <InputLabel><FormattedMessage {...messages.selectProfile} /></InputLabel>
            <Select
              value={selectedProfileId}
              onChange={e => setSelectedProfileId(e.target.value)}
            >
              {Array.isArray(profiles) && profiles.map(profile => (
                <MenuItem key={profile.id} value={profile.id}>
                  {profile.display_name || profile.name || `#${profile.id}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

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
          <FormControl className={classes.formControl} fullWidth style={{ marginTop: 16 }}>
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
            onClick={() => handleStartGame('matching', matchingGameType)}
            disabled={loading || !selectedProfileId}
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

    const pairs = gameData?.pairs || [];
    const options = gameData?.options || [];

    const handleImageSelect = (pairId) => {
      // Don't allow selection if already matched
      if (matchedPairs.includes(pairId)) return;
      
      // Don't allow selection if this image has failed matches with current option
      if (selectedOption) {
        const matchKey = `${pairId}-${selectedOption}`;
        if (failedMatches.has(matchKey)) {
          return; // This combination already failed, don't allow retry
        }
      }
      
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
      // Check if this option is already matched
      const isAlreadyMatched = matchedPairs.some(p => {
        const pair = pairs.find(pr => pr.id === p);
        if (!pair) return false;
        if (matchingGameType === 'word-picture') {
          return pair.title === option;
        } else if (matchingGameType === 'jyutping-picture') {
          return pair.jyutping === option;
        }
        return false;
      });
      if (isAlreadyMatched) return;
      
      // Don't allow selection if this option has failed matches with current image
      if (selectedImage) {
        const matchKey = `${selectedImage}-${option}`;
        if (failedMatches.has(matchKey)) {
          return; // This combination already failed, don't allow retry
        }
      }
      
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
      if (!pair) {
        setSelectedImage(null);
        setSelectedOption(null);
        return;
      }
      
      // Check if this combination was already attempted and failed
      const matchKey = `${pairId}-${option}`;
      if (failedMatches.has(matchKey)) {
        // Already failed, don't allow retry
        setSelectedImage(null);
        setSelectedOption(null);
        return;
      }
      
      // Check match based on game type
      let isMatch = false;
      if (matchingGameType === 'word-picture') {
        // Match word (title) with option - both should be the title
        isMatch = pair.title === option;
      } else if (matchingGameType === 'jyutping-picture') {
        // Match jyutping with option - option should be the jyutping code
        isMatch = pair.jyutping === option;
      }
      
      // Store match result for visual feedback
      setLastMatchResult({ pairId, option, isCorrect: isMatch });
      
      // Mark this pair as attempted (regardless of success or failure)
      const newAttemptedPairs = new Set([...attemptedPairs, pairId]);
      setAttemptedPairs(newAttemptedPairs);
      
      if (isMatch) {
        const newScore = score + 1;
        setScore(newScore);
        const newMatchedPairs = [...matchedPairs, pairId];
        setMatchedPairs(newMatchedPairs);
        
        // Remove from failed matches if it was there (shouldn't be, but just in case)
        const newFailedMatches = new Set(failedMatches);
        newFailedMatches.delete(matchKey);
        setFailedMatches(newFailedMatches);
        
        // Check if all pairs are matched
        if (newMatchedPairs.length >= pairs.length) {
          setTimeout(() => handleFinishGame(), 500);
        } else {
          // Also check if all pairs have been attempted (matched or failed)
          // This handles the case where some pairs failed to match
          if (newAttemptedPairs.size >= pairs.length) {
            setTimeout(() => handleFinishGame(), 500);
          }
        }
      } else {
        // Mark this combination as failed - prevent retry
        setFailedMatches(new Set([...failedMatches, matchKey]));
        
        // Check if all pairs have been attempted (matched or failed)
        // This handles the case where some pairs failed to match
        if (newAttemptedPairs.size >= pairs.length) {
          setTimeout(() => handleFinishGame(), 1500); // Wait for feedback to show
        } else {
          // Show incorrect feedback briefly
          setTimeout(() => {
            setLastMatchResult(null);
          }, 1500);
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
          {pairs.map((pair) => {
            // Check if this image has any failed matches
            const hasFailedMatches = Array.from(failedMatches).some(key => key.startsWith(`${pair.id}-`));
            const isDisabled = matchedPairs.includes(pair.id) || hasFailedMatches;
            
            return (
            <Card
              key={pair.id}
              className={classes.gameCard}
              style={{
                opacity: matchedPairs.includes(pair.id) ? 0.5 : (hasFailedMatches ? 0.7 : 1),
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                border: (() => {
                  if (matchedPairs.includes(pair.id)) {
                    return '3px solid #4caf50'; // Green for matched
                  }
                  if (lastMatchResult && lastMatchResult.pairId === pair.id) {
                    return lastMatchResult.isCorrect 
                      ? '3px solid #4caf50' // Green for correct
                      : '3px solid #f44336'; // Red for incorrect
                  }
                  if (selectedImage === pair.id) {
                    return '3px solid #1976d2'; // Blue for selected
                  }
                  if (hasFailedMatches) {
                    return '1px dashed #ccc'; // Dashed border for images with failed attempts
                  }
                  return '1px solid #ccc';
                })(),
                transition: 'border 0.3s ease, opacity 0.3s ease',
                pointerEvents: isDisabled ? 'none' : 'auto'
              }}
              onClick={() => !isDisabled && handleImageSelect(pair.id)}
            >
              <CardContent style={{ textAlign: 'center', padding: '8px' }}>
                <div style={{ position: 'relative', minHeight: '120px', width: '100%' }}>
                  {pair.image ? (
                    <img 
                      src={pair.image} 
                      alt={pair.title || ''} 
                      style={{ 
                        width: '100%', 
                        height: '120px', 
                        objectFit: 'contain',
                        display: 'block'
                      }}
                      onError={(e) => {
                        console.warn('Image failed to load:', pair.image);
                        e.target.style.display = 'none';
                        const fallback = e.target.parentElement.querySelector('.image-fallback');
                        if (fallback) {
                          fallback.style.display = 'flex';
                        }
                      }}
                      onLoad={() => {
                        // Hide fallback when image loads successfully
                        const fallback = document.querySelector(`.image-fallback[data-pair-id="${pair.id}"]`);
                        if (fallback) {
                          fallback.style.display = 'none';
                        }
                      }}
                    />
                  ) : null}
                  <Typography 
                    variant="body1" 
                    className="image-fallback"
                    data-pair-id={pair.id}
                    style={{ 
                      padding: '20px', 
                      minHeight: '120px', 
                      display: pair.image ? 'none' : 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      position: pair.image ? 'absolute' : 'relative',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      fontSize: '0.875rem',
                      wordBreak: 'break-word'
                    }}
                  >
                    {(() => {
                      // Resolve translation key to actual text for display
                      let displayTitle = pair.title || 'No Image';
                      if (pair.title && typeof pair.title === 'string' && intl && intl.messages) {
                        // Try multiple formats: lowercase, original case, with/without cboard prefix
                        const possibleKeys = [
                          pair.title.toLowerCase(),
                          pair.title,
                          `cboard.${pair.title.toLowerCase()}`,
                          `cboard.${pair.title}`,
                          pair.title.toLowerCase().replace(/^symbol\./, 'cboard.symbol.'),
                          pair.title.replace(/^SYMBOL\./, 'cboard.symbol.').toLowerCase(),
                          pair.title.replace(/^SYMBOL\./, 'cboard.symbol.')
                        ];
                        
                        for (const key of possibleKeys) {
                          if (intl.messages[key]) {
                            try {
                              displayTitle = intl.formatMessage({ id: key });
                              break; // Found translation, exit loop
                            } catch (e) {
                              // Continue to next key
                            }
                          }
                        }
                      }
                      return displayTitle;
                    })()}
                  </Typography>
                </div>
                {matchedPairs.includes(pair.id) && (
                  <Typography variant="body2" style={{ marginTop: '8px', color: '#4caf50' }}>
                    ✓
                  </Typography>
                )}
                {hasFailedMatches && !matchedPairs.includes(pair.id) && (
                  <Typography variant="body2" style={{ marginTop: '8px', color: '#999', fontSize: '0.75rem' }}>
                    ✗
                  </Typography>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>
        <div style={{ marginTop: '24px' }}>
          <Typography variant="h6" gutterBottom>
            <FormattedMessage {...messages.selectOption} />
          </Typography>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {options.map((option, index) => {
              // Check if this option is already matched
              const isMatched = matchedPairs.some(p => {
                const pair = pairs.find(pr => pr.id === p);
                if (!pair) return false;
                if (matchingGameType === 'word-picture') {
                  return pair.title === option;
                } else if (matchingGameType === 'jyutping-picture') {
                  return pair.jyutping === option;
                }
                return false;
              });
              // Resolve translation key to actual text
              // For jyutping-picture game, don't translate - show jyutping codes as-is
              let displayText = option;
              if (matchingGameType === 'jyutping-picture') {
                // For jyutping-picture, just show the jyutping code directly
                displayText = option;
              } else if (option && typeof option === 'string' && intl && intl.messages) {
                // Try multiple formats: lowercase, original case, with/without cboard prefix
                const possibleKeys = [
                  option.toLowerCase(),
                  option,
                  `cboard.${option.toLowerCase()}`,
                  `cboard.${option}`,
                  option.toLowerCase().replace(/^symbol\./, 'cboard.symbol.'),
                  option.replace(/^SYMBOL\./, 'cboard.symbol.').toLowerCase(),
                  option.replace(/^SYMBOL\./, 'cboard.symbol.')
                ];
                
                for (const key of possibleKeys) {
                  if (intl.messages[key]) {
                    try {
                      displayText = intl.formatMessage({ id: key });
                      break; // Found translation, exit loop
                    } catch (e) {
                      // Continue to next key
                    }
                  }
                }
              }
              
              // Check if this option was part of the last match attempt
              const isLastMatchOption = lastMatchResult && lastMatchResult.option === option;
              const showMatchFeedback = isLastMatchOption && lastMatchResult;
              
              // Check if this option has failed matches with any image
              const hasFailedMatches = Array.from(failedMatches).some(key => key.endsWith(`-${option}`));
              
              // Determine button styling based on match result
              let buttonStyle = { opacity: isMatched ? 0.5 : (hasFailedMatches ? 0.6 : 1), transition: 'all 0.3s ease' };
              let buttonVariant = selectedOption === option ? 'contained' : (isMatched ? 'outlined' : 'outlined');
              let buttonColor = selectedOption === option ? 'primary' : (isMatched ? 'default' : 'default');
              
              if (showMatchFeedback) {
                if (lastMatchResult.isCorrect) {
                  buttonStyle.backgroundColor = '#4caf50'; // Green
                  buttonStyle.color = '#fff';
                  buttonStyle.border = '2px solid #4caf50';
                  buttonVariant = 'contained';
                } else {
                  buttonStyle.backgroundColor = '#f44336'; // Red
                  buttonStyle.color = '#fff';
                  buttonStyle.border = '2px solid #f44336';
                  buttonVariant = 'contained';
                }
              } else if (isMatched) {
                buttonStyle.backgroundColor = '#4caf50'; // Green for already matched
                buttonStyle.color = '#fff';
                buttonStyle.border = '2px solid #4caf50';
                buttonVariant = 'contained';
              } else if (hasFailedMatches) {
                // Show visual indication that this option has failed matches
                buttonStyle.border = '1px dashed #ccc';
              }
              
              return (
                <Button
                  key={index}
                  variant={buttonVariant}
                  color={buttonColor}
                  className={classes.optionButton}
                  onClick={() => handleOptionSelect(option)}
                  disabled={isMatched || hasFailedMatches}
                  style={buttonStyle}
                  title={hasFailedMatches ? '此选项已尝试过，无法再次选择' : ''}
                >
                  {displayText}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderHistory = () => {
    const history = Array.isArray(gameHistory) ? gameHistory : [];

    const filteredHistory = history.filter(entry => {
      const typeOk =
        historyGameType === 'all' ||
        !entry.game_type ||
        entry.game_type === historyGameType;
      const diff = (entry.difficulty || 'medium').toLowerCase();
      const diffOk =
        historyDifficulty === 'all' || diff === historyDifficulty.toLowerCase();
      return typeOk && diffOk;
    });

    // Calculate statistics
    const calculateStats = () => {
      if (filteredHistory.length === 0) {
        return {
          totalGames: 0,
          averageAccuracy: 0,
          bestScore: 0,
          bestAccuracy: 0,
          totalTimeSpent: 0,
          byGameType: {}
        };
      }

      let totalAccuracy = 0;
      let bestScore = 0;
      let bestAccuracy = 0;
      let totalTimeSpent = 0;
      const byGameType = {};

      filteredHistory.forEach(entry => {
        const accuracy = typeof entry.accuracy === 'number' 
          ? entry.accuracy 
          : parseFloat(entry.accuracy) || 0;
        const score = entry.score || 0;
        const timeSpent = entry.time_spent || 0;

        totalAccuracy += accuracy;
        if (score > bestScore) bestScore = score;
        if (accuracy > bestAccuracy) bestAccuracy = accuracy;
        totalTimeSpent += timeSpent;

        const gameType = entry.game_type || 'unknown';
        if (!byGameType[gameType]) {
          byGameType[gameType] = {
            count: 0,
            totalAccuracy: 0,
            bestScore: 0,
            bestAccuracy: 0
          };
        }
        byGameType[gameType].count++;
        byGameType[gameType].totalAccuracy += accuracy;
        if (score > byGameType[gameType].bestScore) {
          byGameType[gameType].bestScore = score;
        }
        if (accuracy > byGameType[gameType].bestAccuracy) {
          byGameType[gameType].bestAccuracy = accuracy;
        }
      });

      const averageAccuracy = filteredHistory.length > 0 
        ? totalAccuracy / filteredHistory.length 
        : 0;

      // Calculate averages for each game type
      Object.keys(byGameType).forEach(type => {
        const stats = byGameType[type];
        stats.averageAccuracy = stats.count > 0 
          ? stats.totalAccuracy / stats.count 
          : 0;
      });

      return {
        totalGames: filteredHistory.length,
        averageAccuracy,
        bestScore,
        bestAccuracy,
        totalTimeSpent,
        byGameType
      };
    };

    const stats = calculateStats();

    return (
      <div className={classes.tabPanel}>
        <Typography variant="h5" gutterBottom>
          <FormattedMessage {...messages.historyTitle} />
        </Typography>

        {historyLoading ? (
          <div style={{ textAlign: 'center', padding: '16px' }}>
            <CircularProgress size={24} />
          </div>
        ) : history.length === 0 ? (
          <Typography variant="body1" color="textSecondary">
            <FormattedMessage {...messages.historyEmpty} />
          </Typography>
        ) : (
          <>
            {/* Statistics Section */}
            {stats.totalGames > 0 && (
              <>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: '16px', 
                  marginBottom: '24px',
                  marginTop: '16px'
                }}>
                  <Card className={classes.gameCard}>
                    <CardContent>
                      <Typography variant="h6" color="textSecondary" gutterBottom>
                        <FormattedMessage {...messages.statsTotalGames} />
                      </Typography>
                      <Typography variant="h4">
                        {stats.totalGames}
                      </Typography>
                    </CardContent>
                  </Card>

                  <Card className={classes.gameCard}>
                    <CardContent>
                      <Typography variant="h6" color="textSecondary" gutterBottom>
                        <FormattedMessage {...messages.statsAverageAccuracy} />
                      </Typography>
                      <Typography variant="h4">
                        {stats.averageAccuracy.toFixed(1)}%
                      </Typography>
                    </CardContent>
                  </Card>

                  <Card className={classes.gameCard}>
                    <CardContent>
                      <Typography variant="h6" color="textSecondary" gutterBottom>
                        <FormattedMessage {...messages.statsBestScore} />
                      </Typography>
                      <Typography variant="h4">
                        {stats.bestScore}
                      </Typography>
                    </CardContent>
                  </Card>

                  <Card className={classes.gameCard}>
                    <CardContent>
                      <Typography variant="h6" color="textSecondary" gutterBottom>
                        <FormattedMessage {...messages.statsBestAccuracy} />
                      </Typography>
                      <Typography variant="h4">
                        {stats.bestAccuracy.toFixed(1)}%
                      </Typography>
                    </CardContent>
                  </Card>

                  <Card className={classes.gameCard}>
                    <CardContent>
                      <Typography variant="h6" color="textSecondary" gutterBottom>
                        <FormattedMessage {...messages.statsTotalTime} />
                      </Typography>
                      <Typography variant="h4">
                        {stats.totalTimeSpent >= 3600
                          ? `${Math.floor(stats.totalTimeSpent / 3600)}h ${Math.floor((stats.totalTimeSpent % 3600) / 60)}m`
                          : stats.totalTimeSpent >= 60
                          ? `${Math.floor(stats.totalTimeSpent / 60)}m ${stats.totalTimeSpent % 60}s`
                          : `${stats.totalTimeSpent}s`}
                      </Typography>
                    </CardContent>
                  </Card>
                </div>

                {/* Statistics by Game Type */}
                {Object.keys(stats.byGameType).length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <Typography variant="h6" gutterBottom>
                      <FormattedMessage {...messages.statsByGameType} />
                    </Typography>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                      gap: '16px' 
                    }}>
                      {Object.keys(stats.byGameType).map(gameType => {
                        const typeStats = stats.byGameType[gameType];
                        let gameTypeLabel = gameType;
                        if (gameType === 'spelling') {
                          gameTypeLabel = intl.formatMessage(messages.spellingGame);
                        } else if (gameType === 'word-picture' || gameType === 'matching') {
                          gameTypeLabel = intl.formatMessage(messages.wordPicture);
                        } else if (gameType === 'jyutping-picture') {
                          gameTypeLabel = intl.formatMessage(messages.jyutpingPicture);
                        }

                        return (
                          <Card key={gameType} className={classes.gameCard}>
                            <CardContent>
                              <Typography variant="subtitle1" gutterBottom>
                                {gameTypeLabel}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                <FormattedMessage {...messages.statsGamesPlayed} />: {typeStats.count}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                <FormattedMessage {...messages.statsAverageAccuracy} />: {typeStats.averageAccuracy.toFixed(1)}%
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                <FormattedMessage {...messages.statsBestScore} />: {typeStats.bestScore}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                <FormattedMessage {...messages.statsBestAccuracy} />: {typeStats.bestAccuracy.toFixed(1)}%
                              </Typography>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            <div style={{ overflowX: 'auto', marginTop: '16px' }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              <FormControl style={{ minWidth: 160 }}>
                <InputLabel><FormattedMessage {...messages.historyFilterLabelGameType} /></InputLabel>
                <Select
                  value={historyGameType}
                  onChange={e => setHistoryGameType(e.target.value)}
                >
                  <MenuItem value="all">
                    <FormattedMessage {...messages.historyFilterAll} />
                  </MenuItem>
                  <MenuItem value="spelling">
                    <FormattedMessage {...messages.spellingGame} />
                  </MenuItem>
                  <MenuItem value="word-picture">
                    <FormattedMessage {...messages.wordPicture} />
                  </MenuItem>
                  <MenuItem value="jyutping-picture">
                    <FormattedMessage {...messages.jyutpingPicture} />
                  </MenuItem>
                </Select>
              </FormControl>

              <FormControl style={{ minWidth: 160 }}>
                <InputLabel><FormattedMessage {...messages.historyFilterLabelDifficulty} /></InputLabel>
                <Select
                  value={historyDifficulty}
                  onChange={e => setHistoryDifficulty(e.target.value)}
                >
                  <MenuItem value="all">
                    <FormattedMessage {...messages.historyFilterAll} />
                  </MenuItem>
                  <MenuItem value="easy">
                    <FormattedMessage {...messages.easy} />
                  </MenuItem>
                  <MenuItem value="medium">
                    <FormattedMessage {...messages.medium} />
                  </MenuItem>
                  <MenuItem value="hard">
                    <FormattedMessage {...messages.hard} />
                  </MenuItem>
                </Select>
              </FormControl>
            </div>

            <table className="LearningGames-history-table">
              <thead>
                <tr>
                  <th><FormattedMessage {...messages.historyPlayedAt} /></th>
                  <th><FormattedMessage {...messages.historyGameType} /></th>
                  <th><FormattedMessage {...messages.historyDifficulty} /></th>
                  <th><FormattedMessage {...messages.historyScore} /></th>
                  <th><FormattedMessage {...messages.historyAccuracy} /></th>
                  <th><FormattedMessage {...messages.historyTimeSpent} /></th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map(entry => {
                  const total = entry.total_questions || entry.totalPairs || 0;
                  const scoreText = total ? `${entry.score}/${total}` : entry.score;
                  const accuracyText =
                    typeof entry.accuracy === 'number'
                      ? `${entry.accuracy.toFixed(1)}%`
                      : `${entry.accuracy}%`;
                  const seconds = entry.time_spent || 0;
                  const timeText =
                    seconds >= 60
                      ? `${Math.floor(seconds / 60)}m ${seconds % 60}s`
                      : `${seconds}s`;
                  const dateText = entry.played_at
                    ? new Date(entry.played_at).toLocaleString()
                    : '';
                  let gameTypeLabel = entry.game_type || 'unknown';
                  if (gameTypeLabel === 'spelling') {
                    gameTypeLabel = intl.formatMessage(messages.spellingGame);
                  } else if (gameTypeLabel === 'word-picture' || gameTypeLabel === 'matching') {
                    gameTypeLabel = intl.formatMessage(messages.wordPicture);
                  } else if (gameTypeLabel === 'jyutping-picture') {
                    gameTypeLabel = intl.formatMessage(messages.jyutpingPicture);
                  }

                  return (
                    <tr key={entry.id}>
                      <td>{dateText}</td>
                      <td>{gameTypeLabel}</td>
                      <td>{entry.difficulty || 'medium'}</td>
                      <td>{scoreText}</td>
                      <td>{accuracyText}</td>
                      <td>{timeText}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
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
            <Tab label={<FormattedMessage {...messages.historyTab} />} />
          </Tabs>

          {activeTab === 0 && renderSpellingGame()}
          {activeTab === 1 && renderMatchingGame()}
          {activeTab === 2 && renderHistory()}
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

