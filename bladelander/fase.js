/* fase.js — carrega fases desenhadas em SVG para o Lunar Lander

   Nomes reconhecidos (id do objeto ou nome da camada; aceita sufixo numérico:
   base1, superficie_2, obstaculo-3 ...):

     mundo       retângulo com o tamanho total da fase
     escala      quadrado com o tamanho de UMA nave (o centro dele é o centro da nave)
     jato        caixa do bocal do jato principal (embaixo). O topo-centro é o pivô: o bocal gira em torno dele com as
                 setas, e o fogo sai da base-centro. Com uma forma bem pequena (um ponto) é só a posição do fogo.
                 Medido a partir do centro do quadrado "escala" (precisa dele; sem a camada valem os sliders do jogo).
                 Imagem opcional na pasta da fase: jato.png (preenche a caixa, desenhada por cima da nave).
     jato_left   caixa do bocal lateral esquerdo (sopra para a esquerda; o fogo sai da borda esquerda). Imagem: jato_left.png
     jato_right  caixa do bocal lateral direito (o fogo sai da borda direita). Imagem: jato_right.png
                 Se só um dos dois laterais existir, o outro é o espelho dele (imagem espelhada também).
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

     parallax1..parallax4  retângulos que marcam a faixa vertical de cada camada de fundo (parallax4 = a mais
                 distante, parallax1 = a mais próxima). O topo do retângulo é onde fica o topo da imagem
                 parallax{n}.png ao iniciar a fase; a ALTURA do retângulo é a altura da imagem (a largura
                 acompanha a proporção e a imagem se repete na horizontal se "Repetir" estiver ligado no painel). Sem repetir, a imagem aparece uma vez, com o canto esquerdo no x do retângulo (útil para objetos: lua, planeta).
                 O quanto cada camada acompanha a câmera vem dos sliders (salvos por fase).

   Onde ficam as imagens: na pasta da própria fase (a mesma do SVG).

   Imagens de cenário: qualquer camada chamada objeto_tras_xxx (atrás da nave) ou objeto_frente_xxx
   (na frente da nave) desenha o PNG de mesmo nome (objeto_tras_xxx.png) no lugar e no tamanho da forma
   desenhada. Se a forma for um retângulo girado, a imagem gira junto. Nomes em minúsculas, sem acento.

   Objetos com colisão e física: camada objeto_colisao_xxx (retângulo = caixa; círculo = bola que rola).
   O PNG objeto_colisao_xxx.png é desenhado no corpo. O peso vem da tabela PESO (relativo à nave).
   O corpo nasce onde você desenhar e cai, bate no chão, nos sólidos da fase, na nave e em outros corpos.

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
var NOMES = ['mundo', 'escala', 'saida', 'base', 'chegada', 'superficie', 'teto', 'obstaculo', 'zoom_area', 'zoom', 'parallax', 'jato']; // zoom_area vem antes de zoom
var IGNORA = /^(defs|clippath|mask|style|title|desc|metadata|symbol|lineargradient|radialgradient|pattern|filter)$/;

var L = null; // fase atual

/* Objetos com colisão e física: o PESO é relativo à nave (nave = 1). Pesado = difícil de mover.
   A chave é o nome depois de objeto_colisao_ (objeto_colisao_caixa -> 'caixa'). Duplicados (caixa2) usam
   a chave sem número. Sem chave na tabela vale 'padrao'. Para criar outros: acrescente aqui ou no HTML
   (Fase.PESO.pedra=8). Valores abaixo de 0.4 são elevados a 0.4 (mais leve que isso fica instável). */
var PESO = { padrao: 1, caixa: 0.5, pedra: 8 };
var PESO_MIN = 0.4;
/* Atrito dos corpos com o chão, em relação ao da nave (1 = igual). Menor = desliza e é empurrado com mais facilidade. */
var ATRITO_CORPO = 0.5;
/* Contorno da nave (coordenadas locais) usado nas batidas com objetos */
var HULL = [[-16, 17], [16, 17], [10, 8], [9, -8], [0, -14], [-9, -8], [-10, 8]];

/* Linhas de zoom: o NÚMERO no nome escolhe por quanto o "Zoom máximo" é dividido perto dela.
   zoom = 1 (normal), zoom1 = 1.5, zoom2 = 2. Para criar mais, acrescente linhas aqui (ou no HTML: Fase.ZOOM_DIV[3]=3). */
