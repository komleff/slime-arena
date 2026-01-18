/**
 * Оптимизация спрайтов слаймов: 1024×1024 PNG → 512×512 WebP
 * Запуск: node scripts/optimize-slimes.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SLIMES_DIR = path.join(__dirname, '../assets-dist/sprites/slimes/base');
const TARGET_SIZE = 512;
const WEBP_QUALITY = 85;

async function optimizeSlimes() {
  const files = fs.readdirSync(SLIMES_DIR).filter(f => f.endsWith('.png'));

  console.log(`Найдено ${files.length} PNG файлов`);
  console.log(`Конвертация: 1024×1024 PNG → ${TARGET_SIZE}×${TARGET_SIZE} WebP (quality: ${WEBP_QUALITY})`);
  console.log('---');

  let totalBefore = 0;
  let totalAfter = 0;

  for (const file of files) {
    const inputPath = path.join(SLIMES_DIR, file);
    const outputFile = file.replace('.png', '.webp');
    const outputPath = path.join(SLIMES_DIR, outputFile);

    const statBefore = fs.statSync(inputPath);
    totalBefore += statBefore.size;

    await sharp(inputPath)
      .resize(TARGET_SIZE, TARGET_SIZE, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ quality: WEBP_QUALITY, alphaQuality: 90 })
      .toFile(outputPath);

    const statAfter = fs.statSync(outputPath);
    totalAfter += statAfter.size;

    const savings = ((1 - statAfter.size / statBefore.size) * 100).toFixed(1);
    console.log(`${file} → ${outputFile}: ${(statBefore.size / 1024).toFixed(0)}KB → ${(statAfter.size / 1024).toFixed(0)}KB (−${savings}%)`);
  }

  console.log('---');
  console.log(`Итого: ${(totalBefore / 1024 / 1024).toFixed(1)}MB → ${(totalAfter / 1024 / 1024).toFixed(1)}MB`);
  console.log(`Экономия: ${((1 - totalAfter / totalBefore) * 100).toFixed(1)}%`);
  console.log('');
  console.log('Удалить оригинальные PNG? Выполните:');
  console.log(`  rm ${SLIMES_DIR}/*.png`);
}

optimizeSlimes().catch(console.error);
