/**
 * PKPilot0001 · HD2Lab | Photos — 단위 테스트
 * 실행: node --test PKPilot0001/tests/unit/*.test.js
 *
 * 외부 의존성 없이 Node.js 내장 테스트 러너와 메모리 저장소만 사용합니다.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALBUMS,
  DEFAULT_FILTER,
  FILTER_PRESETS,
  PHOTOS,
  SEARCH_SCOPES,
  getFilterPreset,
  photoArtwork,
  photoSearchIndex,
} from '../../js/mockData.js';
import {
  STORAGE_KEY,
  StorageError,
  createMemoryStorage,
  createStore,
  formatBytes,
  formatKoreanDate,
  formatKoreanTime,
  formatStamp,
  groupPhotos,
  localParts,
  searchPhotos,
  toLocalIso,
  weekdayOf,
} from '../../js/store.js';
import {
  ATTEMPT_KEY,
  LOCK_MS,
  MEMBER_PASSCODE,
  SESSION_KEY,
  createAuth,
  isSessionValid,
  normalizePasscode,
  verifyPasscode,
} from '../../js/auth.js';

/* ------------------------------------------------------------------ *
 * 1. 목업 데이터 무결성
 * ------------------------------------------------------------------ */
test('mockData: 사진이 12장 이상이고 id가 유일하다', () => {
  assert.ok(PHOTOS.length >= 12, `사진은 12장 이상이어야 합니다 (현재 ${PHOTOS.length}장)`);
  const ids = new Set(PHOTOS.map((photo) => photo.id));
  assert.equal(ids.size, PHOTOS.length);
});

