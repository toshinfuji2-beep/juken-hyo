/* フリーデザイン エディタ（PowerPoint風）。window.FreeEditor
   使い方：index.html が FreeEditor.init(host) でホスト機能（V・保存・履歴・画像選択など）を渡し、
   「デザイン編集」ボタンから FreeEditor.open() を呼ぶ。描画は templates/free.js（JT.render('free')）をそのまま使うので、
   エディタ上の見た目と印刷・PDF・サムネイルは同じ。要素モデルは DESIGN_FORMAT.md 参照。
   画面の構成：タイトルバー（クイックアクセス）／リボン（ファイル・ホーム・挿入・デザイン・差し込み・表示＋選択に応じたコンテキストタブ）／
   左サムネイル／キャンバス／右の作業ウィンドウ（書式設定・選択）／ステータスバー。
   グループ化は要素の groupId（同じ文字列を持つ要素が1グループ）で表す。 */
(function (g) {
'use strict';
var FE = g.FreeEditor = {};
var JF = g.JukenFree, JT = g.JukenTemplates, C = JT.ctx;
var PXMM = 96 / 25.4, PW = 210, PH = 297;
var H = null, root = null, R = {}, pop = null, mini = null;
var S = {
  open: false, sel: [], zoom: 1, fit: 'c', grid: false, snap: true, raw: false, preview: false, pidx: 0, clip: null, editing: null, ro: false, addN: 0, pasteN: 0,
  st: { s: '', t: '' }, hover: '', rowSel: null, rawKey: '', nt: '', hb: null,
  rtab: 'home', rcol: false, rpeek: false, bs: '', pane: '', ptab: 'shape', secs: {}, thumbs: true, thw: 150, rulers: true, guides: true,
  lockAR: false, draw: null, fp: null, fpSticky: false, lastCol: { font: 'accent', hl: '#fff200', fill: 'accent', line: 'accent' }
};
var drag = null, layDrag = '';
var RECENT_KEY = 'juken-free-recent', UI_KEY = 'juken-free-ui';
var CTAB = { shape: ['図形の書式', '描画ツール', '#c4572e'], pic: ['図の形式', '図ツール', '#2f7d6d'], tbl: ['テーブル デザイン', '表ツール', '#5b6bb5'] };

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
function ic(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || '') + '</svg>'; }
function ibtn(icon, title, fn, cls) { var b = h('button', 'fe-ib' + (cls ? ' ' + cls : ''), ic(icon)); b.type = 'button'; b.setAttribute('data-tip', title); b.setAttribute('aria-label', title.split('\n')[0]); if (fn) b.onclick = fn; return b; }
function lbl(t) { if (H && H.hlabel) H.hlabel(t); }
function loadUI() { try { var o = JSON.parse(localStorage.getItem(UI_KEY) || 'null'); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } }
function saveUI() { try { localStorage.setItem(UI_KEY, JSON.stringify({ rcol: S.rcol, pane: S.pane, ptab: S.ptab, secs: S.secs, thumbs: S.thumbs, thw: S.thw, rulers: S.rulers, guides: S.guides, grid: S.grid, snap: S.snap, lockAR: S.lockAR })); } catch (e) {} }
/* Office 風ツールヒント：1行目=太字の名前、2行目=説明、3行目=ショートカット（data-tip を「\n」でつなぐ） */
function tipOf(t, d, k) { return t + '\n' + (d || '') + (k ? '\n' + k : ''); }
var TT = null, ttTimer = 0;
function ttHide() { clearTimeout(ttTimer); if (TT) { TT.remove(); TT = null; } }
function ttShow(el) {
  var t = el.getAttribute('data-tip'); if (!t || !el.isConnected) return; ttHide();
  var p = t.split('\n'); TT = h('div', 'fe-tt'); TT.appendChild(tx('b', null, p[0])); if (p[1]) TT.appendChild(tx('span', null, p[1])); if (p[2]) TT.appendChild(tx('em', null, p[2]));
  root.appendChild(TT); var r = el.getBoundingClientRect(), w = TT.offsetWidth, hh = TT.offsetHeight;
  TT.style.left = clamp(r.left + 4, 6, innerWidth - w - 6) + 'px'; TT.style.top = (r.bottom + 6 + hh < innerHeight - 4 ? r.bottom + 6 : Math.max(4, r.top - hh - 6)) + 'px';
}
function tipify(c) { Array.prototype.forEach.call((c || root).querySelectorAll('[title]'), function (e) { e.setAttribute('data-tip', e.getAttribute('title')); e.removeAttribute('title'); if (!e.getAttribute('aria-label') && e.tagName === 'BUTTON' && !e.textContent.trim()) e.setAttribute('aria-label', e.getAttribute('data-tip').split('\n')[0]); }); }
function tbtn(icon, label, fn, cls) { var b = h('button', 'fe-bt' + (cls ? ' ' + cls : ''), (icon ? ic(icon) : '') + '<span>' + esc(label) + '</span>'); b.type = 'button'; if (fn) b.onclick = fn; return b; }
function resolveColor(c) { return JF.rc(c, V()); }
function isHex(c) { return /^#[0-9a-f]{6}$/i.test(c); }

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
,
  cut: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8 16L19 3M16 16L5 3"/>',
  paste: '<rect x="6" y="5" width="12" height="16" rx="1.5"/><path d="M9 5V3h6v2M9 11h6M9 15h6"/>',
  fpaint: '<path d="M14 4l6 6-8 8-6-6z"/><path d="M6 12c-2 2-3 5-3 8 3 0 6-1 8-3"/>',
  italic: '<path d="M10 4h8M6 20h8M14 4l-4 16"/>',
  underline: '<path d="M7 4v7a5 5 0 0010 0V4M5 21h14"/>',
  strike: '<path d="M5 12h14M8 7c0-2 2-3 4-3s4 1 4 3M8 17c0 2 2 3 4 3s4-1 4-3"/>',
  fontup: '<path d="M3 19L8 6l5 13M5 15h6M17 9V3M14 6l3-3 3 3"/>',
  fontdown: '<path d="M3 19L8 6l5 13M5 15h6M17 3v6M14 6l3 3 3-3"/>',
  fcolor: '<path d="M6 17L12 4l6 13M8.5 12h7"/>',
  hilite: '<path d="M5 15l8-8 4 4-8 8H5zM13 7l2-2 4 4-2 2M3 21h8"/>',
  tj: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
  lh: '<path d="M10 6h10M10 12h10M10 18h10M5 4v16M3 6l2-2 2 2M3 18l2 2 2-2"/>',
  spacing: '<path d="M5 17L9 6l4 11M6.5 13h5M15 17V7M15 7l4 10"/>',
  group: '<rect x="3" y="3" width="10" height="10" rx="1"/><rect x="11" y="11" width="10" height="10" rx="1"/><path d="M3 16v5h5M21 8V3h-5" stroke-dasharray="2 2"/>',
  ungroup: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
  select: '<path d="M5 3l14 8-6 2-3 6z"/>',
  selall: '<rect x="4" y="4" width="16" height="16" stroke-dasharray="3 2"/><path d="M9 9h6v6H9z"/>',
  textbox: '<rect x="3" y="4" width="18" height="16" rx="1" stroke-dasharray="2 2"/><path d="M8 9V8h8v1M12 8v8M10 16h4"/>',
  bucket: '<path d="M5 11l7-7 7 7-7 7zM19 15c1 2 2 3 2 4a2 2 0 01-4 0c0-1 1-2 2-4z"/>',
  pen: '<path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"/>',
  quick: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1" fill="currentColor" fill-opacity=".25"/><rect x="3" y="13" width="8" height="8" rx="4"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
  palette: '<path d="M12 3a9 9 0 100 18c1.5 0 2-1 1.5-2s-.5-2 1-2H17a4 4 0 004-4c0-5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6M16 5a3 3 0 010 6M18 14c2 1 3 3 3 6"/>',
  print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
  pdf: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 14h6M9 17h4"/>',
  saveas: '<path d="M5 4h11l3 3v5M8 4v5h7M5 4v16h7M8 20v-5h4M16 21l1-3 5-5 2 2-5 5z" transform="scale(.92) translate(1 1)"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  ruler: '<rect x="3" y="8" width="18" height="8" rx="1"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>',
  guides: '<path d="M4 3v18M3 8h18M20 3v18" stroke-dasharray="2 2"/>',
  zoom: '<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6M8 10h4M10 8v4"/>',
  thumbs: '<rect x="3" y="3" width="6" height="8" rx="1"/><rect x="3" y="13" width="6" height="8" rx="1"/><rect x="12" y="3" width="9" height="18" rx="1"/>',
  wm: '<path d="M4 18L9 6l5 12M6 14h6M16 7h5M16 11h5M16 15h5"/>',
  chevU: '<path d="M6 15l6-6 6 6"/>',
  launch: '<path d="M6 6l12 12M18 10v8h-8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  folder2: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  imgchg: '<rect x="3" y="4" width="14" height="12" rx="1.5"/><circle cx="8" cy="9" r="1.3"/><path d="M17 12l-3-3-6 6M19 14v6M16 17h6"/>'
};
var TYPE_ICON = { text: 'text', field: 'ph', rect: 'rect', ellipse: 'circle', line: 'line', image: 'image', notes: 'note', table: 'table', fold: 'fold' };


/* ---------- プロパティ定義（右の「詳細」と上のツールバーを同じ定義から作る） ---------- */
var JFN = window.JukenFonts;
var DASH_OPTS = [['solid', '実線'], ['dashed', '破線'], ['dotted', '点線']];
var TXT_S = [
  { k: 'font', t: 'font', l: 'フォント', ctx: 1, w: 118 },
  { k: 'size', t: 'num', l: 'サイズ', u: 'pt', min: 1, max: 500, step: 0.5, ctx: 1, stp: 1, w: 50 },
  { k: 'weight', t: 'bold', l: '太字', ctx: 1 },
  { k: 'italic', t: 'chk', l: '斜体' }, { k: 'underline', t: 'chk', l: '下線' }, { k: 'strike', t: 'chk', l: '取り消し線' },
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
  field: [{ k: 'itemId', t: 'item', l: '項目' }, { k: 'showLabel', t: 'chk', l: '項目名を表示' }, { k: 'labelText', t: 'text', l: '項目名の文字（空なら項目名）' }, { k: 'ruby', t: 'ruby', l: 'ふりがなを上に小さく' }, { k: 'rubyScale', t: 'num', l: 'ふりがなの大きさ（氏名に対する比）', min: 0.2, max: 1, step: 0.05 },
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
var CSS = `#fe{position:fixed;inset:0;z-index:70;display:flex;flex-direction:column;--bg:#f3f3f3;--panel:#fff;--fg:#262626;--mut:#666;--bd:#d6d6d6;--ac:#c4572e;--acfg:#fff;--acs:rgba(196,87,46,.14);--inp:#fff;--pv:#e6e6e6;--warn:#b45309;--warnbg:#fef3c7;--ok:#15803d;--err:#c42b1c;--hv:rgba(0,0,0,.07);--hvd:rgba(0,0,0,.14);background:var(--bg);color:var(--fg);font:12px/1.4 "Segoe UI","Noto Sans JP","Yu Gothic UI","Hiragino Sans",Meiryo,sans-serif}
@media (prefers-color-scheme:dark){#fe{--bg:#333;--panel:#262626;--fg:#e8e8e8;--mut:#a3a3a3;--bd:#4a4a4a;--ac:#e0764d;--acfg:#1a1a1a;--acs:rgba(224,118,77,.22);--inp:#1e1e1e;--pv:#1c1c1c;--hv:rgba(255,255,255,.1);--hvd:rgba(255,255,255,.2);--warnbg:#3b2f0a;--warn:#fbbf24;--ok:#4ade80;--err:#f87171}}
#fe[hidden]{display:none!important}
#fe *{box-sizing:border-box}
#fe svg{width:16px;height:16px;flex:none}
#fe button{font:inherit;color:inherit;background:transparent;border:0;border-radius:3px;padding:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap;margin:0}
#fe button:hover{background:var(--hv)}
#fe button.on{background:var(--hvd);box-shadow:inset 0 0 0 1px rgba(127,127,127,.4)}
#fe button:disabled{opacity:.38;cursor:default;background:transparent;box-shadow:none}
#fe button:focus-visible,#fe input:focus-visible,#fe select:focus-visible{outline:2px solid var(--ac);outline-offset:-1px}
#fe label{display:block;margin:0;font-size:12px;color:var(--mut);white-space:normal}
#fe input[type=text],#fe input[type=number],#fe input[type=date],#fe select,#fe textarea{width:100%;height:24px;padding:0 6px;border:1px solid var(--bd);border-radius:2px;background:var(--inp);color:var(--fg);font:inherit;margin:0}
#fe textarea{height:auto;padding:5px 6px;resize:vertical;line-height:1.5}
#fe input:focus,#fe select:focus,#fe textarea:focus{outline:0;border-color:var(--ac);box-shadow:0 0 0 1px var(--ac)}
#fe input[type=number]{-moz-appearance:textfield;padding-right:2px}
.fe-sp{flex:1}
.fe-sep{width:1px;height:20px;background:var(--bd);margin:0 3px;flex:none}
/* タイトルバー */
.fe-tbar{display:flex;align-items:center;gap:2px;height:30px;padding:0 6px;background:var(--panel);flex:none;position:relative}
.fe-qat{display:flex;align-items:center;gap:0;flex:1;min-width:0}
#fe .fe-qat button{width:28px;height:26px}
#fe .fe-qat .fe-qd{width:14px;margin-left:-3px}
#fe .fe-qat .fe-qd svg{width:10px;height:10px}
.fe-tcen{position:absolute;left:50%;top:0;transform:translateX(-50%);height:30px;display:flex;align-items:center;gap:10px;font-size:12px;max-width:46%;white-space:nowrap}
.fe-tcen b{font-weight:600;overflow:hidden;text-overflow:ellipsis;max-width:260px}
.fe-tcen span.fe-ds{color:var(--mut);overflow:hidden;text-overflow:ellipsis}
#fe .fe-sst{height:22px;padding:0 6px;font-size:11px;color:var(--mut);cursor:default;gap:5px}
.fe-sst i{width:7px;height:7px;border-radius:50%;background:currentColor;flex:none}
.fe-sst[data-s=saved]{color:var(--ok)}.fe-sst[data-s=dirty]{color:var(--warn);cursor:pointer}.fe-sst[data-s=error]{color:var(--err);cursor:pointer}
.fe-sst[data-s=saved] i{width:auto;height:auto;background:none;border-radius:0}.fe-sst[data-s=saved] i:before{content:"\\2713";font-weight:700;line-height:1}
#fe .fe-done{height:24px;padding:0 12px;background:var(--ac);color:var(--acfg);font-weight:600;border-radius:3px;margin-left:8px}
#fe .fe-done:hover{background:var(--ac);filter:brightness(1.1)}
/* タブ */
.fe-tabs{display:flex;align-items:flex-end;height:40px;padding:0 6px;background:var(--panel);flex:none;border-bottom:1px solid var(--bd);gap:1px}
#fe .fe-tab{height:26px;padding:0 14px;border-radius:3px 3px 0 0;font-size:12.5px;position:relative;color:var(--fg)}
#fe .fe-tab.cur{background:var(--bg);border:1px solid var(--bd);border-bottom-color:var(--bg);margin-bottom:-1px;height:27px;font-weight:600}
#fe .fe-tab.cur:after{content:"";position:absolute;left:10px;right:10px;bottom:2px;height:2px;background:var(--ac)}
#fe .fe-tab.file{background:var(--ac);color:var(--acfg);margin-right:4px;border-radius:3px;height:24px;margin-bottom:1px;padding:0 16px}
#fe .fe-tab.file:hover{filter:brightness(1.1);background:var(--ac)}
#fe .fe-tab.file.cur{border:0;margin-bottom:1px;height:24px}#fe .fe-tab.file.cur:after{display:none}
.fe-ctab{display:flex;flex-direction:column;justify-content:flex-end;margin-left:8px;align-self:stretch}
.fe-ctab>i{display:block;font-style:normal;font-size:10px;line-height:11px;height:11px;color:#fff;padding:0 8px;background:var(--cc,#c4572e);text-align:left;white-space:nowrap}
.fe-ctab .fe-ctr{display:flex;border-top:0;border-left:1px solid var(--cc);border-right:1px solid var(--cc);background:color-mix(in srgb,var(--cc) 8%,transparent)}
#fe .fe-ctab .fe-tab{color:var(--cc);font-weight:600}
#fe .fe-ctab .fe-tab.cur{color:var(--fg)}
#fe .fe-ctab .fe-tab.cur:after{background:var(--cc)}
#fe .fe-rcol{width:24px;height:22px;margin:0 0 3px;margin-left:auto}
.fe-ropen{padding:0 8px 0 0}
/* リボン本体 */
.fe-ribbon{height:98px;flex:none;background:var(--bg);border-bottom:1px solid var(--bd);display:flex;align-items:stretch;overflow-x:auto;overflow-y:hidden;padding:2px 4px 0;scrollbar-width:thin;position:relative;z-index:8}
#fe.rcol .fe-ribbon{display:none}
#fe.rcol.rpeek .fe-ribbon{display:flex;position:absolute;left:0;right:0;top:70px;z-index:30;box-shadow:0 6px 16px rgba(0,0,0,.25)}
.fe-rg{display:flex;flex-direction:column;border-right:1px solid var(--bd);padding:0 4px;flex:none;min-width:30px}
.fe-rgb{flex:1;display:flex;align-items:stretch;gap:2px;min-height:0;padding:2px 0}
.fe-rgl{height:18px;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--mut);position:relative;white-space:nowrap;padding:0 14px}
#fe .fe-rgl button{position:absolute;right:-2px;bottom:1px;width:14px;height:14px;border-radius:2px}
#fe .fe-rgl button svg{width:9px;height:9px}
.fe-rc{display:flex;flex-direction:column;justify-content:center;gap:2px}
.fe-rr{display:flex;align-items:center;gap:1px}
#fe .fe-rbL{flex-direction:column;justify-content:flex-start;height:70px;min-width:46px;padding:4px 6px 2px;gap:2px;align-self:center}
#fe .fe-rbL svg{width:30px;height:30px;stroke-width:1.5}
#fe .fe-rbL em{font-style:normal;display:flex;flex-direction:column;align-items:center;line-height:14px;font-size:11.5px}
#fe .fe-rbL em span{white-space:nowrap}
#fe .fe-rbS{height:22px;min-width:24px;padding:0 5px;gap:4px;justify-content:flex-start}
#fe .fe-rbS svg{width:16px;height:16px}
#fe .fe-rbS em{font-style:normal;white-space:nowrap}
#fe .fe-rbS.ic{width:24px;padding:0;justify-content:center}
.fe-dd{display:inline-block;width:0;height:0;border-left:3.5px solid transparent;border-right:3.5px solid transparent;border-top:4px solid currentColor;margin-left:4px;vertical-align:middle;opacity:.7}
.fe-spl{display:inline-flex;align-items:center;border-radius:3px}
#fe .fe-spl button.fe-sla{width:12px;padding:0}
#fe .fe-spl button.fe-sla .fe-dd{margin:0}
.fe-cbar{display:block;height:3px;border-radius:0;margin-top:-3px;width:14px;background:var(--cb,#c00)}
#fe .fe-rbS.fcol{flex-direction:column;gap:0;justify-content:center;padding:0 3px}
#fe .fe-rbS.fcol svg{margin-bottom:1px}
.fe-combo{display:inline-flex;align-items:center;position:relative}
#fe .fe-combo input{height:22px;font-size:12px}
#fe .fe-combo button.fe-cba{position:absolute;right:1px;top:1px;width:16px;height:20px;border-radius:0}
#fe .fe-combo.f input{padding-right:18px;width:132px}
#fe .fe-combo.z input{padding-right:18px;width:54px;text-align:left}
#fe .fe-rbs-lab{font-size:11px;color:var(--mut)}
.fe-gal{display:flex;align-items:stretch;border:1px solid var(--bd);background:var(--panel);border-radius:2px;align-self:center;height:66px}
.fe-gal .gv{display:flex;gap:3px;padding:3px;overflow:hidden;scroll-behavior:smooth}
.fe-gal .ga{display:flex;flex-direction:column;border-left:1px solid var(--bd);width:16px}
#fe .fe-gal .ga button{flex:1;border-radius:0;width:16px;padding:0}
#fe .fe-gal .ga button+button{border-top:1px solid var(--bd)}
#fe .fe-gal .ga svg{width:10px;height:10px}
#fe .fe-gc{flex:none;width:40px;height:58px;padding:1px;border:1px solid transparent;border-radius:2px;overflow:hidden;flex-direction:column;gap:2px;justify-content:flex-start}
#fe .fe-gc:hover{border-color:var(--ac);background:var(--acs)}
#fe .fe-gc.cur{border-color:var(--ac);box-shadow:inset 0 0 0 1px var(--ac)}
.fe-gc .fe-thumb{width:36px;height:50px;border-radius:0}
#fe .fe-gal.th .fe-gc{width:44px}
#fe .fe-gal.th .fe-gc small{display:none}
#fe .fe-gal.sh{height:auto;border:0;background:transparent;align-self:center}
.fe-shg{display:grid;grid-template-columns:repeat(3,26px);gap:2px}
#fe .fe-shg button{width:26px;height:26px}
#fe .fe-shg button svg{width:18px;height:18px}
.fe-pal{display:grid;grid-template-columns:repeat(2,34px);gap:3px}
/* 本体 */
.fe-main{flex:1;min-height:0;display:flex;position:relative}
.fe-thumbs{flex:none;background:var(--bg);border-right:1px solid var(--bd);display:flex;flex-direction:column;position:relative;min-width:0}
.fe-thl{flex:1;overflow-y:auto;padding:10px 8px 14px 4px}
.fe-thi{display:flex;gap:4px;align-items:flex-start;padding:4px 2px;margin-bottom:6px;border-radius:2px;cursor:pointer}
.fe-thi .n{width:24px;text-align:right;font-size:11px;color:var(--mut);flex:none;padding-top:2px;white-space:nowrap}
.fe-thi .p{border:1px solid var(--bd);background:#fff;position:relative;overflow:hidden;flex:none;pointer-events:none}
.fe-thi .p .ticket{position:absolute;left:0;top:0;transform-origin:0 0}
.fe-thi.on .p{outline:2px solid var(--ac);outline-offset:0;border-color:var(--ac)}
.fe-thi.on .n{color:var(--ac);font-weight:700}
.fe-thi:hover .p{border-color:var(--ac)}
.fe-thi .t{display:none}
.fe-thrs{position:absolute;right:-3px;top:0;bottom:0;width:6px;cursor:col-resize;z-index:3}
.fe-thrs:hover{background:var(--acs)}
#fe .fe-thc{position:absolute;top:2px;right:4px;width:20px;height:20px;z-index:4}
#fe .fe-thc svg{width:12px;height:12px}
.fe-thx{width:14px;flex:none;background:var(--bg);border-right:1px solid var(--bd);display:flex;align-items:flex-start;justify-content:center;padding-top:6px}
#fe .fe-thx button{width:12px;height:20px;border-radius:2px}#fe .fe-thx svg{width:10px;height:10px}
.fe-stage{flex:1;min-width:0;position:relative;background:var(--pv);overflow:hidden}
.fe-scroll{position:absolute;inset:0;overflow:auto;overscroll-behavior:contain}
.fe-world{min-width:100%;min-height:100%;display:flex;padding:34px 40px 40px 44px;width:max-content}
#fe.nor .fe-world{padding:24px 30px 30px}
#fe.nor .fe-ruler{display:none}
.fe-pagebox{position:relative;margin:auto;flex:none}
.fe-pg{position:absolute;inset:0;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.1),0 2px 10px rgba(0,0,0,.2);overflow:hidden}
.fe-pg .ticket{position:absolute;left:0;top:0;transform-origin:0 0;user-select:none;-webkit-user-select:none}
.fe-pg .fz{cursor:move}
.fe-pg .fz:hover{outline:1px solid rgba(196,87,46,.55)}
.fe-pg .fz.fz-editing{outline:1px solid var(--ac,#c4572e);cursor:text}
.fe-pg .fz-t[contenteditable]{outline:0;user-select:text;-webkit-user-select:text;cursor:text;min-height:1em;overflow:visible!important}
#fe.drawing .fe-scroll,#fe.drawing .fe-pg .fz{cursor:crosshair}
#fe.fpaint .fe-scroll,#fe.fpaint .fe-pg .fz{cursor:copy}
.fe-ov{position:absolute;inset:0;pointer-events:none}
.fe-ov.grid{background-image:linear-gradient(to right,rgba(196,87,46,.14) 1px,transparent 1px),linear-gradient(to bottom,rgba(196,87,46,.14) 1px,transparent 1px)}
.fe-sel{position:absolute;border:1px solid var(--ac,#c4572e);pointer-events:none}
.fe-sel.multi{border:1px dotted rgba(196,87,46,.8)}
.fe-sel.lock{border-style:dashed}
.fe-gbox{position:absolute;border:1px solid var(--ac,#c4572e);pointer-events:none}
.fe-gbox.grp{border-style:dashed;border-color:rgba(196,87,46,.55)}
.fe-hd{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;background:#fff;border:1px solid #6e6e6e;border-radius:50%;pointer-events:auto;touch-action:none}
.fe-hd:hover{background:#ffe4d8;border-color:var(--ac,#c4572e)}
.fe-hd[data-h=nw],.fe-hd[data-h=se]{cursor:nwse-resize}.fe-hd[data-h=ne],.fe-hd[data-h=sw]{cursor:nesw-resize}.fe-hd[data-h=n],.fe-hd[data-h=s]{cursor:ns-resize}.fe-hd[data-h=e],.fe-hd[data-h=w]{cursor:ew-resize}
.fe-hd[data-h=rot]{width:18px;height:18px;margin:-9px 0 0 -9px;cursor:grab;display:flex;align-items:center;justify-content:center;color:#444;border-color:#6e6e6e}
.fe-hd[data-h=rot] svg{width:12px;height:12px;stroke-width:2.2}
.fe-snap{position:absolute;pointer-events:none}
.fe-snap.x{width:0;top:0;bottom:0;border-left:1px dashed #e8590c}.fe-snap.y{height:0;left:0;right:0;border-top:1px dashed #e8590c}
.fe-guide{position:absolute;background:#18a8c0;pointer-events:auto}
.fe-guide.x{width:1px;top:0;bottom:0;cursor:ew-resize}.fe-guide.y{height:1px;left:0;right:0;cursor:ns-resize}
#fe.nogd .fe-guide{display:none}
.fe-guide:before{content:"";position:absolute;inset:-4px}
.fe-mq{position:absolute;border:1px solid var(--ac,#c4572e);background:rgba(196,87,46,.1);pointer-events:none}
.fe-mq.dr{border-style:dashed;background:rgba(196,87,46,.05)}
.fe-tip{position:absolute;transform:translateX(-50%);background:#262626;color:#fff;font-size:11px;padding:1px 7px;border-radius:2px;white-space:nowrap;pointer-events:none;z-index:3}
.fe-ruler{position:absolute;background-color:#fff;color:#666;font-size:9px;overflow:hidden;user-select:none;border:1px solid #cfcfcf}
.fe-ruler.top{left:0;right:0;top:-20px;height:16px;cursor:ns-resize}
.fe-ruler.left{top:0;bottom:0;left:-24px;width:20px;cursor:ew-resize}
.fe-ruler span{position:absolute;line-height:1;pointer-events:none}
.fe-ruler.top span{top:2px;margin-left:2px}.fe-ruler.left span{left:1px;margin-top:2px}
@media (prefers-color-scheme:dark){.fe-ruler{background-color:#333;color:#aaa;border-color:#555}}
/* 右の作業ウィンドウ */
.fe-pane{flex:none;width:292px;background:var(--panel);border-left:1px solid var(--bd);display:flex;flex-direction:column;min-height:0}
#fe .fe-pane[hidden]{display:none}
.fe-ph{display:flex;align-items:center;justify-content:space-between;height:32px;padding:0 6px 0 12px;font-size:14px;flex:none}
#fe .fe-ph button{width:24px;height:24px}
.fe-pt{display:flex;border-bottom:1px solid var(--bd);flex:none;padding:0 6px}
#fe .fe-pt button{flex:1;height:30px;border-radius:0;font-size:12px;color:var(--mut);position:relative}
#fe .fe-pt button.on{background:transparent;box-shadow:none;color:var(--ac);font-weight:600}
#fe .fe-pt button.on:after{content:"";position:absolute;left:8px;right:8px;bottom:-1px;height:2px;background:var(--ac)}
.fe-pb{flex:1;overflow-y:auto;padding:0 0 24px}
.fe-ps{border-bottom:1px solid var(--bd)}
#fe .fe-psh{width:100%;justify-content:flex-start;height:30px;padding:0 12px;gap:6px;font-weight:600;font-size:12.5px;border-radius:0}
.fe-psh .ar{display:inline-block;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid currentColor;transition:transform .12s;opacity:.7}
.fe-ps.cl .fe-psh .ar{transform:rotate(-90deg)}
.fe-psb{padding:2px 12px 12px}
.fe-ps.cl .fe-psb{display:none}
.fe-pn{padding:8px 12px 0;font-size:11.5px;color:var(--mut);line-height:1.5}
.fe-two{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.fe-pr{display:grid;grid-template-columns:92px minmax(0,1fr);gap:6px;align-items:center;margin-bottom:6px}
.fe-pr>label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fe-pr .fe-wide{grid-column:1/-1}
.fe-g4{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px}
.fe-nl{position:relative}.fe-nl label{position:absolute;left:6px;top:50%;transform:translateY(-50%);font-size:11px;pointer-events:none;color:var(--mut)}
.fe-nl.u input{padding-right:22px!important}.fe-nl .fe-u{position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:10px;color:var(--mut);pointer-events:none}
.fe-rn{display:grid;grid-template-columns:1fr 62px;gap:8px;align-items:center}
.fe-rn input[type=range]{width:100%;accent-color:var(--ac);margin:0}
.fe-stp{display:inline-flex;align-items:center;gap:0}
#fe .fe-stp input{width:50px;text-align:center;border-radius:0;padding:0 2px;height:24px}
#fe .fe-stp button{width:22px;height:24px;border:1px solid var(--bd);background:var(--bg);border-radius:2px 0 0 2px}
#fe .fe-stp button+input+button{border-radius:0 2px 2px 0}
#fe .fe-sw{width:34px;height:24px;border:1px solid var(--bd);border-radius:2px;padding:3px;background:var(--panel)}
#fe .fe-sw i{display:block;width:100%;height:100%;background-image:linear-gradient(45deg,#d1d5db 25%,transparent 25%,transparent 75%,#d1d5db 75%),linear-gradient(45deg,#d1d5db 25%,#fff 25%,#fff 75%,#d1d5db 75%);background-size:8px 8px;background-position:0 0,4px 4px;position:relative}
#fe .fe-sw i b{position:absolute;inset:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)}
#fe .fe-sw.wide{width:100%;display:flex;justify-content:flex-start;gap:8px;padding:3px 8px;font-size:12px}#fe .fe-sw.wide i{width:44px}
.fe-seg{display:inline-flex;gap:1px;padding:1px;background:var(--bg);border:1px solid var(--bd);border-radius:3px}
#fe .fe-seg button{min-width:26px;height:22px;border-radius:2px;padding:0 6px}
#fe .fe-seg button.on{background:var(--panel);box-shadow:inset 0 0 0 1px var(--ac);color:var(--ac)}
#fe label.fe-chk{display:flex;align-items:center;gap:6px;margin:2px 0 6px;font-size:12px;color:var(--fg);cursor:pointer}
#fe .fe-chk input{width:14px;height:14px;margin:0;accent-color:var(--ac)}
.fe-rad{display:flex;gap:14px;margin-bottom:6px}
.fe-rad label{display:flex;align-items:center;gap:5px;color:var(--fg);cursor:pointer;margin:0}
.fe-rad input{accent-color:var(--ac);margin:0}
.fe-imgp{display:flex;gap:10px;align-items:center;margin-bottom:6px}
.fe-imgp .th{width:56px;height:56px;border:1px solid var(--bd);background:#fff center/contain no-repeat;flex:none}
.fe-its{max-height:200px;overflow-y:auto;border:1px solid var(--bd);padding:4px 8px;background:var(--bg)}
.fe-itbox{border:1px solid var(--bd);padding:8px 10px 2px;margin:6px 0 8px;background:var(--bg)}
.fe-itbox h5{margin:0 0 6px;font-size:12px;color:var(--ac)}
.fe-it{display:flex;align-items:center;gap:4px;margin-bottom:4px}
.fe-sr{display:grid;grid-template-columns:1fr 1fr 24px;gap:4px;margin-bottom:4px;align-items:center}
#fe .fe-sr .fe-ib,#fe .fe-ib{width:24px;height:24px}
#fe .fe-bt,.fe-pophost .fe-bt{border:1px solid var(--bd);background:var(--panel);height:24px;padding:0 10px;font-size:12px;border-radius:2px}
/* 選択ウィンドウ */
.fe-sh{display:flex;align-items:center;gap:4px;padding:6px 8px 6px 10px;border-bottom:1px solid var(--bd);flex:none}
#fe .fe-sh .fe-bt{height:22px;padding:0 8px}
.fe-lay{display:flex;align-items:center;gap:2px;height:28px;padding:0 4px 0 8px;border:1px solid transparent;margin:0 6px 1px;cursor:pointer;position:relative;border-radius:2px}
.fe-lay:hover{background:var(--hv)}.fe-lay.on{background:var(--acs);border-color:var(--ac)}
.fe-lay.ing{padding-left:22px}
.fe-lay .fe-ty{color:var(--mut);display:flex}
.fe-lay .fe-ln{flex:1;min-width:0;padding:0 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-lay.hid .fe-ln{opacity:.45;text-decoration:line-through}
#fe .fe-lay .fe-ib{width:22px;height:22px}
.fe-lay input{height:22px!important}
.fe-lay.dt-a:after,.fe-lay.dt-b:after{content:"";position:absolute;left:4px;right:4px;height:2px;background:var(--ac)}.fe-lay.dt-a:after{bottom:-2px}.fe-lay.dt-b:after{top:-2px}
/* ステータスバー */
.fe-status{height:24px;flex:none;display:flex;align-items:center;gap:0;background:var(--bg);border-top:1px solid var(--bd);font-size:11.5px;color:var(--fg);padding:0 8px}
.fe-status .fe-si{padding:0 10px;white-space:nowrap;border-right:1px solid var(--bd);height:16px;display:flex;align-items:center}
.fe-status .fe-si:first-child{padding-left:0}
.fe-status .fe-si b{font-weight:600}
#fe .fe-status button{height:20px;padding:0 6px;font-size:11.5px}
.fe-status input[type=range]{width:130px;height:14px;margin:0 4px;accent-color:var(--ac)}
#fe .fe-status .zb{width:20px;padding:0}
.fe-status .zv{min-width:40px;text-align:right;font-size:11.5px}
.fe-status .fe-si.nb{border-right:0}
/* バックステージ */
.fe-bs{position:absolute;left:0;right:0;top:30px;bottom:0;z-index:40;background:var(--panel);display:flex}
.fe-bsl{width:230px;background:var(--ac);color:var(--acfg);padding:10px 0;display:flex;flex-direction:column;flex:none}
#fe .fe-bsl button{height:40px;justify-content:flex-start;padding:0 20px;gap:12px;border-radius:0;font-size:13px;color:var(--acfg)}
#fe .fe-bsl button:hover,#fe .fe-bsl button.on{background:rgba(0,0,0,.18);box-shadow:none}
#fe .fe-bsl button svg{width:18px;height:18px}
.fe-bsr{flex:1;overflow:auto;padding:28px 44px}
.fe-bsr h2{margin:0 0 16px;font-size:22px;font-weight:400}
.fe-bsr p{margin:0 0 14px;color:var(--mut);font-size:13px;line-height:1.6}
#fe .fe-bsb{height:auto;padding:12px 16px;border:1px solid var(--bd);background:var(--bg);justify-content:flex-start;gap:14px;width:420px;max-width:100%;text-align:left;margin-bottom:10px;border-radius:3px;white-space:normal}
#fe .fe-bsb:hover{border-color:var(--ac);background:var(--acs)}
#fe .fe-bsb svg{width:30px;height:30px}
#fe .fe-bsb b{display:block;font-size:14px;font-weight:600}
#fe .fe-bsb small{display:block;color:var(--mut);font-size:12px;font-weight:400;margin-top:2px}
.fe-bsi{display:grid;grid-template-columns:120px 1fr;gap:8px 12px;font-size:13px}
.fe-bsi dt{color:var(--mut)}.fe-bsi dd{margin:0}
/* ポップアップ・メニュー */
.fe-pophost{position:fixed;z-index:78;width:248px;background:var(--panel);border:1px solid var(--bd);border-radius:3px;box-shadow:0 6px 24px rgba(0,0,0,.28);padding:8px 10px 10px;color:var(--fg)}
.fe-pophost h5{margin:8px 0 5px;font-size:11.5px;color:var(--mut);font-weight:600}.fe-pophost h5:first-child{margin-top:0}
.fe-pophost.fe-pc{width:auto;padding:6px 8px 8px}
.fe-cg{display:grid;grid-template-columns:repeat(10,18px);gap:2px 3px}
.fe-cg.s1{grid-template-columns:repeat(10,18px);margin-bottom:0}
#fe .fe-pophost .fe-c{width:18px;height:18px;border-radius:0;border:1px solid rgba(0,0,0,.2);padding:0;display:block;position:relative;background-clip:padding-box}
#fe .fe-pophost .fe-c:hover{outline:2px solid var(--ac);outline-offset:0;z-index:2;background-color:inherit}
#fe .fe-pophost .fe-c.cur{outline:2px solid var(--ac);outline-offset:1px}
.fe-cg.t{gap:0 3px;margin-top:1px}
.fe-cg.t .fe-c{border-top-color:transparent;border-bottom-color:transparent}
.fe-pophost .fe-c.none{background:linear-gradient(135deg,#fff 45%,#ef4444 45%,#ef4444 55%,#fff 55%)}
#fe .fe-pophost .fe-cm{width:100%;justify-content:flex-start;height:26px;padding:0 6px;margin-top:4px;gap:8px;border-radius:2px}
.fe-pophost .fe-hex{display:flex;gap:6px;align-items:center;margin-top:6px;padding-top:6px;border-top:1px solid var(--bd)}
.fe-pophost input[type=color]{width:34px;height:24px;padding:1px;border:1px solid var(--bd);border-radius:2px;background:var(--inp);flex:none}
.fe-menu{width:auto;min-width:200px;max-width:340px;padding:3px}
.fe-menu .mi{position:relative}
.fe-menu button.mb{width:100%;justify-content:flex-start;height:26px;padding:0 8px 0 6px;border-radius:2px;font-size:12px;gap:8px;color:var(--fg);display:flex;align-items:center;text-align:left}
.fe-menu button.mb:hover{background:var(--acs)}
.fe-menu button.mb span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fe-menu button.mb small{color:var(--mut);font-size:11px;margin-left:12px;flex:none}
.fe-menu button.mb svg{width:16px;height:16px;color:var(--mut)}
.fe-menu button.mb .ck{width:16px;flex:none;font-size:12px;font-weight:700;color:var(--ac);text-align:center}
.fe-menu button.mb .sb{width:0;height:0;border-top:4px solid transparent;border-bottom:4px solid transparent;border-left:5px solid currentColor;flex:none;opacity:.6}
.fe-menu hr{border:0;border-top:1px solid var(--bd);margin:3px 2px}
.fe-menu .mh{font-size:11px;color:var(--mut);padding:4px 8px 2px;font-weight:600}
.fe-menu .fe-sm{position:absolute;left:100%;top:-4px;margin-left:-2px;z-index:2}
.fe-menu .fe-sm.l{left:auto;right:100%;margin-left:0;margin-right:-2px}
.fe-qs{display:grid;grid-template-columns:repeat(3,64px);gap:6px;padding:2px}
#fe .fe-qs button{width:64px;height:40px;border:1px solid transparent;border-radius:2px;flex-direction:column;gap:2px;height:auto;padding:4px 2px}
#fe .fe-qs button:hover{border-color:var(--ac);background:var(--acs)}
.fe-qs .qp{width:48px;height:22px;border-radius:2px}
.fe-qs small{font-size:10px;color:var(--mut)}
.fe-fld{display:flex;align-items:center;gap:4px;margin-bottom:2px}
#fe .fe-fld .fi{flex:1;min-width:0;justify-content:flex-start;height:26px;padding:0 8px;border:1px solid var(--bd);background:var(--bg);overflow:hidden}
#fe .fe-fld .fi span{overflow:hidden;text-overflow:ellipsis}
#fe .fe-fld .fi:hover{border-color:var(--ac);background:var(--acs)}
#fe .fe-fld .fb{width:28px;height:26px;border:1px solid var(--bd);background:var(--bg);font-size:11px;color:var(--mut)}
/* ミニ ツール バー */
.fe-mini{position:fixed;z-index:77;display:flex;align-items:center;gap:1px;padding:3px 4px;background:var(--panel);border:1px solid var(--bd);box-shadow:0 3px 14px rgba(0,0,0,.25);border-radius:3px;white-space:nowrap}
.fe-mini .fe-combo input{height:22px;width:auto}
.fe-mini .fe-combo.f input{width:100px}
.fe-mini .fe-combo.z input{width:46px}
#fe .fe-mini button{height:22px;min-width:24px;padding:0 4px}
/* 読み取り専用 */
.fe-ronote{display:none}
#fe.ro .fe-tabs,#fe.ro .fe-ribbon,#fe.ro .fe-thumbs,#fe.ro .fe-thx,#fe.ro .fe-pane,#fe.ro .fe-edit,#fe.ro .fe-status .fe-edit{display:none}
#fe.ro .fe-ronote{display:block;position:absolute;left:0;right:0;top:0;z-index:4;text-align:center;padding:8px 16px;background:var(--warnbg);color:var(--warn);font-size:13px;font-weight:700}
#fe.ro .fe-world{padding-top:56px}
#fe.pv .fe-ov,#fe.pv .fe-ruler{display:none}#fe.pv .fe-pg{pointer-events:none}
#fe.pv .fe-pg .fz{cursor:default}#fe.pv .fe-pg .fz:hover{outline:0}
#fe.ro .fe-tcen{max-width:70%}
.fe-tt{position:fixed;z-index:95;background:var(--panel);color:var(--fg);border:1px solid var(--bd);font-size:11.5px;line-height:1.4;padding:5px 9px;border-radius:2px;pointer-events:none;box-shadow:0 3px 10px rgba(0,0,0,.25);max-width:280px}
.fe-tt b{display:block;font-weight:600}.fe-tt span{display:block;color:var(--mut);margin-top:1px;white-space:normal}.fe-tt em{display:block;font-style:normal;color:var(--mut);margin-top:3px;font-size:11px}
.fe-hov{position:absolute;border:2px solid #f59e0b;background:rgba(245,158,11,.1);pointer-events:none}
.fe-rowhl{position:absolute;border:1.5px solid var(--ac,#c4572e);background:rgba(196,87,46,.14);pointer-events:none}
.fe-bdg{position:absolute;width:20px;height:20px;border-radius:50%;background:#c4572e;color:#fff;display:flex;align-items:center;justify-content:center;pointer-events:none;box-shadow:0 1px 5px rgba(0,0,0,.3);z-index:2}
.fe-bdg svg{width:12px;height:12px}
.fe-bdg b{position:absolute;right:26px;top:-1px;white-space:nowrap;background:#262626;color:#fff;font-size:11px;font-weight:400;line-height:1.4;padding:2px 8px;border-radius:2px}
.fe-dl{position:absolute;background:#e8590c;pointer-events:none}
.fe-dl.eq{background:#e8590c}
.fe-dv{position:absolute;transform:translate(-50%,-50%);background:#e8590c;color:#fff;font-size:10px;line-height:1.3;padding:0 4px;border-radius:2px;white-space:nowrap;pointer-events:none}
.fe-pg .fz-ie{outline:2px solid var(--ac,#c4572e)!important;cursor:text;text-overflow:clip!important}
.fe-pg .fz-ie[contenteditable]{user-select:text;-webkit-user-select:text;white-space:pre-wrap!important;overflow:visible!important}
.fe-pophost.fe-wide{width:320px}
.fe-pophost p{margin:0 0 8px;font-size:12px;color:var(--mut);line-height:1.5}
.fe-pophost .fe-act{display:flex;gap:8px;margin-top:10px}
.fe-pophost .fe-bt{flex:1}
.fe-pophost .fe-bt.pri{background:var(--ac);color:var(--acfg);border-color:var(--ac)}
.fe-pophost input,.fe-pophost textarea{width:100%;height:24px;padding:0 6px;border:1px solid var(--bd);border-radius:2px;background:var(--inp);color:var(--fg);font:inherit;box-sizing:border-box}
.fe-pophost textarea{height:auto;padding:5px 6px;line-height:1.5;resize:vertical}
.fe-pophost input[type=checkbox],.fe-pophost input[type=radio]{width:auto;height:auto}
.fe-modal{position:absolute;inset:0;z-index:80;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;padding:20px}
.fe-help{background:var(--panel);border-radius:4px;width:min(760px,100%);max-height:100%;overflow:auto;padding:20px 24px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.fe-help h3{margin:0 0 12px;font-size:15px;display:flex;align-items:center;justify-content:space-between}
.fe-help .cols{display:grid;grid-template-columns:1fr 1fr;gap:6px 30px}
.fe-help h5{margin:12px 0 5px;font-size:12px;color:var(--mut)}
.fe-help .kr{display:flex;justify-content:space-between;gap:12px;padding:3px 0;border-bottom:1px solid var(--bd);font-size:12px}
.fe-help kbd{font:600 11px/1 inherit;background:var(--bg);border:1px solid var(--bd);border-bottom-width:2px;border-radius:3px;padding:3px 6px;white-space:nowrap}
.fe-thumb{width:100px;height:141px;margin:0 auto;background:#fff;border:1px solid var(--bd);position:relative;overflow:hidden;pointer-events:none}
.fe-thumb .ticket{position:absolute;left:0;top:0;transform-origin:0 0}
.fe-sub{margin:0 0 8px;font-size:12px;color:var(--mut);line-height:1.55}
.fe-zm{display:flex;align-items:center;gap:6px}
@media print{#fe,.fe-pophost{display:none!important}}
.fe-menu .fe-sm{display:none;background:var(--panel);border:1px solid var(--bd);box-shadow:0 6px 24px rgba(0,0,0,.28);border-radius:3px;padding:3px;min-width:180px;width:max-content;max-width:300px;position:absolute}
.fe-menu .mi:hover>.fe-sm{display:block}
.fe-menu .mi:hover>button.mb{background:var(--acs)}
.fe-gal.sh{border:0}
.fe-gc .qp{display:block;width:34px;height:22px;border-radius:2px}
`;

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

function recentColors() { try { var a = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(a) ? a.filter(function (x) { return /^#[0-9a-f]{6}$/i.test(x); }).slice(0, 8) : []; } catch (e) { return []; } }
function pushRecent(c) { if (!/^#[0-9a-f]{6}$/i.test(c)) return; c = c.toLowerCase(); var a = recentColors().filter(function (x) { return x !== c; }); a.unshift(c); try { localStorage.setItem(RECENT_KEY, JSON.stringify(a.slice(0, 8))); } catch (e) {} }


/* ---------- 追加の入力部品 ---------- */
function rangeNum(o) {
  var w = h('div', 'fe-rn'), r = h('input'), n = numInput({ v: o.v, min: o.min, max: o.max, step: o.step, label: o.label, on: function (v) { r.value = v; o.on(v); } });
  r.type = 'range'; r.min = o.min; r.max = o.max; r.step = o.step || 1; r.value = o.v; r.setAttribute('aria-label', o.label || '');
  r.oninput = function () { n.value = fmt(+r.value); o.on(+r.value, true); };
  r.onchange = function () { o.on(+r.value); };
  w.appendChild(r); w.appendChild(n); return w;
}
var SIZES = [6, 7, 8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96];
function fontLabel(k) { return k ? (JFN.valid(k) ? JFN.get(k).name : String(k)) : ''; }
function fontCombo(cur, on, dis) {
  var w = h('span', 'fe-combo f'), i = h('input'), b = h('button', 'fe-cba', '<i class="fe-dd"></i>'); i.type = 'text'; i.readOnly = true; i.value = cur ? fontLabel(cur) : ''; i.setAttribute('aria-label', 'フォント'); b.type = 'button'; b.tabIndex = -1;
  if (cur && JFN.valid(cur)) { i.style.fontFamily = JF.fcss(cur); JFN.use(cur); }
  w.setAttribute('data-tip', tipOf('フォント', '文字の書体を変更します。種類別・検索つきの一覧から選べます。'));
  function open() { closePop(); JFN.openPicker({ anchor: w, value: cur, theme: 'light', onPick: on }); }
  i.onclick = open; b.onclick = open; i.disabled = b.disabled = !!dis; w.appendChild(i); w.appendChild(b); return w;
}
function sizeCombo(cur, on, dis) {
  var w = h('span', 'fe-combo z'), i = h('input'), b = h('button', 'fe-cba', '<i class="fe-dd"></i>'); i.type = 'text'; i.value = cur == null ? '' : fmt(cur); i.setAttribute('aria-label', 'フォント サイズ'); b.type = 'button'; b.tabIndex = -1;
  w.setAttribute('data-tip', tipOf('フォント サイズ', '文字の大きさ（pt）を変更します。', 'Ctrl+Shift+> / <'));
  i.onchange = function () { var n = parseFloat(i.value); if (isFinite(n) && n > 0) on(clamp(n, 1, 500)); else i.value = cur == null ? '' : fmt(cur); };
  i.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } };
  b.onclick = function () { openMenu(0, 0, SIZES.map(function (n) { return { l: String(n), ck: cur === n, fn: function () { on(n); } }; }), w); };
  i.disabled = b.disabled = !!dis; w.appendChild(i); w.appendChild(b); return w;
}

/* ---------- 色（Office 風：テーマの色・標準の色・最近使用した色・その他の色） ---------- */
function mixHex(c, t, p) { var a = rgbOf(c); return '#' + a.map(function (v) { return ('0' + Math.round(v + (t - v) * p).toString(16)).slice(-2); }).join(''); }
function tplColors() {
  var out = [];
  JT.list().forEach(function (t) { if (t.id === 'free') return; var c = t.defaults && t.defaults.accent; if (c && isHex(c) && out.indexOf(c.toLowerCase()) < 0) out.push(c.toLowerCase()); });
  var pick = []; for (var i = 0; i < 4; i++) if (out.length) pick.push(out[Math.floor(i * out.length / 4)]);
  var fb = ['#2563eb', '#16a34a', '#d97706', '#7c3aed']; while (pick.length < 4) pick.push(fb[pick.length]);
  return pick;
}
function themeCols() {
  return [['#ffffff', '白'], ['#000000', '黒'], ['#1f2937', 'インク'], ['#e5e7eb', 'うすいグレー'], ['accent', 'アクセント'], ['secondary', 'サブ']].concat(tplColors().map(function (c, i) { return [c, 'テンプレートの色 ' + (i + 1)]; }));
}
var STD = [['#c00000', '濃い赤'], ['#ff0000', '赤'], ['#ffc000', 'オレンジ'], ['#ffff00', '黄'], ['#92d050', '薄い緑'], ['#00b050', '緑'], ['#00b0f0', '薄い青'], ['#0070c0', '青'], ['#002060', '濃い青'], ['#7030a0', '紫']];
function closePop() { if (pop) { pop.remove(); pop = null; } }
function placePop(p, r) {
  root.appendChild(p); pop = p; var pw = p.offsetWidth, ph = p.offsetHeight;
  p.style.left = clamp(r.left, 6, innerWidth - pw - 6) + 'px';
  p.style.top = (r.bottom + 2 + ph > innerHeight - 6 ? Math.max(6, r.top - ph - 2) : r.bottom + 2) + 'px';
}
function openPop(anchor, node) { closePop(); node.classList.add('fe-pophost'); placePop(node, anchor.getBoundingClientRect()); node._anchor = anchor; return node; }
/* o: {none:'塗りつぶしなし'などのラベル（なければ「なし」項目を出さない）} */
function openColor(anchor, cur, cb, o) {
  closePop(); o = o || {};
  var p = h('div', 'fe-pophost fe-pc'), curHex = cur && cur !== 'transparent' && cur !== 'accent' && cur !== 'secondary' ? String(cur).toLowerCase() : '';
  function pick(v, keep) { if (isHex(v)) pushRecent(v); cb(v); if (!keep) closePop(); }
  function dot(v, label) {
    var b = h('button', 'fe-c' + ((cur === v || (curHex && curHex === String(v).toLowerCase())) ? ' cur' : '')); b.type = 'button'; b.style.background = resolveColor(v); b.setAttribute('data-tip', label); b.setAttribute('aria-label', label);
    b.onclick = function () { pick(v); }; return b;
  }
  if (o.none) { var nb = h('button', 'fe-cm', '<span class="fe-c none" style="width:16px;height:16px;display:inline-block"></span><span>' + esc(typeof o.none === 'string' ? o.none : 'なし') + '</span>'); nb.type = 'button'; nb.onclick = function () { pick('transparent'); }; p.appendChild(nb); }
  p.appendChild(tx('h5', null, 'テーマの色'));
  var cols = themeCols(), g1 = h('div', 'fe-cg s1');
  cols.forEach(function (c) { g1.appendChild(dot(c[0], c[1])); }); p.appendChild(g1);
  var rows = [], g2 = h('div', 'fe-cg t');
  for (var ri = 0; ri < 5; ri++) cols.forEach(function (c, ci) {
    var base = resolveColor(c[0]), v;
    if (ci === 0) v = mixHex(base, 0, [0.05, 0.15, 0.25, 0.35, 0.5][ri]);
    else if (ci === 1) v = mixHex(base, 255, [0.5, 0.35, 0.25, 0.15, 0.05][ri]);
    else v = ri < 3 ? mixHex(base, 255, [0.8, 0.6, 0.4][ri]) : mixHex(base, 0, [0.25, 0.5][ri - 3]);
    g2.appendChild(dot(v, c[1] + '（' + (ci === 0 ? '濃く ' + [5, 15, 25, 35, 50][ri] : ci === 1 ? '薄く ' + [50, 35, 25, 15, 5][ri] : ri < 3 ? '薄く ' + [80, 60, 40][ri] : '濃く ' + [25, 50][ri - 3]) + '%）'));
  });
  p.appendChild(g2);
  p.appendChild(tx('h5', null, '標準の色'));
  var g3 = h('div', 'fe-cg'); STD.forEach(function (c) { g3.appendChild(dot(c[0], c[1])); }); p.appendChild(g3);
  var rc = recentColors();
  if (rc.length) { p.appendChild(tx('h5', null, '最近使用した色')); var g4 = h('div', 'fe-cg'); rc.forEach(function (c) { g4.appendChild(dot(c, c)); }); p.appendChild(g4); }
  var more = h('button', 'fe-cm', ic('palette') + '<span>その他の色…</span>'); more.type = 'button';
  var hx = h('div', 'fe-hex'), hi = h('input'), cp = h('input'); hx.style.display = 'none';
  hi.type = 'text'; hi.maxLength = 7; hi.placeholder = '#1e40af'; hi.setAttribute('aria-label', '16進カラーコード');
  var cv = cur && cur !== 'transparent' ? resolveColor(cur) : '#ffffff'; hi.value = isHex(cv) ? cv : '';
  cp.type = 'color'; cp.value = isHex(cv) ? cv : '#ffffff'; cp.setAttribute('aria-label', '色を選ぶ');
  function fromHex() { var v = hi.value.trim(); if (/^[0-9a-f]{6}$/i.test(v)) v = '#' + v; if (isHex(v)) { v = v.toLowerCase(); cp.value = v; pick(v, true); } }
  hi.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); fromHex(); closePop(); } };
  hi.onchange = fromHex;
  cp.oninput = function () { hi.value = cp.value; cb(cp.value, true); };
  cp.onchange = function () { pushRecent(cp.value); cb(cp.value); };
  hx.appendChild(cp); hx.appendChild(hi);
  more.onclick = function () { hx.style.display = hx.style.display === 'none' ? 'flex' : 'none'; if (hx.style.display === 'flex') hi.focus(); };
  p.appendChild(more); p.appendChild(hx);
  closePop(); openPop(anchor, p);
}

/* ---------- メニュー（右クリック・ドロップダウン）。items: {l, fn, k(ショートカット), ic, dis, st(見本のスタイル), ck(チェック), sub:[…]} / {h:'見出し'} / '-' ---------- */
function menuEl(items, isSub) {
  var p = h('div', isSub ? 'fe-menu fe-sm' : 'fe-pophost fe-menu');
  items.forEach(function (it) {
    if (it === '-') { p.appendChild(h('hr')); return; }
    if (it.h) { p.appendChild(tx('div', 'mh', it.h)); return; }
    var w = h('div', 'mi'), lead = it.ck != null ? '<i class="ck">' + (it.ck ? '✓' : '') + '</i>' : it.ic ? ic(it.ic) : '<i class="ck"></i>';
    var b = h('button', 'mb', lead + '<span>' + esc(it.l) + '</span>' + (it.k ? '<small>' + esc(it.k) + '</small>' : '') + (it.sub ? '<i class="sb"></i>' : '')); b.type = 'button'; b.disabled = !!it.dis;
    if (it.st) b.querySelector('span').style.cssText = it.st;
    if (it.sub) {
      var sb = menuEl(it.sub, true); w.appendChild(b); w.appendChild(sb);
      w.onmouseenter = function () { sb.style.display = 'block'; sb.classList.remove('l'); var r = sb.getBoundingClientRect(); if (r.right > innerWidth - 4) sb.classList.add('l'); };
      w.onmouseleave = function () { sb.style.display = ''; };
      b.onclick = function () { sb.style.display = 'block'; };
    } else { b.onclick = function () { closePop(); it.fn(); }; w.appendChild(b); }
    p.appendChild(w);
  });
  return p;
}
function openMenu(x, y, items, anchor) {
  closePop(); var p = menuEl(items, false);
  if (anchor) { placePop(p, anchor.getBoundingClientRect()); p._anchor = anchor; return p; }
  root.appendChild(p); pop = p; var pw = p.offsetWidth, ph = p.offsetHeight;
  p.style.left = clamp(x, 6, innerWidth - pw - 6) + 'px'; p.style.top = clamp(y, 6, innerHeight - ph - 6) + 'px'; return p;
}
document.addEventListener('mousedown', function (e) { if (pop && !pop.contains(e.target) && !(pop._anchor && pop._anchor.contains(e.target))) closePop(); if (mini && !mini.contains(e.target) && !(S.editing)) hideMini(); }, true);

/* ---------- 構築 ---------- */
var TABS = [['home', 'ホーム'], ['insert', '挿入'], ['design', 'デザイン'], ['merge', '差し込み'], ['view', '表示']];
function build() {
  var st = document.createElement('style'); st.id = 'fe-css'; st.textContent = CSS; document.head.appendChild(st);
  root = h('div'); root.id = 'fe'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'デザイン編集');
  root.innerHTML =
    '<div class="fe-tbar"><div class="fe-qat fe-edit"></div>' +
    '<div class="fe-tcen"><b class="fe-nm"></b><span class="fe-ds">- 受験票デザイン</span><button class="fe-sst fe-edit" data-a="sst" data-s=""><i></i><span></span></button></div>' +
    '<button class="fe-done" data-a="close">' + ic('check') + '<span>完了</span></button></div>' +
    '<div class="fe-tabs fe-edit"></div><div class="fe-ribbon fe-edit"></div>' +
    '<div class="fe-main">' +
    '<div class="fe-thumbs fe-edit"><button class="fe-thc" data-a="thc">' + ic('chevL') + '</button><div class="fe-thl"></div><div class="fe-thrs"></div></div>' +
    '<div class="fe-thx fe-edit"><button data-a="thx">' + ic('chevR') + '</button></div>' +
    '<div class="fe-stage"><div class="fe-ronote">デザイン編集はパソコンでご利用ください（この画面は表示のみです）</div>' +
    '<div class="fe-scroll"><div class="fe-world"><div class="fe-pagebox"><div class="fe-ruler top" data-axis="y"></div><div class="fe-ruler left" data-axis="x"></div><div class="fe-pg"></div><div class="fe-ov"></div></div></div></div></div>' +
    '<aside class="fe-pane fe-edit" hidden aria-label="作業ウィンドウ"></aside></div>' +
    '<div class="fe-status"><span class="fe-si fe-pgn"></span><span class="fe-si fe-stn fe-edit"></span><span class="fe-si fe-mgn fe-edit"></span><span class="fe-sp"></span>' +
    '<span class="fe-si nb fe-edit"><button data-a="vnormal">標準</button><button data-a="vfit">全体表示</button></span>' +
    '<span class="fe-si nb"><button class="zb" data-a="zout" aria-label="縮小">−</button><input type="range" class="fe-zs" min="10" max="400" step="1" value="100" aria-label="ズーム"><button class="zb" data-a="zin" aria-label="拡大">+</button><button class="zv" data-a="z100">100%</button></span>' +
    '<button data-a="zfit">ページに合わせる</button></div>';
  document.body.appendChild(root);
  var q = $('.fe-qat');
  var bsave = ibtn('save', tipOf('上書き保存', 'デザインを保存します。', 'Ctrl+S'), null); bsave.setAttribute('data-a', 'save');
  var bun = ibtn('undo', tipOf('元に戻す', '直前の操作を取り消します。', 'Ctrl+Z'), null); bun.setAttribute('data-a', 'undo');
  var bud = ibtn('chevD', tipOf('元に戻す（一覧）', '最近の操作をまとめて取り消します。'), null, 'fe-qd'); bud.setAttribute('data-a', 'undolist');
  var bre = ibtn('redo', tipOf('やり直し', '取り消した操作をやり直します。', 'Ctrl+Y'), null); bre.setAttribute('data-a', 'redo');
  [bsave, bun, bud, bre].forEach(function (b) { q.appendChild(b); });
  R.ribbon = $('.fe-ribbon'); R.tabs = $('.fe-tabs'); R.thumbs = $('.fe-thumbs'); R.thl = $('.fe-thl'); R.thx = $('.fe-thx'); R.pane = $('.fe-pane'); R.scroll = $('.fe-scroll'); R.box = $('.fe-pagebox'); R.pg = $('.fe-pg'); R.ov = $('.fe-ov'); R.rt = $('.fe-ruler.top'); R.rl = $('.fe-ruler.left');
  R.nm = $('.fe-nm'); R.sst = $('.fe-sst'); R.zv = $('.fe-status .zv'); R.zs = $('.fe-zs'); R.pgn = $('.fe-pgn'); R.stn = $('.fe-stn'); R.mgn = $('.fe-mgn'); R.zfit = $('[data-a=zfit]'); R.stage = $('.fe-stage');
  root.addEventListener('mousedown', function (e) { var b = e.target.closest('button,.fe-combo input[readonly]'); if (b && S.editing) e.preventDefault(); else if (e.target.closest('.fe-combo input[readonly]')) e.preventDefault(); });
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b || !root.contains(b)) return; var a = b.getAttribute('data-a');
    if (a === 'close') FE.close();
    else if (a === 'undo') H.undo(); else if (a === 'redo') H.redo();
    else if (a === 'undolist') openUndoList(b);
    else if (a === 'save') H.save();
    else if (a === 'sst') { if (S.st.s === 'dirty' || S.st.s === 'error') H.save(); }
    else if (a === 'thc') { S.thumbs = false; saveUI(); drawFrame(); relayout(); }
    else if (a === 'thx') { S.thumbs = true; saveUI(); drawFrame(); drawThumbs(true); relayout(); }
    else if (a === 'vnormal') { S.fit = 'c'; setZoom(fitZoom(), null, null, true); drawZoomBtns(); }
    else if (a === 'vfit') { S.fit = 'p'; setZoom(fitZoom(), null, null, true); R.scroll.scrollTop = 0; drawZoomBtns(); }
    else if (a === 'zin') setZoom(S.zoom * 1.1); else if (a === 'zout') setZoom(S.zoom / 1.1); else if (a === 'z100') setZoom(1);
    else if (a === 'zfit') { S.fit = S.fit === 'p' ? 'c' : 'p'; setZoom(fitZoom(), null, null, true); R.scroll.scrollTop = 0; drawZoomBtns(); }
  });
  R.zs.addEventListener('input', function () { setZoom(+R.zs.value / 100); });
  R.scroll.addEventListener('pointerdown', onDown);
  R.scroll.addEventListener('pointermove', onMove);
  R.scroll.addEventListener('pointerup', onUp);
  R.scroll.addEventListener('pointercancel', onUp);
  R.scroll.addEventListener('dblclick', onDbl);
  R.scroll.addEventListener('contextmenu', onCtxMenu);
  R.scroll.addEventListener('pointerleave', function () { if (S.hb) { S.hb = null; drawOv(); } });
  root.addEventListener('mouseover', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t && root.contains(t)) { clearTimeout(ttTimer); ttTimer = setTimeout(function () { ttShow(t); }, 350); } });
  root.addEventListener('mouseout', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) ttHide(); });
  root.addEventListener('pointerdown', ttHide, true);
  R.scroll.addEventListener('wheel', function (e) { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); setZoom(S.zoom * Math.exp(-e.deltaY * 0.0018), e.clientX, e.clientY); }, { passive: false });
  if (window.ResizeObserver) new ResizeObserver(function () { if (S.open && S.fit) { S.zoom = fitZoom(); layout(); drawOv(); } }).observe(R.scroll);
  /* サムネイル欄の幅を変える */
  $('.fe-thrs').addEventListener('pointerdown', function (e) {
    e.preventDefault(); var sx = e.clientX, w0 = S.thw, rs = e.target; try { rs.setPointerCapture(e.pointerId); } catch (x) {}
    rs.onpointermove = function (m) { S.thw = clamp(w0 + m.clientX - sx, 96, 280); R.thumbs.style.width = S.thw + 'px'; };
    rs.onpointerup = function () { rs.onpointermove = rs.onpointerup = null; saveUI(); drawThumbs(true); relayout(); };
  });
  R.tabs.addEventListener('dblclick', function (e) { if (e.target.closest('.fe-tab:not(.file)')) { S.rcol = !S.rcol; S.rpeek = false; saveUI(); drawFrame(); relayout(); } });
  document.addEventListener('mousedown', function (e) { if (S.open && S.rcol && S.rpeek && !R.ribbon.contains(e.target) && !R.tabs.contains(e.target) && !(pop && pop.contains(e.target))) { S.rpeek = false; drawFrame(); } }, true);
  tipify();
}
function relayout() { if (S.open && S.fit) { S.zoom = fitZoom(); } layout(); drawOv(); }

