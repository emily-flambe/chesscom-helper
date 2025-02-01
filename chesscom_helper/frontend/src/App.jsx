// App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Material UI imports
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Import the layout and pages
import Layout from './components/Layout';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';
import AddUser from './pages/AddUser';

// Define a simple "Home" component
function Home() {
  return (
    <div>
      <h1>Welcome to Chesscom Helper: Your Chesst Friend :)))</h1>
      <p>Select something from the sidebar!</p>
    </div>
  );
}

// Create your dark theme right here in the same file
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2ea44f', // Your green accent
    },
    background: {
      default: '#1b1f23', // Body background
      paper: '#161b22',   // Paper/Card background
    },
    text: {
      primary: '#c9d1d9', // Your existing text color
    },
  },
});

export default function App() {
  return (
    // Wrap your entire app in ThemeProvider
    <ThemeProvider theme={theme}>
      {/* CssBaseline applies MUI’s global baseline & dark mode defaults */}
      <CssBaseline />

      <BrowserRouter>
        <Routes>
          {/* The "Layout" route wraps the nested routes below */}
          <Route path="/" element={<Layout />}>
            {/* The "index" route means when you visit "/" with no extra path */}
            <Route index element={<Home />} />
            <Route path="users" element={<Users />} />
            <Route path="/user" element={<UserDetail />} />
            <Route path="/user/:username" element={<UserDetail />} />
            <Route path="/add-user" element={<AddUser />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
