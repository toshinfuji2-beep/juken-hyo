/* 取り込んだPDF・画像から、受験番号・氏名などの場所を自動で見つける。window.DesignDetect
   - 文字の箱（{text,x,y,w,h,size} mm）から差し込み候補を推定する共通ロジック（PPTXもPDFも画像も同じ）
   - PDFの文字情報（pdf.js）・画像のOCR（Tesseract.js。必要なときだけ読み込み、すべてブラウザ内で処理）
   - 背景ピクセルの色サンプリング（元の文字を隠す四角と、文字色の推定） */
(function (g) {
'use strict';
var LIB = {
  tess: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  lang: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/jpn/4.0.0_best_int'
};
var JTX = g.JukenText;
var libP = {};
function loadScript(u) {
  return libP[u] || (libP[u] = new Promise(function (ok, ng) {
    var s = document.createElement('script'); s.src = u; s.onload = ok;
    s.onerror = function () { delete libP[u]; ng(new Error('lib')); }; document.head.appendChild(s);
  }));
}

/* ---------- 文字の正規化 ---------- */
function halfDigits(s) { return String(s).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }); }
var CJK = '\u3000-\u30ff\u3400-\u9fff\uf900-\ufaff\uff00-\uffef\u{20000}-\u{3134F}';
var RE_CJK_GAP = new RegExp('([' + CJK + '])[ \u3000]+(?=[' + CJK + '])', 'gu');
/* OCR文字列の整形：全角数字→半角、日本語どうしの間の空白を詰める */
function cleanText(s) { return halfDigits(String(s == null ? '' : s)).replace(/[\r\n]+/g, ' ').replace(RE_CJK_GAP, '$1').replace(/^[ 　]+|[ 　]+$/g, ''); }
function normLbl(t) { return String(t || '').replace(/[\s　:：・\/／\-|｜.。,、_＿]/g, ''); }
/* OCRの取り違えを寄せる（力↔カ、畨↔番 など） */
var CONF_MAP = { '力': 'カ', '畨': '番', '夕': 'タ', '騒': '験', '験': '験', '検': '験', '氏': '氏', '己': '名' };
function confus(n) { return n.replace(/[力畨夕騒検]/g, function (c) { return CONF_MAP[c] || c; }); }
function lev(a, b) {
  var m = a.length, n = b.length, d = [], i, j;
  for (i = 0; i <= m; i++) { d[i] = [i]; }
  for (j = 1; j <= n; j++) d[0][j] = j;
  for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

/* ---------- 項目ラベルの判定 ---------- */
var LBL = [
  [/(カナ|ｶﾅ|フリガナ|ふりがな|ﾌﾘｶﾞﾅ|ヨミ|よみ)/, 'カナ氏名'],
  [/^(受験|受検|生徒|会員)?(番号|No\.?|NO\.?|ID)$/i, '受験番号'],
  [/^(受験|受検)(番号|No)/i, '受験番号'],
  [/^(氏名|名前|お名前|生徒名|漢字氏名|氏名漢字|受験者名|受験者|姓名)(\(漢字\)|（漢字）)?$/, '氏名'],
  [/^(志望学部|志望学科|志望|学部|学部名)$/, '志望学部'],
  [/^(試験)?教室$|^座席$|^教室名$/, '教室'],
  [/^(学校名|学校|高校|在籍校|出身校)$/, '学校名'],
  [/^学年$/, '学年']
];
var CANON = [['受験番号', '受験番号'], ['志望学部', '志望学部'], ['志望学科', '志望学部'], ['フリガナ', 'カナ氏名'], ['カナ氏名', 'カナ氏名'], ['氏名カナ', 'カナ氏名'], ['受験者名', '氏名'], ['お名前', '氏名'], ['漢字氏名', '氏名'], ['生徒氏名', '氏名'], ['学校名', '学校名'], ['教室名', '教室']];
function labelOf(text, fuzzy) {
  var n = normLbl(text), i;
  if (!n || n.length > 9) return '';
  for (i = 0; i < LBL.length; i++) if (LBL[i][0].test(n)) return LBL[i][1];
  if (fuzzy) {
    var c = confus(n);
    if (c !== n) for (i = 0; i < LBL.length; i++) if (LBL[i][0].test(c)) return LBL[i][1];
    if (c.length >= 4) for (i = 0; i < CANON.length; i++) if (Math.abs(c.length - CANON[i][0].length) <= 1 && lev(c, CANON[i][0]) <= 1) return CANON[i][1];
  }
  return '';
}

/* 「受験番号 12345」のように、ラベルと値が1つの箱になっているものを分ける */
function splitLabelValue(b, fuzzy) {
  var t = String(b.text);
  if (labelOf(t, fuzzy)) return null;
  var s = JTX.trim(t.replace(/\s+/g, ' ')), sg = JTX.seg(s), best = null;
  for (var k = 2; k <= Math.min(7, sg.length - 1); k++) {
    var head = sg.slice(0, k).join(''), rest = sg.slice(k).join(''), tail = rest.replace(/^[\s:：|｜]+/, '');
    var sep = /^[\s:：|｜]/.test(rest);
    if (tail && labelOf(head, fuzzy) && (k >= 3 || sep) && JTX.len(tail) <= 24 && !/^[ぁ-んー、。]/.test(tail) && !/^[\s:：]+$/.test(tail)) { best = { k: k, head: head, tail: tail }; }
  }
  if (!best) return null;
  var r = best.k / sg.length, wl = b.w * r, wr = b.w - wl;
  return [Object.assign({}, b, { text: best.head, w: wl }), Object.assign({}, b, { text: best.tail, x: b.x + wl + (wr > 4 ? 0 : 0), w: wr })];
}

/* ---------- 差し込み候補の推定（共通） ----------
   els: [{id,text,x,y,w,h,size}]（mm・pt）。戻り値: [{eid,label,why,conf}]。conf=0〜1 */
function suggest(els, opt) {
  opt = opt || {}; var fuzzy = !!opt.fuzzy, labels = [], out = [], used = {};
  els.forEach(function (e) { var l = labelOf(e.text, fuzzy); if (l) labels.push({ e: e, label: l }); });
  var isLab = {}; labels.forEach(function (l) { isLab[l.e.id] = 1; });
  var GEN = /^.{1,5}(番号|名|日|場|制度|時間|会場|科目|区分|種別|住所)[：:]?$/;
  var cands = els.filter(function (e) { return !isLab[e.id] && !GEN.test(normLbl(e.text)); });
  var sizeK = fuzzy ? 0.6 : 0.9, pen = fuzzy ? 0.12 : 0;
  /* ラベルと値の全組み合わせを近い順に並べ、近いものから1対1で決める（隣の項目のラベルに値を取られない） */
  /* 値の種類がラベルに合うか：受験番号に名前、氏名に数字だけ、を対にしない（OCRでラベルを読み落としたときのずれ防止） */
  function valueFits(lab, t) {
    t = JTX.trim(String(t || '')); var num = /^[0-9A-Za-z０-９Ａ-Ｚａ-ｚ\-－.・\s]{1,14}$/.test(t) && /[0-9０-９]/.test(t), kind = JTX.classifyName(t);
    if (/番号/.test(lab)) return num;
    if (lab === '氏名' || lab === 'カナ氏名') return !num && !/^[0-9０-９\s\-－:：\/年月日時分]+$/.test(t);
    return true;
  }
  function rowOwner(c, a) {
    return labels.some(function (L2) { var b = L2.e; if (b === a) return false; var ov = Math.min(b.y + b.h, c.y + c.h) - Math.max(b.y, c.y); return ov > 0.3 * Math.min(b.h, c.h) && c.x >= b.x + b.w * 0.4 && c.x - (b.x + b.w) < 90; });
  }
  var pairs = [];
  labels.forEach(function (L, li) {
    var a = L.e;
    cands.forEach(function (c) {
      if (c.size < a.size * sizeK) return;
      if (!valueFits(L.label, c.text)) return;
      var ov = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y), mh = Math.min(a.h, c.h);
      var right = c.x - (a.x + a.w), sc, kind;
      if (ov > 0.3 * mh && c.x >= a.x + a.w * 0.4 && right < 90) { sc = Math.max(0, right) + Math.abs((c.y + c.h / 2) - (a.y + a.h / 2)) * 0.4; kind = 'r'; }
      else {
        var below = c.y - (a.y + a.h * 0.5), cxm = c.x + c.w / 2;
        if (below > 0 && below < 40 && cxm > a.x - 10 && cxm < a.x + a.w + 60) { sc = 100 + below * 1.5; kind = 'b'; } else return;
        if (rowOwner(c, a)) return;   /* 同じ行の左に別のラベルがある値は、そのラベルのもの（上のラベルに取られない） */
      }
      pairs.push({ li: li, c: c, s: sc, kind: kind });
    });
  });
  pairs.sort(function (p, q) { return p.s - q.s; });
  var doneL = {};
  pairs.forEach(function (P) {
    if (doneL[P.li] || used[P.c.id]) return;
    doneL[P.li] = 1; used[P.c.id] = 1;
    var L = labels[P.li], conf = P.kind === 'r' ? (P.s < 30 ? 0.92 : 0.8) : 0.72; conf -= pen;
    out.push({ eid: P.c.id, label: L.label, why: '「' + String(L.e.text).trim() + '」の' + (P.kind === 'r' ? '右' : '下'), conf: conf });
  });
  var have = function (l) { return out.some(function (o) { return o.label === l; }); };
  var byId = {}; els.forEach(function (e) { byId[e.id] = e; });
  /* 値の種類で氏名／カナ氏名を直す：「氏名」の値がカナ・かなだけなら、カナ氏名とみなす（漢字氏名が別に見つかっていないとき） */
  out.forEach(function (o) {
    var el0 = byId[o.eid];
    if (o.label === '氏名' && el0 && JTX.classifyName(el0.text) === 'カナ氏名' && !have('カナ氏名')) { o.label = 'カナ氏名'; o.why += '（値がカナだけなので）'; }
  });
  var GENV = /(学部|学科|学校|高校|大学|教室|会場|試験|時間|番号|受験|票|科目|制度)$/;
  cands.forEach(function (c) {
    if (used[c.id]) return; var t = halfDigits(JTX.trim(c.text)), tn = JTX.len(t), kind = JTX.classifyName(t);
    if (!have('受験番号') && /^[0-9]{1,10}$/.test(t) && t.length <= 8 && !/^(19|20)[0-9]{2}$/.test(t)) { out.push({ eid: c.id, label: '受験番号', why: '数字だけの文字', conf: 0.55 - pen }); used[c.id] = 1; }
    else if (!have('カナ氏名') && kind === 'カナ氏名' && tn >= 3 && !/\s\s/.test(t)) { out.push({ eid: c.id, label: 'カナ氏名', why: 'カナ（ひらがな）だけの文字', conf: 0.55 - pen }); used[c.id] = 1; }
    else if (!have('氏名') && kind === '氏名' && tn <= 12 && !GENV.test(t) && !GEN.test(normLbl(t)) && (/[ \u3000]/.test(t) ? /^[^ \u3000]{1,6}[ \u3000][^ \u3000]{1,6}$/.test(t) : (tn >= 2 && tn <= 5 && !/[A-Za-z・.]/.test(t)))) { out.push({ eid: c.id, label: '氏名', why: '名前のような文字', conf: (/[ \u3000]/.test(t) ? 0.5 : 0.4) - pen }); used[c.id] = 1; }
  });
  /* ふりがな（カナ）の直下／直上にある、漢字の氏名（ルビのような2段）も拾う */
  var kOut = out.filter(function (o) { return o.label === 'カナ氏名'; })[0], nOut = out.filter(function (o) { return o.label === '氏名'; })[0];
  function pairNear(a, wantKind, above) {
    var best = null, bd = 1e9;
    els.forEach(function (c) {
      if (used[c.id] || isLab[c.id] || c === a) return;
      var tx = JTX.trim(c.text); if (JTX.classifyName(tx) !== wantKind || JTX.len(tx) > 14 || GEN.test(normLbl(tx)) || GENV.test(tx)) return;
      var gap = above ? a.y - (c.y + c.h) : c.y - (a.y + a.h), ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
      if (gap < -0.35 * Math.min(a.h, c.h) || gap > 1.8 * Math.max(a.h, c.h) + 2 || ox < 0.3 * Math.min(a.w, c.w)) return;
      var d = Math.abs(gap) + Math.abs((c.x + c.w / 2) - (a.x + a.w / 2)) * 0.2; if (d < bd) { bd = d; best = c; }
    });
    return best;
  }
  if (kOut && !nOut && byId[kOut.eid]) { var nm = pairNear(byId[kOut.eid], '氏名', false); if (nm) { out.push({ eid: nm.id, label: '氏名', why: 'ふりがなの下の漢字', conf: 0.62 - pen }); used[nm.id] = 1; } }
  else if (nOut && !kOut && byId[nOut.eid]) { var kk = pairNear(byId[nOut.eid], 'カナ氏名', true); if (kk) { out.push({ eid: kk.id, label: 'カナ氏名', why: '氏名の上のふりがな', conf: 0.62 - pen }); used[kk.id] = 1; } }
  /* 名前欄が1つだけで、見本の値がカナだっただけ（「フリガナ」などの見出しが無い）なら「氏名」にする：漢字でもカナでも差し込めるように */
  if (!out.some(function (o) { return o.label === '氏名'; })) out.forEach(function (o) {
    if (o.label === 'カナ氏名' && /値がカナだけなので|カナ（ひらがな）だけの文字/.test(o.why)) { o.label = '氏名'; o.why = o.why.replace('（値がカナだけなので）', '') + '（名前欄はここだけなので漢字・カナどちらも可）'; }
  });
  return out;
}
/* ラベルらしい箱の一覧 */
function findLabels(els, fuzzy) { var o = []; els.forEach(function (e) { var l = labelOf(e.text, fuzzy); if (l) o.push({ e: e, label: l }); }); return o; }
function confWord(c) { return c >= 0.8 ? '高' : c >= 0.6 ? '中' : '低'; }

