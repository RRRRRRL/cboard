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
  ArrowBack as ArrowBackIcon,
  Message
} from '@material-ui/icons';
import { injectIntl, intlShape } from 'react-intl';

import { getUser, isLogged } from '../../../../components/App/App.selectors';
import { showNotification } from '../../../Notifications/Notifications.actions';
import API from '../../../../api/api.js';
import messages from './TeacherDashboard.messages';

const TeacherDashboard = ({ intl, user, history, showNotification }) => {
  

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
  const [editingObjective, setEditingObjective] = useState(null);

  const [newObjective, setNewObjective] = useState({
    title: '',
    description: '',
    objective_type: 'communication',
    target_date: '',
    progress_percentage: 0
  });

  const [studentForm, setStudentForm] = useState({
    name: '',
    email: '',
    role: 'student'
  });

  const [jyutpingRules, setJyutpingRules] = useState({
    enabled: true,
    frequency_threshold: 50,
    allow_exact_match: true,
    allow_substring_match: true,
    allow_single_char_match: true,
    require_ai_correction: false,
    ai_confidence_threshold: 0.50,
    merge_n_ng_finals: false,
    allow_coda_simplification: false,
    ignore_tones: false,
    allow_fuzzy_tones: false,
    fuzzy_tone_pairs: null,
    allow_ng_zero_confusion: false,
    allow_n_l_confusion: false,
    keyboard_layout: 'jyutping1'
  });

  const [jyutpingExceptionRules, setJyutpingExceptionRules] = useState([]);
  const [studentDifficultyLevels, setStudentDifficultyLevels] = useState({});

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
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageConversation, setMessageConversation] = useState([]);
  const [expandedThreads, setExpandedThreads] = useState(new Set());
  const [newMessage, setNewMessage] = useState({
    subject: '',
    message_body: '',
    priority: 'normal'
  });

  useEffect(() => {
    

    // Check if user has teacher permissions
    if (!user || !user.role) {
    
      return;
    }

    if (!['teacher', 'therapist', 'admin'].includes(user.role)) {
      
      return;
    }

    
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
    
    setLoadingMessages(true);
    try {
      const response = await API.getTeacherMessages();
      

      if (response && response.success && response.data) {
        setMessageList(response.data.messages || []);
        setParents(response.data.parents || []);
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
        message_type: 'teacher_parent',
        student_user_id: selectedParent.child_user_id // Include the student this message is about
      };

      await API.sendMessage(messageData);
      // Show success message
      console.log('Showing message sent notification');
      showNotification(intl.formatMessage(messages.messageSent));
      // Refresh messages
      loadMessages();
      handleCloseMessageDialog();
    } catch (error) {
      console.error('Failed to send message:', error);
      showNotification('Failed to send message', 'error');
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

  // Handle reply to message
  const handleReplyToMessage = (message) => {
    // Find the parent who sent this message
    const parent = parents.find(p => p.id === message.sender_user_id);
    if (parent) {
      // Set up conversation view with the selected message
      setSelectedMessage(message);
      setSelectedParent(parent); // Set the parent for reply
      setMessageDialog(true);
      // Load the full conversation thread
      loadMessageConversation(message);

      // Pre-fill the message with recipient information for reply
      setNewMessage({
        subject: message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`,
        message_body: '',
        priority: 'normal'
      });
    }
  };

  const handleDeleteMessage = async (message) => {
    if (window.confirm(intl.formatMessage(messages.deleteMessageConfirm))) {
      try {
        // Call delete API
        const response = await API.deleteMessage(message.id);
        // Check for success - handle different response formats
        if (response && (response.success === true || response.success === "true" || response.data)) {
          showNotification('Message deleted successfully!');
          // Refresh messages to show updated data
          loadMessages();
        } else {
          throw new Error(response?.message || response?.data?.message || 'Failed to delete message');
        }
      } catch (error) {
        console.error('Failed to delete message:', error);
        showNotification('Failed to delete message. Please try again.', 'error');
      }
    }
  };

  const loadMessageConversation = async (message) => {
    try {
      // Get all messages in this conversation thread using parent_message_id chain
      const response = await API.getTeacherMessages();
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

  // Load student difficulty levels
  const loadStudentDifficultyLevels = async (studentList) => {
    const difficultyLevels = {};
    for (const student of studentList) {
      try {
        const response = await API.getJyutpingMatchingRules(student.id);
        if (response.success && response.data && response.data.difficulty_level) {
          difficultyLevels[student.id] = response.data.difficulty_level;
        } else {
          // Default to beginner if no rules found
          difficultyLevels[student.id] = 'beginner';
        }
      } catch (error) {
        console.warn(`Failed to load difficulty level for student ${student.id}:`, error);
        difficultyLevels[student.id] = 'beginner'; // Default fallback
      }
    }
    setStudentDifficultyLevels(difficultyLevels);
  };

  const loadDashboardData = async () => {
    

    try {
      setLoading(true);

      // Load assigned students
      let loadedStudents = [];
      try {
        const studentsData = await API.getTeacherStudents();

        // Backend returns array directly or wrapped in response object
        loadedStudents = Array.isArray(studentsData) ? studentsData :
          (studentsData.students || []);
        

        setStudents(loadedStudents);
        setStats(prev => ({
          ...prev,
          totalStudents: loadedStudents.length
        }));

        // Load difficulty levels for all students
        if (loadedStudents.length > 0) {
          await loadStudentDifficultyLevels(loadedStudents);
        }
      } catch (apiError) {
        
        // Keep empty array on error
        setStudents([]);
        setStats(prev => ({
          ...prev,
          totalStudents: 0
        }));
      }

      // Load real learning objectives from API
      try {
        
        const allObjectives = [];

      // Get objectives for each assigned student
        for (const student of loadedStudents) {
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
            
            // Continue with other students even if one fails
          }
        }

        
        setLearningObjectives(allObjectives);
      } catch (apiError) {
        
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
    setEditingObjective(null);
    setNewObjective({
      title: '',
      description: '',
      objective_type: 'communication',
      target_date: '',
      progress_percentage: 0
    });
    setCreateObjectiveDialog(true);
  };

  const handleEditObjective = (objective) => {
    setEditingObjective(objective);
    setSelectedStudent(students.find(s => s.name === objective.student_name));
    setNewObjective({
      title: objective.title,
      description: objective.description || '',
      objective_type: objective.objective_type,
      target_date: objective.target_date ? objective.target_date.split('T')[0] : '',
      progress_percentage: objective.progress_percentage || 0
    });
    setCreateObjectiveDialog(true);
  };

  const handleCloseCreateObjective = () => {
    setCreateObjectiveDialog(false);
    setSelectedStudent(null);
    setEditingObjective(null);
    setNewObjective({
      title: '',
      description: '',
      objective_type: 'communication',
      target_date: '',
      progress_percentage: 0
    });
  };

  const handleSaveObjective = async () => {
    if (!selectedStudent || !newObjective.title.trim()) return;

    try {
      // Auto-complete objective when progress reaches 100%
      const progressPercentage = newObjective.progress_percentage || 0;
      const status = progressPercentage >= 100 ? 'completed' : 'active';

      const objectiveData = {
        student_user_id: selectedStudent.id,
        title: newObjective.title,
        description: newObjective.description,
        objective_type: newObjective.objective_type,
        target_date: newObjective.target_date || null,
        progress_percentage: progressPercentage,
        status: status
      };

      let response;
      let successMessage;
      if (editingObjective) {
        // Update existing objective
        response = await API.updateLearningObjective(editingObjective.id, objectiveData);
        successMessage = intl.formatMessage(messages.objectiveSaved);
        // Show completion message if objective was just completed
        if (status === 'completed' && editingObjective.status !== 'completed') {
          successMessage = '🎉 Learning objective completed!';
        }
      } else {
        // Create new objective
        response = await API.createLearningObjective(objectiveData);
        successMessage = intl.formatMessage(messages.objectiveCreated);
        // Show completion message if new objective is already completed
        if (status === 'completed') {
          successMessage = '🎉 Learning objective created and completed!';
        }
      }

      // Show success message regardless of response format
      console.log('Showing success notification:', successMessage);
      console.log('API Response:', response);
      console.log('Calling showNotification function...');
      showNotification(successMessage);
      console.log('showNotification called successfully');
      // Switch to objectives tab
      setActiveTab(2);
      // Refresh dashboard data
      loadDashboardData();
      handleCloseCreateObjective();
    } catch (error) {
      console.error('Failed to save learning objective:', error);
      showNotification(intl.formatMessage(messages.saveError), 'error');
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
    
    setLoadingStudents(true);
    setStudentSearch('');
    setManageStudentDialog(true);

    try {
      // Try to load real available students from API
      const response = await API.getTeacherAvailableStudents();

      if (response && response.students) {
        
        setAvailableStudents(response.students);
      } else {
        // API call succeeded but returned no data
        
        setAvailableStudents([]);
      }
      } catch (apiError) {
        
      // Show empty list on API failure
      setAvailableStudents([]);
    } finally {
      setLoadingStudents(false);
      
    }
  };

  const handleAssignStudent = async (student) => {
    try {
      // Call the API to assign the student to this teacher
      const result = await API.assignStudentToTeacher(student.id);
      if (result && result.success) {
        // Refresh the dashboard data to show the new student in the assigned list
        await loadDashboardData();
        handleCloseManageStudent();
      } else {
        // Show error message to user
        // For now, just log it - you could add a snackbar notification here
      }
    } catch (error) {
      // Show error message to user
      // For now, just log it - you could add a snackbar notification here
      // Still close the dialog even on error to avoid getting stuck
      handleCloseManageStudent();
    }
  };

  const handleUnassignStudent = async (student) => {
    console.log('handleUnassignStudent called with student:', student);
    if (window.confirm(`Are you sure you want to remove ${student.name} from your assigned students?`)) {
      console.log('User confirmed removal, calling API...');
      try {
        console.log('Calling API.unassignStudentFromTeacher with student ID:', student.id);
        const result = await API.unassignStudentFromTeacher(student.id);
        console.log('API call completed, result:', result);
        showNotification(`Student ${student.name} has been removed successfully!`);
        // Refresh the dashboard data to show updated student list
        loadDashboardData();
      } catch (error) {
        console.error('Failed to unassign student:', error);
        showNotification('Failed to remove student. Please try again.', 'error');
      }
    } else {
      console.log('User cancelled the removal');
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
      // Load both matching rules and exception rules
      const [matchingResponse, exceptionResponse] = await Promise.all([
        API.getJyutpingMatchingRules(studentId),
        API.getJyutpingExceptionRules(studentId)
      ]);

      

      if (matchingResponse && matchingResponse.rules) {
        const rules = matchingResponse.rules;
        setJyutpingRules(rules);
      } else {
        
      }

      if (exceptionResponse && exceptionResponse.rules) {
        
        setJyutpingExceptionRules(exceptionResponse.rules);

        // Also update the jyutpingRules state with exception rule values for the switches
        // This creates a combined state that includes both matching rules and exception rules
        setJyutpingRules(prevRules => {
          const exceptionRuleMap = {};
          exceptionResponse.rules.forEach(rule => {
            exceptionRuleMap[rule.rule_key] = rule.enabled;
          });

          const combinedRules = {
            ...prevRules,
            // Map exception rules to the expected property names
            allow_character_variants: exceptionRuleMap.allow_character_variants || false,
            allow_low_frequency: exceptionRuleMap.allow_low_frequency || false,
            allow_tone_variants: exceptionRuleMap.allow_tone_variants || false,
            require_full_word_match: exceptionRuleMap.require_full_word_match || false,
            strict_hanzi_match: exceptionRuleMap.strict_hanzi_match || false,
            enable_ai_correction: exceptionRuleMap.enable_ai_correction || false
          };

          
          console.log('  require_ai_correction:', combinedRules.require_ai_correction, '(from matching rules)');
          console.log('  allow_character_variants:', combinedRules.allow_character_variants, '(from exception rules)');
          console.log('  allow_low_frequency:', combinedRules.allow_low_frequency, '(from exception rules)');
          console.log('  allow_tone_variants:', combinedRules.allow_tone_variants, '(from exception rules)');
          console.log('  require_full_word_match:', combinedRules.require_full_word_match, '(from exception rules)');
          console.log('  strict_hanzi_match:', combinedRules.strict_hanzi_match, '(from exception rules)');
          console.log('  merge_n_ng_finals:', combinedRules.merge_n_ng_finals, '(from matching rules)');
          console.log('  allow_coda_simplification:', combinedRules.allow_coda_simplification, '(from matching rules)');
          console.log('  ignore_tones:', combinedRules.ignore_tones, '(from matching rules)');
          console.log('  allow_fuzzy_tones:', combinedRules.allow_fuzzy_tones, '(from matching rules)');
          console.log('  allow_ng_zero_confusion:', combinedRules.allow_ng_zero_confusion, '(from matching rules)');
          console.log('  allow_n_l_confusion:', combinedRules.allow_n_l_confusion, '(from matching rules)');
          return combinedRules;
        });
      } else {
        
        setJyutpingExceptionRules([]);
      }
    } catch (error) {
      
      setJyutpingExceptionRules([]);
    }
  };

  const handleSaveJyutpingRules = async () => {
    if (!selectedStudent) return;

    

    try {
      // Separate matching rules from exception rules
      // Only send matching rule fields to the matching rules API
      // Convert boolean values to integers as expected by backend
      const matchingRulesOnly = {
        frequency_threshold: jyutpingRules.frequency_threshold,
        allow_exact_match: jyutpingRules.allow_exact_match ? 1 : 0,
        allow_substring_match: jyutpingRules.allow_substring_match ? 1 : 0,
        allow_single_char_match: jyutpingRules.allow_single_char_match ? 1 : 0,
        require_ai_correction: jyutpingRules.require_ai_correction ? 1 : 0,
        ai_confidence_threshold: jyutpingRules.ai_confidence_threshold,
        enabled: jyutpingRules.enabled ? 1 : 0,
        merge_n_ng_finals: jyutpingRules.merge_n_ng_finals ? 1 : 0,
        allow_coda_simplification: jyutpingRules.allow_coda_simplification ? 1 : 0,
        ignore_tones: jyutpingRules.ignore_tones ? 1 : 0,
        allow_fuzzy_tones: jyutpingRules.allow_fuzzy_tones ? 1 : 0,
        fuzzy_tone_pairs: jyutpingRules.fuzzy_tone_pairs,
        allow_ng_zero_confusion: jyutpingRules.allow_ng_zero_confusion ? 1 : 0,
        allow_n_l_confusion: jyutpingRules.allow_n_l_confusion ? 1 : 0
      };

      const matchingResult = await API.updateJyutpingMatchingRules(selectedStudent.id, matchingRulesOnly);

      const exceptionData = {
        rules: jyutpingExceptionRules.map(rule => ({
          rule_id: rule.id,
          enabled: rule.enabled
        }))
      };
      const exceptionResult = await API.updateJyutpingExceptionRules(selectedStudent.id, exceptionData);
      showNotification('Jyutping rules updated successfully!');
      setJyutpingRulesDialog(false);
      setSelectedStudent(null);
      // Refresh dashboard data to show updated rules - but this doesn't reload Jyutping rules
      await loadDashboardData();
    } catch (error) {
      showNotification('Failed to save Jyutping rules', 'error');
    }
  };

  const handleDeleteObjective = async (objective) => {
    if (window.confirm(`Are you sure you want to delete the learning objective "${objective.title}"?`)) {
      try {
        await API.deleteLearningObjective(objective.id);
        showNotification('Learning objective deleted successfully!');
        // Refresh dashboard data to show updated objectives list
        loadDashboardData();
      } catch (error) {
        console.error('Failed to delete learning objective:', error);
        showNotification('Failed to delete learning objective. Please try again.', 'error');
      }
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
                        <IconButton
                          size="small"
                          color="secondary"
                          onClick={() => handleUnassignStudent(student)}
                          title="Remove student from this teacher"
                        >
                          <Delete />
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
                          onClick={() => handleEditObjective(objective)}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="secondary"
                          onClick={() => handleDeleteObjective(objective)}
                          title="Delete learning objective"
                        >
                          <Delete />
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
          <Box style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
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

            <Box style={{ maxHeight: 'calc(100vh - 350px)', overflow: 'auto' }}>
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
                      <List dense style={{ maxHeight: '400px', overflow: 'auto' }}>
                        {/* Group messages by conversation threads - show only root messages */}
                        {(() => {
                          // Group messages by conversation thread
                          const threadMap = new Map();
                          const rootMessages = [];

                          messageList.forEach(message => {
                            if (!message.parent_message_id) {
                              // This is a root message
                              rootMessages.push(message);
                              threadMap.set(message.id, [message]);
                            } else {
                              // This is a reply - add to its thread
                              const rootId = findRootMessageId(message.id, messageList);
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
                                      <IconButton
                                        size="small"
                                        color="secondary"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteMessage(rootMessage);
                                        }}
                                      >
                                        <Delete />
                                      </IconButton>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleReplyToMessage(rootMessage);
                                        }}
                                      >
                                        {intl.formatMessage(messages.reply)}
                                      </Button>
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
                                          <IconButton
                                            size="small"
                                            color="secondary"
                                            onClick={() => handleDeleteMessage(replyMsg)}
                                          >
                                            <Delete />
                                          </IconButton>
                                          {replyIndex === threadMessages.length - 2 && (
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
                        {messageList.length === 0 && (
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
                        {intl.formatMessage(messages.currentDifficulty)}: {intl.formatMessage(messages[studentDifficultyLevels[student.id] || 'beginner'] || messages.beginner)}
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

        {/* Create/Edit Learning Objective Dialog */}
        <Dialog
          open={createObjectiveDialog}
          onClose={handleCloseCreateObjective}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {editingObjective ? intl.formatMessage(messages.editObjective) : intl.formatMessage(messages.createObjective)}
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
            <TextField
              margin="dense"
              label={intl.formatMessage(messages.progress)}
              type="number"
              fullWidth
              inputProps={{ min: 0, max: 100 }}
              value={newObjective.progress_percentage}
              onChange={(e) => setNewObjective({ ...newObjective, progress_percentage: parseInt(e.target.value) || 0 })}
              helperText={intl.formatMessage(messages.progressHelper) || "Enter progress percentage (0-100)"}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCreateObjective}>
              {intl.formatMessage(messages.cancel)}
            </Button>
            <Button onClick={handleSaveObjective} color="primary" variant="contained">
              {editingObjective ? intl.formatMessage(messages.saveObjective) : intl.formatMessage(messages.createObjective)}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Manage Student Dialog */}
        <Dialog
          open={manageStudentDialog}
          onClose={handleCloseManageStudent}
          maxWidth="md"
          fullWidth
          onEntered={() => {}}
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
              const filteredStudents = availableStudents.filter(student =>
                student.name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
                student.email?.toLowerCase().includes(studentSearch.toLowerCase())
              );

              return (
                <Box style={{ maxHeight: '400px', overflow: 'auto' }}>
                  {filteredStudents.map((student) => {
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

        {/* Message Dialog - Email-like Conversation View */}
        <Dialog
          open={messageDialog}
          onClose={handleCloseMessageDialog}
          fullWidth
          maxWidth={false}
          style={{ maxWidth: '800px', margin: 'auto' }}
        >
          <DialogTitle>
            {selectedMessage ? `Re: ${selectedMessage.subject}` : intl.formatMessage(messages.sendMessageToParent).replace('Parent', selectedParent?.name || 'Parent')}
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
                  Send message to {selectedParent?.name}
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
                value={newMessage.message_body}
                onChange={(e) => setNewMessage({ ...newMessage, message_body: e.target.value })}
                placeholder={selectedMessage ? "Type your reply here..." : "Type your message here..."}
              />
              <TextField
                margin="dense"
                label={intl.formatMessage(messages.priority)}
                select
                fullWidth
                value={newMessage.priority}
                onChange={(e) => setNewMessage({ ...newMessage, priority: e.target.value })}
                style={{ marginTop: '16px' }}
              >
                <MenuItem value="normal">{intl.formatMessage(messages.normal)}</MenuItem>
                <MenuItem value="urgent">{intl.formatMessage(messages.urgent)}</MenuItem>
                <MenuItem value="low">{intl.formatMessage(messages.low)}</MenuItem>
              </TextField>
            </Box>
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
              {selectedMessage ? intl.formatMessage(messages.reply) : intl.formatMessage(messages.sendMessage)}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Jyutping Rules Dialog */}
        <Dialog
          open={jyutpingRulesDialog}
          onClose={() => setJyutpingRulesDialog(false)}
          maxWidth="md"
          fullWidth
          className="JyutpingKeyboard__dialog"
        >
          
          <DialogTitle className="JyutpingKeyboard__header">
            <div className="JyutpingKeyboard__header-content">
              <IconButton
                onClick={() => setJyutpingRulesDialog(false)}
                className="JyutpingKeyboard__close-button"
              >
                <ArrowBackIcon />
              </IconButton>
              <span className="JyutpingKeyboard__title">
                {intl.formatMessage(messages.jyutpingRules)} - {selectedStudent?.name}
              </span>
            </div>
          </DialogTitle>

          <DialogContent className="JyutpingKeyboard__content">
            {/* Demo Text Area - Shows what the keyboard interface looks like */}
            <Box mb={3} p={2} border={1} borderColor="grey.300" borderRadius={1}>
              <Typography variant="h6" gutterBottom>
                {intl.formatMessage(messages.keyboardPreview)}
              </Typography>
              <Typography variant="body2" color="textSecondary" style={{ marginBottom: '1rem' }}>
                {intl.formatMessage(messages.keyboardPreviewDescription)}
              </Typography>

              {/* Mock Text Editor Area */}
              <Box
                style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  padding: '16px',
                  backgroundColor: '#fafafa',
                  marginBottom: '1rem'
                }}
              >
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {intl.formatMessage(messages.textOutputArea)}
                </Typography>
                <Box
                  style={{
                    minHeight: '60px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    padding: '8px',
                    backgroundColor: 'white',
                    fontFamily: 'monospace'
                  }}
                >
                  {jyutpingRules.text_demo || 'Student will type here...'}
                </Box>

                <Typography variant="body2" color="textSecondary" style={{ marginTop: '8px' }} gutterBottom>
                  {intl.formatMessage(messages.jyutpingPronunciation)}
                </Typography>
                <Box
                  style={{
                    minHeight: '30px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    padding: '8px',
                    backgroundColor: 'white',
                    fontFamily: 'monospace',
                    fontSize: '0.9em',
                    color: '#666'
                  }}
                >
                  {jyutpingRules.jyutping_demo || 'jyutping will appear here...'}
                </Box>
              </Box>

              {/* Voice Controls */}
              <Box display="flex" gap={2} mb={2}>
                <Box>
                  <Typography variant="body2" gutterBottom>
                    {intl.formatMessage(messages.voiceProfile)}
                  </Typography>
                  <TextField
                    select
                    size="small"
                    value={jyutpingRules.speech_profile || 'cantonese_1'}
                    onChange={(e) => setJyutpingRules({ ...jyutpingRules, speech_profile: e.target.value })}
                  >
                    <MenuItem value="cantonese_1">Cantonese 1</MenuItem>
                    <MenuItem value="cantonese_2">Cantonese 2</MenuItem>
                    <MenuItem value="cantonese_3">Cantonese 3</MenuItem>
                    <MenuItem value="mandarin">Mandarin</MenuItem>
                    <MenuItem value="english_female">English Female</MenuItem>
                    <MenuItem value="english_male">English Male</MenuItem>
                  </TextField>
                </Box>

                <Box>
                  <Typography variant="body2" gutterBottom>
                    {intl.formatMessage(messages.speechRate)}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={jyutpingRules.speech_rate || 1.0}
                      onChange={(e) => setJyutpingRules({ ...jyutpingRules, speech_rate: parseFloat(e.target.value) })}
                      style={{ width: '80px' }}
                    />
                    <Typography variant="body2">
                      {(jyutpingRules.speech_rate || 1.0).toFixed(1)}x
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Keyboard Layout Configuration */}
            <Box mb={3}>
              <Typography variant="h6" gutterBottom>
                {intl.formatMessage(messages.keyboardLayoutSettings)}
              </Typography>
              <Typography variant="body2" color="textSecondary" style={{ marginBottom: '1rem' }}>
                {intl.formatMessage(messages.keyboardLayoutSettingsDescription)}
              </Typography>

              {/* Layout Tabs - Same as JyutpingKeyboard */}
          <Tabs
            value={jyutpingRules.keyboard_layout || 'jyutping1'}
            onChange={(event, newValue) => setJyutpingRules({ ...jyutpingRules, keyboard_layout: newValue })}
            variant="scrollable"
            scrollButtons="auto"
            style={{ marginBottom: '1rem' }}
          >
            <Tab label="Jyutping 1" value="jyutping1" />
            <Tab label="Jyutping 2" value="jyutping2" />
            <Tab label="Cantonese 1" value="cantonese1" />
            <Tab label="Cantonese 2" value="cantonese2" />
            <Tab label="Cantonese 3" value="cantonese3" />
            <Tab label="QWERTY" value="qwerty" />
            <Tab label="Numeric" value="numeric" />
          </Tabs>

              {/* Keyboard Preview */}
              <Box
                style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  padding: '16px',
                  backgroundColor: '#fafafa'
                }}
              >
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {intl.formatMessage(messages.keyboardPreviewLayout, { layout: jyutpingRules.keyboard_layout || 'jyutping1' })}
                </Typography>
                <Typography variant="body2" style={{ fontStyle: 'italic' }}>
                  {intl.formatMessage(messages.keyboardPreviewPlaceholder)}
                </Typography>
              </Box>
            </Box>

            {/* Part 1: Matching Game Rules */}
            <Box mb={4} p={2} border={1} borderColor="primary.main" borderRadius={2}>
              <Typography variant="h5" gutterBottom style={{ color: 'primary.main', fontWeight: 'bold' }}>
                🎯 Part 1: Matching Game Rules
              </Typography>
              <Typography variant="body2" color="textSecondary" style={{ marginBottom: '1.5rem' }}>
                Configure rules for spelling and matching games. These rules affect how the system evaluates student input during gameplay.
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={jyutpingRules.require_ai_correction || false}
                        onChange={(e) => setJyutpingRules({ ...jyutpingRules, require_ai_correction: e.target.checked })}
                        color="primary"
                      />
                    }
                    label="Enable AI Correction"
                  />
                  <Typography variant="body2" color="textSecondary" style={{ marginLeft: '42px', marginBottom: '1rem' }}>
                    Use AI to suggest corrections when confidence is low
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="AI Confidence Threshold"
                    type="number"
                    value={jyutpingRules.ai_confidence_threshold || 0.5}
                    onChange={(e) => setJyutpingRules({ ...jyutpingRules, ai_confidence_threshold: parseFloat(e.target.value) || 0.5 })}
                    helperText="Minimum confidence level for AI corrections (0.0-1.0)"
                    inputProps={{ min: 0, max: 1, step: 0.1 }}
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={jyutpingRules.allow_exact_match ?? true}
                        onChange={(e) => setJyutpingRules({ ...jyutpingRules, allow_exact_match: e.target.checked })}
                        color="primary"
                      />
                    }
                    label="Allow Exact Match"
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={jyutpingRules.allow_substring_match ?? true}
                        onChange={(e) => setJyutpingRules({ ...jyutpingRules, allow_substring_match: e.target.checked })}
                        color="primary"
                      />
                    }
                    label="Allow Substring Match"
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={jyutpingRules.allow_single_char_match ?? true}
                        onChange={(e) => setJyutpingRules({ ...jyutpingRules, allow_single_char_match: e.target.checked })}
                        color="primary"
                      />
                    }
                    label="Allow Single Character Match"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Frequency Threshold"
                    type="number"
                    value={jyutpingRules.frequency_threshold || 50}
                    onChange={(e) => setJyutpingRules({ ...jyutpingRules, frequency_threshold: parseInt(e.target.value) || 50 })}
                    helperText="Minimum word frequency for suggestions (0-100)"
                    inputProps={{ min: 0, max: 100 }}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Part 2: Jyutping Keyboard Settings */}
            <Box mb={3} p={2} border={1} borderColor="secondary.main" borderRadius={2}>
              <Typography variant="h5" gutterBottom style={{ color: 'secondary.main', fontWeight: 'bold' }}>
                ⌨️ Part 2: Jyutping Keyboard Settings
              </Typography>
              <Typography variant="body2" color="textSecondary" style={{ marginBottom: '1.5rem' }}>
                Configure the Jyutping input keyboard behavior and phonological adaptation rules for typing assistance.
              </Typography>

              {/* Keyboard Layout Selection */}
              <Box mb={3}>
                <Typography variant="h6" gutterBottom>
                  Keyboard Layout
                </Typography>
                <Tabs
                  value={jyutpingRules.keyboard_layout || 'jyutping1'}
                  onChange={(event, newValue) => setJyutpingRules({ ...jyutpingRules, keyboard_layout: newValue })}
                  variant="scrollable"
                  scrollButtons="auto"
                  style={{ marginBottom: '1rem' }}
                >
                  <Tab label="Jyutping 1" value="jyutping1" />
                  <Tab label="Jyutping 2" value="jyutping2" />
                  <Tab label="Cantonese 1" value="cantonese1" />
                  <Tab label="Cantonese 2" value="cantonese2" />
                  <Tab label="Cantonese 3" value="cantonese3" />
                  <Tab label="QWERTY" value="qwerty" />
                  <Tab label="Numeric" value="numeric" />
                </Tabs>
              </Box>

              {/* Phonological Adaptation Rules */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  Phonological Adaptation Rules
                </Typography>
                <Typography variant="body2" color="textSecondary" style={{ marginBottom: '1rem' }}>
                  Adjust how the keyboard handles common phonological variations and speech patterns.
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={jyutpingRules.merge_n_ng_finals || false}
                          onChange={(e) => setJyutpingRules({ ...jyutpingRules, merge_n_ng_finals: e.target.checked })}
                          color="primary"
                        />
                      }
                      label={intl.formatMessage(messages.mergeNFinals)}
                    />
                    <Typography variant="body2" color="textSecondary" style={{ marginLeft: '42px', marginBottom: '1rem' }}>
                      {intl.formatMessage(messages.mergeNFinalsDesc)}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={jyutpingRules.allow_coda_simplification || false}
                          onChange={(e) => setJyutpingRules({ ...jyutpingRules, allow_coda_simplification: e.target.checked })}
                          color="primary"
                        />
                      }
                      label={intl.formatMessage(messages.allowCodaSimplification)}
                    />
                    <Typography variant="body2" color="textSecondary" style={{ marginLeft: '42px', marginBottom: '1rem' }}>
                      {intl.formatMessage(messages.allowCodaSimplificationDesc)}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={jyutpingRules.ignore_tones || false}
                          onChange={(e) => setJyutpingRules({ ...jyutpingRules, ignore_tones: e.target.checked })}
                          color="primary"
                        />
                      }
                      label={intl.formatMessage(messages.ignoreTones)}
                    />
                    <Typography variant="body2" color="textSecondary" style={{ marginLeft: '42px', marginBottom: '1rem' }}>
                      {intl.formatMessage(messages.ignoreTonesDesc)}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={jyutpingRules.allow_fuzzy_tones || false}
                          onChange={(e) => setJyutpingRules({ ...jyutpingRules, allow_fuzzy_tones: e.target.checked })}
                          color="primary"
                        />
                      }
                      label={intl.formatMessage(messages.allowFuzzyTones)}
                    />
                    <Typography variant="body2" color="textSecondary" style={{ marginLeft: '42px', marginBottom: '1rem' }}>
                      {intl.formatMessage(messages.allowFuzzyTonesDesc)}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={jyutpingRules.allow_ng_zero_confusion || false}
                          onChange={(e) => setJyutpingRules({ ...jyutpingRules, allow_ng_zero_confusion: e.target.checked })}
                          color="primary"
                        />
                      }
                      label={intl.formatMessage(messages.allowNgZeroConfusion)}
                    />
                    <Typography variant="body2" color="textSecondary" style={{ marginLeft: '42px', marginBottom: '1rem' }}>
                      {intl.formatMessage(messages.allowNgZeroConfusionDesc)}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={jyutpingRules.allow_n_l_confusion || false}
                          onChange={(e) => setJyutpingRules({ ...jyutpingRules, allow_n_l_confusion: e.target.checked })}
                          color="primary"
                        />
                      }
                      label={intl.formatMessage(messages.allowNlConfusion)}
                    />
                    <Typography variant="body2" color="textSecondary" style={{ marginLeft: '42px', marginBottom: '1rem' }}>
                      {intl.formatMessage(messages.allowNlConfusionDesc)}
                    </Typography>
                  </Grid>

                  {/* Fuzzy Tone Pairs */}
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label={intl.formatMessage(messages.fuzzyTonePairs)}
                      value={jyutpingRules.fuzzy_tone_pairs || ''}
                      onChange={(e) => setJyutpingRules({ ...jyutpingRules, fuzzy_tone_pairs: e.target.value })}
                      helperText="JSON array of tone pairs, e.g., [[1,3],[2,5]] for tone 1 matching 3, tone 2 matching 5"
                      multiline
                      rows={2}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Box>
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
  history: PropTypes.object.isRequired,
  showNotification: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
  user: getUser(state)
});

const mapDispatchToProps = {
  showNotification
};

export default connect(mapStateToProps, mapDispatchToProps)(
  injectIntl(withRouter(TeacherDashboard))
);
