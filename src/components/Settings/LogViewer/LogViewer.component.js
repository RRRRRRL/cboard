import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, intlShape } from 'react-intl';
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import CircularProgress from '@material-ui/core/CircularProgress';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import FullScreenDialog from '../../UI/FullScreenDialog';
import messages from './LogViewer.messages';
import './LogViewer.css';

const styles = theme => ({
  formControl: {
    margin: theme.spacing(1),
    minWidth: 200
  },
  tableContainer: {
    maxHeight: 400,
    marginTop: theme.spacing(2)
  },
  filterSection: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2)
  },
  exportButton: {
    marginLeft: theme.spacing(1)
  }
});

function LogViewer({
  onClose,
  profiles,
  logs,
  loading,
  onLoadLogs,
  onExportLogs,
  userData,
  classes,
  intl
}) {
  const [selectedProfile, setSelectedProfile] = useState('');
  const [actionType, setActionType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Get user creation date - minimum date for start date
  const getUserCreationDate = () => {
    if (userData && userData.createdAt) {
      const date = new Date(userData.createdAt);
      return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    }
    // If no creation date, use a reasonable default (e.g., 1 year ago)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return oneYearAgo.toISOString().split('T')[0];
  };
  
  // Get today's date - maximum date for end date
  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };
  
  const minStartDate = getUserCreationDate();
  const maxEndDate = getTodayDate();
  const minEndDate = startDate || minStartDate; // End date must be >= start date

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLogs = () => {
    const filters = {};
    if (selectedProfile) filters.profile_id = selectedProfile;
    if (actionType) filters.action_type = actionType;
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;
    
    onLoadLogs(filters);
  };

  const handleExport = async () => {
    const filters = {};
    if (selectedProfile) filters.profile_id = selectedProfile;
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;
    
    try {
      await onExportLogs(filters);
    } catch (error) {
      console.error('Export error:', error);
      alert(intl.formatMessage(messages.exportError));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const translateActionType = (actionType) => {
    if (!actionType) return '-';
    const actionKey = `actionType.${actionType}`;
    if (messages[actionKey]) {
      return intl.formatMessage(messages[actionKey]);
    }
    // Fallback: format the action type nicely
    return actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <FullScreenDialog
      open
      title={<FormattedMessage {...messages.logViewer} />}
      onClose={onClose}
    >
      <div className="LogViewer">
        {/* Filters */}
        <Paper className={classes.filterSection}>
          <Typography variant="h6" gutterBottom>
            <FormattedMessage {...messages.filters} />
          </Typography>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
            <FormControl className={classes.formControl}>
              <InputLabel>
                <FormattedMessage {...messages.profile} />
              </InputLabel>
              <Select
                value={selectedProfile}
                onChange={e => setSelectedProfile(e.target.value)}
              >
                <MenuItem value="">
                  <FormattedMessage {...messages.allProfiles} />
                </MenuItem>
                {profiles.map(profile => (
                  <MenuItem key={profile.id} value={profile.id}>
                    {profile.name || profile.display_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl className={classes.formControl}>
              <InputLabel>
                <FormattedMessage {...messages.actionType} />
              </InputLabel>
              <Select
                value={actionType}
                onChange={e => setActionType(e.target.value)}
              >
                <MenuItem value="">
                  <FormattedMessage {...messages.allActions} />
                </MenuItem>
                <MenuItem value="card_click">
                  <FormattedMessage {...messages['actionType.card_click']} />
                </MenuItem>
                <MenuItem value="sentence_compose">
                  <FormattedMessage {...messages['actionType.sentence_compose']} />
                </MenuItem>
                <MenuItem value="scan_start">
                  <FormattedMessage {...messages['actionType.scan_start']} />
                </MenuItem>
                <MenuItem value="scan_select">
                  <FormattedMessage {...messages['actionType.scan_select']} />
                </MenuItem>
                <MenuItem value="game_completed">
                  <FormattedMessage {...messages['actionType.game_completed']} />
                </MenuItem>
                <MenuItem value="device_register">
                  <FormattedMessage {...messages['actionType.device_register']} />
                </MenuItem>
                <MenuItem value="eyetracking_select">
                  <FormattedMessage {...messages['actionType.eyetracking_select']} />
                </MenuItem>
                <MenuItem value="profile_create">
                  <FormattedMessage {...messages['actionType.profile_create']} />
                </MenuItem>
                <MenuItem value="profile_update">
                  <FormattedMessage {...messages['actionType.profile_update']} />
                </MenuItem>
                <MenuItem value="card_create">
                  <FormattedMessage {...messages['actionType.card_create']} />
                </MenuItem>
                <MenuItem value="card_update">
                  <FormattedMessage {...messages['actionType.card_update']} />
                </MenuItem>
              </Select>
            </FormControl>

            <TextField
              label={<FormattedMessage {...messages.startDate} />}
              type="date"
              value={startDate}
              onChange={e => {
                const newStartDate = e.target.value;
                setStartDate(newStartDate);
                // If end date is before new start date, reset end date
                if (endDate && newStartDate && endDate < newStartDate) {
                  setEndDate('');
                }
              }}
              InputLabelProps={{ shrink: true }}
              inputProps={{
                min: minStartDate,
                max: maxEndDate
              }}
              className={classes.formControl}
            />

            <TextField
              label={<FormattedMessage {...messages.endDate} />}
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{
                min: minEndDate,
                max: maxEndDate
              }}
              className={classes.formControl}
            />

            <Button
              variant="contained"
              color="primary"
              onClick={loadLogs}
              disabled={loading}
            >
              {loading ? (
                <CircularProgress size={24} />
              ) : (
                <FormattedMessage {...messages.applyFilters} />
              )}
            </Button>

            <Button
              variant="outlined"
              color="primary"
              onClick={handleExport}
              disabled={loading}
              className={classes.exportButton}
            >
              <FormattedMessage {...messages.export} />
            </Button>
          </div>
        </Paper>

        {/* Logs Table */}
        <Paper>
          <TableContainer className={classes.tableContainer}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell><FormattedMessage {...messages.dateTime} /></TableCell>
                  <TableCell><FormattedMessage {...messages.actionType} /></TableCell>
                  <TableCell><FormattedMessage {...messages.profileName} /></TableCell>
                  <TableCell><FormattedMessage {...messages.cardTitle} /></TableCell>
                  <TableCell><FormattedMessage {...messages.createdAt} /></TableCell>
                  <TableCell><FormattedMessage {...messages.updatedAt} /></TableCell>
                  <TableCell><FormattedMessage {...messages.sentence} /></TableCell>
                  <TableCell><FormattedMessage {...messages.device} /></TableCell>
                  <TableCell><FormattedMessage {...messages.score} /></TableCell>
                  <TableCell><FormattedMessage {...messages.gameType} /></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : logs && logs.length > 0 ? (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatDate(log.created_at)}</TableCell>
                      <TableCell>{translateActionType(log.action_type)}</TableCell>
                      <TableCell>{log.profile_name || '-'}</TableCell>
                      <TableCell>{log.card_title || '-'}</TableCell>
                      <TableCell>
                        {log.profile_created_at || log.card_created_at 
                          ? formatDate(log.profile_created_at || log.card_created_at)
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {log.profile_updated_at || log.card_updated_at 
                          ? formatDate(log.profile_updated_at || log.card_updated_at)
                          : '-'}
                      </TableCell>
                      <TableCell>{log.sentence || '-'}</TableCell>
                      <TableCell>{log.device || '-'}</TableCell>
                      <TableCell>
                        {log.score !== null && log.score !== undefined 
                          ? (log.total_questions ? `${log.score}/${log.total_questions}` : log.score)
                          : '-'}
                      </TableCell>
                      <TableCell>{log.game_type || '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      <FormattedMessage {...messages.noLogs} />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </div>
    </FullScreenDialog>
  );
}

LogViewer.propTypes = {
  onClose: PropTypes.func.isRequired,
  profiles: PropTypes.array.isRequired,
  logs: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
  onLoadLogs: PropTypes.func.isRequired,
  onExportLogs: PropTypes.func.isRequired,
  userData: PropTypes.object,
  classes: PropTypes.object.isRequired,
  intl: intlShape.isRequired
};

LogViewer.defaultProps = {
  userData: {}
};

export default withStyles(styles)(LogViewer);

