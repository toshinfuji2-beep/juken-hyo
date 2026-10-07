/* フォントの一覧（window.JukenFonts）。api.js より先に読み込む。
   - レジストリ：id・表示名・種類・CSSのfont-family（日本語のシステムフォント付きの代替つき）・Google Fonts の太さ・見本
   - 旧id（gothic / mincho / maru / sans-en）は別名として生き続ける（保存データの移行は不要）
   - 使うフォントのCSSだけを必要になったとき読み込む（use / prepare）。印刷・PDF・サムネイルの前は prepare() で
     「ページに実際にある文字」を document.fonts.load に渡し、珍しい漢字を含む unicode-range の分割も確実に取得する
   - 「このPCにある場合」のシステムフォントは canvas の幅比較で有無を判定
   - 選択UI：検索つき・種類別・各行をそのフォントで表示・最近使ったフォント・キーボード操作（openPicker） */
(function (g) {
'use strict';

var CATS = ['持ち込み', 'このパソコンのフォント', 'ゴシック', '明朝', '丸ゴシック', 'UD・教科書', '手書き・筆', 'デザイン', '英字', 'パソコンの書体'];
var TAIL = {
  sans: '"Noto Sans JP","Yu Gothic","Hiragino Sans","Meiryo","Noto Sans CJK JP",sans-serif',
  serif: '"Yu Mincho","Hiragino Mincho ProN","Noto Serif CJK JP","MS PMincho",serif',
  round: '"Yu Gothic","Hiragino Maru Gothic ProN","Meiryo","Noto Sans CJK JP",sans-serif',
  mono: '"MS Gothic","Noto Sans JP","Yu Gothic","Meiryo",monospace',
  senv: '"Noto Sans JP","Yu Gothic","Hiragino Sans","Meiryo",sans-serif',
  serifen: '"Yu Mincho","Hiragino Mincho ProN","Noto Serif CJK JP",serif'
};
var ALL = [100, 200, 300, 400, 500, 600, 700, 800, 900];
var SAMPLE = '受験票 Abc 0123', SAMPLE_EN = '受験票 Exam No. 0123';

/* [id, 表示名, 種類, family, 代替の種類, 太さ, 見本] */
var GF = [
  ['noto-sans-jp', 'Noto Sans JP', 'ゴシック', 'Noto Sans JP', 'sans', ALL],
  ['m-plus-1p', 'M PLUS 1p', 'ゴシック', 'M PLUS 1p', 'sans', [100, 300, 400, 500, 700, 800, 900]],
  ['m-plus-2', 'M PLUS 2', 'ゴシック', 'M PLUS 2', 'sans', ALL],
  ['zen-kaku-gothic-new', 'Zen角ゴシック New', 'ゴシック', 'Zen Kaku Gothic New', 'sans', [300, 400, 500, 700, 900]],
  ['sawarabi-gothic', 'さわらびゴシック', 'ゴシック', 'Sawarabi Gothic', 'sans', [400]],
  ['murecho', 'Murecho', 'ゴシック', 'Murecho', 'sans', ALL],
  ['zen-kaku-gothic-antique', 'Zen角ゴシック アンティーク', 'ゴシック', 'Zen Kaku Gothic Antique', 'sans', [300, 400, 500, 700, 900]],
  ['m-plus-1', 'M PLUS 1', 'ゴシック', 'M PLUS 1', 'sans', ALL],
  ['m-plus-1-code', 'M PLUS 1 Code', 'ゴシック', 'M PLUS 1 Code', 'mono', [100, 200, 300, 400, 500, 600, 700]],
  ['kosugi', '小杉ゴシック', 'ゴシック', 'Kosugi', 'sans', [400]],
  ['biz-udgothic', 'BIZ UDゴシック', 'UD・教科書', 'BIZ UDGothic', 'sans', [400, 700]],
  ['biz-udmincho', 'BIZ UD明朝', 'UD・教科書', 'BIZ UDMincho', 'serif', [400]],
  ['shippori-antique', 'しっぽりアンチック', '明朝', 'Shippori Antique', 'serif', [400]],
  ['shippori-antique-b1', 'しっぽりアンチック B1', '明朝', 'Shippori Antique B1', 'serif', [400]],
  ['kaisei-harunoumi', '解星ハルノウミ', '明朝', 'Kaisei HarunoUmi', 'serif', [400, 500, 700]],
  ['zen-antique-soft', 'Zenアンティーク ソフト', 'デザイン', 'Zen Antique Soft', 'serif', [400]],
  ['yuji-mai', '游字 舞（筆）', '手書き・筆', 'Yuji Mai', 'serif', [400]],
  ['new-tegomin', 'ニュー手書き明朝', '手書き・筆', 'New Tegomin', 'serif', [400]],
  ['chokokutai', '彫刻体', 'デザイン', 'Chokokutai', 'serif', [400]],
  ['aoboshi-one', 'あおぼし One', 'デザイン', 'Aoboshi One', 'serif', [400]],
  ['darumadrop-one', 'だるまドロップ One', 'デザイン', 'Darumadrop One', 'round', [400]],
  ['train-one', 'トレイン One', 'デザイン', 'Train One', 'sans', [400]],
  ['cherry-bomb-one', 'チェリーボム One', 'デザイン', 'Cherry Bomb One', 'round', [400]],
  ['mochiy-pop-p-one', 'もちよポップ P One', 'デザイン', 'Mochiy Pop P One', 'round', [400]],
  ['slackside-one', 'スラックサイド One', 'デザイン', 'Slackside One', 'sans', [400]],
  ['tsukimi-rounded', '月見ラウンド', '丸ゴシック', 'Tsukimi Rounded', 'round', [300, 400, 500, 600, 700]],
  ['ibm-plex-sans-jp', 'IBM Plex Sans JP', 'ゴシック', 'IBM Plex Sans JP', 'sans', [100, 200, 300, 400, 500, 600, 700]],
  ['noto-serif-jp', 'Noto Serif JP', '明朝', 'Noto Serif JP', 'serif', [200, 300, 400, 500, 600, 700, 800, 900]],
  ['zen-old-mincho', 'Zen オールド明朝', '明朝', 'Zen Old Mincho', 'serif', [400, 500, 600, 700, 900]],
  ['shippori-mincho', 'しっぽり明朝', '明朝', 'Shippori Mincho', 'serif', [400, 500, 600, 700, 800]],
  ['shippori-mincho-b1', 'しっぽり明朝 B1', '明朝', 'Shippori Mincho B1', 'serif', [400, 500, 600, 700, 800]],
  ['sawarabi-mincho', 'さわらび明朝', '明朝', 'Sawarabi Mincho', 'serif', [400]],
  ['hina-mincho', 'ひな明朝', '明朝', 'Hina Mincho', 'serif', [400]],
  ['kaisei-opti', '解星オプティ', '明朝', 'Kaisei Opti', 'serif', [400, 500, 700]],
  ['kaisei-tokumin', '解星特明', '明朝', 'Kaisei Tokumin', 'serif', [400, 500, 700, 800]],
  ['m-plus-rounded-1c', 'M PLUS Rounded 1c', '丸ゴシック', 'M PLUS Rounded 1c', 'round', [100, 300, 400, 500, 700, 800, 900]],
  ['zen-maru-gothic', 'Zen丸ゴシック', '丸ゴシック', 'Zen Maru Gothic', 'round', [300, 400, 500, 700, 900]],
  ['kosugi-maru', '小杉丸ゴシック', '丸ゴシック', 'Kosugi Maru', 'round', [400]],
  ['kiwi-maru', 'キウイ丸', '丸ゴシック', 'Kiwi Maru', 'round', [300, 400, 500]],
  ['biz-udpgothic', 'BIZ UDPゴシック', 'UD・教科書', 'BIZ UDPGothic', 'sans', [400, 700]],
  ['biz-udpmincho', 'BIZ UDP明朝', 'UD・教科書', 'BIZ UDPMincho', 'serif', [400, 700]],
  ['klee-one', 'クレー One（教科書体風）', 'UD・教科書', 'Klee One', 'serif', [400, 600]],
  ['yuji-syuku', '游字 粛（筆）', '手書き・筆', 'Yuji Syuku', 'serif', [400]],
  ['yuji-boku', '游字 墨（筆）', '手書き・筆', 'Yuji Boku', 'serif', [400]],
  ['zen-kurenaido', 'Zen紅道', '手書き・筆', 'Zen Kurenaido', 'sans', [400]],
  ['yomogi', 'よもぎ', '手書き・筆', 'Yomogi', 'sans', [400]],
  ['yusei-magic', '油性マジック', '手書き・筆', 'Yusei Magic', 'sans', [400]],
  ['hachi-maru-pop', 'はちまるポップ', '手書き・筆', 'Hachi Maru Pop', 'sans', [400]],
  ['zen-antique', 'Zenアンティーク', 'デザイン', 'Zen Antique', 'serif', [400]],
  ['kaisei-decol', '解星デコール', 'デザイン', 'Kaisei Decol', 'serif', [400, 500, 700]],
  ['mochiy-pop-one', 'もちよポップ', 'デザイン', 'Mochiy Pop One', 'round', [400]],
  ['dela-gothic-one', 'デラゴシック One', 'デザイン', 'Dela Gothic One', 'sans', [400]],
  ['rocknroll-one', 'ロックンロール One', 'デザイン', 'RocknRoll One', 'sans', [400]],
  ['reggae-one', 'レゲエ One', 'デザイン', 'Reggae One', 'sans', [400]],
  ['rampart-one', 'ランパート One', 'デザイン', 'Rampart One', 'sans', [400]],
  ['potta-one', 'ポッタ One', 'デザイン', 'Potta One', 'sans', [400]],
  ['dotgothic16', 'DotGothic16（ドット）', 'デザイン', 'DotGothic16', 'sans', [400]],
  ['stick', 'スティック', 'デザイン', 'Stick', 'sans', [400]],
  ['inter', 'Inter', '英字', 'Inter', 'senv', ALL, 1],
  ['montserrat', 'Montserrat', '英字', 'Montserrat', 'senv', ALL, 1],
  ['oswald', 'Oswald', '英字', 'Oswald', 'senv', [200, 300, 400, 500, 600, 700], 1],
  ['bebas-neue', 'Bebas Neue', '英字', 'Bebas Neue', 'senv', [400], 1],
  ['playfair-display', 'Playfair Display', '英字', 'Playfair Display', 'serifen', [400, 500, 600, 700, 800, 900], 1],
  ['cormorant-garamond', 'Cormorant Garamond', '英字', 'Cormorant Garamond', 'serifen', [300, 400, 500, 600, 700], 1],
  ['lato', 'Lato', '英字', 'Lato', 'senv', [100, 300, 400, 700, 900], 1],
  ['roboto-mono', 'Roboto Mono', '英字', 'Roboto Mono', 'mono', [100, 200, 300, 400, 500, 600, 700], 1],
  ['raleway', 'Raleway', '英字', 'Raleway', 'senv', ALL, 1],
  ['poppins', 'Poppins', '英字', 'Poppins', 'senv', ALL, 1],
  ['josefin-sans', 'Josefin Sans', '英字', 'Josefin Sans', 'senv', [100, 200, 300, 400, 500, 600, 700], 1],
  ['noto-serif', 'Noto Serif', '英字', 'Noto Serif', 'serifen', ALL, 1],
  ['merriweather', 'Merriweather', '英字', 'Merriweather', 'serifen', [300, 400, 700, 900], 1],
  ['abril-fatface', 'Abril Fatface', '英字', 'Abril Fatface', 'serifen', [400], 1]
];
/* パソコンの書体（ダウンロードしない。無いPCもある）。[id, 表示名, 候補名の配列, 代替のid, 代替の種類] */
var SYS = [
  ['yu-gothic', '游ゴシック', ['Yu Gothic', 'YuGothic', '游ゴシック'], 'noto-sans-jp', 'sans'],
  ['yu-mincho', '游明朝', ['Yu Mincho', 'YuMincho', '游明朝'], 'noto-serif-jp', 'serif'],
  ['meiryo', 'メイリオ', ['Meiryo', 'メイリオ'], 'noto-sans-jp', 'sans'],
  ['ms-gothic', 'ＭＳ ゴシック', ['MS Gothic', 'MS PGothic', 'ＭＳ ゴシック', 'ＭＳ Ｐゴシック'], 'biz-udpgothic', 'sans'],
  ['ms-mincho', 'ＭＳ 明朝', ['MS Mincho', 'MS PMincho', 'ＭＳ 明朝', 'ＭＳ Ｐ明朝'], 'biz-udpmincho', 'serif'],
  ['ud-kyokasho', 'UD デジタル 教科書体', ['UD Digi Kyokasho N-R', 'UD デジタル 教科書体 N-R', 'UD デジタル 教科書体 NK-R', 'UD デジタル 教科書体 NP-R'], 'klee-one', 'serif'],
  ['hiragino-kaku', 'ヒラギノ角ゴ（Mac）', ['Hiragino Kaku Gothic ProN', 'Hiragino Kaku Gothic Pro', 'ヒラギノ角ゴ ProN'], 'noto-sans-jp', 'sans'],
  ['hiragino-mincho', 'ヒラギノ明朝（Mac）', ['Hiragino Mincho ProN', 'Hiragino Mincho Pro', 'ヒラギノ明朝 ProN'], 'shippori-mincho', 'serif'],
  ['hiragino-maru', 'ヒラギノ丸ゴ（Mac）', ['Hiragino Maru Gothic ProN', 'ヒラギノ丸ゴ ProN'], 'zen-maru-gothic', 'round']
];

var ALIAS = { gothic: 'noto-sans-jp', mincho: 'shippori-mincho', maru: 'zen-maru-gothic', 'sans-en': 'inter' };
var REG = {}, ORDER = [];
function q(n) { return '"' + n + '"'; }
/* 表示名は英字の family 名（日本語名は kw として検索にだけ使う）。補足が要るものだけ上書き */
var NAMEX = { 'klee-one': 'Klee One（教科書体風）', 'yuji-syuku': 'Yuji Syuku（筆）', 'yuji-boku': 'Yuji Boku（筆）', 'zen-kurenaido': 'Zen Kurenaido（手書き）', 'dotgothic16': 'DotGothic16（ドット）', 'biz-udpgothic': 'BIZ UDPGothic（UD）', 'biz-udpmincho': 'BIZ UDPMincho（UD）' };
GF.forEach(function (r) {
  var tail = TAIL[r[4]];
  /* 先頭の family が代替に重複していたら取り除く */
  var tl = tail.split(',').filter(function (x) { return x !== q(r[3]); }).join(',');
  REG[r[0]] = { id: r[0], name: NAMEX[r[0]] || r[3], kw: r[1], cat: r[2], family: r[3], kind: 'gf', w: r[5], sample: r[6] ? SAMPLE_EN : SAMPLE, css: q(r[3]) + ',' + tl, tail: r[4] };
  ORDER.push(r[0]);
});
SYS.forEach(function (r) {
  var fb = REG[r[3]];
  REG[r[0]] = { id: r[0], name: r[1], cat: 'パソコンの書体', family: r[2][0], locals: r[2], kind: 'sys', w: [400, 700], sample: SAMPLE, fb: r[3], tail: r[4],
    css: r[2].map(q).join(',') + ',' + q(fb.family) + ',' + TAIL[r[4]] };
  ORDER.push(r[0]);
});

function resolve(id) {
  if (typeof id !== 'string') return null;
  if (REG[id]) return REG[id];
  if (id.indexOf('local:') === 0 && id.length > 6) return regLocal(id.slice(6));
  if (id.indexOf('up:') === 0 && id.length > 3) return regUp(id, null);
  return REG[ALIAS[id]] || null;
}
function valid(id) { return !!resolve(id); }
function get(id) { return resolve(id) || REG['noto-sans-jp']; }
/* どの書体でも末尾に総称（sans-serif / serif）を必ず付ける。無いと該当書体が使えないとき、ブラウザ既定の明朝（MS 明朝など）になってしまう */
var SANS_TAIL = '"Noto Sans JP","Yu Gothic","Hiragino Sans","Meiryo",sans-serif';
function generic(c) { c = String(c || '').trim(); return /(^|,)\s*(sans-serif|serif|monospace|cursive)\s*$/i.test(c) ? c : (c ? c + ',' : '') + SANS_TAIL; }
function css(id) { return generic(get(id).css); }
function list() { var out = []; CATS.forEach(function (c) { ORDER.forEach(function (id) { if (REG[id].cat === c) out.push(REG[id]); }); }); return out; }
/* 旧 FONT_NAMES 形式 [[id, 表示名], …] */
function names() { return list().map(function (f) { return [f.id, f.name]; }); }

/* ---------- 太さ ---------- */
var WNAME = { 100: '極細', 200: '特細', 300: '細字', 400: '標準', 500: '中太', 600: '太め', 700: '太字', 800: '極太', 900: '最太' };
function nearest(id, w) {
  var ws = get(id).w, b = ws[0], d = 1e9; w = +w || 400;
  ws.forEach(function (x) { var k = Math.abs(x - w); if (k < d || (k === d && x > b)) { d = k; b = x; } });
  return b;
}
/* 太さの決め方：その書体にある太さならそのまま。無ければ近いもの。ただし太字（600以上）で最大が500以下の書体は 700 のまま（擬似太字） */
function snap(id, w) {
  var ws = get(id).w; w = +w || 400; if (ws.indexOf(w) >= 0) return w;
  if (w >= 600 && ws[ws.length - 1] < 600) return 700;
  return nearest(id, w);
}
function weights(id) { return get(id).w.slice(); }
function weightLabel(w) { return (WNAME[w] || '') + '（' + w + '）'; }

/* ---------- 読み込み（必要なときだけ） ---------- */
function gfUrl(f, ws, textParam) {
  var u = 'https://fonts.googleapis.com/css2?family=' + f.family.replace(/ /g, '+');
  if (ws && !(ws.length === 1 && ws[0] === 400)) u += ':wght@' + ws.join(';');
  if (textParam) u += '&text=' + encodeURIComponent(textParam);
  return u + '&display=swap';
}
var linked = {}, linkP = {};
function linkFor(f) {
  if (f.kind !== 'gf' || typeof document === 'undefined') return linkP[f.id] || Promise.resolve();
  if (linked[f.id]) return linkP[f.id];
  linked[f.id] = 1;
  var l = document.createElement('link'); l.rel = 'stylesheet'; l.setAttribute('data-jf', f.id); l.href = gfUrl(f, f.w);
  linkP[f.id] = new Promise(function (ok) { l.onload = function () { ok(true); }; l.onerror = function () { ok(false); }; setTimeout(function () { ok(false); }, 12000); });
  document.head.appendChild(l); return linkP[f.id];
}
/* 描画の前に呼ぶ：そのフォント（と代替のWebフォント）のCSSを読み込む（旧 loadFonts の代わり） */
function use(id) {
  var f = resolve(id); if (!f) return Promise.resolve();
  if (f.kind === 'gf') return linkFor(f); if (f.kind === 'up') return ensureUp(f.id); if (f.fb && REG[f.fb]) return linkFor(REG[f.fb]);
  return Promise.resolve();
}
/* 読み込み待ちの CSS（link）がすべて取得されるまで */
function linksReady() { return Promise.all(Object.keys(linkP).map(function (k) { return linkP[k]; })); }
function useAll(ids) { (ids || []).forEach(use); }

/* ---------- パソコンにあるか ---------- */
var hasCache = {}, cv = null;
function width(font, text) {
  if (!cv) cv = document.createElement('canvas'); var x = cv.getContext('2d'); x.font = '40px ' + font; return x.measureText(text).width;
}
function installed(name) {
  var T = 'あいうえお漢字mwiAbc0123', bases = ['monospace', 'serif', 'sans-serif'];
  return bases.some(function (b) { return Math.abs(width(q(name) + ',' + b, T) - width(b, T)) > 0.01; });
}
function has(id) {
  var f = resolve(id); if (!f) return false; if (f.kind === 'gf') return true; if (f.kind === 'up') return !f.missing;
  if (hasCache[f.id] === undefined) { try { hasCache[f.id] = f.locals.some(installed); } catch (e) { hasCache[f.id] = true; } }
  return hasCache[f.id];
}

/* ---------- 印刷・PDF・サムネイルの前：ページにある文字のぶんだけ確実に読み込む ---------- */
function prepare(rootEl, timeoutMs) {
  if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) return Promise.resolve();
  var roots = Array.isArray(rootEl) ? rootEl : [rootEl || document.body], map = {};
  function add(el) {
    var cs = getComputedStyle(el), key = cs.fontStyle + '|' + cs.fontWeight + '|' + cs.fontFamily, own = '';
    for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) own += c.nodeValue;
    if (!/\S/.test(own)) return;
    (map[key] || (map[key] = { st: cs.fontStyle, w: cs.fontWeight, fam: cs.fontFamily, set: {} }));
    (g.JukenText ? g.JukenText.seg(own) : Array.from(own)).forEach(function (ch) { map[key].set[ch] = 1; });
  }
  roots.forEach(function (r) { if (!r) return; if (r.nodeType === 1) add(r); Array.prototype.forEach.call(r.querySelectorAll('*'), add); });
  var jobs = Object.keys(map).map(function (k) {
    var m = map[k], text = Object.keys(m.set).join('');
    return function () { return document.fonts.load((m.st === 'italic' ? 'italic ' : '') + m.w + ' 16px ' + m.fam, text).catch(function () { }); };
  });
  var all = linksReady().then(function () { return Promise.all(jobs.map(function (j) { return j(); })); }).then(function () { return document.fonts.ready; });
  var tm = new Promise(function (r) { setTimeout(r, timeoutMs || 10000); });
  return Promise.race([all, tm]).then(function () { });
}

