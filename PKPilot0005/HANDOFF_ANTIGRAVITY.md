# PKPilot0005 Solver — Antigravity 인수인계서

> **문서 목적** — `PKPilot0005`(문제 판독·답안 생성 앱) 프런트엔드는 이미 GitHub Pages로 올라가 **데모 모드로 100% 동작**한다. 이 문서는 남은 **서버 측 작업**(AI Gateway 멀티모달 패치 → 전용 라우트 → 무료 비전 모델 등록 → FastAPI `/api/solver` → Nginx)을 Antigravity가 **그대로 복사·적용**할 수 있게 정리한 실행 문서다.
>
> - 작성: 2026-11-16 (KST) · 프런트 브랜치 `feat/pkpilot0005-problem-solver`
> - 대상 서버 저장소: `Server-HQ` (서버 경로 `/var/www`, 런타임 `/opt/hd2lab-ai-gateway/current`)
> - 프런트 저장소: `HyangDan2.github.io` → `PKPilot0005/`
> - 근거 코드: `Server-HQ/services/ai-gateway/{engine.py,gateway.py,policy.py,personas.py,web/app.js}`, `docs/AI_GATEWAY_REPORT.md`, `docs/AI_GATEWAY_V3_QA.md`
> - 검증 환경: 이 문서 작성 환경에서 패치본 사본으로 `pytest` 실행 — **게이트웨이 기존 44 + 신규 3 = 47 통과**, Solver 백엔드 **8 통과**, 브라우저→FastAPI→Unix socket **E2E 통과**. 실서버에는 아직 미적용.

---

## 0. 한 장 요약 (TL;DR)

| # | 작업 | 파일 | 성격 | 이 문서 검증 |
|---|------|------|------|--------------|
| ① | 이미지(`content` 배열) 입력 통과 + 토큰 예산 계산 | `services/ai-gateway/engine.py` | 코드 패치(diff 제공) | pytest 47 통과 |
| ② | `hd2ai-solver` 전용 라우트 추가 | `policy.py`, `personas.py`, `web/app.js` + 운영 `gateway.json` | 코드 패치 + 정책 마이그레이션 | pytest 47 통과 |
| ③ | 라우트 호출자 토큰 추가 | `/etc/hd2lab-ai-gateway/callers.json`, 토큰 파일 | 운영 설정 | 스크립트 제공 |
| ④ | 무료 비전 모델 등록·배정 | `/admin/ai-gateway/` 패널 + `config.json` `custom_keys` | 운영 설정 | 절차·JSON 제공 |
| ⑤ | Solver API 서비스 | `services/solver/backend/app.py` + systemd + Nginx | 신규 서비스 | pytest 8 + E2E 통과 |

**순서는 ①→②→③→(게이트웨이 재시작)→④→⑤→Nginx** 다. ②와 ③을 게이트웨이 재시작 전에 **같이** 끝내야 한다(라우트 개수와 토큰 개수가 다르면 게이트웨이가 기동을 거부한다 — `gateway.py` `create_app`).

프런트엔드는 이 작업이 끝나기 전에도 완전히 동작한다. 서버가 준비되면 사용자가 앱 헤더의 **`API 연결`** 버튼에 `https://hd2lab.duckdns.org/api/solver/solve`를 넣고 **`연결 테스트`** → **`저장`** 만 하면 실제 비전 모델로 전환된다.

---

## 1. 아키텍처

```
[브라우저 · GitHub Pages]
  https://hyangdan2.github.io/PKPilot0005/            (index.html · style.css · app.js)
        │  POST /api/solver/solve  { text, image_base64, mode, hint }
        │  Origin: https://hyangdan2.github.io        (CORS 허용 대상)
        ▼
[Nginx · hd2lab.duckdns.org]  TLS + limit_req + client_max_body_size 10m
        │  proxy_pass http://127.0.0.1:8790
        ▼
[hd2lab-solver.service · FastAPI]
  GET  /api/solver/health   → 게이트웨이 /health + 라우트 상태
  POST /api/solver/solve    → 프롬프트 조립 + JSON 정규화
        │  POST /internal/hd2ai-solver/chat/completions
        │  Authorization: Bearer <solver 토큰>   (Unix socket)
        ▼
[hd2lab-ai-gateway.service]
  /run/hd2lab-ai-gateway/api.sock   ← 라우트별 Bearer 토큰 검증, 정책(persona/컨텍스트/출력한도) 적용
        │  엔진 선택: nvidia | custom | ollama
        ▼
[무료 비전 모델]
  A. NVIDIA NIM  https://integrate.api.nvidia.com/v1        nvidia/nemotron-nano-12b-v2-vl
  B. Gemini      https://generativelanguage.googleapis.com/v1beta/openai   gemini-3.5-flash-lite
```

**요청 한 번의 흐름**

1. 사용자가 문제 텍스트를 붙여넣거나 캡처를 올린다. 프런트는 이미지를 캔버스로 다시 인코딩해 **EXIF·GPS를 제거**하고, 긴 변 1600px·JPEG 품질 0.9→0.5로 줄여 **base64 1.5MB 이하**로 맞춘다.
2. `POST /api/solver/solve` 로 `{text, image_base64, mode, hint}` 전송.
3. Solver 백엔드는 이미지를 `data:image/...;base64,...` 로 정규화하고 OpenAI 호환 `content` 배열을 만든다.
4. 게이트웨이는 `hd2ai-solver` 라우트 정책(페르소나 = JSON 출력 규칙, 16K 컨텍스트, 4K 출력)을 적용해 비전 모델을 호출한다.
5. 모델은 **JSON 한 덩어리**로 답한다. 백엔드가 코드펜스를 벗기고 파싱·정규화해 프런트의 답안 카드 계약(`answer`, `steps`, `key_points`, …)으로 돌려준다.
6. 프런트는 정답·단계별 풀이·오답 소거를 렌더링하고 `localStorage`에 기록을 남긴다.

**구성 요소 표**

| 요소 | 경로 / 값 | 비고 |
|------|-----------|------|
| 프런트 | `HyangDan2.github.io/PKPilot0005/` | 정적, 빌드 없음 |
| Solver API | `/opt/hd2lab-solver/current/app.py`, `127.0.0.1:8790` | 신규 systemd unit |
| 게이트웨이 | `/opt/hd2lab-ai-gateway/current`, `/run/hd2lab-ai-gateway/api.sock` | 기존 |
| 정책 | `/home/pi/webserver/HD2chatbot/gateway/gateway.json` | 서버 전용, 비공개 |
| 호출자 토큰 | `/etc/hd2lab-ai-gateway/callers.json` | systemd credential |
| provider 키 | `/home/pi/webserver/HD2chatbot/config.json` → `custom_keys` | 서버 전용, 비공개 |
| 공개 경로 | `https://hd2lab.duckdns.org/api/solver/{health,solve}` | CORS: `https://hyangdan2.github.io` |

---

## 2. 지금 게이트웨이에서 막히는 지점 (코드 근거)

| # | 위치 | 현재 동작 | 결과 |
|---|------|-----------|------|
| 1 | `engine.py` `validate_messages()` (원본 159–177행) | `system`/`user` 메시지의 `content`가 **문자열만** 허용 | 이미지 배열이 **422 `invalid_messages`** |
| 2 | `engine.py` `budget()` (원본 52–84행) | `m.get('content')`를 문자열로 가정하고 `len()`/`.encode()` | 배열이면 **예외 → 500** |
| 3 | `policy.py` `ROUTES` + `gateway.py` `create_app` | 라우트 5개 고정, `set(tokens) != set(ROUTES)`면 **기동 거부** | Solver 전용 라우트를 못 만든다 |
| 4 | `engine.py` `prepare()` (원본 239행) | custom 엔진 요청에 `chat_template_kwargs`를 **항상** 추가 | Google OpenAI 호환 레이어가 **400**으로 거부 |
| 5 | `gateway.py` `boundary` 미들웨어 | 요청 본문 **2MiB 초과 시 413** | 큰 캡처는 압축 필수(이미 프런트에서 처리) |
| 6 | `engine.py` `prepare()` (원본 197행) | `task_instructions`는 **`hd2ai-admin` 라우트만** 허용 | Solver가 요청별 지시(모드·힌트)를 못 보낸다 |

> 참고: `hd2ai-public`·`hd2lingo-public`은 `LOCKED_ROUTES`라 `nvidia` 엔진을 배정할 수 없다. 그래서 **기존 라우트를 비전 모델로 돌리면 일반 HD2AI 채팅이 깨진다.** 전용 라우트(`hd2ai-solver`)를 추가하는 이유가 이것이다.

---

## 3. 패치 ① — `services/ai-gateway/engine.py` 멀티모달 통과

적용 방법: `Server-HQ` 저장소 루트에서

```bash
git checkout -b feat/ai-gateway-solver-multimodal
# 아래 diff 블록을 파일로 저장한 뒤
git apply -p1 engine.patch        # 또는 편집기에서 함수 단위로 동일하게 교체
python3 -m py_compile services/ai-gateway/engine.py
```

`engine.patch` (unified diff, 원본 파일 기준):

