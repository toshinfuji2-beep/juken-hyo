/* 「自分のデザインを取り込む」：PowerPoint(.pptx)・画像・PDF → フリーデザイン + 差し込み箇所の指定。window.DesignImport
   流れ：ファイル選択 → （複数スライド/ページなら選ぶ）→ 差し込み箇所の指定（文字をクリックして項目に割り当て）→ 名簿へ。
   変換は editor/pptx-import.js（PptxImport）。データモデルは通常のフリーデザイン＋項目（items）のまま。 */
(function (g) {
'use strict';
var JT = g.JukenTemplates, C = JT.ctx, el = C.el, PXMM = C.PXMM;
var H = null, M = null, OV = null, DD = g.DesignDetect, JTX = g.JukenText;
var MAX_BYTES = 30 * 1024 * 1024;
var LIB = {
  jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfw: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  /* 日本語PDF（CIDフォント）の文字を正しく読むための CMap と標準フォント。pdf.js と同じバージョン（cdnjs には cmaps が無いので jsDelivr の pdfjs-dist） */
  cmaps: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
  fonts: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'
};
var PDF_OPTS = { cMapUrl: LIB.cmaps, cMapPacked: true, standardFontDataUrl: LIB.fonts };
var STD = ['受験番号', '氏名', 'カナ氏名', '志望学部', '教室', '学校名', '学年'];
var libP = {};
function loadScript(u) {
  return libP[u] || (libP[u] = new Promise(function (ok, ng) {
    var s = document.createElement('script'); s.src = u; s.onload = ok;
    s.onerror = function () { delete libP[u]; ng(new Error('lib')); }; document.head.appendChild(s);
  }));
}
function btn(t, title, cls) { var b = el('button', cls || null, t); b.type = 'button'; if (title) b.title = title; return b; }
function mm2px(v) { return v * PXMM * (M ? M.sc : 1); }
function nextFrame() { return new Promise(function (r) { setTimeout(r, 0); }); }

/* ---------- スタイル ---------- */
var CSS = [
'.dimp-card{margin:0 0 var(--s5,24px)}',
'.dimp-big{display:flex;gap:14px;align-items:center;width:100%;padding:16px 18px;border:2px dashed var(--ac);border-radius:14px;background:var(--acs,rgba(37,99,235,.12));text-align:left;white-space:normal;cursor:pointer;color:var(--fg)}',
'.dimp-big:hover,.dimp-big.over{background:rgba(37,99,235,.22);border-style:solid}',
'.dimp-big .di-ic{flex:none;width:46px;height:46px;border-radius:12px;background:var(--ac);color:#fff;display:flex;align-items:center;justify-content:center}',
'.dimp-big b{display:block;font-size:16px;margin-bottom:2px}',
'.dimp-big span.t{display:block;font-size:12px;color:var(--mut);line-height:1.5}',
'.dimp-big .ex{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}',
'#dimp{position:fixed;inset:0;z-index:95;background:var(--bg);color:var(--fg);display:flex;flex-direction:column}',
'#dimp .dp-h{display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid var(--bd);background:var(--panel);min-width:0}',
'#dimp .dp-h b{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}',
'#dimp .dp-h .sp{flex:1}',
'#dimp .dp-b{flex:1;min-height:0;display:flex}',
'#dimp .dp-busy{margin:auto;text-align:center;padding:24px;max-width:420px}',
'#dimp .dp-busy .sp1{width:34px;height:34px;border:4px solid var(--bd);border-top-color:var(--ac);border-radius:50%;margin:0 auto 12px;animation:dpspin 1s linear infinite}',
'@keyframes dpspin{to{transform:rotate(360deg)}}',
'#dimp .dp-err{color:var(--err);font-weight:700;margin-bottom:12px;line-height:1.6;white-space:pre-wrap}',
'#dimp .dp-pick{flex:1;overflow:auto;padding:16px}',
'#dimp .dp-pick h2,#dimp .dp-side h2{font-size:16px;margin:0 0 4px}',
'#dimp .dp-sub{font-size:12px;color:var(--mut);margin:0 0 12px;line-height:1.6}',
'#dimp .dp-tg{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px}',
'#dimp .dp-th{display:flex;flex-direction:column;gap:4px;padding:6px;border:2px solid var(--bd);border-radius:10px;background:var(--panel);cursor:pointer;text-align:center;white-space:normal}',
'#dimp .dp-th:hover{border-color:var(--ac)}',
'#dimp .dp-th .pg{position:relative;overflow:hidden;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25);width:100%;aspect-ratio:210/297}',
'#dimp .dp-th .pg .ticket{position:absolute;left:0;top:0;transform-origin:0 0}',
'#dimp .dp-th .pg canvas,#dimp .dp-th .pg img{width:100%;height:100%;display:block}',
'#dimp .dp-th span{font-size:12px;color:var(--mut)}',
'#dimp .dp-map{flex:1;min-width:0;min-height:0;display:flex;overflow:hidden}',
'#dimp .dp-stage{flex:1;min-width:0;overflow:auto;background:var(--pv);padding:16px;position:relative}',
'#dimp .dp-inner{position:relative;margin:0 auto;box-shadow:0 1px 8px rgba(0,0,0,.35);background:#fff}',
'#dimp .dp-inner .ticket{position:absolute;left:0;top:0;transform-origin:0 0}',
'#dimp .dp-hits{position:absolute;inset:0}',
'#dimp .dp-hits.draw{cursor:crosshair;touch-action:none;background:rgba(37,99,235,.05)}',
'#dimp .hit{position:absolute;cursor:pointer;border-radius:2px;outline:1px dashed rgba(100,116,139,.0);transform-origin:50% 50%;touch-action:none}',
'#dimp .hit:hover{outline:2px solid rgba(37,99,235,.7);background:rgba(37,99,235,.10)}',
'#dimp .hit.sug{outline:2px dashed #f59e0b;background:rgba(245,158,11,.14)}',
'#dimp .hit.map{outline:2px solid #16a34a;background:rgba(22,163,74,.14)}',
'#dimp .hit.fix{outline:2px solid #7c3aed;background:rgba(124,58,237,.12)}',
'#dimp .hit.cur{outline:3px solid #1d4ed8;background:rgba(29,78,216,.16)}',
'#dimp .hit .chip{position:absolute;left:-1px;top:0;transform:translateY(-100%);font-size:11px;line-height:1.3;padding:0 6px;border-radius:4px 4px 0 0;background:#16a34a;color:#fff;white-space:nowrap;pointer-events:none;max-width:200px;overflow:hidden;text-overflow:ellipsis}',
'#dimp .hit.sug .chip{background:#f59e0b;color:#1f2937}',
'#dimp .hit.fix .chip{background:#7c3aed}',
'#dimp .hit .rz{position:absolute;right:-6px;bottom:-6px;width:12px;height:12px;background:#1d4ed8;border:2px solid #fff;border-radius:3px;cursor:nwse-resize}',
'#dimp .dp-side{flex:none;width:340px;border-left:1px solid var(--bd);background:var(--panel);display:flex;flex-direction:column;min-height:0}',
'#dimp .dp-sc{flex:1;overflow:auto;padding:14px}',
'#dimp .dp-sf{padding:10px 14px;border-top:1px solid var(--bd);display:flex;flex-direction:column;gap:8px}',
'#dimp .dp-sf .pri{padding:12px;font-size:15px;font-weight:700;border-radius:10px}',
'#dimp .dp-sum{font-size:12px;border:1px solid var(--bd);border-radius:8px;background:var(--bg);margin:0 0 12px}',
'#dimp .dp-sum summary{padding:6px 10px;font-weight:700;font-size:12px;background:transparent}',
'#dimp .dp-sum div{padding:2px 10px 8px;line-height:1.6;color:var(--mut)}',
'#dimp .dp-sum p{margin:3px 0}',
'#dimp .dp-sum .w{color:var(--warn)}',
'#dimp .dp-sec{margin:0 0 14px}',
'#dimp .dp-sec h3{font-size:12px;color:var(--mut);margin:0 0 6px;display:flex;align-items:center;gap:8px}',
'#dimp .dp-sg{display:flex;align-items:center;gap:6px;padding:5px 6px;border:1px solid var(--bd);border-radius:6px;margin-bottom:4px;font-size:12px;cursor:pointer}',
'#dimp .dp-sg:hover{border-color:#f59e0b}',
'#dimp .dp-sg .tx{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'#dimp .dp-sg b{color:#b45309}',
'#dimp .dp-sg button{padding:2px 8px;font-size:12px}',
'#dimp .dp-mp{display:flex;align-items:center;gap:6px;font-size:12px;padding:3px 0}',
'#dimp .dp-mp b{flex:none}',
'#dimp .dp-mp .tx{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mut)}',
'#dimp .dp-mp button{padding:0 7px;font-size:12px}',
'#dimp .dp-ok{color:var(--ok);font-size:12px}',
'#dimp .dp-pop{position:absolute;z-index:5;width:300px;background:var(--panel);color:var(--fg);border:1px solid var(--bd);border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.35);padding:10px}',
'#dimp .dp-pop h4{margin:0 0 2px;font-size:14px}',
'#dimp .dp-pop .org{font-size:11px;color:var(--mut);margin:0 0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'#dimp .dp-pop .bt{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
'#dimp .dp-pop .bt button{padding:7px 6px;font-size:13px;overflow:hidden;text-overflow:ellipsis}',
'#dimp .dp-pop .bt button.on{background:#16a34a;border-color:#16a34a;color:#fff}',
'#dimp .dp-pop .bt button.rec{border-color:#f59e0b;box-shadow:0 0 0 2px rgba(245,158,11,.4)}',
'#dimp .dp-pop .ln{display:flex;gap:6px;margin-top:8px;align-items:center}',
'#dimp .dp-pop .ln input[type=text]{flex:1;min-width:0;padding:5px 7px}',
'#dimp .dp-pop .sm{font-size:11px;color:var(--mut);margin:8px 0 2px}',
'#dimp .dp-pop .st{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px}',
'#dimp .dp-pop .st select{width:auto;padding:3px 4px}',
'#dimp .dp-pop .st button{padding:2px 8px}',
'#dimp .dp-pop .st input[type=color]{width:34px;height:26px;padding:0;border:1px solid var(--bd)}',
'#dimp .dp-pop .st .num{min-width:34px;text-align:center;font-size:12px}',
'#dimp .hit.det{outline:1px dashed rgba(100,116,139,.55)}',
'#dimp .hit.det:hover{outline:2px solid rgba(37,99,235,.7)}',
'#dimp .dp-busy .bm{margin-bottom:6px}',
'#dimp .dp-busy .bn{font-size:12px;color:var(--mut);line-height:1.6;margin:0 0 12px}',
'#dimp .dp-meth{font-size:12px;border-radius:8px;padding:6px 10px;margin:0 0 10px;line-height:1.55;border:1px solid var(--bd);background:var(--bg)}',
'#dimp .dp-meth.mok{border-color:#16a34a}#dimp .dp-meth.mck{border-color:#f59e0b}',
'#dimp .dp-meth b{display:block;font-size:13px}',
'#dimp .dp-wb{display:inline-block;font-size:11px;line-height:1.4;padding:0 6px;border-radius:4px;background:var(--warnbg,#fef3c7);color:var(--warn,#b45309);margin-left:4px}',
'#dimp .dp-sg .cf{flex:none;font-size:11px;color:var(--mut)}',
'#dimp .dp-conf{flex:1;overflow:auto;padding:16px}',
'#dimp .dp-conf table{border-collapse:collapse;font-size:13px}',
'#dimp .dp-conf th,#dimp .dp-conf td{border:1px solid var(--bd);padding:2px 4px;text-align:left;white-space:nowrap}',
'#dimp .dp-conf th{background:var(--panel);position:sticky;top:0;z-index:1}',
'#dimp .dp-conf td input{width:100%;min-width:110px;padding:4px 6px;font-size:13px;box-sizing:border-box}',
'#dimp .dp-conf td.low input{background:var(--warnbg,#fef3c7);border-color:#f59e0b}',
'#dimp .dp-cf{padding:10px 14px;border-top:1px solid var(--bd);display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:var(--panel)}',
'#dimp .dp-cf .pri{padding:10px 16px;font-weight:700}',
'@media(max-width:820px){#dimp .dp-map{flex-direction:column}#dimp .dp-stage{flex:none;height:46vh;padding:8px}#dimp .dp-side{width:auto;border-left:0;border-top:1px solid var(--bd);flex:1}#dimp .dp-pop{position:fixed;left:8px!important;right:8px;top:auto!important;bottom:8px;width:auto;max-height:60vh;overflow:auto}#dimp .hit{min-width:14px;min-height:14px}#dimp .hit .chip{font-size:9px;padding:0 3px}}'
].join('\n');
function ensureCss() { if (document.getElementById('dimp-css')) return; var s = document.createElement('style'); s.id = 'dimp-css'; s.textContent = CSS; document.head.appendChild(s); }

/* ---------- ファイルの種類・読み込み ---------- */
function kindOfFile(f) {
  var n = (f.name || '').toLowerCase(), t = f.type || '';
  if (/\.pptx$/.test(n) || /presentationml\.presentation/.test(t)) return 'pptx';
  if (/\.ppt$/.test(n)) return 'ppt';
  if (/\.pdf$/.test(n) || t === 'application/pdf') return 'pdf';
  if (/\.(png|jpe?g|gif|webp|bmp)$/.test(n) || /^image\/(png|jpeg|gif|webp|bmp)/.test(t)) return 'image';
  return '';
}
function readBuf(f) { return new Promise(function (ok, ng) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = function () { ng(new Error('read')); }; r.readAsArrayBuffer(f); }); }
function baseName(f) { return String(f.name || '取り込んだデザイン').replace(/\.[A-Za-z0-9]{1,5}$/, ''); }

/* 公開：ファイルを受け取って開始（複数の画像も可） */
async function handleFile(arg) {
  var files = Array.isArray(arg) ? arg : (arg && !arg.name && arg.length != null ? Array.prototype.slice.call(arg) : [arg]);
  files = files.filter(Boolean);
  if (!files.length) return;
  var f = files[0];
  ensureCss();
  var k = kindOfFile(f);
  if (!k) { showBusy(null, 'このファイルは取り込めません。\nPowerPoint（.pptx）、画像（PNG・JPEG）、PDF のいずれかを選んでください。'); return; }
  if (k === 'ppt') { showBusy(null, '古い形式（.ppt）は取り込めません。\nPowerPointで開いて「名前を付けて保存」から .pptx（またはPDF）にしてください。'); return; }
  if (files.length > 1 && files.some(function (x) { return kindOfFile(x) !== 'image'; })) { showBusy(null, '複数のファイルを選ぶときは、画像（PNG・JPEG）だけにしてください。\nPowerPointやPDFは1つずつ選びます。'); return; }
  var tot = files.reduce(function (a, x) { return a + x.size; }, 0);
  if (f.size > MAX_BYTES || tot > MAX_BYTES * 2) { showBusy(null, 'ファイルが大きすぎます（' + (tot / 1048576).toFixed(1) + 'MB）。30MBまでのファイルを選んでください。\n画像が多い場合は、PowerPointで「図の圧縮」をするか、PDFにしてから取り込むと小さくなります。'); return; }
  openOverlay();
  M = { kind: files.length > 1 ? 'images' : k, name: baseName(f), file: f, files: files, map: {}, orig: {}, custom: {}, det: {}, fixed: {}, extra: [], sel: null, sc: 1, seq: 0, wantRoster: false, rosterSig: '', rosterLines: null, method: '' };
  try {
    if (k === 'pptx') await startPptx(f);
    else if (k === 'pdf') await startPdf(f);
    else if (files.length > 1) await startImages(files);
    else await startImage(f);
  } catch (e) {
    if (M && M.cancelled) return;
    showBusy(null, (e && e.message) || '取り込めませんでした。');
  }
}

/* ---------- 画像（背景＋差し込み枠＋OCRで自動判定） ---------- */
function loadImg(url) { return new Promise(function (ok, ng) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ng(new Error('img')); }; i.src = url; }); }
async function fileCanvas(f) {
  var url = URL.createObjectURL(f), im;
  try { im = await loadImg(url); } catch (e) { URL.revokeObjectURL(url); throw new Error('画像を読み込めませんでした。壊れていないか確認してください。'); }
  var s = Math.min(1, 2000 / Math.max(im.naturalWidth, im.naturalHeight)), cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(im.naturalWidth * s)); cv.height = Math.max(1, Math.round(im.naturalHeight * s));
  var x = cv.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
  return { cv: cv, ratio: im.naturalWidth / im.naturalHeight };
}
async function startImage(f) {
  showBusy('画像を読み込んでいます…');
  var r = await fileCanvas(f), cv = r.cv;
  var src = /png|gif|webp/i.test(f.type) ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.9);
  if (src.length > 1.6e6) src = cv.toDataURL('image/jpeg', 0.85);
  await startBackground(src, r.ratio, '画像', cv, 'ocr');
}
/* 複数の画像：生徒ごとに1枚ずつ。どれか1枚をデザインにして、全部から名簿を読み取れる */
async function startImages(files) {
  M.name = baseName(files[0]);
  showPicker({ title: 'どの画像をデザインにしますか？', sub: '画像が' + files.length + '枚あります。生徒ごとに1枚ずつなら、どれか1枚を選んでください（あとで、全部の画像から名簿も読み取れます）。', count: files.length, thumb: async function (i, box) {
    var u = URL.createObjectURL(files[i]), im = new Image(); im.onload = function () { URL.revokeObjectURL(u); }; im.src = u; box.appendChild(im);
  }, label: function (i) { return (i + 1) + '枚目'; }, pick: async function (i) {
    try { M.imgIdx = i; await startImage(files[i]); } catch (e) { if (M && M.cancelled) return; showBusy(null, (e && e.message) || '取り込めませんでした。'); }
  } });
}
function geoOf(cv) { var k = Math.min(210 / cv.width, 297 / cv.height); return { k: k, ox: (210 - cv.width * k) / 2, oy: (297 - cv.height * k) / 2, cw: cv.width, ch: cv.height }; }
async function startBackground(src, ratio, what, cv, mode) {
  var diff = Math.abs(ratio - 210 / 297) > 0.02;
  M.elements = [{ type: 'image', id: 'bg', x: 0, y: 0, w: 210, h: 297, fit: 'contain', locked: true, name: '背景（' + what + '）', src: src }];
  M.bg = '#ffffff';
  M.stats = { count: 1, skipped: {}, skippedTotal: 0, emf: [], aspectDiff: diff, bgOnly: true, what: what };
  M.sugg = []; M.det = {}; M.orig = {}; M.map = {}; M.custom = {}; M.fixed = {};
  M.pix = cv || null; M.geo = cv ? geoOf(cv) : null; M.method = 'none'; M.detectNote = '';
  if (cv) { try { await detectText(mode); } catch (e) { if (M && M.cancelled) return; M.detectNote = '文字の自動判定ができませんでした。「差し込み枠を追加」で指定してください。'; } }
  if (!M || M.cancelled) return;
  showMap();
}

