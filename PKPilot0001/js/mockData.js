/**
 * PKPilot0001 · HD2Lab | Photos
 * js/mockData.js — 목업 사진 데이터 + 오프라인 SVG 아트워크 엔진
 *
 * - 모든 사진은 원격 고화질 이미지를 우선 사용하되, 네트워크가 없거나 차단되어도
 *   각 사진의 팔레트/장면(scene)으로 생성한 SVG 그라디언트 아트워크로 100% 렌더링됩니다.
 * - 외부 의존성 없음. 브라우저와 Node.js(단위 테스트) 양쪽에서 import 가능.
 */

/* ------------------------------------------------------------------ *
 * 필터 프리셋 (CSS filter 조합)
 * ------------------------------------------------------------------ */
export const FILTER_PRESETS = Object.freeze([
  { id: 'none', label: '표준', hint: 'ORIGINAL', css: 'none' },
  { id: 'vivid', label: '비비드', hint: 'VIVID', css: 'saturate(1.38) contrast(1.12) brightness(1.03)' },
  { id: 'warm', label: '따뜻한 톤', hint: 'WARM', css: 'sepia(0.2) saturate(1.22) brightness(1.05) contrast(1.04)' },
  { id: 'cool', label: '차가운 톤', hint: 'COOL', css: 'saturate(0.94) hue-rotate(-10deg) brightness(1.02) contrast(1.06)' },
  { id: 'film', label: '필름 빈티지', hint: 'FILM', css: 'sepia(0.34) saturate(0.86) contrast(0.94) brightness(1.06)' },
  { id: 'mono', label: '모노크롬', hint: 'MONO', css: 'grayscale(1) contrast(1.14) brightness(1.02)' },
  { id: 'noir', label: '누아르', hint: 'NOIR', css: 'grayscale(1) contrast(1.42) brightness(0.86)' },
]);

export const DEFAULT_FILTER = 'none';

export function getFilterPreset(id) {
  return FILTER_PRESETS.find((preset) => preset.id === id) || FILTER_PRESETS[0];
}

/* ------------------------------------------------------------------ *
 * 앨범 정의
 *   kind: smart(즐겨찾기) · recent(최근) · category(태그 기반) · secret(정회원 전용)
 * ------------------------------------------------------------------ */
export const ALBUMS = Object.freeze([
  {
    id: 'favorites',
    title: '즐겨찾기',
    kind: 'smart',
    icon: 'heart',
    description: '하트로 표시한 사진',
  },
  {
    id: 'recent',
    title: '최근 항목',
    kind: 'recent',
    icon: 'clock',
    description: '최근에 담긴 사진',
  },
  {
    id: 'people',
    title: '인물',
    kind: 'category',
    icon: 'person',
    description: '사람이 담긴 사진',
  },
  {
    id: 'landscape',
    title: '풍경',
    kind: 'category',
    icon: 'mountain',
    description: '산, 바다, 호수, 하늘',
  },
  {
    id: 'travel',
    title: '여행',
    kind: 'category',
    icon: 'plane',
    description: '떠난 곳의 기록',
  },
  {
    id: 'night',
    title: '야경 · 별',
    kind: 'category',
    icon: 'moon',
    description: '해가 진 뒤의 장면',
  },
  {
    id: 'family',
    title: '가족',
    kind: 'category',
    icon: 'users',
    description: '함께한 시간',
  },
  {
    id: 'secret',
    title: '비밀 앨범',
    kind: 'secret',
    icon: 'lock',
    description: '정회원만 열람 · 이 기기에만',
    locked: true,
  },
]);

/* ------------------------------------------------------------------ *
 * 사진 목업 (22장)
 * ------------------------------------------------------------------ */
const CDN = 'https://images.unsplash.com/';

function remote(id, width = 1400, quality = 78) {
  return `${CDN}${id}?auto=format&fit=crop&w=${width}&q=${quality}`;
}

function photo(config) {
  const { image, ...rest } = config;
  return Object.freeze({
    ...rest,
    width: 1400,
    height: 1050,
    source: 'Unsplash (mock)',
    src: remote(image, 1400, 80),
    thumb: remote(image, 520, 62),
    fallbackSeed: rest.id.charCodeAt(rest.id.length - 1) * 977 + rest.takenAt.length * 31,
  });
}

