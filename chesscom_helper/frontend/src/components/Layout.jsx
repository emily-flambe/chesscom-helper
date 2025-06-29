// Layout.jsx
import { useContext } from 'react';
import { Outlet, Link as RouterLink } from 'react-router-dom';
import { Drawer, List, ListItem, ListItemButton, ListItemText, Toolbar, Box } from '@mui/material';
import { AuthContext } from '../context/AuthContext';

export default function Layout() {
  const { token } = useContext(AuthContext);

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: 200,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 200,
            boxSizing: 'border-box',
            backgroundColor: 'var(--table-header-bg)',
          },
        }}
      >
        <Toolbar />
        <List>
          {token ? (
            <ListItem disablePadding>
              <ListItemButton component={RouterLink} to="/logout-confirmation">
                <ListItemText primary="Logout" />
              </ListItemButton>
            </ListItem>
          ) : (
            <ListItem disablePadding>
              <ListItemButton component={RouterLink} to="/login">
                <ListItemText primary="Login/Register" />
              </ListItemButton>
            </ListItem>
          )}
          <ListItem disablePadding>
            <ListItemButton component={RouterLink} to="/">
              <ListItemText primary="Home" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton component={RouterLink} to="/users">
              <ListItemText primary="Users List" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton component={RouterLink} to="/user">
              <ListItemText primary="User Detail" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton component={RouterLink} to="/add-user">
              <ListItemText primary="Add User" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton component={RouterLink} to="/about">
              <ListItemText primary="About" />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2,
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
