# HD2Lab | Midpoint (PKPilot0002)

여럿이 만날 때, 딱 가운데.
지도에 출발지를 찍으면 **N명 모두에게 가장 공평한 만남 지점**과 **가까운 지하철역**을 찾아 주는 정적 웹앱입니다.

- 라이브: <https://hyangdan2.github.io/PKPilot0002/>
- 외부 API 키 없음 · 빌드 없음 · 정적 파일만 (Leaflet 1.9.4 로컬 번들)

![데스크톱 — 강남·홍대입구·종로3가의 중간 지점](docs/screenshots/desktop-result.jpg)

| 모바일 (390px) | 결과 카드 |
| --- | --- |
| ![모바일](docs/screenshots/mobile-result.jpg) | ![상세](docs/screenshots/desktop-detail.jpg) |

## 기능

**출발지 입력**
- 지도 클릭으로 참가자 추가 (Person 1, Person 2 … 고유 색 마커)
- 주소·장소 검색 (Nominatim) → 결과를 눌러 추가
- 빠른 선택: 강남 · 홍대입구 · 종로3가 · 신도림 · 여의도 · 잠실 · 판교 · 광화문
- 마커 드래그로 미세 조정, 이름 인라인 수정, 개별 삭제, 전체 초기화
- 최대 12명. 2명 이상이면 즉시 계산

**중간 지점 엔진 — 세 가지 관점**
| 모드 | 계산 | 의미 |
| --- | --- | --- |
| **공평점** (기본) | 최소 외접원의 중심 (1-center) | 가장 먼 사람의 거리를 최소로 → 모두에게 고르게 |
| 균형점 | 기하 중앙값 (Weiszfeld) | 모든 사람의 이동 거리 **합**을 최소로 |
| 무게중심 | 구면 무게중심 (3D 벡터 평균) | 위치의 평균 — 좌표 중심 |

- 지도에 오렌지 펄스 마커로 표시, 참가자별 **점선 연결선 + 직선 거리(km)**
- 평균 거리만큼의 옅은 원(공평 반경) 표시
- **공평도 지수**: `100 × (1 − (최대거리 − 최소거리) / (최대거리 + 최소거리))`
  — 모두 같은 거리면 100%, 한 사람만 멀수록 0%에 가까워집니다. 값에 따라 "완벽한 균형 / 아주 공평해요 / 무난한 균형 / 조금 치우쳤어요 / 한쪽에 쏠렸어요" 등급 표시.
- 참가자별 거리 막대와 합계

**추천 만남 거점**
- 중간 지점에서 가장 가까운 지하철역(수도권 589개 역 스냅샷) + 노선 배지 + 도보 시간
- 후보 중 **가장 먼 참가자의 거리를 최소로 하는 역**을 "더 공평한 역"으로 함께 제안

**공유 · 반응형**
- 상태를 URL에 인코딩: `?p=37.5665,126.978|37.4979,127.0276&n=재혁~민지&m=centroid`
  (좌표 5자리 ≈ 1m 정밀도, `n`은 이름을 바꿨을 때만, `m`은 기본값 `fair`가 아닐 때만)
- 링크를 받은 사람은 같은 결과를 바로 봅니다. 상태가 바뀔 때마다 `history.replaceState`로 주소 갱신
- 데스크톱(1440px) 좌측 패널 / 모바일(390px) 하단 슬라이드 시트(끌어서 펼침·접힘)

## 파일 구조

```
PKPilot0002/
├── index.html            화면 마크업 + 아이콘 스프라이트
├── style.css             HD2Lab 다크 테마 · 지도/패널/시트 레이아웃
├── app.js                Leaflet 지도 · 참가자 · 결과 UI
├── js/
│   ├── core.js           순수 계산 (거리·중간 지점·공평도·URL·역 추천) — DOM 의존 없음
│   ├── stations.js       수도권 지하철역 좌표 스냅샷 (자동 생성)
│   └── landmarks.js      만남 거점 랜드마크 9곳 (Nominatim 확인)
├── vendor/leaflet/       Leaflet 1.9.4 (CDN 장애 없이 동작하도록 로컬 번들)
├── tools/build_stations.py   stations.js 생성기 (Wikidata SPARQL)
├── tests/
│   ├── run_tests.py      단위 테스트 러너 (Playwright + http.server)
│   ├── unit/             테스트 하네스·케이스 58개
│   └── visual/capture.py 화면 검증 + 스크린샷
└── docs/screenshots/     데스크톱·모바일 스크린샷
```

## 로컬에서 실행

```sh
cd PKPilot0002
python3 -m http.server 8080
# http://localhost:8080/
```

ES 모듈을 쓰므로 `file://`로 열면 동작하지 않습니다. 정적 서버가 필요합니다.

## 테스트

```sh
python3 tests/run_tests.py            # 단위 테스트 58개
python3 tests/visual/capture.py --check   # Chromium 화면 검증
python3 tests/visual/capture.py       # 검증 + 스크린샷 갱신
```

- 단위 테스트: Haversine, 구면 무게중심, Weiszfeld·최소 외접원, 공평도, 좌표 정규화, URL 인코딩/파싱(잘못된 좌표·인원 초과·해시·전체 URL), 역 추천, 표시 형식
- 화면 검증: 타일 로드, 핀/마커 수, 결과 카드, URL 상태, 공유 링크 왕복, 모드 전환, 삭제/초기화, 모바일 시트 접힘·펼침
- Node.js 없이 Playwright(Chromium)만 사용합니다. `pip install playwright && playwright install chromium` 필요.

## 데이터 · 타일

| 대상 | 출처 | 비고 |
| --- | --- | --- |
| 지도 타일 | OpenStreetMap 표준 타일 | 다크 테마는 CSS 필터(`invert + hue-rotate`)로 톤만 바꿉니다. 외부 키 불필요 |
| 지오코딩 | Nominatim (search / reverse) | 공개 인스턴스 정책에 맞춰 요청을 1초 간격으로 큐잉, 결과 캐시 |
| 지하철역 좌표 | Wikidata (CC0) | `tools/build_stations.py`로 수도권 589개 역 생성 |
| 랜드마크 | OpenStreetMap Nominatim | `js/landmarks.js` |

> 지도 타일은 초기 기획의 CartoDB Dark Matter를 쓰지 않습니다. 2026년 11월 확인 결과 `basemaps.cartocdn.com`의 dark_all 타일이 **API 키 없이는 "API KEY REQUIRED" 워터마크 타일**을 돌려주기 때문입니다(키 없는 대안 중 OSM 타일을 선택). 필요하면 `app.js`의 `TILES` 상수만 교체하면 됩니다.

## 제약

- 네트워크가 있어야 지도·주소가 보입니다. 오프라인 캐시는 없습니다.
- Nominatim 공개 인스턴스는 초당 1회 수준으로만 호출합니다. 대량 사용 시 자체 프록시가 필요합니다.
- 거리는 직선(대권) 거리이고 도보 시간은 4.5km/h 기준 추정치입니다. 실제 이동 시간·경로는 반영하지 않습니다.
- 역 추천은 좌표 최근접 방식이라 출입구·환승 동선은 고려하지 않습니다.

## 브라우저

최신 Chromium·Safari·Firefox. ES 모듈, `dvh` 단위, `color-mix()`를 사용합니다(iOS 16.4+ / Safari 16.4+).
