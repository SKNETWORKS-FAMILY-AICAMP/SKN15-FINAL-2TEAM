import React, { useState } from 'react';
import chatAPI from '../../services/chatAPI';

interface InviteMemberModalProps {
  tripId: number;
  onSuccess: () => void;
  onClose: () => void;
}

const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  tripId,
  onSuccess,
  onClose
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInvite = async () => {
    if (!email.trim()) {
      setError('이메일을 입력해주세요');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await chatAPI.inviteMember(tripId, email, role);

      if (response.success) {
        setSuccess(`${email}님을 초대했습니다!`);
        setEmail('');

        // 2초 후 성공 메시지 닫고 콜백 실행
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || '초대에 실패했습니다';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInvite();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>동행자 초대</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="invite-email">이메일 주소</label>
            <input
              id="invite-email"
              type="email"
              className="form-input"
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              autoFocus
            />
            <p className="form-hint">
              초대하려는 사용자의 이메일 주소를 입력하세요.
              <br />
              해당 이메일로 이미 가입된 사용자만 초대할 수 있습니다.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="invite-role">권한</label>
            <select
              id="invite-role"
              className="form-select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={loading}
            >
              <option value="editor">편집자 (Editor)</option>
              <option value="commenter">댓글 작성자 (Commenter)</option>
              <option value="viewer">뷰어 (Viewer)</option>
            </select>
            <p className="form-hint">
              {role === 'editor' && '일정 편집 및 댓글 작성 가능'}
              {role === 'commenter' && '댓글 작성만 가능 (일정 편집 불가)'}
              {role === 'viewer' && '읽기만 가능 (편집 및 댓글 불가)'}
            </p>
          </div>

          {error && (
            <div className="alert alert-error">
              ❌ {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              ✅ {success}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            취소
          </button>
          <button
            className="btn btn-primary"
            onClick={handleInvite}
            disabled={loading || !email.trim()}
          >
            {loading ? '초대 중...' : '초대하기'}
          </button>
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            animation: fadeIn 0.2s ease;
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          .modal-content {
            background: white;
            border-radius: 12px;
            width: 90%;
            max-width: 500px;
            max-height: 90vh;
            overflow: auto;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            animation: slideUp 0.3s ease;
          }

          @keyframes slideUp {
            from {
              transform: translateY(20px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }

          .modal-header {
            padding: 20px 24px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .modal-header h2 {
            margin: 0;
            font-size: 1.5rem;
            color: #333;
          }

          .modal-close {
            background: none;
            border: none;
            font-size: 2rem;
            color: #666;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: all 0.2s;
          }

          .modal-close:hover {
            background: #f5f5f5;
            color: #333;
          }

          .modal-body {
            padding: 24px;
          }

          .form-group {
            margin-bottom: 20px;
          }

          .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #333;
            font-size: 0.95rem;
          }

          .form-input,
          .form-select {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 1rem;
            transition: border-color 0.2s;
          }

          .form-input:focus,
          .form-select:focus {
            outline: none;
            border-color: #364C84;
            box-shadow: 0 0 0 3px rgba(54, 76, 132, 0.1);
          }

          .form-input:disabled,
          .form-select:disabled {
            background: #f5f5f5;
            cursor: not-allowed;
          }

          .form-hint {
            margin-top: 8px;
            font-size: 0.85rem;
            color: #666;
            line-height: 1.4;
          }

          .alert {
            padding: 12px 16px;
            border-radius: 8px;
            margin-top: 16px;
            font-size: 0.9rem;
          }

          .alert-error {
            background: #fee;
            border: 1px solid #fcc;
            color: #c00;
          }

          .alert-success {
            background: #efe;
            border: 1px solid #cfc;
            color: #060;
          }

          .modal-footer {
            padding: 16px 24px;
            border-top: 1px solid #e0e0e0;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
          }

          .btn {
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .btn-secondary {
            background: #f5f5f5;
            color: #333;
          }

          .btn-secondary:hover:not(:disabled) {
            background: #e0e0e0;
          }

          .btn-primary {
            background: #364C84;
            color: white;
          }

          .btn-primary:hover:not(:disabled) {
            background: #2a3b6a;
          }

          @media (max-width: 600px) {
            .modal-content {
              width: 95%;
            }

            .modal-header,
            .modal-body,
            .modal-footer {
              padding: 16px;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default InviteMemberModal;
