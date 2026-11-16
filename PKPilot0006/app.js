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

  /* js-dos v8 key codes — the `KBD_` object inside
     https://v8.js-dos.com/latest/js-dos.js (its own `ya(keyCode, location)`
     maps a DOM event onto the same numbers). ci.sendKeyEvent takes these. */
  const KBD = (() => {
    const table = {
      Escape: 256,
      Tab: 258,
      Backspace: 259,
      Enter: 257,
      Space: 32,
      CapsLock: 280,
      ScrollLock: 281,
      NumLock: 282,
      PrintScreen: 283,
      Pause: 284,
      Insert: 260,
      Delete: 261,
      Home: 268,
      End: 269,
      PageUp: 266,
      PageDown: 267,
      ArrowLeft: 263,
      ArrowUp: 265,
      ArrowRight: 262,
      ArrowDown: 264,
      ControlLeft: 341,
      ControlRight: 345,
      ShiftLeft: 340,
      ShiftRight: 344,
      AltLeft: 342,
      AltRight: 346,
      Backquote: 96,
      Minus: 45,
      Equal: 61,
      Backslash: 92,
      BracketLeft: 91,
      BracketRight: 93,
      Semicolon: 59,
      Quote: 39,
      Period: 46,
      Comma: 44,
      Slash: 47,
    };
    for (let i = 0; i < 26; i += 1) table[`Key${String.fromCharCode(65 + i)}`] = 65 + i;
    for (let i = 0; i < 10; i += 1) table[`Digit${i}`] = 48 + i;
    for (let i = 1; i <= 12; i += 1) table[`F${i}`] = 289 + i;
    for (let i = 0; i < 10; i += 1) table[`Numpad${i}`] = 320 + i;
    table.NumpadEnter = 335;
    table.NumpadDecimal = 330;
    table.NumpadDivide = 331;
    table.NumpadMultiply = 332;
    table.NumpadSubtract = 333;
    table.NumpadAdd = 334;
    return table;
  })();

  /* used only as a fallback when the CommandInterface is not up yet: js-dos
     listens for keydown/keyup on window and maps keyCode + location itself */
  const KEY_INFO = (() => {
    const table = {
      Escape: { key: 'Escape', keyCode: 27 },
      Tab: { key: 'Tab', keyCode: 9 },
      Backspace: { key: 'Backspace', keyCode: 8 },
      Enter: { key: 'Enter', keyCode: 13 },
      NumpadEnter: { key: 'Enter', keyCode: 13, location: 3 },
      Space: { key: ' ', keyCode: 32 },
      ArrowLeft: { key: 'ArrowLeft', keyCode: 37 },
      ArrowUp: { key: 'ArrowUp', keyCode: 38 },
      ArrowRight: { key: 'ArrowRight', keyCode: 39 },
      ArrowDown: { key: 'ArrowDown', keyCode: 40 },
      Insert: { key: 'Insert', keyCode: 45 },
      Delete: { key: 'Delete', keyCode: 46 },
      Home: { key: 'Home', keyCode: 36 },
      End: { key: 'End', keyCode: 35 },
      PageUp: { key: 'PageUp', keyCode: 33 },
      PageDown: { key: 'PageDown', keyCode: 34 },
      ControlLeft: { key: 'Control', keyCode: 17, location: 1 },
      ControlRight: { key: 'Control', keyCode: 17, location: 2 },
      ShiftLeft: { key: 'Shift', keyCode: 16, location: 1 },
      ShiftRight: { key: 'Shift', keyCode: 16, location: 2 },
      AltLeft: { key: 'Alt', keyCode: 18, location: 1 },
      AltRight: { key: 'Alt', keyCode: 18, location: 2 },
      Backquote: { key: '`', keyCode: 192 },
      Minus: { key: '-', keyCode: 189 },
      Equal: { key: '=', keyCode: 187 },
      Backslash: { key: '\\', keyCode: 220 },
      BracketLeft: { key: '[', keyCode: 219 },
      BracketRight: { key: ']', keyCode: 221 },
      Semicolon: { key: ';', keyCode: 186 },
      Quote: { key: "'", keyCode: 222 },
      Period: { key: '.', keyCode: 190 },
      Comma: { key: ',', keyCode: 188 },
      Slash: { key: '/', keyCode: 191 },
    };
    for (let i = 0; i < 26; i += 1) {
      const ch = String.fromCharCode(65 + i);
      table[`Key${ch}`] = { key: ch.toLowerCase(), keyCode: 65 + i };
    }
    for (let i = 0; i < 10; i += 1) {
      table[`Digit${i}`] = { key: String(i), keyCode: 48 + i };
      table[`Numpad${i}`] = { key: String(i), keyCode: 96 + i, location: 3 };
    }
    for (let i = 1; i <= 12; i += 1) table[`F${i}`] = { key: `F${i}`, keyCode: 111 + i };
    return table;
  })();

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
      // what a movement *action* sends when the running game is arrow driven
      move: { forward: 'ArrowUp', back: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
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
      move: { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD' },
    },
  };
  const DIRECTION = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

  /* ---------------------------------------------------- key remapping ---- */
  /* Each action owns one or more *slots*. A slot is a physical key plus what it
     sends: a movement token resolved through the running game's profile, or a
     fixed DOS key. The defaults reproduce what the player shipped with (WASD +
     the letter aliases of PR #52); the 키 설정 modal edits the physical keys. */
  const ACTIONS = [
    {
      id: 'forward', label: '앞으로 / 위', note: '이동 ↑',
      slots: [['KeyW', 'forward'], ['ArrowUp', 'ArrowUp']],
    },
    {
      id: 'back', label: '뒤로 / 아래', note: '이동 ↓',
      slots: [['KeyS', 'back'], ['ArrowDown', 'ArrowDown']],
    },
    {
      id: 'left', label: '왼쪽 / 좌회전', note: '옆걸음 · 회전 ←',
      slots: [['KeyA', 'left'], ['ArrowLeft', 'ArrowLeft']],
    },
    {
      id: 'right', label: '오른쪽 / 우회전', note: '옆걸음 · 회전 →',
      slots: [['KeyD', 'right'], ['ArrowRight', 'ArrowRight']],
    },
    {
      id: 'fire', label: '사격 / 액션', note: 'Ctrl',
      slots: [['KeyJ', 'ControlLeft'], ['KeyZ', 'ControlLeft'], ['ControlLeft', 'ControlLeft']],
    },
    {
      id: 'use', label: '사용 / 열기', note: 'Space',
      slots: [['KeyK', 'Space'], ['KeyX', 'Space'], ['Space', 'Space']],
    },
    {
      id: 'enter', label: '확인 / 시작', note: 'Enter',
      slots: [['KeyL', 'Enter'], ['KeyC', 'Enter'], ['Enter', 'Enter']],
    },
    {
      id: 'run', label: '달리기', note: 'Shift',
      slots: [['ShiftLeft', 'ShiftLeft']],
    },
    {
      id: 'strafe', label: '스트레이프', note: 'Alt',
      slots: [['AltLeft', 'AltLeft']],
    },
    {
      id: 'menu', label: '메뉴 / 취소', note: 'Esc',
      slots: [['Escape', 'Escape']],
    },
  ];
  const KEYMAP_STORE = 'pkpilot0006:keymap';

  /* keys we forward that are not part of the remappable set above */
  const NATIVE_KEYS = {
    KeyY: 'KeyY',
    KeyN: 'KeyN',
    Digit1: 'Digit1',
    Digit2: 'Digit2',
    Digit3: 'Digit3',
    Digit4: 'Digit4',
    Digit5: 'Digit5',
    Digit6: 'Digit6',
    Digit7: 'Digit7',
    NumpadEnter: 'Enter',
    ControlRight: 'ControlRight',
    ShiftRight: 'ShiftRight',
    AltRight: 'AltRight',
  };

  function defaultKeymap() {
    const map = {};
    for (const action of ACTIONS) map[action.id] = action.slots.map((slot) => slot[0]);
    return map;
  }

  function readKeymap() {
    const map = defaultKeymap();
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEYMAP_STORE) || 'null'); } catch (_) { saved = null; }
    if (!saved || typeof saved !== 'object') return map;
    for (const action of ACTIONS) {
      const list = saved[action.id];
      if (!Array.isArray(list) || list.length !== action.slots.length) continue;
      if (!list.every((code) => typeof code === 'string' && KBD[code] && KEY_INFO[code])) continue;
      map[action.id] = list.slice();
    }
    return map;
  }

  let keymap = readKeymap();
  let keyIndex = {};

  function rebuildKeyIndex() {
    const index = {};
    for (const action of ACTIONS) {
      const codes = keymap[action.id] || [];
      action.slots.forEach((slot, i) => {
        if (codes[i]) index[codes[i]] = { action, slot: i, send: slot[1] };
      });
    }
    keyIndex = index;
  }
  rebuildKeyIndex();

  function storeKeymap() {
    try { localStorage.setItem(KEYMAP_STORE, JSON.stringify(keymap)); } catch (_) { /* private mode */ }
  }

  /* what a slot sends right now: movement follows the running game's profile,
     everything else is already an exact js-dos key */
  function slotSend(send) {
    const move = PROFILES[state.profile].move;
    return move[send] || send;
  }

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

  function toggleMute() {
    state.muted = !state.muted;
    try { state.dos && state.dos.setVolume(state.muted ? 0 : 1); } catch (_) { /* ignore */ }
    muteBtn.setAttribute('aria-pressed', String(state.muted));
    muteBtn.setAttribute('aria-label', state.muted ? '소리 켜기' : '소리 끄기');
    muteBtn.title = state.muted ? '소리 켜기' : '소리 끄기';
    muteLabel.textContent = state.muted ? '무음' : '소리';
    muteIcon.setAttribute('href', state.muted ? '#i-mute' : '#i-volume');
    const mini = $('miniMuteBtn');
    if (mini) {
      mini.setAttribute('aria-pressed', String(state.muted));
      mini.textContent = state.muted ? '🔇 무음' : '🔊 소리';
    }
    toast(state.muted ? '소리를 껐습니다' : '소리를 켰습니다');
  }
  muteBtn.addEventListener('click', toggleMute);

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
    const info = KEY_INFO[code];
    const kbd = KBD[code];
    if (!info || !kbd) return;
    if (state.ci && typeof state.ci.sendKeyEvent === 'function') {
      try {
        state.ci.sendKeyEvent(kbd, down);
        return;
      } catch (_) { /* CI went away mid-press: fall through to the event path */ }
    }
    const event = new KeyboardEvent(down ? 'keydown' : 'keyup', {
      key: info.key,
      code,
      location: info.location || 0,
      bubbles: true,
      cancelable: true,
      view: window,
    });
    for (const prop of ['keyCode', 'which']) {
      Object.defineProperty(event, prop, { get: () => info.keyCode });
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
    return !state.running || !state.ci || !portalMenuDropdown.hidden || isKeymapOpen();
  }

  function dosCode(event) {
    const hit = keyIndex[event.code];
    if (hit) {
      // WASD off: letters reach DOS as typed characters (js-dos' own listener),
      // arrows, modifiers and the rest of the keymap keep working
      if (!state.wasd && /^Key[A-Z]$/.test(event.code)) return null;
      return slotSend(hit.send);
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

  /* -------------------------------------------------------- keymap modal -- */
  const keymapModal = $('keymapModal');
  const keymapList = $('keymapList');
  const keymapNoteEl = $('keymapNote');
  const keymapBtn = $('keymapBtn');
  const keymapXBtn = $('keymapX');
  const keymapResetBtn = $('keymapReset');
  const keymapDoneBtn = $('keymapDone');
  let listening = null;
  let keymapReturnFocus = null;

  if (keymapNoteEl) keymapNoteEl.setAttribute('role', 'status');

  function isKeymapOpen() {
    return !!keymapModal && !keymapModal.hidden;
  }

  function keyLabel(code) {
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    if (/^Numpad[0-9]$/.test(code)) return `Num ${code.slice(6)}`;
    const named = {
      ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
      Escape: 'Esc', Space: 'Space', Enter: 'Enter', Tab: 'Tab', Backspace: '⌫',
      ControlLeft: 'Ctrl', ControlRight: 'R Ctrl',
      ShiftLeft: 'Shift', ShiftRight: 'R Shift',
      AltLeft: 'Alt', AltRight: 'R Alt',
      NumpadEnter: 'Num Enter',
      Minus: '-', Equal: '=', Backquote: '`', Backslash: '\\',
      BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'",
      Comma: ',', Period: '.', Slash: '/',
    };
    return named[code] || code.replace(/^Numpad/, 'Num ');
  }

  function setKeyNote(text) {
    if (!keymapNoteEl) return;
    keymapNoteEl.textContent = text || '';
    keymapNoteEl.hidden = !text;
  }

  function renderKeymapRows() {
    if (!keymapList) return;
    const frag = document.createDocumentFragment();
    for (const action of ACTIONS) {
      const row = document.createElement('li');
      row.className = 'keymap-row';
      row.dataset.action = action.id;

      const label = document.createElement('div');
      label.className = 'keymap-label';
      const name = document.createElement('b');
      name.textContent = action.label;
      const meta = document.createElement('span');
      meta.textContent = action.note;
      label.append(name, meta);

      const slots = document.createElement('div');
      slots.className = 'keymap-slots';
      action.slots.forEach((slot, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'keyslot';
        btn.dataset.action = action.id;
        btn.dataset.slot = String(i);
        btn.setAttribute('aria-label', `${action.label} 키 ${i + 1}`);
        btn.addEventListener('click', () => beginListen(action.id, i));
        slots.appendChild(btn);
      });

      row.append(label, slots);
      frag.appendChild(row);
    }
    keymapList.replaceChildren(frag);
    paintKeymapRows();
  }

  function paintKeymapRows() {
    if (!keymapList) return;
    for (const btn of keymapList.querySelectorAll('.keyslot')) {
      const id = btn.dataset.action;
      const i = Number(btn.dataset.slot);
      const on = !!listening && listening.action === id && listening.slot === i;
      btn.classList.toggle('is-listening', on);
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = on ? '키를 누르세요… (Esc 취소)' : keyLabel(keymap[id][i]);
    }
    for (const row of keymapList.querySelectorAll('.keymap-row')) {
      row.classList.toggle('is-lead', !!listening && row.dataset.action === listening.action);
    }
  }

  function beginListen(actionId, slot) {
    listening = { action: actionId, slot };
    setKeyNote('');
    paintKeymapRows();
  }

  function cancelListen() {
    if (!listening) return;
    listening = null;
    setKeyNote('입력을 취소했습니다.');
    paintKeymapRows();
  }

  function settleKeymap() {
    storeKeymap();
    rebuildKeyIndex();
    renderKeyLegend();
  }

  function assignKey(actionId, slot, code) {
    if (!KBD[code] || !KEY_INFO[code]) {
      setKeyNote(`‘${code}’ 키는 DOS로 전달할 수 없습니다 — 다른 키를 눌러 주세요.`);
      return;
    }
    const action = ACTIONS.find((a) => a.id === actionId);
    const previous = keymap[actionId][slot];
    let swapped = null;
    // a key can only live in one slot: give the old key to the slot it clashes with
    for (const other of ACTIONS) {
      const list = keymap[other.id];
      for (let i = 0; i < list.length; i += 1) {
        if (other.id === actionId && i === slot) continue;
        if (list[i] !== code) continue;
        list[i] = previous;
        swapped = { action: other, slot: i };
      }
    }
    keymap[actionId][slot] = code;
    listening = null;
    settleKeymap();
    paintKeymapRows();
    if (swapped) {
      const where = swapped.action.slots.length > 1
        ? `${swapped.action.label} ${swapped.slot + 1}번 칸`
        : swapped.action.label;
      setKeyNote(`‘${keyLabel(code)}’는 ‘${where}’에 이미 쓰여 있어 ‘${keyLabel(previous)}’와 서로 바꿨습니다.`);
    } else {
      setKeyNote(`‘${action.label}’ 키를 ‘${keyLabel(code)}’로 바꿨습니다.`);
    }
  }

  function renderKeyLegend() {
    const strip = $('keybind');
    if (!strip) return;
    const chip = (code) => `<kbd>${keyLabel(code)}</kbd>`;
    const slots = (id) => (keymap[id] || []).filter(Boolean);
    const first = (id) => chip(slots(id)[0]);
    const alternates = (id, label) => `<span class="kb">${slots(id).map(chip).join('<i>/</i>')} ${label}</span>`;
    const move = ['forward', 'left', 'back', 'right'].map(first).join('');
    const turn = `${chip(slots('left')[1])}${chip(slots('right')[1])}`;
    strip.innerHTML = `
      <span class="keybind-label">PC 키보드</span>
      <span class="kb">${move} 이동</span>
      <span class="kb">${turn} 회전</span>
      ${alternates('fire', '사격')}
      ${alternates('use', '문 열기')}
      ${alternates('enter', 'Enter')}
      <span class="kb">${first('run')} 달리기</span>
      <span class="kb">${first('strafe')} 스트레이프</span>
      <span class="kb"><kbd>1</kbd>–<kbd>4</kbd> 무기</span>`;
  }

  function openKeymap() {
    if (!keymapModal || !keymapModal.hidden) return;
    keymapReturnFocus = document.activeElement;
    renderKeymapRows();
    setKeyNote('');
    keymapModal.hidden = false;
    keymapBtn.setAttribute('aria-expanded', 'true');
    releaseAll();
    const target = keymapList && keymapList.querySelector('.keyslot');
    if (target) target.focus();
    else keymapXBtn.focus();
  }

  function closeKeymap() {
    if (!keymapModal || keymapModal.hidden) return;
    listening = null;
    paintKeymapRows();
    keymapModal.hidden = true;
    keymapBtn.setAttribute('aria-expanded', 'false');
    releaseAll();
    const back = keymapReturnFocus && keymapReturnFocus.focus && document.contains(keymapReturnFocus)
      ? keymapReturnFocus
      : keymapBtn;
    back.focus();
  }

  function trapKeymapFocus(event) {
    if (!keymapModal) return;
    const list = Array.from(keymapModal.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.disabled && el.offsetParent !== null);
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    const inside = keymapModal.contains(document.activeElement);
    if (event.shiftKey && (!inside || document.activeElement === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
      event.preventDefault();
      first.focus();
    }
  }

  if (keymapBtn) keymapBtn.addEventListener('click', openKeymap);
  if (keymapXBtn) keymapXBtn.addEventListener('click', closeKeymap);
  if (keymapDoneBtn) keymapDoneBtn.addEventListener('click', closeKeymap);
  if (keymapModal) {
    keymapModal.addEventListener('click', (event) => {
      if (event.target.hasAttribute('data-keymap-close')) closeKeymap();
    });
  }
  if (keymapResetBtn) {
    keymapResetBtn.addEventListener('click', () => {
      keymap = defaultKeymap();
      listening = null;
      settleKeymap();
      paintKeymapRows();
      setKeyNote('모든 키를 기본값으로 되돌렸습니다.');
    });
  }

  /* the modal swallows every key while it is open: no key may reach the game
     and the listening slot takes the raw press (Esc always cancels) */
  document.addEventListener('keydown', (event) => {
    if (!isKeymapOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (listening) cancelListen();
      else closeKeymap();
      return;
    }
    if (listening) {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      if (event.code === 'MetaLeft' || event.code === 'MetaRight') {
        setKeyNote('Meta 키는 DOS로 전달할 수 없습니다 — 다른 키를 눌러 주세요.');
        return;
      }
      assignKey(listening.action, listening.slot, event.code);
      return;
    }
    if (event.key === 'Tab') trapKeymapFocus(event);
  }, true);

  renderKeyLegend();

  /* ------------------------------------------------ virtual pad on touch -- */
  /* the gamepad is a touch control; a desktop with a mouse gets it hidden */
  const touchDevice = (() => {
    try {
      return (navigator.maxTouchPoints || 0) > 0
        || window.matchMedia('(hover: none), (pointer: coarse)').matches;
    } catch (_) {
      return false;
    }
  })();
  document.documentElement.dataset.touch = touchDevice ? 'on' : 'off';

  const PAD_FORCE_STORE = 'pkpilot0006:padforce';
  const padForceBtn = $('padForceBtn');
  let padForced = false;
  try { padForced = localStorage.getItem(PAD_FORCE_STORE) === '1'; } catch (_) { /* private mode */ }

  function applyPadForce() {
    pad.dataset.force = padForced ? 'on' : 'off';
    if (padForceBtn) padForceBtn.setAttribute('aria-checked', String(padForced));
  }
  applyPadForce();

  if (padForceBtn) {
    padForceBtn.addEventListener('click', () => {
      padForced = !padForced;
      try { localStorage.setItem(PAD_FORCE_STORE, padForced ? '1' : '0'); } catch (_) { /* ignore */ }
      applyPadForce();
      portalMenuDropdown.hidden = true;
      portalMenuBtn.setAttribute('aria-expanded', 'false');
      toast(padForced ? '가상 게임패드를 강제로 표시합니다' : '가상 게임패드를 숨겼습니다');
    });
  }

  /* -------------------------------------------- landscape full screen ---- */
  /* On a phone on its side the page becomes the machine: header, hero, side
     panels and the normal player bar step away, the canvas fills the viewport
     and the pad floats over it. No screen.orientation.lock() and no forced
     rotation — everything is plain CSS + one data attribute. */
  const miniBar = $('miniBar');
  const miniPadBtn = $('miniPadBtn');
  const miniKbBtn = $('miniKbBtn');
  const miniMuteBtn = $('miniMuteBtn');
  const miniExitBtn = $('miniExitBtn');
  const padMoreBtn = $('padMoreBtn');
  const softKbBtn = $('softKbBtn');
  const softInput = $('softKeyboard');
  let overlayDismissed = false;
  let padHidden = false;
  let lastLandscape = null;

  function applyPadHidden() {
    pad.dataset.hidden = padHidden ? 'on' : 'off';
    if (miniPadBtn) {
      miniPadBtn.textContent = padHidden ? '패드 보이기' : '패드 숨김';
      miniPadBtn.setAttribute('aria-pressed', String(padHidden));
    }
  }

  function syncLandscape() {
    const landscape = window.innerWidth > window.innerHeight;
    if (lastLandscape !== null && lastLandscape !== landscape) overlayDismissed = false;
    lastLandscape = landscape;
    const overlay = touchDevice && landscape && !overlayDismissed;
    document.documentElement.dataset.landscape = overlay ? 'on' : 'off';
    if (miniBar) miniBar.hidden = !overlay;
    if (padMoreBtn && !overlay) {
      pad.dataset.extra = 'closed';
      padMoreBtn.setAttribute('aria-expanded', 'false');
    }
    applyPadHidden();
  }

  window.addEventListener('resize', syncLandscape);
  window.addEventListener('orientationchange', () => { overlayDismissed = false; syncLandscape(); });
  document.addEventListener('fullscreenchange', syncLandscape);
  syncLandscape();

  if (miniPadBtn) {
    miniPadBtn.addEventListener('click', () => {
      padHidden = !padHidden;
      applyPadHidden();
      toast(padHidden ? '가상 패드를 숨겼습니다' : '가상 패드를 표시합니다');
    });
  }
  if (miniMuteBtn) miniMuteBtn.addEventListener('click', toggleMute);
  if (miniExitBtn) {
    miniExitBtn.addEventListener('click', async () => {
      if (document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch (_) { /* ignore */ }
        toast('전체화면을 나갔습니다');
        return;
      }
      overlayDismissed = true;
      syncLandscape();
      toast('가상 전체화면을 닫았습니다 — 화면을 돌리면 다시 열립니다');
    });
  }
  if (padMoreBtn) {
    padMoreBtn.addEventListener('click', () => {
      const open = pad.dataset.extra !== 'open';
      pad.dataset.extra = open ? 'open' : 'closed';
      padMoreBtn.setAttribute('aria-expanded', String(open));
    });
  }

  /* ------------------------------------------------ phone soft keyboard -- */
  /* a 1px text field summons the OS keyboard; characters are translated into
     js-dos key events. Android IMEs only report the character in `input`
     (keydown gives keyCode 229), so that event is the real source. */
  const CHAR_CODES = {
    ' ': 'Space',
    '.': 'Period',
    ',': 'Comma',
    '-': 'Minus',
    '=': 'Equal',
    ';': 'Semicolon',
    "'": 'Quote',
    '/': 'Slash',
    '\\': 'Backslash',
    '[': 'BracketLeft',
    ']': 'BracketRight',
    '`': 'Backquote',
  };

  function codeForChar(ch) {
    if (/^[a-zA-Z]$/.test(ch)) return `Key${ch.toUpperCase()}`;
    if (/^[0-9]$/.test(ch)) return `Digit${ch}`;
    return CHAR_CODES[ch] || null;
  }

  /* a short down/up pair: one DOS keystroke */
  function tapCode(code) {
    if (!code || !KBD[code]) return false;
    press(code, false);
    setTimeout(() => release(code), 70);
    return true;
  }

  function openSoftKeyboard() {
    if (!softInput) return;
    if (!state.running) { toast('먼저 게임을 실행하세요'); return; }
    softInput.value = '';
    try { softInput.focus({ preventScroll: true }); } catch (_) { softInput.focus(); }
  }

  if (softKbBtn) softKbBtn.addEventListener('click', openSoftKeyboard);
  if (miniKbBtn) miniKbBtn.addEventListener('click', openSoftKeyboard);

  if (softInput) {
    softInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); tapCode('Enter'); }
      else if (event.key === 'Backspace') { event.preventDefault(); tapCode('Backspace'); }
    });
    softInput.addEventListener('beforeinput', (event) => {
      if (event.inputType === 'deleteContentBackward') {
        event.preventDefault();
        tapCode('Backspace');
      } else if (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph') {
        event.preventDefault();
        tapCode('Enter');
      }
    });
    softInput.addEventListener('input', () => {
      const typed = softInput.value;
      softInput.value = '';
      for (const ch of typed) {
        if (ch === '\n' || ch === '\r') tapCode('Enter');
        else tapCode(codeForChar(ch));
      }
    });
    softInput.addEventListener('blur', () => { softInput.value = ''; });
  }

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
    actions: ACTIONS,
    keymap: () => JSON.parse(JSON.stringify(keymap)),
    keyLabel,
    openKeymap,
    closeKeymap,
    isTouch: touchDevice,
  };
})();