/* ---------- 文字の自動判定（PDFの文字情報／OCR）→ 差し込み候補 ---------- */
function setBusyMsg(t) { var b = OV && OV.querySelector('.dp-busy .bm'); if (b) b.textContent = t; }
function ocrProg(m) {
  if (!m || !OV) return;
  var p = m.progress != null ? ' ' + Math.round(m.progress * 100) + '%' : '', s = String(m.status || '');
  if (/recogniz/i.test(s)) setBusyMsg('文字を読み取り中…' + p);
  else if (/loading|download/i.test(s)) setBusyMsg('読み取り用データを読み込み中…' + p);
  else setBusyMsg('読み取りの準備をしています…');
}
function ocrNote() { return '初回は読み取り用データ（約10MB）を読み込みます。\n画像はこの端末のブラウザ内だけで処理され、外部には送られません。'; }
async function detectText(mode) {
  var lines, ocr = false;
  if (mode === 'text') {
    lines = DD.mergeItems(M.textItems);
    M.method = 'text';
  } else {
    ocr = true;
    showBusy('読み取りの準備をしています…', null, function () { M.detectCancelled = true; DD.cancelOcr(); }, ocrNote());
    try { lines = await DD.ocrPage(M.pix, ocrProg); M.method = 'ocr'; }
    catch (e) {
      if (M && M.cancelled) throw e;
      lines = []; M.method = 'none';
      M.detectNote = (e && e.message === 'cancel') ? '文字の自動判定をやめました。「差し込み枠を追加」で指定できます。' : ((e && e.message) || '文字の自動判定ができませんでした。') ;
    }
    if (M.method === 'ocr' && M.noTextLayer) M.detectNote = 'このPDFには文字情報が無い（スキャン画像）ため、画像として文字を読み取りました。';
    else if (M.method === 'ocr' && M.garbleAll) M.detectNote = M.garbleNote;
  }
  if (!M || M.cancelled) return;
  await buildDetected(lines, ocr);
}
/* ラベルは見つかったのに値が見つからないとき（1文字の数字など、OCRが拾いにくいもの）、ラベルの下・右の範囲だけを読み直す */
async function rescueLabels(boxes) {
  var G = M.geo, sb = boxes.map(function (b, i) { return { id: 't' + i, text: b.text, x: b.x, y: b.y, w: b.w, h: b.h, size: b.size }; });
  var labs = DD.findLabels(sb, true), have = {}, seen = {};
  DD.suggest(sb, { fuzzy: true }).forEach(function (x) { if (/^「/.test(x.why)) have[x.label] = 1; });
  var miss = labs.filter(function (l) { if (have[l.label] || seen[l.label]) return false; seen[l.label] = 1; return true; });
  if (!miss.length || M.detectCancelled) return boxes;
  setBusyMsg('見つからなかった項目を探しています…');
  var out = boxes.slice(), toPx = function (r) { return { x: (r.x - G.ox) / G.k, y: (r.y - G.oy) / G.k, w: r.w / G.k, h: r.h / G.k }; };
  var empty = function (r) { return !sb.some(function (o) { var ow = Math.min(o.x + o.w, r.x + r.w) - Math.max(o.x, r.x), oh = Math.min(o.y + o.h, r.y + r.h) - Math.max(o.y, r.y); return ow > 0 && oh > 0 && ow * oh > 0.5 * o.w * o.h; }); };
  for (var i = 0; i < miss.length; i++) {
    var L = miss[i], a = L.e, rl = 206;
    sb.forEach(function (o) { if (o !== a && o.x > a.x + a.w && Math.min(o.y + o.h, a.y + a.h) - Math.max(o.y, a.y) > 0.3 * a.h) rl = Math.min(rl, o.x - 1); });
    var regs = [{ x: a.x - 2, y: a.y + a.h + 0.5, w: Math.max(a.w * 2.5, 45), h: Math.max(a.h * 2, 13) }, { x: a.x + a.w + 1, y: a.y - 1, w: Math.max(5, Math.min(rl - (a.x + a.w + 1), 70)), h: a.h + 2 }];
    for (var j = 0; j < regs.length; j++) {
      var rg = regs[j]; rg.x = Math.max(0, rg.x); rg.w = Math.min(rg.w, 210 - rg.x); rg.y = Math.max(0, rg.y); rg.h = Math.min(rg.h, 297 - rg.y);
      if (!empty(rg)) continue;
      var ink = DD.inkBox(M.pix, toPx(rg)); if (!ink) continue;
      var r = await DD.ocrRegion(M.pix, ink, L.label, ocrProg), t = r.text;
      var okTxt = t && (L.label === '受験番号' ? /^[0-9]{1,10}$/.test(t) : (JTX.len(t) <= 20 && r.conf >= 45 && !DD.labelOf(t, true)));
      if (!okTxt) continue;
      var hh = ink.h * G.k, isNum = /^[0-9A-Za-z.\-]+$/.test(t), bx = { text: t, x: G.ox + ink.x * G.k, y: G.oy + ink.y * G.k, w: ink.w * G.k, h: hh, size: hh * 2.8346 / (isNum ? 0.74 : 0.92), conf: r.conf };
      out.push(bx); sb.push({ id: 'r' + out.length, text: t, x: bx.x, y: bx.y, w: bx.w, h: bx.h, size: bx.size }); break;
    }
  }
  return out;
}
/* 文字の箱（px）→ 要素（mm）。元の文字を隠す四角・文字色・位置揃えも用意しておく */
async function buildDetected(lines, ocr) {
  var G = M.geo, boxes = [];
  lines.forEach(function (l) {
    var b = { text: DD.cleanText(l.text), x: G.ox + l.x * G.k, y: G.oy + l.y * G.k, w: l.w * G.k, h: l.h * G.k, size: l.fh * G.k * 2.8346, conf: l.conf };
    if (!b.text || JTX.len(b.text) > 40 || b.size < 3 || b.size > 90 || b.w < 1) return;
    var sp = DD.splitLabelValue(b, ocr); if (sp) { boxes.push(sp[0]); boxes.push(sp[1]); } else boxes.push(b);
  });
  if (boxes.length > 300) boxes = boxes.slice(0, 300);
  if (ocr && M.method === 'ocr') { try { boxes = await rescueLabels(boxes); } catch (e) { if (M && M.cancelled) throw e; } }
  var sb = [];
  boxes.forEach(function (b, i) { b.id = 'd' + (i + 1); sb.push({ id: b.id, text: b.text, x: b.x, y: b.y, w: b.w, h: b.h, size: b.size }); });
  var padMm = 0.8, padPx = padMm / G.k;
  boxes.forEach(function (b) {
    var gl = b.x, gr = 210 - (b.x + b.w);
    boxes.forEach(function (o) {
      if (o === b) return;
      var ov = Math.min(b.y + b.h, o.y + o.h) - Math.max(b.y, o.y); if (ov < 0.5 * Math.min(b.h, o.h)) return;
      if (o.x + o.w <= b.x + b.w * 0.3) gl = Math.min(gl, Math.max(0, b.x - (o.x + o.w)));
      else if (o.x >= b.x + b.w * 0.7) gr = Math.min(gr, Math.max(0, o.x - (b.x + b.w)));
    });
    var al = Math.abs(gl - gr) < 0.3 * (gl + gr) ? 'center' : (gl < gr ? 'left' : 'right');
    var px = { x: (b.x - G.ox) / G.k, y: (b.y - G.oy) / G.k, w: b.w / G.k, h: b.h / G.k }, sm = DD.sampleBox(M.pix, px, padPx);
    var extra = Math.min(60, Math.max(b.w * 0.8, 20)), ex = b.x, ew = b.w;
    if (al === 'left') ew += Math.max(0, Math.min(extra, gr - 1.5));
    else if (al === 'right') { var m1 = Math.max(0, Math.min(extra, gl - 1.5)); ex -= m1; ew += m1; }
    else { var m2 = Math.max(0, Math.min(extra / 2, gl / 2 - 0.75, gr / 2 - 0.75)); ex -= m2; ew += m2 * 2; }
    var size = Math.max(4, Math.min(120, Math.round(b.size * 10) / 10));
    M.elements.push({ type: 'text', id: b.id, det: 1, x: ex, y: b.y, w: ew, h: b.h, text: b.text, name: '読み取った文字', font: 'gothic', size: size, weight: 400, color: sm.fg, align: al, valign: 'middle', fit: 'shrink', lineHeight: 1.2, padding: 0, conf: b.conf,
      gl: gl, gr: gr, ax: b.x, aw: b.w, cover: { x: b.x - padMm, y: b.y - padMm, w: b.w + padMm * 2, h: b.h + padMm * 2, fill: sm.bg, uniform: sm.uniform } });
    M.det[b.id] = 1; M.orig[b.id] = b.text;
  });
  M.sugg = DD.suggest(sb, { fuzzy: ocr });
  M.stats.count = 1 + boxes.length;
}

