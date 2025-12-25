/**
 * Генератор юмористических имён для слаймов.
 * Комбинации: прилагательное + существительное
 */

const ADJECTIVES = [
    // Забавные
    "Бодрый", "Липкий", "Прыгучий", "Мягкий", "Вязкий",
    "Шустрый", "Ленивый", "Хитрый", "Милый", "Злобный",
    // Описательные
    "Зелёный", "Синий", "Красный", "Жёлтый", "Розовый",
    "Большой", "Малый", "Круглый", "Пухлый", "Тощий",
    // Эмоциональные
    "Весёлый", "Грустный", "Дерзкий", "Скромный", "Гордый",
    "Храбрый", "Трусливый", "Сонный", "Дикий", "Сердитый",
    // Характеристики
    "Быстрый", "Медленный", "Тихий", "Громкий", "Юркий",
    "Ловкий", "Неуклюжий", "Голодный", "Сытый", "Жадный",
];

const NOUNS = [
    // Слаймовые
    "Слайм", "Сгусток", "Клякса", "Шарик", "Комок",
    "Желе", "Пузырь", "Капелька", "Лужица", "Кисель",
    // Животные
    "Кот", "Пёс", "Хомяк", "Кролик", "Ёжик",
    "Лис", "Волк", "Медведь", "Енот", "Барсук",
    // Еда
    "Пончик", "Кекс", "Пирожок", "Тортик", "Маффин",
    "Печенька", "Булочка", "Зефир", "Пудинг", "Мармелад",
    // Забавные
    "Бублик", "Носок", "Тапок", "Кактус", "Пельмень",
    "Борщ", "Компот", "Вареник", "Чебурек", "Блинчик",
];

/**
 * Генерирует случайное имя на основе seed.
 * Детерминированно: один seed — одно имя.
 */
export function generateName(seed: number): string {
    // Простой детерминированный генератор
    let hash = seed >>> 0;
    const nextRandom = () => {
        hash = (hash * 1103515245 + 12345) >>> 0;
        return hash;
    };

    const adjIndex = nextRandom() % ADJECTIVES.length;
    const nounIndex = nextRandom() % NOUNS.length;

    return `${ADJECTIVES[adjIndex]} ${NOUNS[nounIndex]}`;
}

/**
 * Генерирует уникальное имя, не совпадающее с существующими.
 * @param seed - начальное значение для генератора
 * @param existingNames - массив уже занятых имён
 * @param maxAttempts - максимум попыток (по умолчанию 100)
 * @returns уникальное имя или имя с номером если все заняты
 */
export function generateUniqueName(
    seed: number,
    existingNames: string[],
    maxAttempts: number = 100
): string {
    const existingSet = new Set(existingNames);
    let hash = seed >>> 0;
    
    const nextRandom = () => {
        hash = (hash * 1103515245 + 12345) >>> 0;
        return hash;
    };

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const adjIndex = nextRandom() % ADJECTIVES.length;
        const nounIndex = nextRandom() % NOUNS.length;
        const name = `${ADJECTIVES[adjIndex]} ${NOUNS[nounIndex]}`;
        
        if (!existingSet.has(name)) {
            return name;
        }
    }
    
    // Если все попытки исчерпаны, добавляем номер
    const baseName = generateName(seed);
    let suffix = 2;
    while (existingSet.has(`${baseName} ${suffix}`)) {
        suffix++;
    }
    return `${baseName} ${suffix}`;
}

/**
 * Генерирует случайное имя с использованием Math.random().
 * Для использования без seed.
 */
export function generateRandomName(): string {
    const adjIndex = Math.floor(Math.random() * ADJECTIVES.length);
    const nounIndex = Math.floor(Math.random() * NOUNS.length);
    return `${ADJECTIVES[adjIndex]} ${NOUNS[nounIndex]}`;
}

/**
 * Возвращает количество возможных комбинаций имён.
 */
export function getNameCombinationsCount(): number {
    return ADJECTIVES.length * NOUNS.length;
}
