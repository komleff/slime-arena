/**
 * Конвертация всех PNG в WebP (кроме уже конвертированных слаймов)
 * Запуск: node scripts/optimize-all-png.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '../assets-dist');
const WEBP_QUALITY = 85;

async function findPngFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findPngFiles(fullPath));
    } else if (entry.name.endsWith('.png')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function optimizeAllPng() {
  const pngFiles = await findPngFiles(ASSETS_DIR);

  console.log(`Найдено ${pngFiles.length} PNG файлов`);
  console.log('---');

  let totalBefore = 0;
  let totalAfter = 0;

  for (const inputPath of pngFiles) {
    const outputPath = inputPath.replace('.png', '.webp');
    const relativePath = path.relative(ASSETS_DIR, inputPath);

    const statBefore = fs.statSync(inputPath);
    totalBefore += statBefore.size;

    await sharp(inputPath)
      .webp({ quality: WEBP_QUALITY, alphaQuality: 90 })
      .toFile(outputPath);

    const statAfter = fs.statSync(outputPath);
    totalAfter += statAfter.size;

    const savings = ((1 - statAfter.size / statBefore.size) * 100).toFixed(1);
    console.log(`${relativePath}: ${(statBefore.size / 1024).toFixed(0)}KB → ${(statAfter.size / 1024).toFixed(0)}KB (−${savings}%)`);

    // Удаляем оригинал сразу
    fs.unlinkSync(inputPath);
  }

  console.log('---');
  console.log(`Итого: ${(totalBefore / 1024 / 1024).toFixed(2)}MB → ${(totalAfter / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Экономия: ${((1 - totalAfter / totalBefore) * 100).toFixed(1)}%`);
}

optimizeAllPng().catch(console.error);