/* ---------- PDF ---------- */
async function loadPdfLib() {
  await loadScript(LIB.pdf);
  if (!g.pdfjsLib) throw new Error('PDFを読み取る部品を読み込めませんでした。通信状況を確認してもう一度お試しください。');
  if (!g.pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try { var t = await (await fetch(LIB.pdfw)).text(); g.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([t], { type: 'text/javascript' })); }
    catch (e) { g.pdfjsLib.GlobalWorkerOptions.workerSrc = LIB.pdfw; }
  }
  return g.pdfjsLib;
}
async function startPdf(f) {
  showBusy('PDFを読み込んでいます…');
  var lib = await loadPdfLib(), buf = await readBuf(f), doc;
  try { doc = await lib.getDocument(Object.assign({ data: new Uint8Array(buf) }, PDF_OPTS)).promise; }
  catch (e) {
    if (e && e.name === 'PasswordException') throw new Error('このPDFはパスワードで保護されています。パスワードを外してからもう一度お試しください。');
    throw new Error('PDFを開けませんでした。壊れているか、PDFではない可能性があります。');
  }
  M.pdf = doc;
  if (doc.numPages === 1) { await pickPdfPage(1); return; }
  showPicker({ title: 'どのページを使いますか？', sub: 'このPDFは' + doc.numPages + 'ページあります。受験票のデザインになっているページを選んでください。', count: doc.numPages, thumb: async function (i, box) {
    var pg = await doc.getPage(i + 1), v0 = pg.getViewport({ scale: 1 }), sc = 200 / v0.width, v = pg.getViewport({ scale: sc }), cv = document.createElement('canvas');
    cv.width = Math.round(v.width); cv.height = Math.round(v.height); await pg.render({ canvasContext: cv.getContext('2d'), viewport: v }).promise; box.appendChild(cv);
  }, label: function (i) { return (i + 1) + 'ページ'; }, pick: function (i) { pickPdfPage(i + 1); } });
}
async function renderPdfPage(n, sc) {
  var pg = await M.pdf.getPage(n), v0 = pg.getViewport({ scale: 1 });
  if (!sc) sc = Math.min(4, 1800 / Math.max(v0.width, v0.height));
  var v = pg.getViewport({ scale: sc }), cv = document.createElement('canvas');
  cv.width = Math.round(v.width); cv.height = Math.round(v.height);
  var x = cv.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height);
  await pg.render({ canvasContext: x, viewport: v }).promise;
  return { pg: pg, v: v, cv: cv, ratio: v0.width / v0.height, sc: sc };
}
/* PDFの文字情報に文字化け（私用領域・置換文字・Latin-1の化け等）があれば、その部分は画像から読み取り直す。大半が化けていればページ全体をOCRに切り替える */
async function fixGarbled(items, cv) {
  var bad = items.filter(function (i) { return i.bad; }), real = items.filter(function (i) { return String(i.s).trim(); });
  if (!bad.length) return { items: items, note: '', all: false };
  if (bad.length >= 0.4 * real.length || bad.length > 10) return { items: [], note: 'このPDFの文字情報が文字化けしていた（' + bad.length + 'か所）ため、画像として文字を読み取りました。', all: true };
  var out = items.filter(function (i) { return !i.bad; }), fixed = 0;
  showBusy('文字化けしている部分を読み取り直しています…', null, null, ocrNote());
  for (var k = 0; k < bad.length; k++) {
    try {
      var r = await DD.ocrRegion(cv, { x: bad[k].x, y: bad[k].y, w: bad[k].w, h: bad[k].h }, '', ocrProg), t = DD.cleanText(r.text);
      if (t && !JTX.isGarbage(t)) { out.push(Object.assign({}, bad[k], { s: t, bad: false, ocr: true })); fixed++; }
    } catch (e) { if (M && M.cancelled) throw e; }
  }
  return { items: out, note: 'PDFの文字情報のうち' + bad.length + 'か所が文字化けしていたため、その部分は画像から読み取り直しました（' + fixed + 'か所で成功）。読み間違いがないか確認してください。', all: false };
}
async function pickPdfPage(n) {
  showBusy('ページを取り込んでいます…');
  var r = await renderPdfPage(n), cv = r.cv;
  var src = cv.toDataURL('image/jpeg', 0.9); if (src.length > 1.6e6) src = cv.toDataURL('image/jpeg', 0.8);
  M.pdfSc = r.sc; M.pdfPage = n; M.noTextLayer = false; M.textItems = null;
  var items = [];
  try { items = await DD.pdfItems(r.pg, r.v, g.pdfjsLib); } catch (e) { items = []; }
  M.garbleNote = ''; M.garbleAll = false;
  var fx = await fixGarbled(items, r.cv); items = fx.items; M.garbleNote = fx.note; M.garbleAll = fx.all;
  var real = items.filter(function (i) { return String(i.s).trim(); });
  var mode = 'ocr';
  if (real.length >= 3) { M.textItems = items; mode = 'text'; } else M.noTextLayer = true;
  await startBackground(src, r.ratio, 'PDF', cv, mode);
}