/* ---------- タブ ---------- */
function ctxTabIds() {
  var es = selEls(); if (!es.length || S.ro || S.preview) return [];
  if (es.every(function (e) { return e.type === 'table'; })) return ['tbl'];
  if (es.every(function (e) { return e.type === 'image'; })) return ['shape', 'pic'];
  return ['shape'];
}
function drawTabs() {
  var T = R.tabs; T.textContent = ''; var ct = ctxTabIds();
  if (S.rtab !== 'file' && ['shape', 'pic', 'tbl'].indexOf(S.rtab) >= 0 && ct.indexOf(S.rtab) < 0) S.rtab = 'home';
  function tab(id, label, cls) {
    var b = h('button', 'fe-tab' + (cls ? ' ' + cls : '') + (S.rtab === id ? ' cur' : ''), esc(label)); b.type = 'button'; b.setAttribute('data-rt', id); b.setAttribute('role', 'tab');
    b.onclick = function () { if (id === 'file') { openBackstage('info'); return; } S.rtab = id; S.rpeek = S.rcol; drawFrame(); drawTabs(); drawRibbon(); }; return b;
  }
  T.appendChild(tab('file', 'ファイル', 'file'));
  TABS.forEach(function (t) { T.appendChild(tab(t[0], t[1])); });
  if (ct.length) {
    var gr = {}; ct.forEach(function (id) { var c = CTAB[id]; (gr[c[1]] = gr[c[1]] || { c: c[2], l: c[1], ids: [] }).ids.push(id); });
    Object.keys(gr).forEach(function (k) {
      var g1 = gr[k], w = h('div', 'fe-ctab'), cap = tx('i', null, g1.l), row = h('div', 'fe-ctr'); w.style.setProperty('--cc', g1.c); w.appendChild(cap);
      g1.ids.forEach(function (id) { row.appendChild(tab(id, CTAB[id][0])); }); w.appendChild(row); T.appendChild(w);
    });
  }
  T.appendChild(h('span', 'fe-sp'));
  var cb = ibtn(S.rcol ? 'chevD' : 'chevU', S.rcol ? tipOf('リボンを展開', 'リボンを常に表示します。', 'Ctrl+F1') : tipOf('リボンを折りたたむ', 'タブの名前だけを表示します。', 'Ctrl+F1'), function () { toggleRibbon(); }, 'fe-rcol'); T.appendChild(cb);
  tipify(T);
}
function toggleRibbon() { S.rcol = !S.rcol; S.rpeek = false; saveUI(); drawFrame(); drawTabs(); relayout(); }

