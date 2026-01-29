/**
 * Валидатор никнеймов игроков.
 * Проверяет длину, допустимые символы и фильтрует запрещённый контент.
 */

/**
 * Результат валидации никнейма.
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Конфигурация валидатора никнеймов.
 */
export const NICKNAME_CONFIG = {
  minLength: 2,
  maxLength: 20,
  // Разрешены: латиница, кириллица, цифры, пробел, дефис, подчёркивание
  allowedPattern: /^[A-Za-zА-Яа-яЁё0-9 _-]+$/,
};

/**
 * Список запрещённых слов (базовый набор).
 * В production должен загружаться из внешнего источника.
 */
const BANNED_WORDS = [
  'admin',
  'moderator',
  'mod',
  'support',
  'official',
  'bot',
  'system',
  // 'slime', 'arena' — разрешены, т.к. используются в гостевых никнеймах
  'dev',
  'staff',
  'gm',
  'gamemaster',
];

/**
 * Проверяет никнейм на соответствие правилам.
 *
 * Правила валидации:
 * - Длина от 2 до 20 символов
 * - Разрешены: A-Z, a-z, А-Я, а-я, 0-9, пробел, дефис, подчёркивание
 * - Запрещены: эмодзи, HTML-теги, спецсимволы
 * - Запрещены зарезервированные слова
 *
 * @param nickname - никнейм для проверки
 * @returns true если никнейм валиден, false иначе
 */
export function validateNickname(nickname: string): boolean {
  const result = validateNicknameDetailed(nickname);
  return result.valid;
}

/**
 * Проверяет никнейм на соответствие правилам с детальным описанием ошибки.
 *
 * @param nickname - никнейм для проверки
 * @returns объект с результатом валидации и описанием ошибки
 */
export function validateNicknameDetailed(nickname: string): ValidationResult {
  // Проверка на пустое значение
  if (nickname === null || nickname === undefined) {
    return { valid: false, error: 'nickname_required' };
  }

  // Приведение к строке и удаление пробелов в начале/конце
  const trimmed = String(nickname).trim();

  // Проверка длины (после trim)
  if (trimmed.length < NICKNAME_CONFIG.minLength) {
    return {
      valid: false,
      error: `nickname_too_short (min: ${NICKNAME_CONFIG.minLength})`,
    };
  }

  if (trimmed.length > NICKNAME_CONFIG.maxLength) {
    return {
      valid: false,
      error: `nickname_too_long (max: ${NICKNAME_CONFIG.maxLength})`,
    };
  }

  // Проверка на допустимые символы
  if (!NICKNAME_CONFIG.allowedPattern.test(trimmed)) {
    return {
      valid: false,
      error: 'nickname_invalid_characters',
    };
  }

  // Проверка на запрещённые слова (без учёта регистра)
  const lowerNickname = trimmed.toLowerCase();
  for (const bannedWord of BANNED_WORDS) {
    if (lowerNickname.includes(bannedWord.toLowerCase())) {
      return {
        valid: false,
        error: 'nickname_contains_banned_word',
      };
    }
  }

  // Проверка на последовательные пробелы
  if (/\s{2,}/.test(trimmed)) {
    return {
      valid: false,
      error: 'nickname_multiple_spaces',
    };
  }

  // Проверка на пробел в начале или конце (не должно быть после trim, но на всякий случай)
  if (trimmed !== trimmed.trim()) {
    return {
      valid: false,
      error: 'nickname_leading_trailing_spaces',
    };
  }

  return { valid: true };
}

/**
 * Нормализует никнейм: удаляет лишние пробелы, приводит к trim.
 *
 * @param nickname - никнейм для нормализации
 * @returns нормализованный никнейм
 * @throws Error если nickname равен null, undefined или не является строкой
 */
export function normalizeNickname(nickname: string): string {
  if (nickname === null || nickname === undefined || typeof nickname !== 'string') {
    throw new Error('Nickname must be a non-empty string');
  }
  return nickname
    .trim()
    .replace(/\s+/g, ' '); // Заменяем множественные пробелы на один
}

/**
 * Проверяет никнейм и возвращает нормализованную версию.
 * Выбрасывает ошибку если никнейм невалиден.
 *
 * @param nickname - никнейм для проверки
 * @returns нормализованный никнейм
 * @throws Error если никнейм невалиден
 */
export function validateAndNormalize(nickname: string): string {
  const normalized = normalizeNickname(nickname);
  const result = validateNicknameDetailed(normalized);

  if (!result.valid) {
    throw new Error(`Invalid nickname: ${result.error}`);
  }

  return normalized;
}
