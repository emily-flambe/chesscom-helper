import { Link, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{ width: '200px', background: '#f0f0f0', padding: '20px' }}>
        <nav style={{ display: 'flex', flexDirection: 'column' }}>
          <Link to="/">Home</Link>
          <Link to="/users">Chess.com Users</Link>
          <Link to="/other-app">Other App</Link>
          {/* Add more links as needed */}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '20px' }}>
        <Outlet />
      </main>
    </div>
  );
}