/* ---------- 文字片を行にまとめる ----------
   items: [{s,x,y,w,h,fh,conf?}]（px、左上基準。fh=文字の高さ）。
   同じ行（中心の高さが近い）で、すき間が文字高さの0.75倍未満なら1つにつなぐ。1文字ずつ分かれたCJKも、全角スペースも扱う。 */
function mergeItems(items, opt) {
  /* 空の文字片は捨てる。空白だけの文字片は、全角1〜2文字ぶんまでなら単語のつなぎとして残し、それより広い空白（桁そろえの空白など）はセルの区切りとして捨てる */
  var its = items.filter(function (i) { return i.s != null && String(i.s) !== '' && i.w >= 0 && i.fh > 0 && (String(i.s).trim() || i.w <= 1.3 * i.fh); });
  its.sort(function (a, b) { return (a.y + a.h / 2) - (b.y + b.h / 2); });
  var rows = [];
  its.forEach(function (it) {
    var cy = it.y + it.h / 2, r = null;
    for (var k = rows.length - 1; k >= 0 && k >= rows.length - 6; k--) {
      var q = rows[k], tol = 0.45 * Math.max(it.fh, q.fh);
      if (Math.abs(cy - q.cy) < tol && Math.min(it.y + it.h, q.y2) - Math.max(it.y, q.y1) > 0.35 * Math.min(it.h, q.y2 - q.y1)) { r = q; break; }
    }
    if (!r) { r = { items: [], cy: cy, fh: it.fh, y1: it.y, y2: it.y + it.h }; rows.push(r); }
    r.items.push(it); var n = r.items.length; r.cy = (r.cy * (n - 1) + cy) / n; r.fh = Math.max(r.fh, it.fh); r.y1 = Math.min(r.y1, it.y); r.y2 = Math.max(r.y2, it.y + it.h);
  });
  var out = [];
  rows.forEach(function (r) {
    r.items.sort(function (a, b) { return a.x - b.x; });
    var cur = null;
    r.items.forEach(function (it) {
      if (!cur) { cur = start(it); return; }
      var gap = it.x - (cur.x + cur.w), fh = Math.max(it.fh, cur.fh), ratio = Math.max(it.fh, cur.fh) / Math.max(1, Math.min(it.fh, cur.fh));
      if (gap < (opt && opt.wide ? 1.4 : 0.75) * fh && ratio < 1.7) {
        var a = JTX.last(cur.text, 1), b = JTX.first(it.s, 1), sp = '';
        if (gap > 0.22 * fh && /[A-Za-z0-9]/.test(a) && /[A-Za-z0-9]/.test(b)) sp = ' ';
        cur.text += sp + it.s; var x2 = Math.max(cur.x + cur.w, it.x + it.w); cur.x = Math.min(cur.x, it.x); cur.w = x2 - cur.x;
        cur.y = Math.min(cur.y, it.y); cur.y2 = Math.max(cur.y2, it.y + it.h); cur.fh = Math.max(cur.fh, it.fh); cur.cs.push(it.conf == null ? 100 : it.conf); cur.n++;
      } else { out.push(fin(cur)); cur = start(it); }
    });
    if (cur) out.push(fin(cur));
  });
  function start(it) { return { text: String(it.s), x: it.x, y: it.y, w: it.w, y2: it.y + it.h, fh: it.fh, cs: [it.conf == null ? 100 : it.conf], n: 1 }; }
  function fin(c) { var cf = c.cs.reduce(function (a, b) { return a + b; }, 0) / c.cs.length; return { text: c.text.replace(/^[ 　]+|[ 　]+$/g, ''), x: c.x, y: c.y, w: c.w, h: c.y2 - c.y, fh: c.fh, conf: cf }; }
  return out.filter(function (b) { return b.text; });
}

