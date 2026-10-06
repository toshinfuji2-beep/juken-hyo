/* フリーデザイン エディタ（Canva風）。window.FreeEditor
   使い方：index.html が FreeEditor.init(host) でホスト機能（V・保存・履歴・画像選択など）を渡し、
   「デザイン編集」ボタンから FreeEditor.open() を呼ぶ。描画は templates/free.js（JT.render('free')）をそのまま使うので、
   エディタ上の見た目と印刷・PDF・サムネイルは同じ。要素モデルは DESIGN_FORMAT.md 参照。 */
(function (g) {
'use strict';
var FE = g.FreeEditor = {};
var JF = g.JukenFree, JT = g.JukenTemplates, C = JT.ctx;
var PXMM = 96 / 25.4, PW = 210, PH = 297;
var H = null, root = null, R = {}, pop = null;
var S = { open: false, sel: [], zoom: 1, fit: 'c', grid: false, snap: true, raw: false, preview: false, pidx: 0, tab: 'text', clip: null, editing: null, ro: false, addN: 0, pasteN: 0, st: { s: '', t: '' }, lopen: false, rcol: false, hover: '', rowSel: null, rawKey: '', nt: '', hb: null };
var drag = null, layDrag = '';
var PAL_CHIC = ['#000000', '#1f2937', '#1e3a5f', '#5b4636', '#14532d', '#7f1d1d', '#9a8c73', '#e5e7eb'];
var PAL_POP = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
var RECENT_KEY = 'juken-free-recent', UI_KEY = 'juken-free-ui';

/* ---------- 小道具 ---------- */
function esc(s) { return C.esc(s); }
function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function tx(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function $(s, r) { return (r || root).querySelector(s); }
function V() { return H.V(); }
function F() { return H.V().tpl.free; }
function elems() { return F().elements; }
function find(id) { var a = elems(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
function selEls() { return S.sel.map(find).filter(Boolean); }
function sz() { return PXMM * S.zoom; }
function r2(n) { return Math.round(n * 100) / 100; }
function clamp(v, lo, hi) { if (lo != null && v < lo) v = lo; if (hi != null && v > hi) v = hi; return v; }
function nodeOf(id) { return R.pg ? R.pg.querySelector('[data-eid="' + id + '"]') : null; }
function ic(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || '') + '</svg>'; }
function ibtn(icon, title, fn, cls) { var b = h('button', 'fe-ib' + (cls ? ' ' + cls : ''), ic(icon)); b.type = 'button'; b.setAttribute('data-tip', title); b.setAttribute('aria-label', title); if (fn) b.onclick = fn; return b; }
/* 文字つきの小さなボタン（上のツールバー用） */
function lbtn(icon, label, tip, fn, cls) { var b = h('button', 'fe-lb' + (cls ? ' ' + cls : ''), ic(icon) + '<span>' + esc(label) + '</span>'); b.type = 'button'; b.setAttribute('data-tip', tip || label); if (fn) b.onclick = fn; return b; }
function loadUI() { try { var o = JSON.parse(localStorage.getItem(UI_KEY) || 'null'); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } }
function saveUI() { try { localStorage.setItem(UI_KEY, JSON.stringify({ lopen: S.lopen, rcol: S.rcol, tab: S.tab, grid: S.grid, snap: S.snap })); } catch (e) {} }
/* 日本語のツールチップ（title の代わり。すぐ出て、見やすい） */
var TT = null, ttTimer = 0;
function ttHide() { clearTimeout(ttTimer); if (TT) { TT.remove(); TT = null; } }
function ttShow(el) {
  var t = el.getAttribute('data-tip'); if (!t || !el.isConnected) return; ttHide();
  TT = tx('div', 'fe-tt', t); root.appendChild(TT); var r = el.getBoundingClientRect(), w = TT.offsetWidth, hh = TT.offsetHeight;
  TT.style.left = clamp(r.left + r.width / 2 - w / 2, 6, innerWidth - w - 6) + 'px'; TT.style.top = (r.bottom + 8 + hh < innerHeight - 4 ? r.bottom + 8 : Math.max(4, r.top - hh - 8)) + 'px';
}
function tipify(c) { Array.prototype.forEach.call((c || root).querySelectorAll('[title]'), function (e) { e.setAttribute('data-tip', e.getAttribute('title')); e.removeAttribute('title'); if (!e.getAttribute('aria-label') && e.tagName === 'BUTTON' && !e.textContent.trim()) e.setAttribute('aria-label', e.getAttribute('data-tip')); }); }
function tbtn(icon, label, fn, cls) { var b = h('button', 'fe-tb' + (cls ? ' ' + cls : ''), (icon ? ic(icon) : '') + '<span>' + esc(label) + '</span>'); b.type = 'button'; if (fn) b.onclick = fn; return b; }
function resolveColor(c) { return JF.rc(c, V()); }

var IC = {
  tpl: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  shape: '<rect x="3" y="3" width="8" height="8" rx="1"/><circle cx="17" cy="7" r="4"/><path d="M7 14l4 7H3zM14 14h7v7h-7z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
  elements: '<rect x="4" y="3" width="16" height="6" rx="1.5"/><path d="M4 13h16M4 17h16M4 21h10"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18M10.6 6.1A10 10 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.2 4M6.5 6.8C3.7 8.6 2 12 2 12s4 7 10 7a9.7 9.7 0 004.2-1M9.9 9.9a3 3 0 004.2 4.2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 017.5-2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>',
  front: '<rect x="8" y="8" width="12" height="12" rx="1.5" fill="currentColor" fill-opacity=".18"/><path d="M4 14V5a1 1 0 011-1h9"/>',
  back: '<rect x="4" y="4" width="12" height="12" rx="1.5"/><path d="M20 10v9a1 1 0 01-1 1h-9" /><rect x="10" y="10" width="10" height="10" rx="1.5" fill="currentColor" fill-opacity=".18" stroke="none"/>',
  al: '<path d="M4 3v18"/><rect x="7" y="6" width="12" height="4" rx="1"/><rect x="7" y="14" width="7" height="4" rx="1"/>',
  ac: '<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>',
  ar: '<path d="M20 3v18"/><rect x="5" y="6" width="12" height="4" rx="1"/><rect x="10" y="14" width="7" height="4" rx="1"/>',
  at: '<path d="M3 4h18"/><rect x="6" y="7" width="4" height="12" rx="1"/><rect x="14" y="7" width="4" height="7" rx="1"/>',
  am: '<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>',
  ab: '<path d="M3 20h18"/><rect x="6" y="5" width="4" height="12" rx="1"/><rect x="14" y="10" width="4" height="7" rx="1"/>',
  dh: '<path d="M4 3v18M20 3v18"/><rect x="9" y="7" width="6" height="10" rx="1"/>',
  dv: '<path d="M3 4h18M3 20h18"/><rect x="7" y="9" width="10" height="6" rx="1"/>',
  bold: '<path d="M7 4h6a4 4 0 010 8H7zM7 12h7a4 4 0 010 8H7z"/>',
  tl: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  tc: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  tr: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  vt: '<path d="M4 4h4M6 4v12M13 4h7M16.5 4v16M10 17l-4 3-4-3" transform="translate(2 0)"/>',
  vtop: '<path d="M4 4h16"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  vmid: '<path d="M4 12h16"/><rect x="8" y="5" width="8" height="14" rx="1"/>',
  vbot: '<path d="M4 20h16"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  magnet: '<path d="M6 3v8a6 6 0 0012 0V3h-4v8a2 2 0 01-4 0V3zM6 7h4M14 7h4"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>',
  pin: '<path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  note: '<path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 10h18M3 15h18M10 4v16"/>',
  fold: '<path d="M3 12h4M10 12h4M17 12h4M12 4v4M12 16v4"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/>',
  rotate: '<path d="M20 12a8 8 0 10-3 6.2M20 5v5h-5"/>',
  save: '<path d="M5 4h11l3 3v13H5zM8 4v5h7M8 20v-6h8v6"/>',
  grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  ph: '<path d="M8 4c-2 0-3 1-3 3v2c0 1-1 3-2 3 1 0 2 2 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1 1 3 2 3-1 0-2 2-2 3v2c0 2-1 3-3 3"/>',
  chevL: '<path d="M15 6l-6 6 6 6"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  rect: '<rect x="4" y="5" width="16" height="14" rx="1"/>',
  round: '<rect x="4" y="5" width="16" height="14" rx="6"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  line: '<path d="M4 12h16"/>',
  dashed: '<path d="M3 12h4M10 12h4M17 12h4"/>',
  blank: '<rect x="5" y="3" width="14" height="18" rx="1.5"/>',
  starter: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M8 7h8M8 11h3M13 11h3M8 15h8"/>',
  pt: '<path d="M4 7h16M10 4v16"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  fx: '<path d="M4 8V5a1 1 0 011-1h14a1 1 0 011 1v3M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3M8 12h8"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.4 9.2a2.7 2.7 0 015.2.8c0 1.8-2.6 2.2-2.6 3.8M12 17.2h.01"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  chevD: '<path d="M6 9l6 6 6-6"/>',
  styl: '<path d="M4 19l5.5-14L15 19M6 14.5h7M17 7h4M19 5v4"/>',
  page: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 8h6M9 12h6"/>',
  convert: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  panelR: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
  data: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>'
};
var TYPE_ICON = { text: 'text', field: 'ph', rect: 'rect', ellipse: 'circle', line: 'line', image: 'image', notes: 'note', table: 'table', fold: 'fold' };

/* ---------- プロパティ定義（右の「詳細」と上のツールバーを同じ定義から作る） ---------- */
var FONT_OPTS = JF.FONT_NAMES;
var DASH_OPTS = [['solid', '実線'], ['dashed', '破線'], ['dotted', '点線']];
var TXT_S = [
  { k: 'font', t: 'sel', l: 'フォント', opts: FONT_OPTS, ctx: 1, w: 118 },
  { k: 'size', t: 'num', l: 'サイズ', u: 'pt', min: 1, max: 500, step: 0.5, ctx: 1, stp: 1, w: 50 },
  { k: 'weight', t: 'bold', l: '太字', ctx: 1 },
  { k: 'color', t: 'col', l: '文字色', ctx: 1 },
  { k: 'align', t: 'alignh', l: '左右の揃え', ctx: 1 },
  { k: 'valign', t: 'alignv', l: '上下の揃え' },
  { k: 'letterSpacing', t: 'num', l: '字間', u: 'em', min: -0.5, max: 5, step: 0.05, ctx: 1, cl: '字間', w: 52 },
  { k: 'lineHeight', t: 'num', l: '行間', min: 0.5, max: 4, step: 0.05, ctx: 1, cl: '行間', w: 52 },
  { k: 'vertical', t: 'vert', l: '縦書き', ctx: 1 },
  { k: 'fit', t: 'chk', l: 'はみ出すときは1行で自動縮小', tv: ['none', 'shrink'] },
  { k: 'bg', t: 'col', l: '背景色', none: 1 },
  { k: 'padding', t: 'num', l: '内側の余白', u: 'mm', min: 0, max: 50, step: 0.5 }
];
var SCHEMA = {
  text: [{ k: 'text', t: 'area', l: '内容（{{項目名}} で差し込み）' }].concat(TXT_S),
  field: [{ k: 'itemId', t: 'item', l: '項目' }, { k: 'showLabel', t: 'chk', l: '項目名を表示' }, { k: 'labelText', t: 'text', l: '項目名の文字（空なら項目名）' },
    { k: 'labelPos', t: 'sel', l: '項目名の位置', opts: [['top', '上'], ['left', '左']] }, { k: 'labelSize', t: 'num', l: '項目名のサイズ', u: 'pt', min: 1, max: 200, step: 0.5 }, { k: 'labelColor', t: 'col', l: '項目名の色' }]
    .concat(TXT_S.filter(function (p) { return p.k !== 'vertical'; })),
  rect: [{ k: 'fill', t: 'col', l: '塗り', none: 1, ctx: 1 }, { k: 'stroke', t: 'col', l: '線の色', none: 1, ctx: 1 }, { k: 'strokeWidth', t: 'num', l: '線の太さ', u: 'pt', min: 0, max: 50, step: 0.25, ctx: 1, cl: '太さ', w: 52 },
    { k: 'dash', t: 'sel', l: '線の種類', opts: DASH_OPTS, ctx: 1, w: 74 }, { k: 'radius', t: 'num', l: '角の丸み', u: 'mm', min: 0, max: 200, step: 0.5, ctx: 1, cl: '角丸', w: 52 }],
  ellipse: [{ k: 'fill', t: 'col', l: '塗り', none: 1, ctx: 1 }, { k: 'stroke', t: 'col', l: '線の色', none: 1, ctx: 1 }, { k: 'strokeWidth', t: 'num', l: '線の太さ', u: 'pt', min: 0, max: 50, step: 0.25, ctx: 1, cl: '太さ', w: 52 }, { k: 'dash', t: 'sel', l: '線の種類', opts: DASH_OPTS, ctx: 1, w: 74 }],
  line: [{ k: 'stroke', t: 'col', l: '線の色', ctx: 1 }, { k: 'strokeWidth', t: 'num', l: '線の太さ', u: 'pt', min: 0.1, max: 50, step: 0.25, ctx: 1, cl: '太さ', w: 52 }, { k: 'dash', t: 'sel', l: '線の種類', opts: DASH_OPTS, ctx: 1, w: 74 }],
  image: [{ k: 'src', t: 'imgsrc', l: '画像' }, { k: 'fit', t: 'sel', l: '表示方法', opts: [['contain', '全体を表示'], ['cover', '枠いっぱいに']], ctx: 1, w: 104 }, { k: 'radius', t: 'num', l: '角の丸み', u: 'mm', min: 0, max: 200, step: 0.5, ctx: 1, cl: '角丸', w: 52 }],
  notes: [{ k: 'title', t: 'text', l: '見出し（空なら非表示）' }, { k: 'size', t: 'num', l: '文字サイズ', u: 'pt', min: 1, max: 100, step: 0.5, ctx: 1, stp: 1, w: 50 }, { k: 'color', t: 'col', l: '文字色', ctx: 1 }, { k: 'accentColor', t: 'col', l: '強調色（見出し・「!」の行）', ctx: 1 },
    { k: 'bullet', t: 'sel', l: '行頭の記号', opts: [['number', '番号'], ['dot', '・'], ['none', 'なし']], ctx: 1, w: 74 }, { k: 'lineHeight', t: 'num', l: '行間', min: 0.8, max: 3, step: 0.05, ctx: 1, cl: '行間', w: 52 },
    { k: 'fit', t: 'chk', l: 'はみ出すときは自動で縮小', tv: ['none', 'shrink'] }, { k: 'x_notes', t: 'hint', l: '本文は「詳細編集 > 注意事項・画像」で編集します（行頭「!」で強調）。' }],
  table: [{ k: 'itemIds', t: 'items', l: '表に出す項目' }, { k: 'borderColor', t: 'col', l: '罫線の色', ctx: 1 }, { k: 'labelBg', t: 'col', l: '項目名の背景', none: 1, ctx: 1 }, { k: 'labelColor', t: 'col', l: '項目名の文字色' }, { k: 'color', t: 'col', l: '値の文字色' },
    { k: 'size', t: 'num', l: '文字サイズ', u: 'pt', min: 1, max: 100, step: 0.5, ctx: 1, stp: 1, w: 50 }, { k: 'rowGap', t: 'num', l: 'セルの上下余白', u: 'mm', min: 0, max: 30, step: 0.5 },
    { k: 'itemSize', t: 'chk', l: '項目ごとの文字サイズ（小・大・特大）を反映する' }],
  fold: [{ k: 'label', t: 'text', l: '折り線の文字' }, { k: 'size', t: 'num', l: '文字サイズ', u: 'pt', min: 1, max: 60, step: 0.5, ctx: 1, stp: 1, w: 50 }, { k: 'color', t: 'col', l: '色', ctx: 1 }, { k: 'strokeWidth', t: 'num', l: '線の太さ', u: 'pt', min: 0.1, max: 20, step: 0.25, ctx: 1, cl: '太さ', w: 52 }, { k: 'dash', t: 'sel', l: '線の種類', opts: DASH_OPTS, ctx: 1, w: 74 }]
};

/* ---------- CSS ---------- */
var CSS = [
'#fe{position:fixed;inset:0;z-index:70;display:flex;flex-direction:column;background:var(--bg);color:var(--fg);font:13px/1.45 "Hiragino Sans","Yu Gothic UI","Meiryo",sans-serif}',
'#fe[hidden]{display:none!important}',
'#fe *{box-sizing:border-box}',
'#fe svg{width:18px;height:18px;flex:none}',
'#fe button{font:inherit;color:inherit;background:transparent;border:0;border-radius:8px;padding:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;margin:0}',
'#fe button:hover{background:rgba(127,127,127,.15)}',
'#fe button:disabled{opacity:.35;cursor:default;background:transparent}',
'#fe button.on{background:var(--acs);color:var(--ac)}',
'#fe .fe-ib{width:32px;height:32px;flex:none}',
'#fe .fe-tb{height:34px;padding:0 12px;font-weight:600}',
'#fe .fe-pri{background:var(--ac);color:var(--acfg)}#fe .fe-pri:hover{background:var(--ac);filter:brightness(1.1)}',
'#fe .fe-pri.on{background:var(--ac);color:var(--acfg)}',
'#fe label{display:block;margin:0;font-size:12px;color:var(--mut);white-space:normal}',
'#fe input[type=text],#fe input[type=number],#fe select,#fe textarea{width:100%;height:32px;padding:0 9px;border:1px solid var(--bd);border-radius:8px;background:var(--inp);color:var(--fg);font:inherit;font-size:13px;margin:0}',
'#fe textarea{height:auto;padding:7px 9px;resize:vertical;line-height:1.5}',
'#fe input:focus,#fe select:focus,#fe textarea:focus{outline:2px solid var(--acs);border-color:var(--ac)}',
'#fe input[type=number]{-moz-appearance:textfield;padding-right:4px}',
'.fe-top{display:flex;align-items:center;gap:10px;height:50px;padding:0 14px;background:var(--panel);border-bottom:1px solid var(--bd);flex:none}',
'.fe-ttl{display:flex;flex-direction:column;line-height:1.25;min-width:0}.fe-ttl b{font-size:14px}',
'.fe-ttl span{font-size:11px;color:var(--mut);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.fe-sp{flex:1}',
'.fe-sep{width:1px;height:22px;background:var(--bd);margin:0 4px;flex:none}',
'#fe .fe-sst{height:30px;padding:0 10px;font-size:12px;color:var(--mut);cursor:default;gap:6px}',
'.fe-sst i{width:8px;height:8px;border-radius:50%;background:currentColor;flex:none}',
'.fe-sst[data-s=saved]{color:var(--ok)}.fe-sst[data-s=dirty]{color:var(--warn);cursor:pointer}.fe-sst[data-s=error]{color:var(--err);cursor:pointer}',
'.fe-sst[data-s=saved] i{width:auto;height:auto;background:none;border-radius:0}.fe-sst[data-s=saved] i:before{content:"\\2713";font-weight:700;line-height:1}',
'.fe-ctx{display:flex;align-items:center;gap:6px;height:46px;padding:0 14px;background:var(--panel);border-bottom:1px solid var(--bd);flex:none;overflow-x:auto;overflow-y:hidden;white-space:nowrap}',
'.fe-ctx>*{flex:none}',
'.fe-ctx .fe-hint{color:var(--mut);font-size:12.5px}',
'.fe-ctx .fe-cl{font-size:11px;color:var(--mut);margin:0 -2px 0 2px}',
'.fe-grp{display:inline-flex;gap:2px;padding:2px;background:var(--bg);border-radius:10px}',
'.fe-grp .fe-ib{width:30px;height:28px;border-radius:8px}',
'.fe-main{flex:1;min-height:0;display:flex}',
'.fe-rail{width:74px;flex:none;background:var(--panel);border-right:1px solid var(--bd);display:flex;flex-direction:column;gap:2px;padding:8px 6px;overflow-y:auto}',
'#fe .fe-rail button{flex-direction:column;gap:3px;height:58px;font-size:11px;color:var(--mut);border-radius:10px}',
'#fe .fe-rail button.on{background:var(--acs);color:var(--ac);font-weight:700}',
'.fe-panel{width:276px;flex:none;background:var(--panel);border-right:1px solid var(--bd);overflow-y:auto;padding:4px 16px 24px}',
'.fe-panel h4,.fe-props h4{margin:18px 0 8px;font-size:12px;font-weight:700;color:var(--mut);letter-spacing:.03em}',
'.fe-panel h4:first-child,.fe-props h4:first-child{margin-top:14px}',
'.fe-panel p,.fe-props p{margin:0 0 8px;font-size:12px;color:var(--mut);line-height:1.55}',
'.fe-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
'#fe .fe-card{flex-direction:column;gap:6px;height:76px;border:1px solid var(--bd);border-radius:12px;background:var(--bg);font-size:12px;font-weight:600;white-space:normal;text-align:center;padding:0 4px}',
'#fe .fe-card:hover{border-color:var(--ac);background:var(--acs)}',
'#fe .fe-card svg{width:22px;height:22px}',
'#fe .fe-row{width:100%;justify-content:flex-start;gap:10px;height:auto;min-height:48px;padding:8px 12px;border:1px solid var(--bd);border-radius:12px;background:var(--bg);text-align:left;margin-bottom:8px;white-space:normal}',
'#fe .fe-row:hover{border-color:var(--ac);background:var(--acs)}',
'#fe .fe-row small{display:block;font-size:11px;color:var(--mut);font-weight:400;line-height:1.35}',
'#fe .fe-row b{display:block;font-weight:700}',
'#fe .fe-row.dis{opacity:.55;border-style:dashed;pointer-events:none}',
'.fe-txt-h{font-size:26px;font-weight:700;line-height:1.2}.fe-txt-b{font-size:15px}.fe-txt-s{font-size:11px;color:var(--mut)}',
'.fe-it{display:flex;align-items:center;gap:4px;margin-bottom:4px}',
'#fe .fe-it .fe-itm{flex:1;min-width:0;justify-content:flex-start;height:36px;padding:0 10px;border:1px solid var(--bd);border-radius:10px;background:var(--bg);font-size:13px;overflow:hidden}',
'#fe .fe-it .fe-itm span{overflow:hidden;text-overflow:ellipsis}',
'#fe .fe-it .fe-itm:hover{border-color:var(--ac);background:var(--acs)}',
'#fe .fe-it .fe-ib{width:36px;height:36px;border:1px solid var(--bd);background:var(--bg);border-radius:10px;font-size:12px;color:var(--mut)}',
'.fe-stage{flex:1;min-width:0;position:relative;background:var(--pv);overflow:hidden}',
'.fe-scroll{position:absolute;inset:0;overflow:auto;overscroll-behavior:contain}',
'.fe-world{min-width:100%;min-height:100%;display:flex;padding:38px 40px 40px 46px;width:max-content}',
'.fe-pagebox{position:relative;margin:auto;flex:none}',
'.fe-pg{position:absolute;inset:0;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12),0 8px 28px rgba(0,0,0,.14);overflow:hidden}',
'.fe-pg .ticket{position:absolute;left:0;top:0;transform-origin:0 0;user-select:none;-webkit-user-select:none}',
'.fe-pg .fz{cursor:move}',
'.fe-pg .fz:hover{outline:1.5px solid rgba(124,77,255,.5)}',
'.fe-pg .fz.fz-editing{outline:2px solid #7c4dff;cursor:text}',
'.fe-pg .fz-t[contenteditable]{outline:0;user-select:text;-webkit-user-select:text;cursor:text;min-height:1em;overflow:visible!important}',
'.fe-ov{position:absolute;inset:0;pointer-events:none}',
'.fe-ov.grid{background-image:linear-gradient(to right,rgba(124,77,255,.12) 1px,transparent 1px),linear-gradient(to bottom,rgba(124,77,255,.12) 1px,transparent 1px)}',
'.fe-sel{position:absolute;border:1.5px solid #7c4dff;pointer-events:none}',
'.fe-sel.multi{border-width:1px;border-color:rgba(124,77,255,.75)}',
'.fe-sel.lock{border-style:dashed}',
'.fe-gbox{position:absolute;border:1px dashed #7c4dff;pointer-events:none}',
'.fe-hd{position:absolute;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;background:#fff;border:1.5px solid #7c4dff;border-radius:3px;pointer-events:auto;touch-action:none}',
'.fe-hd[data-h=nw],.fe-hd[data-h=se]{cursor:nwse-resize}.fe-hd[data-h=ne],.fe-hd[data-h=sw]{cursor:nesw-resize}.fe-hd[data-h=n],.fe-hd[data-h=s]{cursor:ns-resize}.fe-hd[data-h=e],.fe-hd[data-h=w]{cursor:ew-resize}',
'.fe-hd[data-h=rot]{width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;cursor:grab;display:flex;align-items:center;justify-content:center;color:#7c4dff;box-shadow:0 1px 4px rgba(0,0,0,.25)}',
'.fe-hd[data-h=rot] svg{width:13px;height:13px}',
'.fe-rotl{position:absolute;left:50%;top:-30px;width:0;height:30px;border-left:1.5px solid #7c4dff;pointer-events:none}',
'.fe-snap{position:absolute;background:#ff2d95;pointer-events:none}',
'.fe-snap.x{width:1px;top:0;bottom:0}.fe-snap.y{height:1px;left:0;right:0}',
'.fe-guide{position:absolute;background:#18c0d8;pointer-events:auto}',
'.fe-guide.x{width:1px;top:0;bottom:0;margin-left:0;cursor:ew-resize}.fe-guide.y{height:1px;left:0;right:0;cursor:ns-resize}',
'.fe-guide:before{content:"";position:absolute;inset:-4px}',
'.fe-mq{position:absolute;border:1px solid #7c4dff;background:rgba(124,77,255,.1);pointer-events:none}',
'.fe-tip{position:absolute;transform:translateX(-50%);background:#111827;color:#fff;font-size:11px;padding:2px 8px;border-radius:6px;white-space:nowrap;pointer-events:none;z-index:3}',
'.fe-ruler{position:absolute;background-color:var(--panel);color:var(--mut);font-size:9px;overflow:hidden;user-select:none;opacity:.95}',
'.fe-ruler.top{left:0;right:0;top:-22px;height:18px;cursor:ns-resize;border-radius:4px}',
'.fe-ruler.left{top:0;bottom:0;left:-26px;width:22px;cursor:ew-resize;border-radius:4px}',
'.fe-ruler span{position:absolute;line-height:1;pointer-events:none}',
'.fe-ruler.top span{top:2px;margin-left:2px}.fe-ruler.left span{left:1px;margin-top:2px}',
'.fe-zoom{position:absolute;right:16px;bottom:14px;display:flex;align-items:center;gap:2px;padding:4px;background:var(--panel);border:1px solid var(--bd);border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.14);z-index:5}',
'.fe-zoom .fe-zv{min-width:48px;text-align:center;font-size:12px;font-weight:700}',
'.fe-main{position:relative}',
'.fe-props{position:absolute;right:0;top:0;bottom:0;z-index:6;width:296px;background:var(--panel);border-left:1px solid var(--bd);box-shadow:-8px 0 24px rgba(0,0,0,.07);overflow-y:auto;padding:4px 16px 28px}',
'#fe:not(.nosel):not(.rc) .fe-zoom{right:312px}',
'.fe-pr{display:grid;grid-template-columns:96px minmax(0,1fr);gap:8px;align-items:center;margin-bottom:8px}',
'.fe-pr>label{white-space:nowrap}',
'.fe-pr .fe-wide{grid-column:1/-1}',
'.fe-g4{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}',
'.fe-nl{position:relative}.fe-nl label{position:absolute;left:9px;top:50%;transform:translateY(-50%);font-size:11px;pointer-events:none;color:var(--mut)}',
'.fe-nl.u input{padding-right:22px!important}.fe-nl .fe-u{position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:10px;color:var(--mut);pointer-events:none}',
'.fe-stp{display:inline-flex;align-items:center;gap:0}',
'#fe .fe-stp input{width:50px;text-align:center;border-radius:0;padding:0 2px;height:30px}',
'#fe .fe-stp button{width:26px;height:30px;border:1px solid var(--bd);background:var(--bg);border-radius:8px 0 0 8px}',
'#fe .fe-stp button+input+button{border-radius:0 8px 8px 0}',
'#fe .fe-sw{width:34px;height:30px;border:1px solid var(--bd);border-radius:8px;padding:4px;background:var(--panel)}',
'#fe .fe-sw i{display:block;width:100%;height:100%;border-radius:4px;background-image:linear-gradient(45deg,#d1d5db 25%,transparent 25%,transparent 75%,#d1d5db 75%),linear-gradient(45deg,#d1d5db 25%,#fff 25%,#fff 75%,#d1d5db 75%);background-size:8px 8px;background-position:0 0,4px 4px;position:relative}',
'#fe .fe-sw i b{position:absolute;inset:0;border-radius:4px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)}',
'#fe .fe-sw.wide{width:100%;display:flex;justify-content:flex-start;gap:8px;padding:4px 8px;font-size:12px}#fe .fe-sw.wide i{width:44px}',
'.fe-seg{display:inline-flex;gap:2px;padding:2px;background:var(--bg);border-radius:10px}',
'#fe .fe-seg button{width:30px;height:28px;border-radius:8px}',
'#fe label.fe-chk{display:flex;align-items:center;gap:8px;margin:2px 0 8px;font-size:13px;color:var(--fg);cursor:pointer}',
'#fe .fe-chk input{width:16px;height:16px;margin:0;accent-color:var(--ac)}',
'.fe-pophost{position:fixed;z-index:78;width:248px;background:var(--panel);border:1px solid var(--bd);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.28);padding:12px 14px 14px;color:var(--fg)}',
'.fe-pophost h5{margin:10px 0 6px;font-size:11px;color:var(--mut);font-weight:700}.fe-pophost h5:first-child{margin-top:0}',
'.fe-cs{display:flex;flex-wrap:wrap;gap:6px}',
'#fe .fe-pophost .fe-c,.fe-pophost .fe-c{width:24px;height:24px;border-radius:50%;border:1px solid rgba(0,0,0,.18);padding:0;cursor:pointer;display:inline-block;position:relative;background-clip:padding-box}',
'.fe-pophost .fe-c.cur{box-shadow:0 0 0 2px var(--panel),0 0 0 4px var(--ac)}',
'.fe-pophost .fe-c.tk:after{content:attr(data-l);position:absolute;left:50%;top:100%;transform:translateX(-50%);font-size:9px;color:var(--mut);white-space:nowrap;margin-top:2px}',
'.fe-pophost .fe-c.none{background:linear-gradient(135deg,#fff 45%,#ef4444 45%,#ef4444 55%,#fff 55%)}',
'.fe-pophost .fe-hex{display:flex;gap:8px;align-items:center;margin-top:12px}',
'.fe-pophost input[type=color]{width:34px;height:32px;padding:2px;border:1px solid var(--bd);border-radius:8px;background:var(--inp);flex:none}',
'.fe-lay{display:flex;align-items:center;gap:2px;height:42px;padding:0 4px;border:1px solid transparent;border-radius:10px;margin-bottom:2px;cursor:pointer;position:relative}',
'.fe-lay:hover{background:var(--bg)}.fe-lay.on{background:var(--acs);border-color:var(--ac)}',
'.fe-lay .fe-gr{width:18px;color:var(--mut);cursor:grab;display:flex}.fe-lay .fe-gr svg{width:14px;height:14px}',
'.fe-lay .fe-ty{color:var(--mut);display:flex}',
'.fe-lay .fe-ln{flex:1;min-width:0;padding:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}',
'.fe-lay.hid .fe-ln{opacity:.45}',
'#fe .fe-lay .fe-ib{width:28px;height:28px}',
'#fe .fe-lay .fe-ib svg{width:16px;height:16px}',
'#fe .fe-lay input{height:28px}',
'.fe-lay.dt-a:after,.fe-lay.dt-b:after{content:"";position:absolute;left:4px;right:4px;height:2px;background:var(--ac);border-radius:2px}.fe-lay.dt-a:after{bottom:-2px}.fe-lay.dt-b:after{top:-2px}',
'.fe-imgp{display:flex;gap:10px;align-items:center;margin-bottom:8px}',
'.fe-imgp .th{width:64px;height:64px;border:1px solid var(--bd);border-radius:8px;background:#fff center/contain no-repeat;flex:none}',
'.fe-its{max-height:220px;overflow-y:auto;border:1px solid var(--bd);border-radius:10px;padding:6px 10px;background:var(--bg)}',
'.fe-ronote{display:none}',
'#fe.ro .fe-rail,#fe.ro .fe-panel,#fe.ro .fe-props,#fe.ro .fe-top .fe-edit,#fe.ro .fe-zoom .fe-edit{display:none}',
'#fe.ro .fe-ronote{display:block;position:absolute;left:0;right:0;top:0;z-index:4;text-align:center;padding:10px 16px;background:var(--warnbg);color:var(--warn);font-size:13px;font-weight:700}',
'#fe.ro .fe-world{padding-top:64px}',
'#fe.pv .fe-ov,#fe.pv .fe-ruler{display:none}#fe.pv .fe-pg{pointer-events:none}',
'#fe.pv .fe-pg .fz{cursor:default}',
'#fe.pv .fe-pg .fz:hover{outline:0}',
'#fe.lc .fe-panel{display:none}',
'#fe.nosel .fe-props,#fe.rc .fe-props{display:none}',
'#fe .fe-lb{height:32px;padding:0 9px;gap:5px;font-size:12px;font-weight:600;border-radius:8px;flex:none}',
'#fe .fe-lb svg{width:16px;height:16px}',
'#fe .fe-lb.dng:hover{background:rgba(220,38,38,.12);color:var(--err)}',
'.fe-tt{position:fixed;z-index:95;background:#111827;color:#fff;font-size:11.5px;line-height:1.4;padding:4px 10px;border-radius:7px;white-space:nowrap;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.3)}',
'.fe-mode{display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--mut);white-space:nowrap}',
'#fe .fe-mode .fe-seg button{width:auto;padding:0 12px;font-size:12px;font-weight:600;color:var(--mut)}#fe .fe-mode .fe-seg button.on{background:var(--panel);color:var(--ac);box-shadow:0 1px 3px rgba(0,0,0,.15)}',
'.fe-stu{display:inline-flex;align-items:center;gap:2px;font-size:12px;color:var(--mut)}.fe-stu b{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fg);font-weight:600;padding:0 4px}',
'#fe .fe-rtog{position:absolute;right:14px;top:12px;z-index:5;height:34px;padding:0 12px;background:var(--panel);border:1px solid var(--bd);box-shadow:0 2px 10px rgba(0,0,0,.12);font-size:12px;font-weight:600}',
'.fe-props .fe-phd{display:flex;align-items:center;justify-content:space-between;margin:10px -6px 0 0}.fe-props .fe-phd h4{margin:0}',
'.fe-hov{position:absolute;border:2px solid #f59e0b;background:rgba(245,158,11,.1);pointer-events:none}',
'.fe-rowhl{position:absolute;border:1.5px solid #7c4dff;background:rgba(124,77,255,.14);pointer-events:none}',
'.fe-bdg{position:absolute;width:20px;height:20px;border-radius:50%;background:#7c4dff;color:#fff;display:flex;align-items:center;justify-content:center;pointer-events:none;box-shadow:0 1px 5px rgba(0,0,0,.3);z-index:2}',
'.fe-bdg svg{width:12px;height:12px}',
'.fe-bdg b{position:absolute;right:26px;top:-1px;white-space:nowrap;background:#111827;color:#fff;font-size:11px;font-weight:400;line-height:1.4;padding:2px 8px;border-radius:6px}',
'.fe-dl{position:absolute;background:#ff2d95;pointer-events:none}',
'.fe-dv{position:absolute;transform:translate(-50%,-50%);background:#ff2d95;color:#fff;font-size:10px;line-height:1.3;padding:0 4px;border-radius:4px;white-space:nowrap;pointer-events:none}',
'.fe-pg .fz-ie{outline:2px solid #7c4dff!important;cursor:text;text-overflow:clip!important}',
'.fe-pg .fz-ie[contenteditable]{user-select:text;-webkit-user-select:text;white-space:pre-wrap!important;overflow:visible!important}',
'.fe-menu{width:232px;padding:6px}',
'.fe-menu button{width:100%;justify-content:flex-start;height:32px;padding:0 10px;border-radius:7px;font-size:13px;font-weight:500;gap:8px;color:var(--fg);background:transparent;border:0;cursor:pointer;display:flex;align-items:center}',
'.fe-menu button:hover{background:var(--acs)}.fe-menu button:disabled{opacity:.4}',
'.fe-menu button small{margin-left:auto;color:var(--mut);font-size:11px}',
'.fe-menu hr{border:0;border-top:1px solid var(--bd);margin:5px 2px}',
'.fe-menu button svg{width:16px;height:16px;color:var(--mut)}',
'.fe-pophost.fe-wide{width:320px}',
'.fe-pophost p{margin:0 0 8px;font-size:12px;color:var(--mut);line-height:1.5}',
'.fe-sr{display:grid;grid-template-columns:1fr 1fr 30px;gap:6px;margin-bottom:6px;align-items:center}',
'#fe .fe-sr input,.fe-sr input{height:30px}',
'#fe .fe-sr .fe-ib{width:30px;height:30px;border:1px solid var(--bd);background:var(--panel)}',
'#fe .fe-bt{border:1px solid var(--bd);background:var(--panel);height:32px;padding:0 12px;font-size:12px;font-weight:500}',
'.fe-pophost .fe-act{display:flex;gap:8px;margin-top:10px}',
'.fe-pophost .fe-bt{height:34px;padding:0 12px;border:1px solid var(--bd);font-size:12.5px;font-weight:600;background:var(--bg);flex:1;border-radius:8px;cursor:pointer;color:var(--fg);font-family:inherit}',
'.fe-pophost .fe-bt.pri{background:var(--ac);color:var(--acfg);border-color:var(--ac)}',
'.fe-pophost input,.fe-pophost textarea{width:100%;height:32px;padding:0 9px;border:1px solid var(--bd);border-radius:8px;background:var(--inp);color:var(--fg);font:inherit;font-size:13px;box-sizing:border-box}',
'.fe-pophost textarea{height:auto;padding:7px 9px;line-height:1.5;resize:vertical}',
'.fe-modal{position:absolute;inset:0;z-index:80;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;padding:20px}',
'.fe-help{background:var(--panel);border-radius:16px;width:min(760px,100%);max-height:100%;overflow:auto;padding:22px 26px;box-shadow:0 20px 60px rgba(0,0,0,.4)}',
'.fe-help h3{margin:0 0 14px;font-size:16px;display:flex;align-items:center;justify-content:space-between}',
'.fe-help .cols{display:grid;grid-template-columns:1fr 1fr;gap:6px 30px}',
'.fe-help h5{margin:14px 0 6px;font-size:12px;color:var(--mut)}',
'.fe-help .kr{display:flex;justify-content:space-between;gap:12px;padding:4px 0;border-bottom:1px solid var(--bd);font-size:12.5px}',
'.fe-help kbd{font:600 11px/1 inherit;background:var(--bg);border:1px solid var(--bd);border-bottom-width:2px;border-radius:5px;padding:3px 6px;white-space:nowrap}',
'.fe-thumb{width:102px;height:144px;margin:0 auto;background:#fff;border:1px solid var(--bd);border-radius:6px;position:relative;overflow:hidden;pointer-events:none}',
'.fe-thumb .ticket{position:absolute;left:0;top:0;transform-origin:0 0}',
'#fe .fe-tcard{flex-direction:column;align-items:stretch;gap:6px;height:auto;padding:8px;border:1px solid var(--bd);border-radius:12px;background:var(--bg);font-size:12px;font-weight:600;white-space:normal;text-align:center}',
'#fe .fe-tcard:hover{border-color:var(--ac);background:var(--acs)}',
'#fe .fe-tcard small{display:block;font-size:10.5px;font-weight:400;color:var(--mut);line-height:1.35}',
'.fe-sub{margin:0 0 8px;font-size:12px;color:var(--mut);line-height:1.55}',
'.fe-itbox{border:1px solid var(--bd);border-radius:12px;padding:10px 12px 4px;margin:6px 0 10px;background:var(--bg)}',
'.fe-itbox h5{margin:0 0 8px;font-size:12px;color:var(--ac)}',
'@media print{#fe,.fe-pophost{display:none!important}}'
].join('\n');

/* ---------- 入力部品 ---------- */
function fmt(n) { return String(Math.round(n * 100) / 100); }
function numInput(o) {
  var i = h('input'); i.type = 'number'; i.step = o.step || 'any'; if (o.min != null) i.min = o.min; if (o.max != null) i.max = o.max; i.value = fmt(o.v); i.setAttribute('aria-label', o.label || '');
  i.onchange = function () { var n = parseFloat(i.value); if (!isFinite(n)) { i.value = fmt(o.v); return; } n = clamp(n, o.min, o.max); i.value = fmt(n); o.on(n); };
  i.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } };
  return i;
}
function labeledNum(label, o, unit) {
  var w = h('div', 'fe-nl' + (unit ? ' u' : '')), i = numInput(o); w.appendChild(tx('label', null, label)); w.appendChild(i); if (unit) w.appendChild(tx('span', 'fe-u', unit));
  i.style.setProperty('padding-left', Math.round(11 + label.length * 12) + 'px', 'important'); return w;
}
function selInput(opts, cur, on, w) {
  var s = h('select'); opts.forEach(function (o) { var op = document.createElement('option'); op.value = String(o[0]); op.textContent = o[1]; s.appendChild(op); });
  s.value = String(cur); if (w) s.style.width = w + 'px'; s.onchange = function () { var v = s.value; for (var i = 0; i < opts.length; i++) if (String(opts[i][0]) === v) { v = opts[i][0]; break; } on(v); };
  return s;
}
function chkInput(label, checked, on) {
  var l = h('label', 'fe-chk'), c = h('input'); c.type = 'checkbox'; c.checked = !!checked; c.onchange = function () { on(c.checked); };
  l.appendChild(c); l.appendChild(document.createTextNode(label)); return l;
}
function swatch(cur, none, cb, wideLabel) {
  var b = h('button', 'fe-sw' + (wideLabel ? ' wide' : '')), i = h('i'), c = h('b'); i.appendChild(c);
  c.style.background = (!cur || cur === 'transparent') ? 'transparent' : resolveColor(cur); b.appendChild(i);
  if (wideLabel) b.appendChild(tx('span', null, wideLabel));
  b.type = 'button'; b.setAttribute('data-tip', '色を選ぶ'); b.onclick = function (e) { e.stopPropagation(); openColor(b, cur, cb, { none: none }); }; return b;
}
function seg(items, cur, on) {
  var s = h('span', 'fe-seg'); items.forEach(function (it) { var b = ibtn(it[1], it[2], function () { on(it[0]); }, cur === it[0] ? 'on' : ''); s.appendChild(b); }); return s;
}
function stepper(o) {
  var w = h('span', 'fe-stp'), i = numInput(o), m = ibtn('minus', '小さく', function () { o.on(clamp(r2((+i.value || 0) - (o.stepBy || 1)), o.min, o.max)); }), p = ibtn('plus', '大きく', function () { o.on(clamp(r2((+i.value || 0) + (o.stepBy || 1)), o.min, o.max)); });
  w.appendChild(m); w.appendChild(i); w.appendChild(p); return w;
}

/* ---------- 色ポップオーバー ---------- */
function recentColors() { try { var a = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(a) ? a.filter(function (x) { return /^#[0-9a-f]{6}$/i.test(x); }).slice(0, 8) : []; } catch (e) { return []; } }
function pushRecent(c) { if (!/^#[0-9a-f]{6}$/i.test(c)) return; c = c.toLowerCase(); var a = recentColors().filter(function (x) { return x !== c; }); a.unshift(c); try { localStorage.setItem(RECENT_KEY, JSON.stringify(a.slice(0, 8))); } catch (e) {} }
function closePop() { if (pop) { pop.remove(); pop = null; } }
function openColor(anchor, cur, cb, o) {
  closePop(); o = o || {};
  var p = h('div', 'fe-pophost'), Vv = V();
  function pick(v, keep) { if (v !== 'accent' && v !== 'secondary' && v !== '' && v !== 'transparent') pushRecent(v); cb(v); if (!keep) closePop(); }
  function dot(v, label, cls) {
    var b = h('button', 'fe-c' + (cls ? ' ' + cls : '') + (cur === v ? ' cur' : '')); b.type = 'button'; b.style.background = (v && v !== 'transparent') ? resolveColor(v) : ''; b.title = label || v;
    if (cls === 'tk') b.setAttribute('data-l', label);
    b.onclick = function () { pick(v); }; return b;
  }
  var sec = function (t, arr) { p.appendChild(tx('h5', null, t)); var d = h('div', 'fe-cs'); arr.forEach(function (x) { d.appendChild(x); }); p.appendChild(d); return d; };
  var d1 = [dot('accent', 'アクセント', 'tk'), dot('secondary', 'サブ', 'tk')]; if (o.none) d1.push(dot('transparent', 'なし', 'none'));
  var s1 = sec('デザインの色', d1); s1.style.marginBottom = '12px';
  sec('シック', PAL_CHIC.map(function (c) { return dot(c); }));
  sec('ポップ', PAL_POP.map(function (c) { return dot(c); }));
  var rc = recentColors(); if (rc.length) sec('最近使った色', rc.map(function (c) { return dot(c); }));
  var hx = h('div', 'fe-hex'), hi = h('input'), cp = h('input'); hi.type = 'text'; hi.maxLength = 7; hi.placeholder = '#1e40af'; hi.setAttribute('aria-label', '16進カラーコード');
  var cv = cur && cur !== 'transparent' ? resolveColor(cur) : '#ffffff'; hi.value = /^#[0-9a-f]{6}$/i.test(cv) ? cv : '';
  cp.type = 'color'; cp.value = /^#[0-9a-f]{6}$/i.test(cv) ? cv : '#ffffff'; cp.setAttribute('aria-label', '色を選ぶ');
  function fromHex() { var v = hi.value.trim(); if (/^[0-9a-f]{6}$/i.test(v)) v = '#' + v; if (/^#[0-9a-f]{6}$/i.test(v)) { v = v.toLowerCase(); cp.value = v; pick(v, true); } }
  hi.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); fromHex(); closePop(); } };
  hi.onchange = fromHex;
  cp.oninput = function () { hi.value = cp.value; cb(cp.value); };
  cp.onchange = function () { pushRecent(cp.value); };
  hx.appendChild(cp); hx.appendChild(hi); p.appendChild(hx);
  document.body.appendChild(p); pop = p;
  var ar = anchor.getBoundingClientRect(), pw = 248, ph = p.offsetHeight;
  p.style.left = clamp(ar.left, 8, innerWidth - pw - 8) + 'px'; p.style.top = (ar.bottom + 8 + ph > innerHeight - 8 ? Math.max(8, ar.top - ph - 8) : ar.bottom + 8) + 'px';
  p._anchor = anchor;
}
function placePop(p, r) {
  document.body.appendChild(p); pop = p; var pw = p.offsetWidth, ph = p.offsetHeight;
  p.style.left = clamp(r.left, 8, innerWidth - pw - 8) + 'px';
  p.style.top = (r.bottom + 8 + ph > innerHeight - 8 ? Math.max(8, r.top - ph - 8) : r.bottom + 8) + 'px';
}
/* メニュー（右クリック・スタイル・サイズ）。items: {l, fn, k(ショートカット表示), ic, dis, st(見本のスタイル)} または '-' */
function openMenu(x, y, items, anchor) {
  closePop(); var p = h('div', 'fe-pophost fe-menu');
  items.forEach(function (it) {
    if (it === '-') { p.appendChild(h('hr')); return; }
    var b = h('button', '', (it.ic ? ic(it.ic) : '<i style="width:16px;flex:none"></i>') + '<span>' + esc(it.l) + '</span>' + (it.k ? '<small>' + esc(it.k) + '</small>' : '')); b.type = 'button'; b.disabled = !!it.dis;
    if (it.st) b.querySelector('span').style.cssText = it.st;
    b.onclick = function () { closePop(); it.fn(); }; p.appendChild(b);
  });
  if (anchor) { placePop(p, anchor.getBoundingClientRect()); p._anchor = anchor; return; }
  document.body.appendChild(p); pop = p; var pw = p.offsetWidth, ph = p.offsetHeight;
  p.style.left = clamp(x, 8, innerWidth - pw - 8) + 'px'; p.style.top = clamp(y, 8, innerHeight - ph - 8) + 'px';
}
function placePop(p, r) {
  document.body.appendChild(p); pop = p; var pw = p.offsetWidth, ph = p.offsetHeight;
  p.style.left = clamp(r.left, 8, innerWidth - pw - 8) + 'px';
  p.style.top = (r.bottom + 8 + ph > innerHeight - 8 ? Math.max(8, r.top - ph - 8) : r.bottom + 8) + 'px';
}
/* メニュー（右クリック・スタイル・サイズ）。items: {l, fn, k(ショートカット表示), ic, dis, st(見本のスタイル)} または '-' */
function openMenu(x, y, items, anchor) {
  closePop(); var p = h('div', 'fe-pophost fe-menu');
  items.forEach(function (it) {
    if (it === '-') { p.appendChild(h('hr')); return; }
    var b = h('button', '', (it.ic ? ic(it.ic) : '') + '<span>' + esc(it.l) + '</span>' + (it.k ? '<small>' + esc(it.k) + '</small>' : '')); b.type = 'button'; b.disabled = !!it.dis;
    if (it.st) b.querySelector('span').style.cssText = it.st;
    b.onclick = function () { closePop(); it.fn(); }; p.appendChild(b);
  });
  if (anchor) { placePop(p, anchor.getBoundingClientRect()); p._anchor = anchor; return; }
  document.body.appendChild(p); pop = p; var pw = p.offsetWidth, ph = p.offsetHeight;
  p.style.left = clamp(x, 8, innerWidth - pw - 8) + 'px'; p.style.top = clamp(y, 8, innerHeight - ph - 8) + 'px';
}
function placePop(p, r) {
  document.body.appendChild(p); pop = p; var pw = p.offsetWidth, ph = p.offsetHeight;
  p.style.left = clamp(r.left, 8, innerWidth - pw - 8) + 'px';
  p.style.top = (r.bottom + 8 + ph > innerHeight - 8 ? Math.max(8, r.top - ph - 8) : r.bottom + 8) + 'px';
}
/* メニュー（右クリック・スタイル・サイズ）。items: {l, fn, k(ショートカット表示), ic, dis, st(見本のスタイル)} または '-' */
function openMenu(x, y, items, anchor) {
  closePop(); var p = h('div', 'fe-pophost fe-menu');
  items.forEach(function (it) {
    if (it === '-') { p.appendChild(h('hr')); return; }
    var b = h('button', '', (it.ic ? ic(it.ic) : '') + '<span>' + esc(it.l) + '</span>' + (it.k ? '<small>' + esc(it.k) + '</small>' : '')); b.type = 'button'; b.disabled = !!it.dis;
    if (it.st) b.querySelector('span').style.cssText = it.st;
    b.onclick = function () { closePop(); it.fn(); }; p.appendChild(b);
  });
  if (anchor) { placePop(p, anchor.getBoundingClientRect()); p._anchor = anchor; return; }
  document.body.appendChild(p); pop = p; var pw = p.offsetWidth, ph = p.offsetHeight;
  p.style.left = clamp(x, 8, innerWidth - pw - 8) + 'px'; p.style.top = clamp(y, 8, innerHeight - ph - 8) + 'px';
}
document.addEventListener('mousedown', function (e) { if (pop && !pop.contains(e.target) && !(pop._anchor && pop._anchor.contains(e.target))) closePop(); }, true);

/* ---------- 構築 ---------- */
function build() {
  var st = document.createElement('style'); st.id = 'fe-css'; st.textContent = CSS; document.head.appendChild(st);
  root = h('div'); root.id = 'fe'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'デザイン編集');
  root.innerHTML =
    '<div class="fe-top">' +
    '<button class="fe-tb fe-pri" data-a="close" title="編集を終えてプレビューに戻る">' + ic('check') + '<span>完了</span></button>' +
    '<div class="fe-ttl"><b>デザイン編集</b><span class="fe-nm"></span></div>' +
    '<span class="fe-sep fe-edit"></span><span class="fe-grp fe-edit"><button class="fe-ib" data-a="undo" title="元に戻す (Ctrl+Z)" aria-label="元に戻す">' + ic('undo') + '</button><button class="fe-ib" data-a="redo" title="やり直し (Ctrl+Y)" aria-label="やり直し">' + ic('redo') + '</button></span>' +
    '<span class="fe-sp"></span>' +
    '<span class="fe-stu"></span>' +
    '<span class="fe-mode fe-edit"><span>差し込み表示</span><span class="fe-seg"><button data-a="raw0" title="生徒の実際の値で表示します（印刷と同じ見た目）">実データ</button><button data-a="raw1" title="値の代わりに {{項目名}} を表示します">項目名</button></span></span>' +
    '<button class="fe-ib fe-edit" data-a="help" title="操作のヒント・ショートカット (?)">' + ic('help') + '</button>' +
    '<button class="fe-sst fe-edit" data-a="sst" data-s=""><i></i><span></span></button>' +
    '<button class="fe-tb fe-pri fe-edit" data-a="save" title="保存 (Ctrl+S)">' + ic('save') + '<span>保存</span></button>' +
    '</div>' +
    '<div class="fe-ctx"></div>' +
    '<div class="fe-main">' +
    '<nav class="fe-rail" aria-label="追加メニュー"></nav>' +
    '<div class="fe-panel"></div>' +
    '<div class="fe-stage"><div class="fe-ronote">デザイン編集はパソコンでご利用ください（この画面は表示のみです）</div>' +
    '<button class="fe-rtog fe-edit" data-a="rtog" hidden title="詳細パネルを開く">' + ic('panelR') + '<span>詳細</span></button>' +
    '<div class="fe-scroll"><div class="fe-world"><div class="fe-pagebox"><div class="fe-ruler top" data-axis="y"></div><div class="fe-ruler left" data-axis="x"></div><div class="fe-pg"></div><div class="fe-ov"></div></div></div></div>' +
    '<div class="fe-zoom"><button class="fe-ib fe-edit" data-a="grid" title="グリッドを表示（5mm）">' + ic('grid') + '</button><button class="fe-ib fe-edit" data-a="snap" title="ぴったり吸着（Altを押している間は解除）">' + ic('magnet') + '</button><span class="fe-sep fe-edit"></span>' +
    '<button class="fe-ib" data-a="zout" title="縮小">' + ic('minus') + '</button><span class="fe-zv" aria-live="polite">100%</span><button class="fe-ib" data-a="zin" title="拡大">' + ic('plus') + '</button><button class="fe-ib" data-a="zfit" title="1ページ全体を表示">' + ic('fit') + '</button></div></div>' +
    '<aside class="fe-props" aria-label="詳細"></aside>' +
    '</div>';
  document.body.appendChild(root);
  R.ctx = $('.fe-ctx'); R.rail = $('.fe-rail'); R.panel = $('.fe-panel'); R.props = $('.fe-props'); R.scroll = $('.fe-scroll'); R.box = $('.fe-pagebox'); R.pg = $('.fe-pg'); R.ov = $('.fe-ov'); R.rt = $('.fe-ruler.top'); R.rl = $('.fe-ruler.left');
  R.zv = $('.fe-zv'); R.nm = $('.fe-nm'); R.sst = $('.fe-sst'); R.stu = $('.fe-stu'); R.rtog = $('.fe-rtog'); R.zfit = $('[data-a=zfit]');
  root.addEventListener('mousedown', function (e) { var b = e.target.closest('button'); if (b && (S.editing)) e.preventDefault(); });
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b || !root.contains(b)) return; var a = b.getAttribute('data-a');
    if (a === 'close') FE.close();
    else if (a === 'undo') H.undo(); else if (a === 'redo') H.redo();
    else if (a === 'save') H.save();
    else if (a === 'sst') { if (S.st.s === 'dirty' || S.st.s === 'error') H.save(); }
    else if (a === 'raw0' || a === 'raw1') { S.raw = a === 'raw1'; if (S.editing) finishEdit(true); redraw(); }
    else if (a === 'help') showHelp();
    else if (a === 'rtog') { S.rcol = false; saveUI(); drawFrame(); }
    else if (a === 'grid') { S.grid = !S.grid; saveUI(); drawZoomBtns(); drawOv(); }
    else if (a === 'snap') { S.snap = !S.snap; saveUI(); drawZoomBtns(); }
    else if (a === 'zin') setZoom(S.zoom * 1.2); else if (a === 'zout') setZoom(S.zoom / 1.2);
    else if (a === 'zfit') { S.fit = S.fit === 'p' ? 'c' : 'p'; setZoom(fitZoom(), null, null, true); R.scroll.scrollTop = 0; drawZoomBtns(); }
  });
  R.scroll.addEventListener('pointerdown', onDown);
  R.scroll.addEventListener('pointermove', onMove);
  R.scroll.addEventListener('pointerup', onUp);
  R.scroll.addEventListener('pointercancel', onUp);
  R.scroll.addEventListener('dblclick', onDbl);
  R.scroll.addEventListener('contextmenu', onCtxMenu);
  R.scroll.addEventListener('pointerleave', function () { if (S.hb) { S.hb = null; drawOv(); } });
  root.addEventListener('mouseover', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t && root.contains(t)) { clearTimeout(ttTimer); ttTimer = setTimeout(function () { ttShow(t); }, 280); } });
  root.addEventListener('mouseout', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) ttHide(); });
  root.addEventListener('pointerdown', ttHide, true);
  R.scroll.addEventListener('wheel', function (e) { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); setZoom(S.zoom * Math.exp(-e.deltaY * 0.0018), e.clientX, e.clientY); }, { passive: false });
  if (window.ResizeObserver) new ResizeObserver(function () { if (S.open && S.fit) { S.zoom = fitZoom(); layout(); drawOv(); } }).observe(R.scroll);
  drawRail(); tipify();
}

