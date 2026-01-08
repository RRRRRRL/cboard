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
  ListItemSecondaryAction,
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
  TablePagination,
  Paper,
  Tabs,
  Tab,
  IconButton,
  Switch,
  FormControlLabel,
  AppBar,
  Toolbar,
  MenuItem
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
  Delete,
  Settings,
  AccountTree,
  BarChart,
  ArrowBack
} from '@material-ui/icons';
import { injectIntl, intlShape } from 'react-intl';

import { getUser, isLogged } from '../../../../components/App/App.selectors';
import API from '../../../../api/api.js';
import messages from './ParentDashboard.messages';

const ParentDashboard = ({ intl, user, history, match }) => {
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [childProgress, setChildProgress] = useState({});
  const [learningObjectives, setLearningObjectives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  // Check if we're viewing a specific child's progress page
  const childIdFromRoute = match?.params?.childId;
  const isChildProgressView = Boolean(childIdFromRoute);

  // Children Management
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');

  const [messageDialog, setMessageDialog] = useState(false);
  const [manageChildDialog, setManageChildDialog] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageConversation, setMessageConversation] = useState([]);
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

  // Communication data
  const [availableTeachers, setAvailableTeachers] = useState([]);
  const [parentMessages, setParentMessages] = useState([]);
  const [expandedThreads, setExpandedThreads] = useState(new Set());

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
    // Check if user has parent role before loading data
    if (user && user.role === 'parent') {
      loadDashboardData();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Handle child progress view initialization
  useEffect(() => {
    if (isChildProgressView && childIdFromRoute && children.length > 0) {
      const child = children.find(c => c.id == childIdFromRoute);
      if (child) {
        setSelectedChild(child);
        setActiveTab(2); // Switch to progress reports tab
      }
    }
  }, [isChildProgressView, childIdFromRoute, children]);

  // Debug logging for communication tab
  useEffect(() => {
    if (activeTab === 3) {
      
    }
  }, [activeTab, parentMessages, availableTeachers]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load children and teachers/messages in parallel
      const [childrenResponse, messagesResponse] = await Promise.all([
        API.getParentChildren(),
        API.getParentMessages().catch(err => {
          console.warn('Failed to load messages, continuing without:', err);
          return { success: true, data: { messages: [], teachers: [] } };
        })
      ]);

      // Load children
      if (childrenResponse.success) {
        const childrenList = childrenResponse.data.children || [];
        setChildren(childrenList);
        setStats(prev => ({ ...prev, totalChildren: childrenList.length }));

        // Load progress for each child
        const progressPromises = childrenList.map(async (child) => {
          try {
            const progressResponse = await API.getParentChildProgress(child.id);
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

      // Load teachers and messages
      if (messagesResponse.success) {
        const teachers = messagesResponse.data.teachers || [];
        const messages = messagesResponse.data.messages || [];
        setAvailableTeachers(teachers);
        setParentMessages(messages);
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

  const handleReplyToMessage = (message) => {
    // Set up conversation view with the selected message
    setSelectedMessage(message);
    setMessageDialog(true);
    // Load the full conversation thread
    loadMessageConversation(message);

    // Pre-fill the message with recipient information for reply
    setNewMessage({
      teacher_id: message.sender_user_id, // Reply to the sender
      subject: message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`,
      message: ''
    });
  };

  const handleDeleteMessage = async (message) => {
    if (window.confirm(intl.formatMessage(messages.deleteMessageConfirm))) {
      try {
        // Call delete API - we'll need to implement this in the backend
        // For now, just remove from local state
        setParentMessages(prev => prev.filter(m => m.id !== message.id));
        alert('Message deleted successfully!');
        // Refresh messages to show updated data
        loadDashboardData();
      } catch (error) {
        console.error('Failed to delete message:', error);
        alert('Failed to delete message. Please try again.');
      }
    }
  };

  const loadMessageConversation = async (message) => {
    try {
      // Get all messages in this conversation thread using parent_message_id chain
      const response = await API.getParentMessages();
      if (response.success && response.data && response.data.messages) {
        // Build conversation thread by following parent_message_id chain
        const allMessages = response.data.messages;
        const conversationMessages = [];

        // Find the root message (original message with no parent_message_id)
        let rootMessage = message;
        while (rootMessage.parent_message_id) {
          const parentMsg = allMessages.find(m => m.id === rootMessage.parent_message_id);
          if (!parentMsg) break;
          rootMessage = parentMsg;
        }

        // Collect all messages in this conversation thread
        const collectThread = (msgId) => {
          const msg = allMessages.find(m => m.id === msgId);
          if (msg) {
            conversationMessages.push(msg);
            // Find all replies to this message
            const replies = allMessages.filter(m => m.parent_message_id === msgId);
            replies.forEach(reply => collectThread(reply.id));
          }
        };

        collectThread(rootMessage.id);

        // Sort by creation date
        conversationMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        setMessageConversation(conversationMessages);
      }
    } catch (error) {
      console.error('Failed to load message conversation:', error);
      setMessageConversation([message]); // Fallback to just the original message
    }
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
    if (!newMessage.teacher_id || !newMessage.subject.trim() || !newMessage.message.trim()) {
      alert(intl.formatMessage(messages.messageRequired));
      return;
    }

    try {
      const messageData = {
        recipient_id: newMessage.teacher_id,
        subject: newMessage.subject,
        message: newMessage.message,
        student_id: selectedChild?.id
      };

      const response = await API.sendParentMessage(messageData);
      if (response.success) {
        alert(intl.formatMessage(messages.messageSent));
        handleCloseMessageDialog();
        // Refresh messages after sending
        loadDashboardData();
      } else {
        alert(intl.formatMessage(messages.sendFailed));
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert(intl.formatMessage(messages.sendFailed));
    }
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
    // Return real teachers from API, filtered by child's relationships if possible
    if (availableTeachers && availableTeachers.length > 0) {
      // For now, return all available teachers since we don't have specific child-teacher mappings
      // In a more advanced implementation, we could filter by which teachers are assigned to this specific child
      return availableTeachers.map(teacher => ({
        id: teacher.id,
        name: teacher.name,
        role: teacher.class_name ? `${teacher.class_name} Teacher` : 'Teacher'
      }));
    }

    // Fallback to sample data if no teachers loaded
    return [
      { id: 1, name: 'No teachers available', role: 'Please check database setup' }
    ];
  };

  // Children Management Functions
  const handleManageChild = (child) => {
    setSelectedChild(child);
    setManageChildDialog(true);
  };

  const handleCloseManageChild = () => {
    setManageChildDialog(false);
    setSelectedChild(null);
  };

  const handleBackToDashboard = () => {
    if (isChildProgressView) {
      // Go back to parent dashboard overview
      history.push('/parent/dashboard');
    } else {
      // Go back to settings
      history.push('/settings');
    }
  };



  // Check if user has parent role
  if (!user || user.role !== 'parent') {
    return (
      <Box p={3}>
        <Typography variant="h6" color="error">
          {intl.formatMessage(messages.accessDenied)}
        </Typography>
        <Typography variant="body1">
          {intl.formatMessage(messages.parentRoleRequired)}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => history.push('/settings')}
          style={{ marginTop: '1rem' }}
        >
          {intl.formatMessage(messages.backToSettings)}
        </Button>
      </Box>
    );
  }

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
            onClick={handleBackToDashboard}
            aria-label={isChildProgressView ? "back to dashboard" : "back to settings"}
          >
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" style={{ flexGrow: 1 }}>
            {isChildProgressView && selectedChild
              ? `${selectedChild.name} - ${intl.formatMessage(messages.progressReport)}`
              : intl.formatMessage(messages.parentDashboard)
            }
          </Typography>
          <IconButton color="inherit" aria-label="settings">
            <Settings />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box p={3}>

        {/* Tab Navigation - Hide when viewing specific child progress */}
        {!isChildProgressView && (
          <Paper style={{ marginBottom: '2rem' }}>
            <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
              <Tab label={intl.formatMessage(messages.overview)} icon={<Assessment />} />
              <Tab label={intl.formatMessage(messages.childrenManagement)} icon={<ChildCare />} />
              <Tab label={intl.formatMessage(messages.progressReports)} icon={<BarChart />} />
              <Tab label={intl.formatMessage(messages.communication)} icon={<Message />} />
            </Tabs>
          </Paper>
        )}

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
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h5">
                {intl.formatMessage(messages.progressReports)}
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<BarChart />}
                onClick={async () => {
                  if (children.length === 0) return;

                  // Generate reports for all children
                  try {
                    const reportPromises = children.map(async (child) => {
                      const reportData = {
                        student_user_id: child.id,
                        report_type: 'monthly',
                        period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
                        period_end: new Date().toISOString().split('T')[0] // Today
                      };
                      return await API.generateProgressReport(reportData);
                    });

                    const results = await Promise.all(reportPromises);
                    const successCount = results.filter(r => r.success).length;

                    alert(`${successCount} ${intl.formatMessage(messages.reportsGenerated)}`);
                  } catch (error) {
                    console.error('Failed to generate reports:', error);
                    alert(intl.formatMessage(messages.reportGenerationFailed));
                  }
                }}
              >
                {intl.formatMessage(messages.generateReports)}
              </Button>
            </Box>

            <Grid container spacing={3}>
              {(isChildProgressView ? [selectedChild] : children).filter(Boolean).map((child) => {
                const objectives = getChildObjectives(child.id);
                const gameResults = getChildGameResults(child.id);

                return (
                  <Grid item xs={12} md={isChildProgressView ? 12 : 6} key={child.id}>
                    <Card>
                      <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                          <Typography variant="h6">
                            {child.name} - {intl.formatMessage(messages.progressReport)}
                          </Typography>
                          {!isChildProgressView && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<BarChart />}
                              onClick={async () => {
                                try {
                                  const reportData = {
                                    student_user_id: child.id,
                                    report_type: 'monthly',
                                    period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                                    period_end: new Date().toISOString().split('T')[0]
                                  };

                                  const response = await API.generateProgressReport(reportData);
                                  if (response.success) {
                                    alert(`${intl.formatMessage(messages.reportGenerated)} ${child.name}`);
                                  } else {
                                    alert(intl.formatMessage(messages.reportGenerationFailed));
                                  }
                                } catch (error) {
                                  console.error('Failed to generate report:', error);
                                  alert(intl.formatMessage(messages.reportGenerationFailed));
                                }
                              }}
                            >
                              {intl.formatMessage(messages.generateReport)}
                            </Button>
                          )}
                        </Box>

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
          <Box style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
            <Typography variant="h5" gutterBottom>
              {intl.formatMessage(messages.communication)}
            </Typography>

            {/* Message History Section */}
            {parentMessages && parentMessages.length > 0 && (
              <Card style={{ marginBottom: '2rem' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {intl.formatMessage(messages.messageHistory)}
                  </Typography>
                  <List style={{ maxHeight: '400px', overflow: 'auto' }}>
                    {/* Group messages by conversation threads - show only root messages */}
                    {(() => {
                      // Group messages by conversation thread
                      const threadMap = new Map();
                      const rootMessages = [];

                      parentMessages.forEach(message => {
                        if (!message.parent_message_id) {
                          // This is a root message
                          rootMessages.push(message);
                          threadMap.set(message.id, [message]);
                        } else {
                          // This is a reply - add to its thread
                          const rootId = findRootMessageId(message.id, parentMessages);
                          if (threadMap.has(rootId)) {
                            threadMap.get(rootId).push(message);
                          }
                        }
                      });

                      // Helper function to find root message ID
                      function findRootMessageId(messageId, messages) {
                        const msg = messages.find(m => m.id === messageId);
                        if (!msg || !msg.parent_message_id) return messageId;
                        return findRootMessageId(msg.parent_message_id, messages);
                      }

                      return rootMessages.map((rootMessage) => {
                        const threadMessages = threadMap.get(rootMessage.id) || [rootMessage];
                        const replyCount = threadMessages.length - 1;
                        const isExpanded = expandedThreads.has(rootMessage.id);

                        return (
                          <Box key={rootMessage.id}>
                            <ListItem
                              button
                              onClick={() => {
                                const newExpanded = new Set(expandedThreads);
                                if (isExpanded) {
                                  newExpanded.delete(rootMessage.id);
                                } else {
                                  newExpanded.add(rootMessage.id);
                                }
                                setExpandedThreads(newExpanded);
                              }}
                              divider={!isExpanded}
                            >
                              <ListItemAvatar>
                                <Avatar>
                                  {rootMessage.sender_name ? rootMessage.sender_name.charAt(0).toUpperCase() : 'U'}
                                </Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={
                                  <Box display="flex" justifyContent="space-between" alignItems="center">
                                    <Box display="flex" alignItems="center" gap={1}>
                                      <Typography variant="body1" style={{ fontWeight: 'bold' }}>
                                        {rootMessage.subject}
                                      </Typography>
                                      {replyCount > 0 && (
                                        <Chip
                                          label={`${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
                                          size="small"
                                          color="primary"
                                          variant="outlined"
                                        />
                                      )}
                                    </Box>
                                    <Typography variant="caption" color="textSecondary">
                                      {rootMessage.created_at ? new Date(rootMessage.created_at).toLocaleDateString() : ''}
                                    </Typography>
                                  </Box>
                                }
                                secondary={
                                  <Box>
                                    <Typography variant="body2" color="textSecondary" gutterBottom>
                                      {rootMessage.sender_name} → {rootMessage.recipient_name}
                                    </Typography>
                                    <Typography variant="body2">
                                      {(rootMessage.message_body || rootMessage.message) && (rootMessage.message_body || rootMessage.message).length > 100
                                        ? `${(rootMessage.message_body || rootMessage.message).substring(0, 100)}...`
                                        : (rootMessage.message_body || rootMessage.message)}
                                    </Typography>
                                  </Box>
                                }
                              />
                              <ListItemSecondaryAction>
                                <Box display="flex" alignItems="center" gap={1}>
                                  {rootMessage.sender_user_id === user.id && (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="secondary"
                                      startIcon={<Delete />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteMessage(rootMessage);
                                      }}
                                    >
                                      {intl.formatMessage(messages.delete)}
                                    </Button>
                                  )}
                                  {rootMessage.sender_user_id !== user.id && (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={<Message />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleReplyToMessage(rootMessage);
                                      }}
                                    >
                                      {intl.formatMessage(messages.reply)}
                                    </Button>
                                  )}
                                  <Typography variant="caption" color="textSecondary">
                                    {isExpanded ? '▼' : '▶'}
                                  </Typography>
                                </Box>
                              </ListItemSecondaryAction>
                            </ListItem>

                            {/* Expanded thread view */}
                            {isExpanded && threadMessages.length > 1 && (
                              <Box ml={9} mr={2} mb={2}>
                                {threadMessages.slice(1).map((replyMsg, replyIndex) => (
                                  <Box
                                    key={replyMsg.id}
                                    style={{
                                      borderLeft: '2px solid #e0e0e0',
                                      paddingLeft: '16px',
                                      marginBottom: '8px',
                                      paddingBottom: '8px'
                                    }}
                                  >
                                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                      <Typography variant="body2" style={{ fontWeight: 'bold' }}>
                                        {replyMsg.sender_name}
                                      </Typography>
                                      <Typography variant="caption" color="textSecondary">
                                        {new Date(replyMsg.created_at).toLocaleString()}
                                      </Typography>
                                    </Box>
                                        <Typography variant="body2" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                                          {replyMsg.message_body || replyMsg.message}
                                        </Typography>
                                        <Box mt={1} display="flex" gap={1}>
                                          {replyMsg.sender_user_id === user.id && (
                                            <Button
                                              size="small"
                                              variant="outlined"
                                              color="secondary"
                                              onClick={() => handleDeleteMessage(replyMsg)}
                                            >
                                              {intl.formatMessage(messages.delete)}
                                            </Button>
                                          )}
                                          {replyMsg.sender_user_id !== user.id && replyIndex === threadMessages.length - 2 && (
                                            <Button
                                              size="small"
                                              variant="outlined"
                                              onClick={() => handleReplyToMessage(replyMsg)}
                                            >
                                              {intl.formatMessage(messages.reply)}
                                            </Button>
                                          )}
                                        </Box>
                                  </Box>
                                ))}
                              </Box>
                            )}
                          </Box>
                        );
                      });
                    })()}
                  </List>
                </CardContent>
              </Card>
            )}

            {/* Contact Teachers Section */}
            <Typography variant="h6" gutterBottom style={{ marginTop: '2rem' }}>
              {intl.formatMessage(messages.contactTeachers)}
            </Typography>

            <Box style={{ maxHeight: '400px', overflow: 'auto' }}>
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
              onClick={async () => {
                try {
                  const settingsData = {
                    child_user_id: selectedChild.id,
                    settings_data: childSettings
                  };

                  const response = await API.saveChildSettings(settingsData);
                  if (response.success) {
                    alert(intl.formatMessage(messages.settingsSaved));
                    handleCloseManageChild();
                  } else {
                    alert(intl.formatMessage(messages.saveFailed));
                  }
                } catch (error) {
                  console.error('Failed to save child settings:', error);
                  alert(intl.formatMessage(messages.saveFailed));
                }
              }}
              color="primary"
              variant="contained"
            >
              {intl.formatMessage(messages.saveSettings)}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Send Message Dialog - Email-like Conversation View */}
        <Dialog
          open={messageDialog}
          onClose={handleCloseMessageDialog}
          fullWidth
          maxWidth={false}
          style={{ maxWidth: '800px', margin: 'auto' }}
        >
          <DialogTitle>
            {selectedMessage ? `Re: ${selectedMessage.subject}` : intl.formatMessage(messages.sendMessageToTeacher)}
          </DialogTitle>
          <DialogContent style={{ padding: '24px' }}>
            {/* Conversation Thread - Read Only */}
            {messageConversation && messageConversation.length > 0 && (
              <Box mb={3}>
                <Typography variant="h6" gutterBottom>
                  Conversation
                </Typography>
                <Box style={{ maxHeight: '400px', overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px' }}>
                  {messageConversation.map((msg, index) => (
                    <Box key={msg.id || index} mb={3} style={{ borderBottom: index < messageConversation.length - 1 ? '1px solid #f0f0f0' : 'none', paddingBottom: '16px' }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="subtitle2" style={{ fontWeight: 'bold' }}>
                          {msg.sender_name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {new Date(msg.created_at).toLocaleString()}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        Subject: {msg.subject}
                      </Typography>
                      <Typography variant="body1" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                        {msg.message_body || msg.message}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Reply Section */}
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedMessage ? 'Your Reply' : 'New Message'}
              </Typography>

              {!selectedMessage && (
                <Typography variant="body2" color="textSecondary" gutterBottom style={{ marginBottom: '16px' }}>
                  {intl.formatMessage(messages.regarding)} {selectedChild?.name}
                </Typography>
              )}

              <TextField
                autoFocus={!selectedMessage}
                margin="dense"
                label={intl.formatMessage(messages.subject)}
                fullWidth
                value={newMessage.subject}
                onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                style={{ marginBottom: '16px' }}
              />
              <TextField
                autoFocus={selectedMessage}
                margin="dense"
                label={selectedMessage ? intl.formatMessage(messages.reply) : intl.formatMessage(messages.message)}
                fullWidth
                multiline
                rows={6}
                value={newMessage.message}
                onChange={(e) => setNewMessage({ ...newMessage, message: e.target.value })}
                placeholder={selectedMessage ? "Type your reply here..." : "Type your message here..."}
              />
            </Box>
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
              disabled={!newMessage.subject.trim() || !newMessage.message.trim()}
            >
              {selectedMessage ? intl.formatMessage(messages.reply) : intl.formatMessage(messages.sendMessage)}
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