/* ---------- バックステージ（ファイルタブ） ---------- */
var BS = [['info', '情報', 'info'], ['save', '保存', 'save'], ['saveas', '名前を付けて保存', 'saveas'], ['pdf', 'PDFとして保存', 'pdf'], ['print', '印刷', 'print'], ['json', '書き出し（JSON）', 'ph'], ['close', 'エディタを閉じる', 'close']];
function closeBackstage() { if (R.bs) { R.bs.remove(); R.bs = null; } S.bs = ''; }
function openBackstage(sec) {
  closePop(); hideMini(); if (S.editing) finishEdit(true);
  if (R.bs) R.bs.remove(); S.bs = sec;
  var d = h('div', 'fe-bs'), l = h('div', 'fe-bsl'), r = h('div', 'fe-bsr'); R.bs = d;
  var back = h('button', '', ic('chevL') + '<span>戻る</span>'); back.type = 'button'; back.onclick = closeBackstage; l.appendChild(back);
  BS.forEach(function (x) {
    var b = h('button', x[0] === sec ? 'on' : '', ic(x[2]) + '<span>' + esc(x[1]) + '</span>'); b.type = 'button'; b.setAttribute('data-bs', x[0]);
    b.onclick = function () { if (x[0] === 'save') { closeBackstage(); H.save(); } else if (x[0] === 'close') { closeBackstage(); FE.close(); } else openBackstage(x[0]); }; l.appendChild(b);
  });
  function big(icon, t, sub, fn) { var b = h('button', 'fe-bsb', ic(icon) + '<span><b>' + esc(t) + '</b><small>' + esc(sub) + '</small></span>'); b.type = 'button'; b.onclick = function () { closeBackstage(); fn(); }; return b; }
  var Vv = V();
  if (sec === 'info') {
    r.appendChild(tx('h2', null, '情報'));
    var dl = h('dl', 'fe-bsi'), ls = H.students(), real = ls.length && !ls[0].sample;
    [['デザイン名', H.name()], ['保存の状態', S.st.t || '（変更なし）'], ['用紙', 'A4 縦（210 × 297 mm）'], ['要素の数', elems().length + '個'], ['差し込み項目', Vv.items.length + '個'], ['名簿', real ? ls.length + '名を選択中' : '未読み込み（サンプルで表示）']].forEach(function (x) { dl.appendChild(tx('dt', null, x[0])); dl.appendChild(tx('dd', null, x[1])); });
    r.appendChild(dl);
  } else if (sec === 'saveas') { r.appendChild(tx('h2', null, '名前を付けて保存')); r.appendChild(tx('p', null, '別の名前で保存します。いまのデザインは元の名前のまま残ります。')); r.appendChild(big('saveas', '名前を付けて保存…', '保存先のフォルダーと名前を指定します', function () { H.act('saveas'); })); }
  else if (sec === 'pdf') { r.appendChild(tx('h2', null, 'PDFとして保存')); r.appendChild(tx('p', null, '選択中の生徒の受験票を、1人1ページのPDFにします。')); r.appendChild(big('pdf', 'PDFとして保存', '印刷用のA4・PDFファイルを作ります', function () { H.act('pdf'); })); }
  else if (sec === 'print') { r.appendChild(tx('h2', null, '印刷')); r.appendChild(tx('p', null, '選択中の生徒の受験票を印刷します。')); r.appendChild(big('print', '印刷', 'ブラウザーの印刷画面を開きます', function () { H.act('print'); })); }
  else if (sec === 'json') { r.appendChild(tx('h2', null, '書き出し（JSON）')); r.appendChild(tx('p', null, 'デザインを .juken.json ファイルとして書き出します。別のパソコンで読み込めます。')); r.appendChild(big('ph', 'ファイルに書き出し', 'デザインの設定をJSONファイルにします', function () { H.act('json'); })); }
  d.appendChild(l); d.appendChild(r); root.appendChild(d); tipify(d);
}

/* ---------- 元に戻すの一覧 ---------- */
function openUndoList(anchor) {
  var hl = H.histList ? H.histList() : null, items = [];
  if (!hl || hl.i < 1) items.push({ l: '（元に戻せる操作はありません）', dis: true, fn: function () {} });
  else for (var j = hl.i, n = 0; j >= 1 && n < 12; j--, n++) (function (jj, nn) { items.push({ l: (hl.labels[jj] || '変更') + (nn ? '' : '（直前）'), fn: function () { H.histTo(jj - 1); } }); })(j, n);
  openMenu(0, 0, [{ h: '元に戻す（上が新しい操作）' }].concat(items), anchor);
}

/* ---------- ズーム・レイアウト ---------- */
/* S.fit='c'：ちょうどよい大きさ（画面の高さに合わせ、ただし80%を下回らない）／'p'：1ページ全体が入る大きさ */
function fitZoom() {
  var W = R.scroll.clientWidth, Hh = R.scroll.clientHeight, pad = S.rulers ? [92, 84] : [64, 54];
  if (W < 100 || Hh < 100) return S.zoom;
  var wfit = (W - pad[0]) / (PW * PXMM), hfit = (Hh - pad[1]) / (PH * PXMM);
  return clamp(S.fit === 'p' ? Math.min(wfit, hfit) : Math.min(wfit, Math.max(hfit, 0.8)), 0.1, 4);
}
function setZoom(z, cx, cy, fitting) {
  z = clamp(z, 0.1, 4); if (!fitting) S.fit = false;
  var br = R.box.getBoundingClientRect(), s0 = sz(), mx = cx != null ? (cx - br.left) / s0 : PW / 2, my = cy != null ? (cy - br.top) / s0 : PH / 2;
  S.zoom = z; layout(); drawOv(); drawZoomBtns();
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
  R.zv.textContent = Math.round(S.zoom * 100) + '%'; R.zs.value = Math.round(S.zoom * 100);
  R.ov.style.backgroundSize = (5 * s) + 'px ' + (5 * s) + 'px';
  drawRulers();
}
function drawRulers() {
  if (!S.rulers) return;
  var s = sz(), step = s * 10 >= 30 ? 10 : s * 10 >= 14 ? 20 : 50;
  [R.rt, R.rl].forEach(function (r, k) {
    r.textContent = '';
    for (var mmv = 0; mmv <= (k ? PH : PW); mmv += step) { var sp = tx('span', null, String(mmv)); sp.style[k ? 'top' : 'left'] = (mmv * s) + 'px'; r.appendChild(sp); }
    var a = k ? '180deg' : '90deg', col = 'rgba(127,127,127,.7)';
    r.style.backgroundImage = 'linear-gradient(' + a + ',' + col + ' 1px,transparent 1px),linear-gradient(' + a + ',' + col + ' 1px,transparent 1px)';
    r.style.backgroundSize = k ? ('8px ' + (10 * s) + 'px,4px ' + (5 * s) + 'px') : ((10 * s) + 'px 8px,' + (5 * s) + 'px 4px');
    r.style.backgroundPosition = k ? '100% 0,100% 0' : '0 100%,0 100%';
    r.style.backgroundRepeat = k ? 'repeat-y' : 'repeat-x';
  });
}
function drawZoomBtns() { if (R.zfit) R.zfit.setAttribute('data-tip', S.fit === 'p' ? 'ちょうどよい大きさに戻す' : '1ページ全体を表示'); }


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
  H.fitAll(page); R.pg.style.background = '';
}
function redraw() { drawPage(); layout(); drawFrame(); drawOv(); drawRibbon(); drawPane(); drawTop(); drawThumbs(); }
/* パネルなどの開閉状態 */
function drawFrame() {
  root.classList.toggle('rcol', S.rcol); root.classList.toggle('rpeek', S.rcol && S.rpeek); root.classList.toggle('nor', !S.rulers); root.classList.toggle('nogd', !S.guides);
  root.classList.toggle('drawing', !!S.draw); root.classList.toggle('fpaint', !!S.fp);
  R.thumbs.hidden = !S.thumbs || S.ro; R.thumbs.style.width = S.thw + 'px'; R.thx.hidden = S.thumbs || S.ro;
  R.pane.hidden = !S.pane || S.ro;
}
function drawTop() {
  R.nm.textContent = H.name(); var hs = H.hist();
  $('[data-a=undo]').disabled = !hs.u; $('[data-a=redo]').disabled = !hs.r; $('[data-a=undolist]').disabled = !hs.u;
  root.classList.toggle('pv', S.preview); drawZoomBtns(); drawStatus(); drawTabs(); drawStat();
}
function drawStat() {
  var l = H.students(), real = l.length > 0 && !l[0].sample;
  R.pgn.textContent = 'ページ 1 / 1';
  R.stn.hidden = !(real && !S.raw); R.stn.textContent = '生徒 ' + (clamp(S.pidx, 0, Math.max(0, l.length - 1)) + 1) + ' / ' + l.length;
  R.mgn.textContent = S.raw ? '差し込み表示：項目名' : '差し込み表示：実データ';
}
function drawStatus() { R.sst.setAttribute('data-s', S.st.s); R.sst.querySelector('span').textContent = S.st.t; R.sst.title = S.st.s === 'dirty' ? '未保存の変更あり（クリックで保存）' : S.st.t; tipify(R.sst); }

/* ---------- サムネイル（左） ---------- */
var thTimer = 0, thObs = null;
function drawThumbs(now) {
  clearTimeout(thTimer);
  if (!S.open || !S.thumbs || S.ro || !R.thl) return;
  if (!now) { thTimer = setTimeout(function () { drawThumbs(true); }, 280); return; }
  var L = R.thl, keep = L.scrollTop; L.textContent = '';
  var list = H.students(), real = list.length > 0 && !list[0].sample, many = real && !S.raw && list.length > 1;
  var pw = Math.max(64, S.thw - 56), ph = Math.round(pw * 297 / 210);
  if (thObs) { thObs.disconnect(); thObs = null; }
  if (window.IntersectionObserver) thObs = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { var p = en.target; thObs.unobserve(p); thRender(p, pw); } }); }, { root: L, rootMargin: '200px' });
  var n = many ? list.length : 1;
  for (var i = 0; i < n; i++) (function (i) {
    var d = h('div', 'fe-thi' + ((many ? i === S.pidx : true) ? ' on' : '')), p = h('div', 'p'); d.setAttribute('data-i', i);
    p.style.width = pw + 'px'; p.style.height = ph + 'px'; p._i = many ? i : -1;
    d.appendChild(tx('span', 'n', String(i + 1))); d.appendChild(p);
    d.setAttribute('data-tip', many ? (H.label(list[i]) || '') + '\nクリックで、この生徒のページを表示します。' : 'デザインのページ');
    d.onclick = function () { if (many) { S.pidx = i; redraw(); } };
    L.appendChild(d); if (thObs) thObs.observe(p); else thRender(p, pw);
  })(i);
  tipify(L); L.scrollTop = keep;
  var on = L.querySelector('.fe-thi.on'); if (on && many) { var r = on.getBoundingClientRect(), lr = L.getBoundingClientRect(); if (r.top < lr.top || r.bottom > lr.bottom) on.scrollIntoView({ block: 'nearest' }); }
}
function thRender(p, pw) {
  if (p._d) return; p._d = 1; var list = H.students(), st = Object.create(p._i >= 0 ? (list[p._i] || H.sample()) : (list[clamp(S.pidx, 0, list.length - 1)] || H.sample()));
  st._edit = false; st._raw = S.raw && p._i < 0;
  try { var pg = JT.render('free', st, V()); pg.style.transform = 'scale(' + (pw / (PW * PXMM)) + ')'; p.appendChild(pg); H.fitAll(pg); } catch (e) {}
}
function thumbSel() {
  if (!R.thl) return; var many = R.thl.children.length > 1;
  Array.prototype.forEach.call(R.thl.children, function (d, i) { d.classList.toggle('on', many ? i === S.pidx : true); });
}

