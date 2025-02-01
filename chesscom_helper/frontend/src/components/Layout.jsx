import { Link, Outlet } from 'react-router-dom';
import './Layout.css';

export default function Layout() {
  return (
    <div className="layout-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <nav>
          <Link to="/">Home</Link>
          <Link to="/users">Users List</Link>
          <Link to="/user">User Detail</Link>
          <Link to="/add-user">Add User</Link>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