/* ---------- PowerPoint ---------- */
async function startPptx(f) {
  showBusy('PowerPointを読み込んでいます…');
  if (!g.JSZip) { try { await loadScript(LIB.jszip); } catch (e) { throw new Error('ファイルを読み取る部品を読み込めませんでした。通信状況を確認してもう一度お試しください。'); } }
  var buf = await readBuf(f);
  M.pkg = await PptxImport.open(buf);
  if (M.pkg.slides.length === 1) { await pickSlide(0); return; }
  var n = M.pkg.slides.length, thumbOpts = { maxPx: 260, skipMedia: false };
  showPicker({ title: 'どのスライドをデザインにしますか？', sub: 'このファイルは' + n + 'ページあります。生徒ごとに1枚ずつ作ってある場合は、どれか1枚を選んでください（あとで、全スライドから名簿も読み取れます）。', count: n, thumb: async function (i, box) {
    var r = await PptxImport.convertSlide(M.pkg, i, thumbOpts);
    var V = tempVals(r.elements, r.bg, []), t = JT.render('free', H.sample(), V), s = box.clientWidth / (210 * PXMM) || 0.15;
    t.style.transform = 'scale(' + s + ')'; box.appendChild(t); H.fitAll(t);
  }, label: function (i) { return (i + 1) + '枚目'; }, pick: function (i) { pickSlide(i); } });
}
async function pickSlide(i) {
  showBusy('スライドを変換しています…');
  var r = await PptxImport.convertSlide(M.pkg, i, { maxPx: 1600 });
  M.slideIdx = i; M.elements = r.elements; M.bg = r.bg; M.stats = r.stats;
  M.orig = {}; M.map = {}; M.custom = {}; M.fixed = {};
  r.elements.forEach(function (e) { if (e.type === 'text') M.orig[e.id] = e.text; });
  M.sugg = suggest();
  showMap();
}

/* ---------- 差し込み候補の推定 ---------- */
function textEls() { return M.elements.filter(function (e) { return e.type === 'text' && !e.hidden && !e.det && String(e.text).trim() && !e.vertical; }); }
function suggest() { return DD.suggest(textEls(), {}); }

/* ---------- 画面（オーバーレイ） ---------- */
function openOverlay() {
  if (OV) return;
  OV = el('div'); OV.id = 'dimp'; OV.setAttribute('role', 'dialog'); OV.setAttribute('aria-modal', 'true'); OV.setAttribute('aria-label', '自分のデザインを取り込む');
  document.body.appendChild(OV);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
}
function closeOverlay() {
  if (!OV) return;
  if (M) M.cancelled = true;
  OV.remove(); OV = null; document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); M = null;
}
function onKey(e) { if (e.key === 'Escape' && OV) { if (M && M.pop) closePop(); else closeOverlay(); } }
var rzT = null;
function onResize() { clearTimeout(rzT); rzT = setTimeout(function () { if (M && M.stage) drawStage(); }, 120); }
function header(title, back) {
  var h = el('div', 'dp-h');
  if (back) { var b = btn('← ' + back.label); b.onclick = back.fn; h.appendChild(b); }
  h.appendChild(el('b', null, title)); h.appendChild(el('span', 'sp'));
  var x = btn('✕ やめる', '取り込みをやめて閉じる (Esc)'); x.onclick = closeOverlay; h.appendChild(x);
  return h;
}
function showBusy(msg, err, cancel, note) {
  openOverlay(); ensureCss(); OV.textContent = '';
  OV.appendChild(header('自分のデザインを取り込む'));
  var b = el('div', 'dp-b'), w = el('div', 'dp-busy');
  if (err) { w.appendChild(el('div', 'dp-err', err)); var c = btn('閉じる', null, 'pri'); c.onclick = closeOverlay; w.appendChild(c); }
  else {
    w.appendChild(el('div', 'sp1')); w.appendChild(el('div', 'bm', msg || ''));
    if (note) w.appendChild(el('p', 'bn', note)).style.whiteSpace = 'pre-line';
    if (cancel) { var cb = btn('キャンセル（手動で指定する）'); cb.onclick = cancel; w.appendChild(cb); }
  }
  b.appendChild(w); OV.appendChild(b);
  if (M) M.stage = null;
}
function showPicker(o) {
  OV.textContent = ''; if (M) M.stage = null;
  OV.appendChild(header('自分のデザインを取り込む'));
  var b = el('div', 'dp-b'), p = el('div', 'dp-pick');
  p.appendChild(el('h2', null, o.title)); p.appendChild(el('p', 'dp-sub', o.sub));
  var gr = el('div', 'dp-tg'); p.appendChild(gr); b.appendChild(p); OV.appendChild(b);
  var boxes = [];
  for (var i = 0; i < o.count; i++) (function (i) {
    var c = el('button', 'dp-th'); c.type = 'button'; var pg = el('div', 'pg'); c.appendChild(pg); c.appendChild(el('span', null, o.label(i)));
    c.onclick = function () { o.pick(i); }; gr.appendChild(c); boxes.push(pg);
  })(i);
  var token = M; (async function () {
    for (var i = 0; i < boxes.length; i++) {
      if (!OV || M !== token || M.stage) return;
      try { await o.thumb(i, boxes[i]); } catch (e) { boxes[i].textContent = '×'; }
      if (i % 3 === 2) await nextFrame();
    }
  })();
}

/* 項目カタログ（既存の名簿項目＋この取り込みで作った項目） */
function catalog() { return STD.concat(M.extra.filter(function (l) { return STD.indexOf(l) < 0; })); }
function usedLabels() { var o = []; Object.keys(M.map).forEach(function (k) { var l = M.map[k]; if (o.indexOf(l) < 0) o.push(l); }); return o; }
function itemsForDraft() {
  return usedLabels().map(function (l) {
    if (M.fixedLbl && M.fixedLbl[l] !== undefined) return JT.mkItem(l, 'fixed', { value: M.fixedLbl[l] });
    return JT.mkItem(l, 'column', { column: l });
  });
}
function tempVals(elements, bg, items) { return JT.mkVals('free', { items: items, tpl: { free: { bg: bg, elements: elements, guides: [] } } }); }
function coverEl(e) {
  var c = e.cover; return { type: 'rect', id: 'cv_' + e.id, x: c.x, y: c.y, w: c.w, h: c.h, fill: c.fill, stroke: 'transparent', strokeWidth: 0, locked: true, name: '元の文字を隠す', groupId: 'g_' + e.id };
}
function stageElements() {
  var out = [];
  M.elements.forEach(function (e) {
    if (M.det[e.id]) {
      var l = M.map[e.id], c = Object.assign({}, e); delete c.cover; c.text = l ? '{{' + l + '}}' : '';
      if (l) { out.push(coverEl(e)); c.groupId = 'g_' + e.id; out.push(c); }
      return;
    }
    if (M.custom[e.id]) { var c2 = Object.assign({}, e); c2.text = M.map[e.id] ? '{{' + M.map[e.id] + '}}' : ''; out.push(c2); return; }
    out.push(e);
  });
  return out;
}

function showMap() {
  OV.textContent = '';
  OV.appendChild(header('差し込み箇所の指定　' + M.name));
  var b = el('div', 'dp-map'), st = el('div', 'dp-stage'), side = el('div', 'dp-side');
  M.stage = st; b.appendChild(st); b.appendChild(side); OV.appendChild(b);
  M.side = side; M.fixedLbl = M.fixedLbl || {};
  drawSide(); drawStage();
}

