/**
 * RegistrationPromptModal — модал для предложения сохранить прогресс
 * Показывается гостям и анонимным пользователям после матча.
 */

// JSX runtime imported automatically via jsxImportSource
import { useCallback, useState } from 'preact/hooks';
import { injectStyles } from '../utils/injectStyles';
import { platformManager } from '../../platform';
import { claimToken, claimStatus } from '../../services/matchResultsService';
import { metaServerClient } from '../../api/metaServerClient';
import { authService } from '../../services/authService';
import { OAuthProviderSelector } from './OAuthProviderSelector';

// ========== Стили ==========

const styles = `
  .reg-modal-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    z-index: 2000;
    animation: regModalFadeIn 200ms ease-out;
    padding: 20px;
  }

  @keyframes regModalFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .reg-modal {
    background: linear-gradient(145deg, #1a1a2e, #16213e);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 24px;
    max-width: 400px;
    width: 100%;
    font-family: "IBM Plex Mono", monospace;
    color: #e6f3ff;
    animation: regModalSlideIn 300ms ease-out;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  @keyframes regModalSlideIn {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .reg-modal-header {
    text-align: center;
    margin-bottom: 20px;
  }

  .reg-modal-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .reg-modal-title {
    font-size: 20px;
    font-weight: 700;
    color: #ffc857;
    margin: 0 0 8px 0;
  }

  .reg-modal-subtitle {
    font-size: 14px;
    color: #8aa4c8;
    line-height: 1.5;
  }

  .reg-modal-benefits {
    background: rgba(155, 224, 112, 0.08);
    border: 1px solid rgba(155, 224, 112, 0.2);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
  }

  .reg-modal-benefits-title {
    font-size: 12px;
    color: #9be070;
    font-weight: 600;
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .reg-modal-benefit {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: #e6f3ff;
    padding: 6px 0;
  }

  .reg-modal-benefit-icon {
    font-size: 16px;
    width: 24px;
    text-align: center;
  }

  .reg-modal-buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .reg-modal-button {
    padding: 14px 24px;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: transform 150ms, box-shadow 150ms;
    font-family: inherit;
    text-align: center;
  }

  .reg-modal-button:hover:not(:disabled) {
    transform: scale(1.02);
  }

  .reg-modal-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .reg-modal-button.telegram {
    background: linear-gradient(135deg, #0088cc, #006699);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .telegram-icon {
    width: 20px;
    height: 20px;
  }

  .reg-modal-button.later {
    background: transparent;
    color: #8aa4c8;
    border: 1px solid rgba(138, 164, 200, 0.3);
  }

  .reg-modal-button.later:hover {
    background: rgba(138, 164, 200, 0.1);
  }

  .reg-modal-note {
    text-align: center;
    font-size: 11px;
    color: #6b7a94;
    margin-top: 16px;
    line-height: 1.4;
  }

  .reg-modal-error {
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

const STYLES_ID = 'registration-prompt-modal-styles';
injectStyles(STYLES_ID, styles);

// ========== Компонент ==========

interface RegistrationPromptModalProps {
  onClose: () => void;
  /** Режим авторизации: login — простой вход, convert_guest — привязка гостевого прогресса */
  intent?: 'login' | 'convert_guest';
}

export function RegistrationPromptModal({ onClose, intent = 'convert_guest' }: RegistrationPromptModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Copilot P3: Используем явные методы platformManager вместо сравнения platformType
  const isTelegram = platformManager.isTelegram();
  const isStandalone = platformManager.isStandalone();

  // Gemini P1: Проверяем доступность claimToken перед разрешением upgrade
  // LB-009: Пытаемся взять токен из сигнала или из localStorage
  const effectiveClaimToken = claimToken.value || localStorage.getItem('registration_claim_token');
  const hasClaimToken = effectiveClaimToken !== null;
  const isTokenLoading = claimStatus.value === 'claiming';
  // Для intent='login' claimToken не нужен
  const canUpgrade = intent === 'login' || hasClaimToken || !isTelegram;

  const handleTelegramLogin = useCallback(async () => {
    if (!isTelegram) {
      // Если не в Telegram, открываем бота
      window.open('https://t.me/SlimeArenaBot', '_blank');
      return;
    }

    // intent='login' в Telegram: открываем бота для повторного входа
    if (intent === 'login') {
      window.open('https://t.me/SlimeArenaBot', '_blank');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Copilot P1: Для Telegram используем upgrade flow напрямую через API
      // (adapter.requestAuth() не работает для Telegram Mini App)
      // LB-009: Используем эффективный токен (из сигнала или localStorage)
      const token = effectiveClaimToken;
      if (!token) {
        setError('Нет данных для сохранения прогресса. Сыграйте матч.');
        return;
      }

      // Copilot P1: Вызываем /auth/upgrade с обязательным параметром mode
      const response = await metaServerClient.post<{
        accessToken?: string;
        expiresAt?: string;
      }>('/api/v1/auth/upgrade', {
        claimToken: token,
        mode: 'complete_profile', // Для анонимного Telegram-пользователя
      });

      // Copilot P1: Сохраняем новый accessToken и обновляем HTTP-клиент
      if (response.accessToken) {
        localStorage.setItem('access_token', response.accessToken);
        // Copilot P1: Обновляем токен в HTTP-клиенте для последующих запросов
        metaServerClient.setToken(response.accessToken);
        if (response.expiresAt) {
          localStorage.setItem('token_expires_at', response.expiresAt);
        }
      }

      // Завершаем upgrade только при успешном получении токена
      if (response.accessToken) {
        // Copilot P1: Обновляем is_anonymous ВНУТРИ условия, чтобы избежать
        // несогласованного состояния при отсутствии токена
        localStorage.setItem('is_anonymous', 'false');
        // FIX-010: await для загрузки профиля с сервера
        await authService.finishUpgrade(response.accessToken);
      }

      // После успешного upgrade закрываем модал
      onClose();
    } catch (err) {
      // Gemini P1: Улучшенная обработка ошибок валидации никнейма
      // Гостевые никнеймы генерируются на клиенте и могут не пройти серверную валидацию
      const rawMessage = err instanceof Error ? err.message : 'Ошибка сохранения прогресса';
      const isNicknameError = rawMessage.toLowerCase().includes('nickname') ||
        rawMessage.toLowerCase().includes('никнейм') ||
        rawMessage.includes('validation');
      const message = isNicknameError
        ? 'Ваш никнейм не прошёл проверку. Попробуйте сыграть ещё раз с новым никнеймом.'
        : rawMessage;
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isTelegram, intent, onClose, effectiveClaimToken]);

  const handleOverlayClick = useCallback((e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('reg-modal-overlay')) {
      onClose();
    }
  }, [onClose]);

  return (
    <div class="reg-modal-overlay" onClick={handleOverlayClick}>
      <div class="reg-modal">
        <div class="reg-modal-header">
          <div class="reg-modal-icon">
            {/* Иконка сохранения/облака */}
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path
                d="M38 20c0-6.627-5.373-12-12-12-5.522 0-10.148 3.736-11.534 8.818C9.757 17.654 6 21.96 6 27c0 5.523 4.477 10 10 10h22c4.418 0 8-3.582 8-8 0-4.077-3.054-7.44-7-7.938V20z"
                fill="#4a90c2"
                opacity="0.2"
              />
              <path
                d="M38 20c0-6.627-5.373-12-12-12-5.522 0-10.148 3.736-11.534 8.818C9.757 17.654 6 21.96 6 27c0 5.523 4.477 10 10 10h22c4.418 0 8-3.582 8-8 0-4.077-3.054-7.44-7-7.938V20z"
                stroke="#4a90c2"
                stroke-width="2"
                fill="none"
              />
              <path
                d="M24 22v12M20 30l4 4 4-4"
                stroke="#9be070"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <h2 class="reg-modal-title">
            {intent === 'login' ? 'Войти в аккаунт' : 'Сохранить прогресс'}
          </h2>
          <p class="reg-modal-subtitle">
            {intent === 'login'
              ? 'Войдите, чтобы восстановить свой профиль, рейтинг и прогресс'
              : isStandalone
                ? 'Войдите через соцсеть, чтобы ваши достижения не пропали'
                : 'Войдите через Telegram, чтобы ваши достижения не пропали'}
          </p>
        </div>

        {intent === 'convert_guest' && (
          <div class="reg-modal-benefits">
            <div class="reg-modal-benefits-title">После входа вы получите</div>
            <div class="reg-modal-benefit">
              <span class="reg-modal-benefit-icon">*</span>
              <span>Сохранение рейтинга и статистики</span>
            </div>
            <div class="reg-modal-benefit">
              <span class="reg-modal-benefit-icon">*</span>
              <span>Участие в глобальном рейтинге</span>
            </div>
            <div class="reg-modal-benefit">
              <span class="reg-modal-benefit-icon">*</span>
              <span>Доступ к скинам и наградам</span>
            </div>
            <div class="reg-modal-benefit">
              <span class="reg-modal-benefit-icon">*</span>
              <span>Игра с разных устройств</span>
            </div>
          </div>
        )}

        {error && (
          <div class="reg-modal-error">
            {error}
          </div>
        )}

        <div class="reg-modal-buttons">
          {isStandalone ? (
            <OAuthProviderSelector
              intent={intent}
              onError={(err) => setError(err)}
              disabled={isLoading}
              showTitle={false}
            />
          ) : (
            <button
              class="reg-modal-button telegram"
              onClick={handleTelegramLogin}
              disabled={isLoading || !canUpgrade}
            >
              <svg class="telegram-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
              {isLoading ? 'Подождите...' : isTokenLoading ? 'Получение данных...' : isTelegram ? 'Войти через Telegram' : 'Открыть в Telegram'}
            </button>
          )}
          <button
            class="reg-modal-button later"
            onClick={onClose}
            disabled={isLoading}
          >
            Продолжить как гость
          </button>
        </div>

        <div class="reg-modal-note">
          {isStandalone
            ? 'Ваши данные в безопасности. Мы используем только идентификатор аккаунта.'
            : 'Ваши данные в безопасности. Мы используем только ваш Telegram ID для идентификации.'}
        </div>
      </div>
    </div>
  );
}

export default RegistrationPromptModal;
