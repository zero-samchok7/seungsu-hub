/* ===== 사인과 코사인의 관계 ===== */
(function () {
  var PI = Math.PI, HALF = PI / 2;
  var COL = { sin: '#e8590c', cos: '#1971c2' };
  var TARGET = '#1b2a4e';
  var OK = '#099268';
  var MUTED = '#718096';
  var AXIS = '#4a5568';
  var GRID = '#e2e8f0';

  var XMAX = 2 * PI + 0.3;     // 가로 범위: −XMAX ~ XMAX
  var YMAX = 1.5;
  var MAX_W = 1300, MAX_H = 480;   // 그래프 영역 최대 크기(px)

  var st = {
    fn: 'sin',
    c: 2,        // 상수 (π/2 의 몇 배): 1 → π/2, 2 → π, 3 → 3π/2, 4 → 2π
    s: 1,        // 부호 (+1 / −1)
    cand: null,  // 고른 후보: { fn: 'sin' | 'cos', sg: 1 | −1 }
    checked: null   // 고른 답의 결과: null(아직) | 'ok' | 'bad'
  };
  var parts = [];       // 색종이 조각들
  var CONFETTI = ['#e8590c', '#1971c2', '#099268', '#f59f00', '#ae3ec9', '#e64980'];

  var cv = document.getElementById('mainCanvas');
  var c = cv.getContext('2d');
  var W = 0, H = 0;

  /* ---------- 수식 ---------- */
  function fn(name, x) { return name === 'sin' ? Math.sin(x) : Math.cos(x); }
  function target(x) { return fn(st.fn, st.c * HALF + st.s * x); }

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
  function candText(cd) { return (cd.sg < 0 ? '−' : '') + cd.fn + ' x'; }

  function sameGraph(cd) {
    for (var x = -XMAX; x <= XMAX; x += 0.1) {
      if (Math.abs(target(x) - cd.sg * fn(cd.fn, x)) > 1e-6) return false;
    }
    return true;
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

  function plot(g, fy, color, lw) {
    c.strokeStyle = color; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath();
    var n = 600;
    for (var i = 0; i <= n; i++) {
      var x = -XMAX + 2 * XMAX * i / n;
      if (i === 0) c.moveTo(g.X(x), g.Y(fy(x))); else c.lineTo(g.X(x), g.Y(fy(x)));
    }
    c.stroke();
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

    // 목표(굵은 남색, 겹치면 초록) 위에 고른 후보를 더 가늘게 덮는다
    var match = st.checked === 'ok';
    if (match) { c.shadowColor = OK; c.shadowBlur = 18; }
    plot(g, target, match ? OK : TARGET, 6);
    c.shadowBlur = 0;
    drawParts();
  }

  /* ---------- 정답 축하 효과 (색종이) ---------- */
  function burst() {
    for (var i = 0; i < 90; i++) {
      var left = i % 2 === 0;
      parts.push({
        x: left ? 0 : W, y: H * 0.75,
        vx: (left ? 1 : -1) * (3 + Math.random() * 9), vy: -(8 + Math.random() * 12),
        w: 6 + Math.random() * 6, h: 4 + Math.random() * 5,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        col: CONFETTI[i % CONFETTI.length], life: 0
      });
    }
    if (parts.length === 90) requestAnimationFrame(tick);
  }
  function drawParts() {
    parts.forEach(function (p) {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
      c.globalAlpha = Math.max(0, 1 - p.life / 110);
      c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      c.restore();
    });
  }
  function tick() {
    parts.forEach(function (p) {
      p.vy += 0.35; p.vx *= 0.99;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life++;
    });
    parts = parts.filter(function (p) { return p.life < 110 && p.y < H + 20; });
    draw();
    if (parts.length) requestAnimationFrame(tick);
  }

  /* ---------- 표시 갱신 ---------- */
  function update() {
    document.getElementById('rdTarget').textContent = targetText();

    var cell = document.getElementById('cellResult');
    var name = document.getElementById('rdResName');
    var val = document.getElementById('rdResult');
    cell.className = 'rd-cell';
    name.textContent = '결과';
    if (st.checked === 'ok') {
      val.textContent = '정답이에요! 🎉  ' + targetText().replace('y = ', '') + ' = ' + candText(st.cand);
      cell.classList.add('ok');
    } else if (st.checked === 'bad') {
      val.textContent = '(' + candText(st.cand) + ')은 아니에요. 다시 골라 보세요';
      cell.classList.add('bad');
    } else {
      val.textContent = '—';
    }

    var btns = document.querySelectorAll('#barCand .cand-btn');
    Array.prototype.forEach.call(btns, function (b) {
      var on = st.cand && b.getAttribute('data-fn') === st.cand.fn && +b.getAttribute('data-sg') === st.cand.sg;
      b.classList.toggle('right', !!on && st.checked === 'ok');
      b.classList.toggle('wrong', !!on && st.checked === 'bad');
    });
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
        st.cand = null; st.checked = null;
        update();
      });
    });
  }
  bindBar('barFn', 'data-fn', function (v) { st.fn = v; });
  bindBar('barC', 'data-c', function (v) { st.c = +v; });
  bindBar('barS', 'data-s', function (v) { st.s = +v; });

  Array.prototype.forEach.call(document.querySelectorAll('#barCand .cand-btn'), function (b) {
    b.addEventListener('click', function () {
      st.cand = { fn: b.getAttribute('data-fn'), sg: +b.getAttribute('data-sg') };
      st.checked = sameGraph(st.cand) ? 'ok' : 'bad';
      update();
      if (st.checked === 'ok') burst();
    });
  });
  document.getElementById('btnReset').addEventListener('click', function () {
    st.cand = null; st.checked = null; update();
  });

  update();
  resize();
})();
