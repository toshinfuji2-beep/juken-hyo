/* フリーデザイン（自由編集）：A4（210×297mm）に要素を絶対配置するテンプレート。
   要素モデルは DESIGN_FORMAT.md「フリーデザイン」と templates/README.md を参照。
   データ：V.tpl.free = { bg, elements:[…], guides:[…] }（mm・左上原点）。
   エディタ本体は editor/free-editor.js（window.FreeEditor）。ここは「描画」と「要素の正規化」だけ。 */
(function (g) {
'use strict';
var JT = g.JukenTemplates, C = JT.ctx, el = C.el;

var TYPES = ['text', 'field', 'rect', 'ellipse', 'line', 'image', 'notes', 'table', 'fold'];
var TYPE_NAMES = { text: 'テキスト', field: '項目', rect: '四角形', ellipse: '円', line: '線', image: '画像', notes: '注意事項', table: '情報テーブル', fold: '折り線' };
var JF_ = g.JukenFonts, JTX = g.JukenText;
/* 書体：フォント一覧（templates/fonts.js）から。旧id（gothic/mincho/maru/sans-en）も一覧の別名として同じ見た目で使える */
function fcss(id) { return JF_.css(JF_.valid(id) ? id : 'gothic'); }
var FONTS = {}; ['gothic', 'mincho', 'maru', 'sans-en'].forEach(function (k) { FONTS[k] = JF_.css(k); });
var FONT_NAMES = JF_.names();
function loadFonts() { }   /* 互換：読み込みは描画時に使うフォントだけ JukenFonts.use で行う */

/* ---------- 要素の既定値（キー＝要素が持つプロパティ。型は既定値の型で決まる） ---------- */
var TXT = { font: 'gothic', size: 14, weight: 400, italic: false, underline: false, strike: false, color: '#111827', align: 'left', valign: 'top', lineHeight: 1.4, letterSpacing: 0, vertical: false, fit: 'none', bg: '', padding: 0 };
var DEF = {
  text: Object.assign({ x: 15, y: 15, w: 80, h: 12, text: 'テキストを入力' }, TXT),
  field: Object.assign({}, TXT, { x: 15, y: 15, w: 80, h: 20, itemId: '', showLabel: true, labelText: '', labelSize: 8, labelColor: '#6b7280', labelPos: 'top', size: 20, weight: 700, valign: 'middle', lineHeight: 1.3, fit: 'shrink', vertical: false, ruby: '', rubyScale: 0.45 }),
  rect: { x: 15, y: 15, w: 60, h: 30, fill: '#e5e7eb', stroke: '#1f2937', strokeWidth: 0, radius: 0, dash: 'solid' },
  ellipse: { x: 15, y: 15, w: 40, h: 40, fill: '#e5e7eb', stroke: '#1f2937', strokeWidth: 0, dash: 'solid' },
  line: { x: 15, y: 15, w: 60, h: 0, stroke: '#1f2937', strokeWidth: 1, dash: 'solid' },
  image: { x: 15, y: 15, w: 50, h: 50, src: '', fit: 'contain', radius: 0 },
  notes: { x: 15, y: 156, w: 112, h: 124, title: '注意事項', size: 9.5, color: '#111827', accentColor: 'accent', bullet: 'number', lineHeight: 1.5, fit: 'shrink' },
  table: { x: 15, y: 60, w: 180, h: 60, itemIds: [], borderColor: 'accent', labelBg: '#f3f4f6', labelColor: '#374151', color: '#111827', size: 12, rowGap: 1.5, itemSize: false },
  fold: { x: 0, y: 148.5, w: 210, h: 0, label: '＜山折り＞', size: 11, color: '#111827', strokeWidth: 1, dash: 'dashed' }
};
var SEL = { align: ['left', 'center', 'right', 'justify'], valign: ['top', 'middle', 'bottom'], dash: ['solid', 'dashed', 'dotted'], bullet: ['number', 'dot', 'none'], labelPos: ['top', 'left'] };
var COLK = { color: 1, bg: 1, fill: 1, stroke: 1, labelColor: 1, accentColor: 1, borderColor: 1, labelBg: 1 };
var RANGE = { size: [1, 500], weight: [100, 900], lineHeight: [0.5, 5], letterSpacing: [-1, 10], padding: [0, 100], strokeWidth: [0, 50], radius: [0, 200], labelSize: [1, 200], rowGap: [0, 50], rubyScale: [0.2, 1] };

function num(v, d, lo, hi) { v = +v; if (typeof v !== 'number' || !isFinite(v)) v = d; if (lo != null && v < lo) v = lo; if (hi != null && v > hi) v = hi; return v; }
function pick(v, list, d) { return list.indexOf(v) >= 0 ? v : d; }
function col(v, d) {
  if (typeof v !== 'string') return d;
  if (v === '' || v === 'transparent' || v === 'accent' || v === 'secondary' || /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(v)) return v;
  return d;
}
function srcOk(v) { return typeof v === 'string' && (v === '' || v === 'map' || v === 'logo' || /^data:image\//i.test(v) || /^assets\/[\w.\/-]+$/.test(v)) ? v : ''; }
var seq = 0;
function newId() { return 'e' + Math.random().toString(36).slice(2, 7) + (seq++).toString(36); }

function normProp(t, k, v, dv) {
  if (k === 'font') return JF_.valid(v) ? v : (JF_.valid(dv) ? dv : 'gothic');
  if (k === 'fit') return pick(v, t === 'image' ? ['contain', 'cover'] : ['none', 'shrink'], dv);
  if (SEL[k]) return pick(v, SEL[k], dv);
  if (COLK[k]) return col(v, dv);
  if (k === 'src') return srcOk(v);
  if (k === 'itemIds') return Array.isArray(v) ? v.filter(function (s) { return typeof s === 'string'; }).slice(0, 60) : [];
  if (typeof dv === 'number') { var r = RANGE[k] || [-1e4, 1e4]; return num(v, dv, r[0], r[1]); }
  if (typeof dv === 'boolean') return typeof v === 'boolean' ? v : dv;
  if (typeof dv === 'string') return typeof v === 'string' ? (v.length > 5000 ? JTX.first(v, 5000) : v) : dv;
  return dv;
}
/* 要素1つを正規化（不正な値は既定値に。型が不明なら null） */
function normElement(x, seen) {
  if (!x || typeof x !== 'object' || Array.isArray(x) || TYPES.indexOf(x.type) < 0) return null;
  seen = seen || {};
  var t = x.type, d = DEF[t], e = { id: typeof x.id === 'string' && x.id && !seen[x.id] ? x.id.slice(0, 40) : newId(), type: t };
  seen[e.id] = 1;
  e.x = num(x.x, d.x, -2000, 2000); e.y = num(x.y, d.y, -2000, 2000);
  e.w = num(x.w, d.w, 0, 2000); e.h = (t === 'line' || t === 'fold') ? 0 : num(x.h, d.h, 0, 2000);
  e.rot = num(x.rot, 0, -360, 360); e.opacity = num(x.opacity, 1, 0, 1);
  e.locked = x.locked === true; e.hidden = x.hidden === true;
  e.name = typeof x.name === 'string' && x.name ? JTX.first(x.name, 60) : TYPE_NAMES[t];
  Object.keys(d).forEach(function (k) { if (k === 'x' || k === 'y' || k === 'w' || k === 'h') return; e[k] = normProp(t, k, x[k], d[k]); });
  if (typeof x.groupId === 'string' && x.groupId) e.groupId = x.groupId.slice(0, 40);   /* 同じ groupId を持つ要素が1つのグループ */
  return e;
}
function normElements(arr) {
  if (!Array.isArray(arr)) return [];
  var seen = {}, out = [];
  arr.slice(0, 600).forEach(function (x) { var e = normElement(x, seen); if (e) out.push(e); });
  var gn = {}; out.forEach(function (e) { if (e.groupId) gn[e.groupId] = (gn[e.groupId] || 0) + 1; });
  out.forEach(function (e) { if (e.groupId && gn[e.groupId] < 2) delete e.groupId; });   /* 1つだけのグループは解除 */
  return out;
}
function normGuides(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(function (x) { return x && (x.axis === 'x' || x.axis === 'y') && isFinite(+x.pos); }).slice(0, 60).map(function (x) { return { axis: x.axis, pos: +x.pos }; });
}
function newElement(type, props) { var o = Object.assign({ type: type }, props || {}); delete o.id; return normElement(o, {}); }
/* 当たり判定・描画に使う矩形（線と折り線は高さ3mmの帯にする） */
function geom(e) { return (e.type === 'line' || e.type === 'fold') ? { x: e.x, y: e.y - 1.5, w: e.w, h: 3 } : { x: e.x, y: e.y, w: e.w, h: e.h }; }
/* 回転後の外接矩形 */
function aabb(e) {
  var q = geom(e), cx = q.x + q.w / 2, cy = q.y + q.h / 2, r = (e.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), xs = [], ys = [];
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (k) { var lx = k[0] * q.w / 2, ly = k[1] * q.h / 2; xs.push(cx + lx * c - ly * s); ys.push(cy + lx * s + ly * c); });
  var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, r: x1, b: y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/* ---------- 差し込み（{{項目名}} / {{ヘッダー}} {{バッジ}} {{マーク}}） ---------- */
var PH = /\{\{\s*([^{}]+?)\s*\}\}/g;
function normLabel(s) { return String(s == null ? '' : s).replace(/[\s　]/g, '').toLowerCase(); }
function lookup(V, label) { var n = normLabel(label); for (var i = 0; i < V.items.length; i++) if (normLabel(V.items[i].label) === n) return V.items[i]; return null; }
function itemById(V, id) { for (var i = 0; i < V.items.length; i++) if (V.items[i].id === id) return V.items[i]; return null; }
function itemText(it, st) { return it.source === 'schedule' ? C.sched(it).map(function (r) { return (r.t + ' ' + r.c).trim(); }).join('\n') : C.value(it, st); }
function special(V, k) { return k === 'ヘッダー' ? (V.hdr || '') : k === 'バッジ' ? (V.badgeOn ? V.badge || '' : '') : k === 'マーク' ? (V.markOn ? V.mark || '' : '') : null; }
function resolveText(text, V, st) {
  return String(text == null ? '' : text).replace(PH, function (m, k) { var sp = special(V, k); if (sp !== null) return sp; var it = lookup(V, k); return it ? itemText(it, st) : ''; });
}
function placeholders(V) { return ['ヘッダー', 'バッジ', 'マーク'].concat(V.items.map(function (i) { return i.label; }).filter(Boolean)); }
function isKnownPh(V, k) { return special(V, k) !== null || !!lookup(V, k); }

/* ---------- 描画 ---------- */
function mm(n) { return (Math.round(n * 1000) / 1000) + 'mm'; }
function rc(v, V) { if (v === 'accent') return V.accent; if (v === 'secondary') return V.secondary; return v || 'transparent'; }
function base(e, cls) {
  var d = el('div', 'fz ' + cls), q = geom(e);
  d.setAttribute('data-eid', e.id);
  d.style.left = mm(q.x); d.style.top = mm(q.y); d.style.width = mm(q.w); d.style.height = mm(q.h);
  if (e.rot) d.style.transform = 'rotate(' + e.rot + 'deg)';
  if (e.opacity < 1) d.style.opacity = e.opacity;
  return d;
}
var JUST = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
function textStyle(n, e, V) {
  n.style.fontFamily = fcss(e.font); n.style.fontSize = e.size + 'pt'; n.style.fontWeight = e.weight;
  n.style.color = rc(e.color, V); n.style.textAlign = e.align; n.style.lineHeight = e.lineHeight;
  if (e.letterSpacing) n.style.letterSpacing = e.letterSpacing + 'em';
  if (e.italic) n.style.fontStyle = 'italic';
  if (e.underline || e.strike) n.style.textDecoration = (e.underline ? 'underline ' : '') + (e.strike ? 'line-through' : '');
}
function chips(n, text, V) {
  var last = 0, m, re = new RegExp(PH.source, 'g');
  while ((m = re.exec(text))) {
    if (m.index > last) n.appendChild(document.createTextNode(text.slice(last, m.index)));
    var c = el('span', 'fz-chip' + (isKnownPh(V, m[1]) ? '' : ' bad'), '{{' + m[1] + '}}'); c.setAttribute('data-ph', m[1]); n.appendChild(c);
    last = m.index + m[0].length;
  }
  if (last < text.length) n.appendChild(document.createTextNode(text.slice(last)));
}
/* 縦書き：writing-mode は html2canvas（PDF）で崩れるため、1文字ずつ縦に積んだ列で組む（右の列から） */
var ROT = /[ー―－—〜~…‥（）()「」『』【】\-]/, SHIFT = /[、。，．]/;
function vText(n, text, e) {
  n.style.display = 'flex'; n.style.flexDirection = 'row-reverse'; n.style.height = '100%'; n.style.gap = Math.max(0, e.lineHeight - 1) + 'em'; n.style.lineHeight = '1';
  var jc = { left: 'flex-start', center: 'center', right: 'flex-end' }[e.align] || 'flex-start';
  String(text).split(/\n/).forEach(function (ln) {
    var col = el('div', 'fz-vc'); col.style.cssText = 'display:flex;flex-direction:column;justify-content:' + jc + ';width:1em;flex:none;align-items:center';
    JTX.seg(ln).forEach(function (ch) {
      var c = el('span', null, ch); c.style.cssText = 'display:block;height:1em;width:1em;text-align:center;line-height:1;flex:none;margin-bottom:' + (e.letterSpacing || 0) + 'em';
      if (ROT.test(ch)) c.style.transform = 'rotate(90deg)'; else if (SHIFT.test(ch)) c.style.position = 'relative', c.style.left = '.55em', c.style.top = '-.5em';
      col.appendChild(c);
    });
    n.appendChild(col);
  });
}
/* 差し込み表示：st._raw=すべて項目名で表示 / st._rawIds={要素id:1}=その要素だけ項目名（チップ）で表示。それ以外は実データ */
function isRaw(st, e) { return !!(st._edit && (st._raw || (st._rawIds && st._rawIds[e.id]))); }
function rText(e, V, st, t, edit) {
  var raw = isRaw(st, e), d = base(e, 'fz-text'), n = el('div', 'fz-t');
  d.style.display = 'flex'; if (e.padding) d.style.padding = mm(e.padding); if (e.bg) d.style.background = rc(e.bg, V);
  if (e.vertical) { n.className += ' fz-v'; d.style.justifyContent = { top: 'flex-end', middle: 'center', bottom: 'flex-start' }[e.valign]; }
  else { d.style.alignItems = JUST[e.valign]; n.style.width = '100%'; n.style.whiteSpace = e.fit === 'shrink' ? 'nowrap' : 'pre-wrap'; n.style.overflowWrap = 'anywhere'; }
  textStyle(n, e, V);
  if (e.vertical) vText(n, raw ? e.text : resolveText(e.text, V, st), e);
  else if (raw) chips(n, e.text, V); else n.textContent = resolveText(e.text, V, st);
  d.appendChild(n);
  if (e.fit === 'shrink' && !e.vertical) { n._fitBase = e.size + 'pt'; C.fitText(t, n, 4); }
  return d;
}
function rField(e, V, st, t, edit) {
  var it = itemById(V, e.itemId), d = base(e, 'fz-field');
  if (!it) { if (edit) { d.classList.add('fz-empty'); d.textContent = '項目が未選択（または削除済み）'; } return d; }
  C.item(d, it);
  d.style.display = 'flex'; if (e.padding) d.style.padding = mm(e.padding); if (e.bg) d.style.background = rc(e.bg, V);
  var row = e.labelPos === 'left';
  d.style.flexDirection = row ? 'row' : 'column';
  if (row) d.style.alignItems = JUST[e.valign]; else d.style.justifyContent = JUST[e.valign];
  if (e.showLabel) {
    var lb = el('div', 'fz-fl', e.labelText || it.label);
    lb.style.fontFamily = fcss(e.font); lb.style.fontSize = e.labelSize + 'pt'; lb.style.color = rc(e.labelColor, V); lb.style.lineHeight = 1.3; lb.style.textAlign = e.align; lb.style.whiteSpace = 'nowrap';
    if (row) { lb.style.marginRight = '2.5mm'; lb.style.flex = 'none'; } else lb.style.marginBottom = '0.6mm';
    d.appendChild(lb);
  }
  var v = el('div', 'fz-fv');
  textStyle(v, e, V);
  if (it.source === 'schedule') {
    v.style.whiteSpace = 'nowrap';
    C.sched(it).forEach(function (r) { var s = el('div', 'fz-sr'); s.appendChild(el('span', 'fz-st', r.t)); s.appendChild(el('span', 'fz-sc', r.c)); v.appendChild(s); });
  } else {
    if (isRaw(st, e)) chips(v, '{{' + it.label + '}}', V); else v.textContent = C.value(it, st);
    v.style.whiteSpace = e.fit === 'shrink' ? 'nowrap' : 'pre-wrap'; v.style.overflowWrap = 'anywhere';
    if (e.fit === 'shrink') { v._fitBase = e.size + 'pt'; C.fitText(t, v, 4); }
  }
  var rbIt = e.ruby && e.ruby !== e.itemId ? itemById(V, e.ruby) : null, rbTxt = rbIt && rbIt.source !== 'schedule' ? (isRaw(st, e) ? '' : C.value(rbIt, st)) : '';
  if (rbIt && (rbTxt || isRaw(st, e)) && it.source !== 'schedule') {
    /* ふりがな：氏名の上に小さく（氏名と同じ書体・揃え。はみ出すときは縮小） */
    var wr = el('div', 'fz-fw'), rb = el('div', 'fz-rb');
    textStyle(rb, e, V); rb.style.fontSize = (e.size * e.rubyScale) + 'pt'; rb.style.fontWeight = 400; rb.style.lineHeight = 1.15; rb.style.marginBottom = '.4mm'; rb.style.whiteSpace = 'nowrap'; rb.style.width = '100%';
    if (isRaw(st, e)) chips(rb, '{{' + rbIt.label + '}}', V); else rb.textContent = rbTxt;
    if (e.fit === 'shrink') { rb._fitBase = (e.size * e.rubyScale) + 'pt'; C.fitText(t, rb, 3); }
    wr.style.cssText = row ? 'flex:1;min-width:0' : 'width:100%'; v.style.width = '100%';
    wr.appendChild(rb); wr.appendChild(v); d.appendChild(wr); return d;
  }
  if (row) { v.style.flex = '1'; v.style.minWidth = '0'; } else v.style.width = '100%';
  d.appendChild(v);
  return d;
}
function rShape(e, V) {
  var d = base(e, 'fz-shape');
  d.style.background = rc(e.fill, V);
  if (e.strokeWidth > 0 && e.stroke && e.stroke !== 'transparent') d.style.border = e.strokeWidth + 'pt ' + e.dash + ' ' + rc(e.stroke, V);
  d.style.borderRadius = e.type === 'ellipse' ? '50%' : mm(e.radius || 0);
  return d;
}
function rLine(e, V, label) {
  var d = base(e, label ? 'fz-fold' : 'fz-line'), css = Math.max(0.1, e.strokeWidth) + 'pt ' + e.dash + ' ' + rc(e.type === 'fold' ? e.color : e.stroke, V);
  if (!label) { var i = el('i'); i.style.cssText = 'position:absolute;left:0;right:0;top:50%;height:0;margin-top:-' + (Math.max(0.1, e.strokeWidth) / 2) + 'pt;border-top:' + css; d.appendChild(i); return d; }
  d.style.display = 'flex'; d.style.alignItems = 'center'; d.style.gap = '3mm';
  var a = el('span'); a.style.cssText = 'display:block;flex:1;height:0;border-top:' + css;
  d.appendChild(a);
  if (e.label) { var em = el('em', null, e.label); em.style.cssText = 'flex:none;font-style:normal;white-space:nowrap;line-height:1;font-size:' + e.size + 'pt;color:' + rc(e.color, V) + ';font-family:' + fcss(V.font); d.appendChild(em); var b = el('span'); b.style.cssText = a.style.cssText; d.appendChild(b); }
  return d;
}
function rImage(e, V, st, t, edit) {
  var d = base(e, 'fz-img'), src = e.src === 'map' ? C.imageSrc(V.map, 'map') : e.src === 'logo' ? C.imageSrc(V.logo, 'logo') : e.src;
  d.style.overflow = 'hidden'; if (e.radius) d.style.borderRadius = mm(e.radius);
  if (src) { var i = document.createElement('img'); i.src = src; i.alt = ''; i.draggable = false; i.style.cssText = 'width:100%;height:100%;object-fit:' + e.fit + ';display:block'; d.appendChild(i); }
  else if (edit) { d.classList.add('fz-empty'); d.textContent = e.src === 'map' ? '地図なし' : e.src === 'logo' ? 'ロゴなし' : '画像'; }
  return d;
}
function rNotes(e, V, st, t, edit) {
  var d = base(e, 'fz-notes'), ns = C.notes(V);
  d.style.fontSize = e.size + 'pt'; d.style.color = rc(e.color, V); d.style.lineHeight = e.lineHeight; d.style.overflow = 'hidden';
  var ac = rc(e.accentColor, V);
  if (e.title) { var h = el('div', 'fz-nt', e.title); h.style.cssText = 'font-weight:700;font-size:1.15em;line-height:1.3;margin-bottom:.5em;padding-left:.7em;border-left:.4em solid ' + ac + ';color:' + ac; d.appendChild(h); }
  ns.forEach(function (n, i) {
    var r = el('div', 'fz-nl'); r.style.cssText = 'display:flex;gap:.35em;margin-bottom:.15em' + (n.accent ? ';font-weight:700;color:' + ac : '');
    if (e.bullet !== 'none') { var m = el('span', 'fz-nm', e.bullet === 'number' ? (i + 1) + '.' : '・'); m.style.cssText = 'flex:none;min-width:' + (e.bullet === 'number' ? '1.4em' : '1em') + ';text-align:' + (e.bullet === 'number' ? 'right' : 'left'); r.appendChild(m); }
    var x = el('span', 'fz-ntx', n.text); x.style.cssText = 'flex:1;min-width:0;overflow-wrap:anywhere'; r.appendChild(x); d.appendChild(r);
  });
  if (!ns.length && edit) { var p = el('div', 'fz-empty', '注意事項が空です（詳細編集の「注意事項・画像」で入力）'); p.style.cssText = 'padding:2mm'; d.appendChild(p); }
  if (e.fit === 'shrink') { d._fitBase = e.size + 'pt'; d._fitH = true; C.fitText(t, d, 4); }
  return d;
}
function rowsOf(items) {
  var out = [], q = 0;
  while (q < items.length) { var a = items[q], b = items[q + 1]; if (a.width === 'half' && b && b.width === 'half') { out.push([a, b]); q += 2; } else { out.push([a]); q++; } }
  return out;
}
function rTable(e, V, st, t, edit) {
  var d = base(e, 'fz-table'), items = e.itemIds.map(function (id) { return itemById(V, id); }).filter(Boolean), rows = rowsOf(items), bc = rc(e.borderColor, V);
  d.style.fontSize = e.size + 'pt'; d.style.color = rc(e.color, V); d.style.border = '.45mm solid ' + bc; d.style.display = 'grid'; d.style.overflow = 'hidden';
  d.style.fontFamily = 'inherit';
  if (!rows.length) { if (edit) { d.classList.add('fz-empty'); d.textContent = '表示する項目を選んでください'; } return d; }
  d.style.gridTemplateRows = rows.map(function (r) { return (r.length === 1 && r[0].source === 'schedule' ? Math.max(1, C.sched(r[0]).length) : 1) + 'fr'; }).join(' ');
  rows.forEach(function (r, ri) {
    var tr = el('div', 'fz-tr'); tr.style.cssText = 'display:flex;min-height:0;' + (ri ? 'border-top:.25mm solid ' + bc : '');
    r.forEach(function (it, ci) {
      var c = C.item(el('div', 'fz-tc'), it); c.style.cssText = 'flex:1;min-width:0;display:flex;min-height:0;' + (ci ? 'border-left:.25mm solid ' + bc : '');
      var l = el('div', 'fz-tl', it.label); l.style.cssText = 'flex:none;width:' + (r.length === 2 ? '36%' : '26%') + ';display:flex;align-items:center;padding:' + mm(e.rowGap) + ' 2mm;font-size:.82em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:' + rc(e.labelBg, V) + ';color:' + rc(e.labelColor, V);
      var v = el('div', 'fz-tv'); v.style.cssText = 'flex:1;min-width:0;display:flex;align-items:center;padding:' + mm(e.rowGap) + ' 2.5mm;white-space:nowrap;' + (it.color === 'accent' ? 'font-weight:700;color:' + V.accent : '');
      if (it.source === 'schedule') {
        var w = el('div'); w.style.cssText = 'line-height:1.35';
        C.sched(it).forEach(function (s) { w.appendChild(el('div', null, (s.t + '　' + s.c).trim())); }); v.appendChild(w);
      } else { var tx = el('div'); if (st._edit && st._raw) chips(tx, '{{' + it.label + '}}', V); else tx.textContent = C.value(it, st); var fsz = e.itemSize ? ({ S: 0.8, M: 1, L: 1.2, XL: 1.4 }[it.size] || 1) + 'em' : ''; tx.style.cssText = 'flex:1;min-width:0;overflow:hidden' + (fsz ? ';font-size:' + fsz : ''); v.appendChild(tx); tx._fitBase = fsz; C.fitText(t, tx, 5); }
      c.appendChild(l); c.appendChild(v); tr.appendChild(c);
    });
    d.appendChild(tr);
  });
  return d;
}
function renderEl(e, V, st, t, edit) {
  switch (e.type) {
    case 'text': return rText(e, V, st, t, edit);
    case 'field': return rField(e, V, st, t, edit);
    case 'rect': case 'ellipse': return rShape(e, V);
    case 'line': return rLine(e, V, false);
    case 'fold': return rLine(e, V, true);
    case 'image': return rImage(e, V, st, t, edit);
    case 'notes': return rNotes(e, V, st, t, edit);
    case 'table': return rTable(e, V, st, t, edit);
  }
  return null;
}

/* 受験番号・氏名（漢字）・カナ氏名の拾い方。漢字の氏名が表示されていればそれを主役にし、カナも表示されていれば「ふりがな」として上に小さく付ける */
var KANA_RE = /カナ|ｶﾅ|フリガナ|ふりがな/;
function nameItems(V) {
  var find = function (re, not) { return C.findItem(V, re, not); };
  var no = find(/受験番号/), nm = find(/氏名|名前/, KANA_RE), kana = find(KANA_RE), vis = function (i) { return i && !i.hidden; }, kn, ruby = null;
  if (vis(nm)) { kn = nm; if (vis(kana)) ruby = kana; } else kn = kana || nm;
  if (kn === no) kn = null;
  return { no: no, kn: kn, ruby: ruby };
}

/* ---------- 初期レイアウト（新しい白紙のフリーデザインに入れる、ほどよい見本） ---------- */
function starter(V) {
  var els = [], ft = JF_.valid(V.font) ? V.font : 'gothic';
  function add(t, p) { var e = newElement(t, p); if (e) els.push(e); return e; }
  function find(re, not) { return C.findItem(V, re, not); }
  var nmI = nameItems(V), no = nmI.no, kn = nmI.kn, ruby = nmI.ruby;
  add('text', { name: 'タイトル', x: 15, y: 11, w: 180, h: 14, text: '{{ヘッダー}}', size: 20, weight: 700, color: 'accent', valign: 'middle', font: ft, fit: 'shrink' });
  add('line', { name: 'タイトル罫線', x: 15, y: 27.5, w: 180, stroke: 'accent', strokeWidth: 1.5 });
  if (no) add('field', { name: no.label, x: 15, y: 33, w: 82, h: 22, itemId: no.id, size: 30, font: ft });
  if (kn && kn !== no) add('field', { name: kn.label, x: 104, y: 33, w: 91, h: 22, itemId: kn.id, size: 20, font: ft, ruby: ruby ? ruby.id : '' });
  var rest = V.items.filter(function (i) { return !i.hidden && i !== no && i !== kn && i !== ruby; });
  if (rest.length) {
    var rows = rowsOf(rest), wsum = 0;
    rows.forEach(function (r) { wsum += r.length === 1 && r[0].source === 'schedule' ? Math.max(1, C.sched(r[0]).length) : 1; });
    add('table', { name: '情報テーブル', x: 15, y: 60, w: 180, h: Math.max(20, Math.min(78, wsum * 10.5)), itemIds: rest.map(function (i) { return i.id; }), font: ft });
  }
  if (V.foldOn !== false) add('fold', { name: '折り線', y: 148.5, label: V.foldLabel == null ? '＜山折り＞' : V.foldLabel });
  add('notes', { name: '注意事項', x: 15, y: 156, w: 112, h: 124, title: V.noteTitle || '' });
  add('image', { name: '地図', x: 133, y: 156, w: 62, h: 62, src: 'map' });
  return els;
}

/* ---------- スターターレイアウト（テンプレタブの「ひな形」） ---------- */
function layoutBase(V) {
  var nmI = nameItems(V), no = nmI.no, kn = nmI.kn, ruby = nmI.ruby;
  var rest = V.items.filter(function (i) { return !i.hidden && i !== no && i !== kn && i !== ruby; });
  return { ft: JF_.valid(V.font) ? V.font : 'gothic', no: no, kn: kn, ruby: ruby, rest: rest, rows: rowsOf(rest) };
}
function tableH(rows) { var w = 0; rows.forEach(function (r) { w += r.length === 1 && r[0].source === 'schedule' ? Math.max(1, C.sched(r[0]).length) : 1; }); return Math.max(20, Math.min(78, w * 10.5)); }
function lowerHalf(els, V, add, o) {
  if (V.foldOn !== false) add('fold', { name: '折り線', y: 148.5, label: V.foldLabel == null ? '＜山折り＞' : V.foldLabel });
  if (o && o.card) add('rect', { name: '注意事項の枠', x: 13, y: 154, w: 116, h: 130, fill: '#ffffff', stroke: 'accent', strokeWidth: 1, radius: 3 });
  add('notes', { name: '注意事項', x: o && o.card ? 17 : 15, y: o && o.card ? 158 : 156, w: o && o.card ? 108 : 112, h: o && o.card ? 122 : 124, title: V.noteTitle || '' });
  add('image', { name: '地図', x: 133, y: 156, w: 62, h: 62, src: 'map' });
}
var LAYOUTS = [
  { id: 'simple-v', name: 'シンプル縦型', desc: 'タイトル・番号・氏名を縦に並べた基本形',
    build: function (V) {
      var els = [], b = layoutBase(V);
      function add(t, p) { var e = newElement(t, p); if (e) els.push(e); return e; }
      add('text', { name: 'タイトル', x: 15, y: 12, w: 180, h: 12, text: '{{ヘッダー}}', size: 18, weight: 700, color: 'accent', valign: 'middle', font: b.ft, fit: 'shrink' });
      add('line', { name: 'タイトル罫線', x: 15, y: 27, w: 180, stroke: 'accent', strokeWidth: 1.2 });
      if (b.no) add('field', { name: b.no.label, x: 15, y: 32, w: 180, h: 15, itemId: b.no.id, size: 26, font: b.ft, labelPos: 'left', labelSize: 9 });
      if (b.kn) add('field', { name: b.kn.label, x: 15, y: 49, w: 180, h: 13, itemId: b.kn.id, ruby: b.ruby ? b.ruby.id : '', size: 18, font: b.ft, labelPos: 'left', labelSize: 9 });
      if (b.rest.length) add('table', { name: '情報テーブル', x: 15, y: 68, w: 180, h: tableH(b.rows), itemIds: b.rest.map(function (i) { return i.id; }), font: b.ft });
      lowerHalf(els, V, add);
      return els;
    } },
  { id: 'two-card', name: '2段カード', desc: '帯のタイトルと、角丸カードに入れた番号・氏名・表',
    build: function (V) {
      var els = [], b = layoutBase(V);
      function add(t, p) { var e = newElement(t, p); if (e) els.push(e); return e; }
      add('rect', { name: 'タイトル帯', x: 0, y: 0, w: 210, h: 26, fill: 'accent' });
      add('text', { name: 'タイトル', x: 15, y: 6, w: 180, h: 14, text: '{{ヘッダー}}', size: 20, weight: 700, color: '#ffffff', valign: 'middle', font: b.ft, fit: 'shrink' });
      add('rect', { name: '番号カード', x: 15, y: 33, w: 86, h: 26, fill: 'secondary', radius: 4 });
      add('rect', { name: '氏名カード', x: 109, y: 33, w: 86, h: 26, fill: 'secondary', radius: 4 });
      if (b.no) add('field', { name: b.no.label, x: 19, y: 35, w: 78, h: 22, itemId: b.no.id, size: 28, font: b.ft });
      if (b.kn) add('field', { name: b.kn.label, x: 113, y: 35, w: 78, h: 22, itemId: b.kn.id, ruby: b.ruby ? b.ruby.id : '', size: 18, font: b.ft });
      if (b.rest.length) {
        add('rect', { name: '情報カード', x: 15, y: 66, w: 180, h: tableH(b.rows) + 6, fill: '#ffffff', stroke: 'accent', strokeWidth: 1, radius: 4 });
        add('table', { name: '情報テーブル', x: 18, y: 69, w: 174, h: tableH(b.rows), itemIds: b.rest.map(function (i) { return i.id; }), font: b.ft, borderColor: '#d1d5db', labelBg: '' });
      }
      lowerHalf(els, V, add, { card: true });
      return els;
    } },
  { id: 'big-no', name: '大きな受験番号', desc: '受験番号を特大で見せる、番号重視のレイアウト',
    build: function (V) {
      var els = [], b = layoutBase(V);
      function add(t, p) { var e = newElement(t, p); if (e) els.push(e); return e; }
      add('text', { name: 'タイトル', x: 15, y: 10, w: 180, h: 11, text: '{{ヘッダー}}', size: 16, weight: 700, color: 'accent', valign: 'middle', font: b.ft, fit: 'shrink' });
      add('rect', { name: '番号の枠', x: 15, y: 24, w: 180, h: 38, fill: '#ffffff', stroke: 'accent', strokeWidth: 2.5, radius: 2 });
      if (b.no) add('field', { name: b.no.label, x: 19, y: 26, w: 172, h: 34, itemId: b.no.id, size: 60, font: b.ft, align: 'center', labelPos: 'top', labelSize: 9 });
      if (b.kn) add('field', { name: b.kn.label, x: 15, y: 66, w: 180, h: 12, itemId: b.kn.id, ruby: b.ruby ? b.ruby.id : '', size: 18, font: b.ft, align: 'center', showLabel: false });
      if (b.rest.length) add('table', { name: '情報テーブル', x: 15, y: 82, w: 180, h: Math.min(60, tableH(b.rows)), itemIds: b.rest.map(function (i) { return i.id; }), font: b.ft, size: 11 });
      lowerHalf(els, V, add);
      return els;
    } }
];

JT.register({
  id: 'free',
  name: 'フリーデザイン',
  category: '自由編集',
  description: 'A4に文字・図形・画像・項目を自由に配置して作るデザイン（「デザイン編集」で作成）。',
  swatch: ['#ffffff', '#1e40af', '#e5e7eb'],
  defaults: { accent: '#1e40af', secondary: '#e8edf3', font: 'gothic', hdr: '○○模試　受験票', noteTitle: '注意事項' },
  uses: ['header', 'badge', 'mark', 'accent', 'secondary', 'font', 'notes', 'images', 'wm'],
  extras: [
    { k: 'bg', type: 'color', label: 'ページの背景色', def: '#ffffff', hidden: true },
    { k: 'elements', type: 'json', def: [], hidden: true, norm: normElements },
    { k: 'guides', type: 'json', def: [], hidden: true, norm: normGuides }
  ],
  render: function (st, V, Cx) {
    var F = V.tpl.free, edit = !!st._edit, t = Cx.page('free', V);
    t.style.background = F.bg || '#ffffff';
    JF_.use(V.font); F.elements.forEach(function (e) { if (!e.hidden && e.font) JF_.use(e.font); });
    F.elements.forEach(function (e) { if (e.hidden) return; var n = renderEl(e, V, st, t, edit); if (n) t.appendChild(n); });
    var wm = Cx.watermark(V, { top: 0, height: 297 }); if (wm) t.appendChild(wm);
    return t;
  },
  styles: [
    '.tpl-free{padding:0;display:block;font-family:"Noto Sans JP","Yu Gothic","Hiragino Sans",Meiryo,sans-serif}',
    '.tpl-free .fz{position:absolute;box-sizing:border-box;transform-origin:50% 50%}',
    '.tpl-free .fz *{box-sizing:border-box}',
    '.tpl-free .fz-img img{-webkit-user-drag:none;user-select:none}',
    '.tpl-free .fz-empty{display:flex;align-items:center;justify-content:center;border:.3mm dashed #9ca3af;color:#9ca3af;font-size:9pt;background:rgba(156,163,175,.08);text-align:center;padding:1mm}',
    '.tpl-free .fz-chip{display:inline-block;background:#e0e7ff;color:#3730a3;border-radius:1mm;padding:0 .3em;line-height:1.25;font-weight:400;letter-spacing:0;white-space:nowrap}',
    '.tpl-free .fz-chip.bad{background:#fee2e2;color:#991b1b}',
    '.tpl-free .fz-sr{display:flex;gap:3mm;white-space:nowrap}',
    '.tpl-free .fz-st{flex:none}'
  ].join('\n')
});

g.JukenFree = {
  TYPES: TYPES, TYPE_NAMES: TYPE_NAMES, FONTS: FONTS, FONT_NAMES: FONT_NAMES, fcss: fcss, DEF: DEF, SEL: SEL,
  normElement: normElement, normElements: normElements, normGuides: normGuides, newElement: newElement, newId: newId,
  starter: starter, LAYOUTS: LAYOUTS, geom: geom, aabb: aabb, resolveText: resolveText, placeholders: placeholders, itemById: itemById, rowsOf: rowsOf, rc: rc, loadFonts: loadFonts
};
})(window);
