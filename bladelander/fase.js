/* fase.js — carrega fases desenhadas em SVG para o Lunar Lander

   Nomes reconhecidos (id do objeto ou nome da camada; aceita sufixo numérico:
   base1, superficie_2, obstaculo-3 ...):

     mundo       retângulo com o tamanho total da fase
     escala      quadrado com o tamanho de UMA nave
     saida       retângulo da base de saída (a nave nasce estacionada nela)
     base        retângulos das bases de reabastecimento
     chegada     retângulo da base final
     superficie  chão sólido (linha aberta = preenche para baixo; forma fechada = sólido)
     teto        teto sólido (linha aberta = preenche para cima; forma fechada = sólido)
     obstaculo   sólido solto, em qualquer lugar (forma fechada)
     zoom_area   qualquer forma fechada (círculo, retângulo, desenho livre) que fixa o zoom enquanto a
                 nave estiver dentro dela, ignorando altura e velocidade. O valor vem do número do nome
                 (tabela ZOOM_AREA). Se duas se sobrepõem, vale a menor. A transição de entrada e saída
                 usa a "Rapidez do zoom" do painel.
     zoom        linha invisível de referência da câmera: o zoom depende da distância vertical
                 da nave até ela (acima ou abaixo). Pode haver várias (zoom, zoom1, zoom2...);
                 vale a mais próxima. Sem nenhuma, o zoom usa a altura até a superficie.

   Textura: acrescente UMA palavra depois do nome: superficie_gelo, obstaculo_lava, teto_gelo_2.
   O jogo usa essa palavra para escolher a textura (tabela TEX no HTML). Sem palavra = textura padrão.
*/
(function () {
'use strict';

var NAVE_PX = 32;   // largura de colisão da nave no jogo = lado do quadrado "escala"
var CELL = 2;       // resolução da colisão em px do jogo (menor = mais preciso, mais pesado)
var MARGEM = 100;   // quanto linhas de superficie/teto avançam além do mundo (px do jogo)
var FOLGA_BASE = 6; // base é prolongada para dentro do chão (evita fresta entre polígonos)
var PES_Y = 17.5;   // distância do centro da nave até os pés (nave nasce com os pés na base)
var NOMES = ['mundo', 'escala', 'saida', 'base', 'chegada', 'superficie', 'teto', 'obstaculo', 'zoom_area', 'zoom']; // zoom_area vem antes de zoom
var IGNORA = /^(defs|clippath|mask|style|title|desc|metadata|symbol|lineargradient|radialgradient|pattern|filter)$/;

var L = null; // fase atual

/* Linhas de zoom: o NÚMERO no nome escolhe por quanto o "Zoom máximo" é dividido perto dela.
   zoom = 1 (normal), zoom1 = 1.5, zoom2 = 2. Para criar mais, acrescente linhas aqui (ou no HTML: Fase.ZOOM_DIV[3]=3). */
var ZOOM_DIV = { 0: 1, 1: 1.5, 2: 2 };

/* Áreas de zoom fixo: o NÚMERO no nome escolhe o valor do zoom dentro da área.
   zoom_area = 2.5, zoom_area1 = 1, zoom_area2 = 0.6 (exemplos: troque pelos seus valores).
   Para criar mais, acrescente linhas aqui (ou no HTML: Fase.ZOOM_AREA[3]=0.4). */
var ZOOM_AREA = { 0: 2.5, 1: 3, 2: 0.6 };

/* ---------- matrizes (SVG: [a b c d e f]) ---------- */
function mul(m, n) {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
          m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
          m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}
function ap(m, p) { return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]; }
function parseT(str) {
  var M = [1, 0, 0, 1, 0, 0], re = /(\w+)\s*\(([^)]*)\)/g, m;
  while ((m = re.exec(str))) {
    var a = m[2].split(/[\s,]+/).filter(Boolean).map(Number), f = null, r;
    switch (m[1]) {
      case 'matrix': if (a.length === 6) f = a; break;
      case 'translate': f = [1, 0, 0, 1, a[0] || 0, a[1] || 0]; break;
      case 'scale': f = [a[0], 0, 0, a.length > 1 ? a[1] : a[0], 0, 0]; break;
      case 'rotate':
        r = (a[0] || 0) * Math.PI / 180;
        f = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
        if (a.length === 3) f = mul(mul([1, 0, 0, 1, a[1], a[2]], f), [1, 0, 0, 1, -a[1], -a[2]]);
        break;
      case 'skewX': f = [1, 0, Math.tan((a[0] || 0) * Math.PI / 180), 1, 0, 0]; break;
      case 'skewY': f = [1, Math.tan((a[0] || 0) * Math.PI / 180), 0, 1, 0, 0]; break;
    }
    if (f) M = mul(M, f);
  }
  return M;
}

