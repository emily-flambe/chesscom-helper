// Layout.jsx
import React from 'react';
import { Outlet, Link as RouterLink } from 'react-router-dom';
import { Drawer, List, ListItem, ListItemButton, ListItemText, Toolbar, Box } from '@mui/material';

export default function Layout() {
  return (
    <Box sx={{ display: 'flex' }}>
      {/* 
        A permanent Drawer on the left side. 
        "sx" allows customizing the drawer's Paper background, width, etc.
      */}
      <Drawer
        variant="permanent"
        sx={{
          width: 200,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 200,
            boxSizing: 'border-box',
            backgroundColor: 'var(--table-header-bg)', // optional custom color
          },
        }}
      >
        {/* 
          Toolbar adds top spacing so content doesn't flow under an AppBar (if you ever add one).
          You can remove <Toolbar /> if you don't need that spacing.
        */}
        <Toolbar />
        <List>
          <ListItem disablePadding>
            <ListItemButton component={RouterLink} to="/register">
              <ListItemText primary="Register" />
            </ListItemButton>
          </ListItem>
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
        </List>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2, // material-ui spacing for padding
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
