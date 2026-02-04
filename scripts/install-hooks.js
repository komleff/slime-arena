#!/usr/bin/env node
/**
 * Установка git hooks для защиты ветки main
 * Автоматически определяет платформу и запускает соответствующий скрипт
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Определяем корневую директорию проекта
const projectRoot = path.resolve(__dirname, '..');
const scriptsDir = path.join(projectRoot, 'scripts');

// Проверяем наличие директории .git (это git репозиторий)
const gitDir = path.join(projectRoot, '.git');
if (!fs.existsSync(gitDir)) {
  console.log('⚠️  Не найдена директория .git, пропускаем установку hooks');
  console.log('   (hooks будут установлены после клонирования репозитория)');
  process.exit(0);
}

// Определяем команду в зависимости от платформы
let command;
if (process.platform === 'win32') {
  command = path.join(scriptsDir, 'install-hooks.bat');
  // Проверяем существование файла
  if (!fs.existsSync(command)) {
    console.error('❌ Ошибка: Не найден файл install-hooks.bat');
    process.exit(1);
  }
} else {
  command = 'bash ' + path.join(scriptsDir, 'install-hooks.sh');
  const scriptPath = path.join(scriptsDir, 'install-hooks.sh');
  // Проверяем существование файла
  if (!fs.existsSync(scriptPath)) {
    console.error('❌ Ошибка: Не найден файл install-hooks.sh');
    process.exit(1);
  }
}

try {
  // Запускаем скрипт установки
  execSync(command, { 
    stdio: 'inherit',
    cwd: projectRoot
  });
  process.exit(0);
} catch (error) {
  console.error('❌ Ошибка при установке git hooks');
  console.error(error.message);
  process.exit(1);
}
