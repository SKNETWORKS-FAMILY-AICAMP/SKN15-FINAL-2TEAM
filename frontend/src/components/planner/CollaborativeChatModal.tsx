'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
} from '@mui/icons-material';
import CollaborativeChatRoom from './CollaborativeChatRoom';

interface CollaborativeChatModalProps {
  open: boolean;
  onClose: () => void;
  roomId: number;
  tripTitle: string;
}

export default function CollaborativeChatModal({
  open,
  onClose,
  roomId,
  tripTitle,
}: CollaborativeChatModalProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={fullScreen}
      PaperProps={{
        sx: {
          height: fullScreen ? '100%' : '80vh',
          maxHeight: fullScreen ? '100%' : '80vh',
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          zIndex: 1,
        }}
      >
        <IconButton
          onClick={onClose}
          sx={{
            bgcolor: 'rgba(255,255,255,0.9)',
            '&:hover': {
              bgcolor: 'rgba(255,255,255,1)',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 0, height: '100%' }}>
        <CollaborativeChatRoom roomId={roomId} tripTitle={tripTitle} />
      </DialogContent>
    </Dialog>
  );
}
