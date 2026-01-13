/**
 * ScreenManager — система управления экранами и модальными окнами
 * Реализует стек экранов с анимациями переходов
 */

import type { JSX } from 'preact';
import { render, VNode } from 'preact';
import { useEffect, useCallback, useRef } from 'preact/hooks';
// Signals читаются напрямую через .value, без useSignal
import { injectStyles } from '../utils/injectStyles';
import {
  currentScreen,
  activeModal,
  pushScreen,
  popScreen,
  openModal,
  closeModal,
  type ScreenType,
  type ModalType,
} from '../signals/gameState';

// ========== Типы ==========

export interface ScreenConfig {
  id: ScreenType;
  component: () => VNode;
  title?: string;
  canGoBack?: boolean;
  showHeader?: boolean;
}

export interface ModalConfig {
  id: ModalType;
  component: () => VNode;
  title?: string;
  closable?: boolean;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
}

// ========== Реестр экранов и модалок ==========

const screenRegistry = new Map<ScreenType, ScreenConfig>();
const modalRegistry = new Map<ModalType, ModalConfig>();

export function registerScreen(config: ScreenConfig) {
  screenRegistry.set(config.id, config);
}

export function registerModal(config: ModalConfig) {
  modalRegistry.set(config.id, config);
}

// ========== CSS стили ==========

const styles = `
  .screen-manager {
    position: fixed;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: 100;
  }
  
  .screen-manager > * {
    pointer-events: auto;
  }

  .screen-container {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
  }

  .screen-content {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* Анимации переходов */
  .screen-enter {
    animation: slideInRight 250ms ease-out forwards;
  }

  .screen-exit {
    animation: slideOutLeft 250ms ease-out forwards;
  }

  .screen-enter-back {
    animation: slideInLeft 250ms ease-out forwards;
  }

  .screen-exit-back {
    animation: slideOutRight 250ms ease-out forwards;
  }

  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0.8; }
    to { transform: translateX(0); opacity: 1; }
  }

  @keyframes slideOutLeft {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(-30%); opacity: 0.5; }
  }

  @keyframes slideInLeft {
    from { transform: translateX(-30%); opacity: 0.5; }
    to { transform: translateX(0); opacity: 1; }
  }

  @keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0.8; }
  }

  /* Модальные окна */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    animation: fadeIn 200ms ease-out;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .modal-container {
    background: linear-gradient(160deg, #101721, #0c0f14);
    border: 1px solid #2a3c55;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    animation: modalSlideIn 250ms ease-out;
    max-height: 90vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .modal-small { width: min(320px, 90vw); }
  .modal-medium { width: min(480px, 90vw); }
  .modal-large { width: min(640px, 90vw); }
  .modal-fullscreen { 
    width: 100vw; 
    height: 100vh; 
    border-radius: 0;
    max-height: 100vh;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .modal-title {
    font-size: 18px;
    font-weight: 700;
    color: #e6f3ff;
    margin: 0;
  }

  .modal-close {
    background: none;
    border: none;
    color: #6a8099;
    font-size: 24px;
    cursor: pointer;
    padding: 4px 8px;
    transition: color 150ms;
  }

  .modal-close:hover {
    color: #e6f3ff;
  }

  .modal-body {
    padding: 20px;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes modalSlideIn {
    from { transform: translateY(20px) scale(0.95); opacity: 0; }
    to { transform: translateY(0) scale(1); opacity: 1; }
  }

  /* Safe area поддержка с корректными fallback значениями */
  .safe-area-top {
    padding-top: max(env(safe-area-inset-top, 0px), 0px);
  }

  .safe-area-bottom {
    padding-bottom: max(env(safe-area-inset-bottom, 0px), 0px);
  }

  .safe-area-left {
    padding-left: max(env(safe-area-inset-left, 0px), 0px);
  }

  .safe-area-right {
    padding-right: max(env(safe-area-inset-right, 0px), 0px);
  }
`;

const STYLES_ID = 'screen-manager-styles';

// ========== Компоненты ==========

/**
 * Модальное окно с focus trap для доступности
 */