export const PHOTOS = Object.freeze([
  photo({
    id: 'ph-001',
    image: 'photo-1506905925346-21bda4d32df4',
    title: '대청봉 운해',
    caption: '새벽 6시, 구름 위로 해가 올라오던 3분.',
    fileName: 'IMG_20261025_061218.DNG',
    takenAt: '2026-10-25T06:12:18+09:00',
    place: '강원 인제군 · 대청봉',
    region: '강원',
    lat: 38.1191,
    lng: 128.4654,
    camera: 'Sony A7 IV',
    cameraModel: 'ILCE-7M4',
    lens: 'FE 24-70mm F2.8 GM II',
    focal: '24mm',
    aperture: 'f/2.8',
    shutter: '1/250s',
    iso: 100,
    exposure: '-0.3 EV',
    wb: '자동',
    sizeLabel: '18.4 MB',
    tags: ['풍경', '여행', '새벽', '산'],
    albums: ['landscape', 'travel'],
    favorite: true,
    art: { scene: 'mountain', palette: ['#0d1729', '#3c4d68', '#f2b184', '#101a28'], seed: 1101 },
  }),
  photo({
    id: 'ph-002',
    image: 'photo-1507525428034-b723cf961d3e',
    title: '해운대 일몰',
    caption: '파도 소리만 남은 해질녘.',
    fileName: 'IMG_20260914_182402.HEIC',
    takenAt: '2026-09-14T18:24:02+09:00',
    place: '부산 해운대구 · 해운대해수욕장',
    region: '부산',
    lat: 35.1587,
    lng: 129.1604,
    camera: 'iPhone 16 Pro',
    cameraModel: 'iPhone17,1',
    lens: 'Main Camera 24mm',
    focal: '24mm',
    aperture: 'f/1.78',
    shutter: '1/1200s',
    iso: 50,
    exposure: '0 EV',
    wb: '자동',
    sizeLabel: '4.8 MB',
    tags: ['바다', '노을', '여행', '부산'],
    albums: ['travel', 'landscape'],
    favorite: true,
    art: { scene: 'beach', palette: ['#2d4c5f', '#84b8bf', '#ffd7a6', '#c99564'], seed: 1202 },
  }),
  photo({
    id: 'ph-003',
    image: 'photo-1519681393784-d120267933ba',
    title: '지리산 별밤',
    caption: '은하수가 산등성이에 걸린 밤.',
    fileName: 'DSC_04188.ARW',
    takenAt: '2026-08-12T23:41:07+09:00',
    place: '경남 산청군 · 지리산 천왕봉',
    region: '경남',
    lat: 35.3372,
    lng: 127.7305,
    camera: 'Sony A7 IV',
    cameraModel: 'ILCE-7M4',
    lens: 'FE 20mm F1.8 G',
    focal: '20mm',
    aperture: 'f/1.8',
    shutter: '15s',
    iso: 3200,
    exposure: '+0.7 EV',
    wb: '3800K',
    sizeLabel: '26.1 MB',
    tags: ['별', '밤', '풍경', '산'],
    albums: ['landscape', 'night'],
    favorite: false,
    art: { scene: 'night', palette: ['#05070f', '#1b2450', '#8d7bff', '#0a0d18'], seed: 1303 },
  }),
  photo({
    id: 'ph-004',
    image: 'photo-1519501025264-65ba15a82390',
    title: '을지로의 밤',
    caption: '비 온 뒤, 간판 불빛이 도로에 번지던 밤.',
    fileName: 'DSCF_2207.RAF',
    takenAt: '2026-07-03T21:08:44+09:00',
    place: '서울 중구 · 을지로',
    region: '서울',
    lat: 37.5663,
    lng: 126.9912,
    camera: 'Fujifilm X-T5',
    cameraModel: 'X-T5',
    lens: 'XF 35mm F1.4 R',
    focal: '35mm',
    aperture: 'f/2.0',
    shutter: '1/60s',
    iso: 800,
    exposure: '-0.7 EV',
    wb: '자동',
    sizeLabel: '21.2 MB',
    tags: ['도시', '야경', '서울', '골목'],
    albums: ['night', 'travel'],
    favorite: false,
    art: { scene: 'city', palette: ['#0b0f19', '#26344f', '#ff9c64', '#151a2b'], seed: 1404 },
  }),
  photo({
    id: 'ph-005',
    image: 'photo-1501785888041-af3ef285b470',
    title: '북한강 나룻배',
    caption: '물빛이 에메랄드로 바뀌는 시간.',
    fileName: 'IMG_20260621_103255.CR3',
    takenAt: '2026-06-21T10:32:55+09:00',
    place: '경기 가평군 · 북한강',
    region: '경기',
    lat: 37.8312,
    lng: 127.5107,
    camera: 'Canon EOS R6',
    cameraModel: 'EOS R6',
    lens: 'RF 24-70mm F2.8 L IS USM',
    focal: '24mm',
    aperture: 'f/8.0',
    shutter: '1/500s',
    iso: 100,
    exposure: '0 EV',
    wb: '자동',
    sizeLabel: '19.7 MB',
    tags: ['호수', '여행', '풍경', '배'],
    albums: ['landscape', 'travel'],
    favorite: false,
    art: { scene: 'lake', palette: ['#123033', '#2f7f7a', '#eaf6ef', '#173f3c'], seed: 1505 },
  }),
  photo({
    id: 'ph-006',
    image: 'photo-1470071459604-3b5ec3a7fe05',
    title: '천주산 일출',
    caption: '동네 뒷산에서 만난 안개와 아침.',
    fileName: 'IMG_20261101_064712.HEIC',
    takenAt: '2026-11-01T06:47:12+09:00',
    place: '창원시 의창구 · 천주산',
    region: '창원',
    lat: 35.2631,
    lng: 128.6662,
    camera: 'iPhone 16 Pro',
    cameraModel: 'iPhone17,1',
    lens: 'Main Camera 24mm',
    focal: '24mm',
    aperture: 'f/1.78',
    shutter: '1/640s',
    iso: 64,
    exposure: '0 EV',
    wb: '자동',
    sizeLabel: '5.2 MB',
    tags: ['풍경', '일출', '창원', '안개'],
    albums: ['landscape'],
    favorite: true,
    art: { scene: 'field', palette: ['#2a3626', '#7f9367', '#f6d9a2', '#33452f'], seed: 1606 },
  }),
  photo({
    id: 'ph-007',
    image: 'photo-1477959858617-67f85cf4f1df',
    title: '마린시티 스카이라인',
    caption: '해운대에서 바라본 저녁 도시.',
    fileName: 'DSC_03812.ARW',
    takenAt: '2026-09-15T19:05:31+09:00',
    place: '부산 해운대구 · 마린시티',
    region: '부산',
    lat: 35.1535,
    lng: 129.1462,
    camera: 'Sony A7 IV',
    cameraModel: 'ILCE-7M4',
    lens: 'FE 70-200mm F2.8 GM OSS II',
    focal: '70mm',
    aperture: 'f/4.0',
    shutter: '1/200s',
    iso: 200,
    exposure: '-0.3 EV',
    wb: '자동',
    sizeLabel: '23.9 MB',
    tags: ['도시', '여행', '부산', '노을'],
    albums: ['travel', 'landscape', 'night'],
    favorite: false,
    art: { scene: 'city', palette: ['#1b2a3f', '#6b7d90', '#f6c48d', '#1a2230'], seed: 1707 },
  }),
  photo({
    id: 'ph-008',
    image: 'photo-1518837695005-2083093ee35b',
    title: '광안리 파도',
    caption: '아침 7시, 사람 없는 바다.',
    fileName: 'IMG_20260913_072003.HEIC',
    takenAt: '2026-09-13T07:20:03+09:00',
    place: '부산 수영구 · 광안리',
    region: '부산',
    lat: 35.1532,
    lng: 129.1186,
    camera: 'iPhone 16 Pro',
    cameraModel: 'iPhone17,1',
    lens: 'Ultra Wide Camera 13mm',
    focal: '13mm',
    aperture: 'f/2.2',
    shutter: '1/2000s',
    iso: 32,
    exposure: '0 EV',
    wb: '자동',
    sizeLabel: '4.1 MB',
    tags: ['바다', '파도', '부산', '아침'],
    albums: ['landscape', 'travel'],
    favorite: false,
    art: { scene: 'wave', palette: ['#22323c', '#6d94a0', '#dfeef0', '#1c2a33'], seed: 1808 },
  }),
  photo({
    id: 'ph-009',
    image: 'photo-1540959733332-eab4deabeeaf',
    title: '신주쿠 네온',
    caption: '비 내리는 골목, 간판이 길을 밝힌다.',
    fileName: 'IMG_20260405_205102.HEIC',
    takenAt: '2026-04-05T20:51:02+09:00',
    place: '도쿄 신주쿠구 · 가부키초',
    region: '도쿄',
    lat: 35.6942,
    lng: 139.7034,
    camera: 'iPhone 16 Pro',
    cameraModel: 'iPhone17,1',
    lens: 'Main Camera 24mm',
    focal: '24mm',
    aperture: 'f/1.78',
    shutter: '1/60s',
    iso: 640,
    exposure: '-0.3 EV',
    wb: '자동',
    sizeLabel: '5.9 MB',
    tags: ['도쿄', '여행', '야경', '네온'],
    albums: ['travel', 'night'],
    favorite: true,
    art: { scene: 'neon', palette: ['#120a1c', '#3a1f5c', '#ff5fa2', '#0d0715'], seed: 1909 },
  }),
  photo({
    id: 'ph-010',
    image: 'photo-1528164344705-47542687000d',
    title: '가와구치코의 후지',
    caption: '탑 너머로 보이던 그 산.',
    fileName: 'DSC_03944.ARW',
    takenAt: '2026-04-06T08:15:20+09:00',
    place: '야마나시 · 가와구치코',
    region: '도쿄',
    lat: 35.5171,
    lng: 138.7519,
    camera: 'Sony A7 IV',
    cameraModel: 'ILCE-7M4',
    lens: 'FE 50mm F1.8',
    focal: '50mm',
    aperture: 'f/5.6',
    shutter: '1/250s',
    iso: 125,
    exposure: '0 EV',
    wb: '자동',
    sizeLabel: '17.3 MB',
    tags: ['여행', '도쿄', '산', '후지'],
    albums: ['travel', 'landscape'],
    favorite: false,
    art: { scene: 'mountain', palette: ['#2a3550', '#9aa7bd', '#f2d7c4', '#1a2238'], seed: 2010 },
  }),
  photo({
    id: 'ph-011',
    image: 'photo-1490806843957-31f4c9a91c65',
    title: '우에노 벚꽃',
    caption: '꽃잎이 바람에 흩어지던 오후.',
    fileName: 'IMG_20260407_110318.HEIC',
    takenAt: '2026-04-07T11:03:18+09:00',
    place: '도쿄 다이토구 · 우에노공원',
    region: '도쿄',
    lat: 35.7148,
    lng: 139.7737,
    camera: 'iPhone 16 Pro',
    cameraModel: 'iPhone17,1',
    lens: 'Telephoto Camera 48mm',
    focal: '48mm',
    aperture: 'f/1.78',
    shutter: '1/1000s',
    iso: 40,
    exposure: '0 EV',
    wb: '자동',
    sizeLabel: '4.6 MB',
    tags: ['여행', '도쿄', '벚꽃', '봄'],
    albums: ['travel'],
    favorite: true,
    art: { scene: 'blossom', palette: ['#1d3f6b', '#78a8d8', '#ffd7e2', '#14294a'], seed: 2111 },
  }),
  photo({
    id: 'ph-012',
    image: 'photo-1493246507139-91e8fad9978e',
    title: '모레인 호수',
    caption: '밴프에서 만난, 물감 같은 물빛.',
    fileName: 'IMG_20250819_094011.CR3',
    takenAt: '2025-08-19T09:40:11-06:00',
    place: '캐나다 앨버타 · 밴프',
    region: '캐나다',
    lat: 51.3217,
    lng: -116.186,
    camera: 'Sony A7 IV',
    cameraModel: 'ILCE-7M4',
    lens: 'FE 16-35mm F2.8 GM',
    focal: '24mm',
    aperture: 'f/9.0',
    shutter: '1/320s',
    iso: 100,
    exposure: '-0.3 EV',
    wb: '자동',
    sizeLabel: '24.5 MB',
    tags: ['여행', '호수', '산', '풍경'],
    albums: ['travel', 'landscape'],
    favorite: false,
    art: { scene: 'lake', palette: ['#0d2a33', '#2c7d8a', '#e9f4f2', '#103039'], seed: 2212 },
  }),
  photo({
    id: 'ph-013',
    image: 'photo-1494790108377-be9c29b29330',
    title: '스튜디오 인물',
    caption: '가음정 작업실, 창가 빛.',
    fileName: 'IMG_0013.CR3',
    takenAt: '2026-10-12T15:20:44+09:00',
    place: '창원시 성산구 · 가음정동',
    region: '창원',
    lat: 35.2283,
    lng: 128.6817,
    camera: 'Canon EOS R5',
    cameraModel: 'EOS R5',
    lens: 'RF 85mm F1.2 L USM',
    focal: '85mm',
    aperture: 'f/1.2',
    shutter: '1/200s',
    iso: 200,
    exposure: '+0.3 EV',
    wb: '5200K',
    sizeLabel: '22.8 MB',
    tags: ['인물', '스튜디오', '가족'],
    albums: ['people', 'family'],
    favorite: true,
    art: { scene: 'portrait', palette: ['#2a1418', '#6b2b33', '#ffd2c2', '#1d0f12'], seed: 2313 },
  }),
  photo({
    id: 'ph-014',
    image: 'photo-1500648767791-00dcc994a43e',
    title: '아버지의 초상',
    caption: '아버지, 서른 번째 생신 무렵.',
    fileName: 'DSC_03455.ARW',
    takenAt: '2026-05-05T13:10:26+09:00',
    place: '창원시 마산회원구 · 양덕동',
    region: '창원',
    lat: 35.2139,
    lng: 128.5736,
    camera: 'Sony A7 IV',
    cameraModel: 'ILCE-7M4',
    lens: 'FE 85mm F1.8',
    focal: '85mm',
    aperture: 'f/2.0',
    shutter: '1/160s',
    iso: 320,
    exposure: '0 EV',
    wb: '자동',
    sizeLabel: '16.2 MB',
    tags: ['인물', '가족', '창원'],
    albums: ['people', 'family'],
    favorite: false,
    art: { scene: 'portrait', palette: ['#23272c', '#4a5058', '#d9dde2', '#171a1e'], seed: 2414 },
  }),
  photo({
    id: 'ph-015',
    image: 'photo-1544005313-94ddf0286df2',
    title: '용지호수 산책',
    caption: '호수 한 바퀴, 카페 창가에서.',
    fileName: 'IMG_20261030_164201.HEIC',
    takenAt: '2026-10-30T16:42:01+09:00',
    place: '창원시 성산구 · 용지호수',
    region: '창원',
    lat: 35.2298,
    lng: 128.6774,
    camera: 'iPhone 16 Pro',
    cameraModel: 'iPhone17,1',
    lens: 'Telephoto Camera 48mm',
    focal: '48mm',
    aperture: 'f/1.78',
    shutter: '1/250s',
    iso: 80,
    exposure: '0 EV',
    wb: '자동',
    sizeLabel: '4.4 MB',
    tags: ['인물', '창원', '호수', '가족'],
    albums: ['people', 'family'],
    favorite: true,
    art: { scene: 'portrait', palette: ['#2b2a24', '#6f6a5a', '#f0e7d8', '#1d1c18'], seed: 2515 },
  }),
  photo({
    id: 'ph-016',
    image: 'photo-1517841905240-472988babdf9',
    title: '성수 골목',
    caption: '서울 성수, 파란 벽 앞에서.',
    fileName: 'DSCF_1988.RAF',
    takenAt: '2026-03-22T17:15:09+09:00',
    place: '서울 성동구 · 성수동',
    region: '서울',
    lat: 37.5445,
    lng: 127.0562,
    camera: 'Fujifilm X100VI',
    cameraModel: 'X100VI',
    lens: '23mm F2 (고정)',
    focal: '23mm',
    aperture: 'f/2.0',
    shutter: '1/250s',
    iso: 320,
    exposure: '0 EV',
    wb: '자동',
    sizeLabel: '14.1 MB',
    tags: ['인물', '서울', '골목'],
    albums: ['people', 'travel'],
    favorite: false,
    art: { scene: 'portrait', palette: ['#12303c', '#3f7f92', '#cfe6ee', '#0d222b'], seed: 2616 },
  }),
  photo({
    id: 'ph-017',
    image: 'photo-1533050487297-09b450131914',
    title: '오모이데 라멘골목',
    caption: '도쿄 첫날, 줄 서서 먹은 라멘.',
    fileName: 'IMG_20260405_193207.HEIC',
    takenAt: '2026-04-05T19:32:07+09:00',
    place: '도쿄 신주쿠구 · 오모이데요코초',
    region: '도쿄',
    lat: 35.6935,
    lng: 139.6996,
    camera: 'iPhone 16 Pro',
    cameraModel: 'iPhone17,1',
    lens: 'Main Camera 24mm',
    focal: '24mm',
    aperture: 'f/1.78',
    shutter: '1/50s',
    iso: 1000,
    exposure: '-0.7 EV',
    wb: '자동',
    sizeLabel: '5.3 MB',
    tags: ['도쿄', '여행', '골목', '음식'],
    albums: ['travel', 'night'],
    favorite: false,
    art: { scene: 'neon', palette: ['#1a1208', '#4a3416', '#ffb04a', '#120c05'], seed: 2717 },
  }),
  photo({
    id: 'ph-018',
    image: 'photo-1554797589-7241bb691973',
    title: '이자카야 골목',
    caption: '가부키초 뒤편, 등불만 켜진 골목.',
    fileName: 'DSC_04112.ARW',
    takenAt: '2026-04-05T21:14:33+09:00',
    place: '도쿄 신주쿠구 · 오모이데요코초',
    region: '도쿄',
    lat: 35.6931,
    lng: 139.7001,
    camera: 'Sony A7 IV',
    cameraModel: 'ILCE-7M4',
    lens: 'FE 35mm F1.8',
    focal: '35mm',
    aperture: 'f/1.8',
    shutter: '1/80s',
    iso: 1600,
    exposure: '-0.3 EV',
    wb: '자동',
    sizeLabel: '20.6 MB',
    tags: ['도쿄', '여행', '야경', '골목'],
    albums: ['travel', 'night'],
    favorite: false,
    art: { scene: 'neon', palette: ['#180d0a', '#52251a', '#ff7a3c', '#0f0807'], seed: 2818 },
  }),
  photo({
    id: 'ph-019',
    image: 'photo-1476514525535-07fb3b4ae5f1',
    title: '호수 위 보트',
    caption: '노를 젓던 오전, 물소리와 햇빛.',
    fileName: 'IMG_20250820_101533.CR3',
    takenAt: '2025-08-20T10:15:33-06:00',
    place: '캐나다 앨버타 · 루이스호수',
    region: '캐나다',
    lat: 51.4254,
    lng: -116.1773,
    camera: 'Canon EOS R6',
    cameraModel: 'EOS R6',
    lens: 'RF 35mm F1.8 MACRO IS STM',
    focal: '35mm',
    aperture: 'f/5.6',
    shutter: '1/800s',
    iso: 100,
    exposure: '0 EV',
    wb: '자동',
    sizeLabel: '18.9 MB',
    tags: ['여행', '호수', '풍경', '배'],
    albums: ['travel', 'landscape'],
    favorite: false,
    art: { scene: 'lake', palette: ['#12313a', '#3f7f8a', '#dfeff1', '#0e242b'], seed: 2919 },
  }),
  photo({
    id: 'ph-020',
    image: 'photo-1469474968028-56623f02e42e',
    title: '무학산 능선',
    caption: '마산 앞바다를 내려다보던 능선.',
    fileName: 'IMG_20261018_100512.HEIC',
    takenAt: '2026-10-18T10:05:12+09:00',
    place: '창원시 마산합포구 · 무학산',
    region: '창원',
    lat: 35.1952,
    lng: 128.5677,
    camera: 'iPhone 16 Pro',
    cameraModel: 'iPhone17,1',
    lens: 'Main Camera 24mm',
    focal: '24mm',
    aperture: 'f/1.78',
    shutter: '1/1200s',
    iso: 40,
    exposure: '0 EV',
    wb: '자동',
    sizeLabel: '4.9 MB',
    tags: ['산', '풍경', '창원', '등산'],
    albums: ['landscape'],
    favorite: false,
    art: { scene: 'mountain', palette: ['#2a3327', '#5c6a4e', '#d9d3b4', '#1e2519'], seed: 3020 },
  }),
  photo({
    id: 'ph-021',
    image: 'photo-1464349095431-e9a21285b5f3',
    title: '생일 케이크',
    caption: '초를 끄기 직전, 가족사진 대신.',
    fileName: 'IMG_20261024_200918.HEIC',
    takenAt: '2026-10-24T20:09:18+09:00',
    place: '창원시 마산회원구 · 양덕동',
    region: '창원',
    lat: 35.2142,
    lng: 128.5741,
    camera: 'iPhone 16 Pro',
    cameraModel: 'iPhone17,1',
    lens: 'Main Camera 24mm',
    focal: '24mm',
    aperture: 'f/1.78',
    shutter: '1/60s',
    iso: 500,
    exposure: '0 EV',
    wb: '자동',
    sizeLabel: '4.2 MB',
    tags: ['가족', '생일', '비밀'],
    albums: ['secret', 'family'],
    favorite: false,
    secret: true,
    art: { scene: 'party', palette: ['#1a1016', '#4a2333', '#ffd6e0', '#120a0f'], seed: 3121 },
  }),
  photo({
    id: 'ph-022',
    image: 'photo-1530103862676-de8c9debad1d',
    title: '풍선과 웃음',
    caption: '거실이 잠깐 놀이터가 된 오후.',
    fileName: 'IMG_20261024_195544.HEIC',
    takenAt: '2026-10-24T19:55:44+09:00',
    place: '창원시 마산회원구 · 양덕동',
    region: '창원',
    lat: 35.2142,
    lng: 128.5741,
    camera: 'iPhone 16 Pro',
    cameraModel: 'iPhone17,1',
    lens: 'Ultra Wide Camera 13mm',
    focal: '13mm',
    aperture: 'f/2.2',
    shutter: '1/45s',
    iso: 800,
    exposure: '0 EV',
    wb: '자동',
    sizeLabel: '3.7 MB',
    tags: ['가족', '생일', '비밀'],
    albums: ['secret', 'family'],
    favorite: false,
    secret: true,
    art: { scene: 'party', palette: ['#101a2a', '#2b4a6b', '#ffcf5c', '#0b121d'], seed: 3222 },
  }),
]);

