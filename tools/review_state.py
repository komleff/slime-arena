"""
Review State — структуры данных для PM Orchestrator

Определяет состояния review cycle, структуры для хранения данных ревью,
и типы результатов цикла.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional
from datetime import datetime


class ReviewStatus(Enum):
    """Статус ревью от одного ревьювера"""
    APPROVED = "APPROVED"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"
    COMMENTED = "COMMENTED"
    PENDING = "PENDING"
    ERROR = "ERROR"


class CycleState(Enum):
    """Состояние review-fix-review цикла"""
    WAITING_FOR_REVIEWS = "waiting_for_reviews"
    ANALYZING_CONSENSUS = "analyzing_consensus"
    WAITING_FOR_FIX = "waiting_for_fix"
    COMPLETED = "completed"
    ESCALATED = "escalated"


class CycleResult(Enum):
    """Результат завершения цикла"""
    CONSENSUS_APPROVED = "consensus_approved"
    MAX_ITERATIONS_REACHED = "max_iterations_reached"
    ESCALATED_TO_HUMAN = "escalated_to_human"
    ERROR = "error"


@dataclass
class Issue:
    """Проблема, найденная ревьювером"""
    priority: str  # P0, P1, P2
    file: str
    line: Optional[int]
    problem: str
    solution: Optional[str] = None
    reviewer: str = ""

    def is_blocking(self) -> bool:
        """P0 и P1 блокируют merge"""
        return self.priority in ("P0", "P1")


@dataclass
class ReviewData:
    """Данные ревью от одного ревьювера"""
    reviewer: str  # opus, codex, gemini, copilot
    status: ReviewStatus
    body: str
    issues: List[Issue] = field(default_factory=list)
    iteration: int = 1
    timestamp: Optional[datetime] = None
    pr_number: int = 0

    @classmethod
    def from_error(cls, reviewer: str, error_message: str) -> "ReviewData":
        """Создать ReviewData из ошибки"""
        return cls(
            reviewer=reviewer,
            status=ReviewStatus.ERROR,
            body=f"Error: {error_message}",
            issues=[],
        )

    def has_blocking_issues(self) -> bool:
        """Есть ли блокирующие проблемы (P0/P1)"""
        return any(issue.is_blocking() for issue in self.issues)


@dataclass
class CycleContext:
    """Контекст текущего цикла review-fix-review"""
    pr_number: int
    iteration: int = 1
    max_iterations: int = 5
    state: CycleState = CycleState.WAITING_FOR_REVIEWS
    reviews: dict = field(default_factory=dict)  # Dict[str, ReviewData]
    blocking_issues: List[Issue] = field(default_factory=list)
    developer_model: str = "opus"  # opus или codex
    attempt: int = 1

    def should_escalate_to_codex(self) -> bool:
        """Нужно ли эскалировать на Codex (после 3 попыток Opus)"""
        return self.attempt > 3 and self.developer_model == "opus"

    def should_escalate_to_human(self) -> bool:
        """Нужно ли эскалировать на человека (после 5 попыток)"""
        return self.attempt > 5

    def increment_attempt(self) -> None:
        """Увеличить счётчик попыток и проверить эскалацию"""
        self.attempt += 1
        if self.should_escalate_to_codex():
            self.developer_model = "codex"


# Основные ревьюверы для консенсуса (3 APPROVED = консенсус)
# Tuple для детерминированного порядка вывода
MAIN_REVIEWERS = ("opus", "codex", "gemini")

# Copilot: НЕ влияет на консенсус, но ОБЯЗАТЕЛЕН если оставил замечания.
# Его P0/P1 замечания должны быть исправлены перед merge.
OPTIONAL_REVIEWERS = ("copilot",)
ALL_REVIEWERS = MAIN_REVIEWERS + OPTIONAL_REVIEWERS

# Множества для быстрых проверок принадлежности
MAIN_REVIEWERS_SET = frozenset(MAIN_REVIEWERS)
OPTIONAL_REVIEWERS_SET = frozenset(OPTIONAL_REVIEWERS)
ALL_REVIEWERS_SET = MAIN_REVIEWERS_SET | OPTIONAL_REVIEWERS_SET

# Минимум APPROVED для консенсуса (от основных ревьюверов)
CONSENSUS_THRESHOLD = 3
