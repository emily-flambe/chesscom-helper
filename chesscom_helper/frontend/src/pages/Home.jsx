// src/pages/Home.jsx
import React from 'react';
import { Box, Typography } from '@mui/material';

export default function Home() {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
        Welcome to Chesscom Helper
      </Typography>
      <Typography variant="h5" gutterBottom sx={{ mb: 5 }}>
        Your Chesstest Friend :)
      </Typography>
      <Typography variant="body1">
        Select something from the sidebar!
      </Typography>
    </Box>
  );
}