/* ---------- PDFの文字情報 ----------
   page: pdf.js のページ、vp: 描画に使った viewport。戻り値: 文字片（px）。回転した文字は除く。 */
async function pdfItems(page, vp, lib) {
  var tc = await page.getTextContent({ disableNormalization: true }), out = [];
  tc.items.forEach(function (it) {
    if (!it || typeof it.str !== 'string' || !it.transform) return;
    var t = lib.Util.transform(vp.transform, it.transform);
    if (Math.abs(t[1]) > Math.abs(t[0]) * 0.2 || Math.abs(t[2]) > Math.abs(t[3]) * 0.2) return;
    var fh = Math.hypot(t[2], t[3]), w = Math.abs(it.width * (vp.scale || 1));
    if (!(fh > 1)) return;
    var fn = ''; try { var fo = it.fontName && page.commonObjs && page.commonObjs.has(it.fontName) ? page.commonObjs.get(it.fontName) : null; fn = (fo && (fo.name || fo.fallbackName)) || ''; } catch (e) { fn = ''; }
    out.push({ s: it.str, x: t[4], y: t[5] - 0.88 * fh, w: w, h: 1.1 * fh, fh: fh, font: fn, bad: !!it.str.trim() && JTX.isGarbage(it.str) });
  });
  return out;
}

