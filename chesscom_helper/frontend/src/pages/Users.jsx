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
  Stack
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load initial user list on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Helper function to fetch user list
  const fetchUsers = () => {
    setLoading(true);
    setError(null);

    axios
      .get('/api/chesscom-app/users/')
      .then((response) => {
        if (Array.isArray(response.data)) {
          setUsers(response.data);
        } else {
          setUsers([]);
        }
      })
      .catch((err) => {
        setError('Failed to fetch users');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Refresh a single user
  const handleRefreshUser = async (username) => {
    setLoading(true);
    setError(null);

    try {
      await axios.post('/api/chesscom-app/add-user/', { username });
      fetchUsers();
    } catch (err) {
      console.error('Error refreshing user:', err);
      setError('Failed to refresh user data');
      setLoading(false);
    }
  };

  // Refresh ALL users
  const handleRefreshAll = async () => {
    setLoading(true);
    setError(null);

    try {
      await axios.post('/api/chesscom-app/refresh-all-users/');
      // or whatever your endpoint is named
      fetchUsers();
    } catch (err) {
      console.error('Error refreshing all users:', err);
      setError('Failed to refresh all user data');
      setLoading(false);
    }
  };

  // Loading State
  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6">Loading users...</Typography>
      </Box>
    );
  }

  // Error State
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
      <Typography variant="h4" gutterBottom>
        Chess.com Users
      </Typography>

      {/* "Refresh All" button row */}
      <Stack direction="row" sx={{ mb: 2 }} spacing={2}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleRefreshAll}
        >
          REFRESH ALL
        </Button>
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Player ID</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Followers</TableCell>
              <TableCell>League</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Online</TableCell>
              <TableCell>Actions</TableCell>
              <TableCell>Refresh</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
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
                  <Link
                    component={RouterLink}
                    to={`/user/${user.username}`}
                    underline="hover"
                  >
                    View Details
                  </Link>
                </TableCell>
                <TableCell>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleRefreshUser(user.username)}
                  >
                    Refresh
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
