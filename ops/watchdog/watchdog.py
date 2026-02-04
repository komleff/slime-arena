#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Slime Arena Watchdog

Скрипт для мониторинга и управления жизненным циклом Docker-контейнера.

Функции:
1. Recovery при старте — проверка незавершённых рестартов
2. Outbox-приёмник — обработка запросов на рестарт (каждые 5 сек)
3. Health monitor — проверка здоровья сервера (каждые 30 сек)

Взаимодействие с сервером:
- Сервер создаёт restart-requested → watchdog выполняет рестарт
- Watchdog отправляет результат в Telegram

Требования: Python 3.9+
"""

import json
import logging
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv

# ============================================================================
# Конфигурация
# ============================================================================

# Загружаем переменные окружения из .env файла
load_dotenv()

# Директория для файлов-флагов взаимодействия с сервером
SHARED_DIR = Path(os.getenv("SHARED_DIR", "/opt/slime-arena/shared"))

# Имя Docker-контейнера
CONTAINER_NAME = os.getenv("CONTAINER_NAME", "slime-arena")

# URL для health-check
HEALTH_URL = os.getenv("HEALTH_URL", "http://127.0.0.1:3000/health")

# Telegram для уведомлений
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

# Интервалы проверок (секунды)
OUTBOX_CHECK_INTERVAL = 5
HEALTH_CHECK_INTERVAL = 30
HEALTH_TIMEOUT = 5

# Порог для auto-restart при health failures
HEALTH_FAIL_THRESHOLD = 3

# ============================================================================
# Логирование
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("watchdog")

# ============================================================================
# Файлы-флаги
# ============================================================================


def get_restart_requested_path() -> Path:
    """Путь к файлу-запросу на рестарт (создаётся сервером)."""
    return SHARED_DIR / "restart-requested"


def get_restart_processing_path() -> Path:
    """Путь к файлу-индикатору выполнения рестарта."""
    return SHARED_DIR / "restart-processing"


def get_restart_result_path() -> Path:
    """Путь к файлу-результату рестарта."""
    return SHARED_DIR / "restart-result"


# ============================================================================
# Telegram
# ============================================================================


def send_telegram_message(message: str) -> bool:
    """
    Отправляет сообщение в Telegram.

    Args:
        message: Текст сообщения

    Returns:
        True если сообщение отправлено, False при ошибке
    """
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.warning("Telegram не настроен, пропускаем уведомление")
        return False

    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        response = requests.post(
            url,
            json={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": message,
                "parse_mode": "HTML",
            },
            timeout=10,
        )
        response.raise_for_status()
        return True
    except Exception as e:
        logger.error(f"Ошибка отправки в Telegram: {e}")
        return False


# ============================================================================
# Docker операции
# ============================================================================


def docker_restart() -> tuple[bool, str]:
    """
    Выполняет рестарт Docker-контейнера.

    Returns:
        (success, message) — результат операции
    """
    logger.info(f"Выполняю рестарт контейнера: {CONTAINER_NAME}")

    try:
        # Используем docker restart с таймаутом 30 секунд
        result = subprocess.run(
            ["docker", "restart", "-t", "30", CONTAINER_NAME],
            capture_output=True,
            text=True,
            timeout=60,
        )

        if result.returncode == 0:
            logger.info(f"Контейнер {CONTAINER_NAME} успешно перезапущен")
            return True, "ok"
        else:
            error_msg = result.stderr.strip() or result.stdout.strip()
            logger.error(f"Ошибка рестарта: {error_msg}")
            return False, f"error: {error_msg}"

    except subprocess.TimeoutExpired:
        logger.error("Таймаут при рестарте контейнера")
        return False, "error: timeout"
    except Exception as e:
        logger.error(f"Исключение при рестарте: {e}")
        return False, f"error: {str(e)}"


# ============================================================================
# Результат операции
# ============================================================================


def write_result(audit_id: str, status: str, message: str = "") -> None:
    """
    Записывает результат рестарта в файл.

    Args:
        audit_id: ID операции из запроса
        status: Статус (ok, error)
        message: Дополнительное сообщение
    """
    result_path = get_restart_result_path()
    result_data = {
        "auditId": audit_id,
        "status": status,
        "message": message,
        "completedAt": datetime.utcnow().isoformat() + "Z",
    }

    try:
        # Атомарная запись через временный файл
        tmp_path = result_path.with_suffix(".tmp")
        tmp_path.write_text(json.dumps(result_data, indent=2), encoding="utf-8")
        tmp_path.rename(result_path)
        logger.info(f"Результат записан: {result_path}")
    except Exception as e:
        logger.error(f"Ошибка записи результата: {e}")


# ============================================================================
# Recovery при старте
# ============================================================================


def recovery_check() -> None:
    """
    Проверяет незавершённые операции при старте watchdog.

    Если существует restart-processing, значит watchdog упал во время
    рестарта — выполняем рестарт повторно.
    """
    processing_path = get_restart_processing_path()

    if processing_path.exists():
        logger.warning("Обнаружен незавершённый рестарт, выполняю recovery")

        try:
            # Читаем данные предыдущего запроса
            data = json.loads(processing_path.read_text(encoding="utf-8"))
            audit_id = data.get("auditId", "recovery")

            # Выполняем рестарт
            success, message = docker_restart()

            # Записываем результат
            write_result(audit_id, "ok" if success else "error", message)

            # Уведомляем в Telegram
            status_emoji = "✅" if success else "❌"
            send_telegram_message(
                f"{status_emoji} <b>Recovery restart</b>\n"
                f"Контейнер: {CONTAINER_NAME}\n"
                f"Статус: {message}\n"
                f"Audit ID: {audit_id}"
            )

            # Удаляем флаг
            processing_path.unlink()
            logger.info("Recovery завершён")

        except Exception as e:
            logger.error(f"Ошибка recovery: {e}")
            # Удаляем повреждённый флаг
            try:
                processing_path.unlink()
            except Exception:
                pass


# ============================================================================
# Outbox-приёмник
# ============================================================================


def process_restart_request() -> bool:
    """
    Проверяет и обрабатывает запрос на рестарт.

    Returns:
        True если запрос обработан, False если запросов нет
    """
    requested_path = get_restart_requested_path()
    processing_path = get_restart_processing_path()

    if not requested_path.exists():
        return False

    logger.info("Обнаружен запрос на рестарт")

    try:
        # Читаем данные запроса
        data = json.loads(requested_path.read_text(encoding="utf-8"))
        audit_id = data.get("auditId", "unknown")
        requested_by = data.get("requestedBy", "unknown")
        requested_at = data.get("requestedAt", "unknown")

        logger.info(f"Рестарт запрошен: {requested_by} в {requested_at}")

        # Атомарно переименовываем в processing (делает исходный файл недоступным)
        requested_path.rename(processing_path)

        # Выполняем рестарт
        success, message = docker_restart()

        # Записываем результат
        write_result(audit_id, "ok" if success else "error", message)

        # Уведомляем в Telegram
        status_emoji = "✅" if success else "❌"
        send_telegram_message(
            f"{status_emoji} <b>Server Restart</b>\n"
            f"Контейнер: {CONTAINER_NAME}\n"
            f"Запросил: {requested_by}\n"
            f"Статус: {message}\n"
            f"Audit ID: {audit_id}"
        )

        # Удаляем processing-флаг
        processing_path.unlink()
        logger.info("Запрос на рестарт обработан")

        return True

    except json.JSONDecodeError as e:
        logger.error(f"Некорректный JSON в запросе: {e}")
        # Удаляем повреждённый файл
        try:
            requested_path.unlink()
        except Exception:
            pass
        return False
    except Exception as e:
        logger.error(f"Ошибка обработки запроса: {e}")
        return False


# ============================================================================
# Health Monitor
# ============================================================================


class HealthMonitor:
    """Мониторинг здоровья сервера с автоматическим рестартом."""

    def __init__(self):
        self.fail_count = 0
        self.last_check_time = 0.0

    def should_check(self) -> bool:
        """Проверяет, пора ли выполнять health check."""
        return time.time() - self.last_check_time >= HEALTH_CHECK_INTERVAL

    def check_health(self) -> bool:
        """
        Выполняет health check.

        Returns:
            True если сервер здоров, False при ошибке
        """
        self.last_check_time = time.time()

        try:
            response = requests.get(HEALTH_URL, timeout=HEALTH_TIMEOUT)
            if response.status_code == 200:
                if self.fail_count > 0:
                    logger.info(f"Сервер восстановился после {self.fail_count} ошибок")
                    self.fail_count = 0
                return True
            else:
                logger.warning(f"Health check: статус {response.status_code}")
                self.fail_count += 1
                return False

        except requests.exceptions.Timeout:
            logger.warning("Health check: таймаут")
            self.fail_count += 1
            return False
        except requests.exceptions.ConnectionError:
            logger.warning("Health check: соединение отклонено")
            self.fail_count += 1
            return False
        except Exception as e:
            logger.warning(f"Health check: ошибка {e}")
            self.fail_count += 1
            return False

    def handle_failures(self) -> None:
        """Обрабатывает накопленные ошибки health check."""
        if self.fail_count >= HEALTH_FAIL_THRESHOLD:
            logger.error(
                f"Достигнут порог ошибок ({self.fail_count}/{HEALTH_FAIL_THRESHOLD}), "
                f"выполняю автоматический рестарт"
            )

            # Выполняем рестарт
            success, message = docker_restart()

            # Уведомляем в Telegram
            status_emoji = "✅" if success else "❌"
            send_telegram_message(
                f"🚨 <b>Auto-restart (health failure)</b>\n"
                f"Контейнер: {CONTAINER_NAME}\n"
                f"Ошибок подряд: {self.fail_count}\n"
                f"Статус: {status_emoji} {message}"
            )

            # Сбрасываем счётчик
            self.fail_count = 0


# ============================================================================
# Главный цикл
# ============================================================================


def ensure_shared_dir() -> None:
    """Создаёт директорию для файлов-флагов если не существует."""
    if not SHARED_DIR.exists():
        logger.info(f"Создаю директорию: {SHARED_DIR}")
        SHARED_DIR.mkdir(parents=True, exist_ok=True)


def main() -> None:
    """Главный цикл watchdog."""
    logger.info("=" * 60)
    logger.info("Slime Arena Watchdog запущен")
    logger.info(f"Shared dir: {SHARED_DIR}")
    logger.info(f"Container: {CONTAINER_NAME}")
    logger.info(f"Health URL: {HEALTH_URL}")
    logger.info("=" * 60)

    # Создаём директорию если нужно
    ensure_shared_dir()

    # Recovery при старте
    recovery_check()

    # Инициализируем health monitor
    health_monitor = HealthMonitor()

    # Основной цикл
    last_outbox_check = 0.0

    while True:
        try:
            current_time = time.time()

            # Проверка outbox (каждые 5 секунд)
            if current_time - last_outbox_check >= OUTBOX_CHECK_INTERVAL:
                last_outbox_check = current_time
                process_restart_request()

            # Health check (каждые 30 секунд)
            if health_monitor.should_check():
                health_monitor.check_health()
                health_monitor.handle_failures()

            # Короткий sleep чтобы не нагружать CPU
            time.sleep(1)

        except KeyboardInterrupt:
            logger.info("Получен сигнал завершения, выхожу")
            break
        except Exception as e:
            logger.error(f"Ошибка в главном цикле: {e}")
            time.sleep(5)


if __name__ == "__main__":
    main()
