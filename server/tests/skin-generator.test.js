/**
 * Unit-тесты для skinGenerator
 * Запуск: node server/tests/skin-generator.test.js
 */

const path = require('path');

// Установка рабочей директории на корень проекта
const projectRoot = path.resolve(__dirname, '..', '..');
process.chdir(projectRoot);

const {
  generateRandomBasicSkin,
  generateBasicSkin,
  getBasicSkins,
  skinExists,
  getSkinById
} = require(path.resolve(__dirname, '../dist/server/src/utils/generators/skinGenerator.js'));

// Простой тестовый фреймворк
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ ${message}`);
    failedTests++;
    return false;
  } else {
    console.log(`  ✓ ${message}`);
    passedTests++;
    return true;
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    console.error(`  ✗ ${message}`);
    console.error(`    Expected: ${expected}`);
    console.error(`    Actual: ${actual}`);
    failedTests++;
    return false;
  } else {
    console.log(`  ✓ ${message}`);
    passedTests++;
    return true;
  }
}

function test(name, fn) {
  console.log(`\n${name}:`);
  try {
    fn();
  } catch (error) {
    console.error(`  ✗ Test failed with error: ${error.message}`);
    failedTests++;
  }
}

// ============= Тесты =============

console.log('\n=== Skin Generator Tests ===\n');

test('Basic skins list', () => {
  const basicSkins = getBasicSkins();
  assert(Array.isArray(basicSkins), 'Should return array');
  assert(basicSkins.length > 0, 'Should have at least one basic skin');
  assert(basicSkins.every(skin => skin.tier === 'basic'), 'All skins should be basic tier');
  assert(basicSkins.every(skin => skin.id), 'All skins should have id');
  assert(basicSkins.every(skin => skin.name), 'All skins should have name');
  assert(basicSkins.every(skin => typeof skin.price === 'number'), 'All skins should have price');
  assert(basicSkins.every(skin => skin.color), 'All skins should have color');
  console.log(`  Found ${basicSkins.length} basic skins`);
});

test('Random basic skin generation', () => {
  const basicSkins = getBasicSkins();
  const skinIds = basicSkins.map(s => s.id);

  // Генерируем несколько скинов
  for (let i = 0; i < 10; i++) {
    const skinId = generateRandomBasicSkin();
    assert(typeof skinId === 'string', `Generated skin should be string (iteration ${i})`);
    assert(skinIds.includes(skinId), `Generated skin should be in basic skins list (iteration ${i}): ${skinId}`);
  }
});

test('Deterministic basic skin generation', () => {
  const basicSkins = getBasicSkins();
  const skinIds = basicSkins.map(s => s.id);

  // Один seed должен давать один скин
  const seed1 = 12345;
  const skin1a = generateBasicSkin(seed1);
  const skin1b = generateBasicSkin(seed1);
  assertEquals(skin1a, skin1b, 'Same seed should produce same skin');

  // Разные seeds могут давать разные скины (но не обязательно)
  const seed2 = 67890;
  const skin2 = generateBasicSkin(seed2);
  assert(skinIds.includes(skin2), 'Generated skin should be valid');

  // Проверяем несколько seeds на большом диапазоне
  const generatedSkins = new Set();
  for (let seed = 0; seed < 1000; seed += 10) {
    const skinId = generateBasicSkin(seed);
    assert(skinIds.includes(skinId), `Generated skin for seed ${seed} should be valid: ${skinId}`);
    generatedSkins.add(skinId);
  }

  // Должны получить несколько разных скинов
  // Примечание: LCG может давать перекос на малых seeds, но на большом диапазоне должно быть разнообразие
  if (basicSkins.length > 1) {
    const minUnique = Math.max(2, Math.floor(basicSkins.length * 0.3));
    assert(generatedSkins.size >= minUnique, `Should produce at least ${minUnique} different skins (got ${generatedSkins.size})`);
  }
  console.log(`  Generated ${generatedSkins.size} unique skins from 100 seeds (step 10)`);
});

test('Skin existence check', () => {
  const basicSkins = getBasicSkins();

  // Проверяем существующие скины
  for (const skin of basicSkins) {
    assert(skinExists(skin.id), `Skin ${skin.id} should exist`);
  }

  // Проверяем несуществующие скины
  assert(!skinExists('nonexistent_skin'), 'Nonexistent skin should return false');
  assert(!skinExists(''), 'Empty string should return false');
  assert(!skinExists('slime_invalid'), 'Invalid skin ID should return false');
});

test('Get skin by ID', () => {
  const basicSkins = getBasicSkins();

  // Проверяем существующие скины
  for (const skin of basicSkins) {
    const retrieved = getSkinById(skin.id);
    assert(retrieved !== null, `Should find skin ${skin.id}`);
    assertEquals(retrieved.id, skin.id, 'Retrieved skin ID should match');
    assertEquals(retrieved.name, skin.name, 'Retrieved skin name should match');
    assertEquals(retrieved.tier, skin.tier, 'Retrieved skin tier should match');
    assertEquals(retrieved.price, skin.price, 'Retrieved skin price should match');
    assertEquals(retrieved.color, skin.color, 'Retrieved skin color should match');
  }

  // Проверяем несуществующие скины
  const nonexistent = getSkinById('nonexistent_skin');
  assertEquals(nonexistent, null, 'Nonexistent skin should return null');
});

test('Config structure validation', () => {
  const basicSkins = getBasicSkins();

  // Проверяем обязательные поля
  for (const skin of basicSkins) {
    assert(typeof skin.id === 'string' && skin.id.length > 0, `Skin ${skin.id}: id should be non-empty string`);
    assert(typeof skin.name === 'string' && skin.name.length > 0, `Skin ${skin.id}: name should be non-empty string`);
    assert(['basic', 'rare', 'epic', 'legendary'].includes(skin.tier), `Skin ${skin.id}: tier should be valid`);
    assert(typeof skin.price === 'number' && skin.price >= 0, `Skin ${skin.id}: price should be non-negative number`);
    assert(typeof skin.color === 'string' && skin.color.length > 0, `Skin ${skin.id}: color should be non-empty string`);

    // Проверяем формат цвета (должен быть HEX)
    assert(/^#[0-9a-fA-F]{6}$/.test(skin.color), `Skin ${skin.id}: color should be valid HEX (#rrggbb)`);

    // Базовые скины должны быть бесплатными
    assert(skin.price === 0, `Skin ${skin.id}: basic skins should be free (price = 0)`);
  }
});

