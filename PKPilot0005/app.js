/* ==========================================================================
   HD2Lab | Solver (PKPilot0005)
   Static problem reader + answer card.
   - Demo mode: runs entirely in the browser (no network, no backend).
   - API mode : POST { text, image_base64, mode, hint } to a Server-HQ
                /api/solver/solve endpoint that fronts the AI Gateway.
   ========================================================================== */
(() => {
  'use strict';

  const STORE_API = 'pkpilot0005_api_v1';
  const STORE_HISTORY = 'pkpilot0005_history_v1';
  const HISTORY_MAX = 30;
  const MAX_IMAGE_EDGE = 1600;
  const MAX_IMAGE_BYTES = 1_500_000; // gateway body cap is 2 MiB, keep headroom

  const MODES = {
    auto: '자동 판독',
    quiz: '객관식',
    essay: '주관식·서술형',
    code: '코딩·디버깅',
    enpago: '엔파고다·어학',
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const dom = {
    connChip: $('#connChip'),
    connChipText: $('#connChipText'),
    portalMenuBtn: $('#portalMenuBtn'),
    portalMenuDropdown: $('#portalMenuDropdown'),
    problemText: $('#problemText'),
    charCount: $('#charCount'),
    clearText: $('#clearText'),
    dropZone: $('#dropZone'),
    dropIdle: $('#dropIdle'),
    fileInput: $('#fileInput'),
    thumbWrap: $('#thumbWrap'),
    thumb: $('#thumb'),
    thumbMeta: $('#thumbMeta'),
    clearImage: $('#clearImage'),
    modeChips: $('#modeChips'),
    hintInput: $('#hintInput'),
    solveBtn: $('#solveBtn'),
    resetBtn: $('#resetBtn'),
    formError: $('#formError'),
    emptyState: $('#emptyState'),
    loadingState: $('#loadingState'),
    loadingText: $('#loadingText'),
    loadingSteps: $('#loadingSteps'),
    answerCard: $('#answerCard'),
    badgeType: $('#badgeType'),
    badgeTopic: $('#badgeTopic'),
    badgeSrc: $('#badgeSrc'),
    answerTime: $('#answerTime'),
    answerValue: $('#answerValue'),
    answerSub: $('#answerSub'),
    stepList: $('#stepList'),
    pointsTitle: $('#pointsTitle'),
    pointList: $('#pointList'),
    answerNote: $('#answerNote'),
    copyBtn: $('#copyBtn'),
    againBtn: $('#againBtn'),
    historyList: $('#historyList'),
    historyEmpty: $('#historyEmpty'),
    clearHistory: $('#clearHistory'),
    apiBtn: $('#apiBtn'),
    apiDialog: $('#apiDialog'),
    apiClose: $('#apiClose'),
    apiUrl: $('#apiUrl'),
    apiAuth: $('#apiAuth'),
    apiToken: $('#apiToken'),
    tokenField: $('#tokenField'),
    apiTest: $('#apiTest'),
    apiSave: $('#apiSave'),
    apiClear: $('#apiClear'),
    apiStatus: $('#apiStatus'),
    toast: $('#toast'),
  };

  const state = {
    mode: 'auto',
    image: null,        // { dataUrl, name, width, height, bytes }
    api: { url: '', auth: 'none', token: '' },
    history: [],
    busy: false,
    answer: null,
    timers: [],
  };

  /* ---------------------------------------------------------------- utils -- */
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  function rich(text) {
    return escapeHtml(text)
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      .replace(/\n/g, '<br>');
  }

  const stripMarkup = (text) => String(text).replace(/\*\*/g, '').replace(/`/g, '');

  const pad = (n) => String(n).padStart(2, '0');
  function stamp(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function toast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => dom.toast.classList.remove('is-on'), 1900);
  }

  function showError(message) {
    dom.formError.textContent = message;
    dom.formError.hidden = false;
  }
  function hideError() {
    dom.formError.hidden = true;
    dom.formError.textContent = '';
  }

  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch { return fallback; }
  }
  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }

  /* ------------------------------------------------------------- samples -- */
  const SAMPLES = {
    quiz: {
      mode: 'quiz',
      text: `다음 일차방정식의 해를 구하시오.\n\n2x + 6 = 3x - 4\n\n① x = 2    ② x = 5    ③ x = 8    ④ x = 10    ⑤ 해가 없다`,
      hint: '고1 수학 · 일차방정식',
      image: null,
    },
    code: {
      mode: 'code',
      text: `def average(scores):
    total = 0
    for i in range(len(scores)):
        total += scores[i]
    return total / len(scores)

print(average([]))`,
      hint: '파이썬 · 실행하면 어떤 오류가 나고 왜 그런지',
      image: null,
    },
    image: {
      mode: 'enpago',
      text: '',
      hint: '영어 빈칸 채우기',
      image: { src: 'assets/sample-problem.png', name: 'sample-problem.png' },
    },
  };

  /* ---------------------------------------------------------- input state -- */
  function setMode(mode) {
    if (!MODES[mode]) return;
    state.mode = mode;
    $$('.chip', dom.modeChips).forEach((chip) => {
      const on = chip.dataset.mode === mode;
      chip.classList.toggle('is-on', on);
      chip.setAttribute('aria-pressed', String(on));
    });
  }

  function updateCount() {
    const n = dom.problemText.value.length;
    dom.charCount.textContent = `${n.toLocaleString('ko-KR')}자`;
  }

  function renderImage() {
    const img = state.image;
    if (!img) {
      dom.thumbWrap.hidden = true;
      dom.dropIdle.hidden = false;
      dom.dropZone.classList.remove('has-image');
      dom.thumb.removeAttribute('src');
      return;
    }
    dom.thumb.src = img.dataUrl || img.src;
    dom.thumb.alt = img.name ? `업로드한 문제 이미지: ${img.name}` : '업로드한 문제 이미지 미리보기';
    dom.thumbMeta.textContent = img.width
      ? `${img.width}×${img.height} · ${formatBytes(img.bytes)} · ${img.type || 'JPEG'}`
      : (img.name || '이미지');
    dom.thumbWrap.hidden = false;
    dom.dropIdle.hidden = true;
    dom.dropZone.classList.add('has-image');
  }

  function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  function clearImage() {
    state.image = null;
    dom.fileInput.value = '';
    renderImage();
  }

  function setImage(file) {
    return prepareImage(file).then((img) => {
      state.image = img;
      renderImage();
      hideError();
      return img;
    }).catch((err) => {
      showError(err && err.message ? err.message : '이미지를 읽지 못했습니다. 다른 파일로 시도해 주세요.');
      return null;
    });
  }

  /* Downscale + compress so the base64 stays under the gateway body limit. */
  function prepareImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type || '')) {
        reject(new Error('이미지 파일만 올릴 수 있습니다. (PNG · JPG · WEBP)'));
        return;
      }
      if (file.size > 12 * 1024 * 1024) {
        reject(new Error('이미지가 너무 큽니다. 12MB 이하 파일을 사용해 주세요.'));
        return;
      }
      const url = URL.createObjectURL(file);
      const base = new Image();
      base.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(base.width, base.height));
        const width = Math.max(1, Math.round(base.width * scale));
        const height = Math.max(1, Math.round(base.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(base, 0, 0, width, height);
        URL.revokeObjectURL(url);

        const qualities = [0.9, 0.8, 0.7, 0.6, 0.5];
        let index = 0;
        let dataUrl = '';
        const encode = () => {
          dataUrl = canvas.toDataURL('image/jpeg', qualities[index]);
          const bytes = Math.round((dataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75);
          if (bytes > MAX_IMAGE_BYTES && index < qualities.length - 1) {
            index += 1;
            encode();
            return;
          }
          const payload = Math.round((dataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75);
          resolve({
            dataUrl,
            name: file.name || 'capture.jpg',
            width,
            height,
            bytes: payload,
            type: 'JPEG',
            oversized: payload > MAX_IMAGE_BYTES,
          });
        };
        encode();
      };
      base.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('이미지를 열지 못했습니다. 다른 파일로 시도해 주세요.'));
      };
      base.src = url;
    });
  }

  /* Loads a sample image (PNG) as a data URL so API mode can send it. */
  async function sampleImage() {
    const response = await fetch('assets/sample-problem.png', { cache: 'force-cache' });
    if (!response.ok) throw new Error('sample image unavailable');
    const blob = await response.blob();
    const file = new File([blob], 'sample-problem.png', { type: 'image/png' });
    return prepareImage(file);
  }

  function loadSample(key) {
    const sample = SAMPLES[key];
    if (!sample) return;
    hideError();
    dom.problemText.value = sample.text;
    dom.hintInput.value = sample.hint || '';
    setMode(sample.mode);
    updateCount();
    clearImage();
    if (sample.image) {
      state.image = { src: sample.image.src, name: sample.image.name, width: 0, height: 0, bytes: 0 };
      renderImage();
      dom.thumb.onload = () => {
        if (!state.image || state.image.src !== sample.image.src) return;
        state.image.width = dom.thumb.naturalWidth;
        state.image.height = dom.thumb.naturalHeight;
        dom.thumbMeta.textContent = `${state.image.width}×${state.image.height} · 예시 캡처`;
      };
    }
    toast(`${MODES[sample.mode]} 예시를 불러왔습니다`);
  }

  /* --------------------------------------------------------- demo solver -- */
  function detectType(text, hasImage, hint) {
    if (state.mode !== 'auto') return state.mode;
    const t = `${text}\n${hint}`;
    if (hasImage && !text.trim()) return 'enpago';
    if (/(①|②|③|④|⑤|[ㄱ-ㅎ]\s*\.|^\s*\d\))/m.test(text)) return 'quiz';
    if (/(def |function |class |import |console\.log|return |=>|\bfor\s*\(|\bwhile\s*\(|NullPointer|Traceback|Error:|에러|버그|디버그|코드)/i.test(t)) return 'code';
    if (/(빈칸|어휘|문법|영어|영작|해석|다음\s*글|to부정사|관계대명사|as planned|sentence)/i.test(t)) return 'enpago';
    if (/(방정식|함수|미분|적분|확률|도형|수열|집합|삼각|로그|계산|구하시오|값을|넓이|부피)/.test(t)) return 'essay';
    return 'essay';
  }

  function detectTopic(text, type) {
    const t = text || '';
    if (type === 'code') return '프로그래밍 · 파이썬';
    if (type === 'enpago') return '영어 · 어휘/문법';
    if (/방정식|일차|이차|연립/.test(t)) return '수학 · 방정식';
    if (/미분|적분|극한/.test(t)) return '수학 · 미적분';
    if (/확률|경우의 수|순열|조합/.test(t)) return '수학 · 확률과 통계';
    if (/도형|삼각형|원의|넓이|부피|각도/.test(t)) return '수학 · 기하';
    if (/함수|그래프|정의역|치역/.test(t)) return '수학 · 함수';
    if (/조선|고려|근대|일제|역사/.test(t)) return '한국사';
    if (/물리|화학|생물|지구과학|전류|화학식|세포/.test(t)) return '과학';
    if (/국어|지문|시적|소설|문학|화자/.test(t)) return '국어 · 문학';
    if (/경제|수요|공급|금리/.test(t)) return '사회 · 경제';
    if (/빈칸|어휘|문법|영어|영작|전치사|시제/.test(t)) return '영어 · 어휘/문법';
    return '일반 · 판독';
  }

  /* Safely solve a single linear equation of the form ax + b = cx + d. */
  function solveLinear(text) {
    const flat = String(text).replace(/\s+/g, '').replace(/−/g, '-').replace(/–/g, '-');
    const match = flat.match(/(-?\d*(?:\.\d+)?)\*?[xX]([+-]\d+(?:\.\d+)?)?=(-?\d*(?:\.\d+)?)\*?[xX]([+-]\d+(?:\.\d+)?)?/);
    if (!match) return null;
    const coeff = (raw) => {
      if (raw === '' || raw === '+') return 1;
      if (raw === '-') return -1;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };
    const a = coeff(match[1]);
    const c = coeff(match[3]);
    const b = match[2] ? Number(match[2]) : 0;
    const d = match[4] ? Number(match[4]) : 0;
    if (a === null || c === null || a === c) return null;
    const x = (d - b) / (a - c);
    if (!Number.isFinite(x)) return null;
    return { a, b, c, d, x: Math.round(x * 1e6) / 1e6 };
  }

  function optionFor(text, value) {
    const pattern = /([①②③④⑤⑥⑦⑧⑨⑩])\s*([^①②③④⑤⑥⑦⑧⑨⑩\n]{0,40})/g;
    let m;
    while ((m = pattern.exec(text)) !== null) {
      const numbers = m[2].match(/-?\d+(?:\.\d+)?/g);
      if (!numbers) continue;
      if (numbers.some((n) => Math.abs(Number(n) - value) < 1e-9)) {
        return { mark: m[1], label: m[2].trim() };
      }
    }
    return null;
  }

  /* Tiny recursive-descent arithmetic evaluator (no eval). */
  function evalArithmetic(input) {
    const tokens = String(input).replace(/[×✕]/g, '*').replace(/[÷]/g, '/').replace(/\s+/g, '')
      .match(/\d+(?:\.\d+)?|[+\-*/^()]/g);
    if (!tokens || tokens.join('').length !== String(input).replace(/[×✕÷\s]/g, '').replace(/\*\*/g, '').length) return null;
    let i = 0;
    const parseExpr = () => {
      let value = parseTerm();
      while (tokens[i] === '+' || tokens[i] === '-') {
        const op = tokens[i++];
        const rhs = parseTerm();
        value = op === '+' ? value + rhs : value - rhs;
      }
      return value;
    };
    const parseTerm = () => {
      let value = parsePower();
      while (tokens[i] === '*' || tokens[i] === '/') {
        const op = tokens[i++];
        const rhs = parsePower();
        value = op === '*' ? value * rhs : value / rhs;
      }
      return value;
    };
    const parsePower = () => {
      const base = parseAtom();
      if (tokens[i] === '^') { i += 1; return Math.pow(base, parsePower()); }
      return base;
    };
    const parseAtom = () => {
      const token = tokens[i];
      if (token === '(') {
        i += 1;
        const value = parseExpr();
        if (tokens[i] !== ')') throw new Error('paren');
        i += 1;
        return value;
      }
      if (token === '-') { i += 1; return -parseAtom(); }
      const n = Number(token);
      if (!Number.isFinite(n)) throw new Error('token');
      i += 1;
      return n;
    };
    try {
      const value = parseExpr();
      if (i !== tokens.length || !Number.isFinite(value)) return null;
      return Math.round(value * 1e6) / 1e6;
    } catch { return null; }
  }

  function demoSolve(input) {
    const raw = input.text.trim();
    const type = detectType(raw, Boolean(input.image), input.hint);
    const topic = detectTopic(raw, type);
    const base = {
      source: 'demo',
      type,
      typeLabel: MODES[type],
      topic,
      at: new Date().toISOString(),
    };

    if (raw.includes('2x + 6 = 3x - 4') || raw.replace(/\s+/g, '').includes('2x+6=3x-4')) {
      return {
        ...base,
        type: 'quiz',
        typeLabel: MODES.quiz,
        topic: '수학 · 일차방정식',
        answer: '④ x = 10',
        answerSub: '양변을 정리하면 −x = −10 이므로 x = 10. 검산: 2(10) + 6 = 26 = 3(10) − 4 ✓',
        steps: [
          '좌변의 **+6**을 우변으로, 우변의 **3x**를 좌변으로 이항합니다. → `2x − 3x = −4 − 6`',
          '동류항을 정리합니다. → `−x = −10`',
          '양변을 **−1**로 나눕니다. → `x = 10`',
          '검산합니다. `2(10) + 6 = 26`, `3(10) − 4 = 26` — 양변이 같으므로 해가 맞습니다.',
          '보기와 대조하면 **④ x = 10** 이 정답입니다.',
        ],
        pointsTitle: '오답 소거 · 핵심 포인트',
        points: [
          '**② x = 5** — 이항할 때 부호를 바꾸지 않고 `2x + 3x`로 계산한 경우',
          '**③ x = 8** — 상수항을 옮기며 부호를 놓친 경우 (`−4 − 6` 대신 `−2`)',
          '**① x = 2** — 양변을 나눌 때 계수(−1) 대신 상수로 나눈 경우',
          '**⑤ 해가 없다** — 일차방정식은 `x`의 계수가 0이 아니면 해가 항상 하나입니다.',
          '핵심: **이항하면 부호가 바뀐다**, 그리고 **검산은 10초**면 끝납니다.',
        ],
        note: '데모 모드 · 브라우저 안에서 직접 계산한 풀이입니다.',
      };
    }

    if (raw.includes('def average') || (type === 'code' && /average|ZeroDivision|len\(/.test(raw))) {
      return {
        ...base,
        type: 'code',
        typeLabel: MODES.code,
        topic: '프로그래밍 · 파이썬 예외',
        answer: 'ZeroDivisionError — 빈 리스트에서 `len(scores) == 0`',
        answerSub: '`average([])` → `total = 0`, `len(scores) = 0` → `0 / 0` 에서 예외가 발생합니다.',
        steps: [
          '**재현**: `average([])`를 호출하면 반복문은 한 번도 돌지 않고 `total`은 0으로 남습니다.',
          '**원인**: `total / len(scores)` 에서 분모가 0입니다. 입력이 비었을 때의 경계값 처리가 빠져 있습니다.',
          '**수정**: 빈 입력을 먼저 걸러 냅니다.\n`def average(scores):`\n`    if not scores:`\n`        return 0.0`\n`    return sum(scores) / len(scores)`',
          '**검증**: `average([]) == 0.0`, `average([90, 80]) == 85.0` — 두 경우 모두 통과합니다.',
          '**정책 선택**: 평균이 정의되지 않는 것이 맞다면 `raise ValueError("scores is empty")` 로 명시하는 편이 낫습니다.',
        ],
        pointsTitle: '핵심 포인트 · 리팩터링',
        points: [
          '경계값 테스트 3종: **빈 리스트 · 원소 1개 · 음수/0 포함**',
          '`for` + 인덱스 누적 대신 **`sum(scores) / len(scores)`** 로 의도를 드러냅니다.',
          '부동소수 오차가 민감하면 **`math.fsum`** 을 사용합니다.',
          '시그니처에 **타입 힌트**(`scores: list[float] -> float`)를 붙이면 빈 입력 계약이 문서화됩니다.',
        ],
        note: '데모 모드 · 코드 패턴을 읽고 정적 분석한 결과입니다.',
      };
    }

    if (input.image && (!raw || /sample-problem|빈칸|as planned|Despite/.test(`${raw} ${input.hint}`))) {
      return {
        ...base,
        type: 'enpago',
        typeLabel: MODES.enpago,
        topic: '영어 · 빈칸 추론',
        answer: '③ went ahead',
        answerSub: 'Despite the heavy rain, the outdoor concert **went ahead** as planned. — “폭우에도 불구하고 야외 공연은 예정대로 진행되었다.”',
        steps: [
          '**판독**: 캡처의 문장은 `Despite the heavy rain, the outdoor concert ______ as planned.` 이고, 보기는 ① was called off ② was postponed ③ went ahead ④ was delayed ⑤ got cancelled 입니다.',
          '**문법**: `Despite` 는 전치사로 “~에도 불구하고”라는 **양보**를 만듭니다. 양보 뒤 주절은 기대와 반대되는 결과가 와야 합니다.',
          '**어휘**: `go ahead`(예정대로 진행되다) · `call off`(취소하다) · `postpone`(연기하다) 중 `as planned` 와 자연스럽게 결합하는 것은 **go ahead** 입니다.',
          '**정답**: `③ went ahead` (과거 서사 시제). 능동 표현 대신 `was held` 를 쓴다면 그것도 문맥상 인정됩니다.',
          '**검산**: “폭우에도 불구하고 예정대로 진행되었다” — 양보 접속사와 주절의 의미가 일치합니다.',
        ],
        pointsTitle: '오답 소거 · 핵심 포인트',
        points: [
          '**① was called off / ⑤ got cancelled** — “취소되다”. 양보 표현 뒤에서 의미가 뒤집힙니다.',
          '**② was postponed / ④ was delayed** — “연기되다”. `as planned`(예정대로)와 정면으로 충돌합니다.',
          '`Despite`(전치사 + 명사) vs `Although`(접속사 + 절) — 뒤에 오는 형태를 먼저 확인합니다.',
          '빈칸 앞뒤에 시간 표현이 없으면 **과거 서사 시제**를 유지합니다.',
        ],
        note: '데모 모드 · 예시 캡처에 대한 고정 풀이입니다. 실제 캡처 판독은 API 모드에서 동작합니다.',
      };
    }

    /* Generic, honest demo: analyse the problem, do not invent an answer. */
    const equation = solveLinear(raw);
    if (equation) {
      const picked = optionFor(raw, equation.x);
      const answer = picked ? `${picked.mark} ${picked.label || `x = ${equation.x}`}` : `x = ${equation.x}`;
      return {
        ...base,
        answer,
        answerSub: `주어진 식 ${equation.a}x ${equation.b >= 0 ? '+' : '−'} ${Math.abs(equation.b)} = ${equation.c}x ${equation.d >= 0 ? '+' : '−'} ${Math.abs(equation.d)} 를 정리하면 x = ${equation.x} 입니다.`,
        steps: [
          `좌변과 우변의 x 항을 한쪽으로 모읍니다. → \`(${equation.a} − ${equation.c})x = ${equation.d} − (${equation.b})\``,
          `계수를 계산합니다. → \`${equation.a - equation.c}x = ${equation.d - equation.b}\``,
          `양변을 x의 계수 ${equation.a - equation.c} 로 나눕니다. → \`x = ${equation.x}\``,
          '구한 값을 원식에 대입해 양변이 같은지 검산합니다.',
        ],
        pointsTitle: '핵심 포인트',
        points: [
          '이항할 때는 **부호를 반드시 바꿉니다**.',
          '계수가 분수·소수면 양변에 최소공배수를 곱해 정수로 만든 뒤 풉니다.',
          '답을 낼 때 **단위·조건**(x > 0 등)이 문제에 있는지 확인합니다.',
        ],
        note: '데모 모드 · 입력에서 일차방정식을 찾아 브라우저에서 직접 풀었습니다.',
      };
    }

    const arith = /^[\d\s+\-*/^().×÷]+$/.test(raw) ? evalArithmetic(raw) : null;
    if (arith !== null) {
      return {
        ...base,
        type: 'essay',
        typeLabel: MODES.essay,
        topic: '수학 · 계산',
        answer: String(arith),
        answerSub: `\`${raw}\` 를 연산 우선순위(괄호 → 지수 → 곱셈·나눗셈 → 덧셈·뺄셈)대로 계산했습니다.`,
        steps: [
          '괄호 안을 먼저 계산합니다.',
          '곱셈·나눗셈을 왼쪽부터 차례로 처리합니다.',
          '덧셈·뺄셈을 마무리하고 결과를 정리합니다.',
        ],
        pointsTitle: '핵심 포인트',
        points: [
          '나눗셈을 곱셈으로 바꾸면 약분이 빨라집니다.',
          '음수 부호는 괄호 앞까지 함께 묶어 실수를 줄입니다.',
        ],
        note: '데모 모드 · 브라우저 계산기로 검산한 결과입니다.',
      };
    }

    const excerpt = raw.replace(/\s+/g, ' ').slice(0, 120);
    return {
      ...base,
      answer: '정답 판독에는 API 연결이 필요합니다',
      answerSub: input.image
        ? '이미지 판독은 Server-HQ AI Gateway의 비전 모델이 필요합니다. 데모는 예시 캡처에 한해 동작합니다.'
        : '데모 모드는 예시 문제와 일차방정식·단순 계산만 직접 풉니다. 연결하면 실제 모델이 단계별로 풀이합니다.',
      steps: [
        `**입력 요약**: “${excerpt}${raw.length > 120 ? '…' : ''}”`,
        `**유형 판독**: ${MODES[type]} · ${topic} 로 분류했습니다. (판독은 휴리스틱입니다)`,
        '**풀이 전략**: 요구사항 → 주어진 조건 → 사용할 개념 → 계산 → 검산 순서로 접근합니다.',
        '**다음 단계**: 헤더의 `API 연결`에서 Server-HQ 엔드포인트를 저장하면 실제 모델이 정답과 근거를 생성합니다.',
      ],
      pointsTitle: '핵심 포인트',
      points: [
        '데모 모드는 **브라우저 안에서만** 동작하며 문제를 외부로 보내지 않습니다.',
        '연결 후에도 전송되는 것은 입력한 텍스트와 캡처뿐이며, 토큰은 이 브라우저에만 저장됩니다.',
      ],
      note: '데모 모드 · 이 입력에 대한 정답은 계산하지 않았습니다 (임의의 정답을 만들지 않습니다).',
    };
  }

  /* ----------------------------------------------------------- API calls -- */
  function apiConfigured() {
    return Boolean(state.api.url);
  }

  function authHeaders() {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (state.api.auth === 'bearer' && state.api.token) {
      headers.Authorization = `Bearer ${state.api.token}`;
    }
    return headers;
  }

  function healthUrl(url) {
    const trimmed = url.replace(/\/+$/, '');
    if (/\/solve$/i.test(trimmed)) return trimmed.replace(/\/solve$/i, '/health');
    return `${trimmed}/health`;
  }

  async function fetchJson(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        credentials: state.api.auth === 'cookie' ? 'include' : 'same-origin',
      });
      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      if (!response.ok) {
        const message = (data && (data.detail || data.error || data.message)) || `HTTP ${response.status}`;
        throw new Error(typeof message === 'string' ? message : `HTTP ${response.status}`);
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async function testConnection(url = dom.apiUrl.value.trim()) {
    if (!url) {
      setApiStatus('bad', '엔드포인트 주소를 먼저 입력해 주세요.');
      return false;
    }
    setApiStatus('wait', '연결을 확인하는 중…');
    const started = performance.now();
    try {
      const data = await fetchJson(healthUrl(url), { method: 'GET', headers: authHeaders() }, 9000);
      const ms = Math.round(performance.now() - started);
      const parts = [];
      if (data && typeof data === 'object') {
        if (data.gateway) parts.push(`gateway ${data.gateway}`);
        if (data.route) parts.push(`route ${data.route}`);
        if (data.engine) parts.push(`engine ${data.engine}`);
        if (data.model) parts.push(`model ${data.model}`);
      }
      setApiStatus('ok', `연결됨 · ${ms}ms${parts.length ? ` · ${parts.join(' · ')}` : ''}`);
      return true;
    } catch (err) {
      const reason = err && err.name === 'AbortError' ? '응답 시간 초과(9s)' : (err && err.message) || '알 수 없는 오류';
      setApiStatus('bad', `연결 실패 — ${reason}. 주소·CORS 허용 도메인·서버 상태를 확인하세요.`);
      return false;
    }
  }

  function setApiStatus(kind, message) {
    dom.apiStatus.hidden = false;
    dom.apiStatus.classList.remove('is-ok', 'is-bad', 'is-wait');
    dom.apiStatus.classList.add(kind === 'ok' ? 'is-ok' : kind === 'bad' ? 'is-bad' : 'is-wait');
    dom.apiStatus.textContent = message;
  }

  function normalizeApiResult(payload, fallbackType) {
    const root = payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object' ? payload.data : payload;
    let data = root;
    const contentKeys = ['content', 'text', 'answer_markdown', 'result'];
    if (data && typeof data.answer !== 'string') {
      for (const key of contentKeys) {
        const candidate = data[key];
        if (typeof candidate === 'string' && candidate.trim().startsWith('{')) {
          try { data = JSON.parse(candidate); break; } catch { /* keep going */ }
        }
      }
    }
    if (!data || typeof data !== 'object') {
      return makeResult(fallbackType, { answer: String(payload || '응답이 비어 있습니다.'), steps: [], points: [], model: '' });
    }
    const pick = (keys) => {
      for (const key of keys) {
        if (data[key] !== undefined && data[key] !== null) return data[key];
      }
      return undefined;
    };
    const toArray = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).filter(Boolean);
      if (typeof value === 'string') {
        return value.split(/\n+/).map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean);
      }
      return [String(value)];
    };
    let answer = pick(['answer', 'final_answer', '정답', 'solution_answer']);
    let steps = toArray(pick(['steps', 'reasoning', 'solution', '풀이', 'step_by_step']));
    let points = toArray(pick(['key_points', 'points', 'distractors', 'distractor_notes', 'takeaways', '핵심']));
    if (answer === undefined) {
      const content = pick(['content', 'text', 'message', 'result']);
      if (typeof content === 'string' && content.trim()) {
        const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
        answer = lines[0];
        const rest = lines.slice(1);
        if (!steps.length) steps = rest.filter((l) => /^(\d+[.)]|[-*•])/.test(l)).map((l) => l.replace(/^(\d+[.)]|[-*•])\s*/, ''));
        if (!steps.length && rest.length) steps = rest;
      }
    }
    const typeRaw = pick(['problem_type', 'type', 'mode']);
    const type = MODES[typeRaw] ? typeRaw : (fallbackType === 'auto' ? 'essay' : fallbackType);
    return {
      source: 'api',
      type,
      typeLabel: MODES[type] || MODES.essay,
      topic: pick(['topic', 'key_topic', '주제']) || detectTopic(String(answer || ''), type),
      answer: String(answer ?? '응답 형식을 해석하지 못했습니다.'),
      answerSub: pick(['answer_detail', 'explanation', 'summary', 'note']) || '',
      steps,
      points,
      pointsTitle: points.length ? (pick(['points_title']) || '핵심 포인트') : '핵심 포인트',
      note: `${state.api.auth === 'cookie' ? 'SSO 세션' : 'API'} 모드 · ${pick(['model']) || 'Server-HQ gateway'}${pick(['elapsed_ms']) ? ` · ${pick(['elapsed_ms'])}ms` : ''}`,
      at: new Date().toISOString(),
    };
  }

  function makeResult(type, partial) {
    return {
      source: partial.source || 'api',
      type,
      typeLabel: MODES[type] || MODES.essay,
      topic: partial.topic || '일반 · 판독',
      answer: partial.answer || '',
      answerSub: partial.answerSub || '',
      steps: partial.steps || [],
      points: partial.points || [],
      pointsTitle: '핵심 포인트',
      note: partial.note || '',
      at: new Date().toISOString(),
    };
  }

  async function apiSolve(input) {
    const started = performance.now();
    const body = {
      text: input.text,
      image_base64: input.image ? (input.image.dataUrl || null) : null,
      mode: input.mode,
      hint: input.hint,
    };
    const payload = await fetchJson(state.api.url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    }, 120000);
    const result = normalizeApiResult(payload, input.mode);
    const elapsed = Math.round(performance.now() - started);
    if (!/·\s*\d+ms$/.test(result.note)) result.note = `${result.note} · ${elapsed}ms`;
    return result;
  }

  /* ---------------------------------------------------------- answer view -- */
  function renderAnswer(result) {
    state.answer = result;
    dom.emptyState.hidden = true;
    dom.loadingState.hidden = true;
    dom.answerCard.hidden = false;

    dom.badgeType.textContent = result.typeLabel || MODES.essay;
    dom.badgeTopic.textContent = result.topic || '일반 · 판독';
    const isApi = result.source === 'api';
    dom.badgeSrc.textContent = isApi ? 'API' : 'DEMO';
    dom.badgeSrc.classList.toggle('is-api', isApi);
    dom.answerTime.textContent = stamp(result.at);

    dom.answerValue.textContent = result.answer || '';
    if (result.answerSub) {
      dom.answerSub.innerHTML = rich(result.answerSub);
      dom.answerSub.hidden = false;
    } else {
      dom.answerSub.hidden = true;
      dom.answerSub.textContent = '';
    }

    dom.stepList.innerHTML = '';
    (result.steps || []).forEach((step) => {
      const li = document.createElement('li');
      li.innerHTML = rich(step);
      dom.stepList.appendChild(li);
    });
    if (!result.steps || !result.steps.length) {
      const li = document.createElement('li');
      li.textContent = '단계별 풀이가 응답에 포함되지 않았습니다.';
      dom.stepList.appendChild(li);
    }

    dom.pointsTitle.innerHTML = `${escapeHtml(result.pointsTitle || '핵심 포인트')} <span>KEY POINTS</span>`;
    dom.pointList.innerHTML = '';
    (result.points || []).forEach((point) => {
      const li = document.createElement('li');
      li.innerHTML = rich(point);
      dom.pointList.appendChild(li);
    });
    dom.pointList.closest('.answer-section').hidden = !(result.points && result.points.length);

    dom.answerNote.textContent = result.note || '';
    dom.answerNote.hidden = !result.note;
  }

  function resetAnswerView() {
    state.answer = null;
    dom.answerCard.hidden = true;
    dom.loadingState.hidden = true;
    dom.emptyState.hidden = false;
  }

  function answerText(result) {
    const lines = [];
    lines.push(`[정답] ${stripMarkup(result.answer || '')}`);
    if (result.answerSub) lines.push(stripMarkup(result.answerSub));
    if (result.steps && result.steps.length) {
      lines.push('');
      lines.push('[단계별 풀이]');
      result.steps.forEach((step, i) => lines.push(`${i + 1}. ${stripMarkup(step).replace(/\n/g, ' ')}`));
    }
    if (result.points && result.points.length) {
      lines.push('');
      lines.push(`[${result.pointsTitle || '핵심 포인트'}]`);
      result.points.forEach((point) => lines.push(`- ${stripMarkup(point)}`));
    }
    lines.push('');
    lines.push(`HD2Lab Solver · ${result.typeLabel} · ${result.topic}`);
    return lines.join('\n');
  }

  async function copyAnswer() {
    if (!state.answer) return;
    const text = answerText(state.answer);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      }
      toast('답안을 복사했습니다');
      const label = dom.copyBtn.querySelector('span');
      if (label) {
        label.textContent = '복사됨';
        setTimeout(() => { label.textContent = '답안 복사'; }, 1600);
      }
    } catch {
      toast('복사가 차단되었습니다. 길게 눌러 선택해 주세요.');
    }
  }

  /* -------------------------------------------------------------- loading -- */
  function clearTimers() {
    state.timers.forEach((t) => clearTimeout(t));
    state.timers = [];
  }

  function markLoadingStep(index) {
    $$('li', dom.loadingSteps).forEach((li) => {
      li.classList.toggle('is-done', Number(li.dataset.step) < index);
    });
  }

  function beginLoading(label) {
    dom.emptyState.hidden = true;
    dom.answerCard.hidden = true;
    dom.loadingState.hidden = false;
    dom.loadingText.textContent = label;
    markLoadingStep(0);
  }

  /* ----------------------------------------------------------------- solve -- */
  async function solve() {
    if (state.busy) return;
    hideError();
    const text = dom.problemText.value.trim();
    const hint = dom.hintInput.value.trim();
    if (!text && !state.image) {
      showError('문제 텍스트나 이미지를 먼저 넣어 주세요.');
      dom.problemText.focus();
      return;
    }
    if (!text && state.image && state.mode === 'auto' && !apiConfigured()) {
      // demo can only answer the bundled capture example
      if (!/sample-problem/.test(state.image.src || state.image.name || '')) {
        showError('이미지 판독은 API 모드에서 동작합니다. 텍스트를 함께 넣거나 API를 연결해 주세요.');
        return;
      }
    }

    state.busy = true;
    dom.solveBtn.disabled = true;
    clearTimers();
    beginLoading(apiConfigured() ? '문제를 판독하는 중…' : '문제를 읽는 중…');

    const input = { text, mode: state.mode, hint, image: state.image };
    try {
      let result;
      if (apiConfigured()) {
        let step = 0;
        const tick = setInterval(() => {
          step = Math.min(step + 1, 2);
          markLoadingStep(step);
          dom.loadingText.textContent = ['이미지·텍스트 정리 중…', '유형과 주제 판독 중…', '풀이 생성 중…'][step] || '풀이 생성 중…';
        }, 2400);
        state.timers.push(tick);
        try {
          if (input.image && !input.image.dataUrl) {
            const prepared = await sampleImage();
            input.image = { ...input.image, ...prepared };
            state.image = input.image;
            renderImage();
          }
          result = await apiSolve(input);
        } finally {
          clearInterval(tick);
        }
      } else {
        await new Promise((resolve) => {
          state.timers.push(setTimeout(() => markLoadingStep(1), 220));
          state.timers.push(setTimeout(() => {
            markLoadingStep(2);
            dom.loadingText.textContent = '답안 카드를 만드는 중…';
          }, 460));
          state.timers.push(setTimeout(resolve, 720));
        });
        if (input.image && !input.image.dataUrl && /sample-problem/.test(input.image.src || input.image.name || '')) {
          try {
            const prepared = await sampleImage();
            input.image = { ...input.image, ...prepared };
            state.image = input.image;
            renderImage();
          } catch { /* preview only, demo answer already cached */ }
        }
        result = demoSolve(input);
      }
      renderAnswer(result);
      saveHistory(input, result);
      dom.answerCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (err) {
      dom.loadingState.hidden = true;
      dom.emptyState.hidden = false;
      const message = err && err.name === 'AbortError'
        ? '응답 시간이 초과되었습니다(120s). 서버 상태를 확인하거나 데모 모드로 전환해 주세요.'
        : (err && err.message) || '풀이에 실패했습니다.';
      showError(`API 오류 — ${message}`);
    } finally {
      state.busy = false;
      dom.solveBtn.disabled = false;
    }
  }

  /* --------------------------------------------------------------- history -- */
  function loadHistory() {
    const stored = readStore(STORE_HISTORY, []);
    state.history = Array.isArray(stored) ? stored.filter((item) => item && item.id && item.result) : [];
    renderHistory();
  }

  function saveHistory(input, result) {
    const item = {
      id: `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      at: result.at || new Date().toISOString(),
      type: result.type,
      typeLabel: result.typeLabel,
      topic: result.topic,
      question: (input.text || (input.image ? '[이미지] 캡처 판독' : '')).slice(0, 8000),
      hint: input.hint || '',
      mode: input.mode,
      result: { ...result },
    };
    state.history.unshift(item);
    if (state.history.length > HISTORY_MAX) state.history.length = HISTORY_MAX;
    persistHistory();
    renderHistory();
  }

  function persistHistory() {
    if (writeStore(STORE_HISTORY, state.history)) return;
    // Quota guard: keep the newest few, drop step bodies if still too large.
    state.history = state.history.slice(0, 8);
    if (writeStore(STORE_HISTORY, state.history)) return;
    state.history = state.history.slice(0, 5).map((item) => ({
      ...item,
      result: { ...item.result, steps: (item.result.steps || []).slice(0, 3), points: (item.result.points || []).slice(0, 3) },
    }));
    writeStore(STORE_HISTORY, state.history);
  }

  function renderHistory() {
    dom.historyList.innerHTML = '';
    dom.historyEmpty.hidden = state.history.length > 0;
    dom.clearHistory.hidden = state.history.length === 0;
    dom.clearHistory.textContent = '전체 삭제';
    state.history.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.dataset.id = item.id;

      const top = document.createElement('div');
      top.className = 'history-top';
      const type = document.createElement('span');
      type.className = 'history-type';
      type.textContent = item.typeLabel || MODES[item.type] || '문제';
      const when = document.createElement('time');
      when.className = 'history-when';
      when.textContent = stamp(item.at);
      top.append(type, when);

      const question = document.createElement('p');
      question.className = 'history-q';
      question.textContent = (item.question || '이미지 판독').replace(/\s+/g, ' ').slice(0, 140);

      const answer = document.createElement('p');
      answer.className = 'history-a';
      answer.textContent = stripMarkup(item.result.answer || '').slice(0, 80);

      const actions = document.createElement('div');
      actions.className = 'history-actions';
      const load = document.createElement('button');
      load.type = 'button';
      load.className = 'link-btn';
      load.textContent = '불러오기';
      load.dataset.action = 'load';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'link-btn danger';
      remove.textContent = '삭제';
      remove.dataset.action = 'delete';
      actions.append(load, remove);

      li.append(top, question, answer, actions);
      dom.historyList.appendChild(li);
    });
  }

  function loadHistoryItem(id) {
    const item = state.history.find((h) => h.id === id);
    if (!item) return;
    dom.problemText.value = item.question.startsWith('[이미지]') ? '' : item.question;
    dom.hintInput.value = item.hint || '';
    setMode(MODES[item.mode] ? item.mode : 'auto');
    updateCount();
    renderAnswer(item.result);
    dom.answerCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    toast('기록을 불러왔습니다');
  }

  function deleteHistoryItem(id) {
    state.history = state.history.filter((h) => h.id !== id);
    persistHistory();
    renderHistory();
    toast('기록을 삭제했습니다');
  }

  function clearAllHistory() {
    if (dom.clearHistory.dataset.armed !== '1') {
      dom.clearHistory.dataset.armed = '1';
      dom.clearHistory.textContent = '정말 전체 삭제?';
      setTimeout(() => {
        dom.clearHistory.dataset.armed = '0';
        dom.clearHistory.textContent = '전체 삭제';
      }, 4000);
      return;
    }
    state.history = [];
    persistHistory();
    renderHistory();
    toast('풀이 기록을 모두 지웠습니다');
  }

  /* ------------------------------------------------------------- api dialog -- */
  function openApiDialog() {
    dom.apiUrl.value = state.api.url || '';
    dom.apiAuth.value = state.api.auth || 'none';
    dom.apiToken.value = state.api.token || '';
    syncTokenField();
    dom.apiStatus.hidden = true;
    dom.apiStatus.className = 'api-status';
    if (typeof dom.apiDialog.showModal === 'function' && !dom.apiDialog.open) dom.apiDialog.showModal();
    else dom.apiDialog.setAttribute('open', '');
    setTimeout(() => dom.apiUrl.focus(), 40);
  }

  function closeApiDialog() {
    if (typeof dom.apiDialog.close === 'function' && dom.apiDialog.open) dom.apiDialog.close();
    else dom.apiDialog.removeAttribute('open');
  }

  function syncTokenField() {
    dom.tokenField.hidden = dom.apiAuth.value !== 'bearer';
  }

  function saveApiConfig() {
    const url = dom.apiUrl.value.trim().replace(/\/+$/, '');
    const auth = dom.apiAuth.value;
    const token = dom.apiToken.value.trim();
    if (url && !/^https?:\/\/[^\s]+$/i.test(url)) {
      setApiStatus('bad', 'http:// 또는 https://로 시작하는 주소를 넣어 주세요.');
      return;
    }
    if (auth === 'bearer' && !token) {
      setApiStatus('bad', '베어러 토큰을 입력하거나 인증 방식을 바꿔 주세요.');
      return;
    }
    state.api = { url, auth, token };
    writeStore(STORE_API, state.api);
    reflectApiState();
    if (!url) {
      setApiStatus('wait', 'API 연결을 해제했습니다. 데모 모드로 동작합니다.');
      toast('데모 모드로 전환했습니다');
      return;
    }
    toast('API 설정을 저장했습니다');
    setApiStatus('wait', '저장했습니다. 연결을 확인하는 중…');
    testConnection(url);
  }

  function clearApiConfig() {
    state.api = { url: '', auth: 'none', token: '' };
    try { localStorage.removeItem(STORE_API); } catch { /* ignore */ }
    dom.apiUrl.value = '';
    dom.apiAuth.value = 'none';
    dom.apiToken.value = '';
    syncTokenField();
    reflectApiState();
    setApiStatus('wait', '연결을 해제했습니다. 데모 모드로 동작합니다.');
    toast('데모 모드로 전환했습니다');
  }

  function reflectApiState() {
    const connected = apiConfigured();
    dom.connChip.dataset.state = connected ? 'api' : 'demo';
    dom.connChipText.textContent = connected ? 'API 연결' : '데모 모드';
    dom.connChip.title = connected
      ? `API 연결됨 — ${state.api.url} (눌러서 변경)`
      : '데모 모드 — 눌러서 Server-HQ API 연결';
  }

  /* ----------------------------------------------------------------- events -- */
  function bindEvents() {
    dom.problemText.addEventListener('input', () => { updateCount(); if (!dom.formError.hidden) hideError(); });
    dom.clearText.addEventListener('click', () => {
      dom.problemText.value = '';
      updateCount();
      dom.problemText.focus();
    });

    dom.modeChips.addEventListener('click', (event) => {
      const chip = event.target.closest('.chip');
      if (!chip) return;
      setMode(chip.dataset.mode);
    });

    $$('.sample-btn').forEach((btn) => {
      btn.addEventListener('click', () => loadSample(btn.dataset.sample));
    });

    dom.dropZone.addEventListener('click', (event) => {
      if (event.target.closest('#clearImage')) return;
      dom.fileInput.click();
    });
    dom.dropZone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        dom.fileInput.click();
      }
    });
    dom.fileInput.addEventListener('change', () => {
      const file = dom.fileInput.files && dom.fileInput.files[0];
      if (file) setImage(file);
    });
    dom.clearImage.addEventListener('click', (event) => {
      event.stopPropagation();
      clearImage();
    });

    ['dragenter', 'dragover'].forEach((type) => {
      dom.dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        dom.dropZone.classList.add('is-drag');
      });
    });
    ['dragleave', 'dragend'].forEach((type) => {
      dom.dropZone.addEventListener(type, () => dom.dropZone.classList.remove('is-drag'));
    });
    dom.dropZone.addEventListener('drop', (event) => {
      event.preventDefault();
      dom.dropZone.classList.remove('is-drag');
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) setImage(file);
    });
    // drop anywhere on the page still lands in the box
    window.addEventListener('dragover', (event) => { if (event.dataTransfer && event.dataTransfer.types.includes('Files')) event.preventDefault(); });
    window.addEventListener('drop', (event) => {
      if (!event.dataTransfer || !event.dataTransfer.files || !event.dataTransfer.files.length) return;
      event.preventDefault();
      if (event.target.closest && event.target.closest('.dropzone')) return;
      setImage(event.dataTransfer.files[0]);
    });

    document.addEventListener('paste', (event) => {
      const items = event.clipboardData && event.clipboardData.items;
      if (!items) return;
      for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            setImage(file);
          }
          return;
        }
      }
    });

    dom.solveBtn.addEventListener('click', solve);
    dom.againBtn.addEventListener('click', solve);
    dom.copyBtn.addEventListener('click', copyAnswer);

    dom.resetBtn.addEventListener('click', () => {
      dom.problemText.value = '';
      dom.hintInput.value = '';
      setMode('auto');
      clearImage();
      updateCount();
      hideError();
      resetAnswerView();
      clearTimers();
      dom.problemText.focus();
    });

    dom.hintInput.addEventListener('input', () => { if (!dom.formError.hidden) hideError(); });

    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        solve();
      }
      if (event.key === 'Escape') {
        if (!dom.portalMenuDropdown.hidden) closePortalMenu();
      }
    });

    dom.historyList.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const item = button.closest('.history-item');
      if (!item) return;
      if (button.dataset.action === 'load') loadHistoryItem(item.dataset.id);
      if (button.dataset.action === 'delete') deleteHistoryItem(item.dataset.id);
    });
    dom.clearHistory.addEventListener('click', clearAllHistory);

    dom.apiBtn.addEventListener('click', openApiDialog);
    dom.connChip.addEventListener('click', openApiDialog);
    dom.apiClose.addEventListener('click', closeApiDialog);
    dom.apiDialog.addEventListener('click', (event) => {
      if (event.target === dom.apiDialog) closeApiDialog();
    });
    dom.apiAuth.addEventListener('change', syncTokenField);
    dom.apiTest.addEventListener('click', () => testConnection());
    dom.apiSave.addEventListener('click', saveApiConfig);
    dom.apiClear.addEventListener('click', clearApiConfig);

    dom.portalMenuBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = dom.portalMenuDropdown.hidden;
      dom.portalMenuDropdown.hidden = !open;
      dom.portalMenuBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (event) => {
      if (!dom.portalMenuDropdown.hidden && !event.target.closest('#portalMenu')) closePortalMenu();
    });
  }

  function closePortalMenu() {
    dom.portalMenuDropdown.hidden = true;
    dom.portalMenuBtn.setAttribute('aria-expanded', 'false');
  }

  /* -------------------------------------------------------------------- init -- */
  function init() {
    const savedApi = readStore(STORE_API, null);
    if (savedApi && typeof savedApi === 'object') {
      state.api = {
        url: typeof savedApi.url === 'string' ? savedApi.url : '',
        auth: ['none', 'bearer', 'cookie'].includes(savedApi.auth) ? savedApi.auth : 'none',
        token: typeof savedApi.token === 'string' ? savedApi.token : '',
      };
    }
    reflectApiState();
    loadHistory();
    updateCount();
    renderImage();
    setMode('auto');
    bindEvents();
    if (state.api.url) {
      // Silent health probe: never blocks the UI and never nags on failure.
      testConnection(state.api.url).then((ok) => {
        if (ok) dom.connChip.title = `API 연결됨 — ${state.api.url} (눌러서 변경)`;
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
