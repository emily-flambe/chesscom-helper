import { useEffect, useState } from 'react';
import axios from 'axios';

function App() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get('/api/chesscom-app/users/')
      .then(response => {
        console.log("API Response:", response.data);
        if (Array.isArray(response.data)) {
          setUsers(response.data);
        } else {
          console.warn('Unexpected response format:', response.data);
          setUsers([]);
        }
      })
      .catch(error => {
        console.error('Error fetching users:', error);
        setError('Failed to fetch users');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) return <h2>Loading users...</h2>;
  if (error) return <h2 style={{ color: 'red' }}>{error}</h2>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>Chess.com Users</h1>
      <table border="1" cellPadding="10" cellSpacing="0">
        <thead>
          <tr>
            <th>Player ID</th>
            <th>Username</th>
            <th>Name</th>
            <th>Followers</th>
            <th>League</th>
            <th>Status</th>
            <th>Last Online</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.player_id}>
              <td>{user.player_id}</td>
              <td>{user.username}</td>
              <td>{user.name || 'N/A'}</td>
              <td>{user.followers}</td>
              <td>{user.league}</td>
              <td>{user.status}</td>
              <td>{new Date(user.last_online * 1000).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
