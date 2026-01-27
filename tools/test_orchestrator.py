"""
Unit-тесты для PM Orchestrator

Тестирует:
- calculate_consensus: расчёт консенсуса (3+ APPROVED от основных ревьюверов)
- extract_blocking_issues: извлечение P0/P1 проблем
- Исключение copilot из расчёта консенсуса
"""

import sys
from pathlib import Path

# Добавляем корень репозитория в sys.path для импортов
_REPO_ROOT = Path(__file__).parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

import pytest
from tools.review_state import ReviewData, ReviewStatus, Issue, CONSENSUS_THRESHOLD
from tools.consensus import calculate_consensus, extract_blocking_issues


def test_consensus_success():
    """Проверка достижения консенсуса при 3 APPROVED"""
    reviews = {
        "opus": ReviewData(
            reviewer="opus",
            status=ReviewStatus.APPROVED,
            body="All good",
            iteration=1,
        ),
        "codex": ReviewData(
            reviewer="codex",
            status=ReviewStatus.APPROVED,
            body="All good",
            iteration=1,
        ),
        "gemini": ReviewData(
            reviewer="gemini",
            status=ReviewStatus.APPROVED,
            body="All good",
            iteration=1,
        ),
    }

    consensus, approved, total = calculate_consensus(reviews)

    assert approved == 3
    assert consensus is True


def test_consensus_failure():
    """Проверка отсутствия консенсуса при 2 APPROVED"""
    reviews = {
        "opus": ReviewData(
            reviewer="opus",
            status=ReviewStatus.APPROVED,
            body="All good",
            iteration=1,
        ),
        "codex": ReviewData(
            reviewer="codex",
            status=ReviewStatus.CHANGES_REQUESTED,
            body="Issues found",
            iteration=1,
        ),
        "gemini": ReviewData(
            reviewer="gemini",
            status=ReviewStatus.APPROVED,
            body="All good",
            iteration=1,
        ),
    }

    consensus, approved, total = calculate_consensus(reviews)

    assert approved == 2
    assert consensus is False


def test_extract_blocking_issues():
    """Проверка извлечения блокирующих проблем P0/P1"""
    reviews = {
        "opus": ReviewData(
            reviewer="opus",
            status=ReviewStatus.CHANGES_REQUESTED,
            body="Issues found",
            iteration=1,
            issues=[
                Issue(priority="P0", file="test.py", line=10, problem="Critical bug"),
                Issue(priority="P2", file="test.py", line=20, problem="Minor issue"),
            ],
        ),
    }

    blocking = extract_blocking_issues(reviews)

    assert len(blocking) == 1
    assert blocking[0].priority == "P0"
    assert blocking[0].problem == "Critical bug"


def test_copilot_excluded_from_consensus():
    """Проверка что Copilot не влияет на консенсус"""
    reviews = {
        "opus": ReviewData(
            reviewer="opus",
            status=ReviewStatus.APPROVED,
            body="All good",
            iteration=1,
        ),
        "codex": ReviewData(
            reviewer="codex",
            status=ReviewStatus.APPROVED,
            body="All good",
            iteration=1,
        ),
        "gemini": ReviewData(
            reviewer="gemini",
            status=ReviewStatus.APPROVED,
            body="All good",
            iteration=1,
        ),
        "copilot": ReviewData(
            reviewer="copilot",
            status=ReviewStatus.CHANGES_REQUESTED,
            body="Some style issues",
            iteration=1,
        ),
    }

    consensus, approved, total = calculate_consensus(reviews)

    # Copilot не считается — 3/3 main reviewers APPROVED
    assert approved == 3
    assert total == 3
    assert consensus is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