/* ---------- ズーム・レイアウト ---------- */
/* S.fit='c'：ちょうどよい大きさ（画面の高さに合わせ、ただし80%を下回らない）／'p'：1ページ全体が入る大きさ */
function fitZoom() {
  var W = R.scroll.clientWidth, Hh = R.scroll.clientHeight;
  if (W < 100 || Hh < 100) return S.zoom;
  var wfit = (W - 92) / (PW * PXMM), hfit = (Hh - 84) / (PH * PXMM);
  return clamp(S.fit === 'p' ? Math.min(wfit, hfit) : Math.min(wfit, Math.max(hfit, 0.8)), 0.25, 4);
}
function setZoom(z, cx, cy, fitting) {
  z = clamp(z, 0.25, 4); if (!fitting) S.fit = false;
  var br = R.box.getBoundingClientRect(), s0 = sz(), mx = cx != null ? (cx - br.left) / s0 : PW / 2, my = cy != null ? (cy - br.top) / s0 : PH / 2;
  S.zoom = z; layout(); drawOv();
  if (!fitting) {
    var br2 = R.box.getBoundingClientRect(), vr = R.scroll.getBoundingClientRect(), s1 = sz();
    var px = cx != null ? cx : vr.left + vr.width / 2, py = cy != null ? cy : vr.top + vr.height / 2;
    R.scroll.scrollLeft += br2.left + mx * s1 - px; R.scroll.scrollTop += br2.top + my * s1 - py;
  }
}
function layout() {
  var s = sz(), w = PW * PXMM * S.zoom, hh = PH * PXMM * S.zoom;
  R.box.style.width = w + 'px'; R.box.style.height = hh + 'px';
  if (S.page) { S.page.style.transform = 'scale(' + S.zoom + ')'; }
  R.zv.textContent = Math.round(S.zoom * 100) + '%';
  R.ov.style.backgroundSize = (5 * s) + 'px ' + (5 * s) + 'px';
  drawRulers();
}
function drawRulers() {
  var s = sz(), step = s * 10 >= 30 ? 10 : s * 10 >= 14 ? 20 : 50;
  [R.rt, R.rl].forEach(function (r, k) {
    r.textContent = '';
    for (var mmv = 0; mmv <= (k ? PH : PW); mmv += step) { var sp = tx('span', null, String(mmv)); sp.style[k ? 'top' : 'left'] = (mmv * s) + 'px'; r.appendChild(sp); }
    var a = k ? '180deg' : '90deg', t1 = '1px', col = 'rgba(127,127,127,.7)';
    r.style.backgroundImage = 'linear-gradient(' + a + ',' + col + ' 1px,transparent 1px),linear-gradient(' + a + ',' + col + ' 1px,transparent 1px)';
    r.style.backgroundSize = k ? ('10px ' + (10 * s) + 'px,5px ' + (5 * s) + 'px') : ((10 * s) + 'px 10px,' + (5 * s) + 'px 5px');
    r.style.backgroundPosition = k ? '100% 0,100% 0' : '0 100%,0 100%';
    r.style.backgroundRepeat = k ? 'repeat-y' : 'repeat-x';
  });
}
function drawZoomBtns() { $('[data-a=grid]').classList.toggle('on', S.grid); $('[data-a=snap]').classList.toggle('on', S.snap); if (R.zfit) R.zfit.setAttribute('data-tip', S.fit === 'p' ? 'ちょうどよい大きさに戻す' : '1ページ全体を表示'); }