/* ---------- caminhos (path d="...") em polilinhas ---------- */
function cubic(P, x0, y0, x1, y1, x2, y2, x3, y3) {
  var len = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
  var n = Math.max(4, Math.min(80, Math.ceil(len / 8)));
  for (var k = 1; k <= n; k++) {
    var t = k / n, u = 1 - t;
    P.push([u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
            u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]);
  }
}
function arc(P, x1, y1, rx, ry, phiDeg, fa, fs, x2, y2) {
  if (!rx || !ry) { P.push([x2, y2]); return; }
  rx = Math.abs(rx); ry = Math.abs(ry);
  var phi = phiDeg * Math.PI / 180, cp = Math.cos(phi), sp = Math.sin(phi);
  var dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, xp = cp * dx + sp * dy, yp = -sp * dx + cp * dy;
  var lam = xp * xp / (rx * rx) + yp * yp / (ry * ry);
  if (lam > 1) { var sq = Math.sqrt(lam); rx *= sq; ry *= sq; }
  var den = rx * rx * yp * yp + ry * ry * xp * xp;
  var co = den ? Math.sqrt(Math.max(0, (rx * rx * ry * ry - den) / den)) : 0;
  if (fa === fs) co = -co;
  var cxp = co * rx * yp / ry, cyp = -co * ry * xp / rx;
  var cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  function ang(ux, uy, vx, vy) { return Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); }
  var ux = (xp - cxp) / rx, uy = (yp - cyp) / ry;
  var th = ang(1, 0, ux, uy), dth = ang(ux, uy, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!fs && dth > 0) dth -= 2 * Math.PI; else if (fs && dth < 0) dth += 2 * Math.PI;
  var n = Math.max(6, Math.ceil(Math.abs(dth) / (Math.PI / 24)));
  for (var k = 1; k <= n; k++) {
    var a = th + dth * k / n, ex = rx * Math.cos(a), ey = ry * Math.sin(a);
    P.push([cx + ex * cp - ey * sp, cy + ex * sp + ey * cp]);
  }
}
function parsePath(d) {
  var i = 0, n = d.length, subs = [], cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = '', lcx = 0, lcy = 0, last = '';
  var NUM = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;
  function ws() { while (i < n && /[\s,]/.test(d[i])) i++; }
  function num() { ws(); NUM.lastIndex = i; var m = NUM.exec(d); if (!m) return NaN; i = NUM.lastIndex; return parseFloat(m[0]); }
  function flag() { ws(); var c = d[i++]; return c === '1' ? 1 : 0; }
  function start(px, py) { cur = { pts: [[px, py]], closed: false }; subs.push(cur); }
  while (true) {
    ws(); if (i >= n) break;
    if (/[A-Za-z]/.test(d[i])) cmd = d[i++]; else if (!cmd) break;
    var up = cmd.toUpperCase(), rel = cmd !== up, a, b, c, e, f, g, h;
    if (up === 'Z') {
      if (cur) cur.closed = true;
      x = sx; y = sy; cur = null; cmd = ''; last = 'Z'; continue;
    }
    if (up === 'M') {
      a = num(); b = num(); if (isNaN(a) || isNaN(b)) break;
      x = rel ? x + a : a; y = rel ? y + b : b; sx = x; sy = y; start(x, y);
      cmd = rel ? 'l' : 'L'; last = 'M'; continue;
    }
    if (!cur) start(x, y);
    var P = cur.pts;
    if (up === 'L') { a = num(); b = num(); if (isNaN(a) || isNaN(b)) break; x = rel ? x + a : a; y = rel ? y + b : b; P.push([x, y]); }
    else if (up === 'H') { a = num(); if (isNaN(a)) break; x = rel ? x + a : a; P.push([x, y]); }
    else if (up === 'V') { a = num(); if (isNaN(a)) break; y = rel ? y + a : a; P.push([x, y]); }
    else if (up === 'C' || up === 'S') {
      var x1, y1;
      if (up === 'C') { a = num(); b = num(); x1 = rel ? x + a : a; y1 = rel ? y + b : b; }
      else if (last === 'C' || last === 'S') { x1 = 2 * x - lcx; y1 = 2 * y - lcy; } else { x1 = x; y1 = y; }
      c = num(); e = num(); f = num(); g = num();
      if (isNaN(g)) break;
      var x2 = rel ? x + c : c, y2 = rel ? y + e : e, x3 = rel ? x + f : f, y3 = rel ? y + g : g;
      cubic(P, x, y, x1, y1, x2, y2, x3, y3); lcx = x2; lcy = y2; x = x3; y = y3;
    }
    else if (up === 'Q' || up === 'T') {
      var qx, qy;
      if (up === 'Q') { a = num(); b = num(); qx = rel ? x + a : a; qy = rel ? y + b : b; }
      else if (last === 'Q' || last === 'T') { qx = 2 * x - lcx; qy = 2 * y - lcy; } else { qx = x; qy = y; }
      c = num(); e = num(); if (isNaN(e)) break;
      var qx3 = rel ? x + c : c, qy3 = rel ? y + e : e;
      cubic(P, x, y, x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), qx3 + 2 / 3 * (qx - qx3), qy3 + 2 / 3 * (qy - qy3), qx3, qy3);
      lcx = qx; lcy = qy; x = qx3; y = qy3;
    }
    else if (up === 'A') {
      a = num(); b = num(); c = num(); e = flag(); f = flag(); g = num(); h = num();
      if (isNaN(h)) break;
      var ex = rel ? x + g : g, ey = rel ? y + h : h;
      arc(P, x, y, a, b, c, e, f, ex, ey); x = ex; y = ey;
    }
    else break;
    last = up;
  }
  return subs;
}

