// frontend/src/components/Header.jsx
import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Button, AppBar, Toolbar, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

const Header = () => {
  const { token, logout } = useContext(AuthContext);

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Chesscom Helper
        </Typography>
        {token ? (
          // If token exists, show Logout button
          <Button color="inherit" onClick={logout}>
            Logout
          </Button>
        ) : (
          // If no token, show Login and Register buttons
          <>
            <Button color="inherit" component={Link} to="/login">
              Login
            </Button>
            <Button color="inherit" component={Link} to="/register">
              Register
            </Button>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Header;
