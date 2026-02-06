/**
 * sync-version.js — Синхронизация версии из version.json во все файлы проекта.
 *
 * Единственный источник правды: version.json
 * Вызывается автоматически через prebuild хук (npm run build).
 *
 * Покрытие:
 *   - 5× package.json (root, client, server, shared, admin-dashboard)
 *   - 3× Dockerfile (monolith-full, app, db)
 *   - 2× docker-compose (monolith-full, app-db)
 */

const fs = require('fs');
const path = require('path');

const version = require('../version.json').version;

console.log(`sync-version: syncing to ${version}`);

// --- 1. package.json файлы ---
const packageFiles = [
  '../package.json',
  '../client/package.json',
  '../server/package.json',
  '../shared/package.json',
  '../admin-dashboard/package.json'
];

packageFiles.forEach(file => {
  const filePath = path.resolve(__dirname, file);
  if (fs.existsSync(filePath)) {
    const pkg = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (pkg.version !== version) {
      pkg.version = version;
      fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`  updated ${file}`);
    }
  }
});

// --- 2. Docker и Compose файлы ---
const dockerFiles = [
  {
    path: '../docker/monolith-full.Dockerfile',
    patterns: [
      { regex: /# Version: \d+\.\d+\.\d+/, replacement: `# Version: ${version}` },
      { regex: /org\.opencontainers\.image\.version="\d+\.\d+\.\d+"/, replacement: `org.opencontainers.image.version="${version}"` }
    ]
  },
  {
    path: '../docker/app.Dockerfile',
    patterns: [
      { regex: /# Version: \d+\.\d+\.\d+/, replacement: `# Version: ${version}` },
      { regex: /org\.opencontainers\.image\.version="\d+\.\d+\.\d+"/, replacement: `org.opencontainers.image.version="${version}"` }
    ]
  },
  {
    path: '../docker/db.Dockerfile',
    patterns: [
      { regex: /# Version: \d+\.\d+\.\d+/, replacement: `# Version: ${version}` },
      { regex: /org\.opencontainers\.image\.version="\d+\.\d+\.\d+"/, replacement: `org.opencontainers.image.version="${version}"` }
    ]
  },
  {
    path: '../docker/docker-compose.monolith-full.yml',
    patterns: [
      { regex: /# Version: \d+\.\d+\.\d+/, replacement: `# Version: ${version}` },
      { regex: /slime-arena-monolith-full:\$\{VERSION:-\d+\.\d+\.\d+\}/g, replacement: `slime-arena-monolith-full:\${VERSION:-${version}}` }
    ]
  },
  {
    path: '../docker/docker-compose.app-db.yml',
    patterns: [
      { regex: /# Version: \d+\.\d+\.\d+/, replacement: `# Version: ${version}` },
      { regex: /slime-arena-db:\$\{VERSION:-\d+\.\d+\.\d+\}/g, replacement: `slime-arena-db:\${VERSION:-${version}}` },
      { regex: /slime-arena-app:\$\{VERSION:-\d+\.\d+\.\d+\}/g, replacement: `slime-arena-app:\${VERSION:-${version}}` }
    ]
  }
];

dockerFiles.forEach(({ path: filePath, patterns }) => {
  const fullPath = path.resolve(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`  skip (not found): ${filePath}`);
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf-8');
  let updated = false;
  patterns.forEach(({ regex, replacement }) => {
    const newContent = content.replace(regex, replacement);
    if (newContent !== content) {
      content = newContent;
      updated = true;
    }
  });
  if (updated) {
    fs.writeFileSync(fullPath, content);
    console.log(`  updated ${filePath}`);
  }
});

console.log('sync-version: done');
