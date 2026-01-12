# PostgreSQL Backup & Restore

Руководство по резервному копированию и восстановлению базы данных Slime Arena.

## Требования

- PostgreSQL client tools (pg_dump, pg_restore)
- Доступ к базе данных (PGPASSWORD)

### Установка PostgreSQL Client Tools

**Windows (Chocolatey):**
```bash
choco install postgresql
```

**macOS (Homebrew):**
```bash
brew install postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql-client
```

## Переменные окружения

Скрипты используют следующие переменные (с defaults):

| Переменная | Default | Описание |
|------------|---------|----------|
| `PGHOST` | localhost | Хост PostgreSQL |
| `PGPORT` | 5432 | Порт PostgreSQL |
| `PGUSER` | slime | Пользователь БД |
| `PGDATABASE` | slime_arena | Имя базы данных |
| `PGPASSWORD` | — | Пароль (обязательно) |

Переменные можно задать в файле `.env` в корне проекта:

```env
PGHOST=localhost
PGPORT=5432
PGUSER=slime
PGPASSWORD=your_password
PGDATABASE=slime_arena
```

## Резервное копирование

### Windows (PowerShell)

```powershell
.\scripts\backup.ps1
```

### Linux/macOS

```bash
chmod +x scripts/backup.sh
./scripts/backup.sh
```

### Параметры

| Параметр | Описание |
|----------|----------|
| `-OutputDir` (PS1) | Директория для backup (default: `backups`) |
| `$1` (sh) | Директория для backup (default: `backups`) |

### Пример вывода

```
=== Slime Arena PostgreSQL Backup ===

Host:     localhost:5432
Database: slime_arena
User:     slime
Output:   backups/slime_arena_20260107_143022.dump

Using: pg_dump (PostgreSQL) 16.1

Starting backup...
  pg_dump: dumping contents of table "public.users"
  pg_dump: dumping contents of table "public.profiles"
  ...

=== Backup Complete ===
File:     backups/slime_arena_20260107_143022.dump
Size:     2.34 MB (2398208 bytes)
Duration: 3.45 seconds
Checksum: a1b2c3d4e5f6g7h8... (SHA256)

To restore: .\scripts\restore.ps1 -BackupFile "backups\slime_arena_20260107_143022.dump"
```

### Формат backup

Используется `pg_dump --format=custom`:
- Сжатый формат (меньше размер)
- Поддержка параллельного восстановления
- Возможность выборочного восстановления таблиц

## Восстановление

### Windows (PowerShell)

```powershell
.\scripts\restore.ps1 -BackupFile "backups\slime_arena_20260107_143022.dump"
```

С автоматическим подтверждением:
```powershell
.\scripts\restore.ps1 -BackupFile "backups\slime_arena_20260107_143022.dump" -Force
```

### Linux/macOS

```bash
./scripts/restore.sh backups/slime_arena_20260107_143022.dump
```

С автоматическим подтверждением:
```bash
./scripts/restore.sh backups/slime_arena_20260107_143022.dump --force
```

### Процесс восстановления

1. Скрипт запрашивает подтверждение (введите `RESTORE`)
2. Выполняется `pg_restore --clean --if-exists`
3. Существующие объекты удаляются и пересоздаются
4. Данные загружаются из backup

### Предупреждения при восстановлении

`pg_restore` может выдавать warnings (exit code != 0):
- `DROP ... does not exist` — нормально, объект не существовал
- Эти warnings не влияют на целостность данных

## Проверка после восстановления

После восстановления рекомендуется запустить тесты:

```bash
npx tsx server/tests/meta-stage-d.test.ts
```

Ожидаемый результат: **19/19 тестов пройдены**.

## Автоматизация

### Windows Task Scheduler

1. Открыть Task Scheduler
2. Create Basic Task → "Slime Arena Backup"
3. Trigger: Daily (или по расписанию)
4. Action: Start a program
   - Program: `powershell.exe`
   - Arguments: `-ExecutionPolicy Bypass -File "C:\path\to\slime-arena\scripts\backup.ps1"`
   - Start in: `C:\path\to\slime-arena`

### Linux/macOS Cron

```bash
# Ежедневный backup в 3:00
crontab -e
0 3 * * * cd /path/to/slime-arena && ./scripts/backup.sh >> /var/log/slime-arena-backup.log 2>&1
```

## Хранение backup файлов

### Рекомендации

1. **Retention**: Храните минимум 7 последних backup
2. **Off-site**: Копируйте backup в облако (S3, GCS, Azure Blob)
3. **Encryption**: Шифруйте backup при хранении в облаке
4. **Testing**: Регулярно проверяйте восстановление

### Структура директории

```
backups/
├── slime_arena_20260101_030000.dump
├── slime_arena_20260102_030000.dump
├── slime_arena_20260103_030000.dump
└── ...
```

### Очистка старых backup

**PowerShell** (оставить последние 7):
```powershell
Get-ChildItem backups/*.dump | Sort-Object LastWriteTime -Descending | Select-Object -Skip 7 | Remove-Item
```

**Bash** (оставить последние 7):
```bash
ls -t backups/*.dump | tail -n +8 | xargs rm -f
```

## Troubleshooting

### "pg_dump not found"

PostgreSQL client tools не установлены. См. раздел "Установка".

### "password authentication failed"

Проверьте `PGPASSWORD` в `.env` или переменных окружения.

### "connection refused"

1. PostgreSQL запущен? `docker ps` или `pg_isready`
2. Правильный хост/порт? Проверьте `PGHOST`, `PGPORT`

### "permission denied"

1. Пользователь имеет права на чтение/запись БД?
2. На Linux: `chmod +x scripts/*.sh`

### Большой размер backup

1. Используйте `pg_dump --compress=9` для максимального сжатия
2. Очистите неиспользуемые данные в БД
3. Выполните `VACUUM FULL` перед backup

## Безопасность

1. **Никогда** не храните `PGPASSWORD` в git
2. Используйте `.env` файл (добавлен в `.gitignore`)
3. Ограничьте доступ к backup файлам
4. Шифруйте backup при передаче по сети

## См. также

- [SlimeArena-SoftLaunch-Plan-v1.0.5.md](../soft-launch/SlimeArena-SoftLaunch-Plan-v1.0.5.md) — требования к backup
- [PostgreSQL pg_dump documentation](https://www.postgresql.org/docs/current/app-pgdump.html)
- [PostgreSQL pg_restore documentation](https://www.postgresql.org/docs/current/app-pgrestore.html)
