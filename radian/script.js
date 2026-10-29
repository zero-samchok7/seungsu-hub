/* ===== 호도법 탐구 ===== */
(function () {
  var PI = Math.PI;
  var POS = '#e17055';   // 양의 방향 (주황)
  var NEG = '#0984e3';   // 음의 방향 (파랑)
  var ACCENT = '#6c5ce7';
  var MUTED = '#718096';
  var BORDER = '#cbd5e0';

  var st = {
    deg: 0,          // 각의 크기(절댓값, 정수 도)
    dir: 1,          // 1: 양의 방향, -1: 음의 방향
    turns: false,    // 한 바퀴 넘기기
    R: 2.0,          // 바깥 원 반지름
    u: 1,            // 펴짐 진행도 (0: 감김, 1: 완전히 펴짐)
    divT: 0,         // ÷ 반지름 진행도
    showRatio: false,
    drag: null       // 'angle' | 'radius' | null
  };

  var cvC = document.getElementById('circleCanvas');
  var cvL = document.getElementById('lineCanvas');
  var cxC = cvC.getContext('2d');
  var cxL = cvL.getContext('2d');
  var sizeC = { w: 0, h: 0 }, sizeL = { w: 0, h: 0 };

  /* ---------- 유틸 ---------- */
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function dirColor() { return st.dir === 1 ? POS : NEG; }
  function thetaRad() { return st.dir * st.deg * PI / 180; }
  function piText(deg) {
    if (deg === 0) return '0';
    var g = gcd(deg, 180), n = deg / g, d = 180 / g;
    var s = (n === 1 ? '' : n) + 'π' + (d === 1 ? '' : '/' + d);
    return s;
  }
  function thetaText() {
    var t = thetaRad();
    if (st.deg === 0) return '0';
    return (st.dir < 0 ? '−' : '') + piText(st.deg) + ' ≈ ' + Math.abs(t).toFixed(3).replace(/^/, st.dir < 0 ? '−' : '');
  }
  function num(x, d) {
    var s = Math.abs(x) < 0.0005 ? '0' : x.toFixed(d == null ? 3 : d);
    return s.replace('-', '−');
  }

  /* ---------- 캔버스 크기 ---------- */
  function fit(cv, cx, size) {
    var r = cv.parentElement.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    size.w = r.width; size.h = r.height;
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function resize() { fit(cvC, cxC, sizeC); fit(cvL, cxL, sizeL); draw(); }
  window.addEventListener('resize', resize);

  /* ---------- 왼쪽: 원 ---------- */
  var RMAX = 3.0;
  function circleGeom() {
    var s = Math.min(sizeC.w, sizeC.h) / 2 / (RMAX + 0.5);
    return { cx: sizeC.w / 2, cy: sizeC.h / 2, s: s };
  }

  function drawCircle() {
    var c = cxC, g = circleGeom(), cx = g.cx, cy = g.cy, s = g.s, R = st.R;
    c.clearRect(0, 0, sizeC.w, sizeC.h);

    // 축
    c.strokeStyle = '#e2e8f0'; c.lineWidth = 1;
    c.beginPath();
    c.moveTo(8, cy); c.lineTo(sizeC.w - 8, cy);
    c.moveTo(cx, 8); c.lineTo(cx, sizeC.h - 8);
    c.stroke();

    // 바깥 원 / 안쪽 원
    c.strokeStyle = '#b8b2f0'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(cx, cy, R * s, 0, 2 * PI); c.stroke();
    c.strokeStyle = BORDER; c.lineWidth = 1.5;
    c.beginPath(); c.arc(cx, cy, s, 0, 2 * PI); c.stroke();

    // 각 부채꼴(옅게)
    var th = thetaRad();
    if (st.deg > 0) {
      c.fillStyle = st.dir === 1 ? 'rgba(225,112,85,0.10)' : 'rgba(9,132,227,0.10)';
      c.beginPath(); c.moveTo(cx, cy);
      c.arc(cx, cy, R * s, 0, -Math.min(Math.abs(th), 2 * PI) * st.dir, st.dir === 1);
      c.closePath(); c.fill();
    }

    // 호 (바퀴마다 반지름을 조금씩 키워 겹침 표시)
    var loops = Math.ceil(st.deg / 360);
    c.lineCap = 'round';
    for (var i = 0; i < loops; i++) {
      var d = Math.min(st.deg - 360 * i, 360) * PI / 180;
      var off = i * 5;
      c.strokeStyle = dirColor();
      c.lineWidth = 6;
      c.beginPath(); c.arc(cx, cy, s + off, 0, -d * st.dir, st.dir === 1); c.stroke();
      c.lineWidth = 4;
      c.globalAlpha = 0.75;
      c.beginPath(); c.arc(cx, cy, R * s + off, 0, -d * st.dir, st.dir === 1); c.stroke();
      c.globalAlpha = 1;
    }

    // 반지름 선
    var ex = Math.cos(th), ey = -Math.sin(th);
    c.strokeStyle = dirColor(); c.lineWidth = 1.5; c.setLineDash([5, 4]);
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + ex * R * s, cy + ey * R * s); c.stroke();
    c.setLineDash([]);

    // 기준점 (각 0)
    c.fillStyle = '#2d3748';
    c.beginPath(); c.arc(cx + s, cy, 3.5, 0, 2 * PI); c.fill();
    c.beginPath(); c.arc(cx + R * s, cy, 3.5, 0, 2 * PI); c.fill();
    c.fillStyle = MUTED; c.font = '600 17px sans-serif'; c.textAlign = 'left';
    c.fillText('0', cx + s + 6, cy + 20);

    // 중심 O
    c.fillStyle = '#2d3748';
    c.beginPath(); c.arc(cx, cy, 3, 0, 2 * PI); c.fill();
    c.fillStyle = MUTED; c.textAlign = 'right'; c.fillText('O', cx - 8, cy + 20);

    // 움직이는 점 (안쪽 · 바깥)
    function dot(rad, r, big) {
      c.fillStyle = '#fff'; c.strokeStyle = dirColor(); c.lineWidth = 3;
      c.beginPath(); c.arc(cx + ex * rad * s, cy + ey * rad * s, r, 0, 2 * PI); c.fill(); c.stroke();
    }
    dot(R, 8); dot(1, 12);

    // 반지름 라벨
    c.font = '700 17px sans-serif'; c.textAlign = 'left';
    c.fillStyle = MUTED;
    c.fillText('r = 1', cx + 8, cy - 10);
    c.fillStyle = '#7d70e8';
    c.fillText('r = ' + R.toFixed(1), cx + R * s * Math.cos(-PI / 4 + 0.0) - 8, cy + R * s * Math.sin(PI / 4) + 34);

    // 반지름 조절 손잡이 (오른쪽 아래)
    var hx = cx + R * s * Math.cos(PI / 4), hy = cy + R * s * Math.sin(PI / 4);
    c.fillStyle = ACCENT; c.strokeStyle = '#fff'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(hx, hy, 12, 0, 2 * PI); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.font = '700 15px sans-serif'; c.textAlign = 'center';
    c.fillText('↔', hx, hy + 5);

    // 각 표시
    if (st.deg > 0) {
      c.fillStyle = dirColor(); c.font = '700 22px sans-serif'; c.textAlign = 'left';
      var turnsN = Math.floor(st.deg / 360), rest = st.deg - turnsN * 360;
      var label = (st.dir < 0 ? '−' : '') + st.deg + '°';
      if (turnsN > 0 && rest > 0) label += '  (' + turnsN + '바퀴 + ' + rest + '°)';
      else if (turnsN > 0) label += '  (' + turnsN + '바퀴)';
      c.fillText(label, 14, 30);
    }
  }

  /* ---------- 오른쪽: 수직선 ---------- */
  function lineGeom() {
    var maxM = st.turns ? 4 * PI : 2 * PI;
    var a = maxM * Math.max(st.R, 1) + 0.4;
    return { x0: sizeL.w / 2, yA: sizeL.h * 0.34, yB: sizeL.h * 0.72, a: a, ppu: (sizeL.w / 2 - 22) / a };
  }

  function drawAxis(c, g, y, withPi) {
    c.strokeStyle = '#4a5568'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(14, y); c.lineTo(sizeL.w - 14, y); c.stroke();
    // 화살표
    c.fillStyle = '#4a5568';
    c.beginPath(); c.moveTo(sizeL.w - 8, y); c.lineTo(sizeL.w - 16, y - 4); c.lineTo(sizeL.w - 16, y + 4); c.fill();
    var step = 1;
    [1, 2, 5, 10].some(function (s) { step = s; return s * g.ppu >= 34; });
    c.font = '15px sans-serif'; c.textAlign = 'center';
    var n = Math.floor(g.a);
    for (var k = -n; k <= n; k++) {
      var x = g.x0 + k * g.ppu;
      c.strokeStyle = '#4a5568'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, y - (k === 0 ? 6 : 4)); c.lineTo(x, y + (k === 0 ? 6 : 4)); c.stroke();
      if (k % step === 0) { c.fillStyle = MUTED; c.fillText(String(k).replace('-', '−'), x, y + 22); }
    }
    if (withPi) {
      c.font = '700 17px sans-serif';
      var m = Math.floor(g.a / PI);
      for (var j = -m; j <= m; j++) {
        if (j === 0) continue;
        var xp = g.x0 + j * PI * g.ppu;
        c.strokeStyle = 'rgba(108,92,231,0.45)'; c.lineWidth = 1; c.setLineDash([2, 3]);
        c.beginPath(); c.moveTo(xp, y - 14); c.lineTo(xp, y + 34); c.stroke(); c.setLineDash([]);
        c.fillStyle = ACCENT;
        var t = (j === 1 ? '' : j === -1 ? '−' : String(j).replace('-', '−')) + 'π';
        c.fillText(t, xp, y + 50);
      }
    }
  }

  // r인 원에서 잰 호(각 θ)를 u 만큼 편 곡선. 반환: 끝점 좌표
  function drawUnroll(c, g, y, r, alpha, lenScale) {
    var ell = thetaRad() * r * lenScale;
    var L = Math.abs(ell), sgn = ell < 0 ? -1 : 1;
    var kappa = (1 - st.u) / r;
    var N = Math.max(2, Math.ceil(L * g.ppu / 3));
    var ex = g.x0, ey = y;
    c.strokeStyle = dirColor(); c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round';
    c.globalAlpha = alpha;
    c.beginPath();
    for (var i = 0; i <= N; i++) {
      var s = L * i / N, x, yy;
      if (kappa < 1e-6) { x = s; yy = 0; }
      else { x = Math.sin(kappa * s) / kappa; yy = (1 - Math.cos(kappa * s)) / kappa; }
      var px = g.x0 + sgn * x * g.ppu, py = y - yy * g.ppu;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      ex = px; ey = py;
    }
    c.stroke();
    c.globalAlpha = 1;
    return { x: ex, y: ey };
  }

  function drawLine() {
    var c = cxL, g = lineGeom(), R = st.R;
    c.clearRect(0, 0, sizeL.w, sizeL.h);

    c.font = '700 17px sans-serif'; c.textAlign = 'left';
    c.fillStyle = '#7d70e8';
    c.fillText('바깥 원 (r = ' + R.toFixed(1) + ')의 호  ℓ₂ = ' + R.toFixed(1) + ' × θ', 14, g.yA - 78);
    c.fillStyle = MUTED;
    c.fillText('안쪽 원 (r = 1)의 호  ℓ₁ = θ', 14, g.yB - 78);

    drawAxis(c, g, g.yA, false);
    drawAxis(c, g, g.yB, true);

    var th = thetaRad();
    var done = st.u >= 1;

    // 바깥 원 호
    var divided = st.divT > 0;
    var endA = drawUnroll(c, g, g.yA, R, divided ? 0.25 : 1, 1);
    if (divided) {
      var f = 1 - st.divT * (1 - 1 / R);
      var saveU = st.u; st.u = 1;
      endA = drawUnroll(c, g, g.yA, R, 1, f);
      st.u = saveU;
    }
    // 안쪽 원 호
    var endB = drawUnroll(c, g, g.yB, 1, 1, 1);

    // 끝점 표시
    function mark(p, text, color, up) {
      c.fillStyle = '#fff'; c.strokeStyle = color; c.lineWidth = 3;
      c.beginPath(); c.arc(p.x, p.y, 6, 0, 2 * PI); c.fill(); c.stroke();
      if (done && text) {
        c.fillStyle = color; c.font = '700 17px sans-serif'; c.textAlign = 'center';
        c.fillText(text, p.x, p.y + (up ? -16 : 40));
      }
    }
    // 0 점
    c.fillStyle = '#2d3748';
    [g.yA, g.yB].forEach(function (y) { c.beginPath(); c.arc(g.x0, y, 3.5, 0, 2 * PI); c.fill(); });

    if (st.deg > 0 || !done) {
      mark(endA, divided && st.divT >= 1 ? 'ℓ₂ ÷ r = ' + num(th) : 'ℓ₂ = ' + num(th * R), dirColor(), true);
      mark(endB, 'θ = ' + num(th), dirColor(), false);
    }

    // ÷ r 완료 시 안쪽 수직선과 연결
    if (st.divT >= 1 && done) {
      c.strokeStyle = ACCENT; c.lineWidth = 1.5; c.setLineDash([4, 4]);
      c.beginPath(); c.moveTo(endA.x, endA.y + 6); c.lineTo(endB.x, endB.y - 6); c.stroke(); c.setLineDash([]);
      c.fillStyle = ACCENT; c.font = '700 17px sans-serif'; c.textAlign = 'left';
      c.fillText('같은 실수!', (endA.x + endB.x) / 2 + 8, (g.yA + g.yB) / 2 + 4);
    }
  }

  /* ---------- 읽기값 ---------- */
  function updateReadouts() {
    var th = thetaRad(), R = st.R;
    document.getElementById('rdDeg').textContent = (st.dir < 0 ? '−' : '') + st.deg + '°';
    document.getElementById('rdL1').textContent = num(th);
    document.getElementById('rdL2Name').textContent = '바깥 원(r = ' + R.toFixed(1) + ')의 호의 길이 ℓ₂';
    document.getElementById('rdL2').textContent = num(th * R);
    document.getElementById('rdRatio').textContent = st.showRatio
      ? num(th) + ' , ' + num(th * R / R) : '–';
    document.getElementById('rdTheta').textContent = thetaText();
  }

  function draw() { drawCircle(); drawLine(); updateReadouts(); }

  /* ---------- 애니메이션 ---------- */
  var anim = null;
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function runAnim(kind, dur, onEnd) {
    anim = { kind: kind, t0: performance.now(), dur: dur, onEnd: onEnd };
    requestAnimationFrame(tick);
  }
  function tick(now) {
    if (!anim) return;
    var p = Math.min(1, (now - anim.t0) / anim.dur), e = ease(p);
    if (anim.kind === 'unroll') st.u = e; else st.divT = e;
    draw();
    if (p < 1) requestAnimationFrame(tick);
    else { var cb = anim.onEnd; anim = null; if (cb) cb(); }
  }
  function stopAnim() { anim = null; }
  function curl() { stopAnim(); st.u = 0; st.divT = 0; st.showRatio = false; }
  function unroll() { stopAnim(); st.u = 0; st.divT = 0; runAnim('unroll', 800); }

  /* ---------- 입력 ---------- */
  function pos(ev, cv) {
    var r = cv.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function setAngleFromPointer(p, first) {
    var g = circleGeom();
    var phi = Math.atan2(-(p.y - g.cy), p.x - g.cx) * 180 / PI;
    if (phi < 0) phi += 360;
    var d = st.dir === 1 ? phi : (360 - phi) % 360;
    d = Math.round(d) % 360;
    var prev = st.deg;
    if (!first) {
      if (!st.turns) {
        if (prev > 270 && d < 90) d = 360;
        else if (prev < 90 && d > 270) d = 0;
      } else {
        var k = Math.round((prev - d) / 360);
        d = Math.max(0, Math.min(720, d + 360 * k));
      }
    }
    st.deg = d;
  }

  function setRadiusFromPointer(p) {
    var g = circleGeom();
    var r = Math.hypot(p.x - g.cx, p.y - g.cy) / g.s;
    st.R = Math.max(1.5, Math.min(RMAX, Math.round(r * 10) / 10));
  }

  cvC.addEventListener('pointerdown', function (ev) {
    var p = pos(ev, cvC), g = circleGeom();
    var dist = Math.hypot(p.x - g.cx, p.y - g.cy);
    var hx = g.cx + st.R * g.s * Math.cos(PI / 4), hy = g.cy + st.R * g.s * Math.sin(PI / 4);
    var th = thetaRad();
    var onOuterDot = Math.hypot(p.x - (g.cx + Math.cos(th) * st.R * g.s), p.y - (g.cy - Math.sin(th) * st.R * g.s)) < 14;
    var onHandle = Math.hypot(p.x - hx, p.y - hy) < 16;
    var onRing = Math.abs(dist - st.R * g.s) < 8 && !onOuterDot;
    cvC.setPointerCapture(ev.pointerId);
    if (onHandle || onRing) {
      st.drag = 'radius'; curl(); setRadiusFromPointer(p);
    } else {
      st.drag = 'angle'; curl();
      var onInnerDot = Math.hypot(p.x - (g.cx + Math.cos(th) * g.s), p.y - (g.cy - Math.sin(th) * g.s)) < 18;
      setAngleFromPointer(p, !(onInnerDot || onOuterDot));
    }
    draw();
  });
  cvC.addEventListener('pointermove', function (ev) {
    if (!st.drag) return;
    var p = pos(ev, cvC);
    if (st.drag === 'radius') setRadiusFromPointer(p); else setAngleFromPointer(p, false);
    st.showRatio = false; st.divT = 0;
    draw();
  });
  function endDrag() {
    if (!st.drag) return;
    var wasAngle = st.drag === 'angle';
    st.drag = null;
    unroll();
  }
  cvC.addEventListener('pointerup', endDrag);
  cvC.addEventListener('pointercancel', endDrag);

  /* ---------- 버튼 ---------- */
  function goDeg(d) { st.deg = d; curl(); draw(); unroll(); }
  Array.prototype.forEach.call(document.querySelectorAll('[data-deg]'), function (b) {
    b.addEventListener('click', function () { goDeg(parseInt(b.getAttribute('data-deg'), 10)); });
  });
  document.getElementById('btnReset').addEventListener('click', function () {
    st.R = 2.0; st.deg = 0; curl(); st.u = 1; draw();
  });

  var togTurns = document.getElementById('togTurns');
  togTurns.addEventListener('click', function () {
    st.turns = !st.turns;
    togTurns.classList.toggle('on', st.turns);
    if (!st.turns && st.deg > 360) { st.deg = 360; }
    curl(); st.u = 1; draw();
  });
  var togNeg = document.getElementById('togNeg');
  togNeg.addEventListener('click', function () {
    st.dir = -st.dir;
    togNeg.classList.toggle('on', st.dir < 0);
    curl(); st.u = 1; draw();
  });

  document.getElementById('btnDivide').addEventListener('click', function () {
    if (st.deg === 0) return;
    stopAnim();
    st.showRatio = true; st.divT = 0;
    var go = function () { runAnim('div', 1000); };
    if (st.u < 1) { runAnim('unroll', 600, go); } else { go(); }
  });

  resize();
})();
