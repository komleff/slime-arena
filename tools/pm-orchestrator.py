#!/usr/bin/env python3
"""
PM Orchestrator — автоматизация циклического review-fix-review
Использует API Anthropic, OpenAI, Google для параллельного code review
"""

import os
import sys
import json
import asyncio
import argparse
import subprocess
import time
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# Проверка зависимостей
try:
    import anthropic
    import openai
    import google.generativeai as genai
except ImportError:
    print("ERROR: Missing dependencies. Install with:")
    print("  pip install anthropic openai google-generativeai")
    sys.exit(1)

# Импорт локальных модулей
try:
    from review_state import ReviewState, ReviewData, Issue, CycleResult
    from consensus import calculate_consensus, get_pending_reviewers
    from pr_parser import parse_pr_comments, extract_blocking_issues, remove_duplicate_issues
    from developer_requester import request_developer_fix, wait_for_developer_fix
except ImportError as e:
    print(f"ERROR: Failed to import local modules: {e}")
    print("Make sure all required modules are in the same directory")
    sys.exit(1)


class ReviewCycleOrchestrator:
    """Оркестратор для циклического review-fix-review"""

    def __init__(self, repo_path: str, pr_number: int):
        self.repo_path = Path(repo_path)
        self.pr_number = pr_number
        self.iteration = 0
        self.state = ReviewState.INITIAL_REVIEW

        # Инициализация клиентов
        self.anthropic_client = anthropic.Anthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY")
        )
        self.openai_client = openai.OpenAI(
            api_key=os.environ.get("OPENAI_API_KEY")
        )
        genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))
        self.gemini_model = genai.GenerativeModel('gemini-2.0-flash-exp')

    def load_prompt_template(self) -> str:
        """Загрузить универсальный промпт для ревьюверов"""
        prompt_file = self.repo_path / "docs" / "sprint-13" / "universal-review-prompt.md"
        with open(prompt_file, 'r', encoding='utf-8') as f:
            return f.read()

    async def review_with_opus(self, prompt: str) -> str:
        """Ревью с помощью Claude Opus 4.5"""
        print("[Opus 4.5] Starting review...")

        try:
            message = self.anthropic_client.messages.create(
                model="claude-opus-4-5-20251101",
                max_tokens=16000,
                temperature=0.2,
                messages=[{
                    "role": "user",
                    "content": prompt.replace("[MODEL_NAME]", "Claude Opus 4.5")
                }]
            )

            result = message.content[0].text
            print("[Opus 4.5] [OK] Review completed")
            return result
        except Exception as e:
            print(f"[Opus 4.5] [FAIL] Error: {e}")
            return f"# Error during review\n\n{str(e)}"

    async def review_with_chatgpt(self, prompt: str) -> str:
        """Ревью с помощью ChatGPT 5.2 Codex"""
        print("[ChatGPT 5.2 Codex] Starting review...")

        try:
            response = self.openai_client.chat.completions.create(
                model="o1-2024-12-17",
                messages=[{
                    "role": "user",
                    "content": prompt.replace("[MODEL_NAME]", "ChatGPT 5.2 Codex")
                }]
            )

            result = response.choices[0].message.content
            print("[ChatGPT 5.2 Codex] [OK] Review completed")
            return result
        except Exception as e:
            print(f"[ChatGPT 5.2 Codex] [FAIL] Error: {e}")
            return f"# Error during review\n\n{str(e)}"

    async def review_with_gemini(self, prompt: str) -> str:
        """Ревью с помощью Gemini 3 Pro"""
        print("[Gemini 3 Pro] Starting review...")

        try:
            response = self.gemini_model.generate_content(
                prompt.replace("[MODEL_NAME]", "Gemini 3 Pro"),
                generation_config=genai.GenerationConfig(
                    temperature=0.2,
                    max_output_tokens=16000,
                )
            )

            result = response.text
            print("[Gemini 3 Pro] [OK] Review completed")
            return result
        except Exception as e:
            print(f"[Gemini 3 Pro] [FAIL] Error: {e}")
            return f"# Error during review\n\n{str(e)}"

    async def run_all_reviewers(self) -> Dict[str, str]:
        """Запустить всех ревьюверов параллельно"""
        prompt = self.load_prompt_template()

        print("\n=== Starting parallel reviews ===\n")

        # Запуск параллельно
        results = await asyncio.gather(
            self.review_with_opus(prompt),
            self.review_with_chatgpt(prompt),
            self.review_with_gemini(prompt),
            return_exceptions=True
        )

        return {
            "opus": results[0] if not isinstance(results[0], Exception) else f"Error: {results[0]}",
            "chatgpt": results[1] if not isinstance(results[1], Exception) else f"Error: {results[1]}",
            "gemini": results[2] if not isinstance(results[2], Exception) else f"Error: {results[2]}",
        }

    async def post_reviews_to_pr(self, reviews: Dict[str, str]):
        """Публикация отчётов как комментариев в PR"""
        print(f"\n=== Posting reviews to PR #{self.pr_number} ===\n")

        for reviewer, report in reviews.items():
            metadata = {
                "reviewer": reviewer,
                "iteration": self.iteration,
                "type": "review",
                "timestamp": datetime.now().isoformat()
            }

            body = f"<!-- {json.dumps(metadata)} -->\n{report}"

            subprocess.run([
                "gh", "pr", "comment", str(self.pr_number),
                "--repo", "komleff/slime-arena",
                "--body", body
            ], check=True)

            print(f"[OK] Posted {reviewer} review to PR")

    async def wait_for_copilot_review(self, timeout: int = 600) -> bool:
        """
        Ждать review от Copilot (до 10 минут)
        Только для iteration 0 (первое ревью)
        """
        if self.iteration > 0:
            return False  # Не ждать повторных ревью

        print("\n=== Waiting for GitHub Copilot review ===\n")

        start = time.time()
        while time.time() - start < timeout:
            comments = parse_pr_comments(self.pr_number)

            if "copilot" in comments or "github-copilot" in comments:
                print("[OK] Copilot review received")
                return True

            await asyncio.sleep(30)  # Проверять каждые 30 секунд

        print("[!] Copilot review timeout (10 minutes)")
        return False

    async def run_review_cycle(self, max_iterations: int = 5) -> CycleResult:
        """Основной цикл review-fix-review с эскалацией"""

        while self.iteration < max_iterations:
            print(f"\n{'='*60}")
            print(f"=== Iteration {self.iteration} ===")
            print(f"{'='*60}\n")

            # 1. Run reviewers
            reviews = await self.run_all_reviewers()

            # 2. Post to PR
            await self.post_reviews_to_pr(reviews)

            # 3. Wait Copilot (только iteration 0)
            if self.iteration == 0:
                await self.wait_for_copilot_review()

            # 4. Check consensus
            consensus = calculate_consensus(reviews)

            if consensus.all_approved:
                print(f"\n[SUCCESS] Consensus achieved ({consensus.approved_count}/3 APPROVED)")
                return CycleResult.SUCCESS

            # 5. Extract issues
            all_issues = extract_blocking_issues(reviews)
            issues = remove_duplicate_issues(all_issues)

            print(f"\n[!] Found {len(issues)} blocking issues (P0/P1)")

            # 6. Determine developer model
            if self.iteration < 3:
                developer_model = "opus"
            elif self.iteration < 5:
                developer_model = "codex"
            else:
                print("\n[ALERT] Escalate to human after 5 attempts")
                return CycleResult.ESCALATE_TO_HUMAN

            # 7. Create Beads task
            task_id = await request_developer_fix(
                self.pr_number,
                issues,
                developer_model,
                self.iteration + 1
            )
            print(f"[OK] Created Beads task: {task_id}")

            # 8. Wait for fix
            print(f"\n[...] Waiting for developer fix (up to 1 hour)...")
            if not await wait_for_developer_fix(str(self.repo_path)):
                print("\n[TIMEOUT] Waiting for developer fix")
                return CycleResult.TIMEOUT

            self.iteration += 1

        return CycleResult.ESCALATE_TO_HUMAN