test('Determinism verification', () => {
  // Проверяем, что один seed всегда даёт один результат
  const testSeeds = [0, 1, 42, 12345, 67890, 999999];

  for (const seed of testSeeds) {
    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(generateBasicSkin(seed));
    }

    const allSame = results.every(r => r === results[0]);
    assert(allSame, `Seed ${seed} should always produce same result: [${results.join(', ')}]`);
  }
});

test('Distribution check', () => {
  const basicSkins = getBasicSkins();

  // Проверяем распределение на 1000 seeds
  const distribution = {};
  for (const skin of basicSkins) {
    distribution[skin.id] = 0;
  }

  for (let seed = 0; seed < 1000; seed++) {
    const skinId = generateBasicSkin(seed);
    distribution[skinId]++;
  }

  console.log('  Distribution (1000 seeds):');
  for (const [skinId, count] of Object.entries(distribution)) {
    const percentage = (count / 1000 * 100).toFixed(1);
    console.log(`    ${skinId}: ${count} (${percentage}%)`);
  }

  // Большинство скинов должны быть представлены
  // Примечание: LCG на малых seeds может не покрыть все варианты
  const appearingSkinsCount = Object.values(distribution).filter(count => count > 0).length;
  const coverageRatio = appearingSkinsCount / basicSkins.length;
  assert(coverageRatio >= 0.5, `At least 50% of skins should appear (got ${(coverageRatio * 100).toFixed(1)}%)`);
  console.log(`  Coverage: ${appearingSkinsCount}/${basicSkins.length} skins (${(coverageRatio * 100).toFixed(1)}%)`);

  // Проверяем, что нет огромного перекоса (не более 50% на один скин при >= 3 скинах)
  if (basicSkins.length >= 3) {
    for (const [skinId, count] of Object.entries(distribution)) {
      const percentage = count / 1000;
      assert(percentage < 0.5, `Skin ${skinId} appears too often (${(percentage * 100).toFixed(1)}%), should be < 50%`);
    }
  }
});

test('Edge cases', () => {
  // Негативные seeds
  const negativeSkin = generateBasicSkin(-1);
  assert(skinExists(negativeSkin), 'Should handle negative seed');

  // Очень большие seeds
  const largeSkin = generateBasicSkin(2147483647);
  assert(skinExists(largeSkin), 'Should handle large seed (max int32)');

  // Нулевой seed
  const zeroSkin = generateBasicSkin(0);
  assert(skinExists(zeroSkin), 'Should handle zero seed');
});

// ============= Итоги =============

console.log('\n=== Test Results ===\n');
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);
console.log(`Total: ${passedTests + failedTests}\n`);

if (failedTests > 0) {
  console.error('Some tests failed!');
  process.exit(1);
} else {
  console.log('All tests passed!');
  process.exit(0);
}
