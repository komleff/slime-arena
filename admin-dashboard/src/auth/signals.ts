/**
 * Модуль аутентификации администратора.
 * Access token хранится в памяти (signal), НЕ в localStorage.
 * Refresh token — httpOnly cookie, управляется сервером.
 */
import { signal, computed } from '@preact/signals';

/** Access token JWT (в памяти, теряется при закрытии вкладки) */
export const accessToken = signal<string | null>(null);

/** Требуется ли настройка 2FA (true = 2FA не включена, нужно настроить) */
export const totpRequired = signal<boolean>(false);

/** 2FA успешно настроена в текущей сессии */
export const totpSuccess = signal<boolean>(false);

/** Вычисляемый сигнал: авторизован ли пользователь */
export const isAuthenticated = computed(() => accessToken.value !== null);

/**
 * Сохранить access token после успешного логина/refresh.
 */
export function setAccessToken(token: string | null): void {
  accessToken.value = token;
}

/**
 * Установить флаг необходимости 2FA.
 */
export function setTotpRequired(required: boolean): void {
  totpRequired.value = required;
}

/**
 * Очистить состояние аутентификации (logout).
 * P2: Сбрасываем totpSuccess чтобы при следующем логине не показывалось "2FA включена"
 */
export function clearAuth(): void {
  accessToken.value = null;
  totpRequired.value = false;
  totpSuccess.value = false;
}
