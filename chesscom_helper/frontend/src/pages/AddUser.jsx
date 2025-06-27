// AddUser.jsx
import { useState } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
} from '@mui/material';

export default function AddUser() {
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAddUser = async (e) => {
    e.preventDefault();

    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    setLoading(true);
    setMessage('');
    setError(null);

    try {
      // Make a POST request to your Django route, e.g.:
      // /api/chesscom-app/add-user/
      const response = await axios.post('/api/chesscom-app/add-user/', {
        username,
      });
      // If successful, display a success message from the server or a fallback
      setMessage(response.data.message || 'User added!');
      // Optionally clear the input after success
      // setUsername('');
    } catch (err) {
      // If the server returns an error response, capture it
      if (err.response && err.response.data) {
        setError(err.response.data.error || 'An error occurred');
      } else {
        setError('Network error or server not reachable');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>
        Add Chess.com User
      </Typography>

      <Box
        component="form"
        onSubmit={handleAddUser}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          maxWidth: 400, // limit width so it’s not too wide
        }}
      >
        <TextField
          label="Enter Chess.com username"
          variant="outlined"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          disabled={loading}
        />
        <Button
          variant="contained"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Adding...' : 'Add User'}
        </Button>
      </Box>

      {/* Success or Error Messages */}
      {message && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {message}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}
