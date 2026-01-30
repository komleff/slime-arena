/**
 * OAuthProviderSelector — компонент выбора OAuth провайдера
 * Показывает доступные провайдеры с учётом региона.
 *
 * @see docs/soft-launch/TZ-StandaloneAdapter-OAuth-v1.9.md раздел 4.6
 */

// JSX runtime imported automatically via jsxImportSource
import { useCallback, useEffect, useState } from 'preact/hooks';
import { injectStyles } from '../utils/injectStyles';
import { oauthService } from '../../oauth/OAuthService';
import { OAuthProviderConfig, OAuthProviderName, OAuthIntent } from '../../oauth/types';

// ========== Стили ==========

const styles = `
  .oauth-selector {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .oauth-selector-title {
    font-size: 12px;
    color: #8aa4c8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
    text-align: center;
  }

  .oauth-providers {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .oauth-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 24px;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: transform 150ms, box-shadow 150ms, opacity 150ms;
    font-family: "IBM Plex Mono", monospace;
    text-align: center;
    width: 100%;
  }

  .oauth-button:hover:not(:disabled) {
    transform: scale(1.02);
  }

  .oauth-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .oauth-button.google {
    background: #fff;
    color: #3c4043;
    border: 1px solid rgba(0, 0, 0, 0.1);
  }

  .oauth-button.google:hover:not(:disabled) {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .oauth-button.yandex {
    background: #fc3f1d;
    color: #fff;
  }

  .oauth-button.yandex:hover:not(:disabled) {
    box-shadow: 0 4px 12px rgba(252, 63, 29, 0.4);
  }

  .oauth-button.vk {
    background: #0077ff;
    color: #fff;
  }

  .oauth-button.vk:hover:not(:disabled) {
    box-shadow: 0 4px 12px rgba(0, 119, 255, 0.4);
  }

  .oauth-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .oauth-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    color: #8aa4c8;
    font-size: 13px;
  }

  .oauth-error {
    background: rgba(255, 77, 77, 0.1);
    border: 1px solid rgba(255, 77, 77, 0.3);
    border-radius: 8px;
    padding: 10px;
    font-size: 12px;
    color: #ff6b6b;
    text-align: center;
  }

  .oauth-region-hint {
    font-size: 11px;
    color: #6b7a94;
    text-align: center;
    margin-top: 8px;
  }
`;

const STYLES_ID = 'oauth-provider-selector-styles';
injectStyles(STYLES_ID, styles);

// ========== Иконки провайдеров ==========

function GoogleIcon() {
  return (
    <svg class="oauth-icon" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function YandexIcon() {
  return (
    <svg class="oauth-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12zm11.27-5.18h-1.5c-2.1 0-3.27 1.22-3.27 2.97 0 1.5.6 2.4 1.97 3.45l1.65 1.2-3.72 4.74h2.25l3.3-4.35v-.82l-1.35-.97c-.97-.67-1.5-1.35-1.5-2.4 0-.97.6-1.67 1.72-1.67h.45V6.82z"/>
    </svg>
  );
}

function VKIcon() {
  return (
    <svg class="oauth-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.862-.523-2.049-1.71-1.033-1.01-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.559c0 .424-.136.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4 8.423 4 7.889c0-.254.102-.492.593-.492h1.744c.44 0 .61.203.78.678.847 2.455 2.27 4.608 2.862 4.608.22 0 .322-.102.322-.66V9.737c-.068-1.186-.695-1.287-.695-1.71 0-.203.17-.407.44-.407h2.744c.373 0 .508.203.508.644v3.465c0 .373.17.508.27.508.22 0 .407-.135.813-.542 1.254-1.406 2.149-3.574 2.149-3.574.119-.254.322-.492.763-.492h1.744c.525 0 .644.27.525.644-.22 1.017-2.353 4.031-2.353 4.031-.186.305-.254.44 0 .78.186.254.796.78 1.203 1.254.745.847 1.32 1.558 1.473 2.049.17.475-.085.722-.576.722z"/>
    </svg>
  );
}

// ========== Компонент ==========

interface OAuthProviderSelectorProps {
  intent: OAuthIntent;
  gameState?: string;
  onError?: (error: string) => void;
  disabled?: boolean;
  showTitle?: boolean;
}

export function OAuthProviderSelector({
  intent,
  gameState,
  onError,
  disabled = false,
  showTitle = true,
}: OAuthProviderSelectorProps) {
  const [providers, setProviders] = useState<OAuthProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [startingOAuth, setStartingOAuth] = useState<OAuthProviderName | null>(null);

  // Загружаем конфигурацию при монтировании
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const config = await oauthService.loadConfig();
      setProviders(config.providers);
      setRegion(config.region);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load OAuth config';
      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthClick = useCallback(async (provider: OAuthProviderName) => {
    if (disabled || startingOAuth) return;

    try {
      setStartingOAuth(provider);
      await oauthService.startOAuth(provider, intent, gameState);
      // После startOAuth происходит редирект, код ниже не выполнится
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OAuth error';
      setError(message);
      onError?.(message);
      setStartingOAuth(null);
    }
  }, [disabled, startingOAuth, intent, gameState, onError]);

  const getProviderLabel = (name: OAuthProviderName): string => {
    switch (name) {
      case 'google':
        return 'Войти через Google';
      case 'yandex':
        return 'Войти через Яндекс';
      case 'vk':
        return 'Войти через VK';
      default:
        return `Войти через ${name}`;
    }
  };

  const getProviderIcon = (name: OAuthProviderName) => {
    switch (name) {
      case 'google':
        return <GoogleIcon />;
      case 'yandex':
        return <YandexIcon />;
      case 'vk':
        return <VKIcon />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div class="oauth-selector">
        <div class="oauth-loading">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div class="oauth-selector">
        <div class="oauth-error">{error}</div>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div class="oauth-selector">
        <div class="oauth-error">Нет доступных способов входа</div>
      </div>
    );
  }

  return (
    <div class="oauth-selector">
      {showTitle && (
        <div class="oauth-selector-title">Войти через</div>
      )}
      <div class="oauth-providers">
        {providers.map((provider) => (
          <button
            key={provider.name}
            class={`oauth-button ${provider.name}`}
            onClick={() => handleOAuthClick(provider.name)}
            disabled={disabled || startingOAuth !== null}
          >
            {getProviderIcon(provider.name)}
            {startingOAuth === provider.name ? 'Переход...' : getProviderLabel(provider.name)}
          </button>
        ))}
      </div>
      {region && region !== 'GLOBAL' && (
        <div class="oauth-region-hint">
          Регион: {region}
        </div>
      )}
    </div>
  );
}

export default OAuthProviderSelector;
