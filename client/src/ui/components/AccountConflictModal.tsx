/**
 * AccountConflictModal — диалог для разрешения конфликта OAuth 409
 * Показывается когда OAuth привязан к другому аккаунту.
 *
 * @see docs/soft-launch/TZ-StandaloneAdapter-OAuth-v1.9.md раздел 4.5
 */

// JSX runtime imported automatically via jsxImportSource
import { useCallback, useState } from 'preact/hooks';
import { injectStyles } from '../utils/injectStyles';
import { OAuthConflictResponse } from '../../oauth/types';
import { resolveOAuthConflict } from '../../oauth/OAuthRedirectHandler';
import { authService } from '../../services/authService';

// ========== Стили ==========

const styles = `
  .conflict-modal-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    z-index: 2100;
    animation: conflictModalFadeIn 200ms ease-out;
    padding: 20px;
  }

  @keyframes conflictModalFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .conflict-modal {
    background: linear-gradient(145deg, #1a1a2e, #16213e);
    border: 1px solid rgba(255, 193, 7, 0.3);
    border-radius: 16px;
    padding: 24px;
    max-width: 420px;
    width: 100%;
    font-family: "IBM Plex Mono", monospace;
    color: #e6f3ff;
    animation: conflictModalSlideIn 300ms ease-out;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 193, 7, 0.1);
  }

  @keyframes conflictModalSlideIn {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .conflict-modal-header {
    text-align: center;
    margin-bottom: 20px;
  }

  .conflict-modal-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .conflict-modal-title {
    font-size: 18px;
    font-weight: 700;
    color: #ffc857;
    margin: 0 0 8px 0;
  }

  .conflict-modal-subtitle {
    font-size: 13px;
    color: #8aa4c8;
    line-height: 1.5;
  }

  .conflict-accounts {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
  }

  .conflict-account {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 14px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .conflict-account.existing {
    border-color: rgba(155, 224, 112, 0.3);
    background: rgba(155, 224, 112, 0.05);
  }

  .conflict-account.current {
    border-color: rgba(138, 164, 200, 0.3);
    background: rgba(138, 164, 200, 0.05);
  }

  .conflict-account-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    flex-shrink: 0;
  }

  .conflict-account-avatar img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .conflict-account-info {
    flex: 1;
    min-width: 0;
  }

  .conflict-account-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .conflict-account.existing .conflict-account-label {
    color: #9be070;
  }

  .conflict-account.current .conflict-account-label {
    color: #8aa4c8;
  }

  .conflict-account-nickname {
    font-size: 15px;
    font-weight: 600;
    color: #e6f3ff;
    margin-bottom: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .conflict-account-stats {
    font-size: 12px;
    color: #6b7a94;
  }

  .conflict-warning {
    background: rgba(255, 193, 7, 0.1);
    border: 1px solid rgba(255, 193, 7, 0.3);
    border-radius: 10px;
    padding: 12px;
    margin-bottom: 20px;
    font-size: 12px;
    color: #ffc857;
    text-align: center;
    line-height: 1.5;
  }

  .conflict-buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .conflict-button {
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

  .conflict-button:hover:not(:disabled) {
    transform: scale(1.02);
  }

  .conflict-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .conflict-button.switch {
    background: linear-gradient(135deg, #9be070, #7bc250);
    color: #1a1a2e;
  }

  .conflict-button.switch:hover:not(:disabled) {
    box-shadow: 0 4px 16px rgba(155, 224, 112, 0.4);
  }

  .conflict-button.cancel {
    background: transparent;
    color: #8aa4c8;
    border: 1px solid rgba(138, 164, 200, 0.3);
  }

  .conflict-button.cancel:hover:not(:disabled) {
    background: rgba(138, 164, 200, 0.1);
  }

  .conflict-error {
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

const STYLES_ID = 'account-conflict-modal-styles';
injectStyles(STYLES_ID, styles);

// ========== Компонент ==========

interface AccountConflictModalProps {
  conflict: OAuthConflictResponse;
  currentNickname?: string;
  currentMass?: number;
  onSwitch: () => void;
  onCancel: () => void;
}

export function AccountConflictModal({
  conflict,
  currentNickname,
  currentMass,
  onSwitch,
  onCancel,
}: AccountConflictModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSwitch = useCallback(async () => {
    if (!conflict.pendingAuthToken) {
      setError('Token not available');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await resolveOAuthConflict(conflict.pendingAuthToken);

      if (result.success && result.result) {
        // Сохраняем токен и обновляем состояние
        authService.finishUpgrade(result.result.accessToken);
        onSwitch();
      } else {
        setError(result.error || 'Switch failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Switch failed');
    } finally {
      setIsLoading(false);
    }
  }, [conflict.pendingAuthToken, onSwitch]);

  const handleOverlayClick = useCallback((e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('conflict-modal-overlay')) {
      if (!isLoading) {
        onCancel();
      }
    }
  }, [isLoading, onCancel]);

  const formatMass = (mass?: number): string => {
    if (!mass) return '0';
    if (mass >= 1000) {
      return `${(mass / 1000).toFixed(1)}k`;
    }
    return mass.toString();
  };

  const getAvatarContent = (avatarUrl?: string | null, nickname?: string) => {
    if (avatarUrl) {
      return <img src={avatarUrl} alt="Avatar" />;
    }
    // Первая буква никнейма или дефолтная иконка
    const initial = nickname ? nickname.charAt(0).toUpperCase() : '?';
    return initial;
  };

  return (
    <div class="conflict-modal-overlay" onClick={handleOverlayClick}>
      <div class="conflict-modal">
        <div class="conflict-modal-header">
          <div class="conflict-modal-icon">
            {/* Иконка предупреждения */}
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path
                d="M24 4L4 44h40L24 4z"
                fill="#ffc857"
                opacity="0.2"
              />
              <path
                d="M24 4L4 44h40L24 4z"
                stroke="#ffc857"
                stroke-width="2"
                fill="none"
              />
              <path
                d="M24 18v12M24 34v2"
                stroke="#ffc857"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </div>
          <h2 class="conflict-modal-title">Аккаунт уже существует</h2>
          <p class="conflict-modal-subtitle">
            Этот {conflict.existingAccount ? 'OAuth аккаунт' : 'аккаунт'} уже привязан к другому профилю
          </p>
        </div>

        <div class="conflict-accounts">
          {/* Существующий аккаунт */}
          <div class="conflict-account existing">
            <div class="conflict-account-avatar">
              {getAvatarContent(conflict.existingAccount?.avatarUrl, conflict.existingAccount?.nickname)}
            </div>
            <div class="conflict-account-info">
              <div class="conflict-account-label">Существующий аккаунт</div>
              <div class="conflict-account-nickname">
                {conflict.existingAccount?.nickname || 'Unknown'}
              </div>
              <div class="conflict-account-stats">
                Масса: {formatMass(conflict.existingAccount?.totalMass)}
              </div>
            </div>
          </div>

          {/* Текущий аккаунт */}
          {(currentNickname || currentMass) && (
            <div class="conflict-account current">
              <div class="conflict-account-avatar">
                {(currentNickname || '?').charAt(0).toUpperCase()}
              </div>
              <div class="conflict-account-info">
                <div class="conflict-account-label">Текущий (гость)</div>
                <div class="conflict-account-nickname">
                  {currentNickname || 'Guest'}
                </div>
                <div class="conflict-account-stats">
                  Масса: {formatMass(currentMass)}
                </div>
              </div>
            </div>
          )}
        </div>

        <div class="conflict-warning">
          При переключении прогресс текущего гостевого аккаунта будет потерян
        </div>

        {error && (
          <div class="conflict-error">
            {error}
          </div>
        )}

        <div class="conflict-buttons">
          <button
            class="conflict-button switch"
            onClick={handleSwitch}
            disabled={isLoading}
          >
            {isLoading ? 'Переключение...' : `Войти как ${conflict.existingAccount?.nickname || 'существующий'}`}
          </button>
          <button
            class="conflict-button cancel"
            onClick={onCancel}
            disabled={isLoading}
          >
            Остаться гостем
          </button>
        </div>
      </div>
    </div>
  );
}

export default AccountConflictModal;