function Modal({ config, onClose }: { config: ModalConfig; onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  const handleBackdropClick = useCallback((e: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && config.closable !== false) {
      onClose();
    }
  }, [config.closable, onClose]);

  // Для глобальных обработчиков (window.addEventListener) используем DOM KeyboardEvent
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && config.closable !== false) {
      onClose();
    }
  }, [onClose, config.closable]);

  // Focus management: сохраняем фокус при открытии, возвращаем при закрытии
  useEffect(() => {
    // Сохраняем текущий фокус
    previousFocusRef.current = document.activeElement;

    // Перемещаем фокус на модальное окно
    const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements && focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      modalRef.current?.focus();
    }

    return () => {
      // Возвращаем фокус при закрытии
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const sizeClass = `modal-${config.size || 'medium'}`;

  return (
    <div class="modal-backdrop" onClick={handleBackdropClick}>
      <div 
        ref={modalRef}
        class={`modal-container ${sizeClass}`} 
        role="dialog" 
        aria-modal="true"
        tabIndex={-1}
      >
        {config.title && (
          <div class="modal-header">
            <h2 class="modal-title">{config.title}</h2>
            {config.closable !== false && (
              <button class="modal-close" onClick={onClose} aria-label="Закрыть">
                ✕
              </button>
            )}
          </div>
        )}
        <div class="modal-body">
          {config.component()}
        </div>
      </div>
    </div>
  );
}

/**
 * Главный компонент ScreenManager
 */
export function ScreenManager() {
  const screen = currentScreen.value;
  const modal = activeModal.value;
  const config = screenRegistry.get(screen);
  const modalConfig = modal ? modalRegistry.get(modal) : null;

  // Обработка hardware back button
  useEffect(() => {
    const handlePopState = () => {
      // Сначала закрываем модалку, если есть
      if (activeModal.value) {
        closeModal();
        // replaceState вместо pushState чтобы не накапливать историю
        window.history.replaceState(null, '', window.location.href);
        return;
      }

      // Затем возвращаемся по стеку экранов
      const popped = popScreen();
      if (popped) {
        // replaceState вместо pushState чтобы не накапливать историю
        window.history.replaceState(null, '', window.location.href);
      }
    };

    // Добавляем запись в историю только если ещё не добавляли (проверка через state)
    if (!window.history.state?.__screenManagerInit) {
      window.history.pushState({ __screenManagerInit: true }, '', window.location.href);
    }
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Инжектируем стили при монтировании
  useEffect(() => {
    injectStyles(STYLES_ID, styles);
  }, []);

  if (!config) {
    return null;
  }

  return (
    <div class="screen-manager">
      <div class="screen-container safe-area-top safe-area-bottom">
        <div class="screen-content">
          {config.component()}
        </div>
      </div>
      
      {modalConfig && (
        <Modal config={modalConfig} onClose={closeModal} />
      )}
    </div>
  );
}

// ========== Навигационные хелперы ==========

export function navigateTo(screen: ScreenType) {
  pushScreen(screen);
}

export function goBack(): boolean {
  const popped = popScreen();
  return popped !== null;
}

export function showModal(modal: ModalType) {
  openModal(modal);
}

export function hideModal() {
  closeModal();
}

// ========== Регистрация экранов ==========

import { MainScreen } from './MainScreen';
import { LobbyScreen } from './LobbyScreen';
import { MatchmakingScreen } from './MatchmakingScreen';

// Регистрируем экраны при загрузке модуля
registerScreen({ id: 'main-menu', component: () => <MainScreen /> });
registerScreen({ id: 'lobby', component: () => <LobbyScreen /> });
registerScreen({ id: 'matchmaking', component: () => <MatchmakingScreen /> });

// ========== Рендер ==========

let screenManagerRoot: HTMLElement | null = null;

export function mountScreenManager(container: HTMLElement) {
  screenManagerRoot = container;
  render(<ScreenManager />, container);
}

export function unmountScreenManager() {
  if (screenManagerRoot) {
    render(null, screenManagerRoot);
    screenManagerRoot = null;
  }
}
