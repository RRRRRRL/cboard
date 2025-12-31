import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Fab,
  Tooltip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  IconButton,
  Switch,
  FormControlLabel,
  AppBar,
  Toolbar
} from '@material-ui/core';
import {
  People,
  TrendingUp,
  Message,
  Assessment,
  School,
  ChildCare,
  Send,
  Edit,
  Settings,
  AccountTree,
  BarChart,
  ArrowBack
} from '@material-ui/icons';
import { injectIntl, intlShape } from 'react-intl';

import { getUser, isLogged } from '../../../../components/App/App.selectors';
import API from '../../../../api/api.js';
import messages from './ParentDashboard.messages';

const ParentDashboard = ({ intl, user, history }) => {
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [childProgress, setChildProgress] = useState({});
  const [learningObjectives, setLearningObjectives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  // Children Management
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');

  const [messageDialog, setMessageDialog] = useState(false);
  const [manageChildDialog, setManageChildDialog] = useState(false);
  const [newMessage, setNewMessage] = useState({
    teacher_id: '',
    subject: '',
    message: ''
  });
  const [stats, setStats] = useState({
    totalChildren: 0,
    averageProgress: 0,
    activeObjectives: 0,
    recentActivities: 0
  });

  // Child Settings Management
  const [childSettings, setChildSettings] = useState({
    notifications_enabled: true,
    language_preference: 'zh-HK',
    accessibility_features: {
      high_contrast: false,
      large_text: false,
      simplified_interface: false
    }
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load children
      const childrenResponse = await API.getParentChildren();
      if (childrenResponse.success) {
        const childrenList = childrenResponse.data.children || [];
        setChildren(childrenList);
        setStats(prev => ({ ...prev, totalChildren: childrenList.length }));

        // Load progress for each child
        const progressPromises = childrenList.map(async (child) => {
          try {
            const progressResponse = await API.getStudentProgress(child.id);
            return { childId: child.id, data: progressResponse.data };
          } catch (error) {
            console.error(`Failed to load progress for child ${child.id}:`, error);
            return { childId: child.id, data: null };
          }
        });

        const progressResults = await Promise.all(progressPromises);
        const progressMap = {};
        progressResults.forEach(result => {
          if (result.data) {
            progressMap[result.childId] = result.data;
          }
        });
        setChildProgress(progressMap);

        // Calculate overall stats
        calculateStats(childrenList, progressMap);
      }

    } catch (error) {
      console.error('Failed to load parent dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (childrenList, progressMap) => {
    let totalProgress = 0;
    let totalObjectives = 0;
    let activeObjectives = 0;

    childrenList.forEach(child => {
      const progress = progressMap[child.id];
      if (progress && progress.objectives) {
        progress.objectives.forEach(obj => {
          totalProgress += obj.progress_percentage || 0;
          totalObjectives++;
          if (obj.status === 'active') {
            activeObjectives++;
          }
        });
      }
    });

    const averageProgress = totalObjectives > 0 ? Math.round(totalProgress / totalObjectives) : 0;

    setStats(prev => ({
      ...prev,
      averageProgress,
      activeObjectives,
      recentActivities: childrenList.length * 3 // Rough estimate
    }));
  };

  const handleViewChildProgress = (child) => {
    setSelectedChild(child);
    history.push(`/parent/children/${child.id}/progress`);
  };

  const handleSendMessage = (teacherId, child) => {
    setSelectedChild(child);
    setNewMessage({
      teacher_id: teacherId,
      subject: '',
      message: ''
    });
    setMessageDialog(true);
  };

  const handleCloseMessageDialog = () => {
    setMessageDialog(false);
    setSelectedChild(null);
    setNewMessage({
      teacher_id: '',
      subject: '',
      message: ''
    });
  };

  const handleSendMessageSubmit = async () => {
    // This would need a messaging API endpoint
    // For now, we'll just close the dialog
    console.log('Sending message:', newMessage);
    handleCloseMessageDialog();
  };

  const getChildObjectives = (childId) => {
    const progress = childProgress[childId];
    return progress?.objectives || [];
  };

  const getChildGameResults = (childId) => {
    const progress = childProgress[childId];
    return progress?.game_results || [];
  };

  const getTeachersForChild = (childId) => {
    // This would need to be fetched from the API
    // For now, return sample teachers
    return [
      { id: 1, name: 'Ms. Chan', role: 'Class Teacher' },
      { id: 2, name: 'Mr. Wong', role: 'Speech Therapist' }
    ];
  };

  if (loading) {
    return <div>{intl.formatMessage(messages.loadingParentDashboard)}</div>;
  }

  // Children Management Functions
  const handleManageChild = (child) => {
    setSelectedChild(child);
    setManageChildDialog(true);
  };

  const handleCloseManageChild = () => {
    setManageChildDialog(false);
    setSelectedChild(null);
  };

  const handleBackToSettings = () => {
    history.push('/settings');
  };

  const filteredChildren = children.filter(child =>
    child.name?.toLowerCase().includes(search.toLowerCase()) ||
    child.email?.toLowerCase().includes(search.toLowerCase())
  );

  const paginatedChildren = filteredChildren.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box>
      {/* Navigation Bar */}
      <AppBar position="static" color="primary">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleBackToSettings}
            aria-label="back to settings"
          >
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" style={{ flexGrow: 1 }}>
            {intl.formatMessage(messages.parentDashboard)}
          </Typography>
          <IconButton color="inherit" aria-label="settings">
            <Settings />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box p={3}>

      {/* Tab Navigation */}
      <Paper style={{ marginBottom: '2rem' }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label={intl.formatMessage(messages.overview)} icon={<Assessment />} />
          <Tab label={intl.formatMessage(messages.childrenManagement)} icon={<ChildCare />} />
          <Tab label={intl.formatMessage(messages.progressReports)} icon={<BarChart />} />
          <Tab label={intl.formatMessage(messages.communication)} icon={<Message />} />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {activeTab === 0 && (
        /* Overview/Dashboard Tab */
        <>
          {/* Statistics Cards */}
          <Grid container spacing={3} style={{ marginBottom: '2rem' }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <People color="primary" style={{ marginRight: '0.5rem' }} />
                    <Typography variant="h6">
                      {intl.formatMessage(messages.myChildren)}
                    </Typography>
                  </Box>
                  <Typography variant="h4" color="primary">
                    {stats.totalChildren}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <TrendingUp color="secondary" style={{ marginRight: '0.5rem' }} />
                    <Typography variant="h6">
                      {intl.formatMessage(messages.averageProgress)}
                    </Typography>
                  </Box>
                  <Typography variant="h4" color="secondary">
                    {stats.averageProgress}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <School color="primary" style={{ marginRight: '0.5rem' }} />
                    <Typography variant="h6">
                      {intl.formatMessage(messages.activeObjectives)}
                    </Typography>
                  </Box>
                  <Typography variant="h4" color="primary">
                    {stats.activeObjectives}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Message color="secondary" style={{ marginRight: '0.5rem' }} />
                    <Typography variant="h6">
                      {intl.formatMessage(messages.recentActivities)}
                    </Typography>
                  </Box>
                  <Typography variant="h4" color="secondary">
                    {stats.recentActivities}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {intl.formatMessage(messages.last7Days)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            {/* My Children Overview */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">
                      {intl.formatMessage(messages.myChildren)}
                    </Typography>
                    <Button
                      size="small"
                      color="primary"
                      onClick={() => setActiveTab(1)}
                    >
                      {intl.formatMessage(messages.manageChildren)}
                    </Button>
                  </Box>
                  <List>
                    {children.slice(0, 5).map((child) => {
                      const objectives = getChildObjectives(child.id);
                      const recentObjective = objectives.length > 0 ? objectives[0] : null;
                      const teachers = getTeachersForChild(child.id);

                      return (
                        <ListItem key={child.id} button onClick={() => handleViewChildProgress(child)}>
                          <ListItemAvatar>
                            <Avatar>
                              {child.name ? child.name.charAt(0).toUpperCase() : 'C'}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center">
                                <Typography variant="body1" style={{ marginRight: '1rem' }}>
                                  {child.name}
                                </Typography>
                                <Chip
                                  label={`${child.relationship_type || 'Child'}`}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                              </Box>
                            }
                            secondary={
                              <Box mt={1}>
                                {recentObjective && (
                                  <Box mb={1}>
                                    <Typography variant="body2" color="textSecondary">
                                      {intl.formatMessage(messages.latestObjective)}: {recentObjective.title}
                                    </Typography>
                                    <Box display="flex" alignItems="center" mt={0.5}>
                                      <LinearProgress
                                        variant="determinate"
                                        value={recentObjective.progress_percentage || 0}
                                        style={{ flexGrow: 1, marginRight: '0.5rem', height: '4px' }}
                                      />
                                      <Typography variant="caption">
                                        {recentObjective.progress_percentage || 0}%
                                      </Typography>
                                    </Box>
                                  </Box>
                                )}
                                <Typography variant="body2" color="textSecondary">
                                  {teachers.length} {intl.formatMessage(messages.teachers)}
                                </Typography>
                              </Box>
                            }
                          />
                          <Box display="flex" flexDirection="column" gap={1}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewChildProgress(child);
                              }}
                            >
                              {intl.formatMessage(messages.viewProgress)}
                            </Button>
                            {teachers.length > 0 && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSendMessage(teachers[0].id, child);
                                }}
                              >
                                <Message fontSize="small" style={{ marginRight: '0.25rem' }} />
                                {intl.formatMessage(messages.messageTeacher)}
                              </Button>
                            )}
                          </Box>
                        </ListItem>
                      );
                    })}
                    {children.length === 0 && (
                      <ListItem>
                        <ListItemText
                          primary={intl.formatMessage(messages.noChildren)}
                          secondary={intl.formatMessage(messages.contactSchool)}
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>

            {/* Quick Actions */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {intl.formatMessage(messages.quickActions)}
                  </Typography>

                  <Box display="flex" flexDirection="column" gap={1}>
                    <Button
                      variant="outlined"
                      startIcon={<BarChart />}
                      onClick={() => setActiveTab(2)}
                      fullWidth
                    >
                      {intl.formatMessage(messages.viewDetailedReports)}
                    </Button>

                    <Button
                      variant="outlined"
                      startIcon={<Message />}
                      onClick={() => setActiveTab(3)}
                      fullWidth
                    >
                      {intl.formatMessage(messages.contactTeachers)}
                    </Button>

                    <Button
                      variant="outlined"
                      startIcon={<Settings />}
                      onClick={() => setActiveTab(1)}
                      fullWidth
                    >
                      {intl.formatMessage(messages.manageSettings)}
                    </Button>
                  </Box>

                  <Divider style={{ margin: '1rem 0' }} />

                  <Typography variant="subtitle2" gutterBottom>
                    {intl.formatMessage(messages.contactInformation)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {intl.formatMessage(messages.contactSchoolForHelp)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}

      {activeTab === 1 && (
        /* Children Management Tab */
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h5">
              {intl.formatMessage(messages.childrenManagement)}
            </Typography>
          </Box>

          {/* Search and Filters */}
          <Paper style={{ padding: '1rem', marginBottom: '1rem' }}>
            <TextField
              label={intl.formatMessage(messages.search)}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginRight: '1rem', minWidth: '300px' }}
            />
          </Paper>

          {/* Children Table */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{intl.formatMessage(messages.name)}</TableCell>
                  <TableCell>{intl.formatMessage(messages.class)}</TableCell>
                  <TableCell>{intl.formatMessage(messages.currentProgress)}</TableCell>
                  <TableCell>{intl.formatMessage(messages.teachers)}</TableCell>
                  <TableCell>{intl.formatMessage(messages.lastActivity)}</TableCell>
                  <TableCell>{intl.formatMessage(messages.actions)}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedChildren.map((child) => {
                  const objectives = getChildObjectives(child.id);
                  const teachers = getTeachersForChild(child.id);
                  const avgProgress = objectives.length > 0
                    ? Math.round(objectives.reduce((sum, obj) => sum + (obj.progress_percentage || 0), 0) / objectives.length)
                    : 0;

                  return (
                    <TableRow key={child.id}>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <Avatar style={{ marginRight: '0.5rem', width: 32, height: 32 }}>
                            {child.name ? child.name.charAt(0).toUpperCase() : 'C'}
                          </Avatar>
                          {child.name}
                        </Box>
                      </TableCell>
                      <TableCell>{child.class_name || '-'}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <Typography variant="body2" style={{ marginRight: '0.5rem' }}>
                            {avgProgress}%
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={avgProgress}
                            style={{ width: '60px', height: '6px' }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>{teachers.length}</TableCell>
                      <TableCell>{child.last_login ? new Date(child.last_login).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleViewChildProgress(child)}>
                          <Assessment />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleManageChild(child)}>
                          <Settings />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleSendMessage(teachers[0]?.id, child)}>
                          <Message />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {paginatedChildren.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      {intl.formatMessage(messages.noChildrenFound)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={filteredChildren.length}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 20, 50]}
            />
          </TableContainer>
        </Box>
      )}

      {activeTab === 2 && (
        /* Progress Reports Tab */
        <Box>
          <Typography variant="h5" gutterBottom>
            {intl.formatMessage(messages.progressReports)}
          </Typography>

          <Grid container spacing={3}>
            {children.map((child) => {
              const objectives = getChildObjectives(child.id);
              const gameResults = getChildGameResults(child.id);

              return (
                <Grid item xs={12} md={6} key={child.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {child.name} - {intl.formatMessage(messages.progressReport)}
                      </Typography>

                      {/* Learning Objectives Progress */}
                      <Typography variant="subtitle2" gutterBottom>
                        {intl.formatMessage(messages.learningObjectives)}
                      </Typography>
                      {objectives.length > 0 ? (
                        <Box mb={2}>
                          {objectives.map((obj, index) => (
                            <Box key={index} mb={1}>
                              <Typography variant="body2">{obj.title}</Typography>
                              <LinearProgress
                                variant="determinate"
                                value={obj.progress_percentage || 0}
                                style={{ height: '8px', borderRadius: '4px' }}
                              />
                              <Typography variant="caption" color="textSecondary">
                                {obj.progress_percentage || 0}% - {obj.status}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          {intl.formatMessage(messages.noObjectivesYet)}
                        </Typography>
                      )}

                      {/* Game Results */}
                      <Typography variant="subtitle2" gutterBottom>
                        {intl.formatMessage(messages.recentGames)}
                      </Typography>
                      {gameResults.length > 0 ? (
                        gameResults.slice(0, 3).map((game, index) => (
                          <Box key={index} display="flex" justifyContent="space-between" mb={0.5}>
                            <Typography variant="body2">{game.game_type}</Typography>
                            <Typography variant="body2" color="primary">
                              {game.score} {intl.formatMessage(messages.points)}
                            </Typography>
                          </Box>
                        ))
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          {intl.formatMessage(messages.noGamesPlayed)}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}

      {activeTab === 3 && (
        /* Communication Tab */
        <Box>
          <Typography variant="h5" gutterBottom>
            {intl.formatMessage(messages.communication)}
          </Typography>

          <Grid container spacing={3}>
            {children.map((child) => {
              const teachers = getTeachersForChild(child.id);

              return (
                <Grid item xs={12} md={6} key={child.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {intl.formatMessage(messages.contactFor)} {child.name}
                      </Typography>

                      {teachers.map((teacher, index) => (
                        <Box key={index} display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                          <Box>
                            <Typography variant="body1">{teacher.name}</Typography>
                            <Typography variant="body2" color="textSecondary">
                              {teacher.role}
                            </Typography>
                          </Box>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Message />}
                            onClick={() => handleSendMessage(teacher.id, child)}
                          >
                            {intl.formatMessage(messages.contact)}
                          </Button>
                        </Box>
                      ))}

                      {teachers.length === 0 && (
                        <Typography variant="body2" color="textSecondary">
                          {intl.formatMessage(messages.noTeachersAssigned)}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}

      {/* Manage Child Settings Dialog */}
      <Dialog
        open={manageChildDialog}
        onClose={handleCloseManageChild}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {intl.formatMessage(messages.manageSettingsFor)} {selectedChild?.name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom style={{ marginBottom: '1rem' }}>
            {intl.formatMessage(messages.adjustChildSettings)}
          </Typography>

          <Box mb={3}>
            <Typography variant="subtitle2" gutterBottom>
              {intl.formatMessage(messages.notifications)}
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={childSettings.notifications_enabled}
                  onChange={(e) => setChildSettings({ ...childSettings, notifications_enabled: e.target.checked })}
                  color="primary"
                />
              }
              label={intl.formatMessage(messages.enableNotifications)}
            />
          </Box>

          <Box mb={3}>
            <Typography variant="subtitle2" gutterBottom>
              {intl.formatMessage(messages.languagePreferences)}
            </Typography>
            <TextField
              select
              fullWidth
              label={intl.formatMessage(messages.preferredLanguage)}
              value={childSettings.language_preference}
              onChange={(e) => setChildSettings({ ...childSettings, language_preference: e.target.value })}
            >
              <MenuItem value="zh-HK">
                {intl.formatMessage(messages.traditionalChinese)}
              </MenuItem>
              <MenuItem value="zh-CN">
                {intl.formatMessage(messages.simplifiedChinese)}
              </MenuItem>
              <MenuItem value="en">
                {intl.formatMessage(messages.english)}
              </MenuItem>
            </TextField>
          </Box>

          <Box mb={3}>
            <Typography variant="subtitle2" gutterBottom>
              {intl.formatMessage(messages.accessibilityFeatures)}
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={childSettings.accessibility_features.high_contrast}
                  onChange={(e) => setChildSettings({
                    ...childSettings,
                    accessibility_features: {
                      ...childSettings.accessibility_features,
                      high_contrast: e.target.checked
                    }
                  })}
                  color="primary"
                />
              }
              label={intl.formatMessage(messages.highContrastMode)}
            />
            <br />
            <FormControlLabel
              control={
                <Switch
                  checked={childSettings.accessibility_features.large_text}
                  onChange={(e) => setChildSettings({
                    ...childSettings,
                    accessibility_features: {
                      ...childSettings.accessibility_features,
                      large_text: e.target.checked
                    }
                  })}
                  color="primary"
                />
              }
              label={intl.formatMessage(messages.largeText)}
            />
            <br />
            <FormControlLabel
              control={
                <Switch
                  checked={childSettings.accessibility_features.simplified_interface}
                  onChange={(e) => setChildSettings({
                    ...childSettings,
                    accessibility_features: {
                      ...childSettings.accessibility_features,
                      simplified_interface: e.target.checked
                    }
                  })}
                  color="primary"
                />
              }
              label={intl.formatMessage(messages.simplifiedInterface)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseManageChild}>
            {intl.formatMessage(messages.cancel)}
          </Button>
          <Button
            onClick={() => {
              // Save child settings
              console.log('Saving child settings:', childSettings);
              handleCloseManageChild();
            }}
            color="primary"
            variant="contained"
          >
            {intl.formatMessage(messages.saveSettings)}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Send Message Dialog */}
      <Dialog
        open={messageDialog}
        onClose={handleCloseMessageDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {intl.formatMessage(messages.sendMessageToTeacher)}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            {intl.formatMessage(messages.regarding)} {selectedChild?.name}
          </Typography>

          <TextField
            autoFocus
            margin="dense"
            label={intl.formatMessage(messages.subject)}
            fullWidth
            value={newMessage.subject}
            onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
          />
          <TextField
            margin="dense"
            label={intl.formatMessage(messages.message)}
            fullWidth
            multiline
            rows={4}
            value={newMessage.message}
            onChange={(e) => setNewMessage({ ...newMessage, message: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMessageDialog}>
            {intl.formatMessage(messages.cancel)}
          </Button>
          <Button
            onClick={handleSendMessageSubmit}
            color="primary"
            variant="contained"
            startIcon={<Send />}
          >
            {intl.formatMessage(messages.sendMessage)}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Tooltip title={intl.formatMessage(messages.contactTeacher)}>
        <Fab
          color="primary"
          style={{ position: 'fixed', bottom: '2rem', right: '2rem' }}
          onClick={() => children.length > 0 && handleSendMessage('', children[0])}
        >
          <Message />
        </Fab>
      </Tooltip>
      </Box>
    </Box>
  );
};

ParentDashboard.propTypes = {
  intl: intlShape.isRequired,
  user: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired
};

const mapStateToProps = state => ({
  user: getUser(state)
});

export default connect(mapStateToProps)(
  injectIntl(withRouter(ParentDashboard))
);
