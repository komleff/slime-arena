/**
 * SystemMetrics — сбор метрик CPU/RAM/Uptime
 *
 * Источники данных (в порядке приоритета):
 * 1. Docker cgroup v2: /sys/fs/cgroup/cpu.stat, /sys/fs/cgroup/memory.current
 * 2. Docker cgroup v1: /sys/fs/cgroup/cpu/cpuacct.usage, /sys/fs/cgroup/memory/memory.usage_in_bytes
 * 3. Linux /proc: /proc/stat, /proc/meminfo
 * 4. Fallback: os.cpus(), os.totalmem(), os.freemem()
 *
 * Требования: REQ-MON-009 (ТЗ TZ-MON-v1.6)
 */

import * as os from 'os';
import * as fs from 'fs';

// ============================================================================
// Типы
// ============================================================================

export interface RamUsage {
  used: number; // МБ
  total: number; // МБ
  percent: number; // 0-100
}

export interface SystemMetrics {
  cpu: number; // 0-100%
  memory: RamUsage;
  uptime: number; // секунды
}

// ============================================================================
// Внутренние переменные для расчёта CPU
// ============================================================================

// Для расчёта CPU нужны два замера с интервалом
let lastCpuTime = 0;
let lastCpuTotal = 0;
let lastCpuMeasureTime = 0;
let cachedCpuPercent = 0;

// Время запуска процесса
const processStartTime = Date.now();

// ============================================================================
// Вспомогательные функции
// ============================================================================

/**
 * Безопасное чтение файла
 */