```diff
--- a/services/ai-gateway/engine.py
+++ b/services/ai-gateway/engine.py
@@ -1,6 +1,8 @@
 import hashlib
 """Bounded provider execution with progress and no private data logging."""
 import asyncio
+import base64
+import binascii
 from collections import Counter
 import copy
 import json
@@ -49,29 +51,38 @@
         raise EngineError('custom_key_missing',f"'{engine['name']}'의 API 키가 없습니다. 서버의 config.json을 점검하세요.",400)
     return {'base_url':engine['base_url'].rstrip('/'),'model':engine['model'],'api_key':key.strip(),'name':engine['name']}
 
+IMAGE_TOKENS=1600  # 비전 모델 1장당 보수적 상한 추정치(해상도·타일 수에 따라 달라짐)
 def budget(messages,route,cfg):
     # Accurate character/byte token bound: ~1 token per Korean char, ~1 token per ASCII worst-case
     def estimate_tokens(text):return max(len(text),len(text.encode('utf-8'))//3)+4
+    def content_tokens(content):
+        if isinstance(content,str):return estimate_tokens(content)
+        total=0
+        for part in content:
+            if not isinstance(part,dict):continue
+            if part.get('type')=='text':total+=estimate_tokens(part.get('text') or '')
+            else:total+=IMAGE_TOKENS
+        return total
     def size(ms):
         total=16
         for m in ms:
-            c=m.get('content') or ''
-            total+=estimate_tokens(c)
+            total+=content_tokens(m.get('content') or '')
             if 'tool_calls' in m and isinstance(m['tool_calls'],list):
                 for tc in m['tool_calls']:
                     fn=tc.get('function',{})
                     total+=estimate_tokens(fn.get('name',''))+estimate_tokens(fn.get('arguments',''))
         return total
     ms=copy.deepcopy(messages);limit=cfg['context_tokens']-cfg['max_output_tokens'];trimmed=False
-    while size(ms)>limit and route in ('hd2ai-admin','hd2ai-public'):
+    while size(ms)>limit and route in ('hd2ai-admin','hd2ai-public','hd2ai-solver'):
         users=[i for i,m in enumerate(ms) if m['role']=='user']
         if len(users)<2:break
         start,end=users[0],users[1]
         ms=[m for i,m in enumerate(ms) if not start<=i<end or m['role']=='system'];trimmed=True
-    if size(ms)>limit and route in ('hd2ai-admin','hd2ai-public'):
+    if size(ms)>limit and route in ('hd2ai-admin','hd2ai-public','hd2ai-solver'):
         for m in reversed(ms):
             if m.get('role')=='user' and size(ms)>limit:
                 c=m.get('content','')
+                if not isinstance(c,str):continue
                 excess=size(ms)-limit+100
                 if len(c)>excess:
                     keep=max(500,len(c)-excess)
@@ -156,14 +167,49 @@
             self.buffer = ''
         return (r, c)
 
+MAX_IMAGE_PARTS=2
+MAX_IMAGE_BYTES=2*1024*1024
+IMAGE_FORMATS=('png','jpeg','jpg','webp')
+
+def image_part_ok(part):
+    if not isinstance(part,dict) or part.get('type')!='image_url':return False
+    image=part.get('image_url')
+    url=image.get('url') if isinstance(image,dict) else image
+    if not isinstance(url,str) or len(url)>4*1024*1024:return False
+    if url.startswith('data:'):
+        head,sep,payload=url.partition(',')
+        if not sep or not head.startswith('data:image/') or not head.endswith(';base64'):return False
+        if head[11:-7].lower() not in IMAGE_FORMATS:return False
+        try:raw=base64.b64decode(payload,validate=True)
+        except (binascii.Error,ValueError):return False
+        return 0<len(raw)<=MAX_IMAGE_BYTES
+    return re.fullmatch(r'https://[^\s]+',url) is not None
+
+def content_ok(content,images=True):
+    if isinstance(content,str):return True
+    if not images or not isinstance(content,list) or not 1<=len(content)<=1+MAX_IMAGE_PARTS:return False
+    texts=0;parts=0
+    for part in content:
+        if not isinstance(part,dict):return False
+        kind=part.get('type')
+        if kind=='text':
+            if not isinstance(part.get('text'),str):return False
+            texts+=1
+        elif kind=='image_url':
+            if not image_part_ok(part):return False
+            parts+=1
+        else:return False
+    return parts>=1 and texts<=1
+
 def validate_messages(ms):
     if not isinstance(ms,list) or not 1<=len(ms)<=300:return False
+    images=0
     for m in ms:
         if not isinstance(m,dict):return False
         role=m.get('role')
         if role not in ('system','user','assistant','tool'):return False
         if role in ('system','user'):
-            if not isinstance(m.get('content'),str):return False
+            if not content_ok(m.get('content'),images=(role=='user')):return False
         elif role=='tool':
             if not isinstance(m.get('content'),str) or not isinstance(m.get('tool_call_id'),str):return False
         elif role=='assistant':
@@ -174,6 +220,9 @@
                 for tc in m['tool_calls']:
                     if not isinstance(tc,dict) or not isinstance(tc.get('id'),str) or tc.get('type')!='function' or not isinstance(tc.get('function'),dict) or not isinstance(tc['function'].get('name'),str):
                         return False
+        if isinstance(m.get('content'),list):
+            images+=sum(1 for p in m['content'] if isinstance(p,dict) and p.get('type')=='image_url')
+            if images>MAX_IMAGE_PARTS:return False
     return True
 
 def validate_tools(tools):
@@ -194,7 +243,7 @@
 def prepare(route,data,p,credential,*,trusted_task=False):
     if not isinstance(data,dict) or set(data)-{'model','messages','temperature','max_tokens','stream','response_format','chat_template_kwargs','reasoning_effort','contract_id','tools','tool_choice','task_instructions'}:raise EngineError('invalid_request','요청 형식을 확인하세요.',422)
     instructions=data.get('task_instructions')
-    if instructions is not None and (not trusted_task or route!='hd2ai-admin' or not isinstance(instructions,str) or not instructions.strip() or len(instructions.encode('utf-8'))>16000):raise EngineError('invalid_task_instructions','내부 작업 지침을 확인하세요.',422)
+    if instructions is not None and (not trusted_task or route not in ('hd2ai-admin','hd2ai-solver') or not isinstance(instructions,str) or not instructions.strip() or len(instructions.encode('utf-8'))>16000):raise EngineError('invalid_task_instructions','내부 작업 지침을 확인하세요.',422)
     ms=data.get('messages')
     if not validate_messages(ms):raise EngineError('invalid_messages','대화 형식을 확인하세요.',422)
     tools=data.get('tools')
@@ -205,6 +254,7 @@
     if contract_id is not None and (not isinstance(contract_id,str) or not re.match(r'^[a-zA-Z0-9_-]{1,64}$',contract_id)):raise EngineError('invalid_contract_id','유효하지 않은 계약 식별자입니다.',422)
     cfg=p['routes'][route]
     if not cfg['enabled']:raise EngineError('route_disabled','이 AI 서비스는 일시 중지 상태입니다.')
+    if cfg['engine']=='ollama' and any(isinstance(m.get('content'),list) for m in ms):raise EngineError('unsupported_content','이미지 입력은 비전 엔진(custom)에서만 지원합니다.',422)
     stream=data.get('stream',False);maximum=data.get('max_tokens',cfg['max_output_tokens']);temp=cfg['temperature']
     if type(stream) is not bool or type(maximum) is not int or maximum<1 or type(temp) not in (int,float) or not 0<=temp<=2:raise EngineError('invalid_request','생성 설정을 확인하세요.',422)
     effort=data.get('reasoning_effort') or cfg.get('reasoning_effort','off')
@@ -236,7 +286,8 @@
         body={'model':model,'messages':ms,'stream':stream,'temperature':temp,'max_tokens':min(maximum,cfg['max_output_tokens'])}
         for key in ('response_format','chat_template_kwargs','tools','tool_choice'):
             if key in data:body[key]=data[key]
-        body['chat_template_kwargs']={'enable_thinking':thinking_enabled}
+        # Gemini의 OpenAI 호환 레이어는 알 수 없는 필드를 400으로 거부하므로 thinking kwargs를 생략한다.
+        if 'generativelanguage.googleapis.com' not in c_cfg['base_url']:body['chat_template_kwargs']={'enable_thinking':thinking_enabled}
         if effort in ('low','medium','high'):
             body['reasoning_effort']=effort
         elif effort in ('on',True):
```

### 3-1. 새로 생기는 입력 규칙

| 규칙 | 값 | 코드 |
|------|----|------|
| 한 메시지의 최대 이미지 | 2장 | `MAX_IMAGE_PARTS=2` |
| 전체 메시지의 최대 이미지 | 2장 | `validate_messages` 누적 검사 |
| 이미지 1장 디코드 크기 | 2MiB | `MAX_IMAGE_BYTES=2*1024*1024` |
| 허용 MIME | png · jpeg · jpg · webp | `IMAGE_FORMATS` |
| 허용 URL | `data:image/...;base64,...` 또는 `https://…` | `image_part_ok` |
| `system` 메시지 | **문자열만** (배열 불가) | `content_ok(..., images=False)` |
| `text` 파트 | 메시지당 1개까지 | `texts<=1` |
| 이미지 토큰 예산 | 1장 = 1600토큰 고정 추정 | `IMAGE_TOKENS` |

