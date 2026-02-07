/**
 * ShutdownBanner — красный баннер с обратным отсчётом до перезагрузки сервера.
 * Показывается поверх всего UI, когда shutdownAt > 0.
 */

import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { shutdownAt } from '../signals/gameState';
import { injectStyles } from '../utils/injectStyles';

const STYLES_ID = 'shutdown-banner-styles';

/** Оставшиеся секунды до перезагрузки (обновляется каждую секунду) */
const countdown = signal(0);

export function ShutdownBanner() {
  useEffect(() => {
    injectStyles(STYLES_ID, styles);
  }, []);

  // Обновляем countdown каждую секунду
  useEffect(() => {
    if (!shutdownAt.value || shutdownAt.value <= 0) {
      countdown.value = 0;
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((shutdownAt.value - Date.now()) / 1000));
      countdown.value = remaining;
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [shutdownAt.value]);

  if (!shutdownAt.value || shutdownAt.value <= 0 || countdown.value <= 0) {
    return null;
  }

  return (
    <div class="shutdown-banner">
      <span class="shutdown-banner__icon">&#9888;</span>
      <span class="shutdown-banner__text">
        Сервер будет перезагружен через {countdown.value} сек!
      </span>
    </div>
  );
}

const styles = /* css */ `
.shutdown-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: #d32f2f;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  text-align: center;
  animation: shutdown-banner-pulse 1.5s ease-in-out infinite;
  pointer-events: none;
  user-select: none;
}

.shutdown-banner__icon {
  font-size: 20px;
}

@keyframes shutdown-banner-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
`;
