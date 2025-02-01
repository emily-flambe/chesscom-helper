import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Link,
  Button,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [sortColumn, setSortColumn] = useState('last_online');
  const [sortOrder, setSortOrder] = useState('desc');

  // 1) Define a reusable fetchUsers function
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      // If you want to always refresh-all before fetching, 
      // you can do: await axios.post('/api/chesscom-app/refresh-all-users/');
      const response = await axios.get('/api/chesscom-app/users/');
      if (Array.isArray(response.data)) {
        setUsers(response.data);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  // 2) On mount, load the user list
  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3) Deletion logic
  const handleDeleteUser = async (username) => {
    setLoading(true);
    setError(null);
    try {
      await axios.post(`/api/chesscom-app/remove-user/${username}/`);
      // Re-fetch after delete
      await fetchUsers();
    } catch (err) {
      console.error(`Error removing user ${username}`, err);
      setError('Failed to remove user');
      setLoading(false);
    }
  };

  // Sorting logic
  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(columnKey);
      setSortOrder('asc');
    }
  };

  const sortedUsers = React.useMemo(() => {
    if (!sortColumn) return users;
    const copy = [...users];
    copy.sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [users, sortColumn, sortOrder]);

  // Render states
  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6">Loading users...</Typography>
      </Box>
    );
  }
  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" color="error">
          {error}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 4 }}>
        Chess.com Users
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell onClick={() => handleSort('player_id')} sx={{ cursor: 'pointer' }}>
                Player ID {sortColumn === 'player_id' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </TableCell>
              <TableCell onClick={() => handleSort('username')} sx={{ cursor: 'pointer' }}>
                Username {sortColumn === 'username' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </TableCell>
              <TableCell onClick={() => handleSort('name')} sx={{ cursor: 'pointer' }}>
                Name {sortColumn === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </TableCell>
              <TableCell onClick={() => handleSort('followers')} sx={{ cursor: 'pointer' }}>
                Followers {sortColumn === 'followers' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </TableCell>
              <TableCell onClick={() => handleSort('league')} sx={{ cursor: 'pointer' }}>
                League {sortColumn === 'league' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </TableCell>
              <TableCell onClick={() => handleSort('status')} sx={{ cursor: 'pointer' }}>
                Status {sortColumn === 'status' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </TableCell>
              <TableCell onClick={() => handleSort('last_online')} sx={{ cursor: 'pointer' }}>
                Last Online{' '}
                {sortColumn === 'last_online' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
              </TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedUsers.map((user) => (
              <TableRow key={user.player_id}>
                <TableCell>{user.player_id}</TableCell>
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.name || 'N/A'}</TableCell>
                <TableCell>{user.followers}</TableCell>
                <TableCell>{user.league}</TableCell>
                <TableCell>{user.status}</TableCell>
                <TableCell>
                  {new Date(user.last_online * 1000).toLocaleString()}
                </TableCell>
                <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Link component={RouterLink} to={`/user/${user.username}`} underline="hover">
                    View Details
                  </Link>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={() => handleDeleteUser(user.username)}
                  >
                    Delete
                  </Button>
                </Box>
              </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
