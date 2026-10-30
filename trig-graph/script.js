/* ===== 삼각함수의 그래프 ===== */
(function () {
  var PI = Math.PI;
  var COL = { sin: '#e17055', cos: '#0984e3', tan: '#00a383' };
  var ACCENT = '#6c5ce7';
  var MUTED = '#718096';
  var AXIS = '#4a5568';
  var GRID = '#e2e8f0';

  var DEG_MIN = -360, DEG_MAX = 720;      // ① 각의 범위: −2π ~ 4π
  var XMIN = -2 * PI - 0.35, XMAX = 4 * PI + 0.35;

  var st = {
    tab: 1,
    fn: 'sin',
    deg: 0,        // ① 동경의 각 (도, 부호 있음)
    lo: 0, hi: 0,  // ① 지금까지 지나간 각의 범위 (잔상)
    a: 1,
    b: 1,
    playing: false,
    drag: null     // 'circle' | 'graph' | null
  };

  var cv = document.getElementById('mainCanvas');
  var c = cv.getContext('2d');
  var W = 0, H = 0;

  /* ---------- 유틸 ---------- */
  function f(x) {
    return st.fn === 'sin' ? Math.sin(x) : st.fn === 'cos' ? Math.cos(x) : Math.tan(x);
  }
  function gcd(p, q) { return q ? gcd(q, p % q) : Math.abs(p); }
  function fmt(x) { return String(+x.toFixed(1)).replace('-', '−'); }
  function num3(x) { return Math.abs(x) < 0.0005 ? '0' : x.toFixed(3).replace('-', '−'); }

  // 분수 × π 꼴 문자열 (n/d π)
  function piFrac(n, d) {
    if (n === 0) return '0';
    var g = gcd(n, d); n /= g; d /= g;
    var sign = n < 0 ? '−' : ''; n = Math.abs(n);
    return sign + (n === 1 ? '' : n) + 'π' + (d === 1 ? '' : '/' + d);
  }
  function piTextDeg(deg) {
    if (!Number.isInteger(deg)) return null;
    return piFrac(deg, 180);
  }
  var EXACT = {
    sin: [[0, '0'], [0.5, '1/2'], [Math.SQRT1_2, '√2/2'], [Math.sqrt(3) / 2, '√3/2'], [1, '1']],
    tan: [[0, '0'], [Math.sqrt(3) / 3, '√3/3'], [1, '1'], [Math.sqrt(3), '√3']]
  };
  EXACT.cos = EXACT.sin;
  function exactText(v) {
    var list = EXACT[st.fn];
    for (var i = 0; i < list.length; i++) {
      if (Math.abs(Math.abs(v) - list[i][0]) < 1e-9) {
        return (v < 0 && list[i][0] !== 0 ? '−' : '') + list[i][1];
      }
    }
    return null;
  }
  function undefinedTan(th) { return st.fn === 'tan' && Math.abs(Math.cos(th)) < 1e-9; }

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
  function dotted(x1, y1, x2, y2, color, lw) {
    c.strokeStyle = color; c.lineWidth = lw || 1.5; c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.setLineDash([]);
  }

  // 함수 곡선 그리기. 점근선 근처에서는 선을 끊는다.
  function plot(X, Y, fy, xa, xb, step) {
    var prev = null;
    c.beginPath();
    var n = Math.max(2, Math.ceil((xb - xa) / step));
    for (var i = 0; i <= n; i++) {
      var x = xa + (xb - xa) * i / n, y = fy(x);
      if (!isFinite(y) || Math.abs(y) > 30) { prev = null; continue; }
      if (prev !== null && Math.abs(y - prev) > 20) prev = null;
      if (prev === null) c.moveTo(X(x), Y(y)); else c.lineTo(X(x), Y(y));
      prev = y;
    }
    c.stroke();
  }

  // 탄젠트 점근선 x = π/2 + kπ (가로축 변수 u = b·x 기준으로 간격 T = π/b)
  function drawAsymptotes(X, top, bot, b) {
    var T = PI / b;
    c.strokeStyle = 'rgba(0,163,131,0.45)'; c.lineWidth = 1.5; c.setLineDash([7, 5]);
    for (var k = -40; k <= 40; k++) {
      var x = (PI / 2 + k * PI) / b;
      if (x < XMIN || x > XMAX) continue;
      c.beginPath(); c.moveTo(X(x), top); c.lineTo(X(x), bot); c.stroke();
    }
    c.setLineDash([]);
  }

  function xTickLabel(k) { return k === 0 ? '0' : piFrac(k, 2); }   // k × π/2

  /* ---------- ① 좌표 ---------- */
  // x축·y축 눈금 간격(1 라디안 = y축 1)이 같도록 한 값(ppu)으로 통일한다.
  function geom1() {
    var span = XMAX - XMIN;
    var ppu = (W - 66 - 12) / (2.8 + span);
    ppu = Math.max(24, Math.min(ppu, (H - 60) / 2.9));
    var Lw = 2.8 * ppu + 12;
    var gl = Lw + 30;
    return {
      s: ppu, px: ppu, Lw: Lw, cx: Lw / 2, cy: H / 2,
      gl: gl, gr: gl + ppu * span,
      X: function (x) { return gl + (x - XMIN) * ppu; },
      Y: function (y) { return H / 2 - y * ppu; },
      x0: gl + (0 - XMIN) * ppu
    };
  }

  /* ---------- ① 그리기 ---------- */
  function draw1() {
    var g = geom1(), s = g.s, cx = g.cx, cy = g.cy, X = g.X, Y = g.Y;
    st.lo = Math.min(st.lo, st.deg); st.hi = Math.max(st.hi, st.deg);
    var th = st.deg * PI / 180;
    var col = COL[st.fn];
    var top = 10, bot = H - 10;
    var vis = Math.floor((H / 2 - 12) / s);

    // 그래프 격자 (y 정수 눈금)
    c.strokeStyle = GRID; c.lineWidth = 1;
    for (var v = -vis; v <= vis; v++) {
      if (v === 0) continue;
      c.beginPath(); c.moveTo(g.gl, Y(v)); c.lineTo(g.gr, Y(v)); c.stroke();
    }

    // 그래프 x축·y축 + 눈금
    c.font = '600 16px sans-serif';
    for (var k = -4; k <= 8; k++) {
      if (k === 0) continue;
      var px_ = X(k * PI / 2);
      c.strokeStyle = GRID; c.lineWidth = 1;
      c.beginPath(); c.moveTo(px_, top); c.lineTo(px_, bot); c.stroke();
    }
    if (st.fn === 'tan') drawAsymptotes(X, top, bot, 1);
    arrowX(g.gl - 4, g.gr, cy);
    arrowY(g.x0, bot, top);
    c.textAlign = 'center';
    for (k = -4; k <= 8; k++) {
      if (k === 0) continue;
      px_ = X(k * PI / 2);
      c.strokeStyle = AXIS; c.lineWidth = 1;
      c.beginPath(); c.moveTo(px_, cy - 4); c.lineTo(px_, cy + 4); c.stroke();
      c.fillStyle = MUTED; c.fillText(xTickLabel(k), px_, cy + 24);
    }
    c.textAlign = 'right'; c.fillStyle = MUTED;
    for (v = -vis; v <= vis; v++) { if (v !== 0) c.fillText(String(v).replace('-', '−'), g.x0 - 8, Y(v) + 6); }
    c.fillText('O', g.x0 - 8, cy + 22);
    c.textAlign = 'left'; c.fillText('x', g.gr - 12, cy - 10);

    // 왼쪽 단위원
    arrowX(cx - 1.35 * s, cx + 1.35 * s, cy);
    arrowY(cx, cy + 1.35 * s, cy - 1.35 * s);
    if (st.fn === 'tan') {   // x = 1 인 접선
      c.strokeStyle = 'rgba(0,163,131,0.55)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx + s, top); c.lineTo(cx + s, bot); c.stroke();
    }
    c.strokeStyle = '#b8c2cc'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(cx, cy, s, 0, 2 * PI); c.stroke();
    c.fillStyle = MUTED; c.font = '600 16px sans-serif'; c.textAlign = 'center';
    c.fillText('1', cx + s, cy + 22); c.fillText('−1', cx - s, cy + 22);
    c.textAlign = 'right'; c.fillText('1', cx - 8, cy - s + 6); c.fillText('−1', cx - 8, cy + s + 6);
    c.fillText('O', cx - 8, cy + 22);

    // 호 (바퀴마다 반지름을 조금씩 키워 겹침 표시)
    var loops = Math.ceil(Math.abs(st.deg) / 360);
    c.lineCap = 'round'; c.strokeStyle = col; c.lineWidth = 6;
    for (var i = 0; i < loops; i++) {
      var d = Math.min(Math.abs(st.deg) - 360 * i, 360) * PI / 180 * (st.deg < 0 ? -1 : 1);
      c.beginPath(); c.arc(cx, cy, s + i * 6, 0, -d, st.deg > 0); c.stroke();
    }
    c.lineCap = 'butt';

    // 동경
    var Px = cx + Math.cos(th) * s, Py = cy - Math.sin(th) * s;
    var gx = X(th), gy = Y(f(th));
    var ok = !undefinedTan(th);

    // 값 표시용 굵은 막대 + 점선 연결
    c.lineCap = 'round';
    if (st.fn === 'sin') {
      c.strokeStyle = col; c.lineWidth = 6;
      c.beginPath(); c.moveTo(Px, cy); c.lineTo(Px, Py); c.stroke();
      dotted(Px, Py, gx, gy, col, 1.8);
    } else if (st.fn === 'cos') {
      var cs = Math.cos(th);
      c.strokeStyle = col; c.lineWidth = 6;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(Px, cy); c.stroke();
      dotted(Px, Py, Px, cy, col, 1.8);
      var r = Math.abs(cs) * s;
      if (r > 1) {
        c.lineWidth = 1.8; c.setLineDash([4, 4]);
        c.beginPath();
        if (cs > 0) c.arc(cx, cy, r, 0, -PI / 2, true); else c.arc(cx, cy, r, PI, PI / 2, true);
        c.stroke(); c.setLineDash([]);
      }
      dotted(cx, cy - cs * s, gx, gy, col, 1.8);
    } else if (ok) {
      var tv = Math.tan(th), Tx = cx + s, Ty = cy - tv * s;
      dotted(cx, cy, Tx, Ty, AXIS, 1.5);                       // 동경의 연장선
      c.strokeStyle = col; c.lineWidth = 6;
      c.beginPath(); c.moveTo(Tx, cy); c.lineTo(Tx, Ty); c.stroke();
      c.fillStyle = col; c.beginPath(); c.arc(Tx, Ty, 5, 0, 2 * PI); c.fill();
      dotted(Tx, Ty, gx, gy, col, 1.8);
    }
    c.lineCap = 'butt';

    c.strokeStyle = AXIS; c.lineWidth = 2;
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(Px, Py); c.stroke();

    // 곡선: 지나간 범위는 옅게(잔상), 0 에서 현재 θ 까지는 진하게
    c.strokeStyle = col; c.lineWidth = 4.5; c.lineJoin = 'round';
    if (st.hi - st.lo > 0) {
      c.globalAlpha = 0.3;
      plot(X, Y, f, st.lo * PI / 180, st.hi * PI / 180, 0.01);
      c.globalAlpha = 1;
    }
    var xa = Math.min(0, th), xb = Math.max(0, th);
    if (xb - xa > 1e-6) plot(X, Y, f, xa, xb, 0.01);

    if (ok) dotted(gx, gy, gx, cy, AXIS, 1.2);

    // 점들
    c.fillStyle = '#fff'; c.strokeStyle = col; c.lineWidth = 3.5;
    if (ok) { c.beginPath(); c.arc(gx, gy, 8, 0, 2 * PI); c.fill(); c.stroke(); }
    c.beginPath(); c.arc(Px, Py, 10, 0, 2 * PI); c.fill(); c.stroke();
  }

  /* ---------- ② 그리기 ---------- */
  function draw2() {
    var span = XMAX - XMIN, YR = 3.6;
    var ppu = Math.max(20, Math.min((W - 64 - 28) / span, (H - 48) / (2 * YR)));
    var gl = 64, gr = gl + ppu * span, cy = H / 2;
    var top = 8, bot = H - 8;
    function X(x) { return gl + (x - XMIN) * ppu; }
    function Y(y) { return cy - y * ppu; }
    var x0 = X(0), vis = Math.floor((H / 2 - 12) / ppu);
    var a = st.a, b = st.b, col = COL[st.fn], isTan = st.fn === 'tan';

    // 격자
    c.strokeStyle = GRID; c.lineWidth = 1;
    for (var v = -vis; v <= vis; v++) { c.beginPath(); c.moveTo(gl, Y(v)); c.lineTo(gr, Y(v)); c.stroke(); }
    for (var k = -4; k <= 8; k++) { c.beginPath(); c.moveTo(X(k * PI / 2), top); c.lineTo(X(k * PI / 2), bot); c.stroke(); }

    // 축
    arrowX(gl - 4, gr, cy);
    arrowY(x0, bot, top);
    c.font = '600 16px sans-serif'; c.textAlign = 'center';
    for (k = -4; k <= 8; k++) {
      if (k === 0) continue;
      c.strokeStyle = AXIS; c.lineWidth = 1;
      c.beginPath(); c.moveTo(X(k * PI / 2), cy - 4); c.lineTo(X(k * PI / 2), cy + 4); c.stroke();
      c.fillStyle = MUTED; c.fillText(xTickLabel(k), X(k * PI / 2), cy + 22);
    }
    c.textAlign = 'right'; c.fillStyle = MUTED;
    for (v = -vis; v <= vis; v++) { if (v !== 0) c.fillText(String(v).replace('-', '−'), x0 - 8, Y(v) + 6); }
    c.fillText('O', x0 - 8, cy + 22);
    c.textAlign = 'left'; c.fillText('x', gr - 12, cy - 10);
    c.fillText('y', x0 + 10, top + 14);

    // 점근선 (탄젠트)
    if (isTan) drawAsymptotes(X, top, bot, b);

    // 기준 곡선 (y = sin x / cos x / tan x)
    c.strokeStyle = '#a0aec0'; c.lineWidth = 2; c.setLineDash([6, 5]);
    plot(X, Y, f, XMIN, XMAX, 0.01);
    c.setLineDash([]);
    c.fillStyle = '#8a97a8'; c.font = '700 16px sans-serif'; c.textAlign = 'left';
    c.fillText('y = ' + st.fn + ' x (기준)', gl + 10, top + 24);

    // 최댓값·최솟값 선 (사인·코사인)
    var amp = Math.abs(a);
    if (!isTan && amp > 0) {
      dotted(gl, Y(amp), gr, Y(amp), col, 1.3);
      dotted(gl, Y(-amp), gr, Y(-amp), col, 1.3);
      c.fillStyle = col; c.font = '700 16px sans-serif'; c.textAlign = 'right';
      c.fillText('최댓값 ' + fmt(amp), gr - 6, Y(amp) - 6);
      c.fillText('최솟값 −' + fmt(amp), gr - 6, Y(-amp) + 20);
    }

    // y = a sin bx
    c.strokeStyle = col; c.lineWidth = 4.5; c.lineJoin = 'round';
    plot(X, Y, function (x) {
      var u = b * x;
      return a * (st.fn === 'sin' ? Math.sin(u) : st.fn === 'cos' ? Math.cos(u) : Math.tan(u));
    }, XMIN, XMAX, 0.005);

    // 주기 표시 (0 ~ T)
    var T = (isTan ? PI : 2 * PI) / b, ay = H - 26;
    dotted(X(0), ay, X(0), cy, ACCENT, 1.3);
    dotted(X(T), ay, X(T), cy, ACCENT, 1.3);
    c.strokeStyle = ACCENT; c.fillStyle = ACCENT; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(X(0) + 4, ay); c.lineTo(X(T) - 4, ay); c.stroke();
    c.beginPath(); c.moveTo(X(0), ay); c.lineTo(X(0) + 9, ay - 5); c.lineTo(X(0) + 9, ay + 5); c.fill();
    c.beginPath(); c.moveTo(X(T), ay); c.lineTo(X(T) - 9, ay - 5); c.lineTo(X(T) - 9, ay + 5); c.fill();
    c.font = '700 17px sans-serif'; c.textAlign = 'center';
    c.fillText('주기 ' + periodText(), (X(0) + X(T)) / 2, ay - 9);
  }

  function periodText() {
    var n = Math.round(st.b * 10);
    return piFrac(st.fn === 'tan' ? 10 : 20, n);
  }

  /* ---------- 읽기값 ---------- */
  function exprText() {
    var a = st.a, b = st.b;
    if (a === 0) return 'y = 0';
    var as = a === 1 ? '' : (a === -1 ? '−' : fmt(a));
    var bs = b === 1 ? '' : fmt(b);
    return 'y = ' + as + st.fn + ' ' + bs + 'x';
  }

  function update() {
    var t1 = st.tab === 1;
    Array.prototype.forEach.call(document.querySelectorAll('.tab1-only'), function (e) { e.hidden = !t1; });
    Array.prototype.forEach.call(document.querySelectorAll('.tab2-only'), function (e) { e.hidden = t1; });
    document.getElementById('tab1').classList.toggle('active', t1);
    document.getElementById('tab2').classList.toggle('active', !t1);
    Array.prototype.forEach.call(document.querySelectorAll('.fn-btn'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-fn') === st.fn);
    });
    document.getElementById('btnPlay').textContent = st.playing ? '⏸ 일시정지' : '▶ 재생';

    if (t1) {
      var th = st.deg * PI / 180;
      var pt = piTextDeg(st.deg);
      document.getElementById('rdRad').textContent = pt === null ? num3(th)
        : (st.deg === 0 ? '0' : pt + ' ≈ ' + num3(th));
      document.getElementById('rdDeg').textContent = (Number.isInteger(st.deg) ? st.deg : st.deg.toFixed(1)).toString().replace('-', '−') + '°';
      document.getElementById('rdFnName').textContent = st.fn + ' θ';
      if (undefinedTan(th)) {
        document.getElementById('rdFn').textContent = '정의되지 않음';
      } else {
        var v = f(th), ex = exactText(v);
        document.getElementById('rdFn').textContent = ex === null ? num3(v) : (/^−?[01]$/.test(ex) ? ex : ex + ' ≈ ' + num3(v));
      }
    } else {
      var isTan = st.fn === 'tan';
      document.getElementById('valA').textContent = fmt(st.a);
      document.getElementById('valB').textContent = fmt(st.b);
      document.getElementById('rdExpr').textContent = exprText();
      var amp = Math.abs(st.a);
      document.getElementById('rdMax').textContent = isTan ? '없음' : fmt(amp);
      document.getElementById('rdMin').textContent = isTan ? '없음' : (amp === 0 ? '0' : '−' + fmt(amp));
      document.getElementById('rdPeriodName').textContent = '주기 ' + (isTan ? 'π' : '2π') + '/|b|';
      var T = (isTan ? PI : 2 * PI) / st.b;
      document.getElementById('rdPeriod').textContent = periodText() + (Math.abs(T - (isTan ? PI : 2 * PI)) < 1e-9 ? '' : ' ≈ ' + T.toFixed(2));
    }
  }

  function draw() {
    c.clearRect(0, 0, W, H);
    if (st.tab === 1) draw1(); else draw2();
    update();
  }

  /* ---------- 입력 (①) ---------- */
  function pos(ev) {
    var r = cv.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }
  function clampDeg(v) { return Math.max(DEG_MIN, Math.min(DEG_MAX, v)); }
  function snap15(v) {
    var m = Math.round(v / 15) * 15;
    return Math.abs(v - m) <= 2 ? m : v;
  }

  function setFromCircle(p, first) {
    var g = geom1();
    var phi = Math.atan2(-(p.y - g.cy), p.x - g.cx) * 180 / PI;
    if (phi < 0) phi += 360;
    phi = Math.round(phi) % 360;
    var v = phi;
    if (!first) v = phi + 360 * Math.round((st.deg - phi) / 360);   // 직전 각에서 가장 가까운 각 (연속 회전)
    st.deg = snap15(clampDeg(v));
  }
  function setFromGraph(p) {
    var g = geom1();
    var x = (p.x - g.gl) / g.px + XMIN;
    st.deg = snap15(clampDeg(Math.round(x * 180 / PI)));
  }

  cv.addEventListener('pointerdown', function (ev) {
    if (st.tab !== 1) return;
    var p = pos(ev), g = geom1();
    stopPlay();
    cv.setPointerCapture(ev.pointerId);
    if (p.x < g.gl - 10) {
      st.drag = 'circle';
      var th = st.deg * PI / 180;
      var onDot = Math.hypot(p.x - (g.cx + Math.cos(th) * g.s), p.y - (g.cy - Math.sin(th) * g.s)) < 22;
      setFromCircle(p, !onDot);
    } else {
      st.drag = 'graph';
      setFromGraph(p);
    }
    draw();
  });
  cv.addEventListener('pointermove', function (ev) {
    if (!st.drag) return;
    var p = pos(ev);
    if (st.drag === 'circle') setFromCircle(p, false); else setFromGraph(p);
    draw();
  });
  function endDrag() { st.drag = null; }
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  /* ---------- 재생 ---------- */
  var lastT = 0;
  function stopPlay() { st.playing = false; }
  function tick(now) {
    if (!st.playing) return;
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    st.deg += 60 * dt;
    if (st.deg >= DEG_MAX) { st.deg = DEG_MAX; st.playing = false; }
    draw();
    if (st.playing) requestAnimationFrame(tick);
  }
  document.getElementById('btnPlay').addEventListener('click', function () {
    if (st.playing) { st.playing = false; draw(); return; }
    if (st.deg >= DEG_MAX) st.deg = 0;
    st.playing = true; lastT = performance.now();
    draw();
    requestAnimationFrame(tick);
  });
  document.getElementById('btnReset').addEventListener('click', function () {
    st.playing = false; st.deg = 0; st.lo = 0; st.hi = 0; draw();
  });

  /* ---------- 탭·함수·슬라이더 ---------- */
  function setTab(n) { st.tab = n; stopPlay(); draw(); }
  document.getElementById('tab1').addEventListener('click', function () { setTab(1); });
  document.getElementById('tab2').addEventListener('click', function () { setTab(2); });
  Array.prototype.forEach.call(document.querySelectorAll('.fn-btn'), function (b) {
    b.addEventListener('click', function () { st.fn = b.getAttribute('data-fn'); draw(); });
  });
  document.getElementById('btnAB').addEventListener('click', function () {
    st.a = 1; st.b = 1;
    document.getElementById('sliderA').value = 1;
    document.getElementById('sliderB').value = 1;
    draw();
  });
  document.getElementById('sliderA').addEventListener('input', function (e) {
    st.a = Math.round(parseFloat(e.target.value) * 10) / 10; draw();
  });
  document.getElementById('sliderB').addEventListener('input', function (e) {
    st.b = Math.round(parseFloat(e.target.value) * 10) / 10; draw();
  });

  resize();
})();
