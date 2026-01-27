#!/usr/bin/env python3
"""
PM Orchestrator — координатор review-fix-review цикла

Основные функции:
- Запуск Gemini ревьювера (gemini_reviewer.py)
- Парсинг комментариев PR для сбора вердиктов
- Расчёт консенсуса (3+ APPROVED от основных ревьюверов)
- Вывод статуса и рекомендаций

Workflow:
1. PM (Claude) создаёт PR
2. PM запускает Opus review через Task tool (нативно в Claude Code)
3. PM запускает: python tools/pm_orchestrator.py --pr=XXX --run-gemini
4. Человек запускает Codex (опционально)
5. PM запускает: python tools/pm_orchestrator.py --pr=XXX --check-consensus
6. Если нет консенсуса — PM запускает Developer для фиксов

Note: Opus вызывается через Task tool, Codex — человеком.
      Этот скрипт автоматизирует только Gemini и сбор консенсуса.
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

# Добавляем корень репозитория в sys.path для импортов
_REPO_ROOT = Path(__file__).parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from tools.pr_parser import get_latest_reviews
from tools.consensus import (
    calculate_consensus,
    extract_blocking_issues,
    get_consensus_summary,
)
from tools.review_state import MAIN_REVIEWERS, MAIN_REVIEWERS_SET, CONSENSUS_THRESHOLD

# Репозиторий по умолчанию
DEFAULT_REPO = os.getenv("SLIME_ARENA_REPO", "komleff/slime-arena")


def run_gemini_reviewer(pr_number: int, iteration: int = 1, repo: str = DEFAULT_REPO) -> bool:
    """
    Запустить gemini_reviewer.py для указанного PR.

    Args:
        pr_number: Номер PR
        iteration: Номер итерации ревью
        repo: Репозиторий в формате owner/repo

    Returns:
        bool: True если успешно, False при ошибке
    """
    script_dir = Path(__file__).parent
    gemini_script = script_dir / "gemini_reviewer.py"

    if not gemini_script.exists():
        print(f"[ERROR] Скрипт {gemini_script} не найден")
        return False

    print(f"[INFO] Запуск Gemini reviewer для PR #{pr_number} (iteration {iteration}, repo {repo})...")

    try:
        subprocess.run(
            [
                sys.executable,
                str(gemini_script),
                "--pr", str(pr_number),
                "--iteration", str(iteration),
                "--repo", repo,
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        print("[OK] Gemini review опубликован")
        return True
    except FileNotFoundError:
        print("[ERROR] Python не найден")
        return False
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Gemini reviewer завершился с ошибкой: код {e.returncode}")
        if e.stderr:
            print(f"[INFO] stderr: {e.stderr[:500]}")
        return False


def check_consensus(
    pr_number: int,
    repo: str = DEFAULT_REPO,
    iteration: Optional[int] = None
) -> bool:
    """
    Проверить консенсус для PR.

    Args:
        pr_number: Номер PR
        repo: Репозиторий
        iteration: Фильтр по итерации (None = все итерации)

    Returns:
        bool: True если консенсус достигнут
    """
    iter_info = f" (iteration {iteration})" if iteration else ""
    print(f"[INFO] Проверка консенсуса для PR #{pr_number}{iter_info}...")

    reviews = get_latest_reviews(pr_number, repo, iteration=iteration)

    if not reviews:
        print("[WARN] Ревью не найдены. Убедитесь, что ревьюверы опубликовали комментарии.")
        return False

    # Вывод статуса каждого ревьювера
    print("\n[INFO] Найденные ревью:")
    for reviewer in MAIN_REVIEWERS:
        if reviewer in reviews:
            data = reviews[reviewer]
            print(f"  - {reviewer}: {data.status.value}")
        else:
            print(f"  - {reviewer}: NOT FOUND")

    # Расчёт консенсуса
    consensus, approved, total = calculate_consensus(reviews)

    print(f"\n[INFO] Консенсус: {approved}/{total} APPROVED (требуется {CONSENSUS_THRESHOLD})")

    # Проверяем blocking issues ВСЕГДА (включая P0/P1 от Copilot)
    # Согласно AGENT_ROLES.md v1.8: Copilot обязателен если оставил замечания
    blocking = extract_blocking_issues(reviews)

    if consensus and not blocking:
        print("\n[OK] КОНСЕНСУС ДОСТИГНУТ - PR готов к merge")
        return True

    if consensus and blocking:
        # Консенсус есть, но есть blocking issues (например, от Copilot)
        print(f"\n[WARN] Консенсус достигнут, но есть блокирующие проблемы ({len(blocking)}):")
        for issue in blocking:
            location = f"{issue.file}:{issue.line}" if issue.line is not None else issue.file
            print(f"  - [{issue.priority}] {location} - {issue.problem[:60]}")
        print("\n[FAIL] PR НЕ готов к merge - исправьте P0/P1 замечания")
        return False

    # Если нет консенсуса — показать блокирующие проблемы
    if blocking:
        print(f"\n[WARN] Блокирующие проблемы ({len(blocking)}):")
        for issue in blocking:
            # Форматируем без :None если line отсутствует
            location = f"{issue.file}:{issue.line}" if issue.line is not None else issue.file
            print(f"  - [{issue.priority}] {location} - {issue.problem[:60]}")

    print("\n[FAIL] КОНСЕНСУС НЕ ДОСТИГНУТ - требуются исправления")

    # Рекомендации
    missing = MAIN_REVIEWERS_SET - set(reviews.keys())
    if missing:
        print(f"\n[TIP] Ожидаем ревью от: {', '.join(sorted(missing))}")

    return False


def publish_consensus_summary(pr_number: int, repo: str = DEFAULT_REPO) -> None:
    """
    Опубликовать summary консенсуса в PR.

    Args:
        pr_number: Номер PR
        repo: Репозиторий
    """
    reviews = get_latest_reviews(pr_number, repo)
    summary = get_consensus_summary(reviews)

    # Записываем во временный файл (обход лимита командной строки)
    # Уникальное имя с pr_number и pid для избежания гонок при параллельных запусках
    import os
    tmp_file = Path(__file__).parent / f"tmp_consensus_pr{pr_number}_pid{os.getpid()}.md"
    try:
        tmp_file.write_text(summary, encoding="utf-8")

        subprocess.run(
            [
                "gh", "pr", "comment", str(pr_number),
                "--repo", repo,
                "--body-file", str(tmp_file),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        print(f"[OK] Consensus summary опубликован в PR #{pr_number}")
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Не удалось опубликовать summary: код {e.returncode}")
        if e.stderr:
            print(f"[INFO] stderr: {e.stderr[:500]}")
    finally:
        if tmp_file.exists():
            tmp_file.unlink()


def main():
    parser = argparse.ArgumentParser(
        description="PM Orchestrator — координатор review-fix-review цикла",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры использования:

  # Запустить Gemini ревью
  python tools/pm_orchestrator.py --pr=110 --run-gemini

  # Проверить консенсус
  python tools/pm_orchestrator.py --pr=110 --check-consensus

  # Опубликовать summary в PR
  python tools/pm_orchestrator.py --pr=110 --publish-summary

  # Полный цикл: Gemini + проверка
  python tools/pm_orchestrator.py --pr=110 --run-gemini --check-consensus
        """
    )

    parser.add_argument(
        "--pr",
        type=int,
        required=True,
        help="Номер PR"
    )
    parser.add_argument(
        "--repo",
        type=str,
        default=DEFAULT_REPO,
        help=f"Репозиторий (по умолчанию: {DEFAULT_REPO})"
    )
    parser.add_argument(
        "--iteration",
        type=int,
        default=None,
        help="Номер итерации ревью (по умолчанию: все итерации)"
    )
    parser.add_argument(
        "--run-gemini",
        action="store_true",
        help="Запустить Gemini reviewer"
    )
    parser.add_argument(
        "--check-consensus",
        action="store_true",
        help="Проверить консенсус по комментариям PR"
    )
    parser.add_argument(
        "--publish-summary",
        action="store_true",
        help="Опубликовать summary консенсуса в PR"
    )

    args = parser.parse_args()

    # Хотя бы одно действие должно быть указано
    if not any([args.run_gemini, args.check_consensus, args.publish_summary]):
        parser.print_help()
        print("\n[ERROR] Укажите хотя бы одно действие: --run-gemini, --check-consensus, --publish-summary")
        sys.exit(1)

    # Выполнение действий
    success = True

    if args.run_gemini:
        # Для Gemini используем iteration=1 если не указан явно
        gemini_iteration = args.iteration if args.iteration is not None else 1
        if not run_gemini_reviewer(args.pr, gemini_iteration, args.repo):
            success = False

    if args.check_consensus:
        # Передаём iteration напрямую (None = все итерации)
        if not check_consensus(args.pr, args.repo, iteration=args.iteration):
            success = False

    if args.publish_summary:
        publish_consensus_summary(args.pr, args.repo)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
