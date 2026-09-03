'use strict';

/* ===== 상태 ===== */
var formulas = [];
var points = [];
var nextFormulaId = 1;
var nextPointId = 1;
var selectedType = 'basic';

var COLORS = ['#e53e3e', '#3182ce', '#38a169', '#d69e2e', '#805ad5', '#0987a0', '#dd6b20', '#4a5568'];
var colorIdx = 0;

/* ===== 캔버스 & 뷰 ===== */
var canvas = document.getElementById('graphCanvas');
var ctx = canvas.getContext('2d');

var viewX = 0;      // 화면 중심의 x 좌표 (수학)
var viewY = 3;      // 화면 중심의 y 좌표 (수학)
var zoom  = 60;     // pixels per unit

var DEFAULT_VIEW = { x: 0, y: 3, zoom: 60 };

/* ===== 좌표 변환 ===== */
function toPixel(x, y) {
    return {
        px: canvas.width  / 2 + (x - viewX) * zoom,
        py: canvas.height / 2 - (y - viewY) * zoom
    };
}
function fromPixel(px, py) {
    return {
        x: viewX + (px - canvas.width  / 2) / zoom,
        y: viewY - (py - canvas.height / 2) / zoom
    };
}

/* ===== 함수 계산 ===== */
function evalF(f, x) {
    var a = f.a;
    if (a <= 0) return null;
    var xVal = (f.type === 'shifted') ? x - f.p : x;
    var y = Math.pow(a, xVal);
    if (!isFinite(y) || isNaN(y)) return null;
    if (f.type === 'shifted') y += f.q;
    return y;
}

/* ===== 눈금 간격 계산 ===== */
function niceStep(zoomPx) {
    var raw   = 80 / zoomPx;
    var exp   = Math.floor(Math.log10(raw));
    var base  = Math.pow(10, exp);
    var ratio = raw / base;
    if (ratio < 2) return base;
    if (ratio < 5) return 2 * base;
    return 5 * base;
}

/* ===== 분수 파싱 (예: "1/2" → 0.5) ===== */
function parseFrac(str) {
    str = String(str).trim();
    var sl = str.indexOf('/');
    if (sl === -1) return parseFloat(str);
    var n = parseFloat(str.slice(0, sl).trim());
    var d = parseFloat(str.slice(sl + 1).trim());
    if (isNaN(n) || isNaN(d) || d === 0) return NaN;
    return n / d;
}

/* ===== 숫자 포맷 ===== */
function fmtLabel(n) {
    if (n === 0) return '0';
    var abs = Math.abs(n);
    if (abs >= 10000 || abs < 0.0001) return n.toExponential(1);
    return parseFloat(n.toPrecision(4)).toString();
}
function fmtCoord(n) {
    return parseFloat(n.toFixed(3)).toString();
}
function fmtA(n) {
    return parseFloat(n.toFixed(3)).toString();
}

/* ===== 식 라벨 HTML ===== */
function formulaHTML(f) {
    var aStr = fmtA(f.a);
    if (f.type === 'basic') {
        return 'y = ' + aStr + '<sup>x</sup>';
    }
    var expPart = 'x';
    if (f.p !== 0) {
        expPart = f.p > 0
            ? 'x&minus;' + fmtA(f.p)
            : 'x+' + fmtA(Math.abs(f.p));
    }
    var qPart = '';
    if (f.q !== 0) {
        qPart = f.q > 0
            ? ' + ' + fmtA(f.q)
            : ' &minus; ' + fmtA(Math.abs(f.q));
    }
    return 'y = ' + aStr + '<sup>' + expPart + '</sup>' + qPart;
}

/* ===== select용 순수 텍스트 라벨 ===== */
function formulaText(f) {
    var aStr = fmtA(f.a);
    if (f.type === 'basic') return 'y = ' + aStr + '^x';
    var expPart = 'x';
    if (f.p !== 0) expPart = f.p > 0 ? 'x-' + fmtA(f.p) : 'x+' + fmtA(Math.abs(f.p));
    var qPart = '';
    if (f.q !== 0) qPart = f.q > 0 ? '+' + fmtA(f.q) : '-' + fmtA(Math.abs(f.q));
    return 'y = ' + aStr + '^(' + expPart + ')' + qPart;
}

