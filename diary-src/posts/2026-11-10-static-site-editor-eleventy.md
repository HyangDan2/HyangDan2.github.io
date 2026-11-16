---
title: "정적 사이트에 에디터를 붙이는 가장 싼 방법"
date: 2026-11-10
category: Architecture
summary: "서버 없이 브라우저에서 글을 쓰고, GitHub 커밋 URL로 바로 올리는 구조를 정리한다."
tags: [eleventy, github-pages, editor, architecture]
layout: post
---

블로그를 하나 더 만들면서 제일 먼저 정한 것은 **서버를 두지 않는다**였다. 관리할 것이 늘면 결국 안 쓰게 된다. 대신 브라우저가 전부 하고, GitHub이 저장소와 배포를 맡는다.

## 구조

```text
HyangDan2.github.io/
├── index.html            # Web-HQ (정적)
├── diary-src/            # Eleventy 소스
│   ├── index.njk         # /diary/
│   ├── categories.njk    # /diary/categories/<slug>/
│   ├── write.njk         # /diary/write/  (클라이언트 에디터)
│   ├── posts/*.md        # 글
│   └── assets/
├── .github/workflows/deploy-pages.yml
└── (나머지 허브 디렉터리)
```

빌드는 두 단계다. Eleventy가 `diary-src/`를 `_site/`로 만들고, 워크플로가 그 결과를 저장소 루트의 정적 파일과 합쳐 `/diary/` 아래에 놓는다.

## 왜 서버가 필요 없나

글쓰기에 필요한 기능은 세 가지뿐이다. 입력, 미리보기, 저장.

| 기능 | 구현 | 비용 |
| --- | --- | --- |
| 입력 | `<textarea>` + 마크다운 파서 | 0 |
| 미리보기 | 같은 파서로 즉시 렌더 | 0 |
| 임시 저장 | `localStorage` | 0 |
| 최종 저장 | GitHub 웹 커밋 URL | 0 |

GitHub은 `new/<branch>/<path>` 경로에 `filename`과 `value` 쿼리를 받는다. 즉 **빈 파일 생성 화면에 내용을 미리 채워서** 열 수 있다.

```js
const url = `https://github.com/HyangDan2/HyangDan2.github.io/new/main/diary-src/posts`
  + `?filename=${encodeURIComponent(filename)}`
  + `&value=${encodeURIComponent(markdown)}`;
window.open(url, '_blank', 'noopener');
```

사용자는 파일이 채워진 화면을 보고 `Commit changes`만 누르면 된다. 서버도, 토큰도, 업로드 UI도 필요 없다.

## 대가

공짜는 아니다. 세 가지를 감수했다.

- **긴 글은 URL에 담기지 않는다.** 브라우저 URL 한계에 걸리면 `.md` 다운로드로 우회한다.
- **초안은 기기 안에만 있다.** 다른 기기에서 이어 쓰려면 파일을 옮겨야 한다.
- **커밋은 사용자가 누른다.** 자동 발행이 아니라는 점이 오히려 안전장치이기도 하다.

> 자동화는 편하지만, 마지막 한 번의 확인은 사람이 누르는 게 좋다. 특히 공개 저장소에 글이 올라갈 때는.

## 글 한 편의 머리말

모든 글은 같은 여섯 줄로 시작한다. 편집기가 이 형식을 그대로 만들어 준다.

```yaml
---
title: "정적 사이트에 에디터를 붙이는 가장 싼 방법"
date: 2026-11-10
category: Architecture
summary: "서버 없이 브라우저에서 글을 쓰고, GitHub 커밋 URL로 바로 올리는 구조."
tags: [eleventy, github-pages, editor]
layout: post
---
```

카테고리는 `Devlog`, `Architecture`, `Troubleshooting`, `Notes` 네 개를 기본으로 두고, 처음 보는 값이 들어오면 빌드할 때 자동으로 새 서랍이 생긴다.

## 정리

이 구조의 장점은 **실패했을 때 되돌리기 쉽다**는 것이다. 빌드가 깨지면 이전 커밋으로 돌리고, 잘못 쓴 글은 GitHub에서 바로 고친다. 서버가 없으니 새벽에 죽어 있을 것도 없다.
