import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, intlShape } from 'react-intl';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import CircularProgress from '@material-ui/core/CircularProgress';
import FullScreenDialog from '../../UI/FullScreenDialog';
import messages from './DataRetention.messages';
import './DataRetention.css';

const styles = theme => ({
  tabPanel: {
    padding: theme.spacing(3)
  },
  formControl: {
    margin: theme.spacing(2),
    minWidth: 250
  },
  section: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2)
  },
  description: {
    marginBottom: theme.spacing(2),
    color: theme.palette.text.secondary
  },
  buttonGroup: {
    marginTop: theme.spacing(3),
    display: 'flex',
    gap: theme.spacing(2)
  },
  statsSection: {
    marginTop: theme.spacing(3),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.grey[100]
  }
});

// Retention period options (in days)
const RETENTION_OPTIONS = [
  { value: 0, label: 'Never delete' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '180 days (6 months)' },
  { value: 365, label: '365 days (1 year)' },
  { value: 730, label: '730 days (2 years)' }
];

function DataRetention({
  onClose,
  loading,
  settings,
  cleanupStats,
  onLoadSettings,
  onSaveSettings,
  onRunCleanup,
  classes,
  intl
}) {
  const [actionLogsRetention, setActionLogsRetention] = useState(365);
  const [learningLogsRetention, setLearningLogsRetention] = useState(365);
  const [ocrHistoryRetention, setOcrHistoryRetention] = useState(90);
  const [cleanupRunning, setCleanupRunning] = useState(false);

  useEffect(() => {
    if (onLoadSettings) {
      onLoadSettings();
    }
  }, [onLoadSettings]);

  useEffect(() => {
    if (settings) {
      // Convert null (never delete) to 0 for the select component
      setActionLogsRetention(settings.action_logs_retention_days === null ? 0 : (settings.action_logs_retention_days || 365));
      setLearningLogsRetention(settings.learning_logs_retention_days === null ? 0 : (settings.learning_logs_retention_days || 365));
      setOcrHistoryRetention(settings.ocr_history_retention_days === null ? 0 : (settings.ocr_history_retention_days || 90));
    }
  }, [settings]);

  const handleSave = async () => {
    // Convert 0 (never delete) to null for the API
    const newSettings = {
      action_logs_retention_days: actionLogsRetention === 0 ? null : actionLogsRetention,
      learning_logs_retention_days: learningLogsRetention === 0 ? null : learningLogsRetention,
      ocr_history_retention_days: ocrHistoryRetention === 0 ? null : ocrHistoryRetention
    };
    await onSaveSettings(newSettings);
  };

  const handleCleanup = async () => {
    setCleanupRunning(true);
    try {
      await onRunCleanup();
    } finally {
      setCleanupRunning(false);
    }
  };

  const getRetentionLabel = (days) => {
    if (days === null || days === 0) {
      return intl.formatMessage(messages.never);
    }
    const option = RETENTION_OPTIONS.find(opt => opt.value === days);
    return option ? option.label : `${days} ${intl.formatMessage(messages.days)}`;
  };

  return (
    <FullScreenDialog
      open
      title={<FormattedMessage {...messages.dataRetention} />}
      onClose={onClose}
    >
      <div className="DataRetention">
        <Paper className={classes.tabPanel}>
          <Typography variant="body1" className={classes.description}>
            <FormattedMessage {...messages.description} />
          </Typography>

          {settings && (
            <Paper className={classes.section}>
              <Typography variant="h6" gutterBottom>
                <FormattedMessage {...messages.currentSettings} />
              </Typography>
              <Typography variant="body2">
                <FormattedMessage {...messages.actionLogsRetention} />: {getRetentionLabel(settings.action_logs_retention_days ?? 365)}
              </Typography>
              <Typography variant="body2">
                <FormattedMessage {...messages.learningLogsRetention} />: {getRetentionLabel(settings.learning_logs_retention_days ?? 365)}
              </Typography>
              <Typography variant="body2">
                <FormattedMessage {...messages.ocrHistoryRetention} />: {getRetentionLabel(settings.ocr_history_retention_days ?? 90)}
              </Typography>
            </Paper>
          )}

          <Paper className={classes.section}>
            <Typography variant="h6" gutterBottom>
              <FormattedMessage {...messages.dataRetention} />
            </Typography>

            <FormControl className={classes.formControl} fullWidth>
              <InputLabel><FormattedMessage {...messages.actionLogsRetention} /></InputLabel>
              <Select
                value={actionLogsRetention}
                onChange={e => setActionLogsRetention(e.target.value)}
              >
                {RETENTION_OPTIONS.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl className={classes.formControl} fullWidth>
              <InputLabel><FormattedMessage {...messages.learningLogsRetention} /></InputLabel>
              <Select
                value={learningLogsRetention}
                onChange={e => setLearningLogsRetention(e.target.value)}
              >
                {RETENTION_OPTIONS.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl className={classes.formControl} fullWidth>
              <InputLabel><FormattedMessage {...messages.ocrHistoryRetention} /></InputLabel>
              <Select
                value={ocrHistoryRetention}
                onChange={e => setOcrHistoryRetention(e.target.value)}
              >
                {RETENTION_OPTIONS.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <div className={classes.buttonGroup}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : <FormattedMessage {...messages.save} />}
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={handleCleanup}
                disabled={cleanupRunning || loading}
              >
                {cleanupRunning ? <CircularProgress size={24} /> : <FormattedMessage {...messages.manualCleanup} />}
              </Button>
            </div>
          </Paper>

          {cleanupStats && (
            <Paper className={classes.statsSection}>
              <Typography variant="h6" gutterBottom>
                <FormattedMessage {...messages.cleanupStats} />
              </Typography>
              <Typography variant="body2">
                <FormattedMessage {...messages.deletedActionLogs} />: {cleanupStats.action_logs_deleted || 0}
              </Typography>
              <Typography variant="body2">
                <FormattedMessage {...messages.deletedLearningLogs} />: {cleanupStats.learning_logs_deleted || 0}
              </Typography>
              <Typography variant="body2">
                <FormattedMessage {...messages.deletedOcrHistory} />: {cleanupStats.ocr_history_deleted || 0}
              </Typography>
            </Paper>
          )}
        </Paper>
      </div>
    </FullScreenDialog>
  );
}

DataRetention.propTypes = {
  onClose: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  settings: PropTypes.object,
  cleanupStats: PropTypes.object,
  onLoadSettings: PropTypes.func.isRequired,
  onSaveSettings: PropTypes.func.isRequired,
  onRunCleanup: PropTypes.func.isRequired,
  classes: PropTypes.object.isRequired,
  intl: intlShape.isRequired
};

export default withStyles(styles)(DataRetention);

