/**
 * Страница аудит-лога административных действий.
 * Отображает историю действий администраторов с пагинацией.
 */
import { signal, computed } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { apiRequest, ApiError } from '../api/client';

/** Запись аудит-лога */
interface AuditEntry {
  id: string;
  timestamp: string;       // ISO-8601
  actorUserId: string;
  action: string;          // "login", "logout", "settings_change", etc.
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/** Ответ API аудит-лога */
interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

/** Размер страницы для пагинации */
const PAGE_SIZE = 50;

/** Состояние компонента */
const auditEntries = signal<AuditEntry[]>([]);
const isLoading = signal(false);
const isLoadingMore = signal(false);
const error = signal<string | null>(null);
const offset = signal(0);
const hasMore = signal(true);

/** Вычисляемое значение: есть ли записи для отображения */
const hasEntries = computed(() => auditEntries.value.length > 0);

/**
 * Форматирует ISO timestamp в человекочитаемый формат.
 * Формат: "DD.MM.YYYY HH:MM:SS"
 */
function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return isoString;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
  } catch {
    return isoString;
  }
}

/**
 * Форматирует action в человекочитаемый вид.
 */
function formatAction(action: string): string {
  const actionMap: Record<string, string> = {
    login: 'Вход',
    logout: 'Выход',
    settings_change: 'Изменение настроек',
    totp_setup: 'Настройка 2FA',
    totp_verify: 'Верификация 2FA',
    password_change: 'Смена пароля',
    room_restart: 'Перезапуск комнаты',
    server_restart: 'Перезапуск сервера',
  };
  return actionMap[action] || action;
}

/**
 * Форматирует details объект в строку.
 */
function formatDetails(details?: Record<string, unknown>): string {
  if (!details || Object.keys(details).length === 0) {
    return '-';
  }
  try {
    return JSON.stringify(details);
  } catch {
    return '-';
  }
}

/**
 * Загрузка записей аудита.
 */
async function loadAuditEntries(loadMore = false): Promise<void> {
  if (loadMore) {
    isLoadingMore.value = true;
  } else {
    isLoading.value = true;
    offset.value = 0;
    auditEntries.value = [];
  }
  error.value = null;

  try {
    const currentOffset = loadMore ? offset.value : 0;
    const response = await apiRequest<AuditResponse>(
      `/audit?limit=${PAGE_SIZE}&offset=${currentOffset}`
    );

    if (loadMore) {
      auditEntries.value = [...auditEntries.value, ...response.entries];
    } else {
      auditEntries.value = response.entries;
    }

    // Обновляем offset для следующей загрузки
    offset.value = currentOffset + response.entries.length;

    // Проверяем, есть ли ещё записи
    hasMore.value = response.entries.length === PAGE_SIZE &&
                    offset.value < response.total;
  } catch (err) {
    if (err instanceof ApiError) {
      error.value = err.message;
    } else {
      error.value = 'Ошибка загрузки аудит-лога';
    }
  } finally {
    isLoading.value = false;
    isLoadingMore.value = false;
  }
}

/**
 * Обработчик нажатия "Загрузить ещё".
 */
function handleLoadMore(): void {
  loadAuditEntries(true);
}

export function AuditPage() {
  // Загружаем данные при монтировании
  useEffect(() => {
    loadAuditEntries();
  }, []);

  return (
    <div class="page audit-page">
      <h1 class="page-title">Аудит-лог</h1>

      {/* Ошибка */}
      {error.value && (
        <div class="error-message audit-error" role="alert">
          {error.value}
          <button
            class="btn btn-secondary audit-retry-btn"
            onClick={() => loadAuditEntries()}
          >
            Повторить
          </button>
        </div>
      )}

      {/* Загрузка */}
      {isLoading.value && (
        <div class="audit-loading">
          <div class="loading-spinner" />
          <span>Загрузка...</span>
        </div>
      )}

      {/* Пустой список */}
      {!isLoading.value && !error.value && !hasEntries.value && (
        <div class="placeholder-content">
          <p>Записей в аудит-логе нет.</p>
        </div>
      )}

      {/* Таблица/список записей */}
      {hasEntries.value && (
        <>
          {/* Мобильный список */}
          <div class="audit-list-mobile">
            {auditEntries.value.map((entry) => (
              <AuditEntryCard key={entry.id} entry={entry} />
            ))}
          </div>

          {/* Десктопная таблица */}
          <div class="audit-table-desktop">
            <table class="audit-table">
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Админ</th>
                  <th>Действие</th>
                  <th>Цель</th>
                  <th>Детали</th>
                </tr>
              </thead>
              <tbody>
                {auditEntries.value.map((entry) => (
                  <tr key={entry.id}>
                    <td class="audit-cell-timestamp">
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td class="audit-cell-admin">{entry.actorUserId}</td>
                    <td class="audit-cell-action">
                      <span class={`audit-action audit-action--${entry.action}`}>
                        {formatAction(entry.action)}
                      </span>
                    </td>
                    <td class="audit-cell-target">
                      {entry.targetType
                        ? `${entry.targetType}${entry.targetId ? `: ${entry.targetId}` : ''}`
                        : '-'}
                    </td>
                    <td class="audit-cell-details">
                      {formatDetails(entry.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Кнопка "Загрузить ещё" */}
          {hasMore.value && (
            <div class="audit-load-more">
              <button
                class="btn btn-secondary btn-full"
                onClick={handleLoadMore}
                disabled={isLoadingMore.value}
              >
                {isLoadingMore.value ? 'Загрузка...' : 'Загрузить ещё'}
              </button>
            </div>
          )}

          {/* Индикатор конца списка */}
          {!hasMore.value && auditEntries.value.length > 0 && (
            <div class="audit-end-marker">
              Показано записей: {auditEntries.value.length}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Карточка записи для мобильного вида.
 */
function AuditEntryCard({ entry }: { entry: AuditEntry }) {
  return (
    <div class="audit-card">
      <div class="audit-card-header">
        <span class={`audit-action audit-action--${entry.action}`}>
          {formatAction(entry.action)}
        </span>
        <span class="audit-card-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div class="audit-card-body">
        <div class="audit-card-row">
          <span class="audit-card-label">Админ:</span>
          <span class="audit-card-value">{entry.actorUserId}</span>
        </div>
        {entry.targetType && (
          <div class="audit-card-row">
            <span class="audit-card-label">Цель:</span>
            <span class="audit-card-value">
              {entry.targetType}{entry.targetId ? `: ${entry.targetId}` : ''}
            </span>
          </div>
        )}
        {entry.details && Object.keys(entry.details).length > 0 && (
          <div class="audit-card-row">
            <span class="audit-card-label">Детали:</span>
            <span class="audit-card-value audit-card-details">
              {formatDetails(entry.details)}
            </span>
          </div>
        )}
        {entry.ipAddress && (
          <div class="audit-card-row">
            <span class="audit-card-label">IP:</span>
            <span class="audit-card-value">{entry.ipAddress}</span>
          </div>
        )}
      </div>
    </div>
  );
}
