#!/usr/bin/env python3
"""
External Reviewers — ChatGPT Codex и Gemini Pro через API
Opus вызывается нативно через Claude Code Task tool
"""

import os
import sys
import json
import asyncio
import argparse
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

# Проверка зависимостей
try:
    import openai
    import google.generativeai as genai
except ImportError:
    print("ERROR: Missing dependencies. Install with:")
    print("  pip install openai google-generativeai")
    sys.exit(1)


class ExternalReviewers:
    """Запуск внешних ревьюверов (Codex, Gemini)"""

    def __init__(self, repo_path: str, pr_number: int):
        self.repo_path = Path(repo_path)
        self.pr_number = pr_number

        # Инициализация клиентов
        self.openai_client = openai.OpenAI(
            api_key=os.environ.get("OPENAI_API_KEY")
        )
        genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))
        self.gemini_model = genai.GenerativeModel('gemini-2.0-flash-exp')

    def load_prompt_template(self) -> str:
        """Загрузить универсальный промпт для ревьюверов"""
        prompt_file = self.repo_path / "docs" / "sprint-13" / "universal-review-prompt.md"
        if not prompt_file.exists():
            # Fallback на базовый промпт
            return """
# Code Review Request

Please review PR #{pr_number} and provide:
1. Checklist of what was verified
2. P0/P1/P2 issues found (with file:line references)
3. Verdict: APPROVED or CHANGES_REQUESTED

Focus on:
- Determinism (no Math.random() in server simulation)
- Path correctness for config files
- SQL injection prevention
- TypeScript type safety
"""
        with open(prompt_file, 'r', encoding='utf-8') as f:
            return f.read()

    async def review_with_codex(self, prompt: str) -> str:
        """Ревью с помощью ChatGPT Codex"""
        print("[ChatGPT Codex] Starting review...")

        try:
            response = self.openai_client.chat.completions.create(
                model="o1-2024-12-17",
                messages=[{
                    "role": "user",
                    "content": prompt.replace("[MODEL_NAME]", "ChatGPT 5.2 Codex")
                }]
            )

            result = response.choices[0].message.content
            print("[ChatGPT Codex] [OK] Review completed")
            return result
        except Exception as e:
            print(f"[ChatGPT Codex] [FAIL] Error: {e}")
            return f"# Error during review\n\n{str(e)}"

    async def review_with_gemini(self, prompt: str) -> str:
        """Ревью с помощью Gemini Pro"""
        print("[Gemini Pro] Starting review...")

        try:
            response = self.gemini_model.generate_content(
                prompt.replace("[MODEL_NAME]", "Gemini 3 Pro"),
                generation_config=genai.GenerationConfig(
                    temperature=0.2,
                    max_output_tokens=16000,
                )
            )

            result = response.text
            print("[Gemini Pro] [OK] Review completed")
            return result
        except Exception as e:
            print(f"[Gemini Pro] [FAIL] Error: {e}")
            return f"# Error during review\n\n{str(e)}"

    async def run_external_reviewers(self, reviewers: list = None) -> Dict[str, str]:
        """Запустить выбранных внешних ревьюверов параллельно"""
        if reviewers is None:
            reviewers = ["codex", "gemini"]

        prompt = self.load_prompt_template()
        results = {}

        print(f"\n=== Starting external reviews ({', '.join(reviewers)}) ===\n")

        tasks = []
        reviewer_names = []

        if "codex" in reviewers:
            tasks.append(self.review_with_codex(prompt))
            reviewer_names.append("codex")

        if "gemini" in reviewers:
            tasks.append(self.review_with_gemini(prompt))
            reviewer_names.append("gemini")

        if tasks:
            completed = await asyncio.gather(*tasks, return_exceptions=True)
            for name, result in zip(reviewer_names, completed):
                if isinstance(result, Exception):
                    results[name] = f"Error: {result}"
                else:
                    results[name] = result

        return results

    def post_reviews_to_pr(self, reviews: Dict[str, str], iteration: int = 0):
        """Публикация отчётов как комментариев в PR"""
        print(f"\n=== Posting reviews to PR #{self.pr_number} ===\n")

        for reviewer, report in reviews.items():
            metadata = {
                "reviewer": reviewer,
                "iteration": iteration,
                "type": "review",
                "timestamp": datetime.now().isoformat(),
                "source": "external_reviewers.py"
            }

            body = f"<!-- {json.dumps(metadata)} -->\n{report}"

            try:
                subprocess.run([
                    "gh", "pr", "comment", str(self.pr_number),
                    "--repo", "komleff/slime-arena",
                    "--body", body
                ], check=True)
                print(f"[OK] Posted {reviewer} review to PR")
            except subprocess.CalledProcessError as e:
                print(f"[FAIL] Failed to post {reviewer} review: {e}")


async def main():
    parser = argparse.ArgumentParser(
        description="External Reviewers - Codex/Gemini reviews (Opus via Task tool)"
    )
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
        "--reviewers",
        nargs="+",
        choices=["codex", "gemini"],
        default=["codex", "gemini"],
        help="Which reviewers to run (default: both)"
    )
    parser.add_argument(
        "--iteration",
        type=int,
        default=0,
        help="Review iteration number"
    )
    parser.add_argument(
        "--post",
        action="store_true",
        help="Post reviews to PR as comments"
    )

    args = parser.parse_args()

    # Проверка API ключей
    missing_keys = []
    if "codex" in args.reviewers and not os.environ.get("OPENAI_API_KEY"):
        missing_keys.append("OPENAI_API_KEY")
    if "gemini" in args.reviewers and not os.environ.get("GOOGLE_API_KEY"):
        missing_keys.append("GOOGLE_API_KEY")

    if missing_keys:
        print(f"ERROR: Missing API keys: {', '.join(missing_keys)}")
        sys.exit(1)

    # Запуск ревьюверов
    reviewers = ExternalReviewers(args.repo, args.pr)
    results = await reviewers.run_external_reviewers(args.reviewers)

    # Вывод результатов
    print("\n" + "=" * 60)
    print("=== Review Results ===")
    print("=" * 60 + "\n")

    for reviewer, report in results.items():
        print(f"\n--- {reviewer.upper()} ---\n")
        print(report[:2000] + "..." if len(report) > 2000 else report)

    # Публикация в PR
    if args.post:
        reviewers.post_reviews_to_pr(results, args.iteration)
        print("\n[SUCCESS] Reviews posted to PR")
    else:
        print("\n[INFO] Use --post to publish reviews to PR")


if __name__ == "__main__":
    asyncio.run(main())
