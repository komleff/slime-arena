/**
 * Unit-тесты для nicknameValidator
 * Запуск: node server/tests/nickname-validator.test.js
 */

const path = require('path');

// Установка рабочей директории
const serverRoot = path.resolve(__dirname, '..');
process.chdir(serverRoot);

const {
  validateNickname,
  validateNicknameDetailed,
  normalizeNickname,
  validateAndNormalize,
  NICKNAME_CONFIG
} = require(path.resolve(__dirname, '../dist/server/src/utils/generators/nicknameValidator.js'));

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

console.log('\n=== Nickname Validator Tests ===\n');

test('Valid nicknames', () => {
  assert(validateNickname('Player'), 'Latin letters');
  assert(validateNickname('Игрок'), 'Cyrillic letters');
  assert(validateNickname('Player123'), 'Letters with numbers');
  assert(validateNickname('Player One'), 'Nickname with space');
  assert(validateNickname('Player-One'), 'Nickname with hyphen');
  assert(validateNickname('Player_One'), 'Nickname with underscore');
  assert(validateNickname('ИгрокНомер1'), 'Mixed cyrillic and numbers');
  assert(validateNickname('AB'), 'Minimum length (2 characters)');
  assert(validateNickname('12345678901234567890'), 'Maximum length (20 characters)');
});

test('Invalid nicknames - length', () => {
  assert(!validateNickname('A'), 'Too short (1 character)');
  assert(!validateNickname('123456789012345678901'), 'Too long (21 characters)');
  assert(!validateNickname(''), 'Empty string');
  assert(!validateNickname('   '), 'Only spaces');
});

test('Invalid nicknames - forbidden characters', () => {
  assert(!validateNickname('Player@123'), 'Contains @');
  assert(!validateNickname('Player#One'), 'Contains #');
  assert(!validateNickname('Player$One'), 'Contains $');
  assert(!validateNickname('Player%One'), 'Contains %');
  assert(!validateNickname('Player&One'), 'Contains &');
  assert(!validateNickname('Player!'), 'Contains !');
  assert(!validateNickname('Player?'), 'Contains ?');
  assert(!validateNickname('Player.One'), 'Contains dot');
  assert(!validateNickname('Player,One'), 'Contains comma');
  assert(!validateNickname('Player;One'), 'Contains semicolon');
  assert(!validateNickname('Player:One'), 'Contains colon');
  assert(!validateNickname('Player/One'), 'Contains slash');
  assert(!validateNickname('Player\\One'), 'Contains backslash');
  assert(!validateNickname('Player<One>'), 'Contains angle brackets (HTML)');
  assert(!validateNickname('Player(One)'), 'Contains parentheses');
  assert(!validateNickname('Player[One]'), 'Contains square brackets');
  assert(!validateNickname('Player{One}'), 'Contains curly braces');
  assert(!validateNickname('Player*One'), 'Contains asterisk');
  assert(!validateNickname('Player+One'), 'Contains plus');
  assert(!validateNickname('Player=One'), 'Contains equals');
});

test('Invalid nicknames - emojis', () => {
  assert(!validateNickname('Player😀'), 'Contains emoji');
  assert(!validateNickname('🎮Player'), 'Starts with emoji');
  assert(!validateNickname('❤️'), 'Only emoji');
});

test('Invalid nicknames - banned words', () => {
  assert(!validateNickname('admin'), 'Banned word: admin');
  assert(!validateNickname('Admin'), 'Banned word: Admin (case insensitive)');
  assert(!validateNickname('ADMIN'), 'Banned word: ADMIN');
  assert(!validateNickname('TheAdmin'), 'Contains banned word: admin');
  assert(!validateNickname('moderator'), 'Banned word: moderator');
  assert(!validateNickname('support'), 'Banned word: support');
  assert(!validateNickname('official'), 'Banned word: official');
  assert(!validateNickname('bot'), 'Banned word: bot');
  assert(!validateNickname('system'), 'Banned word: system');
});

test('Invalid nicknames - multiple spaces', () => {
  assert(!validateNickname('Player  One'), 'Double space');
  assert(!validateNickname('Player   One'), 'Triple space');
  assert(!validateNickname('A  B'), 'Multiple spaces in short nickname');
});

test('Detailed validation - valid', () => {
  const result = validateNicknameDetailed('ValidPlayer');
  assert(result.valid === true, 'Valid nickname should pass');
  assert(result.error === undefined, 'Valid nickname should have no error');
});

test('Detailed validation - invalid', () => {
  let result;

  result = validateNicknameDetailed('A');
  assert(result.valid === false, 'Too short should fail');
  assert(result.error && result.error.includes('too_short'), 'Should return too_short error');

  result = validateNicknameDetailed('123456789012345678901');
  assert(result.valid === false, 'Too long should fail');
  assert(result.error && result.error.includes('too_long'), 'Should return too_long error');

  result = validateNicknameDetailed('Player@123');
  assert(result.valid === false, 'Invalid characters should fail');
  assert(result.error && result.error.includes('invalid_characters'), 'Should return invalid_characters error');

  result = validateNicknameDetailed('admin');
  assert(result.valid === false, 'Banned word should fail');
  assert(result.error && result.error.includes('banned_word'), 'Should return banned_word error');

  result = validateNicknameDetailed('Player  One');
  assert(result.valid === false, 'Multiple spaces should fail');
  assert(result.error && result.error.includes('multiple_spaces'), 'Should return multiple_spaces error');
});

test('Nickname normalization', () => {
  assertEquals(normalizeNickname('  Player  '), 'Player', 'Should trim spaces');
  assertEquals(normalizeNickname('Player  One'), 'Player One', 'Should collapse multiple spaces');
  assertEquals(normalizeNickname('  Player   One  '), 'Player One', 'Should trim and collapse');
  assertEquals(normalizeNickname('Player'), 'Player', 'Should leave valid nickname unchanged');
});

test('Validate and normalize', () => {
  assertEquals(validateAndNormalize('  Player  '), 'Player', 'Should normalize valid nickname');
  assertEquals(validateAndNormalize('Player  One'), 'Player One', 'Should normalize spaces');

  // Should throw for invalid nicknames
  let threw = false;
  try {
    validateAndNormalize('A');
  } catch (e) {
    threw = true;
    assert(e.message.includes('Invalid nickname'), 'Should throw with error message');
  }
  assert(threw, 'Should throw for invalid nickname');

  threw = false;
  try {
    validateAndNormalize('admin');
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Should throw for banned word');
});

test('Edge cases', () => {
  // Null and undefined
  let result = validateNicknameDetailed(null);
  assert(result.valid === false, 'null should fail');
  assert(result.error && result.error.includes('required'), 'null should return required error');

  result = validateNicknameDetailed(undefined);
  assert(result.valid === false, 'undefined should fail');
  assert(result.error && result.error.includes('required'), 'undefined should return required error');

  // Numbers
  assert(validateNickname('12'), 'Numbers only (min length)');
  assert(validateNickname('123456'), 'Numbers only');

  // Mixed scripts
  assert(validateNickname('PlayerИгрок'), 'Mixed Latin and Cyrillic');
  assert(validateNickname('ИгрокPlayer123'), 'Cyrillic, Latin, numbers');
});

test('Configuration values', () => {
  assertEquals(NICKNAME_CONFIG.minLength, 2, 'Min length should be 2');
  assertEquals(NICKNAME_CONFIG.maxLength, 20, 'Max length should be 20');
  assert(NICKNAME_CONFIG.allowedPattern instanceof RegExp, 'allowedPattern should be RegExp');
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
