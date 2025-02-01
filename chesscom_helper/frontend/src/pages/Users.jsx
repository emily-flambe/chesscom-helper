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
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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
  }, []);

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
      <Typography variant="h4" gutterBottom>
        Chess.com Users
      </Typography>

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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
