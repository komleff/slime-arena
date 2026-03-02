/**
 * ConnectingScreen — индикатор подключения к серверу
 *
 * Показывается при фазе "connecting" (например, при нажатии "Играть ещё"),
 * чтобы предотвратить мелькание главного экрана (#126).
 */

import { injectStyles } from '../utils/injectStyles';

const STYLES_ID = 'connecting-screen-styles';

const styles = `
  .connecting-screen {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #090b10;
    font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    z-index: 1000;
    color: #e6f3ff;
  }

  .connecting-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(111, 214, 255, 0.2);
    border-top-color: #6fd6ff;
    border-radius: 50%;
    animation: connecting-spin 0.8s linear infinite;
    margin-bottom: 20px;
  }

  .connecting-text {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: #a7c6ff;
  }

  @keyframes connecting-spin {
    to { transform: rotate(360deg); }
  }
`;

export function ConnectingScreen() {
  injectStyles(STYLES_ID, styles);

  return (
    <div class="connecting-screen">
      <div class="connecting-spinner" />
      <div class="connecting-text">Подключение...</div>
    </div>
  );
}