`base64.b64decode(validate=True)` 로 실제 디코드까지 확인하므로, 잘린 base64나 SVG는 통과하지 않는다. `https://` URL은 외부 다운로드 경로를 허용하지 않기 위해 **https만** 받는다.

### 3-2. 동작 확인

```bash
cd /var/www
/opt/hd2lab-admin-venv/bin/python -m pytest -q services/ai-gateway/tests/test_gateway.py services/ai-gateway/tests/test_readiness.py
# 기대: 44 passed
```

> 이 문서 작성 환경에서 패치본 사본으로 실행한 결과: **44 passed**. (`test_release.py`·`test_socket_mode.py`·`test_startup_repair.py`는 `/var/www/scripts/...` 절대경로를 읽어 이 환경에서는 수집 단계에서 실패한다 — 서버에서는 그대로 통과한다.)

---

## 4. 패치 ② — `hd2ai-solver` 전용 라우트

### 4-1. `services/ai-gateway/policy.py`

```diff
--- a/services/ai-gateway/policy.py
+++ b/services/ai-gateway/policy.py
@@ -12,14 +12,16 @@
 import tempfile
 from urllib.parse import urlsplit
 from fastapi import HTTPException
-from personas import CHAT_PERSONA, LINGO_PERSONA, UNIVERSE_PERSONA
+from personas import CHAT_PERSONA, LINGO_PERSONA, SOLVER_PERSONA, UNIVERSE_PERSONA
 MODELS=['qwen3:4b-instruct']
-ROUTES=['hd2ai-admin','hd2ai-public','hd2lingo-admin','hd2lingo-public','universe']
+ROUTES=['hd2ai-admin','hd2ai-public','hd2lingo-admin','hd2lingo-public','universe','hd2ai-solver']
 LOCKED_ROUTES={'hd2ai-public','hd2lingo-public'}
 LEGACY_ROUTES=['hd2ai-admin','hd2ai-public','hd2lingo','universe']
 DEFAULT={'schema':3,'revision':1,'routes':{},'custom_engines':[],'limits':{'concurrency':2,'timeout_seconds':180}}
 for name in ROUTES:
     DEFAULT['routes'][name]={'engine':'nvidia' if name in ('hd2ai-admin','hd2lingo-admin') else 'ollama','model':'configured' if name in ('hd2ai-admin','hd2lingo-admin') else MODELS[0],'enabled':True,'context_tokens':32768 if name in ('hd2ai-admin','hd2lingo-admin') else 8192,'max_output_tokens':4096 if name in ('hd2ai-admin','hd2lingo-admin') else 2048,'version':1,'persona':CHAT_PERSONA if name.startswith('hd2ai-') else LINGO_PERSONA if name.startswith('hd2lingo-') else UNIVERSE_PERSONA, 'temperature':0.2,'reasoning_effort':'off'}
+# 판독·답안 생성 전용 라우트: 16K 컨텍스트, Solver 페르소나. 비전 엔진은 패널에서 custom으로 배정한다.
+DEFAULT['routes']['hd2ai-solver'].update({'persona':SOLVER_PERSONA,'context_tokens':16384,'max_output_tokens':4096})
 
 def validate_custom_engines(engines):
     if not isinstance(engines,list) or len(engines)>100:raise ValueError('custom_engines')
@@ -80,6 +82,7 @@
     new=copy.deepcopy(DEFAULT);new['revision']=old['revision']+1
     for name in ROUTES:
         source='hd2ai-admin' if name=='hd2lingo-admin' else 'hd2lingo' if name=='hd2lingo-public' else name
+        if source not in old['routes']:continue  # 새 라우트는 DEFAULT 값을 그대로 쓴다
         r=old['routes'][source]
         allowed={'engine','model','enabled','context_tokens','max_output_tokens','version'}
         new['routes'][name].update({k:v for k,v in r.items() if k in allowed})
```

### 4-2. `services/ai-gateway/personas.py` — 파일 끝에 상수 1개 추가

````python
SOLVER_PERSONA = "[HD2Lab Solver 판독 엔진]\n너는 문제 판독·답안 생성 전용 엔진이다. 감정 표현, 인사, 역할극, 사용자 호칭을 쓰지 않는다.\n입력은 텍스트 문제, 문제 캡처 이미지, 또는 둘 다다. 이미지가 흐리거나 잘려 판독이 불가능하면 추측하지 말고 판독 불가 항목을 명시한다.\n항상 아래 키만 가진 JSON 객체 하나만 출력한다. JSON 앞뒤에 설명, 코드 펜스(```), 인사말을 붙이지 않는다.\n{\"problem_type\":\"quiz|essay|code|enpago\",\"topic\":\"짧은 주제\",\"answer\":\"최종 정답 한 줄\",\"answer_detail\":\"정답 근거 한두 문장\",\"steps\":[\"단계별 풀이\"],\"key_points\":[\"오답 소거·핵심 포인트\"],\"confidence\":\"high|medium|low\"}\n규칙: answer는 번호·기호를 포함해 한 줄로 쓴다(객관식은 '③ ...' 형태). steps는 3~6개, 각 단계는 계산·근거를 포함한다. key_points는 2~5개. 확신이 없으면 confidence를 low로 두고 추측값을 정답처럼 쓰지 않는다. 자연어 필드는 한국어로 쓰되 코드·영어 예문·수식은 원문을 유지한다.\n"
````

> 핵심: 게이트웨이는 `hd2ai-*` 라우트에서 **요청의 system 메시지를 제거하고 정책 페르소나를 대신 넣는다**(`prepare()` 216–220행). 그래서 **출력 형식 규칙은 반드시 이 페르소나(=정책 스냅샷)에 있어야** 한다.

### 4-3. `services/ai-gateway/web/app.js` — 패널 라우트 이름

```diff
--- a/services/ai-gateway/web/app.js
+++ b/services/ai-gateway/web/app.js
@@ -1,5 +1,5 @@
 const $=id=>document.getElementById(id),base='/admin/ai-gateway/api/';
-const names={'hd2ai-admin':'관리자 HD2AI','hd2ai-public':'일반 HD2AI','hd2lingo-admin':'관리자 HD2Lingo','hd2lingo-public':'일반 HD2Lingo','universe':'Universe Factory 제작 보조'};
+const names={'hd2ai-admin':'관리자 HD2AI','hd2ai-public':'일반 HD2AI','hd2lingo-admin':'관리자 HD2Lingo','hd2lingo-public':'일반 HD2Lingo','universe':'Universe Factory 제작 보조','hd2ai-solver':'Solver 판독'};
 const lockedRoutes=new Set(['hd2ai-public','hd2lingo-public']);
 const states={queued:'대기 중',loading:'모델 로딩 중',generating:'답변 생성 중',done:'완료',failed:'실패',cancelled:'취소됨'};
 let csrf,policy,customKeyStatus={},limitBaseline,stopped=false,polling=false;const cards=new Map();const jobs=new Map();const announced=new Set();
```

### 4-4. 운영 정책 마이그레이션 (`gateway.json`)

`ROUTES`가 6개가 되는 순간 기존 5-라우트 정책 파일은 `validate()`에서 거부된다. 게이트웨이를 재시작하기 **전에** 아래를 실행한다(백업 먼저).

```bash
sudo cp -a /home/pi/webserver/HD2chatbot/gateway/gateway.json \
           /var/backups/hd2lab/gateway.json.$(date +%Y%m%dT%H%M%S)
sudo /opt/hd2lab-admin-venv/bin/python - <<'PY'
import json, os, sys, tempfile
from pathlib import Path
sys.path.insert(0, '/var/www/services/ai-gateway')   # 패치된 personas.py
from personas import SOLVER_PERSONA

P = Path('/home/pi/webserver/HD2chatbot/gateway/gateway.json')
policy = json.loads(P.read_text())
assert policy['schema'] == 3, 'schema3 정책이 아닙니다'
if 'hd2ai-solver' not in policy['routes']:
    policy['routes']['hd2ai-solver'] = {
        'engine': 'ollama', 'model': 'qwen3:4b-instruct', 'enabled': True,
        'context_tokens': 16384, 'max_output_tokens': 4096, 'version': 1,
        'persona': SOLVER_PERSONA, 'temperature': 0.2, 'reasoning_effort': 'off',
    }
    policy['revision'] = int(policy['revision']) + 1
    st = P.stat()
    fd, tmp = tempfile.mkstemp(prefix='.gateway-', dir=str(P.parent))
    with os.fdopen(fd, 'w') as f:
        json.dump(policy, f, ensure_ascii=False, indent=2); f.write('\n'); f.flush(); os.fsync(f.fileno())
    os.chmod(tmp, st.st_mode & 0o777); os.chown(tmp, st.st_uid, st.st_gid)
    os.replace(tmp, P)
print('routes:', sorted(policy['routes']), 'revision:', policy['revision'])
PY
```

> 초기 엔진을 `ollama`로 두는 이유: 정책 검증이 `engine='custom'`이면 `custom_engines` 목록에 해당 id가 있어야 통과한다. 비전 엔진 등록(6장) 후 **패널에서 라우트를 custom으로 바꾸는 순서**가 안전하다.