function drawStage() {
  var st = M.stage; if (!st) return;
  closePop(true);
  var keepSc = st.scrollTop; st.textContent = '';
  var availW = Math.max(160, st.clientWidth - 32), availH = Math.max(200, st.clientHeight - 32);
  var sc = Math.min(availW / (210 * PXMM), availH / (297 * PXMM)); if (innerWidth <= 820) sc = Math.min(sc, availW / (210 * PXMM));
  sc = Math.max(0.2, sc); M.sc = sc;
  var inner = el('div', 'dp-inner'); inner.style.width = 210 * PXMM * sc + 'px'; inner.style.height = 297 * PXMM * sc + 'px'; M.inner = inner;
  var V = tempVals(stageElements(), M.bg, itemsForDraft()), t = JT.render('free', H.sample(), V);
  t.style.transform = 'scale(' + sc + ')'; inner.appendChild(t); st.appendChild(inner); H.fitAll(t);
  var hits = el('div', 'dp-hits' + (M.draw ? ' draw' : '')); inner.appendChild(hits); M.hits = hits;
  var sg = {}; (M.sugg || []).forEach(function (s) { if (!M.map[s.eid]) sg[s.eid] = s; });
  M.elements.forEach(function (e) {
    if (e.type !== 'text' || e.hidden) return;
    if (!M.custom[e.id] && !M.det[e.id] && !String(e.text).trim()) return;
    var h = el('div', 'hit'), map = M.map[e.id], fx = map && M.fixedLbl[map] !== undefined;
    h.setAttribute('data-eid', e.id);
    var q = JukenFree.geom(e);
    h.style.left = mm2px(q.x) + 'px'; h.style.top = mm2px(q.y) + 'px'; h.style.width = Math.max(10, mm2px(q.w)) + 'px'; h.style.height = Math.max(10, mm2px(q.h)) + 'px';
    if (e.rot) h.style.transform = 'rotate(' + e.rot + 'deg)';
    if (map) { h.classList.add(fx ? 'fix' : 'map'); h.appendChild(el('span', 'chip', (fx ? '固定：' : '') + map)); }
    else if (sg[e.id]) { h.classList.add('sug'); h.appendChild(el('span', 'chip', '候補：' + sg[e.id].label)); }
    else if (M.det[e.id]) h.classList.add('det');
    if (M.sel === e.id) { h.classList.add('cur'); if (M.custom[e.id]) { var rz = el('span', 'rz'); rz.setAttribute('data-rz', '1'); h.appendChild(rz); } }
    h.title = map ? '「' + map + '」に差し込み（クリックで変更）' : (M.det[e.id] ? '『' + JTX.first(String(e.text), 20) + '』をクリックして、何にするか選ぶ' : 'クリックして、この文字を何にするか選ぶ');
    hits.appendChild(h);
  });
  hits.onpointerdown = onDown;
  st.scrollTop = keepSc;
  if (M.sel && M.reopen) { M.reopen = false; openPop(M.sel); }
}

/* ---- ポインタ操作：クリック=ポップオーバー、カスタム枠はドラッグ移動・リサイズ、描画モードで枠を追加 ---- */
function pageMm(ev) { var r = M.inner.getBoundingClientRect(); return { x: (ev.clientX - r.left) / (PXMM * M.sc), y: (ev.clientY - r.top) / (PXMM * M.sc) }; }
function onDown(ev) {
  if (ev.button > 0) return;
  var tgt = ev.target.closest('.hit'), rz = ev.target.getAttribute && ev.target.getAttribute('data-rz');
  if (M.draw && !tgt) {
    ev.preventDefault();
    var p0 = pageMm(ev), box = el('div', 'hit map'); box.style.cssText += ';pointer-events:none;'; M.hits.appendChild(box);
    var move = function (e2) { var p = pageMm(e2), x = Math.min(p0.x, p.x), y = Math.min(p0.y, p.y); box.style.left = mm2px(x) + 'px'; box.style.top = mm2px(y) + 'px'; box.style.width = mm2px(Math.abs(p.x - p0.x)) + 'px'; box.style.height = mm2px(Math.abs(p.y - p0.y)) + 'px'; };
    var up = function (e2) {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); box.remove();
      var p = pageMm(e2), x = Math.min(p0.x, p.x), y = Math.min(p0.y, p.y), w = Math.abs(p.x - p0.x), h = Math.abs(p.y - p0.y);
      if (w < 5 || h < 3) { w = 60; h = 9; x = Math.max(0, Math.min(210 - w, p0.x - w / 2)); y = Math.max(0, Math.min(297 - h, p0.y - h / 2)); }
      M.draw = false; syncDrawBtn(); addFrame(x, y, w, h);
    };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); return;
  }
  if (!tgt) { if (M.pop) closePop(); return; }
  var eid = tgt.getAttribute('data-eid'), e = elOf(eid); if (!e) return;
  if (M.custom[eid] && M.sel === eid || (M.custom[eid] && rz)) {
    ev.preventDefault();
    var s0 = { x: ev.clientX, y: ev.clientY }, o = { x: e.x, y: e.y, w: e.w, h: e.h }, moved = false, k = 1 / (PXMM * M.sc);
    var mv = function (e2) {
      var dx = (e2.clientX - s0.x) * k, dy = (e2.clientY - s0.y) * k;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 1) return; moved = true; if (M.pop) closePop(true);
      if (rz) { e.w = Math.max(5, o.w + dx); e.h = Math.max(3, o.h + dy); } else { e.x = o.x + dx; e.y = o.y + dy; }
      tgt.style.left = mm2px(e.x) + 'px'; tgt.style.top = mm2px(e.y) + 'px'; tgt.style.width = mm2px(e.w) + 'px'; tgt.style.height = mm2px(e.h) + 'px';
    };
    var upf = function () { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', upf); if (moved) { M.sel = eid; M.reopen = true; drawStage(); } else openPop(eid); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', upf); return;
  }
  M.sel = eid; openPop(eid);
}
function elOf(id) { for (var i = 0; i < M.elements.length; i++) if (M.elements[i].id === id) return M.elements[i]; return null; }
function addFrame(x, y, w, h) {
  var id = 'c' + (++M.seq) + Math.random().toString(36).slice(2, 5), size = Math.max(8, Math.min(40, Math.round(h * 2.835 * 0.62)));
  M.elements.push({ type: 'text', id: id, x: x, y: y, w: w, h: h, text: '', name: '差し込み枠', font: 'gothic', size: size, weight: 400, color: '#111111', align: 'center', valign: 'middle', fit: 'shrink', lineHeight: 1.2, padding: 0 });
  M.custom[id] = 1; M.sel = id; M.reopen = true; drawStage(); drawSide();
}

/* ---- ポップオーバー ---- */
function closePop(keepSel) { if (M && M.pop) { M.pop.remove(); M.pop = null; } if (!keepSel && M) { M.sel = null; if (M.hits) { var c = M.hits.querySelector('.hit.cur'); if (c) c.classList.remove('cur'); } } }
function mapEl(eid, label) {
  if (label) M.map[eid] = label; else delete M.map[eid];
  if (label && STD.indexOf(label) < 0 && M.extra.indexOf(label) < 0 && !(M.fixedLbl && M.fixedLbl[label] !== undefined)) M.extra.push(label);
  M.rosterSig = '';
}
function setFixed(eid, label) {
  var e = elOf(eid); M.fixedLbl[label] = M.fixedLbl[label] !== undefined ? M.fixedLbl[label] : String(M.orig[eid] != null ? M.orig[eid] : e.text).replace(/\s*\n\s*/g, ' ');
  M.map[eid] = label; M.rosterSig = '';
}
function openPop(eid) {
  var e = elOf(eid); if (!e) return;
  closePop(true); M.sel = eid;
  var hit = M.hits.querySelector('[data-eid="' + eid + '"]'); if (hit) { M.hits.querySelectorAll('.hit.cur').forEach(function (n) { n.classList.remove('cur'); }); hit.classList.add('cur'); }
  var pop = el('div', 'dp-pop'); M.pop = pop; pop.onpointerdown = function (ev) { ev.stopPropagation(); };
  pop.appendChild(el('h4', null, 'この文字を何にしますか？'));
  var org = M.custom[eid] ? '差し込み枠' : '元の文字：『' + JTX.first(String(M.orig[eid] != null ? M.orig[eid] : e.text).replace(/\s+/g, ' ').trim(), 30) + '』';
  pop.appendChild(el('p', 'org', org));
  var cur = M.map[eid], sg = (M.sugg || []).filter(function (s) { return s.eid === eid; })[0], bt = el('div', 'bt');
  var done = function () { drawStage(); drawSide(); };
  catalog().forEach(function (l) {
    var b = btn(l); if (cur === l && !(M.fixedLbl[l] !== undefined)) b.className = 'on'; else if (sg && sg.label === l && !cur) { b.className = 'rec'; b.title = 'おすすめ'; }
    b.onclick = function () { mapEl(eid, l); M.reopen = true; done(); }; bt.appendChild(b);
  });
  var fx = btn('変えない（固定）', '全員同じ文字のまま'); fx.onclick = function () { mapEl(eid, null); M.sel = null; done(); };
  if (!cur) fx.className = 'on'; bt.appendChild(fx);
  if (M.custom[eid]) { var dl = btn('この枠を削除'); dl.onclick = function () { M.elements = M.elements.filter(function (x) { return x.id !== eid; }); delete M.custom[eid]; delete M.map[eid]; M.sel = null; done(); }; bt.appendChild(dl); }
  pop.appendChild(bt);
  var ln = el('div', 'ln'), ni = el('input'); ni.type = 'text'; ni.placeholder = '新しい項目名（例：受験会場）'; ni.maxLength = 20; ni.setAttribute('aria-label', '新しい項目名');
  var na = btn('追加'); na.onclick = function () { var v = ni.value.trim(); if (!v) { ni.focus(); return; } mapEl(eid, v); M.reopen = true; done(); };
  ni.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); na.click(); } };
  ln.appendChild(ni); ln.appendChild(na); pop.appendChild(el('div', 'sm', '新しい項目（名簿の列）'));
  pop.appendChild(ln);
  if (!M.custom[eid]) {
    pop.appendChild(el('div', 'sm', '「試験日」「試験場」など、全員共通だけど後で書き換えたい文字'));
    var l2 = el('div', 'ln'), fi = el('input'); fi.type = 'text'; fi.placeholder = '項目名（例：試験日）'; fi.maxLength = 20; fi.setAttribute('aria-label', '試験情報の項目名');
    var fa = btn('あとで編集できるように'); fa.title = 'ステップ②「試験の情報」で書き換えられます';
    fa.onclick = function () { var v = fi.value.trim() || (cur && M.fixedLbl[cur] !== undefined ? cur : ''); if (!v) { fi.focus(); return; } setFixed(eid, v); M.sel = null; done(); };
    l2.appendChild(fi); l2.appendChild(fa); pop.appendChild(l2);
  }
  if (cur || M.custom[eid]) styleRow(pop, e);
  var cb = btn('閉じる'); cb.style.marginTop = '8px'; cb.onclick = function () { closePop(); }; pop.appendChild(cb);
  M.inner.appendChild(pop);
  placePop(pop, e);
}
function styleRow(pop, e) {
  pop.appendChild(el('div', 'sm', '文字の見た目'));
  var st = el('div', 'st'), fs = el('select'); JukenFonts.fillSelect(fs, e.font); fs.setAttribute('aria-label', '書体');
  fs.onchange = function () { e.font = fs.value; drawStage(); };
  var mi = btn('−', '小さく'), pl = btn('＋', '大きく'), nm = el('span', 'num', String(Math.round(e.size * 10) / 10));
  var ch = function (d) { e.size = Math.max(4, Math.min(200, Math.round((e.size + d) * 10) / 10)); nm.textContent = String(e.size); redrawKeep(); };
  mi.onclick = function () { ch(-1); }; pl.onclick = function () { ch(1); };
  var co = el('input'); co.type = 'color'; co.value = /^#[0-9a-f]{6}$/i.test(e.color) ? e.color : '#111111'; co.setAttribute('aria-label', '文字の色'); co.oninput = function () { e.color = co.value; redrawKeep(); };
  st.appendChild(fs); st.appendChild(mi); st.appendChild(nm); st.appendChild(pl); st.appendChild(co);
  [['left', '左'], ['center', '中'], ['right', '右']].forEach(function (a) { var b = btn(a[1], '文字位置'); if (e.align === a[0]) b.className = 'on'; b.onclick = function () { e.align = a[0]; redrawKeep(); st.querySelectorAll('button').forEach(function (x) { if (/^[左中右]$/.test(x.textContent)) x.className = ''; }); b.className = 'on'; }; st.appendChild(b); });
  pop.appendChild(st);
}
function redrawKeep() { var sel = M.sel, pop = M.pop, top = M.stage.scrollTop; /* ポップオーバーを残したまま、ページだけ描き直す */
  var inner = M.inner, t = inner.querySelector('.ticket'); if (!t) return;
  var V = tempVals(stageElements(), M.bg, itemsForDraft()), n = JT.render('free', H.sample(), V); n.style.transform = 'scale(' + M.sc + ')'; inner.replaceChild(n, t); H.fitAll(n); M.stage.scrollTop = top; }
