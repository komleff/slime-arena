"""
Review State Machine для PM Orchestrator
Определяет состояния и структуры данных для review cycle
"""

from enum import Enum
from dataclasses import dataclass
from datetime import datetime


class ReviewState(Enum):
    """Состояния review cycle"""
    INITIAL_REVIEW = "initial_review"
    FIXES_NEEDED = "fixes_needed"
    DEVELOPER_FIX_OPUS = "developer_fix_opus"      # Попытки 1-3
    DEVELOPER_FIX_CODEX = "developer_fix_codex"    # Попытки 4-5
    RE_REVIEW = "re_review"
    SUCCESS = "success"
    ESCALATE_TO_HUMAN = "escalate_to_human"


@dataclass
class ReviewData:
    """Данные review от одного ревьювера"""
    reviewer: str  # "opus", "codex", "gemini", "copilot"
    iteration: int
    status: str  # "APPROVED", "CHANGES_REQUESTED", "COMMENTED"
    body: str
    timestamp: str


@dataclass
class Issue:
    """Проблема найденная ревьювером"""
    priority: str  # "P0", "P1", "P2"
    file: str
    line: int
    problem: str
    solution: str
    reviewer: str


class CycleResult(Enum):
    """Результат review cycle"""
    SUCCESS = "success"
    TIMEOUT = "timeout"
    MAX_ITERATIONS_EXCEEDED = "max_iterations_exceeded"
    ESCALATE_TO_HUMAN = "escalate_to_human"
