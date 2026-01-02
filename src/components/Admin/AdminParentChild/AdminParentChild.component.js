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
    Tooltip,
    FormControlLabel,
    Switch
} from '@material-ui/core';
import {
    People,
    Search,
    Edit,
    Delete,
    ArrowBack,
    Settings,
    Add,
    PersonAdd,
    SupervisorAccount
} from '@material-ui/icons';
import { injectIntl, intlShape } from 'react-intl';

import { getUser } from '../../../components/App/App.selectors';
import API from '../../../api/api.js';
import messages from './AdminParentChild.messages';

const AdminParentChild = ({ intl, user, history }) => {
    const [relationships, setRelationships] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [search, setSearch] = useState('');
    const [editDialog, setEditDialog] = useState(false);
    const [createDialog, setCreateDialog] = useState(false);
    const [selectedRelationship, setSelectedRelationship] = useState(null);
    const [users, setUsers] = useState([]);

    // Form states
    const [relationshipForm, setRelationshipForm] = useState({
        parent_user_id: '',
        child_user_id: '',
        relationship_type: 'guardian',
        custody_type: 'full',
        can_manage_profile: true,
        can_view_progress: true,
        can_receive_notifications: true,
        emergency_contact: false,
        notes: ''
    });

    useEffect(() => {
        loadRelationships();
        loadUsers();
    }, []);

    const loadRelationships = async () => {
        try {
            setLoading(true);
            const response = await API.getAdminParentChildRelationships();
            if (response && response.relationships) {
                setRelationships(response.relationships);
            } else {
                console.error('Failed to load relationships:', response);
                setRelationships([]);
            }
        } catch (error) {
            console.error('Failed to load relationships:', error);
            setRelationships([]);
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async () => {
        try {
            // Get all users for parent/child selection
            const response = await API.getAdminUsers({ limit: 1000 }); // Large limit to get all users
            if (response && response.users) {
                setUsers(response.users);
            }
        } catch (error) {
            console.error('Failed to load users:', error);
            setUsers([]);
        }
    };

    const handleBackToDashboard = () => {
        history.push('/admin/dashboard');
    };

    const handleCreateRelationship = () => {
        setRelationshipForm({
            parent_user_id: '',
            child_user_id: '',
            relationship_type: 'guardian',
            custody_type: 'full',
            can_manage_profile: true,
            can_view_progress: true,
            can_receive_notifications: true,
            emergency_contact: false,
            notes: ''
        });
        setCreateDialog(true);
    };

    const handleEditRelationship = (relationship) => {
        setSelectedRelationship(relationship);
        setRelationshipForm({
            parent_user_id: relationship.parent_user_id,
            child_user_id: relationship.child_user_id,
            relationship_type: relationship.relationship_type || 'guardian',
            custody_type: relationship.custody_type || 'full',
            can_manage_profile: Boolean(relationship.can_manage_profile),
            can_view_progress: Boolean(relationship.can_view_progress),
            can_receive_notifications: Boolean(relationship.can_receive_notifications),
            emergency_contact: Boolean(relationship.emergency_contact),
            notes: relationship.notes || ''
        });
        setEditDialog(true);
    };

    const handleCloseCreateDialog = () => {
        setCreateDialog(false);
        setRelationshipForm({
            parent_user_id: '',
            child_user_id: '',
            relationship_type: 'guardian',
            custody_type: 'full',
            can_manage_profile: true,
            can_view_progress: true,
            can_receive_notifications: true,
            emergency_contact: false,
            notes: ''
        });
    };

    const handleCloseEditDialog = () => {
        setEditDialog(false);
        setSelectedRelationship(null);
        setRelationshipForm({
            parent_user_id: '',
            child_user_id: '',
            relationship_type: 'guardian',
            custody_type: 'full',
            can_manage_profile: true,
            can_view_progress: true,
            can_receive_notifications: true,
            emergency_contact: false,
            notes: ''
        });
    };

    const handleSaveRelationship = async () => {
        if (!relationshipForm.parent_user_id || !relationshipForm.child_user_id) {
            alert(intl.formatMessage(messages.selectParentAndChild));
            return;
        }

        if (relationshipForm.parent_user_id === relationshipForm.child_user_id) {
            alert(intl.formatMessage(messages.parentChildCannotBeSame));
            return;
        }

        try {
            if (createDialog) {
                // Create new relationship
                const response = await API.createAdminParentChildRelationship(relationshipForm);
                if (response && response.success !== false) {
                    loadRelationships();
                    handleCloseCreateDialog();
                }
            } else if (editDialog && selectedRelationship) {
                // Update existing relationship
                const updateData = {
                    relationship_type: relationshipForm.relationship_type,
                    custody_type: relationshipForm.custody_type,
                    can_manage_profile: relationshipForm.can_manage_profile,
                    can_view_progress: relationshipForm.can_view_progress,
                    can_receive_notifications: relationshipForm.can_receive_notifications,
                    emergency_contact: relationshipForm.emergency_contact,
                    notes: relationshipForm.notes
                };
                const response = await API.updateAdminParentChildRelationship(selectedRelationship.id, updateData);
                if (response && response.success !== false) {
                    loadRelationships();
                    handleCloseEditDialog();
                }
            }
        } catch (error) {
            console.error('Failed to save relationship:', error);
            alert(intl.formatMessage(messages.saveFailed));
        }
    };

    const handleDeleteRelationship = async (relationship) => {
        if (!window.confirm(intl.formatMessage(messages.confirmDelete))) return;

        try {
            const response = await API.deleteAdminParentChildRelationship(relationship.id);
            if (response && response.success !== false) {
                loadRelationships();
            }
        } catch (error) {
            console.error('Failed to delete relationship:', error);
        }
    };

    const filteredRelationships = relationships.filter(relationship => {
        const searchLower = search.toLowerCase();
        return (
            relationship.parent_name?.toLowerCase().includes(searchLower) ||
            relationship.parent_email?.toLowerCase().includes(searchLower) ||
            relationship.child_name?.toLowerCase().includes(searchLower) ||
            relationship.child_email?.toLowerCase().includes(searchLower) ||
            relationship.relationship_type?.toLowerCase().includes(searchLower)
        );
    });

    const paginatedRelationships = filteredRelationships.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
    );

    const getRelationshipTypeColor = (type) => {
        switch (type) {
            case 'mother': return 'primary';
            case 'father': return 'secondary';
            case 'guardian': return 'default';
            default: return 'default';
        }
    };

    const getParentOptions = () => {
        return users.filter(u => u.role === 'parent' || u.role === 'admin');
    };

    const getChildOptions = () => {
        return users.filter(u => u.role === 'student');
    };

    if (loading) {
        return <div>Loading relationships...</div>;
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
                        {intl.formatMessage(messages.adminParentChild)}
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
                        {intl.formatMessage(messages.parentChildManagement)}
                    </Typography>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<PersonAdd />}
                        onClick={handleCreateRelationship}
                    >
                        {intl.formatMessage(messages.createRelationship)}
                    </Button>
                </Box>

                {/* Search */}
                <Paper style={{ padding: '1rem', marginBottom: '1rem' }}>
                    <TextField
                        fullWidth
                        label={intl.formatMessage(messages.search)}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        InputProps={{
                            startAdornment: <Search style={{ marginRight: '0.5rem', color: 'gray' }} />
                        }}
                    />
                </Paper>

                {/* Relationships Table */}
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>{intl.formatMessage(messages.parent)}</TableCell>
                                <TableCell>{intl.formatMessage(messages.relationship)}</TableCell>
                                <TableCell>{intl.formatMessage(messages.child)}</TableCell>
                                <TableCell>{intl.formatMessage(messages.permissions)}</TableCell>
                                <TableCell>{intl.formatMessage(messages.createdAt)}</TableCell>
                                <TableCell>{intl.formatMessage(messages.actions)}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {paginatedRelationships.map((relationship) => (
                                <TableRow key={relationship.id}>
                                    <TableCell>
                                        <Box display="flex" alignItems="center">
                                            <People style={{ marginRight: '0.5rem', color: 'gray' }} />
                                            <Box>
                                                <Typography variant="body2" style={{ fontWeight: 'bold' }}>
                                                    {relationship.parent_name}
                                                </Typography>
                                                <Typography variant="caption" color="textSecondary">
                                                    {relationship.parent_email}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={intl.formatMessage(messages[relationship.relationship_type] || messages.guardian)}
                                            color={getRelationshipTypeColor(relationship.relationship_type)}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Box display="flex" alignItems="center">
                                            <People style={{ marginRight: '0.5rem', color: 'gray' }} />
                                            <Box>
                                                <Typography variant="body2" style={{ fontWeight: 'bold' }}>
                                                    {relationship.child_name}
                                                </Typography>
                                                <Typography variant="caption" color="textSecondary">
                                                    {relationship.child_email}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Box display="flex" flexWrap="wrap" gap={0.5}>
                                            {relationship.can_manage_profile && (
                                                <Chip label={intl.formatMessage(messages.manageProfile)} size="small" variant="outlined" />
                                            )}
                                            {relationship.can_view_progress && (
                                                <Chip label={intl.formatMessage(messages.viewProgress)} size="small" variant="outlined" />
                                            )}
                                            {relationship.emergency_contact && (
                                                <Chip label={intl.formatMessage(messages.emergency)} size="small" color="error" />
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        {relationship.created_at ? new Date(relationship.created_at).toLocaleDateString() : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <IconButton size="small" onClick={() => handleEditRelationship(relationship)}>
                                            <Edit />
                                        </IconButton>
                                        <IconButton size="small" onClick={() => handleDeleteRelationship(relationship)}>
                                            <Delete />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {paginatedRelationships.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} align="center">
                                        {intl.formatMessage(messages.noRelationshipsFound)}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <TablePagination
                        component="div"
                        count={filteredRelationships.length}
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

                {/* Create Relationship Dialog */}
                <Dialog
                    open={createDialog}
                    onClose={handleCloseCreateDialog}
                    maxWidth="md"
                    fullWidth
                >
                    <DialogTitle>
                        {intl.formatMessage(messages.createRelationship)}
                    </DialogTitle>
                    <DialogContent>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    select
                                    fullWidth
                                    label={intl.formatMessage(messages.selectParent)}
                                    value={relationshipForm.parent_user_id}
                                    onChange={(e) => setRelationshipForm({ ...relationshipForm, parent_user_id: e.target.value })}
                                    required
                                >
                                    {getParentOptions().map((user) => (
                                        <MenuItem key={user.id} value={user.id}>
                                            {user.name} ({user.email})
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    select
                                    fullWidth
                                    label={intl.formatMessage(messages.selectChild)}
                                    value={relationshipForm.child_user_id}
                                    onChange={(e) => setRelationshipForm({ ...relationshipForm, child_user_id: e.target.value })}
                                    required
                                >
                                    {getChildOptions().map((user) => (
                                        <MenuItem key={user.id} value={user.id}>
                                            {user.name} ({user.email})
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    select
                                    fullWidth
                                    label={intl.formatMessage(messages.relationshipType)}
                                    value={relationshipForm.relationship_type}
                                    onChange={(e) => setRelationshipForm({ ...relationshipForm, relationship_type: e.target.value })}
                                >
                                    <MenuItem value="mother">{intl.formatMessage(messages.mother)}</MenuItem>
                                    <MenuItem value="father">{intl.formatMessage(messages.father)}</MenuItem>
                                    <MenuItem value="guardian">{intl.formatMessage(messages.guardian)}</MenuItem>
                                    <MenuItem value="grandparent">{intl.formatMessage(messages.grandparent)}</MenuItem>
                                    <MenuItem value="other">{intl.formatMessage(messages.other)}</MenuItem>
                                </TextField>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    select
                                    fullWidth
                                    label={intl.formatMessage(messages.custodyType)}
                                    value={relationshipForm.custody_type}
                                    onChange={(e) => setRelationshipForm({ ...relationshipForm, custody_type: e.target.value })}
                                >
                                    <MenuItem value="full">{intl.formatMessage(messages.fullCustody)}</MenuItem>
                                    <MenuItem value="joint">{intl.formatMessage(messages.jointCustody)}</MenuItem>
                                    <MenuItem value="partial">{intl.formatMessage(messages.partialCustody)}</MenuItem>
                                </TextField>
                            </Grid>
                            <Grid item xs={12}>
                                <Typography variant="subtitle1" gutterBottom>
                                    {intl.formatMessage(messages.permissions)}
                                </Typography>
                                <Box display="flex" flexDirection="column" gap={1}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={relationshipForm.can_manage_profile}
                                                onChange={(e) => setRelationshipForm({ ...relationshipForm, can_manage_profile: e.target.checked })}
                                                color="primary"
                                            />
                                        }
                                        label={intl.formatMessage(messages.canManageProfile)}
                                    />
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={relationshipForm.can_view_progress}
                                                onChange={(e) => setRelationshipForm({ ...relationshipForm, can_view_progress: e.target.checked })}
                                                color="primary"
                                            />
                                        }
                                        label={intl.formatMessage(messages.canViewProgress)}
                                    />
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={relationshipForm.can_receive_notifications}
                                                onChange={(e) => setRelationshipForm({ ...relationshipForm, can_receive_notifications: e.target.checked })}
                                                color="primary"
                                            />
                                        }
                                        label={intl.formatMessage(messages.canReceiveNotifications)}
                                    />
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={relationshipForm.emergency_contact}
                                                onChange={(e) => setRelationshipForm({ ...relationshipForm, emergency_contact: e.target.checked })}
                                                color="primary"
                                            />
                                        }
                                        label={intl.formatMessage(messages.emergencyContact)}
                                    />
                                </Box>
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={3}
                                    label={intl.formatMessage(messages.notes)}
                                    value={relationshipForm.notes}
                                    onChange={(e) => setRelationshipForm({ ...relationshipForm, notes: e.target.value })}
                                    placeholder={intl.formatMessage(messages.notesPlaceholder)}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseCreateDialog}>
                            {intl.formatMessage(messages.cancel)}
                        </Button>
                        <Button onClick={handleSaveRelationship} color="primary" variant="contained">
                            {intl.formatMessage(messages.create)}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Edit Relationship Dialog */}
                <Dialog
                    open={editDialog}
                    onClose={handleCloseEditDialog}
                    maxWidth="md"
                    fullWidth
                >
                    <DialogTitle>
                        {intl.formatMessage(messages.editRelationship)}
                    </DialogTitle>
                    <DialogContent>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label={intl.formatMessage(messages.parent)}
                                    value={`${selectedRelationship?.parent_name} (${selectedRelationship?.parent_email})`}
                                    disabled
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label={intl.formatMessage(messages.child)}
                                    value={`${selectedRelationship?.child_name} (${selectedRelationship?.child_email})`}
                                    disabled
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    select
                                    fullWidth
                                    label={intl.formatMessage(messages.relationshipType)}
                                    value={relationshipForm.relationship_type}
                                    onChange={(e) => setRelationshipForm({ ...relationshipForm, relationship_type: e.target.value })}
                                >
                                    <MenuItem value="mother">{intl.formatMessage(messages.mother)}</MenuItem>
                                    <MenuItem value="father">{intl.formatMessage(messages.father)}</MenuItem>
                                    <MenuItem value="guardian">{intl.formatMessage(messages.guardian)}</MenuItem>
                                    <MenuItem value="grandparent">{intl.formatMessage(messages.grandparent)}</MenuItem>
                                    <MenuItem value="other">{intl.formatMessage(messages.other)}</MenuItem>
                                </TextField>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    select
                                    fullWidth
                                    label={intl.formatMessage(messages.custodyType)}
                                    value={relationshipForm.custody_type}
                                    onChange={(e) => setRelationshipForm({ ...relationshipForm, custody_type: e.target.value })}
                                >
                                    <MenuItem value="full">{intl.formatMessage(messages.fullCustody)}</MenuItem>
                                    <MenuItem value="joint">{intl.formatMessage(messages.jointCustody)}</MenuItem>
                                    <MenuItem value="partial">{intl.formatMessage(messages.partialCustody)}</MenuItem>
                                </TextField>
                            </Grid>
                            <Grid item xs={12}>
                                <Typography variant="subtitle1" gutterBottom>
                                    {intl.formatMessage(messages.permissions)}
                                </Typography>
                                <Box display="flex" flexDirection="column" gap={1}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={relationshipForm.can_manage_profile}
                                                onChange={(e) => setRelationshipForm({ ...relationshipForm, can_manage_profile: e.target.checked })}
                                                color="primary"
                                            />
                                        }
                                        label={intl.formatMessage(messages.canManageProfile)}
                                    />
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={relationshipForm.can_view_progress}
                                                onChange={(e) => setRelationshipForm({ ...relationshipForm, can_view_progress: e.target.checked })}
                                                color="primary"
                                            />
                                        }
                                        label={intl.formatMessage(messages.canViewProgress)}
                                    />
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={relationshipForm.can_receive_notifications}
                                                onChange={(e) => setRelationshipForm({ ...relationshipForm, can_receive_notifications: e.target.checked })}
                                                color="primary"
                                            />
                                        }
                                        label={intl.formatMessage(messages.canReceiveNotifications)}
                                    />
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={relationshipForm.emergency_contact}
                                                onChange={(e) => setRelationshipForm({ ...relationshipForm, emergency_contact: e.target.checked })}
                                                color="primary"
                                            />
                                        }
                                        label={intl.formatMessage(messages.emergencyContact)}
                                    />
                                </Box>
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={3}
                                    label={intl.formatMessage(messages.notes)}
                                    value={relationshipForm.notes}
                                    onChange={(e) => setRelationshipForm({ ...relationshipForm, notes: e.target.value })}
                                    placeholder={intl.formatMessage(messages.notesPlaceholder)}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseEditDialog}>
                            {intl.formatMessage(messages.cancel)}
                        </Button>
                        <Button onClick={handleSaveRelationship} color="primary" variant="contained">
                            {intl.formatMessage(messages.save)}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Floating Action Button */}
                <Tooltip title={intl.formatMessage(messages.refreshRelationships)}>
                    <Fab
                        color="primary"
                        style={{ position: 'fixed', bottom: '2rem', right: '2rem' }}
                        onClick={loadRelationships}
                    >
                        <Search />
                    </Fab>
                </Tooltip>
            </Box>
        </Box>
    );
};

AdminParentChild.propTypes = {
    intl: intlShape.isRequired,
    user: PropTypes.object.isRequired,
    history: PropTypes.object.isRequired
};

const mapStateToProps = state => ({
    user: getUser(state)
});

export default connect(mapStateToProps)(
    injectIntl(withRouter(AdminParentChild))
);
