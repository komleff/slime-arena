/**
 * Страница списка игровых комнат.
 * Polling каждые 5 секунд.
 *
 * Требования:
 * - Показывает: roomId, players/maxPlayers, phase, tick avg/max
 * - "Нет активных комнат" если список пуст
 * - ACC-MON-015: Mobile layout (320px) — всё видимо
 */
import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { apiRequest, ApiError } from '../api/client';

// ============================================================================
// Типы
// ============================================================================

/** Данные комнаты от GET /api/v1/admin/rooms */
interface RoomData {
  roomId: string;
  playerCount: number;
  maxPlayers: number;
  state: 'spawning' | 'playing' | 'ending';
  phase: string;
  duration: number;
  tick: { avg: number; max: number };
}

// ============================================================================
// Сигналы состояния
// ============================================================================

/** Список комнат */
const roomsData = signal<RoomData[]>([]);

/** Ошибка загрузки */
const roomsError = signal<string | null>(null);

/** Загрузка в процессе */
const isLoading = signal(true);

// ============================================================================
// API
// ============================================================================

/** Интервал polling в миллисекундах */
const POLLING_INTERVAL = 5000;

/** Загрузить список комнат с сервера */
async function fetchRooms(): Promise<void> {
  try {
    const data = await apiRequest<RoomData[]>('/rooms');
    roomsData.value = data;
    roomsError.value = null;
  } catch (error) {
    if (error instanceof ApiError) {
      roomsError.value = error.message;
    } else {
      roomsError.value = 'Не удалось загрузить данные';
    }
  } finally {
    isLoading.value = false;
  }
}

// ============================================================================
// Компоненты
// ============================================================================

/** Цвета состояний */
const STATE_COLORS: Record<RoomData['state'], string> = {
  spawning: '#F59E0B', // amber
  playing: '#22C55E',   // green
  ending: '#6B7280',    // gray
};

/** Метки состояний */
const STATE_LABELS: Record<RoomData['state'], string> = {
  spawning: 'Spawning',
  playing: 'Playing',
  ending: 'Ending',
};

/** Форматирование длительности в читаемый вид */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/** Карточка комнаты */
interface RoomCardProps {
  room: RoomData;
}

function RoomCard({ room }: RoomCardProps) {
  const stateColor = STATE_COLORS[room.state];
  const stateLabel = STATE_LABELS[room.state];

  return (
    <div class="room-card">
      {/* Заголовок с ID и статусом */}
      <div class="room-card__header">
        <span class="room-card__id">{room.roomId}</span>
        <span class="room-card__state" style={{ backgroundColor: stateColor }}>
          {stateLabel}
        </span>
      </div>

      {/* Информация о комнате */}
      <div class="room-card__info">
        {/* Игроки */}
        <div class="room-card__row">
          <span class="room-card__label">Players</span>
          <span class="room-card__value">
            {room.playerCount} / {room.maxPlayers}
          </span>
        </div>

        {/* Фаза */}
        <div class="room-card__row">
          <span class="room-card__label">Phase</span>
          <span class="room-card__value">{room.phase}</span>
        </div>

        {/* Tick latency */}
        <div class="room-card__row">
          <span class="room-card__label">Tick</span>
          <span class="room-card__value">
            {room.tick.avg.toFixed(1)} ms
            <span class="room-card__tick-max">(max: {room.tick.max.toFixed(1)})</span>
          </span>
        </div>

        {/* Длительность */}
        <div class="room-card__row">
          <span class="room-card__label">Duration</span>
          <span class="room-card__value">{formatDuration(room.duration)}</span>
        </div>
      </div>
    </div>
  );
}

/** Пустое состояние */
function EmptyState() {
  return (
    <div class="empty-state">
      <span class="empty-state__icon">👥</span>
      <span class="empty-state__text">Нет активных комнат</span>
    </div>
  );
}

// ============================================================================
// Главный компонент
// ============================================================================

export function RoomsPage() {
  // Запуск polling при монтировании
  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Polling с setTimeout для предотвращения наложения запросов
    async function poll() {
      await fetchRooms();
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
      <div class="page rooms-page">
        <h1 class="page-title">Rooms</h1>
        <div class="loading-indicator">
          <div class="loading-spinner" />
          <span>Загрузка комнат...</span>
        </div>
      </div>
    );
  }

  // Ошибка загрузки
  if (roomsError.value) {
    return (
      <div class="page rooms-page">
        <h1 class="page-title">Rooms</h1>
        <div class="error-message">
          {roomsError.value}
        </div>
      </div>
    );
  }

  const rooms = roomsData.value;

  return (
    <div class="page rooms-page">
      <h1 class="page-title">
        Rooms
        {rooms.length > 0 && (
          <span class="rooms-count">({rooms.length})</span>
        )}
      </h1>

      {/* Пустое состояние или список комнат */}
      {rooms.length === 0 ? (
        <EmptyState />
      ) : (
        <div class="rooms-list">
          {rooms.map((room) => (
            <RoomCard key={room.roomId} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}