test('mockData: 모든 사진이 EXIF · 위치 · 태그 필수 필드를 갖춘다', () => {
  const required = [
    'id',
    'title',
    'fileName',
    'takenAt',
    'place',
    'camera',
    'lens',
    'focal',
    'aperture',
    'shutter',
    'iso',
    'tags',
    'albums',
    'src',
    'thumb',
    'art',
  ];
  PHOTOS.forEach((photo) => {
    required.forEach((field) => {
      assert.ok(photo[field] !== undefined && photo[field] !== null, `${photo.id} 필드 누락: ${field}`);
    });
    assert.ok(Array.isArray(photo.tags) && photo.tags.length > 0, `${photo.id} 태그 없음`);
    assert.ok(Array.isArray(photo.albums) && photo.albums.length > 0, `${photo.id} 앨범 없음`);
    assert.match(photo.aperture, /^f\//);
    assert.match(photo.shutter, /s$/);
    assert.ok(Number.isFinite(Number(photo.iso)), `${photo.id} ISO`);
  });
});

test('mockData: takenAt은 올바른 ISO 8601 타임스탬프다', () => {
  PHOTOS.forEach((photo) => {
    assert.match(photo.takenAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/, photo.id);
    assert.ok(!Number.isNaN(new Date(photo.takenAt).getTime()), `${photo.id} 날짜 파싱 실패`);
    const parts = localParts(photo.takenAt);
    assert.ok(parts.year >= 2000 && parts.year <= 2100);
    assert.ok(parts.month >= 1 && parts.month <= 12);
    assert.ok(parts.day >= 1 && parts.day <= 31);
  });
});

test('mockData: 위도/경도가 유효 범위에 있고 지역 메타데이터가 있다', () => {
  PHOTOS.forEach((photo) => {
    assert.ok(photo.lat >= -90 && photo.lat <= 90, `${photo.id} 위도`);
    assert.ok(photo.lng >= -180 && photo.lng <= 180, `${photo.id} 경도`);
    assert.ok(photo.region.length > 0);
    assert.ok(photo.place.includes('·'), `${photo.id} 장소 표기`);
  });
});

test('mockData: 사용자 생활권(창원·마산·부산·성수·도쿄) 사진이 포함된다', () => {
  const places = PHOTOS.map((photo) => photo.place).join(' ');
  ['창원', '마산', '부산', '성수', '도쿄'].forEach((keyword) => {
    assert.ok(places.includes(keyword), `장소 누락: ${keyword}`);
  });
});

test('mockData: 모든 사진의 앨범 참조가 실제 앨범 id와 일치한다', () => {
  const albumIds = new Set(ALBUMS.map((album) => album.id));
  PHOTOS.forEach((photo) => {
    photo.albums.forEach((albumId) => {
      assert.ok(albumIds.has(albumId), `${photo.id} 알 수 없는 앨범: ${albumId}`);
    });
  });
});

test('mockData: 비밀 앨범 사진이 존재하고 secret 플래그가 설정되어 있다', () => {
  const secret = PHOTOS.filter((photo) => photo.albums.includes('secret'));
  assert.ok(secret.length >= 1);
  secret.forEach((photo) => {
    assert.equal(photo.secret, true);
  });
});

test('mockData: SVG 아트워크 폴백이 결정론적으로 생성된다', () => {
  PHOTOS.forEach((photo) => {
    const first = photoArtwork(photo);
    const second = photoArtwork(photo);
    assert.ok(first.startsWith('data:image/svg+xml'), `${photo.id} 아트워크 형식`);
    assert.equal(first, second, `${photo.id} 아트워크는 결정론적이어야 함`);
    const decoded = decodeURIComponent(first.split(',')[1]);
    assert.ok(decoded.startsWith('<svg'), `${photo.id} SVG 본문`);
    assert.ok(decoded.includes('</svg>'));
  });
});

test('mockData: 필터 프리셋이 유효하고 기본값이 포함된다', () => {
  assert.ok(FILTER_PRESETS.length >= 5);
  const ids = FILTER_PRESETS.map((preset) => preset.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes(DEFAULT_FILTER));
  FILTER_PRESETS.forEach((preset) => {
    assert.ok(preset.label.length > 0);
    assert.ok(typeof preset.css === 'string' && preset.css.length > 0);
  });
  assert.equal(getFilterPreset('없는프리셋').id, DEFAULT_FILTER);
});

test('mockData: 앨범 정의와 검색 범위가 유효하다', () => {
  const ids = ALBUMS.map((album) => album.id);
  assert.equal(new Set(ids).size, ids.length);
  ALBUMS.forEach((album) => {
    assert.ok(['smart', 'recent', 'category', 'secret'].includes(album.kind), album.id);
    assert.ok(album.title.length > 0);
  });
  assert.ok(SEARCH_SCOPES.some((scope) => scope.id === 'all'));
});

test('mockData: 검색 인덱스가 제목·장소·태그·카메라를 포함한다', () => {
  const index = photoSearchIndex(PHOTOS[0]);
  assert.ok(index.includes(PHOTOS[0].title.toLowerCase()));
  assert.ok(index.includes(PHOTOS[0].tags[0].toLowerCase()));
});

/* ------------------------------------------------------------------ *
 * 2. 날짜 · 그룹핑 · 검색 유틸
 * ------------------------------------------------------------------ */
test('format: 한국어 날짜 · 시간 표기', () => {
  assert.equal(formatKoreanDate('2026-10-25T06:12:18+09:00'), '2026년 10월 25일 (일)');
  assert.equal(weekdayOf('2026-10-25T06:12:18+09:00'), '일');
  assert.equal(formatKoreanTime('2026-10-25T06:12:18+09:00'), '오전 6:12');
  assert.equal(formatKoreanTime('2026-10-25T18:05:00+09:00'), '오후 6:05');
  assert.equal(formatKoreanTime('2026-10-25T12:00:00+09:00'), '오후 12:00');
  assert.equal(formatKoreanTime('2026-10-25T00:07:00+09:00'), '오전 12:07');
  assert.ok(formatStamp('2026-10-25T06:12:18+09:00').includes('2026년 10월 25일'));
  assert.equal(formatKoreanDate('잘못된 값'), '날짜 미상');
});

test('format: toLocalIso · formatBytes', () => {
  const iso = toLocalIso(new Date(2026, 10, 10, 9, 5, 3));
  assert.match(iso, /^2026-11-10T09:05:03[+-]\d{2}:\d{2}$/);
  assert.equal(formatBytes(0), '0 KB');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
});

test('groupPhotos: 연/월/일/모든 사진 그룹의 합이 전체와 같다', () => {
  const photos = PHOTOS.map((photo) => ({ ...photo }));
  ['year', 'month', 'day'].forEach((mode) => {
    const groups = groupPhotos(photos, mode);
    const total = groups.reduce((sum, group) => sum + group.photos.length, 0);
    assert.equal(total, photos.length, `${mode} 그룹 합계`);
    groups.forEach((group) => assert.ok(group.label.length > 0));
  });
  const all = groupPhotos(photos, 'all');
  assert.equal(all.length, 1);
  assert.equal(all[0].photos.length, photos.length);
  assert.equal(all[0].label, '');
});

test('groupPhotos: 최신순 정렬 입력에서 월 그룹이 최신순으로 유지된다', () => {
  const photos = [...PHOTOS]
    .map((photo) => ({ ...photo }))
    .sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt));
  const groups = groupPhotos(photos, 'month');
  const months = groups.map((group) => group.key.split('-').map(Number));
  for (let index = 1; index < months.length; index += 1) {
    const previous = months[index - 1];
    const current = months[index];
    assert.ok(
      previous[0] > current[0] || (previous[0] === current[0] && previous[1] > current[1]),
      `${previous.join('-')} 다음에 ${current.join('-')} 그룹이 왔습니다`,
    );
  }
});