function placePop(pop, e) {
  if (innerWidth <= 820) return;
  var q = JukenFree.geom(e), iw = parseFloat(M.inner.style.width), ih = parseFloat(M.inner.style.height), pw = 300;
  var left = mm2px(q.x), top = mm2px(q.y + q.h) + 8;
  left = Math.max(-10, Math.min(left, iw - pw + 40));
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
  var need = top + pop.offsetHeight;
  if (need > ih + 40) { var up = mm2px(q.y) - pop.offsetHeight - 8; pop.style.top = (up > -200 ? up : Math.max(0, ih - pop.offsetHeight)) + 'px'; }
  setTimeout(function () { var r = pop.getBoundingClientRect(), sr = M.stage.getBoundingClientRect(); if (r.bottom > sr.bottom) M.stage.scrollTop += r.bottom - sr.bottom + 8; if (r.top < sr.top) M.stage.scrollTop -= sr.top - r.top + 8; }, 0);
}

/* ---- 右パネル ---- */
function syncDrawBtn() { var b = M.side && M.side.querySelector('.dp-draw'); if (b) { b.classList.toggle('on', !!M.draw); b.textContent = M.draw ? 'ページ上をドラッグして枠をかこむ（Escで中止）' : '＋ 差し込み枠を追加'; } if (M.hits) M.hits.classList.toggle('draw', !!M.draw); }
function hasDet() { return Object.keys(M.det || {}).length > 0; }
function drawSide() {
  var s = M.side, keep = s.querySelector('.dp-sc'), top = keep ? keep.scrollTop : 0; s.textContent = '';
  var sc = el('div', 'dp-sc'); s.appendChild(sc);
  sc.appendChild(el('h2', null, '生徒ごとに変わる文字をクリックしてください'));
  sc.appendChild(el('p', 'dp-sub', M.stats && M.stats.bgOnly ? (hasDet() ? '取り込んだ' + M.stats.what + 'は背景になりました。見つかった文字（点線の枠）をクリックして項目を選ぶと、元の文字を隠して差し込みます。見つからない場所は「差し込み枠を追加」で指定できます。' : '取り込んだ' + M.stats.what + 'は背景になりました。「差し込み枠を追加」で、受験番号や氏名を入れる場所をドラッグで指定します。') : '受験番号・氏名など、人によって変わる文字をクリックして項目を選びます。試験日や会場など全員同じものは、そのままで構いません。'));
  methodNote(sc);
  summary(sc);
  /* おすすめ */
  var pend = (M.sugg || []).filter(function (x) { return !M.map[x.eid] && elOf(x.eid); });
  if (pend.length) {
    var sec = el('div', 'dp-sec'), h3 = el('h3', null, 'おすすめ（' + pend.length + '件）'); sec.appendChild(h3);
    var all = btn('おすすめを全部適用', '候補をまとめて割り当てます', 'pri'); all.style.width = '100%'; all.style.marginBottom = '6px';
    all.onclick = function () { pend.forEach(function (x) { mapEl(x.eid, x.label); }); drawStage(); drawSide(); H.toast(pend.length + '件を割り当てました'); }; sec.appendChild(all);
    pend.forEach(function (x) {
      var r = el('div', 'dp-sg'), tx = el('span', 'tx'); tx.appendChild(el('b', null, x.label)); tx.appendChild(document.createTextNode('　←『' + JTX.first(String(M.orig[x.eid] || '').replace(/\s+/g, ' ').trim(), 14) + '』（' + x.why + '）'));
      tx.title = x.why + '（確度：' + DD.confWord(x.conf == null ? 0.7 : x.conf) + '）'; r.appendChild(tx); if (x.conf != null) r.appendChild(el('span', 'cf', '確度' + DD.confWord(x.conf))); var ok = btn('適用'); ok.onclick = function (ev) { ev.stopPropagation(); mapEl(x.eid, x.label); drawStage(); drawSide(); }; r.appendChild(ok);
      r.onclick = function () { M.sel = x.eid; var h = M.hits && M.hits.querySelector('[data-eid="' + x.eid + '"]'); if (h) h.scrollIntoView({ block: 'center', behavior: 'smooth' }); openPop(x.eid); };
      sec.appendChild(r);
    });
    sc.appendChild(sec);
  }
  /* 割り当て済み */
  var keys = Object.keys(M.map).filter(function (k) { return elOf(k); });
  var sec2 = el('div', 'dp-sec'); sec2.appendChild(el('h3', null, '差し込む文字（' + keys.length + '）'));
  if (!keys.length) sec2.appendChild(el('p', 'dp-sub', 'まだありません。ページの文字をクリックしてください。'));
  keys.forEach(function (k) {
    var r = el('div', 'dp-mp'), l = M.map[k], fx = M.fixedLbl[l] !== undefined;
    r.appendChild(el('b', null, (fx ? '固定：' : '') + l));
    var tx = el('span', 'tx', M.custom[k] ? '（差し込み枠）' : '←『' + JTX.first(String(M.orig[k] || '').replace(/\s+/g, ' ').trim(), 16) + '』'); r.appendChild(tx);
    var de = M.det[k] && elOf(k); if (de && de.cover && !de.cover.uniform) { var wb = el('div', 'dp-wb', '背景が模様のため消し跡が見える可能性'); wb.style.marginLeft = '0'; r.style.flexWrap = 'wrap'; r.appendChild(wb); }
    var go = btn('選択', '位置を表示'); go.onclick = function () { M.sel = k; var h = M.hits && M.hits.querySelector('[data-eid="' + k + '"]'); if (h) h.scrollIntoView({ block: 'center', behavior: 'smooth' }); openPop(k); }; r.appendChild(go);
    var x = btn('✕', '割り当てをやめる'); x.setAttribute('aria-label', '割り当てをやめる'); x.onclick = function () { mapEl(k, null); drawStage(); drawSide(); }; r.appendChild(x);
    sec2.appendChild(r);
  });
  sc.appendChild(sec2);
  var dr = btn('＋ 差し込み枠を追加', '空いている場所に、項目を入れる枠をドラッグで作ります'); dr.className = 'dp-draw' + (M.draw ? ' on' : ''); dr.style.width = '100%';
  dr.onclick = function () { M.draw = !M.draw; closePop(); syncDrawBtn(); }; sc.appendChild(dr);
  /* 名簿の読み取り（複数スライドのPPTX／複数ページのPDF／複数の画像） */
  var nPages = rosterPages();
  if (nPages > 1) {
    var isP = M.kind === 'pptx', isPdfT = M.kind === 'pdf' && M.method === 'text';
    var rs = el('div', 'dp-sec'); rs.style.marginTop = '14px';
    rs.appendChild(el('h3', null, isP ? '作成済みのスライドから名簿を作る' : (isPdfT ? '作成済みのPDFから名簿を作る' : '作成済みの画像から名簿を作る')));
    var nm = isP ? 'スライド' : (isPdfT ? 'PDF' : '画像'), unit = isP ? '枚' : (M.kind === 'images' ? '枚' : 'ページ');
    var rb = btn(M.wantRoster ? '✓ ' + nm + 'から名簿も読み取る' : nm + 'から名簿も読み取る（' + nPages + unit + '）', '全ページの同じ位置の文字を、名簿の貼り付け欄に入れます'); rb.style.width = '100%'; if (M.wantRoster) rb.className = 'on';
    rb.onclick = function () { M.wantRoster = !M.wantRoster; if (M.wantRoster && isP) readRoster(true); else { drawSide(); } }; rs.appendChild(rb);
    var info;
    if (isP) info = M.wantRoster ? (M.rosterLines ? M.rosterN + '名分を読み取りました（名簿の欄に入ります。この端末内だけで処理され、保存・送信されません）。' : '「このデザインで名簿を入れる」を押すと読み取ります。') : '生徒ごとに1枚ずつ作ってあるファイルなら、割り当てた項目の文字を全スライドから集めて、名簿に入れます。';
    else if (isPdfT) info = M.wantRoster ? '「このデザインで名簿を入れる」を押すと、全ページの文字情報から読み取ります（正確）。この端末内だけで処理され、保存・送信されません。' : '生徒ごとに1ページずつのPDFなら、割り当てた項目の文字を全ページから集めて、名簿に入れます。';
    else info = M.wantRoster ? '「このデザインで名簿を入れる」を押すと、各ページの文字を読み取ります（時間がかかります）。読み取った内容は確認画面で直せます。この端末内だけで処理され、保存・送信されません。' : '生徒ごとに1ページずつあるなら、割り当てた場所の文字を全ページから読み取って名簿に入れます（読み取り結果は確認してから入ります）。';
    info = el('p', 'dp-sub', info); info.style.marginTop = '6px'; rs.appendChild(info);
    sc.appendChild(rs);
  }
  var ft = el('div', 'dp-sf');
  var go2 = btn('このデザインで名簿を入れる', null, 'pri'); go2.onclick = finish;
  var n = Object.keys(M.map).filter(function (k) { return elOf(k); }).length;
  if (!n) { var hint = el('p', 'dp-sub', '※ 差し込む文字がまだありません。このまま進むと、全員同じ受験票になります。'); hint.style.margin = '0'; ft.appendChild(hint); }
  ft.appendChild(go2); s.appendChild(ft);
  sc.scrollTop = top;
}
function methodNote(box) {
  if (!M.stats || !M.stats.bgOnly || !M.method) return;
  var d = el('div', 'dp-meth');
  if (M.method === 'text') {
    d.classList.add('mok'); d.appendChild(el('b', null, 'PDFの文字情報から自動判定しました（正確）')); d.appendChild(document.createTextNode('文字の位置と大きさをPDFから直接読み取っています。'));
    /* 文字情報が見た目と違う（化けている）ときの手動の逃げ道：画像として読み取り直す */
    var rb = btn('文字がおかしいときは、画像から読み取り直す', 'PDFの文字情報を使わず、見た目の文字を画像として読み取ります'); rb.style.cssText = 'display:block;margin-top:6px;padding:2px 8px;font-size:12px';
    rb.onclick = async function () { var tk = M; try { M.garbleNote = '読み取り直しを指定したため、画像として文字を読み取りました。'; M.garbleAll = true; await startBackground(M.elements[0].src, M.geo.cw / M.geo.ch, 'PDF', M.pix, 'ocr'); } catch (e) { if (M === tk && !M.cancelled) showMap(); } };
    d.appendChild(rb);
  }
  else if (M.method === 'ocr') { d.classList.add('mck'); d.appendChild(el('b', null, '画像の文字を読み取って判定しました（要確認）')); d.appendChild(document.createTextNode((M.detectNote ? M.detectNote + ' ' : '') + '読み間違いがないか、候補をよく確認してください。画像はこの端末のブラウザ内だけで処理され、外部には送られません。')); }
  else if (M.detectNote) { d.classList.add('mck'); d.appendChild(document.createTextNode(M.detectNote)); }
  else if (!(M.garbleNote && !M.garbleAll)) return;
  if (M.garbleNote && !M.garbleAll) { d.classList.remove('mok'); d.classList.add('mck'); var gp = el('div'); gp.style.marginTop = '4px'; gp.appendChild(el('b', null, '文字化けを検出しました')); gp.appendChild(document.createTextNode('　' + M.garbleNote)); d.appendChild(gp); }
  box.appendChild(d);
}
function summary(box) {
  var S = M.stats, d = document.createElement('details'); d.className = 'dp-sum'; d.open = innerWidth > 820 && !!(S.skippedTotal || S.emf.length || S.aspectDiff);
  var sm = el('summary', null, S.bgOnly ? '取り込み結果（' + S.what + 'を背景にしました）' : '取り込み結果（' + S.count + '個の要素' + (S.skippedTotal ? '・' + S.skippedTotal + '個は取り込めず' : '') + '）'); d.appendChild(sm);
  var b = el('div'); d.appendChild(b);
  if (S.aspectDiff) b.appendChild(el('p', 'w', S.bgOnly ? '元の縦横比がA4（210×297mm）と違うため、全体を縮小して中央に置きました（上下または左右に余白ができます）。' : 'スライドの縦横比がA4（210×297mm）と違うため、縦横比を保ったまま縮小して中央に置きました（余白ができます）。'));
  if (S.emf.length) b.appendChild(el('p', 'w', '読み込めない形式の画像が' + S.emf.length + '点あります（' + S.emf.map(function (x) { return x.type; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join('・') + '）。ブラウザでは表示できないため、枠だけ置きました。編集画面で右クリック→「図の変更」で差し替えてください。'));
  var ks = Object.keys(S.skipped || {}); if (ks.length) b.appendChild(el('p', 'w', '取り込めなかったもの：' + ks.map(function (k) { return k + ' ' + S.skipped[k] + '個'; }).join('、')));
  if (S.dropped) b.appendChild(el('p', 'w', '要素が多すぎたため、前面側の' + S.dropped + '個は省略しました。'));
  if (S.notes && S.notes.length) b.appendChild(el('p', null, '一部の塗りは単色で近似しました。'));
  if (!S.bgOnly) {
    var p = el('p', null, '見た目が崩れる場合は、PowerPointで「PDFとして保存」したものを取り込むと確実です。 ');
    var pb = btn('PDFを取り込む…'); pb.style.padding = '1px 8px'; pb.style.fontSize = '12px'; pb.onclick = function () { pickFile('.pdf,application/pdf'); }; p.appendChild(pb); b.appendChild(p);
  } else if (S.bgOnly) b.appendChild(el('p', null, 'この画像の上に、文字の差し込み枠を重ねます。'));
  box.appendChild(d);
}

/* ---------- 名簿の読み取り・確定 ---------- */
function mapSig() { return JSON.stringify(M.map) + '|' + M.slideIdx; }
function rosterPages() {
  if (!M) return 0;
  if (M.kind === 'pptx') return M.pkg ? M.pkg.slides.length : 0;
  if (M.kind === 'pdf') return M.pdf ? M.pdf.numPages : 0;
  if (M.kind === 'images') return M.files ? M.files.length : 0;
  return 0;
}
function sideProg(t) { var side = M.side && M.side.querySelector('.dp-sf'); if (side) { var p = side.querySelector('.dp-prog') || side.insertBefore(el('p', 'dp-sub dp-prog'), side.firstChild); p.textContent = t; } }
function rosterTargets() {
  var first = {};
  Object.keys(M.map).forEach(function (eid) { var l = M.map[eid]; if (M.fixedLbl[l] !== undefined || first[l] || !elOf(eid)) return; if (M.kind === 'pptx' && M.custom[eid]) return; first[l] = eid; });
  return first;
}
async function readRoster(show) {
  var sig = mapSig();
  if (M.rosterLines && M.rosterSig === sig) { if (show) drawSide(); return M.rosterLines; }
  var by = {}, firstEid = rosterTargets();
  var labels = Object.keys(firstEid), n = M.pkg.slides.length; labels.forEach(function (l) { by[l] = []; });
  var token = M;
  for (var i = 0; i < n; i++) {
    if (!OV || M !== token) return null;
    if (show || i % 4 === 0) { sideProg('名簿を読み取っています… ' + (i + 1) + ' / ' + n); await nextFrame(); }
    var tx = {}; try { tx = await PptxImport.slideTexts(M.pkg, i); } catch (e) { tx = {}; }
    labels.forEach(function (l) { by[l].push(String(tx[firstEid[l]] == null ? '' : tx[firstEid[l]]).replace(/\s*\n\s*/g, ' ').replace(/[ 　]+$/, '').replace(/^[ 　]+/, '')); });
  }
  M.rosterLines = by; M.rosterN = n; M.rosterSig = sig;
  if (show) drawSide();
  return by;
}
function rosterRect(e) {
  if (!e.det) return e;
  var cl = function (v, m) { return Math.max(0, Math.min(v, m)); }, x = e.ax, w = e.aw;
  if (e.align === 'left') w += cl(e.gr - 1.5, 80);
  else if (e.align === 'right') { var m1 = cl(e.gl - 1.5, 80); x -= m1; w += m1; }
  else { var m2 = cl(Math.min(e.gl, e.gr) / 2 - 0.75, 40); x -= m2; w += m2 * 2; }
  return { x: x, y: e.y, w: w, h: e.h };
}
function pageFrac(e0) { var G = M.geo, e = rosterRect(e0); return { x: (e.x - G.ox) / G.k / G.cw, y: (e.y - G.oy) / G.k / G.ch, w: e.w / G.k / G.cw, h: e.h / G.k / G.ch }; }
function fixVal(l, t) { t = DD.cleanText(t); return l === '受験番号' ? DD.halfDigits(t).replace(/[ 　]+/g, '') : t; }
/* PDFの文字情報から（全ページ） */
async function readRosterPdf() {
  var tg = rosterTargets(), labels = Object.keys(tg), n = M.pdf.numPages, by = {}, token = M, lib = g.pdfjsLib;
  labels.forEach(function (l) { by[l] = []; });
  var fr = {}; labels.forEach(function (l) { fr[l] = pageFrac(elOf(tg[l])); });
  for (var i = 1; i <= n; i++) {
    if (!OV || M !== token) return null;
    sideProg('名簿を読み取っています… ' + i + ' / ' + n); if (i % 3 === 1) await nextFrame();
    var pg = await M.pdf.getPage(i), vp = pg.getViewport({ scale: M.pdfSc }), items = [];
    try { items = await DD.pdfItems(pg, vp, lib); } catch (e) { items = []; }
    var pcv = null;
    for (var li = 0; li < labels.length; li++) {
      var l = labels[li];
      var r = { x: fr[l].x * vp.width, y: fr[l].y * vp.height, w: fr[l].w * vp.width, h: fr[l].h * vp.height }, px = r.w * 0.6, py = r.h * 0.2; /* ページごとに位置が少しずれていても拾えるよう、横に広めに見る */
      var ins = items.filter(function (it) { if (!String(it.s).trim()) return false; var cx = it.x + it.w / 2, cy = it.y + it.h / 2; return cx >= r.x - px && cx <= r.x + r.w + px && cy >= r.y - py && cy <= r.y + r.h + py; });
      if (ins.some(function (it) { return it.bad; })) {   /* 文字化けしている → この場所だけ画像から読む */
        try { if (!pcv) pcv = (await renderPdfPage(i, M.pdfSc)).cv; var oc = await DD.ocrRegion(pcv, r, l, function () { }); by[l].push(fixVal(l, oc.text)); M.garbleHit = (M.garbleHit || 0) + 1; continue; }
        catch (e2) { if (M !== token) return null; ins = ins.filter(function (it) { return !it.bad; }); }
      }
      /* 行にまとめてから、枠に重なる行を採る（重なる行が無ければ、いちばん近い行） */
      var lines = DD.mergeItems(ins), tol = r.h * 0.12, hit = lines.filter(function (q) { return q.x < r.x + r.w + tol && q.x + q.w > r.x - tol && q.y < r.y + r.h + tol && q.y + q.h > r.y - tol; });
      if (!hit.length && lines.length) {
        var best = null, bd = 1e9; lines.forEach(function (q) { var d = Math.abs(q.x + q.w / 2 - (r.x + r.w / 2)) + Math.abs(q.y + q.h / 2 - (r.y + r.h / 2)); if (d < bd) { bd = d; best = q; } }); hit = [best];
      }
      by[l].push(fixVal(l, hit.sort(function (a, b) { return a.y - b.y || a.x - b.x; }).map(function (x) { return x.text; }).join(' ')));
    }
  }
  M.rosterN = n; return by;
}
async function pageCanvasAt(i) {
  if (M.kind === 'pdf') return (await renderPdfPage(i + 1, M.pdfSc)).cv;
  return (await fileCanvas(M.files[i])).cv;
}
/* OCRで（全ページの、割り当てた場所だけ）→ 確認画面 */
async function readRosterOcr() {
  var tg = rosterTargets(), labels = Object.keys(tg), n = rosterPages(), token = M, rows = [];
  if (!labels.length) return {};
  var fr = {}; labels.forEach(function (l) { fr[l] = pageFrac(elOf(tg[l])); });
  M.rosterCancel = false;
  showBusy('名簿を読み取り中… 0 / ' + n + 'ページ', null, function () { M.rosterCancel = true; DD.cancelOcr(); }, ocrNote());
  try {
    for (var i = 0; i < n; i++) {
      if (!OV || M !== token) return null;
      setBusyMsg('名簿を読み取り中… ' + (i + 1) + ' / ' + n + 'ページ');
      var cv = await pageCanvasAt(i), row = { vals: [], conf: [] };
      for (var j = 0; j < labels.length; j++) {
        var f = fr[labels[j]], r = await DD.ocrRegion(cv, { x: f.x * cv.width, y: f.y * cv.height, w: f.w * cv.width, h: f.h * cv.height }, labels[j], function (m) { if (m && /loading|download/i.test(m.status || '')) ocrProg(m); });
        row.vals.push(r.text); row.conf.push(r.conf);
      }
      rows.push(row);
    }
  } catch (e) {
    if (M !== token || !OV) return null;
    showMap();
    if (!(e && e.message === 'cancel')) H.toast((e && e.message) || '名簿を読み取れませんでした');
    return null;
  }
  return await confirmRoster(labels, rows);
}
function confirmRoster(labels, rows) {
  return new Promise(function (ok) {
    var token = M; OV.textContent = '';
    OV.appendChild(header('名簿の確認', { label: '戻る', fn: function () { ok(null); if (M === token) showMap(); } }));
    var box = el('div', 'dp-conf'), h2 = el('h2', null, '読み取った名簿を確認してください'); h2.style.cssText = 'font-size:16px;margin:0 0 4px'; box.appendChild(h2);
    box.appendChild(el('p', 'dp-sub', '黄色い欄は、自信がない（または読み取れなかった）ところです。直してから「名簿に入れる」を押してください。この端末内だけで処理され、保存・送信されません。'));
    var tb = document.createElement('table'), th = el('tr'), inputs = [], low = 0;
    th.appendChild(el('th', null, M.kind === 'images' ? '画像' : 'ページ')); labels.forEach(function (l) { th.appendChild(el('th', null, l)); }); tb.appendChild(th);
    rows.forEach(function (r, i) {
      var tr = el('tr'); tr.appendChild(el('td', null, (i + 1) + (M.kind === 'images' ? '枚目' : 'ページ'))); var ri = [];
      labels.forEach(function (l, j) {
        var td = el('td'), inp = el('input'); inp.type = 'text'; inp.value = r.vals[j]; inp.setAttribute('aria-label', (i + 1) + '番目の' + l);
        if (!r.vals[j] || r.conf[j] < 70) { td.className = 'low'; low++; inp.oninput = function () { td.className = ''; }; }
        td.appendChild(inp); tr.appendChild(td); ri.push(inp);
      });
      inputs.push(ri); tb.appendChild(tr);
    });
    box.appendChild(tb); OV.appendChild(box);
    var ft = el('div', 'dp-cf'), go = btn('この内容で名簿に入れる', null, 'pri');
    go.onclick = function () {
      var by = {}; labels.forEach(function (l, j) { by[l] = inputs.map(function (ri) { return ri[j].value.replace(/^[ 　]+|[ 　]+$/g, ''); }); });
      M.rosterN = rows.length; ok(by);
    };
    var lw = el('span', 'dp-sub', low ? '要確認：' + low + 'か所' : '要確認の欄はありません'); lw.style.margin = '0';
    ft.appendChild(go); ft.appendChild(lw); OV.appendChild(ft);
  });
}
async function finish() {
  var items = itemsForDraft(), idOf = {}; items.forEach(function (it) { idOf[it.label] = it.id; });
  var elements = [];
  M.elements.forEach(function (e) {
    var l = M.map[e.id];
    if (M.det[e.id]) {
      if (!l) return;
      elements.push(coverEl(e));
      elements.push({ type: 'field', id: e.id, x: e.x, y: e.y, w: e.w, h: e.h, name: l, itemId: idOf[l], showLabel: false, font: e.font, size: e.size, weight: 400, color: e.color, align: e.align, valign: 'middle', fit: 'shrink', lineHeight: 1.2, padding: 0, groupId: 'g_' + e.id });
      return;
    }
    if (M.custom[e.id] && !l) return;
    var c = JSON.parse(JSON.stringify(e));
    if (l) { c.text = '{{' + l + '}}'; if (!c.vertical) c.fit = 'shrink'; }
    elements.push(c);
  });
  var rosterLines = null;
  if (M.wantRoster && Object.keys(M.map).length && rosterPages() > 1) {
    var side = M.side && M.side.querySelector('.dp-sf'); if (side) side.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    if (M.kind === 'pptx') rosterLines = await readRoster(false);
    else if (M.kind === 'pdf' && M.method === 'text') rosterLines = await readRosterPdf();
    else rosterLines = await readRosterOcr();
    if (!rosterLines) { if (OV && M && M.side) M.side.querySelectorAll('.dp-sf button').forEach(function (b) { b.disabled = false; }); return; }
  }
  var info = { name: M.name, elements: elements, bg: M.bg, items: items, rosterLines: rosterLines, kind: M.kind };
  var nRows = rosterLines ? M.rosterN : 0, gh = M.garbleHit || 0;
  closeOverlay();
  H.apply(info);
  H.toast('『' + info.name + '』を取り込みました。' + (nRows ? nRows + '名分の名簿も入れました。' : '次は名簿を入れます。') + (gh ? '（PDFの文字化けがあった' + gh + 'か所は画像から読み取りました。内容を確認してください）' : ''));
}

/* ---------- ステップ①のカード・ファイル選択 ---------- */
function pickFile(accept) {
  var inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept || '.pptx,.pdf,.png,.jpg,.jpeg,.gif,.webp,application/pdf,image/*,application/vnd.openxmlformats-officedocument.presentationml.presentation';
  inp.multiple = !accept; inp.style.display = 'none'; document.body.appendChild(inp);
  inp.onchange = function () { var fs = Array.prototype.slice.call(inp.files || []); inp.remove(); if (fs.length) { if (OV && M) { closeOverlay(); } handleFile(fs); } };
  inp.click();
}
function makeCard() {
  ensureCss();
  var s = el('section', 'gsec dimp-card'), h = el('h3', null, '自分のデザインを使う'); h.appendChild(el('span', 'gl')); s.appendChild(h);
  var b = el('button', 'dimp-big'); b.type = 'button'; b.id = 'dimpcard';
  b.innerHTML = '<span class="di-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg></span><span><b>自分のデザインを取り込む</b><span class="t">PowerPointやPDF、画像で作った受験票を取り込めます。名前や番号を入れる場所をクリックして指定すれば、名簿を貼り付けるだけで全員分が一括でできます。</span><span class="ex"><span class="chip">PowerPoint（.pptx）</span><span class="chip">PDF</span><span class="chip">画像（PNG・JPEG）</span><span class="chip">ここにドロップ</span></span></span>';
  b.onclick = function () { pickFile(); };
  ['dragenter', 'dragover'].forEach(function (t) { b.addEventListener(t, function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); b.classList.add('over'); } }); });
  b.addEventListener('dragleave', function () { b.classList.remove('over'); });
  b.addEventListener('drop', function (e) { e.preventDefault(); b.classList.remove('over'); if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(Array.prototype.slice.call(e.dataTransfer.files)); });
  s.appendChild(b); return s;
}

g.DesignImport = {
  init: function (h) { H = h; },
  card: makeCard, pick: pickFile, handle: handleFile, close: closeOverlay,
  suggest: function () { return M ? M.sugg : null; },
  _state: function () { return M; }
};
})(window);