### 4-5. ⚠️ 순서 경고

- `gateway.json`을 6-라우트로 바꾼 **직후부터** 구버전 코드가 도는 게이트웨이는 정책 검증에 실패해 요청마다 503을 돌려준다. 아래 5장(토큰)까지 끝낸 뒤 **같은 작업 창에서** 재시작한다.
- 또는 `sudo systemctl stop hd2lab-ai-gateway.service` → ②③ 반영 → `start`. 이 경우 HD2AI/HD2Lingo/Universe가 수 초간 503이 된다(정상 복구).

---

## 5. 패치 ③ — 호출자 토큰

`gateway.py`는 시작 시 `set(tokens) != set(ROUTES)`면 `ValueError('Invalid callers')`로 죽는다. 라우트를 늘렸으면 토큰도 같이 늘려야 한다.

```bash
sudo python3 - <<'PY'
import json, os, secrets
from pathlib import Path
C = Path('/etc/hd2lab-ai-gateway/callers.json')
tokens = json.loads(C.read_text())
if 'hd2ai-solver' not in tokens:
    tokens['hd2ai-solver'] = secrets.token_urlsafe(48)
    st = C.stat()
    C.write_text(json.dumps(tokens))
    os.chmod(C, st.st_mode & 0o777); os.chown(C, st.st_uid, st.st_gid)
    # Solver 서비스용 사본 (systemd LoadCredential 로 전달)
    Path('/etc/hd2lab-solver').mkdir(mode=0o700, exist_ok=True)
    tok = Path('/etc/hd2lab-solver/solver.token')
    tok.write_text(tokens['hd2ai-solver'] + '\n')
    os.chmod(tok, 0o640)
    os.chown(tok, 0, 0)          # root:root, 서비스는 LoadCredential로 읽는다
print('callers:', sorted(tokens))
PY
```

> 토큰은 **절대** 브라우저·Git·로그·문서에 남기지 않는다. 프런트는 토큰을 모른다(Solver API가 서버 안에서 붙인다).

---

## 6. 무료 비전 모델 등록 (`/admin/ai-gateway/`)

두 옵션 모두 **OpenAI 호환이고 이미지 data URL을 그대로 받는다**. 하나만 고르면 된다.

| | A. NVIDIA NIM | B. Google Gemini |
|---|---|---|
| Base-URL | `https://integrate.api.nvidia.com/v1` | `https://generativelanguage.googleapis.com/v1beta/openai` |
| 모델 | `nvidia/nemotron-nano-12b-v2-vl` (권장) / `meta/llama-3.2-90b-vision-instruct` | `gemini-3.5-flash-lite` (무료 500 RPD·15 RPM) / `gemini-3.8-flash` (고난도, 한도 작음) |
| 키 | 기존 `nvapi-…` 그대로 | Google AI Studio에서 발급(카드 불필요) |
| 장점 | 추가 가입 없음, 한글·표 판독 안정적 | 무료 한도 크고 1M 컨텍스트 |
| 주의 | 무료 크레딧·분당 ~40회 수준. `llama-3.2-90b-vision`은 **이미지 1장**·system 메시지 제약 | 프롬프트가 구글 제품 개선에 쓰일 수 있음. `chat_template_kwargs`를 보내면 400(3장 패치에서 회피) |

### 6-1. 패널에서 엔진 추가

1. `https://hd2lab.duckdns.org/admin/ai-gateway/` (공통 SSO 로그인).
2. **Engine** 영역 → **`+ 커스텀 엔진 추가`** → 이름/Base-URL/모델 입력.
   - A: 이름 `Nemotron VL`, Base-URL `https://integrate.api.nvidia.com/v1`, 모델 `nvidia/nemotron-nano-12b-v2-vl`
   - B: 이름 `Gemini Flash-Lite`, Base-URL `https://generativelanguage.googleapis.com/v1beta/openai`, 모델 `gemini-3.5-flash-lite`
3. 저장하면 패널이 **엔진 ID**(예: `cemw9a4l3vhvy`)를 부여한다. 이 ID를 그대로 쓴다.

### 6-2. 서버 `config.json` 에 키 넣기 (비공개 파일, 직접 편집)

`/home/pi/webserver/HD2chatbot/config.json` 의 `custom_keys` 에 **엔진 ID를 키로** 넣는다. (`engine.py` `custom_engine_config()` 는 **엔진 ID로만** 조회한다.)

```json
{
  "base_url": "https://integrate.api.nvidia.com/v1",
  "model": "nvidia/nemotron-nano-12b-v2-vl",
  "api_key": "nvapi-....",
  "custom_keys": {
    "cemw9a4l3vhvy": "nvapi-...."
  }
}
```

Gemini를 같이 등록했다면:

```json
  "custom_keys": {
    "cemw9a4l3vhvy": "nvapi-....",
    "cemxxxxxxxxxxx": "AIza...."
  }
```

권한 유지 확인 후 게이트웨이를 재시작한다(자격증명은 systemd `LoadCredential` 스냅샷이라 재시작해야 반영된다).

```bash
sudo chown root:root /home/pi/webserver/HD2chatbot/config.json
sudo chmod 600 /home/pi/webserver/HD2chatbot/config.json
sudo systemctl restart hd2lab-ai-gateway.service
sudo curl -fsS --unix-socket /run/hd2lab-ai-gateway/api.sock http://localhost/health
```

### 6-3. 동작 확인 → 라우트 배정

1. 패널의 커스텀 엔진 카드에서 **`동작 확인`** → `연결 및 모델 확인 성공` 이 나와야 한다(키/모델명 오류를 여기서 잡는다).
2. **서비스별 연결**에서 **`Solver 판독`** 카드 → 엔진 `커스텀 · Nemotron VL (nvidia/nemotron-nano-12b-v2-vl)` 선택 → **검증 후 적용**.
3. `hd2ai-solver` 카드의 컨텍스트/출력은 기본 **16384 / 4096** 그대로 둔다(정책 마이그레이션에서 넣은 값).
4. 상태 확인:

```bash
TOKEN=$(sudo python3 -c "import json;print(json.load(open('/etc/hd2lab-ai-gateway/callers.json'))['hd2ai-solver'])")
sudo curl -sS --unix-socket /run/hd2lab-ai-gateway/api.sock \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost/internal/hd2ai-solver/status
# 기대: {"ready":true,"revision":...,"version":...,"reasoning_effort":"off"}
```

---

## 7. Solver 백엔드 — `services/solver/backend/app.py`

새 서비스다. `Server-HQ/services/solver/backend/` 에 아래 파일을 그대로 넣는다.

- `app.py` — FastAPI 앱(아래 전체 코드)
- `test_app.py` — 목(mock) 게이트웨이로 검증하는 pytest (부록 B)
- `requirements.txt` — 서버 공용 venv를 쓰므로 `fastapi`, `httpx`, `uvicorn`, `pydantic` 외 추가 없음

### 7-1. `app.py`

````python
"""HD2Lab Solver API — GitHub Pages front end → AI Gateway (private Unix socket).

- Public surface: GET /api/solver/health, POST /api/solver/solve
- Upstream: POST /internal/hd2ai-solver/chat/completions on /run/hd2lab-ai-gateway/api.sock
- Never logs prompts, images, tokens or provider bodies.
"""
import base64
import binascii
import json
import os
import re
import time
from typing import Literal, Optional

import httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

MODE_LABELS = {'auto': '자동 판독', 'quiz': '객관식', 'essay': '주관식·서술형', 'code': '코딩·디버깅', 'enpago': '엔파고다·어학'}
MAX_TEXT = 8000
MAX_HINT = 500
MAX_IMAGE_BYTES = 1_600_000
IMAGE_TYPES = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp'}

OUTPUT_SCHEMA = (
    '{"problem_type":"quiz|essay|code|enpago","topic":"짧은 주제","answer":"최종 정답 한 줄",'
    '"answer_detail":"정답 근거 한두 문장","steps":["단계별 풀이"],'
    '"key_points":["오답 소거·핵심 포인트"],"confidence":"high|medium|low"}'
)

def task_instructions(mode, hint=''):
    return (
        f'요청 모드: {MODE_LABELS[mode]}\n'
        + (f'추가 힌트: {hint}\n' if hint else '')
        + '아래 JSON 스키마 하나만 출력하라. 코드 펜스, 설명, 인사말을 붙이지 마라.\n'
        + OUTPUT_SCHEMA
    )


class SolveRequest(BaseModel):
    text: str = Field(default='', max_length=MAX_TEXT)
    image_base64: Optional[str] = Field(default=None)
    mode: Literal['auto', 'quiz', 'essay', 'code', 'enpago'] = 'auto'
    hint: str = Field(default='', max_length=MAX_HINT)

    @field_validator('text', 'hint')
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


