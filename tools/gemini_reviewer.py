import os
import sys
import json
import subprocess
import argparse
from datetime import datetime
from google import genai

# Конфигурация
# Требуется: pip install google-genai
# Требуется: gh auth login
DEFAULT_REPO = os.getenv("SLIME_ARENA_REPO", "komleff/slime-arena")

# Модель Gemini для ревью (gemini-2.5-flash — быстрая и качественная)
GEMINI_MODEL = "gemini-2.5-flash"

class GeminiReviewer:
    def __init__(self, pr_number, iteration=1, repo=DEFAULT_REPO):
        self.pr_number = pr_number
        self.iteration = iteration
        self.repo = repo

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            print("[ERROR] Не задана переменная окружения GEMINI_API_KEY")
            sys.exit(1)

        # Новый API: используем Client
        self.client = genai.Client(api_key=api_key)

        self.check_dependencies()

    def check_dependencies(self):
        """Проверка окружения перед запуском"""
        try:
            subprocess.run(["gh", "--version"], check=True, capture_output=True, encoding='utf-8')
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("[ERROR] GitHub CLI (gh) не найден. Установите его и выполните `gh auth login`.")
            sys.exit(1)

    def get_pr_data(self):
        """Получение diff и деталей PR через GitHub CLI"""
        print(f"[INFO] Получение данных для PR #{self.pr_number} из {self.repo}...")

        # Получаем Diff
        diff_proc = subprocess.run(
            ["gh", "pr", "diff", str(self.pr_number), "--repo", self.repo],
            capture_output=True, text=True, check=True, encoding='utf-8'
        )

        # Получаем описание
        view_proc = subprocess.run(
            ["gh", "pr", "view", str(self.pr_number), "--repo", self.repo, "--json", "title,body,author"],
            capture_output=True, text=True, check=True, encoding='utf-8'
        )

        return diff_proc.stdout, json.loads(view_proc.stdout)

    def analyze_code(self, diff, pr_details):
        """Анализ кода через Gemini API"""
        print("[INFO] Gemini 3 Pro анализирует код...")
        
        system_prompt = """
        Ты — Gemini 3 Pro, элитный AI-ревьювер кода для проекта Slime Arena.
        Твоя специализация: UX, Производительность (Performance), Безопасность и Оптимистичные находки.
        
        Твоя задача:
        1. Найти проблемы, влияющие на опыт игрока (задержки, лаги, непонятный UI).
        2. Найти узкие места производительности (лишние ререндеры, тяжелые вычисления).
        3. Проверить безопасность (утечки токенов, SQL-инъекции, XSS).
        4. Отметить хорошие решения (будь позитивным, но строгим к ошибкам).
        5. Игнорировать мелкие придирки к стилю (это задача Copilot).
        
        Формат ответа (Markdown):
        ## Review by Gemini 3 Pro

        ### Чеклист
        - [ ] Сборка проходит (предполагаем)
        - [ ] Тесты проходят (предполагаем)
        - [ ] Детерминизм сохранён (для серверного кода)

        ### Позитивные моменты
        (Кратко, что сделано хорошо)

        ### Замечания
        1. **[P0]** `файл:строка` — Критическая проблема (UX блок, краш, утечка памяти).
        2. **[P1]** `файл:строка` — Важная проблема (плохая производительность, баг логики).
        3. **[P2]** `файл:строка` — Рекомендация по улучшению.

        ### Вердикт
        **APPROVED** ✅ или **CHANGES_REQUESTED** ❌ (если есть P0/P1).
        """

        user_prompt = f"""
        PR Title: {pr_details['title']}
        Author: {pr_details['author']['login']}
        Description: {pr_details['body']}
        
        Code Diff:
        ```diff
        {diff[:100000]} 
        ```
        """
        # Ограничиваем diff 100к символов, хотя 1.5 Pro может больше

        # Новый API: используем client.models.generate_content
        response = self.client.models.generate_content(
            model=GEMINI_MODEL,
            contents=f"{system_prompt}\n\n{user_prompt}"
        )
        return response.text

    def publish_report(self, report):
        """Публикация отчета в PR"""
        print("[INFO] Публикация отчета в GitHub...")
        
        metadata = {
            "reviewer": "gemini",
            "iteration": self.iteration,
            "timestamp": datetime.now().isoformat(),
            "type": "review"
        }
        
        body = f"<!-- {json.dumps(metadata)} -->\n{report}"
        
        subprocess.run([
            "gh", "pr", "comment", str(self.pr_number),
            "--repo", self.repo,
            "--body", body
        ], check=True, encoding='utf-8')
        print(f"[OK] Отчет успешно опубликован в PR #{self.pr_number} ({self.repo})")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Gemini 3 Pro Agent Reviewer")
    parser.add_argument("--pr", type=int, required=True, help="Номер PR")
    parser.add_argument("--iteration", type=int, default=1, help="Номер итерации ревью")
    parser.add_argument("--repo", type=str, default=DEFAULT_REPO, help=f"Репозиторий (по умолчанию: {DEFAULT_REPO})")
    args = parser.parse_args()

    try:
        agent = GeminiReviewer(args.pr, args.iteration, args.repo)
        diff, details = agent.get_pr_data()
        report = agent.analyze_code(diff, details)
        agent.publish_report(report)
    except Exception as e:
        print(f"[ERROR] Критическая ошибка агента: {e}")
        sys.exit(1)