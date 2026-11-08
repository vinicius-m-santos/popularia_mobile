/**
 * Estatística descritiva sem dependências para o coletor do POP-72.
 * As funções ignoram valores não finitos e nunca inventam uma amostra.
 */

export function round(value, decimals = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function finiteNumbers(values) {
  return (Array.isArray(values) ? values : []).filter((value) => Number.isFinite(value)).map(Number);
}

export function median(values) {
  const numbers = finiteNumbers(values).sort((a, b) => a - b);
  if (numbers.length === 0) return null;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 === 0 ? (numbers[middle - 1] + numbers[middle]) / 2 : numbers[middle];
}

/** Quantil por interpolação linear (mesmo critério para p50/p90/p95/p99). */
export function quantile(values, q) {
  const numbers = finiteNumbers(values).sort((a, b) => a - b);
  if (numbers.length === 0) return null;
  const clamped = Math.min(1, Math.max(0, q));
  const position = (numbers.length - 1) * clamped;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return numbers[lower];
  return numbers[lower] + (numbers[upper] - numbers[lower]) * (position - lower);
}

export function mean(values) {
  const numbers = finiteNumbers(values);
  if (numbers.length === 0) return null;
  return numbers.reduce((total, value) => total + value, 0) / numbers.length;
}

export function stdev(values) {
  const numbers = finiteNumbers(values);
  if (numbers.length < 2) return null;
  const average = mean(numbers);
  const variance = numbers.reduce((total, value) => total + (value - average) ** 2, 0) / (numbers.length - 1);
  return Math.sqrt(variance);
}

/** Desvio absoluto mediano; base robusta para calibrar thresholds com ruído. */
export function mad(values) {
  const middle = median(values);
  if (middle === null) return null;
  return median(finiteNumbers(values).map((value) => Math.abs(value - middle)));
}

export function summarize(values, decimals = 2) {
  const numbers = finiteNumbers(values);
  if (numbers.length === 0) {
    return { samples: 0, min: null, median: null, mean: null, p95: null, p99: null, max: null, stdev: null, mad: null };
  }
  return {
    samples: numbers.length,
    min: round(Math.min(...numbers), decimals),
    median: round(median(numbers), decimals),
    mean: round(mean(numbers), decimals),
    p95: round(quantile(numbers, 0.95), decimals),
    p99: round(quantile(numbers, 0.99), decimals),
    max: round(Math.max(...numbers), decimals),
    stdev: round(stdev(numbers), decimals),
    mad: round(mad(numbers), decimals),
  };
}

export function pickMetricValues(runs, path) {
  return finiteNumbers(runs.map((run) => readPath(run, path)));
}

export function readPath(object, path) {
  return path.split('.').reduce((current, key) => (current && typeof current === 'object' ? current[key] : undefined), object);
}

export function writePath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!current[key] || typeof current[key] !== 'object') current[key] = {};
    return current[key];
  }, object);
  target[last] = value;
  return object;
}