var ZOOM_DIV = { 0: 1, 1: 1.5, 2: 2 };

/* Áreas de zoom fixo: o NÚMERO no nome escolhe o valor do zoom dentro da área.
   zoom_area = 2.5, zoom_area1 = 1, zoom_area2 = 0.6 (exemplos: troque pelos seus valores).
   Para criar mais, acrescente linhas aqui (ou no HTML: Fase.ZOOM_AREA[3]=0.4). */
var ZOOM_AREA = { 0: 2.5, 1: 1, 2: 0.6 };

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
    if (/^objeto[\s_\-]+colisao[\s_\-]+\S/.test(s))
      return { name: 'corpo', tag: '', num: '', arquivo: s.replace(/\s+/g, '_').replace(/_+$/, '') };
    var mo = /^objeto[\s_\-]+(frente|tras)[\s_\-]+\S/.exec(s);
    if (mo) return { name: 'objeto', tag: '', num: '', camada: mo[1],
                     arquivo: s.replace(/\s+/g, '_').replace(/_+$/, '') };
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
    if (f) { var o = { fam: f.name, tag: f.tag, num: f.num, camada: f.camada, arquivo: f.arquivo, subs: [] }; coletar(k, m, o); out.push(o); }
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
/* Se os 4 pontos formam um retângulo (possivelmente girado), devolve centro, tamanho e ângulo */
function retangulo(P) {
  if (P.length !== 4) return null;
  var a = P[0], b = P[1], c = P[2], d = P[3];
  var ux = b[0] - a[0], uy = b[1] - a[1], vx = d[0] - a[0], vy = d[1] - a[1];
  var lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
  if (lu < 1e-6 || lv < 1e-6) return null;
  if (Math.abs(ux * vx + uy * vy) > 1e-3 * lu * lv) return null;
  if (Math.hypot(c[0] - (b[0] + d[0] - a[0]), c[1] - (b[1] + d[1] - a[1])) > 1e-3 * (lu + lv)) return null;
  return { cx: (a[0] + c[0]) / 2, cy: (a[1] + c[1]) / 2, w: lu, h: lv, ang: Math.atan2(uy, ux) };
}
function area(P) { var s = 0; for (var i = 0, n = P.length; i < n; i++) { var a = P[i], b = P[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
function limpa(P) { var R = []; P.forEach(function (p) { var q = R[R.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.01) R.push(p); }); return R; }

function circulo(P) {
  var cx = 0, cy = 0, i;
  P.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= P.length; cy /= P.length;
  var r = 0; P.forEach(function (p) { r += Math.hypot(p[0] - cx, p[1] - cy); }); r /= P.length;
  if (r < 1e-6) return null;
  for (i = 0; i < P.length; i++) if (Math.abs(Math.hypot(P[i][0] - cx, P[i][1] - cy) - r) > 0.03 * r) return null;
  return { cx: cx, cy: cy, r: r };
}

/* ---------- construir a fase ---------- */
function build(text) {
  var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('O arquivo SVG não pôde ser lido (XML inválido).');
  var out = [];
  percorrer(doc.documentElement, [1, 0, 0, 1, 0, 0], out);
  var by = { objeto: [], corpo: [] }; NOMES.forEach(function (n) { by[n] = []; });
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

  var mb = by.mundo.length ? caixa([by.mundo[0]]) : caixa(out.filter(function (o) { return o.fam !== 'escala' && o.fam !== 'parallax'; }));
  var ox = mb.x0, oy = mb.y0, WW = (mb.x1 - mb.x0) * s, WH = (mb.y1 - mb.y0) * s;
    function G(p) { return [(p[0] - ox) * s, (p[1] - oy) * s]; }
  function gsub(sub) { return sub.pts.map(G); }

  // posição inicial = centro do quadrado "escala"
  var posEscala = null;
  if (by.escala.length) {
    var ee = caixa([by.escala[0]]);
    posEscala = G([(ee.x0 + ee.x1) / 2, (ee.y0 + ee.y1) / 2]);
  }
  // jatos (jato, jato_left, jato_right): caixa em px do jogo, relativa ao centro da nave (centro do quadrado "escala")
  var jatos = {};
  by.jato.forEach(function (o) {
    var t = (o.tag || '').toLowerCase();
    var k = /^(left|esquerda|esq|l)$/.test(t) ? 'left' : /^(right|direita|dir|r)$/.test(t) ? 'right' : t === '' ? 'main' : null;
    if (!k) { avisos.push('Camada "jato_' + o.tag + '" ignorada: use jato, jato_left ou jato_right.'); return; }
    if (!posEscala) { avisos.push('A camada "jato" precisa do quadrado "escala" como referência.'); return; }
    var c = caixa([o]), a = G([c.x0, c.y0]), b = G([c.x1, c.y1]);
    jatos[k] = { x0: a[0] - posEscala[0], y0: a[1] - posEscala[1], x1: b[0] - posEscala[0], y1: b[1] - posEscala[1] };   // caixa, relativa ao centro da nave
  });
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

  // imagens de cenário (objeto_xxx, frente_xxx)
  var objetos = [];
  by.objeto.forEach(function (o) {
    var g = null;
    if (o.subs.length === 1) { var P = limpa(gsub(o.subs[0])); g = retangulo(P); }
    if (!g) {
      var bb = { x0: 1e30, y0: 1e30, x1: -1e30, y1: -1e30 };
      o.subs.forEach(function (sub) { gsub(sub).forEach(function (p) {
        if (p[0] < bb.x0) bb.x0 = p[0]; if (p[0] > bb.x1) bb.x1 = p[0]; if (p[1] < bb.y0) bb.y0 = p[1]; if (p[1] > bb.y1) bb.y1 = p[1];
      }); });
      g = { cx: (bb.x0 + bb.x1) / 2, cy: (bb.y0 + bb.y1) / 2, w: bb.x1 - bb.x0, h: bb.y1 - bb.y0, ang: 0 };
    }
    var arq = o.arquivo, cand = [arq], sem = arq.replace(/[\s_\-]*\d+$/, '');
    if (sem !== arq && /^objeto[\s_\-]+(frente|tras)[\s_\-]+\S/.test(sem)) cand.push(sem); // objeto_pedra2 -> tenta objeto_pedra
    g.arquivos = cand; g.camada = o.camada; g.img = null;
    objetos.push(g);
  });

  // corpos com colisão e física (objeto_colisao_xxx)
  var corpos = [];
  by.corpo.forEach(function (o) {
    var P = o.subs.length === 1 ? limpa(gsub(o.subs[0])) : null, g = P && retangulo(P), cr = null;
    if (!g && P && P.length >= 12) cr = circulo(P);
    if (!g && !cr) {
      var bb = { x0: 1e30, y0: 1e30, x1: -1e30, y1: -1e30 };
      o.subs.forEach(function (sub) { gsub(sub).forEach(function (p) {
        if (p[0] < bb.x0) bb.x0 = p[0]; if (p[0] > bb.x1) bb.x1 = p[0]; if (p[1] < bb.y0) bb.y0 = p[1]; if (p[1] > bb.y1) bb.y1 = p[1];
      }); });
      g = { cx: (bb.x0 + bb.x1) / 2, cy: (bb.y0 + bb.y1) / 2, w: bb.x1 - bb.x0, h: bb.y1 - bb.y0, ang: 0 };
    }
    var chave = o.arquivo.replace(/^objeto_colisao_/, '').replace(/[\s\-]+/g, '_');
    var arqs = [o.arquivo], sem = o.arquivo.replace(/[\s_\-]*\d+$/, '');
    if (sem !== o.arquivo && /^objeto[\s_\-]+colisao[\s_\-]+\S/.test(sem)) arqs.push(sem);
    corpos.push(criaCorpo(cr ? { circ: true, cx: cr.cx, cy: cr.cy, r: cr.r } : g, pesoDe(chave), arqs));
  });

  // faixas das camadas de parallax (parallax1..4): {x, y, w, h} em px do jogo
  var par = [];
  by.parallax.forEach(function (o) {
    var n = o.num === '' ? 0 : parseInt(o.num, 10);
    if (!(n >= 1 && n <= 4)) { avisos.push('Camada "parallax' + o.num + '" ignorada: use parallax1 a parallax4.'); return; }
    var c = caixa([o]), a = G([c.x0, c.y0]), b = G([c.x1, c.y1]);
    par[n] = { x: a[0], y: a[1], w: b[0] - a[0], h: b[1] - a[1] };
  });

  var sa = pads[0];
  var lv = { WW: WW, WH: WH, scale: s, pads: pads, polys: polys, zoom: zoom, areas: areas, parallax: par, jatos: jatos, objetos: objetos, corpos: corpos, avisos: avisos,
             start: posEscala
               ? { x: posEscala[0], y: posEscala[1] }
               : { x: (sa.x1 + sa.x2) / 2, y: sa.y - PES_Y } };
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
var ON = { d: 0, nx: 0, ny: -1 };
/* d = distância com sinal até o sólido (negativa dentro); (nx,ny) = direção para longe do sólido */
function distNormal(x, y) {
  if (y >= L.WH) { ON.d = -(y - L.WH + 1); ON.nx = 0; ON.ny = -1; return ON; } // piso de segurança
  var e = L.grid.c, gx = sd(x + e, y) - sd(x - e, y), gy = sd(x, y + e) - sd(x, y - e), m = Math.sqrt(gx * gx + gy * gy);
  if (m < 1e-6) { gx = 0; gy = -1; m = 1; }
  ON.d = sd(x, y); ON.nx = gx / m; ON.ny = gy / m;
  return ON;
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

/* ---------- corpos com física ---------- */
function pesoDe(chave) {
  var T = api.PESO, sem = chave.replace(/_*\d+$/, ''), v = T[chave];
  if (v === undefined) v = T[sem];
  if (v === undefined) v = T.padrao;
  if (!(v > 0)) v = 1;
  return Math.max(PESO_MIN, v);
}
function reiniciaCorpo(b) { b.x = b.x0; b.y = b.y0; b.th = b.th0; b.vx = b.vy = b.w = 0; }
function criaCorpo(g, m, arqs) {
  var b = { m: m, invM: 1 / m, arquivos: arqs, img: null, ax: 0, ay: 0, aw: 0, c: 1, s: 0, amostras: [] }, k, n;
  b.x0 = g.cx; b.y0 = g.cy;
  if (g.circ) {
    b.circ = true; b.R = g.r; b.W = b.H = 2 * g.r; b.th0 = 0; b.Iu = 1.5 * g.r * g.r / 2;
    n = Math.max(12, Math.min(48, Math.ceil(2 * Math.PI * g.r / 10)));
    for (k = 0; k < n; k++) b.amostras.push([g.r * Math.cos(2 * Math.PI * k / n), g.r * Math.sin(2 * Math.PI * k / n)]);
  } else {
    b.W = g.w; b.H = g.h; b.hw = g.w / 2; b.hh = g.h / 2; b.th0 = g.ang; b.Iu = 1.5 * (g.w * g.w + g.h * g.h) / 12;
    var q = [[-b.hw, -b.hh], [b.hw, -b.hh], [b.hw, b.hh], [-b.hw, b.hh]];
    for (var e = 0; e < 4; e++) {
      var A = q[e], B = q[(e + 1) % 4], len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      n = Math.max(1, Math.ceil(len / 16));
      for (k = 0; k < n; k++) b.amostras.push([A[0] + (B[0] - A[0]) * k / n, A[1] + (B[1] - A[1]) * k / n]);
    }
  }
  b.rad = Math.hypot(b.W, b.H) / 2;
  reiniciaCorpo(b);
  return b;
}
function resetCorpos() { if (L) L.corpos.forEach(reiniciaCorpo); }

var SB = { x: 0, y: 0, vx: 0, vy: 0, w: 0, th: 0, c: 1, s: 0, invM: 1, Iu: 250, ax: 0, ay: 0, aw: 0 }; // a nave, vista como corpo
var O2 = { pen: 0, nx: 0, ny: -1 };
var RO = { ax: 0, ay: 0, aw: 0, n: 0 };
var PT = { K: 0, C: 0, KF: 0, MU: 0 }; // constantes de contato corpo x terreno
var hullArea = 0;
/* Troca o contorno da nave (coordenadas locais, em ordem): usado pelo jogo quando a nave da fase muda. */
function setCasco(arr) {
  HULL = arr; hullArea = 0;
  for (var i = 0; i < HULL.length; i++) { var a = HULL[i], b = HULL[(i + 1) % HULL.length]; hullArea += a[0] * b[1] - b[0] * a[1]; }
}
setCasco(HULL);

function aplica(b, rx, ry, Fx, Fy, sc) { b.ax += Fx * sc; b.ay += Fy * sc; b.aw += (rx * Fy - ry * Fx) * sc / b.Iu; }
/* Ponto (px,py) do corpo A entrou em B (ou no terreno, se B = null). (nx,ny) = normal para fora de B, rumo a A. */
function contato(A, B, px, py, pen, nx, ny, P) {
  var rax = px - A.x, ray = py - A.y, vax = A.vx - A.w * ray, vay = A.vy + A.w * rax, rbx = 0, rby = 0, vbx = 0, vby = 0;
  if (B) { rbx = px - B.x; rby = py - B.y; vbx = B.vx - B.w * rby; vby = B.vy + B.w * rbx; }
  var rvx = vax - vbx, rvy = vay - vby, vn = rvx * nx + rvy * ny, vt = -rvx * ny + rvy * nx;
  var fn = Math.max(0, P.K * pen - P.C * vn), lim = P.MU * fn, ft = -Math.max(-lim, Math.min(lim, P.KF * vt));
  var m = B ? 1 / (A.invM + B.invM) : 1; // massa reduzida: o contato se comporta igual para qualquer peso
  var Fx = m * (fn * nx - ft * ny), Fy = m * (fn * ny + ft * nx);
  aplica(A, rax, ray, Fx, Fy, B ? A.invM : 1);
  if (B) aplica(B, rbx, rby, -Fx, -Fy, B.invM);
}
function dentro(B, px, py) { // O2 = profundidade e normal (para fora de B) se o ponto está dentro
  var dx = px - B.x, dy = py - B.y;
  if (B.circ) {
    var d = Math.hypot(dx, dy); if (d >= B.R) return false;
    O2.pen = B.R - d; if (d > 1e-6) { O2.nx = dx / d; O2.ny = dy / d; } else { O2.nx = 0; O2.ny = -1; }
    return true;
  }
  var lx = B.c * dx + B.s * dy, ly = -B.s * dx + B.c * dy, ex = B.hw - Math.abs(lx), ey = B.hh - Math.abs(ly);
  if (ex <= 0 || ey <= 0) return false;
  var nlx = 0, nly = 0;
  if (ex < ey) { O2.pen = ex; nlx = lx < 0 ? -1 : 1; } else { O2.pen = ey; nly = ly < 0 ? -1 : 1; }
  O2.nx = B.c * nlx - B.s * nly; O2.ny = B.s * nlx + B.c * nly;
  return true;
}
function dentroCasco(lx, ly) { // ponto em coordenadas locais da nave
  var n = HULL.length, dentroF = false, best = 1e30, bx = 0, by = 0;
  for (var i = 0, j = n - 1; i < n; j = i++) {
    var a = HULL[j], b = HULL[i], ex = b[0] - a[0], ey = b[1] - a[1];
    if ((a[1] > ly) !== (b[1] > ly) && lx < ex * (ly - a[1]) / (b[1] - a[1]) + a[0]) dentroF = !dentroF;
    var t = Math.max(0, Math.min(1, ((lx - a[0]) * ex + (ly - a[1]) * ey) / (ex * ex + ey * ey)));
    var d = Math.hypot(lx - (a[0] + t * ex), ly - (a[1] + t * ey));
    if (d < best) { best = d; var l = Math.hypot(ex, ey); bx = hullArea > 0 ? ey / l : -ey / l; by = hullArea > 0 ? -ex / l : ex / l; }
  }
  if (!dentroF) return false;
  O2.pen = best; O2.nx = bx; O2.ny = by;
  return true;
}
/* Um passo (h segundos) da física dos corpos. Devolve a reação sobre a nave: {ax, ay, aw, n}. */
function fisica(h, ship, P) {
  RO.ax = RO.ay = RO.aw = 0; RO.n = 0;
  var C = L.corpos; if (!C.length) return RO;
  var i, j, k, b, p, px, py, q;
  SB.x = ship.x; SB.y = ship.y; SB.vx = ship.vx; SB.vy = ship.vy; SB.w = ship.w; SB.th = ship.th;
  SB.c = Math.cos(ship.th); SB.s = Math.sin(ship.th); SB.Iu = P.I; SB.ax = SB.ay = SB.aw = 0;
  for (i = 0; i < C.length; i++) { b = C[i]; b.ax = 0; b.ay = P.g; b.aw = 0; b.c = Math.cos(b.th); b.s = Math.sin(b.th); }
  PT.K = P.K; PT.C = P.C; PT.KF = P.KF; PT.MU = P.MU * api.ATRITO_CORPO;
  // 1) corpos x terreno (aceleração independe do peso, como na nave)
  for (i = 0; i < C.length; i++) { b = C[i];
    if (b.circ) { // disco: usa a distância ao terreno no centro (rola de forma suave, sem "facetas")
      q = distNormal(b.x, b.y);
      if (q.d < b.R) contato(b, null, b.x - q.nx * b.R, b.y - q.ny * b.R, b.R - q.d, q.nx, q.ny, PT);
      continue;
    }
    for (k = 0; k < b.amostras.length; k++) {
      p = b.amostras[k]; px = b.x + b.c * p[0] - b.s * p[1]; py = b.y + b.s * p[0] + b.c * p[1];
      q = hit(px, py); if (q) contato(b, null, px, py, q.d, q.nx, q.ny, PT);
    }
  }
  // 2) nave x corpos
  for (i = 0; i < C.length; i++) { b = C[i];
    if (Math.hypot(b.x - SB.x, b.y - SB.y) > b.rad + 40) continue;
    for (k = 0; k < P.PTS.length; k++) {                 // pontos da nave dentro do corpo
      p = P.PTS[k]; px = SB.x + SB.c * p[0] - SB.s * p[1]; py = SB.y + SB.s * p[0] + SB.c * p[1];
      if (dentro(b, px, py)) { contato(SB, b, px, py, O2.pen, O2.nx, O2.ny, P); RO.n++; }
    }
    for (k = 0; k < b.amostras.length; k++) {             // pontos do corpo dentro do casco da nave
      p = b.amostras[k]; px = b.x + b.c * p[0] - b.s * p[1]; py = b.y + b.s * p[0] + b.c * p[1];
      var dx = px - SB.x, dy = py - SB.y;
      if (dentroCasco(SB.c * dx + SB.s * dy, -SB.s * dx + SB.c * dy)) {
        var nx = SB.c * O2.nx - SB.s * O2.ny, ny = SB.s * O2.nx + SB.c * O2.ny;
        contato(b, SB, px, py, O2.pen, nx, ny, P); RO.n++;
      }
    }
  }
  // 3) corpo x corpo
  for (i = 0; i < C.length; i++) for (j = i + 1; j < C.length; j++) {
    var A = C[i], B = C[j];
    if (Math.hypot(A.x - B.x, A.y - B.y) > A.rad + B.rad) continue;
    for (k = 0; k < A.amostras.length; k++) {
      p = A.amostras[k]; px = A.x + A.c * p[0] - A.s * p[1]; py = A.y + A.s * p[0] + A.c * p[1];
      if (dentro(B, px, py)) contato(A, B, px, py, O2.pen, O2.nx, O2.ny, P);
    }
    for (k = 0; k < B.amostras.length; k++) {
      p = B.amostras[k]; px = B.x + B.c * p[0] - B.s * p[1]; py = B.y + B.s * p[0] + B.c * p[1];
      if (dentro(A, px, py)) contato(B, A, px, py, O2.pen, O2.nx, O2.ny, P);
    }
  }
  // 4) integrar
  for (i = 0; i < C.length; i++) { b = C[i];
    b.aw -= 0.1 * b.w;
    b.vx += b.ax * h; b.vy += b.ay * h; b.w += b.aw * h;
    var sp = Math.hypot(b.vx, b.vy); if (sp > 4000) { b.vx *= 4000 / sp; b.vy *= 4000 / sp; }
    b.x += b.vx * h; b.y += b.vy * h; b.th += b.w * h;
    if (b.x < b.rad) { b.x = b.rad; if (b.vx < 0) b.vx = 0; }
    if (b.x > L.WW - b.rad) { b.x = L.WW - b.rad; if (b.vx > 0) b.vx = 0; }
  }
  RO.ax = SB.ax; RO.ay = SB.ay; RO.aw = SB.aw;
  return RO;
}
/* Desenha as imagens dos corpos (chamar logo antes de desenhar a nave) */
function drawCorpos(ctx) {
  L.corpos.forEach(function (b) {
    if (!b.img || !b.img.complete || !b.img.naturalWidth) return;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.th);
    ctx.drawImage(b.img, -b.W / 2, -b.H / 2, b.W, b.H);
    ctx.restore();
  });
}
/* Contorno dos corpos (só para depuração: ?debug) */
function corposPath(ctx) {
  ctx.beginPath();
  L.corpos.forEach(function (b) {
    if (b.circ) { ctx.moveTo(b.x + b.R, b.y); ctx.arc(b.x, b.y, b.R, 0, 2 * Math.PI); return; }
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.th); ctx.rect(-b.hw, -b.hh, b.W, b.H); ctx.restore();
  });
}

/* Procura o PNG na pasta da fase (a mesma do SVG); api.IMG_DIRS_EXTRA pode listar pastas extras de reserva (vazio por padrão). */
function carregaImagem(o, cache, dir) {
  var k = o.arquivos.join('|');
  if (cache[k]) { o.img = cache[k]; return; }
  var dirs = [], urls = [];
  [dir || ''].concat(api.IMG_DIRS_EXTRA).forEach(function (d) { if (dirs.indexOf(d) < 0) dirs.push(d); });
  dirs.forEach(function (d) { o.arquivos.forEach(function (a) { urls.push(d + a + '.png'); }); });
  var img = new Image(), i = 0;
  img.onerror = function () {
    if (++i < urls.length) img.src = urls[i];
    else console.warn('[fase] imagem não encontrada. Procurei: ' + urls.join(' | '));
  };
  img.src = urls[0];
  o.img = cache[k] = img;
}
/* Desenha as imagens de cenário de uma camada: 'tras' (objeto_tras_xxx) ou 'frente' (objeto_frente_xxx) */
function drawObjetos(ctx, camada) {
  L.objetos.forEach(function (o) {
    if (o.camada !== camada || !o.img || !o.img.complete || !o.img.naturalWidth) return;
    ctx.save(); ctx.translate(o.cx, o.cy); ctx.rotate(o.ang);
    ctx.drawImage(o.img, -o.w / 2, -o.h / 2, o.w, o.h);
    ctx.restore();
  });
}

function load(url) {
  return fetch(url, { cache: 'no-store' }).then(function (r) {
    if (!r.ok) throw new Error('Não achei "' + url + '" (HTTP ' + r.status + ').');
    return r.text();
  }).then(function (t) {
    L = build(t); api.level = L;
    L.dir = url.indexOf('/') >= 0 ? url.slice(0, url.lastIndexOf('/') + 1) : '';   // pasta da fase (onde está o SVG)
    var cache = {};
    L.objetos.forEach(function (o) { carregaImagem(o, cache, L.dir); });
    L.corpos.forEach(function (o) { carregaImagem(o, cache, L.dir); });
    L.avisos.forEach(function (a) { console.warn('[fase] ' + a); });
    console.log('[fase] ' + url + ': ' + Math.round(L.WW) + '×' + Math.round(L.WH) + ' px, escala ' + L.scale.toFixed(3) +
                ', ' + L.pads.length + ' bases, ' + L.polys.length + ' sólidos');
    return L;
  });
}

var api = { load: load, build: build, hit: hit, below: below, path: path, tags: tags, zoomDist: zoomDist, zoomLines: zoomLines, zoomPath: zoomPath, zoomArea: zoomArea, zoomAreaPath: zoomAreaPath, drawObjetos: drawObjetos, fisica: fisica, drawCorpos: drawCorpos, corposPath: corposPath, resetCorpos: resetCorpos, PESO: PESO, ATRITO_CORPO: ATRITO_CORPO, ZOOM_DIV: ZOOM_DIV, ZOOM_AREA: ZOOM_AREA, setCasco: setCasco, IMG_DIRS_EXTRA: [], level: null,
            _use: function (lv) { L = lv; api.level = lv; } };
var root = typeof window !== 'undefined' ? window : globalThis;
root.Fase = api;
if (typeof module !== 'undefined') module.exports = api;
})();