---
title: "사흘째 빨간불이던 CI: 앱이 아니라 엔진이 없었습니다"
date: 2026-11-18
category: Troubleshooting
summary: "AGPilot0003의 E2E 여섯 개가 Engine Offline으로 타임아웃되던 문제를 Playwright가 백엔드를 직접 띄우게 고쳤습니다. 그 과정에서 드러난 준비 대기 레이스와, 마지막까지 남아 있던 Pages 배포 잡까지 정리한 기록입니다."
tags: [github-actions, playwright, e2e, fastapi, ci]
layout: post
---

AGPilot0003은 브라우저에서 도면을 열고 편집하는 CAD 앱입니다. 프런트는 Vue 3 + Vite, 도면 계산은 FastAPI로 만든 **CoverFilm 지오메트리 엔진**이 맡습니다. 단위 테스트는 계속 초록불이었습니다. 그런데 `main`의 CI는 사흘 넘게 빨간불이었습니다.

## 증상

- `build` 잡이 `Run E2E tests` 단계에서 죽습니다.
- 화면의 엔진 상태 배지(`data-testid="cf-backend-status"`)가 계속 **Engine Offline**입니다.
- CoverFilm·CAD 코어를 다루는 E2E 여섯 개가 전부 타임아웃됩니다.
- 반면 Jest 단위 테스트는 정상이었습니다. 354개 스위트 중 352개 통과(2개 스킵), 테스트 2,463개 통과(2개 스킵).

즉 **코드가 깨진 게 아니라 테스트가 기대하는 환경이 없었습니다.** CI 로그에 남은 실패는 이런 모양이었습니다.

```text
19 × locator resolved to <span data-testid="cf-backend-status" class="cf-backend-tag is-offline">Engine Offline</span>
  - unexpected value "Engine Offline"
```

## 원인: 스펙은 진짜 엔진을 요구합니다

문제의 여섯 스펙은 화면만 확인하는 테스트가 아닙니다. `Engine Online`을 확인한 뒤, **실제로 DXF 파일을 `127.0.0.1:8000`의 엔진에 올려** 도면을 가져옵니다. README 3장과 `docs/USER_GUIDE.md`가 안내하는 로컬 실행 절차도 그래서 "백엔드를 먼저 띄우라"로 시작합니다.

개발자 컴퓨터에서는 손으로 띄운 엔진이 그 자리에 있었습니다. CI에는 아무도 띄워 주지 않았습니다. `playwright.config.ts`의 `webServer`에는 Vite 서버 하나만 있었기 때문입니다. 앱 결함이 아니라 **구성 누락**이었습니다.

## 해결 1 · Playwright가 엔진을 함께 띄우게 (PR #2 · `918fd17a`)

워크플로 파일을 고치는 방법도 있었지만, 그러면 로컬과 CI의 실행 조건이 다시 갈라집니다. 그래서 `webServer`를 배열로 바꿔 **앱과 엔진을 한 명령으로 함께 띄우게** 했습니다.

```ts
webServer: [
  {
    command: `pnpm dev --host 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000
  },
  {
    command: backendCommand,               // scripts/start-e2e-backend.sh | .ps1
    url: 'http://127.0.0.1:8000/api/v1/health',
    timeout: 300_000,                      // 첫 실행은 venv 생성 + 의존성 설치
    reuseExistingServer: !process.env.CI
  }
]
```

기동 스크립트는 README에 적혀 있던 수동 절차를 그대로 옮긴 것입니다.

- `backend/.venv`가 없으면 만들고, `backend/requirements.txt`를 설치합니다.
- 요구사항 파일이 바뀌면 다시 설치합니다. 설치 시점의 해시를 `.requirements.sha`에 남겨 두고 비교합니다.
- 마지막에 `uvicorn app.main:app`을 `127.0.0.1:8000`에 올립니다.
- Windows는 같은 일을 하는 `start-e2e-backend.ps1`을 씁니다.

`reuseExistingServer: !process.env.CI` 덕분에 로컬에서는 이미 띄워 둔 엔진을 그대로 쓰고, CI에서는 항상 새로 띄웁니다. **스펙은 한 줄도 고치지 않았습니다. 모킹도, 스킵도 없습니다.**

로컬에서 확인한 값은 이렇습니다.

| 상황 | 소요 |
| --- | --- |
| 첫 실행 (venv 생성 + 의존성 설치 + uvicorn) | 약 140초 |
| 이미 준비된 뒤 | 약 9초 |

이 PR의 검증 런(`44195201490`)에서 E2E 36개가 5분 42초 만에 전부 통과했습니다. 엔진 배지도 `Engine Online`으로 바뀌었습니다.

## 해결 2 · 엔진이 살아나자 드러난 레이스 (PR #3 · `82acca1d`)

엔진 문제를 걷어내자, 기다리고 있던 결함이 모습을 드러냈습니다. 머지 후 `main` 런(`44200297047`)에서 `nested INSERT Off vs Freeze follows AutoCAD layer semantics` 스펙 하나가 **세 번의 시도 모두** `null`로 실패했습니다. 나머지 35개는 통과했습니다.

원인은 스펙의 준비 대기였습니다.

```ts
await expect(page.locator('.ml-cad-container')).toBeVisible({ timeout: 30_000 })
await page.waitForTimeout(1500)   // 여기서 1.5초만 기다리고 바로 읽었습니다
```

`window.AcApDocManager.instance`는 `App.vue`의 `initialize()`가 `@mlightcad/cad-simple-viewer` 동적 임포트를 끝낸 뒤에야 생깁니다. 업로드한 INSERT가 모델 공간에 도착하는 것도 그와 별개입니다. 컨테이너가 보인 시점과 준비가 끝난 시점 사이에는 아무 보장이 없으니, 부하가 걸린 러너에서는 1.5초 뒤에 읽은 값이 `null`이었습니다. 로컬에서는 대개 통과하고 CI에서만 무너지는 전형적인 플레이크입니다.

고정 대기를 **준비 상태 폴링**으로 바꿨습니다.

```ts
await expect
  .poll(
    async () => (await readNestedInsertSceneState(page))?.insertObjectId,
    { timeout: 30_000 }
  )
  .toBeTruthy()
