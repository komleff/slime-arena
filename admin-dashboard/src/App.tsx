/**
 * Корневой компонент приложения с роутингом.
 */
import { signal, computed } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { isAuthenticated } from './auth/signals';
import { tryRestoreSession } from './api/client';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { RoomsPage } from './pages/RoomsPage';
import { AuditPage } from './pages/AuditPage';
import { SettingsPage } from './pages/SettingsPage';
import { TabBar } from './components/TabBar';

/** Текущая вкладка */
export type TabId = 'dashboard' | 'rooms' | 'audit' | 'settings';
export const currentTab = signal<TabId>('dashboard');

/** Состояние загрузки при восстановлении сессии */
const isLoading = signal(true);

export function App() {
  // Попытка восстановить сессию при загрузке
  useEffect(() => {
    tryRestoreSession().finally(() => {
      isLoading.value = false;
    });
  }, []);

  // Показываем индикатор загрузки
  if (isLoading.value) {
    return (
      <div class="loading-screen">
        <div class="loading-spinner" />
        <p>Загрузка...</p>
      </div>
    );
  }

  // Если не авторизован — показываем логин
  if (!isAuthenticated.value) {
    return <LoginPage />;
  }

  // Основной layout с TabBar
  return (
    <div class="app-layout">
      <main class="app-content">
        <PageRouter />
      </main>
      <TabBar />
    </div>
  );
}

/**
 * Роутер страниц по текущей вкладке.
 */
function PageRouter() {
  switch (currentTab.value) {
    case 'dashboard':
      return <DashboardPage />;
    case 'rooms':
      return <RoomsPage />;
    case 'audit':
      return <AuditPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <DashboardPage />;
  }
}