/* ===== 그리기 ===== */
function draw() {
    var w = canvas.width, h = canvas.height;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    var step = niceStep(zoom);
    var xMin = viewX - w / (2 * zoom);
    var xMax = viewX + w / (2 * zoom);
    var yMin = viewY - h / (2 * zoom);
    var yMax = viewY + h / (2 * zoom);

    /* --- 격자 --- */
    ctx.strokeStyle = '#edf2f7';
    ctx.lineWidth = 1;

    var gx = Math.ceil(xMin / step) * step;
    while (gx <= xMax + step * 0.01) {
        var gp = toPixel(gx, 0);
        ctx.beginPath(); ctx.moveTo(gp.px, 0); ctx.lineTo(gp.px, h); ctx.stroke();
        gx += step;
    }
    var gy = Math.ceil(yMin / step) * step;
    while (gy <= yMax + step * 0.01) {
        var gq = toPixel(0, gy);
        ctx.beginPath(); ctx.moveTo(0, gq.py); ctx.lineTo(w, gq.py); ctx.stroke();
        gy += step;
    }

    /* --- 축 --- */
    var origin = toPixel(0, 0);
    ctx.strokeStyle = '#a0aec0';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, origin.py); ctx.lineTo(w, origin.py); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(origin.px, 0); ctx.lineTo(origin.px, h); ctx.stroke();

    /* --- 눈금 라벨 --- */
    ctx.fillStyle = '#a0aec0';
    ctx.font = '11px sans-serif';

    var labelY = Math.min(Math.max(origin.py + 14, 13), h - 4);
    var labelX = Math.min(Math.max(origin.px - 6, 28), w - 4);

    var lx = Math.ceil(xMin / step) * step;
    while (lx <= xMax + step * 0.01) {
        if (Math.abs(lx) > step * 0.01) {
            ctx.textAlign = 'center';
            ctx.fillText(fmtLabel(lx), toPixel(lx, 0).px, labelY);
        }
        lx += step;
    }
    var ly = Math.ceil(yMin / step) * step;
    while (ly <= yMax + step * 0.01) {
        if (Math.abs(ly) > step * 0.01) {
            ctx.textAlign = 'right';
            ctx.fillText(fmtLabel(ly), labelX, toPixel(0, ly).py + 4);
        }
        ly += step;
    }
    /* 원점 0 */
    if (origin.px > 4 && origin.px < w - 4 && origin.py > 4 && origin.py < h - 4) {
        ctx.textAlign = 'right';
        ctx.fillText('0', labelX, labelY);
    }

    /* --- 식 곡선 --- */
    formulas.forEach(function (f) {
        if (!f.visible) return;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        var started = false;
        for (var px = 0; px <= w; px++) {
            var wx = viewX + (px - w / 2) / zoom;
            var wy = evalF(f, wx);
            if (wy === null || !isFinite(wy)) { started = false; continue; }
            var py = h / 2 - (wy - viewY) * zoom;
            if (!isFinite(py)) { started = false; continue; }
            if (!started) { ctx.moveTo(px, py); started = true; }
            else { ctx.lineTo(px, py); }
        }
        ctx.stroke();
    });

    /* --- 점 --- */
    points.forEach(function (pt) {
        var p = toPixel(pt.x, pt.y);
        if (p.px < -12 || p.px > w + 12 || p.py < -12 || p.py > h + 12) return;
        ctx.beginPath();
        ctx.arc(p.px, p.py, 5, 0, 2 * Math.PI);
        ctx.fillStyle = pt.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        var label = '(' + fmtCoord(pt.x) + ', ' + fmtCoord(pt.y) + ')';
        ctx.fillStyle = pt.color;
        ctx.font = 'bold 11px sans-serif';
        var tw = ctx.measureText(label).width;
        var lbx = p.px + 8;
        var lby = p.py - 6;
        if (lbx + tw > w - 4) lbx = p.px - tw - 8;
        if (lby < 14) lby = p.py + 17;
        ctx.fillText(label, lbx, lby);
    });
}

