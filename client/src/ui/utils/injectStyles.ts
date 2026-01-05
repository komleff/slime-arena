/**
 * Утилита для внедрения CSS стилей в документ.
 * Предотвращает дублирование стилей через Set отслеживания и проверку DOM.
 * 
 * Вызов на уровне модуля безопасен для HMR: Set сохраняется между перезагрузками,
 * а проверка document.getElementById предотвращает дублирование в DOM.
 */

const injectedStyles = new Set<string>();

/**
 * Внедряет CSS стили в документ, если они ещё не были добавлены.
 * @param id Уникальный идентификатор стилей (используется как id элемента style)
 * @param css CSS код для внедрения
 */
export function injectStyles(id: string, css: string): void {
  // Сначала проверяем кэш
  if (injectedStyles.has(id)) {
    return;
  }
  // Затем проверяем DOM и синхронизируем кэш (для HMR)
  if (document.getElementById(id)) {
    injectedStyles.add(id);
    return;
  }

  const styleEl = document.createElement('style');
  styleEl.id = id;
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  injectedStyles.add(id);
}

/**
 * Проверяет, были ли стили уже внедрены.
 * @param id Идентификатор стилей
 */
export function hasStyles(id: string): boolean {
  return injectedStyles.has(id);
}
