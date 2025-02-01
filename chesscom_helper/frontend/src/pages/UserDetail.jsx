import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function UserDetail() {
  const { username: urlUsername } = useParams(); // Get username from URL if available
  const [username, setUsername] = useState(urlUsername || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (urlUsername) {
      fetchUser(urlUsername);
    }
  }, [urlUsername]);

  const fetchUser = (searchUsername) => {
    if (!searchUsername.trim()) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);
    setError(null);
    setUser(null);

    axios
      .get(`/api/chesscom-app/user/${searchUsername}/`)
      .then((response) => {
        setUser(response.data);
      })
      .catch((err) => {
        console.error('Error fetching user details:', err);
        setError('User not found or an error occurred.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleSearch = (e) => {
    e.preventDefault(); // Prevent page reload
    if (username) {
      navigate(`/user/${username}`); // Update URL to reflect searched username
      fetchUser(username);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Search Chess.com User</h1>

      <form onSubmit={handleSearch} style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username..."
          style={{ padding: '10px', marginRight: '10px' }}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {loading && <h2>Loading user details...</h2>}

      {user && (
        <div>
          <h2>User Details</h2>
          <table border="1" cellPadding="10" cellSpacing="0">
            <tbody>
              <tr>
                <td><strong>Player ID</strong></td>
                <td>{user.player_id}</td>
              </tr>
              <tr>
                <td><strong>Username</strong></td>
                <td>{user.username}</td>
              </tr>
              <tr>
                <td><strong>Name</strong></td>
                <td>{user.name || 'N/A'}</td>
              </tr>
              <tr>
                <td><strong>Followers</strong></td>
                <td>{user.followers}</td>
              </tr>
              <tr>
                <td><strong>Country</strong></td>
                <td>{user.country}</td>
              </tr>
              <tr>
                <td><strong>League</strong></td>
                <td>{user.league}</td>
              </tr>
              <tr>
                <td><strong>Last Online</strong></td>
                <td>{new Date(user.last_online * 1000).toLocaleString()}</td>
              </tr>
              <tr>
                <td><strong>Is Streamer</strong></td>
                <td>{user.is_streamer ? 'Yes' : 'No'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
