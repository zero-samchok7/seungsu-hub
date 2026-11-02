/* ===== 사인과 코사인의 관계 ===== */
(function () {
  var PI = Math.PI, HALF = PI / 2;
  var COL = { sin: '#e17055', cos: '#0984e3' };
  var ACCENT = '#6c5ce7';
  var MUTED = '#718096';
  var AXIS = '#4a5568';
  var GRID = '#e2e8f0';

  var XMAX = 2 * PI + 0.3;     // 가로 범위: −XMAX ~ XMAX
  var YMAX = 1.5;
  var MAX_W = 760, MAX_H = 340;   // 그래프 영역 최대 크기(px)
  var SNAP = 0.22;            // π/2 의 배수에 이만큼 가까우면 달라붙는다

  var st = {
    fn: 'sin',
    c: 2,        // 상수 (π/2 의 몇 배): 1 → π/2, 2 → π, 3 → 3π/2, 4 → 2π
    s: 1,        // 부호 (+1 / −1)
    off: 0,      // 점선 그래프가 오른쪽으로 옮겨진 양 (라디안)
    revealed: false,
    drag: null
  };

  var cv = document.getElementById('mainCanvas');
  var c = cv.getContext('2d');
  var W = 0, H = 0;

  /* ---------- 수식 ---------- */
  function fn(name, x) { return name === 'sin' ? Math.sin(x) : Math.cos(x); }
  function target(x) { return fn(st.fn, st.c * HALF + st.s * x); }
  function dragged(x) { return fn(st.fn, x - st.off); }

  function gcd(p, q) { return q ? gcd(q, p % q) : Math.abs(p); }
  // n × (π/2) 를 분수 × π 꼴로
  function piFrac(n) {
    if (n === 0) return '0';
    var d = 2, g = gcd(n, d); n /= g; d /= g;
    var sign = n < 0 ? '−' : ''; n = Math.abs(n);
    return sign + (n === 1 ? '' : n) + 'π' + (d === 1 ? '' : '/' + d);
  }

  function targetText() {
    return 'y = ' + st.fn + '(' + piFrac(st.c) + (st.s > 0 ? ' + x' : ' − x') + ')';
  }

  // 지금 점선 그래프가 π/2 의 배수 위치에 있으면 그 배수(정수), 아니면 null
  function snappedN() {
    var n = Math.round(st.off / HALF);
    return Math.abs(st.off - n * HALF) < 1e-9 ? n : null;
  }
  function dragText() {
    var n = snappedN();
    if (n === null) return '맞춰 보세요';
    n = -n;   // 오른쪽으로 옮긴 양 → f(x + k) 의 k
    if (n === 0) return 'y = ' + st.fn + ' x';
    return 'y = ' + st.fn + '(x ' + (n > 0 ? '+ ' : '− ') + piFrac(Math.abs(n)) + ')';
  }

  // 두 그래프가 겹치는지
  function matches() {
    for (var x = -XMAX; x <= XMAX; x += 0.1) {
      if (Math.abs(target(x) - dragged(x)) > 1e-6) return false;
    }
    return true;
  }

  // 선택한 식과 같은 식 (±sin x, ±cos x)
  function resultText() {
    var names = ['sin', 'cos'], signs = [1, -1];
    for (var i = 0; i < 2; i++) {
      for (var j = 0; j < 2; j++) {
        var ok = true;
        for (var x = -3; x <= 3; x += 0.37) {
          if (Math.abs(target(x) - signs[j] * fn(names[i], x)) > 1e-9) { ok = false; break; }
        }
        if (ok) return (signs[j] < 0 ? '−' : '') + names[i] + ' x';
      }
    }
    return '?';
  }

  /* ---------- 캔버스 ---------- */
  function resize() {
    var r = cv.parentElement.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  window.addEventListener('resize', resize);

  function geom() {
    var gw = Math.min(W - 24, MAX_W), gh = Math.min(H - 16, MAX_H);
    var ox = (W - gw) / 2, left = ox + 44, right = ox + gw - 20;
    var px = (right - left) / (2 * XMAX);
    var py = (gh - 40) / (2 * YMAX);
    var x0 = left + XMAX * px, y0 = H / 2;
    return {
      px: px, py: py, x0: x0, y0: y0, left: left, right: right,
      top: y0 - gh / 2 + 8, bot: y0 + gh / 2 - 8,
      X: function (x) { return x0 + x * px; },
      Y: function (y) { return y0 - y * py; }
    };
  }

  function arrowX(x1, x2, y) {
    c.strokeStyle = AXIS; c.lineWidth = 1.5; c.fillStyle = AXIS;
    c.beginPath(); c.moveTo(x1, y); c.lineTo(x2, y); c.stroke();
    c.beginPath(); c.moveTo(x2 + 6, y); c.lineTo(x2 - 4, y - 4.5); c.lineTo(x2 - 4, y + 4.5); c.fill();
  }
  function arrowY(x, y1, y2) {
    c.strokeStyle = AXIS; c.lineWidth = 1.5; c.fillStyle = AXIS;
    c.beginPath(); c.moveTo(x, y1); c.lineTo(x, y2); c.stroke();
    c.beginPath(); c.moveTo(x, y2 - 6); c.lineTo(x - 4.5, y2 + 4); c.lineTo(x + 4.5, y2 + 4); c.fill();
  }

  function plot(g, fy, color, lw, dash) {
    c.strokeStyle = color; c.lineWidth = lw; c.lineJoin = 'round';
    c.setLineDash(dash || []);
    c.beginPath();
    var n = 600;
    for (var i = 0; i <= n; i++) {
      var x = -XMAX + 2 * XMAX * i / n;
      if (i === 0) c.moveTo(g.X(x), g.Y(fy(x))); else c.lineTo(g.X(x), g.Y(fy(x)));
    }
    c.stroke();
    c.setLineDash([]);
  }

  function draw() {
    c.clearRect(0, 0, W, H);
    var g = geom(), top = g.top, bot = g.bot, k, v;

    // 격자
    c.strokeStyle = GRID; c.lineWidth = 1;
    for (k = -4; k <= 4; k++) {
      if (k === 0) continue;
      c.beginPath(); c.moveTo(g.X(k * HALF), top); c.lineTo(g.X(k * HALF), bot); c.stroke();
    }
    for (v = -1; v <= 1; v += 2) {
      c.beginPath(); c.moveTo(g.left, g.Y(v)); c.lineTo(g.right, g.Y(v)); c.stroke();
    }

    // 축 + 눈금
    arrowX(g.left - 4, g.right, g.y0);
    arrowY(g.x0, bot, top);
    c.font = '600 15px sans-serif'; c.textAlign = 'center'; c.fillStyle = MUTED;
    for (k = -4; k <= 4; k++) {
      if (k === 0) continue;
      c.strokeStyle = AXIS; c.lineWidth = 1;
      c.beginPath(); c.moveTo(g.X(k * HALF), g.y0 - 4); c.lineTo(g.X(k * HALF), g.y0 + 4); c.stroke();
      c.fillText(piFrac(k), g.X(k * HALF), g.y0 + 22);
    }
    c.textAlign = 'right';
    c.fillText('1', g.x0 - 8, g.Y(1) + 5);
    c.fillText('−1', g.x0 - 8, g.Y(-1) + 5);
    c.fillText('O', g.x0 - 8, g.y0 + 20);
    c.textAlign = 'left'; c.fillText('x', g.right - 12, g.y0 - 10);

    // 목표(보라색 실선) → 점선 그래프 (위에 덮음)
    plot(g, target, ACCENT, 6);
    plot(g, dragged, COL[st.fn], 3.5, [9, 7]);
  }

  /* ---------- 표시 갱신 ---------- */
  function update() {
    document.getElementById('rdTarget').textContent = targetText();
    document.getElementById('rdDrag').textContent = dragText();

    var cell = document.getElementById('cellResult');
    var name = document.getElementById('rdResName');
    var val = document.getElementById('rdResult');
    cell.className = 'rd-cell';
    if (st.revealed) {
      name.textContent = '결과';
      val.textContent = targetText().replace('y = ', '') + ' = ' + resultText();
      cell.classList.add('hl');
    } else if (snappedN() !== null && matches()) {
      name.textContent = '겹쳤나요?';
      val.textContent = '겹쳤어요! 🎉';
      cell.classList.add('ok');
    } else {
      name.textContent = '겹쳤나요?';
      val.textContent = '—';
    }
    draw();
  }

  /* ---------- 버튼 ---------- */
  function bindBar(id, attr, apply) {
    var btns = document.querySelectorAll('#' + id + ' .seg-btn');
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(btns, function (o) { o.classList.remove('active'); });
        b.classList.add('active');
        apply(b.getAttribute(attr));
        st.off = 0; st.revealed = false;
        update();
      });
    });
  }
  bindBar('barFn', 'data-fn', function (v) { st.fn = v; });
  bindBar('barC', 'data-c', function (v) { st.c = +v; });
  bindBar('barS', 'data-s', function (v) { st.s = +v; });

  document.getElementById('btnReveal').addEventListener('click', function () {
    st.revealed = true; update();
  });
  document.getElementById('btnReset').addEventListener('click', function () {
    st.off = 0; st.revealed = false; update();
  });

  /* ---------- 드래그 ---------- */
  function setOff(raw) {
    raw = Math.max(-2 * PI, Math.min(2 * PI, raw));
    var n = Math.round(raw / HALF);
    st.off = Math.abs(raw - n * HALF) < SNAP ? n * HALF : raw;
  }
  cv.addEventListener('pointerdown', function (e) {
    st.drag = { x: e.clientX, off0: st.off };
    cv.setPointerCapture(e.pointerId);
    cv.classList.add('dragging');
  });
  cv.addEventListener('pointermove', function (e) {
    if (!st.drag) return;
    setOff(st.drag.off0 + (e.clientX - st.drag.x) / geom().px);
    update();
  });
  function endDrag() { st.drag = null; cv.classList.remove('dragging'); }
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  update();
  resize();
})();
