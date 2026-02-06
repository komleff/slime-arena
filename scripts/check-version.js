/**
 * check-version.js — Проверка синхронизации версий во всех файлах проекта.
 *
 * Единственный источник правды: version.json
 * Выход с кодом 1 если найдено расхождение.
 *
 * Использование:
 *   npm run check-version
 *   node scripts/check-version.js
 */

const fs = require('fs');
const path = require('path');

const versionData = require('../version.json');
if (!versionData.version || !/^\d+\.\d+\.\d+$/.test(versionData.version)) {
  console.error('check-version: version.json is missing or has invalid "version" field');
  process.exit(1);
}
const version = versionData.version;
const errors = [];

// --- 1. package.json файлы ---
const packageFiles = [
  'package.json',
  'client/package.json',
  'server/package.json',
  'shared/package.json',
  'admin-dashboard/package.json'
];

packageFiles.forEach(file => {
  const filePath = path.resolve(__dirname, '..', file);
  if (!fs.existsSync(filePath)) return;
  const pkg = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (pkg.version !== version) {
    errors.push({ file, expected: version, found: pkg.version });
  }
});

// --- 2. Docker и Compose файлы (проверяем ВСЕ вхождения) ---
const regexChecks = [
  { file: 'docker/monolith-full.Dockerfile', pattern: /org\.opencontainers\.image\.version="(\d+\.\d+\.\d+)"/g },
  { file: 'docker/app.Dockerfile', pattern: /org\.opencontainers\.image\.version="(\d+\.\d+\.\d+)"/g },
  { file: 'docker/db.Dockerfile', pattern: /org\.opencontainers\.image\.version="(\d+\.\d+\.\d+)"/g },
  { file: 'docker/docker-compose.monolith-full.yml', pattern: /\$\{VERSION:-(\d+\.\d+\.\d+)\}/g },
  { file: 'docker/docker-compose.app-db.yml', pattern: /\$\{VERSION:-(\d+\.\d+\.\d+)\}/g },
];

regexChecks.forEach(({ file, pattern }) => {
  const filePath = path.resolve(__dirname, '..', file);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  const matches = [...content.matchAll(pattern)];
  if (matches.length === 0) {
    errors.push({ file, expected: version, found: '(pattern not found)' });
  } else {
    matches.forEach(m => {
      if (m[1] !== version) {
        errors.push({ file, expected: version, found: m[1] });
      }
    });
  }
});

// --- Результат ---
if (errors.length > 0) {
  console.error(`check-version: FAIL — ${errors.length} mismatch(es) (expected ${version}):\n`);
  errors.forEach(({ file, expected, found }) => {
    console.error(`  ${file}: found "${found}", expected "${expected}"`);
  });
  console.error('\nRun "npm run sync-version" to fix.');
  process.exit(1);
} else {
  console.log(`check-version: OK — all files at ${version}`);
}