/* ---------- formas do SVG -> lista de subcaminhos ---------- */
function ellipse(cx, cy, rx, ry) {
  var P = [];
  for (var k = 0; k < 64; k++) { var a = k / 64 * 2 * Math.PI; P.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  return [{ pts: P, closed: true }];
}
function shapeSubs(el) {
  var t = (el.localName || el.nodeName || '').replace(/^.*:/, '').toLowerCase();
  function v(k) { var r = parseFloat(el.getAttribute(k)); return isNaN(r) ? 0 : r; }
  function list(s) { var a = (s || '').trim().split(/[\s,]+/).map(Number), P = []; for (var i = 0; i + 1 < a.length; i += 2) P.push([a[i], a[i + 1]]); return P; }
  switch (t) {
    case 'rect': var x = v('x'), y = v('y'), w = v('width'), h = v('height');
      return [{ pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], closed: true }];
    case 'circle': return ellipse(v('cx'), v('cy'), v('r'), v('r'));
    case 'ellipse': return ellipse(v('cx'), v('cy'), v('rx'), v('ry'));
    case 'polygon': return [{ pts: list(el.getAttribute('points')), closed: true }];
    case 'polyline': return [{ pts: list(el.getAttribute('points')), closed: false }];
    case 'path': return parsePath(el.getAttribute('d') || '');
  }
  return null;
}

