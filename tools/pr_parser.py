"""
PR Comment Parser для PM Orchestrator
Парсинг review-комментариев из GitHub PR
"""

import subprocess
import json
import re
from typing import Dict
from review_state import ReviewData, Issue


def parse_pr_comments(pr_number: int, repo: str = "komleff/slime-arena") -> Dict[str, ReviewData]:
    """
    Парсить review-комментарии из PR через gh API

    Возвращает словарь {reviewer_name: ReviewData}
    """

    result = subprocess.run([
        "gh", "api",
        f"/repos/{repo}/issues/{pr_number}/comments"
    ], capture_output=True, text=True, check=True)

    reviews = {}

    for comment in json.loads(result.stdout):
        # Извлечь JSON метаданные из <!-- {...} -->
        match = re.search(r'<!--\s*({.*?})\s*-->', comment["body"])

        if match:
            try:
                metadata = json.loads(match.group(1))

                if metadata.get("type") == "review":
                    reviewer = metadata["reviewer"]
                    reviews[reviewer] = ReviewData(
                        reviewer=reviewer,
                        iteration=metadata.get("iteration", 0),
                        status=metadata.get("status", "COMMENTED"),
                        body=comment["body"],
                        timestamp=metadata.get("timestamp", comment["created_at"])
                    )
            except json.JSONDecodeError:
                pass  # Игнорировать некорректные метаданные

    return reviews


def extract_blocking_issues(reviews: Dict[str, ReviewData]) -> list[Issue]:
    """
    Извлечь все P0 и P1 проблемы из отчётов ревьюверов

    Парсит markdown отчёты и извлекает замечания
    """

    issues = []

    for reviewer, data in reviews.items():
        # Парсить секции [P0] и [P1]
        # Простой regex для поиска проблем
        pattern = r'\*\*\[P[01]\]\*\*\s+`([^`]+):(\d+)`\s+[—-]\s+(.+?)(?=\n\s*-|\n\*\*|\Z)'

        for match in re.finditer(pattern, data.body, re.DOTALL):
            file_path = match.group(1)
            line_num = int(match.group(2))
            description = match.group(3).strip()

            # Определить приоритет из контекста
            priority = "P0" if "[P0]" in match.group(0) else "P1"

            # Извлечь проблему и решение
            problem = description
            solution = ""

            if "Решение:" in description:
                parts = description.split("Решение:", 1)
                problem = parts[0].strip()
                solution = parts[1].strip()

            issues.append(Issue(
                priority=priority,
                file=file_path,
                line=line_num,
                problem=problem,
                solution=solution,
                reviewer=reviewer
            ))

    return issues


def remove_duplicate_issues(issues: list[Issue]) -> list[Issue]:
    """
    Удалить дубликаты проблем (одна проблема от нескольких ревьюверов)

    Группирует по файлу и строке, оставляет приоритет выше
    """

    unique = {}

    for issue in issues:
        key = (issue.file, issue.line)

        if key not in unique:
            unique[key] = issue
        else:
            # Если приоритет выше (P0 > P1), заменить
            if issue.priority == "P0" and unique[key].priority == "P1":
                unique[key] = issue

    return list(unique.values())