function selBoxes() {
  var s = sz();
  return selEls().filter(function (e) { return !e.hidden; }).map(function (e) { var q = JF.geom(e); return { e: e, q: q, left: q.x * s, top: q.y * s, w: q.w * s, h: q.h * s }; });
}
function drawOv() {
  var ov = R.ov, s = sz(); ov.textContent = ''; ov.classList.toggle('grid', S.grid && !S.preview);
  if (S.preview || !S.open) return;
  drawExtra(ov, s);
  if (S.guides) F().guides.forEach(function (gd, i) { var l = h('div', 'fe-guide ' + gd.axis); l.setAttribute('data-gi', i); l.style[gd.axis === 'x' ? 'left' : 'top'] = (gd.pos * s) + 'px'; ov.appendChild(l); });
  var bs = selBoxes(), multi = bs.length > 1, dm = drag && drag.mode;
  var showH = !S.editing && !S.draw && !S.fp && !(dm && dm !== 'rs' && dm !== 'rot' && dm !== 'rsm' && dm !== 'rotm');
  function handles(d, one) {
    var hs = one ? ['w', 'e'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'], pos = { nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], sw: [0, 100], w: [0, 50] };
    hs.forEach(function (k) { var hd = h('div', 'fe-hd'); hd.setAttribute('data-h', k); hd.style.left = pos[k][0] + '%'; hd.style.top = pos[k][1] + '%'; d.appendChild(hd); });
    var rh = h('div', 'fe-hd', ic('rotate')); rh.setAttribute('data-h', 'rot'); rh.style.left = '50%'; rh.style.top = '-24px'; rh.setAttribute('data-tip', '回転（Shiftで15°ずつ）'); d.appendChild(rh);
  }
  bs.forEach(function (b) {
    var d = h('div', 'fe-sel' + (multi ? ' multi' : '') + (b.e.locked ? ' lock' : '')); d.style.cssText = 'left:' + b.left + 'px;top:' + b.top + 'px;width:' + b.w + 'px;height:' + b.h + 'px;' + (b.e.rot ? 'transform:rotate(' + b.e.rot + 'deg)' : '');
    if (!multi && !b.e.locked && showH) handles(d, b.e.type === 'line' || b.e.type === 'fold');
    ov.appendChild(d);
  });
  if (bs.length === 1 && bs[0].e.groupId) {
    var gm = elems().filter(function (e) { return e.groupId === bs[0].e.groupId && !e.hidden; }), gu = unionBox(gm);
    if (gu) { var gd2 = h('div', 'fe-gbox grp'); gd2.style.cssText = 'left:' + (gu.x * s) + 'px;top:' + (gu.y * s) + 'px;width:' + (gu.w * s) + 'px;height:' + (gu.h * s) + 'px'; ov.appendChild(gd2); }
  }
  if (multi) {
    var vis = selEls().filter(function (e) { return !e.hidden; }), u = unionBox(vis);
    if (u) { var gb = h('div', 'fe-gbox'); gb.style.cssText = 'left:' + (u.x * s) + 'px;top:' + (u.y * s) + 'px;width:' + (u.w * s) + 'px;height:' + (u.h * s) + 'px'; if (showH && vis.some(function (e) { return !e.locked; })) handles(gb, false); ov.appendChild(gb); }
  }
  if (drag && drag.lines) drag.lines.forEach(function (l) { var d = h('div', 'fe-snap ' + l.axis); d.style[l.axis === 'x' ? 'left' : 'top'] = (l.pos * s) + 'px'; ov.appendChild(d); });
  if (drag && drag.mode === 'mq' && drag.rect) { var mq = h('div', 'fe-mq'), rr = drag.rect; mq.style.cssText = 'left:' + (rr.x * s) + 'px;top:' + (rr.y * s) + 'px;width:' + (rr.w * s) + 'px;height:' + (rr.h * s) + 'px'; ov.appendChild(mq); }
  if (drag && drag.mode === 'draw' && drag.moved) {
    var dq = h('div', 'fe-mq dr');
    if (drag.type === 'line') { dq.style.cssText = 'left:' + (drag.a.x * s) + 'px;top:' + (drag.a.y * s) + 'px;width:' + (drag.len * s) + 'px;height:0;border:0;border-top:2px solid var(--ac,#c4572e);background:none;transform-origin:0 0;transform:rotate(' + drag.ang + 'deg)'; }
    else { var rd = drag.rect; dq.style.cssText = 'left:' + (rd.x * s) + 'px;top:' + (rd.y * s) + 'px;width:' + (rd.w * s) + 'px;height:' + (rd.h * s) + 'px'; }
    ov.appendChild(dq);
  }
  var tipTxt = (drag && drag.tip) || S.nt;
  if (tipTxt) { var u2 = unionBox(selEls().filter(function (e) { return !e.hidden; })); if (u2) { var tp = tx('div', 'fe-tip', tipTxt); tp.style.left = ((u2.x + u2.w / 2) * s) + 'px'; tp.style.top = ((u2.y + u2.h) * s + 14) + 'px'; ov.appendChild(tp); } }
}

/* ホバー強調・選択中の表の行・名簿連動バッジ・ドラッグ中の距離表示 */
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
    var l = h('div', 'fe-dl' + (d.eq ? ' eq' : '')), horiz = d.y1 === d.y2;
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
var PROP_LBL = { fill: '塗りつぶしの変更', bg: '塗りつぶしの変更', stroke: '枠線の変更', strokeWidth: '線の太さの変更', dash: '線の種類の変更', color: '文字色の変更', size: 'フォント サイズの変更', font: 'フォントの変更', weight: '太字の変更', italic: '斜体の変更', underline: '下線の変更', strike: '取り消し線の変更', align: '配置の変更', valign: '配置の変更', letterSpacing: '文字の間隔の変更', lineHeight: '行間の変更', vertical: '文字列の方向の変更', text: '文字の編集', opacity: '透明度の変更', radius: '角の丸みの変更', name: '名前の変更', locked: 'ロックの変更', hidden: '表示の変更', padding: '余白の変更', fit: '自動調整の変更', src: '画像の変更' };
function cleanGroups() {
  var n = {}; elems().forEach(function (e) { if (e.groupId) n[e.groupId] = (n[e.groupId] || 0) + 1; });
  elems().forEach(function (e) { if (e.groupId && n[e.groupId] < 2) delete e.groupId; });
}
function mut(fn, o) {
  o = o || {}; if (o.label) lbl(o.label); fn(); cleanGroups(); H.changed(!o.live);
  if (o.live) { drawPage(); drawOv(); } else redraw();
}
function setSel(ids) { S.sel = ids.filter(function (id, i) { return ids.indexOf(id) === i && find(id); }); if (S.rowSel && S.sel.indexOf(S.rowSel.eid) < 0) S.rowSel = null; }
function groupOf(e) { return e && e.groupId ? elems().filter(function (m) { return m.groupId === e.groupId; }) : []; }
function expandGroups(ids) {
  var out = ids.slice(); ids.forEach(function (id) { var e = find(id); if (e && e.groupId) groupOf(e).forEach(function (m) { if (out.indexOf(m.id) < 0) out.push(m.id); }); });
  return out;
}
function selChanged() { drawFrame(); if (rawKey() !== S.rawKey) drawPage(); drawOv(); drawTabs(); drawRibbon(); drawPane(); }
function restyleEdit(e) {
  var n = S.editing && S.editing.node; if (!n || !e) return; var s = n.style;
  s.fontFamily = JF.fcss(e.font); s.fontSize = e.size + 'pt'; s.fontWeight = e.weight; s.fontStyle = e.italic ? 'italic' : 'normal';
  s.textDecoration = [e.underline ? 'underline' : '', e.strike ? 'line-through' : ''].join(' ').trim() || 'none';
  s.color = resolveColor(e.color); s.textAlign = e.align; s.lineHeight = e.lineHeight; s.letterSpacing = e.letterSpacing ? e.letterSpacing + 'em' : '';
}
function editingOnly(es) { var ed = S.editing; return ed && !ed.commit && ed.id && es.length === 1 && es[0].id === ed.id; }
function setProp(k, v, live) {
  var es = selEls(); if (!es.length) return;
  if (editingOnly(es)) { lbl(PROP_LBL[k] || '書式の変更'); if (k in es[0]) es[0][k] = v; H.changed(!live); restyleEdit(es[0]); drawOv(); if (!live) { drawRibbon(); drawPane(); } return; }
  mut(function () { es.forEach(function (e) { if (k in e) e[k] = v; }); }, { live: !!live, label: PROP_LBL[k] || '書式の変更' });
}
function eachProp(label, fn) {
  var es = selEls(); if (!es.length) return;
  if (editingOnly(es)) { lbl(label); fn(es[0]); H.changed(true); restyleEdit(es[0]); drawOv(); drawRibbon(); drawPane(); return; }
  mut(function () { es.forEach(fn); }, { label: label });
}
/* 太字：フォントにある太さのうち近いものを使う（太い太さが無い書体は 700 を指定してブラウザの擬似太字） */
function setBold(on) { eachProp('太字の変更', function (e) { if ('weight' in e) e.weight = JFN.snap(e.font, on ? 700 : 400); }); }
function setFont(v) { JFN.use(v); eachProp('フォントの変更', function (e) { if ('font' in e) { e.font = v; if ('weight' in e) e.weight = JFN.snap(v, e.weight); } }); }
function forGeom(fn, label) { var es = selEls().filter(function (e) { return !e.locked; }); if (!es.length) return; mut(function () { es.forEach(fn); }, { label: label || '位置とサイズの変更' }); }
function addEl(type, props) {
  var e = JF.newElement(type, props); if (!e) return null;
  var off = (S.addN++ % 6) * 4;
  if (!props || props.x == null) e.x = r2(clamp((PW - e.w) / 2 + off, 0, PW - Math.min(e.w, PW)));
  if (!props || props.y == null) e.y = r2(clamp((PH - e.h) / 2 + off, 0, PH));
  mut(function () { elems().push(e); setSel([e.id]); }, { label: '挿入' });
  S.draw = null; drawFrame();
  return e;
}
function removeSel() {
  var ids = S.sel.slice(); if (!ids.length) return;
  mut(function () { F().elements = elems().filter(function (e) { return ids.indexOf(e.id) < 0; }); S.sel = []; }, { label: '削除' });
}
function cloneEls(es, dx, dy) {
  var gm = {};
  return es.map(function (e) { var c = JSON.parse(JSON.stringify(e)); c.id = JF.newId(); c.x = r2(c.x + dx); c.y = r2(c.y + dy); if (c.groupId) { gm[c.groupId] = gm[c.groupId] || JF.newId(); c.groupId = gm[c.groupId]; } return c; });
}
function dupSel() {
  var es = selEls(); if (!es.length) return; var cs = cloneEls(es, 5, 5);
  mut(function () { cs.forEach(function (c) { elems().push(c); }); setSel(cs.map(function (c) { return c.id; })); }, { label: '複製' });
}
function copySel(quiet) { var es = selEls(); if (!es.length) return; S.clip = JSON.parse(JSON.stringify(es)); S.pasteN = 0; if (!quiet) H.toast(es.length + '個の要素をコピーしました'); }
function cutSel() { if (!S.sel.length) return; copySel(true); var ids = S.sel.slice(); mut(function () { F().elements = elems().filter(function (e) { return ids.indexOf(e.id) < 0; }); S.sel = []; }, { label: '切り取り' }); }
function pasteSel() {
  if (!S.clip || !S.clip.length) return; S.pasteN++; var d = 5 * S.pasteN, cs = cloneEls(S.clip, d, d);
  mut(function () { cs.forEach(function (c) { elems().push(c); }); setSel(cs.map(function (c) { return c.id; })); }, { label: '貼り付け' });
}
/* kind: up=ひとつ前面へ / down=ひとつ背面へ / front=最前面へ / back=最背面へ */
function arrange(kind) {
  var ids = S.sel.slice(); if (!ids.length) return;
  mut(function () {
    var a = elems(), on = function (e) { return ids.indexOf(e.id) >= 0; };
    if (kind === 'front' || kind === 'back') { var sel = a.filter(on), rest = a.filter(function (e) { return !on(e); }); F().elements = kind === 'front' ? rest.concat(sel) : sel.concat(rest); }
    else if (kind === 'up') { for (var i = a.length - 2; i >= 0; i--) if (on(a[i]) && !on(a[i + 1])) { var t = a[i]; a[i] = a[i + 1]; a[i + 1] = t; } }
    else { for (var j = 1; j < a.length; j++) if (on(a[j]) && !on(a[j - 1])) { var u = a[j]; a[j] = a[j - 1]; a[j - 1] = u; } }
  }, { label: { front: '最前面へ移動', back: '最背面へ移動', up: '前面へ移動', down: '背面へ移動' }[kind] });
}
function reorder(fromId, toId, afterDisplay) {
  if (fromId === toId) return;
  mut(function () {
    var a = elems(), f = find(fromId); if (!f) return; a.splice(a.indexOf(f), 1);
    var ti = a.indexOf(find(toId)); a.splice(afterDisplay ? ti : ti + 1, 0, f);
  }, { label: '重なり順の変更' });
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
  }, { label: '配置の変更' });
}
function centerPage(axis) {
  var es = selEls().filter(function (e) { return !e.locked && !e.hidden; }); if (!es.length) return; var bb = unionBox(es);
  mut(function () { es.forEach(function (e) { if (axis === 'h') e.x = r2(e.x + PW / 2 - bb.cx); else e.y = r2(e.y + PH / 2 - bb.cy); }); }, { label: '配置の変更' });
}
function distribute(axis) {
  var es = selEls().filter(function (e) { return !e.locked && !e.hidden; }); if (es.length < 3) return;
  var k = axis === 'h' ? 'x' : 'y', wk = axis === 'h' ? 'w' : 'h';
  var arr = es.map(function (e) { return { e: e, a: JF.aabb(e) }; }).sort(function (p, q) { return p.a[k] - q.a[k]; });
  var first = arr[0].a[k], last = arr[arr.length - 1].a[k] + arr[arr.length - 1].a[wk], sum = 0; arr.forEach(function (p) { sum += p.a[wk]; });
  var gap = (last - first - sum) / (arr.length - 1);
  mut(function () { var pos = first; arr.forEach(function (p) { var d = pos - p.a[k]; p.e[k] = r2(p.e[k] + d); pos += p.a[wk] + gap; }); }, { label: '等間隔に配置' });
}
/* 回転・グループ化 */
function isLn(e) { return e.type === 'line' || e.type === 'fold'; }
function ctrOf(e) { return { x: e.x + e.w / 2, y: isLn(e) ? e.y : e.y + e.h / 2 }; }
function setCtr(e, cx, cy) { e.x = r2(cx - e.w / 2); e.y = r2(isLn(e) ? cy : cy - e.h / 2); }
function normRot(d) { d = ((d + 180) % 360 + 360) % 360 - 180; return r2(d === -180 ? 180 : d); }
function rotateEls(es, deg) {
  var u = es.length > 1 ? unionBox(es) : null;
  es.forEach(function (e) {
    if (u) { var c = ctrOf(e), r = deg * Math.PI / 180, co = Math.cos(r), si = Math.sin(r), dx = c.x - u.cx, dy = c.y - u.cy; setCtr(e, u.cx + dx * co - dy * si, u.cy + dx * si + dy * co); }
    e.rot = normRot((e.rot || 0) + deg);
  });
}
function rotateSel(deg) { var es = selEls().filter(function (e) { return !e.locked; }); if (!es.length) return; mut(function () { rotateEls(es, deg); }, { label: '回転' }); }
function groupSel() {
  var es = selEls(); if (es.length < 2) { H.toast('グループ化するには、2つ以上の要素を選んでください'); return; }
  var gid = JF.newId();
  mut(function () {
    var a = elems(), mem = a.filter(function (e) { return S.sel.indexOf(e.id) >= 0; }), top = 0;
    a.forEach(function (e, i) { if (mem.indexOf(e) >= 0) top = i; });
    mem.forEach(function (e) { e.groupId = gid; });
    var out = []; a.forEach(function (e, i) { if (mem.indexOf(e) >= 0) { if (i === top) mem.forEach(function (m) { out.push(m); }); } else out.push(e); });
    F().elements = out;
  }, { label: 'グループ化' });
}
function ungroupSel() {
  var es = selEls().filter(function (e) { return e.groupId; }); if (!es.length) return;
  var gs = {}; es.forEach(function (e) { gs[e.groupId] = 1; });
  mut(function () { elems().forEach(function (e) { if (e.groupId && gs[e.groupId]) delete e.groupId; }); }, { label: 'グループ解除' });
}
/* 文字の大きさ（PowerPoint と同じ段階で増減） */
function nextSize(cur, dir) {
  var a = SIZES, i;
  if (dir > 0) { for (i = 0; i < a.length; i++) if (a[i] > cur + 0.01) return a[i]; return Math.min(500, Math.round(cur + 8)); }
  for (i = a.length - 1; i >= 0; i--) if (a[i] < cur - 0.01) return a[i]; return Math.max(1, Math.round((cur - 1) * 2) / 2);
}
function stepSize(dir) { eachProp('フォント サイズの変更', function (e) { if ('size' in e) e.size = nextSize(e.size, dir); }); }
/* 書式のコピー／貼り付け */
var FP_KEYS = ['font', 'size', 'weight', 'italic', 'underline', 'strike', 'color', 'align', 'valign', 'lineHeight', 'letterSpacing', 'bg', 'padding', 'fill', 'stroke', 'strokeWidth', 'dash', 'radius', 'opacity', 'borderColor', 'labelBg', 'labelColor', 'accentColor', 'bullet'];
function fpTake() {
  var e = selEls()[0]; if (!e) { H.toast('書式をコピーする要素を、先に選んでください'); return null; }
  var st = {}; FP_KEYS.forEach(function (k) { if (k in e) st[k] = e[k]; }); S.fpStore = st; return st;
}
function fpApply(ids, st) {
  var es = ids.map(find).filter(Boolean); if (!es.length || !st) return;
  mut(function () { es.forEach(function (e) { Object.keys(st).forEach(function (k) { if (k in e) e[k] = st[k]; }); }); }, { label: '書式のコピー/貼り付け' });
}
function fpToggle(sticky) {
  if (S.fp) { S.fp = null; S.fpSticky = false; drawFrame(); drawRibbon(); return; }
  var st = fpTake(); if (!st) return; S.fp = st; S.fpSticky = !!sticky; drawFrame(); drawRibbon();
}
function applyStyle(st, label) { var es = selEls().filter(function (e) { return !e.locked; }); if (!es.length) return; mut(function () { es.forEach(function (e) { Object.keys(st).forEach(function (k) { if (k in e) e[k] = st[k]; }); }); }, { label: label || '図形のスタイルの変更' }); }

