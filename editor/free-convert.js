/* 既存デザイン → フリーデザイン変換。window.JukenFree.convert(templateId, V, student)
   テンプレートをA4の画面外に描画し、DOMを歩いて自由編集用の要素（rect / text / field / image / notes / fold）に置き換える。
   - 背景・罫線のある箱 → rect（塗り・線・角丸）／円 → ellipse／片側だけの罫線 → 細い rect か line
   - 文字 → text（書体・サイズ・太さ・色・字間・行間・揃え・縦書き）。{{ヘッダー}} などは差し込みに戻す
   - 項目（C.item のフック data-item）→ 値は field（名簿・固定文字・日付・時間割がそのまま流れる）、項目名は text
   - 注意事項 → notes ／ 折り線(.jt-fold) → fold ／ 地図・ロゴ → image(map/logo) ／ 透かし(.jt-wm) → V の透かし設定を維持
   結果は { elements, bg, wm:{y}|null, count }。要素は最大150個。 */
(function (g) {
'use strict';
var JF = g.JukenFree, JT = g.JukenTemplates, C = JT.ctx;
var MM = 25.4 / 96, MAXN = 150;

function r2(n) { return Math.round(n * 100) / 100; }
function norm(s) { return String(s == null ? '' : s).replace(/[\s　]/g, ''); }

/* ---------- 色 ---------- */
function parseColor(s) {
  if (!s || s === 'transparent') return null;
  var m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s);
  if (m) { var a = m[4] == null ? 1 : (/%$/.test(m[4]) ? parseFloat(m[4]) / 100 : parseFloat(m[4])); return { r: +m[1], g: +m[2], b: +m[3], a: a }; }
  m = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\)$/.exec(s);
  if (m) { var a2 = m[4] == null ? 1 : (/%$/.test(m[4]) ? parseFloat(m[4]) / 100 : parseFloat(m[4])); return { r: m[1] * 255, g: m[2] * 255, b: m[3] * 255, a: a2 }; }
  return null;
}
function hex2(n) { n = Math.max(0, Math.min(255, Math.round(n))); return (n < 16 ? '0' : '') + n.toString(16); }
function toHex(c) { return '#' + hex2(c.r) + hex2(c.g) + hex2(c.b); }
function hexRgb(h) { var m = /^#([0-9a-f]{6})$/i.exec(h || ''); return m ? { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4), 16) } : null; }
function firstColorIn(str) { var m = /(rgba?\([^)]*\)|color\(srgb[^)]*\))/g, x, o; while ((x = m.exec(str))) { o = parseColor(x[1]); if (o && o.a > 0.05) return o; } return null; }

function convert(tid, V, st) {
  var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  return fontsReady.then(function () {
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-6000px;top:0;width:' + JT.pageSize(V).w + 'mm;height:' + JT.pageSize(V).h + 'mm;opacity:0;pointer-events:none;overflow:hidden;background:#fff';
    document.body.appendChild(host);
    var stu = Object.create(st); stu._edit = false;
    var page = JT.render(tid, stu, V);
    host.appendChild(page);
    function fits() { (page._fits || []).forEach(function (e) { C.fit(e, e._fitMin); }); }
    fits();
    return (window.JukenFonts ? window.JukenFonts.prepare(page) : fontsReady).then(function () { fits(); return new Promise(function (r) { setTimeout(r, 120); }); }).then(function () {
      fits();
      try { return walkPage(page, V, stu); } finally { host.remove(); }
    });
  });
}