/* ---------- percorrer o SVG e achar os objetos nomeados ---------- */
function kids(n) { var r = [], c = n.childNodes; for (var i = 0; i < c.length; i++) if (c[i].nodeType === 1) r.push(c[i]); return r; }
function tag(el) { return (el.localName || el.nodeName || '').replace(/^.*:/, '').toLowerCase(); }
function T(el) { var t = el.getAttribute('transform'); return t ? parseT(t) : [1, 0, 0, 1, 0, 0]; }
var RES = NOMES.map(function (n) { return [n, new RegExp('^' + n.replace(/_/g, '[\\s_\\-]*') + '(?:[\\s_\\-]*(\\d+))?(?:[\\s_\\-]+([a-z][a-z0-9]*))?(?:[\\s_\\-]*(\\d+))?_*$')]; });
function familia(el) {
  var at = ['serif:id', 'id', 'inkscape:label', 'data-name'];
  for (var i = 0; i < at.length; i++) {
    var s = el.getAttribute(at[i]);
    if (!s) continue;
    s = s.replace(/_x5F_/gi, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    for (var j = 0; j < RES.length; j++) { var m = RES[j][1].exec(s); if (m) return { name: RES[j][0], tag: m[2] || '', num: m[1] || m[3] || '' }; }
  }
  return null;
}
function coletar(el, M, o) {
  var subs = shapeSubs(el);
  if (subs) subs.forEach(function (s) { o.subs.push({ closed: s.closed, pts: s.pts.map(function (p) { return ap(M, p); }) }); });
  kids(el).forEach(function (k) { if (!IGNORA.test(tag(k))) coletar(k, mul(M, T(k)), o); });
}
function percorrer(el, M, out) {
  kids(el).forEach(function (k) {
    if (IGNORA.test(tag(k))) return;
    var m = mul(M, T(k)), f = familia(k);
    if (f) { var o = { fam: f.name, tag: f.tag, num: f.num, subs: [] }; coletar(k, m, o); out.push(o); }
    else percorrer(k, m, out);
  });
}
function caixa(objs) {
  var x0 = 1e30, y0 = 1e30, x1 = -1e30, y1 = -1e30;
  objs.forEach(function (o) { o.subs.forEach(function (s) { s.pts.forEach(function (p) {
    if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
  }); }); });
  return { x0: x0, y0: y0, x1: x1, y1: y1 };
}

/* ---------- geometria ---------- */
function area(P) { var s = 0; for (var i = 0, n = P.length; i < n; i++) { var a = P[i], b = P[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
function limpa(P) { var R = []; P.forEach(function (p) { var q = R[R.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.01) R.push(p); }); return R; }

/* ---------- construir a fase ---------- */
function build(text) {
  var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('O arquivo SVG não pôde ser lido (XML inválido).');
  var out = [];
  percorrer(doc.documentElement, [1, 0, 0, 1, 0, 0], out);
  var by = {}; NOMES.forEach(function (n) { by[n] = []; });
  out.forEach(function (o) { if (o.subs.length) by[o.fam].push(o); });
  if (!by.saida.length) throw new Error('Falta o objeto "saida" no SVG.');

  // escala: quadrado "escala" = uma nave
  var s, avisos = [];
  if (by.escala.length) {
    var e = caixa([by.escala[0]]);
    s = NAVE_PX / (((e.x1 - e.x0) + (e.y1 - e.y0)) / 2);
  } else {
    var pb = by.saida.concat(by.base, by.chegada).map(function (o) { var c = caixa([o]); return c.x1 - c.x0; });
    var med = pb.reduce(function (a, b) { return a + b; }, 0) / pb.length;
    s = 180 / med; // referência do jogo antigo: bases de 180 px
    avisos.push('Sem o quadrado "escala": usando bases de 180 px como referência.');
  }

  var mb = by.mundo.length ? caixa([by.mundo[0]]) : caixa(out.filter(function (o) { return o.fam !== 'escala'; }));
  var ox = mb.x0, oy = mb.y0, WW = (mb.x1 - mb.x0) * s, WH = (mb.y1 - mb.y0) * s;
  function G(p) { return [(p[0] - ox) * s, (p[1] - oy) * s]; }
  function gsub(sub) { return sub.pts.map(G); }

  // bases
  var pads = [];
  function pad(o, kind) {
    var c = caixa([o]), x1 = (c.x0 - ox) * s, x2 = (c.x1 - ox) * s, y = (c.y0 - oy) * s, h = (c.y1 - c.y0) * s;
    pads.push({ x1: x1, x2: x2, y: y, h: h, kind: kind });
  }
  by.saida.slice(0, 1).forEach(function (o) { pad(o, 'saida'); });
  by.base.slice().sort(function (a, b) { return caixa([a]).x0 - caixa([b]).x0; }).forEach(function (o) { pad(o, 'base'); });
  by.chegada.slice(0, 1).forEach(function (o) { pad(o, 'chegada'); });
  if (!by.chegada.length) avisos.push('Sem o objeto "chegada": a fase não pode ser vencida.');

  // sólidos
  var polys = [];
  function addPoly(P, tex, chao) {
    P = limpa(P); if (P.length < 3) return;
    if (area(P) < 0) P.reverse(); // tudo com a mesma orientação: o preenchimento vira união
    P.tex = tex || '';             // etiqueta de textura (superficie_gelo -> 'gelo')
    P.chao = !!chao;               // true = superficie ou base (usado pelo zoom da câmera)
    polys.push(P);
  }
  function linha(P, teto) {
    if (P[0][0] > P[P.length - 1][0]) P = P.slice().reverse();
    var a = P[0], b = P[P.length - 1], R = P.slice(), borda = teto ? -MARGEM : WH + MARGEM;
    R.unshift([-MARGEM, a[1]]); R.push([WW + MARGEM, b[1]]); R.push([WW + MARGEM, borda]); R.push([-MARGEM, borda]);
    return R;
  }
  ['superficie', 'teto'].forEach(function (f) {
    by[f].forEach(function (o) { o.subs.forEach(function (sub) {
      var P = gsub(sub); if (P.length < 2) return;
      addPoly(sub.closed ? P : linha(P, f === 'teto'), o.tag, f === 'superficie');
    }); });
  });
  by.obstaculo.forEach(function (o) { o.subs.forEach(function (sub) { addPoly(gsub(sub), o.tag); }); });
  pads.forEach(function (p) {
    addPoly([[p.x1, p.y], [p.x2, p.y], [p.x2, p.y + p.h + FOLGA_BASE * s], [p.x1, p.y + p.h + FOLGA_BASE * s]], '', true);
  });

  // linhas de zoom (não colidem e não são desenhadas)
  var zoom = [];
  by.zoom.forEach(function (o) { o.subs.forEach(function (sub) {
    var P = gsub(sub); if (sub.closed) P.push(P[0]);
    P = limpa(P); if (P.length < 2) return;
    if (P[0][0] > P[P.length - 1][0]) P.reverse();
    var n = o.num === '' ? 0 : parseInt(o.num, 10), dv = api.ZOOM_DIV[n];
    if (!dv) { avisos.push('Linha "zoom' + n + '" sem divisor definido (ZOOM_DIV): usando 1.'); dv = 1; }
    zoom.push({ pts: P, left: P[0], right: P[P.length - 1], div: dv });
  }); });

  // áreas de zoom fixo (não colidem e não são desenhadas)
  var areas = [];
  by.zoom_area.forEach(function (o) {
    var n = o.num === '' ? 0 : parseInt(o.num, 10), v = api.ZOOM_AREA[n];
    if (v === undefined) { avisos.push('Área "zoom_area' + (n || '') + '" sem valor em ZOOM_AREA: ignorada.'); return; }
    o.subs.forEach(function (sub) {
      var P = limpa(gsub(sub)); if (P.length < 3) return;
      var x0 = 1e30, y0 = 1e30, x1 = -1e30, y1 = -1e30;
      P.forEach(function (p) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
      areas.push({ pts: P, val: v, ar: Math.abs(area(P)), x0: x0, y0: y0, x1: x1, y1: y1 });
    });
  });
  areas.sort(function (a, b) { return a.ar - b.ar; }); // a menor primeiro: áreas internas vencem as externas

  var sa = pads[0];
  var lv = { WW: WW, WH: WH, scale: s, pads: pads, polys: polys, zoom: zoom, areas: areas, avisos: avisos,
             start: { x: (sa.x1 + sa.x2) / 2, y: sa.y - PES_Y } };
  campo(lv);
  return lv;
}

/* ---------- colisão: grade de ocupação + campo de distância com sinal ---------- */
var INF = 1e10;
function edt1(f, n, v, z, out) {
  var k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (var q = 1; q < n; q++) {
    var s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (q = 0; q < n; q++) { while (z[k + 1] < q) k++; var d = q - v[k]; out[q] = d * d + f[v[k]]; }
}
function edt(F, cols, rows) {
  var n = Math.max(cols, rows), f = new Float32Array(n), o = new Float32Array(n), v = new Int32Array(n), z = new Float32Array(n + 1), x, y;
  for (x = 0; x < cols; x++) { for (y = 0; y < rows; y++) f[y] = F[y * cols + x]; edt1(f, rows, v, z, o); for (y = 0; y < rows; y++) F[y * cols + x] = o[y]; }
  for (y = 0; y < rows; y++) { for (x = 0; x < cols; x++) f[x] = F[y * cols + x]; edt1(f, cols, v, z, o); for (x = 0; x < cols; x++) F[y * cols + x] = o[x]; }
}
function campo(lv) {
  var c = CELL;
  while ((lv.WW / c) * (lv.WH / c) > 4e6) c *= 1.5; // fases enormes: reduz a resolução
  var cols = Math.ceil(lv.WW / c), rows = Math.ceil(lv.WH / c), N = cols * rows;
  function raster(lista) {
    var occ = new Uint8Array(N);
    lista.forEach(function (P) {
      var y0 = 1e30, y1 = -1e30, i, j, k;
      P.forEach(function (p) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
      var j0 = Math.max(0, Math.floor(y0 / c)), j1 = Math.min(rows - 1, Math.ceil(y1 / c));
      for (j = j0; j <= j1; j++) {
        var y = (j + 0.5) * c, xs = [];
        for (i = 0; i < P.length; i++) {
          var a = P[i], b = P[(i + 1) % P.length];
          if ((a[1] <= y) !== (b[1] <= y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
        xs.sort(function (p, q) { return p - q; });
        for (k = 0; k + 1 < xs.length; k += 2) {
          var i0 = Math.max(0, Math.ceil(xs[k] / c - 0.5)), i1 = Math.min(cols - 1, Math.ceil(xs[k + 1] / c - 0.5) - 1);
          for (i = i0; i <= i1; i++) occ[j * cols + i] = 1;
        }
      }
    });
    return occ;
  }
  var occ = raster(lv.polys), occChao = raster(lv.polys.filter(function (P) { return P.chao; }));
  var Fi = new Float32Array(N), Fo = new Float32Array(N), sdf = new Float32Array(N), i;
  for (i = 0; i < N; i++) { if (occ[i]) { Fi[i] = INF; Fo[i] = 0; } else { Fi[i] = 0; Fo[i] = INF; } }
  edt(Fi, cols, rows); edt(Fo, cols, rows);
  for (i = 0; i < N; i++) sdf[i] = occ[i] ? -(Math.sqrt(Fi[i]) - 0.5) * c : (Math.sqrt(Fo[i]) - 0.5) * c;
  lv.grid = { c: c, cols: cols, rows: rows, occ: occ, occChao: occChao, sdf: sdf };
}

function sd(x, y) {
  var g = L.grid, c = g.c, cols = g.cols, rows = g.rows, s = g.sdf;
  var fx = x / c - 0.5, fy = y / c - 0.5, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
  var i1 = i + 1, j1 = j + 1;
  if (i < 0) i = 0; else if (i >= cols) i = cols - 1;
  if (i1 < 0) i1 = 0; else if (i1 >= cols) i1 = cols - 1;
  if (j < 0) j = 0; else if (j >= rows) j = rows - 1;
  if (j1 < 0) j1 = 0; else if (j1 >= rows) j1 = rows - 1;
  return (s[j * cols + i] * (1 - tx) + s[j * cols + i1] * tx) * (1 - ty) +
         (s[j1 * cols + i] * (1 - tx) + s[j1 * cols + i1] * tx) * ty;
}
var O = { d: 0, nx: 0, ny: -1 };
/* O ponto (x,y) está dentro de um sólido? Devolve {d: profundidade, nx,ny: normal para fora} ou null */
function hit(x, y) {
  if (y >= L.WH) { O.d = y - L.WH + 1; O.nx = 0; O.ny = -1; return O; } // piso de segurança
  var v = sd(x, y);
  if (v >= 0) return null;
  var e = L.grid.c, gx = sd(x + e, y) - sd(x - e, y), gy = sd(x, y + e) - sd(x, y - e), m = Math.sqrt(gx * gx + gy * gy);
  if (m < 1e-6) { gx = 0; gy = -1; m = 1; }
  O.d = -v; O.nx = gx / m; O.ny = gy / m;
  return O;
}
/* Altura (y) da primeira superfície sólida abaixo de (x,y0). Se já estiver dentro de sólido, devolve y0.
   soChao = true: ignora teto e obstáculos (só superficie e bases) — usado pelo zoom da câmera. */
function below(x, y0, soChao) {
  var g = L.grid, c = g.c, i = Math.floor(x / c), occ = soChao ? g.occChao : g.occ;
  if (i < 0 || i >= g.cols) return L.WH;
  var j = Math.floor(y0 / c); if (j < 0) j = 0;
  if (j >= g.rows) return L.WH;
  if (occ[j * g.cols + i]) return y0;
  for (j++; j < g.rows; j++) if (occ[j * g.cols + i]) return j * c;
  return L.WH;
}
function distLinha(Z, x, y) {
  var P = Z.pts, best = 1e30, achou = false;
  for (var i = 0; i + 1 < P.length; i++) {
    var a = P[i], b = P[i + 1];
    if ((a[0] <= x) !== (b[0] <= x)) {
      achou = true;
      var d = Math.abs(y - (a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0])));
      if (d < best) best = d;
    }
  }
  if (!achou) best = Math.min(Math.hypot(x - Z.left[0], y - Z.left[1]), Math.hypot(x - Z.right[0], y - Z.right[1]));
  return best;
}
/* Distância (px) até cada linha "zoom": [{d, div}, ...], ou null se a fase não tem linhas de zoom.
   d = vertical dentro da extensão da linha, em linha reta além das pontas.
   div = divisor do "Zoom máximo" daquela linha (zoom=1, zoom1=1.5, zoom2=2...). */
function zoomLines(x, y) {
  if (!L.zoom.length) return null;
  return L.zoom.map(function (Z) { return { d: distLinha(Z, x, y), div: Z.div }; });
}
/* Distância até a linha de zoom mais próxima (null se não houver) */
function zoomDist(x, y) {
  if (!L.zoom.length) return null;
  var best = 1e30;
  L.zoom.forEach(function (Z) { var d = distLinha(Z, x, y); if (d < best) best = d; });
  return best;
}
/* Valor de zoom fixo da área em que (x,y) está, ou null se não está em nenhuma zoom_area */
function zoomArea(x, y) {
  var A = L.areas;
  for (var k = 0; k < A.length; k++) {
    var a = A[k];
    if (x < a.x0 || x > a.x1 || y < a.y0 || y > a.y1) continue;
    var P = a.pts, dentro = false;
    for (var i = 0, j = P.length - 1; i < P.length; j = i++) {
      if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) dentro = !dentro;
    }
    if (dentro) return a.val;
  }
  return null;
}
/* Contorno das áreas de zoom (só para depuração: ?debug) */
function zoomAreaPath(ctx) {
  ctx.beginPath();
  L.areas.forEach(function (a) {
    ctx.moveTo(a.pts[0][0], a.pts[0][1]);
    for (var i = 1; i < a.pts.length; i++) ctx.lineTo(a.pts[i][0], a.pts[i][1]);
    ctx.closePath();
  });
}
/* Desenha as linhas de zoom (só para depuração: ?debug) */
function zoomPath(ctx) {
  ctx.beginPath();
  L.zoom.forEach(function (Z) {
    ctx.moveTo(Z.pts[0][0], Z.pts[0][1]);
    for (var i = 1; i < Z.pts.length; i++) ctx.lineTo(Z.pts[i][0], Z.pts[i][1]);
  });
}
/* Monta o contorno de todos os sólidos no contexto do canvas (para preencher com a textura) */
function tags() {
  var t = [''];
  L.polys.forEach(function (P) { if (t.indexOf(P.tex) < 0) t.push(P.tex); });
  return t;
}
/* tex omitido = todos os sólidos; tex = 'gelo' -> só os sólidos com essa etiqueta ('' = sem etiqueta) */
function path(ctx, tex) {
  ctx.beginPath();
  L.polys.forEach(function (P) {
    if (tex !== undefined && P.tex !== tex) return;
    ctx.moveTo(P[0][0], P[0][1]);
    for (var i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
    ctx.closePath();
  });
}

function load(url) {
  return fetch(url, { cache: 'no-store' }).then(function (r) {
    if (!r.ok) throw new Error('Não achei "' + url + '" (HTTP ' + r.status + ').');
    return r.text();
  }).then(function (t) {
    L = build(t); api.level = L;
    L.avisos.forEach(function (a) { console.warn('[fase] ' + a); });
    console.log('[fase] ' + url + ': ' + Math.round(L.WW) + '×' + Math.round(L.WH) + ' px, escala ' + L.scale.toFixed(3) +
                ', ' + L.pads.length + ' bases, ' + L.polys.length + ' sólidos');
    return L;
  });
}

var api = { load: load, build: build, hit: hit, below: below, path: path, tags: tags, zoomDist: zoomDist, zoomLines: zoomLines, zoomPath: zoomPath, zoomArea: zoomArea, zoomAreaPath: zoomAreaPath, ZOOM_DIV: ZOOM_DIV, ZOOM_AREA: ZOOM_AREA, level: null,
            _use: function (lv) { L = lv; api.level = lv; } };
var root = typeof window !== 'undefined' ? window : globalThis;
root.Fase = api;
if (typeof module !== 'undefined') module.exports = api;
})();
