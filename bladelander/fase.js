/* fase.js — carrega fases desenhadas em SVG para o Lunar Lander

   Nomes reconhecidos (id do objeto ou nome da camada; aceita sufixo numérico:
   base1, superficie_2, obstaculo-3 ...):

     mundo       retângulo com o tamanho total da fase
     escala      contorno da NAVE desenhado em polígono (colide por esse contorno, como os objeto_colisao).
                 Desenhe a nave em pé, como ela fica com inclinação 0. A LARGURA do desenho vale NAVE_PX (32 px) e define
                 a escala da fase; o centro da caixa que envolve o desenho é o centro da nave (e o ponto de saída).
                 Um quadrado simples também vale. Se houver uma imagem dentro da camada, ela vira a arte da nave;
                 sem imagem, nave.png é esticado na caixa do desenho.
     jato        caixa do bocal do jato principal (embaixo). O topo-centro é o pivô: o bocal gira em torno dele com as
                 setas, e o fogo sai da base-centro. Com uma forma bem pequena (um ponto) é só a posição do fogo.
                 Medido a partir do centro do quadrado "escala" (precisa dele; sem a camada valem os sliders do jogo).
                 Imagem opcional na pasta da fase: jato.png (preenche a caixa, desenhada por cima da nave).
     jato_left   caixa do bocal lateral esquerdo (sopra para a esquerda; o fogo sai da borda esquerda). Imagem: jato_left.png
     jato_right  caixa do bocal lateral direito (o fogo sai da borda direita). Imagem: jato_right.png
                 Se só um dos dois laterais existir, o outro é o espelho dele (imagem espelhada também).
     centro      (dentro da camada "escala") ponto que marca o centro de gravidade da nave: o centro da caixa dela vira a origem da nave.
     ponto       (dentro da camada "escala", quantos quiser) pino da nave, ex: o braço da Starship. O centro da caixa de cada um é um ponto
                 de contato que NÃO colide com superficie/obstaculo/corpos: só com o braço "chegada_ponto".
     chegada_ponto  braço da torre (forma fechada; várias formas valem: chegada_ponto, chegada_ponto2...). Só os "ponto" da nave encostam nele;
                 o resto da nave o atravessa. Com ele a fase só é vencida com TODOS os "ponto" apoiados no braço. Faça o braço com pelo menos
                 uns 6 px (do jogo) de espessura. A "chegada" comum, se existir, vira uma base normal.
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

     parallax1..parallax4  (e parallaxN_nome, ex: parallax2_casa, com imagem parallax2_casa.webp e os mesmos ajustes do parallax 2;
                 camadas duplicadas, ex: parallax2_casa2, parallax2_casa3, usam a mesma imagem parallax2_casa)
                 formas que marcam onde fica cada camada de fundo (parallax4 = a mais distante, parallax1 = a mais próxima).
                 Retângulo = faixa simples: o topo é o topo da imagem e a ALTURA é a altura da imagem (a largura acompanha a
                 proporção; a imagem se repete na horizontal se "Repetir" estiver ligado no painel; sem repetir aparece uma vez,
                 com o canto esquerdo no x do retângulo: útil para objetos como a lua).
                 Qualquer OUTRA forma (polígono, curva, círculo) recorta a camada: a imagem só aparece dentro do desenho, como na
                 superficie. Com "Textura" ligada no painel, a imagem é ladrilhada dentro da forma; com "Repetir", a forma se
                 repete lado a lado (a cada largura dela).
                 O quanto cada camada acompanha a câmera vem dos sliders (salvos por fase).

   Onde ficam as imagens: na pasta da própria fase (a mesma do SVG).

   Imagens de cenário: qualquer camada chamada objeto_tras_xxx (atrás da nave) ou objeto_frente_xxx
   (na frente da nave) desenha o PNG de mesmo nome (objeto_tras_xxx.png) no lugar e no tamanho da forma
   desenhada. Se a forma for um retângulo girado, a imagem gira junto. Nomes em minúsculas, sem acento.

   Objetos com colisão e física: camada objeto_colisao_xxx (retângulo = caixa; círculo = bola que rola;
   qualquer outra forma fechada, como polígono ou desenho livre, colide pelo contorno exato, côncavo ou convexo).
   Nas formas livres o PNG é esticado na caixa que envolve o desenho: recorte o PNG nessa caixa.
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
var NOMES = ['mundo', 'escala', 'saida', 'base', 'chegada', 'superficie', 'teto', 'obstaculo', 'zoom_area', 'zoom', 'parallax', 'jato', 'centro', 'ponto']; // zoom_area vem antes de zoom
var IGNORA = /^(defs|clippath|mask|style|title|desc|metadata|symbol|lineargradient|radialgradient|pattern|filter)$/;

var L = null; // fase atual
var DOC = null;
/* Objetos com colisão e física: o PESO é relativo à nave (nave = 1). Pesado = difícil de mover.
   A chave é o nome depois de objeto_colisao_ (objeto_colisao_caixa -> 'caixa'). Duplicados (caixa2) usam
   a chave sem número. Sem chave na tabela vale 'padrao'. Para criar outros: acrescente aqui ou no HTML
   (Fase.PESO.pedra=8). Valores abaixo de 0.4 são elevados a 0.4 (mais leve que isso fica instável). */
