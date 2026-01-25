"""
Developer Requester для PM Orchestrator
Создание задач в Beads для исправления проблем
"""

import subprocess
import re
from typing import List
from review_state import Issue


async def request_developer_fix(
    pr_number: int,
    issues: List[Issue],
    developer_model: str = "opus",  # "opus" or "codex"
    attempt: int = 1,
    beads_cwd: str = "d:/GitHub/slime-arena"
) -> str:
    """
    Создать задачу в Beads для Developer

    Returns:
        task_id: ID созданной задачи (например, "slime-arena-xxx")
    """

    model_names = {
        "opus": "Claude Opus 4.5",
        "codex": "ChatGPT 5.2 Codex"
    }

    model_name = model_names.get(developer_model, developer_model)

    # Формировать description задачи
    description = f"### Code Review Issues (PR #{pr_number})\\n\\n"
    description += f"**Разработчик:** {model_name}\\n"
    description += f"**Попытка:** {attempt}/5\\n\\n"

    for issue in issues:
        description += f"**[{issue.priority}]** {issue.file}:{issue.line}\\n"
        description += f"- Проблема: {issue.problem}\\n"

        if issue.solution:
            description += f"- Решение: {issue.solution}\\n"

        description += "\\n"

    description += f"\\n**ВАЖНО:** Подпиши fix-комментарий в PR как:\\n"
    description += f"```\\nFixed by {model_name} (Attempt {attempt}/5)\\n```\\n"

    # Определить приоритет
    # P0 если attempt > 3 или есть P0 проблемы
    has_p0 = any(i.priority == "P0" for i in issues)
    priority = "0" if (attempt > 3 or has_p0) else "1"

    # Создать задачу через bd CLI
    result = subprocess.run([
        "bd", "create",
        "--title", f"Fix: Review issues ({developer_model}, attempt {attempt})",
        "--type", "bug",
        "--priority", priority,
        "--description", description
    ], capture_output=True, text=True, check=True, cwd=beads_cwd)

    # Парсить task ID из вывода
    match = re.search(r'(slime-arena-\w+)', result.stdout)

    if match:
        return match.group(1)
    else:
        raise ValueError(f"Failed to extract task ID from bd create output: {result.stdout}")


async def wait_for_developer_fix(
    repo_path: str,
    timeout: int = 3600  # 1 час
) -> bool:
    """
    Ждать коммита с исправлениями от Developer

    Returns:
        True если новый коммит появился, False если timeout
    """

    import asyncio
    import time

    # Получить текущий commit
    current_commit = subprocess.run([
        "git", "rev-parse", "HEAD"
    ], capture_output=True, text=True, cwd=repo_path, check=True).stdout.strip()

    start = time.time()

    while time.time() - start < timeout:
        # Pull последние изменения
        subprocess.run(["git", "pull"], cwd=repo_path, capture_output=True)

        # Проверить commit
        latest_commit = subprocess.run([
            "git", "rev-parse", "HEAD"
        ], capture_output=True, text=True, cwd=repo_path, check=True).stdout.strip()

        if latest_commit != current_commit:
            return True  # Новый коммит найден

        # Ждать 60 секунд перед следующей проверкой
        await asyncio.sleep(60)

    return False  # Timeout
