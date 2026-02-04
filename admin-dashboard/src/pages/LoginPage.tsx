/**
 * Страница логина администратора.
 */
import { signal } from '@preact/signals';
import { login, ApiError } from '../api/client';
import { setAccessToken, setTotpRequired } from '../auth/signals';
import { currentTab } from '../App';

/** Состояние формы */
const username = signal('');
const password = signal('');
const error = signal<string | null>(null);
const isSubmitting = signal(false);

export function LoginPage() {
  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (isSubmitting.value) return;

    error.value = null;
    isSubmitting.value = true;

    try {
      const response = await login(username.value, password.value);

      // Сохраняем токен
      setAccessToken(response.accessToken);
      setTotpRequired(response.totpRequired);

      // Сбрасываем форму
      username.value = '';
      password.value = '';

      // Если требуется 2FA — переходим в настройки
      if (response.totpRequired) {
        currentTab.value = 'settings';
      } else {
        currentTab.value = 'dashboard';
      }
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.status) {
          case 401:
            error.value = 'Неверное имя пользователя или пароль';
            break;
          case 429:
            error.value = 'Слишком много попыток. Подождите и попробуйте снова';
            break;
          default:
            error.value = err.message || 'Ошибка сервера';
        }
      } else {
        error.value = 'Ошибка соединения с сервером';
      }
    } finally {
      isSubmitting.value = false;
    }
  };

  return (
    <div class="login-page">
      <div class="login-card">
        <h1 class="login-title">Slime Arena</h1>
        <h2 class="login-subtitle">Admin Dashboard</h2>

        <form class="login-form" onSubmit={handleSubmit}>
          {error.value && (
            <div class="error-message" role="alert">
              {error.value}
            </div>
          )}

          <div class="form-group">
            <label for="username">Имя пользователя</label>
            <input
              type="text"
              id="username"
              name="username"
              value={username.value}
              onInput={(e) => (username.value = (e.target as HTMLInputElement).value)}
              autocomplete="username"
              required
              disabled={isSubmitting.value}
            />
          </div>

          <div class="form-group">
            <label for="password">Пароль</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password.value}
              onInput={(e) => (password.value = (e.target as HTMLInputElement).value)}
              autocomplete="current-password"
              required
              disabled={isSubmitting.value}
            />
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-full"
            disabled={isSubmitting.value}
          >
            {isSubmitting.value ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
