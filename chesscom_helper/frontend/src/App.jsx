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
import Home from './pages/Home';
import Register from './pages/Register';
import Login from './pages/Login';
import LogoutConfirmation from './pages/LogoutConfirmation';

// Create your dark theme
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2ea44f',
    },
    background: {
      default: '#1b1f23',
      paper: '#161b22',
    },
    text: {
      primary: '#c9d1d9',
    },
  },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            {/* The "index" route means "/" with no extra path */}
            <Route index element={<Home />} />

            <Route path="users" element={<Users />} />
            <Route path="/user" element={<UserDetail />} />
            <Route path="/user/:username" element={<UserDetail />} />
            <Route path="/add-user" element={<AddUser />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/logout-confirmation" element={<LogoutConfirmation />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
