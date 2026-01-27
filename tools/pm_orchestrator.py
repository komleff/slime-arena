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
from tools.review_state import MAIN_REVIEWERS

# Репозиторий по умолчанию
DEFAULT_REPO = os.getenv("SLIME_ARENA_REPO", "komleff/slime-arena")


def run_gemini_reviewer(pr_number: int, iteration: int = 1) -> bool:
    """
    Запустить gemini_reviewer.py для указанного PR.

    Args:
        pr_number: Номер PR
        iteration: Номер итерации ревью

    Returns:
        bool: True если успешно, False при ошибке
    """
    script_dir = Path(__file__).parent
    gemini_script = script_dir / "gemini_reviewer.py"

    if not gemini_script.exists():
        print(f"[ERROR] Скрипт {gemini_script} не найден")
        return False

    print(f"[INFO] Запуск Gemini reviewer для PR #{pr_number} (iteration {iteration})...")

    try:
        result = subprocess.run(
            [
                sys.executable,
                str(gemini_script),
                "--pr", str(pr_number),
                "--iteration", str(iteration),
            ],
            check=True,
            encoding="utf-8",
        )
        print("[OK] Gemini review опубликован")
        return True
    except FileNotFoundError:
        print("[ERROR] Python не найден")
        return False
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Gemini reviewer завершился с ошибкой: код {e.returncode}")
        return False


def check_consensus(pr_number: int, repo: str = DEFAULT_REPO) -> bool:
    """
    Проверить консенсус для PR.

    Args:
        pr_number: Номер PR
        repo: Репозиторий

    Returns:
        bool: True если консенсус достигнут
    """
    print(f"[INFO] Проверка консенсуса для PR #{pr_number}...")

    reviews = get_latest_reviews(pr_number, repo)

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

    print(f"\n[INFO] Консенсус: {approved}/{total} APPROVED (требуется {3})")

    if consensus:
        print("\n✅ КОНСЕНСУС ДОСТИГНУТ — PR готов к merge")
        return True

    # Если нет консенсуса — показать блокирующие проблемы
    blocking = extract_blocking_issues(reviews)
    if blocking:
        print(f"\n[WARN] Блокирующие проблемы ({len(blocking)}):")
        for issue in blocking:
            print(f"  - [{issue.priority}] {issue.file}:{issue.line} — {issue.problem[:60]}")

    print("\n❌ КОНСЕНСУС НЕ ДОСТИГНУТ — требуются исправления")

    # Рекомендации
    missing = MAIN_REVIEWERS - set(reviews.keys())
    if missing:
        print(f"\n[TIP] Ожидаем ревью от: {', '.join(missing)}")

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
    tmp_file = Path(__file__).parent / "tmp_consensus.md"
    try:
        tmp_file.write_text(summary, encoding="utf-8")

        subprocess.run(
            [
                "gh", "pr", "comment", str(pr_number),
                "--repo", repo,
                "--body-file", str(tmp_file),
            ],
            check=True,
            encoding="utf-8",
        )
        print(f"[OK] Consensus summary опубликован в PR #{pr_number}")
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Не удалось опубликовать summary: {e}")
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
        default=1,
        help="Номер итерации ревью (по умолчанию: 1)"
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
        if not run_gemini_reviewer(args.pr, args.iteration):
            success = False

    if args.check_consensus:
        if not check_consensus(args.pr, args.repo):
            success = False

    if args.publish_summary:
        publish_consensus_summary(args.pr, args.repo)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
