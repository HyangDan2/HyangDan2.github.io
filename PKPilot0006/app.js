/* ==========================================================================
   HD2Lab | DOS Player (PKPilot0006)
   js-dos v8 (DOSBox WebAssembly) instant-play shell.

   - verified public bundles boot with one click (no autoplay block)
   - a local .jsdos / .zip file is opened with URL.createObjectURL
   - native fullscreen, mute, restart
   - input goes through the js-dos v8 CommandInterface (ci.sendKeyEvent) so the
     emulator receives keys no matter where focus sits
   - touch gamepad (+ DOOM run / strafe / weapon keys) with pointer capture, and
     an optional PC WASD binding
   ========================================================================== */
(() => {
  'use strict';

  const JSDOS_SRC = 'https://v8.js-dos.com/latest/js-dos.js';
  const JSDOS_CSS = 'https://v8.js-dos.com/latest/js-dos.css';
  const STORE_KEY = 'pkpilot0006:last';
  const WASD_KEY = 'pkpilot0006:wasd';

  /* -------------------------------------------------------------- library -- */
  const GAMES = [
    {
      id: 'digger',
      name: 'Digger',
      badge: 'DG',
      year: 1983,
      maker: 'Windmill Software',
      genre: '아케이드',
      size: '27 KB',
      license: 'Freeware',
      url: 'https://v8.js-dos.com/bundles/digger.jsdos',
      blurb: '땅을 파고 보석을 캐는 1983년 아케이드. 노블을 피해 다 캐면 다음 스테이지로.',
    },
    {
      id: 'doom',
      name: 'DOOM',
      badge: 'DM',
      year: 1993,
      maker: 'id Software',
      genre: 'FPS',
      size: '5.3 MB',
      license: 'Shareware',
      pad: 'doom',
      url: 'https://v8.js-dos.com/bundles/doom.jsdos',
      blurb: '셰어웨어 에피소드 1 “Knee-Deep in the Dead”. WASD 이동·옆걸음, ←→ 회전, Ctrl 사격, Space 문 열기.',
    },
    {
      id: 'dhrystone',
      name: 'Dhrystone 2',
      badge: 'DH',
      year: 1984,
      maker: 'R. P. Weicker',
      genre: '벤치마크',
      size: '175 KB',
      license: 'Benchmark',
      url: 'https://v8.js-dos.com/bundles/dhry2.jsdos',
      blurb: 'DOS/4GW 위에서 도는 Dhrystone 2.1. 이 브라우저의 DOS 연산 성능을 숫자로 재어 봅니다.',
    },
  ];

  /* js-dos v8 key codes — taken from the `KBD_` table inside
     https://v8.js-dos.com/latest/js-dos.js (function ya(keyCode, location)
     maps a DOM event onto it). ci.sendKeyEvent takes these numbers. */
  const KBD = {
    ArrowUp: 265,
    ArrowDown: 264,
    ArrowLeft: 263,
    ArrowRight: 262,
    Enter: 257,
    Space: 32,
    Escape: 256,
    Tab: 258,
    Backspace: 259,
    ControlLeft: 341,
    ControlRight: 345,
    ShiftLeft: 340,
    ShiftRight: 344,
    AltLeft: 342,
    AltRight: 346,
    KeyY: 89,
    KeyN: 78,
    KeyW: 87,
    KeyA: 65,
    KeyS: 83,
    KeyD: 68,
    Digit1: 49,
    Digit2: 50,
    Digit3: 51,
    Digit4: 52,
    Digit5: 53,
    Digit6: 54,
    Digit7: 55,
  };

  /* used only as a fallback when the CommandInterface is not up yet: js-dos
     listens for keydown/keyup on window and maps keyCode + location itself */
  const KEYMAP = {
    ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    Enter: { key: 'Enter', code: 'Enter', keyCode: 13 },
    Space: { key: ' ', code: 'Space', keyCode: 32 },
    Escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
    ControlLeft: { key: 'Control', code: 'ControlLeft', keyCode: 17, location: 1 },
    ShiftLeft: { key: 'Shift', code: 'ShiftLeft', keyCode: 16, location: 1 },
    AltLeft: { key: 'Alt', code: 'AltLeft', keyCode: 18, location: 1 },
    KeyY: { key: 'y', code: 'KeyY', keyCode: 89 },
    KeyN: { key: 'n', code: 'KeyN', keyCode: 78 },
    KeyW: { key: 'w', code: 'KeyW', keyCode: 87 },
    KeyA: { key: 'a', code: 'KeyA', keyCode: 65 },
    KeyS: { key: 's', code: 'KeyS', keyCode: 83 },
    KeyD: { key: 'd', code: 'KeyD', keyCode: 68 },
    Digit1: { key: '1', code: 'Digit1', keyCode: 49 },
    Digit2: { key: '2', code: 'Digit2', keyCode: 50 },
    Digit3: { key: '3', code: 'Digit3', keyCode: 51 },
    Digit4: { key: '4', code: 'Digit4', keyCode: 52 },
  };

  /* What the arrow keys mean depends on the game. This DOOM shareware bundle
     ships its own DEFAULT.CFG:
       key_up = W (sc 17)   key_down = S (sc 31)
       key_strafeleft = A (sc 30)   key_straferight = D (sc 32)
       key_left/right = left/right arrow, key_fire = Ctrl, key_use = Space,
       key_speed = Shift, key_strafe = Alt
     so in DOOM a plain up arrow does nothing at all — the d-pad has to send
     what the game listens for, or touch players cannot walk. */
  const PROFILES = {
    arrows: {
      pad: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
      wasd: { KeyW: 'ArrowUp', KeyA: 'ArrowLeft', KeyS: 'ArrowDown', KeyD: 'ArrowRight' },
    },
    doom: {
      // DOOM walks on W/S but its menus (Esc) move on the real arrow keys, so
      // the d-pad sends both: gameplay goes to W/S, menus to up/down
      pad: {
        up: ['KeyW', 'ArrowUp'],
        down: ['KeyS', 'ArrowDown'],
        left: ['ArrowLeft'],
        right: ['ArrowRight'],
      },
      // the bundle is already WASD native, so the letters stay letters
      wasd: { KeyW: 'KeyW', KeyA: 'KeyA', KeyS: 'KeyS', KeyD: 'KeyD' },
    },
  };
  const ACTION_MAP = {
    KeyJ: 'ControlLeft',
    KeyZ: 'ControlLeft',
    KeyK: 'Space',
    KeyX: 'Space',
    KeyL: 'Enter',
    KeyC: 'Enter',
  };
  const DIRECTION = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

  /* DOS keys we forward ourselves (single path: js-dos' own window listener is
     stopped for these so one physical press never reaches the emulator twice) */
  const NATIVE_KEYS = {
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft',
    ArrowRight: 'ArrowRight',
    Enter: 'Enter',
    NumpadEnter: 'Enter',
    Space: 'Space',
    Escape: 'Escape',
    ControlLeft: 'ControlLeft',
    ControlRight: 'ControlRight',
    ShiftLeft: 'ShiftLeft',
    ShiftRight: 'ShiftRight',
    AltLeft: 'AltLeft',
    AltRight: 'AltRight',
    KeyY: 'KeyY',
    KeyN: 'KeyN',
    Digit1: 'Digit1',
    Digit2: 'Digit2',
    Digit3: 'Digit3',
    Digit4: 'Digit4',
    Digit5: 'Digit5',
    Digit6: 'Digit6',
    Digit7: 'Digit7',
  };

  /* ------------------------------------------------------------------ dom -- */
  const $ = (id) => document.getElementById(id);
  const stage = $('dosStage');
  const shell = $('screenShell');
  const veil = $('veil');
  const startBtn = $('startBtn');
  const veilTitle = $('veilTitle');
  const veilSub = $('veilSub');
  const stageMeta = $('stageMeta');
  const note = $('stageNote');
  const noteText = $('stageNoteText');
  const noteRetry = $('stageNoteRetry');
  const nowTitle = $('nowTitle');
  const nowMeta = $('nowMeta');
  const gameList = $('gameList');
  const restartBtn = $('restartBtn');
  const muteBtn = $('muteBtn');
  const muteLabel = $('muteLabel');
  const muteIcon = $('muteIcon');
  const fsBtn = $('fsBtn');
  const fsExit = $('fsExit');
  const pad = $('pad');
  const dropZone = $('dropZone');
  const fileInput = $('fileInput');
  const fileNote = $('fileNote');
  const engineChip = $('engineChip');
  const engineChipText = $('engineChipText');
  const toastEl = $('toast');
  const portalMenuBtn = $('portalMenuBtn');
  const portalMenuDropdown = $('portalMenuDropdown');

  const wasdBtn = $('wasdBtn');
  const wasdState = $('wasdState');

  const state = {
    current: null,
    dos: null,
    ci: null,
    objectUrl: null,
    muted: false,
    running: false,
    booting: false,
    wasd: true,
    profile: 'arrows',
    enginePromise: null,
  };

  /* --------------------------------------------------------------- helpers -- */
  let toastTimer = 0;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  }

  function setEngine(mode, text) {
    engineChip.dataset.state = mode;
    engineChipText.textContent = text;
  }

  function setMeta(text) {
    stageMeta.textContent = text;
  }

  function showNote(message) {
    noteText.textContent = message;
    note.hidden = false;
  }
  function hideNote() {
    note.hidden = true;
    noteText.textContent = '';
  }

  function describe(target) {
    if (!target) return '';
    if (target.local) return target.meta || '로컬 파일';
    return `${target.year} · ${target.maker} · ${target.genre}`;
  }

  function refreshLabels() {
    const target = state.current;
    nowTitle.textContent = target ? target.name : '게임을 선택하세요';
    nowMeta.textContent = target ? describe(target) : '아래 ‘바로실행용’에서 한 번만 누르면 부팅됩니다';
    const padHintEl = $('padHint');
    if (padHintEl) {
      padHintEl.textContent = state.profile === 'doom'
        ? '가상 게임패드 · ▲▼ 이동 / ◀▶ 회전 · Alt 옆걸음'
        : '가상 게임패드 · 터치로 조작';
    }
    if (!state.running && !state.booting) {
      veil.hidden = false;
      veil.dataset.state = 'idle';
      veilTitle.textContent = target ? `${target.name} 실행` : '게임 선택';
      veilSub.textContent = target
        ? `클릭하면 DOSBox가 부팅됩니다${target.size ? ' · ' + target.size : ''}`
        : '라이브러리에서 게임을 고르세요';
      setMeta('01 / IDLE');
    }
    for (const btn of gameList.querySelectorAll('.game-tile')) {
      btn.setAttribute('aria-pressed', String(!!target && btn.dataset.game === target.id));
    }
  }

  /* -------------------------------------------------------------- js-dos -- */
  function loadEngine() {
    if (window.Dos) return Promise.resolve();
    if (state.enginePromise) return state.enginePromise;

    state.enginePromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-jsdos-css]')) {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = JSDOS_CSS;
        css.crossOrigin = 'anonymous';
        css.dataset.jsdosCss = '1';
        document.head.appendChild(css);
      }
      if (!document.querySelector('script[data-jsdos-js]')) {
        const script = document.createElement('script');
        script.type = 'module';
        script.crossOrigin = 'anonymous';
        script.src = JSDOS_SRC;
        script.dataset.jsdosJs = '1';
        script.onerror = () => reject(new Error('js-dos 스크립트를 불러오지 못했습니다.'));
        document.head.appendChild(script);
      }

      const started = Date.now();
      const tick = () => {
        if (window.Dos) {
          setEngine('ready', 'js-dos v8 · 준비됨');
          resolve();
          return;
        }
        if (Date.now() - started > 30000) {
          reject(new Error('js-dos 로딩이 시간을 넘었습니다. 네트워크를 확인해 주세요.'));
          return;
        }
        setTimeout(tick, 120);
      };
      tick();
    }).catch((error) => {
      state.enginePromise = null;
      throw error;
    });

    return state.enginePromise;
  }

  function teardown() {
    releaseAll();
    state.ci = null;
    if (state.dos) {
      try { state.dos.stop(); } catch (_) { /* already stopped */ }
      state.dos = null;
    }
    stage.replaceChildren();
    state.running = false;
  }

  function findCanvas() {
    const canvas = stage.querySelector('canvas');
    if (!canvas || !canvas.width || !canvas.height) return null;
    return canvas;
  }

  function waitForBoot(timeout = 60000) {
    return new Promise((resolve) => {
      const started = Date.now();
      const tick = () => {
        const canvas = findCanvas();
        if (canvas) {
          // one more beat so the first frame is painted
          setTimeout(() => resolve(true), 450);
          return;
        }
        if (Date.now() - started > timeout) {
          resolve(false);
          return;
        }
        setTimeout(tick, 150);
      };
      tick();
    });
  }

  async function boot(target) {
    if (!target) return;
    if (state.booting) return;
    state.booting = true;
    hideNote();
    setEngine('loading', '부팅 중…');
    setMeta('01 / BOOTING');
    veil.hidden = false;
    veil.dataset.state = 'loading';
    veilTitle.textContent = `${target.name} 부팅 중`;
    veilSub.textContent = 'DOSBox WebAssembly를 올리는 중입니다…';
    [restartBtn, muteBtn, fsBtn].forEach((b) => { b.disabled = true; });

    teardown();
    state.current = target;
    state.profile = PROFILES[target.pad] ? target.pad : 'arrows';
    refreshLabels();
    for (const btn of gameList.querySelectorAll('.game-tile')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.game === target.id));
    }
    nowTitle.textContent = target.name;
    nowMeta.textContent = describe(target);

    try {
      await loadEngine();
      const props = window.Dos(stage, {
        url: target.url,
        theme: 'dark',
        autoStart: true,
        autoSave: false,
        noCloud: true,
        thinSidebar: true,
        mouseCapture: false,
        countDownStart: 0,
        onEvent: (event, ci) => {
          // js-dos reports "ci-ready" with the live CommandInterface; every key
          // we send goes through it, so the emulator needs no focused element
          if (event === 'ci-ready' && ci) {
            state.ci = ci;
            releaseAll();
          }
        },
      });
      state.dos = props;
      if (state.muted) {
        try { props.setVolume(0); } catch (_) { /* ignore */ }
      }

      const booted = await waitForBoot();
      if (!booted) {
        state.booting = false;
        veil.dataset.state = 'idle';
        veilTitle.textContent = `${target.name} 다시 시도`;
        veilSub.textContent = '부팅이 끝나지 않았습니다 · 다시 눌러 주세요';
        setEngine('idle', 'js-dos v8 · WASM');
        setMeta('01 / TIMEOUT');
        showNote('부팅이 끝나지 않았습니다. 번들 크기가 크거나 네트워크가 느릴 수 있습니다.');
        return;
      }

      state.running = true;
      state.booting = false;
      veil.hidden = true;
      hideNote();
      setEngine('running', `실행 중 · ${target.name}`);
      setMeta('01 / RUNNING');
      [restartBtn, muteBtn, fsBtn].forEach((b) => { b.disabled = false; });
      try { localStorage.setItem(STORE_KEY, target.id); } catch (_) { /* private mode */ }
      toast(`${target.name} 부팅 완료 — 바로 플레이하세요`);
    } catch (error) {
      state.booting = false;
      state.running = false;
      veil.hidden = false;
      veil.dataset.state = 'idle';
      veilTitle.textContent = `${target.name} 다시 시도`;
      veilSub.textContent = '부팅에 실패했습니다 · 다시 눌러 주세요';
      setEngine('idle', 'js-dos v8 · WASM');
      setMeta('01 / ERROR');
      showNote(error && error.message ? error.message : '부팅에 실패했습니다.');
    }
  }

  /* --------------------------------------------------------------- library -- */
  function renderLibrary() {
    const frag = document.createDocumentFragment();
    GAMES.forEach((game) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'game-tile';
      btn.dataset.game = game.id;
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML = `
        <span class="game-badge" aria-hidden="true">${game.badge}</span>
        <span class="game-body">
          <span class="game-title">${game.name}<span class="game-lic">${game.license}</span></span>
          <span class="game-sub">${game.year} · ${game.maker} · ${game.genre} · ${game.size}</span>
          <span class="game-blurb">${game.blurb}</span>
        </span>`;
      btn.addEventListener('click', () => {
        if (state.booting) return;
        if (state.running && state.current && state.current.id === game.id) {
          toast('이미 실행 중입니다');
          return;
        }
        boot(game);
      });
      li.appendChild(btn);
      frag.appendChild(li);
    });
    gameList.replaceChildren(frag);
  }

  /* ------------------------------------------------------------ play bar -- */
  startBtn.addEventListener('click', () => {
    if (state.booting) return;
    if (state.running) { veil.hidden = true; return; }
    boot(state.current || GAMES[0]);
  });

  restartBtn.addEventListener('click', () => {
    if (state.booting) return;
    if (!state.current) { toast('먼저 게임을 고르세요'); return; }
    boot(state.current);
    toast('다시 시작합니다');
  });

  muteBtn.addEventListener('click', () => {
    state.muted = !state.muted;
    try { state.dos && state.dos.setVolume(state.muted ? 0 : 1); } catch (_) { /* ignore */ }
    muteBtn.setAttribute('aria-pressed', String(state.muted));
    muteBtn.setAttribute('aria-label', state.muted ? '소리 켜기' : '소리 끄기');
    muteBtn.title = state.muted ? '소리 켜기' : '소리 끄기';
    muteLabel.textContent = state.muted ? '무음' : '소리';
    muteIcon.setAttribute('href', state.muted ? '#i-mute' : '#i-volume');
    toast(state.muted ? '소리를 껐습니다' : '소리를 켰습니다');
  });

  function syncFullscreen() {
    const on = document.fullscreenElement === shell;
    fsBtn.setAttribute('aria-pressed', String(on));
    fsBtn.querySelector('span').textContent = on ? '나가기' : '전체화면';
    if (fsExit) fsExit.hidden = !on;
  }

  fsBtn.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (shell.requestFullscreen) {
        await shell.requestFullscreen();
      } else if (shell.webkitRequestFullscreen) {
        shell.webkitRequestFullscreen();
      } else {
        toast('이 브라우저는 전체화면을 지원하지 않습니다');
      }
    } catch (_) {
      toast('전체화면으로 전환하지 못했습니다');
    }
  });
  if (fsExit) {
    fsExit.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
    });
  }
  document.addEventListener('fullscreenchange', syncFullscreen);

  noteRetry.addEventListener('click', () => {
    hideNote();
    boot(state.current || GAMES[0]);
  });

  /* ------------------------------------------------------------ local file -- */
  function openFile(file) {
    if (!file) return;
    if (!/\.(jsdos|zip)$/i.test(file.name)) {
      showNote('.jsdos 또는 .zip 파일만 실행할 수 있습니다.');
      toast('.jsdos / .zip 파일을 골라 주세요');
      return;
    }
    const size = file.size > 1048576
      ? `${(file.size / 1048576).toFixed(1)} MB`
      : `${Math.max(1, Math.round(file.size / 1024))} KB`;
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = URL.createObjectURL(file);
    const target = {
      id: 'local',
      name: file.name.replace(/\.(jsdos|zip)$/i, ''),
      local: true,
      meta: `${file.name} · ${size} · 로컬 파일`,
      license: 'Local',
      badge: 'FL',
      size,
      url: state.objectUrl,
    };
    boot(target);
    toast(`${file.name} 실행`);
  }

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener('change', () => {
    openFile(fileInput.files && fileInput.files[0]);
    fileInput.value = '';
  });
  ['dragenter', 'dragover'].forEach((type) => {
    dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      dropZone.classList.add('is-over');
    });
  });
  ['dragleave', 'dragend'].forEach((type) => {
    dropZone.addEventListener(type, () => dropZone.classList.remove('is-over'));
  });
  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('is-over');
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) openFile(file);
  });
  // a bundle dropped anywhere on the page lands in the player, not in the tab
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => {
    if (dropZone.contains(event.target)) return;
    event.preventDefault();
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) openFile(file);
    fileNote.textContent = '드롭한 파일은 브라우저 안에서만 열립니다 — 서버로 업로드되지 않습니다.';
  });

  /* --------------------------------------------------------------- input -- */
  /* every key the player presses (pad, WASD, native) ends up in `held` so a
     blur, a hidden tab or a stopped emulator can never leave a key stuck down */
  const held = new Set();

  function keyTarget() {
    return stage.querySelector('canvas') || document;
  }

  function sendKey(code, down) {
    const map = KEYMAP[code];
    if (!map) return;
    if (state.ci && typeof state.ci.sendKeyEvent === 'function') {
      try {
        state.ci.sendKeyEvent(KBD[code], down);
        return;
      } catch (_) { /* CI went away mid-press: fall through to the event path */ }
    }
    const event = new KeyboardEvent(down ? 'keydown' : 'keyup', {
      key: map.key,
      code: map.code,
      location: map.location || 0,
      bubbles: true,
      cancelable: true,
      view: window,
    });
    for (const prop of ['keyCode', 'which']) {
      Object.defineProperty(event, prop, { get: () => map.keyCode });
    }
    event.__pkpilot = true;
    keyTarget().dispatchEvent(event);
  }

  function press(codes, repeat) {
    for (const code of Array.isArray(codes) ? codes : [codes]) {
      if (!repeat && held.has(code)) continue;
      held.add(code);
      sendKey(code, true);
    }
  }

  function release(codes) {
    for (const code of Array.isArray(codes) ? codes : [codes]) {
      if (!held.delete(code)) continue;
      sendKey(code, false);
    }
  }

  function releaseAll() {
    for (const code of Array.from(held)) release(code);
    held.clear();
    for (const btn of pad.querySelectorAll('.pad-key.is-down')) {
      btn.classList.remove('is-down');
    }
  }

  function flashPad(code, on) {
    for (const btn of pad.querySelectorAll('.pad-key')) {
      if (padCodes(btn).includes(code)) btn.classList.toggle('is-down', !!on);
    }
  }

  /* the d-pad buttons are semantic (up/down/left/right); the DOS key(s) behind
     them come from the running game's profile */
  function padCodes(btn) {
    const dir = DIRECTION[btn.dataset.code];
    if (!dir) return [btn.dataset.code];
    const codes = PROFILES[state.profile].pad[dir];
    return Array.isArray(codes) ? codes : [codes];
  }

  /* a key must never escape while the page itself is losing focus */
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  window.addEventListener('pagehide', releaseAll);

  /* ---- touch / pointer gamepad ---- */
  for (const btn of pad.querySelectorAll('.pad-key')) {
    let pointerId = null;
    let activeCodes = [];

    const down = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      if (pointerId !== null) return;
      if (!state.running) {
        toast('먼저 게임을 실행하세요');
        return;
      }
      pointerId = event.pointerId;
      btn.classList.add('is-down');
      // capture keeps the hold alive when the finger slides off the button —
      // previously pointerleave released it and the d-pad dropped mid-move
      if (btn.setPointerCapture && event.pointerId !== undefined) {
        try { btn.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
      }
      activeCodes = padCodes(btn);
      press(activeCodes, false);
    };

    const up = (event) => {
      if (pointerId === null) return;
      if (event.pointerId !== undefined && event.pointerId !== pointerId) return;
      pointerId = null;
      btn.classList.remove('is-down');
      for (const code of activeCodes) release(code);
      activeCodes = [];
    };

    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
    btn.addEventListener('contextmenu', (event) => event.preventDefault());
    btn.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); }
    });
    btn.addEventListener('click', (event) => {
      // keyboard activation (detail 0) lands here; pointer taps already fired
      if (event.detail === 0 && state.running) {
        const codes = padCodes(btn);
        press(codes, false);
        setTimeout(() => codes.forEach(release), 90);
      }
    });
  }

  /* ---- PC keyboard ---- */
  function isTyping(target) {
    return !!(target && target.closest
      && target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
  }

  function keysBlocked() {
    return !state.running || !state.ci || !portalMenuDropdown.hidden;
  }

  function dosCode(event) {
    if (state.wasd && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const mapped = PROFILES[state.profile].wasd[event.code] || ACTION_MAP[event.code];
      if (mapped) return mapped;
    }
    return NATIVE_KEYS[event.code] || null;
  }

  window.addEventListener('keydown', (event) => {
    if (event.__pkpilot || keysBlocked() || isTyping(event.target)) return;
    const code = dosCode(event);
    if (!code) return;
    // the page must not scroll on arrows/space, and js-dos' own window listener
    // (bubble phase) must not deliver the same press a second time
    event.preventDefault();
    event.stopPropagation();
    press(code, event.repeat);
    flashPad(code, true);
  }, true);

  window.addEventListener('keyup', (event) => {
    if (event.__pkpilot || keysBlocked() || isTyping(event.target)) return;
    const code = dosCode(event);
    if (!code) return;
    event.preventDefault();
    event.stopPropagation();
    release(code);
    flashPad(code, false);
  }, true);

  /* ---- PC keyboard binding (WASD) ---- */
  function applyWasd() {
    if (!wasdBtn) return;
    wasdBtn.setAttribute('aria-pressed', String(state.wasd));
    wasdBtn.title = state.wasd
      ? 'PC 키보드 WASD 바인딩 · 켜짐 (누르면 끕니다)'
      : 'PC 키보드 WASD 바인딩 · 꺼짐 (누르면 켭니다)';
    if (wasdState) wasdState.textContent = state.wasd ? '켜짐' : '꺼짐';
    const strip = $('keybind');
    if (strip) strip.dataset.wasd = state.wasd ? 'on' : 'off';
  }

  try {
    const saved = localStorage.getItem(WASD_KEY);
    if (saved === '0') state.wasd = false;
    else if (saved === '1') state.wasd = true;
  } catch (_) { /* private mode */ }

  if (wasdBtn) {
    wasdBtn.addEventListener('click', () => {
      state.wasd = !state.wasd;
      try { localStorage.setItem(WASD_KEY, state.wasd ? '1' : '0'); } catch (_) { /* ignore */ }
      applyWasd();
      releaseAll();
      toast(state.wasd ? 'WASD 모드 켜짐 — W/A/S/D로 이동합니다' : 'WASD 모드 꺼짐 — W/A/S/D는 글자로 전달됩니다');
    });
  }
  applyWasd();

  /* ------------------------------------------------------------- chrome -- */
  portalMenuBtn.addEventListener('click', () => {
    const open = portalMenuDropdown.hidden;
    portalMenuDropdown.hidden = !open;
    portalMenuBtn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (event) => {
    if (portalMenuDropdown.hidden) return;
    if (event.target.closest('#portalMenu')) return;
    portalMenuDropdown.hidden = true;
    portalMenuBtn.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !portalMenuDropdown.hidden) {
      portalMenuDropdown.hidden = true;
      portalMenuBtn.setAttribute('aria-expanded', 'false');
      portalMenuBtn.focus();
    }
  });

  /* --------------------------------------------------------------- start -- */
  renderLibrary();

  const params = new URLSearchParams(location.search);
  const wanted = params.get('game');
  let initial = GAMES[0];
  if (wanted) {
    initial = GAMES.find((game) => game.id === wanted) || initial;
  } else {
    try {
      const last = localStorage.getItem(STORE_KEY);
      if (last) initial = GAMES.find((game) => game.id === last) || initial;
    } catch (_) { /* private mode */ }
  }
  state.current = initial;
  refreshLabels();

  // warm the engine once the page is idle so the first click boots instantly
  const warm = () => loadEngine().catch(() => { /* retried on click */ });
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 2500 });
  else setTimeout(warm, 1200);

  // expose a tiny debug surface for verification scripts
  window.__pkpilot = {
    games: GAMES,
    state,
    boot,
    press,
    release,
    releaseAll,
    sendKey,
    KBD,
  };
})();
