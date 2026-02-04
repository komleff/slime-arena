/**
 * Главная страница: статус сервера, метрики CPU/RAM/Rooms/Players/Tick.
 * Polling каждые 5 секунд.
 *
 * Требования:
 * - ACC-MON-009: Dashboard показывает CPU, RAM, Rooms, Players
 * - ACC-MON-010: Статус корректен по правилам
 * - ACC-MON-015: Mobile layout (320px) — всё видимо
 */
import { signal, computed } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { apiRequest, ApiError } from '../api/client';

// ============================================================================
// Типы
// ============================================================================

/** Ответ от GET /api/v1/admin/stats */
interface StatsResponse {
  cpu: number;
  memory: {
    used: number;
    total: number;
    percent: number;
  };
  uptime: number;
  rooms: number | null;
  players: number | null;
  tick: { avg: number; max: number } | null;
  timestamp: string;
}

/** Статус сервера */
type ServerStatus = 'online' | 'degraded' | 'offline' | 'unknown';

// ============================================================================
// Сигналы состояния
// ============================================================================

/** Данные статистики */
const statsData = signal<StatsResponse | null>(null);

/** Ошибка загрузки */
const statsError = signal<string | null>(null);

/** Загрузка в процессе */
const isLoading = signal(true);

/** Вычисляемый статус сервера */
const serverStatus = computed<ServerStatus>(() => {
  if (statsError.value) return 'offline';
  if (!statsData.value) return 'unknown';

  const { cpu, memory } = statsData.value;

  // Статус "Online" если CPU < 90% и RAM < 90%
  // Статус "Degraded" если CPU >= 90% или RAM >= 90%
  if (cpu >= 90 || memory.percent >= 90) {
    return 'degraded';
  }

  return 'online';
});

// ============================================================================
// API
// ============================================================================

/** Интервал polling в миллисекундах */
const POLLING_INTERVAL = 5000;

/** Загрузить статистику с сервера */
async function fetchStats(): Promise<void> {
  try {
    const data = await apiRequest<StatsResponse>('/stats');
    statsData.value = data;
    statsError.value = null;
  } catch (error) {
    if (error instanceof ApiError) {
      statsError.value = error.message;
    } else {
      statsError.value = 'Не удалось загрузить данные';
    }
  } finally {
    isLoading.value = false;
  }
}

// ============================================================================
// Компоненты
// ============================================================================

/** Цвета статусов */
const STATUS_COLORS: Record<ServerStatus, string> = {
  online: '#22C55E',
  degraded: '#F59E0B',
  offline: '#EF4444',
  unknown: '#6B7280',
};

/** Метки статусов */
const STATUS_LABELS: Record<ServerStatus, string> = {
  online: 'Online',
  degraded: 'Degraded',
  offline: 'Offline',
  unknown: 'Unknown',
};

/** Карточка статуса сервера */
function StatusCard() {
  const status = serverStatus.value;
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  return (
    <div class="status-card">
      <div class="status-card__indicator" style={{ backgroundColor: color }} />
      <div class="status-card__content">
        <span class="status-card__label">Статус сервера</span>
        <span class="status-card__value" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

/** Карточка метрики */
interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
}

function MetricCard({ label, value, unit, subtitle }: MetricCardProps) {
  return (
    <div class="metric-card">
      <span class="metric-card__label">{label}</span>
      <div class="metric-card__value-row">
        <span class="metric-card__value">{value}</span>
        {unit && <span class="metric-card__unit">{unit}</span>}
      </div>
      {subtitle && <span class="metric-card__subtitle">{subtitle}</span>}
    </div>
  );
}

/** Форматирование uptime в читаемый вид */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ============================================================================
// Главный компонент
// ============================================================================

export function DashboardPage() {
  // Запуск polling при монтировании
  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Polling с setTimeout для предотвращения наложения запросов
    async function poll() {
      await fetchStats();
      // Следующий запрос только после завершения предыдущего
      if (mounted) {
        timeoutId = setTimeout(poll, POLLING_INTERVAL);
      }
    }

    // Запуск polling
    poll();

    // Очистка при размонтировании
    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Состояние загрузки
  if (isLoading.value) {
    return (
      <div class="page dashboard-page">
        <h1 class="page-title">Dashboard</h1>
        <div class="loading-indicator">
          <div class="loading-spinner" />
          <span>Загрузка метрик...</span>
        </div>
      </div>
    );
  }

  // Ошибка загрузки (сервер недоступен)
  if (statsError.value && !statsData.value) {
    return (
      <div class="page dashboard-page">
        <h1 class="page-title">Dashboard</h1>
        <StatusCard />
        <div class="error-message" style={{ marginTop: '16px' }}>
          {statsError.value}
        </div>
      </div>
    );
  }

  const stats = statsData.value!;

  return (
    <div class="page dashboard-page">
      <h1 class="page-title">Dashboard</h1>

      {/* Карточка статуса */}
      <StatusCard />

      {/* Сетка метрик */}
      <div class="metrics-grid">
        <MetricCard
          label="CPU"
          value={Math.round(stats.cpu)}
          unit="%"
        />
        <MetricCard
          label="RAM"
          value={Math.round(stats.memory.percent)}
          unit="%"
          subtitle={`${Math.round(stats.memory.used)} / ${Math.round(stats.memory.total)} MB`}
        />
        <MetricCard
          label="Rooms"
          value={stats.rooms ?? '—'}
        />
        <MetricCard
          label="Players"
          value={stats.players ?? '—'}
        />
        <MetricCard
          label="Tick Latency"
          value={stats.tick ? stats.tick.avg.toFixed(1) : '—'}
          unit={stats.tick ? 'ms' : ''}
          subtitle={stats.tick ? `max: ${stats.tick.max.toFixed(1)} ms` : undefined}
        />
      </div>

      {/* Время работы */}
      <div class="uptime-info">
        <span class="uptime-info__label">Uptime:</span>
        <span class="uptime-info__value">{formatUptime(stats.uptime)}</span>
      </div>

      {/* Время последнего обновления */}
      <div class="last-update">
        Обновлено: {new Date(stats.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}