function readFileSync(path: string): string | null {
  try {
    return fs.readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

// ============================================================================
// CPU метрики
// ============================================================================

/**
 * Получить CPU usage из cgroup v2
 * /sys/fs/cgroup/cpu.stat содержит usage_usec
 */
function getCpuFromCgroupV2(): number | null {
  const statContent = readFileSync('/sys/fs/cgroup/cpu.stat');
  if (!statContent) return null;

  // Формат: usage_usec 123456789
  const match = statContent.match(/usage_usec\s+(\d+)/);
  if (!match) return null;

  return parseInt(match[1], 10); // микросекунды
}

/**
 * Получить CPU usage из cgroup v1
 * /sys/fs/cgroup/cpu/cpuacct.usage или /sys/fs/cgroup/cpuacct/cpuacct.usage
 */
function getCpuFromCgroupV1(): number | null {
  const paths = [
    '/sys/fs/cgroup/cpu/cpuacct.usage',
    '/sys/fs/cgroup/cpuacct/cpuacct.usage',
    '/sys/fs/cgroup/cpu,cpuacct/cpuacct.usage',
  ];

  for (const path of paths) {
    const content = readFileSync(path);
    if (content) {
      const value = parseInt(content.trim(), 10);
      if (!isNaN(value)) {
        return value / 1000; // наносекунды → микросекунды
      }
    }
  }

  return null;
}

/**
 * Получить CPU usage из /proc/stat (суммарно по всем ядрам)
 * Возвращает { user, system, idle, total } в jiffies
 */
function getCpuFromProcStat(): { active: number; total: number } | null {
  const content = readFileSync('/proc/stat');
  if (!content) return null;

  // Первая строка: cpu user nice system idle iowait irq softirq steal guest guest_nice
  const firstLine = content.split('\n')[0];
  const match = firstLine.match(
    /^cpu\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/
  );
  if (!match) return null;

  const user = parseInt(match[1], 10);
  const nice = parseInt(match[2], 10);
  const system = parseInt(match[3], 10);
  const idle = parseInt(match[4], 10);
  const iowait = parseInt(match[5], 10);
  const irq = parseInt(match[6], 10);
  const softirq = parseInt(match[7], 10);
  const steal = parseInt(match[8], 10);

  const active = user + nice + system + irq + softirq + steal;
  const total = active + idle + iowait;

  return { active, total };
}

/**
 * Получить CPU % через os.cpus() (fallback)
 * Возвращает среднюю загрузку по всем ядрам
 */
function getCpuFromOsCpus(): number {
  const cpus = os.cpus();
  if (cpus.length === 0) return 0;

  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    const times = cpu.times;
    totalIdle += times.idle;
    totalTick += times.user + times.nice + times.sys + times.idle + times.irq;
  }

  if (totalTick === 0) return 0;

  // Это моментальный снимок, не дельта — показываем "среднюю" загрузку с момента старта
  // Для более точных данных нужны два замера
  return Math.round(((totalTick - totalIdle) / totalTick) * 100);
}

/**
 * Получить текущую загрузку CPU (0-100%)
 *
 * Использует дельту между двумя замерами для точного расчёта.
 * При первом вызове или если прошло мало времени — возвращает кешированное значение.
 */
export function getCpuUsage(): number {
  const now = Date.now();
  const timeDelta = now - lastCpuMeasureTime;

  // Минимальный интервал между замерами — 500мс
  // Если меньше — возвращаем кешированное значение
  if (timeDelta < 500 && lastCpuMeasureTime > 0) {
    return cachedCpuPercent;
  }

  // Пробуем cgroup v2
  let currentCpuTime = getCpuFromCgroupV2();

  // Пробуем cgroup v1
  if (currentCpuTime === null) {
    currentCpuTime = getCpuFromCgroupV1();
  }

  // Если cgroup доступен — считаем процент от реального времени
  if (currentCpuTime !== null) {
    if (lastCpuMeasureTime > 0 && timeDelta > 0) {
      const cpuTimeDelta = currentCpuTime - lastCpuTime; // микросекунды
      const realTimeDelta = timeDelta * 1000; // мс → микросекунды
      const numCpus = os.cpus().length || 1;

      // CPU% = (cpuTimeDelta / realTimeDelta) * 100 / numCpus
      // Делим на numCpus т.к. контейнер может использовать все ядра
      cachedCpuPercent = Math.min(100, Math.round((cpuTimeDelta / realTimeDelta) * 100 / numCpus));
    }

    lastCpuTime = currentCpuTime;
    lastCpuMeasureTime = now;
    return cachedCpuPercent;
  }

  // Пробуем /proc/stat
  const procStat = getCpuFromProcStat();

  if (procStat !== null) {
    if (lastCpuMeasureTime > 0 && lastCpuTotal > 0) {
      const activeDelta = procStat.active - lastCpuTime;
      const totalDelta = procStat.total - lastCpuTotal;

      if (totalDelta > 0) {
        cachedCpuPercent = Math.min(100, Math.round((activeDelta / totalDelta) * 100));
      }
    }

    lastCpuTime = procStat.active;
    lastCpuTotal = procStat.total;
    lastCpuMeasureTime = now;
    return cachedCpuPercent;
  }

  // Fallback на os.cpus()
  cachedCpuPercent = getCpuFromOsCpus();
  lastCpuMeasureTime = now;
  return cachedCpuPercent;
}

// ============================================================================
// RAM метрики
// ============================================================================

/**
 * Получить лимит памяти из cgroup v2
 */
function getMemoryLimitCgroupV2(): number | null {
  const content = readFileSync('/sys/fs/cgroup/memory.max');
  if (!content) return null;

  const trimmed = content.trim();
  // "max" означает без лимита
  if (trimmed === 'max') return null;

  const value = parseInt(trimmed, 10);
  return isNaN(value) ? null : value;
}

/**
 * Получить текущее использование памяти из cgroup v2
 */
function getMemoryUsageCgroupV2(): number | null {
  const content = readFileSync('/sys/fs/cgroup/memory.current');
  if (!content) return null;

  const value = parseInt(content.trim(), 10);
  return isNaN(value) ? null : value;
}

/**
 * Получить лимит памяти из cgroup v1
 */
function getMemoryLimitCgroupV1(): number | null {
  const paths = [
    '/sys/fs/cgroup/memory/memory.limit_in_bytes',
    '/sys/fs/cgroup/memory.limit_in_bytes',
  ];

  for (const path of paths) {
    const content = readFileSync(path);
    if (content) {
      const value = parseInt(content.trim(), 10);
      // Очень большое значение (>= 2^62) означает "без лимита"
      if (!isNaN(value) && value < 2 ** 62) {
        return value;
      }
    }
  }

  return null;
}

/**
 * Получить текущее использование памяти из cgroup v1
 */
function getMemoryUsageCgroupV1(): number | null {
  const paths = [
    '/sys/fs/cgroup/memory/memory.usage_in_bytes',
    '/sys/fs/cgroup/memory.usage_in_bytes',
  ];

  for (const path of paths) {
    const content = readFileSync(path);
    if (content) {
      const value = parseInt(content.trim(), 10);
      if (!isNaN(value)) {
        return value;
      }
    }
  }

  return null;
}

/**
 * Получить RAM из /proc/meminfo
 */
function getMemoryFromProcMeminfo(): { used: number; total: number } | null {
  const content = readFileSync('/proc/meminfo');
  if (!content) return null;

  const lines = content.split('\n');
  let total = 0;
  let free = 0;
  let buffers = 0;
  let cached = 0;

  for (const line of lines) {
    const match = line.match(/^(\w+):\s+(\d+)\s+kB/);
    if (match) {
      const key = match[1];
      const value = parseInt(match[2], 10) * 1024; // kB → bytes

      switch (key) {
        case 'MemTotal':
          total = value;
          break;
        case 'MemFree':
          free = value;
          break;
        case 'Buffers':
          buffers = value;
          break;
        case 'Cached':
          cached = value;
          break;
      }
    }
  }

  if (total === 0) return null;

  // used = total - free - buffers - cached (реально используемая память)
  const used = total - free - buffers - cached;
  return { used: Math.max(0, used), total };
}

/**
 * Получить использование RAM
 */
export function getRamUsage(): RamUsage {
  const bytesToMB = (bytes: number) => Math.round(bytes / (1024 * 1024));

  // Пробуем cgroup v2
  let used = getMemoryUsageCgroupV2();
  let total = getMemoryLimitCgroupV2();

  if (used !== null && total !== null) {
    const usedMB = bytesToMB(used);
    const totalMB = bytesToMB(total);
    return {
      used: usedMB,
      total: totalMB,
      percent: totalMB > 0 ? Math.round((usedMB / totalMB) * 100) : 0,
    };
  }

  // Пробуем cgroup v1
  used = getMemoryUsageCgroupV1();
  total = getMemoryLimitCgroupV1();

  if (used !== null && total !== null) {
    const usedMB = bytesToMB(used);
    const totalMB = bytesToMB(total);
    return {
      used: usedMB,
      total: totalMB,
      percent: totalMB > 0 ? Math.round((usedMB / totalMB) * 100) : 0,
    };
  }

  // Пробуем /proc/meminfo
  const procMem = getMemoryFromProcMeminfo();
  if (procMem !== null) {
    const usedMB = bytesToMB(procMem.used);
    const totalMB = bytesToMB(procMem.total);
    return {
      used: usedMB,
      total: totalMB,
      percent: totalMB > 0 ? Math.round((usedMB / totalMB) * 100) : 0,
    };
  }

  // Fallback на os модуль
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;

  const usedMB = bytesToMB(usedBytes);
  const totalMB = bytesToMB(totalBytes);

  return {
    used: usedMB,
    total: totalMB,
    percent: totalMB > 0 ? Math.round((usedMB / totalMB) * 100) : 0,
  };
}

// ============================================================================
// Uptime
// ============================================================================

/**
 * Получить uptime процесса в секундах
 */
export function getUptime(): number {
  return Math.floor((Date.now() - processStartTime) / 1000);
}

// ============================================================================
// Агрегированный метод
// ============================================================================

/**
 * Получить все системные метрики
 */
export function getSystemMetrics(): SystemMetrics {
  return {
    cpu: getCpuUsage(),
    memory: getRamUsage(),
    uptime: getUptime(),
  };
}