test('searchPhotos: 장소 · 태그 · 카메라 · 날짜 검색', () => {
  const photos = PHOTOS.filter((photo) => !photo.secret).map((photo) => ({ ...photo }));
  assert.ok(searchPhotos(photos, '부산').length >= 2);
  assert.ok(searchPhotos(photos, '여행').length >= 5);
  assert.ok(searchPhotos(photos, 'iPhone 16 Pro').length >= 5);
  assert.ok(searchPhotos(photos, '2026년 4월').length >= 3);
  assert.equal(searchPhotos(photos, '').length, photos.length);
  assert.equal(searchPhotos(photos, '존재하지않는검색어').length, 0);
});

test('searchPhotos: 범위(scope) 필터가 동작한다', () => {
  const photos = PHOTOS.filter((photo) => !photo.secret).map((photo) => ({ ...photo }));
  const titleOnly = searchPhotos(photos, '해운대', { scope: 'tag' });
  assert.equal(titleOnly.length, 0, '태그 범위에서는 해운대가 없다');
  const placeHit = searchPhotos(photos, '해운대', { scope: 'place' });
  assert.ok(placeHit.length >= 1);
  const cameraHit = searchPhotos(photos, 'Sony', { scope: 'camera' });
  assert.ok(cameraHit.length >= 3);
  const dateHit = searchPhotos(photos, '2026 4', { scope: 'date' });
  assert.ok(dateHit.length >= 1);
});

/* ------------------------------------------------------------------ *
 * 3. 스토어 — 즐겨찾기 · 필터 · 삭제 · 업로드 · 영속화
 * ------------------------------------------------------------------ */
function makeStore(options = {}) {
  return createStore({ storage: createMemoryStorage(), now: () => 1_800_000_000_000, ...options });
}

test('store: 시드 사진을 최신순으로 반환한다', () => {
  const store = makeStore();
  const photos = [...store.photos()];
  assert.equal(photos.length, PHOTOS.filter((photo) => !photo.secret).length);
  for (let index = 1; index < photos.length; index += 1) {
    assert.ok(new Date(photos[index - 1].takenAt) >= new Date(photos[index].takenAt));
  }
});

test('store: 게스트는 비밀 사진을 볼 수 없고 정회원은 볼 수 있다', () => {
  const store = makeStore();
  const guestIds = store.photos({ member: false }).map((photo) => photo.id);
  const memberIds = store.photos({ member: true }).map((photo) => photo.id);
  const secretIds = PHOTOS.filter((photo) => photo.secret).map((photo) => photo.id);
  secretIds.forEach((id) => {
    assert.ok(!guestIds.includes(id), `게스트에게 노출됨: ${id}`);
    assert.ok(memberIds.includes(id), `정회원에게 숨겨짐: ${id}`);
    assert.equal(store.getPhoto(id, { member: false }), null);
    assert.ok(store.getPhoto(id, { member: true }));
  });
});

test('store: 즐겨찾기 토글이 저장되고 새 인스턴스에서 복원된다', () => {
  const storage = createMemoryStorage();
  const store = createStore({ storage, now: () => 1 });
  const target = PHOTOS.find((photo) => !photo.favorite && !photo.secret);
  assert.equal(store.toggleFavorite(target.id), true);
  assert.ok(store.photos().find((photo) => photo.id === target.id).favorite);

  const reloaded = createStore({ storage, now: () => 2 });
  assert.ok(reloaded.photos().find((photo) => photo.id === target.id).favorite);

  assert.equal(reloaded.toggleFavorite(target.id), false);
  const again = createStore({ storage, now: () => 3 });
  assert.equal(again.photos().find((photo) => photo.id === target.id).favorite, false);
});