/* ===== 캔버스 크기 동기화 ===== */
function resizeCanvas() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    draw();
}
window.addEventListener('resize', resizeCanvas);

/* ===== 마우스 이벤트 ===== */
var isDragging = false, hasMoved = false;
var dragStart = null, viewStart = null;

canvas.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    isDragging = true;
    hasMoved   = false;
    dragStart  = { x: e.clientX, y: e.clientY };
    viewStart  = { x: viewX, y: viewY };
    canvas.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    var dx = e.clientX - dragStart.x;
    var dy = e.clientY - dragStart.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved = true;
    viewX = viewStart.x - dx / zoom;
    viewY = viewStart.y + dy / zoom;
    draw();
});

document.addEventListener('mouseup', function () {
    if (!isDragging) return;
    isDragging = false;
    canvas.style.cursor = 'crosshair';
});

/* 그래프 클릭 → 자유 점 추가 */
canvas.addEventListener('click', function (e) {
    if (hasMoved) return;
    var rect = canvas.getBoundingClientRect();
    var pt   = fromPixel(e.clientX - rect.left, e.clientY - rect.top);
    addFreePoint(pt.x, pt.y);
});

/* 마우스 이동 → 좌표 표시 */
canvas.addEventListener('mousemove', function (e) {
    var rect = canvas.getBoundingClientRect();
    var pt   = fromPixel(e.clientX - rect.left, e.clientY - rect.top);
    document.getElementById('coordHint').textContent =
        'x = ' + fmtCoord(pt.x) + ',  y = ' + fmtCoord(pt.y);
});
canvas.addEventListener('mouseleave', function () {
    document.getElementById('coordHint').textContent = '';
});

/* 휠 → 줌 (마우스 위치 기준) */
canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var rect   = canvas.getBoundingClientRect();
    var mx     = e.clientX - rect.left;
    var my     = e.clientY - rect.top;
    var before = fromPixel(mx, my);
    var factor = Math.pow(1.15, -e.deltaY / 100);
    zoom = Math.max(5, Math.min(8000, zoom * factor));
    var after = fromPixel(mx, my);
    viewX += before.x - after.x;
    viewY += before.y - after.y;
    draw();
}, { passive: false });

/* ===== 줌 버튼 ===== */
document.getElementById('btnZoomIn').addEventListener('click', function () {
    zoom = Math.min(8000, zoom * 1.5); draw();
});
document.getElementById('btnZoomOut').addEventListener('click', function () {
    zoom = Math.max(5, zoom / 1.5); draw();
});
document.getElementById('btnReset').addEventListener('click', function () {
    viewX = DEFAULT_VIEW.x; viewY = DEFAULT_VIEW.y; zoom = DEFAULT_VIEW.zoom; draw();
});

/* ===== 식 관리 ===== */
function nextColor() {
    return COLORS[(colorIdx++) % COLORS.length];
}

function addFormula() {
    var f = {
        id: nextFormulaId++,
        type: selectedType,
        a: 2, p: 0, q: 0,
        color: nextColor(),
        visible: true
    };
    formulas.push(f);
    renderFormulaList();
    refreshCurveSelect();
    draw();
}

function removeFormula(id) {
    formulas = formulas.filter(function (f) { return f.id !== id; });
    points   = points.filter(function (pt) { return pt.formulaId !== id; });
    renderFormulaList();
    renderPointList();
    refreshCurveSelect();
    draw();
}

function findFormula(id) {
    for (var i = 0; i < formulas.length; i++) {
        if (formulas[i].id === id) return formulas[i];
    }
    return null;
}

function updateCurvePoints(fId) {
    var f = findFormula(fId);
    if (!f) return;
    points.forEach(function (pt) {
        if (pt.formulaId !== fId) return;
        var y = evalF(f, pt.x);
        if (y !== null) pt.y = y;
    });
    renderPointList();
}

