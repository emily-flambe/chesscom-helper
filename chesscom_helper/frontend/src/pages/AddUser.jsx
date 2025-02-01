import { useState } from 'react';
import axios from 'axios';

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
      // Make a POST request to your Django route:
      // e.g., /api/chesscom-app/add-user/
      const response = await axios.post('/api/chesscom-app/add-user/', {
        username,
      });

      // If the response is successful, display a success message
      setMessage(response.data.message || 'User added!');
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
    <div>
      <h2>Add Chess.com User</h2>
      <form onSubmit={handleAddUser}>
        <input
          type="text"
          placeholder="Enter Chess.com username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Adding...' : 'Add User'}
        </button>
      </form>
      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
