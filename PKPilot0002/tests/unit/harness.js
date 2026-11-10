// 아주 작은 테스트 하네스 — 프레임워크 없이 브라우저에서 바로 돈다.
const registry = [];

export function test(name, fn) {
  registry.push({ name, fn });
}

export function assert(condition, message = '조건이 참이어야 합니다') {
  if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message} 기대값 ${JSON.stringify(expected)}, 실제값 ${JSON.stringify(actual)}`.trim());
  }
}

export function assertClose(actual, expected, tolerance, message = '') {
  if (typeof actual !== 'number' || Number.isNaN(actual)) {
    throw new Error(`${message} 값이 숫자가 아닙니다: ${actual}`.trim());
  }
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(
      `${message} 기대값 ${expected} ± ${tolerance}, 실제값 ${actual}`.trim(),
    );
  }
}

export function assertFinitePoint(point, message = '') {
  assert(point && typeof point === 'object', `${message} 좌표 객체가 없습니다`.trim());
  assert(Number.isFinite(point.lat), `${message} 위도가 유한수가 아닙니다: ${point.lat}`.trim());
  assert(Number.isFinite(point.lng), `${message} 경도가 유한수가 아닙니다: ${point.lng}`.trim());
  assert(point.lat >= -90 && point.lat <= 90, `${message} 위도 범위를 벗어났습니다`.trim());
  assert(point.lng >= -180 && point.lng <= 180, `${message} 경도 범위를 벗어났습니다`.trim());
}

export async function runAll() {
  const results = [];
  for (const item of registry) {
    const started = performance.now();
    try {
      await item.fn();
      results.push({ name: item.name, ok: true, ms: performance.now() - started });
    } catch (error) {
      results.push({
        name: item.name,
        ok: false,
        ms: performance.now() - started,
        error: String((error && error.message) || error),
      });
    }
  }
  return results;
}

export function count() {
  return registry.length;
}