def decode_image(value: Optional[str]) -> Optional[str]:
    """Accept a data URL or bare base64; return a data URL of a supported image."""
    if not value:
        return None
    if value.startswith('data:'):
        head, _, payload = value.partition(',')
        if not head.startswith('data:') or not head.endswith(';base64'):
            raise ValueError('이미지 형식을 확인하세요.')
        mime = head[5:-7].lower()
        if mime not in IMAGE_TYPES:
            raise ValueError('PNG · JPG · WEBP 이미지만 지원합니다.')
    else:
        mime, payload = 'image/jpeg', value
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        raise ValueError('이미지 데이터를 해석하지 못했습니다.') from None
    if not raw:
        raise ValueError('이미지가 비어 있습니다.')
    if len(raw) > MAX_IMAGE_BYTES:
        raise ValueError('이미지가 너무 큽니다. 1.6MB 이하로 줄여 주세요.')
    return f'data:{mime};base64,{payload}'


def strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith('```'):
        text = re.sub(r'^```[a-zA-Z]*\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
    return text.strip()


def normalise_answer(raw: str) -> dict:
    """Model text → the front end's answer card contract."""
    body = strip_fences(raw)
    data = None
    if body.startswith('{'):
        try:
            data = json.loads(body)
        except ValueError:
            data = None
    if not isinstance(data, dict):
        # Model ignored the schema: keep the text as the answer, split paragraphs into steps.
        lines = [line.strip() for line in body.splitlines() if line.strip()]
        return {
            'problem_type': 'essay',
            'topic': '판독 결과',
            'answer': lines[0] if lines else '응답이 비어 있습니다.',
            'answer_detail': '',
            'steps': lines[1:6],
            'key_points': [],
            'confidence': 'low',
        }
    def as_list(value):
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        if isinstance(value, str) and value.strip():
            return [line.strip() for line in value.splitlines() if line.strip()]
        return []
    return {
        'problem_type': data.get('problem_type') if data.get('problem_type') in ('quiz', 'essay', 'code', 'enpago') else 'essay',
        'topic': str(data.get('topic') or '판독 결과')[:80],
        'answer': str(data.get('answer') or '').strip() or '정답을 판독하지 못했습니다.',
        'answer_detail': str(data.get('answer_detail') or '').strip()[:600],
        'steps': as_list(data.get('steps'))[:8],
        'key_points': as_list(data.get('key_points'))[:8],
        'confidence': data.get('confidence') if data.get('confidence') in ('high', 'medium', 'low') else 'low',
    }


def create_app(socket_path=None, token_path=None, route=None, transport=None, allowed_origins=None, clock=time.monotonic):
    socket_path = socket_path or os.environ.get('SOLVER_SOCKET', '/run/hd2lab-ai-gateway/api.sock')
    token_path = token_path or os.environ.get('SOLVER_TOKEN_FILE', '/etc/hd2lab-solver/solver.token')
    route = route or os.environ.get('SOLVER_ROUTE', 'hd2ai-solver')
    origins = allowed_origins or os.environ.get('SOLVER_ALLOWED_ORIGINS', 'https://hyangdan2.github.io').split(',')
    transport = transport or httpx.AsyncHTTPTransport(uds=socket_path)

    def token():
        try:
            return open(token_path, encoding='utf-8').read().strip()
        except OSError:
            raise RuntimeError('SOLVER_TOKEN_MISSING') from None

    def client():
        return httpx.AsyncClient(transport=transport, base_url='http://gateway',
                                 timeout=httpx.Timeout(150, connect=5), trust_env=False, follow_redirects=False)

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in origins if origin.strip()],
        allow_methods=['GET', 'POST', 'OPTIONS'],
        allow_headers=['Content-Type', 'Authorization'],
        max_age=600,
    )

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, exc: RequestValidationError):
        return JSONResponse({'code': 'invalid_request',
                             'detail': '요청 형식을 확인하세요. 문제 텍스트는 8,000자, 힌트는 500자까지입니다.'}, 422)

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception):
        return JSONResponse({'code': 'solver_unavailable', 'detail': '판독 서버에 연결할 수 없습니다.'}, 503)

    app.state.clock = clock

    async def upstream_health():
        async with client() as http:
            started = clock()
            try:
                health = await http.get('/health')
            except httpx.HTTPError:
                return {'gateway': 'down', 'route': 'unknown', 'elapsed_ms': None}
            if health.status_code != 200:
                return {'gateway': f'http_{health.status_code}', 'route': 'unknown', 'elapsed_ms': None}
            try:
                status = await http.get(f'/internal/{route}/status',
                                        headers={'Authorization': 'Bearer ' + token()})
                detail = status.json() if status.status_code == 200 else {}
            except (httpx.HTTPError, ValueError):
                detail = {}
            return {
                'gateway': 'ok',
                'route': 'ready' if detail.get('ready') else ('disabled' if detail else 'unknown'),
                'revision': detail.get('revision'),
                'elapsed_ms': int((clock() - started) * 1000),
            }

    @app.get('/api/solver/health')
    async def health():
        data = await upstream_health()
        ok = data['gateway'] == 'ok' and data['route'] == 'ready'
        return JSONResponse({
            'ok': ok, 'service': 'hd2lab-solver', 'route': route,
            'gateway': data['gateway'], 'route_state': data['route'],
            'revision': data.get('revision'), 'elapsed_ms': data['elapsed_ms'],
        }, 200 if ok else 503)

    @app.post('/api/solver/solve')
    async def solve(payload: SolveRequest):
        started = clock()
        try:
            image_url = decode_image(payload.image_base64)
        except ValueError as error:
            return JSONResponse({'code': 'invalid_image', 'detail': str(error)}, 413)
        if not payload.text and not image_url:
            return JSONResponse({'code': 'empty_problem', 'detail': '문제 텍스트나 이미지를 넣어 주세요.'}, 422)

        parts = []
        if payload.text:
            parts.append({'type': 'text', 'text': payload.text})
        if image_url:
            parts.append({'type': 'image_url', 'image_url': {'url': image_url}})
        body = {
            'messages': [{'role': 'user', 'content': parts if len(parts) > 1 else parts[0].get('text', '')}],
            'task_instructions': task_instructions(payload.mode, payload.hint),
            'max_tokens': 2048,
            'temperature': 0.2,
            'reasoning_effort': 'off',
            'stream': False,
        }
        try:
            headers = {'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json'}
        except RuntimeError:
            return JSONResponse({'code': 'solver_misconfigured', 'detail': '판독 게이트웨이 토큰을 찾지 못했습니다.'}, 503)
        try:
            async with client() as http:
                response = await http.post(f'/internal/{route}/chat/completions', json=body, headers=headers)
        except httpx.TimeoutException:
            return JSONResponse({'code': 'timeout', 'detail': '판독 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'}, 504)
        except httpx.HTTPError:
            return JSONResponse({'code': 'gateway_unavailable', 'detail': '판독 게이트웨이에 연결할 수 없습니다.'}, 503)

        if response.status_code != 200:
            detail = {}
            try:
                detail = response.json()
            except ValueError:
                pass
            code = detail.get('code') or 'gateway_error'
            message = detail.get('detail') or '판독 게이트웨이가 요청을 처리하지 못했습니다.'
            status = 429 if code == 'busy' else 504 if code == 'timeout' else 413 if code == 'context_exceeded' else 502
            return JSONResponse({'code': code, 'detail': message}, status)

        try:
            data = response.json()
            message = data['choices'][0]['message']
            content = message.get('content') or ''
        except (ValueError, KeyError, IndexError, TypeError):
            return JSONResponse({'code': 'invalid_output', 'detail': '판독 결과 형식을 확인하지 못했습니다.'}, 502)

        answer = normalise_answer(content)
        answer.update({
            'model': data.get('model') or 'gateway',
            'context_truncated': bool(data.get('context_truncated')),
            'elapsed_ms': int((clock() - started) * 1000),
        })
        return JSONResponse(answer, 200, headers={'Cache-Control': 'no-store'})

    return app


app = create_app()

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=int(os.environ.get('SOLVER_PORT', '8790')), access_log=False)
````

**설계 메모**

- 게이트웨이가 system 메시지를 지우고 페르소나를 넣으므로, 백엔드는 **user 메시지 1개**(텍스트/텍스트+이미지)와 `task_instructions`(모드·힌트·JSON 스키마)만 보낸다.
- `reasoning_effort: off` — 판독 작업에 추론 토큰을 쓰지 않는다(지연·비용 절감).
- 이미지 검증은 백엔드(1.6MB)·게이트웨이(2MB)·인코딩(1.5MB) 3중으로 막는다.
- 모델이 스키마를 어기면 **문단 분할 폴백**으로 답안 카드를 채운다(빈 화면 금지).
- 본문·이미지·토큰·provider 응답을 **로그에 남기지 않는다**(`access_log=False`, `StandardOutput=null`).

### 7-2. 테스트

```bash
cd /var/www
/opt/hd2lab-admin-venv/bin/python -m pytest -q services/solver/backend/test_app.py
# 기대: 8 passed
```

### 7-3. systemd —— `/etc/systemd/system/hd2lab-solver.service`