async def main():
    parser = argparse.ArgumentParser(description="PM Orchestrator - Review Cycle Automation")
    parser.add_argument(
        "--pr",
        type=int,
        required=True,
        help="PR number to review"
    )
    parser.add_argument(
        "--repo",
        default="d:/slime-arena-meta",
        help="Path to repository"
    )
    parser.add_argument(
        "--cycle",
        action="store_true",
        help="Enable review-fix-review cycle mode"
    )
    parser.add_argument(
        "--max-iterations",
        type=int,
        default=5,
        help="Maximum iterations (default: 5)"
    )

    args = parser.parse_args()

    # Проверка API ключей
    if not all([
        os.environ.get("ANTHROPIC_API_KEY"),
        os.environ.get("OPENAI_API_KEY"),
        os.environ.get("GOOGLE_API_KEY"),
    ]):
        print("ERROR: Missing API keys. Set environment variables:")
        print("  - ANTHROPIC_API_KEY")
        print("  - OPENAI_API_KEY")
        print("  - GOOGLE_API_KEY")
        sys.exit(1)

    # Создать оркестратор
    orchestrator = ReviewCycleOrchestrator(args.repo, args.pr)

    if args.cycle:
        # Циклический режим
        result = await orchestrator.run_review_cycle(args.max_iterations)

        if result == CycleResult.SUCCESS:
            print("\n[SUCCESS] PR ready to merge!")
            sys.exit(0)
        elif result == CycleResult.ESCALATE_TO_HUMAN:
            print("\n[ALERT] Escalation required - human intervention needed")
            sys.exit(2)
        else:
            print(f"\n[X] Failed: {result.value}")
            sys.exit(1)
    else:
        # Однократное ревью
        reviews = await orchestrator.run_all_reviewers()
        await orchestrator.post_reviews_to_pr(reviews)

        print("\n[SUCCESS] Reviews posted to PR")


if __name__ == "__main__":
    asyncio.run(main())