test('store: 즐겨찾기 앨범이 실제 즐겨찾기 목록과 일치한다', () => {
  const store = makeStore();
  const favorites = store.albumPhotos('favorites');
  assert.equal(favorites.length, store.photos().filter((photo) => photo.favorite).length);
  favorites.forEach((photo) => assert.equal(photo.favorite, true));
});

test('store: 필터 적용 · 해제가 영속화되고 잘못된 프리셋은 거부된다', () => {
  const storage = createMemoryStorage();
  const store = createStore({ storage, now: () => 1 });
  const id = PHOTOS[0].id;
  assert.equal(store.setFilter(id, 'mono'), true);
  assert.equal(store.getPhoto(id).filter, 'mono');
  assert.equal(createStore({ storage }).getPhoto(id).filter, 'mono');

  assert.equal(store.setFilter(id, 'not-a-preset'), false);
  assert.equal(store.getPhoto(id).filter, 'mono');

  assert.equal(store.setFilter(id, 'none'), true);
  assert.equal(store.getPhoto(id).filter, 'none');
  assert.equal(store.stats().filtered, 0);
});

test('store: 시드 사진 삭제 후 복구할 수 있다', () => {
  const storage = createMemoryStorage();
  const store = createStore({ storage, now: () => 1 });
  const target = store.photos()[0];
  const snapshot = store.deletePhoto(target.id);
  assert.ok(snapshot);
  assert.equal(snapshot.kind, 'seed');
  assert.equal(store.getPhoto(target.id), null);
  assert.ok(createStore({ storage }).getPhoto(target.id) === null);

  assert.equal(store.restorePhoto(snapshot), true);
  assert.ok(store.getPhoto(target.id));
  assert.ok(createStore({ storage }).getPhoto(target.id));
});

test('store: 업로드 추가 · 삭제 · 한도 초과', () => {
  const store = makeStore({ maxUploads: 2 });
  const record = {
    id: 'up-test-1',
    title: '테스트 업로드',
    src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
    thumb: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
    width: 100,
    height: 100,
    takenAt: '2026-11-10T00:00:00+09:00',
  };
  const added = store.addUpload(record);
  assert.equal(added.id, 'up-test-1');
  assert.ok(store.getPhoto('up-test-1'));
  assert.equal(store.getPhoto('up-test-1').takenAt, '2026-11-10T00:00:00+09:00');

  assert.throws(() => store.addUpload({ ...record, id: 'up-bad', src: 'https://example.com/a.jpg' }), /INVALID_UPLOAD|Invalid/);

  store.addUpload({ ...record, id: 'up-test-2' });
  assert.throws(() => store.addUpload({ ...record, id: 'up-test-3' }), (error) => error.code === 'UPLOAD_LIMIT');

  const snapshot = store.deletePhoto('up-test-1');
  assert.equal(snapshot.kind, 'upload');
  assert.equal(store.getPhoto('up-test-1'), null);
  assert.equal(store.restorePhoto(snapshot), true);
  assert.ok(store.getPhoto('up-test-1'));
});

test('store: 저장 실패 시 업로드가 롤백되고 StorageError를 던진다', () => {
  const failing = {
    getItem: () => null,
    setItem() {
      throw new Error('QuotaExceededError');
    },
    removeItem() {},
  };
  const store = createStore({ storage: failing, now: () => 1 });
  assert.throws(
    () =>
      store.addUpload({
        id: 'up-quota',
        src: 'data:image/png;base64,AAAA',
        thumb: 'data:image/png;base64,AAAA',
      }),
    (error) => error instanceof StorageError && error.code === 'STORAGE_WRITE_FAILED',
  );
  assert.equal(store.getPhoto('up-quota'), null);
});

test('store: 손상된 스토리지와 버전 불일치를 안전하게 무시한다', () => {
  const broken = createMemoryStorage({ [STORAGE_KEY]: '{broken json' });
  const store = createStore({ storage: broken });
  assert.equal(store.photos().length, PHOTOS.filter((photo) => !photo.secret).length);

  const oldVersion = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 99, favorites: [] }) });
  const second = createStore({ storage: oldVersion });
  assert.ok(second.photos().some((photo) => photo.favorite), '기본 즐겨찾기가 유지되어야 함');
});