function walkPage(page, V, st) {
  var pr = page.getBoundingClientRect(), out = [], acc = hexRgb(V.accent), sec = hexRgb(V.secondary), wm = null, bg = '#ffffff';
  var gcs = getComputedStyle;

  /* 色の変換：アクセント色・サブカラーと一致したら参照にする。透明度は白に混ぜる */
  function colorOf(cstr, opacity, noRef, raw) {
    var c = parseColor(cstr); if (!c || c.a <= 0.02) return null;
    var a = raw ? 1 : c.a;
    var r = c.r * a + 255 * (1 - a), gg = c.g * a + 255 * (1 - a), b = c.b * a + 255 * (1 - a);
    if (!noRef && (raw || c.a >= 0.99)) {
      if (acc && Math.abs(c.r - acc.r) < 1 && Math.abs(c.g - acc.g) < 1 && Math.abs(c.b - acc.b) < 1) return 'accent';
      if (sec && Math.abs(c.r - sec.r) < 1 && Math.abs(c.g - sec.g) < 1 && Math.abs(c.b - sec.b) < 1) return 'secondary';
    }
    return toHex({ r: r, g: gg, b: b });
  }
  function px(v) { return parseFloat(v) || 0; }
  function visible(node, cs) { return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.01; }

  /* ---------- 疑似要素（::before / ::after）を本物の要素にして、元の疑似要素は消す ---------- */
  (function materialize() {
    var all = [page].concat(Array.prototype.slice.call(page.querySelectorAll('*')));
    all.forEach(function (el) {
      ['::before', '::after'].forEach(function (ps) {
        var pcs = gcs(el, ps), c = pcs.content;
        if (!c || c === 'none' || c === 'normal' || pcs.display === 'none') return;
        var text = '', m = /^"([\s\S]*)"$/.exec(c);
        if (m) text = m[1].replace(/\\([0-9a-fA-F]{1,6})\s?/g, function (x, h) { return String.fromCodePoint(parseInt(h, 16)); }).replace(/\\(.)/g, '$1');
        var rep = document.createElement('span'); rep.setAttribute('data-fe-pseudo', '1');
        for (var i = 0; i < pcs.length; i++) rep.style.setProperty(pcs[i], pcs.getPropertyValue(pcs[i]));
        rep.style.content = 'normal';
        if (text) rep.textContent = text;
        el.setAttribute('data-fe-np', '1');
        if (ps === '::before') el.insertBefore(rep, el.firstChild); else el.appendChild(rep);
      });
    });
    var stl = document.createElement('style'); stl.textContent = '[data-fe-np]::before,[data-fe-np]::after{content:none!important;display:none!important}'; page.appendChild(stl);
  })();

  /* ---------- 幾何 ---------- */
  function rotOf(cs) {
    var t = cs.transform; if (!t || t === 'none') return 0;
    var m = /^matrix\(([^)]+)\)$/.exec(t); if (!m) return 0;
    var p = m[1].split(',').map(parseFloat); return Math.atan2(p[1], p[0]) * 180 / Math.PI;
  }
  /* node の箱（px・ページ左上原点）。回転しているときは回転前のサイズと中心から求める */
  function boxOf(node, rot) {
    var r = node.getBoundingClientRect();
    if (!rot || Math.abs(rot) < 0.05 || !node.offsetWidth) return { x: r.left - pr.left, y: r.top - pr.top, w: r.width, h: r.height };
    var cx = r.left - pr.left + r.width / 2, cy = r.top - pr.top + r.height / 2, w = node.offsetWidth, h = node.offsetHeight;
    return { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
  }
  function contentBox(node, b, cs) {
    var l = px(cs.paddingLeft) + px(cs.borderLeftWidth), t = px(cs.paddingTop) + px(cs.borderTopWidth), rr = px(cs.paddingRight) + px(cs.borderRightWidth), bb = px(cs.paddingBottom) + px(cs.borderBottomWidth);
    return { x: b.x + l, y: b.y + t, w: Math.max(0, b.w - l - rr), h: Math.max(0, b.h - t - bb) };
  }
  function mmBox(b) { return { x: r2(b.x * MM), y: r2(b.y * MM), w: r2(b.w * MM), h: r2(b.h * MM) }; }
  function push(e) { out.push(e); return e; }
  function fire(type, b, rot, op, props) {
    var q = mmBox(b), e = { type: type, x: q.x, y: q.y, w: Math.max(0, q.w), h: Math.max(0, q.h) };
    if (rot && Math.abs(rot) >= 0.05) e.rot = r2(((rot + 180) % 360 + 360) % 360 - 180);
    if (op < 0.995) e.opacity = r2(op);
    for (var k in props) e[k] = props[k];
    return push(e);
  }

  /* ---------- 箱（背景・罫線） ---------- */
  function radiusOf(cs, b) {
    var best = 0, lim = Math.min(b.w, b.h) / 2;
    ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].forEach(function (k) {
      var v = cs[k]; if (!v || v === '0px') return; var first = v.split(' ')[0], n = parseFloat(first) || 0;
      if (/%$/.test(first)) n = n * Math.min(b.w, b.h) / 100; best = Math.max(best, Math.min(n, lim));
    });
    return best;
  }
  function bgInfo(cs, noBgColor, raw) {
    var c = noBgColor ? null : colorOf(cs.backgroundColor, 1, false, raw), bi = cs.backgroundImage, url = null;
    if (bi && bi !== 'none') {
      var um = /^url\(["']?([^"')]+)["']?\)/.exec(bi); if (um) url = um[1];
      else if (!c && /linear-gradient/.test(bi) && !/repeating/.test(bi)) { var fc = firstColorIn(bi); if (fc) c = colorOf('rgb(' + fc.r + ',' + fc.g + ',' + fc.b + ')', 1); }
    }
    return { color: c, url: url };
  }
  function srcFrom(u) {
    if (!u) return '';
    if (/^data:image\//i.test(u)) return u;
    try { var a = new URL(u, location.href), base = new URL('assets/', location.href); if (a.href.indexOf(base.href) === 0) { var rel = 'assets/' + a.href.slice(base.href.length); if (/^assets\/[\w.\/-]+$/.test(rel)) return rel; } } catch (e) {}
    return '';
  }
  function emitBox(node, cs, b, rot, op, opts) {
    var bc0 = parseColor(cs.backgroundColor), ba = bc0 ? bc0.a : 1, w4 = [px(cs.borderTopWidth), px(cs.borderRightWidth), px(cs.borderBottomWidth), px(cs.borderLeftWidth)];
    var names = ['Top', 'Right', 'Bottom', 'Left'], sides = names.map(function (n, i) {
      var sty = cs['border' + n + 'Style'], col = colorOf(cs['border' + n + 'Color'], 1);
      return (w4[i] > 0 && sty !== 'none' && sty !== 'hidden' && col) ? { w: w4[i], style: sty, color: col } : null;
    });
    var has = sides.some(Boolean), all4 = sides.every(Boolean) && sides.every(function (s) { return s.w === sides[0].w && s.color === sides[0].color && s.style === sides[0].style; });
    var bgi = bgInfo(cs, opts && opts.noBg, ba < 0.98 && !all4);
    if (!bgi.color && !has && !bgi.url) return;
    var rad = radiusOf(cs, b);
    var type = 'rect';
    if (rad >= Math.min(b.w, b.h) / 2 - 0.6 && Math.abs(b.w - b.h) < 2 && rad > 0) type = 'ellipse';
    if (bgi.color || all4) {
      var props = { fill: bgi.color || 'transparent', stroke: all4 ? sides[0].color : 'transparent', strokeWidth: all4 ? r2(sides[0].w * 0.75) : 0, dash: all4 && /dash/.test(sides[0].style) ? 'dashed' : all4 && /dot/.test(sides[0].style) ? 'dotted' : 'solid' };
      if (type === 'rect') props.radius = r2(rad * MM);
      var fop = (!all4 && bgi.color && ba < 0.98) ? op * ba : op;
      if (b.w * MM > 0.05 && b.h * MM > 0.05) fire(type, b, rot, fop, props);
    }
    if (bgi.url) {
      var s = srcFrom(bgi.url);
      if (s) fire('image', b, rot, op, { src: s, fit: /cover/.test(cs.backgroundSize) ? 'cover' : 'contain', radius: r2(rad * MM) });
    }
    if (has && !all4) {
      var cx = b.x + b.w / 2, cy = b.y + b.h / 2, a = (rot || 0) * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
      function at(lx, ly) { return { x: cx + lx * co - ly * si, y: cy + lx * si + ly * co }; }
      sides.forEach(function (sd, i) {
        if (!sd) return;
        var horiz = i === 0 || i === 2, len = horiz ? b.w : b.h, off = horiz ? (i === 0 ? -b.h / 2 + sd.w / 2 : b.h / 2 - sd.w / 2) : (i === 1 ? b.w / 2 - sd.w / 2 : -b.w / 2 + sd.w / 2);
        var c0 = horiz ? at(0, off) : at(off, 0);
        if (/dash|dot/.test(sd.style)) {
          var q = { x: c0.x - len / 2, y: c0.y, w: len, h: 0 };
          fire('line', q, horiz ? rot : (rot || 0) + 90, op, { stroke: sd.color, strokeWidth: r2(sd.w * 0.75), dash: /dot/.test(sd.style) ? 'dotted' : 'dashed' });
        } else {
          var bw = horiz ? len : sd.w, bh = horiz ? sd.w : len;
          fire('rect', { x: c0.x - bw / 2, y: c0.y - bh / 2, w: bw, h: bh }, rot, op, { fill: sd.color, stroke: 'transparent', strokeWidth: 0, radius: 0 });
        }
      });
    }
  }

  /* ---------- 文字 ---------- */
  function fontKey(cs) {
    var rid = window.JukenFonts ? window.JukenFonts.fromCss(cs.fontFamily) : '';
    if (rid) return rid;
    var fams = String(cs.fontFamily).split(',').map(function (x) { return x.replace(/["']/g, '').trim().toLowerCase(); });
    for (var i = 0; i < fams.length; i++) {
      var f = fams[i];
      if (/mincho|明朝|^serif$|^times|georgia/.test(f)) return 'mincho';
      if (/maru|丸/.test(f)) return 'maru';
      if (/^inter$/.test(f)) return 'sans-en';
      if (/gothic|ゴシック|meiryo|sans|hiragino kaku|arial|helvetica|noto sans|メイリオ|segoe/.test(f)) return 'gothic';
    }
    return 'gothic';
  }
  function textNodesOf(node) {
    var arr = [], w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      if (!/\S/.test(n.nodeValue) && !/pre/.test(gcs(n.parentNode).whiteSpace)) continue;
      var pcs = n.parentNode.nodeType === 1 ? gcs(n.parentNode) : null; if (pcs && (pcs.display === 'none' || pcs.visibility === 'hidden')) continue;
      arr.push(n);
    }
    return arr;
  }
  function textOf(node, cs) {
    var pre = /^pre/.test(cs.whiteSpace), s = '';
    (function rec(n) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) s += c.nodeValue;
        else if (c.nodeType === 1) { var tn = c.tagName; if (tn === 'BR') s += '\n'; else { var ccs = gcs(c); if (ccs.display !== 'none') rec(c); } }
      }
    })(node);
    if (!pre) s = s.replace(/[ \t\r\n\f]+/g, ' ').replace(/^ | $/g, '');
    if (cs.textTransform === 'uppercase') s = s.toUpperCase(); else if (cs.textTransform === 'lowercase') s = s.toLowerCase();
    return s;
  }
  function rectsOf(nodes) {
    var rs = [];
    nodes.forEach(function (n) { var rg = document.createRange(); rg.selectNodeContents(n); Array.prototype.forEach.call(rg.getClientRects(), function (r) { if (r.width > 0.3 && r.height > 0.3) rs.push(r); }); });
    return rs;
  }
  function unionRects(rs) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    rs.forEach(function (r) { x0 = Math.min(x0, r.left - pr.left); y0 = Math.min(y0, r.top - pr.top); x1 = Math.max(x1, r.right - pr.left); y1 = Math.max(y1, r.bottom - pr.top); });
    return rs.length ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }
  function lineCount(rs) {
    var ys = [];
    rs.slice().sort(function (a, b) { return a.top - b.top; }).forEach(function (r) { var cy = (r.top + r.bottom) / 2; if (!ys.length || Math.abs(cy - ys[ys.length - 1].cy) > r.height * 0.5) ys.push({ cy: cy }); });
    return ys.length;
  }
  /* 文字の見た目（フォント・サイズ・色…）と、箱の中での揃え */
  function domStyleNode(node) {
    var best = null, bl = -1; textNodesOf(node).forEach(function (n) { var l = n.nodeValue.trim().length; if (l > bl && n.parentNode.nodeType === 1) { bl = l; best = n.parentNode; } });
    return best || node;
  }
  function textProps(styleEl, cs, b, cb, tb, lines, rot, op, vert, ocs) {
    var fs = px(cs.fontSize) || 16, wt = parseInt(cs.fontWeight, 10) || 400;
    var ls = cs.letterSpacing === 'normal' ? 0 : px(cs.letterSpacing) / fs, lhr = cs.lineHeight === 'normal' ? 1.3 : px(cs.lineHeight) / fs;
    var p = { font: fontKey(cs), size: Math.round(fs * 75) / 100, weight: wt >= 600 ? 700 : 400, color: colorOf(cs.color, 1, false, true) || '#111827', letterSpacing: r2(ls), lineHeight: r2(Math.max(0.5, Math.min(4, lhr))), padding: 0 };
    var box = { x: cb.x, y: cb.y, w: cb.w, h: cb.h }, tol = Math.max(1.5, 0.04 * cb.w);
    if (tb && !(rot && Math.abs(rot) > 0.05)) {
      if (!vert) {
        var gl = tb.x - cb.x, gr = (cb.x + cb.w) - (tb.x + tb.w), gt = tb.y - cb.y, gb = (cb.y + cb.h) - (tb.y + tb.h);
        if (lines === 1 && (tb.x < cb.x - 1 || tb.x + tb.w > cb.x + cb.w + 1)) { var nx0 = Math.min(cb.x, tb.x), nx1 = Math.max(cb.x + cb.w, tb.x + tb.w); box.x = nx0; box.w = nx1 - nx0; gl = tb.x - box.x; gr = (box.x + box.w) - (tb.x + tb.w); }
        var ta = (ocs || cs).textAlign;
        if (lines === 1) {
          if (Math.abs(gl - gr) <= tol) p.align = gl <= 1.5 ? (ta === 'center' ? 'center' : (ta === 'right' || ta === 'end') ? 'right' : 'left') : 'center';
          else p.align = gl < gr ? 'left' : 'right';
        } else p.align = ta === 'center' ? 'center' : (ta === 'right' || ta === 'end') ? 'right' : 'left';
        var th = Math.max(1, cb.h), vtol = Math.max(1.5, 0.12 * th);
        if (gt <= 1.5 && gb <= 1.5) p.valign = 'middle'; else if (Math.abs(gt - gb) <= vtol) p.valign = 'middle'; else p.valign = gt < gb ? 'top' : 'bottom';
        if (box.h < tb.h) { box.y = Math.min(box.y, tb.y); box.h = Math.max(box.h, tb.h); }
      } else {
        var vgl = tb.x - cb.x, vgr = (cb.x + cb.w) - (tb.x + tb.w), vgt = tb.y - cb.y, vgb = (cb.y + cb.h) - (tb.y + tb.h);
        p.valign = Math.abs(vgl - vgr) <= Math.max(1.5, 0.15 * cb.w) ? 'middle' : (vgl < vgr ? 'bottom' : 'top');
        p.align = Math.abs(vgt - vgb) <= Math.max(1.5, 0.1 * cb.h) ? 'center' : (vgt < vgb ? 'left' : 'right');
        box.x = Math.min(cb.x, tb.x); box.y = Math.min(cb.y, tb.y); box.w = Math.max(cb.x + cb.w, tb.x + tb.w) - box.x; box.h = Math.max(cb.y + cb.h, tb.y + tb.h) - box.y;
      }
    } else {
      var ta2 = (ocs || cs).textAlign; p.align = ta2 === 'center' ? 'center' : (ta2 === 'right' || ta2 === 'end') ? 'right' : 'left';
      p.valign = (cs.display === 'flex' && cs.alignItems === 'center') || lines === 1 ? 'middle' : 'top';
      if (b && rot) { box = { x: b.x, y: b.y, w: b.w, h: b.h }; }
    }
    return { p: p, box: box };
  }
  function lineKnow(rs) { return rs.length ? lineCount(rs) : 1; }

  /* 文字を持つノードか（ブロックの子を持たず、文字がある） */
  function blockish(cs) { return !/^(inline|inline-block|inline-flex|contents)$/.test(cs.display); }
  function hasOwnText(node) { return textNodesOf(node).length > 0; }
  function isTextBearing(node) {
    if (!hasOwnText(node)) return false;
    for (var c = node.firstElementChild; c; c = c.nextElementSibling) {
      var ccs = gcs(c); if (ccs.display === 'none') continue;
      if (blockish(ccs) && hasOwnText(c)) return false;
      if (c.tagName === 'IMG' || c.tagName === 'svg') return false;
      if (ccs.position === 'absolute' && hasOwnText(c)) return false;
    }
    return true;
  }

  /* ---------- 項目・注意事項の準備 ---------- */
  var notesLines = C.notes(V), noteLeaves = [], noteSet = null;
  (function findNotes() {
    if (!notesLines.length) return;
    var leaves = [];
    (function rec(n, inItem) {
      for (var c = n.firstElementChild; c; c = c.nextElementSibling) {
        var cs = gcs(c); if (cs.display === 'none') continue;
        if (c.hasAttribute('data-item') || c.classList.contains('jt-wm') || c.classList.contains('jt-fold')) continue;
        if (isTextBearing(c)) leaves.push(c); else rec(c);
      }
    })(page);
    var nl = notesLines.map(function (x) { return norm(x.text); });
    function match(leaf, line) { var t = norm(textOf(leaf, gcs(leaf))); return t.length >= line.length && t.slice(-line.length) === line && t.length - line.length <= 4; }
    for (var s = 0; s + nl.length <= leaves.length; s++) {
      var ok = true; for (var i = 0; i < nl.length; i++) if (!match(leaves[s + i], nl[i])) { ok = false; break; }
      if (ok) { noteLeaves = leaves.slice(s, s + nl.length); break; }
    }
    if (noteLeaves.length) { noteSet = new Map(); noteLeaves.forEach(function (l, i) { noteSet.set(l, i); }); }
  })();

  function emitNotes() {
    var rects = [], cbs = [];
    noteLeaves.forEach(function (l) { var cs = gcs(l), b = boxOf(l, 0); cbs.push({ cs: cs, cb: contentBox(l, b, cs), b: b }); });
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    cbs.forEach(function (c) { x0 = Math.min(x0, c.cb.x); y0 = Math.min(y0, c.cb.y); x1 = Math.max(x1, c.cb.x + c.cb.w); y1 = Math.max(y1, c.cb.y + c.cb.h); });
    var plain = -1, acc1 = -1; notesLines.forEach(function (n, i) { if (!n.accent && plain < 0) plain = i; if (n.accent && acc1 < 0) acc1 = i; });
    var pi = plain >= 0 ? plain : 0, cs0 = gcs(domStyleNode(noteLeaves[pi])), fs = px(cs0.fontSize) || 14, pitch = cbs.length > 1 ? (cbs[1].cb.y - cbs[0].cb.y) : 0;
    var lhr = cs0.lineHeight === 'normal' ? 1.3 : px(cs0.lineHeight) / fs;
    var multi = cbs.some(function (c) { return lineKnow(rectsOf(textNodesOf(noteLeaves[cbs.indexOf(c)]))) > 1; });
    var eff = !multi && pitch > 0 ? pitch / fs - 0.15 : lhr;
    var bullet = 'none', pre = norm(textOf(noteLeaves[0], gcs(noteLeaves[0]))).slice(0, -norm(notesLines[0].text).length);
    if (/^\d/.test(pre)) bullet = 'number'; else if (pre) bullet = 'dot';
    else if (Array.prototype.some.call(noteLeaves[0].children, function (k) { return !hasOwnText(k) && gcs(k).display !== 'none'; })) bullet = 'dot';
    var op = 1, rot = 0;
    var e = fire('notes', { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, rot, op, {
      title: '', size: Math.round(fs * 75) / 100, color: colorOf(cs0.color, 1, false, true) || '#111827', accentColor: acc1 >= 0 ? (colorOf(gcs(domStyleNode(noteLeaves[acc1])).color, 1, false, true) || 'accent') : 'accent', bullet: bullet, lineHeight: r2(Math.max(0.8, Math.min(3, eff))), fit: 'shrink'
    });
    return e;
  }

  /* ---------- 項目（data-item） ---------- */
  function emitItemNode(node, it, cs, b, rot, op, inh) {
    emitBox(node, cs, b, rot, op);
    var leaves = [];
    for (var c = node.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) walk(c, { rot: rot, op: op, noText: true, leaves: leaves });
    if (isTextBearing(node) && !leaves.length) leaves.push({ node: node });
    var vals = [], statics = [], vtext = norm(it.source === 'schedule' ? C.sched(it).map(function (r) { return r.t + r.c; }).join('') : C.value(it, st)), ln = norm(it.label);
    leaves.forEach(function (l) {
      var t = l.anon ? norm(l.anon.nodeValue) : norm(textOf(l.node, gcs(l.node)));
      if (it.label && t === ln && ln !== vtext) statics.push(l);
      else if (t && (vtext.indexOf(t) >= 0 || (it.source === 'schedule' && C.sched(it).some(function (r) { var rt = norm(r.t), rc = norm(r.c); return t === rt + rc || t === rc + rt || t === rt || t === rc; })))) vals.push(l);
      else statics.push(l);
    });
    statics.forEach(function (l) { emitTextLeaf(l.node, rot, op, null, l.anon); });
    var pb = null, cs0 = null, lines = 1, tb = null, cb;
    if (vals.length) {
      var vs = vals.map(function (v) { return v.node; }), rs = rectsOf([].concat.apply([], vs.map(textNodesOf)));
      tb = unionRects(rs); lines = it.source === 'schedule' ? 2 : lineKnow(rs);
      cs0 = gcs(domStyleNode(vs[0]));
      if (vs.length === 1) { var vb = boxOf(vs[0], rot); cb = contentBox(vs[0], vb, gcs(vs[0])); }
      else {
        var xs0 = 1e9, ys0 = 1e9, xs1 = -1e9, ys1 = -1e9;
        vs.forEach(function (v) { var bb = boxOf(v, rot), cc = contentBox(v, bb, gcs(v)); xs0 = Math.min(xs0, cc.x); ys0 = Math.min(ys0, cc.y); xs1 = Math.max(xs1, cc.x + cc.w); ys1 = Math.max(ys1, cc.y + cc.h); });
        cb = { x: xs0, y: ys0, w: xs1 - xs0, h: ys1 - ys0 }; if (tb) { cb.x = Math.min(cb.x, tb.x); cb.w = Math.max(xs1, tb.x + tb.w) - cb.x; }
      }
    } else { cs0 = cs; cb = contentBox(node, b, cs); }
    var tp = textProps(vals.length ? vals[0].node : node, cs0, b, cb, tb, lines, rot, op, false, vals.length ? gcs(vals[0].node) : cs);
    var props = tp.p; props.itemId = it.id; props.showLabel = false; props.labelPos = 'top'; props.fit = lines === 1 ? 'shrink' : 'none';
    if (it.source === 'schedule') { props.align = 'left'; props.fit = 'none'; }
    props.vertical = false;
    fire('field', tp.box, rot, op, props);
  }

  /* ---------- 文字ノード ---------- */
  function phOf(node) {
    var d = node.getAttribute && node.getAttribute('data-edit'); if (!d) { var q = node.querySelector && node.querySelector('[data-edit]'); d = q ? q.getAttribute('data-edit') : null; }
    return d === 'hdr' ? '{{ヘッダー}}' : d === 'badge' ? '{{バッジ}}' : d === 'mark' ? '{{マーク}}' : null;
  }
  function emitTextLeaf(node, rot, op, forcedText, anon) {
    var cs = gcs(node), tns = anon ? [anon] : textNodesOf(node), rs = rectsOf(tns), dcs = anon ? cs : gcs(domStyleNode(node));
    if (!rs.length) return;
    var text = forcedText != null ? forcedText : (anon ? anon.nodeValue.replace(/[ \t\r\n\f]+/g, ' ').trim() : textOf(node, cs));
    if (!text) return;
    var ph = anon ? null : phOf(node); if (ph) text = ph;
    var b = boxOf(node, rot), cb = contentBox(node, b, cs), tb = unionRects(rs), lines = lineKnow(rs), vert = /^vertical/.test(cs.writingMode || '');
    if (anon) { cb = { x: tb.x, y: tb.y, w: tb.w, h: tb.h }; }
    var tp = textProps(node, dcs, b, cb, tb, lines, rot, op, vert, cs), p = tp.p, box = tp.box;
    p.text = text; p.vertical = vert;
    if (!vert) {
      p.fit = lines === 1 ? 'shrink' : 'none';
      if (lines > 1) { var extra = box.w * 0.015; if (p.align === 'right') box.x -= extra; else if (p.align === 'center') box.x -= extra / 2; box.w += extra; }
    } else p.fit = 'none';
    fire('text', box, rot, op, p);
  }

  /* ---------- 歩く ---------- */
  function walk(node, inh) {
    var cs = gcs(node);
    if (!visible(node, cs)) return;
    var rot = (inh.rot || 0) + rotOf(cs), op = (inh.op == null ? 1 : inh.op) * (parseFloat(cs.opacity) || 1);
    if (node.classList && node.classList.contains('jt-wm')) { var tp0 = parseFloat(node.style.top); if (isFinite(tp0)) wm = { y: tp0 }; return; }
    if (node.tagName === 'STYLE' || node.tagName === 'SCRIPT') return;
    var b = boxOf(node, rot);
    if (b.w * MM < 0.05 && b.h * MM < 0.05 && !/^(IMG|svg)$/.test(node.tagName)) {
      /* 大きさのない箱：子だけ見る */
      for (var z = node.firstChild; z; z = z.nextSibling) if (z.nodeType === 1) walk(z, { rot: rot, op: op, noText: inh.noText, leaves: inh.leaves });
      return;
    }
    if (node.classList && node.classList.contains('jt-fold')) {
      var em = node.querySelector('em'), sp = node.querySelector('span'), scs = sp ? gcs(sp) : null, ecs = em ? gcs(em) : null;
      var lbl = em ? em.textContent : '', fsz = ecs ? px(ecs.fontSize) * 0.75 : 11;
      fire('fold', { x: b.x, y: b.y + b.h / 2, w: b.w, h: 0 }, 0, op, { label: lbl, size: Math.round(fsz * 10) / 10, color: ecs ? (colorOf(ecs.color, 1, false, true) || '#111827') : '#111827', strokeWidth: scs ? r2(px(scs.borderTopWidth) * 0.75) || 1 : 1, dash: scs && /dot/.test(scs.borderTopStyle) ? 'dotted' : scs && /solid/.test(scs.borderTopStyle) ? 'solid' : 'dashed' });
      return;
    }
    if (node.tagName === 'IMG') {
      emitBox(node, cs, b, rot, op);
      var raw = node.getAttribute('src') || '', abs = ''; try { abs = new URL(raw, location.href).href; } catch (e) {}
      function same(u) { if (!u) return false; try { return new URL(u, location.href).href === abs; } catch (e) { return false; } }
      var src = same(C.imageSrc(V.map, 'map')) ? 'map' : same(C.imageSrc(V.logo, 'logo')) ? 'logo' : srcFrom(raw);
      if (src) fire('image', b, rot, op, { src: src, fit: cs.objectFit === 'cover' ? 'cover' : 'contain', radius: r2(radiusOf(cs, b) * MM) });
      return;
    }
    if (node.tagName.toLowerCase() === 'svg') {
      var cl = node.cloneNode(true); cl.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); cl.setAttribute('width', b.w); cl.setAttribute('height', b.h);
      var xml = new XMLSerializer().serializeToString(cl).replace(/currentColor/g, cs.color);
      fire('image', b, rot, op, { src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml), fit: 'contain' });
      return;
    }
    var itId = node.getAttribute && node.getAttribute('data-item'), it = itId ? JF.itemById(V, itId) : null;
    if (it && !inh.noText) { emitItemNode(node, it, cs, b, rot, op, inh); return; }
    emitBox(node, cs, b, rot, op);
    var nin = { rot: rot, op: op, noText: inh.noText, leaves: inh.leaves };
    if (noteSet && noteSet.has(node)) {
      if (noteSet.get(node) === 0 && !inh.noText) emitNotes();
      return;
    }
    if (isTextBearing(node)) {
      if (inh.noText) { inh.leaves.push({ node: node }); }
      else emitTextLeaf(node, rot, op);
      for (var c2 = node.firstElementChild; c2; c2 = c2.nextElementSibling) {
        var ccs = gcs(c2); if (ccs.display === 'none' || hasOwnText(c2)) continue;
        if (c2.hasAttribute && c2.hasAttribute('data-fe-pseudo')) { if (!inh.noText) walk(c2, nin); continue; }
        walk(c2, nin);
      }
      return;
    }
    for (var c = node.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1) walk(c, nin);
      else if (c.nodeType === 3 && /\S/.test(c.nodeValue)) { if (inh.noText) inh.leaves.push({ node: node, anon: c }); else emitTextLeaf(node, rot, op, null, c); }
    }
  }

  /* ページ自体 */
  var pcs = gcs(page), pb = colorOf(pcs.backgroundColor, 1, true);
  if (pb) bg = pb;
  var pbox = { x: 0, y: 0, w: pr.width, h: pr.height };
  emitBox(page, pcs, pbox, 0, 1, { noBg: true });
  for (var ch = page.firstChild; ch; ch = ch.nextSibling) if (ch.nodeType === 1) walk(ch, { rot: 0, op: 1 });

  /* 多すぎるときは小さな飾りから削る */
  if (out.length > MAXN) {
    var prot = { text: 1, field: 1, image: 1, notes: 1, fold: 1 };
    var cand = out.map(function (e, i) { return { e: e, i: i, a: (e.w || 1) * Math.max(e.h, 0.6) }; }).filter(function (x) { return !prot[x.e.type]; }).sort(function (p, q) { return p.a - q.a; });
    var drop = {}, need = out.length - MAXN;
    for (var d = 0; d < cand.length && need > 0; d++) { drop[cand[d].i] = 1; need--; }
    out = out.filter(function (e, i) { return !drop[i]; });
    if (out.length > MAXN) out = out.slice(0, MAXN);
  }
  return { elements: out, bg: bg, wm: wm, count: out.length };
}

JF.convert = convert;
})(window);
