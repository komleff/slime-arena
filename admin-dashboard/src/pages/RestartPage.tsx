/**
 * Страница перезапуска сервера.
 * Требует 2FA-код для подтверждения.
 */
import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { apiRequest, ApiError } from '../api/client';
import { totpRequired, totpSuccess } from '../auth/signals';
import { currentTab } from '../App';

/** Состояние страницы */
type RestartState = 'idle' | 'confirming' | 'sending' | 'sent' | 'error';

const restartState = signal<RestartState>('idle');
const totpCode = signal('');
const errorMessage = signal<string | null>(null);
const auditId = signal<string | null>(null);

/**
 * Отправить запрос на перезапуск сервера.
 */
async function restartServer(code: string): Promise<{ auditId: string }> {
  return apiRequest('/restart', {
    method: 'POST',
    headers: { 'X-2FA-Code': code },
  });
}

export function RestartPage() {
  // Сброс состояния при монтировании (заход на вкладку)
  useEffect(() => {
    restartState.value = 'idle';
    totpCode.value = '';
    errorMessage.value = null;
    auditId.value = null;
  }, []);

  // totpRequired = сервер подтвердил что 2FA включена (при логине)
  // totpSuccess = 2FA настроена в текущей сессии (через Settings)
  const is2FAConfigured = totpRequired.value || totpSuccess.value;

  return (
    <div class="page restart-page">
      <h1 class="page-title">Перезапуск сервера</h1>

      {!is2FAConfigured ? (
        <No2FAWarning />
      ) : (
        <RestartControl />
      )}
    </div>
  );
}

/**
 * Предупреждение: 2FA не настроена.
 */
function No2FAWarning() {
  return (
    <div class="restart-section">
      <div class="restart-warning">
        <span class="restart-warning__icon">&#9888;</span>
        <div>
          <p class="restart-warning__title">2FA не настроена</p>
          <p class="restart-warning__text">
            Для перезапуска сервера необходимо сначала настроить двухфакторную аутентификацию.
          </p>
          <button
            class="btn btn-primary"
            style="margin-top: 12px"
            onClick={() => (currentTab.value = 'settings')}
          >
            Настроить 2FA
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Основной блок управления перезапуском.
 */
function RestartControl() {
  const state = restartState.value;

  return (
    <div class="restart-section">
      <div class="restart-info">
        <p>Перезапуск остановит все активные матчи и перезагрузит сервер.</p>
        <p class="restart-info__detail">
          Время простоя: ~60 секунд. Игроки будут отключены.
        </p>
      </div>

      {state === 'idle' && <IdleState />}
      {state === 'confirming' && <ConfirmingState />}
      {state === 'sending' && <SendingState />}
      {state === 'sent' && <SentState />}
      {state === 'error' && <ErrorState />}
    </div>
  );
}

/** Начальное состояние — кнопка перезапуска */
function IdleState() {
  return (
    <button
      class="btn btn-danger btn-full restart-btn"
      onClick={() => {
        restartState.value = 'confirming';
        totpCode.value = '';
        errorMessage.value = null;
      }}
    >
      Перезапустить сервер
    </button>
  );
}

/** Подтверждение — ввод 2FA-кода */
function ConfirmingState() {
  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (totpCode.value.length !== 6) return;

    restartState.value = 'sending';
    errorMessage.value = null;

    try {
      const result = await restartServer(totpCode.value);
      auditId.value = result.auditId;
      restartState.value = 'sent';
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          errorMessage.value = 'Неверный 2FA-код';
        } else if (err.status === 429) {
          errorMessage.value = 'Слишком частые запросы (лимит: 2 в минуту)';
        } else if (err.status === 409) {
          errorMessage.value = 'Перезапуск уже запрошен';
        } else {
          errorMessage.value = err.message;
        }
      } else {
        errorMessage.value = 'Ошибка соединения с сервером';
      }
      restartState.value = 'error';
    }
  };

  return (
    <form class="restart-confirm" onSubmit={handleSubmit}>
      <div class="restart-confirm__warning">
        Вы уверены? Все активные матчи будут прерваны.
      </div>

      <div class="form-group">
        <label>Введите 2FA-код для подтверждения:</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="000000"
          value={totpCode.value}
          onInput={(e) => {
            totpCode.value = (e.target as HTMLInputElement).value.replace(/\D/g, '');
          }}
          class="totp-input"
          autocomplete="one-time-code"
          autofocus
          required
        />
      </div>

      <div class="restart-confirm__actions">
        <button
          type="submit"
          class="btn btn-danger"
          disabled={totpCode.value.length !== 6}
        >
          Подтвердить перезапуск
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          onClick={() => {
            restartState.value = 'idle';
            totpCode.value = '';
          }}
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

/** Отправка запроса */
function SendingState() {
  return (
    <div class="restart-status">
      <div class="loading-spinner" />
      <p>Отправка запроса на перезапуск...</p>
    </div>
  );
}

/** Запрос отправлен */
function SentState() {
  return (
    <div class="restart-status restart-status--success">
      <span class="restart-status__icon">&#10003;</span>
      <p class="restart-status__title">Запрос отправлен</p>
      <p class="restart-status__text">
        Сервер перезапустится в течение ~60 секунд.
        Страница станет недоступна на время перезагрузки.
      </p>
      {auditId.value && (
        <p class="restart-status__audit">
          Audit ID: <code>{auditId.value}</code>
        </p>
      )}
      <button
        class="btn btn-secondary"
        style="margin-top: 16px"
        onClick={() => {
          restartState.value = 'idle';
          auditId.value = null;
        }}
      >
        Готово
      </button>
    </div>
  );
}

/** Ошибка */
function ErrorState() {
  return (
    <div class="restart-status restart-status--error">
      {errorMessage.value && (
        <div class="error-message" role="alert">
          {errorMessage.value}
        </div>
      )}
      <div class="restart-confirm__actions" style="margin-top: 12px">
        <button
          class="btn btn-danger"
          onClick={() => {
            restartState.value = 'confirming';
            errorMessage.value = null;
          }}
        >
          Попробовать снова
        </button>
        <button
          class="btn btn-secondary"
          onClick={() => {
            restartState.value = 'idle';
            errorMessage.value = null;
            totpCode.value = '';
          }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