var PESO = { padrao: 1, caixa: 0.01, pedra: 8 };
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
    var ma = /^animacao[\s_\-]+(frente|tras)[\s_\-]+\S/.exec(s);
    if (ma) return { name: 'animacao', tag: '', num: '', camada: ma[1],
                     arquivo: s.replace(/\s+/g, '_').replace(/_+$/, '') };
    for (var j = 0; j < RES.length; j++) { var m = RES[j][1].exec(s); if (m) return { name: RES[j][0], tag: m[2] || '', num: m[1] || m[3] || '' }; }
  }
  return null;
}
function coletar(el, M, o) {
  var subs = shapeSubs(el);
  if (o.imgs) { var ir = imagemRect(el, M); if (ir) o.imgs.push(ir); }   // imagem colocada dentro da camada (ex: a arte da nave)
  if (subs) subs.forEach(function (s) { o.subs.push({ closed: s.closed, pts: s.pts.map(function (p) { return ap(M, p); }) }); });
  kids(el).forEach(function (k) {
    if (IGNORA.test(tag(k))) return;
    var m = mul(M, T(k));
    if (o.fam === 'escala') {                                   // camada "centro" dentro da "escala": não faz parte do contorno
      var f = familia(k);
      if (f && (f.name === 'centro' || f.name === 'ponto')) { var c = { fam: f.name, tag: f.tag, num: f.num, subs: [], imgs: null }; coletar(k, m, c); (o.centros = o.centros || []).push(c); return; }
    }
    coletar(k, m, o);
  });
}
function percorrer(el, M, out) {
  kids(el).forEach(function (k) {
    if (IGNORA.test(tag(k))) return;
    var m = mul(M, T(k)), f = familia(k);
    if (f) { var o = { fam: f.name, tag: f.tag, num: f.num, camada: f.camada, arquivo: f.arquivo, subs: [], imgs: []}; coletar(k, m, o); out.push(o); (o.centros || []).forEach(function (c) { out.push(c); }); }
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

/* Reduz pontos quase alinhados (curvas do SVG viram muitos segmentos curtos): eps = tolerância em px */
function simplifica(P, eps) {
  var R = [P[0]];
  for (var i = 1; i < P.length - 1; i++) {
    var a = R[R.length - 1], b = P[i], c = P[i + 1], l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    if (Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) / l > eps) R.push(b);
  }
  R.push(P[P.length - 1]);
  return R;
}
/* Polígono livre -> corpo: origem no centro de massa, contorno em coordenadas locais, caixa da imagem e inércia */
function poligonoCorpo(P) {
  P = P.slice();
  if (P.length > 1 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 0.01) P.pop();
  P = simplifica(P, 0.6);
  if (P.length < 3) return null;
  if (area(P) < 0) P.reverse();                 // mesma orientação sempre (a normal de dentroPoly depende disso)
  var n = P.length, S = 0, cx = 0, cy = 0, i, a, b, c;
  for (i = 0; i < n; i++) { a = P[i]; b = P[(i + 1) % n]; c = a[0] * b[1] - b[0] * a[1]; S += c; cx += (a[0] + b[0]) * c; cy += (a[1] + b[1]) * c; }
  if (Math.abs(S) < 1e-6) return null;
  cx /= 3 * S; cy /= 3 * S;                     // centro de massa (S = 2 × área)
  var Lp = P.map(function (p) { return [p[0] - cx, p[1] - cy]; });
  var num = 0, den = 0, x0 = 1e30, y0 = 1e30, x1 = -1e30, y1 = -1e30, rad = 0;
  for (i = 0; i < n; i++) {
    a = Lp[i]; b = Lp[(i + 1) % n]; c = a[0] * b[1] - b[0] * a[1];
    num += c * (a[0] * a[0] + a[0] * b[0] + b[0] * b[0] + a[1] * a[1] + a[1] * b[1] + b[1] * b[1]); den += c;
    if (a[0] < x0) x0 = a[0]; if (a[0] > x1) x1 = a[0]; if (a[1] < y0) y0 = a[1]; if (a[1] > y1) y1 = a[1];
    rad = Math.max(rad, Math.hypot(a[0], a[1]));
  }
  return { poly: Lp, cx: cx, cy: cy, W: x1 - x0, H: y1 - y0, ix: (x0 + x1) / 2, iy: (y0 + y1) / 2,
           bx0: x0, by0: y0, bx1: x1, by1: y1, rad: rad, Iu: 1.5 * num / (6 * den) };   // inércia por unidade de massa (mesma convenção da caixa)
}
/* ---------- formato da nave desenhado na camada "escala" ---------- */
var ESCALA_BASE = 'largura';   // o que vale NAVE_PX (32 px): a 'largura' do desenho, a 'altura', a dimensão 'maior' ou a 'media' das duas

/* Retângulo (coordenadas do SVG) ocupado por uma imagem: <image>, <use> que aponta para uma <image>, ou um retângulo
   preenchido com padrão que contém imagem (jeito como alguns programas exportam). Não sendo imagem, devolve null. */
function imagemRect(el, M) {
  var t = tag(el);
  function num(e, k) { var r = parseFloat(e.getAttribute(k)); return isNaN(r) ? 0 : r; }
  function porId(id) { return id && DOC ? (DOC.getElementById(id) || DOC.querySelector('[id="' + id + '"]')) : null; }
  function caixaDe(x, y, w, h) {
    if (!(w > 0 && h > 0)) return null;
    var c = [ap(M, [x, y]), ap(M, [x + w, y]), ap(M, [x + w, y + h]), ap(M, [x, y + h])];
    return { x0: Math.min(c[0][0], c[1][0], c[2][0], c[3][0]), y0: Math.min(c[0][1], c[1][1], c[2][1], c[3][1]),
             x1: Math.max(c[0][0], c[1][0], c[2][0], c[3][0]), y1: Math.max(c[0][1], c[1][1], c[2][1], c[3][1]) };
  }
  if (t === 'image') return caixaDe(num(el, 'x'), num(el, 'y'), num(el, 'width'), num(el, 'height'));
  if (t === 'use') {
    var ref = (el.getAttribute('xlink:href') || el.getAttribute('href') || '').replace(/^#/, ''), alvo = porId(ref);
    if (!alvo || tag(alvo) !== 'image') return null;
    return caixaDe(num(el, 'x'), num(el, 'y'), num(el, 'width') || num(alvo, 'width'), num(el, 'height') || num(alvo, 'height'));
  }
  if (t === 'rect') {
    var f = 'fill:' + (el.getAttribute('fill') || '') + ';' + (el.getAttribute('style') || ''),
        m = /fill\s*:\s*url\(\s*['"]?#([^)'"]+)/.exec(f), p = m && porId(m[1]);
    if (p && (p.getElementsByTagName('image').length || p.getElementsByTagName('use').length))
      return caixaDe(num(el, 'x'), num(el, 'y'), num(el, 'width'), num(el, 'height'));
  }
  return null;
}

/* O desenho da camada "escala" é o contorno da nave (um quadrado também vale: foi assim até agora).
   Devolve a escala do mundo, o centro do desenho (= centro da nave) e a "nave" em px do jogo, relativa a esse centro:
   hull = contorno, pontos = pontos de contato com o terreno, pes = distância do centro até o ponto mais baixo,
   I = inércia, img = onde desenhar a imagem da nave (se houver imagem dentro da camada). */
function formaNave(eo, avisos, cm, pinosSvg) {
  var melhor = null;
  eo.subs.forEach(function (sub) {
    var Q = limpa(sub.pts); if (Q.length < 3) return;
    var ar = Math.abs(area(Q)); if (!melhor || ar > melhor.ar) melhor = { pts: Q, ar: ar };
  });
  if (eo.subs.length > 1) avisos.push('A camada "escala" tem mais de uma forma: usando só a maior como contorno da nave.');
  if (!melhor) { var b0 = caixa([eo]); melhor = { pts: [[b0.x0, b0.y0], [b0.x1, b0.y0], [b0.x1, b0.y1], [b0.x0, b0.y1]] }; }
  var x0 = 1e30, y0 = 1e30, x1 = -1e30, y1 = -1e30;
  melhor.pts.forEach(function (p) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
  var w0 = x1 - x0, h0 = y1 - y0, base = ESCALA_BASE;
  var ref = base === 'altura' ? h0 : base === 'maior' ? Math.max(w0, h0) : base === 'media' ? (w0 + h0) / 2 : w0;
  if (!(ref > 0)) ref = 1;
  var s = NAVE_PX / ref, bx = (x0 + x1) / 2, by = (y0 + y1) / 2, cx = bx, cy = by;
  if (cm) { cx = cm[0]; cy = cm[1]; }                        // camada "centro": a origem da nave passa a ser o centro de gravidade
  var Q = limpa(melhor.pts.map(function (p) { return [(p[0] - cx) * s, (p[1] - cy) * s]; }));
  if (Q.length > 1 && Math.hypot(Q[0][0] - Q[Q.length - 1][0], Q[0][1] - Q[Q.length - 1][1]) < 0.01) Q.pop();
  for (var eps = 0.3; Q.length > 40 && eps < 8; eps *= 1.5) Q = simplifica(Q, eps);
  var passo = 10, pts;
  do {                                                      // pontos de contato: vértices + pontos intermediários nas arestas longas
    pts = [];
    Q.forEach(function (a, i) {
      var b = Q[(i + 1) % Q.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / passo));
      for (var k = 0; k < n; k++) pts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    });
    passo *= 1.5;
  } while (pts.length > 64);
  var pes = -1e30; Q.forEach(function (p) { if (p[1] > pes) pes = p[1]; });
  var pc = poligonoCorpo(Q), img = null;
  if (eo.imgs && eo.imgs.length) {
    var im = eo.imgs[0];
    eo.imgs.forEach(function (c) { if ((c.x1 - c.x0) * (c.y1 - c.y0) > (im.x1 - im.x0) * (im.y1 - im.y0)) im = c; });
    img = { x0: (im.x0 - cx) * s, y0: (im.y0 - cy) * s, x1: (im.x1 - cx) * s, y1: (im.y1 - cy) * s };
  }
  return { s: s, cx: cx, cy: cy, nave: { hull: Q, pontos: pts, pes: pes, I: (pc ? pc.Iu + (cm ? 1.5 * (pc.cx * pc.cx + pc.cy * pc.cy) : 0) : 250), img: img, w: w0 * s, h: h0 * s, ox: (bx - cx) * s, oy: (by - cy) * s, cm: !!cm,
    pinos: (pinosSvg || []).map(function (p) { return [(p[0] - cx) * s, (p[1] - cy) * s]; }) } };
}
/* ---------- construir a fase ---------- */
function build(text) {
  var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('O arquivo SVG não pôde ser lido (XML inválido).');
  var out = [];
  percorrer(doc.documentElement, [1, 0, 0, 1, 0, 0], out);
  var by = { objeto: [], corpo: [], animacao: [] }; NOMES.forEach(function (n) { by[n] = []; });
  out.forEach(function (o) { if (o.subs.length) by[o.fam].push(o); });
  if (!by.saida.length) throw new Error('Falta o objeto "saida" no SVG.');
  // chegada_ponto (ou chegada_ponto2...): braço da torre. Só colide com as camadas "ponto" da nave e é a única chegada que vale.
  var bracosO = by.chegada.filter(function (o) { return /^ponto\d*$/.test(o.tag || ''); });
  by.chegada = by.chegada.filter(function (o) { return !/^ponto\d*$/.test(o.tag || ''); });

  DOC = doc;
  // escala: o desenho da camada "escala" é a nave (contorno, tamanho e centro)
  var s, avisos = [], fn = null;
  if (by.escala.length) {
    var cmc = null;
    if (by.centro.length) { var cb = caixa([by.centro[0]]); cmc = [(cb.x0 + cb.x1) / 2, (cb.y0 + cb.y1) / 2]; }
    var pinosC = by.ponto.map(function (o) { var pb = caixa([o]); return [(pb.x0 + pb.x1) / 2, (pb.y0 + pb.y1) / 2]; });
    fn = formaNave(by.escala[0], avisos, cmc, pinosC);
    s = fn.s;
  } else {
    var pb = by.saida.concat(by.base, by.chegada).map(function (o) { var c = caixa([o]); return c.x1 - c.x0; });
    var med = pb.reduce(function (a, b) { return a + b; }, 0) / pb.length;
    s = 180 / med; // referência do jogo antigo: bases de 180 px
    avisos.push('Sem o quadrado "escala": usando bases de 180 px como referência.');
  }

  var mb = by.mundo.length ? caixa([by.mundo[0]]) : caixa(out.filter(function (o) { return o.fam !== 'escala' && o.fam !== 'parallax' && o.fam !== 'centro'; }));
  var ox = mb.x0, oy = mb.y0, WW = (mb.x1 - mb.x0) * s, WH = (mb.y1 - mb.y0) * s;
    function G(p) { return [(p[0] - ox) * s, (p[1] - oy) * s]; }
  function gsub(sub) { return sub.pts.map(G); }

  // posição inicial = centro do desenho da camada "escala" (centro da caixa que envolve o contorno)
  var posEscala = fn ? G([fn.cx, fn.cy]) : null;
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
    pads.push({ x1: x1, x2: x2, y: y, h: h, kind: kind, num: kind === 'base' && o.num !== '' ? parseInt(o.num, 10) : 0 });   // num = número do nome da camada (base2 -> 2)
  }
  by.saida.slice(0, 1).forEach(function (o) { pad(o, 'saida'); });
  by.base.slice().sort(function (a, b) { return caixa([a]).x0 - caixa([b]).x0; }).forEach(function (o) { pad(o, 'base'); });
  by.chegada.slice(0, 1).forEach(function (o) { pad(o, bracosO.length ? 'base' : 'chegada'); });   // com braço, a "chegada" comum vira base normal
  var bracos = [];
  if (bracosO.length) {
    pad({ subs: [].concat.apply([], bracosO.map(function (o) { return o.subs; })) }, 'chegada');
    pads[pads.length - 1].braco = true;                       // pad do braço: não é sólido (o casco atravessa), só os "ponto" da nave encostam
    bracosO.forEach(function (o) { o.subs.forEach(function (sub) {
      var P = limpa(gsub(sub)); if (P.length > 1 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 0.01) P.pop();
      if (P.length >= 3) bracos.push(P);
    }); });
    if (!bracos.length) avisos.push('"chegada_ponto" precisa ser uma forma fechada.');
    if (!fn || !fn.nave.pinos.length) avisos.push('"chegada_ponto" só funciona com camadas "ponto" dentro da nave ("escala"): sem elas a fase não pode ser vencida.');
  } else if (!by.chegada.length) avisos.push('Sem o objeto "chegada": a fase não pode ser vencida.');

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
    if (p.braco) return;
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

  // animações em sequência de imagens: animacao_(frente|tras)_nome_8q_12fps  (8q = quadros, 12fps = velocidade)
  var animacoes = [];
  by.animacao.forEach(function (o) {
    var g = null;
    if (o.subs.length === 1) { var P = limpa(gsub(o.subs[0])); g = retangulo(P); }
    if (!g) {
      var bb = { x0: 1e30, y0: 1e30, x1: -1e30, y1: -1e30 };
      o.subs.forEach(function (sub) { gsub(sub).forEach(function (p) {
        if (p[0] < bb.x0) bb.x0 = p[0]; if (p[0] > bb.x1) bb.x1 = p[0]; if (p[1] < bb.y0) bb.y0 = p[1]; if (p[1] > bb.y1) bb.y1 = p[1];
      }); });
      g = { cx: (bb.x0 + bb.x1) / 2, cy: (bb.y0 + bb.y1) / 2, w: bb.x1 - bb.x0, h: bb.y1 - bb.y0, ang: 0 };
    }
    var mq = /(?:^|[_\-])(\d+)q(?:[_\-]|$)/.exec(o.arquivo), mf = /(?:^|[_\-])(\d+)fps(?:[_\-]|$)/.exec(o.arquivo);
    g.q = mq ? Math.max(1, parseInt(mq[1], 10)) : 1;
    g.fps = mf ? Math.max(1, parseInt(mf[1], 10)) : api.ANIM_FPS;
    if (!mq) avisos.push('Animação "' + o.arquivo + '" sem número de quadros no nome (ex: _8q): usando 1 quadro.');
    g.arquivos = [o.arquivo]; g.camada = o.camada; g.img = null;
    animacoes.push(g);
  });

  // corpos com colisão e física (objeto_colisao_xxx)
  var corpos = [];
  by.corpo.forEach(function (o) {
    var P = o.subs.length === 1 ? limpa(gsub(o.subs[0])) : null, g = P && retangulo(P), cr = null, pl = null;
    if (!g && P && P.length >= 12) cr = circulo(P);
    if (!g && !cr) {                       // forma livre: colide pelo contorno exato do polígono
      var melhor = null;
      o.subs.forEach(function (sub) {
        var Q = limpa(gsub(sub)); if (Q.length < 3) return;
        var ar = Math.abs(area(Q)); if (!melhor || ar > melhor.ar) melhor = { pts: Q, ar: ar };
      });
      if (o.subs.length > 1) avisos.push('Corpo "' + o.arquivo + '" tem mais de uma forma: usando só a maior.');
      if (melhor) pl = poligonoCorpo(melhor.pts);
    }
    if (!g && !cr && !pl) {
      var bb = { x0: 1e30, y0: 1e30, x1: -1e30, y1: -1e30 };
      o.subs.forEach(function (sub) { gsub(sub).forEach(function (p) {
        if (p[0] < bb.x0) bb.x0 = p[0]; if (p[0] > bb.x1) bb.x1 = p[0]; if (p[1] < bb.y0) bb.y0 = p[1]; if (p[1] > bb.y1) bb.y1 = p[1];
      }); });
      g = { cx: (bb.x0 + bb.x1) / 2, cy: (bb.y0 + bb.y1) / 2, w: bb.x1 - bb.x0, h: bb.y1 - bb.y0, ang: 0 };
    }
    var chave = o.arquivo.replace(/^objeto_colisao_/, '').replace(/[\s\-]+/g, '_');
    var arqs = [o.arquivo], sem = o.arquivo.replace(/[\s_\-]*\d+$/, '');
    if (sem !== o.arquivo && /^objeto[\s_\-]+colisao[\s_\-]+\S/.test(sem)) arqs.push(sem);
    corpos.push(criaCorpo(cr ? { circ: true, cx: cr.cx, cy: cr.cy, r: cr.r } : pl ? pl : g, pesoDe(chave), arqs));
  });

  // faixas das camadas de parallax: par[n] = lista de {x, y, w, h, arq} em px do jogo (n = 1..4).
  // parallax2 -> imagem parallax2.png | parallax2_casa -> imagem parallax2_casa.png (segue os ajustes do parallax 2)
  var par = [];
  by.parallax.forEach(function (o) {
    var n = o.num === '' ? 0 : parseInt(o.num, 10);
    if (!(n >= 1 && n <= 4)) { avisos.push('Camada "parallax' + o.num + (o.tag ? '_' + o.tag : '') + '" ignorada: use parallax1 a parallax4 (ex: parallax2_casa).'); return; }
    var c = caixa([o]), a = G([c.x0, c.y0]), b = G([c.x1, c.y1]);
    // imagem: parallax2_picos.webp. Camada duplicada (picos2, picos3, picos_2...) usa a MESMA imagem: tenta o nome exato e, se não existir, sem os números do final
    var arq0 = 'parallax' + n + (o.tag ? '_' + o.tag : ''), semNum = o.tag ? o.tag.replace(/\d+$/, '') : '', arqs = [arq0];
    if (semNum && semNum !== o.tag) arqs.push('parallax' + n + '_' + semNum);
    var polys = o.subs.map(function (sub) {                       // contorno desenhado (px do jogo): a imagem/textura segue esta forma
      var P = limpa(gsub(sub));
      if (P.length > 1 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 0.01) P.pop();
      return P;
    }).filter(function (P) { return P.length >= 3; });
    var ret = polys.length === 1 && polys[0].length === 4 && polys[0].every(function (p, i, A) {   // retângulo alinhado aos eixos (faixa simples)
      var q = A[(i + 1) % 4]; return Math.abs(p[0] - q[0]) < 0.02 || Math.abs(p[1] - q[1]) < 0.02;
    });
    (par[n] || (par[n] = [])).push({ x: a[0], y: a[1], w: b[0] - a[0], h: b[1] - a[1], polys: polys, rect: ret || !polys.length, tag: o.tag || '', arq: arq0, arqs: arqs });
  });

  var sa = pads[0];
  var lv = { WW: WW, WH: WH, scale: s, nave: fn ? fn.nave : null, pads: pads, polys: polys, zoom: zoom, areas: areas, parallax: par, jatos: jatos, objetos: objetos, animacoes: animacoes, corpos: corpos, avisos: avisos, bracos: bracos,
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
  contorno(lv);
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
/* ---------- contorno exato ----------
   A grade acima dá um campo "grosso" (erro de até meia célula, e a célula cresce em fases grandes).
   Perto do chão o jogo usa a distância EXATA ao desenho do SVG: as arestas da união dos sólidos são cortadas em pedaços de
   até PEDACO px (descartando os que ficam dentro de outro sólido) e guardadas em baldes de BK px. O contato então não
   depende mais da resolução da grade nem do tamanho da fase. */
var BK = 16, PEDACO = 4;
function dentroPoly2(P, x, y) {
  var d = false;
  for (var i = 0, j = P.length - 1; i < P.length; j = i++)
    if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) d = !d;
  return d;
}
function contorno(lv) {
  var polys = lv.polys, bb = polys.map(function (P) {
    var x0 = 1e30, y0 = 1e30, x1 = -1e30, y1 = -1e30;
    P.forEach(function (p) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
    return [x0, y0, x1, y1];
  });
  function dentroOutro(x, y, pi) {
    for (var j = 0; j < polys.length; j++) {
      if (j === pi) continue;
      var q = bb[j]; if (x < q[0] || x > q[2] || y < q[1] || y > q[3]) continue;
      if (dentroPoly2(polys[j], x, y)) return true;
    }
    return false;
  }
  var seg = [], cells = {}, bc = Math.ceil(lv.WW / BK) + 8;
  polys.forEach(function (P, pi) {
    for (var i = 0; i < P.length; i++) {
      var a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      if (len < 1e-9) continue;
      var nx = dy / len, ny = -dx / len, n = Math.max(1, Math.ceil(len / PEDACO));   // normal para fora (polígonos têm área > 0)
      for (var k = 0; k < n; k++) {
        var ax = a[0] + dx * k / n, ay = a[1] + dy * k / n, ex = a[0] + dx * (k + 1) / n, ey = a[1] + dy * (k + 1) / n, mx = (ax + ex) / 2, my = (ay + ey) / 2;
        if (dentroOutro(mx, my, pi)) continue;                                     // pedaço dentro de outro sólido não é contorno
        var t0 = 0, t1 = 1, lo, hi, it;                                            // aparar pontas que entram em outro sólido, no cruzamento exato
        if (dentroOutro(ax, ay, pi)) { lo = 0; hi = 0.5; for (it = 0; it < 12; it++) { var tm = (lo + hi) / 2; if (dentroOutro(ax + (ex - ax) * tm, ay + (ey - ay) * tm, pi)) lo = tm; else hi = tm; } t0 = hi; }
        if (dentroOutro(ex, ey, pi)) { lo = 1; hi = 0.5; for (it = 0; it < 12; it++) { var tn = (lo + hi) / 2; if (dentroOutro(ax + (ex - ax) * tn, ay + (ey - ay) * tn, pi)) lo = tn; else hi = tn; } t1 = hi; }
        var bx0 = ax + (ex - ax) * t0, by0 = ay + (ey - ay) * t0, bx1 = ax + (ex - ax) * t1, by1 = ay + (ey - ay) * t1;
        ax = bx0; ay = by0; ex = bx1; ey = by1;
        var id = seg.length; seg.push([ax, ay, ex, ey, nx, ny]);
        var i0 = Math.floor(Math.min(ax, ex) / BK), i1 = Math.floor(Math.max(ax, ex) / BK), j0 = Math.floor(Math.min(ay, ey) / BK), j1 = Math.floor(Math.max(ay, ey) / BK);
        for (var jj = j0; jj <= j1; jj++) for (var ii = i0; ii <= i1; ii++) { var key = jj * bc + ii; (cells[key] || (cells[key] = [])).push(id); }
      }
    }
  });
  lv.cont = { seg: seg, cells: cells, bc: bc, band: Math.min(2.5 * lv.grid.c, 14) };
}
var EX = 0;
/* Distância exata COM SINAL (negativa dentro) do ponto (x,y) ao contorno, em EX. v = valor da grade no ponto (desempate de sinal).
   Devolve false se não há contorno perto (até ~BK px): nesse caso vale o valor da grade. */
function exato(x, y, v) {
  var C = L.cont; if (!C) return false;
  var bi = Math.floor(x / BK), bj = Math.floor(y / BK), best = 1e30, bs = 0, bsa = -1;   // bs = lado (s = produto com a normal) da aresta mais próxima
  for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
    var lst = C.cells[(bj + dj) * C.bc + bi + di]; if (!lst) continue;
    for (var k = 0; k < lst.length; k++) {
      var g = C.seg[lst[k]], sx = g[2] - g[0], sy = g[3] - g[1], l2 = sx * sx + sy * sy;
      var t = l2 > 0 ? ((x - g[0]) * sx + (y - g[1]) * sy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      var qx = g[0] + t * sx, qy = g[1] + t * sy, d2 = (x - qx) * (x - qx) + (y - qy) * (y - qy);
      var tol = 1e-9 * (1 + best);
      if (d2 < best - tol || d2 <= best + tol) {
        var sv = (x - qx) * g[4] + (y - qy) * g[5], sa = Math.abs(sv);
        if (d2 < best - tol) { best = d2; bs = sv; bsa = sa; }                     // aresta mais próxima
        else if (sa > bsa) { bs = sv; bsa = sa; }                                  // empate (vértice): vale a aresta mais "de frente"
        if (d2 < best) best = d2;
      }
    }
  }
  if (bsa < 0) return false;
  var d = Math.sqrt(best), sg = bsa > 1e-9 ? (bs >= 0 ? 1 : -1) : (v >= 0 ? 1 : -1);   // sem lado claro (ponto sobre a linha): grade
  EX = sg * d; return true;
}
/* d = distância com sinal até o sólido (negativa dentro); (nx,ny) = direção para longe do sólido */
function distNormal(x, y) {
  if (y >= L.WH) { ON.d = -(y - L.WH + 1); ON.nx = 0; ON.ny = -1; return ON; } // piso de segurança
  var e = L.grid.c, gx = sd(x + e, y) - sd(x - e, y), gy = sd(x, y + e) - sd(x, y - e), m = Math.sqrt(gx * gx + gy * gy);
  if (m < 1e-6) { gx = 0; gy = -1; m = 1; }
  var v = sd(x, y);
  if (v < 200) {                                  // correção exata: mede o erro da grade no ponto da superfície mais próximo
    var nx = gx / m, ny = gy / m, px = x - nx * v, py = y - ny * v;
    if (exato(px, py, 0)) v += EX;
  }
  ON.d = v; ON.nx = gx / m; ON.ny = gy / m;
  return ON;
}
var O = { d: 0, nx: 0, ny: -1 };
/* O ponto (x,y) está dentro de um sólido? Devolve {d: profundidade, nx,ny: normal para fora} ou null */
function hit(x, y) {
  if (y >= L.WH) { O.d = y - L.WH + 1; O.nx = 0; O.ny = -1; return O; } // piso de segurança
  var v = sd(x, y);
  if (v >= L.cont.band) return null;
  if (v > -L.cont.band && exato(x, y, v)) v = EX;      // perto do chão: distância exata ao desenho (não a da grade)
  if (v >= 0) return null;
  var e = L.grid.c, gx = sd(x + e, y) - sd(x - e, y), gy = sd(x, y + e) - sd(x, y - e), m = Math.sqrt(gx * gx + gy * gy);
  if (m < 1e-6) { gx = 0; gy = -1; m = 1; }
  O.d = -v; O.nx = gx / m; O.ny = gy / m;
  return O;
}
/* Braço da torre (chegada_ponto): só os pinos da nave ("ponto") chamam isto. Devolve {d: profundidade, nx,ny: normal para fora} ou null */
var OB = { d: 0, nx: 0, ny: -1 };
function hitBraco(x, y) {
  var B = L && L.bracos; if (!B || !B.length) return null;
  var best = null;
  for (var bi = 0; bi < B.length; bi++) {
    var P = B[bi], n = P.length, inside = false, md = 1e30, qx0 = 0, qy0 = 0;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var a = P[j], b = P[i];
      if (((a[1] > y) !== (b[1] > y)) && (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])) inside = !inside;
      var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
      var t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
      var qx = a[0] + t * dx, qy = a[1] + t * dy, d2 = (x - qx) * (x - qx) + (y - qy) * (y - qy);
      if (d2 < md) { md = d2; qx0 = qx; qy0 = qy; }
    }
    if (!inside) continue;
    var d = Math.sqrt(md); if (d < 1e-6) continue;
    if (!best || d < best.d) best = { d: d, nx: (qx0 - x) / d, ny: (qy0 - y) / d };
  }
  if (!best) return null;
  OB.d = best.d; OB.nx = best.nx; OB.ny = best.ny;
  return OB;
}
function bracoPath(ctx) {
  ctx.beginPath();
  ((L && L.bracos) || []).forEach(function (P) { P.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); });
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
  var b = { m: m, invM: 1 / m, arquivos: arqs, img: null, ax: 0, ay: 0, aw: 0, c: 1, s: 0, amostras: [], ix: 0, iy: 0 }, k, n;
  b.x0 = g.cx; b.y0 = g.cy;
  if (g.circ) {
    b.circ = true; b.R = g.r; b.W = b.H = 2 * g.r; b.th0 = 0; b.Iu = 1.5 * g.r * g.r / 2;
    n = Math.max(12, Math.min(48, Math.ceil(2 * Math.PI * g.r / 10)));
    for (k = 0; k < n; k++) b.amostras.push([g.r * Math.cos(2 * Math.PI * k / n), g.r * Math.sin(2 * Math.PI * k / n)]);
  } else if (g.poly) {   // polígono livre: contorno local (origem no centro de massa); ix,iy = centro da caixa da imagem
    b.poly = g.poly; b.W = g.W; b.H = g.H; b.ix = g.ix; b.iy = g.iy; b.th0 = 0; b.Iu = g.Iu;
    b.bx0 = g.bx0; b.by0 = g.by0; b.bx1 = g.bx1; b.by1 = g.by1;
    for (var e2 = 0; e2 < b.poly.length; e2++) {
      var A2 = b.poly[e2], B2 = b.poly[(e2 + 1) % b.poly.length], len2 = Math.hypot(B2[0] - A2[0], B2[1] - A2[1]);
      n = Math.max(1, Math.ceil(len2 / 16));
      for (k = 0; k < n; k++) b.amostras.push([A2[0] + (B2[0] - A2[0]) * k / n, A2[1] + (B2[1] - A2[1]) * k / n]);
    }
  } else {
    b.W = g.w; b.H = g.h; b.hw = g.w / 2; b.hh = g.h / 2; b.th0 = g.ang; b.Iu = 1.5 * (g.w * g.w + g.h * g.h) / 12;
    var q = [[-b.hw, -b.hh], [b.hw, -b.hh], [b.hw, b.hh], [-b.hw, b.hh]];
    for (var e = 0; e < 4; e++) {
      var A = q[e], B = q[(e + 1) % 4], len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      n = Math.max(1, Math.ceil(len / 16));
      for (k = 0; k < n; k++) b.amostras.push([A[0] + (B[0] - A[0]) * k / n, A[1] + (B[1] - A[1]) * k / n]);
    }
  }
  b.rad = g.poly ? g.rad : Math.hypot(b.W, b.H) / 2;
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
/* Ponto (dx,dy), relativo ao centro do corpo, dentro do polígono? Profundidade = distância até a aresta mais próxima. */
function dentroPoly(B, dx, dy) {
  var lx = B.c * dx + B.s * dy, ly = -B.s * dx + B.c * dy;
  if (lx < B.bx0 || lx > B.bx1 || ly < B.by0 || ly > B.by1) return false;
  var P = B.poly, n = P.length, ins = false, best = 1e30, nx = 0, ny = -1;
  for (var i = 0, j = n - 1; i < n; j = i++) {
    var a = P[j], b = P[i], ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey;
    if ((a[1] > ly) !== (b[1] > ly) && lx < ex * (ly - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins;
    if (l2 < 1e-9) continue;
    var t = Math.max(0, Math.min(1, ((lx - a[0]) * ex + (ly - a[1]) * ey) / l2));
    var d = Math.hypot(lx - (a[0] + t * ex), ly - (a[1] + t * ey));
    if (d < best) { best = d; var l = Math.sqrt(l2); nx = ey / l; ny = -ex / l; }   // normal para fora (polígono com área positiva)
  }
  if (!ins) return false;
  O2.pen = best; O2.nx = B.c * nx - B.s * ny; O2.ny = B.s * nx + B.c * ny;
  return true;
}
function dentro(B, px, py) { // O2 = profundidade e normal (para fora de B) se o ponto está dentro
  var dx = px - B.x, dy = py - B.y;
  if (B.circ) {
    var d = Math.hypot(dx, dy); if (d >= B.R) return false;
    O2.pen = B.R - d; if (d > 1e-6) { O2.nx = dx / d; O2.ny = dy / d; } else { O2.nx = 0; O2.ny = -1; }
    return true;
  }
  if (B.poly) return dentroPoly(B, dx, dy);
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
  SB.invM = 1 / Math.max(PESO_MIN, P.M > 0 ? P.M : 1);   // peso da nave (mesma escala dos objetos; 1 = padrão)
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
    if (P.A > 0) { var vs0 = Math.hypot(b.vx, b.vy); b.ax -= P.A * vs0 * b.vx / b.m; b.ay -= P.A * vs0 * b.vy / b.m; }   // arrasto do ar (objeto mais pesado = menos efeito)
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
    ctx.drawImage(b.img, b.ix - b.W / 2, b.iy - b.H / 2, b.W, b.H);
    ctx.restore();
  });
}
/* Contorno dos corpos (só para depuração: ?debug) */
function corposPath(ctx) {
  ctx.beginPath();
  L.corpos.forEach(function (b) {
    if (b.circ) { ctx.moveTo(b.x + b.R, b.y); ctx.arc(b.x, b.y, b.R, 0, 2 * Math.PI); return; }
    if (b.poly) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.th);
      ctx.moveTo(b.poly[0][0], b.poly[0][1]);
      for (var i = 1; i < b.poly.length; i++) ctx.lineTo(b.poly[i][0], b.poly[i][1]);
      ctx.closePath(); ctx.restore(); return;
    }
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.th); ctx.rect(-b.hw, -b.hh, b.W, b.H); ctx.restore();
  });
}

/* Procura o PNG na pasta da fase (a mesma do SVG); api.IMG_DIRS_EXTRA pode listar pastas extras de reserva (vazio por padrão). */
function carregaImagem(o, cache, dir) {
  var k = o.arquivos.join('|');
  if (cache[k]) { o.img = cache[k]; return; }
  var dirs = [], urls = [];
  [dir || ''].concat(api.IMG_DIRS_EXTRA).forEach(function (d) { if (dirs.indexOf(d) < 0) dirs.push(d); });
  dirs.forEach(function (d) { o.arquivos.forEach(function (a) { api.IMG_EXTS.forEach(function (x) { urls.push(d + a + '.' + x); }); }); });
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
  // animações: a imagem é uma faixa horizontal com q quadros iguais; mostra um quadro por vez
  var t = performance.now() / 1000;
  L.animacoes.forEach(function (o) {
    if (o.camada !== camada || !o.img || !o.img.complete || !o.img.naturalWidth) return;
    var fw = o.img.naturalWidth / o.q, fh = o.img.naturalHeight, f = Math.floor(t * o.fps) % o.q;
    ctx.save(); ctx.translate(o.cx, o.cy); ctx.rotate(o.ang);
    ctx.drawImage(o.img, f * fw, 0, fw, fh, -o.w / 2, -o.h / 2, o.w, o.h);
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
    L.animacoes.forEach(function (o) { carregaImagem(o, cache, L.dir); });
    L.corpos.forEach(function (o) { carregaImagem(o, cache, L.dir); });
    L.avisos.forEach(function (a) { console.warn('[fase] ' + a); });
    console.log('[fase] ' + url + ': ' + Math.round(L.WW) + '×' + Math.round(L.WH) + ' px, escala ' + L.scale.toFixed(3) +
                ', ' + L.pads.length + ' bases, ' + L.polys.length + ' sólidos');
    return L;
  });
}

var api = { load: load, build: build, hit: hit, hitBraco: hitBraco, bracoPath: bracoPath, below: below, path: path, tags: tags, zoomDist: zoomDist, zoomLines: zoomLines, zoomPath: zoomPath, zoomArea: zoomArea, zoomAreaPath: zoomAreaPath, drawObjetos: drawObjetos, fisica: fisica, drawCorpos: drawCorpos, corposPath: corposPath, resetCorpos: resetCorpos, PESO: PESO, ATRITO_CORPO: ATRITO_CORPO, ZOOM_DIV: ZOOM_DIV, ZOOM_AREA: ZOOM_AREA, setCasco: setCasco, IMG_DIRS_EXTRA: [], IMG_EXTS: ['webp',  'jpg', 'jpeg', 'png', 'avif'], ANIM_FPS: 12, level: null,
            _use: function (lv) { L = lv; api.level = lv; } };
var root = typeof window !== 'undefined' ? window : globalThis;
root.Fase = api;
if (typeof module !== 'undefined') module.exports = api;
})();