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
  MenuItem,
  Fab,
  Tooltip,
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
  Toolbar
} from '@material-ui/core';
import {
  People,
  TrendingUp,
  Assignment,
  Add,
  Assessment,
  School,
  PersonAdd,
  Edit,
  Delete,
  Settings,
  AccountTree,
  Gavel,
  ArrowBack,
  Message
} from '@material-ui/icons';
import { injectIntl, intlShape } from 'react-intl';

import { getUser, isLogged } from '../../../../components/App/App.selectors';
import API from '../../../../api/api.js';
import messages from './TeacherDashboard.messages';

const TeacherDashboard = ({ intl, user, history }) => {
  console.log('[DEBUG TeacherDashboard] Component initialized with user:', user);

  const [students, setStudents] = useState([]);
  const [learningObjectives, setLearningObjectives] = useState([]);
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeObjectives: 0,
    completedObjectives: 0,
    averageProgress: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  // Student Management
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Dialogs
  const [createObjectiveDialog, setCreateObjectiveDialog] = useState(false);
  const [manageStudentDialog, setManageStudentDialog] = useState(false);
  const [jyutpingRulesDialog, setJyutpingRulesDialog] = useState(false);

  const [newObjective, setNewObjective] = useState({
    title: '',
    description: '',
    objective_type: 'communication',
    target_date: ''
  });

  const [studentForm, setStudentForm] = useState({
    name: '',
    email: '',
    role: 'student'
  });

  const [jyutpingRules, setJyutpingRules] = useState({
    matching_enabled: true,
    exception_rules: [],
    difficulty_level: 'beginner'
  });

  const [manageStudentForm, setManageStudentForm] = useState({
    name: '',
    email: '',
    class_name: '',
    role: 'student'
  });

  // Student assignment state
  const [availableStudents, setAvailableStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Messaging state
  const [messageList, setMessageList] = useState([]);
  const [parents, setParents] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageDialog, setMessageDialog] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [newMessage, setNewMessage] = useState({
    subject: '',
    message_body: '',
    priority: 'normal'
  });

  useEffect(() => {
    console.log('[DEBUG TeacherDashboard] Component mounting, user:', user);
    console.log('[DEBUG TeacherDashboard] User role:', user?.role);
    console.log('[DEBUG TeacherDashboard] Is logged in:', !!user);

    // Check if user has teacher permissions
    if (!user || !user.role) {
      console.error('[DEBUG TeacherDashboard] No user or role found - cannot load teacher data');
      return;
    }

    if (!['teacher', 'therapist', 'admin'].includes(user.role)) {
      console.error('[DEBUG TeacherDashboard] User does not have teacher permissions. Role:', user.role);
      return;
    }

    console.log('[DEBUG TeacherDashboard] User has teacher permissions, loading data...');
    loadDashboardData();
    handleRouteBasedTabSwitching();
  }, []);

  // Load messages when communication tab becomes active
  useEffect(() => {
    if (activeTab === 3 && !loadingMessages && messageList.length === 0) {
      loadMessages();
    }
  }, [activeTab]);

  // Handle URL-based tab switching and parameter extraction
  const handleRouteBasedTabSwitching = () => {
    const path = history.location.pathname;
    if (path === '/teacher/messages') {
      setActiveTab(3); // Communication tab
      // Load messages will be called when tab becomes active
    } else if (path.includes('/teacher/students/') && path.includes('/progress')) {
      // Extract student ID from URL
      const pathParts = path.split('/');
      const studentIdIndex = pathParts.findIndex(part => part === 'students') + 1;
      if (studentIdIndex < pathParts.length) {
        const studentId = parseInt(pathParts[studentIdIndex], 10);
        if (!isNaN(studentId)) {
          setActiveTab(1); // Student Management tab
          // Could set selected student for progress view
          console.log('Student progress view for student:', studentId);
        }
      }
    }
  };

  // Load messages and parents
  const loadMessages = async () => {
    console.log('[DEBUG TeacherDashboard] Loading messages');
    setLoadingMessages(true);
    try {
      const response = await API.getTeacherMessages();
      console.log('[DEBUG TeacherDashboard] Messages response:', response);

      if (response && response.data && response.data.data) {
        setMessageList(response.data.data.messages || []);
        setParents(response.data.data.parents || []);
      } else {
        setMessageList([]);
        setParents([]);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessageList([]);
      setParents([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!selectedParent || !newMessage.subject.trim() || !newMessage.message_body.trim()) {
      return;
    }

    try {
      const messageData = {
        recipient_user_id: selectedParent.id,
        subject: newMessage.subject,
        message_body: newMessage.message_body,
        priority: newMessage.priority,
        message_type: 'teacher_parent'
      };

      await API.sendMessage(messageData);
      // Refresh messages
      loadMessages();
      handleCloseMessageDialog();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Open message dialog
  const handleOpenMessageDialog = (parent) => {
    setSelectedParent(parent);
    setMessageDialog(true);
  };

  // Close message dialog
  const handleCloseMessageDialog = () => {
    setMessageDialog(false);
    setSelectedParent(null);
    setNewMessage({
      subject: '',
      message_body: '',
      priority: 'normal'
    });
  };

  const loadDashboardData = async () => {
    console.log('[DEBUG TeacherDashboard] loadDashboardData called');

    try {
      setLoading(true);

      // Load assigned students
      try {
        console.log('[DEBUG TeacherDashboard] Calling API.getTeacherStudents()');
        const studentsData = await API.getTeacherStudents();
        console.log('[DEBUG TeacherDashboard] API.getTeacherStudents() response:', studentsData);

        // Backend returns array directly or wrapped in response object
        const students = Array.isArray(studentsData) ? studentsData :
          (studentsData.students || []);
        console.log('[DEBUG TeacherDashboard] Setting students data:', students);

        setStudents(students);
        setStats(prev => ({
          ...prev,
          totalStudents: students.length
        }));
      } catch (apiError) {
        console.warn('[DEBUG TeacherDashboard] Failed to load students:', apiError);
        // Keep empty array on error
        setStudents([]);
        setStats(prev => ({
          ...prev,
          totalStudents: 0
        }));
      }

      // Load real learning objectives from API
      try {
        console.log('[DEBUG TeacherDashboard] Loading learning objectives for all students');
        const allObjectives = [];

      // Get objectives for each assigned student
        for (const student of students) {
          try {
            const response = await API.getStudentProgress(student.id);
            if (response && response.learning_objectives) {
              // Add student name to each objective
              const studentObjectives = response.learning_objectives.map(obj => ({
                ...obj,
                student_name: student.name
              }));
              allObjectives.push(...studentObjectives);
            }
          } catch (objError) {
            console.warn(`[DEBUG TeacherDashboard] Failed to load objectives for student ${student.id}:`, objError);
            // Continue with other students even if one fails
          }
        }

        console.log('[DEBUG TeacherDashboard] Loaded objectives:', allObjectives);
        setLearningObjectives(allObjectives);
      } catch (apiError) {
        console.warn('[DEBUG TeacherDashboard] Failed to load learning objectives:', apiError);
        // Use empty array instead of sample data
        setLearningObjectives([]);
      }

      const activeObjectives = learningObjectives.filter(obj => obj.status === 'active').length;
      const completedObjectives = learningObjectives.filter(obj => obj.status === 'completed').length;
      const averageProgress =
        learningObjectives.length > 0
          ? learningObjectives.reduce((sum, obj) => sum + (obj.progress_percentage || 0), 0) /
          learningObjectives.length
          : 0;

      setStats(prev => ({
        ...prev,
        activeObjectives,
        completedObjectives,
        averageProgress: Math.round(averageProgress)
      }));
    } catch (error) {
      console.error('Failed to load teacher dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleViewStudentProgress = (studentId) => {
    history.push(`/teacher/students/${studentId}/progress`);
  };

  const handleCreateObjective = (student = null) => {
    setSelectedStudent(student);
    setCreateObjectiveDialog(true);
  };

  const handleCloseCreateObjective = () => {
    setCreateObjectiveDialog(false);
    setSelectedStudent(null);
    setNewObjective({
      title: '',
      description: '',
      objective_type: 'communication',
      target_date: ''
    });
  };

  const handleSaveObjective = async () => {
    if (!selectedStudent || !newObjective.title.trim()) return;

    try {
      const objectiveData = {
        student_user_id: selectedStudent.id,
        title: newObjective.title,
        description: newObjective.description,
        objective_type: newObjective.objective_type,
        target_date: newObjective.target_date || null
      };

      const response = await API.createLearningObjective(objectiveData);
      if (response.success) {
        // Refresh dashboard data
        loadDashboardData();
        handleCloseCreateObjective();
      }
    } catch (error) {
      console.error('Failed to create learning objective:', error);
    }
  };

  const getObjectiveTypeColor = (type) => {
    switch (type) {
      case 'communication': return 'primary';
      case 'academic': return 'secondary';
      case 'social': return 'default';
      case 'motor': return 'default';
      case 'cognitive': return 'default';
      default: return 'default';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'primary';
      case 'completed': return 'secondary';
      case 'cancelled': return 'default';
      case 'on_hold': return 'default';
      default: return 'default';
    }
  };

  if (loading) {
    return <div>{intl.formatMessage(messages.loadingTeacherDashboard)}</div>;
  }

  // Student Management Functions
  const handleManageStudent = async () => {
    console.log('[DEBUG TeacherDashboard] handleManageStudent called');
    setLoadingStudents(true);
    setStudentSearch('');
    setManageStudentDialog(true);

    try {
      // Try to load real available students from API
      console.log('[DEBUG TeacherDashboard] Calling API.getTeacherAvailableStudents()');
      const response = await API.getTeacherAvailableStudents();
      console.log('[DEBUG TeacherDashboard] API.getTeacherAvailableStudents() response:', response);
      console.log('[DEBUG TeacherDashboard] Response type:', typeof response);
      console.log('[DEBUG TeacherDashboard] Response keys:', response ? Object.keys(response) : 'null/undefined');

      if (response && response.students) {
        console.log('[DEBUG TeacherDashboard] Setting available students:', response.students);
        console.log('[DEBUG TeacherDashboard] Students array length:', response.students.length);
        setAvailableStudents(response.students);
      } else {
        // API call succeeded but returned no data
        console.log('[DEBUG TeacherDashboard] API returned success but no students data');
        console.log('[DEBUG TeacherDashboard] Response details:', JSON.stringify(response, null, 2));
        setAvailableStudents([]);
      }
    } catch (apiError) {
      console.warn('[DEBUG TeacherDashboard] API call failed:', apiError);
      console.warn('[DEBUG TeacherDashboard] Error details:', JSON.stringify(apiError, null, 2));
      // Show empty list on API failure
      setAvailableStudents([]);
    } finally {
      setLoadingStudents(false);
      console.log('[DEBUG TeacherDashboard] handleManageStudent finished, loadingStudents set to false');
    }
  };

  const handleAssignStudent = async (student) => {
    console.log('[DEBUG TeacherDashboard] handleAssignStudent called with:', student);

    try {
      // Call the API to assign the student to this teacher
      const result = await API.assignStudentToTeacher(student.id);
      console.log('[DEBUG TeacherDashboard] Student assignment result:', result);

      if (result && result.success) {
        console.log('[DEBUG TeacherDashboard] Student assigned successfully');
        // Refresh the dashboard data to show the new student in the assigned list
        await loadDashboardData();
        handleCloseManageStudent();
      } else {
        console.error('[DEBUG TeacherDashboard] Assignment failed:', result);
        // Show error message to user
        // For now, just log it - you could add a snackbar notification here
      }
    } catch (error) {
      console.error('[DEBUG TeacherDashboard] Failed to assign student:', error);
      // Show error message to user
      // For now, just log it - you could add a snackbar notification here
      // Still close the dialog even on error to avoid getting stuck
      handleCloseManageStudent();
    }
  };

  const handleCloseManageStudent = () => {
    setManageStudentDialog(false);
    setAvailableStudents([]);
    setStudentSearch('');
    setLoadingStudents(false);
  };

  const handleJyutpingRules = (student) => {
    setSelectedStudent(student);
    setJyutpingRulesDialog(true);
    // Load current rules for this student
    loadJyutpingRules(student.id);
  };

  const loadJyutpingRules = async (studentId) => {
    try {
      const response = await API.getJyutpingMatchingRules(studentId);
      if (response.success) {
        setJyutpingRules(response.data);
      }
    } catch (error) {
      console.error('Failed to load Jyutping rules:', error);
    }
  };

  const handleSaveJyutpingRules = async () => {
    if (!selectedStudent) return;

    try {
      await API.updateJyutpingMatchingRules(selectedStudent.id, jyutpingRules);
      setJyutpingRulesDialog(false);
      setSelectedStudent(null);
    } catch (error) {
      console.error('Failed to save Jyutping rules:', error);
    }
  };

  const handleBackToSettings = () => {
    // Go back to main settings page
    history.push('/settings');
  };

  const filteredStudents = students.filter(student =>
    student.name?.toLowerCase().includes(search.toLowerCase()) ||
    student.email?.toLowerCase().includes(search.toLowerCase())
  );

  const paginatedStudents = filteredStudents.slice(
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
            {intl.formatMessage(messages.teacherDashboard)}
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
            <Tab label={intl.formatMessage(messages.studentManagement)} icon={<People />} />
            <Tab label={intl.formatMessage(messages.learningObjectives)} icon={<Assignment />} />
            <Tab label={intl.formatMessage(messages.communication)} icon={<Message />} />
            <Tab label={intl.formatMessage(messages.jyutpingRules)} icon={<Gavel />} />
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
                        {intl.formatMessage(messages.myStudents)}
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="primary">
                      {stats.totalStudents}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Assignment color="secondary" style={{ marginRight: '0.5rem' }} />
                      <Typography variant="h6">
                        {intl.formatMessage(messages.activeObjectives)}
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="secondary">
                      {stats.activeObjectives}
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
                        {intl.formatMessage(messages.completedObjectives)}
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="primary">
                      {stats.completedObjectives}
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
            </Grid>

            <Grid container spacing={3}>
              {/* My Students */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6">
                        {intl.formatMessage(messages.myStudents)}
                      </Typography>
                      <Button
                        size="small"
                        color="primary"
                        onClick={() => setActiveTab(1)}
                      >
                        {intl.formatMessage(messages.manageStudents)}
                      </Button>
                    </Box>
                    <List>
                      {students.slice(0, 5).map((student) => (
                        <ListItem key={student.id} button onClick={() => handleViewStudentProgress(student.id)}>
                          <ListItemAvatar>
                            <Avatar>
                              {student.name ? student.name.charAt(0).toUpperCase() : 'S'}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={student.name}
                            secondary={`${student.class_name || 'No Class'} • ${student.email}`}
                          />
                          <Box display="flex" gap={1}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewStudentProgress(student.id);
                              }}
                            >
                              {intl.formatMessage(messages.viewProgress)}
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateObjective(student);
                              }}
                            >
                              <Add />
                            </Button>
                          </Box>
                        </ListItem>
                      ))}
                      {students.length === 0 && (
                        <ListItem>
                          <ListItemText
                            primary={intl.formatMessage(messages.noStudentsAssigned)}
                            secondary={intl.formatMessage(messages.contactAdmin)}
                          />
                        </ListItem>
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              {/* Recent Learning Objectives */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6">
                        {intl.formatMessage(messages.recentObjectives)}
                      </Typography>
                      <Button
                        size="small"
                        color="primary"
                        onClick={() => setActiveTab(2)}
                      >
                        {intl.formatMessage(messages.manageObjectives)}
                      </Button>
                    </Box>
                    <List>
                      {learningObjectives.slice(0, 5).map((objective) => (
                        <ListItem key={objective.id}>
                          <ListItemText
                            primary={
                              <Box>
                                <Typography variant="body1">{objective.title}</Typography>
                                <Typography variant="body2" color="textSecondary">
                                  {objective.student_name} • {intl.formatMessage(messages[objective.objective_type] || messages.communication)}
                                </Typography>
                              </Box>
                            }
                            secondary={
                              <Box mt={1}>
                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                  <Typography variant="body2" component="span">
                                    <Chip
                                      label={intl.formatMessage(
                                        objective.status === 'active' ? messages.active :
                                          objective.status === 'completed' ? messages.completed :
                                            objective.status === 'cancelled' ? messages.cancelled :
                                              objective.status === 'on_hold' ? messages.on_hold :
                                                messages.active
                                      )}
                                      color={getStatusColor(objective.status)}
                                      size="small"
                                      style={{ marginRight: '0.5rem' }}
                                    />
                                    {objective.progress_percentage}%
                                  </Typography>
                                </Box>
                                <LinearProgress
                                  variant="determinate"
                                  value={objective.progress_percentage}
                                  style={{ height: '6px', borderRadius: '3px' }}
                                />
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                      {learningObjectives.length === 0 && (
                        <ListItem>
                          <ListItemText
                            primary={intl.formatMessage(messages.noObjectives)}
                            secondary={intl.formatMessage(messages.createFirstObjective)}
                          />
                        </ListItem>
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </>
        )}

        {activeTab === 1 && (
          /* Student Management Tab */
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h5">
                {intl.formatMessage(messages.studentManagement)}
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<PersonAdd />}
                onClick={() => handleManageStudent()}
              >
                {intl.formatMessage(messages.assignStudent)}
              </Button>
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

            {/* Students Table */}
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{intl.formatMessage(messages.name)}</TableCell>
                    <TableCell>{intl.formatMessage(messages.email)}</TableCell>
                    <TableCell>{intl.formatMessage(messages.class)}</TableCell>
                    <TableCell>{intl.formatMessage(messages.profiles)}</TableCell>
                    <TableCell>{intl.formatMessage(messages.lastActivity)}</TableCell>
                    <TableCell>{intl.formatMessage(messages.actions)}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <Avatar style={{ marginRight: '0.5rem', width: 32, height: 32 }}>
                            {student.name ? student.name.charAt(0).toUpperCase() : 'S'}
                          </Avatar>
                          {student.name}
                        </Box>
                      </TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell>{student.class_name || '-'}</TableCell>
                      <TableCell>{student.profiles_count || 0}</TableCell>
                      <TableCell>{student.last_login ? new Date(student.last_login).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleViewStudentProgress(student.id)}>
                          <Assessment />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleJyutpingRules(student)}>
                          <Gavel />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleManageStudent(student)}>
                          <Settings />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleCreateObjective(student)}>
                          <Add />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {paginatedStudents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        {intl.formatMessage(messages.noStudentsFound)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={filteredStudents.length}
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
          /* Learning Objectives Tab */
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h5">
                {intl.formatMessage(messages.learningObjectives)}
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Add />}
                onClick={() => students.length > 0 && handleCreateObjective(students[0])}
              >
                {intl.formatMessage(messages.createObjective)}
              </Button>
            </Box>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{intl.formatMessage(messages.objectiveTitle)}</TableCell>
                    <TableCell>{intl.formatMessage(messages.student)}</TableCell>
                    <TableCell>{intl.formatMessage(messages.type)}</TableCell>
                    <TableCell>{intl.formatMessage(messages.progress)}</TableCell>
                    <TableCell>{intl.formatMessage(messages.status)}</TableCell>
                    <TableCell>{intl.formatMessage(messages.targetDate)}</TableCell>
                    <TableCell>{intl.formatMessage(messages.actions)}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {learningObjectives.map((objective) => (
                    <TableRow key={objective.id}>
                      <TableCell>{objective.title}</TableCell>
                      <TableCell>{objective.student_name}</TableCell>
                      <TableCell>
                        <Chip
                          label={intl.formatMessage(messages[objective.objective_type] || messages.communication)}
                          color={getObjectiveTypeColor(objective.objective_type)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <Typography variant="body2" style={{ marginRight: '0.5rem' }}>
                            {objective.progress_percentage}%
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={objective.progress_percentage}
                            style={{ width: '60px', height: '6px' }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={intl.formatMessage(
                            objective.status === 'active' ? messages.active :
                              objective.status === 'completed' ? messages.completed :
                                objective.status === 'cancelled' ? messages.cancelled :
                                  objective.status === 'on_hold' ? messages.on_hold :
                                    messages.active
                          )}
                          color={getStatusColor(objective.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{objective.target_date ? new Date(objective.target_date).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => {
                            // TODO: Implement edit objective functionality
                            console.log('Edit objective:', objective.id);
                          }}
                        >
                          <Edit />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {learningObjectives.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        {intl.formatMessage(messages.noObjectives)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {activeTab === 3 && (
          /* Communication Tab */
          <Box>
            <Typography variant="h5" gutterBottom>
              {intl.formatMessage(messages.communication)}
            </Typography>
            <Typography variant="body1" color="textSecondary" style={{ marginBottom: '2rem' }}>
              Communicate with parents about their children's progress and development.
            </Typography>

            {/* Load messages when tab is active */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6">
                {intl.formatMessage(messages.recentMessages)}
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={() => loadMessages()}
                disabled={loadingMessages}
              >
                {loadingMessages ? 'Loading...' : intl.formatMessage(messages.refreshMessages)}
              </Button>
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {intl.formatMessage(messages.sendMessageToParent)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" style={{ marginBottom: '1rem' }}>
                      {intl.formatMessage(messages.sendMessagesToParents)}
                    </Typography>
                    <TextField
                      select
                      fullWidth
                      label={intl.formatMessage(messages.selectParent)}
                      value={selectedParent?.id || ''}
                      onChange={(e) => {
                        const parentId = e.target.value;
                        const parent = parents.find(p => p.id === parentId);
                        setSelectedParent(parent);
                      }}
                      style={{ marginBottom: '1rem' }}
                    >
                      {parents.map((parent) => (
                        <MenuItem key={parent.id} value={parent.id}>
                          {parent.name} ({parent.email})
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      onClick={() => handleOpenMessageDialog(selectedParent)}
                      disabled={!selectedParent}
                    >
                      {intl.formatMessage(messages.composeMessage)}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {intl.formatMessage(messages.recentMessages)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" style={{ marginBottom: '1rem' }}>
                      {intl.formatMessage(messages.messagesWillAppearHere)}
                    </Typography>
                    <List dense style={{ maxHeight: '300px', overflow: 'auto' }}>
                      {messageList.length > 0 ? messageList.slice(0, 5).map((message) => (
                        <ListItem key={message.id}>
                          <ListItemText
                            primary={`${message.subject} - ${message.recipient_name}`}
                            secondary={`${new Date(message.created_at).toLocaleDateString()} • ${message.is_read ? 'Read' : 'Unread'}`}
                          />
                        </ListItem>
                      )) : (
                        <ListItem>
                          <ListItemText
                            primary={intl.formatMessage(messages.noMessagesYet)}
                            secondary={intl.formatMessage(messages.messagesWillAppearHere)}
                          />
                        </ListItem>
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {activeTab === 4 && (
          /* Jyutping Rules Tab */
          <Box>
            <Typography variant="h5" gutterBottom>
              {intl.formatMessage(messages.jyutpingRules)}
            </Typography>
            <Typography variant="body1" color="textSecondary" style={{ marginBottom: '2rem' }}>
              {intl.formatMessage(messages.jyutpingRulesDescription)}
            </Typography>

            <Grid container spacing={3}>
              {students.map((student) => (
                <Grid item xs={12} md={6} key={student.id}>
                  <Card>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6">{student.name}</Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Gavel />}
                          onClick={() => handleJyutpingRules(student)}
                        >
                          {intl.formatMessage(messages.configure)}
                        </Button>
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        {intl.formatMessage(messages.currentDifficulty)}: {intl.formatMessage(messages.beginner)}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {intl.formatMessage(messages.matchingEnabled)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Create Learning Objective Dialog */}
        <Dialog
          open={createObjectiveDialog}
          onClose={handleCloseCreateObjective}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {intl.formatMessage(messages.createObjective)}
          </DialogTitle>
          <DialogContent>
            {/* Student Selection */}
            <TextField
              select
              margin="dense"
              label={intl.formatMessage(messages.selectStudent)}
              fullWidth
              value={selectedStudent?.id || ''}
              onChange={(e) => {
                const studentId = e.target.value;
                const student = students.find(s => s.id === studentId);
                setSelectedStudent(student);
              }}
            >
              {students.map((student) => (
                <MenuItem key={student.id} value={student.id}>
                  {student.name} ({student.email})
                </MenuItem>
              ))}
            </TextField>

            <TextField
              autoFocus
              margin="dense"
              label={intl.formatMessage(messages.objectiveTitle)}
              fullWidth
              value={newObjective.title}
              onChange={(e) => setNewObjective({ ...newObjective, title: e.target.value })}
            />
            <TextField
              margin="dense"
              label={intl.formatMessage(messages.objectiveDescription)}
              fullWidth
              multiline
              rows={3}
              value={newObjective.description}
              onChange={(e) => setNewObjective({ ...newObjective, description: e.target.value })}
            />
            <TextField
              margin="dense"
              label={intl.formatMessage(messages.objectiveType)}
              select
              fullWidth
              value={newObjective.objective_type}
              onChange={(e) => setNewObjective({ ...newObjective, objective_type: e.target.value })}
            >
              <MenuItem value="communication">
                {intl.formatMessage(messages.communication)}
              </MenuItem>
              <MenuItem value="academic">
                {intl.formatMessage(messages.academic)}
              </MenuItem>
              <MenuItem value="social">
                {intl.formatMessage(messages.social)}
              </MenuItem>
              <MenuItem value="motor">
                {intl.formatMessage(messages.motor)}
              </MenuItem>
              <MenuItem value="cognitive">
                {intl.formatMessage(messages.cognitive)}
              </MenuItem>
            </TextField>
            <TextField
              margin="dense"
              label={intl.formatMessage(messages.targetDate)}
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={newObjective.target_date}
              onChange={(e) => setNewObjective({ ...newObjective, target_date: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCreateObjective}>
              {intl.formatMessage(messages.cancel)}
            </Button>
            <Button onClick={handleSaveObjective} color="primary" variant="contained">
              {intl.formatMessage(messages.createObjective)}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Manage Student Dialog */}
        <Dialog
          open={manageStudentDialog}
          onClose={handleCloseManageStudent}
          maxWidth="md"
          fullWidth
          onEntered={() => console.log('[DEBUG TeacherDashboard] Manage Student Dialog opened')}
        >
          <DialogTitle>
            {intl.formatMessage(messages.selectStudents)}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="textSecondary" style={{ marginBottom: '1rem' }}>
              {intl.formatMessage(messages.selectStudentsToAssign)}
            </Typography>

            {/* Search Field */}
            <TextField
              label={intl.formatMessage(messages.search)}
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              fullWidth
              style={{ marginBottom: '1rem' }}
              placeholder={intl.formatMessage(messages.search)}
            />

            {/* Loading State */}
            {loadingStudents && (
              <Box display="flex" justifyContent="center" p={2}>
                <Typography>{intl.formatMessage(messages.loadingTeacherDashboard)}</Typography>
              </Box>
            )}

            {/* Students List */}
            {!loadingStudents && (() => {
              console.log('[DEBUG TeacherDashboard] Rendering available students list');
              console.log('[DEBUG TeacherDashboard] availableStudents state:', availableStudents);
              console.log('[DEBUG TeacherDashboard] studentSearch:', studentSearch);

              const filteredStudents = availableStudents.filter(student =>
                student.name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
                student.email?.toLowerCase().includes(studentSearch.toLowerCase())
              );

              console.log('[DEBUG TeacherDashboard] filteredStudents count:', filteredStudents.length);

              return (
                <Box style={{ maxHeight: '400px', overflow: 'auto' }}>
                  {filteredStudents.map((student) => {
                    console.log('[DEBUG TeacherDashboard] Rendering student card:', student.id, student.name);
                    return (
                      <Card key={student.id} style={{ marginBottom: '0.5rem' }}>
                        <CardContent style={{ padding: '1rem' }}>
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Box display="flex" alignItems="center">
                              <Avatar style={{ marginRight: '0.75rem', width: 40, height: 40 }}>
                                {student.name ? student.name.charAt(0).toUpperCase() : 'S'}
                              </Avatar>
                              <Box>
                                <Typography variant="body1">{student.name}</Typography>
                                <Typography variant="body2" color="textSecondary">
                                  {student.email}
                                </Typography>
                              </Box>
                            </Box>
                            <Button
                              variant="contained"
                              color="primary"
                              size="small"
                              onClick={() => {
                                console.log('[DEBUG TeacherDashboard] Assign button clicked for student:', student.id, student.name);
                                handleAssignStudent(student);
                              }}
                            >
                              {intl.formatMessage(messages.assign)}
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {filteredStudents.length === 0 && (
                    <Box textAlign="center" p={3}>
                      <Typography variant="body1" color="textSecondary">
                        {intl.formatMessage(messages.noAvailableStudents)}
                      </Typography>
                    </Box>
                  )}
                </Box>
              );
            })()}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseManageStudent}>
              {intl.formatMessage(messages.cancel)}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Message Dialog */}
        <Dialog
          open={messageDialog}
          onClose={handleCloseMessageDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {intl.formatMessage(messages.sendMessageToParent).replace('Parent', selectedParent?.name || 'Parent')}
          </DialogTitle>
          <DialogContent>
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
              value={newMessage.message_body}
              onChange={(e) => setNewMessage({ ...newMessage, message_body: e.target.value })}
            />
            <TextField
              margin="dense"
              label={intl.formatMessage(messages.priority)}
              select
              fullWidth
              value={newMessage.priority}
              onChange={(e) => setNewMessage({ ...newMessage, priority: e.target.value })}
            >
              <MenuItem value="normal">{intl.formatMessage(messages.normal)}</MenuItem>
              <MenuItem value="urgent">{intl.formatMessage(messages.urgent)}</MenuItem>
              <MenuItem value="low">{intl.formatMessage(messages.low)}</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseMessageDialog}>
              {intl.formatMessage(messages.cancel)}
            </Button>
            <Button
              onClick={handleSendMessage}
              color="primary"
              variant="contained"
              disabled={!newMessage.subject.trim() || !newMessage.message_body.trim()}
            >
              {intl.formatMessage(messages.sendMessage)}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Jyutping Rules Dialog */}
        <Dialog
          open={jyutpingRulesDialog}
          onClose={() => setJyutpingRulesDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {intl.formatMessage(messages.jyutpingRules)} - {selectedStudent?.name}
          </DialogTitle>
          <DialogContent>
            <Box mb={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={jyutpingRules.matching_enabled}
                    onChange={(e) => setJyutpingRules({ ...jyutpingRules, matching_enabled: e.target.checked })}
                    color="primary"
                  />
                }
                label={intl.formatMessage(messages.matchingEnabled)}
              />
            </Box>

            <TextField
              margin="dense"
              label={intl.formatMessage(messages.currentDifficulty)}
              select
              fullWidth
              value={jyutpingRules.difficulty_level}
              onChange={(e) => setJyutpingRules({ ...jyutpingRules, difficulty_level: e.target.value })}
            >
              <MenuItem value="beginner">
                {intl.formatMessage(messages.beginner)}
              </MenuItem>
              <MenuItem value="intermediate">
                {intl.formatMessage(messages.intermediate)}
              </MenuItem>
              <MenuItem value="advanced">
                {intl.formatMessage(messages.advanced)}
              </MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setJyutpingRulesDialog(false)}>
              {intl.formatMessage(messages.cancel)}
            </Button>
            <Button onClick={handleSaveJyutpingRules} color="primary" variant="contained">
              {intl.formatMessage(messages.save)}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Floating Action Button for Quick Actions */}
        <Tooltip title={intl.formatMessage(messages.createNewObjective)}>
          <Fab
            color="primary"
            style={{ position: 'fixed', bottom: '2rem', right: '2rem' }}
            onClick={() => students.length > 0 && handleCreateObjective(students[0])}
          >
            <Add />
          </Fab>
        </Tooltip>
      </Box>
    </Box>
  );
};

TeacherDashboard.propTypes = {
  intl: intlShape.isRequired,
  user: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired
};

const mapStateToProps = state => ({
  user: getUser(state)
});

export default connect(mapStateToProps)(
  injectIntl(withRouter(TeacherDashboard))
);
