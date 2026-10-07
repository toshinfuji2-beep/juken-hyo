/* 受験票テンプレート API（共通設定スキーマ・登録・ツールキット）
   使い方は templates/README.md。テンプレートは templates/<id>.js で
   JukenTemplates.register({...}) を呼ぶだけ。ビルド不要（index.html の <script src> で読み込む）。 */
(function (g) {
'use strict';
var PXMM = 96 / 25.4;

/* ---------- 小さな道具 ---------- */
function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
var JTX = g.JukenText || { trim: function (x) { return String(x == null ? '' : x).trim(); }, seg: function (x) { return Array.from(String(x == null ? '' : x)); } };
function lines(s) { return String(s || '').split(/\r?\n/).map(function (x) { return JTX.trim(x); }).filter(Boolean); }
function fmtDate(s) {
  if (!s) return '';
  var m = /^(\d+)-(\d+)-(\d+)$/.exec(s); if (!m) return s;
  var d = new Date(+m[1], +m[2] - 1, +m[3]);
  return m[1] + '年' + (+m[2]) + '月' + (+m[3]) + '日（' + '日月火水木金土'[d.getDay()] + '）';
}
/* 1行に収まるまで文字を縮める（DOMに入ってから呼ぶ） */
function fit(e, min) {
  /* e._fitBase（任意）=縮小前の font-size（CSS値）。再実行しても元の大きさから測り直す。e._fitH=true なら高さのはみ出しも対象 */
  if (e._fitBase != null) e.style.fontSize = e._fitBase;
  var fs = parseFloat(getComputedStyle(e).fontSize), n = 0;
  e.style.fontSize = fs + 'px';
  while ((e.scrollWidth > e.clientWidth + 0.5 || (e._fitH && e.scrollHeight > e.clientHeight + 0.5)) && fs > (min || 6) && n++ < 400) { fs -= 0.5; e.style.fontSize = fs + 'px'; }
}
var seq = 0;
function newId() { return 'i' + Date.now().toString(36) + (seq++); }

/* ---------- 項目（item）モデル ---------- */
var SIZE = { half: { S: 20, M: 26, L: 30, XL: 34 }, full: { S: 20, M: 24, L: 28, XL: 34 }, sch: { S: 11, M: 14, L: 17, XL: 20 } };
var SOURCES = ['column', 'fixed', 'date', 'schedule', 'autonumber'];
function mkItem(label, source, o) {
  var it = { id: newId(), label: label, source: source, column: '', value: '', rows: [], auto: { prefix: '', start: 1, digits: 3 }, fallback: '', autoEmpty: false, width: 'full', size: 'M', color: 'black', align: '', hidden: false };
  for (var k in o) it[k] = o[k];
  return it;
}
var SCH_W = [{ t: '10:00〜11:30', c: '英語' }, { t: '13:00〜14:30', c: '国語' }, { t: '15:30〜16:30', c: '社会' }];
function defItems() {
  return [
    mkItem('受験番号', 'column', { column: '受験番号', width: 'half', size: 'L' }),
    mkItem('試験場', 'fixed', { value: '東進HS 藤沢校', width: 'half', size: 'XL', color: 'accent' }),
    mkItem('氏名', 'column', { column: '氏名', width: 'half', size: 'L', hidden: true }),   /* 漢字氏名：既定では非表示（必要なら「表示」に） */
    mkItem('カナ氏名', 'column', { column: 'カナ氏名', width: 'half' }),
    mkItem('教室', 'fixed', { value: 'レクチャールーム', width: 'half' }),
    mkItem('試験日', 'date', { value: '2023-07-02', size: 'L' }),
    mkItem('入試制度', 'fixed', { value: '第一回早大プレ', size: 'L' }),
    mkItem('志望学部', 'column', { column: '志望学部', size: 'L' }),
    mkItem('試験時間', 'schedule', { rows: clone(SCH_W) })];
}
function normItems(arr) {
  return arr.filter(function (x) { return x && typeof x === 'object'; }).map(function (x) {
    var it = mkItem(String(x.label || ''), SOURCES.indexOf(x.source) >= 0 ? x.source : 'fixed', {});
    if (typeof x.id === 'string' && x.id) it.id = x.id;
    ['column', 'value', 'fallback'].forEach(function (k) { if (typeof x[k] === 'string') it[k] = x[k]; });
    if (Array.isArray(x.rows)) it.rows = x.rows.filter(function (r) { return r && typeof r === 'object'; }).map(function (r) { return { t: String(r.t || ''), c: String(r.c || '') }; });
    if (x.auto && typeof x.auto === 'object') it.auto = { prefix: String(x.auto.prefix || ''), start: +x.auto.start || 0, digits: Math.max(1, +x.auto.digits || 3) };
    it.autoEmpty = x.autoEmpty === true;
    if (x.width === 'half' || x.width === 'full') it.width = x.width;
    if (['S', 'M', 'L', 'XL'].indexOf(x.size) >= 0) it.size = x.size;
    if (x.color === 'accent' || x.color === 'black') it.color = x.color;
    if (x.align === 'left' || x.align === 'center') it.align = x.align;
    it.hidden = !!x.hidden;
    return it;
  });
}

/* ---------- 共通設定スキーマ ----------
   k=キー  type=text|check|number|color|select|lines|image  u=使う機能（テンプレートの uses で絞れる）
   tab=詳細編集のタブ  g=見出し  half=2列並び */
var NOTES_W = '!こちらの受験票を折って試験当日に持参してください。\n入場の際、受験票の提示が必要です。\n!試験教室は8:30から開いています。試験時間の30分前までに試験教室に入場してください。\n試験教室の座席に着席する際に、机に貼られている受験番号と一致していることを確認してください。\n受験票は試験時間中机上に置きますので、何も書き込まないでください。（書き込みを発見した場合、不正行為となる可能性があります。）\n受験票は入学後の学生証交付の際に必要になりますので、大切に保管してください。';
var FIELDS = [
  { k: 'hdr', type: 'text', label: 'タイトル（ヘッダー文字）', def: '2024年度　早稲田大学受験票', u: 'header', tab: 'items', g: 'ヘッダー' },
  { k: 'badge', type: 'text', label: 'バッジ文字', def: '折って試験当日持参', u: 'badge', tab: 'items', half: 1 },
  { k: 'badgeOn', type: 'check', label: 'バッジを表示', def: true, u: 'badge', tab: 'items', half: 1 },
  { k: 'mark', type: 'text', label: '右上マーク', def: '24早', u: 'mark', tab: 'items', half: 1 },
  { k: 'markOn', type: 'check', label: 'マークを表示', def: true, u: 'mark', tab: 'items', half: 1 },
  { k: 'accent', type: 'color', label: 'アクセント色', def: '#C00000', u: 'accent', tab: 'look', g: '色・書体', half: 1 },
  { k: 'secondary', type: 'color', label: 'サブカラー', def: '#444444', u: 'secondary', tab: 'look', half: 1 },
  { k: 'font', type: 'font', label: '基本フォント', def: 'gothic', u: 'font', tab: 'look' },
  { k: 'foldOn', type: 'check', label: '折り線を表示', def: true, u: 'fold', tab: 'look', g: '折り線', half: 1 },
  { k: 'foldPos', type: 'number', label: '位置（mm）', def: 148.5, u: 'fold', tab: 'look', half: 1 },
  { k: 'foldLabel', type: 'text', label: '折り線の文字', def: '＜山折り＞', u: 'fold', tab: 'look' },
  { k: 'noteTitle', type: 'text', label: '注意事項の見出し', def: '注意事項', u: 'notes', tab: 'notes', g: '注意事項' },
  { k: 'notes', type: 'lines', label: '注意事項（1行1項目・先頭「!」でアクセント色）', def: NOTES_W, u: 'notes', tab: 'notes' },
  { k: 'swap', type: 'check', label: '注意事項と画像の左右を入れ替える', def: false, u: 'swap', tab: 'notes' },
  { k: 'map', type: 'image', label: '地図画像', def: { d: '', hide: false }, u: 'images', tab: 'notes', g: '画像' },
  { k: 'logo', type: 'image', label: 'ロゴ画像', def: { d: '', hide: false }, u: 'images', tab: 'notes' },
  { k: 'wmOn', type: 'check', label: '透かしを表示', def: false, u: 'wm', tab: 'wm', half: 1 },
  { k: 'wmBold', type: 'check', label: '太字', def: true, u: 'wm', tab: 'wm', half: 1 },
  { k: 'wmText', type: 'text', label: '文字（プレビューのダブルクリックでも編集）', def: '2027', u: 'wm', tab: 'wm' },
  { k: 'wmAcc', type: 'check', label: '色をアクセント色に合わせる', def: true, u: 'wm', tab: 'wm', half: 1 },
  { k: 'wmColor', type: 'color', label: '色（上をオフのとき）', def: '#C00000', u: 'wm', tab: 'wm', half: 1 },
  { k: 'wmOp', type: 'number', label: '濃さ（不透明度 %）', def: 18, u: 'wm', tab: 'wm', half: 1 },
  { k: 'wmSize', type: 'number', label: '文字の大きさ（mm）', def: 26, u: 'wm', tab: 'wm', half: 1 },
  { k: 'wmSp', type: 'number', label: '字間（em）', def: 0.6, u: 'wm', tab: 'wm', half: 1 },
  { k: 'wmRot', type: 'number', label: '回転（度）', def: 0, u: 'wm', tab: 'wm', half: 1 },
  { k: 'wmAnchor', type: 'select', label: '縦位置の基準', opts: [['top', '表の上端'], ['mid', '表の中央'], ['bot', '表の下端'], ['page', '用紙の上端']], def: 'mid', u: 'wm', tab: 'wm', half: 1 },
  { k: 'wmY', type: 'number', label: '縦位置（mm・文字の中心）', def: 0, u: 'wm', tab: 'wm', half: 1 },
  { k: 'wmX', type: 'number', label: '横のずれ（mm）', def: 0, u: 'wm', tab: 'wm' }
];
var LOOK = ['accent', 'secondary', 'font'];     /* テンプレートを切り替えると新しいテンプレートの既定に変わるキー */
var DEFAULT_IMG = { map: 'assets/map-fujisawa.png', logo: 'assets/logo-fujisawa.png' };

function normField(f, s, def) {
  if (typeof f.norm === 'function') return f.norm(s, def === undefined ? f.def : def);   /* type:'json' など独自の正規化（フリーデザインの elements 等） */
  var x = clone(def === undefined ? f.def : def);
  if (s === undefined || s === null) return x;
  var ok = f.type === 'image' ? (typeof s === 'object' && !Array.isArray(s)) : f.type === 'check' ? typeof s === 'boolean' : f.type === 'number' ? (typeof s === 'number' && isFinite(s)) : typeof s === 'string';
  if (f.type === 'color' && ok) ok = /^#[0-9a-fA-F]{6}$/.test(s);
  if (f.type === 'select' && ok) ok = f.opts.some(function (o) { return o[0] === s; });
  if (f.type === 'font' && ok) ok = !g.JukenFonts || g.JukenFonts.valid(s) || s === 'gothic' || s === 'mincho';
  if (ok) { x = clone(s); if (f.type === 'image') { x.d = typeof x.d === 'string' ? x.d : ''; x.hide = !!x.hide; } }
  return x;
}

/* ---------- 登録 ---------- */
var REG = {}, ORDER = [];
var CATEGORIES = ['ベーシック', 'シック', 'ポップ', 'ナチュラル', 'モダン', '自由編集'];
function addStyle(id, css) {
  var old = document.querySelector('style[data-tpl="' + id + '"]'); if (old) old.remove();
  if (!css) return;
  var st = document.createElement('style'); st.setAttribute('data-tpl', id); st.textContent = css; document.head.appendChild(st);
}
function register(def) {
  if (!def || !/^[a-z][a-z0-9-]*$/.test(def.id || '')) throw new Error('JukenTemplates.register: id は半角小文字・数字・ハイフン');
  if (typeof def.render !== 'function') throw new Error('JukenTemplates.register(' + def.id + '): render が必要です');
  var t = {
    id: def.id, name: def.name || def.id, category: def.category || 'ベーシック', description: def.description || '',
    swatch: Array.isArray(def.swatch) && def.swatch.length ? def.swatch : ['#C00000', '#ffffff'],
    defaults: def.defaults || {}, render: def.render, styles: def.styles || '',
    uses: Array.isArray(def.uses) ? def.uses : null,          /* null=すべての共通項目を使う */
    extras: Array.isArray(def.extras) ? def.extras : [],      /* data.tpl[id] に入る固有設定 */
    migrate: typeof def.migrate === 'function' ? def.migrate : null,
    legacyKeys: Array.isArray(def.legacyKeys) ? def.legacyKeys : []
  };
  if (!REG[t.id]) ORDER.push(t.id);
  REG[t.id] = t;
  addStyle(t.id, t.styles);
  return t;
}
function get(id) { return REG[id] || null; }
function list() {
  var cats = CATEGORIES.slice();
  ORDER.forEach(function (id) { if (cats.indexOf(REG[id].category) < 0) cats.push(REG[id].category); });
  var out = [];
  cats.forEach(function (c) { ORDER.forEach(function (id) { if (REG[id].category === c) out.push(REG[id]); }); });
  return out;
}
function categories() { var seen = {}; return list().filter(function (t) { return !seen[t.category] && (seen[t.category] = 1); }).map(function (t) { return t.category; }); }
function uses(t, u) { return !t || !t.uses || t.uses.indexOf(u) >= 0; }

/* テンプレートの既定値（共通スキーマの既定 + テンプレートの defaults を上書き） */
function defaults(id) {
  var t = REG[id], d = {};
  FIELDS.forEach(function (f) { d[f.k] = clone(f.def); });
  if (t) for (var k in t.defaults) d[k] = clone(t.defaults[k]);
  return d;
}
function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }
/* 保存データ → 完全な設定オブジェクト（不正な値は既定値に、旧形式は migrate で変換） */
function mkVals(id, saved) {
  var t = REG[id];
  if (isObj(saved) && t && t.migrate) saved = t.migrate(clone(saved));
  if (!isObj(saved)) saved = {};
  var D = defaults(id), v = {};
  FIELDS.forEach(function (f) { v[f.k] = normField(f, saved[f.k], D[f.k]); });
  v.items = Array.isArray(saved.items) ? normItems(saved.items) : (Array.isArray(D.items) ? normItems(clone(D.items)) : defItems());
  v.tpl = {};
  ORDER.forEach(function (tid) {
    var ex = REG[tid].extras, s = isObj(saved.tpl) && isObj(saved.tpl[tid]) ? saved.tpl[tid] : {}, o = {};
    ex.forEach(function (f) { o[f.k] = normField(f, s[f.k], undefined); });
    v.tpl[tid] = o;
  });
  return v;
}
/* テンプレートを切り替えたときの設定（内容はそのまま、色・書体だけ新しいテンプレートの既定に） */
function switchVals(id, V) {
  var v = clone(V), D = defaults(id);
  LOOK.forEach(function (k) { v[k] = clone(D[k]); });
  return mkVals(id, v);
}
function known(id) {
  var k = { tpl: 1, items: 1 }; FIELDS.forEach(function (f) { k[f.k] = 1; });
  var t = REG[id]; if (t) t.legacyKeys.forEach(function (x) { k[x] = 1; });
  return k;
}

/* ---------- ctx（render に渡るツールキット） ---------- */
var FONT = { gothic: '"Yu Gothic","Meiryo","Hiragino Sans",sans-serif', mincho: '"Yu Mincho","Hiragino Mincho ProN","MS PMincho",serif' };
function autoNum(a, idx) { return (a.prefix || '') + String((+a.start || 0) + idx).padStart(Math.max(1, a.digits || 3), '0'); }
var ctx = {
  PXMM: PXMM, SIZE: SIZE, el: el, esc: esc, clone: clone, lines: lines, fmtDate: fmtDate, autoNum: autoNum,
  /* A4の1ページ（.ticket.tpl-<id>）。--tac=アクセント色 --tac2=サブカラー。_fits に縮小対象を溜める */
  page: function (id, V, extraCls) {
    var t = el('div', 'ticket tpl-' + id + (extraCls ? ' ' + extraCls : ''));
    t.style.setProperty('--tac', V.accent); t.style.setProperty('--tac2', V.secondary);
    t.style.fontFamily = ctx.font(V); t._fits = []; return t;
  },
  /* 基本フォント。gothic / mincho は各テンプレート本来の書体のまま、それ以外（フォント一覧のid）はその書体 */
  font: function (V) { return FONT[V.font] || (g.JukenFonts && g.JukenFonts.valid(V.font) ? (g.JukenFonts.use(V.font), g.JukenFonts.css(V.font)) : FONT.gothic); },
  isStdFont: function (V) { return V.font === 'gothic' || V.font === 'mincho' || !(g.JukenFonts && g.JukenFonts.valid(V.font)); },
  /* テンプレート固有の書体（sans / serif）と、V.font の選択を合わせる。serifIf=true の書体を明朝系とみなす */
  pickFont: function (V, sans, serif) {
    if (ctx.isStdFont(V)) return V.font === 'mincho' ? serif : sans;
    return ctx.font(V);
  },
  /* 1行に収まるまで縮める対象として登録（表示後にアプリが fit を実行） */
  fitText: function (page, e, min) { e._fitMin = min; page._fits.push(e); return e; },
  fit: fit,
  /* 項目の値（固定/日付/連番/名簿の列＋代替文字） */
  value: function (it, st) {
    var s = it.source;
    if (s === 'fixed') return it.value || '';
    if (s === 'date') return fmtDate(it.value);
    if (s === 'autonumber') return autoNum(it.auto, st.idx);
    if (s === 'column') { var v = st.col ? st.col(it) : ''; if (v) return v; if (it.fallback) return it.fallback; if (it.autoEmpty) return autoNum(it.auto, st.idx); }
    return '';
  },
  sched: function (it) { return (it.rows || []).filter(function (r) { return r.t || r.c; }); },
  visible: function (V) { return V.items.filter(function (i) { return !i.hidden; }); },
  /* 表示項目を行に分ける：連続する半幅2つは横並び [a,b]、それ以外は [a] */
  rows: function (V) {
    var vis = V.items.filter(function (i) { return !i.hidden; }), q = 0, out = [];
    while (q < vis.length) { var a = vis[q], b = vis[q + 1]; if (a.width === 'half' && b && b.width === 'half') { out.push([a, b]); q += 2; } else { out.push([a]); q++; } }
    return out;
  },
  findItem: function (V, re, not) { return V.items.filter(function (i) { return re.test(i.label) && !(not && not.test(i.label)); })[0] || null; },
  /* 注意事項 → [{text, accent}]（先頭「!」「！」でaccent） */
  notes: function (V) { return lines(V.notes).map(function (x) { var r = /^[!！]/.test(x); return { text: r ? x.replace(/^[!！]\s*/, '') : x, accent: r }; }); },
  /* 地図・ロゴの src（空文字=非表示）。既定画像は assets/ の藤沢校のもの */
  imageSrc: function (v, key) { if (!v || v.hide) return ''; return v.d || DEFAULT_IMG[key] || ''; },
  images: function (V) { return { map: ctx.imageSrc(V.map, 'map'), logo: ctx.imageSrc(V.logo, 'logo') }; },
  /* 透かし。o.top=表などの上端(mm) o.height=その高さ(mm)。無効なら null */
  watermark: function (V, o) {
    if (!V.wmOn || !V.wmText) return null;
    o = o || { top: 0, height: 0 };
    var wm = el('div', 'jt-wm'), y = V.wmAnchor === 'top' ? o.top : V.wmAnchor === 'mid' ? o.top + o.height / 2 : V.wmAnchor === 'bot' ? o.top + o.height : 0;
    y += V.wmY; wm.style.top = y + 'mm'; wm.style.fontSize = V.wmSize + 'mm'; wm.style.fontWeight = V.wmBold ? '700' : '400';
    wm.style.color = V.wmAcc ? V.accent : V.wmColor; wm.style.opacity = Math.max(0, Math.min(100, V.wmOp)) / 100;
    wm.style.transform = 'translate(calc(-50% + ' + V.wmX + 'mm),-50%) rotate(' + V.wmRot + 'deg)';
    JTX.seg(V.wmText).forEach(function (ch, i, a) { var sp = el('span', null, ch); if (i < a.length - 1) sp.style.marginRight = V.wmSp + 'em'; wm.appendChild(sp); });
    return ctx.edit(wm, 'wmText');
  },
  /* 折り線（foldOn が false なら null） */
  fold: function (V) {
    if (!V.foldOn) return null;
    var fo = el('div', 'jt-fold'); fo.style.top = V.foldPos + 'mm'; fo.appendChild(el('span'));
    if (V.foldLabel) fo.appendChild(ctx.edit(el('em', null, V.foldLabel), 'foldLabel'));
    fo.appendChild(el('span')); return fo;
  },
  /* プレビューでの編集フック（詳細編集のクリック／ダブルクリック編集） */
  edit: function (e, key) { e.setAttribute('data-edit', key); return e; },            /* ダブルクリックで文字編集。key は設定のキー名 */
  item: function (e, it) { e.setAttribute('data-item', it.id); return e; },           /* クリックで項目を選択 */
  itemEdit: function (e, it) { if (it.source === 'fixed') ctx.edit(e, 'item:' + it.id); return e; },
  extraEdit: function (e, tplId, k) { return ctx.edit(e, 'tpl.' + tplId + '.' + k); }
};

var BASE_CSS =
  '.ticket{position:relative;width:210mm;height:297mm;padding:15mm;background:#fff;color:#000;font-family:"Noto Sans JP","Yu Gothic","Hiragino Sans","Meiryo",sans-serif;font-size:10.5pt;line-height:1.5;display:flex;flex-direction:column;overflow:hidden}' +
  '.ticket *{box-sizing:border-box}' +
  '.jt-wm{position:absolute;left:105mm;white-space:nowrap;line-height:1;pointer-events:none;-webkit-print-color-adjust:exact;print-color-adjust:exact;-webkit-user-select:none;user-select:none}' +
  '.jt-wm span{display:inline-block}' +
  '.jt-wm.editing{pointer-events:auto;-webkit-user-select:text;user-select:text}' +
  '@media screen{.jt-wm span{pointer-events:auto;cursor:pointer}.jt-wm.editing span{cursor:text}}' +
  '.jt-fold{position:absolute;left:0;top:148.5mm;width:210mm;height:0;display:flex;align-items:center;gap:5mm;font-size:13pt;white-space:nowrap}' +
  '.jt-fold span{display:block;flex:1;border-top:1.2pt dashed #000;height:0}' +
  '.jt-fold em{font-style:normal;flex:none}';
addStyle('_base', BASE_CSS);

function render(id, st, V) {
  var t = REG[id];
  try { return t.render(st, V, ctx); }
  catch (e) { var p = ctx.page(id, V); p.style.padding = '20mm'; p.appendChild(el('p', null, 'このデザインを表示できませんでした：' + e.message)); return p; }
}
function cssText() { return Array.prototype.map.call(document.querySelectorAll('style[data-tpl]'), function (s) { return s.textContent; }).join('\n'); }

g.JukenTemplates = {
  register: register, get: get, list: list, categories: categories, uses: uses, ctx: ctx, render: render,
  defaults: defaults, mkVals: mkVals, switchVals: switchVals, known: known, cssText: cssText,
  FIELDS: FIELDS, LOOK: LOOK, SIZE: SIZE, mkItem: mkItem, defItems: defItems, normItems: normItems, normField: normField, DEFAULT_NOTES: NOTES_W
};
})(window);