/* ===== 식 목록 렌더링 ===== */
function renderFormulaList() {
    var list = document.getElementById('formulaList');
    list.innerHTML = '';

    if (formulas.length === 0) {
        list.innerHTML = '<div style="font-size:0.78rem;color:#b0bec5;text-align:center;padding:6px 0;">식을 추가해보세요</div>';
        return;
    }

    formulas.forEach(function (f) {
        var item = document.createElement('div');
        item.className = 'formula-item';
        item.style.borderLeftColor = f.color;
        if (!f.visible) item.style.opacity = '0.5';

        var shiftedHTML = f.type === 'shifted'
            ? '<div class="fi-param">' +
              '  <label>p</label>' +
              '  <input type="text" class="p-inp frac-inp" value="' + fmtA(f.p) + '">' +
              '</div>' +
              '<div class="fi-param">' +
              '  <label>q</label>' +
              '  <input type="text" class="q-inp frac-inp" value="' + fmtA(f.q) + '">' +
              '</div>'
            : '';

        item.innerHTML =
            '<div class="fi-header">' +
            '  <span class="fi-label">' + formulaHTML(f) + '</span>' +
            '  <button class="fi-btn vis-btn' + (f.visible ? '' : ' vis-off') + '" title="표시/숨김">●</button>' +
            '  <button class="fi-btn del" title="삭제">×</button>' +
            '</div>' +
            '<div class="fi-param">' +
            '  <label>a</label>' +
            '  <input type="range" class="a-sl" min="0.1" max="10" step="0.01" value="' + f.a + '">' +
            '  <input type="text" class="a-inp frac-inp" value="' + fmtA(f.a) + '">' +
            '</div>' +
            shiftedHTML;

        /* a 슬라이더 & 입력 */
        var aSl  = item.querySelector('.a-sl');
        var aInp = item.querySelector('.a-inp');

        function syncA(v) {
            f.a = v;
            aSl.value  = Math.min(10, Math.max(0.1, v));
            aInp.value = fmtA(v);
            item.querySelector('.fi-label').innerHTML = formulaHTML(f);
            updateCurveSelect(f);
            updateCurvePoints(f.id);
            draw();
        }
        aSl.addEventListener('input', function () { syncA(parseFloat(this.value)); });
        aInp.addEventListener('change', function () {
            var v = parseFrac(this.value);
            if (!isNaN(v) && v > 0) syncA(v);
            else this.value = fmtA(f.a);
        });

        /* p, q 입력 (shifted만) */
        if (f.type === 'shifted') {
            var pInp = item.querySelector('.p-inp');
            var qInp = item.querySelector('.q-inp');

            pInp.addEventListener('input', function () {
                var v = parseFrac(this.value);
                if (!isNaN(v)) {
                    f.p = v;
                    item.querySelector('.fi-label').innerHTML = formulaHTML(f);
                    updateCurveSelect(f);
                    updateCurvePoints(f.id);
                    draw();
                }
            });
            qInp.addEventListener('input', function () {
                var v = parseFrac(this.value);
                if (!isNaN(v)) {
                    f.q = v;
                    item.querySelector('.fi-label').innerHTML = formulaHTML(f);
                    updateCurveSelect(f);
                    updateCurvePoints(f.id);
                    draw();
                }
            });
        }

        /* 표시/숨김 버튼 */
        item.querySelector('.vis-btn').addEventListener('click', function () {
            f.visible = !f.visible;
            item.style.opacity = f.visible ? '1' : '0.5';
            this.classList.toggle('vis-off', !f.visible);
            draw();
        });

        /* 삭제 버튼 */
        item.querySelector('.del').addEventListener('click', function () {
            removeFormula(f.id);
        });

        list.appendChild(item);
    });
}

/* ===== 곡선 선택 드롭다운 ===== */
function refreshCurveSelect() {
    var sel = document.getElementById('curvePtSelect');
    var prev = sel.value;
    sel.innerHTML = '<option value="">식 선택</option>';
    formulas.forEach(function (f) {
        var opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = formulaText(f);
        sel.appendChild(opt);
    });
    sel.value = prev;
}