test('store: 앨범 · 통계 집계가 일관된다', () => {
  const store = makeStore();
  const photos = store.photos();
  const counts = store.albumCounts();
  assert.equal(counts.favorites, photos.filter((photo) => photo.favorite).length);
  assert.ok(counts.travel >= 5);
  assert.ok(counts.landscape >= 5);
  assert.ok(counts.people >= 3);
  assert.equal(counts.secret, 0, '게스트에게 비밀 앨범 수는 0');
  assert.ok(store.albumCounts({ member: true }).secret >= 1);

  const stats = store.stats();
  assert.equal(stats.total, photos.length);
  assert.equal(stats.uploads, 0);
  assert.ok(stats.places >= 5);
  assert.ok(stats.storageBytes > 0);
});

test('store: 최근 항목 앨범은 최신 사진 기준 30일 이내만 담는다', () => {
  const store = makeStore();
  const recent = store.albumPhotos('recent');
  assert.ok(recent.length >= 1);
  const newest = Math.max(...store.photos().map((photo) => new Date(photo.takenAt).getTime()));
  recent.forEach((photo) => {
    assert.ok(new Date(photo.takenAt).getTime() >= newest - 30 * 24 * 60 * 60 * 1000);
    assert.ok(!photo.secret, `${photo.id} 비밀 사진이 최근 항목에 포함됨`);
  });
});

test('store: 검색이 비밀 사진을 게스트에게 노출하지 않는다', () => {
  const store = makeStore();
  const guest = store.search('가족', { member: false });
  assert.ok(guest.every((photo) => !photo.secret));
  const member = store.search('가족', { member: true });
  assert.ok(member.some((photo) => photo.secret));
});

test('store: 메타데이터 편집이 저장 · 검색 · 앨범에 반영된다', () => {
  const storage = createMemoryStorage();
  const store = createStore({ storage, now: () => 1 });
  const target = PHOTOS.find((photo) => !photo.secret);
  assert.equal(
    store.updatePhotoDetails(target.id, {
      title: '  새 제목  ',
      caption: '설명 수정',
      place: '부산 · 광안리',
      tags: ['#새태그', '여행', '여행'],
      albums: ['travel', 'favorites', '없는앨범'],
    }),
    true,
  );
  const photo = store.getPhoto(target.id);
  assert.equal(photo.title, '새 제목');
  assert.equal(photo.caption, '설명 수정');
  assert.equal(photo.place, '부산 · 광안리');
  assert.deepEqual(photo.tags, ['새태그', '여행']);
  assert.deepEqual(photo.albums, ['travel'], '스마트 앨범은 편집 대상이 아니다');

  const reloaded = createStore({ storage, now: () => 2 });
  assert.equal(reloaded.getPhoto(target.id).title, '새 제목');
  assert.ok(reloaded.search('새태그').some((item) => item.id === target.id));
  assert.ok(reloaded.albumPhotos('travel').some((item) => item.id === target.id));
});

test('store: 잘못된 메타데이터 편집은 거부된다', () => {
  const store = makeStore();
  const target = PHOTOS[0];
  assert.equal(store.updatePhotoDetails('없는-사진', { title: 'x' }), false);
  assert.equal(store.updatePhotoDetails(target.id, { title: '   ' }), false);
  assert.equal(store.updatePhotoDetails(target.id, {}), false);
  assert.equal(store.getPhoto(target.id).title, target.title);
});

test('store: 데모 초기화가 모든 변경을 되돌린다', () => {
  const storage = createMemoryStorage();
  const store = createStore({ storage, now: () => 1 });
  const first = PHOTOS[0];
  store.toggleFavorite(first.id);
  store.setFilter(first.id, 'mono');
  store.updatePhotoDetails(first.id, { title: '바뀐 제목' });
  store.deletePhoto(PHOTOS[1].id);
  store.addUpload({ id: 'up-reset', src: 'data:image/png;base64,AAAA' });
  assert.equal(store.rawState.uploads.length, 1);

  assert.equal(store.reset(), true);
  const photo = store.getPhoto(first.id);
  assert.equal(photo.title, first.title);
  assert.equal(photo.filter, 'none');
  assert.equal(photo.favorite, first.favorite);
  assert.ok(store.getPhoto(PHOTOS[1].id));
  assert.equal(store.rawState.uploads.length, 0);
  assert.equal(createStore({ storage }).getPhoto(first.id).title, first.title);
});

/* ------------------------------------------------------------------ *
 * 4. 인증
 * ------------------------------------------------------------------ */
