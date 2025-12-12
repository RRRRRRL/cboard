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
import TablePagination from '@material-ui/core/TablePagination';
import CircularProgress from '@material-ui/core/CircularProgress';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Chip from '@material-ui/core/Chip';
import IconButton from '@material-ui/core/IconButton';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import FullScreenDialog from '../../UI/FullScreenDialog';
import messages from './AdminPanel.messages';
import './AdminPanel.css';

const styles = theme => ({
  formControl: {
    margin: theme.spacing(1),
    minWidth: 200
  },
  tableContainer: {
    maxHeight: 600,
    marginTop: theme.spacing(2)
  },
  filterSection: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2)
  },
  statsSection: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    display: 'flex',
    gap: theme.spacing(2),
    flexWrap: 'wrap'
  },
  statCard: {
    padding: theme.spacing(2),
    minWidth: 150,
    textAlign: 'center'
  },
  roleChip: {
    margin: theme.spacing(0.5)
  }
});

function AdminPanel({
  onClose,
  users,
  pagination,
  loading,
  statistics,
  onLoadUsers,
  onLoadStatistics,
  onUpdateUser,
  onDeleteUser,
  classes,
  intl
}) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, search, roleFilter, activeFilter]);

  const loadData = () => {
    const filters = {
      page: page + 1,
      limit: rowsPerPage
    };
    if (search) filters.search = search;
    if (roleFilter) filters.role = roleFilter;
    if (activeFilter !== '') filters.is_active = activeFilter === 'active' ? 1 : 0;
    
    onLoadUsers(filters);
    onLoadStatistics();
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name || '',
      role: user.role || 'student',
      is_active: user.is_active === 1,
      is_verified: user.is_verified === 1,
      password: ''
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      await onUpdateUser(selectedUser.id, editForm);
      setEditDialogOpen(false);
      loadData();
    } catch (error) {
      alert(intl.formatMessage(messages.updateError));
    }
  };

  const handleDelete = async (userId) => {
    if (window.confirm(intl.formatMessage(messages.confirmDelete))) {
      try {
        await onDeleteUser(userId);
        loadData();
      } catch (error) {
        alert(intl.formatMessage(messages.deleteError));
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: 'secondary',
      teacher: 'primary',
      therapist: 'default',
      parent: 'default',
      student: 'default'
    };
    return colors[role] || 'default';
  };

  return (
    <FullScreenDialog
      open
      title={<FormattedMessage {...messages.adminPanel} />}
      onClose={onClose}
    >
      <div className="AdminPanel">
        {/* Statistics */}
        {statistics && (
          <Paper className={classes.statsSection}>
            <Paper className={classes.statCard}>
              <Typography variant="h6">{statistics.total_users || 0}</Typography>
              <Typography variant="caption">
                <FormattedMessage {...messages.totalUsers} />
              </Typography>
            </Paper>
            <Paper className={classes.statCard}>
              <Typography variant="h6">{statistics.active_users || 0}</Typography>
              <Typography variant="caption">
                <FormattedMessage {...messages.activeUsers} />
              </Typography>
            </Paper>
            <Paper className={classes.statCard}>
              <Typography variant="h6">{statistics.total_profiles || 0}</Typography>
              <Typography variant="caption">
                <FormattedMessage {...messages.totalProfiles} />
              </Typography>
            </Paper>
            <Paper className={classes.statCard}>
              <Typography variant="h6">{statistics.recent_registrations || 0}</Typography>
              <Typography variant="caption">
                <FormattedMessage {...messages.recentRegistrations} />
              </Typography>
            </Paper>
          </Paper>
        )}

        {/* Filters */}
        <Paper className={classes.filterSection}>
          <Typography variant="h6" gutterBottom>
            <FormattedMessage {...messages.filters} />
          </Typography>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
            <TextField
              label={<FormattedMessage {...messages.search} />}
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className={classes.formControl}
            />
            <FormControl className={classes.formControl}>
              <InputLabel>
                <FormattedMessage {...messages.role} />
              </InputLabel>
              <Select
                value={roleFilter}
                onChange={e => {
                  setRoleFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value=""><FormattedMessage {...messages.allRoles} /></MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="teacher">Teacher</MenuItem>
                <MenuItem value="therapist">Therapist</MenuItem>
                <MenuItem value="parent">Parent</MenuItem>
                <MenuItem value="student">Student</MenuItem>
              </Select>
            </FormControl>
            <FormControl className={classes.formControl}>
              <InputLabel>
                <FormattedMessage {...messages.status} />
              </InputLabel>
              <Select
                value={activeFilter}
                onChange={e => {
                  setActiveFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value=""><FormattedMessage {...messages.allStatus} /></MenuItem>
                <MenuItem value="active"><FormattedMessage {...messages.active} /></MenuItem>
                <MenuItem value="inactive"><FormattedMessage {...messages.inactive} /></MenuItem>
              </Select>
            </FormControl>
          </div>
        </Paper>

        {/* Users Table */}
        <Paper>
          <TableContainer className={classes.tableContainer}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell><FormattedMessage {...messages.email} /></TableCell>
                  <TableCell><FormattedMessage {...messages.name} /></TableCell>
                  <TableCell><FormattedMessage {...messages.role} /></TableCell>
                  <TableCell><FormattedMessage {...messages.status} /></TableCell>
                  <TableCell><FormattedMessage {...messages.profiles} /></TableCell>
                  <TableCell><FormattedMessage {...messages.createdAt} /></TableCell>
                  <TableCell><FormattedMessage {...messages.lastLogin} /></TableCell>
                  <TableCell><FormattedMessage {...messages.actions} /></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : users && users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.name || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={user.role}
                          color={getRoleColor(user.role)}
                          size="small"
                          className={classes.roleChip}
                        />
                      </TableCell>
                      <TableCell>
                        {user.is_active === 1 ? (
                          <Chip label={<FormattedMessage {...messages.active} />} color="primary" size="small" />
                        ) : (
                          <Chip label={<FormattedMessage {...messages.inactive} />} size="small" />
                        )}
                      </TableCell>
                      <TableCell>{user.profile_count || 0}</TableCell>
                      <TableCell>{formatDate(user.created_at)}</TableCell>
                      <TableCell>{formatDate(user.last_login)}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleEdit(user)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDelete(user.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <FormattedMessage {...messages.noUsers} />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {pagination && (
            <TablePagination
              component="div"
              count={pagination.total}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 20, 50, 100]}
            />
          )}
        </Paper>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <FormattedMessage {...messages.editUser} />
          </DialogTitle>
          <DialogContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '8px' }}>
              <TextField
                fullWidth
                label={<FormattedMessage {...messages.name} />}
                value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
              />
              <FormControl fullWidth>
                <InputLabel><FormattedMessage {...messages.role} /></InputLabel>
                <Select
                  value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="teacher">Teacher</MenuItem>
                  <MenuItem value="therapist">Therapist</MenuItem>
                  <MenuItem value="parent">Parent</MenuItem>
                  <MenuItem value="student">Student</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Switch
                    checked={editForm.is_active}
                    onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })}
                  />
                }
                label={<FormattedMessage {...messages.active} />}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={editForm.is_verified}
                    onChange={e => setEditForm({ ...editForm, is_verified: e.target.checked })}
                  />
                }
                label={<FormattedMessage {...messages.verified} />}
              />
              <TextField
                fullWidth
                type="password"
                label={<FormattedMessage {...messages.newPassword} />}
                value={editForm.password}
                onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                helperText={<FormattedMessage {...messages.passwordHelper} />}
              />
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>
              <FormattedMessage {...messages.cancel} />
            </Button>
            <Button onClick={handleSave} color="primary" variant="contained">
              <FormattedMessage {...messages.save} />
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </FullScreenDialog>
  );
}

AdminPanel.propTypes = {
  onClose: PropTypes.func.isRequired,
  users: PropTypes.array.isRequired,
  pagination: PropTypes.object,
  loading: PropTypes.bool.isRequired,
  statistics: PropTypes.object,
  onLoadUsers: PropTypes.func.isRequired,
  onLoadStatistics: PropTypes.func.isRequired,
  onUpdateUser: PropTypes.func.isRequired,
  onDeleteUser: PropTypes.func.isRequired,
  classes: PropTypes.object.isRequired,
  intl: intlShape.isRequired
};

export default withStyles(styles)(AdminPanel);

