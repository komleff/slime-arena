"""
PR Parser — парсинг комментариев PR для извлечения ревью

Извлекает JSON-метаданные из HTML-комментариев, парсит P0/P1/P2 проблемы
из markdown, и формирует ReviewData объекты.
"""

import json
import logging
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# Добавляем корень репозитория в sys.path для импортов
_REPO_ROOT = Path(__file__).parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from tools.review_state import ReviewData, ReviewStatus, Issue

# Логгер модуля; конфигурация логирования задаётся в точке входа
logger = logging.getLogger(__name__)

# Репозиторий по умолчанию (можно переопределить через env)
DEFAULT_REPO = os.getenv("SLIME_ARENA_REPO", "komleff/slime-arena")

# Паттерны для парсинга
METADATA_PATTERN = re.compile(r"<!--\s*(\{.*?\})\s*-->", re.DOTALL)
VERDICT_PATTERN = re.compile(r"\b(APPROVED|CHANGES_REQUESTED|COMMENTED)\b")
ISSUE_PATTERN = re.compile(
    r"\*\*\[(P[012])\]\*\*\s*[`'\"]?([^:`'\"]+)[`'\"]?(?::(\d+))?\s*[—\-–]\s*(.+?)(?=\n|$)",
    re.MULTILINE
)


def parse_pr_comments(
    pr_number: int,
    repo: str = DEFAULT_REPO,
    iteration: Optional[int] = None
) -> Dict[str, ReviewData]:
    """
    Получить и распарсить все комментарии PR.

    Args:
        pr_number: Номер PR
        repo: Репозиторий в формате owner/repo
        iteration: Фильтр по номеру итерации (None = все)

    Returns:
        Dict[str, ReviewData]: Словарь {reviewer_name: ReviewData}
    """
    # Используем --jq '.[]' чтобы развернуть массивы страниц в JSONL
    # Без --jq при >30 комментариях --paginate выводит несколько JSON массивов
    try:
        result = subprocess.run(
            [
                "gh", "api",
                "--paginate",  # Получить все страницы (>30 комментариев)
                "--jq", ".[]",  # Развернуть массив в JSONL (один объект на строку)
                f"repos/{repo}/issues/{pr_number}/comments",
            ],
            capture_output=True,
            text=True,
            check=True,
            encoding="utf-8"
        )
    except FileNotFoundError:
        logger.error("GitHub CLI (gh) не найден. Установите gh и выполните 'gh auth login'.")
        return {}
    except subprocess.CalledProcessError as e:
        logger.error(f"Ошибка при получении комментариев PR #{pr_number}: {e.stderr}")
        return {}

    # Парсим JSONL (каждая строка — отдельный JSON объект)
    comments_json = []
    for line in result.stdout.strip().split("\n"):
        if not line.strip():
            continue
        try:
            comments_json.append(json.loads(line))
        except json.JSONDecodeError as e:
            logger.warning(f"Пропущена строка с ошибкой JSON: {e}")

    reviews: Dict[str, ReviewData] = {}

    for comment in comments_json:
        comment_body = comment.get("body", "")
        if not comment_body:
            continue

        review_data = parse_single_comment(comment_body, pr_number)
        if review_data is None:
            continue

        # Фильтр по итерации
        if iteration is not None and review_data.iteration != iteration:
            continue

        # Сохраняем только последний ревью от каждого ревьювера
        reviews[review_data.reviewer] = review_data

    return reviews


def parse_single_comment(body: str, pr_number: int) -> Optional[ReviewData]:
    """
    Распарсить один комментарий PR.

    Args:
        body: Тело комментария
        pr_number: Номер PR

    Returns:
        ReviewData или None если комментарий не является ревью
    """
    # Попытка извлечь JSON метаданные
    metadata_match = METADATA_PATTERN.search(body)
    if not metadata_match:
        return None  # Не ревью комментарий (без метаданных)

    try:
        metadata = json.loads(metadata_match.group(1))
    except json.JSONDecodeError as e:
        logger.warning(f"Не удалось распарсить JSON метаданные: {e}")
        return None

    # Проверяем, что это ревью
    if metadata.get("type") != "review":
        return None

    # Нормализуем reviewer к lowercase для совместимости
    reviewer = metadata.get("reviewer", "unknown").lower()
    iteration = metadata.get("iteration", 1)

    # Извлекаем статус из метаданных или из текста
    status_str = metadata.get("status")
    if not status_str:
        verdict_match = VERDICT_PATTERN.search(body)
        status_str = verdict_match.group(1) if verdict_match else "COMMENTED"

    # Нормализуем к uppercase для корректного поиска в Enum
    try:
        status = ReviewStatus[status_str.upper()]
    except (KeyError, AttributeError):
        status = ReviewStatus.COMMENTED

    # Парсим timestamp (некритично, оставляем None при ошибке)
    timestamp = None
    if "timestamp" in metadata:
        try:
            timestamp = datetime.fromisoformat(metadata["timestamp"].replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            # Некорректный формат timestamp — не критично, пропускаем
            pass

    # Извлекаем проблемы
    issues = extract_issues_from_body(body, reviewer)

    return ReviewData(
        reviewer=reviewer,
        status=status,
        body=body,
        issues=issues,
        iteration=iteration,
        timestamp=timestamp,
        pr_number=pr_number,
    )


def extract_issues_from_body(body: str, reviewer: str) -> List[Issue]:
    """
    Извлечь проблемы P0/P1/P2 из текста ревью.

    Args:
        body: Текст ревью
        reviewer: Имя ревьювера

    Returns:
        List[Issue]: Список найденных проблем
    """
    issues: List[Issue] = []

    for match in ISSUE_PATTERN.finditer(body):
        priority = match.group(1)
        file_path = match.group(2).strip()
        line_str = match.group(3)
        problem = match.group(4).strip()

        line = int(line_str) if line_str else None

        issues.append(Issue(
            priority=priority,
            file=file_path,
            line=line,
            problem=problem,
            reviewer=reviewer,
        ))

    return issues


def get_latest_reviews(
    pr_number: int,
    repo: str = DEFAULT_REPO,
    iteration: Optional[int] = None
) -> Dict[str, ReviewData]:
    """
    Получить последние ревью от каждого ревьювера.

    Args:
        pr_number: Номер PR
        repo: Репозиторий
        iteration: Фильтр по итерации (None = все итерации, берём последнее от каждого)

    Returns:
        Dict[str, ReviewData]: Последние ревью
    """
    return parse_pr_comments(pr_number, repo, iteration=iteration)