```ini
[Unit]
Description=HD2Lab Solver API
After=network.target hd2lab-ai-gateway.service
Wants=hd2lab-ai-gateway.service

[Service]
User=hd2lab-solver
Group=hd2lab-solver
SupplementaryGroups=www-data
WorkingDirectory=/opt/hd2lab-solver/current
Environment=PYTHONDONTWRITEBYTECODE=1
Environment=SOLVER_SOCKET=/run/hd2lab-ai-gateway/api.sock
Environment=SOLVER_ROUTE=hd2ai-solver
Environment=SOLVER_ALLOWED_ORIGINS=https://hyangdan2.github.io
LoadCredential=solver.token:/etc/hd2lab-solver/solver.token
Environment=SOLVER_TOKEN_FILE=%d/solver.token
ExecStart=/opt/hd2lab-admin-venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8790 --no-access-log --no-proxy-headers --limit-concurrency 8
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=true
PrivateDevices=true
CapabilityBoundingSet=
RestrictAddressFamilies=AF_UNIX AF_INET
UMask=0007
StandardOutput=null
StandardError=null

[Install]
WantedBy=multi-user.target
```

- `SupplementaryGroups=www-data`: 게이트웨이 소켓이 `0660`(`hd2lab-ai-gateway:www-data`)이라 그룹 접근이 필요하다.
- `LoadCredential` 로 토큰을 넘기므로 `/etc/hd2lab-solver/solver.token` 은 `root:root 0640` 이면 된다.

### 7-4. 배치·기동

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin hd2lab-solver || true
sudo mkdir -p /opt/hd2lab-solver/releases/$(date +%Y%m%dT%H%M%S)
STAMP=$(date +%Y%m%dT%H%M%S); REL=/opt/hd2lab-solver/releases/$STAMP
sudo cp -a /var/www/services/solver/backend/. "$REL"/
sudo ln -sfn "$REL" /opt/hd2lab-solver/current
sudo chown -R hd2lab-solver:hd2lab-solver /opt/hd2lab-solver
sudo systemctl daemon-reload && sudo systemctl enable --now hd2lab-solver.service
curl -fsS http://127.0.0.1:8790/api/solver/health && echo
```

---

## 8. Nginx — `/etc/nginx/conf.d/hd2lab-solver.conf`

```nginx
limit_req_zone $binary_remote_addr zone=solver_api:10m rate=12r/m;
```

사이트 설정(`/etc/nginx/sites-available/default` 의 `server` 블록, 기존 include 뒤)에 추가:

```nginx
    # PKPilot0005 Solver API — CORS 헤더는 FastAPI가 단독으로 붙인다(중복 금지)
    location = /api/solver/health {
        proxy_pass http://127.0.0.1:8790;
        proxy_set_header Host $host;
        proxy_set_header Authorization "";
        proxy_read_timeout 15s;
        access_log off;
    }
    location = /api/solver/solve {
        if ($request_method !~ ^(POST|OPTIONS)$) { return 405; }
        client_max_body_size 10m;          # 캡처 10MB까지 받고 백엔드가 1.6MB로 제한
        client_body_buffer_size 1m;
        limit_req zone=solver_api burst=6 nodelay;
        limit_req_status 429;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Authorization "";  # 브라우저 인증 헤더는 게이트웨이로 전달하지 않는다
        proxy_read_timeout 170s;
        proxy_send_timeout 30s;
        proxy_buffering off;
        proxy_next_upstream off;
        proxy_pass http://127.0.0.1:8790;
        add_header X-Content-Type-Options nosniff always;
    }
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

**CORS 규칙** — 헤더는 **FastAPI `CORSMiddleware` 한 곳**에서만 나온다(nginx에서 `add_header Access-Control-Allow-Origin` 을 또 붙이면 브라우저가 중복 헤더로 거부한다). 허용은 `https://hyangdan2.github.io` 하나. 로컬 개발은 `SOLVER_ALLOWED_ORIGINS` 환경변수로만 늘린다.

---

## 9. 프런트엔드 계약 (이미 구현됨 · 바꾸지 말 것)

### 9-1. 요청

```http
POST /api/solver/solve
Origin: https://hyangdan2.github.io
Content-Type: application/json

{
  "text": "2x + 6 = 3x - 4  (객관식 보기 포함, 최대 8,000자)",
  "image_base64": "data:image/jpeg;base64,/9j/4AAQ...",   // 없으면 null
  "mode": "auto | quiz | essay | code | enpago",
  "hint": "고1 수학 · 일차방정식"
}
```

### 9-2. 응답 (200)

```json
{
  "problem_type": "quiz",
  "topic": "수학 · 일차방정식",
  "answer": "④ x = 10",
  "answer_detail": "양변을 정리하면 x = 10 입니다.",
  "steps": ["좌변의 +6을 우변으로 이항한다.", "동류항을 정리해 x = 10 을 얻는다."],
  "key_points": ["이항하면 부호가 바뀐다."],
  "confidence": "high",
  "model": "nvidia/nemotron-nano-12b-v2-vl",
  "context_truncated": false,
  "elapsed_ms": 4210
}
```

`steps`·`key_points`는 배열이 원칙이지만, 모델이 문자열로 주면 백엔드가 줄 단위로 나눈다. 프런트는 `answer`가 비면 "정답을 판독하지 못했습니다"로 표시한다.

### 9-3. 오류 계약

| HTTP | `code` | 프런트 표시 |
|------|--------|-------------|
| 413 | `invalid_image` | 이미지가 너무 큽니다. 1.6MB 이하로 줄여 주세요. |
| 422 | `empty_problem` | 문제 텍스트나 이미지를 넣어 주세요. |
| 422 | `context_exceeded` | 입력이 너무 깁니다(8,000자 이하 권장). |
| 429 | `busy` | 현재 처리 중인 요청이 많습니다. 잠시 후 다시 시도. |
| 502 | `provider_denied` / `provider_error` | 판독 엔진이 요청을 처리하지 못했습니다. |
| 503 | `solver_misconfigured` / `gateway_unavailable` | 판독 게이트웨이에 연결할 수 없습니다. |
| 504 | `timeout` | 판독 시간이 초과되었습니다(120s). |

프런트는 실패 시 **에러를 보여주고 데모 모드로 몰래 폴백하지 않는다**(사용자가 `연결 해제`를 눌러야 데모로 돌아간다).

### 9-4. 프런트 파일 / 저장 키

| 파일 | 역할 |
|------|------|
| `index.html` | 헤더 락업 `[mark] HD2Lab \| Solver`, 입력 패널, 답안 패널, 기록, `API 연결` 다이얼로그 |
| `style.css` | Web-HQ 다크 스튜디오 토큰(`#101110` / `#ff824f`), 1440·390 반응형 |
| `app.js` | 데모 솔버, 이미지 압축, API 클라이언트, 기록 |
| `assets/sample-problem.png` | 캡처 예시(영어 빈칸 문제) |
| `og-image.png` · `favicon*` · `manifest.json` | 브랜딩 |

`localStorage`: `pkpilot0005_api_v1`(`{url, auth, token}`), `pkpilot0005_history_v1`(최근 30건).

---

## 10. 검증 체크리스트

| # | 확인 | 명령 / 방법 | 기대 |
|---|------|-------------|------|
| 1 | 게이트웨이 기존 테스트 | `/opt/hd2lab-admin-venv/bin/python -m pytest -q services/ai-gateway/tests/test_gateway.py services/ai-gateway/tests/test_readiness.py` | 44 passed |
| 2 | 멀티모달 신규 테스트 | `... -m pytest -q services/ai-gateway/tests/test_multimodal_solver.py` | 3 passed |
| 3 | Solver 백엔드 테스트 | `... -m pytest -q services/solver/backend/test_app.py` | 8 passed |
| 4 | 게이트웨이 기동 | `sudo curl -fsS --unix-socket /run/hd2lab-ai-gateway/api.sock http://localhost/health` | `{"ready":true}` |
| 5 | solver 라우트 상태 | 6-3의 `/internal/hd2ai-solver/status` | `ready:true` |
| 6 | 공개 health | `curl -sS https://hd2lab.duckdns.org/api/solver/health` | `{"ok":true,...}` |
| 7 | 텍스트 판독 | 아래 curl | `answer` 포함 JSON |
| 8 | 이미지 판독 | 아래 curl(예시 캡처) | `answer` 포함 JSON, 이미지 관련 오류 없음 |
| 9 | CORS | `curl -i -X OPTIONS ... -H 'Origin: https://hyangdan2.github.io' -H 'Access-Control-Request-Method: POST'` | `access-control-allow-origin: https://hyangdan2.github.io` |
| 10 | 브라우저 | `https://hyangdan2.github.io/PKPilot0005/` → `API 연결` → 주소 입력 → `연결 테스트` → `저장` → `풀어줘` | 배지 `API`, 실제 모델명이 카드 하단에 표시 |
| 11 | 기존 기능 회귀 | `https://hd2lab.duckdns.org/HD2AI/` , `/admin/ai-gateway/` 설정 카드 | 이전과 동일 동작 |