/* ---------- 描画 ---------- */
/* いま表示している生徒（名簿があれば名簿、なければサンプル）。差し込みは実データで描く。
   選択中の文字（{{…}} を含むもの）だけ、元の書き方（項目名のチップ）で見せる */
function stu() {
  var l = H.students(); if (S.pidx >= l.length) S.pidx = l.length - 1; if (S.pidx < 0) S.pidx = 0;
  var s = Object.create(l[S.pidx] || H.sample());
  s._edit = !S.preview; s._raw = S.raw && !S.preview; s._rawIds = S.preview ? null : rawIds(); return s;
}
function rawIds() { var o = {}; if (S.preview) return o; selEls().forEach(function (e) { if (e.type === 'text' && /\{\{/.test(e.text)) o[e.id] = 1; }); return o; }
function rawKey() { return Object.keys(rawIds()).sort().join(','); }
function drawPage() {
  S.rawKey = rawKey(); S.hb = null;
  var page = JT.render('free', stu(), V()); S.page = page; R.pg.textContent = ''; R.pg.appendChild(page); page.style.transform = 'scale(' + S.zoom + ')';
  H.fitAll(page);
}
function redraw() { drawPage(); layout(); drawFrame(); drawOv(); drawCtx(); drawProps(); drawPanel(); drawTop(); }
/* 左右パネルの開閉状態 */
function drawFrame() {
  root.classList.toggle('lc', !S.lopen); root.classList.toggle('rc', S.rcol); root.classList.toggle('nosel', !S.sel.length);
  if (R.rtog) R.rtog.hidden = !(S.rcol && S.sel.length && !S.ro);
  drawRail();
}
function openLeft(tab) { if (tab) S.tab = tab; S.lopen = true; saveUI(); drawFrame(); drawPanel(); }
function closeLeft() { if (!S.lopen) return; S.lopen = false; saveUI(); drawFrame(); }
function drawTop() {
  R.nm.textContent = H.name(); var hs = H.hist();
  $('[data-a=undo]').disabled = !hs.u; $('[data-a=redo]').disabled = !hs.r;
  $('[data-a=raw0]').classList.toggle('on', !S.raw); $('[data-a=raw1]').classList.toggle('on', S.raw);
  root.classList.toggle('pv', S.preview); drawZoomBtns(); drawStatus(); drawStu();
}
function drawStu() {
  var c = R.stu; c.textContent = ''; var l = H.students(), one = l.length <= 1;
  if (one) { if (l[0] && l[0].sample) { c.appendChild(tx('span', null, 'サンプルの生徒で表示中')); c.firstChild.setAttribute('data-tip', '名簿を入れると、実際の生徒で確認できます'); } return; }
  c.appendChild(ibtn('chevL', '前の生徒', function () { S.pidx = Math.max(0, S.pidx - 1); redraw(); }));
  c.appendChild(tx('b', null, H.label(l[clamp(S.pidx, 0, l.length - 1)]))); c.appendChild(tx('span', null, (S.pidx + 1) + '/' + l.length));
  c.appendChild(ibtn('chevR', '次の生徒', function () { S.pidx = Math.min(l.length - 1, S.pidx + 1); redraw(); }));
  tipify(c);
}
function drawStatus() { R.sst.setAttribute('data-s', S.st.s); R.sst.querySelector('span').textContent = S.st.t; R.sst.title = S.st.s === 'dirty' ? '未保存の変更あり（クリックで保存）' : S.st.t; }
function selBoxes() {
  var s = sz();
  return selEls().filter(function (e) { return !e.hidden; }).map(function (e) { var q = JF.geom(e); return { e: e, q: q, left: q.x * s, top: q.y * s, w: q.w * s, h: q.h * s }; });
}
function drawOv() {
  var ov = R.ov, s = sz(); ov.textContent = ''; ov.classList.toggle('grid', S.grid && !S.preview);
  if (S.preview || !S.open) return;
  drawExtra(ov, s);
  F().guides.forEach(function (gd, i) { var l = h('div', 'fe-guide ' + gd.axis); l.setAttribute('data-gi', i); l.style[gd.axis === 'x' ? 'left' : 'top'] = (gd.pos * s) + 'px'; ov.appendChild(l); });
  var bs = selBoxes(), multi = bs.length > 1;
  bs.forEach(function (b) {
    var d = h('div', 'fe-sel' + (multi ? ' multi' : '') + (b.e.locked ? ' lock' : '')); d.style.cssText = 'left:' + b.left + 'px;top:' + b.top + 'px;width:' + b.w + 'px;height:' + b.h + 'px;' + (b.e.rot ? 'transform:rotate(' + b.e.rot + 'deg)' : '');
    if (!multi && !b.e.locked && !S.editing && !(drag && drag.mode !== 'rs' && drag.mode !== 'rot')) {
      var one = b.e.type === 'line' || b.e.type === 'fold', hs = one ? ['w', 'e'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'], pos = { nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], sw: [0, 100], w: [0, 50] };
      hs.forEach(function (k) { var hd = h('div', 'fe-hd'); hd.setAttribute('data-h', k); hd.style.left = pos[k][0] + '%'; hd.style.top = pos[k][1] + '%'; d.appendChild(hd); });
      d.appendChild(h('div', 'fe-rotl')); var rh = h('div', 'fe-hd', ic('rotate')); rh.setAttribute('data-h', 'rot'); rh.style.left = '50%'; rh.style.top = '-30px'; rh.title = '回転（Shiftで15°ずつ）'; d.appendChild(rh);
    }
    ov.appendChild(d);
  });
  if (multi) { var u = unionBox(selEls().filter(function (e) { return !e.hidden; })); if (u) { var gb = h('div', 'fe-gbox'); gb.style.cssText = 'left:' + (u.x * s) + 'px;top:' + (u.y * s) + 'px;width:' + (u.w * s) + 'px;height:' + (u.h * s) + 'px'; ov.appendChild(gb); } }
  if (drag && drag.lines) drag.lines.forEach(function (l) { var d = h('div', 'fe-snap ' + l.axis); d.style[l.axis === 'x' ? 'left' : 'top'] = (l.pos * s) + 'px'; ov.appendChild(d); });
  if (drag && drag.mode === 'mq' && drag.rect) { var mq = h('div', 'fe-mq'), rr = drag.rect; mq.style.cssText = 'left:' + (rr.x * s) + 'px;top:' + (rr.y * s) + 'px;width:' + (rr.w * s) + 'px;height:' + (rr.h * s) + 'px'; ov.appendChild(mq); }
  var tipTxt = (drag && drag.tip) || S.nt;
  if (tipTxt) { var u2 = unionBox(selEls().filter(function (e) { return !e.hidden; })); if (u2) { var tp = tx('div', 'fe-tip', tipTxt); tp.style.left = ((u2.x + u2.w / 2) * s) + 'px'; tp.style.top = ((u2.y + u2.h) * s + 14) + 'px'; ov.appendChild(tp); } }
}
/* ホバー強調（レイヤーから）・選択中の表の行・名簿連動バッジ・ドラッグ中の距離表示 */
function drawExtra(ov, s) {
  if (S.hover) { var he = find(S.hover); if (he && !he.hidden) { var hq = JF.geom(he), hd = h('div', 'fe-hov'); hd.style.cssText = 'left:' + (hq.x * s) + 'px;top:' + (hq.y * s) + 'px;width:' + (hq.w * s) + 'px;height:' + (hq.h * s) + 'px;' + (he.rot ? 'transform:rotate(' + he.rot + 'deg)' : ''); ov.appendChild(hd); } }
  var br = R.box.getBoundingClientRect();
  if (S.rowSel) { var rn = rowNode(); if (rn) { var nr = rn.getBoundingClientRect(), rd = h('div', 'fe-rowhl'); rd.style.cssText = 'left:' + (nr.left - br.left) + 'px;top:' + (nr.top - br.top) + 'px;width:' + nr.width + 'px;height:' + nr.height + 'px'; ov.appendChild(rd); } }
  if (S.hb && S.hb.node.isConnected && !drag) {
    var nb = S.hb.node.getBoundingClientRect(), bd = h('div', 'fe-bdg', ic('link'));
    bd.style.left = (nb.right - br.left - 24) + 'px'; bd.style.top = (nb.top - br.top + 4) + 'px';
    if (S.hb.near) bd.appendChild(tx('b', null, '名簿から自動で入ります')); ov.appendChild(bd);
  }
  if (drag && drag.dists) drag.dists.forEach(function (d) {
    var l = h('div', 'fe-dl'), horiz = d.y1 === d.y2;
    if (horiz) l.style.cssText = 'left:' + (Math.min(d.x1, d.x2) * s) + 'px;top:' + (d.y1 * s) + 'px;width:' + (Math.abs(d.x2 - d.x1) * s) + 'px;height:1px';
    else l.style.cssText = 'left:' + (d.x1 * s) + 'px;top:' + (Math.min(d.y1, d.y2) * s) + 'px;width:1px;height:' + (Math.abs(d.y2 - d.y1) * s) + 'px';
    ov.appendChild(l); var v = tx('div', 'fe-dv', fmt(d.v)); v.style.left = (((d.x1 + d.x2) / 2) * s) + 'px'; v.style.top = (((d.y1 + d.y2) / 2) * s) + 'px'; ov.appendChild(v);
  });
}
function rowNode() { if (!S.rowSel) return null; var n = nodeOf(S.rowSel.eid); return n ? n.querySelector('[data-item="' + S.rowSel.iid + '"]') : null; }
function unionBox(es) {
  if (!es.length) return null; var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  es.forEach(function (e) { var a = JF.aabb(e); x0 = Math.min(x0, a.x); y0 = Math.min(y0, a.y); x1 = Math.max(x1, a.r); y1 = Math.max(y1, a.b); });
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, r: x1, b: y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
function nodeGeom(e) {
  var n = nodeOf(e.id); if (!n) return; var q = JF.geom(e);
  n.style.left = q.x + 'mm'; n.style.top = q.y + 'mm'; n.style.width = q.w + 'mm'; n.style.height = q.h + 'mm'; n.style.transform = e.rot ? 'rotate(' + e.rot + 'deg)' : '';
}

/* ---------- 操作の共通入口 ---------- */
function mut(fn, o) {
  o = o || {}; fn(); H.changed(!o.live);
  if (o.live) { drawPage(); drawOv(); } else redraw();
}
function setSel(ids) { S.sel = ids.filter(function (id, i) { return ids.indexOf(id) === i && find(id); }); if (S.rowSel && S.sel.indexOf(S.rowSel.eid) < 0) S.rowSel = null; }
function selChanged() { drawFrame(); if (rawKey() !== S.rawKey) drawPage(); drawOv(); drawCtx(); drawProps(); if (S.tab === 'lay') drawPanel(); }
function setProp(k, v, live) {
  var es = selEls(); if (!es.length) return;
  mut(function () { es.forEach(function (e) { if (k in e) e[k] = v; }); }, { live: !!live });
}
function forGeom(fn) { var es = selEls().filter(function (e) { return !e.locked; }); if (!es.length) return; mut(function () { es.forEach(fn); }); }
function addEl(type, props) {
  var e = JF.newElement(type, props); if (!e) return null;
  var off = (S.addN++ % 6) * 4;
  if (!props || props.x == null) e.x = r2(clamp((PW - e.w) / 2 + off, 0, PW - Math.min(e.w, PW)));
  if (!props || props.y == null) e.y = r2(clamp((PH - e.h) / 2 + off, 0, PH));
  mut(function () { elems().push(e); setSel([e.id]); });
  closeLeft();
  return e;
}
function removeSel() {
  var ids = S.sel.slice(); if (!ids.length) return;
  mut(function () { F().elements = elems().filter(function (e) { return ids.indexOf(e.id) < 0; }); S.sel = []; });
}
function cloneEls(es, dx, dy) {
  return es.map(function (e) { var c = JSON.parse(JSON.stringify(e)); c.id = JF.newId(); c.x = r2(c.x + dx); c.y = r2(c.y + dy); return c; });
}
function dupSel() {
  var es = selEls(); if (!es.length) return; var cs = cloneEls(es, 5, 5);
  mut(function () { cs.forEach(function (c) { elems().push(c); }); setSel(cs.map(function (c) { return c.id; })); });
}
function copySel() { var es = selEls(); if (!es.length) return; S.clip = JSON.parse(JSON.stringify(es)); S.pasteN = 0; H.toast(es.length + '個の要素をコピーしました'); }
function pasteSel() {
  if (!S.clip || !S.clip.length) return; S.pasteN++; var d = 5 * S.pasteN, cs = cloneEls(S.clip, d, d);
  mut(function () { cs.forEach(function (c) { elems().push(c); }); setSel(cs.map(function (c) { return c.id; })); });
}
/* kind: up=ひとつ前面へ / down=ひとつ背面へ / front=最前面へ / back=最背面へ */
function arrange(kind) {
  var ids = S.sel.slice(); if (!ids.length) return;
  mut(function () {
    var a = elems(), on = function (e) { return ids.indexOf(e.id) >= 0; };
    if (kind === 'front' || kind === 'back') { var sel = a.filter(on), rest = a.filter(function (e) { return !on(e); }); F().elements = kind === 'front' ? rest.concat(sel) : sel.concat(rest); }
    else if (kind === 'up') { for (var i = a.length - 2; i >= 0; i--) if (on(a[i]) && !on(a[i + 1])) { var t = a[i]; a[i] = a[i + 1]; a[i + 1] = t; } }
    else { for (var j = 1; j < a.length; j++) if (on(a[j]) && !on(a[j - 1])) { var u = a[j]; a[j] = a[j - 1]; a[j - 1] = u; } }
  });
}
function reorder(fromId, toId, afterDisplay) {
  if (fromId === toId) return;
  mut(function () {
    var a = elems(), f = find(fromId); if (!f) return; a.splice(a.indexOf(f), 1);
    var ti = a.indexOf(find(toId)); a.splice(afterDisplay ? ti : ti + 1, 0, f);
  });
}
function alignSel(kind) {
  var es = selEls().filter(function (e) { return !e.locked && !e.hidden; }); if (!es.length) return;
  var bb = es.length === 1 ? { x: 0, y: 0, r: PW, b: PH, cx: PW / 2, cy: PH / 2 } : unionBox(es);
  mut(function () {
    es.forEach(function (e) {
      var a = JF.aabb(e), dx = 0, dy = 0;
      if (kind === 'l') dx = bb.x - a.x; else if (kind === 'c') dx = bb.cx - a.cx; else if (kind === 'r') dx = bb.r - a.r;
      else if (kind === 't') dy = bb.y - a.y; else if (kind === 'm') dy = bb.cy - a.cy; else if (kind === 'b') dy = bb.b - a.b;
      e.x = r2(e.x + dx); e.y = r2(e.y + dy);
    });
  });
}
function centerPage(axis) {
  var es = selEls().filter(function (e) { return !e.locked && !e.hidden; }); if (!es.length) return; var bb = unionBox(es);
  mut(function () { es.forEach(function (e) { if (axis === 'h') e.x = r2(e.x + PW / 2 - bb.cx); else e.y = r2(e.y + PH / 2 - bb.cy); }); });
}
function centerPage(axis) {
  var es = selEls().filter(function (e) { return !e.locked && !e.hidden; }); if (!es.length) return; var bb = unionBox(es);
  mut(function () { es.forEach(function (e) { if (axis === 'h') e.x = r2(e.x + PW / 2 - bb.cx); else e.y = r2(e.y + PH / 2 - bb.cy); }); });
}
function centerPage(axis) {
  var es = selEls().filter(function (e) { return !e.locked && !e.hidden; }); if (!es.length) return; var bb = unionBox(es);
  mut(function () { es.forEach(function (e) { if (axis === 'h') e.x = r2(e.x + PW / 2 - bb.cx); else e.y = r2(e.y + PH / 2 - bb.cy); }); });
}
function distribute(axis) {
  var es = selEls().filter(function (e) { return !e.locked && !e.hidden; }); if (es.length < 3) return;
  var k = axis === 'h' ? 'x' : 'y', wk = axis === 'h' ? 'w' : 'h';
  var arr = es.map(function (e) { return { e: e, a: JF.aabb(e) }; }).sort(function (p, q) { return p.a[k] - q.a[k]; });
  var first = arr[0].a[k], last = arr[arr.length - 1].a[k] + arr[arr.length - 1].a[wk], sum = 0; arr.forEach(function (p) { sum += p.a[wk]; });
  var gap = (last - first - sum) / (arr.length - 1);
  mut(function () { var pos = first; arr.forEach(function (p) { var d = pos - p.a[k]; p.e[k] = r2(p.e[k] + d); pos += p.a[wk] + gap; }); });
}

/* ---------- 上のコンテキストツールバー ---------- */
function ctxControl(p, es) {
  var e0 = es[0];
  if (p.t === 'sel') return selInput(p.opts, e0[p.k], function (v) { setProp(p.k, v); }, p.w);
  if (p.t === 'num') {
    var o = { v: e0[p.k], min: p.min, max: p.max, step: p.step, label: p.l, on: function (v) { setProp(p.k, v); }, stepBy: p.k === 'size' ? 1 : p.step };
    var w = h('span', 'fe-ctl'); if (p.cl) w.appendChild(tx('span', 'fe-cl', p.cl));
    var c = p.stp ? stepper(o) : numInput(o); if (!p.stp) { c.style.width = (p.w || 56) + 'px'; c.style.height = '30px'; } w.appendChild(c); w.style.display = 'inline-flex'; w.style.alignItems = 'center'; w.style.gap = '6px'; return w;
  }
  if (p.t === 'bold') { var b = ibtn('bold', '太字', function () { setProp('weight', e0.weight >= 600 ? 400 : 700); }, e0.weight >= 600 ? 'on' : ''); return b; }
  if (p.t === 'vert') { return ibtn('vt', '縦書き', function () { setProp('vertical', !e0.vertical); }, e0.vertical ? 'on' : ''); }
  if (p.t === 'col') return swatch(e0[p.k], p.none, function (v) { setProp(p.k, v); }, null);
  if (p.t === 'alignh') return seg([['left', 'tl', '左揃え'], ['center', 'tc', '中央揃え'], ['right', 'tr', '右揃え']], e0.align, function (v) { setProp('align', v); });
  return null;
}
function schemaFor(es) {
  var t0 = es[0].type; return (SCHEMA[t0] || []).filter(function (p) { return es.every(function (e) { return p.k in e; }); });
}
var SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72, 96];
var STYLES = [
  ['大見出し', { size: 28, weight: 700, lineHeight: 1.2 }, 'font-size:20px;font-weight:700'],
  ['見出し', { size: 18, weight: 700, lineHeight: 1.3 }, 'font-size:16px;font-weight:700'],
  ['本文', { size: 11, weight: 400, lineHeight: 1.5 }, 'font-size:13px'],
  ['注釈', { size: 8, weight: 400, lineHeight: 1.4, color: '#6b7280' }, 'font-size:11px;color:#6b7280']
];
function applyStyle(st) { var es = selEls().filter(function (e) { return !e.locked; }); if (!es.length) return; mut(function () { es.forEach(function (e) { Object.keys(st).forEach(function (k) { if (k in e) e[k] = st[k]; }); }); }); }
function sizeCtl(p, es, o) {
  var w = h('span', 'fe-ctl'); w.style.cssText = 'display:inline-flex;align-items:center;gap:2px'; w.appendChild(stepper(o));
  var dd = ibtn('chevD', '文字サイズの一覧', function () { openMenu(0, 0, SIZES.map(function (n) { return { l: n + ' pt', fn: function () { setProp(p.k, n); } }; }), dd); });
  dd.style.width = '24px'; w.appendChild(dd); return w;
}
function drawCtx() {
  var c = R.ctx; c.textContent = '';
  if (!S.open) return;
  if (S.preview) { c.appendChild(tx('span', 'fe-hint', 'プレビュー表示です。編集はパソコンの画面で行ってください。')); return; }
  var es = selEls();
  if (!es.length) { c.appendChild(tx('span', 'fe-hint', '要素をクリックで選択・ドラッグで移動。文字や表の値はダブルクリックでその場で編集できます。左のメニューから要素を追加できます。')); tipify(c); return; }
  if (es.length > 1) {
    c.appendChild(tx('b', null, es.length + '個を選択'));
    c.appendChild(h('span', 'fe-sep'));
    c.appendChild(seg([['l', 'al', '左端にそろえる'], ['c', 'ac', '左右の中央にそろえる'], ['r', 'ar', '右端にそろえる']], '', alignSel));
    c.appendChild(seg([['t', 'at', '上端にそろえる'], ['m', 'am', '上下の中央にそろえる'], ['b', 'ab', '下端にそろえる']], '', alignSel));
    var dh = ibtn('dh', '左右に等間隔で並べる（3個以上）', function () { distribute('h'); }), dv = ibtn('dv', '上下に等間隔で並べる（3個以上）', function () { distribute('v'); });
    dh.disabled = dv.disabled = es.length < 3; c.appendChild(dh); c.appendChild(dv); c.appendChild(h('span', 'fe-sep'));
  }
  if (es.every(function (e) { return e.type === 'text' || e.type === 'field'; })) {
    var sb = lbtn('styl', 'スタイル', '文字のスタイル（大見出し・見出し・本文・注釈）', function () { openMenu(0, 0, STYLES.map(function (x) { return { l: x[0], st: x[2], fn: function () { applyStyle(x[1]); } }; }), sb); });
    c.appendChild(sb); c.appendChild(h('span', 'fe-sep'));
  }
  var first = true;
  schemaFor(es).forEach(function (p) {
    if (!p.ctx) return;
    var x;
    if (p.t === 'num' && p.k === 'size') x = sizeCtl(p, es, { v: es[0][p.k], min: p.min, max: p.max, step: p.step, label: p.l, on: function (v) { setProp(p.k, v); }, stepBy: 1 });
    else x = ctxControl(p, es);
    if (!x) return;
    if (p.t === 'col' || p.t === 'sel' || p.t === 'num') x.setAttribute('data-tip', p.l);
    if (p.k === 'letterSpacing' || p.k === 'strokeWidth' && es[0].type === 'rect') c.appendChild(h('span', 'fe-sep'));
    c.appendChild(x); first = false;
  });
  c.appendChild(h('span', 'fe-sep'));
  var op = labeledNum('透明度', { v: Math.round(es[0].opacity * 100), min: 0, max: 100, step: 1, label: '不透明度', on: function (v) { setProp('opacity', v / 100); } }); op.style.width = '104px'; op.setAttribute('data-tip', '不透明度（%）'); c.appendChild(op);
  c.appendChild(h('span', 'fe-sep'));
  c.appendChild(lbtn('front', '前面へ', 'ひとつ前面へ (Ctrl+])', function () { arrange('up'); })); c.appendChild(lbtn('back', '背面へ', 'ひとつ背面へ (Ctrl+[)', function () { arrange('down'); }));
  c.appendChild(h('span', 'fe-sep'));
  var lk = es.every(function (e) { return e.locked; });
  c.appendChild(lbtn('copy', '複製', '複製 (Ctrl+D)', dupSel));
  c.appendChild(lbtn(lk ? 'lock' : 'unlock', lk ? 'ロック中' : 'ロック', lk ? 'ロックを解除（動かせるようにする）' : 'ロック（動かせなくする）', function () { setProp('locked', !lk); }, lk ? 'on' : ''));
  c.appendChild(lbtn('trash', '削除', '削除 (Delete)', removeSel, 'dng'));
  tipify(c);
}

/* ---------- 右の詳細パネル ---------- */
function prow(label, ctl, wide) { var d = h('div', 'fe-pr'); if (label) d.appendChild(tx('label', null, label)); if (wide || !label) { ctl.classList.add('fe-wide'); } d.appendChild(ctl); return d; }
function propControl(p, es) {
  var e0 = es[0], P = h('div'), same = function (k) { return es.every(function (e) { return e[k] === e0[k]; }); };
  if (p.t === 'sel') return prow(p.l, selInput(p.opts, e0[p.k], function (v) { setProp(p.k, v); }));
  if (p.t === 'num') { var no = { v: e0[p.k], min: p.min, max: p.max, step: p.step, label: p.l, on: function (v) { setProp(p.k, v); } }, n; if (p.u) { n = h('div', 'fe-nl u'); var ni = numInput(no); n.appendChild(ni); n.appendChild(tx('span', 'fe-u', p.u)); } else n = numInput(no); return prow(p.l, n); }
  if (p.t === 'col') return prow(p.l, swatch(e0[p.k], p.none, function (v) { setProp(p.k, v); }, e0[p.k] === 'accent' ? 'アクセント色' : e0[p.k] === 'secondary' ? 'サブカラー' : (!e0[p.k] || e0[p.k] === 'transparent') ? 'なし' : e0[p.k]));
  if (p.t === 'bold') return chkInput('太字', e0.weight >= 600, function (v) { setProp('weight', v ? 700 : 400); });
  if (p.t === 'vert') return chkInput('縦書き', e0.vertical, function (v) { setProp('vertical', v); });
  if (p.t === 'chk') {
    if (p.tv) return chkInput(p.l, e0[p.k] === p.tv[1], function (v) { setProp(p.k, v ? p.tv[1] : p.tv[0]); });
    return chkInput(p.l, e0[p.k], function (v) { setProp(p.k, v); });
  }
  if (p.t === 'alignh') return prow(p.l, seg([['left', 'tl', '左揃え'], ['center', 'tc', '中央揃え'], ['right', 'tr', '右揃え']], e0.align, function (v) { setProp('align', v); }));
  if (p.t === 'alignv') return prow(p.l, seg([['top', 'vtop', '上揃え'], ['middle', 'vmid', '中央揃え'], ['bottom', 'vbot', '下揃え']], e0.valign, function (v) { setProp('valign', v); }));
  if (p.t === 'area') {
    var d = h('div'); d.appendChild(tx('label', null, p.l)); d.lastChild.style.marginBottom = '4px'; var ta = h('textarea'); ta.rows = 3; ta.value = es.length === 1 ? e0[p.k] : ''; ta.placeholder = es.length === 1 ? '' : '（複数選択中）';
    ta.onchange = function () { setProp(p.k, ta.value); }; d.appendChild(ta); d.style.marginBottom = '8px'; return d;
  }
  if (p.t === 'text') { var i = h('input'); i.type = 'text'; i.value = same(p.k) ? e0[p.k] : ''; i.onchange = function () { setProp(p.k, i.value); }; return prow(p.l, i); }
  if (p.t === 'hint') { var hp = tx('p', null, p.l); return hp; }
  if (p.t === 'item') {
    var opts = [['', '（選んでください）']].concat(V().items.map(function (it) { return [it.id, it.label || '（無題）']; }));
    return prow(p.l, selInput(opts, e0.itemId, function (v) { var it = JF.itemById(V(), v); mut(function () { es.forEach(function (e) { e.itemId = v; if (it && (!e.name || e.name === JF.TYPE_NAMES.field)) e.name = it.label; }); }); }));
  }
  if (p.t === 'items') {
    var box = h('div', 'fe-its'), items = V().items;
    if (!items.length) box.appendChild(tx('p', null, '項目がありません（詳細編集の「項目」で追加）'));
    items.forEach(function (it) {
      var l = h('label', 'fe-chk'), c = h('input'); c.type = 'checkbox'; c.checked = e0.itemIds.indexOf(it.id) >= 0;
      c.onchange = function () { var on = {}; box.querySelectorAll('input').forEach(function (x, ix) { on[items[ix].id] = x.checked; }); setProp('itemIds', items.filter(function (x) { return on[x.id]; }).map(function (x) { return x.id; })); };
      l.appendChild(c); l.appendChild(document.createTextNode(it.label || '（無題）')); box.appendChild(l);
    });
    var wrap = h('div'); wrap.appendChild(tx('label', null, p.l)); wrap.lastChild.style.marginBottom = '4px'; wrap.appendChild(box); wrap.style.marginBottom = '8px'; return wrap;
  }
  if (p.t === 'imgsrc') {
    var w2 = h('div'), pr = h('div', 'fe-imgp'), th = h('div', 'th'), src = e0.src === 'map' ? C.imageSrc(V().map, 'map') : e0.src === 'logo' ? C.imageSrc(V().logo, 'logo') : e0.src;
    if (src) th.style.backgroundImage = 'url("' + src.replace(/"/g, '%22') + '")'; pr.appendChild(th);
    var lab = tx('div', null, e0.src === 'map' ? 'このデザインの地図' : e0.src === 'logo' ? 'このデザインのロゴ' : e0.src ? '埋め込み画像' : '画像なし'); lab.style.cssText = 'font-size:12px;color:var(--mut)'; pr.appendChild(lab); w2.appendChild(pr);
    var g2 = h('div', 'fe-two'); g2.appendChild(tbtn('upload', 'アップロード', function () { pickUpload(function (u) { setProp('src', u); }); }, 'fe-card2')); g2.appendChild(tbtn('folder', '素材から選ぶ', function () { H.pickImage(function (u) { setProp('src', u); }); }, 'fe-card2'));
    g2.appendChild(tbtn('map', '地図', function () { setProp('src', 'map'); }, 'fe-card2')); g2.appendChild(tbtn('pin', 'ロゴ', function () { setProp('src', 'logo'); }, 'fe-card2'));
    Array.prototype.forEach.call(g2.children, function (b) { b.style.cssText = 'border:1px solid var(--bd);height:34px;font-weight:500;font-size:12px'; });
    w2.appendChild(g2); w2.style.marginBottom = '8px'; return w2;
  }
  return P;
}
/* ---------- 項目の内容（表の行・フィールドの設定） ---------- */
var SRC_OPTS = [['fixed', '固定の文字'], ['date', '日付'], ['column', '名簿の列'], ['schedule', '時間割'], ['autonumber', '自動の連番']];
var SIZE_OPTS = [['S', '小'], ['M', 'ふつう'], ['L', '大'], ['XL', '特大']];
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function todayStr() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function itemDisplay(it) { return it.source === 'schedule' ? C.sched(it).map(function (r) { return (r.t + ' ' + r.c).trim(); }).join('\n') : C.value(it, stu()); }
function changeSource(it, v) {
  var cur = itemDisplay(it);
  mut(function () {
    it.source = v;
    if (v === 'fixed') it.value = it.value && !DATE_RE.test(it.value) ? it.value : cur;
    else if (v === 'date' && !DATE_RE.test(it.value)) it.value = todayStr();
    else if (v === 'schedule' && !it.rows.length) it.rows = [{ t: '10:00〜11:30', c: '英語' }];
    else if (v === 'column' && !it.column) it.column = it.label;
  });
}
function textIn(val, on, ph) { var i = h('input'); i.type = 'text'; i.value = val; if (ph) i.placeholder = ph; i.onchange = function () { on(i.value); }; i.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } }; return i; }
/* 時間割の行の編集（右の詳細と、ページ上のポップアップで共通） */
function schedEditor(it) {
  var w = h('div');
  function draw() {
    w.textContent = '';
    it.rows.forEach(function (r, i) {
      var row = h('div', 'fe-sr'), t = textIn(r.t, function (v) { mut(function () { r.t = v; }); }, '10:00〜11:30'), c = textIn(r.c, function (v) { mut(function () { r.c = v; }); }, '科目');
      var x = ibtn('trash', 'この行を削除', function () { mut(function () { it.rows.splice(i, 1); }); draw(); });
      row.appendChild(t); row.appendChild(c); row.appendChild(x); w.appendChild(row);
    });
    var add = h('button', 'fe-bt', '行を追加'); add.type = 'button'; add.style.cssText = 'width:100%;margin-top:2px'; add.onclick = function () { mut(function () { it.rows.push({ t: '', c: '' }); }); draw(); };
    w.appendChild(add); tipify(w);
  }
  draw(); return w;
}
function valueEditor(b, it) {
  var src = it.source;
  if (src === 'fixed') b.appendChild(prow('値', textIn(it.value, function (v) { mut(function () { it.value = v; }); })));
  else if (src === 'date') { var di = h('input'); di.type = 'date'; di.value = DATE_RE.test(it.value) ? it.value : ''; di.onchange = function () { mut(function () { it.value = di.value; }); }; b.appendChild(prow('日付', di)); }
  else if (src === 'column') {
    var cols = H.columns ? H.columns() : [], cur = it.column || it.label;
    if (cols.length) { if (cols.indexOf(cur) < 0) cols = [cur].concat(cols); b.appendChild(prow('名簿の列', selInput(cols.map(function (x) { return [x, x]; }), cur, function (v) { mut(function () { it.column = v; }); }))); }
    else b.appendChild(prow('名簿の列', textIn(cur, function (v) { mut(function () { it.column = v; }); })));
    b.appendChild(prow('空のとき', textIn(it.fallback, function (v) { mut(function () { it.fallback = v; }); }, '代わりの文字')));
  }
  else if (src === 'schedule') { var sw = schedEditor(it); sw.style.marginBottom = '8px'; b.appendChild(sw); }
  else if (src === 'autonumber') {
    b.appendChild(prow('先頭の文字', textIn(it.auto.prefix, function (v) { mut(function () { it.auto.prefix = v; }); })));
    b.appendChild(prow('開始番号', numInput({ v: it.auto.start, min: 0, max: 99999, step: 1, label: '開始番号', on: function (v) { mut(function () { it.auto.start = v; }); } })));
    b.appendChild(prow('桁数', numInput({ v: it.auto.digits, min: 1, max: 8, step: 1, label: '桁数', on: function (v) { mut(function () { it.auto.digits = v; }); } })));
  }
}
function itemBox(it, full, tb) {
  var b = h('div', 'fe-itbox'); b.appendChild(tx('h5', null, full ? '選択中の項目：' + (it.label || '（無題）') : '項目の内容（この項目を使う所すべてに反映）'));
  b.appendChild(prow('項目名', textIn(it.label, function (v) { v = v.trim(); if (v) mut(function () { it.label = v; }); })));
  b.appendChild(prow('入る値', selInput(SRC_OPTS, it.source, function (v) { changeSource(it, v); })));
  valueEditor(b, it);
  if (full) {
    b.appendChild(prow('文字の大きさ', selInput(SIZE_OPTS, it.size, function (v) { mut(function () { it.size = v; if (tb) tb.itemSize = true; }); })));
    b.appendChild(chkInput('アクセント色で強調する', it.color === 'accent', function (v) { mut(function () { it.color = v ? 'accent' : 'black'; }); }));
    b.appendChild(chkInput('半分の幅（隣の半分幅の項目と横に並べる）', it.width === 'half', function (v) { mut(function () { it.width = v ? 'half' : 'full'; }); }));
    if (tb) { var rb = h('button', 'fe-bt', 'この項目を表から外す'); rb.type = 'button'; rb.style.cssText = 'width:100%;height:32px;margin:2px 0 10px;border:1px solid var(--bd);font-size:12px;font-weight:500;background:var(--panel)'; rb.onclick = function () { mut(function () { tb.itemIds = tb.itemIds.filter(function (x) { return x !== it.id; }); S.rowSel = null; }); }; b.appendChild(rb); }
  }
  return b;
}
function drawProps() {
  var P = R.props; P.textContent = '';
  if (!S.open) return;
  var es = selEls(); if (!es.length) return;
  var one = es.length === 1, e0 = es[0];
  var ph = h('div', 'fe-phd'); ph.appendChild(tx('h4', null, '詳細')); ph.appendChild(ibtn('chevR', '詳細パネルを閉じる', function () { S.rcol = true; saveUI(); drawFrame(); })); P.appendChild(ph);
  var hd = h('div', 'fe-it'); hd.appendChild(h('span', 'fe-ty', ic(one ? TYPE_ICON[e0.type] : 'layers')));
  if (one) { var nm = h('input'); nm.type = 'text'; nm.value = layerName(e0); nm.setAttribute('aria-label', '要素の名前'); nm.onchange = function () { var v = nm.value.trim(); setProp('name', !v || v === autoName(e0) ? JF.TYPE_NAMES[e0.type] : v); }; hd.appendChild(nm); }
  else hd.appendChild(tx('b', null, es.length + '個の要素'));
  hd.lastChild.style.flex = '1'; hd.firstChild.style.cssText = 'color:var(--mut);display:flex;margin-right:4px'; hd.style.marginTop = '8px'; P.appendChild(hd);
  /* 表：行をクリックした項目の設定 */
  if (one && e0.type === 'table') {
    var rit = S.rowSel && S.rowSel.eid === e0.id ? JF.itemById(V(), S.rowSel.iid) : null;
    if (rit) P.appendChild(itemBox(rit, true, e0));
    else P.appendChild(tx('p', null, '表の行をクリックすると、その項目の設定（項目名・入る値・大きさ・色）がここに出ます。値や項目名はダブルクリックでその場で編集できます。')).style.marginTop = '10px';
  }
  P.appendChild(tx('h4', null, '位置とサイズ'));
  if (one) {
    var g = h('div', 'fe-g4'), lineish = e0.type === 'line' || e0.type === 'fold';
    function geomIn(label, k, min, max) { return labeledNum(label, { v: e0[k], min: min, max: max, step: 0.1, label: label, on: function (v) { if (e0.locked) { H.toast('ロック中の要素は動かせません'); return; } mut(function () { e0[k] = r2(v); }); } }, k === 'rot' ? '°' : 'mm'); }
    g.appendChild(geomIn('X', 'x', -2000, 2000)); g.appendChild(geomIn('Y', 'y', -2000, 2000)); g.appendChild(geomIn(lineish ? '長さ' : '幅', 'w', 0, 2000));
    if (!lineish) g.appendChild(geomIn('高さ', 'h', 0, 2000)); g.appendChild(geomIn('回転', 'rot', -360, 360)); P.appendChild(g);
  } else { var u = unionBox(es); P.appendChild(tx('p', null, '範囲：X ' + fmt(u.x) + ' / Y ' + fmt(u.y) + ' / 幅 ' + fmt(u.w) + ' / 高さ ' + fmt(u.h) + '（mm）')); }
  var op = labeledNum('不透明度', { v: Math.round(e0.opacity * 100), min: 0, max: 100, step: 1, label: '不透明度', on: function (v) { setProp('opacity', v / 100); } }, '%'); P.appendChild(op); op.style.marginBottom = '10px';
  var bt = h('div', 'fe-two'); bt.style.marginBottom = '4px';
  var lk = es.every(function (e) { return e.locked; }), hid = es.every(function (e) { return e.hidden; });
  [tbtn(lk ? 'lock' : 'unlock', lk ? 'ロック解除' : 'ロック', function () { setProp('locked', !lk); }), tbtn(hid ? 'eyeoff' : 'eye', hid ? '表示する' : '非表示', function () { setProp('hidden', !hid); }), tbtn('copy', '複製', dupSel), tbtn('trash', '削除', removeSel)].forEach(function (b) { b.style.cssText = 'border:1px solid var(--bd);font-weight:500;font-size:12px;height:32px'; bt.appendChild(b); });
  P.appendChild(bt);
  var sc = schemaFor(es);
  if (sc.length) { P.appendChild(tx('h4', null, JF.TYPE_NAMES[e0.type] + 'の設定')); sc.forEach(function (p) { P.appendChild(propControl(p, es)); }); }
  if (one && e0.type === 'field') { var fit = JF.itemById(V(), e0.itemId); if (fit) { P.appendChild(tx('h4', null, '項目の内容')); P.appendChild(itemBox(fit, false)); } }
  if (one && e0.type === 'notes') {
    P.appendChild(tx('h4', null, '注意事項の本文'));
    var nta = h('textarea'); nta.rows = 8; nta.value = V().notes; nta.onchange = function () { mut(function () { V().notes = nta.value; }); }; P.appendChild(nta);
    P.appendChild(tx('p', null, '1行に1項目。行の先頭に「!」を付けると強調（色つき・太字）になります。ページ上でダブルクリックしても編集できます。')).style.marginTop = '6px';
  }
  if (es.length > 1) { P.appendChild(tx('h4', null, '整列')); var al = h('div'); al.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap'; al.appendChild(seg([['l', 'al', '左端にそろえる'], ['c', 'ac', '左右の中央にそろえる'], ['r', 'ar', '右端にそろえる']], '', alignSel)); al.appendChild(seg([['t', 'at', '上端にそろえる'], ['m', 'am', '上下の中央にそろえる'], ['b', 'ab', '下端にそろえる']], '', alignSel)); P.appendChild(al); }
  tipify(P);
}
function pickUpload(cb) {
  var f = h('input'); f.type = 'file'; f.accept = 'image/*'; f.style.display = 'none'; document.body.appendChild(f);
  f.onchange = function () { var fl = f.files[0]; f.remove(); if (fl) H.resizeImage(fl, cb); };
  f.click();
}

/* ---------- 左のレール・パネル ---------- */
var TABS = [['tpl', 'テンプレ', 'tpl'], ['text', 'テキスト', 'text'], ['shape', '図形', 'shape'], ['img', '画像', 'image'], ['el', '要素', 'elements'], ['lay', 'レイヤー', 'layers'], ['pg', 'ページ', 'page']];
function drawRail() {
  R.rail.textContent = '';
  TABS.forEach(function (t) {
    var on = S.lopen && S.tab === t[0], b = h('button', on ? 'on' : '', ic(t[2]) + '<span>' + t[1] + '</span>'); b.type = 'button'; b.setAttribute('data-tab', t[0]);
    b.setAttribute('data-tip', on ? t[1] + 'のパネルを閉じる' : t[1] + 'のパネルを開く');
    b.onclick = function () { if (S.lopen && S.tab === t[0]) closeLeft(); else openLeft(t[0]); }; R.rail.appendChild(b);
  });
}
function card(icon, label, fn) { var b = h('button', 'fe-card', ic(icon) + '<span>' + esc(label) + '</span>'); b.type = 'button'; b.onclick = fn; return b; }
function rowBtn(icon, title, sub, fn, cls) { var b = h('button', 'fe-row' + (cls ? ' ' + cls : ''), ic(icon) + '<span><b>' + esc(title) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>'); b.type = 'button'; if (fn) b.onclick = fn; return b; }
function drawPanel() {
  var P = R.panel; if (!P) return; var keep = P.scrollTop; P.textContent = '';
  if (!S.lopen) return; var fn = { tpl: panelTpl, text: panelText, shape: panelShape, img: panelImg, el: panelEl, lay: panelLay, pg: panelPg }[S.tab]; if (fn) fn(P); tipify(P);
  P.scrollTop = keep;
}
/* ---------- テンプレタブ：ひな形・既存デザインからの変換 ---------- */
function pageFor(els) {
  var v = JSON.parse(JSON.stringify(V())); v.tpl.free = { bg: '#ffffff', elements: els, guides: [] };
  return JT.render('free', H.students()[0] || H.sample(), JT.mkVals('free', v));
}
function thumb(page) {
  var box = h('div', 'fe-thumb'); page.style.transform = 'scale(' + (102 / (210 * PXMM)) + ')'; box.appendChild(page); H.fitAll(page); return box;
}
function tcard(th, name, sub, fn) {
  var b = h('button', 'fe-tcard'); b.type = 'button'; b.appendChild(th); var d = h('div'); d.appendChild(tx('div', null, name)); if (sub) d.appendChild(tx('small', null, sub)); b.appendChild(d); b.onclick = fn; return b;
}
function applyLayout(els) {
  if (elems().length && !confirm('今の配置をすべて消して、この配置にしますか？（元に戻すで戻せます）')) return;
  mut(function () { F().elements = els; S.sel = []; }); closeLeft();
}
function convertFrom(tid) {
  var t = JT.get(tid); if (!t) return;
  if (elems().length && !confirm('今の配置をすべて消して、「' + t.name + '」の見た目に置き換えますか？（元に戻すで戻せます）')) return;
  H.toast('「' + t.name + '」を変換しています…');
  var srcV = JT.switchVals(tid, V());
  JF.convert(tid, srcV, H.students()[0] || H.sample()).then(function (r) {
    mut(function () {
      var v = V(); F().elements = JF.normElements(r.elements); F().bg = r.bg || '#ffffff'; F().guides = []; S.sel = [];
      v.accent = srcV.accent; v.secondary = srcV.secondary; v.font = srcV.font;
      if (r.wm) { v.wmAnchor = 'page'; v.wmY = r.wm.y; }
    });
    closeLeft(); H.toast('「' + t.name + '」を自由編集の要素に変換しました（' + r.count + '個）');
  }, function (e) { H.toast('変換できませんでした：' + (e && e.message || e)); });
}
function buildTplPanel() {
  var d = h('div'), Vv = V();
  d.appendChild(tx('h4', null, 'ひな形から始める'));
  d.appendChild(tx('p', null, '今の配置は置き換わります（「元に戻す」で戻せます）。'));
  var g = h('div', 'fe-two');
  JF.LAYOUTS.forEach(function (L) { var els = L.build(Vv); g.appendChild(tcard(thumb(pageFor(els)), L.name, L.desc, function () { applyLayout(L.build(V())); })); });
  g.appendChild(tcard(thumb(pageFor(JF.starter(Vv))), '初期レイアウト', 'タイトル・番号・表・折り線・注意事項', function () { applyLayout(JF.starter(V())); }));
  g.appendChild(tcard(thumb(pageFor([])), '白紙', '何もない状態から', function () { applyLayout([]); }));
  d.appendChild(g);
  d.appendChild(tx('h4', null, 'デザインを元に自由編集'));
  d.appendChild(tx('p', null, '既存のデザインを、自由に動かせる要素に変換します。名簿の値・固定の文字・日付・時間割は、そのまま入ります。'));
  var g2 = h('div', 'fe-two');
  JT.list().filter(function (t) { return t.id !== 'free'; }).forEach(function (t) {
    var pg; try { pg = JT.render(t.id, H.students()[0] || H.sample(), JT.switchVals(t.id, Vv)); } catch (e) { return; }
    g2.appendChild(tcard(thumb(pg), t.name, t.category, function () { convertFrom(t.id); }));
  });
  d.appendChild(g2);
  return d;
}
function panelTpl(P) {
  if (!S.tplEl) S.tplEl = buildTplPanel();
  P.appendChild(S.tplEl);
}
function panelPg(P) {
  P.appendChild(tx('h4', null, 'ページの設定'));
  P.appendChild(prow('背景色', swatch(F().bg, false, function (v) { mut(function () { F().bg = v || '#ffffff'; }); }, F().bg)));
  P.appendChild(chkInput('グリッドを表示（5mm）', S.grid, function (v) { S.grid = v; saveUI(); drawZoomBtns(); drawOv(); }));
  P.appendChild(chkInput('ガイド・他の要素・余白にスナップ', S.snap, function (v) { S.snap = v; saveUI(); drawZoomBtns(); }));
  if (F().guides.length) { var gb = tbtn('', 'ガイドをすべて消す', function () { mut(function () { F().guides = []; }); }); gb.style.cssText = 'border:1px solid var(--bd);font-weight:500;font-size:12px;height:32px;margin-bottom:8px'; P.appendChild(gb); }
  P.appendChild(tx('h4', null, '使い方'));
  P.appendChild(tx('p', null, '・クリックで選択、ドラッグで移動。Shift+クリックで複数選択、空きをドラッグで範囲選択。'));
  P.appendChild(tx('p', null, '・文字や表の値はダブルクリックでその場で編集。重なった要素は Alt+クリック か右クリックで選べます。'));
  P.appendChild(tx('p', null, '・「{{項目名}}」と書いた文字は、印刷のときに生徒ごとの値に置き換わります。上の「差し込み表示」で切り替えて確認できます。'));
  var hb = tbtn('help', 'ショートカット一覧を見る', showHelp); hb.style.cssText = 'border:1px solid var(--bd);font-weight:500;font-size:12px;height:32px;margin-top:6px'; P.appendChild(hb);
}
function panelText(P) {
  P.appendChild(tx('h4', null, 'テキストを追加'));
  [['見出しを追加', 'fe-txt-h', { text: '見出し', size: 26, weight: 700, w: 100, h: 14, valign: 'middle' }],
   ['本文を追加', 'fe-txt-b', { text: '本文のテキストを入力します', size: 12, w: 100, h: 16 }],
   ['小さな文字を追加', 'fe-txt-s', { text: '補足の小さな文字', size: 8, w: 80, h: 8 }]].forEach(function (x) {
    var b = h('button', 'fe-row'); b.type = 'button'; var sp = tx('span', x[1], x[0]); b.appendChild(sp); b.onclick = function () { addEl('text', x[2]); }; P.appendChild(b);
  });
  P.appendChild(tx('h4', null, '差し込み項目'));
  P.appendChild(tx('p', null, '項目名をクリックすると、その項目の「値」を表示する要素を追加します。右の「{}」は {{項目名}} のテキストを追加（文字の中に混ぜて使えます）。'));
  var sp = ['ヘッダー', 'バッジ', 'マーク'];
  sp.forEach(function (k) { P.appendChild(itemRow(k, null)); });
  var Vv = V(); Vv.items.forEach(function (it) { P.appendChild(itemRow(it.label || '（無題）', it)); });
}
function insertPh(label) {
  var s = '{{' + label + '}}';
  if (S.editing) { document.execCommand('insertText', false, s); return; }
  var es = selEls();
  if (es.length === 1 && es[0].type === 'text' && !es[0].locked) { var e = es[0]; mut(function () { e.text = (e.text ? e.text + '\n' : '') + s; }); return; }
  addEl('text', { text: s, size: 14, w: 90, h: 10, valign: 'middle', name: s });
}
function itemRow(label, it) {
  var d = h('div', 'fe-it'), b = h('button', 'fe-itm', '<span>' + esc(label) + '</span>'); b.type = 'button';
  b.title = it ? 'この項目の値を表示する要素を追加' : '{{' + label + '}} を文字として追加';
  b.onclick = function () { if (it) addEl('field', { itemId: it.id, size: 18 }); else insertPh(label); };
  d.appendChild(b); var p = ibtn('ph', '{{' + label + '}} をテキストとして挿入', function () { insertPh(label); }); p.textContent = '{}'; d.appendChild(p); return d;
}
function panelShape(P) {
  P.appendChild(tx('h4', null, '図形'));
  var g = h('div', 'fe-two');
  g.appendChild(card('rect', '四角', function () { addEl('rect', { fill: 'secondary', w: 60, h: 36 }); }));
  g.appendChild(card('round', '角丸', function () { addEl('rect', { fill: 'secondary', radius: 6, w: 60, h: 36 }); }));
  g.appendChild(card('circle', '円', function () { addEl('ellipse', { fill: 'secondary', w: 40, h: 40 }); }));
  g.appendChild(card('line', '線', function () { addEl('line', { w: 80, strokeWidth: 1, stroke: '#1f2937' }); }));
  g.appendChild(card('dashed', '点線', function () { addEl('line', { w: 80, strokeWidth: 1, stroke: '#1f2937', dash: 'dashed' }); }));
  P.appendChild(g);
  P.appendChild(tx('p', null, '追加したら右の「詳細」で色・線・角の丸みを調整できます。')).style.marginTop = '12px';
}
function panelImg(P) {
  P.appendChild(tx('h4', null, '画像を追加'));
  P.appendChild(rowBtn('upload', 'アップロード', 'この端末の画像ファイル', function () { pickUpload(function (u) { addEl('image', { src: u, w: 60, h: 60 }); }); }));
  P.appendChild(rowBtn('folder', '素材から選ぶ', 'ファイル保管の「画像」から', function () { H.pickImage(function (u) { addEl('image', { src: u, w: 60, h: 60 }); }); }));
  P.appendChild(tx('h4', null, 'このデザインの画像'));
  var Vv = V(), m = C.imageSrc(Vv.map, 'map'), l = C.imageSrc(Vv.logo, 'logo');
  P.appendChild(rowBtn('map', '地図', m ? '詳細編集の「注意事項・画像」で変更できます' : '非表示になっています', function () { addEl('image', { src: 'map', w: 62, h: 62, name: '地図' }); }));
  P.appendChild(rowBtn('pin', 'ロゴ', l ? '詳細編集の「注意事項・画像」で変更できます' : '非表示になっています', function () { addEl('image', { src: 'logo', w: 50, h: 30, name: 'ロゴ' }); }));
  P.appendChild(tx('p', null, '画像は大きすぎる場合、自動で縮小して埋め込みます。保存データが大きくなるので、必要な画像だけ使ってください。'));
}
function wmForm(P) {
  var Vv = V(), fs = JT.FIELDS.filter(function (f) { return f.tab === 'wm'; }), g = null;
  function ch(k, v) { mut(function () { Vv[k] = v; }); }
  fs.forEach(function (f) {
    var cur = Vv[f.k];
    if (f.type === 'check') { P.appendChild(chkInput(f.label, cur, function (v) { ch(f.k, v); })); return; }
    var ctl;
    if (f.type === 'number') ctl = numInput({ v: cur, step: f.k === 'wmSp' ? 0.05 : 1, label: f.label, on: function (v) { ch(f.k, v); } });
    else if (f.type === 'color') ctl = swatch(cur, false, function (v) { ch(f.k, v || '#000000'); }, cur);
    else if (f.type === 'select') ctl = selInput([['top', '用紙の上端'], ['mid', '用紙の中央'], ['bot', '用紙の下端']], cur === 'page' ? 'top' : cur, function (v) { ch(f.k, v); });
    else { ctl = h('input'); ctl.type = 'text'; ctl.value = cur; ctl.onchange = function () { ch(f.k, ctl.value); }; }
    P.appendChild(prow(f.label.replace(/（.*$/, ''), ctl));
  });
}
function panelEl(P) {
  P.appendChild(tx('h4', null, 'ブロックを追加'));
  P.appendChild(rowBtn('note', '注意事項ブロック', '「詳細編集 > 注意事項・画像」の本文を表示', function () { addEl('notes', { x: 15, y: 156, w: 112, h: 110, title: V().noteTitle || '' }); }));
  P.appendChild(rowBtn('table', '情報テーブル', '項目を表にまとめて表示', function () {
    var ids = V().items.filter(function (i) { return !i.hidden; }).map(function (i) { return i.id; });
    addEl('table', { itemIds: ids, w: 180, h: Math.max(20, Math.min(80, ids.length * 10)), x: 15, y: 60 });
  }));
  P.appendChild(rowBtn('fold', '折り線', '山折り・谷折りの目印（破線と文字）', function () { addEl('fold', { y: 148.5, x: 0, w: 210 }); }));
  P.appendChild(tx('h4', null, '透かし文字'));
  P.appendChild(tx('p', null, 'ページ全体に重ねる大きな文字です。ほかの要素の上に薄く表示されます。'));
  wmForm(P);
}
var CN = [['#000000', '黒'], ['#ffffff', '白'], ['#ef4444', '赤'], ['#f97316', 'オレンジ'], ['#facc15', '黄'], ['#22c55e', '緑'], ['#06b6d4', '水色'], ['#3b82f6', '青'], ['#8b5cf6', '紫'], ['#ec4899', 'ピンク'], ['#9ca3af', 'グレー'], ['#e5e7eb', 'うすいグレー'], ['#7c4a1e', '茶'], ['#1e3a5f', 'ネイビー'], ['#fde68a', 'うすい黄'], ['#e0e7ff', 'うすい青']];
function rgbOf(c) { c = String(c || '').replace('#', ''); if (c.length === 3) c = c.replace(/./g, '$&$&'); var n = parseInt(c, 16); return isNaN(n) ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function colorName(c) {
  if (c === 'accent') return 'アクセント色'; if (c === 'secondary') return 'サブ色'; if (!c || c === 'transparent') return '枠のみ';
  var a = rgbOf(resolveColor(c)), best = '', bd = 1e9;
  CN.forEach(function (x) { var b = rgbOf(x[0]), d = Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2); if (d < bd) { bd = d; best = x[1]; } });
  return best;
}
/* 名前を付けていない要素は、中身から自動で名前を付ける */
function autoName(e) {
  var Vv = V();
  if (e.type === 'text') { var t = JF.resolveText(e.text, Vv, H.students()[0] || H.sample()).replace(/\s+/g, ' ').trim(); return t ? (t.length > 12 ? t.slice(0, 12) + '…' : t) : '（空のテキスト）'; }
  if (e.type === 'field') { var it = JF.itemById(Vv, e.itemId); return it ? (it.label || '（無題の項目）') : '（項目が未選択）'; }
  if (e.type === 'image') return e.src === 'map' ? '地図' : e.src === 'logo' ? 'ロゴ' : /^assets\//.test(e.src) ? e.src.split('/').pop() : e.src ? '画像' : '画像（未設定）';
  if (e.type === 'rect') return '四角（' + colorName(e.fill) + '）';
  if (e.type === 'ellipse') return '円（' + colorName(e.fill) + '）';
  return JF.TYPE_NAMES[e.type] || e.type;
}
function layerName(e) { return e.name && e.name !== JF.TYPE_NAMES[e.type] ? e.name : autoName(e); }
function panelLay(P) {
  S.hover = '';
  P.appendChild(tx('h4', null, 'レイヤー（上ほど前面）'));
  P.appendChild(tx('p', null, 'マウスを乗せるとページ上で位置が光ります。クリックで選択、ドラッグで順番を変更。'));
  var a = elems();
  if (!a.length) P.appendChild(tx('p', null, '要素がありません。左のメニューから追加してください。'));
  for (var i = a.length - 1; i >= 0; i--) (function (e) {
    var r = h('div', 'fe-lay' + (S.sel.indexOf(e.id) >= 0 ? ' on' : '') + (e.hidden ? ' hid' : '')); r.setAttribute('data-id', e.id); r.draggable = true;
    r.appendChild(h('span', 'fe-gr', ic('grip'))); r.appendChild(h('span', 'fe-ty', ic(TYPE_ICON[e.type])));
    var nm = tx('span', 'fe-ln', layerName(e)); nm.title = layerName(e) + '（ダブルクリックで名前を変更）'; r.appendChild(nm);
    var ey = ibtn(e.hidden ? 'eyeoff' : 'eye', e.hidden ? '表示する' : '非表示にする', function (ev) { ev.stopPropagation(); mut(function () { e.hidden = !e.hidden; }); });
    var lk = ibtn(e.locked ? 'lock' : 'unlock', e.locked ? 'ロック解除' : 'ロック', function (ev) { ev.stopPropagation(); mut(function () { e.locked = !e.locked; }); }, e.locked ? 'on' : '');
    r.appendChild(ey); r.appendChild(lk);
    r.onmouseenter = function () { if (S.hover !== e.id) { S.hover = e.id; drawOv(); } };
    r.onmouseleave = function () { if (S.hover === e.id) { S.hover = ''; drawOv(); } };
    r.onclick = function (ev) { if (ev.shiftKey || ev.ctrlKey || ev.metaKey) { var s = S.sel.slice(), k = s.indexOf(e.id); if (k >= 0) s.splice(k, 1); else s.push(e.id); setSel(s); } else setSel([e.id]); selChanged(); };
    nm.ondblclick = function (ev) {
      ev.stopPropagation(); var inp = h('input'); inp.type = 'text'; inp.value = layerName(e); inp.style.margin = '0 4px'; r.replaceChild(inp, nm); inp.focus(); inp.select(); var done = false;
      function fin(ok) { if (done) return; done = true; var v = inp.value.trim(); if (ok && v && v !== layerName(e)) mut(function () { e.name = v; }); else drawPanel(); }
      inp.onblur = function () { fin(true); }; inp.onkeydown = function (k) { if (k.key === 'Enter') { k.preventDefault(); fin(true); } else if (k.key === 'Escape') { k.preventDefault(); k.stopPropagation(); fin(false); } }; inp.onclick = function (k) { k.stopPropagation(); };
    };
    r.ondragstart = function (ev) { layDrag = e.id; ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', e.id); } catch (x) {} };
    r.ondragover = function (ev) { if (!layDrag) return; ev.preventDefault(); var b = r.getBoundingClientRect(), after = ev.clientY > b.top + b.height / 2; r.classList.toggle('dt-a', after); r.classList.toggle('dt-b', !after); };
    r.ondragleave = function () { r.classList.remove('dt-a', 'dt-b'); };
    r.ondrop = function (ev) { ev.preventDefault(); var b = r.getBoundingClientRect(), after = ev.clientY > b.top + b.height / 2, f = layDrag; layDrag = ''; r.classList.remove('dt-a', 'dt-b'); if (f) reorder(f, e.id, after); };
    r.ondragend = function () { layDrag = ''; Array.prototype.forEach.call(P.querySelectorAll('.dt-a,.dt-b'), function (x) { x.classList.remove('dt-a', 'dt-b'); }); };
    P.appendChild(r);
  })(a[i]);
}

/* ---------- ポインタ操作 ---------- */
function pageXY(ev) { var r = R.box.getBoundingClientRect(), s = sz(); return { x: (ev.clientX - r.left) / s, y: (ev.clientY - r.top) / s }; }
function blurActive() { var a = document.activeElement; if (a && a !== document.body && root.contains(a) && a.blur && !S.editing) a.blur(); }
function snapTargets(excl) {
  var xs = [0, PW / 2, PW, 10, PW - 10], ys = [0, PH / 2, PH, 10, PH - 10];   /* ページの端・中央・余白(10mm) */
  F().guides.forEach(function (g) { (g.axis === 'x' ? xs : ys).push(g.pos); });
  elems().forEach(function (e) { if (e.hidden || excl.indexOf(e.id) >= 0) return; var a = JF.aabb(e); xs.push(a.x, a.cx, a.r); ys.push(a.y, a.cy, a.b); });
  return { xs: xs, ys: ys };
}
function bestSnap(cands, targets, thr) {
  var best = null;
  cands.forEach(function (c) { targets.forEach(function (t) { var d = t - c; if (Math.abs(d) <= thr && (best === null || Math.abs(d) < Math.abs(best))) best = d; }); });
  return best;
}
function linesAt(cands, targets, d) {
  var out = [], seen = {}; cands.forEach(function (c) { targets.forEach(function (t) { if (Math.abs(t - (c + d)) < 0.02 && !seen[t.toFixed(2)]) { seen[t.toFixed(2)] = 1; out.push(t); } }); }); return out;
}
/* ドラッグ中、上下左右でいちばん近い要素までの距離（mm） */
function neighbours(b, excl) {
  var best = {};
  elems().forEach(function (e) {
    if (e.hidden || excl.indexOf(e.id) >= 0 || e.type === 'line' || e.type === 'fold') return;
    var a = JF.aabb(e), oy = Math.min(b.b, a.b) - Math.max(b.y, a.y), ox = Math.min(b.r, a.r) - Math.max(b.x, a.x), g;
    if (oy > 0.5) { if (a.r <= b.x + 0.01) { g = b.x - a.r; if (!best.l || g < best.l.g) best.l = { g: g, a: a }; } if (a.x >= b.r - 0.01) { g = a.x - b.r; if (!best.r || g < best.r.g) best.r = { g: g, a: a }; } }
    if (ox > 0.5) { if (a.b <= b.y + 0.01) { g = b.y - a.b; if (!best.t || g < best.t.g) best.t = { g: g, a: a }; } if (a.y >= b.b - 0.01) { g = a.y - b.b; if (!best.d || g < best.d.g) best.d = { g: g, a: a }; } }
  });
  var out = [];
  function my(a) { return (Math.max(b.y, a.y) + Math.min(b.b, a.b)) / 2; } function mx(a) { return (Math.max(b.x, a.x) + Math.min(b.r, a.r)) / 2; }
  if (best.l && best.l.g > 0.2) { var y1 = my(best.l.a); out.push({ x1: best.l.a.r, y1: y1, x2: b.x, y2: y1, v: best.l.g }); }
  if (best.r && best.r.g > 0.2) { var y2 = my(best.r.a); out.push({ x1: b.r, y1: y2, x2: best.r.a.x, y2: y2, v: best.r.g }); }
  if (best.t && best.t.g > 0.2) { var x1 = mx(best.t.a); out.push({ x1: x1, y1: best.t.a.b, x2: x1, y2: b.y, v: best.t.g }); }
  if (best.d && best.d.g > 0.2) { var x2 = mx(best.d.a); out.push({ x1: x2, y1: b.b, x2: x2, y2: best.d.a.y, v: best.d.g }); }
  return out;
}
/* 名簿から入る項目の上にマウスを置くと、小さなバッジを出す */
function onHover(ev) {
  if (S.preview || S.ro || S.editing || ev.buttons) return;
  var tg = document.elementFromPoint(ev.clientX, ev.clientY), nd = tg && tg.closest && tg.closest('[data-item]'), node = nd && R.pg.contains(nd) ? nd : null;
  var it = node ? JF.itemById(V(), node.getAttribute('data-item')) : null;
  if (!it || it.source !== 'column') { if (S.hb) { S.hb = null; drawOv(); } return; }
  var nb = node.getBoundingClientRect(), near = Math.hypot(ev.clientX - (nb.right - 14), ev.clientY - (nb.top + 14)) < 22;
  if (!S.hb || S.hb.node !== node || S.hb.near !== near) { S.hb = { node: node, near: near }; drawOv(); }
}
function onCtxMenu(ev) {
  if (S.preview || S.ro) return; ev.preventDefault(); if (S.editing) return; closePop();
  var ids = underPoint(ev);
  if (ids.length && S.sel.indexOf(ids[0]) < 0) { setSel([ids[0]]); selChanged(); } else if (!ids.length && S.sel.length) { setSel([]); selChanged(); }
  var has = S.sel.length > 0, es = selEls(), lk = has && es.every(function (e) { return e.locked; });
  openMenu(ev.clientX, ev.clientY, [
    { l: 'コピー', k: 'Ctrl+C', ic: 'copy', dis: !has, fn: copySel }, { l: '貼り付け', k: 'Ctrl+V', dis: !(S.clip && S.clip.length), fn: pasteSel },
    { l: '複製', k: 'Ctrl+D', dis: !has, fn: dupSel }, { l: '削除', k: 'Delete', ic: 'trash', dis: !has, fn: removeSel }, '-',
    { l: '前面へ', k: 'Ctrl+]', dis: !has, fn: function () { arrange('up'); } }, { l: '最前面へ', k: 'Ctrl+Shift+]', dis: !has, fn: function () { arrange('front'); } },
    { l: '背面へ', k: 'Ctrl+[', dis: !has, fn: function () { arrange('down'); } }, { l: '最背面へ', k: 'Ctrl+Shift+[', dis: !has, fn: function () { arrange('back'); } }, '-',
    { l: lk ? 'ロックを解除' : 'ロック', ic: lk ? 'lock' : 'unlock', dis: !has, fn: function () { setProp('locked', !lk); } }, '-',
    { l: 'ページ中央に配置（横）', ic: 'dh', dis: !has, fn: function () { centerPage('h'); } }, { l: 'ページ中央に配置（縦）', ic: 'dv', dis: !has, fn: function () { centerPage('v'); } }, '-',
    { l: '下の要素を選択', k: 'Alt+クリック', dis: ids.length < 2, fn: function () { var ci = S.sel.length === 1 ? ids.indexOf(S.sel[0]) : -1; setSel([ids[(ci + 1) % ids.length]]); selChanged(); } }
  ]);
}
/* ドラッグ中、上下左右でいちばん近い要素までの距離（mm） */
function neighbours(b, excl) {
  var best = {};
  elems().forEach(function (e) {
    if (e.hidden || excl.indexOf(e.id) >= 0 || e.type === 'line' || e.type === 'fold') return;
    var a = JF.aabb(e), oy = Math.min(b.b, a.b) - Math.max(b.y, a.y), ox = Math.min(b.r, a.r) - Math.max(b.x, a.x), g;
    if (oy > 0.5) { if (a.r <= b.x + 0.01) { g = b.x - a.r; if (!best.l || g < best.l.g) best.l = { g: g, a: a }; } if (a.x >= b.r - 0.01) { g = a.x - b.r; if (!best.r || g < best.r.g) best.r = { g: g, a: a }; } }
    if (ox > 0.5) { if (a.b <= b.y + 0.01) { g = b.y - a.b; if (!best.t || g < best.t.g) best.t = { g: g, a: a }; } if (a.y >= b.b - 0.01) { g = a.y - b.b; if (!best.d || g < best.d.g) best.d = { g: g, a: a }; } }
  });
  var out = [];
  function my(a) { return (Math.max(b.y, a.y) + Math.min(b.b, a.b)) / 2; } function mx(a) { return (Math.max(b.x, a.x) + Math.min(b.r, a.r)) / 2; }
  if (best.l && best.l.g > 0.2) { var y1 = my(best.l.a); out.push({ x1: best.l.a.r, y1: y1, x2: b.x, y2: y1, v: best.l.g }); }
  if (best.r && best.r.g > 0.2) { var y2 = my(best.r.a); out.push({ x1: b.r, y1: y2, x2: best.r.a.x, y2: y2, v: best.r.g }); }
  if (best.t && best.t.g > 0.2) { var x1 = mx(best.t.a); out.push({ x1: x1, y1: best.t.a.b, x2: x1, y2: b.y, v: best.t.g }); }
  if (best.d && best.d.g > 0.2) { var x2 = mx(best.d.a); out.push({ x1: x2, y1: b.b, x2: x2, y2: best.d.a.y, v: best.d.g }); }
  return out;
}
/* 名簿から入る項目の上にマウスを置くと、小さなバッジを出す */
function onHover(ev) {
  if (S.preview || S.ro || S.editing || ev.buttons) return;
  var tg = document.elementFromPoint(ev.clientX, ev.clientY), nd = tg && tg.closest && tg.closest('[data-item]'), node = nd && R.pg.contains(nd) ? nd : null;
  var it = node ? JF.itemById(V(), node.getAttribute('data-item')) : null;
  if (!it || it.source !== 'column') { if (S.hb) { S.hb = null; drawOv(); } return; }
  var nb = node.getBoundingClientRect(), near = Math.hypot(ev.clientX - (nb.right - 14), ev.clientY - (nb.top + 14)) < 22;
  if (!S.hb || S.hb.node !== node || S.hb.near !== near) { S.hb = { node: node, near: near }; drawOv(); }
}
function onCtxMenu(ev) {
  if (S.preview || S.ro) return; ev.preventDefault(); if (S.editing) return; closePop();
  var ids = underPoint(ev);
  if (ids.length && S.sel.indexOf(ids[0]) < 0) { setSel([ids[0]]); selChanged(); } else if (!ids.length && S.sel.length) { setSel([]); selChanged(); }
  var has = S.sel.length > 0, es = selEls(), lk = has && es.every(function (e) { return e.locked; });
  openMenu(ev.clientX, ev.clientY, [
    { l: 'コピー', k: 'Ctrl+C', ic: 'copy', dis: !has, fn: copySel }, { l: '貼り付け', k: 'Ctrl+V', dis: !(S.clip && S.clip.length), fn: pasteSel },
    { l: '複製', k: 'Ctrl+D', dis: !has, fn: dupSel }, { l: '削除', k: 'Delete', ic: 'trash', dis: !has, fn: removeSel }, '-',
    { l: '前面へ', k: 'Ctrl+]', dis: !has, fn: function () { arrange('up'); } }, { l: '最前面へ', k: 'Ctrl+Shift+]', dis: !has, fn: function () { arrange('front'); } },
    { l: '背面へ', k: 'Ctrl+[', dis: !has, fn: function () { arrange('down'); } }, { l: '最背面へ', k: 'Ctrl+Shift+[', dis: !has, fn: function () { arrange('back'); } }, '-',
    { l: lk ? 'ロックを解除' : 'ロック', ic: lk ? 'lock' : 'unlock', dis: !has, fn: function () { setProp('locked', !lk); } }, '-',
    { l: 'ページ中央に配置（横）', ic: 'dh', dis: !has, fn: function () { centerPage('h'); } }, { l: 'ページ中央に配置（縦）', ic: 'dv', dis: !has, fn: function () { centerPage('v'); } }, '-',
    { l: '下の要素を選択', k: 'Alt+クリック', dis: ids.length < 2, fn: function () { var ci = S.sel.length === 1 ? ids.indexOf(S.sel[0]) : -1; setSel([ids[(ci + 1) % ids.length]]); selChanged(); } }
  ]);
}
/* ドラッグ中、上下左右でいちばん近い要素までの距離（mm） */
function neighbours(b, excl) {
  var best = {};
  elems().forEach(function (e) {
    if (e.hidden || excl.indexOf(e.id) >= 0 || e.type === 'line' || e.type === 'fold') return;
    var a = JF.aabb(e), oy = Math.min(b.b, a.b) - Math.max(b.y, a.y), ox = Math.min(b.r, a.r) - Math.max(b.x, a.x), g;
    if (oy > 0.5) { if (a.r <= b.x + 0.01) { g = b.x - a.r; if (!best.l || g < best.l.g) best.l = { g: g, a: a }; } if (a.x >= b.r - 0.01) { g = a.x - b.r; if (!best.r || g < best.r.g) best.r = { g: g, a: a }; } }
    if (ox > 0.5) { if (a.b <= b.y + 0.01) { g = b.y - a.b; if (!best.t || g < best.t.g) best.t = { g: g, a: a }; } if (a.y >= b.b - 0.01) { g = a.y - b.b; if (!best.d || g < best.d.g) best.d = { g: g, a: a }; } }
  });
  var out = [];
  function my(a) { return (Math.max(b.y, a.y) + Math.min(b.b, a.b)) / 2; } function mx(a) { return (Math.max(b.x, a.x) + Math.min(b.r, a.r)) / 2; }
  if (best.l && best.l.g > 0.2) { var y1 = my(best.l.a); out.push({ x1: best.l.a.r, y1: y1, x2: b.x, y2: y1, v: best.l.g }); }
  if (best.r && best.r.g > 0.2) { var y2 = my(best.r.a); out.push({ x1: b.r, y1: y2, x2: best.r.a.x, y2: y2, v: best.r.g }); }
  if (best.t && best.t.g > 0.2) { var x1 = mx(best.t.a); out.push({ x1: x1, y1: best.t.a.b, x2: x1, y2: b.y, v: best.t.g }); }
  if (best.d && best.d.g > 0.2) { var x2 = mx(best.d.a); out.push({ x1: x2, y1: b.b, x2: x2, y2: best.d.a.y, v: best.d.g }); }
  return out;
}
/* 名簿から入る項目の上にマウスを置くと、小さなバッジを出す */
function onHover(ev) {
  if (S.preview || S.ro || S.editing || ev.buttons) return;
  var tg = document.elementFromPoint(ev.clientX, ev.clientY), nd = tg && tg.closest && tg.closest('[data-item]'), node = nd && R.pg.contains(nd) ? nd : null;
  var it = node ? JF.itemById(V(), node.getAttribute('data-item')) : null;
  if (!it || it.source !== 'column') { if (S.hb) { S.hb = null; drawOv(); } return; }
  var nb = node.getBoundingClientRect(), near = Math.hypot(ev.clientX - (nb.right - 14), ev.clientY - (nb.top + 14)) < 22;
  if (!S.hb || S.hb.node !== node || S.hb.near !== near) { S.hb = { node: node, near: near }; drawOv(); }
}
function onCtxMenu(ev) {
  if (S.preview || S.ro) return; ev.preventDefault(); if (S.editing) return; closePop();
  var ids = underPoint(ev);
  if (ids.length && S.sel.indexOf(ids[0]) < 0) { setSel([ids[0]]); selChanged(); } else if (!ids.length && S.sel.length) { setSel([]); selChanged(); }
  var has = S.sel.length > 0, es = selEls(), lk = has && es.every(function (e) { return e.locked; });
  openMenu(ev.clientX, ev.clientY, [
    { l: 'コピー', k: 'Ctrl+C', ic: 'copy', dis: !has, fn: copySel }, { l: '貼り付け', k: 'Ctrl+V', dis: !(S.clip && S.clip.length), fn: pasteSel },
    { l: '複製', k: 'Ctrl+D', dis: !has, fn: dupSel }, { l: '削除', k: 'Delete', ic: 'trash', dis: !has, fn: removeSel }, '-',
    { l: '前面へ', k: 'Ctrl+]', dis: !has, fn: function () { arrange('up'); } }, { l: '最前面へ', k: 'Ctrl+Shift+]', dis: !has, fn: function () { arrange('front'); } },
    { l: '背面へ', k: 'Ctrl+[', dis: !has, fn: function () { arrange('down'); } }, { l: '最背面へ', k: 'Ctrl+Shift+[', dis: !has, fn: function () { arrange('back'); } }, '-',
    { l: lk ? 'ロックを解除' : 'ロック', ic: lk ? 'lock' : 'unlock', dis: !has, fn: function () { setProp('locked', !lk); } }, '-',
    { l: 'ページ中央に配置（横）', ic: 'dh', dis: !has, fn: function () { centerPage('h'); } }, { l: 'ページ中央に配置（縦）', ic: 'dv', dis: !has, fn: function () { centerPage('v'); } }, '-',
    { l: '下の要素を選択', k: 'Alt+クリック', dis: ids.length < 2, fn: function () { var ci = S.sel.length === 1 ? ids.indexOf(S.sel[0]) : -1; setSel([ids[(ci + 1) % ids.length]]); selChanged(); } }
  ]);
}
function onDown(ev) {
  if (S.preview || S.ro || ev.button !== 0) return;
  var t = ev.target, vr = R.scroll.getBoundingClientRect();
  if (ev.clientX > vr.left + R.scroll.clientWidth || ev.clientY > vr.top + R.scroll.clientHeight) return;
  if (S.editing) { if (S.editing.node.contains(t)) return; finishEdit(true); }
  closePop(); blurActive();
  var hd = t.closest && t.closest('[data-h]');
  if (hd && R.ov.contains(hd)) return startHandle(ev, hd.getAttribute('data-h'));
  var gd = t.closest && t.closest('.fe-guide'); if (gd) return startGuide(ev, +gd.getAttribute('data-gi'));
  var rl = t.closest && t.closest('.fe-ruler'); if (rl) return startGuide(ev, -1, rl.getAttribute('data-axis'));
  var nd = t.closest && t.closest('[data-eid]');
  if (nd && R.pg.contains(nd)) {
    var id = nd.getAttribute('data-eid'), tg = t;
    if (ev.altKey) { var ids = underPoint(ev); if (ids.length) { var ci = S.sel.length === 1 ? ids.indexOf(S.sel[0]) : -1; id = ids[ci < 0 ? 0 : (ci + 1) % ids.length]; tg = null; } }
    return startMove(ev, id, tg);
  }
  startMarquee(ev);
}
function cap(ev) { try { R.scroll.setPointerCapture(ev.pointerId); } catch (e) {} }
/* ポインタの位置にある要素のid（前面から順に）。Alt+クリック・右クリックの「下の要素を選択」で使う */
function underPoint(ev) {
  var ids = []; document.elementsFromPoint(ev.clientX, ev.clientY).forEach(function (n) { var d = n.closest && n.closest('[data-eid]'); if (d && R.pg.contains(d)) { var id = d.getAttribute('data-eid'); if (ids.indexOf(id) < 0) ids.push(id); } });
  return ids;
}
function startMove(ev, id, tg) {
  var e = find(id); if (!e) return;
  var was = S.sel.indexOf(id) >= 0, cell = tg && tg.closest && tg.closest('.fz-tc'), tn = nodeOf(id);
  S.rowSel = (e.type === 'table' && cell && tn && tn.contains(cell) && !ev.shiftKey) ? { eid: id, iid: cell.getAttribute('data-item') } : null;
  if (ev.shiftKey) { var s = S.sel.slice(); if (was) { s.splice(s.indexOf(id), 1); setSel(s); selChanged(); return; } s.push(id); setSel(s); selChanged(); }
  else if (!was) { setSel([id]); selChanged(); }
  var mv = selEls().filter(function (x) { return !x.locked; });
  drag = { mode: 'move', sx: ev.clientX, sy: ev.clientY, moved: false, id: id, shift: ev.shiftKey, wasSel: was, els: mv, orig: mv.map(function (x) { return { e: x, x: x.x, y: x.y }; }), bbox: unionBox(mv), lines: [], targets: snapTargets(mv.map(function (x) { return x.id; })), ov: null };
  if (!mv.length) drag.mode = 'click';
  cap(ev);
}
function startHandle(ev, hn) {
  var e = selEls()[0]; if (!e || e.locked) return;
  var s = sz(), q = JF.geom(e), br = R.box.getBoundingClientRect();
  if (hn === 'rot') {
    var cx = br.left + (q.x + q.w / 2) * s, cy = br.top + (q.y + q.h / 2) * s;
    drag = { mode: 'rot', e: e, cx: cx, cy: cy, a0: Math.atan2(ev.clientY - cy, ev.clientX - cx), r0: e.rot || 0, moved: false, tip: '' };
  } else {
    var p0 = pageXY(ev), hx = { nw: -1, n: 0, ne: 1, e: 1, se: 1, s: 0, sw: -1, w: -1 }[hn], hy = { nw: -1, n: -1, ne: -1, e: 0, se: 1, s: 1, sw: 1, w: 0 }[hn];
    drag = { mode: 'rs', e: e, hn: hn, hx: hx, hy: hy, q0: { x: q.x, y: q.y, w: q.w, h: q.h }, rot: e.rot || 0, p0: p0, offx: (hx > 0 ? q.x + q.w : q.x) - p0.x, offy: (hy > 0 ? q.y + q.h : q.y) - p0.y, moved: false, lines: [], targets: snapTargets([e.id]), tip: '', line: e.type === 'line' || e.type === 'fold' };
  }
  cap(ev);
}
function startMarquee(ev) {
  var p = pageXY(ev), base = ev.shiftKey ? S.sel.slice() : [];
  if (!ev.shiftKey && S.sel.length) { setSel([]); selChanged(); }
  drag = { mode: 'mq', p0: p, base: base, rect: { x: p.x, y: p.y, w: 0, h: 0 }, moved: false, sx: ev.clientX, sy: ev.clientY };
  cap(ev);
}
function startGuide(ev, idx, axis) {
  var gs = F().guides;
  if (idx < 0) { gs.push({ axis: axis, pos: axis === 'x' ? pageXY(ev).x : pageXY(ev).y }); idx = gs.length - 1; }
  drag = { mode: 'guide', gi: idx, axis: gs[idx].axis, moved: false, sx: ev.clientX, sy: ev.clientY, isNew: axis != null };
  cap(ev); drawOv();
}
function onMove(ev) {
  if (!drag) { onHover(ev); return; }
  var s = sz(), d = drag;
  if (d.mode === 'click') return;
  if (d.mode === 'move') {
    var rx = ev.clientX - d.sx, ry = ev.clientY - d.sy;
    if (!d.moved && Math.hypot(rx, ry) < 3) return; d.moved = true;
    var dx = rx / s, dy = ry / s, b = d.bbox, thr = 6 / s, lines = [];
    if (ev.shiftKey && !d.shift) { if (Math.abs(rx) > Math.abs(ry)) dy = 0; else dx = 0; }
    if (!ev.altKey && S.snap) {
      var cx = [b.x + dx, b.cx + dx, b.r + dx], cy = [b.y + dy, b.cy + dy, b.b + dy], sx = bestSnap(cx, d.targets.xs, thr), sy = bestSnap(cy, d.targets.ys, thr);
      if (sx === null && S.grid) { var gx = Math.round((b.x + dx) / 5) * 5 - (b.x + dx); if (Math.abs(gx) <= thr) sx = gx; }
      if (sy === null && S.grid) { var gy = Math.round((b.y + dy) / 5) * 5 - (b.y + dy); if (Math.abs(gy) <= thr) sy = gy; }
      if (sx !== null) { dx += sx; linesAt(cx, d.targets.xs, sx).forEach(function (p) { lines.push({ axis: 'x', pos: p }); }); }
      if (sy !== null) { dy += sy; linesAt(cy, d.targets.ys, sy).forEach(function (p) { lines.push({ axis: 'y', pos: p }); }); }
    }
    d.lines = lines;
    d.orig.forEach(function (o) { o.e.x = r2(o.x + dx); o.e.y = r2(o.y + dy); nodeGeom(o.e); });
    d.tip = 'X ' + fmt(b.x + dx) + '  Y ' + fmt(b.y + dy) + ' mm';
    d.dists = neighbours({ x: b.x + dx, y: b.y + dy, r: b.r + dx, b: b.b + dy }, d.els.map(function (x) { return x.id; })); drawOv(); return;
  }
  if (d.mode === 'rot') {
    d.moved = true; var a = Math.atan2(ev.clientY - d.cy, ev.clientX - d.cx), deg = d.r0 + (a - d.a0) * 180 / Math.PI;
    if (ev.shiftKey) deg = Math.round(deg / 15) * 15; deg = ((deg + 180) % 360 + 360) % 360 - 180; d.e.rot = r2(deg === -180 ? 180 : deg);
    nodeGeom(d.e); d.tip = fmt(d.e.rot) + '°'; drawOv(); return;
  }
  if (d.mode === 'rs') { resizeMove(ev, d); return; }
  if (d.mode === 'mq') {
    if (!d.moved && Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) < 3) return; d.moved = true;
    var p = pageXY(ev), x0 = Math.min(p.x, d.p0.x), y0 = Math.min(p.y, d.p0.y), x1 = Math.max(p.x, d.p0.x), y1 = Math.max(p.y, d.p0.y); d.rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    var hit = elems().filter(function (e) { if (e.hidden) return false; var q = JF.aabb(e); return q.x < x1 && q.r > x0 && q.y < y1 && q.b > y0; }).map(function (e) { return e.id; });
    setSel(d.base.concat(hit)); drawOv(); return;
  }
  if (d.mode === 'guide') {
    d.moved = true; var g = F().guides[d.gi]; if (!g) return; var pp = pageXY(ev); g.pos = r2(d.axis === 'x' ? pp.x : pp.y); drawOv(); return;
  }
}
function resizeMove(ev, d) {
  d.moved = true; var s = sz(), p = pageXY(ev), q0 = d.q0, e = d.e, hx = d.hx, hy = d.hy, thr = 6 / s, lines = [];
  var rad = d.rot * Math.PI / 180, co = Math.cos(rad), si = Math.sin(rad);
  if (d.rot === 0 && !ev.altKey && S.snap) {
    if (hx) { var ex = p.x + d.offx, sx = bestSnap([ex], d.targets.xs, thr); if (sx !== null) { p.x += sx; linesAt([ex], d.targets.xs, sx).forEach(function (v) { lines.push({ axis: 'x', pos: v }); }); } }
    if (hy) { var ey = p.y + d.offy, sy = bestSnap([ey], d.targets.ys, thr); if (sy !== null) { p.y += sy; linesAt([ey], d.targets.ys, sy).forEach(function (v) { lines.push({ axis: 'y', pos: v }); }); } }
  }
  var cx0 = q0.x + q0.w / 2, cy0 = q0.y + q0.h / 2, ax = -hx * q0.w / 2, ay = -hy * q0.h / 2;
  var awx = cx0 + ax * co - ay * si, awy = cy0 + ax * si + ay * co;
  var rx = p.x - awx, ry = p.y - awy, lx = co * rx + si * ry, ly = -si * rx + co * ry, min = 1;
  var nw = hx ? Math.max(min, hx * lx) : q0.w, nh = hy ? Math.max(min, hy * ly) : q0.h;
  if (ev.shiftKey && hx && hy && q0.w > 0 && q0.h > 0) { var k = Math.max(nw / q0.w, nh / q0.h); nw = q0.w * k; nh = q0.h * k; }
  var ox = hx * nw / 2, oy = hy * nh / 2, ncx = awx + ox * co - oy * si, ncy = awy + ox * si + oy * co;
  var nx = ncx - nw / 2, ny = ncy - nh / 2;
  if (d.line) { e.x = r2(nx); e.y = r2(ny + 1.5); e.w = r2(nw); } else { e.x = r2(nx); e.y = r2(ny); e.w = r2(nw); e.h = r2(nh); }
  d.lines = lines; nodeGeom(e); d.tip = fmt(e.w) + ' × ' + fmt(d.line ? 0 : e.h) + ' mm'; if (d.line) d.tip = '長さ ' + fmt(e.w) + ' mm';
  drawOv();
  if (e.type === 'text' || e.type === 'field' || e.type === 'notes' || e.type === 'table') { var pn = S.page; if (pn) { clearTimeout(d._ft); d._ft = setTimeout(function () { if (drag === d) { drawPage(); drawOv(); } }, 60); } }
}
function onUp(ev) {
  if (!drag) return; var d = drag; drag = null; clearTimeout(d._ft);
  try { R.scroll.releasePointerCapture(ev.pointerId); } catch (e) {}
  if (d.mode === 'move') {
    if (d.moved) { H.changed(true); redraw(); }
    else { if (!d.shift && S.sel.length > 1 && d.wasSel) { setSel([d.id]); } selChanged(); }
    return;
  }
  if (d.mode === 'click') { selChanged(); return; }
  if (d.mode === 'rot' || d.mode === 'rs') { if (d.moved) { H.changed(true); redraw(); } else drawOv(); return; }
  if (d.mode === 'mq') { selChanged(); return; }
  if (d.mode === 'guide') {
    var g = F().guides[d.gi]; var lim = d.axis === 'x' ? PW : PH;
    if (g && (g.pos < 0 || g.pos > lim || (d.isNew && !d.moved))) F().guides.splice(d.gi, 1);
    H.changed(true); drawOv(); drawProps();
  }
}
function onDbl(ev) {
  if (S.preview || S.ro) return;
  var tg = document.elementFromPoint(ev.clientX, ev.clientY) || ev.target;
  var gd = tg.closest && tg.closest('.fe-guide'); if (gd) { F().guides.splice(+gd.getAttribute('data-gi'), 1); H.changed(true); drawOv(); return; }
  var nd = tg.closest && tg.closest('[data-eid]'); if (!nd || !R.pg.contains(nd)) return;
  var e = find(nd.getAttribute('data-eid')); if (!e || e.locked) return;
  activateAt(e, tg);
}
/* ダブルクリック（Enter）：その場で編集。tg=クリックした場所（なければ値の部分） */
function activateAt(e, tg) {
  var nd = nodeOf(e.id);
  if (e.type === 'text') startEdit(e);
  else if (e.type === 'image') H.pickImage(function (u) { mut(function () { e.src = u; }); });
  else if (e.type === 'notes') openNotesEditor(e);
  else if (e.type === 'field') {
    var it = JF.itemById(V(), e.itemId); if (!it || !nd) return;
    var lb = tg && tg.closest && tg.closest('.fz-fl');
    if (lb) inlineEdit(lb, e.labelText || it.label, function (v) { e.labelText = v === it.label ? '' : v; });
    else { var vn = nd.querySelector('.fz-fv'); if (vn) editItemValue(it, vn, e.id); }
  }
  else if (e.type === 'table') {
    var cell = tg && tg.closest && tg.closest('.fz-tc'), iid = cell ? cell.getAttribute('data-item') : (S.rowSel && S.rowSel.eid === e.id ? S.rowSel.iid : '');
    var ti = iid ? JF.itemById(V(), iid) : null; if (!ti || !nd) return;
    S.rowSel = { eid: e.id, iid: iid }; selChanged();
    var cn = nodeOf(e.id).querySelector('[data-item="' + iid + '"]'); if (!cn) return;
    var ln = tg && tg.closest && tg.closest('.fz-tl');
    if (ln) inlineEdit(cn.querySelector('.fz-tl'), ti.label, function (v) { v = v.trim(); if (v) ti.label = v; });
    else editItemValue(ti, cn.querySelector('.fz-tv > div') || cn.querySelector('.fz-tv'), e.id);
  }
}
function valueNodeFor(eid, iid) {
  var e = find(eid), nd = nodeOf(eid); if (!e || !nd) return null;
  return e.type === 'field' ? nd.querySelector('.fz-fv') : nd.querySelector('[data-item="' + iid + '"] .fz-tv > div');
}
function editItemValue(it, node, eid) {
  var src = it.source;
  if (src === 'fixed') { inlineEdit(node, it.value, function (v) { it.value = v; }); return; }
  var p = h('div', 'fe-pophost fe-wide');
  function done() { var b = h('div', 'fe-act'), ok = h('button', 'fe-bt pri', '閉じる'); ok.type = 'button'; ok.onclick = closePop; b.appendChild(ok); p.appendChild(b); }
  if (src === 'date') {
    p.appendChild(tx('h5', null, '日付を選んでください（「' + (it.label || '') + '」）'));
    var di = h('input'); di.type = 'date'; di.value = DATE_RE.test(it.value) ? it.value : ''; di.onchange = function () { mut(function () { it.value = di.value; }); }; p.appendChild(di); done();
  } else if (src === 'schedule') {
    p.appendChild(tx('h5', null, '時間割（「' + (it.label || '') + '」）')); p.appendChild(schedEditor(it)); done();
  } else {
    p.appendChild(tx('p', null, src === 'column' ? 'この値は名簿から入ります（' + (it.column || it.label) + '列）。生徒ごとに変わるので、ここでは書きかえられません。' : 'この値は自動の連番で入ります。'));
    var fb = h('button', 'fe-bt pri', 'この項目を固定の文字にする'); fb.type = 'button'; fb.style.width = '100%';
    fb.onclick = function () {
      var cur = itemDisplay(it); closePop(); mut(function () { it.source = 'fixed'; it.value = cur; });
      var n2 = valueNodeFor(eid, it.id); if (n2) editItemValue(it, n2, eid);
    };
    p.appendChild(fb);
  }
  tipify(p); placePop(p, node.getBoundingClientRect());
}
function openNotesEditor(e) {
  var nd = nodeOf(e.id); if (!nd) return; closePop();
  var p = h('div', 'fe-pophost fe-wide'), ta = h('textarea'), t0 = 0;
  p.appendChild(tx('h5', null, '注意事項（1行に1項目）')); ta.rows = 9; ta.value = V().notes; p.appendChild(ta);
  p.appendChild(tx('p', null, '行の先頭に「!」を付けると、その行が強調（色つき・太字）になります。')).style.marginTop = '8px';
  function commit() { clearTimeout(t0); if (ta.value !== V().notes) mut(function () { V().notes = ta.value; }); }
  ta.oninput = function () { clearTimeout(t0); t0 = setTimeout(commit, 350); }; ta.onblur = commit;
  var b = h('div', 'fe-act'), ok = h('button', 'fe-bt pri', '閉じる'); ok.type = 'button'; ok.onclick = function () { commit(); closePop(); }; b.appendChild(ok); p.appendChild(b);
  placePop(p, nd.getBoundingClientRect()); ta.focus();
}

/* ---------- その場編集（文字・値・項目名。プレーンテキスト） ---------- */
function startEdit(e) {
  setSel([e.id]); selChanged();
  var nd = nodeOf(e.id), t = nd && nd.querySelector('.fz-t'); if (!t) return;
  t.textContent = e.text; t.style.fontSize = e.size + 'pt'; t.style.whiteSpace = 'pre-wrap'; t.style.width = e.vertical ? '' : '100%'; if (e.vertical) { t.style.display = 'block'; t.style.writingMode = 'vertical-rl'; t.style.lineHeight = e.lineHeight; t.style.gap = ''; }
  openEditor(t, nd, { id: e.id, orig: e.text, cls: 'fz-editing' });
}
/* ページ上の任意の文字ノードをその場で編集する。commit(text) は mut の中で呼ばれる */
function inlineEdit(node, initial, commit) {
  if (!node) return; finishEdit(true); closePop();
  node.textContent = initial;
  openEditor(node, node, { orig: initial, commit: commit, single: true, cls: 'fz-ie' });
}
function openEditor(t, nd, ed) {
  var plain = true; t.contentEditable = 'plaintext-only'; if (t.contentEditable !== 'plaintext-only') { t.contentEditable = 'true'; plain = false; }
  t.spellcheck = false; nd.classList.add(ed.cls); ed.plain = plain; ed.node = t; ed.nd = nd; S.editing = ed;
  t.onblur = function () { finishEdit(true); };
  t.onkeydown = function (k) {
    k.stopPropagation();
    if (k.key === 'Escape') { k.preventDefault(); finishEdit(true); }
    else if (k.key === 'Enter' && ed.single && !k.isComposing) { k.preventDefault(); finishEdit(true); }
  };
  t.onpaste = function (k) { k.preventDefault(); var x = (k.clipboardData || window.clipboardData).getData('text/plain'); if (ed.single) x = x.replace(/\s*\n\s*/g, ' '); document.execCommand('insertText', false, x); };
  t.focus(); var rg = document.createRange(); rg.selectNodeContents(t); var sn = window.getSelection(); sn.removeAllRanges(); sn.addRange(rg);
  drawOv();
}
function finishEdit(commit) {
  var ed = S.editing; if (!ed) return; S.editing = null;
  var t = ed.node; t.onblur = null; t.onkeydown = null; t.onpaste = null; t.contentEditable = 'false';
  var txt = (t.innerText || t.textContent || '').replace(/\r/g, '').replace(/ /g, ' ').replace(/\n$/, '');
  if (ed.single) txt = txt.replace(/\n/g, ' ');
  if (ed.commit) { if (commit && txt !== ed.orig) mut(function () { ed.commit(txt); }); else redraw(); return; }
  var e = find(ed.id);
  if (commit && e && txt !== ed.orig) mut(function () { e.text = txt; }); else redraw();
}

/* ---------- キーボード・ヘルプ ---------- */
function typing(t) { return !!t && (t.isContentEditable || /^(TEXTAREA|SELECT)$/.test(t.tagName) || (t.tagName === 'INPUT' && !/^(checkbox|radio|button|color)$/.test(t.type))); }
function nudgeTip() {
  var u = unionBox(selEls().filter(function (e) { return !e.hidden; })); if (!u) return;
  S.nt = 'X ' + fmt(u.x) + '  Y ' + fmt(u.y) + ' mm'; clearTimeout(S.ntT); S.ntT = setTimeout(function () { S.nt = ''; if (S.open) drawOv(); }, 1000); drawOv();
}
var HELP = [
  ['選ぶ', [['クリック', '要素を選ぶ'], ['Shift+クリック', '複数選択（追加・解除）'], ['空きをドラッグ', '範囲選択'], ['Ctrl+A', 'すべて選択'], ['Alt+クリック', '重なった下の要素を選ぶ'], ['右クリック', 'コピー・並べ替え・中央配置などのメニュー']]],
  ['編集する', [['ダブルクリック / Enter', '文字・表の値・項目名をその場で編集'], ['Esc', '編集を終える（もう一度で選択解除）'], ['Delete', '削除'], ['Ctrl+C / V / X', 'コピー / 貼り付け / 切り取り'], ['Ctrl+D', '複製'], ['Ctrl+Z / Ctrl+Y', '元に戻す / やり直し'], ['Ctrl+S', '保存']]],
  ['動かす', [['矢印キー', '0.5mm ずつ移動（Shiftで5mm）'], ['Alt+ドラッグ', '吸着せずに動かす'], ['Shift+ドラッグ', '縦か横に固定して動かす'], ['Shift+角をドラッグ', '縦横比を保って拡大縮小'], ['Shift+回転ハンドル', '15°ずつ回転']]],
  ['並び順・表示', [['Ctrl+]  /  Ctrl+[', 'ひとつ前面へ / 背面へ'], ['Ctrl+Shift+]  /  [', '最前面へ / 最背面へ'], ['Ctrl+ホイール', '拡大縮小'], ['Ctrl+0', '1ページ全体を表示'], ['Ctrl++  /  Ctrl+-', '拡大 / 縮小'], ['?', 'このヒントを表示']]]
];
function hideHelp() { if (R.help) { R.help.remove(); R.help = null; } }
function showHelp() {
  hideHelp(); var m = h('div', 'fe-modal'), b = h('div', 'fe-help'), t = h('h3'), cols = h('div', 'cols'), cl = [h('div'), h('div')];
  t.appendChild(tx('span', null, '操作のヒント・ショートカット')); t.appendChild(ibtn('check', '閉じる', hideHelp)); b.appendChild(t);
  HELP.forEach(function (g, i) { var c = cl[i % 2]; c.appendChild(tx('h5', null, g[0])); g[1].forEach(function (r) { var d = h('div', 'kr'); d.appendChild(tx('span', null, r[1])); d.appendChild(tx('kbd', null, r[0])); c.appendChild(d); }); });
  cols.appendChild(cl[0]); cols.appendChild(cl[1]); b.appendChild(cols); m.appendChild(b); m.onmousedown = function (e) { if (e.target === m) hideHelp(); };
  root.appendChild(m); R.help = m; tipify(m);
}
document.addEventListener('keydown', function (ev) {
  if (!S.open || !root || root.hidden) return;
  if (document.getElementById('mdl') || !document.getElementById('fp').hidden || !document.getElementById('ex').hidden) return;
  var k = ev.key, mod = ev.ctrlKey || ev.metaKey, t = ev.target;
  function stop() { ev.preventDefault(); ev.stopPropagation(); }
  if (k === 'Escape') {
    if (R.help) { stop(); hideHelp(); return; }
    if (pop) { stop(); closePop(); return; }
    if (S.editing) { stop(); finishEdit(true); return; }
    if (typing(t)) { t.blur(); stop(); return; }
    if (S.sel.length) { stop(); setSel([]); selChanged(); return; }
    stop(); return;
  }
  if (S.ro) return;
  if (typing(t) || S.editing) return;
  if (k === '?') { stop(); showHelp(); return; }
  if (mod && !ev.altKey) {
    var lk = k.toLowerCase();
    if (lk === 'c') { stop(); copySel(); } else if (lk === 'v') { stop(); pasteSel(); } else if (lk === 'd') { stop(); dupSel(); }
    else if (lk === 'a') { stop(); setSel(elems().filter(function (e) { return !e.hidden; }).map(function (e) { return e.id; })); selChanged(); }
    else if (lk === 'x') { stop(); copySel(); removeSel(); }
    else if (k === ']' || k === '}') { stop(); arrange(ev.shiftKey ? 'front' : 'up'); }
    else if (k === '[' || k === '{') { stop(); arrange(ev.shiftKey ? 'back' : 'down'); }
    else if (k === '0') { stop(); S.fit = 'p'; setZoom(fitZoom(), null, null, true); drawZoomBtns(); }
    else if (k === '+' || k === '=') { stop(); setZoom(S.zoom * 1.2); } else if (k === '-') { stop(); setZoom(S.zoom / 1.2); }
    return;
  }
  if (k === 'Delete' || k === 'Backspace') { if (S.sel.length) { stop(); removeSel(); } return; }
  if (k === 'Enter' && S.sel.length === 1) { var e1 = find(S.sel[0]); if (e1 && !e1.locked && e1.type !== 'image') { stop(); activateAt(e1, null); } return; }
  if (/^Arrow/.test(k) && S.sel.length) {
    stop(); var st = ev.shiftKey ? 5 : 0.5, dx = k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0, dy = k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0;
    var es = selEls().filter(function (e) { return !e.locked; });
    if (es.length) { mut(function () { es.forEach(function (e) { e.x = r2(e.x + dx); e.y = r2(e.y + dy); }); }, { live: true }); drawProps(); nudgeTip(); }
  }
}, true);

/* ---------- 開閉 ---------- */
FE.init = function (host) { H = host; };
FE.isOpen = function () { return S.open; };
FE.open = function () {
  if (!H) return; if (!root) build();
  H.ensureFree(); root.hidden = false; S.open = true; S.ro = innerWidth < 1024; root.classList.toggle('ro', S.ro);
  S.sel = []; S.preview = S.ro; S.pidx = 0; S.fit = 'c'; S.raw = false; S.rowSel = null; S.tplEl = null; S.hover = ''; S.hb = null; S.nt = ''; closePop(); hideHelp();
  var u = loadUI();
  if (u) { S.lopen = !!u.lopen; S.rcol = !!u.rcol; S.grid = !!u.grid; S.snap = u.snap !== false; if (TABS.some(function (x) { return x[0] === u.tab; })) S.tab = u.tab; }
  else { S.lopen = !elems().length; S.rcol = false; }
  if (S.ro) S.lopen = false;
  S.zoom = fitZoom(); redraw();
  requestAnimationFrame(function () { if (S.open && S.fit) { S.zoom = fitZoom(); layout(); drawOv(); } });
};
FE.close = function () {
  if (!S.open) return; if (S.editing) finishEdit(true); closePop(); hideHelp(); ttHide(); drag = null; S.open = false; root.hidden = true; H.onClose();
};
/* 履歴（元に戻す／やり直し）や外部の変更のあとに呼ぶ */
FE.refresh = function () { if (!S.open) return; if (S.editing) { S.editing = null; } setSel(S.sel); redraw(); };
FE.status = function (s, t) { if (s != null) S.st = { s: s, t: t || '' }; if (S.open && root) drawTop(); };
FE._state = S;
})(window);
