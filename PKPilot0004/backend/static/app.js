/* HD2Lab Market Intelligence draft dashboard.
   외부 문자열(뉴스 제목 등)은 전부 textContent 로만 넣는다. innerHTML 금지. */
(function () {
  "use strict";

  var API = new URL("api/", document.baseURI).href;
  var $ = function (id) { return document.getElementById(id); };
  var state = { factors: null, busy: false };

  /* ---------- helpers ---------- */
  function num(value) {
    if (value === null || value === undefined || value === "") return "—";
    var n = Number(value);
    if (!isFinite(n)) return String(value);
    return n.toLocaleString("ko-KR");
  }
  function pct(value, digits) {
    if (value === null || value === undefined) return "—";
    var n = Number(value);
    if (!isFinite(n)) return "—";
    return (n > 0 ? "+" : "") + n.toFixed(digits === undefined ? 2 : digits) + "%";
  }
  function compact(value) {
    if (value === null || value === undefined) return "—";
    var n = Number(value);
    if (!isFinite(n)) return "—";
    if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(1).replace(/\.0$/, "") + "조";
    if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, "") + "억";
    if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, "") + "만";
    return num(n);
  }
  function won(value, currency) {
    if (value === null || value === undefined) return "—";
    return currency === "USD" ? "$" + Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 }) : num(value) + "원";
  }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function getJSON(path) {
    return fetch(API + path, { headers: { Accept: "application/json" } }).then(function (res) {
      return res.json().then(function (body) { return { ok: res.ok, status: res.status, body: body }; });
    });
  }

  function setMode(mode) {
    var pill = $("modePill");
    var label = { live: "LIVE · 실데이터", mixed: "MIXED · 일부 표본", sample: "SAMPLE · 표본 데이터", offline: "OFFLINE" }[mode] || mode;
    pill.textContent = label;
    pill.setAttribute("data-mode", mode || "unknown");
  }

  function notify(message, isError) {
    var box = $("notice");
    box.textContent = message;
    box.className = "notice" + (isError ? " error" : "");
    box.hidden = !message;
  }

  /* ---------- matrix ---------- */
  function renderMatrix(payload) {
    var body = $("matrixBody");
    clear(body);
    payload.factors.forEach(function (factor) {
      var tr = el("tr");

      var axisTd = el("td", "axis-cell", factor.axis_name);
      tr.appendChild(axisTd);

      var nameTd = el("td", "factor-cell");
      nameTd.appendChild(el("strong", null, factor.name));
      nameTd.appendChild(el("span", null, String(factor.id).padStart(2, "0") + " · " + factor.axis_id));
      tr.appendChild(nameTd);

      tr.appendChild(el("td", "mech-cell", factor.mechanism));

      var dirTd = el("td", "dir-cell " + (factor.outcomes.length > 1 ? (factor.direction === "down" ? "dir-down" : "dir-both") : (factor.direction === "down" ? "dir-down" : "dir-up")), factor.direction_label);
      tr.appendChild(dirTd);

      var srcTd = el("td", "src-cell", (factor.sources || []).map(function (s) {
        return { opendart: "공시", news_rss: "뉴스", market_data: "시세" }[s] || s;
      }).join("·") + " / 키워드 " + factor.keyword_count);
      tr.appendChild(srcTd);

      body.appendChild(tr);
    });
    if (payload.mechanism) {
      var inputs = $("mechInputs");
      if (inputs && payload.axes) {
        clear(inputs);
        var marks = ["①", "②", "③", "④"];
        payload.axes.forEach(function (axis, index) {
          var chip = el("div", "axis-chip");
          chip.appendChild(el("span", "axis-no", marks[index] || String(index + 1)));
          var box = el("div");
          box.appendChild(el("strong", null, axis.name));
          box.appendChild(el("small", null, axis.factor_ids.join(" · ") + "번"));
          chip.appendChild(box);
          inputs.appendChild(chip);
        });
      }
    }
  }

  /* ---------- chips ---------- */
  function renderChips(examples) {
    var wrap = $("chips");
    clear(wrap);
    examples.slice(0, 6).forEach(function (item) {
      var button = el("button", "chip", item.name + " · " + item.ticker);
      button.type = "button";
      button.addEventListener("click", function () { $("queryInput").value = item.ticker; analyze(item.ticker); });
      wrap.appendChild(button);
    });
  }

  /* ---------- quote ---------- */
  function renderQuote(body) {
    var grid = $("quoteGrid");
    clear(grid);
    var quote = body.quote || {};
    var currency = body.entity.currency || quote.currency;
    var cells = [];

    cells.push(["현재가", won(quote.price, currency), quote.change_pct === undefined ? "" : pct(quote.change_pct), quote.change_pct > 0 ? "pos" : quote.change_pct < 0 ? "neg" : ""]);
    cells.push(["거래량 / 평균", quote.volume ? num(quote.volume) : "—", quote.volume_ratio ? quote.volume_ratio.toFixed(1) + "배" : ""]);
    cells.push(["시가총액", quote.market_cap || (quote.market_cap_value ? compact(quote.market_cap_value) : "—"), ""]);
    cells.push(["PER / PBR", quote.per ? quote.per.toFixed(2) + "배" : "—", quote.pbr ? "PBR " + quote.pbr.toFixed(2) + "배" : ""]);
    cells.push(["선행 PER", quote.consensus_per ? quote.consensus_per.toFixed(2) + "배" : "—", quote.consensus_eps ? "EPS " + num(quote.consensus_eps) : ""]);
    cells.push(["52주 범위", quote.low_52w && quote.high_52w ? num(quote.low_52w) + " ~ " + num(quote.high_52w) : "—", ""]);
    cells.push(["MA60", quote.ma60 ? num(quote.ma60) : "—", quote.price && quote.ma60 ? pct((quote.price / quote.ma60 - 1) * 100) : ""]);

    cells.forEach(function (cell) {
      var box = el("dl", "quote-cell");
      box.appendChild(el("dt", null, cell[0]));
      var dd = el("dd", cell[3] || null, "");
      dd.appendChild(document.createTextNode(cell[1]));
      if (cell[2]) dd.appendChild(el("small", null, " " + cell[2]));
      box.appendChild(dd);
      grid.appendChild(box);
    });
    if (!quote.available) {
      var notice = el("dl", "quote-cell");
      notice.appendChild(el("dt", null, "시세"));
      notice.appendChild(el("dd", null, "표본 시세 없음 — 뉴스·공시 신호만 반영"));
      grid.appendChild(notice);
    }
  }

  /* ---------- scoring ---------- */
  function renderScore(body) {
    var scoring = body.scoring || {};
    var nfds = scoring.nfds || {};
    $("nfdsValue").textContent = nfds.score === undefined ? "—" : Number(nfds.score).toFixed(1);
    var label = $("nfdsLabel");
    label.textContent = nfds.label || "—";
    label.className = "badge" + (nfds.label === "과열" ? " up" : nfds.label === "경계" ? " strong" : "");
    $("nfdsMessage").textContent = nfds.message || "";
    $("nfdsBar").style.width = Math.max(0, Math.min(100, Number(nfds.score) || 0)) + "%";

    var bars = $("axisBars");
    clear(bars);
    (scoring.axes || []).forEach(function (axis) {
      var li = el("li");
      li.appendChild(el("span", null, axis.name));
      li.appendChild(el("span", null, axis.score_100.toFixed(1)));
      var bar = el("div", "bar");
      var fill = el("span");
      fill.style.width = Math.max(0, Math.min(100, axis.score_100)) + "%";
      bar.appendChild(fill);
      li.appendChild(bar);
      bars.appendChild(li);
    });

    var dir = nfds.direction || {};
    $("directionLine").textContent = dir.label ? "우세 방향 · " + dir.label + " (상방 " + Number(dir.up || 0).toFixed(2) + " / 하방 " + Number(dir.down || 0).toFixed(2) + ")" : "";

    var mr = scoring.mean_reversion || {};
    $("mrLevel").textContent = mr.level || "—";
    $("mrScore").textContent = (mr.score === undefined ? "—" : Number(mr.score).toFixed(1)) + "/100";
    $("mrBar").style.width = Math.max(0, Math.min(100, Number(mr.score) || 0)) + "%";
    $("mrMessage").textContent = mr.message || "";
    $("mrPanel").className = "panel mr-panel" + (mr.alert ? " alert" : "");

    var metrics = $("mrMetrics");
    clear(metrics);
    var comp = mr.components || {};
    var rows = [
      ["52주 위치", comp.range_position === null || comp.range_position === undefined ? "—" : (comp.range_position * 100).toFixed(0) + "%"],
      ["MA60 대비", comp.ma60_extension === null || comp.ma60_extension === undefined ? "—" : pct(comp.ma60_extension * 100, 1)],
      ["PER 괴리(후행/선행)", comp.valuation_premium === null || comp.valuation_premium === undefined ? "—" : pct(comp.valuation_premium * 100, 1)],
      ["신뢰도", (scoring.confidence ? scoring.confidence.label : "—")]
    ];
    rows.forEach(function (row) {
      var box = el("div");
      box.appendChild(el("dt", null, row[0]));
      box.appendChild(el("dd", null, row[1]));
      metrics.appendChild(box);
    });
  }

  /* ---------- signals ---------- */
  function renderSignals(body) {
    var list = $("signals");
    clear(list);
    var signals = body.signals || [];
    $("signalCount").textContent = String(signals.length);
    if (!signals.length) {
      list.appendChild(el("li", "empty", "이 종목에서 잡힌 비재무 요인 신호가 없습니다. 뉴스·공시가 실데이터로 연결됐는지 아래 출처를 확인하세요."));
      return;
    }
    signals.forEach(function (signal) {
      var li = el("li", "signal");
      li.appendChild(el("span", "signal-no", String(signal.factor_id).padStart(2, "0")));
      var right = el("div");

      var top = el("div", "signal-top");
      top.appendChild(el("strong", null, signal.name));
      top.appendChild(el("span", "signal-axis", signal.axis_id + " · " + signal.direction_label));
      right.appendChild(top);

      var strength = el("div", "signal-strength");
      var bar = el("div", "strength-bar");
      var fill = el("span");
      fill.style.width = Math.round(signal.strength * 100) + "%";
      bar.appendChild(fill);
      strength.appendChild(bar);
      strength.appendChild(el("span", "strength-value", Math.round(signal.strength * 100) + "%"));
      right.appendChild(strength);

      if (signal.evidence && signal.evidence.length) {
        var ul = el("ul", "evidence");
        signal.evidence.forEach(function (item) {
          var ev = el("li");
          if (item.url && /^https?:\/\//.test(item.url)) {
            var link = el("a", null, item.title);
            link.href = item.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer nofollow";
            ev.appendChild(link);
          } else {
            ev.appendChild(document.createTextNode(item.title));
          }
          if (item.date) ev.appendChild(el("span", "src", String(item.date).slice(0, 10)));
          if (item.kind) ev.appendChild(el("span", "src", item.kind));
          ul.appendChild(ev);
        });
        right.appendChild(ul);
      }
      if (signal.note) right.appendChild(el("p", "signal-note", signal.note));
      li.appendChild(right);
      list.appendChild(li);
    });
  }

  /* ---------- principles, sources ---------- */
  function renderPrinciples(body) {
    var principles = (body.scoring && body.scoring.principles) || {};
    var list = $("principles");
    clear(list);
    (principles.rows || []).forEach(function (row) {
      var li = el("li", row.tone || "");
      li.appendChild(el("span", "p-type", row.type));
      li.appendChild(el("p", "p-trigger", row.trigger));
      li.appendChild(el("p", "p-action", "→ " + row.action));
      list.appendChild(li);
    });
    (principles.factor_actions || []).slice(0, 3).forEach(function (action) {
      var li = el("li", "");
      li.appendChild(el("span", "p-type", "요인 대응"));
      li.appendChild(el("p", "p-trigger", action.name));
      li.appendChild(el("p", "p-action", "→ " + action.action));
      list.appendChild(li);
    });
    $("conclusion").textContent = principles.core_conclusion || "";
  }

  function renderSources(body) {
    var list = $("sources");
    clear(list);
    var labels = { naver_quote: "네이버 금융", yahoo_quote: "Yahoo Finance", news_rss: "Google News RSS", opendart: "OpenDART" };
    (body.sources || []).forEach(function (source) {
      var li = el("li");
      var left = el("span", "name", labels[source.name] || source.name);
      var right = el("span", "status " + source.status, source.status);
      li.appendChild(left);
      li.appendChild(right);
      list.appendChild(li);
    });
    var gaps = $("gaps");
    clear(gaps);
    (body.data_gaps || []).forEach(function (gap) { gaps.appendChild(el("li", null, gap)); });

    var fundamental = (body.scoring && body.scoring.fundamental) || {};
    var fund = $("fundamental");
    clear(fund);
    (fundamental.flags || []).forEach(function (flag) { fund.appendChild(el("li", null, flag)); });
    if (fundamental.message) fund.appendChild(el("li", null, "※ " + fundamental.message));
  }

  /* ---------- analysis ---------- */
  function analyze(query) {
    if (state.busy) return;
    state.busy = true;
    var button = document.querySelector("#searchForm .btn");
    if (button) button.disabled = true;
    $("queryInput").value = query;
    notify("", false);

    getJSON("analyze?q=" + encodeURIComponent(query))
      .then(function (res) {
        if (!res.ok) {
          var message = (res.body && res.body.message) || "분석에 실패했습니다.";
          var hint = res.body && res.body.suggestions && res.body.suggestions.length
            ? " 예: " + res.body.suggestions.slice(0, 4).map(function (s) { return s.name + "(" + s.ticker + ")"; }).join(", ")
            : "";
          notify(message + hint, true);
          $("result").hidden = true;
          return;
        }
        var body = res.body;
        setMode(body.mode);
        $("result").hidden = false;
        $("entityMeta").textContent = [body.entity.ticker, body.entity.market, body.entity.currency, "MODE " + String(body.mode).toUpperCase()].filter(Boolean).join(" · ");
        $("entityName").textContent = body.entity.name || body.q;

        var badges = $("entityBadges");
        clear(badges);
        var dir = (body.scoring && body.scoring.nfds && body.scoring.nfds.direction) || {};
        if (dir.label) badges.appendChild(el("span", "badge", dir.label));
        var mr = (body.scoring && body.scoring.mean_reversion) || {};
        if (mr.level) badges.appendChild(el("span", "badge" + (mr.alert ? " strong" : ""), "평균 회귀 " + mr.level));
        if (body.scoring && body.scoring.confidence) badges.appendChild(el("span", "badge", "신뢰도 " + body.scoring.confidence.label));
        if (body.mode !== "live") badges.appendChild(el("span", "badge", "표본 데이터 포함"));

        renderQuote(body);
        renderScore(body);
        renderSignals(body);
        renderPrinciples(body);
        renderSources(body);

        if (body.mode !== "live") {
          notify("일부 출처가 실데이터가 아닙니다. 표본 값은 화면 확인용이며 투자 판단에 쓸 수 없습니다.", false);
        }
        var target = $("result");
        if (target.getBoundingClientRect().top < 0) target.scrollIntoView({ block: "start", behavior: "smooth" });
      })
      .catch(function (error) {
        notify("API 호출 실패: " + error.message, true);
      })
      .then(function () {
        state.busy = false;
        if (button) button.disabled = false;
      });
  }

  /* ---------- boot ---------- */
  function boot() {
    $("searchForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var query = $("queryInput").value.trim();
      if (query) analyze(query);
    });

    Promise.all([getJSON("factors"), getJSON("symbols"), getJSON("health")])
      .then(function (results) {
        var factors = results[0];
        var symbols = results[1];
        var health = results[2];
        if (factors.ok) { state.factors = factors.body; renderMatrix(factors.body); }
        if (symbols.ok) renderChips(symbols.body.examples || []);
        if (health.ok) {
          $("footerVersion").textContent = "v" + health.body.version + " · " + health.body.mode;
          var ready = health.body.connectors && health.body.connectors.naver_quote ? health.body.connectors.naver_quote.status : "unknown";
          setMode(ready === "ready" ? "live" : "sample");
        }
      })
      .catch(function () { notify("초기 데이터를 불러오지 못했습니다.", true); })
      .then(function () { analyze("005930"); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