/* ---------- 一覧用の見本読み込み（&text= で軽く）。本体と衝突しないよう family 名を替える ---------- */
var prev = {};
function previewFamily(f) { return f.kind === 'gf' ? f.family + ' Prv' : f.family; }
function previewCss(f) {
  if (f.kind !== 'gf') return f.css;
  return q(previewFamily(f)) + ',' + f.css.split(',').slice(1).join(',');
}
function preview(id) {
  var f = resolve(id); if (!f || f.kind !== 'gf') return Promise.resolve();
  if (prev[f.id]) return prev[f.id];
  var text = f.name + f.sample + 'ABCabc';
  var uniq = Object.keys((g.JukenText ? g.JukenText.seg(text) : Array.from(text)).reduce(function (o, c) { o[c] = 1; return o; }, {})).join('');
  return (prev[f.id] = fetch(gfUrl(f, [f.w.indexOf(400) >= 0 ? 400 : f.w[0]], uniq)).then(function (r) { if (!r.ok) throw new Error('http'); return r.text(); }).then(function (t) {
    var st = document.createElement('style'); st.setAttribute('data-jfp', f.id);
    st.textContent = t.replace(/font-family:\s*(['"])([^'"]+)\1/g, function (m, qq, n) { return 'font-family:' + qq + n + ' Prv' + qq; });
    document.head.appendChild(st);
    return document.fonts.load('16px ' + q(previewFamily(f)), uniq).catch(function () { });
  }).catch(function () { delete prev[f.id]; }));
}

/* ---------- 最近使ったフォント ---------- */
var RK = 'juken-recent-fonts';
function recent() { try { var a = JSON.parse(localStorage.getItem(RK) || '[]'); return Array.isArray(a) ? a.filter(valid).map(function (x) { return resolve(x).id; }).filter(function (x, i, s) { return s.indexOf(x) === i; }).slice(0, 5) : []; } catch (e) { return []; } }
function pushRecent(id) {
  var f = resolve(id); if (!f) return;
  try { var a = recent().filter(function (x) { return x !== f.id; }); a.unshift(f.id); localStorage.setItem(RK, JSON.stringify(a.slice(0, 5))); } catch (e) { }
}

/* ---------- 名前 → レジストリ（PPTXの書体名・計算済みfont-family から） ---------- */
function norm(s) { return String(s || '').toLowerCase().replace(/[\s　_\-]/g, '').replace(/[Ａ-Ｚａ-ｚ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); }); }
var byFamily = null;
function famIndex() { if (!byFamily) { byFamily = {}; ORDER.forEach(function (id) { var f = REG[id]; byFamily[norm(f.family)] = id; (f.locals || []).forEach(function (n) { byFamily[norm(n)] = id; }); }); } return byFamily; }
/* face: 書体名。cjk: 本文に日本語が含まれるか */
function fromName(face, cjk) {
  var raw = String(face || '').trim(), n = norm(raw), ix = famIndex();
  if (!n) return 'noto-sans-jp';
  if (ix[n]) return ix[n];
  if (/^\+(mn|mj)-(lt|ea|cs)$/.test(n) || /^\+?(mn|mj)/.test(n)) return /mj/.test(n) ? 'noto-serif-jp' : 'noto-sans-jp';
  if (/ms(p)?ゴシック|msp?gothic/.test(n)) return 'ms-gothic';
  if (/ms(p)?明朝|msp?mincho/.test(n)) return 'ms-mincho';
  if (/游ゴシック|yugothic/.test(n)) return 'yu-gothic';
  if (/游明朝|yumincho/.test(n)) return 'yu-mincho';
  if (/メイリオ|meiryo/.test(n)) return 'meiryo';
  if (/ヒラギノ丸ゴ|hiraginomaru/.test(n)) return 'hiragino-maru';
  if (/ヒラギノ明朝|hiraginomincho/.test(n)) return 'hiragino-mincho';
  if (/ヒラギノ|hiragino/.test(n)) return 'hiragino-kaku';
  if (/ud(デジタル)?教科書|kyokasho|digikyo/.test(n)) return 'ud-kyokasho';
  if (/教科書体|hg教科書|klee/.test(n)) return 'klee-one';
  if (/正楷書|行書|毛筆|楷書|筆|brush/.test(n)) return 'yuji-syuku';
  if (/ポップ|ﾎﾟｯﾌﾟ|hgsoeikakupop/.test(n)) return 'mochiy-pop-one';
  if (/創英角ゴシックub|ゴシックub|ゴシックe|black|heavy|extrabold/.test(n) && /ゴシック|gothic/.test(n)) return 'dela-gothic-one';
  if (/丸|maru|rounded/.test(n)) return /ゴシック|gothic|丸/.test(n) ? 'zen-maru-gothic' : 'm-plus-rounded-1c';
  if (/bizud?p?明朝|bizud?p?mincho/.test(n)) return 'biz-udpmincho';
  if (/bizud?p?ゴシック|bizud?p?gothic|udゴシック|udgothic|udp/.test(n)) return 'biz-udpgothic';
  if (/明朝|mincho|ming|song/.test(n) && !/sans/.test(n)) return /明朝e|明朝b|black|bold|heavy/.test(n) ? 'shippori-mincho-b1' : 'biz-udpmincho';
  if (/ゴシック|gothic|角ゴ|kakugo/.test(n)) return 'biz-udpgothic';
  if (/couriernew|courier|consolas|monaco|menlo|mono/.test(n)) return 'roboto-mono';
  if (/calibri|candara|corbel|lato/.test(n)) return 'lato';
  if (/arial|helvetica|segoe|verdana|tahoma|roboto|opensans|sans|trebuchet|システム|system/.test(n)) return 'inter';
  if (/garamond|palatino/.test(n)) return 'cormorant-garamond';
  if (/times|georgia|cambria|century|bookantiqua|serif/.test(n)) return 'shippori-mincho';
  if (/impact|oswald|condensed/.test(n)) return 'oswald';
  if (/comic|handwrit|segoescript|手書き/.test(n)) return 'yomogi';
  return 'noto-sans-jp';
}
/* CSS の font-family リスト（"A","B",serif）から最初に当てはまるレジストリ id（無ければ ''） */
function fromCss(famList) {
  var ix = famIndex(), arr = String(famList || '').split(',');
  for (var i = 0; i < arr.length; i++) { var n = norm(arr[i].replace(/["']/g, '')); if (ix[n]) return ix[n]; }
  return '';
}

/* ---------- <select> を種類別（optgroup）で埋める（簡易UI用） ---------- */
function fillSelect(sel, cur) {
  sel.textContent = '';
  CATS.forEach(function (c) {
    var og = document.createElement('optgroup'); og.label = c;
    list().filter(function (f) { return f.cat === c; }).forEach(function (f) { var o = document.createElement('option'); o.value = f.id; o.textContent = f.name + (f.kind === 'sys' && !has(f.id) ? '（このPCにない）' : ''); og.appendChild(o); });
    sel.appendChild(og);
  });
  var r = resolve(cur); sel.value = r ? r.id : 'noto-sans-jp';
}

/* ---------- 選択UI ---------- */
var CSS_PICK = '.jfp{position:fixed;z-index:9999;width:312px;max-width:calc(100vw - 12px);display:flex;flex-direction:column;background:var(--jfp-bg,#fff);color:var(--jfp-fg,#262626);border:1px solid var(--jfp-bd,#c8c8c8);border-radius:4px;box-shadow:0 6px 22px rgba(0,0,0,.28);font:12px/1.4 "Segoe UI","Noto Sans JP","Yu Gothic UI","Hiragino Sans",Meiryo,sans-serif}' +
  '.jfp *{box-sizing:border-box}' +
  '.jfp-s{flex:none;padding:6px;border-bottom:1px solid var(--jfp-bd,#c8c8c8)}' +
  '.jfp-s input{width:100%;height:26px;padding:0 8px;border:1px solid var(--jfp-bd,#c8c8c8);border-radius:3px;background:var(--jfp-bg,#fff);color:inherit;font:inherit}' +
  '.jfp-l{overflow:auto;padding:2px 0 4px;min-height:60px}' +
  '.jfp-h{padding:6px 10px 2px;font-size:11px;font-weight:600;color:var(--jfp-mut,#666);position:sticky;top:0;background:var(--jfp-bg,#fff)}' +
  '.jfp-r{display:flex;align-items:center;gap:8px;width:100%;min-height:32px;padding:2px 10px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit}' +
  '.jfp-r.act{background:var(--jfp-hv,rgba(0,0,0,.09))}.jfp-r:hover{background:var(--jfp-hv,rgba(0,0,0,.09))}' +
  '.jfp-r.na{opacity:.45;cursor:default}' +
  '.jfp-ck{flex:none;width:14px;font-weight:700;color:var(--jfp-ac,#c4572e)}' +
  '.jfp-t{flex:1;min-width:0;display:flex;flex-direction:column}' +
  '.jfp-n{font-size:15px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
  '.jfp-m{font:10.5px/1.3 "Segoe UI","Yu Gothic UI",Meiryo,sans-serif;color:var(--jfp-mut,#666);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
  '.jfp-e{padding:14px 10px;color:var(--jfp-mut,#666)}' +
  '.jfp-st{flex:none;width:22px;height:22px;line-height:22px;text-align:center;border-radius:3px;color:var(--jfp-mut,#888);font-size:14px}.jfp-st:hover{background:var(--jfp-hv,rgba(0,0,0,.09))}.jfp-st.on{color:#d97706}' +
  '.jfp-f{flex:none;display:flex;flex-wrap:wrap;gap:4px;padding:6px;border-top:1px solid var(--jfp-bd,#c8c8c8)}' +
  '.jfp-f button{flex:1 1 auto;min-height:28px;padding:2px 8px;border:1px solid var(--jfp-bd,#c8c8c8);border-radius:3px;background:transparent;color:inherit;font:inherit;cursor:pointer;white-space:nowrap}.jfp-f button:hover{background:var(--jfp-hv,rgba(0,0,0,.09))}';
var DARK = '@media(prefers-color-scheme:dark){.jfp.auto{--jfp-bg:#1f2937;--jfp-fg:#e5e7eb;--jfp-bd:#4b5563;--jfp-mut:#9ca3af;--jfp-hv:rgba(255,255,255,.12);--jfp-ac:#60a5fa}}';
var pk = null;
function closePicker() { if (pk) { var p = pk; pk = null; p.cleanup(); p.el.remove(); if (p.o.onClose) p.o.onClose(); } }
/* o: {anchor, value, onPick(id), theme:'light'|'auto', onClose} */
function openPicker(o) {
  closePicker();
  if (!document.getElementById('jfp-css')) { var st = document.createElement('style'); st.id = 'jfp-css'; st.textContent = CSS_PICK + DARK; document.head.appendChild(st); }
  var std = Array.isArray(o.std) ? o.std : [], exact = std.some(function (x) { return x[0] === o.value; }), cur = exact ? null : resolve(o.value), el = document.createElement('div'); el.className = 'jfp' + (o.theme === 'light' ? '' : ' auto'); el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'フォントを選ぶ');
  var s = document.createElement('div'); s.className = 'jfp-s';
  var inp = document.createElement('input'); inp.type = 'search'; inp.placeholder = 'フォントを検索（名前・種類）'; inp.setAttribute('aria-label', 'フォントを検索'); inp.autocomplete = 'off'; inp.spellcheck = false; s.appendChild(inp);
  var ls = document.createElement('div'); ls.className = 'jfp-l'; ls.setAttribute('role', 'listbox'); el.appendChild(s); el.appendChild(ls);
  var ft = document.createElement('div'); ft.className = 'jfp-f'; el.appendChild(ft);
  function fbtn(t, fn, title) { var b = document.createElement('button'); b.type = 'button'; b.textContent = t; if (title) b.title = title; b.onmousedown = function (e) { e.preventDefault(); }; b.onclick = fn; ft.appendChild(b); return b; }
  fbtn('見本で比べる', function () { var op = { text: o.sample, value: o.value, w: o.weight, onPick: o.onPick }; closePicker(); openCompare(op); }, '実際の名前で並べて見比べる');
  if (localSupported()) fbtn('このパソコンのフォントを使う', function () { var bt = this; loadLocal().then(function () { build(inp.value); }).catch(function () { bt.textContent = '許可されませんでした'; }); }, 'パソコンに入っているフォントを一覧に出します（許可が必要）');
  fbtn('フォントを追加', function () { var op = { onClose: function () { build(inp.value); } }; openManager(op); }, 'TTF / OTF / WOFF のファイルを持ち込む');
  var rows = [], act = -1, io = null;
  function mkRow(f) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'jfp-r'; b.setAttribute('role', 'option'); b.setAttribute('data-id', f.id);
    var ok = f.kind === 'std' || has(f.id), isCur = cur && cur.id === f.id;
    if (!ok && !isCur) { b.classList.add('na'); b.setAttribute('aria-disabled', 'true'); }
    var ck = document.createElement('span'); ck.className = 'jfp-ck'; ck.textContent = isCur ? '✓' : ''; b.appendChild(ck);
    var t = document.createElement('span'); t.className = 'jfp-t';
    var n = document.createElement('span'); n.className = 'jfp-n'; n.textContent = f.name; n.style.fontFamily = f.kind === 'std' ? f.css : previewCss(f);
    var m = document.createElement('span'); m.className = 'jfp-m'; m.textContent = f.sample + (f.kind === 'sys' ? (ok ? '　・このPCにあります' : '　・このPCにはありません') : '');
    m.style.fontFamily = ''; t.appendChild(n); t.appendChild(m); b.appendChild(t);
    b._f = f; b._n = n;
    if (f.kind !== 'std') {
      var sb = document.createElement('span'); sb.className = 'jfp-st' + (isFav(f.id) ? ' on' : ''); sb.textContent = isFav(f.id) ? '★' : '☆'; sb.title = 'お気に入り'; sb.setAttribute('role', 'button'); sb.setAttribute('aria-label', 'お気に入り');
      sb.onmousedown = function (e) { e.preventDefault(); e.stopPropagation(); };
      sb.onclick = function (e) { e.preventDefault(); e.stopPropagation(); var on = toggleFav(f.id); sb.className = 'jfp-st' + (on ? ' on' : ''); sb.textContent = on ? '★' : '☆'; };
      b.appendChild(sb);
    }
    b.onmousedown = function (e) { e.preventDefault(); };
    b.onclick = function () { if (b.classList.contains('na')) return; pick(f); };
    b.onmousemove = function () { var i = rows.indexOf(b); if (i >= 0 && i !== act) setAct(i, true); };
    return b;
  }
  function pick(f) { if (f.kind !== 'std') { pushRecent(f.id); pushLocal(f.id); } var cb = o.onPick; closePicker(); if (cb) cb(f.id); }
  function setAct(i, noScroll) {
    if (rows[act]) rows[act].classList.remove('act'); act = i;
    if (rows[act]) { rows[act].classList.add('act'); if (!noScroll) rows[act].scrollIntoView({ block: 'nearest' }); }
  }
  function build(qs) {
    ls.textContent = ''; rows = []; act = -1; if (io) io.disconnect();
    chosenLocals().forEach(regLocal); (localAll || []).forEach(function (x) { regLocal(x.family); });
    var key = norm(qs), fs = list().filter(function (f) { return !key || norm(f.name + f.id + f.cat + f.family + (f.kw || '') + (f.locals || []).join('')).indexOf(key) >= 0; });
    function head(t) { var h = document.createElement('div'); h.className = 'jfp-h'; h.textContent = t; ls.appendChild(h); }
    function add(f) { var b = mkRow(f); ls.appendChild(b); rows.push(b); if (io) io.observe(b); }
    if (typeof IntersectionObserver !== 'undefined') io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { var b = e.target; io.unobserve(b); if (b._f.kind !== 'std') preview(b._f.id); } }); }, { root: ls, rootMargin: '120px' });
    else fs.forEach(function (f) { preview(f.id); });
    var ci0 = -1;
    if (!fs.length) { var em = document.createElement('div'); em.className = 'jfp-e'; em.textContent = '該当するフォントがありません'; ls.appendChild(em); return; }
    if (!key && std.length) { head('標準'); std.forEach(function (x) { var f0 = { id: x[0], name: x[1], sample: x[3] || '受験票 Abc 0123', kind: 'std', css: x[2] }; var b = mkRow(f0); b.querySelector('.jfp-ck').textContent = x[0] === o.value ? '✓' : ''; ls.appendChild(b); rows.push(b); }); }
    if (!key) { var fv = favList().map(resolve).filter(Boolean); if (fv.length) { head('★ お気に入り'); fv.forEach(add); } }
    if (!key) { var rc = recent().map(resolve).filter(Boolean); if (rc.length) { head('最近使ったフォント'); rc.forEach(add); } }
    CATS.forEach(function (c) {
      var g2 = fs.filter(function (f) { return f.cat === c && (c !== 'このパソコンのフォント' || key || localAll || chosenLocals().indexOf(f.family) >= 0); });
      if (c === 'このパソコンのフォント' && !key && !localAll) g2 = g2.filter(function (f) { return chosenLocals().indexOf(f.family) >= 0; });
      if (g2.length) { head(c + (c === 'パソコンの書体' ? '（このPCにある場合のみ）' : c === 'このパソコンのフォント' ? '（' + g2.length + '種類）' : '')); g2.forEach(add); }
    });
    var ci = -1; rows.forEach(function (b, i) { if (ci < 0 && ((cur && b._f.kind !== 'std' && b._f.id === cur.id) || (exact && b._f.kind === 'std' && b._f.id === o.value))) ci = i; });
    if (key) { var first1 = -1; rows.forEach(function (b, i) { if (first1 < 0 && !b.classList.contains('na')) first1 = i; }); setAct(first1, true); }
    else if (ci >= 0) { setAct(ci, true); }
  }
  build('');
  if (localSupported()) autoLocal().then(function (r) { if (r && pk && pk.el === el) build(inp.value); });
  inp.oninput = function () { build(inp.value); };
  function step(d) { if (!rows.length) return; var i = act, n = rows.length; for (var k = 0; k < n; k++) { i = (i + d + n) % n; if (!rows[i].classList.contains('na')) break; } setAct(i); }
  el.onkeydown = function (e) {
    var k = e.key;
    if (k === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); step(1); }
    else if (k === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); step(-1); }
    else if (k === 'PageDown') { e.preventDefault(); e.stopPropagation(); step(6); }
    else if (k === 'PageUp') { e.preventDefault(); e.stopPropagation(); step(-6); }
    else if (k === 'Enter') { e.preventDefault(); e.stopPropagation(); if (rows[act] && !rows[act].classList.contains('na')) pick(rows[act]._f); }
    else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); closePicker(); }
    else e.stopPropagation();
  };
  document.body.appendChild(el);
  var r = o.anchor ? o.anchor.getBoundingClientRect() : { left: 20, top: 20, bottom: 20, right: 20 }, W = el.offsetWidth, vh = innerHeight;
  var below = vh - r.bottom - 10, above = r.top - 10, up = below < 260 && above > below, mh = Math.max(180, Math.min(440, up ? above : below));
  ls.style.maxHeight = (mh - 40) + 'px';
  el.style.left = Math.max(6, Math.min(r.left, innerWidth - W - 6)) + 'px';
  el.style.top = up ? Math.max(6, r.top - el.offsetHeight - 2) + 'px' : (r.bottom + 2) + 'px';
  function md(e) { if (!el.contains(e.target) && !(o.anchor && o.anchor.contains(e.target))) closePicker(); }
  function rz() { closePicker(); }
  document.addEventListener('mousedown', md, true); window.addEventListener('resize', rz);
  pk = { el: el, o: o, cleanup: function () { document.removeEventListener('mousedown', md, true); window.removeEventListener('resize', rz); if (io) io.disconnect(); } };
  inp.focus();
  if (act >= 0 && rows[act]) rows[act].scrollIntoView({ block: 'center' });
  return el;
}