test('auth: 패스코드 정규화 · 검증', () => {
  assert.equal(normalizePasscode(' hd2-2026 '), 'HD2-2026');
  assert.equal(normalizePasscode('hd2 2026'), 'HD22026');
  assert.equal(verifyPasscode('HD2 2026', MEMBER_PASSCODE), false);
  assert.equal(normalizePasscode(' HD2 - 2026 '), 'HD2-2026');
  assert.equal(verifyPasscode(' hd2-2026', MEMBER_PASSCODE), true);
  assert.equal(verifyPasscode('HD2-2025', MEMBER_PASSCODE), false);
  assert.equal(verifyPasscode('', MEMBER_PASSCODE), false);
});

test('auth: 올바른 패스코드로 정회원 세션이 생성 · 저장된다', () => {
  const storage = createMemoryStorage();
  let clock = 1_000_000;
  const auth = createAuth({ storage, now: () => clock });
  assert.equal(auth.isMember(), false);

  const result = auth.signIn(MEMBER_PASSCODE, { remember: true });
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'granted');
  assert.equal(auth.isMember(), true);
  assert.ok(auth.session().expiresAt > clock);
  assert.equal(auth.remainingMs(), 12 * 60 * 60 * 1000);

  const restored = createAuth({ storage, now: () => clock + 1000 });
  assert.equal(restored.isMember(), true, '세션이 복원되어야 함');

  clock += 12 * 60 * 60 * 1000 + 1;
  assert.equal(auth.isMember(), false, '만료된 세션은 무효');
});

test('auth: 잘못된 패스코드는 남은 시도를 줄이고 5회 초과 시 잠긴다', () => {
  let clock = 5_000_000;
  const auth = createAuth({ storage: createMemoryStorage(), now: () => clock });

  const first = auth.signIn('0000');
  assert.equal(first.ok, false);
  assert.equal(first.reason, 'invalid');
  assert.equal(first.attemptsLeft, 4);

  auth.signIn('1111');
  auth.signIn('2222');
  auth.signIn('3333');
  assert.equal(auth.attemptsLeft(), 1);

  const locked = auth.signIn('4444');
  assert.equal(locked.ok, false);
  assert.equal(locked.reason, 'locked');
  assert.equal(auth.isLocked(), true);
  assert.equal(auth.signIn(MEMBER_PASSCODE).reason, 'locked');

  clock += LOCK_MS + 1;
  assert.equal(auth.isLocked(), false);
  assert.equal(auth.signIn(MEMBER_PASSCODE).ok, true, '잠금 해제 후 정상 코드 허용');
});

test('auth: 로그아웃하면 세션이 제거된다', () => {
  const storage = createMemoryStorage();
  const auth = createAuth({ storage, now: () => 10_000 });
  auth.signIn(MEMBER_PASSCODE);
  assert.ok(storage.getItem(SESSION_KEY));
  auth.signOut();
  assert.equal(auth.isMember(), false);
  assert.equal(storage.getItem(SESSION_KEY), null);
  assert.equal(createAuth({ storage, now: () => 10_000 }).isMember(), false);
});

test('auth: 만료된 세션은 복원되지 않고 저장소에서 정리된다', () => {
  const storage = createMemoryStorage({
    [SESSION_KEY]: JSON.stringify({ memberId: 'x', issuedAt: 0, expiresAt: 1 }),
  });
  const auth = createAuth({ storage, now: () => 1_000 });
  assert.equal(auth.isMember(), false);
  assert.equal(storage.getItem(SESSION_KEY), null);
  assert.equal(isSessionValid({ issuedAt: 0, expiresAt: 1 }, 1000), false);
  assert.equal(isSessionValid({ issuedAt: 0, expiresAt: 10_000 }, 1000), true);
});

test('auth: 실패 기록이 저장소에 남아 새로고침 후에도 유지된다', () => {
  const storage = createMemoryStorage();
  const auth = createAuth({ storage, now: () => 1_000 });
  auth.signIn('nope');
  const raw = JSON.parse(storage.getItem(ATTEMPT_KEY));
  assert.equal(raw.count, 1);
  const reloaded = createAuth({ storage, now: () => 1_000 });
  assert.equal(reloaded.attemptsLeft(), 4);
});

test('auth: 저장소가 없는 환경에서도 동작한다', () => {
  const auth = createAuth({ storage: null, now: () => 1 });
  assert.equal(auth.isMember(), false);
  assert.equal(auth.signIn(MEMBER_PASSCODE).ok, true);
  assert.equal(auth.isMember(), true);
  auth.signOut();
  assert.equal(auth.isMember(), false);
});