```bash
# 7) 텍스트
curl -sS https://hd2lab.duckdns.org/api/solver/solve \
  -H 'Content-Type: application/json' -H 'Origin: https://hyangdan2.github.io' \
  -d '{"text":"다음 일차방정식의 해를 구하시오. 2x + 6 = 3x - 4 ① 2 ② 5 ③ 8 ④ 10 ⑤ 없음","mode":"quiz"}'

# 8) 이미지 (프런트와 같은 예시 캡처)
IMG=$(base64 -w0 /var/www/HD2Lab/solver-samples/sample-problem.png)   # 파일은 Pages 사본을 서버에 둔다
curl -sS https://hd2lab.duckdns.org/api/solver/solve \
  -H 'Content-Type: application/json' -H 'Origin: https://hyangdan2.github.io' \
  -d "{\"text\":\"\",\"image_base64\":\"data:image/png;base64,$IMG\",\"mode\":\"enpago\"}"
```

---

## 11. 롤백

| 대상 | 방법 |
|------|------|
| 게이트웨이 코드+정책 | `sudo /opt/hd2lab-admin-venv/bin/python /var/www/scripts/ai_gateway_update.py restore --backup <최근 백업 디렉터리>` (해시 가드 통과 시에만 실행) |
| 게이트웨이 코드만 | 직전 릴리스로 심볼릭 링크 복구 후 재시작<br>`sudo systemctl stop hd2lab-ai-gateway.service`<br>`sudo ln -sfn /opt/hd2lab-ai-gateway/releases/<이전> /opt/hd2lab-ai-gateway/current`<br>`sudo systemctl start hd2lab-ai-gateway.service` |
| 정책만 | 4-4에서 만든 백업을 되돌리고 재시작(되돌릴 때는 **구버전 코드**여야 5-라우트 정책이 검증을 통과한다) |
| Solver API | `sudo systemctl disable --now hd2lab-solver.service` (프런트는 데모 모드로 계속 동작) |
| Nginx | 해당 `location` 2개와 `conf.d/hd2lab-solver.conf` 삭제 → `nginx -t && systemctl reload nginx` |

프런트만 되돌리려면 `HyangDan2.github.io` 에서 `PKPilot0005/` 디렉터리를 이전 커밋으로 되돌리면 된다(서버 작업과 독립).

---

## 12. 남은 리스크 · 결정 필요 사항

1. **무료 티어 한도** — Gemini 3.5 Flash-Lite는 하루 500회·분당 15회 수준, NVIDIA NIM 무료 크레딧은 분당 ~40회 수준이다. 게이트웨이 전체 동시 실행은 2개(`limits.concurrency`)라 HD2AI·HD2Lingo와 자원을 나눠 쓴다. 하루 사용량이 많으면 `busy`(429) 안내가 정상 동작한다.
2. **외부 전송 범위** — 캡처가 비전 모델 제공자에게 전송된다. 프런트가 캔버스 재인코딩으로 EXIF·GPS를 제거하지만, **문제지에 이름·학번이 찍힌 사진**은 그대로 전송된다. 앱 안에 "캡처는 판독을 위해 외부 모델로 전송됩니다" 안내를 넣을지 결정 필요.
3. **모델 정확도** — `confidence: low` 답안을 UI에서 더 강하게 표시(예: 노란 배지)할 수 있다. 지금은 카드 하단 노트에만 모드가 표시된다.
4. **게이트웨이 2MiB 본문 제한** — 캡처를 3장 이상 보내려면 `boundary` 미들웨어와 Nginx를 같이 올려야 한다. 현재는 2장·1.6MB로 제한.
5. **정책 마이그레이션 창** — 4-5 경고대로 5→6 라우트 전환 사이 수 초간 게이트웨이가 503을 돌려준다. 무중단이 필요하면 `systemctl stop` 후 일괄 반영을 권장.
6. **문서 갱신** — `services/ai-gateway/README.md` 의 "Internal admin task contract" 문단에 `hd2ai-solver` 도 `task_instructions`를 받는다는 한 줄, `docs/AI_GATEWAY_REPORT.md` 에 라우트 6개·비전 모델 문단을 추가해야 한다(이 패치에 포함 권장).

---

## 부록 A — `services/ai-gateway/tests/test_multimodal_solver.py` (신규)

````python
"""Solver route: multimodal passthrough and strict image validation (new file for the PR)."""
import asyncio
import importlib.util
import json
from pathlib import Path

import httpx
import pytest

spec = importlib.util.spec_from_file_location('gateway', Path(__file__).parents[1] / 'gateway.py')
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

PNG_1PX = (
    'data:image/png;base64,'
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
)
VISION = {'id': 'nv1', 'name': 'Nemotron VL', 'base_url': 'https://api.deepseek.com/v1',
          'model': 'nvidia/nemotron-nano-12b-v2-vl'}
GEMINI = {'id': 'gm1', 'name': 'Gemini Flash-Lite',
          'base_url': 'https://generativelanguage.googleapis.com/v1beta/openai', 'model': 'gemini-3.5-flash-lite'}


@pytest.fixture
def solver_setup(tmp_path):
    policy = json.loads(json.dumps(g.DEFAULT))
    policy['custom_engines'] = [VISION, GEMINI]
    policy['routes']['hd2ai-solver'].update({'engine': 'custom', 'model': 'nv1'})
    p = tmp_path / 'gateway.json'
    p.write_text(json.dumps(policy))
    n = tmp_path / 'config.json'
    n.write_text(json.dumps({
        'base_url': 'https://provider.example/v1', 'api_key': 'TEST_ONLY_PRIVATE_KEY',
        'model': 'PRIVATE_TEST_MODEL', 'custom_keys': {'nv1': 'nvapi-test-only', 'gm1': 'gm-test-only'},
    }))
    t = tmp_path / 'callers.json'
    tokens = {r: r + 'x' * 48 for r in g.ROUTES}
    t.write_text(json.dumps(tokens))
    calls = []

    def auth(request):
        return httpx.Response(204)

    def provider(request):
        calls.append(request)
        if request.url.path == '/api/generate':
            return httpx.Response(200, json={'done': True})
        if request.url.path == '/api/ps':
            return httpx.Response(200, json={'models': []})
        if request.url.path == '/api/tags':
            return httpx.Response(200, json={'models': [{'name': m} for m in g.MODELS]})
        body = json.loads(request.content)
        if body.get('stream'):
            return httpx.Response(200, headers={'content-type': 'text/event-stream'},
                                  content=b'data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: [DONE]\n\n')
        return httpx.Response(200, json={'choices': [{'message': {'content': 'hello'}}]})

    def make():
        return g.create_app(p, n, t, httpx.MockTransport(provider), httpx.MockTransport(auth))

    return {'policy': p, 'tokens': tokens, 'calls': calls, 'make': make}


def test_multimodal_passthrough_and_local_engine_guard(solver_setup):
    p, t, c, make = solver_setup['policy'], solver_setup['tokens'], solver_setup['calls'], solver_setup['make']
    body = {
        'messages': [{'role': 'user', 'content': [
            {'type': 'text', 'text': '이 문제를 풀어줘'},
            {'type': 'image_url', 'image_url': {'url': PNG_1PX}},
        ]}],
        'task_instructions': 'JSON 객체 하나만 출력한다.',
        'max_tokens': 512,
        'stream': False,
    }

    async def case():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=make()), base_url='http://test') as x:
            auth = {'Authorization': 'Bearer ' + t['hd2ai-solver']}
            r = await x.post('/internal/hd2ai-solver/chat/completions', json=body, headers=auth)
            assert r.status_code == 200, r.text
            sent = json.loads(c[-1].content)
            assert sent['messages'][0]['role'] == 'system'
            assert 'JSON 객체 하나만 출력한다' in sent['messages'][0]['content']
            assert isinstance(sent['messages'][1]['content'], list)
            assert sent['messages'][1]['content'][1]['image_url']['url'] == PNG_1PX
            assert sent['chat_template_kwargs'] == {'enable_thinking': False}

            local = json.loads(p.read_text())
            local['routes']['hd2ai-solver'].update({'engine': 'ollama', 'model': 'qwen3:4b-instruct', 'version': 3})
            local['revision'] += 1
            p.write_text(json.dumps(local))
            bad = await x.post('/internal/hd2ai-solver/chat/completions', json=body, headers=auth)
            assert bad.status_code == 422
            assert bad.json()['code'] == 'unsupported_content'
            assert (await x.post('/internal/hd2ai-public/chat/completions', json=body,
                                 headers={'Authorization': 'Bearer ' + t['hd2ai-public']})).status_code == 422

    asyncio.run(case())


def test_gemini_layer_omits_thinking_kwargs(solver_setup):
    p, t, c, make = solver_setup['policy'], solver_setup['tokens'], solver_setup['calls'], solver_setup['make']
    policy = json.loads(p.read_text())
    policy['routes']['hd2ai-solver'].update({'engine': 'custom', 'model': 'gm1', 'version': 2})
    policy['revision'] += 1
    p.write_text(json.dumps(policy))

    async def case():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=make()), base_url='http://test') as x:
            r = await x.post('/internal/hd2ai-solver/chat/completions',
                             json={'messages': [{'role': 'user', 'content': '안녕'}], 'stream': False},
                             headers={'Authorization': 'Bearer ' + t['hd2ai-solver']})
            assert r.status_code == 200, r.text
            sent = json.loads(c[-1].content)
            assert 'chat_template_kwargs' not in sent
            assert sent['model'] == 'gemini-3.5-flash-lite'

    asyncio.run(case())