function updateCurveSelect(f) {
    var sel = document.getElementById('curvePtSelect');
    var opt = sel.querySelector('option[value="' + f.id + '"]');
    if (opt) opt.textContent = formulaText(f);
}

/* ===== 점 관리 ===== */
function addFreePoint(x, y) {
    points.push({
        id: nextPointId++,
        type: 'free',
        x: x, y: y,
        formulaId: null,
        color: '#6c5ce7'
    });
    renderPointList();
    draw();
}

function addCurvePoint(fId, x) {
    var f = findFormula(fId);
    if (!f) return false;
    var y = evalF(f, x);
    if (y === null) return false;
    points.push({
        id: nextPointId++,
        type: 'curve',
        x: x, y: y,
        formulaId: fId,
        color: f.color
    });
    renderPointList();
    draw();
    return true;
}

function removePoint(id) {
    points = points.filter(function (pt) { return pt.id !== id; });
    renderPointList();
    draw();
}

function renderPointList() {
    var list = document.getElementById('pointList');
    list.innerHTML = '';
    points.forEach(function (pt) {
        var item = document.createElement('div');
        item.className = 'pt-item';
        item.innerHTML =
            '<span class="pt-dot" style="background:' + pt.color + '"></span>' +
            '<span class="pt-coords">(' + fmtCoord(pt.x) + ', ' + fmtCoord(pt.y) + ')</span>' +
            '<button class="pt-del-btn" title="삭제">×</button>';
        item.querySelector('.pt-del-btn').addEventListener('click', function () {
            removePoint(pt.id);
        });
        list.appendChild(item);
    });
}

/* ===== 자유 점 입력 ===== */
document.getElementById('btnAddFreePt').addEventListener('click', function () {
    var raw  = document.getElementById('freePtInput').value.trim();
    var err  = document.getElementById('freePtError');
    err.textContent = '';
    var parts = raw.replace(/[()]/g, '').split(/\s*,\s*|\s+/).filter(Boolean);
    var xv = parseFrac(parts[0]), yv = parseFrac(parts[1]);
    if (parts.length !== 2 || isNaN(xv) || isNaN(yv)) {
        err.textContent = '형식: (3, 5) 또는 1/2, 3/4';
        return;
    }
    addFreePoint(xv, yv);
    document.getElementById('freePtInput').value = '';
});
document.getElementById('freePtInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('btnAddFreePt').click();
});

/* ===== 곡선 위 점 입력 ===== */
document.getElementById('btnAddCurvePt').addEventListener('click', function () {
    var sel = document.getElementById('curvePtSelect');
    var xEl = document.getElementById('curvePtX');
    var err = document.getElementById('curvePtError');
    err.textContent = '';
    var fId = parseInt(sel.value);
    if (!fId) { err.textContent = '식을 선택해주세요'; return; }
    var x = parseFrac(xEl.value);
    if (isNaN(x)) { err.textContent = 'x 값을 입력해주세요 (예: 1/2)'; return; }
    if (!addCurvePoint(fId, x)) {
        err.textContent = '해당 x에서 값 계산 불가';
    }
});
document.getElementById('curvePtX').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('btnAddCurvePt').click();
});

/* ===== 타입 선택 ===== */
document.getElementById('typeBtnBasic').addEventListener('click', function () {
    selectedType = 'basic';
    this.classList.add('active');
    document.getElementById('typeBtnShifted').classList.remove('active');
});
document.getElementById('typeBtnShifted').addEventListener('click', function () {
    selectedType = 'shifted';
    this.classList.add('active');
    document.getElementById('typeBtnBasic').classList.remove('active');
});

/* ===== 식 추가 버튼 ===== */
document.getElementById('btnAddFormula').addEventListener('click', addFormula);

/* ===== 초기화 ===== */
(function init() {
    resizeCanvas();
    addFormula(); // 기본 y = 2^x 하나
})();