/* ---------- リボン ---------- */
function X() {
  var es = selEls(), n = es.length, o = { es: es, n: n, e0: es[0] || null, one: n === 1 };
  o.has = function (k) { return n > 0 && es.every(function (e) { return k in e; }); };
  o.val = function (k) { if (!n) return undefined; var v = es[0][k]; return es.every(function (e) { return e[k] === v; }) ? v : undefined; };
  o.fillKey = o.has('fill') ? 'fill' : o.has('bg') ? 'bg' : null;
  o.lineOk = o.has('stroke') && o.has('strokeWidth');
  return o;
}
function rb(o) {
  var big = !!o.big, b = h('button', (big ? 'fe-rbL' : 'fe-rbS') + (o.cls ? ' ' + o.cls : '') + (o.on ? ' on' : '') + (!o.l && !big ? ' ic' : '')), dd = o.drop ? '<i class="fe-dd"></i>' : '', lab = '';
  b.type = 'button';
  if (o.l) {
    if (big) { var ls = String(o.l).split('\n'); lab = '<em>' + ls.map(function (x, i) { return '<span>' + esc(x) + (i === ls.length - 1 ? dd : '') + '</span>'; }).join('') + '</em>'; }
    else lab = '<em>' + esc(o.l) + '</em>' + dd;
  } else lab = dd;
  b.innerHTML = (o.i ? ic(o.i) : '') + lab;
  b.setAttribute('data-tip', tipOf(o.t || String(o.l || '').replace('\n', ''), o.d, o.k));
  if (!o.l) b.setAttribute('aria-label', String(o.t || '').split('\n')[0]);
  b.disabled = !!o.dis; if (o.fn) b.onclick = function (e) { o.fn(e, b); }; if (o.dbl) b.ondblclick = o.dbl;
  return b;
}
function grp(name, kids, launch) {
  var g1 = h('div', 'fe-rg'), b = h('div', 'fe-rgb'), l = h('div', 'fe-rgl');
  kids.forEach(function (k) { if (k) b.appendChild(k); }); l.appendChild(tx('span', null, name));
  if (launch) { var lb = ibtn('launch', tipOf(launch.t, launch.d || ''), launch.fn); l.appendChild(lb); }
  g1.appendChild(b); g1.appendChild(l); g1.setAttribute('data-g', name); return g1;
}
function col() { var c = h('div', 'fe-rc'); Array.prototype.forEach.call(arguments, function (k) { if (k) c.appendChild(k); }); return c; }
function rrow() { var c = h('div', 'fe-rr'); Array.prototype.forEach.call(arguments, function (k) { if (k) c.appendChild(k); }); return c; }
function splitBtn(o) {
  var w = h('span', 'fe-spl'), m = rb({ i: o.i, t: o.t, d: o.d, k: o.k, fn: function () { o.apply(); }, dis: o.dis, cls: 'fcol' }), bar = h('i', 'fe-cbar');
  var c = o.color && o.color !== 'transparent' ? resolveColor(o.color) : '#e5e7eb'; bar.style.setProperty('--cb', c); m.appendChild(bar);
  var a = h('button', 'fe-sla', '<i class="fe-dd"></i>'); a.type = 'button'; a.setAttribute('data-tip', tipOf(o.t + 'の色', '色の一覧を開きます。')); a.disabled = !!o.dis; a.onclick = function () { o.pick(w); };
  w.appendChild(m); w.appendChild(a); return w;
}
function vchk(label, on, fn, tip, dis) {
  var l = h('label', 'fe-chk'), c = h('input'); c.type = 'checkbox'; c.checked = !!on; c.disabled = !!dis; c.onchange = function () { fn(c.checked); };
  l.appendChild(c); l.appendChild(document.createTextNode(label)); if (tip) l.setAttribute('data-tip', tip); l.style.margin = '0 4px'; return l;
}
function lnum(label, v, on, dis, min, max) {
  var w = h('span', 'fe-rr'), i = numInput({ v: v == null ? 0 : v, min: min != null ? min : 0, max: max != null ? max : 2000, step: 0.1, label: label, on: on });
  w.appendChild(tx('span', 'fe-rbs-lab', label)); i.style.width = '58px'; i.style.height = '22px'; i.style.marginLeft = '4px'; if (v == null) i.value = ''; i.disabled = !!dis; w.appendChild(i); return w;
}
function openPane(kind, sec, tab) {
  S.pane = kind; if (tab) S.ptab = tab; if (sec) { S.secs[sec] = true; S.scrollTo = sec; } saveUI(); drawFrame(); drawPane(); relayout();
}
function closePane() { S.pane = ''; saveUI(); drawFrame(); relayout(); drawRibbon(); }
function startDraw(type, props) { S.draw = { type: type, props: props || {} }; closePop(); drawFrame(); drawStat(); }
var SHAPES = [['rect', '四角形', 'rect', { fill: 'secondary', w: 60, h: 36 }], ['round', '角丸四角形', 'rect', { fill: 'secondary', radius: 6, w: 60, h: 36 }], ['circle', '楕円', 'ellipse', { fill: 'secondary', w: 40, h: 40 }], ['line', '直線', 'line', { w: 80, strokeWidth: 1, stroke: '#1f2937' }], ['dashed', '点線', 'line', { w: 80, strokeWidth: 1, stroke: '#1f2937', dash: 'dashed' }]];
function shapeBtns() {
  var g1 = h('div', 'fe-shg');
  SHAPES.forEach(function (s) { g1.appendChild(rb({ i: s[0], t: s[1], d: 'ページ上をドラッグして描きます。クリックだけでも挿入できます。', fn: function () { startDraw(s[2], s[3]); } })); });
  g1.appendChild(rb({ i: 'chevD', t: 'その他の図形', d: '図形の一覧を開きます。', fn: function (e, b) { openMenu(0, 0, SHAPES.map(function (s) { return { l: s[1], ic: s[0], fn: function () { startDraw(s[2], s[3]); } }; }).concat(['-', { l: 'テキスト ボックス', ic: 'textbox', fn: function () { startDraw('text', TB_DEF); } }]), b); } }));
  return g1;
}
var TB_DEF = { text: 'テキストを入力', size: 14, w: 60, h: 12 };
var QSTYLES = [
  ['濃い塗りつぶし', { fill: 'accent', stroke: 'accent', strokeWidth: 0 }], ['薄い塗りつぶし', { fill: 'secondary', stroke: 'accent', strokeWidth: 0 }], ['白＋アクセントの枠', { fill: '#ffffff', stroke: 'accent', strokeWidth: 1.5 }],
  ['枠線のみ', { fill: 'transparent', stroke: 'accent', strokeWidth: 1.5 }], ['アクセント＋黒の枠', { fill: 'accent', stroke: '#111827', strokeWidth: 1 }], ['黒の塗りつぶし', { fill: '#111827', stroke: '#111827', strokeWidth: 0 }],
  ['サブカラー', { fill: 'secondary', stroke: 'transparent', strokeWidth: 0 }], ['白＋灰色の枠', { fill: '#ffffff', stroke: '#9ca3af', strokeWidth: 1 }], ['黒の破線', { fill: 'transparent', stroke: '#111827', strokeWidth: 1, dash: 'dashed' }]
];
function qsPrev(st) {
  var d = h('span', 'qp'), sw = st[1].strokeWidth || 0; d.style.background = resolveColor(st[1].fill); d.style.border = (sw ? Math.max(1, Math.min(3, sw * 1.3)) : 0) + 'px ' + (st[1].dash || 'solid') + ' ' + resolveColor(st[1].stroke || 'transparent'); return d;
}
function qsCell(st, dis) { var b = h('button', 'fe-gc', ''); b.type = 'button'; b.style.cssText = 'height:auto;justify-content:center'; b.appendChild(qsPrev(st)); b.setAttribute('data-tip', tipOf(st[0], '図形の塗りつぶしと枠線をまとめて変えます。')); b.disabled = !!dis; b.onclick = function () { closePop(); applyStyle(st[1], '図形のスタイルの変更'); }; return b; }
function openQuick(anchor) {
  var p = h('div', 'fe-qs'); QSTYLES.forEach(function (st) { var b = h('button', '', ''); b.type = 'button'; b.appendChild(qsPrev(st)); b.appendChild(tx('small', null, st[0])); b.onclick = function () { closePop(); applyStyle(st[1], '図形のスタイルの変更'); }; p.appendChild(b); });
  openPop(anchor, p); p.style.width = 'auto';
}
function gallery(descs, mk, vis, cls) {
  var g1 = h('div', 'fe-gal ' + (cls || '')), v = h('div', 'gv'), a = h('div', 'ga'), cw = cls === 'th' ? 47 : 43;
  v.style.width = (vis * cw) + 'px'; descs.forEach(function (d) { v.appendChild(mk(d)); });
  a.appendChild(ibtn('chevL', '前へ', function () { v.scrollLeft -= vis * cw; })); a.appendChild(ibtn('chevR', '次へ', function () { v.scrollLeft += vis * cw; }));
  a.appendChild(ibtn('chevD', 'すべて表示', function (e) { var p = h('div', 'fe-pophost'); p.style.cssText = 'display:grid;grid-template-columns:repeat(' + Math.min(6, descs.length) + ',auto);gap:4px;width:auto;padding:8px'; descs.forEach(function (d) { var c = mk(d); c.classList.add('x'); c.onclickBak = c.onclick; var o = c.onclick; c.onclick = function (ev) { closePop(); o.call(c, ev); }; p.appendChild(c); }); tipify(p); openPop(e.currentTarget || a, p); }));
  g1.appendChild(v); g1.appendChild(a); return g1;
}
/* デザイン（テーマ）・レイアウトのサムネイル */
function thumbOf(pageFn) { var box = h('div', 'fe-thumb'), pg; try { pg = pageFn(); } catch (e) { return box; } pg.style.transform = 'scale(' + (36 / (210 * PXMM)) + ')'; box.style.width = '36px'; box.style.height = '51px'; box.appendChild(pg); return box; }
function themeDescs() {
  if (!S.themeC) {
    var Vv = V(); S.themeC = { th: [], lay: [] };
    JT.list().filter(function (t) { return t.id !== 'free'; }).forEach(function (t) {
      var th = thumbOf(function () { return JT.render(t.id, H.students()[0] || H.sample(), JT.switchVals(t.id, Vv)); }); S.themeC.th.push({ n: t.name, sub: 'このデザインを元に自由編集に変換します。今の配置は置き換わります（元に戻すで戻せます）。', th: th, fn: function () { convertFrom(t.id); } });
    });
    JF.LAYOUTS.forEach(function (L) { S.themeC.lay.push({ n: L.name, sub: L.desc, th: thumbOf(function () { return pageFor(L.build(Vv)); }), fn: function () { applyLayout(L.build(V())); } }); });
    S.themeC.lay.push({ n: '初期レイアウト', sub: 'タイトル・番号・表・折り線・注意事項', th: thumbOf(function () { return pageFor(JF.starter(Vv)); }), fn: function () { applyLayout(JF.starter(V())); } });
    S.themeC.lay.push({ n: '白紙', sub: '何もない状態から', th: thumbOf(function () { return pageFor([]); }), fn: function () { applyLayout([]); } });
    S.themeC.th.forEach(function (d) { H.fitAll(d.th.firstChild); });
  }
  return S.themeC;
}
function thCell(d) {
  var b = h('button', 'fe-gc'); b.type = 'button'; var t = d.th.cloneNode(true); b.appendChild(t); b.setAttribute('data-tip', tipOf(d.n, d.sub || '', '')); b.onclick = d.fn; return b;
}
var PALS = [['藍', '#1e40af', '#e8edf3'], ['墨', '#111827', '#e5e7eb'], ['臙脂', '#9b1c31', '#f5e6e8'], ['若草', '#166534', '#e6f2ea'], ['橙', '#c2410c', '#fdeee3'], ['紫', '#6d28d9', '#eee9fb'], ['青緑', '#0f766e', '#e0f2f1'], ['桃', '#be185d', '#fce7f1']];
function palCell(p) {
  var cur = V().accent === p[1] && V().secondary === p[2], b = h('button', 'fe-gc' + (cur ? ' cur' : '')), s = h('span', 'qp'); b.type = 'button'; b.style.cssText = 'height:auto;justify-content:center;flex-direction:column;gap:2px';
  s.style.cssText = 'width:34px;height:34px;border-radius:2px;border:1px solid rgba(0,0,0,.2);background:linear-gradient(90deg,' + p[1] + ' 50%,' + p[2] + ' 50%)'; b.appendChild(s); b.appendChild(tx('small', null, p[0])); b.lastChild.style.cssText = 'font-size:10px;color:var(--mut)';
  b.setAttribute('data-tip', tipOf('配色：' + p[0], 'アクセント色とサブカラーを変えます。「アクセント」「サブ」を使っている所が一緒に変わります。'));
  b.onclick = function () { mut(function () { var v = V(); v.accent = p[1]; v.secondary = p[2]; }, { label: '配色の変更' }); }; return b;
}
function toggleFold() {
  var fs = elems().filter(function (e) { return e.type === 'fold'; });
  if (!fs.length) { addEl('fold', { y: 148.5, x: 0, w: 210 }); return; }
  var hid = fs.every(function (e) { return e.hidden; }); mut(function () { fs.forEach(function (e) { e.hidden = !hid; }); }, { label: '折り線の表示切り替え' });
}
function pageInfoPop(anchor) {
  var p = h('div', 'fe-pophost fe-wide'), fs = elems().filter(function (e) { return e.type === 'fold'; });
  p.appendChild(tx('h5', null, 'ページ設定')); p.appendChild(tx('p', null, '用紙：A4 縦（210 × 297 mm）。受験票は印刷とPDFで同じ大きさになるため、用紙の大きさは変えられません。'));
  p.appendChild(chkInput('折り線を表示', fs.length && !fs.every(function (e) { return e.hidden; }), function () { closePop(); toggleFold(); }));
  p.appendChild(chkInput('グリッドを表示（5mm）', S.grid, function (v) { S.grid = v; saveUI(); drawOv(); drawRibbon(); }));
  p.appendChild(chkInput('ガイド・他の要素・余白にスナップ', S.snap, function (v) { S.snap = v; saveUI(); }));
  openPop(anchor, p);
}
function fieldPop(anchor) {
  var p = h('div', 'fe-pophost'); p.style.width = '270px'; p.style.maxHeight = '70vh'; p.style.overflowY = 'auto';
  p.appendChild(tx('h5', null, '項目の値を要素として挿入'));
  var sp = ['ヘッダー', 'バッジ', 'マーク']; sp.forEach(function (k) { p.appendChild(itemRow(k, null)); });
  V().items.forEach(function (it) { p.appendChild(itemRow(it.label || '（無題）', it)); });
  p.appendChild(tx('p', null, '左の名前＝その項目の値を表示する要素を追加。右の「{}」＝{{項目名}} を文字として挿入（文字の中に混ぜて使えます）。')).style.marginTop = '8px';
  tipify(p); openPop(anchor, p);
}
function wmPop(anchor) { var p = h('div', 'fe-pophost fe-wide'); p.appendChild(tx('h5', null, '透かし文字')); p.appendChild(tx('p', null, 'ページ全体に重ねる大きな文字です。ほかの要素の上に薄く表示されます。')); wmForm(p); tipify(p); openPop(anchor, p); }
function imgMenu(anchor, replace) {
  var put = function (u) { if (replace) { var e = selEls()[0]; mut(function () { e.src = u; }, { label: '画像の変更' }); } else addEl('image', { src: u, w: 60, h: 60 }); };
  var Vv = V(), m = C.imageSrc(Vv.map, 'map'), l = C.imageSrc(Vv.logo, 'logo');
  openMenu(0, 0, [
    { l: 'このデバイス…', ic: 'upload', fn: function () { pickUpload(put); } }, { l: '素材から…', ic: 'folder', fn: function () { H.pickImage(put); } }, '-',
    { l: '地図' + (m ? '' : '（非表示中）'), ic: 'map', fn: function () { if (replace) put('map'); else addEl('image', { src: 'map', w: 62, h: 62, name: '地図' }); } },
    { l: 'ロゴ' + (l ? '' : '（非表示中）'), ic: 'pin', fn: function () { if (replace) put('logo'); else addEl('image', { src: 'logo', w: 50, h: 30, name: 'ロゴ' }); } }
  ], anchor);
}
function insertTable() { var ids = V().items.filter(function (i) { return !i.hidden; }).map(function (i) { return i.id; }); addEl('table', { itemIds: ids, w: 180, h: Math.max(20, Math.min(80, ids.length * 10)), x: 15, y: 60 }); }
function colorMenu(anchor, key, label, none, X1, kind) {
  openColor(anchor, X1.val(key), function (v, live) { if (!live && kind) S.lastCol[kind] = v; setProp(key, v, live); }, none ? { none: none } : {});
}
function lineMenu(anchor, X1) {
  var sw = X1.val('strokeWidth'), ds = X1.val('dash');
  openMenu(0, 0, [
    { l: '線の色…', ic: 'pen', fn: function () { setTimeout(function () { colorMenu(anchor, 'stroke', '枠線', '枠線なし', X1, 'line'); }, 0); } },
    { l: '枠線なし', ic: 'close', fn: function () { setProp('strokeWidth', 0); } }, '-',
    { l: '太さ', sub: [0.25, 0.5, 0.75, 1, 1.5, 2.25, 3, 4.5, 6].map(function (n) { return { l: n + ' pt', ck: sw === n, fn: function () { eachProp('線の太さの変更', function (e) { if ('strokeWidth' in e) { e.strokeWidth = n; if (e.stroke === 'transparent' || !e.stroke) e.stroke = S.lastCol.line === 'transparent' ? 'accent' : S.lastCol.line; } }); } }; }) },
    { l: '実線/点線', sub: DASH_OPTS.map(function (d) { return { l: d[1], ck: ds === d[0], fn: function () { setProp('dash', d[0]); } }; }) }
  ], anchor);
}
function arrangeMenu(anchor, X1) {
  var n = X1.n, multi = n > 1, a3 = n > 2;
  openMenu(0, 0, [
    { l: '最前面へ移動', ic: 'front', dis: !n, fn: function () { arrange('front'); } }, { l: '前面へ移動', ic: 'front', k: 'Ctrl+]', dis: !n, fn: function () { arrange('up'); } },
    { l: '背面へ移動', ic: 'back', k: 'Ctrl+[', dis: !n, fn: function () { arrange('down'); } }, { l: '最背面へ移動', ic: 'back', dis: !n, fn: function () { arrange('back'); } }, '-',
    { l: 'グループ化', ic: 'group', k: 'Ctrl+G', dis: !multi, fn: groupSel }, { l: 'グループ解除', ic: 'ungroup', k: 'Ctrl+Shift+G', dis: !selEls().some(function (e) { return e.groupId; }), fn: ungroupSel }, '-',
    { l: '配置', ic: 'al', sub: [
      { l: '左揃え', ic: 'al', dis: !n, fn: function () { alignSel('l'); } }, { l: '左右中央揃え', ic: 'ac', dis: !n, fn: function () { alignSel('c'); } }, { l: '右揃え', ic: 'ar', dis: !n, fn: function () { alignSel('r'); } },
      { l: '上揃え', ic: 'at', dis: !n, fn: function () { alignSel('t'); } }, { l: '上下中央揃え', ic: 'am', dis: !n, fn: function () { alignSel('m'); } }, { l: '下揃え', ic: 'ab', dis: !n, fn: function () { alignSel('b'); } }, '-',
      { l: '左右に整列（等間隔）', ic: 'dh', dis: !a3, fn: function () { distribute('h'); } }, { l: '上下に整列（等間隔）', ic: 'dv', dis: !a3, fn: function () { distribute('v'); } }, '-',
      { l: 'ページの左右中央に配置', dis: !n, fn: function () { centerPage('h'); } }, { l: 'ページの上下中央に配置', dis: !n, fn: function () { centerPage('v'); } }] },
    { l: '回転', ic: 'rotate', sub: [{ l: '右へ90°回転', dis: !n, fn: function () { rotateSel(90); } }, { l: '左へ90°回転', dis: !n, fn: function () { rotateSel(-90); } }, '-', { l: 'その他の回転オプション…', fn: function () { openPane('fmt', 'size', 'shape'); } }] }, '-',
    { l: 'オブジェクトの選択と表示', ic: 'layers', fn: function () { S.pane === 'sel' ? closePane() : openPane('sel'); } }
  ], anchor);
}
/* 配置・サイズのグループ（図形の書式／図の形式／テーブル デザインで共通） */
function geomGroups(X1) {
  var e0 = X1.e0, one = X1.one, ln = one && isLn(e0), go = function (k) { return function (v) { if (e0.locked) { H.toast('ロック中の要素は動かせません'); return; } resizeKey(e0, k, v); }; };
  return [
    grp('配置', [
      col(rb({ i: 'front', l: '前面へ移動', drop: 1, t: '前面へ移動', d: '選んだ要素を手前に移動します。', dis: !X1.n, fn: function (e, b) { openMenu(0, 0, [{ l: '最前面へ移動', fn: function () { arrange('front'); } }, { l: '前面へ移動', k: 'Ctrl+]', fn: function () { arrange('up'); } }], b); } }),
        rb({ i: 'back', l: '背面へ移動', drop: 1, t: '背面へ移動', d: '選んだ要素を奥に移動します。', dis: !X1.n, fn: function (e, b) { openMenu(0, 0, [{ l: '最背面へ移動', fn: function () { arrange('back'); } }, { l: '背面へ移動', k: 'Ctrl+[', fn: function () { arrange('down'); } }], b); } }),
        rb({ i: 'layers', l: '選択ウィンドウ', t: 'オブジェクトの選択と表示', d: '要素の一覧を開き、名前の変更・表示/非表示・順序の変更ができます。', on: S.pane === 'sel', fn: function () { S.pane === 'sel' ? closePane() : openPane('sel'); } })),
      col(rb({ i: 'al', l: '配置', drop: 1, t: '配置', d: '選んだ要素をそろえたり、等間隔に並べたりします。', dis: !X1.n, fn: function (e, b) { arrangeMenu(b, X1); } }),
        rb({ i: 'group', l: 'グループ化', drop: 1, t: 'グループ化', d: '複数の要素を1つにまとめます。まとめて動かし、大きさや回転も一緒に変えられます。', k: 'Ctrl+G', dis: !X1.n, fn: function (e, b) { openMenu(0, 0, [{ l: 'グループ化', ic: 'group', k: 'Ctrl+G', dis: X1.n < 2, fn: groupSel }, { l: 'グループ解除', ic: 'ungroup', k: 'Ctrl+Shift+G', dis: !X1.es.some(function (x) { return x.groupId; }), fn: ungroupSel }], b); } }),
        rb({ i: 'rotate', l: '回転', drop: 1, t: '回転', d: '選んだ要素を回転します。', dis: !X1.n, fn: function (e, b) { openMenu(0, 0, [{ l: '右へ90°回転', fn: function () { rotateSel(90); } }, { l: '左へ90°回転', fn: function () { rotateSel(-90); } }, '-', { l: 'その他の回転オプション…', fn: function () { openPane('fmt', 'size', 'shape'); } }], b); } }))
    ]),
    grp('サイズ', [col(ln ? lnum('長さ', e0.w, go('w'), false, 0.5, 2000) : lnum('高さ', one ? e0.h : null, go('h'), !one, 0.5, 2000), ln ? null : lnum('幅', one ? e0.w : null, go('w'), !one, 0.5, 2000))], { t: '図形のサイズと位置', d: '右の書式設定を開きます。', fn: function () { openPane('fmt', 'size', 'shape'); } })
  ];
}
function resizeKey(e, k, v) {
  var o = e[k]; mut(function () { e[k] = r2(v); if (S.lockAR && o > 0 && !isLn(e)) { var q = v / o; if (k === 'w') e.h = r2(e.h * q); else e.w = r2(e.w * q); } }, { label: 'サイズ変更' });
}