def test_validate_messages_multimodal_limits():
    import engine

    img = {'type': 'image_url', 'image_url': {'url': PNG_1PX}}
    assert engine.validate_messages([{'role': 'user', 'content': 'plain text'}])
    assert engine.validate_messages([{'role': 'user', 'content': [{'type': 'text', 'text': 'hi'}, img]}])
    assert engine.validate_messages([{'role': 'user', 'content': [img, img]}])
    assert not engine.validate_messages([{'role': 'user', 'content': [img, img, img]}])
    assert not engine.validate_messages([{'role': 'system', 'content': [{'type': 'text', 'text': 'rule'}]}])
    assert not engine.validate_messages([{'role': 'user', 'content': []}])
    assert not engine.validate_messages([{'role': 'user', 'content': [
        {'type': 'image_url', 'image_url': {'url': 'data:image/svg+xml;base64,PHN2Zy8+'}}]}])
    assert not engine.validate_messages([{'role': 'user', 'content': [
        {'type': 'image_url', 'image_url': {'url': 'data:image/png;base64,@@@@'}}]}])
    assert not engine.validate_messages([{'role': 'user', 'content': [
        {'type': 'image_url', 'image_url': {'url': 'http://insecure.example/a.png'}}]}])
    assert engine.validate_messages([{'role': 'user', 'content': [
        {'type': 'image_url', 'image_url': {'url': 'https://assets.example/a.png'}}]}])
    assert not engine.validate_messages([{'role': 'user', 'content': [{'type': 'audio', 'audio': {}}]}])
````

---

## 부록 B — `services/solver/backend/test_app.py` (신규)

````python
"""Solver API tests with a mocked AI Gateway transport."""
import asyncio
import base64
import importlib.util
import json
from pathlib import Path

import httpx
import pytest

spec = importlib.util.spec_from_file_location('solver_app', Path(__file__).parent / 'app.py')
app_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app_module)

PNG = base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
)


@pytest.fixture
def env(tmp_path):
    token = tmp_path / 'solver.token'
    token.write_text('SOLVER_TEST_TOKEN')
    calls = []

    def handler(request: httpx.Request):
        calls.append(request)
        if request.url.path == '/health':
            return httpx.Response(200, json={'ready': True})
        if request.url.path.endswith('/status'):
            return httpx.Response(200, json={'ready': True, 'revision': 7, 'version': 3})
        if request.url.path == '/internal/hd2ai-solver/chat/completions':
            assert request.headers['authorization'] == 'Bearer SOLVER_TEST_TOKEN'
            body = json.loads(request.content)
            if body['messages'][0]['content'] == 'BUSY':
                return httpx.Response(429, json={'code': 'busy', 'detail': '현재 처리 중인 요청이 많습니다.'})
            content = '```json\n' + json.dumps({
                'problem_type': 'quiz', 'topic': '수학 · 일차방정식', 'answer': '④ x = 10',
                'answer_detail': '양변을 정리하면 x = 10', 'steps': ['이항한다', '계산한다'],
                'key_points': ['부호'], 'confidence': 'high',
            }, ensure_ascii=False) + '\n```'
            return httpx.Response(200, json={'model': 'gateway', 'choices': [{'message': {'content': content}}]})
        return httpx.Response(404, json={'detail': 'nope'})

    def make():
        return app_module.create_app(route='hd2ai-solver', token_path=str(token),
                                     allowed_origins=['https://hyangdan2.github.io'],
                                     transport=httpx.MockTransport(handler))

    return {'make': make, 'calls': calls, 'token': token}


def test_health(env):
    async def case():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=env['make']()), base_url='http://test') as x:
            r = await x.get('/api/solver/health')
            assert r.status_code == 200, r.text
            data = r.json()
            assert data['ok'] is True and data['route_state'] == 'ready' and data['revision'] == 7
    asyncio.run(case())


def test_solve_json_answer_and_prompt(env):
    async def case():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=env['make']()), base_url='http://test') as x:
            r = await x.post('/api/solver/solve', json={'text': '2x + 6 = 3x - 4', 'mode': 'quiz', 'hint': '고1'})
            assert r.status_code == 200, r.text
            data = r.json()
            assert data['answer'] == '④ x = 10'
            assert data['problem_type'] == 'quiz'
            assert data['steps'] == ['이항한다', '계산한다']
            assert data['confidence'] == 'high'
            assert data['elapsed_ms'] >= 0
            upstream = json.loads(env['calls'][-1].content)
            assert upstream['messages'][0]['content'] == '2x + 6 = 3x - 4'
            assert '객관식' in upstream['task_instructions'] and '고1' in upstream['task_instructions']
            assert upstream['reasoning_effort'] == 'off' and upstream['stream'] is False
    asyncio.run(case())


def test_solve_image_parts(env):
    data_url = 'data:image/png;base64,' + base64.b64encode(PNG).decode()
    async def case():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=env['make']()), base_url='http://test') as x:
            r = await x.post('/api/solver/solve', json={'text': '빈칸을 채워라', 'image_base64': data_url, 'mode': 'enpago'})
            assert r.status_code == 200, r.text
            upstream = json.loads(env['calls'][-1].content)
            parts = upstream['messages'][0]['content']
            assert parts[0] == {'type': 'text', 'text': '빈칸을 채워라'}
            assert parts[1]['image_url']['url'] == data_url
            assert '엔파고다' in upstream['task_instructions']
    asyncio.run(case())


def test_plain_text_answer_fallback(env):
    def handler(request):
        if request.url.path == '/internal/hd2ai-solver/chat/completions':
            return httpx.Response(200, json={'choices': [{'message': {'content': '정답은 12입니다.\n3 × 4 = 12'}}]})
        return httpx.Response(200, json={'ready': True})
    app = app_module.create_app(route='hd2ai-solver', token_path=str(env['token']),
                                allowed_origins=['https://hyangdan2.github.io'], transport=httpx.MockTransport(handler))

    async def case():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as x:
            r = await x.post('/api/solver/solve', json={'text': '3곱하기4'})
            data = r.json()
            assert data['answer'] == '정답은 12입니다.'
            assert data['steps'] == ['3 × 4 = 12']
            assert data['confidence'] == 'low'
    asyncio.run(case())


def test_oversize_image_rejected(env):
    payload = base64.b64encode(b'0' * (1_700_000)).decode()
    async def case():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=env['make']()), base_url='http://test') as x:
            r = await x.post('/api/solver/solve', json={'text': 'x', 'image_base64': 'data:image/png;base64,' + payload})
            assert r.status_code == 413
            assert r.json()['code'] == 'invalid_image'
    asyncio.run(case())


def test_empty_and_busy_and_missing_token(env):
    async def case():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=env['make']()), base_url='http://test') as x:
            assert (await x.post('/api/solver/solve', json={})).status_code == 422
            busy = await x.post('/api/solver/solve', json={'text': 'BUSY'})
            assert busy.status_code == 429 and busy.json()['code'] == 'busy'
        missing = app_module.create_app(route='hd2ai-solver', token_path='/nonexistent/token',
                                        transport=httpx.MockTransport(lambda request: httpx.Response(200, json={})))
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=missing), base_url='http://test') as x:
            r = await x.post('/api/solver/solve', json={'text': 'hi'})
            assert r.status_code == 503 and r.json()['code'] == 'solver_misconfigured'
    asyncio.run(case())


def test_too_long_text_is_422(env):
    async def case():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=env['make']()), base_url='http://test') as x:
            r = await x.post('/api/solver/solve', json={'text': 'x' * 9000})
            assert r.status_code == 422
            assert r.json()['code'] == 'invalid_request'
            assert '8,000자' in r.json()['detail']
    asyncio.run(case())


def test_cors_preflight(env):
    async def case():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=env['make']()), base_url='http://test') as x:
            r = await x.options('/api/solver/solve', headers={
                'Origin': 'https://hyangdan2.github.io',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type',
            })
            assert r.status_code in (200, 204)
            assert r.headers['access-control-allow-origin'] == 'https://hyangdan2.github.io'
            bad = await x.options('/api/solver/solve', headers={
                'Origin': 'https://evil.example', 'Access-Control-Request-Method': 'POST'})
            assert bad.headers.get('access-control-allow-origin') is None
    asyncio.run(case())
````

---

## 부록 C — 참고 경로

- 게이트웨이 정책/토큰/자격증명: `/home/pi/webserver/HD2chatbot/gateway/gateway.json`, `/etc/hd2lab-ai-gateway/{callers.json,hd2ai-solver.token}`, `/home/pi/webserver/HD2chatbot/config.json`
- 게이트웨이 런타임: `/opt/hd2lab-ai-gateway/current`, socket `/run/hd2lab-ai-gateway/api.sock`
- 기존 배포/복원: `scripts/ai_gateway_update.py`, `scripts/ai_gateway_v3_release.py`, 백업 `/var/backups/hd2lab/ai-gateway*`
- 문서: `docs/AI_GATEWAY_REPORT.md`, `docs/AI_GATEWAY_V3_QA.md`, `docs/ADMIN_SSO_OPERATIONS.md`
- 프런트: `HyangDan2.github.io/PKPilot0005/` (라이브 `https://hyangdan2.github.io/PKPilot0005/`)
