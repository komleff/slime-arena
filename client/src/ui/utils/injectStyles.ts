/**
 * Утилита для внедрения CSS стилей в документ.
 * Предотвращает дублирование стилей через Set отслеживания.
 */

const injectedStyles = new Set<string>();

/**
 * Внедряет CSS стили в документ, если они ещё не были добавлены.
 * @param id Уникальный идентификатор стилей (используется как id элемента style)
 * @param css CSS код для внедрения
 */
export function injectStyles(id: string, css: string): void {
  if (injectedStyles.has(id)) return;

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
