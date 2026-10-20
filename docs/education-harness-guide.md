# 교육자료 작성 Harness Guide

## 프로젝트 경계

교육 사이트 소스는 Web-HQ와 같은 상위 폴더의 `EDPilot0001/`에서 관리합니다.
Web-HQ는 포트폴리오, 분석 자료, 이 작성 가이드를 관리합니다.

- 교육 사이트: https://hyangdan2.github.io/EDPilot0001/
- 소스 저장소: https://github.com/HyangDan2/EDPilot0001
- 기존 포트폴리오: https://hyangdan2.github.io/

EDPilot0001은 한국어 단일 정적 사이트입니다. 영어·일본어 판, 번역 데이터와
언어 선택 기능을 다시 생성하지 않습니다. 수학의 표준 영문 용어, 수식과 코드의
식별자는 필요에 따라 사용합니다. 사용자 지시가 이 가이드보다 우선합니다.

## 작업 시작

`Web-HQ` 안에서 작업하지 말고 형제 폴더인 EDPilot0001로 이동합니다.

```sh
cd ../EDPilot0001
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt -r requirements-format.txt
npm ci
python -m playwright install chromium
```

이미 설치된 환경이면 가상환경만 활성화합니다. Python 3.12 이상과 Node.js 22를
권장합니다. `README.md`와 `docs/curriculum-map.md`, 실제 소스를 함께 읽고
기존 검증 기록이 현재 코드에도 유효한지 확인합니다.

## 수정할 원본

| 대상 | 원본 | 역할 |
| --- | --- | --- |
| 기초 설명과 예제 | `tools/content.py`, `tools/content_more.py` | 7개 장, 수학 부록, 용어 |
| 심화 사례 | `tools/content_advanced.py` | 장별 사례 3개와 그림 연결 |
| 페이지 구조 | `tools/render_site.py` | 탐색, 테마 버튼, 실험실, 기본 Python/Notebook 생성 |
| 브라우저 계산 | `assets/js/math-core.js`, `assets/js/svm-core.js` | 수치 알고리즘 |
| 그래프와 상호작용 | `assets/js/figures.js`, `assets/js/labs.js` | 실험 결과와 시각화 |
| 표시 환경 | `assets/css/base.css`, `assets/js/navigation.js`, `assets/js/preferences.js` | 반응형, 인쇄, 테마 |
| 심화 계산 | `downloads/advanced-experiments.py`, `downloads/advanced-figures.py` | 수치 결과와 SVG 생성 |

생성된 `index.html`, `main.html`, `chapters/`, `labs/`, `appendix/` HTML을
직접 수정하지 않습니다. 기본 `study-examples.py`와 Notebook도 생성기가 덮어씁니다.
심화 결과 JSON, SVG와 Notebook은 `tools/enrich_site.py`로 다시 생성합니다.
한국어 원본은 루트에서 직접 생성하며 중간 번역 폴더가 필요하지 않습니다.

## 교육자료 작성 원칙

학습 목표 → 예상 질문 → 개념과 가정 → 단계별 계산 → 조건 비교 → 해석의 한계
순서로 작성합니다. 현재 구성인 7개 장, 5개 실험실, 3개 부록, 21개 심화 사례와
28개 비교 그림을 유지하며 확장 시 목차와 검증 기준도 함께 바꿉니다.

설명과 예제는 직접 작성하고 참고 문헌을 부록에 명시합니다. 참고 페이지의 문장,
연습문제나 그림을 그대로 복제하지 않습니다. 개인 경험이나 실제 성능을 지어내지 않습니다.

모든 실험 데이터는 합성임을 밝히고 생성식, 시드, 표본 수, 단위와 평가 구간을 기록합니다.
전처리는 훈련 데이터로만 적합합니다. 검증 데이터에 반복 조정한 결과를 최종 테스트
성능으로 표현하지 않습니다. PCA의 정규화와 복원 오차, GMM 책임값 합과 로그우도,
SVM 제약조건과 수렴 기준을 유지합니다. 미수렴 결과에는 근사치임을 표시합니다.
수치가 설명과 다르면 계산 원인을 조사하고 결과를 임의로 맞추지 않습니다.

## 생성과 검증

```sh
# 심화 계산을 변경했을 때만 먼저 실행
python tools/enrich_site.py

# 한국어 HTML/기본 예제 생성 및 배포 패키징
npm run build

# 독립 NumPy 검증, 수학/SVM 테스트, 링크·제목·한국어 검사
npm test

# 저장된 심화 Notebook 출력 재현
python tests/advanced_verify.py --notebook

# 배포 결과물을 하위 URL 경로에서 브라우저로 검증
npm run test:browser

# 소스 형식 정리 및 확인
npm run format
npm run format:check
```

`npm run build` 후 배포 산출물은 `output/site/`, ZIP은
`output/edpilot0001-static.zip`입니다. 포매팅으로 소스를 바꿨다면 다시 빌드합니다.
브라우저 검증은 17개 페이지를 1440/390/320px에서 확인하고, 5개 실험실의
입력 변경·초기화, 테마 저장, JavaScript 없는 본문과 HTTP 다운로드 해시를 검사합니다.
검증 보고서와 화면은 `output/`에 생성되며 Git에는 포함하지 않습니다.

```sh
python -m http.server 8000 --directory output/site
```

`http://localhost:8000/`에서 키보드 탐색, 초점 표시, 수식 가로 스크롤,
그림 대체 설명과 밝은/어두운 테마를 직접 확인합니다. 방문자에게 설치나 API 키를
요구하지 않고, 브라우저에는 테마 설정만 저장합니다.

## 배포

EDPilot0001의 `main`에 검증된 변경을 push합니다. `.github/workflows/deploy.yml`이
빌드·수학·정적 링크·브라우저 검증을 실행하고 통과한 `output/site/`만
GitHub Pages로 게시합니다. Settings → Pages의 Source는 GitHub Actions입니다.
GitHub Actions에서 수동 실행도 가능합니다.

배포 작업 성공 이후 공개 URL의 본문, CSS/JS, favicon, 중첩 장·실험실과 다운로드를
확인합니다. 저장소가 `EDPilot0001` 하위 경로로 공개되므로 사이트 내부 경로는
상대 URL로 유지합니다. Web-HQ 복귀 링크만 공개 포트폴리오 절대 URL을 사용합니다.

배포 실패 시 Actions 로그의 실패 단계를 수정하고 다시 검증·배포합니다.
이전 버전 복원이 필요하면 해당 변경을 revert한 뒤 같은 파이프라인으로 게시합니다.
사이트 소스·테스트·내부 문서는 공개 산출물에 넣지 않습니다.

## 작업 완료 보고

변경 내용, 실제 실행한 검증, 배포 커밋과 공개 URL을 기록합니다.
실행하지 않은 테스트를 통과했다고 보고하지 않습니다. 가이드의 절차와 실제 도구가
달라졌으면 이 Web-HQ 문서도 함께 갱신합니다.