/* ---------- 画像：前処理（拡大・グレー化・コントラスト伸長） ---------- */
function preprocess(src, maxSide) {
  var s = 1, long = Math.max(src.width, src.height);
  if (long < 1600) s = 2000 / long; else if (long > (maxSide || 2600)) s = (maxSide || 2600) / long;
  var cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(src.width * s)); cv.height = Math.max(1, Math.round(src.height * s));
  var x = cv.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, cv.width, cv.height);
  var d = x.getImageData(0, 0, cv.width, cv.height), p = d.data, n = p.length / 4, hist = new Uint32Array(256), i;
  for (i = 0; i < n; i++) { var v = (p[i * 4] * 0.299 + p[i * 4 + 1] * 0.587 + p[i * 4 + 2] * 0.114) | 0; p[i * 4] = v; hist[v]++; }
  var lo = 0, hi = 255, acc = 0; for (i = 0; i < 256; i++) { acc += hist[i]; if (acc >= n * 0.01) { lo = i; break; } }
  acc = 0; for (i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= n * 0.01) { hi = i; break; } }
  if (hi - lo < 40) { lo = 0; hi = 255; }
  var k = 255 / (hi - lo);
  for (i = 0; i < n; i++) { var u = Math.max(0, Math.min(255, ((p[i * 4] - lo) * k) | 0)); p[i * 4] = p[i * 4 + 1] = p[i * 4 + 2] = u; p[i * 4 + 3] = 255; }
  x.putImageData(d, 0, 0);
  return { cv: cv, scale: s };
}

