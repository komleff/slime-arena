/**
 * Страница настроек: 2FA setup, logout.
 */
import { signal } from '@preact/signals';
import { getTotpSetup, verifyTotp, logout, ApiError } from '../api/client';
import { totpRequired, setTotpRequired, totpSuccess } from '../auth/signals';

/** Состояние настройки 2FA (локальное) */
const totpSetupData = signal<{ secret: string; qrCodeUrl: string } | null>(null);
const totpCode = signal('');
const totpError = signal<string | null>(null);
// P2: totpSuccess перенесён в auth/signals.ts для сброса при logout
const isLoadingSetup = signal(false);
const isVerifying = signal(false);

export function SettingsPage() {
  return (
    <div class="page settings-page">
      <h1 class="page-title">Настройки</h1>

      <section class="settings-section">
        <h2>Двухфакторная аутентификация (2FA)</h2>
        <TotpSetup />
      </section>

      <section class="settings-section">
        <h2>Сессия</h2>
        <LogoutButton />
      </section>
    </div>
  );
}

/**
 * Компонент настройки TOTP.
 */
function TotpSetup() {
  // Если 2FA уже настроена и не требуется
  if (!totpRequired.value && !totpSetupData.value && totpSuccess.value) {
    return (
      <div class="totp-status totp-enabled">
        <span class="status-icon">&#10003;</span>
        <span>2FA включена</span>
      </div>
    );
  }

  // Если успешно настроили
  if (totpSuccess.value) {
    return (
      <div class="totp-status totp-enabled">
        <span class="status-icon">&#10003;</span>
        <span>2FA успешно настроена!</span>
      </div>
    );
  }

  // Кнопка начала настройки
  if (!totpSetupData.value) {
    return (
      <div class="totp-setup-start">
        {totpRequired.value && (
          <p class="totp-required-notice">
            Для использования панели администратора необходимо настроить 2FA.
          </p>
        )}
        <button
          class="btn btn-primary"
          onClick={handleStartSetup}
          disabled={isLoadingSetup.value}
        >
          {isLoadingSetup.value ? 'Загрузка...' : 'Настроить 2FA'}
        </button>
        {totpError.value && (
          <div class="error-message" role="alert">
            {totpError.value}
          </div>
        )}
      </div>
    );
  }

  // Форма верификации
  return (
    <div class="totp-setup-form">
      <p class="totp-instructions">
        1. Отсканируйте QR-код в приложении аутентификации (Google Authenticator, Authy и др.)
      </p>

      <div class="qr-code-container">
        {/* P1: Используем data URL от backend — секрет не утекает на внешний сервис */}
        {/* P2-1: Валидация что URL начинается с data:image/ */}
        {totpSetupData.value.qrCodeUrl.startsWith('data:image/') ? (
          <img
            src={totpSetupData.value.qrCodeUrl}
            alt="QR-код для настройки 2FA"
            class="qr-code"
            width="200"
            height="200"
          />
        ) : (
          <div class="error-message" role="alert">
            Некорректный формат QR-кода. Используйте ручной ввод.
          </div>
        )}
      </div>

      <details class="manual-entry">
        <summary>Ввести вручную</summary>
        <code class="secret-code">{totpSetupData.value.secret}</code>
      </details>

      <p class="totp-instructions">
        2. Введите 6-значный код из приложения:
      </p>

      <form class="totp-verify-form" onSubmit={handleVerify}>
        {totpError.value && (
          <div class="error-message" role="alert">
            {totpError.value}
          </div>
        )}

        <div class="form-group">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            value={totpCode.value}
            onInput={(e) => {
              // Только цифры
              const value = (e.target as HTMLInputElement).value.replace(/\D/g, '');
              totpCode.value = value;
            }}
            class="totp-input"
            autocomplete="one-time-code"
            disabled={isVerifying.value}
            required
          />
        </div>

        <button
          type="submit"
          class="btn btn-primary btn-full"
          disabled={isVerifying.value || totpCode.value.length !== 6}
        >
          {isVerifying.value ? 'Проверка...' : 'Подтвердить'}
        </button>
      </form>

      <button
        class="btn btn-secondary"
        onClick={handleCancelSetup}
        disabled={isVerifying.value}
      >
        Отмена
      </button>
    </div>
  );
}

/**
 * Начать настройку 2FA.
 */
async function handleStartSetup() {
  isLoadingSetup.value = true;
  totpError.value = null;

  try {
    const data = await getTotpSetup();
    totpSetupData.value = data;
  } catch (err) {
    if (err instanceof ApiError) {
      totpError.value = err.message;
    } else {
      totpError.value = 'Ошибка загрузки настроек 2FA';
    }
  } finally {
    isLoadingSetup.value = false;
  }
}

/**
 * Отменить настройку.
 */
function handleCancelSetup() {
  totpSetupData.value = null;
  totpCode.value = '';
  totpError.value = null;
}

/**
 * Подтвердить код TOTP.
 */
async function handleVerify(e: Event) {
  e.preventDefault();

  if (isVerifying.value) return;

  isVerifying.value = true;
  totpError.value = null;

  try {
    await verifyTotp(totpCode.value);
    totpSuccess.value = true;
    totpSetupData.value = null;
    totpCode.value = '';
    // Сбрасываем флаг требования 2FA (P2-3: используем setter)
    setTotpRequired(false);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        totpError.value = 'Неверный код. Проверьте время на устройстве.';
      } else {
        totpError.value = err.message;
      }
    } else {
      totpError.value = 'Ошибка проверки кода';
    }
  } finally {
    isVerifying.value = false;
  }
}

/** P2: Вынесен из компонента чтобы не пересоздаваться при каждом рендере */
const isLoggingOut = signal(false);

/**
 * Кнопка выхода.
 */
function LogoutButton() {
  const handleLogout = async () => {
    if (isLoggingOut.value) return;
    isLoggingOut.value = true;

    try {
      await logout();
      // После logout сессия очищается, App покажет LoginPage
    } catch {
      // Даже при ошибке очищаем локальное состояние
    } finally {
      isLoggingOut.value = false;
    }
  };

  return (
    <button
      class="btn btn-secondary"
      onClick={handleLogout}
      disabled={isLoggingOut.value}
    >
      {isLoggingOut.value ? 'Выход...' : 'Выйти'}
    </button>
  );
}
