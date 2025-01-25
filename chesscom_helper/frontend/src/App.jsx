import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Import the layout and pages
import Layout from './components/Layout';
import Users from './pages/Users';
import OtherApp from './pages/OtherApp';

function Home() {
  return (
    <div>
      <h1>Welcome Home</h1>
      <p>Select an app from the sidebar!</p>
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
          <Route path="other-app" element={<OtherApp />} />

          {/* You can add more routes as needed */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
