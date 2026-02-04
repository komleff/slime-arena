/**
 * Нижняя панель навигации с 4 вкладками.
 */
import { currentTab, TabId } from '../App';

interface TabItem {
  id: TabId;
  label: string;
  icon: string; // Временно emoji, позже можно заменить на SVG
}

const tabs: TabItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'rooms', label: 'Rooms', icon: '👥' },
  { id: 'audit', label: 'Audit', icon: '📋' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export function TabBar() {
  return (
    <nav class="tab-bar" role="navigation" aria-label="Основная навигация">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          class={`tab-item ${currentTab.value === tab.id ? 'tab-item--active' : ''}`}
          onClick={() => (currentTab.value = tab.id)}
          aria-current={currentTab.value === tab.id ? 'page' : undefined}
        >
          <span class="tab-icon" aria-hidden="true">{tab.icon}</span>
          <span class="tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