var RT = {};
RT.home = function (X1) {
  var n = X1.n, txt = X1.has('size'), fnt = X1.has('font'), has = X1.has;
  function tog(k, i, t, k2, on) { return rb({ i: i, t: t, d: '', k: k2, on: on, dis: !has(k), fn: function () { if (k === 'weight') setBold(!on); else setProp(k, !on); } }); }
  var bold = X1.val('weight') >= 600, it = X1.val('italic') === true, ul = X1.val('underline') === true, st = X1.val('strike') === true;
  var al = X1.val('align'), lh = X1.val('lineHeight'), ls = X1.val('letterSpacing');
  var fillOn = !!X1.fillKey;
  function alb(v, i, t, k2) { return rb({ i: i, t: t, d: '段落の配置を変えます。', k: k2, on: al === v, dis: !has('align'), fn: function () { setProp('align', v); } }); }
  return [
    grp('クリップボード', [
      rb({ big: 1, i: 'paste', l: '貼り付け', t: '貼り付け', d: 'コピーまたは切り取った要素を貼り付けます。', k: 'Ctrl+V', dis: !(S.clip && S.clip.length), fn: pasteSel }),
      col(rb({ i: 'cut', l: '切り取り', t: '切り取り', d: '選んだ要素を切り取ります。', k: 'Ctrl+X', dis: !n, fn: cutSel }), rb({ i: 'copy', l: 'コピー', t: 'コピー', d: '選んだ要素をコピーします。', k: 'Ctrl+C', dis: !n, fn: function () { copySel(); } }),
        rb({ i: 'fpaint', l: '書式のコピー/貼り付け', t: '書式のコピー/貼り付け', d: '選んだ要素の書式をコピーして、ほかの要素にクリックで貼り付けます。ダブルクリックで続けて貼り付けられます。', k: 'Ctrl+Shift+C / V', on: !!S.fp, dis: !n && !S.fp, fn: function () { fpToggle(false); }, dbl: function () { if (S.fp) { S.fpSticky = true; } else { fpToggle(true); } } }))
    ]),
    grp('フォント', [col(
      rrow(fontCombo(fnt ? X1.val('font') : '', setFont, !fnt), sizeCombo(txt ? X1.val('size') : null, function (v) { setProp('size', v); }, !txt),
        rb({ i: 'fontup', t: 'フォント サイズの拡大', d: '文字を大きくします。', k: 'Ctrl+Shift+>', dis: !txt, fn: function () { stepSize(1); } }), rb({ i: 'fontdown', t: 'フォント サイズの縮小', d: '文字を小さくします。', k: 'Ctrl+Shift+<', dis: !txt, fn: function () { stepSize(-1); } })),
      rrow(tog('weight', 'bold', '太字', 'Ctrl+B', bold), tog('italic', 'italic', '斜体', 'Ctrl+I', it), tog('underline', 'underline', '下線', 'Ctrl+U', ul), tog('strike', 'strike', '取り消し線', '', st),
        rb({ i: 'spacing', drop: 1, t: '文字の間隔', d: '文字と文字の間隔を変えます。', dis: !has('letterSpacing'), fn: function (e, b) {
          openMenu(0, 0, [['極狭', -0.1], ['狭く', -0.05], ['標準', 0], ['広く', 0.1], ['極広', 0.25]].map(function (x) { return { l: x[0], ck: ls === x[1], fn: function () { setProp('letterSpacing', x[1]); } }; }).concat(['-', { l: 'その他の間隔…', fn: function () { openPane('fmt', 'para', 'text'); } }]), b); } }),
        splitBtn({ i: 'fcolor', t: '文字の色', d: '文字の色を変えます。', dis: !has('color'), color: has('color') ? X1.val('color') || S.lastCol.font : S.lastCol.font, apply: function () { setProp('color', S.lastCol.font); }, pick: function (a) { openColor(a, X1.val('color'), function (v, live) { S.lastCol.font = v; setProp('color', v, live); }, {}); } }),
        splitBtn({ i: 'hilite', t: '蛍光ペンの色（背景色）', d: '文字ボックスの背景に色を付けます。', dis: !has('bg'), color: has('bg') && X1.val('bg') ? X1.val('bg') : S.lastCol.hl, apply: function () { setProp('bg', S.lastCol.hl); }, pick: function (a) { openColor(a, X1.val('bg'), function (v, live) { if (v !== 'transparent') S.lastCol.hl = v; setProp('bg', v, live); }, { none: '色なし' }); } }))
    )], { t: 'フォント', d: '右の書式設定（文字のオプション）を開きます。', fn: function () { openPane('fmt', 'font', 'text'); } }),
    grp('段落', [col(
      rrow(alb('left', 'tl', '左揃え', 'Ctrl+L'), alb('center', 'tc', '中央揃え', 'Ctrl+E'), alb('right', 'tr', '右揃え', 'Ctrl+R'), alb('justify', 'tj', '両端揃え', 'Ctrl+J')),
      rrow(rb({ i: 'lh', drop: 1, t: '行間', d: '行と行の間隔を変えます。', dis: !has('lineHeight'), fn: function (e, b) { openMenu(0, 0, [1.0, 1.15, 1.5, 2.0, 2.5, 3.0].map(function (v) { return { l: v.toFixed(v === 1.15 ? 2 : 1), ck: lh != null && Math.abs(lh - v) < 0.01, fn: function () { setProp('lineHeight', v); } }; }).concat(['-', { l: '行間のオプション…', fn: function () { openPane('fmt', 'para', 'text'); } }]), b); } }),
        rb({ i: X1.val('vertical') ? 'vt' : 'tl', drop: 1, t: '文字列の方向', d: '文字を横書きにするか縦書きにするかを選びます。', dis: !has('vertical'), fn: function (e, b) { openMenu(0, 0, [{ l: '横書き', ck: X1.val('vertical') === false, fn: function () { setProp('vertical', false); } }, { l: '縦書き', ck: X1.val('vertical') === true, fn: function () { setProp('vertical', true); } }], b); } }),
        rb({ i: { top: 'vtop', middle: 'vmid', bottom: 'vbot' }[X1.val('valign')] || 'vmid', drop: 1, t: '文字の配置（上下）', d: '枠の中で、文字を上・上下中央・下のどこに置くかを選びます。', dis: !has('valign'), fn: function (e, b) { openMenu(0, 0, [['top', '上揃え', 'vtop'], ['middle', '上下中央揃え', 'vmid'], ['bottom', '下揃え', 'vbot']].map(function (x) { return { l: x[1], ic: x[2], ck: X1.val('valign') === x[0], fn: function () { setProp('valign', x[0]); } }; }), b); } }))
    )], { t: '段落', d: '右の書式設定（文字のオプション）を開きます。', fn: function () { openPane('fmt', 'para', 'text'); } }),
    grp('図形描画', [
      shapeBtns(),
      rb({ big: 1, i: 'quick', l: 'クイック\nスタイル', drop: 1, t: 'クイック スタイル', d: '図形の塗りつぶしと枠線の組み合わせを選びます。', dis: !(X1.has('fill') || X1.has('stroke')), fn: function (e, b) { openQuick(b); } }),
      col(rb({ i: 'bucket', l: '図形の塗りつぶし', drop: 1, t: '図形の塗りつぶし', d: '図形や文字ボックスの塗りつぶしの色を選びます。', dis: !fillOn, fn: function (e, b) { colorMenu(b, X1.fillKey, '塗りつぶし', '塗りつぶしなし', X1, 'fill'); } }),
        rb({ i: 'pen', l: '図形の枠線', drop: 1, t: '図形の枠線', d: '枠線の色・太さ・種類を選びます。', dis: !X1.lineOk, fn: function (e, b) { lineMenu(b, X1); } }),
        rb({ i: 'al', l: '配置', drop: 1, t: '配置', d: '要素の重なり順・グループ化・位置合わせ・回転を行います。', dis: !n, fn: function (e, b) { arrangeMenu(b, X1); } }))
    ], { t: '図形の書式設定', d: '右の書式設定（図形のオプション）を開きます。', fn: function () { openPane('fmt', 'fill', 'shape'); } }),
    grp('編集', [rb({ big: 1, i: 'select', l: '選択', drop: 1, t: '選択', d: '要素をまとめて選んだり、一覧から選んだりします。', fn: function (e, b) { openMenu(0, 0, [{ l: 'すべて選択', ic: 'selall', k: 'Ctrl+A', fn: selectAll }, { l: 'オブジェクトの選択と表示', ic: 'layers', fn: function () { S.pane === 'sel' ? closePane() : openPane('sel'); } }], b); } })])
  ];
};
RT.insert = function (X1) {
  return [
    grp('テキスト', [rb({ big: 1, i: 'textbox', l: 'テキスト\nボックス', t: 'テキスト ボックス', d: 'ページ上をドラッグして、文字を入れる枠を描きます。', fn: function () { startDraw('text', TB_DEF); } })]),
    grp('図', [
      rb({ big: 1, i: 'shape', l: '図形', drop: 1, t: '図形', d: '四角形・角丸四角形・楕円・線を描きます。', fn: function (e, b) { openMenu(0, 0, SHAPES.map(function (s) { return { l: s[1], ic: s[0], fn: function () { startDraw(s[2], s[3]); } }; }), b); } }),
      rb({ big: 1, i: 'image', l: '画像', drop: 1, t: '画像', d: 'このデバイス・素材・地図・ロゴから画像を挿入します。', fn: function (e, b) { imgMenu(b, false); } })
    ]),
    grp('差し込み', [rb({ big: 1, i: 'ph', l: '差し込み\nフィールド', drop: 1, t: '差し込みフィールド', d: '名簿などの項目（受験番号・氏名など）を、生徒ごとに入れ替わる要素として挿入します。', fn: function (e, b) { fieldPop(b); } })]),
    grp('表', [rb({ big: 1, i: 'table', l: '表', t: '表（情報テーブル）', d: '項目を表にまとめた「情報テーブル」を挿入します。セルはダブルクリックで編集できます。', fn: insertTable })]),
    grp('ブロック', [
      rb({ big: 1, i: 'note', l: '注意事項', t: '注意事項', d: '注意事項の本文を表示するブロックを挿入します。', fn: function () { addEl('notes', { x: 15, y: 156, w: 112, h: 110, title: V().noteTitle || '' }); } }),
      rb({ big: 1, i: 'fold', l: '折り線', t: '折り線', d: '山折り・谷折りの目印（破線と文字）を挿入します。', fn: function () { addEl('fold', { y: 148.5, x: 0, w: 210 }); } })
    ]),
    grp('透かし', [rb({ big: 1, i: 'wm', l: '透かし', drop: 1, t: '透かし', d: 'ページ全体に重ねる大きな薄い文字を設定します。', fn: function (e, b) { wmPop(b); } })])
  ];
};
RT.design = function (X1) {
  var D = themeDescs();
  return [
    grp('テーマ', [gallery(D.th, thCell, 6, 'th')]),
    grp('レイアウト', [gallery(D.lay, thCell, 4, 'th')]),
    grp('バリエーション', [gallery(PALS, palCell, 4, '')]),
    grp('ユーザー設定', [
      rb({ big: 1, i: 'drop', l: '背景の\n書式設定', t: '背景の書式設定', d: 'ページの背景色を変えます。', fn: function () { setSel([]); selChanged(); openPane('fmt', 'bg', 'shape'); } }),
      rb({ big: 1, i: 'page', l: 'ページ設定', t: 'ページ設定', d: '用紙（A4）の情報と、折り線・グリッドの設定です。', fn: function (e, b) { pageInfoPop(b); } })
    ])
  ];
};
RT.merge = function (X1) {
  var ls = H.students(), real = ls.length > 0 && !ls[0].sample, nn = ls.length;
  return [
    grp('フィールドの挿入', [rb({ big: 1, i: 'ph', l: '差し込み\nフィールド', drop: 1, t: '差し込みフィールドの挿入', d: '項目の値を、生徒ごとに入れ替わる要素として挿入します。', fn: function (e, b) { fieldPop(b); } })]),
    grp('結果のプレビュー', [
      rb({ big: 1, i: 'eye', l: '結果の\nプレビュー', on: !S.raw, t: '結果のプレビュー', d: 'オン：生徒の実際の値で表示します（印刷と同じ見た目）。オフ：値の代わりに {{項目名}} を表示します。', fn: function () { S.raw = !S.raw; if (S.editing) finishEdit(true); redraw(); } }),
      col(rrow(rb({ i: 'chevL', t: '前のレコード', d: '前の生徒を表示します。', dis: !real || S.pidx <= 0, fn: function () { S.pidx = Math.max(0, S.pidx - 1); redraw(); } }),
        tx('span', 'fe-rbs-lab', real ? 'レコード ' + (S.pidx + 1) + ' / ' + nn : 'サンプル'),
        rb({ i: 'chevR', t: '次のレコード', d: '次の生徒を表示します。', dis: !real || S.pidx >= nn - 1, fn: function () { S.pidx = Math.min(nn - 1, S.pidx + 1); redraw(); } })),
        tx('span', 'fe-rbs-lab', real ? (H.label(ls[clamp(S.pidx, 0, nn - 1)]) || '') : '名簿を読み込むと生徒を切り替えられます')) 
    ]),
    grp('名簿', [rb({ big: 1, i: 'people', l: '名簿の確認', t: '名簿の確認', d: '名簿を読み込み、印刷する生徒を選ぶ画面に移ります。', fn: function () { H.act('roster'); } })]),
    grp('完了', [rb({ big: 1, i: 'print', l: '完了と印刷', drop: 1, t: '完了と印刷', d: '選択中の生徒の受験票を印刷、またはPDFにします。', fn: function (e, b) { openMenu(0, 0, [{ l: '印刷', ic: 'print', fn: function () { H.act('print'); } }, { l: 'PDFとして保存', ic: 'pdf', fn: function () { H.act('pdf'); } }], b); } })])
  ];
};
RT.view = function (X1) {
  return [
    grp('表示', [col(
      vchk('ルーラー', S.rulers, function (v) { S.rulers = v; saveUI(); drawFrame(); relayout(); }, 'ルーラー\nページの上と左に目盛りを表示します。ルーラーからドラッグするとガイドを作れます。'),
      vchk('グリッド線', S.grid, function (v) { S.grid = v; saveUI(); drawOv(); }, 'グリッド線\n5mm間隔の格子を表示します。要素がグリッドに吸着します。'),
      vchk('ガイド', S.guides, function (v) { S.guides = v; saveUI(); drawFrame(); drawOv(); }, 'ガイド\nルーラーからドラッグして作った補助線を表示します。'))]),
    grp('ズーム', [
      rb({ big: 1, i: 'zoom', l: 'ズーム', drop: 1, t: 'ズーム', d: '表示の倍率を選びます。', fn: function (e, b) { openMenu(0, 0, [400, 300, 200, 150, 100, 75, 50, 25, 10].map(function (p) { return { l: p + '%', ck: Math.round(S.zoom * 100) === p, fn: function () { setZoom(p / 100); } }; }), b); } }),
      rb({ big: 1, i: 'fit', l: 'ページに\n合わせる', t: 'ページに合わせる', d: '1ページ全体が入る大きさにします。', fn: function () { S.fit = 'p'; setZoom(fitZoom(), null, null, true); R.scroll.scrollTop = 0; } }),
      rb({ big: 1, i: 'page', l: '100%', t: '100%', d: '実寸（100%）で表示します。', fn: function () { setZoom(1); } })
    ]),
    grp('ウィンドウ', [
      rb({ big: 1, i: 'layers', l: '選択\nウィンドウ', on: S.pane === 'sel', t: '選択ウィンドウ', d: '要素の一覧を開き、名前の変更・表示/非表示・順序の変更ができます。', fn: function () { S.pane === 'sel' ? closePane() : openPane('sel'); } }),
      rb({ big: 1, i: 'panelR', l: '書式設定\nウィンドウ', on: S.pane === 'fmt', t: '書式設定ウィンドウ', d: '選んだ要素の塗りつぶし・線・サイズ・文字の設定を細かく調べます。', fn: function () { S.pane === 'fmt' ? closePane() : openPane('fmt'); } }),
      rb({ big: 1, i: 'thumbs', l: 'サムネイル', on: S.thumbs, t: 'サムネイル', d: '左のページ一覧（生徒ごとの小さな見本）を表示/非表示にします。', fn: function () { S.thumbs = !S.thumbs; saveUI(); drawFrame(); drawThumbs(true); relayout(); drawRibbon(); } })
    ])
  ];
};
function selectAll() { setSel(elems().filter(function (e) { return !e.hidden; }).map(function (e) { return e.id; })); selChanged(); }
function shapeStyleGallery(X1) {
  var dis = !(X1.has('fill') || X1.has('stroke'));
  return gallery(QSTYLES, function (st) { return qsCell(st, dis); }, 5, '');
}
RT.shape = function (X1) {
  var G = geomGroups(X1), fillOn = !!X1.fillKey;
  return [
    grp('図形の挿入', [shapeBtns(), rb({ big: 1, i: 'textbox', l: 'テキスト\nボックス', t: 'テキスト ボックス', d: 'ページ上をドラッグして、文字を入れる枠を描きます。', fn: function () { startDraw('text', TB_DEF); } })]),
    grp('図形のスタイル', [shapeStyleGallery(X1),
      col(rb({ i: 'bucket', l: '図形の塗りつぶし', drop: 1, t: '図形の塗りつぶし', d: '塗りつぶしの色を選びます。', dis: !fillOn, fn: function (e, b) { colorMenu(b, X1.fillKey, '塗りつぶし', '塗りつぶしなし', X1, 'fill'); } }),
        rb({ i: 'pen', l: '図形の枠線', drop: 1, t: '図形の枠線', d: '枠線の色・太さ・種類を選びます。', dis: !X1.lineOk, fn: function (e, b) { lineMenu(b, X1); } }),
        rb({ i: 'drop', l: '透明度', drop: 1, t: '透明度', d: '要素全体の透明度を選びます。', dis: !X1.n, fn: function (e, b) { var v = X1.val('opacity'); openMenu(0, 0, [0, 25, 50, 75].map(function (p) { return { l: p + '%', ck: v != null && Math.round((1 - v) * 100) === p, fn: function () { setProp('opacity', 1 - p / 100); } }; }), b); } }))
    ], { t: '図形の書式設定', d: '右の書式設定を開きます。', fn: function () { openPane('fmt', 'fill', 'shape'); } }),
    grp('文字', [col(
      splitBtn({ i: 'fcolor', t: '文字の色', d: '文字の色を変えます。', dis: !X1.has('color'), color: X1.has('color') ? X1.val('color') || S.lastCol.font : S.lastCol.font, apply: function () { setProp('color', S.lastCol.font); }, pick: function (a) { openColor(a, X1.val('color'), function (v, live) { S.lastCol.font = v; setProp('color', v, live); }, {}); } }),
      rb({ i: X1.val('vertical') ? 'vt' : 'tl', l: '文字列の方向', drop: 1, t: '文字列の方向', d: '横書き・縦書きを選びます。', dis: !X1.has('vertical'), fn: function (e, b) { openMenu(0, 0, [{ l: '横書き', ck: X1.val('vertical') === false, fn: function () { setProp('vertical', false); } }, { l: '縦書き', ck: X1.val('vertical') === true, fn: function () { setProp('vertical', true); } }], b); } }),
      rb({ i: 'vmid', l: '文字の配置', drop: 1, t: '文字の配置（上下）', d: '枠の中での上下の位置を選びます。', dis: !X1.has('valign'), fn: function (e, b) { openMenu(0, 0, [['top', '上揃え', 'vtop'], ['middle', '上下中央揃え', 'vmid'], ['bottom', '下揃え', 'vbot']].map(function (x) { return { l: x[1], ic: x[2], ck: X1.val('valign') === x[0], fn: function () { setProp('valign', x[0]); } }; }), b); } })
    )], { t: '文字のオプション', d: '右の書式設定（文字のオプション）を開きます。', fn: function () { openPane('fmt', 'font', 'text'); } })
  ].concat(G);
};
RT.pic = function (X1) {
  var G = geomGroups(X1), e0 = X1.e0;
  return [
    grp('調整', [rb({ big: 1, i: 'imgchg', l: '図の変更', drop: 1, t: '図の変更', d: '別の画像（このデバイス・素材・地図・ロゴ）に差し替えます。サイズと位置は保たれます。', dis: !X1.one, fn: function (e, b) { imgMenu(b, true); } })]),
    grp('図のスタイル', [col(
      rb({ i: 'image', l: '全体を表示', t: '表示方法：全体を表示', d: '画像全体が枠に収まるように表示します。', on: X1.val('fit') === 'contain', fn: function () { setProp('fit', 'contain'); } }),
      rb({ i: 'fit', l: '枠いっぱいに（切り抜き）', t: '表示方法：枠いっぱいに', d: '枠をすき間なく埋めます（はみ出す部分は切り取られます）。', on: X1.val('fit') === 'cover', fn: function () { setProp('fit', 'cover'); } }),
      lnum('角の丸み', X1.val('radius'), function (v) { setProp('radius', v); }, false, 0, 200)
    )], { t: '図の書式設定', d: '右の書式設定を開きます。', fn: function () { openPane('fmt', 'size', 'shape'); } })
  ].concat(G);
};
RT.tbl = function (X1) {
  var G = geomGroups(X1), e0 = X1.e0;
  function cbtn(key, i, label, d, none) { return rb({ i: i, l: label, drop: 1, t: label, d: d, fn: function (ev, b) { colorMenu(b, key, label, none, X1, null); } }); }
  return [
    grp('表の項目', [rb({ big: 1, i: 'table', l: '項目の選択', drop: 1, t: '表に出す項目', d: '情報テーブルに表示する項目を選びます。', fn: function (ev, b) {
      var p = h('div', 'fe-pophost'); p.style.width = '240px'; p.appendChild(tx('h5', null, '表に出す項目')); var box = h('div', 'fe-its'), items = V().items;
      items.forEach(function (it) { var l = h('label', 'fe-chk'), c = h('input'); c.type = 'checkbox'; c.checked = e0.itemIds.indexOf(it.id) >= 0; c.onchange = function () { var on = {}; box.querySelectorAll('input').forEach(function (x, ix) { on[items[ix].id] = x.checked; }); setProp('itemIds', items.filter(function (x) { return on[x.id]; }).map(function (x) { return x.id; })); }; l.appendChild(c); l.appendChild(document.createTextNode(it.label || '（無題）')); box.appendChild(l); });
      p.appendChild(box); openPop(b, p); } })]),
    grp('罫線と色', [col(cbtn('borderColor', 'pen', '罫線の色', '表の罫線の色を選びます。'), cbtn('labelBg', 'bucket', '項目名の背景', '項目名セルの背景色を選びます。', '背景なし'), cbtn('labelColor', 'fcolor', '項目名の文字色', '項目名の文字の色を選びます。')), col(cbtn('color', 'fcolor', '値の文字色', '値の文字の色を選びます。'))]),
    grp('文字', [col(rrow(sizeCombo(X1.val('size'), function (v) { setProp('size', v); }), rb({ i: 'fontup', t: 'フォント サイズの拡大', fn: function () { stepSize(1); } }), rb({ i: 'fontdown', t: 'フォント サイズの縮小', fn: function () { stepSize(-1); } })),
      lnum('セルの余白', X1.val('rowGap'), function (v) { setProp('rowGap', v); }, false, 0, 30),
      vchk('項目ごとの大きさ', e0.itemSize, function (v) { setProp('itemSize', v); }, '項目ごとの文字サイズを反映\n項目の「小・大・特大」の設定を表に反映します。'))])
  ].concat(G);
};
var lastTabKey = '';
function drawRibbon() {
  var rbn = R.ribbon; if (!rbn) return; var sl = rbn.scrollLeft; rbn.textContent = '';
  if (!S.open || S.ro) return;
  var fn = RT[S.rtab] || RT.home; fn(X()).forEach(function (g1) { rbn.appendChild(g1); });
  tipify(rbn); if (mini) refreshMini(); var key = S.rtab; rbn.scrollLeft = key === lastTabKey ? sl : 0; lastTabKey = key;
}

/* ---------- 項目の内容・プロパティ部品 ---------- */
function prow(label, ctl, wide) { var d = h('div', 'fe-pr'); if (label) d.appendChild(tx('label', null, label)); if (wide || !label) { ctl.classList.add('fe-wide'); } d.appendChild(ctl); return d; }
function propControl(p, es) {
  var e0 = es[0], P = h('div'), same = function (k) { return es.every(function (e) { return e[k] === e0[k]; }); };
  if (p.t === 'font') return prow(p.l, fontCombo(e0.font, setFont, false));
  if (p.t === 'ruby') { var ro = [['', 'なし']].concat(V().items.filter(function (it) { return it.source !== 'schedule' && it.id !== e0.itemId; }).map(function (it) { return [it.id, it.label || '（無題）']; })); return prow(p.l, selInput(ro, e0.ruby || '', function (v) { setProp('ruby', v); })); }
  if (p.t === 'sel') return prow(p.l, selInput(p.opts, e0[p.k], function (v) { setProp(p.k, v); }));
  if (p.t === 'num') { var no = { v: e0[p.k], min: p.min, max: p.max, step: p.step, label: p.l, on: function (v) { setProp(p.k, v); } }, n; if (p.u) { n = h('div', 'fe-nl u'); var ni = numInput(no); n.appendChild(ni); n.appendChild(tx('span', 'fe-u', p.u)); } else n = numInput(no); return prow(p.l, n); }
  if (p.t === 'col') return prow(p.l, swatch(e0[p.k], p.none, function (v, lv) { setProp(p.k, v, lv); }, e0[p.k] === 'accent' ? 'アクセント色' : e0[p.k] === 'secondary' ? 'サブカラー' : (!e0[p.k] || e0[p.k] === 'transparent') ? 'なし' : e0[p.k]));
  if (p.t === 'bold') return chkInput('太字', e0.weight >= 600, function (v) { setBold(v); });
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
function pickUpload(cb) {
  var f = h('input'); f.type = 'file'; f.accept = 'image/*'; f.style.display = 'none'; document.body.appendChild(f);
  f.onchange = function () { var fl = f.files[0]; f.remove(); if (fl) H.resizeImage(fl, cb); };
  f.click();
}
function pageFor(els) {
  var v = JSON.parse(JSON.stringify(V())); v.tpl.free = { bg: '#ffffff', elements: els, guides: [] };
  return JT.render('free', H.students()[0] || H.sample(), JT.mkVals('free', v));
}
function applyLayout(els) {
  if (elems().length && !confirm('今の配置をすべて消して、この配置にしますか？（元に戻すで戻せます）')) return;
  mut(function () { F().elements = els; S.sel = []; }, { label: 'レイアウトの適用' });
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
    H.toast('「' + t.name + '」を自由編集の要素に変換しました（' + r.count + '個）');
  }, function (e) { H.toast('変換できませんでした：' + (e && e.message || e)); });
}
function insertPh(label) {
  var s = '{{' + label + '}}';
  if (S.editing) { document.execCommand('insertText', false, s); return; }
  var es = selEls();
  if (es.length === 1 && es[0].type === 'text' && !es[0].locked) { var e = es[0]; mut(function () { e.text = (e.text ? e.text + '\n' : '') + s; }); return; }
  addEl('text', { text: s, size: 14, w: 90, h: 10, valign: 'middle', name: s });
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
  if (e.type === 'text') { var t = JF.resolveText(e.text, Vv, H.students()[0] || H.sample()).replace(/\s+/g, ' ').trim(); return t ? window.JukenText.cut(t, 13) : '（空のテキスト）'; }
  if (e.type === 'field') { var it = JF.itemById(Vv, e.itemId); return it ? (it.label || '（無題の項目）') : '（項目が未選択）'; }
  if (e.type === 'image') return e.src === 'map' ? '地図' : e.src === 'logo' ? 'ロゴ' : /^assets\//.test(e.src) ? e.src.split('/').pop() : e.src ? '画像' : '画像（未設定）';
  if (e.type === 'rect') return '四角（' + colorName(e.fill) + '）';
  if (e.type === 'ellipse') return '円（' + colorName(e.fill) + '）';
  return JF.TYPE_NAMES[e.type] || e.type;
}
function layerName(e) { return e.name && e.name !== JF.TYPE_NAMES[e.type] ? e.name : autoName(e); }