```

검증하는 내용과 커버리지는 그대로 두고, 기다리는 방식만 바꿨습니다. 기다릴 조건이 있으면 시간을 정하지 말고 조건을 기다리는 편이 맞습니다.

## 해결 3 · 마지막 빨간불은 테스트가 아니었습니다 (`8ff203e9`)

두 PR을 머지한 뒤에도 CI는 아직 빨간불이었습니다. 이번에는 다른 잡이 문제였습니다. `build` 잡은 초록불인데 `deploy-pages` 잡이 실패했습니다.

```text
Get Pages site failed. Please verify that the repository has Pages enabled
and configured to build using GitHub Actions...
Error: Not Found - https://docs.github.com/rest/pages/pages#get-a-pages-site
```

이 저장소는 백엔드 엔진이 필요한 프로젝트라 정적 Pages 배포를 쓰지 않습니다. 그런데 워크플로에는 예전 구성이 그대로 남아 매번 배포를 시도하고 있었습니다. 테스트와 무관한 잡이 전체 CI의 결과를 계속 failure로 만들고 있었던 것입니다.

`ci.yml`에서 `upload-pages`와 `deploy-pages` 두 잡을 걷어냈습니다(27줄 삭제). 빌드 잡 안의 가이드 빌드 단계는 그대로 두었습니다.

## 결과

마지막 커밋 `8ff203e9`의 런(`44209661363`)에서 `build` 잡이 전 구간 초록불로 끝났습니다.

| 항목 | 결과 |
| --- | --- |
| Jest 단위 테스트 | 2,463 통과 · 2 스킵 (스위트 352 통과 · 2 스킵) |
| Playwright E2E | 36 통과 · 1 스킵 |
| `build` 잡 | success |
| 전체 CI | success |

세 커밋의 역할을 정리하면 이렇습니다.

| 커밋 | 내용 | 결과 |
| --- | --- | --- |
| `918fd17a` (PR #2) | Playwright가 CoverFilm 엔진을 함께 기동 | Engine Offline 해소, E2E 6종 복구 |
| `82acca1d` (PR #3) | nested INSERT 스펙의 고정 대기 → 30초 폴링 | 플레이크 제거 |
| `8ff203e9` | Pages 업로드·배포 잡 제거 | 전체 CI success |

## 배운 것

- **빨간 CI가 항상 코드 문제는 아닙니다.** 먼저 "이 테스트가 무엇을 전제하는가"를 확인해야 합니다. 여기서는 엔진 프로세스 하나였고, 그 누락이 여섯 스펙을 한꺼번에 죽였습니다.
- **고친 뒤에 드러나는 실패는 진전입니다.** 엔진이 없을 때는 가려져 있던 레이스가 엔진을 켜자 바로 나왔습니다. 가려진 결함을 세는 것보다 하나씩 걷어내는 편이 빠릅니다.
- **고정 대기는 언젠가 터집니다.** `waitForTimeout(1500)`은 로컬에서 잘 통과합니다. 조건이 분명하면 `expect.poll`처럼 조건을 기다려야 합니다.
- **롤업이 아니라 잡을 봐야 합니다.** 테스트가 다 초록불이어도 워크플로 구성이 낡아 있으면 CI는 계속 빨간불입니다. 실패한 잡 이름을 먼저 읽는 습관이 시간을 아낍니다.