/* ---------- パソコンのフォント（Local Font Access API）・持ち込みフォント・お気に入り ---------- */
var LK = 'juken-local-fonts', FK = 'juken-fav-fonts', localAll = null, share = null;
function lsGet(k) { try { var a = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function lsSet(k, a) { try { localStorage.setItem(k, JSON.stringify(a)); } catch (e) { } }
function isSerifName(n) { return /明朝|mincho|serif|ming|song|roman|garamond|times|cambria|georgia|palatino|century/i.test(n); }
function isRoundName(n) { return /丸|maru|rounded/i.test(n); }
function changed() { try { window.dispatchEvent(new Event('juken-fonts')); } catch (e) { } }
/* このパソコンのフォント：id は 'local:<family>'。登録は resolve から自動（保存済みデザインの id をそのまま解決できる） */
function regLocal(family) {
  var id = 'local:' + family; if (REG[id]) return REG[id];
  var tl = isSerifName(family) ? 'serif' : isRoundName(family) ? 'round' : 'sans';
  REG[id] = { id: id, name: family, cat: 'このパソコンのフォント', family: family, locals: [family], kind: 'local', w: [400, 700], sample: SAMPLE, tail: tl, css: q(family) + ',' + TAIL[tl] };
  ORDER.push(id); return REG[id];
}
function localSupported() { return typeof window !== 'undefined' && typeof window.queryLocalFonts === 'function'; }
function chosenLocals() { return lsGet(LK).filter(function (x) { return typeof x === 'string'; }); }
function pushLocal(id) { var f = resolve(id); if (!f || f.kind !== 'local') return; var a = chosenLocals().filter(function (x) { return x !== f.family; }); a.unshift(f.family); lsSet(LK, a.slice(0, 200)); }
/* すべてのフォントを取得（ユーザー操作の中で呼ぶ。許可ダイアログが出る）→ Promise<[{family,styles}]> */
function loadLocal() {
  if (!localSupported()) return Promise.reject(new Error('unsupported'));
  return window.queryLocalFonts().then(function (arr) {
    var m = {}; arr.forEach(function (f) { var fam = f.family; if (!fam) return; (m[fam] || (m[fam] = { family: fam, styles: [], full: f.fullName })).styles.push(f.style); });
    localAll = Object.keys(m).sort(function (a, b) { return a.localeCompare(b, 'ja'); }).map(function (k) { return m[k]; });
    changed(); return localAll;
  });
}
function localListed() { return localAll; }
function autoLocal() {
  if (localAll || !localSupported() || !navigator.permissions || !navigator.permissions.query) return Promise.resolve(null);
  return navigator.permissions.query({ name: 'local-fonts' }).then(function (st) { return st.state === 'granted' ? loadLocal() : null; }).catch(function () { return null; });
}

/* 持ち込みフォント（TTF/OTF/WOFF/WOFF2）：このブラウザの IndexedDB に保存。id は 'up:<名前>-<ハッシュ>'、CSSの family は 'JF <名前>-<ハッシュ>' */
function upFamily(id) { return 'JF ' + id.slice(3); }
function regUp(id, label) {
  if (REG[id]) { if (label) REG[id].name = label; return REG[id]; }
  var fam = upFamily(id);
  REG[id] = { id: id, name: label || id.slice(3).replace(/-[0-9a-f]{6}$/, ''), cat: '持ち込み', family: fam, kind: 'up', w: [400, 700], sample: SAMPLE, tail: 'sans', css: q(fam) + ',' + TAIL.sans, missing: true, loading: false };
  ORDER.push(id); if (label !== null) return REG[id];
  ensureUp(id); return REG[id];
}
var idbP = null;
function idb() {
  if (idbP) return idbP;
  idbP = new Promise(function (ok, ng) {
    try { var r = indexedDB.open('juken-fonts', 1); r.onupgradeneeded = function () { r.result.createObjectStore('fonts', { keyPath: 'id' }); }; r.onsuccess = function () { ok(r.result); }; r.onerror = function () { ng(r.error); }; } catch (e) { ng(e); }
  });
  return idbP;
}
function idbAll() { return idb().then(function (db) { return new Promise(function (ok, ng) { var q2 = db.transaction('fonts').objectStore('fonts').getAll(); q2.onsuccess = function () { ok(q2.result || []); }; q2.onerror = function () { ng(q2.error); }; }); }); }
function idbPut(e) { return idb().then(function (db) { return new Promise(function (ok, ng) { var t = db.transaction('fonts', 'readwrite'); t.objectStore('fonts').put(e); t.oncomplete = ok; t.onerror = function () { ng(t.error); }; }); }); }
function idbDel(id) { return idb().then(function (db) { return new Promise(function (ok, ng) { var t = db.transaction('fonts', 'readwrite'); t.objectStore('fonts').delete(id); t.oncomplete = ok; t.onerror = function () { ng(t.error); }; }); }); }
function addFace(id, buf, label) {
  var f = regUp(id, label || ''), ff = new FontFace(upFamily(id), buf.slice(0), { weight: '100 900' });
  return ff.load().then(function () { document.fonts.add(ff); f.missing = false; f.loading = false; changed(); return f; });
}
var upLoading = {};
/* 'up:' の id を使うとき：このブラウザに無ければ共有（ファイル保管）から取得して読み込む */
function ensureUp(id) {
  var f = REG[id]; if (f && !f.missing) return Promise.resolve(f);
  if (upLoading[id]) return upLoading[id];
  if (f) f.loading = true;
  return (upLoading[id] = idbAll().catch(function () { return []; }).then(function (all) {
    var e = all.filter(function (x) { return x.id === id; })[0];
    if (e) return addFace(id, e.buf, e.name);
    if (share && share.fetch) return share.fetch(id).then(function (r) { if (!r) throw new Error('none'); return addFace(id, r.buf, r.name).then(function (ff) { idbPut({ id: id, name: r.name, buf: r.buf, at: Date.now(), shared: true }).catch(function () { }); return ff; }); });
    throw new Error('none');
  }).then(function (r) { delete upLoading[id]; return r; }, function () { if (REG[id]) REG[id].loading = false; delete upLoading[id]; return null; }));
}
function loadUps() { return idbAll().then(function (all) { return Promise.all(all.map(function (e) { return addFace(e.id, e.buf, e.name).catch(function () { }); })); }).catch(function () { }); }
function hash6(u8) { var h = 5381, n = Math.min(u8.length, 65536); for (var i = 0; i < n; i++) h = ((h << 5) + h + u8[i]) | 0; h = (h ^ u8.length) >>> 0; return ('000000' + h.toString(16)).slice(-6); }
/* ファイル → 登録。戻り値 Promise<{id,name,buf}> */
function addFontFile(file) {
  return new Promise(function (ok, ng) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = function () { ng(new Error('読み込めませんでした')); }; r.readAsArrayBuffer(file); }).then(function (buf) {
    var u8 = new Uint8Array(buf);
    var magic = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
    if (!(magic === 'wOFF' || magic === 'wOF2' || magic === 'OTTO' || magic === 'true' || (u8[0] === 0 && u8[1] === 1 && u8[2] === 0 && u8[3] === 0))) throw new Error('フォントファイルではないようです（TTF / OTF / WOFF / WOFF2 に対応）');
    var label = String(file.name || 'font').replace(/\.[A-Za-z0-9]{2,5}$/, '').trim() || 'font';
    var slug = label.replace(/[^A-Za-z0-9぀-ヿ一-鿿]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'font';
    var id = 'up:' + slug + '-' + hash6(u8);
    return addFace(id, buf, label).then(function () { return idbPut({ id: id, name: label, buf: buf, at: Date.now(), shared: false }).catch(function () { }).then(function () { return { id: id, name: label, buf: buf }; }); });
  });
}
function removeUp(id) { var f = REG[id]; if (f) { f.missing = true; } return idbDel(id).catch(function () { }).then(changed); }
function setShare(o) { share = o; }
function upList() { return list().filter(function (f) { return f.kind === 'up' && !f.missing; }); }

/* フォント管理ダイアログ（持ち込みの追加・削除・共有） */
function openManager(o) {
  o = o || {}; var w = document.createElement('div'); w.id = 'jfm'; w.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px';
  var c = document.createElement('div'); c.style.cssText = 'width:100%;max-width:460px;max-height:86vh;overflow:auto;background:var(--panel,#fff);color:var(--fg,#1f2937);border:1px solid var(--bd,#d1d5db);border-radius:10px;padding:16px;font:13px/1.5 "Noto Sans JP","Yu Gothic UI",Meiryo,sans-serif';
  w.appendChild(c);
  function E(t, x, st) { var e = document.createElement(t); if (x != null) e.textContent = x; if (st) e.style.cssText = st; return e; }
  function close() { w.remove(); if (o.onClose) o.onClose(); }
  var msg = '';
  function render() {
    c.textContent = '';
    c.appendChild(E('h3', 'フォントを追加（持ち込み）', 'margin:0 0 8px;font-size:15px'));
    c.appendChild(E('p', 'TTF / OTF / WOFF / WOFF2 のファイルを選ぶと、このブラウザに保存され、受験票・PDFで使えます。', 'margin:0 0 8px'));
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.ttf,.otf,.woff,.woff2'; inp.multiple = true; inp.setAttribute('aria-label', 'フォントファイル'); c.appendChild(inp);
    var sh = document.createElement('label'); sh.style.cssText = 'display:flex;gap:6px;align-items:flex-start;margin:10px 0 2px'; var cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'jfm-share'; cb.disabled = !(share && share.upload);
    sh.appendChild(cb); sh.appendChild(E('span', 'チームに共有する（ほかの人がこのフォントを使ったデザインを開くと自動で読み込まれます）')); c.appendChild(sh);
    c.appendChild(E('div', '学校で使用許諾のあるフォントだけ共有してください。', 'font-size:12px;color:var(--warn,#b45309);background:var(--warnbg,#fef3c7);border-radius:6px;padding:6px 8px;margin:6px 0'));
    var st = E('div', msg, 'min-height:18px;font-size:12px;color:var(--mut,#6b7280)'); st.id = 'jfm-st'; c.appendChild(st);
    inp.onchange = function () {
      var fs = Array.prototype.slice.call(inp.files || []); inp.value = ''; var okn = 0, errs = [];
      fs.reduce(function (p, f) {
        return p.then(function () {
          st.textContent = f.name + ' を読み込み中…';
          return addFontFile(f).then(function (r) { okn++; if (cb.checked && share && share.upload) return Promise.resolve(share.upload({ id: r.id, name: r.name, buf: r.buf, file: f })).catch(function (e) { errs.push(f.name + '：共有に失敗（' + ((e && e.message) || e) + '）'); }); });
        }).catch(function (e) { errs.push(f.name + '：' + ((e && e.message) || '読み込めませんでした')); });
      }, Promise.resolve()).then(function () { msg = (okn ? okn + '件追加しました。' : '') + errs.join(' '); render(); });
    };
    var ups = upList();
    if (ups.length) {
      c.appendChild(E('b', '追加済みのフォント', 'display:block;margin:8px 0 4px'));
      ups.forEach(function (f) {
        var r = E('div', '', 'display:flex;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid var(--bd,#d1d5db)');
        r.appendChild(E('span', f.name + '　受験票 Abc 012', 'flex:1;min-width:0;font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:' + f.css));
        var rm = E('button', '削除'); rm.type = 'button'; rm.onclick = function () { removeUp(f.id).then(function () { msg = ''; render(); }); }; r.appendChild(rm); c.appendChild(r);
      });
    }
    var bb = E('div', '', 'display:flex;justify-content:flex-end;margin-top:12px'); var x = E('button', '閉じる'); x.type = 'button'; x.onclick = close; bb.appendChild(x); c.appendChild(bb);
  }
  render(); w.addEventListener('mousedown', function (e) { if (e.target === w) close(); });
  w.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  document.body.appendChild(w);
}

/* お気に入り */
function favList() { return lsGet(FK).filter(valid).map(function (x) { return resolve(x).id; }); }
function isFav(id) { var f = resolve(id); return !!f && favList().indexOf(f.id) >= 0; }
function toggleFav(id) { var f = resolve(id); if (!f) return false; var a = favList(), i = a.indexOf(f.id); if (i >= 0) a.splice(i, 1); else a.unshift(f.id); lsSet(FK, a.slice(0, 100)); return i < 0; }

/* 近い Web フォントの提案（パソコンの書体が無いとき用） */
function suggest(family) { var id = fromName(family); var r = REG[id]; return r ? r.name : 'Noto Sans JP'; }

/* ---------- 書体の見本比べ（実際の名前で並べて選ぶ） ---------- */
/* o: {text, value, w, onPick(id, weight)} */
function openCompare(o) {
  o = o || {}; var text = String(o.text || '山田 太郎').slice(0, 24), w = document.createElement('div'); w.id = 'jfc'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', '書体の見本比べ');
  w.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:12px';
  var c = document.createElement('div'); c.style.cssText = 'width:100%;max-width:980px;height:min(86vh,760px);display:flex;flex-direction:column;background:var(--panel,#fff);color:var(--fg,#1f2937);border:1px solid var(--bd,#d1d5db);border-radius:10px;font:13px/1.4 "Noto Sans JP","Yu Gothic UI",Meiryo,sans-serif;overflow:hidden';
  w.appendChild(c);
  function E(t, x, st) { var e = document.createElement(t); if (x != null) e.textContent = x; if (st) e.style.cssText = st; return e; }
  var top = E('div', '', 'flex:none;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid var(--bd,#d1d5db)');
  top.appendChild(E('b', '書体を見比べる', 'font-size:15px'));
  var ti = document.createElement('input'); ti.type = 'text'; ti.value = text; ti.setAttribute('aria-label', '見本の文字'); ti.style.cssText = 'flex:1;min-width:120px;max-width:300px;height:28px;padding:0 8px'; top.appendChild(ti);
  var wt = document.createElement('select'); wt.setAttribute('aria-label', '太さ'); [[400, '標準'], [700, '太字']].forEach(function (x) { var op = document.createElement('option'); op.value = x[0]; op.textContent = x[1]; wt.appendChild(op); }); wt.value = String(o.w >= 600 ? 700 : 400); top.appendChild(wt);
  var xb = E('button', '閉じる'); xb.type = 'button'; xb.style.marginLeft = 'auto'; top.appendChild(xb); c.appendChild(top);
  var chips = E('div', '', 'flex:none;display:flex;gap:6px;flex-wrap:wrap;padding:6px 12px;border-bottom:1px solid var(--bd,#d1d5db)'); c.appendChild(chips);
  var grid = E('div', '', 'flex:1;min-height:0;overflow:auto;padding:10px 12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;align-content:start'); c.appendChild(grid);
  var cat = '★・最近', io = null;
  function cats() { var a = ['★・最近', '全部']; CATS.forEach(function (k) { if (list().some(function (f) { return f.cat === k; })) a.push(k); }); return a; }
  function items() {
    if (cat === '★・最近') {
      var ids = favList().concat(recent()).filter(function (x, i, s) { return s.indexOf(x) === i; });
      if (o.value && valid(o.value) && ids.indexOf(resolve(o.value).id) < 0) ids.unshift(resolve(o.value).id);
      var out = ids.map(resolve).filter(Boolean);
      ['noto-sans-jp', 'biz-udpgothic', 'zen-maru-gothic', 'shippori-mincho', 'noto-serif-jp', 'klee-one', 'yuji-syuku', 'dela-gothic-one', 'm-plus-rounded-1c', 'zen-kaku-gothic-new', 'biz-udpmincho', 'zen-old-mincho'].forEach(function (id) { var f = REG[id]; if (f && out.indexOf(f) < 0 && out.length < 12) out.push(f); });
      return out;
    }
    return list().filter(function (f) { return cat === '全部' || f.cat === cat; });
  }
  function draw() {
    grid.textContent = ''; if (io) io.disconnect();
    chips.textContent = ''; cats().forEach(function (k) { var b = E('button', k, 'padding:2px 10px;border-radius:12px' + (k === cat ? ';font-weight:700;outline:2px solid var(--ac,#1d4ed8)' : '')); b.type = 'button'; b.onclick = function () { cat = k; draw(); }; chips.appendChild(b); });
    io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); use(e.target._id); } }); }, { root: grid, rootMargin: '200px' }) : null;
    var t = ti.value || '山田 太郎', wv = +wt.value, cur = o.value && resolve(o.value);
    items().forEach(function (f) {
      var ok = f.kind === 'std' || has(f.id);
      var b = E('button', '', 'text-align:left;padding:8px 10px;border:1px solid var(--bd,#d1d5db);border-radius:6px;background:var(--inp,#fff);color:inherit;cursor:pointer;display:flex;flex-direction:column;gap:4px;min-width:0' + (cur && cur.id === f.id ? ';outline:2px solid var(--ac,#1d4ed8)' : '') + (ok ? '' : ';opacity:.5')); b.type = 'button'; b._id = f.id; b.setAttribute('data-id', f.id);
      var s = E('span', t, 'font-size:24px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:' + snap(f.id, wv) + ';font-family:' + css(f.id));
      b.appendChild(s); b.appendChild(E('span', f.name + (ok ? '' : '（このPCにない）'), 'font-size:11px;color:var(--mut,#6b7280);white-space:nowrap;overflow:hidden;text-overflow:ellipsis'));
      b.onclick = function () { if (!ok) return; w.remove(); pushRecent(f.id); pushLocal(f.id); if (o.onPick) o.onPick(f.id, snap(f.id, +wt.value)); };
      grid.appendChild(b); if (io) io.observe(b); else use(f.id);
    });
  }
  ti.oninput = draw; wt.onchange = draw; draw();
  xb.onclick = function () { w.remove(); };
  w.addEventListener('mousedown', function (e) { if (e.target === w) w.remove(); });
  w.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); w.remove(); } });
  document.body.appendChild(w); ti.focus();
  return w;
}


g.JukenFonts = {
  CATS: CATS, REG: REG, ALIAS: ALIAS, list: list, names: names, get: get, resolve: resolve, valid: valid, css: css, has: has,
  weights: weights, nearest: nearest, snap: snap, weightLabel: weightLabel, use: use, useAll: useAll, linksReady: linksReady, prepare: prepare, preview: preview,
  recent: recent, pushRecent: pushRecent, fromName: fromName, fromCss: fromCss, fillSelect: fillSelect, openPicker: openPicker, closePicker: closePicker,
  gfUrl: gfUrl, previewCss: previewCss,
  localSupported: localSupported, loadLocal: loadLocal, localListed: localListed, autoLocal: autoLocal, chosenLocals: chosenLocals, pushLocal: pushLocal,
  addFontFile: addFontFile, removeUp: removeUp, ensureUp: ensureUp, setShare: setShare, openManager: openManager, upList: upList,
  favList: favList, isFav: isFav, toggleFav: toggleFav, suggest: suggest, openCompare: openCompare
};
if (typeof indexedDB !== 'undefined') loadUps();
})(window);