/* ---------- OCR（Tesseract.js） ---------- */
var W = null, WP = null, cur = null;
function cancelOcr() {
  if (cur) { var c = cur; cur = null; try { c.reject(new Error('cancel')); } catch (e) { } }
  if (W) { try { W.terminate(); } catch (e) { } }
  W = null; WP = null;
}
function guard(p) { return new Promise(function (ok, ng) { cur = { reject: ng }; p.then(function (v) { cur = null; ok(v); }, function (e) { cur = null; ng(e); }); }); }
async function getWorker(onProg) {
  if (W) { W._prog = onProg; return W; }
  if (WP) { var w0 = await WP; w0._prog = onProg; return w0; }
  WP = (async function () {
    try { await loadScript(LIB.tess); } catch (e) { throw new Error('文字を読み取る部品を読み込めませんでした。通信状況を確認してもう一度お試しください。'); }
    if (!g.Tesseract) throw new Error('文字を読み取る部品を読み込めませんでした。');
    var holder = {};
    var w = await g.Tesseract.createWorker('jpn', 1, { langPath: LIB.lang, gzip: true, logger: function (m) { if (holder.w && holder.w._prog) holder.w._prog(m); else if (onProg) onProg(m); } });
    holder.w = w; w._prog = onProg; W = w; return w;
  })();
  try { return await WP; } catch (e) { WP = null; throw e; }
}
function wordsOf(data) {
  if (data.words && data.words.length) return data.words;
  var o = [];
  (data.blocks || []).forEach(function (b) { (b.paragraphs || []).forEach(function (p) { (p.lines || []).forEach(function (l) { (l.words || []).forEach(function (w) { o.push(w); }); }); }); });
  return o;
}
/* キャンバス全体のOCR。戻り値: 文字の箱（元キャンバスのpx） */
async function ocrPage(src, onProg) {
  var pre = preprocess(src), w = await getWorker(onProg);
  try { await w.setParameters({ tessedit_pageseg_mode: '11', preserve_interword_spaces: '1' }); } catch (e) { }
  var res = await guard(w.recognize(pre.cv)), data = res.data || {}, items = [];
  wordsOf(data).forEach(function (wd) {
    var b = wd.bbox || {}, t = cleanText(wd.text);
    if (!t || (wd.confidence != null && wd.confidence < 25)) return;
    var h = b.y1 - b.y0, wdt = b.x1 - b.x0; if (!(h > 4 && wdt > 2) || h > pre.cv.height * 0.2) return;
    var allNum = /^[0-9A-Za-z.\-]+$/.test(t), fh = h / (allNum ? 0.74 : 0.92);
    items.push({ s: t, x: b.x0 / pre.scale, y: b.y0 / pre.scale, w: wdt / pre.scale, h: h / pre.scale, fh: Math.min(fh, h * 1.5) / pre.scale, conf: wd.confidence });
  });
  var lines = mergeItems(items, { wide: true }).map(function (l) { l.text = cleanText(l.text); return l; }).filter(function (l) { return l.text && !/^[\s!-\/:-@\[-`{-~、。・|｜ー_]+$/.test(l.text); });
  return lines;
}
/* 範囲だけのOCR（名簿用）。rect はsrcのpx。戻り値 {text, conf} */
async function ocrRegion(src, rect, label, onProg) {
  var pad = Math.max(2, rect.h * 0.15), x0 = Math.max(0, rect.x - pad), y0 = Math.max(0, rect.y - pad), x1 = Math.min(src.width, rect.x + rect.w + pad), y1 = Math.min(src.height, rect.y + rect.h + pad);
  var cw = Math.max(4, x1 - x0), ch = Math.max(4, y1 - y0), s = Math.max(0.5, Math.min(4, 110 / ch)), B = 24;
  var c1 = document.createElement('canvas'); c1.width = Math.round(cw * s); c1.height = Math.round(ch * s);
  var x = c1.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c1.width, c1.height); x.imageSmoothingQuality = 'high'; x.drawImage(src, x0, y0, cw, ch, 0, 0, c1.width, c1.height);
  var pre = preprocess(c1, 4000), c2 = document.createElement('canvas'); c2.width = pre.cv.width + B * 2; c2.height = pre.cv.height + B * 2;
  var x2 = c2.getContext('2d'); x2.fillStyle = '#fff'; x2.fillRect(0, 0, c2.width, c2.height); x2.drawImage(pre.cv, B, B);
  var w = await getWorker(onProg);
  var data = {}, t = '', modes = ['7', '8', '10'];
  for (var mi = 0; mi < modes.length; mi++) {
    try { await w.setParameters({ tessedit_pageseg_mode: modes[mi], preserve_interword_spaces: '1' }); } catch (e) { }
    var res = await guard(w.recognize(c2)); data = res.data || {}; t = cleanText(data.text || '');
    if (t.replace(/[\s|｜]/g, '')) break;
  }
  var conf = data.confidence == null ? 0 : data.confidence;
  /* 枠線などの読み取りゴミ（| > など）を取り除く */
  t = t.replace(/[|｜¦]/g, ' ').replace(/^[\s>＞<＜\-—_.,;:'"`~=+*\\/]+|[\s>＞<＜\-—_.,;:'"`~=+*\\/]+$/g, '').replace(RE_CJK_GAP, '$1').replace(/\s{2,}/g, ' ');
  if (label === '受験番号') {
    var d = t.replace(/[ 　\-ー]/g, '');
    if (/^[0-9OoDlI|SsBZ]+$/.test(d)) t = d.replace(/[OoD]/g, '0').replace(/[lI|]/g, '1').replace(/[Ss]/g, '5').replace(/B/g, '8').replace(/Z/g, '2');
  }
  return { text: t, conf: conf };
}

/* ---------- 背景色・文字色のサンプリング ----------
   cv: ページのキャンバス、r: {x,y,w,h}(px)、padPx: 隠す四角の余白。 */
function sampleBox(cv, r, padPx) {
  var x = cv.getContext('2d', { willReadFrequently: true }), W0 = cv.width, H0 = cv.height;
  var rx0 = Math.max(0, Math.floor(r.x - padPx)), ry0 = Math.max(0, Math.floor(r.y - padPx)), rx1 = Math.min(W0, Math.ceil(r.x + r.w + padPx)), ry1 = Math.min(H0, Math.ceil(r.y + r.h + padPx));
  var t = Math.max(2, Math.round(padPx * 1.6)), ox0 = Math.max(0, rx0 - t), oy0 = Math.max(0, ry0 - t), ox1 = Math.min(W0, rx1 + t), oy1 = Math.min(H0, ry1 + t);
  if (ox1 - ox0 < 2 || oy1 - oy0 < 2) return { bg: '#ffffff', fg: '#111111', uniform: true };
  var d = x.getImageData(ox0, oy0, ox1 - ox0, oy1 - oy0), p = d.data, w = ox1 - ox0, R = [], G = [], B = [];
  for (var yy = oy0; yy < oy1; yy++) for (var xx = ox0; xx < ox1; xx++) {
    if (xx >= rx0 && xx < rx1 && yy >= ry0 && yy < ry1) continue;
    var i = ((yy - oy0) * w + (xx - ox0)) * 4; R.push(p[i]); G.push(p[i + 1]); B.push(p[i + 2]);
  }
  if (!R.length) return { bg: '#ffffff', fg: '#111111', uniform: true };
  var med = function (a) { var s = a.slice().sort(function (m, n) { return m - n; }); return s[s.length >> 1]; };
  var mr = med(R), mg = med(G), mb = med(B), near = 0;
  for (var k = 0; k < R.length; k++) if (Math.abs(R[k] - mr) + Math.abs(G[k] - mg) + Math.abs(B[k] - mb) < 36) near++;
  var uniform = near / R.length >= 0.9;
  /* 文字色：枠の中で背景から最も離れた画素の平均 */
  var inx0 = Math.max(0, Math.floor(r.x)), iny0 = Math.max(0, Math.floor(r.y)), inx1 = Math.min(W0, Math.ceil(r.x + r.w)), iny1 = Math.min(H0, Math.ceil(r.y + r.h));
  var fg = '#111111';
  if (inx1 - inx0 > 1 && iny1 - iny0 > 1) {
    var d2 = x.getImageData(inx0, iny0, inx1 - inx0, iny1 - iny0).data, ds = [], n2 = d2.length / 4;
    for (var j = 0; j < n2; j++) ds.push({ d: Math.abs(d2[j * 4] - mr) + Math.abs(d2[j * 4 + 1] - mg) + Math.abs(d2[j * 4 + 2] - mb), j: j });
    ds.sort(function (a, b) { return b.d - a.d; });
    if (ds[0] && ds[0].d >= 90) {
      var cnt = Math.max(3, Math.floor(n2 * 0.06)), sr = 0, sg = 0, sb = 0, c = 0;
      for (var q = 0; q < cnt && q < ds.length; q++) { if (ds[q].d < ds[0].d * 0.7) break; var jj = ds[q].j; sr += d2[jj * 4]; sg += d2[jj * 4 + 1]; sb += d2[jj * 4 + 2]; c++; }
      if (c) fg = hex(sr / c, sg / c, sb / c);
    } else fg = (mr + mg + mb) / 3 < 110 ? '#ffffff' : '#111111';
  }
  return { bg: hex(mr, mg, mb), fg: fg, uniform: uniform };
}
function hex(r, g2, b) { return '#' + [r, g2, b].map(function (v) { var s = Math.max(0, Math.min(255, Math.round(v))).toString(16); return s.length < 2 ? '0' + s : s; }).join(''); }

/* 範囲の中の「文字の色の部分」だけを囲む箱（px）。何も無ければ null */
function inkBox(cv, r) {
  var x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y)), x1 = Math.min(cv.width, Math.ceil(r.x + r.w)), y1 = Math.min(cv.height, Math.ceil(r.y + r.h));
  if (x1 - x0 < 4 || y1 - y0 < 4) return null;
  var w = x1 - x0, h = y1 - y0, d = cv.getContext('2d', { willReadFrequently: true }).getImageData(x0, y0, w, h).data, bd = [];
  /* 背景色＝範囲の中でいちばん多い色（端が枠線でも崩れない） */
  var hs = {}, bestK = '', bestN = 0, j;
  for (j = 0; j < w * h; j++) { var kk = (d[j * 4] >> 4) + ',' + (d[j * 4 + 1] >> 4) + ',' + (d[j * 4 + 2] >> 4); var nn = (hs[kk] = (hs[kk] || 0) + 1); if (nn > bestN) { bestN = nn; bestK = kk; } }
  var bp = bestK.split(','), mr = bp[0] * 16 + 8, mg = bp[1] * 16 + 8, mb = bp[2] * 16 + 8;
  var ink = new Uint8Array(w * h), rc = new Uint32Array(h), cc = new Uint32Array(w), yy, xx;
  for (yy = 0; yy < h; yy++) for (xx = 0; xx < w; xx++) {
    var k = (yy * w + xx) * 4; if (Math.abs(d[k] - mr) + Math.abs(d[k + 1] - mg) + Math.abs(d[k + 2] - mb) > 150) { ink[yy * w + xx] = 1; rc[yy]++; cc[xx]++; }
  }
  /* 枠線（行・列のほとんどが色付き）は無視する */
  var minx = w, miny = h, maxx = -1, maxy = -1, cnt = 0;
  for (yy = 0; yy < h; yy++) { if (rc[yy] > 0.88 * w) continue; for (xx = 0; xx < w; xx++) { if (!ink[yy * w + xx] || cc[xx] > 0.88 * h) continue; cnt++; if (xx < minx) minx = xx; if (xx > maxx) maxx = xx; if (yy < miny) miny = yy; if (yy > maxy) maxy = yy; } }
  if (cnt < Math.max(6, w * h * 0.002)) return null;
  return { x: x0 + minx, y: y0 + miny, w: maxx - minx + 1, h: maxy - miny + 1 };
}

g.DesignDetect = {
  findLabels: findLabels, inkBox: inkBox,
  suggest: suggest, labelOf: labelOf, splitLabelValue: splitLabelValue, confWord: confWord, normLbl: normLbl, halfDigits: halfDigits, cleanText: cleanText,
  mergeItems: mergeItems, pdfItems: pdfItems, preprocess: preprocess, ocrPage: ocrPage, ocrRegion: ocrRegion, cancelOcr: cancelOcr, sampleBox: sampleBox
};
})(window);
