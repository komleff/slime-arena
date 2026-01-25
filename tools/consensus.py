"""
Consensus Checker для PM Orchestrator
Проверяет достижение консенсуса между ревьюверами
"""

from dataclasses import dataclass
from typing import Dict
from review_state import ReviewData


@dataclass
class ConsensusData:
    """Данные о консенсусе"""
    pr_number: int
    iteration: int
    reviews: Dict[str, ReviewData]
    approved_count: int
    all_approved: bool


def calculate_consensus(reviews: Dict[str, ReviewData]) -> ConsensusData:
    """
    Проверить консенсус между ревьюверами

    Требуется 3 APPROVED из 3 основных ревьюверов (Opus, Codex, Gemini)
    GitHub Copilot опциональный, не влияет на консенсус
    """

    # Основные ревьюверы
    main_reviewers = {"opus", "codex", "gemini"}

    # Подсчитать APPROVED от основных ревьюверов
    approved = sum(
        1 for reviewer, data in reviews.items()
        if reviewer in main_reviewers and data.status == "APPROVED"
    )

    return ConsensusData(
        pr_number=0,  # Будет заполнено позже
        iteration=0,   # Будет заполнено позже
        reviews=reviews,
        approved_count=approved,
        all_approved=(approved >= 3)
    )


def get_pending_reviewers(reviews: Dict[str, ReviewData]) -> list[str]:
    """Получить список ревьюверов, которые ещё не ответили"""
    expected = {"opus", "codex", "gemini"}
    received = set(reviews.keys())
    return list(expected - received)