/* ------------------------------------------------------------------ *
 * 오프라인 SVG 아트워크 엔진
 *   사진의 팔레트와 장면만으로 결정론적(deterministic) 아트워크를 생성합니다.
 * ------------------------------------------------------------------ */
const PALETTE_TINTS = ['#f6d9a2', '#9ad7d0', '#ff9d7a', '#c9d6ff', '#ffe6a8'];

function hashString(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ridgePath(random, baseline, amplitude, width, height, steps = 9) {
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const x = (width / steps) * index;
    const drift = (random() - 0.5) * amplitude;
    const y = Math.min(height - 8, Math.max(baseline * 0.35, baseline + drift));
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M0,${height} L${points.join(' L')} L${width},${height} Z`;
}

function stars(random, count, width, height, horizon) {
  let markup = '';
  for (let index = 0; index < count; index += 1) {
    const x = random() * width;
    const y = random() * horizon;
    const radius = 0.6 + random() * 1.6;
    const opacity = 0.25 + random() * 0.7;
    markup += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(2)}" fill="#fff" opacity="${opacity.toFixed(2)}"/>`;
  }
  return markup;
}

function bokeh(random, count, width, height, palette) {
  let markup = '';
  for (let index = 0; index < count; index += 1) {
    const x = random() * width;
    const y = random() * height;
    const radius = 40 + random() * 160;
    const tint = palette[Math.floor(random() * palette.length)];
    markup += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${radius.toFixed(0)}" fill="${tint}" opacity="${(0.08 + random() * 0.18).toFixed(2)}" filter="url(#blur36)"/>`;
  }
  return markup;
}

function skyline(random, width, height, horizon, tint) {
  let markup = '';
  let x = -20;
  while (x < width + 40) {
    const blockWidth = 40 + random() * 90;
    const blockHeight = 60 + random() * (horizon * 0.7);
    const top = horizon - blockHeight;
    markup += `<rect x="${x.toFixed(0)}" y="${top.toFixed(0)}" width="${blockWidth.toFixed(0)}" height="${(height - top).toFixed(0)}" fill="${tint}" opacity="${(0.55 + random() * 0.3).toFixed(2)}"/>`;
    if (random() > 0.35) {
      let windows = '';
      for (let wy = top + 12; wy < horizon - 8; wy += 18) {
        for (let wx = x + 8; wx < x + blockWidth - 8; wx += 16) {
          if (random() > 0.62) {
            windows += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="5" height="7" fill="#ffd9a3" opacity="${(0.25 + random() * 0.6).toFixed(2)}"/>`;
          }
        }
      }
      markup += windows;
    }
    x += blockWidth + 4 + random() * 12;
  }
  return markup;
}

function blossomBranches(random, width, height, tint) {
  let markup = '';
  for (let branch = 0; branch < 4; branch += 1) {
    const startX = random() * width;
    const startY = -20;
    const endX = startX + (random() - 0.5) * 260;
    const endY = 140 + random() * 240;
    markup += `<path d="M${startX.toFixed(0)},${startY} Q${((startX + endX) / 2).toFixed(0)},${(endY * 0.4).toFixed(0)} ${endX.toFixed(0)},${endY.toFixed(0)}" stroke="#3a2b2b" stroke-width="4" fill="none" opacity="0.65"/>`;
    for (let petal = 0; petal < 26; petal += 1) {
      const px = startX + (endX - startX) * random() + (random() - 0.5) * 90;
      const py = (endY + 30) * random();
      const radius = 3 + random() * 7;
      markup += `<circle cx="${px.toFixed(0)}" cy="${py.toFixed(0)}" r="${radius.toFixed(1)}" fill="${tint}" opacity="${(0.4 + random() * 0.5).toFixed(2)}"/>`;
    }
  }
  return markup;
}

function neonLights(random, width, height) {
  const colors = ['#ff5fa2', '#4cd8ff', '#ffd166', '#b388ff', '#ff8a5c'];
  let markup = '';
  for (let index = 0; index < 16; index += 1) {
    const x = 40 + random() * (width - 80);
    const y = 60 + random() * (height * 0.62);
    const w = 8 + random() * 16;
    const h = 26 + random() * 120;
    const color = colors[Math.floor(random() * colors.length)];
    markup += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" rx="4" fill="${color}" opacity="${(0.45 + random() * 0.5).toFixed(2)}" filter="url(#blur6)"/>`;
  }
  return markup;
}

function confetti(random, count, width, height) {
  const colors = ['#ffd166', '#ff6b8a', '#6bd8ff', '#c6ff8a', '#ffffff'];
  let markup = '';
  for (let index = 0; index < count; index += 1) {
    const x = random() * width;
    const y = random() * height;
    const size = 5 + random() * 14;
    const rotate = random() * 360;
    markup += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${size.toFixed(0)}" height="${(size * 0.45).toFixed(1)}" rx="2" fill="${colors[Math.floor(random() * colors.length)]}" opacity="${(0.35 + random() * 0.5).toFixed(2)}" transform="rotate(${rotate.toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
  }
  return markup;
}

const SCENE_LABELS = Object.freeze({
  mountain: 'MOUNTAIN · RIDGE',
  beach: 'BEACH · GOLDEN HOUR',
  night: 'NIGHT SKY · MILKY WAY',
  city: 'CITY · NIGHT',
  lake: 'LAKE · STILL WATER',
  field: 'FIELD · SUNRISE MIST',
  wave: 'SEA · WAVE',
  neon: 'NEON · ALLEY',
  portrait: 'PORTRAIT · BOKEH',
  blossom: 'BLOSSOM · SPRING',
  party: 'CELEBRATION · INDOOR',
});

const artCache = new Map();

/**
 * 사진에 대응하는 SVG 아트워크(data URI)를 반환합니다.
 * 네트워크 없이도 항상 렌더링되는 폴백 이미지입니다.
 */
export function photoArtwork(input) {
  const id = typeof input === 'string' ? input : input && input.id;
  if (id && artCache.has(id)) return artCache.get(id);

  const artwork = (input && input.art) || { scene: 'mountain', palette: ['#101110', '#2c3130', '#ff824f', '#141816'], seed: hashString(id || 'ph') };
  const palette = artwork.palette || ['#101110', '#2c3130', '#ff824f', '#141816'];
  const scene = artwork.scene || 'mountain';
  const seed = artwork.seed || hashString(id || scene);
  const random = mulberry32(seed);
  const W = 1200;
  const H = 900;
  const [deep, mid, accent, shade] = palette;
  const horizon = H * (0.52 + random() * 0.14);

  let layers = '';

  if (scene === 'portrait') {
    layers += bokeh(random, 9, W, H, [accent, mid, PALETTE_TINTS[seed % PALETTE_TINTS.length]]);
    layers += `<ellipse cx="${W * 0.5}" cy="${H * 0.58}" rx="${W * 0.22}" ry="${H * 0.32}" fill="${shade}" opacity="0.55" filter="url(#blur36)"/>`;
  } else if (scene === 'party') {
    layers += bokeh(random, 6, W, H, [accent, mid, '#ffd166']);
    layers += confetti(random, 90, W, H);
  } else if (scene === 'night') {
    layers += stars(random, 220, W, H, horizon);
    layers += `<ellipse cx="${W * 0.6}" cy="${H * 0.42}" rx="${W * 0.42}" ry="${H * 0.1}" fill="${accent}" opacity="0.18" filter="url(#blur36)" transform="rotate(-18 ${W * 0.6} ${H * 0.42})"/>`;
    layers += stars(random, 120, W, H, horizon);
  } else if (scene === 'neon') {
    layers += `<rect x="0" y="0" width="${W}" height="${H}" fill="${deep}" opacity="0.55"/>`;
    layers += neonLights(random, W, H);
    layers += bokeh(random, 5, W, H, [accent, mid]);
  } else if (scene === 'city') {
    layers += `<circle cx="${W * 0.76}" cy="${horizon * 0.42}" r="${H * 0.16}" fill="url(#glow)"/>`;
    layers += skyline(random, W, H, horizon, shade);
  } else if (scene === 'lake' || scene === 'beach' || scene === 'wave') {
    layers += `<circle cx="${W * (0.3 + random() * 0.4)}" cy="${horizon * 0.72}" r="${H * 0.12}" fill="url(#glow)"/>`;
    layers += `<path d="${ridgePath(random, horizon - 40, 70, W, H)}" fill="${shade}" opacity="0.55"/>`;
    layers += `<path d="${ridgePath(random, horizon + 10, 40, W, H)}" fill="${mid}" opacity="0.45"/>`;
    layers += `<rect x="0" y="${horizon.toFixed(0)}" width="${W}" height="${(H - horizon).toFixed(0)}" fill="url(#water)"/>`;
    for (let line = 0; line < 26; line += 1) {
      const y = horizon + 18 + line * ((H - horizon) / 26);
      const w = W * (0.2 + random() * 0.6);
      const x = random() * (W - w);
      layers += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${(1 + random() * 3).toFixed(1)}" rx="2" fill="#ffffff" opacity="${(0.04 + random() * 0.12).toFixed(2)}"/>`;
    }
  } else if (scene === 'blossom') {
    layers += `<path d="${ridgePath(random, horizon, 90, W, H)}" fill="${shade}" opacity="0.5"/>`;
    layers += `<circle cx="${W * 0.7}" cy="${horizon * 0.55}" r="${H * 0.15}" fill="url(#glow)"/>`;
    layers += blossomBranches(random, W, H, accent);
    layers += blossomBranches(random, W, H, PALETTE_TINTS[1]);
  } else if (scene === 'field') {
    layers += `<circle cx="${W * 0.28}" cy="${horizon * 0.7}" r="${H * 0.14}" fill="url(#glow)"/>`;
    layers += `<path d="${ridgePath(random, horizon - 30, 60, W, H)}" fill="${shade}" opacity="0.6"/>`;
    layers += `<path d="${ridgePath(random, horizon + 40, 30, W, H)}" fill="${mid}" opacity="0.8"/>`;
    layers += `<rect x="0" y="${(H * 0.78).toFixed(0)}" width="${W}" height="${(H * 0.22).toFixed(0)}" fill="${shade}" opacity="0.9"/>`;
  } else {
    // mountain (기본)
    layers += `<circle cx="${W * 0.3}" cy="${horizon * 0.55}" r="${H * 0.18}" fill="url(#glow)"/>`;
    layers += `<path d="${ridgePath(random, horizon - 90, 120, W, H)}" fill="${mid}" opacity="0.55"/>`;
    layers += `<path d="${ridgePath(random, horizon - 20, 90, W, H)}" fill="${shade}" opacity="0.8"/>`;
    for (let band = 0; band < 4; band += 1) {
      layers += `<rect x="0" y="${(horizon + band * 26).toFixed(0)}" width="${W}" height="18" fill="${accent}" opacity="${(0.06 + band * 0.01).toFixed(2)}"/>`;
    }
  }

  const label = SCENE_LABELS[scene] || 'HD2LAB · MEMORY';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${deep}"/>
    <stop offset="0.62" stop-color="${mid}"/>
    <stop offset="1" stop-color="${shade}"/>
  </linearGradient>
  <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${accent}" stop-opacity="0.55"/>
    <stop offset="0.35" stop-color="${mid}" stop-opacity="0.75"/>
    <stop offset="1" stop-color="${deep}"/>
  </linearGradient>
  <radialGradient id="glow">
    <stop offset="0" stop-color="${accent}" stop-opacity="0.95"/>
    <stop offset="0.45" stop-color="${accent}" stop-opacity="0.35"/>
    <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="vignette">
    <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
    <stop offset="1" stop-color="#000" stop-opacity="0.5"/>
  </radialGradient>
  <filter id="blur36" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="36"/></filter>
  <filter id="blur6" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="grain">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/>
  </filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
${layers}
<rect width="${W}" height="${H}" fill="url(#vignette)"/>
<rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.05"/>
<text x="48" y="${H - 44}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="20" letter-spacing="4" fill="#ffffff" opacity="0.42">${label}</text>
<text x="${W - 48}" y="${H - 44}" text-anchor="end" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="20" letter-spacing="3" fill="#ffffff" opacity="0.3">HD2LAB</text>
</svg>`;

  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  if (id) artCache.set(id, uri);
  return uri;
}

/* ------------------------------------------------------------------ *
 * 집계 · 검색 유틸
 * ------------------------------------------------------------------ */
export const SEARCH_SCOPES = Object.freeze([
  { id: 'all', label: '전체' },
  { id: 'place', label: '장소' },
  { id: 'tag', label: '태그' },
  { id: 'camera', label: '카메라' },
  { id: 'date', label: '날짜' },
]);

export function photoSearchIndex(item) {
  const stamp = String(item.takenAt || '');
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(stamp);
  const dateWords = match ? [`${match[1]}년`, `${match[1]}-${match[2]}-${match[3]}`, `${Number(match[2])}월`, `${Number(match[3])}일`] : [];
  const parts = [
    item.title,
    item.caption,
    item.place,
    item.region,
    item.camera,
    item.cameraModel,
    item.lens,
    item.fileName,
    item.favorite ? '즐겨찾기 하트' : '',
    ...dateWords,
    ...(item.tags || []),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

export const RECENT_WINDOW_DAYS = 30;

export const LIBRARY_SORT = (a, b) => new Date(b.takenAt) - new Date(a.takenAt);
