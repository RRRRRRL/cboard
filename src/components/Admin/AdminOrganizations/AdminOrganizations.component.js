import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import { injectIntl, intlShape } from 'react-intl';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Fab,
  Tooltip,
  AppBar,
  Toolbar,
  IconButton
} from '@material-ui/core';
import {
  School,
  People,
  Add,
  ArrowBack,
  Settings,
  Edit,
  Delete
} from '@material-ui/icons';
import { getUser } from '../../../components/App/App.selectors';
import API from '../../../api/api.js';
import messages from './AdminOrganizations.messages.js';

const AdminOrganizations = ({ intl, user, history, match }) => {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [newOrg, setNewOrg] = useState({
    name: '',
    description: '',
    address: '',
    contact_email: ''
  });

  // Check if this is the "new" route
  const isNewOrgRoute = match.path.includes('/new');

  useEffect(() => {
    if (isNewOrgRoute) {
      setCreateDialog(true);
    } else {
      loadOrganizations();
    }
  }, [isNewOrgRoute]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const response = await API.getAdminOrganizations();
      if (response && response.success && response.data) {
        setOrganizations(response.data.organizations || []);
      } else {
        console.error('Failed to load organizations:', response);
        setOrganizations([]);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrganization = async () => {
    if (!newOrg.name.trim()) return;

    try {
      const response = await API.createOrganization(newOrg);
      if (response.success) {
        setCreateDialog(false);
        setNewOrg({
          name: '',
          description: '',
          address: '',
          contact_email: ''
        });
        loadOrganizations();
        // If we were on the /new route, redirect to the list
        if (isNewOrgRoute) {
          history.push('/admin/organizations');
        }
      }
    } catch (error) {
      console.error('Failed to create organization:', error);
    }
  };

  const handleBackToDashboard = () => {
    history.push('/admin/dashboard');
  };

  const handleEditOrganization = (org) => {
    // TODO: Implement edit functionality
    console.log('Edit organization:', org);
  };

  const handleDeleteOrganization = (org) => {
    // TODO: Implement delete functionality
    console.log('Delete organization:', org);
  };

  if (loading && !isNewOrgRoute) {
    return <div>Loading organizations...</div>;
  }

  return (
    <Box>
      {/* Navigation Bar */}
      <AppBar position="static" color="primary">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleBackToDashboard}
            aria-label="back to dashboard"
          >
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" style={{ flexGrow: 1 }}>
            {intl.formatMessage(messages.adminOrganizations)}
          </Typography>
          <IconButton color="inherit" aria-label="settings">
            <Settings />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box p={3}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">
            {intl.formatMessage(messages.organizationManagement)}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={() => setCreateDialog(true)}
          >
            {intl.formatMessage(messages.createOrganization)}
          </Button>
        </Box>

        {/* Organizations List */}
        <Grid container spacing={3}>
          {organizations.map((org) => (
            <Grid item xs={12} md={6} key={org.id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box display="flex" alignItems="center">
                      <Avatar style={{ marginRight: '1rem', backgroundColor: '#1976d2' }}>
                        <School />
                      </Avatar>
                      <Box>
                        <Typography variant="h6">{org.name}</Typography>
                        <Typography variant="body2" color="textSecondary">
                          {org.contact_email}
                        </Typography>
                      </Box>
                    </Box>
                    <Box>
                      <IconButton size="small" onClick={() => handleEditOrganization(org)}>
                        <Edit />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteOrganization(org)}>
                        <Delete />
                      </IconButton>
                    </Box>
                  </Box>

                  <Typography variant="body2" color="textSecondary" paragraph>
                    {org.description}
                  </Typography>

                  <Typography variant="body2" color="textSecondary">
                    {org.address}
                  </Typography>

                  <Box display="flex" justifyContent="space-between" mt={2}>
                    <Box display="flex" alignItems="center">
                      <People fontSize="small" style={{ marginRight: '0.25rem' }} />
                      <Typography variant="body2">
                        {org.user_count || 0} {intl.formatMessage(messages.users)}
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center">
                      <School fontSize="small" style={{ marginRight: '0.25rem' }} />
                      <Typography variant="body2">
                        {org.class_count || 0} {intl.formatMessage(messages.classes)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {organizations.length === 0 && !loading && (
          <Box textAlign="center" mt={4}>
            <Typography variant="h6" color="textSecondary">
              {intl.formatMessage(messages.noOrganizations)}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {intl.formatMessage(messages.createFirstOrganization)}
            </Typography>
          </Box>
        )}

        {/* Create Organization Dialog */}
        <Dialog
          open={createDialog}
          onClose={() => {
            setCreateDialog(false);
            if (isNewOrgRoute) {
              history.push('/admin/organizations');
            }
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {intl.formatMessage(messages.createOrganization)}
          </DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label={intl.formatMessage(messages.organizationName)}
              fullWidth
              value={newOrg.name}
              onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
            />
            <TextField
              margin="dense"
              label={intl.formatMessage(messages.description)}
              fullWidth
              multiline
              rows={3}
              value={newOrg.description}
              onChange={(e) => setNewOrg({ ...newOrg, description: e.target.value })}
            />
            <TextField
              margin="dense"
              label={intl.formatMessage(messages.address)}
              fullWidth
              value={newOrg.address}
              onChange={(e) => setNewOrg({ ...newOrg, address: e.target.value })}
            />
            <TextField
              margin="dense"
              label={intl.formatMessage(messages.contactEmail)}
              type="email"
              fullWidth
              value={newOrg.contact_email}
              onChange={(e) => setNewOrg({ ...newOrg, contact_email: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setCreateDialog(false);
              if (isNewOrgRoute) {
                history.push('/admin/organizations');
              }
            }}>
              {intl.formatMessage(messages.cancel)}
            </Button>
            <Button
              onClick={handleCreateOrganization}
              color="primary"
              variant="contained"
            >
              {intl.formatMessage(messages.create)}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Floating Action Button */}
        <Tooltip title={intl.formatMessage(messages.createOrganization)}>
          <Fab
            color="primary"
            style={{ position: 'fixed', bottom: '2rem', right: '2rem' }}
            onClick={() => setCreateDialog(true)}
          >
            <Add />
          </Fab>
        </Tooltip>
      </Box>
    </Box>
  );
};

AdminOrganizations.propTypes = {
  intl: intlShape.isRequired,
  user: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
  match: PropTypes.object.isRequired
};

const mapStateToProps = state => ({
  user: getUser(state)
});

export default connect(mapStateToProps)(
  injectIntl(withRouter(AdminOrganizations))
);
