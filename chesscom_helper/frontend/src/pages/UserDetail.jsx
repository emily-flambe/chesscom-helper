import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
} from '@mui/material';

export default function UserDetail() {
  const { username: urlUsername } = useParams();
  const [username, setUsername] = useState(urlUsername || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 1) Add a new piece of state for a “just added” message
  const [addedMessage, setAddedMessage] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    if (urlUsername) {
      fetchUser(urlUsername);
    }
  }, [urlUsername]);

  const fetchUser = async (searchUsername) => {
    if (!searchUsername.trim()) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);
    setError(null);
    setUser(null);
    setAddedMessage(''); // clear any old success message

    try {
      // Attempt to GET existing user
      const response = await axios.get(`/api/chesscom-app/user/${searchUsername}/`);
      setUser(response.data);
    } catch (err) {
      // If user is not found (404), auto-add them
      if (err.response && err.response.status === 404) {
        try {
          await axios.post('/api/chesscom-app/add-user/', {
            username: searchUsername,
          });
          // 2) Set the message that user was added
          setAddedMessage(`User "${searchUsername}" was added to your list!`);

          // Re-fetch the newly added user
          const secondResponse = await axios.get(`/api/chesscom-app/user/${searchUsername}/`);
          setUser(secondResponse.data);
        } catch (err2) {
          console.error('Error adding user or fetching newly added user:', err2);
          setError('User not found or an error occurred.');
        }
      } else {
        // Some other error (500, network error, etc.)
        console.error('Error fetching user details:', err);
        setError('User not found or an error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (username) {
      navigate(`/user/${username}`);
      fetchUser(username);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>
        Search Chess.com User
      </Typography>

      <Box
        component="form"
        onSubmit={handleSearch}
        sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}
      >
        <TextField
          label="Enter username..."
          variant="outlined"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loading}
        />
        <Button variant="contained" type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </Box>

      {/* If there's a global error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 3) If user was successfully added */}
      {addedMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {addedMessage}
        </Alert>
      )}

      {loading && <Typography>Loading user details...</Typography>}

      {user && (
        <>
          <Typography variant="h5" gutterBottom>
            User Details
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <strong>Player ID</strong>
                  </TableCell>
                  <TableCell>{user.player_id}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Username</strong>
                  </TableCell>
                  <TableCell>{user.username}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Name</strong>
                  </TableCell>
                  <TableCell>{user.name || 'N/A'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Followers</strong>
                  </TableCell>
                  <TableCell>{user.followers}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Country</strong>
                  </TableCell>
                  <TableCell>{user.country}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>League</strong>
                  </TableCell>
                  <TableCell>{user.league}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Last Online</strong>
                  </TableCell>
                  <TableCell>
                    {new Date(user.last_online * 1000).toLocaleString()}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Is Streamer</strong>
                  </TableCell>
                  <TableCell>{user.is_streamer ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
