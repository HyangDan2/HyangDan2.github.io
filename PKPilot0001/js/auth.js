/**
 * PKPilot0001 · HD2Lab | Photos
 * js/auth.js — HD2Lab 정회원 패스코드 인증 · 세션 관리
 *
 * 서버가 없는 정적 앱이므로 인증은 "이 브라우저에서의 정회원 모드"를 의미합니다.
 * 패스코드는 클라이언트 번들에 포함된 데모용 코드이며, 실제 개인정보 보호 장치가 아닙니다.
 * (README의 보안 범위 설명 참고)
 */

export const MEMBER_PASSCODE = 'HD2-2026';
export const MEMBER_ID = 'HD2-MEMBER-0001';
export const SESSION_KEY = 'pkpilot0001:session:v1';
export const ATTEMPT_KEY = 'pkpilot0001:attempts:v1';
export const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const LOCK_MS = 60 * 1000;

export const MEMBER_PROFILE = Object.freeze({
  id: MEMBER_ID,
  name: 'HD2',
  handle: '@HyangDan2',
  tier: 'HD2Lab 정회원',
  since: '2026-01-01',
  perks: [
    '사진 업로드 · 로컬 라이브러리 확장',
    'EXIF · 태그 편집',
    '필터 / 보정 엔진',
    '고해상도 원본 다운로드',
    '비밀 앨범 열람',
    '사진 삭제 및 복구',
  ],
});

export function normalizePasscode(value) {
  return String(value || '')
    .replace(/[\s\u200b]/g, '')
    .toUpperCase();
}

export function verifyPasscode(input, expected = MEMBER_PASSCODE) {
  return normalizePasscode(input) === normalizePasscode(expected);
}

export function isSessionValid(session, at = Date.now()) {
  if (!session || typeof session !== 'object') return false;
  if (typeof session.expiresAt !== 'number' || typeof session.issuedAt !== 'number') return false;
  return session.expiresAt > at && session.issuedAt <= at;
}

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function createAuth({
  storage = null,
  now = () => Date.now(),
  passcode = MEMBER_PASSCODE,
  ttlMs = DEFAULT_TTL_MS,
  maxAttempts = MAX_ATTEMPTS,
  lockMs = LOCK_MS,
} = {}) {
  let session = null;
  let attempts = { count: 0, lockedUntil: 0 };

  function readStorage(key) {
    if (!storage) return null;
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStorage(key, value) {
    if (!storage) return false;
    try {
      storage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function hydrate() {
    const stored = safeParse(readStorage(SESSION_KEY));
    if (stored && isSessionValid(stored, now())) {
      session = stored;
    } else if (stored) {
      // 만료된 세션은 정리합니다.
      if (storage) {
        try {
          storage.removeItem(SESSION_KEY);
        } catch {
          /* noop */
        }
      }
    }
    const storedAttempts = safeParse(readStorage(ATTEMPT_KEY));
    if (storedAttempts && typeof storedAttempts === 'object') {
      attempts = {
        count: Number(storedAttempts.count) || 0,
        lockedUntil: Number(storedAttempts.lockedUntil) || 0,
      };
    }
  }

  function persistAttempts() {
    writeStorage(ATTEMPT_KEY, JSON.stringify(attempts));
  }

  hydrate();

  function isMember() {
    return isSessionValid(session, now());
  }

  function currentSession() {
    if (!isMember()) return null;
    return { ...session };
  }

  function remainingMs() {
    const current = currentSession();
    return current ? Math.max(0, current.expiresAt - now()) : 0;
  }

  function lockRemainingMs() {
    return Math.max(0, attempts.lockedUntil - now());
  }

  function isLocked() {
    return lockRemainingMs() > 0;
  }

  function attemptsLeft() {
    if (isLocked()) return 0;
    return Math.max(0, maxAttempts - attempts.count);
  }

  function signIn(input, { remember = true } = {}) {
    if (isLocked()) {
      return {
        ok: false,
        reason: 'locked',
        retryAfterMs: lockRemainingMs(),
        attemptsLeft: 0,
      };
    }
    if (!verifyPasscode(input, passcode)) {
      attempts.count += 1;
      if (attempts.count >= maxAttempts) {
        attempts.lockedUntil = now() + lockMs;
        attempts.count = 0;
        persistAttempts();
        return { ok: false, reason: 'locked', retryAfterMs: lockMs, attemptsLeft: 0 };
      }
      persistAttempts();
      return { ok: false, reason: 'invalid', attemptsLeft: attemptsLeft(), retryAfterMs: 0 };
    }

    const issuedAt = now();
    const expiresAt = issuedAt + (remember ? ttlMs : Math.min(ttlMs, 60 * 60 * 1000));
    session = {
      memberId: MEMBER_PROFILE.id,
      name: MEMBER_PROFILE.name,
      tier: MEMBER_PROFILE.tier,
      issuedAt,
      expiresAt,
      remember: Boolean(remember),
    };
    attempts = { count: 0, lockedUntil: 0 };
    persistAttempts();
    if (remember) {
      writeStorage(SESSION_KEY, JSON.stringify(session));
    }
    return { ok: true, reason: 'granted', session: { ...session }, attemptsLeft: maxAttempts };
  }

  function signOut() {
    session = null;
    if (storage) {
      try {
        storage.removeItem(SESSION_KEY);
      } catch {
        /* noop */
      }
    }
  }

  return {
    isMember,
    session: currentSession,
    signIn,
    signOut,
    remainingMs,
    isLocked,
    lockRemainingMs,
    attemptsLeft,
    maxAttempts,
    passcodeHint: passcode,
  };
}
