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
    TextField,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Paper,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip,
    IconButton,
    AppBar,
    Toolbar,
    Fab,
    Tooltip
} from '@material-ui/core';
import {
    People,
    Search,
    Edit,
    Delete,
    ArrowBack,
    Settings,
    Add
} from '@material-ui/icons';
import { injectIntl, intlShape } from 'react-intl';

import { getUser } from '../../../components/App/App.selectors';
import API from '../../../api/api.js';
import messages from './AdminUsers.messages';

const AdminUsers = ({ intl, user, history }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [editDialog, setEditDialog] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userForm, setUserForm] = useState({
        name: '',
        email: '',
        role: 'student',
        is_active: true,
        is_verified: false
    });

    useEffect(() => {
        loadUsers();
    }, [search, roleFilter, statusFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const filters = {};
      if (search.trim()) filters.search = search.trim();
      if (roleFilter) filters.role = roleFilter;
      if (statusFilter !== '') filters.is_active = statusFilter === 'active';

      const response = await API.getAdminUsers(filters);
      if (response && response.users) {
        setUsers(response.users);
        // Reset pagination when loading new data
        setPage(0);
      } else {
        console.error('Failed to load users:', response);
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

    const handleBackToDashboard = () => {
        history.push('/admin/dashboard');
    };

    const handleEditUser = (user) => {
        setSelectedUser(user);
        setUserForm({
            name: user.name,
            email: user.email,
            role: user.role,
            is_active: user.is_active,
            is_verified: user.is_verified
        });
        setEditDialog(true);
    };

    const handleCloseEditDialog = () => {
        setEditDialog(false);
        setSelectedUser(null);
        setUserForm({
            name: '',
            email: '',
            role: 'student',
            is_active: true,
            is_verified: false
        });
    };

    const handleSaveUser = async () => {
        if (!selectedUser || !userForm.name.trim() || !userForm.email.trim()) return;

        try {
            const response = await API.updateAdminUser(selectedUser.id, userForm);
            if (response && response.status === 200) {
                loadUsers();
                handleCloseEditDialog();
            }
        } catch (error) {
            console.error('Failed to update user:', error);
        }
    };

    const handleDeleteUser = async (user) => {
        if (!window.confirm(intl.formatMessage(messages.confirmDelete))) return;

        try {
            const response = await API.deleteAdminUser(user.id);
            if (response && response.status === 200) {
                loadUsers();
            }
        } catch (error) {
            console.error('Failed to delete user:', error);
        }
    };

    const filteredUsers = users.filter(user => {
        // Search filter
        const matchesSearch = search === '' ||
            user.name?.toLowerCase().includes(search.toLowerCase()) ||
            user.email?.toLowerCase().includes(search.toLowerCase());

        // Role filter
        const matchesRole = roleFilter === '' || user.role === roleFilter;

        // Status filter (convert backend integer to boolean)
        const userActive = Boolean(user.is_active);
        const matchesStatus = statusFilter === '' ||
            (statusFilter === 'active' && userActive) ||
            (statusFilter === 'inactive' && !userActive);

        return matchesSearch && matchesRole && matchesStatus;
    });

    const paginatedUsers = filteredUsers.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
    );

    const getRoleColor = (role) => {
        switch (role) {
            case 'admin': return 'error';
            case 'teacher': return 'primary';
            case 'parent': return 'secondary';
            case 'student': return 'default';
            default: return 'default';
        }
    };

    const getStatusColor = (isActive) => {
        return isActive ? 'primary' : 'default';
    };

    if (loading) {
        return <div>Loading users...</div>;
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
                        {intl.formatMessage(messages.adminUsers)}
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
                        {intl.formatMessage(messages.userManagement)}
                    </Typography>
                </Box>

                {/* Filters */}
                <Paper style={{ padding: '1rem', marginBottom: '1rem' }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                label={intl.formatMessage(messages.search)}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                InputProps={{
                                    startAdornment: <Search style={{ marginRight: '0.5rem', color: 'gray' }} />
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                select
                                fullWidth
                                label={intl.formatMessage(messages.role)}
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                            >
                                <MenuItem value="">{intl.formatMessage(messages.allRoles)}</MenuItem>
                                <MenuItem value="admin">{intl.formatMessage(messages.admin)}</MenuItem>
                                <MenuItem value="teacher">{intl.formatMessage(messages.teacher)}</MenuItem>
                                <MenuItem value="parent">{intl.formatMessage(messages.parent)}</MenuItem>
                                <MenuItem value="student">{intl.formatMessage(messages.student)}</MenuItem>
                            </TextField>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                select
                                fullWidth
                                label={intl.formatMessage(messages.status)}
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <MenuItem value="">{intl.formatMessage(messages.allStatus)}</MenuItem>
                                <MenuItem value="active">{intl.formatMessage(messages.active)}</MenuItem>
                                <MenuItem value="inactive">{intl.formatMessage(messages.inactive)}</MenuItem>
                            </TextField>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Users Table */}
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>{intl.formatMessage(messages.name)}</TableCell>
                                <TableCell>{intl.formatMessage(messages.email)}</TableCell>
                                <TableCell>{intl.formatMessage(messages.role)}</TableCell>
                                <TableCell>{intl.formatMessage(messages.status)}</TableCell>
                                <TableCell>{intl.formatMessage(messages.createdAt)}</TableCell>
                                <TableCell>{intl.formatMessage(messages.lastLogin)}</TableCell>
                                <TableCell>{intl.formatMessage(messages.actions)}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {paginatedUsers.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <Box display="flex" alignItems="center">
                                            <People style={{ marginRight: '0.5rem', color: 'gray' }} />
                                            {user.name}
                                        </Box>
                                    </TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={intl.formatMessage(messages[user.role] || messages.student)}
                                            color={getRoleColor(user.role)}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={user.is_active ? intl.formatMessage(messages.active) : intl.formatMessage(messages.inactive)}
                                            color={getStatusColor(user.is_active)}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                                    </TableCell>
                                    <TableCell>
                                        {user.last_login ? new Date(user.last_login).toLocaleDateString() : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <IconButton size="small" onClick={() => handleEditUser(user)}>
                                            <Edit />
                                        </IconButton>
                                        <IconButton size="small" onClick={() => handleDeleteUser(user)}>
                                            <Delete />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {paginatedUsers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} align="center">
                                        {intl.formatMessage(messages.noUsersFound)}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <TablePagination
                        component="div"
                        count={filteredUsers.length}
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

                {/* Edit User Dialog */}
                <Dialog
                    open={editDialog}
                    onClose={handleCloseEditDialog}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>
                        {intl.formatMessage(messages.editUser)}
                    </DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            margin="dense"
                            label={intl.formatMessage(messages.name)}
                            fullWidth
                            value={userForm.name}
                            onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                        />
                        <TextField
                            margin="dense"
                            label={intl.formatMessage(messages.email)}
                            type="email"
                            fullWidth
                            value={userForm.email}
                            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                        />
                        <TextField
                            margin="dense"
                            label={intl.formatMessage(messages.role)}
                            select
                            fullWidth
                            value={userForm.role}
                            onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                        >
                            <MenuItem value="admin">{intl.formatMessage(messages.admin)}</MenuItem>
                            <MenuItem value="teacher">{intl.formatMessage(messages.teacher)}</MenuItem>
                            <MenuItem value="parent">{intl.formatMessage(messages.parent)}</MenuItem>
                            <MenuItem value="student">{intl.formatMessage(messages.student)}</MenuItem>
                        </TextField>
                        <TextField
                            margin="dense"
                            label={intl.formatMessage(messages.status)}
                            select
                            fullWidth
                            value={userForm.is_active ? 'active' : 'inactive'}
                            onChange={(e) => setUserForm({ ...userForm, is_active: e.target.value === 'active' })}
                        >
                            <MenuItem value="active">{intl.formatMessage(messages.active)}</MenuItem>
                            <MenuItem value="inactive">{intl.formatMessage(messages.inactive)}</MenuItem>
                        </TextField>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseEditDialog}>
                            {intl.formatMessage(messages.cancel)}
                        </Button>
                        <Button onClick={handleSaveUser} color="primary" variant="contained">
                            {intl.formatMessage(messages.save)}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Floating Action Button */}
                <Tooltip title={intl.formatMessage(messages.refreshUsers)}>
                    <Fab
                        color="primary"
                        style={{ position: 'fixed', bottom: '2rem', right: '2rem' }}
                        onClick={loadUsers}
                    >
                        <Search />
                    </Fab>
                </Tooltip>
            </Box>
        </Box>
    );
};

AdminUsers.propTypes = {
    intl: intlShape.isRequired,
    user: PropTypes.object.isRequired,
    history: PropTypes.object.isRequired
};

const mapStateToProps = state => ({
    user: getUser(state)
});

export default connect(mapStateToProps)(
    injectIntl(withRouter(AdminUsers))
);
