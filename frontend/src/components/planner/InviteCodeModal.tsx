import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  IconButton,
  Alert,
  CircularProgress,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ShareIcon from '@mui/icons-material/Share';
import tripAPI from '../../services/tripAPI';

interface InviteCodeModalProps {
  open: boolean;
  onClose: () => void;
  tripId: number;
  tripTitle: string;
}

const InviteCodeModal: React.FC<InviteCodeModalProps> = ({
  open,
  onClose,
  tripId,
  tripTitle,
}) => {
  const [inviteCode, setInviteCode] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>('');

  const handleGenerateCode = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await tripAPI.generateInviteCode(tripId, 24);
      setInviteCode(result.invite_code);
      setExpiresAt(result.expires_at);
    } catch (err: any) {
      setError(err.response?.data?.error || '초대 코드 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      alert(`초대 코드가 복사되었습니다!\n\n${inviteCode}\n\n이 코드를 친구에게 전달하세요.`);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = inviteCode;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        alert(`초대 코드가 복사되었습니다!\n\n${inviteCode}\n\n이 코드를 친구에게 전달하세요.`);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        alert('복사에 실패했습니다. 코드를 직접 선택해서 복사해주세요.');
      }
      document.body.removeChild(textArea);
    }
  };

  const handleShareCode = async () => {
    if (!inviteCode) {
      alert('초대 코드가 생성되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    // Generate shareable URL (exactly same as mypage)
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/planner/${inviteCode}`;

    // Copy to clipboard (exactly same as mypage)
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert(`공유 링크가 복사되었습니다!\n\n${shareUrl}\n\n이 링크를 친구들과 공유하세요.`);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert(`공유 링크가 복사되었습니다!\n\n${shareUrl}\n\n이 링크를 친구들과 공유하세요.`);
    }
  };

  React.useEffect(() => {
    if (open && !inviteCode) {
      handleGenerateCode();
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>동행자 초대</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : inviteCode ? (
            <>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                아래 초대 코드를 공유하세요
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  my: 2,
                  p: 2,
                  bgcolor: 'primary.main',
                  color: 'white',
                  borderRadius: 2,
                }}
              >
                <TextField
                  value={inviteCode}
                  variant="standard"
                  InputProps={{
                    readOnly: true,
                    disableUnderline: true,
                    style: {
                      fontSize: '2rem',
                      fontWeight: 'bold',
                      letterSpacing: '0.2em',
                      color: 'white',
                      textAlign: 'center',
                    },
                  }}
                  fullWidth
                />
                <IconButton
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCopyCode();
                  }}
                  sx={{ color: 'white' }}
                  title="코드 복사"
                >
                  <ContentCopyIcon />
                </IconButton>
              </Box>

              {copied && (
                <Typography
                  variant="caption"
                  color="success.main"
                  sx={{ display: 'block', textAlign: 'center', mb: 1 }}
                >
                  ✓ 복사되었습니다!
                </Typography>
              )}

              <Typography variant="caption" color="text.secondary" gutterBottom>
                유효기간: {new Date(expiresAt).toLocaleString('ko-KR')}
              </Typography>

              <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  📱 초대 방법:
                </Typography>
                <Typography variant="body2" component="ol" sx={{ pl: 2 }}>
                  <li>위 초대 코드를 복사하세요</li>
                  <li>친구에게 코드를 공유하세요</li>
                  <li>친구가 http://{window.location.host}/join 에 접속</li>
                  <li>코드를 입력하면 여행에 참여합니다!</li>
                </Typography>
              </Box>

              <Button
                variant="contained"
                startIcon={<ShareIcon />}
                onClick={handleShareCode}
                fullWidth
                sx={{ mt: 2 }}
              >
                초대 링크 공유하기
              </Button>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                링크를 클릭하면 바로 이 여행에 참여할 수 있습니다
              </Typography>
            </>
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions>
        {inviteCode && (
          <Button onClick={handleGenerateCode} disabled={loading}>
            새 코드 생성
          </Button>
        )}
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
};

export default InviteCodeModal;
