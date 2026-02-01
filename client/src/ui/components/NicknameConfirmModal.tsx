/**
 * P1-4: NicknameConfirmModal — диалог подтверждения никнейма после OAuth
 * Показывает имя из OAuth провайдера и позволяет изменить.
 *
 * @see docs/plans/ethereal-forging-cookie.md
 */

// JSX runtime imported automatically via jsxImportSource
import { useCallback, useState } from 'preact/hooks';
import { injectStyles } from '../utils/injectStyles';
import { OAuthPrepareResponse } from '../../oauth/types';
import { completeOAuthUpgrade } from '../../oauth/OAuthRedirectHandler';
import { authService } from '../../services/authService';

// ========== Стили ==========

const styles = `
  .nickname-modal-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    z-index: 2100;
    animation: nicknameModalFadeIn 200ms ease-out;
    padding: 20px;
  }

  @keyframes nicknameModalFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .nickname-modal {
    background: linear-gradient(145deg, #1a1a2e, #16213e);
    border: 1px solid rgba(155, 224, 112, 0.3);
    border-radius: 16px;
    padding: 24px;
    max-width: 380px;
    width: 100%;
    font-family: "IBM Plex Mono", monospace;
    color: #e6f3ff;
    animation: nicknameModalSlideIn 300ms ease-out;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(155, 224, 112, 0.1);
  }

  @keyframes nicknameModalSlideIn {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .nickname-modal-header {
    text-align: center;
    margin-bottom: 20px;
  }

  .nickname-modal-avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 12px;
    font-size: 28px;
    overflow: hidden;
  }

  .nickname-modal-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .nickname-modal-title {
    font-size: 18px;
    font-weight: 700;
    color: #9be070;
    margin: 0 0 8px 0;
  }

  .nickname-modal-subtitle {
    font-size: 13px;
    color: #8aa4c8;
    line-height: 1.5;
  }

  .nickname-input-container {
    margin-bottom: 20px;
  }

  .nickname-input-label {
    font-size: 12px;
    color: #8aa4c8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
    display: block;
  }

  .nickname-input {
    width: 100%;
    padding: 14px 16px;
    border: 1px solid rgba(155, 224, 112, 0.3);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    color: #e6f3ff;
    font-size: 16px;
    font-family: inherit;
    outline: none;
    transition: border-color 150ms, box-shadow 150ms;
    box-sizing: border-box;
  }

  .nickname-input:focus {
    border-color: rgba(155, 224, 112, 0.6);
    box-shadow: 0 0 12px rgba(155, 224, 112, 0.2);
  }

  .nickname-input.error {
    border-color: rgba(255, 77, 77, 0.5);
  }

  .nickname-input-hint {
    font-size: 11px;
    color: #6b7a94;
    margin-top: 6px;
  }

  .nickname-input-error {
    font-size: 11px;
    color: #ff6b6b;
    margin-top: 6px;
  }

  .nickname-modal-buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .nickname-button {
    padding: 14px 24px;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: transform 150ms, box-shadow 150ms;
    font-family: inherit;
    text-align: center;
    width: 100%;
  }

  .nickname-button:hover:not(:disabled) {
    transform: scale(1.02);
  }

  .nickname-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .nickname-button.confirm {
    background: linear-gradient(135deg, #9be070, #7bc250);
    color: #1a1a2e;
  }

  .nickname-button.confirm:hover:not(:disabled) {
    box-shadow: 0 4px 16px rgba(155, 224, 112, 0.4);
  }

  .nickname-button.cancel {
    background: transparent;
    color: #8aa4c8;
    border: 1px solid rgba(138, 164, 200, 0.3);
  }

  .nickname-button.cancel:hover:not(:disabled) {
    background: rgba(138, 164, 200, 0.1);
  }

  .nickname-modal-error {
    background: rgba(255, 77, 77, 0.1);
    border: 1px solid rgba(255, 77, 77, 0.3);
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 16px;
    font-size: 12px;
    color: #ff6b6b;
    text-align: center;
  }
`;

const STYLES_ID = 'nickname-confirm-modal-styles';
injectStyles(STYLES_ID, styles);

// ========== Компонент ==========

interface NicknameConfirmModalProps {
  prepare: OAuthPrepareResponse;
  onConfirm: () => void;
  onCancel: () => void;
}

export function NicknameConfirmModal({
  prepare,
  onConfirm,
  onCancel,
}: NicknameConfirmModalProps) {
  const [nickname, setNickname] = useState(prepare.displayName);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateNickname = (value: string): string | null => {
    if (value.length < 2) {
      return 'Минимум 2 символа';
    }
    if (value.length > 20) {
      return 'Максимум 20 символов';
    }
    return null;
  };

  const handleNicknameChange = useCallback((e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setNickname(value);
    setValidationError(validateNickname(value));
    setError(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    const validError = validateNickname(nickname);
    if (validError) {
      setValidationError(validError);
      return;
    }

    const guestToken = localStorage.getItem('guest_token');
    if (!guestToken) {
      setError('Сессия истекла. Обновите страницу.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await completeOAuthUpgrade(
        prepare.prepareToken,
        nickname.trim(),
        guestToken
      );

      if (result.success && result.result) {
        // FIX-010: await для загрузки профиля с сервера
        await authService.finishUpgrade(result.result.accessToken, nickname.trim());
        localStorage.removeItem('pending_claim_token');
        onConfirm();
      } else {
        setError(result.error || 'Ошибка регистрации');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setIsLoading(false);
    }
  }, [nickname, prepare.prepareToken, onConfirm]);

  const handleOverlayClick = useCallback((e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('nickname-modal-overlay')) {
      if (!isLoading) {
        onCancel();
      }
    }
  }, [isLoading, onCancel]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !validationError && !isLoading) {
      handleConfirm();
    }
  }, [handleConfirm, validationError, isLoading]);

  const getAvatarInitial = (name: string): string => {
    const match = name.match(/[a-zA-Zа-яА-ЯёЁ]/);
    if (match) {
      return match[0].toUpperCase();
    }
    return name[0] || '?';
  };

  return (
    <div class="nickname-modal-overlay" onClick={handleOverlayClick}>
      <div class="nickname-modal">
        <div class="nickname-modal-header">
          <div class="nickname-modal-avatar">
            {prepare.avatarUrl ? (
              <img src={prepare.avatarUrl} alt="Avatar" />
            ) : (
              getAvatarInitial(prepare.displayName)
            )}
          </div>
          <h2 class="nickname-modal-title">Подтвердите имя</h2>
          <p class="nickname-modal-subtitle">
            Вы можете сохранить имя из аккаунта или выбрать другое
          </p>
        </div>

        <div class="nickname-input-container">
          <label class="nickname-input-label">Ваш никнейм</label>
          <input
            type="text"
            class={`nickname-input ${validationError ? 'error' : ''}`}
            value={nickname}
            onInput={handleNicknameChange}
            onKeyDown={handleKeyDown}
            maxLength={20}
            placeholder="Введите никнейм"
            disabled={isLoading}
            autoFocus
          />
          {validationError ? (
            <div class="nickname-input-error">{validationError}</div>
          ) : (
            <div class="nickname-input-hint">2–20 символов</div>
          )}
        </div>

        {error && (
          <div class="nickname-modal-error">
            {error}
          </div>
        )}

        <div class="nickname-modal-buttons">
          <button
            class="nickname-button confirm"
            onClick={handleConfirm}
            disabled={isLoading || !!validationError}
          >
            {isLoading ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            class="nickname-button cancel"
            onClick={onCancel}
            disabled={isLoading}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

export default NicknameConfirmModal;