/* ---------- 右の作業ウィンドウ（書式設定・選択） ---------- */
function ctl(es, k) { var p = schemaFor(es).filter(function (x) { return x.k === k; })[0]; return p ? propControl(p, es) : null; }
function addCtl(b, es, k) { var c = ctl(es, k); if (c) b.appendChild(c); return c; }
function psec(P, key, title, fill) {
  var s = h('div', 'fe-ps' + (S.secs[key] === false ? ' cl' : '')), hd = h('button', 'fe-psh', '<i class="ar"></i><span>' + esc(title) + '</span>'), b = h('div', 'fe-psb');
  s.setAttribute('data-sec', key); hd.type = 'button'; hd.onclick = function () { S.secs[key] = s.classList.contains('cl'); s.classList.toggle('cl'); saveUI(); };
  s.appendChild(hd); s.appendChild(b); P.appendChild(s); fill(b); return s;
}
function schemaFor(es) { var t0 = es[0].type; return (SCHEMA[t0] || []).filter(function (p) { return es.every(function (e) { return p.k in e; }); }); }
function radios(items, cur, on) {
  var d = h('div', 'fe-rad'), nm = 'fer' + Math.random().toString(36).slice(2, 6);
  items.forEach(function (it) { var l = h('label'), r = h('input'); r.type = 'radio'; r.name = nm; r.checked = it[0] === cur; r.onchange = function () { if (r.checked) on(it[0]); }; l.appendChild(r); l.appendChild(document.createTextNode(it[1])); d.appendChild(l); });
  return d;
}
function colLabel(c) { return c === 'accent' ? 'アクセント色' : c === 'secondary' ? 'サブカラー' : (!c || c === 'transparent') ? 'なし' : c; }
function fillSec(b, es, key) {
  var cur = es[0][key], none = !cur || cur === 'transparent';
  b.appendChild(radios([['none', key === 'bg' ? '塗りつぶしなし（透明）' : '塗りつぶしなし'], ['solid', '塗りつぶし（単色）']], none ? 'none' : 'solid', function (v) { setProp(key, v === 'none' ? 'transparent' : (S.lastCol.fill && S.lastCol.fill !== 'transparent' ? S.lastCol.fill : 'secondary')); }));
  if (!none) b.appendChild(prow('色', swatch(cur, false, function (v, lv) { S.lastCol.fill = v; setProp(key, v, lv); }, colLabel(cur))));
  b.appendChild(prow('透明度', rangeNum({ v: Math.round((1 - es[0].opacity) * 100), min: 0, max: 100, step: 1, label: '透明度', on: function (v, live) { setProp('opacity', 1 - v / 100, live); } }), true));
  b.appendChild(tx('p', null, '透明度は要素全体（枠線・文字を含む）にかかります。')).style.cssText = 'margin:2px 0 0;font-size:11px;color:var(--mut)';
}
function lineSec(b, es) {
  var e0 = es[0], ln = e0.type === 'line', none = !ln && (!(e0.strokeWidth > 0) || !e0.stroke || e0.stroke === 'transparent');
  if (!ln) b.appendChild(radios([['none', '線なし'], ['solid', '線（単色）']], none ? 'none' : 'solid', function (v) {
    if (v === 'none') setProp('strokeWidth', 0);
    else mut(function () { es.forEach(function (e) { if ('strokeWidth' in e) { if (!(e.strokeWidth > 0)) e.strokeWidth = 1; if (!e.stroke || e.stroke === 'transparent') e.stroke = 'accent'; } }); }, { label: '枠線の変更' });
  }));
  if (!none) {
    b.appendChild(prow('色', swatch(e0.stroke, false, function (v, lv) { S.lastCol.line = v; setProp('stroke', v, lv); }, colLabel(e0.stroke))));
    addCtl(b, es, 'strokeWidth'); addCtl(b, es, 'dash');
  }
}
function sizeSec(b, es) {
  var one = es.length === 1, e0 = es[0], ln = isLn(e0);
  if (one) {
    var gi = function (label, k, min, max, unit) { return labeledNum(label, { v: e0[k], min: min, max: max, step: 0.1, label: label, on: function (v) { if (e0.locked) { H.toast('ロック中の要素は動かせません'); return; } if (k === 'w' || k === 'h') resizeKey(e0, k, v); else mut(function () { e0[k] = r2(v); }, { label: k === 'rot' ? '回転' : '移動' }); } }, unit); };
    var g1 = h('div', 'fe-g4'); g1.appendChild(gi(ln ? '長さ' : '高さ', ln ? 'w' : 'h', 0.5, 2000, 'mm')); if (!ln) g1.appendChild(gi('幅', 'w', 0.5, 2000, 'mm')); else g1.appendChild(gi('回転', 'rot', -360, 360, '°')); b.appendChild(g1);
    if (!ln) { var g2 = h('div', 'fe-g4'); g2.appendChild(gi('回転', 'rot', -360, 360, '°')); b.appendChild(g2); b.appendChild(chkInput('縦横比を固定する', S.lockAR, function (v) { S.lockAR = v; saveUI(); })); }
    var g3 = h('div', 'fe-g4'); g3.appendChild(gi('位置 X', 'x', -2000, 2000, 'mm')); g3.appendChild(gi('Y', 'y', -2000, 2000, 'mm')); b.appendChild(g3);
  } else { var u = unionBox(es); b.appendChild(tx('p', null, es.length + '個を選択中。範囲：X ' + fmt(u.x) + ' / Y ' + fmt(u.y) + ' / 幅 ' + fmt(u.w) + ' / 高さ ' + fmt(u.h) + '（mm）')).style.margin = '0 0 6px'; }
  var lk = es.every(function (e) { return e.locked; }), hid = es.every(function (e) { return e.hidden; });
  b.appendChild(chkInput('動かせないようにする（ロック）', lk, function (v) { setProp('locked', v); }));
  b.appendChild(chkInput('非表示にする', hid, function (v) { setProp('hidden', v); }));
  if (one) { var nm = h('input'); nm.type = 'text'; nm.value = layerName(e0); nm.setAttribute('aria-label', '要素の名前'); nm.onchange = function () { var v = nm.value.trim(); setProp('name', !v || v === autoName(e0) ? JF.TYPE_NAMES[e0.type] : v); }; b.appendChild(prow('名前', nm)); }
  var bt = h('div', 'fe-two'); bt.style.marginTop = '4px'; bt.appendChild(tbtn('copy', '複製', dupSel)); bt.appendChild(tbtn('trash', '削除', removeSel)); b.appendChild(bt);
}
function drawFmtPane(P) {
  var es = selEls(), e0 = es[0], ty = es.length ? (es.every(function (e) { return e.type === 'image'; }) ? '図の書式設定' : es.every(function (e) { return e.type === 'table'; }) ? 'テーブルの書式設定' : '図形の書式設定') : '背景の書式設定';
  var hd = h('div', 'fe-ph'); hd.appendChild(tx('b', null, ty)); hd.firstChild.style.fontWeight = '600'; hd.appendChild(ibtn('close', tipOf('閉じる', '書式設定ウィンドウを閉じます。'), closePane)); P.appendChild(hd);
  var textTab = es.length && es.every(function (e) { return e.type === 'text' || e.type === 'field'; });
  if (es.length && (textTab || true)) {
    var tb = h('div', 'fe-pt'), mk = function (id, l, icn) { var bt = h('button', S.ptab === id ? 'on' : '', ic(icn) + '<span>' + l + '</span>'); bt.type = 'button'; bt.onclick = function () { S.ptab = id; drawPane(); }; return bt; };
    if (!textTab && S.ptab === 'text') S.ptab = 'shape';
    tb.appendChild(mk('shape', '図形のオプション', 'shape')); if (textTab) tb.appendChild(mk('text', '文字のオプション', 'text')); P.appendChild(tb);
  }
  var pb = h('div', 'fe-pb'); P.appendChild(pb);
  if (!es.length) {
    psec(pb, 'bg', '背景', function (b) {
      b.appendChild(prow('背景色', swatch(F().bg, false, function (v, lv) { F().bg = v || '#ffffff'; H.changed(!lv); lbl('背景の変更'); if (lv) { drawPage(); } else redraw(); }, F().bg)));
      b.appendChild(tx('p', null, '用紙：A4 縦（210 × 297 mm）。要素を選ぶと、その書式がここに出ます。')).style.cssText = 'margin:0;font-size:11px;color:var(--mut)';
    });
    psec(pb, 'pgset', 'ページ設定', function (b) {
      b.appendChild(chkInput('グリッドを表示（5mm）', S.grid, function (v) { S.grid = v; saveUI(); drawOv(); drawRibbon(); }));
      b.appendChild(chkInput('ガイド・他の要素・余白にスナップ', S.snap, function (v) { S.snap = v; saveUI(); }));
      if (F().guides.length) { var gb = tbtn('', 'ガイドをすべて消す', function () { mut(function () { F().guides = []; }, { label: 'ガイドの削除' }); }); gb.style.marginBottom = '6px'; b.appendChild(gb); }
      b.appendChild(tbtn('help', 'ショートカット一覧', showHelp));
    });
    return;
  }
  var t = e0.type, one = es.length === 1;
  if (S.ptab === 'text' && textTab) {
    if (t === 'text' && one) psec(pb, 'content', 'テキスト', function (b) { addCtl(b, es, 'text'); b.appendChild(tx('p', null, '「{{項目名}}」は印刷のとき生徒ごとの値に置き換わります。')).style.cssText = 'margin:0;font-size:11px;color:var(--mut)'; });
    if (t === 'field' && one) {
      psec(pb, 'field', 'フィールド', function (b) { ['itemId', 'showLabel', 'labelText', 'labelPos', 'labelSize', 'labelColor', 'ruby'].concat(e0.ruby ? ['rubyScale'] : []).forEach(function (k) { addCtl(b, es, k); }); var fit = JF.itemById(V(), e0.itemId); if (fit) b.appendChild(itemBox(fit, false)); });
    }
    psec(pb, 'font', 'フォント', function (b) {
      addCtl(b, es, 'font'); addCtl(b, es, 'size');
      var wsv = JFN.weights(e0.font || 'gothic');
      if (e0.font && 'weight' in e0 && wsv.length > 2) b.appendChild(prow('太さ', selInput(wsv.map(function (x) { return [x, JFN.weightLabel(x)]; }), JFN.nearest(e0.font, e0.weight), function (v) { setProp('weight', +v); })));
      var d = h('div'); d.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px';
      var bold = es.every(function (e) { return e.weight >= 600; });
      d.appendChild(seg([['b', 'bold', '太字'], ['i', 'italic', '斜体'], ['u', 'underline', '下線'], ['s', 'strike', '取り消し線']].map(function (x) { return x; }), '', function () { }));
      var sg = d.firstChild; Array.prototype.forEach.call(sg.children, function (btn, i) { var k = ['weight', 'italic', 'underline', 'strike'][i], on = k === 'weight' ? bold : es.every(function (e) { return e[k]; }); btn.classList.toggle('on', on); btn.onclick = function () { if (k === 'weight') setBold(!on); else setProp(k, !on); }; });
      b.appendChild(d); addCtl(b, es, 'color');
    });
    psec(pb, 'para', '段落', function (b) {
      b.appendChild(prow('配置', seg([['left', 'tl', '左揃え'], ['center', 'tc', '中央揃え'], ['right', 'tr', '右揃え'], ['justify', 'tj', '両端揃え']], e0.align, function (v) { setProp('align', v); })));
      addCtl(b, es, 'lineHeight'); addCtl(b, es, 'letterSpacing');
    });
    psec(pb, 'tbox', 'テキスト ボックス', function (b) {
      b.appendChild(prow('上下の配置', seg([['top', 'vtop', '上揃え'], ['middle', 'vmid', '中央揃え'], ['bottom', 'vbot', '下揃え']], e0.valign, function (v) { setProp('valign', v); })));
      addCtl(b, es, 'padding'); addCtl(b, es, 'vertical'); addCtl(b, es, 'fit');
    });
    return;
  }
  /* 図形のオプション */
  if (t === 'table' && one) {
    psec(pb, 'tbl', 'テーブルの項目', function (b) {
      var rit = S.rowSel && S.rowSel.eid === e0.id ? JF.itemById(V(), S.rowSel.iid) : null;
      if (rit) b.appendChild(itemBox(rit, true, e0));
      else b.appendChild(tx('p', null, '表の行をクリックすると、その項目の設定（項目名・入る値・大きさ・色）がここに出ます。値や項目名はダブルクリックでその場で編集できます。')).style.cssText = 'margin:0 0 8px;font-size:11px;color:var(--mut)';
      addCtl(b, es, 'itemIds');
    });
    psec(pb, 'tblfmt', 'テーブルの書式', function (b) { ['borderColor', 'labelBg', 'labelColor', 'color', 'size', 'rowGap', 'itemSize'].forEach(function (k) { addCtl(b, es, k); }); });
  }
  if (es.every(function (e) { return 'fill' in e; })) psec(pb, 'fill', '塗りつぶし', function (b) { fillSec(b, es, 'fill'); });
  else if (es.every(function (e) { return 'bg' in e; })) psec(pb, 'fill', '塗りつぶし', function (b) { fillSec(b, es, 'bg'); });
  if (es.every(function (e) { return 'stroke' in e && 'strokeWidth' in e; })) psec(pb, 'line', '線', function (b) { lineSec(b, es); });
  if (t === 'rect' && es.every(function (e) { return e.type === 'rect'; })) psec(pb, 'shp', '図形', function (b) { addCtl(b, es, 'radius'); });
  if (t === 'image' && one) psec(pb, 'img', '画像', function (b) { ['src', 'fit', 'radius'].forEach(function (k) { addCtl(b, es, k); }); });
  if (t === 'notes' && one) {
    psec(pb, 'notes', '注意事項', function (b) {
      schemaFor(es).forEach(function (p) { if (p.t !== 'hint') b.appendChild(propControl(p, es)); });
      var nta = h('textarea'); nta.rows = 7; nta.value = V().notes; nta.onchange = function () { mut(function () { V().notes = nta.value; }, { label: '注意事項の編集' }); }; b.appendChild(tx('label', null, '本文（1行に1項目。行頭の「!」で強調）')); b.lastChild.style.margin = '6px 0 4px'; b.appendChild(nta);
    });
  }
  if (t === 'fold' && one) psec(pb, 'foldp', '折り線', function (b) { schemaFor(es).forEach(function (p) { b.appendChild(propControl(p, es)); }); });
  if (t === 'field' && one) psec(pb, 'field2', 'フィールド', function (b) { b.appendChild(tx('p', null, '文字の書体・大きさ・色は「文字のオプション」で変更します。')).style.cssText = 'margin:0;font-size:11px;color:var(--mut)'; });
  psec(pb, 'size', 'サイズとプロパティ', function (b) { sizeSec(b, es); });
}
function drawPane() {
  var P = R.pane; if (!P || !S.open) return;
  var old = P.querySelector('.fe-pb'), keep = old ? old.scrollTop : 0, pk = S.sel.join(',') + '|' + (S.rowSel ? S.rowSel.iid : '') + '|' + S.pane + S.ptab;
  if (pk !== S.paneKey) { keep = 0; S.paneKey = pk; }
  P.textContent = ''; if (!S.pane) return;
  if (S.pane === 'sel') drawSelPane(P); else drawFmtPane(P);
  tipify(P);
  var pb = P.querySelector('.fe-pb'); if (!pb) return;
  if (S.scrollTo) { var t = pb.querySelector('[data-sec="' + S.scrollTo + '"]'); if (t) pb.scrollTop = Math.max(0, t.offsetTop - 4); S.scrollTo = ''; } else pb.scrollTop = keep;
}
/* ---------- 選択ウィンドウ ---------- */
function drawSelPane(P) {
  S.hover = '';
  var hd = h('div', 'fe-ph'); hd.appendChild(tx('b', null, '選択')); hd.firstChild.style.fontWeight = '600'; hd.appendChild(ibtn('close', tipOf('閉じる', '選択ウィンドウを閉じます。'), closePane)); P.appendChild(hd);
  var a = elems(), sh = h('div', 'fe-sh');
  sh.appendChild(tbtn('eye', 'すべて表示', function () { mut(function () { a.forEach(function (e) { e.hidden = false; }); }, { label: '表示の変更' }); }));
  sh.appendChild(tbtn('eyeoff', 'すべて非表示', function () { mut(function () { a.forEach(function (e) { e.hidden = true; }); }, { label: '表示の変更' }); }));
  sh.appendChild(h('span', 'fe-sp'));
  var up = ibtn('chevU', tipOf('前面へ移動', '選んだ要素をひとつ前面へ移動します。'), function () { arrange('up'); }), dn = ibtn('chevD', tipOf('背面へ移動', '選んだ要素をひとつ背面へ移動します。'), function () { arrange('down'); });
  up.disabled = dn.disabled = !S.sel.length; sh.appendChild(up); sh.appendChild(dn); P.appendChild(sh);
  var pb = h('div', 'fe-pb'); pb.style.paddingTop = '6px'; P.appendChild(pb);
  if (!a.length) pb.appendChild(tx('p', 'fe-pn', '要素がありません。「挿入」タブから追加してください。'));
  for (var i = a.length - 1; i >= 0; i--) (function (e) {
    var r = h('div', 'fe-lay' + (S.sel.indexOf(e.id) >= 0 ? ' on' : '') + (e.hidden ? ' hid' : '') + (e.groupId ? ' ing' : '')); r.setAttribute('data-id', e.id); r.draggable = true;
    r.appendChild(h('span', 'fe-ty', ic(e.groupId ? 'group' : TYPE_ICON[e.type])));
    var nm = tx('span', 'fe-ln', layerName(e)); nm.setAttribute('data-tip', layerName(e) + '\nダブルクリックで名前を変更できます。'); r.appendChild(nm);
    var ey = ibtn(e.hidden ? 'eyeoff' : 'eye', tipOf(e.hidden ? '表示する' : '非表示にする', ''), function (ev) { ev.stopPropagation(); mut(function () { e.hidden = !e.hidden; }, { label: '表示の変更' }); });
    var lk = ibtn(e.locked ? 'lock' : 'unlock', tipOf(e.locked ? 'ロックを解除' : 'ロック', '動かせないようにします。'), function (ev) { ev.stopPropagation(); mut(function () { e.locked = !e.locked; }, { label: 'ロックの変更' }); }, e.locked ? 'on' : '');
    r.appendChild(ey); r.appendChild(lk);
    r.onmouseenter = function () { if (S.hover !== e.id) { S.hover = e.id; drawOv(); } };
    r.onmouseleave = function () { if (S.hover === e.id) { S.hover = ''; drawOv(); } };
    r.onclick = function (ev) { if (ev.shiftKey || ev.ctrlKey || ev.metaKey) { var s = S.sel.slice(), k = s.indexOf(e.id); if (k >= 0) s.splice(k, 1); else s.push(e.id); setSel(s); } else { if (S.sel.length === 1 && S.sel[0] === e.id) return; setSel([e.id]); } selChanged(); };
    nm.ondblclick = function (ev) {
      ev.stopPropagation(); var inp = h('input'); inp.type = 'text'; inp.value = layerName(e); inp.style.margin = '0 4px'; r.replaceChild(inp, nm); inp.focus(); inp.select(); var done = false;
      function fin(ok) { if (done) return; done = true; var v = inp.value.trim(); if (ok && v && v !== layerName(e)) mut(function () { e.name = v; }, { label: '名前の変更' }); else drawPane(); }
      inp.onblur = function () { fin(true); }; inp.onkeydown = function (k) { k.stopPropagation(); if (k.key === 'Enter') { k.preventDefault(); fin(true); } else if (k.key === 'Escape') { k.preventDefault(); fin(false); } }; inp.onclick = function (k) { k.stopPropagation(); };
    };
    r.ondragstart = function (ev) { layDrag = e.id; ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', e.id); } catch (x) {} };
    r.ondragover = function (ev) { if (!layDrag) return; ev.preventDefault(); var b = r.getBoundingClientRect(), after = ev.clientY > b.top + b.height / 2; r.classList.toggle('dt-a', after); r.classList.toggle('dt-b', !after); };
    r.ondragleave = function () { r.classList.remove('dt-a', 'dt-b'); };
    r.ondrop = function (ev) { ev.preventDefault(); var b = r.getBoundingClientRect(), after = ev.clientY > b.top + b.height / 2, f = layDrag; layDrag = ''; r.classList.remove('dt-a', 'dt-b'); if (f) reorder(f, e.id, after); };
    r.ondragend = function () { layDrag = ''; Array.prototype.forEach.call(pb.querySelectorAll('.dt-a,.dt-b'), function (x) { x.classList.remove('dt-a', 'dt-b'); }); };
    pb.appendChild(r);
  })(a[i]);
}

/* ---------- ポインタ操作 ---------- */
function pageXY(ev) { var r = R.box.getBoundingClientRect(), s = sz(); return { x: (ev.clientX - r.left) / s, y: (ev.clientY - r.top) / s }; }
function blurActive() { var a = document.activeElement; if (a && a !== document.body && root.contains(a) && a.blur && !S.editing) a.blur(); }
function snapTargets(excl) {
  var xs = [0, PW / 2, PW, 10, PW - 10], ys = [0, PH / 2, PH, 10, PH - 10];   /* ページの端・中央・余白(10mm) */
  if (S.guides) F().guides.forEach(function (g) { (g.axis === 'x' ? xs : ys).push(g.pos); });
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
/* ドラッグ中、上下左右でいちばん近い要素までの距離（mm）。raw=trueなら生の近傍を返す。左右（上下）の距離が等しいときは eq=true（等間隔） */
function neighbours(b, excl, raw) {
  var best = {};
  elems().forEach(function (e) {
    if (e.hidden || excl.indexOf(e.id) >= 0 || e.type === 'line' || e.type === 'fold') return;
    var a = JF.aabb(e), oy = Math.min(b.b, a.b) - Math.max(b.y, a.y), ox = Math.min(b.r, a.r) - Math.max(b.x, a.x), g;
    if (oy > 0.5) { if (a.r <= b.x + 0.01) { g = b.x - a.r; if (!best.l || g < best.l.g) best.l = { g: g, a: a }; } if (a.x >= b.r - 0.01) { g = a.x - b.r; if (!best.r || g < best.r.g) best.r = { g: g, a: a }; } }
    if (ox > 0.5) { if (a.b <= b.y + 0.01) { g = b.y - a.b; if (!best.t || g < best.t.g) best.t = { g: g, a: a }; } if (a.y >= b.b - 0.01) { g = a.y - b.b; if (!best.d || g < best.d.g) best.d = { g: g, a: a }; } }
  });
  if (raw) return best;
  var out = [], eqx = best.l && best.r && Math.abs(best.l.g - best.r.g) < 0.1, eqy = best.t && best.d && Math.abs(best.t.g - best.d.g) < 0.1;
  function my(a) { return (Math.max(b.y, a.y) + Math.min(b.b, a.b)) / 2; } function mx(a) { return (Math.max(b.x, a.x) + Math.min(b.r, a.r)) / 2; }
  if (best.l && best.l.g > 0.2) { var y1 = my(best.l.a); out.push({ x1: best.l.a.r, y1: y1, x2: b.x, y2: y1, v: best.l.g, eq: eqx }); }
  if (best.r && best.r.g > 0.2) { var y2 = my(best.r.a); out.push({ x1: b.r, y1: y2, x2: best.r.a.x, y2: y2, v: best.r.g, eq: eqx }); }
  if (best.t && best.t.g > 0.2) { var x1 = mx(best.t.a); out.push({ x1: x1, y1: best.t.a.b, x2: x1, y2: b.y, v: best.t.g, eq: eqy }); }
  if (best.d && best.d.g > 0.2) { var x2 = mx(best.d.a); out.push({ x1: x2, y1: b.b, x2: x2, y2: best.d.a.y, v: best.d.g, eq: eqy }); }
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
/* ---------- 右クリックメニュー（PowerPoint 風） ---------- */
function onCtxMenu(ev) {
  if (S.preview || S.ro) return; ev.preventDefault(); if (S.editing) return; closePop(); hideMini();
  var ids = underPoint(ev);
  if (ids.length && S.sel.indexOf(ids[0]) < 0) { setSel(expandGroups([ids[0]])); selChanged(); } else if (!ids.length && S.sel.length) { setSel([]); selChanged(); }
  ctxMenuAt(ev.clientX, ev.clientY, ids);
}
function ctxMenuAt(x, y, ids) {
  var has = S.sel.length > 0, es = selEls(), X1 = X(), lk = has && es.every(function (e) { return e.locked; }), n = X1.n, one = es.length === 1;
  var editable = one && ['text', 'field', 'table', 'notes'].indexOf(es[0].type) >= 0 && !es[0].locked, hasGrp = es.some(function (e) { return e.groupId; });
  var items = [
    { l: '切り取り', k: 'Ctrl+X', ic: 'cut', dis: !has, fn: cutSel }, { l: 'コピー', k: 'Ctrl+C', ic: 'copy', dis: !has, fn: function () { copySel(); } },
    { l: '貼り付けのオプション', ic: 'paste', dis: !(S.clip && S.clip.length) && !S.fpStore, sub: [{ l: '貼り付け', k: 'Ctrl+V', dis: !(S.clip && S.clip.length), fn: pasteSel }, { l: '書式のみ貼り付け', k: 'Ctrl+Shift+V', dis: !S.fpStore || !has, fn: function () { fpApply(S.sel, S.fpStore); } }] },
    { l: '複製', k: 'Ctrl+D', dis: !has, fn: dupSel }, { l: '削除', k: 'Delete', ic: 'trash', dis: !has, fn: removeSel }, '-',
    { l: 'テキストの編集', k: 'F2', dis: !editable, fn: function () { activateAt(es[0], null); } }, '-',
    { l: 'グループ化', ic: 'group', dis: !has, sub: [{ l: 'グループ化', k: 'Ctrl+G', dis: n < 2, fn: groupSel }, { l: 'グループ解除', k: 'Ctrl+Shift+G', dis: !hasGrp, fn: ungroupSel }] },
    { l: '最前面へ移動', ic: 'front', dis: !has, sub: [{ l: '最前面へ移動', fn: function () { arrange('front'); } }, { l: '前面へ移動', k: 'Ctrl+]', fn: function () { arrange('up'); } }] },
    { l: '最背面へ移動', ic: 'back', dis: !has, sub: [{ l: '最背面へ移動', fn: function () { arrange('back'); } }, { l: '背面へ移動', k: 'Ctrl+[', fn: function () { arrange('down'); } }] },
    { l: '配置', ic: 'al', dis: !has, sub: [
      { l: '左揃え', ic: 'al', fn: function () { alignSel('l'); } }, { l: '左右中央揃え', ic: 'ac', fn: function () { alignSel('c'); } }, { l: '右揃え', ic: 'ar', fn: function () { alignSel('r'); } },
      { l: '上揃え', ic: 'at', fn: function () { alignSel('t'); } }, { l: '上下中央揃え', ic: 'am', fn: function () { alignSel('m'); } }, { l: '下揃え', ic: 'ab', fn: function () { alignSel('b'); } }, '-',
      { l: '左右に整列（3個以上）', ic: 'dh', dis: n < 3, fn: function () { distribute('h'); } }, { l: '上下に整列（3個以上）', ic: 'dv', dis: n < 3, fn: function () { distribute('v'); } }, '-',
      { l: 'ページの左右中央に配置', fn: function () { centerPage('h'); } }, { l: 'ページの上下中央に配置', fn: function () { centerPage('v'); } }] },
    { l: lk ? 'ロックを解除' : 'ロック', ic: lk ? 'lock' : 'unlock', dis: !has, fn: function () { setProp('locked', !lk); } }, '-',
    { l: '図形の書式設定…', ic: 'panelR', dis: !has, fn: function () { openPane('fmt', 'fill', 'shape'); } },
    { l: '下の要素を選択', k: 'Alt+クリック', dis: ids.length < 2, fn: function () { var ci = S.sel.length === 1 ? ids.indexOf(S.sel[0]) : -1; setSel([ids[(ci + 1) % ids.length]]); selChanged(); } }
  ];
  var m = openMenu(x, y, items);
  if (has && es.every(function (e) { return 'font' in e; })) { var r = m.getBoundingClientRect(); showMini(r.left, r.top - 4); }
}
function onDown(ev) {
  if (S.preview || S.ro || ev.button !== 0) return;
  var t = ev.target, vr = R.scroll.getBoundingClientRect();
  if (ev.clientX > vr.left + R.scroll.clientWidth || ev.clientY > vr.top + R.scroll.clientHeight) return;
  if (S.editing) { if (S.editing.node.contains(t)) return; finishEdit(true); }
  closePop(); hideMini(); blurActive();
  if (S.draw) return startDrawDrag(ev);
  var hd = t.closest && t.closest('[data-h]');
  if (hd && R.ov.contains(hd)) return startHandle(ev, hd.getAttribute('data-h'));
  var gd = t.closest && t.closest('.fe-guide'); if (gd) return startGuide(ev, +gd.getAttribute('data-gi'));
  var rl = t.closest && t.closest('.fe-ruler'); if (rl) return startGuide(ev, -1, rl.getAttribute('data-axis'));
  var nd = t.closest && t.closest('[data-eid]');
  if (S.fp) {
    if (nd && R.pg.contains(nd)) { fpApply([nd.getAttribute('data-eid')], S.fp); if (!S.fpSticky) { S.fp = null; } drawFrame(); drawRibbon(); }
    return;
  }
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
  var was = S.sel.indexOf(id) >= 0, raw = tg === null, cell = tg && tg.closest && tg.closest('.fz-tc'), tn = nodeOf(id);
  S.rowSel = (e.type === 'table' && cell && tn && tn.contains(cell) && !ev.shiftKey) ? { eid: id, iid: cell.getAttribute('data-item') } : null;
  var grp = raw ? [id] : expandGroups([id]);
  if (ev.shiftKey) {
    var s = S.sel.slice();
    if (was) { s = s.filter(function (x) { return grp.indexOf(x) < 0; }); setSel(s); selChanged(); return; }
    grp.forEach(function (x) { if (s.indexOf(x) < 0) s.push(x); }); setSel(s); selChanged();
  } else if (!was) { setSel(grp); selChanged(); }
  else if (S.rowSel) selChanged();
  var mv = selEls().filter(function (x) { return !x.locked; });
  drag = { mode: 'move', sx: ev.clientX, sy: ev.clientY, moved: false, id: id, shift: ev.shiftKey, ctrl: ev.ctrlKey || ev.metaKey, wasSel: was, els: mv, orig: mv.map(function (x) { return { e: x, x: x.x, y: x.y }; }), bbox: unionBox(mv), lines: [], targets: snapTargets(mv.map(function (x) { return x.id; })), ov: null };
  if (!mv.length) drag.mode = 'click';
  cap(ev);
}
function startHandle(ev, hn) {
  var sel = selEls().filter(function (x) { return !x.locked; }); if (!sel.length) return;
  var s = sz(), br = R.box.getBoundingClientRect();
  if (S.sel.length > 1) {
    var u0 = unionBox(sel), items = sel.map(function (x) { return { e: x, c: ctrOf(x), w: x.w, h: x.h, rot: x.rot || 0, rot0: x.rot || 0 }; });
    if (hn === 'rot') {
      var cx = br.left + u0.cx * s, cy = br.top + u0.cy * s;
      drag = { mode: 'rotm', items: items, u0: u0, cx: cx, cy: cy, a0: Math.atan2(ev.clientY - cy, ev.clientX - cx), moved: false, tip: '' };
    } else {
      var p0 = pageXY(ev), hx = { nw: -1, n: 0, ne: 1, e: 1, se: 1, s: 0, sw: -1, w: -1 }[hn], hy = { nw: -1, n: -1, ne: -1, e: 0, se: 1, s: 1, sw: 1, w: 0 }[hn];
      drag = { mode: 'rsm', items: items, u0: u0, hx: hx, hy: hy, offx: hx ? (hx > 0 ? u0.r : u0.x) - p0.x : 0, offy: hy ? (hy > 0 ? u0.b : u0.y) - p0.y : 0, moved: false, tip: '' };
    }
    cap(ev); return;
  }
  var e = sel[0], q = JF.geom(e);
  if (hn === 'rot') {
    var cx2 = br.left + (q.x + q.w / 2) * s, cy2 = br.top + (q.y + q.h / 2) * s;
    drag = { mode: 'rot', e: e, cx: cx2, cy: cy2, a0: Math.atan2(ev.clientY - cy2, ev.clientX - cx2), r0: e.rot || 0, moved: false, tip: '' };
  } else {
    var p1 = pageXY(ev), hx1 = { nw: -1, n: 0, ne: 1, e: 1, se: 1, s: 0, sw: -1, w: -1 }[hn], hy1 = { nw: -1, n: -1, ne: -1, e: 0, se: 1, s: 1, sw: 1, w: 0 }[hn];
    drag = { mode: 'rs', e: e, hn: hn, hx: hx1, hy: hy1, q0: { x: q.x, y: q.y, w: q.w, h: q.h }, rot: e.rot || 0, p0: p1, offx: (hx1 > 0 ? q.x + q.w : q.x) - p1.x, offy: (hy1 > 0 ? q.y + q.h : q.y) - p1.y, moved: false, lines: [], targets: snapTargets([e.id]), tip: '', line: e.type === 'line' || e.type === 'fold' };
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
  if (idx < 0) { if (!S.guides) { S.guides = true; saveUI(); drawFrame(); } gs.push({ axis: axis, pos: axis === 'x' ? pageXY(ev).x : pageXY(ev).y }); idx = gs.length - 1; }
  drag = { mode: 'guide', gi: idx, axis: gs[idx].axis, moved: false, sx: ev.clientX, sy: ev.clientY, isNew: axis != null };
  cap(ev); drawOv();
}
/* 描画モード（テキスト ボックス・図形）：ドラッグで描く／クリックだけなら既定の大きさで挿入 */
function startDrawDrag(ev) {
  var p = pageXY(ev), d = S.draw;
  drag = { mode: 'draw', type: d.type, props: d.props, p0: p, a: p, rect: { x: p.x, y: p.y, w: 0, h: 0 }, len: 0, ang: 0, moved: false, sx: ev.clientX, sy: ev.clientY };
  cap(ev);
}
function onMove(ev) {
  if (!drag) { onHover(ev); return; }
  var s = sz(), d = drag;
  if (d.mode === 'click') return;
  if (d.mode === 'draw') {
    if (!d.moved && Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) < 4) return; d.moved = true;
    var p = pageXY(ev), p0 = d.p0;
    if (d.type === 'line') {
      var dx0 = p.x - p0.x, dy0 = p.y - p0.y, ang = Math.atan2(dy0, dx0) * 180 / Math.PI, len = Math.hypot(dx0, dy0);
      if (ev.shiftKey) { ang = Math.round(ang / 15) * 15; var rr = ang * Math.PI / 180; d.pEnd = { x: p0.x + len * Math.cos(rr), y: p0.y + len * Math.sin(rr) }; } else d.pEnd = p;
      d.ang = ang; d.len = len; d.a = p0; d.tip = '長さ ' + fmt(len) + ' mm';
    } else {
      var w = Math.abs(p.x - p0.x), hh = Math.abs(p.y - p0.y);
      if (ev.shiftKey && d.type !== 'text') { var m = Math.max(w, hh); w = hh = m; }
      var x0 = p.x < p0.x ? p0.x - w : p0.x, y0 = p.y < p0.y ? p0.y - hh : p0.y; d.rect = { x: x0, y: y0, w: w, h: hh }; d.tip = fmt(w) + ' × ' + fmt(hh) + ' mm';
    }
    drawOv(); return;
  }
  if (d.mode === 'move') {
    var rx = ev.clientX - d.sx, ry = ev.clientY - d.sy;
    if (!d.moved && Math.hypot(rx, ry) < 3) return;
    if (!d.moved && d.ctrl && !d.shift) {   /* Ctrl+ドラッグ：複製を動かす */
      var cs = cloneEls(d.els, 0, 0); lbl('複製'); d.dup = true;
      cs.forEach(function (c) { elems().push(c); }); setSel(cs.map(function (c) { return c.id; }));
      d.els = cs; d.orig = cs.map(function (x) { return { e: x, x: x.x, y: x.y }; }); d.bbox = unionBox(cs); d.targets = snapTargets(cs.map(function (x) { return x.id; })); drawPage();
    }
    d.moved = true;
    var dx = rx / s, dy = ry / s, b = d.bbox, thr = 6 / s, lines = [], ids = d.els.map(function (x) { return x.id; });
    if (ev.shiftKey) { if (Math.abs(rx) > Math.abs(ry)) dy = 0; else dx = 0; }
    var sx = null, sy = null;
    if (!ev.altKey && S.snap) {
      var cx = [b.x + dx, b.cx + dx, b.r + dx], cy = [b.y + dy, b.cy + dy, b.b + dy]; sx = bestSnap(cx, d.targets.xs, thr); sy = bestSnap(cy, d.targets.ys, thr);
      if (sx === null && S.grid) { var gx = Math.round((b.x + dx) / 5) * 5 - (b.x + dx); if (Math.abs(gx) <= thr) sx = gx; }
      if (sy === null && S.grid) { var gy = Math.round((b.y + dy) / 5) * 5 - (b.y + dy); if (Math.abs(gy) <= thr) sy = gy; }
      if (sx !== null) { dx += sx; linesAt(cx, d.targets.xs, sx).forEach(function (p) { lines.push({ axis: 'x', pos: p }); }); }
      if (sy !== null) { dy += sy; linesAt(cy, d.targets.ys, sy).forEach(function (p) { lines.push({ axis: 'y', pos: p }); }); }
      /* 等間隔：左右（上下）の隣の要素までの距離が同じになる位置に吸着 */
      var nb = neighbours({ x: b.x + dx, y: b.y + dy, r: b.r + dx, b: b.b + dy }, ids, true);
      if (sx === null && nb.l && nb.r) { var ex = (nb.r.g - nb.l.g) / 2; if (Math.abs(ex) <= thr) dx += ex; }
      if (sy === null && nb.t && nb.d) { var ey = (nb.d.g - nb.t.g) / 2; if (Math.abs(ey) <= thr) dy += ey; }
    }
    d.lines = lines;
    d.orig.forEach(function (o) { o.e.x = r2(o.x + dx); o.e.y = r2(o.y + dy); nodeGeom(o.e); });
    d.tip = 'X ' + fmt(b.x + dx) + '  Y ' + fmt(b.y + dy) + ' mm';
    d.dists = neighbours({ x: b.x + dx, y: b.y + dy, r: b.r + dx, b: b.b + dy }, ids); drawOv(); return;
  }
  if (d.mode === 'rot') {
    d.moved = true; var a = Math.atan2(ev.clientY - d.cy, ev.clientX - d.cx), deg = d.r0 + (a - d.a0) * 180 / Math.PI;
    if (ev.shiftKey) deg = Math.round(deg / 15) * 15; d.e.rot = normRot(deg);
    nodeGeom(d.e); d.tip = fmt(d.e.rot) + '°'; drawOv(); return;
  }
  if (d.mode === 'rotm') {
    d.moved = true; var a2 = Math.atan2(ev.clientY - d.cy, ev.clientX - d.cx), dg = (a2 - d.a0) * 180 / Math.PI;
    if (ev.shiftKey) dg = Math.round(dg / 15) * 15;
    var r = dg * Math.PI / 180, co = Math.cos(r), si = Math.sin(r), u = d.u0;
    d.items.forEach(function (o) { var ddx = o.c.x - u.cx, ddy = o.c.y - u.cy; setCtr(o.e, u.cx + ddx * co - ddy * si, u.cy + ddx * si + ddy * co); o.e.rot = normRot(o.rot0 + dg); nodeGeom(o.e); });
    d.tip = fmt(dg) + '°'; drawOv(); return;
  }
  if (d.mode === 'rs') { resizeMove(ev, d); return; }
  if (d.mode === 'rsm') { resizeMulti(ev, d); return; }
  if (d.mode === 'mq') {
    if (!d.moved && Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) < 3) return; d.moved = true;
    var q = pageXY(ev), mx0 = Math.min(q.x, d.p0.x), my0 = Math.min(q.y, d.p0.y), mx1 = Math.max(q.x, d.p0.x), my1 = Math.max(q.y, d.p0.y); d.rect = { x: mx0, y: my0, w: mx1 - mx0, h: my1 - my0 };
    var hit = elems().filter(function (e) { if (e.hidden) return false; var qq = JF.aabb(e); return qq.x < mx1 && qq.r > mx0 && qq.y < my1 && qq.b > my0; }).map(function (e) { return e.id; });
    setSel(d.base.concat(expandGroups(hit))); drawOv(); return;
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
  if ((ev.shiftKey || (S.lockAR && e.type === 'image')) && hx && hy && q0.w > 0 && q0.h > 0) { var k = Math.max(nw / q0.w, nh / q0.h); nw = q0.w * k; nh = q0.h * k; }
  else if (S.lockAR && hx && hy && q0.w > 0 && q0.h > 0) { var k2 = Math.max(nw / q0.w, nh / q0.h); nw = q0.w * k2; nh = q0.h * k2; }
  var ox = hx * nw / 2, oy = hy * nh / 2, ncx = awx + ox * co - oy * si, ncy = awy + ox * si + oy * co;
  var nx = ncx - nw / 2, ny = ncy - nh / 2;
  if (d.line) { e.x = r2(nx); e.y = r2(ny + 1.5); e.w = r2(nw); } else { e.x = r2(nx); e.y = r2(ny); e.w = r2(nw); e.h = r2(nh); }
  d.lines = lines; nodeGeom(e); d.tip = fmt(e.w) + ' × ' + fmt(d.line ? 0 : e.h) + ' mm'; if (d.line) d.tip = '長さ ' + fmt(e.w) + ' mm';
  drawOv();
  if (e.type === 'text' || e.type === 'field' || e.type === 'notes' || e.type === 'table') { var pn = S.page; if (pn) { clearTimeout(d._ft); d._ft = setTimeout(function () { if (drag === d) { drawPage(); drawOv(); } }, 60); } }
}
/* 複数選択（グループ）をまとめて拡大縮小 */
function resizeMulti(ev, d) {
  d.moved = true; var p = pageXY(ev), u0 = d.u0, hx = d.hx, hy = d.hy, px = p.x + d.offx, py = p.y + d.offy, min = 2;
  var nx0 = u0.x, ny0 = u0.y, nw = u0.w, nh = u0.h;
  if (hx > 0) nw = Math.max(min, px - u0.x); else if (hx < 0) { nw = Math.max(min, u0.r - px); nx0 = u0.r - nw; }
  if (hy > 0) nh = Math.max(min, py - u0.y); else if (hy < 0) { nh = Math.max(min, u0.b - py); ny0 = u0.b - nh; }
  if ((ev.shiftKey || S.lockAR) && hx && hy && u0.w > 0 && u0.h > 0) { var k = Math.max(nw / u0.w, nh / u0.h); nw = u0.w * k; nh = u0.h * k; if (hx < 0) nx0 = u0.r - nw; if (hy < 0) ny0 = u0.b - nh; }
  var sx = u0.w > 0 ? nw / u0.w : 1, sy = u0.h > 0 ? nh / u0.h : 1;
  d.items.forEach(function (o) {
    var e = o.e, cx = nx0 + (o.c.x - u0.x) * sx, cy = ny0 + (o.c.y - u0.y) * sy, th = o.rot * Math.PI / 180, co = Math.cos(th), si = Math.sin(th);
    var kw = Math.sqrt(sx * co * sx * co + sy * si * sy * si), kh = Math.sqrt(sx * si * sx * si + sy * co * sy * co);
    e.w = r2(Math.max(0.5, o.w * kw)); if (!isLn(e)) e.h = r2(Math.max(0.5, o.h * kh)); setCtr(e, cx, cy); nodeGeom(e);
  });
  d.tip = fmt(nw) + ' × ' + fmt(nh) + ' mm'; drawOv();
  clearTimeout(d._ft); d._ft = setTimeout(function () { if (drag === d) { drawPage(); drawOv(); } }, 60);
}
function onUp(ev) {
  if (!drag) return; var d = drag; drag = null; clearTimeout(d._ft);
  try { R.scroll.releasePointerCapture(ev.pointerId); } catch (e) {}
  if (d.mode === 'draw') { finishDraw(d); return; }
  if (d.mode === 'move') {
    if (d.moved) { lbl(d.dup ? '複製' : '移動'); H.changed(true); redraw(); }
    else { if (!d.shift && S.sel.length > 1 && d.wasSel) { setSel([d.id]); } selChanged(); }
    return;
  }
  if (d.mode === 'click') { selChanged(); return; }
  if (d.mode === 'rot' || d.mode === 'rs' || d.mode === 'rotm' || d.mode === 'rsm') { if (d.moved) { lbl(d.mode === 'rot' || d.mode === 'rotm' ? '回転' : 'サイズ変更'); H.changed(true); redraw(); } else drawOv(); return; }
  if (d.mode === 'mq') { selChanged(); return; }
  if (d.mode === 'guide') {
    var g = F().guides[d.gi]; var lim = d.axis === 'x' ? PW : PH;
    if (g && (g.pos < 0 || g.pos > lim || (d.isNew && !d.moved))) F().guides.splice(d.gi, 1);
    lbl('ガイドの変更'); H.changed(true); drawOv(); drawPane();
  }
}
function finishDraw(d) {
  var pr = Object.assign({}, d.props), e;
  if (d.moved) {
    if (d.type === 'line') { var pe = d.pEnd || d.p0, len = Math.max(2, d.len), cx = (d.p0.x + pe.x) / 2, cy = (d.p0.y + pe.y) / 2; pr.w = r2(len); pr.x = r2(cx - len / 2); pr.y = r2(cy); pr.rot = normRot(d.ang); }
    else { pr.x = r2(d.rect.x); pr.y = r2(d.rect.y); pr.w = r2(Math.max(3, d.rect.w)); pr.h = r2(Math.max(3, d.rect.h)); }
  } else if (d.type === 'line') { pr.x = r2(d.p0.x - (pr.w || 60) / 2); pr.y = r2(d.p0.y); }
  else { pr.x = r2(d.p0.x - (pr.w || 40) / 2); pr.y = r2(d.p0.y - (pr.h || 20) / 2); }
  e = addEl(d.type, pr); drawStat(); drawRibbon();
  if (e && e.type === 'text') startEdit(find(e.id));
}
function edgeHit(ev, nd) {
  var r = nd.getBoundingClientRect(), dx = Math.min(ev.clientX - r.left, r.right - ev.clientX), dy = Math.min(ev.clientY - r.top, r.bottom - ev.clientY);
  return Math.min(dx, dy) <= 5;
}
function onDbl(ev) {
  if (S.preview || S.ro || S.draw || S.fp) return;
  var tg = document.elementFromPoint(ev.clientX, ev.clientY) || ev.target;
  var gd = tg.closest && tg.closest('.fe-guide'); if (gd) { F().guides.splice(+gd.getAttribute('data-gi'), 1); lbl('ガイドの削除'); H.changed(true); drawOv(); return; }
  var nd = tg.closest && tg.closest('[data-eid]'); if (!nd || !R.pg.contains(nd)) return;
  var e = find(nd.getAttribute('data-eid')); if (!e) return;
  var shapeish = ['rect', 'ellipse', 'line', 'fold'].indexOf(e.type) >= 0;
  if (shapeish || edgeHit(ev, nd)) { var ct = ctxTabIds(); if (ct.indexOf('shape') >= 0) S.rtab = 'shape'; drawTabs(); drawRibbon(); openPane('fmt', 'fill', 'shape'); return; }
  if (e.type === 'image') { S.rtab = 'pic'; drawTabs(); drawRibbon(); return; }
  if (e.locked) return;
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
  drawOv(); if (ed.cls === 'fz-editing') { var br0 = nd.getBoundingClientRect(); showMini(br0.left, br0.top - 6); }
}
function finishEdit(commit) {
  var ed = S.editing; if (!ed) return; S.editing = null; hideMini(); lbl('文字の編集');
  var t = ed.node; t.onblur = null; t.onkeydown = null; t.onpaste = null; t.contentEditable = 'false';
  var txt = (t.innerText || t.textContent || '').replace(/\r/g, '').replace(/ /g, ' ').replace(/\n$/, '');
  if (ed.single) txt = txt.replace(/\n/g, ' ');
  if (ed.commit) { if (commit && txt !== ed.orig) mut(function () { ed.commit(txt); }); else redraw(); return; }
  var e = find(ed.id);
  if (commit && e && txt !== ed.orig) mut(function () { e.text = txt; }); else redraw();
}

/* ---------- 差し込みフィールドの行（ポップアップ内） ---------- */
function itemRow(label, it) {
  var d = h('div', 'fe-fld'), b = h('button', 'fi', '<span>' + esc(label) + '</span>'); b.type = 'button';
  b.setAttribute('data-tip', it ? tipOf(label, 'この項目の値を表示する要素を追加します。') : tipOf('{{' + label + '}}', '文字として追加します（文字の中に混ぜて使えます）。'));
  b.onclick = function () { closePop(); if (it) addEl('field', { itemId: it.id, size: 18 }); else insertPh(label); };
  d.appendChild(b); var p = h('button', 'fb', '{}'); p.type = 'button'; p.setAttribute('data-tip', tipOf('{{' + label + '}} を文字として挿入', '選んでいる文字（または編集中の文字）に差し込みます。'));
  p.onclick = function () { closePop(); insertPh(label); }; d.appendChild(p); return d;
}

/* ---------- ミニ ツール バー（文字を編集中・右クリックで出る小さな書式バー） ---------- */
var miniPos = null;
function hideMini() { if (mini) { mini.remove(); mini = null; } miniPos = null; }
function showMini(x, y) { miniPos = { x: x, y: y }; refreshMini(); }
function refreshMini() {
  if (!miniPos) return; var es = selEls();
  if (!es.length || !es.every(function (e) { return 'font' in e; })) { if (mini) { mini.remove(); mini = null; } return; }
  var X1 = X(), has = X1.has, m = h('div', 'fe-mini'), bold = X1.val('weight') >= 600, al = X1.val('align');
  m.appendChild(fontCombo(X1.val('font'), setFont, false)); m.appendChild(sizeCombo(X1.val('size'), function (v) { setProp('size', v); }, false));
  m.appendChild(rb({ i: 'fontup', t: 'フォント サイズの拡大', k: 'Ctrl+Shift+>', fn: function () { stepSize(1); } })); m.appendChild(rb({ i: 'fontdown', t: 'フォント サイズの縮小', k: 'Ctrl+Shift+<', fn: function () { stepSize(-1); } }));
  m.appendChild(rb({ i: 'bold', t: '太字', k: 'Ctrl+B', on: bold, fn: function () { setBold(!bold); } }));
  m.appendChild(rb({ i: 'italic', t: '斜体', k: 'Ctrl+I', on: X1.val('italic') === true, fn: function () { setProp('italic', X1.val('italic') !== true); } }));
  m.appendChild(rb({ i: 'underline', t: '下線', k: 'Ctrl+U', on: X1.val('underline') === true, fn: function () { setProp('underline', X1.val('underline') !== true); } }));
  m.appendChild(splitBtn({ i: 'fcolor', t: '文字の色', color: X1.val('color') || S.lastCol.font, apply: function () { setProp('color', S.lastCol.font); }, pick: function (a) { openColor(a, X1.val('color'), function (v, live) { S.lastCol.font = v; setProp('color', v, live); }, {}); } }));
  [['left', 'tl', '左揃え', 'Ctrl+L'], ['center', 'tc', '中央揃え', 'Ctrl+E'], ['right', 'tr', '右揃え', 'Ctrl+R']].forEach(function (a) { m.appendChild(rb({ i: a[1], t: a[2], k: a[3], on: al === a[0], fn: function () { setProp('align', a[0]); } })); });
  if (mini) mini.remove(); root.appendChild(m); mini = m; tipify(m);
  m.style.left = clamp(miniPos.x, 4, innerWidth - m.offsetWidth - 4) + 'px'; m.style.top = Math.max(4, miniPos.y - m.offsetHeight) + 'px';
}

/* ---------- キーボード・ヘルプ ---------- */
function typing(t) { return !!t && (t.isContentEditable || /^(TEXTAREA|SELECT)$/.test(t.tagName) || (t.tagName === 'INPUT' && !/^(checkbox|radio|button|color|range)$/.test(t.type))); }
function nudgeTip() {
  var u = unionBox(selEls().filter(function (e) { return !e.hidden; })); if (!u) return;
  S.nt = 'X ' + fmt(u.x) + '  Y ' + fmt(u.y) + ' mm'; clearTimeout(S.ntT); S.ntT = setTimeout(function () { S.nt = ''; if (S.open) drawOv(); }, 1000); drawOv();
}
var HELP = [
  ['選ぶ', [['クリック', '要素を選ぶ（グループは全体。もう一度クリックで中の1つ）'], ['Shift+クリック', '複数選択（追加・解除）'], ['空きをドラッグ', '範囲選択'], ['Ctrl+A', 'すべて選択'], ['Tab / Shift+Tab', '次 / 前の要素を選ぶ'], ['Alt+クリック', '重なった下の要素を選ぶ'], ['右クリック / Shift+F10', 'メニューとミニ ツール バー']]],
  ['編集する', [['ダブルクリック / F2 / Enter', '文字・表の値・項目名をその場で編集'], ['図形の枠をダブルクリック', '書式設定ウィンドウを開く'], ['Delete', '削除'], ['Ctrl+X / C / V', '切り取り / コピー / 貼り付け'], ['Ctrl+D', '複製（Ctrl+ドラッグでも複製）'], ['Ctrl+Z / Ctrl+Y', '元に戻す / やり直し'], ['Ctrl+S', '保存'], ['Esc', '編集を終える（もう一度で選択解除）']]],
  ['書式', [['Ctrl+B / I / U', '太字 / 斜体 / 下線'], ['Ctrl+L / E / R / J', '左 / 中央 / 右 / 両端揃え'], ['Ctrl+] / Ctrl+[', '文字を大きく / 小さく（文字がないときは前面 / 背面へ）'], ['Ctrl+Shift+> / <', '文字を大きく / 小さく'], ['Ctrl+Shift+C / V', '書式のコピー / 貼り付け'], ['Ctrl+G / Ctrl+Shift+G', 'グループ化 / 解除']]],
  ['動かす・表示', [['矢印キー', '0.5mm ずつ移動（Shiftで5mm）'], ['Shift+ドラッグ', '縦か横に固定して動かす'], ['Alt+ドラッグ', '吸着せずに動かす'], ['Shift+角をドラッグ', '縦横比を保って拡大縮小'], ['Shift+回転ハンドル', '15°ずつ回転'], ['Ctrl+ホイール', '拡大縮小'], ['Ctrl+0', '1ページ全体を表示'], ['Ctrl+F1', 'リボンを折りたたむ / 展開'], ['?', 'このヒントを表示']]]
];
function hideHelp() { if (R.help) { R.help.remove(); R.help = null; } }
function showHelp() {
  hideHelp(); var m = h('div', 'fe-modal'), b = h('div', 'fe-help'), t = h('h3'), cols = h('div', 'cols'), cl = [h('div'), h('div')];
  t.appendChild(tx('span', null, '操作のヒント・ショートカット')); t.appendChild(ibtn('close', '閉じる', hideHelp)); b.appendChild(t);
  HELP.forEach(function (g1, i) { var c = cl[i % 2]; c.appendChild(tx('h5', null, g1[0])); g1[1].forEach(function (r) { var d = h('div', 'kr'); d.appendChild(tx('span', null, r[1])); d.appendChild(tx('kbd', null, r[0])); c.appendChild(d); }); });
  cols.appendChild(cl[0]); cols.appendChild(cl[1]); b.appendChild(cols); m.appendChild(b); m.onmousedown = function (e) { if (e.target === m) hideHelp(); };
  root.appendChild(m); R.help = m; tipify(m);
}
/* 書式のショートカット（編集中の文字にも効く）。処理したら true */
function fmtKey(ev) {
  var k = ev.key, lk = k.toLowerCase(), X1 = X(); if (!X1.n) return false;
  var sh = ev.shiftKey, tog = function (key) { if (!X1.has(key)) return false; setProp(key, !X1.val(key)); return true; };
  if (!sh && lk === 'b') { if (!X1.has('weight')) return false; setBold(!(X1.val('weight') >= 600)); return true; }
  if (!sh && lk === 'i') return tog('italic');
  if (!sh && lk === 'u') return tog('underline');
  var al = { l: 'left', e: 'center', r: 'right', j: 'justify' }[lk];
  if (!sh && al) { if (!X1.has('align')) return false; setProp('align', al); return true; }
  if (X1.has('size') && (k === ']' || ev.code === 'BracketRight' && !sh || (sh && (k === '>' || k === '.')))) { stepSize(1); return true; }
  if (X1.has('size') && (k === '[' || ev.code === 'BracketLeft' && !sh || (sh && (k === '<' || k === ',')))) { stepSize(-1); return true; }
  return false;
}
function cycleSel(dir) {
  var a = elems().filter(function (e) { return !e.hidden; }); if (!a.length) return;
  var units = [], seen = {}; a.forEach(function (e) { var key = e.groupId || e.id; if (!seen[key]) { seen[key] = 1; units.push(e.id); } });
  var cur = -1; if (S.sel.length) { var f = find(S.sel[0]); var key0 = f && f.groupId ? f.groupId : S.sel[0]; units.forEach(function (id, i) { var u = find(id); if ((u.groupId || u.id) === key0) cur = i; }); }
  var nx = cur < 0 ? (dir > 0 ? 0 : units.length - 1) : (cur + dir + units.length) % units.length;
  setSel(expandGroups([units[nx]])); selChanged();
}
document.addEventListener('keydown', function (ev) {
  if (!S.open || !root || root.hidden) return;
  if (document.getElementById('mdl') || !document.getElementById('fp').hidden || !document.getElementById('ex').hidden) return;
  var k = ev.key, mod = ev.ctrlKey || ev.metaKey, t = ev.target;
  function stop() { ev.preventDefault(); ev.stopPropagation(); }
  if (mod && k === 'F1') { stop(); toggleRibbon(); return; }
  if (k === 'Escape') {
    if (R.help) { stop(); hideHelp(); return; }
    if (R.bs) { stop(); closeBackstage(); return; }
    if (pop) { stop(); closePop(); return; }
    if (S.draw) { stop(); S.draw = null; drawFrame(); drawStat(); return; }
    if (S.fp) { stop(); S.fp = null; S.fpSticky = false; drawFrame(); drawRibbon(); return; }
    if (S.rcol && S.rpeek) { stop(); S.rpeek = false; drawFrame(); return; }
    if (S.editing) { stop(); finishEdit(true); return; }
    if (mini) { hideMini(); }
    if (typing(t)) { t.blur(); stop(); return; }
    if (S.sel.length) { stop(); setSel([]); selChanged(); return; }
    stop(); return;
  }
  if (S.ro || R.bs) return;
  if (S.editing) { if (mod && !ev.altKey && fmtKey(ev)) stop(); return; }
  if (typing(t)) return;
  if (k === '?') { stop(); showHelp(); return; }
  if (k === 'F10' && ev.shiftKey) {
    stop(); var u0 = unionBox(selEls().filter(function (e) { return !e.hidden; })), br = R.box.getBoundingClientRect(), sc = sz();
    ctxMenuAt(u0 ? br.left + u0.cx * sc : br.left + 60, u0 ? br.top + u0.cy * sc : br.top + 60, []); return;
  }
  if (k === 'F2' && S.sel.length === 1) { var e2 = find(S.sel[0]); if (e2 && !e2.locked && e2.type !== 'image') { stop(); activateAt(e2, null); } return; }
  if (k === 'Tab' && !mod && (t === document.body || R.scroll.contains(t))) { stop(); cycleSel(ev.shiftKey ? -1 : 1); return; }
  if (mod && !ev.altKey) {
    var lk = k.toLowerCase();
    if (ev.shiftKey && lk === 'c') { stop(); var st = fpTake(); if (st) H.toast('書式をコピーしました。貼り付けたい要素を選んで Ctrl+Shift+V'); return; }
    if (ev.shiftKey && lk === 'v') { stop(); if (S.fpStore && S.sel.length) fpApply(S.sel, S.fpStore); return; }
    if (lk === 'g') { stop(); if (ev.shiftKey) ungroupSel(); else groupSel(); return; }
    if (lk === 'c') { stop(); copySel(); } else if (lk === 'v') { stop(); pasteSel(); } else if (lk === 'd') { stop(); dupSel(); }
    else if (lk === 'a') { stop(); selectAll(); }
    else if (lk === 'x') { stop(); cutSel(); }
    else if (fmtKey(ev)) { stop(); }
    else if (k === ']' || k === '}') { stop(); arrange(ev.shiftKey ? 'front' : 'up'); }
    else if (k === '[' || k === '{') { stop(); arrange(ev.shiftKey ? 'back' : 'down'); }
    else if (k === '0') { stop(); S.fit = 'p'; setZoom(fitZoom(), null, null, true); }
    else if (k === '+' || k === '=') { stop(); setZoom(S.zoom * 1.2); } else if (k === '-') { stop(); setZoom(S.zoom / 1.2); }
    return;
  }
  if (k === 'Delete' || k === 'Backspace') { if (S.sel.length) { stop(); removeSel(); } return; }
  if (k === 'Enter' && S.sel.length === 1) { var e1 = find(S.sel[0]); if (e1 && !e1.locked && e1.type !== 'image') { stop(); activateAt(e1, null); } return; }
  if (/^Arrow/.test(k) && S.sel.length) {
    stop(); var stp = ev.shiftKey ? 5 : 0.5, dx = k === 'ArrowLeft' ? -stp : k === 'ArrowRight' ? stp : 0, dy = k === 'ArrowUp' ? -stp : k === 'ArrowDown' ? stp : 0;
    var es = selEls().filter(function (e) { return !e.locked; });
    if (es.length) { lbl('移動'); mut(function () { es.forEach(function (e) { e.x = r2(e.x + dx); e.y = r2(e.y + dy); }); }, { live: true }); drawPane(); nudgeTip(); }
  }
}, true);

/* ---------- 開閉 ---------- */
FE.init = function (host) { H = host; };
FE.isOpen = function () { return S.open; };
FE.open = function () {
  if (!H) return; if (!root) build();
  H.ensureFree(); root.hidden = false; S.open = true; S.ro = innerWidth < 1024; root.classList.toggle('ro', S.ro);
  S.sel = []; S.preview = S.ro; S.pidx = 0; S.fit = 'c'; S.raw = false; S.rowSel = null; S.themeC = null; S.hover = ''; S.hb = null; S.nt = ''; S.draw = null; S.fp = null; S.fpSticky = false; S.rtab = 'home'; S.rpeek = false; S.pane = '';
  closeBackstage(); closePop(); hideMini(); hideHelp();
  var u = loadUI();
  if (u) { S.rcol = !!u.rcol; S.secs = u.secs && typeof u.secs === 'object' ? u.secs : {}; S.thumbs = u.thumbs !== false; S.thw = clamp(+u.thw || 150, 96, 280); S.rulers = u.rulers !== false; S.guides = u.guides !== false; S.grid = !!u.grid; S.snap = u.snap !== false; S.lockAR = !!u.lockAR; if (u.ptab === 'text' || u.ptab === 'shape') S.ptab = 'shape'; }
  S.zoom = fitZoom(); redraw(); drawThumbs(true);
  requestAnimationFrame(function () { if (S.open && S.fit) { S.zoom = fitZoom(); layout(); drawOv(); } });
};
FE.close = function () {
  if (!S.open) return; if (S.editing) finishEdit(true); closePop(); hideMini(); hideHelp(); closeBackstage(); ttHide(); drag = null; S.open = false; root.hidden = true; H.onClose();
};
/* 履歴（元に戻す／やり直し）や外部の変更のあとに呼ぶ */
FE.refresh = function () { if (!S.open) return; if (S.editing) { S.editing = null; } hideMini(); setSel(S.sel); redraw(); };
FE.status = function (s, t) { if (s != null) S.st = { s: s, t: t || '' }; if (S.open && root) drawTop(); };
FE._state = S;
})(window);
