// frontend/src/pages/Home.jsx
import React from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { useLocation } from 'react-router-dom';

export default function Home() {
  const location = useLocation();

  // Parse query parameters from location.search
  const params = new URLSearchParams(location.search);
  const logoutFlag = params.get('logout');

  return (
    <Box sx={{ p: 2 }}>
      {logoutFlag === '1' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You have logged out. Thank you for using chesscomhelper.com!
        </Alert>
      )}
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
        Welcome to Chesscom HelperrrRRRR
      </Typography>
      <Typography variant="h5" gutterBottom sx={{ mb: 5 }}>
        Your Chesstest Friend :)
      </Typography>
      <Box sx={{ my: 2, textAlign: 'center' }}>
        <img
          src="/assets/majestic-knight.png"
          alt="Majestic Knight"
          style={{ maxWidth: '75%', height: 'auto' }}
        />
      </Box>
    </Box>
  );
}
