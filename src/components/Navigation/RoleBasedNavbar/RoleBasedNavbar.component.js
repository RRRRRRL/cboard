import React from 'react';
import { connect } from 'react-redux';
import { withRouter, Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Menu,
  MenuItem,
  IconButton,
  Box,
  Chip,
  Avatar,
  Divider
} from '@material-ui/core';
import {
  Menu as MenuIcon,
  School,
  People,
  Class,
  Dashboard,
  Assessment,
  Settings,
  AccountCircle,
  ExitToApp
} from '@material-ui/icons';
import { injectIntl, intlShape } from 'react-intl';

import { logout } from '../../../components/Account/Login/Login.actions.js';
import { isLogged } from '../../App/App.selectors';
import API from '../../../api/api.js';
import messages from './RoleBasedNavbar.messages';

const RoleBasedNavbar = ({
  intl,
  user,
  history,
  location,
  onLogout
}) => {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [userRoles, setUserRoles] = React.useState([]);

  React.useEffect(() => {
    if (user && user.id) {
      loadUserRoles();
    }
  }, [user]);

  const loadUserRoles = async () => {
    try {
      // We'll need to implement this in the API and backend
      // For now, we'll use a simple role detection based on user data
      const roles = [];

      // Check if user has admin role
      if (user.role === 'admin') {
        roles.push({ role: 'system_admin', organization_name: 'System' });
      }

      // Check organization roles (this would come from backend)
      // For demo purposes, we'll assume some roles
      if (user.role === 'teacher') {
        roles.push({
          role: 'teacher',
          organization_name: 'Sample School',
          class_name: 'Grade 1A'
        });
      }

      if (user.role === 'parent') {
        roles.push({ role: 'parent', organization_name: 'Sample School' });
      }

      if (user.role === 'student') {
        roles.push({
          role: 'student',
          organization_name: 'Sample School',
          class_name: 'Grade 1A'
        });
      }

      setUserRoles(roles);
    } catch (error) {
      console.error('Failed to load user roles:', error);
    }
  };

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    onLogout();
    history.push('/');
  };

  const isSystemAdmin = userRoles.some(r => r.role === 'system_admin');
  const isTeacher = userRoles.some(r => r.role === 'teacher');
  const isParent = userRoles.some(r => r.role === 'parent');
  const isStudent = userRoles.some(r => r.role === 'student');

  const getRoleDisplay = () => {
    if (isSystemAdmin) return intl.formatMessage(messages.systemAdmin);
    if (isTeacher) return intl.formatMessage(messages.teacher);
    if (isParent) return intl.formatMessage(messages.parent);
    if (isStudent) return intl.formatMessage(messages.student);
    return intl.formatMessage(messages.user);
  };

  const getPrimaryRole = () => {
    if (isSystemAdmin) return 'system_admin';
    if (isTeacher) return 'teacher';
    if (isParent) return 'parent';
    if (isStudent) return 'student';
    return 'user';
  };

  const renderNavigationButtons = () => {
    const buttons = [];

    // Common navigation for all users
    buttons.push(
      <Button
        key="home"
        color="inherit"
        component={Link}
        to="/"
        style={{ marginLeft: '1rem' }}
      >
        {intl.formatMessage(messages.home)}
      </Button>
    );

    // System Admin navigation
    if (isSystemAdmin) {
      buttons.push(
        <Button
          key="admin-dashboard"
          color="inherit"
          component={Link}
          to="/admin/dashboard"
          startIcon={<Dashboard />}
          style={{ marginLeft: '1rem' }}
        >
          {intl.formatMessage(messages.adminDashboard)}
        </Button>,
        <Button
          key="organizations"
          color="inherit"
          component={Link}
          to="/admin/organizations"
          startIcon={<School />}
          style={{ marginLeft: '1rem' }}
        >
          {intl.formatMessage(messages.organizations)}
        </Button>,
        <Button
          key="system-users"
          color="inherit"
          component={Link}
          to="/admin/users"
          startIcon={<People />}
          style={{ marginLeft: '1rem' }}
        >
          {intl.formatMessage(messages.users)}
        </Button>
      );
    }

    // Teacher navigation
    if (isTeacher) {
      buttons.push(
        <Button
          key="teacher-dashboard"
          color="inherit"
          component={Link}
          to="/teacher/dashboard"
          startIcon={<Dashboard />}
          style={{ marginLeft: '1rem' }}
        >
          {intl.formatMessage(messages.teacherDashboard)}
        </Button>,
        <Button
          key="my-students"
          color="inherit"
          component={Link}
          to="/teacher/students"
          startIcon={<People />}
          style={{ marginLeft: '1rem' }}
        >
          {intl.formatMessage(messages.myStudents)}
        </Button>
      );
    }

    // Parent navigation
    if (isParent) {
      buttons.push(
        <Button
          key="parent-dashboard"
          color="inherit"
          component={Link}
          to="/parent/dashboard"
          startIcon={<Dashboard />}
          style={{ marginLeft: '1rem' }}
        >
          {intl.formatMessage(messages.parentDashboard)}
        </Button>,
        <Button
          key="my-children"
          color="inherit"
          component={Link}
          to="/parent/children"
          startIcon={<People />}
          style={{ marginLeft: '1rem' }}
        >
          {intl.formatMessage(messages.myChildren)}
        </Button>
      );
    }

    // Student navigation
    if (isStudent) {
      buttons.push(
        <Button
          key="student-dashboard"
          color="inherit"
          component={Link}
          to="/student/dashboard"
          startIcon={<Dashboard />}
          style={{ marginLeft: '1rem' }}
        >
          {intl.formatMessage(messages.studentDashboard)}
        </Button>
      );
    }

    return buttons;
  };

  return (
    <AppBar position="static" color="primary">
      <Toolbar>
        <Typography variant="h6" style={{ flexGrow: 1 }}>
          Cboard AAC
        </Typography>

        {/* Navigation Buttons */}
        {renderNavigationButtons()}

        {/* User Menu */}
        <Box display="flex" alignItems="center" style={{ marginLeft: 'auto' }}>
          {userRoles.length > 0 && (
            <Box mr={2}>
              {userRoles.map((roleData, index) => (
                <Chip
                  key={index}
                  label={`${getRoleDisplay()}${roleData.organization_name ? ` - ${roleData.organization_name}` : ''}`}
                  size="small"
                  color="secondary"
                  variant="outlined"
                  style={{ marginLeft: '0.5rem' }}
                />
              ))}
            </Box>
          )}

          <IconButton
            color="inherit"
            onClick={handleMenuClick}
            aria-controls="user-menu"
            aria-haspopup="true"
          >
            <Avatar style={{ width: 32, height: 32 }}>
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </Avatar>
          </IconButton>

          <Menu
            id="user-menu"
            anchorEl={anchorEl}
            keepMounted
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem disabled>
              <Typography variant="body2" color="textSecondary">
                {user.name || user.email}
              </Typography>
            </MenuItem>

            {userRoles.map((roleData, index) => (
              <MenuItem key={index} disabled>
                <Typography variant="caption">
                  {roleData.role} {roleData.organization_name && `at ${roleData.organization_name}`}
                  {roleData.class_name && ` - ${roleData.class_name}`}
                </Typography>
              </MenuItem>
            ))}

            <Divider />

            <MenuItem component={Link} to="/settings" onClick={handleMenuClose}>
              <Settings style={{ marginRight: '0.5rem' }} />
              {intl.formatMessage(messages.settings)}
            </MenuItem>

            <MenuItem onClick={handleLogout}>
              <ExitToApp style={{ marginRight: '0.5rem' }} />
              {intl.formatMessage(messages.logout)}
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

RoleBasedNavbar.propTypes = {
  intl: intlShape.isRequired,
  user: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
  location: PropTypes.object.isRequired,
  onLogout: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
  user: state.user
});

const mapDispatchToProps = dispatch => ({
  onLogout: () => dispatch(logout())
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(injectIntl(withRouter(RoleBasedNavbar)));
