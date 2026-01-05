/**
 * UI экспорты — точка входа для всех UI компонентов
 */

// Bridge — главный API для интеграции с игрой
export * from './UIBridge';

// Signals (состояние)
export * from './signals/gameState';

// Screen Manager
export { 
  ScreenManager, 
  registerScreen, 
  registerModal,
  navigateTo,
  goBack,
  showModal,
  hideModal,
  mountScreenManager,
  unmountScreenManager,
} from './screens/ScreenManager';

// Components
export { GameHUD } from './components/GameHUD';
export { TalentModal } from './components/TalentModal';
export { ResultsScreen } from './components/ResultsScreen';
export { AbilityButtons } from './components/AbilityButtons';
export { MainMenu } from './components/MainMenu';
