"""
Consensus — логика определения консенсуса между ревьюверами

Требуется 3 APPROVED от основных ревьюверов (opus, codex, gemini).
GitHub Copilot опционален и не влияет на консенсус.
"""

import sys
from pathlib import Path

# Добавляем корень репозитория в sys.path для импортов
_REPO_ROOT = Path(__file__).parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from typing import Dict, List, Tuple

from tools.review_state import (
    ReviewData,
    ReviewStatus,
    Issue,
    MAIN_REVIEWERS,
    MAIN_REVIEWERS_SET,
    CONSENSUS_THRESHOLD,
)


def calculate_consensus(reviews: Dict[str, ReviewData]) -> Tuple[bool, int, int]:
    """
    Проверить, достигнут ли консенсус.

    Args:
        reviews: Словарь {reviewer_name: ReviewData}

    Returns:
        Tuple[bool, int, int]: (консенсус достигнут, кол-во APPROVED, общее кол-во основных ревьюверов)
    """
    approved_count = 0

    for reviewer, data in reviews.items():
        # Считаем только основных ревьюверов (используем set для O(1) lookup)
        if reviewer not in MAIN_REVIEWERS_SET:
            continue

        if data.status == ReviewStatus.APPROVED:
            approved_count += 1

    # Возвращаем общее число основных ревьюверов (не найденных, а всего)
    consensus_reached = approved_count >= CONSENSUS_THRESHOLD
    return consensus_reached, approved_count, len(MAIN_REVIEWERS)


def extract_blocking_issues(reviews: Dict[str, ReviewData]) -> List[Issue]:
    """
    Извлечь все блокирующие проблемы (P0/P1) из ревью.

    Args:
        reviews: Словарь {reviewer_name: ReviewData}

    Returns:
        List[Issue]: Список уникальных блокирующих проблем
    """
    blocking_issues: List[Issue] = []
    seen_issues: set = set()  # Для дедупликации

    for reviewer, data in reviews.items():
        for issue in data.issues:
            if not issue.is_blocking():
                continue

            # Дедупликация по файлу и строке
            issue_key = (issue.file, issue.line, issue.problem[:50])
            if issue_key in seen_issues:
                continue

            seen_issues.add(issue_key)
            # Создаём копию с установленным reviewer (не мутируем оригинал)
            blocking_issue = Issue(
                priority=issue.priority,
                file=issue.file,
                line=issue.line,
                problem=issue.problem,
                reviewer=reviewer,
            )
            blocking_issues.append(blocking_issue)

    # Сортировка: P0 перед P1, затем по файлу
    blocking_issues.sort(key=lambda x: (x.priority, x.file, x.line or 0))
    return blocking_issues


def get_consensus_summary(reviews: Dict[str, ReviewData]) -> str:
    """
    Сформировать текстовое резюме консенсуса.

    Args:
        reviews: Словарь {reviewer_name: ReviewData}

    Returns:
        str: Форматированное резюме
    """
    consensus, approved, total = calculate_consensus(reviews)
    blocking = extract_blocking_issues(reviews)

    lines = [
        "## Consensus Summary",
        "",
        f"**Status:** {'CONSENSUS REACHED' if consensus else 'NO CONSENSUS'}",
        f"**Approved:** {approved}/{total} main reviewers",
        "",
        "### Reviewer Verdicts",
        "",
    ]

    for reviewer in MAIN_REVIEWERS:
        if reviewer in reviews:
            data = reviews[reviewer]
            status_emoji = "✅" if data.status == ReviewStatus.APPROVED else "❌"
            lines.append(f"- **{reviewer}**: {data.status.value} {status_emoji}")
        else:
            lines.append(f"- **{reviewer}**: NOT RECEIVED ⏳")

    if blocking:
        lines.extend([
            "",
            f"### Blocking Issues ({len(blocking)})",
            "",
        ])
        for issue in blocking:
            # Форматируем location без :None если line отсутствует
            location = f"{issue.file}:{issue.line}" if issue.line is not None else issue.file
            lines.append(
                f"- **[{issue.priority}]** `{location}` — {issue.problem[:80]}"
            )

    return "\n".join(lines)
