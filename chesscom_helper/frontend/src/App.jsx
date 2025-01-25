import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Import the layout and pages
import Layout from './components/Layout';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';

function Home() {
  return (
    <div>
      <h1>Welcome to Chesscom Helper: Your Chesst Friend :)))</h1>
      <p>Select something from the sidebar!</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* The "Layout" route wraps the nested routes below */}
        <Route path="/" element={<Layout />}>
          {/* The "index" route means when you visit "/" with no extra path */}
          <Route index element={<Home />} />
          <Route path="users" element={<Users />} />
          <Route path="/user" element={<UserDetail />} />
          <Route path="/user/:username" element={<UserDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
