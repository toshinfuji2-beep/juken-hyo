/* 文字化け 0 のための検査（window.JukenCheck）。textkit.js・fonts.js の後に読み込む。
   1. 入力チェック：貼り付け・読み込んだ文字列の文字化けらしさ（UTF-8をShift_JISで読んだ形など）・置換文字・半角カナ等を検出し、直せるものは直す
   2. 文字カバー確認：選んだ書体に、全員の全文字の字形があるか（canvas＋「字形の無い文字は幅1.37emになる」検査用フォントで判定）
   3. 代替書体の確認：選んだ書体が読み込めずブラウザ既定の書体になっていないか
   4. 印刷・PDFの前の確認ダイアログ（verify → gate → check） */
(function (g) {
'use strict';
var JT = function () { return g.JukenText; };
function seg(s) { return JT() ? JT().seg(s) : Array.from(String(s || '')); }
function $el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }

/* ================= 1. 入力チェック ================= */
var SJIS_SIG = /[縺繧繝竊蜿譁蜷莠荳螟迚驕驟縲逕蟆蛟髢譌蛻譛]/g;
var LATIN_SIG = /[ÃÂãåçæèéêï][\u0080-¿‘-›€ŒœŠšŸŽžƒˆ˜]/g;
var HALFKANA = /[ｦ-ﾟ]/;
var CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;
var PUA = /[-]|[\u{F0000}-\u{10FFFD}]/u;
/* 文字列の問題点 → [{kind, level:'error'|'warn', msg}] */
function scanText(s, nofix) {
  s = String(s == null ? '' : s); var out = [], m;
  if (!s) return out;
  m = s.match(SJIS_SIG); if (m && m.length >= 2) out.push({ kind: 'sjis-misread', level: 'error', msg: 'UTF-8の文字をShift_JISとして読んだ形（縺・繧 など）が含まれます' });
  m = s.match(LATIN_SIG); if (m && m.length >= 2) out.push({ kind: 'latin-misread', level: 'error', msg: '文字コードの取り違え（Ã・â€ など）らしい文字が含まれます' });
  if (!out.length && /[-ÿŒ-Ÿˆ˜–-›€™]{2}/.test(s) && !/[ぁ-ヿ一-鿿]/.test(s) && !nofix && fixText(s)) out.push({ kind: 'latin-misread', level: 'error', msg: 'Shift_JISの文字を欧文として読んだ形（Ž・“ など）になっています' });
  if (/�/.test(s)) out.push({ kind: 'fffd', level: 'error', msg: '読み取れなかった文字（�）が含まれます' });
  if (/[぀-ヿ一-鿿]\?[぀-ヿ一-鿿]|\?{2,}|^\?+$/.test(s)) out.push({ kind: 'qmark', level: 'error', msg: '漢字・かなが「?」に置き換わっているようです' });
  if (CTRL.test(s)) out.push({ kind: 'ctrl', level: 'error', msg: '制御文字が含まれます' });
  if (PUA.test(s)) out.push({ kind: 'pua', level: 'warn', msg: '外字（私用領域の文字）が含まれます。他のパソコンでは表示できません' });
  if (HALFKANA.test(s)) out.push({ kind: 'halfkana', level: 'warn', msg: '半角カナが含まれます' });
  if (!out.length && JT() && s.length >= 3 && JT().garbageRatio(s) >= 0.4) out.push({ kind: 'garbage', level: 'error', msg: '日本語として読めない文字が多く含まれます' });
  return out;
}
function worst(arr) { return arr.some(function (i) { return i.level === 'error'; }) ? 'error' : arr.length ? 'warn' : ''; }
/* 複数の値をまとめて検査 → {errors:[{i,v,issues}], warns:[...]} （i は 0 始まりの行） */
function scanList(vals) {
  var r = { errors: [], warns: [] };
  (vals || []).forEach(function (v, i) { var is = scanText(v); if (!is.length) return; var w = worst(is); (w === 'error' ? r.errors : r.warns).push({ i: i, v: v, issues: is }); });
  return r;
}

/* 半角カナ → 全角カナ（ｶﾞ → ガ） */
function toFullKana(s) { return String(s == null ? '' : s).replace(/[ｦ-ﾟ]+/g, function (m) { return m.normalize('NFKC'); }); }

/* ---- 文字化けの逆変換（Shift_JIS として読まれてしまった UTF-8 などを元に戻す） ---- */
var sjRev = null, cpRev = null;
function sjisRev() {
  if (sjRev) return sjRev; sjRev = {};
  var d = new TextDecoder('shift_jis'), i, j, c;
  for (i = 0x20; i < 0x7F; i++) sjRev[String.fromCharCode(i)] = [i];
  for (i = 0xA1; i <= 0xDF; i++) { c = d.decode(new Uint8Array([i])); if (c && c !== '�') sjRev[c] = [i]; }
  for (i = 0x81; i <= 0xFC; i++) { if (i > 0x9F && i < 0xE0) continue; for (j = 0x40; j <= 0xFC; j++) { if (j === 0x7F) continue; c = d.decode(new Uint8Array([i, j])); if (c.length === 1 && c !== '�' && !sjRev[c]) sjRev[c] = [i, j]; } }
  return sjRev;
}
function cp1252Rev() {
  if (cpRev) return cpRev; cpRev = {}; var d = new TextDecoder('windows-1252');
  for (var i = 0; i < 256; i++) { var c = d.decode(new Uint8Array([i])); if (!(c in cpRev)) cpRev[c] = [i]; }
  return cpRev;
}
function revBytes(s, tbl) { var b = [], cs = Array.from(s); for (var i = 0; i < cs.length; i++) { var t = tbl[cs[i]]; if (!t) return null; for (var k = 0; k < t.length; k++) b.push(t[k]); } return new Uint8Array(b); }
/* 直せたら直した文字列、直せなければ null */
function fixText(s) {
  s = String(s == null ? '' : s); if (!s) return null;
  var cands = [], u;
  try { u = revBytes(s, sjisRev()); if (u) cands.push(new TextDecoder('utf-8', { fatal: true }).decode(u)); } catch (e) { }
  try { u = revBytes(s, cp1252Rev()); if (u) { try { cands.push(new TextDecoder('utf-8', { fatal: true }).decode(u)); } catch (e) { } try { cands.push(new TextDecoder('shift_jis').decode(u)); } catch (e) { } } } catch (e) { }
  var base = JT() ? JT().garbageRatio(s) : 0, best = null, bs = 1e9, mis = scanText(s, true).some(function (i) { return i.kind.indexOf('misread') > 0; });
  cands.forEach(function (c) {
    if (!c || c === s || /�/.test(c) || !/[ぁ-ヿ一-鿿]/.test(c)) return;
    var sc = JT() ? JT().garbageRatio(c) : 0; if (scanText(c, true).some(function (i) { return i.level === 'error'; })) return;
    if (sc < bs && (sc < base || mis)) { bs = sc; best = c; }
  });
  return best;
}

/* バイト列を各文字コードで読んだ候補（読みやすさの良い順） */
var ENCS = [['utf-8', 'UTF-8'], ['shift_jis', 'Shift_JIS（Windows日本語）'], ['euc-jp', 'EUC-JP'], ['utf-16le', 'UTF-16（LE）'], ['utf-16be', 'UTF-16（BE）']];
function redecode(buf) {
  var u = buf instanceof Uint8Array ? buf : new Uint8Array(buf), out = [];
  ENCS.forEach(function (e) {
    var t; try { t = new TextDecoder(e[0]).decode(u); } catch (er) { return; }
    t = t.replace(/^﻿/, '');
    var bad = (t.match(/�/g) || []).length, sig = (t.match(SJIS_SIG) || []).length + (t.match(LATIN_SIG) || []).length;
    var gr = JT() ? JT().garbageRatio(t.slice(0, 4000)) : 0, nul = (t.match(/\u0000/g) || []).length;
    var kana = (t.match(/[ぁ-んァ-ヶ一-鿿]/g) || []).length;
    out.push({ enc: e[0], label: e[1], text: t, score: bad * 10 + sig * 5 + gr * 100 + nul * 10 - Math.min(kana, 200) * 0.01 });
  });
  return out.sort(function (a, b) { return a.score - b.score; });
}

/* ================= 2. 字形の有無（検査用フォント） ================= */
/* どの文字にも「幅 1.37em の空白」の字形を持つだけのフォントを作る。書体リストの後ろにこれを置くと、
   先頭の書体に字形が無い文字だけが幅1.37emになる＝字形の有無が確実に分かる（OS・ブラウザ既定の代替に左右されない） */
/* 最小のTrueType（字形は空、全コードポイントが幅1.37emの1字形に対応：cmap format 13） */
function buildProbe() {
  function u16(a,v){a.push((v>>8)&255,v&255)} function u32(a,v){a.push((v>>>24)&255,(v>>>16)&255,(v>>>8)&255,v&255)}
  function i16(a,v){u16(a,v&0xFFFF)}
  var ADV=1370;
  var head=[];u32(head,0x00010000);u32(head,0x00010000);u32(head,0);u32(head,0x5F0F3CF5);u16(head,0x000B);u16(head,1000);u32(head,0);u32(head,0);u32(head,0);u32(head,0);i16(head,0);i16(head,0);i16(head,0);i16(head,0);u16(head,0);u16(head,8);i16(head,2);i16(head,0);i16(head,0);
  var hhea=[];u32(hhea,0x00010000);i16(hhea,800);i16(hhea,-200);i16(hhea,0);u16(hhea,ADV);i16(hhea,0);i16(hhea,0);i16(hhea,0);i16(hhea,1);i16(hhea,0);i16(hhea,0);for(var i=0;i<4;i++)i16(hhea,0);i16(hhea,0);u16(hhea,2);
  var maxp=[];u32(maxp,0x00010000);u16(maxp,2);u16(maxp,0);u16(maxp,0);u16(maxp,0);u16(maxp,0);u16(maxp,2);u16(maxp,0);u16(maxp,0);u16(maxp,0);u16(maxp,0);u16(maxp,0);u16(maxp,0);u16(maxp,0);u16(maxp,0);
  var hmtx=[];u16(hmtx,ADV);i16(hmtx,0);u16(hmtx,ADV);i16(hmtx,0);
  var glyf=[];i16(glyf,0);i16(glyf,0);i16(glyf,0);i16(glyf,0);i16(glyf,0);i16(glyf,0);
  var loca=[];u16(loca,0);u16(loca,6);u16(loca,6);
  var os=[];u16(os,3);i16(os,ADV);u16(os,400);u16(os,5);u16(os,0);for(i=0;i<10;i++)i16(os,0);i16(os,0);for(i=0;i<10;i++)os.push(0);for(i=0;i<4;i++)u32(os,0);os.push(0x4A,0x4B,0x50,0x42);u16(os,0x40);u16(os,0x20);u16(os,0xFFFF);i16(os,800);i16(os,-200);i16(os,0);u16(os,800);u16(os,200);u32(os,1);u32(os,0);i16(os,0);i16(os,0);u16(os,0);u16(os,32);u16(os,1);
  var nm=['JukenProbe','Regular','JukenProbe','JukenProbe'],ids=[1,2,4,6],strs=[],offs=[];
  var sdata=[];nm.forEach(function(s,k){offs.push(sdata.length);for(var j=0;j<s.length;j++){u16(sdata,s.charCodeAt(j))}});
  var name=[];u16(name,0);u16(name,4);u16(name,6+12*4);ids.forEach(function(id,k){u16(name,3);u16(name,1);u16(name,0x409);u16(name,id);u16(name,nm[k].length*2);u16(name,offs[k])});name=name.concat(sdata);
  var post=[];u32(post,0x00030000);u32(post,0);i16(post,-100);i16(post,50);u32(post,0);u32(post,0);u32(post,0);u32(post,0);u32(post,0);
  /* cmap: f4 (3,1) 0x20-0x7FEF, f13 (3,10), f13 (0,4) */
  var f4=[];var lo=0x20,hi=0x7FEF,n=hi-lo+1;
  u16(f4,4);u16(f4,0);u16(f4,0);u16(f4,4);u16(f4,4);u16(f4,1);u16(f4,0);
  u16(f4,hi);u16(f4,0xFFFF);u16(f4,0);u16(f4,lo);u16(f4,0xFFFF);u16(f4,0);u16(f4,1);u16(f4,4);u16(f4,0);
  for(i=0;i<n;i++)u16(f4,1);
  f4[2]=(f4.length>>8)&255;f4[3]=f4.length&255;
  var f13=[];u16(f13,13);u16(f13,0);u32(f13,16+12*3);u32(f13,0);u32(f13,3);
  [[0x20,0xFFFF],[0x10000,0x1FFFF],[0x20000,0x10FFFF]].forEach(function(g){u32(f13,g[0]);u32(f13,g[1]);u32(f13,1)});
  var base=4+8*3,cm;
  /* 配置：ヘッダ → f13 → f4 */
  cm=[];u16(cm,0);u16(cm,3);
  u16(cm,0);u16(cm,4);u32(cm,base);u16(cm,3);u16(cm,1);u32(cm,base+f13.length);u16(cm,3);u16(cm,10);u32(cm,base);
  cm=cm.concat(f13).concat(f4);
  var T={'OS/2':os,cmap:cm,glyf:glyf,head:head,hhea:hhea,hmtx:hmtx,loca:loca,maxp:maxp,name:name,post:post};
  var tags=Object.keys(T).sort(),nT=tags.length,out=[];
  u32(out,0x00010000);u16(out,nT);var sr=1,es=0;while(sr*2<=nT){sr*=2;es++}u16(out,sr*16);u16(out,es);u16(out,nT*16-sr*16);
  var off=12+16*nT,body=[];
  tags.forEach(function(t){var d=T[t];while(d.length%4)d.push(0);for(var j=0;j<4;j++)out.push(t.charCodeAt(j)||32);u32(out,0);u32(out,off+body.length);u32(out,d.length);body=body.concat(d)});
  return new Uint8Array(out.concat(body));
}

var probeP = null, probeOK = false, PADV = 1.37;
function ensureProbe() {
  if (probeP) return probeP;
  probeP = (function () {
    try {
      var ff = new FontFace('JukenProbe', buildProbe().buffer);
      return ff.load().then(function () { document.fonts.add(ff); probeOK = selfTest(); return probeOK; }).catch(function () { probeOK = false; return false; });
    } catch (e) { probeOK = false; return Promise.resolve(false); }
  })();
  return probeP;
}
var cv = null;
function ctx() { if (!cv) cv = document.createElement('canvas').getContext('2d'); return cv; }
function mw(font, text) { var x = ctx(); x.font = font; return x.measureText(text).width; }
function selfTest() { var w = mw('100px "JukenProbe"', 'あ'); var w2 = mw('100px "JukenProbe"', '\u{20BB7}'); return Math.abs(w - 137) < 1 && Math.abs(w2 - 137) < 1; }
var memo = {}, memoN = 0;
/* 書体 fam（引用符なしの family 名）に字形 ch があるか。weight/style も反映。fam が全く使えないときも false */
function hasGlyph(fam, ch, weight, style) {
  var key = fam + '|' + (weight || 400) + '|' + (style || '') + '|' + ch; if (key in memo) return memo[key];
  var f = (style === 'italic' ? 'italic ' : '') + (weight || 400) + ' 100px ', r;
  if (probeOK) { r = Math.abs(mw(f + '"' + fam + '","JukenProbe"', ch) - 100 * PADV) > 1; }
  else { /* 検査用フォントが使えないブラウザ：別系統の代替との比較 */
    var a = mw(f + '"' + fam + '",serif', ch), b = mw(f + '"' + fam + '",monospace', ch), c = mw(f + '"' + fam + '",sans-serif', ch); r = Math.abs(a - b) < 0.5 && Math.abs(a - c) < 0.5;
  }
  if (++memoN > 200000) { memo = {}; memoN = 0; }
  return (memo[key] = r);
}
/* 読み込み状況が変わったら結果の記憶を捨てる */
function resetMemo() { memo = {}; memoN = 0; }
/* 書体そのものが使えているか（読み込み済み／インストール済みか） */
function famAvailable(fam, weight, style) {
  return ['A', 'あ', '漢', '0', 'M'].some(function (c) { return hasGlyph(fam, c, weight, style); });
}

/* ================= 3. 検査本体 ================= */
var GENERIC = /^(sans-serif|serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|emoji|math)$/i;
function famList(css) { return String(css || '').split(',').map(function (x) { return x.trim().replace(/^["']|["']$/g, ''); }).filter(Boolean); }
function primaryOf(css) { var l = famList(css); for (var i = 0; i < l.length; i++) if (!GENERIC.test(l[i])) return l[i]; return ''; }
function ownText(el) { var s = ''; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) s += c.nodeValue; return s; }
function isVS(ch) { return /^[︀-️\u{E0100}-\u{E01EF}‍゙゚​﻿⁠]$/u.test(ch); }
/* 検査する文字（書記素の先頭コードポイント）。空白・制御は除く */
function chars(text) {
  var out = [];
  seg(text).forEach(function (gc) { var cp = Array.from(gc)[0]; if (!cp || /^[\s　 ]$/.test(cp) || CTRL.test(cp) || isVS(cp)) return; out.push(cp); });
  return out;
}
/* 代替書体の候補（Webフォント → パソコンの書体）。serif なら明朝系を先に */
function fbCands(serif) {
  var web = serif ? [['noto-serif-jp', 'Noto Serif JP'], ['biz-udpmincho', 'BIZ UDP明朝'], ['noto-sans-jp', 'Noto Sans JP'], ['biz-udpgothic', 'BIZ UDPゴシック']] : [['noto-sans-jp', 'Noto Sans JP'], ['biz-udpgothic', 'BIZ UDPゴシック'], ['noto-serif-jp', 'Noto Serif JP'], ['biz-udpmincho', 'BIZ UDP明朝']];
  var sys = serif ? ['Yu Mincho', 'MS Mincho', 'Hiragino Mincho ProN', 'Yu Gothic', 'MS Gothic', 'Meiryo', 'Hiragino Sans', 'SimSun'] : ['Yu Gothic', 'Meiryo', 'MS Gothic', 'Hiragino Sans', 'Yu Mincho', 'MS Mincho', 'SimSun'];
  var l = web.map(function (w) { var f = g.JukenFonts && g.JukenFonts.resolve ? g.JukenFonts.resolve(w[0]) : null; return { id: w[0], label: w[1], fam: f ? f.family : w[1] }; });
  sys.forEach(function (s) { l.push({ id: '', label: s, fam: s, sys: true }); });
  return l;
}
function loadFor(fam, weight, style, text) {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  var t = Array.from(new Set(Array.from(text))).join('');
  return document.fonts.load((style === 'italic' ? 'italic ' : '') + weight + ' 16px "' + fam + '"', t).catch(function () { });
}
function withTimeout(p, ms) { return Promise.race([p, new Promise(function (r) { setTimeout(r, ms); })]); }

/* roots の中の全テキストを検査する。opts.label(i) … i番目のroot の呼び名（例「3番 山田」）。
   戻り値 {ok, count, fonts:[family], missing:[{ch, cp, fams:[family], who:[label], fb:{label,fam,id}|null}], notLoaded:[family], ms} */
function verify(roots, opts) {
  opts = opts || {}; var t0 = Date.now();
  roots = (Array.isArray(roots) ? roots : [roots]).filter(Boolean);
  return ensureProbe().then(function () {
    resetMemo();
    var groups = {};
    roots.forEach(function (root, ri) {
      var els = Array.prototype.slice.call(root.querySelectorAll('*')); if (root.nodeType === 1) els.unshift(root);
      els.forEach(function (e) {
        var t = ownText(e); if (!/\S/.test(t)) return;
        var cs = getComputedStyle(e); if (cs.display === 'none') return;
        var fam = primaryOf(cs.fontFamily); if (!fam) fam = '(指定なし)';
        var key = fam + '|' + cs.fontWeight + '|' + cs.fontStyle;
        var G = groups[key] || (groups[key] = { fam: fam, w: parseInt(cs.fontWeight, 10) || 400, st: cs.fontStyle, css: cs.fontFamily, set: {}, who: {} });
        chars(t).forEach(function (c) { G.set[c] = 1; (G.who[c] || (G.who[c] = {}))[ri] = 1; });
      });
    });
    var keys = Object.keys(groups), links = g.JukenFonts && g.JukenFonts.linksReady ? withTimeout(g.JukenFonts.linksReady(), 12000) : Promise.resolve();
    return links.then(function () { return Promise.all(keys.map(function (k) { var G = groups[k]; return loadFor(G.fam, G.w, G.st, Object.keys(G.set).join('')); })); }).then(function (x) { return withTimeout(Promise.resolve(x), opts.timeout || 8000); }).then(function () { return document.fonts && document.fonts.ready ? withTimeout(document.fonts.ready, 3000) : 0; }).then(function () {
      resetMemo();
      var res = { ok: true, count: roots.length, fonts: [], missing: [], notLoaded: [], subst: [], probe: probeOK }, miss = {};
      keys.forEach(function (k) {
        var G = groups[k]; if (res.fonts.indexOf(G.fam) < 0) res.fonts.push(G.fam);
        if (G.fam === '(指定なし)') return;
        var eff = G.fam;
        if (!famAvailable(G.fam, G.w, G.st)) {
          /* パソコンの書体が無いPCでは、書体リストに決めてある代替（Webフォント）で表示される。それは想定どおりなので注意書きだけ */
          var rg = g.JukenFonts && g.JukenFonts.fromCss ? g.JukenFonts.fromCss(G.css) : null, alt = '';
          if (rg && (rg.kind === 'sys' || rg.kind === 'local')) { var fl = famList(G.css); for (var q = 1; q < fl.length; q++) { if (!GENERIC.test(fl[q]) && famAvailable(fl[q], G.w, G.st)) { alt = fl[q]; break; } } }
          if (alt) { eff = alt; res.subst.push({ from: G.fam, to: alt }); }
          else { if (res.notLoaded.indexOf(G.fam) < 0) res.notLoaded.push(G.fam); return; }
        }
        Object.keys(G.set).forEach(function (c) {
          if (hasGlyph(eff, c, G.w, G.st)) return;
          var m = miss[c] || (miss[c] = { ch: c, cp: 'U+' + c.codePointAt(0).toString(16).toUpperCase(), fams: [], who: {}, serif: false });
          if (m.fams.indexOf(G.fam) < 0) m.fams.push(G.fam);
          Object.keys(G.who[c]).forEach(function (ri) { m.who[ri] = 1; });
          var r = g.JukenFonts && g.JukenFonts.fromCss ? g.JukenFonts.fromCss(G.css) : null; if (r && /serif/.test(r.tail || '')) m.serif = true;
        });
      });
      /* 代替書体の決定（字形のある最初の候補） */
      var mk = Object.keys(miss), pend = [];
      mk.forEach(function (c) {
        var m = miss[c], cands = fbCands(m.serif);
        cands.forEach(function (cd) { if (cd.id && g.JukenFonts) g.JukenFonts.use(cd.id); });
        pend.push((g.JukenFonts && g.JukenFonts.linksReady ? g.JukenFonts.linksReady() : Promise.resolve()).then(function () { return Promise.all(cands.map(function (cd) { return loadFor(cd.fam, 400, '', c); })); }).then(function () {
          resetMemo(); m.fb = null; for (var i = 0; i < cands.length; i++) { if (hasGlyph(cands[i].fam, c, 400, '')) { m.fb = cands[i]; break; } }
        }));
      });
      return withTimeout(Promise.all(pend), 6000).then(function () {
        mk.forEach(function (c) {
          var m = miss[c]; if (m.fb === undefined) m.fb = null;
          m.who = Object.keys(m.who).map(function (ri) { return opts.label ? opts.label(+ri) : String(+ri + 1) + '番目'; });
          res.missing.push(m);
        });
        res.missing.sort(function (a, b) { return a.ch.codePointAt(0) - b.ch.codePointAt(0); });
        res.ok = !res.missing.length && !res.notLoaded.length;
        res.ms = Date.now() - t0; return res;
      });
    });
  });
}

/* 字形の無い文字だけ代替書体の span で包む（plan: {文字: font-family CSS}）。root 内の文字だけ書き換える */
var plan = {};
function setPlan(missing) { plan = {}; (missing || []).forEach(function (m) { if (m.fb) plan[m.ch] = '"' + m.fb.fam + '",' + (m.serif ? 'serif' : 'sans-serif'); }); }
function planned() { return Object.keys(plan).length > 0; }
function apply(root) {
  if (!planned() || !root) return 0; var n = 0;
  var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), nodes = [], t;
  while ((t = w.nextNode())) nodes.push(t);
  nodes.forEach(function (tn) {
    var pe = tn.parentNode; if (!tn.nodeValue || (pe && pe.getAttribute && pe.getAttribute('data-jfb'))) return;
    var gs = seg(tn.nodeValue), hit = gs.some(function (x) { return plan[Array.from(x)[0]]; }); if (!hit) return;
    var frag = document.createDocumentFragment(), buf = '';
    gs.forEach(function (x) {
      var p = plan[Array.from(x)[0]];
      if (p) { if (buf) { frag.appendChild(document.createTextNode(buf)); buf = ''; } var s = $el('span', null, x); s.setAttribute('data-jfb', '1'); s.style.fontFamily = p; frag.appendChild(s); n++; }
      else buf += x;
    });
    if (buf) frag.appendChild(document.createTextNode(buf));
    pe.replaceChild(frag, tn);
  });
  return n;
}
function clearPlan() { plan = {}; }

/* ================= 4. ダイアログ ================= */
function dlg(build) {
  return new Promise(function (res) {
    var w = $el('div'); w.id = 'mdl'; w.setAttribute('data-jc', '1'); var c = $el('div', 'mc xwide'); c.setAttribute('role', 'dialog'); c.setAttribute('aria-modal', 'true'); c.style.maxHeight = '88vh'; c.style.overflow = 'auto'; w.appendChild(c);
    function done(v) { w.remove(); res(v); }
    build(c, done); document.body.appendChild(w);
    w.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); done(null); } });
    var f = c.querySelector('button.pri') || c.querySelector('button'); if (f) f.focus();
  });
}
function mkBtn(t, cls, fn) { var b = $el('button', cls || null, t); b.type = 'button'; b.onclick = fn; return b; }
function warnBox(t, err) { var d = $el('div', 'wn', t); if (err) { d.style.background = '#fee2e2'; d.style.color = '#991b1b'; } return d; }

/* 文字コードの選択ダイアログ：候補ごとに読み取り結果の見本を並べ、読めるものを選ぶ → Promise<{enc,text}|null> */
function encodingDialog(buf, o) {
  o = o || {}; var cands = redecode(buf).slice(0, 5);
  return dlg(function (c, done) {
    c.appendChild($el('h3', null, '文字化けしています。読める文字コードを選んでください'));
    c.appendChild($el('p', null, (o.name ? '「' + o.name + '」は' : '') + 'このままでは名前が正しく読めません。下の見本で、日本語が正しく読めるものを選んでください。'));
    cands.forEach(function (cd, i) {
      var b = $el('button'); b.type = 'button'; b.setAttribute('data-enc', cd.enc); b.style.cssText = 'display:block;width:100%;text-align:left;margin:6px 0;padding:8px 10px;white-space:normal';
      b.appendChild($el('b', null, cd.label + (i === 0 ? '（おすすめ）' : '')));
      var pv = $el('div', null, cd.text.split(/\r?\n/).filter(function (x) { return x.trim(); }).slice(0, 4).join('\n').replace(/\u0000/g, '').slice(0, 220));
      pv.style.cssText = 'white-space:pre-wrap;font-size:12px;margin-top:4px;font-weight:400;overflow-wrap:anywhere;font-family:"Noto Sans JP","Yu Gothic","Meiryo",sans-serif'; b.appendChild(pv);
      b.onclick = function () { done({ enc: cd.enc, text: JT() ? JT().clean(cd.text) : cd.text }); };
      if (i === 0) b.className = 'pri'; c.appendChild(b);
    });
    var bb = $el('div', 'mb'); bb.appendChild(mkBtn('読み込まない', null, function () { done(null); })); c.appendChild(bb);
  });
}

/* 印刷・PDFの前の確認。res は verify の戻り値。→ Promise<'go'|'patch'|'retry'|'cancel'> */
function gate(res, o) {
  o = o || {};
  return dlg(function (c, done) {
    c.setAttribute('data-gate', res.ok ? 'ok' : 'ng');
    var cantFix = res.missing.some(function (m) { return !m.fb; });
    c.appendChild($el('h3', null, res.ok ? '文字チェックOK' : '文字を確認してください'));
    if (res.ok) {
      c.appendChild($el('p', null, res.count + '名・文字チェックOK（使用フォント：' + (res.fonts.join('、') || '—') + '）'));
      c.appendChild($el('p', null, '全員の全文字が、選んだ書体で表示されることを確認しました。'));
      res.subst.forEach(function (x) { c.appendChild(warnBox(x.from + ' はこのパソコンにないため、代わりに ' + x.to + ' で表示・出力します。')); });
      var bb = $el('div', 'mb'); bb.appendChild(mkBtn('やめる', null, function () { done('cancel'); })); bb.appendChild(mkBtn(o.ok || 'OK', 'pri', function () { done('go'); })); c.appendChild(bb); return;
    }
    res.subst.forEach(function (x) { c.appendChild(warnBox(x.from + ' はこのパソコンにないため、代わりに ' + x.to + ' で表示・出力します。')); });
    if (res.notLoaded.length) c.appendChild(warnBox('選んだフォントが読み込めていません：' + res.notLoaded.join('、') + '。このままだと別の書体（明朝など）で出力されます。通信状況を確認して「もう一度確認」を押すか、別のフォントを選んでください。', true));
    if (res.missing.length) {
      c.appendChild($el('p', null, '次の文字は、選んだ書体に字形がありません。'));
      var ul = $el('div'); ul.style.cssText = 'max-height:34vh;overflow:auto;border:1px solid var(--bd);border-radius:6px;padding:4px 8px';
      res.missing.forEach(function (m) {
        var r = $el('div'); r.style.cssText = 'display:flex;gap:8px;align-items:baseline;padding:3px 0;font-size:13px;border-bottom:1px solid var(--bd)';
        var ch = $el('span', null, m.ch); ch.style.cssText = 'font-size:20px;min-width:1.6em;text-align:center;font-family:' + (m.fb ? '"' + m.fb.fam + '",' : '') + '"Noto Sans JP","Yu Gothic","Meiryo",sans-serif'; r.appendChild(ch);
        var tx = $el('div'); tx.style.cssText = 'min-width:0;overflow-wrap:anywhere';
        tx.appendChild(document.createTextNode(m.cp + '（' + m.who.slice(0, 4).join('・') + (m.who.length > 4 ? ' ほか' + (m.who.length - 4) + '名' : '') + '）は ' + m.fams.join('・') + ' にありません → '));
        var s = $el('b', null, m.fb ? m.fb.label + ' で補います' : '補える書体がありません（□になります）'); if (!m.fb) s.style.color = '#b91c1c'; tx.appendChild(s);
        r.appendChild(tx); ul.appendChild(r);
      });
      c.appendChild(ul);
    }
    var bb2 = $el('div', 'mb');
    bb2.appendChild(mkBtn('中止（フォントを選び直す）', null, function () { done('cancel'); }));
    if (res.notLoaded.length) bb2.appendChild(mkBtn('もう一度確認', 'pri', function () { done('retry'); }));
    else if (res.missing.some(function (m) { return m.fb; })) bb2.appendChild(mkBtn('自動で別フォントで補って' + (o.ok || '続ける'), 'pri', function () { done('patch'); }));
    if (cantFix || res.notLoaded.length) bb2.appendChild(mkBtn('このまま' + (o.ok || '続ける') + '（非推奨）', null, function () { done(res.missing.some(function (m) { return m.fb; }) ? 'patch' : 'go'); }));
    c.appendChild(bb2);
  });
}
/* 検査→確認→必要なら代替の登録までをまとめて行う。→ Promise<boolean>（続けてよいか）。roots は検査対象の ticket の配列 */
function check(roots, o) {
  o = o || {};
  function run() {
    return verify(roots, o).then(function (res) {
      o.last = res;
      if (o.silentOk && res.ok) return true;
      return gate(res, o).then(function (a) {
        if (a === 'retry') { return (g.JukenFonts ? g.JukenFonts.prepare(roots, 8000) : Promise.resolve()).then(run); }
        if (a === 'cancel' || a == null) return false;
        if (a === 'patch') setPlan(res.missing); else clearPlan();
        return true;
      });
    });
  }
  return run();
}

g.JukenCheck = {
  scanText: scanText, scanList: scanList, worst: worst, fixText: fixText, toFullKana: toFullKana, redecode: redecode, encodingDialog: encodingDialog,
  ensureProbe: ensureProbe, hasGlyph: hasGlyph, famAvailable: famAvailable, verify: verify, gate: gate, check: check,
  setPlan: setPlan, clearPlan: clearPlan, planned: planned, apply: apply, chars: chars, dlg: dlg, resetMemo: resetMemo,
  isProbeOK: function () { return probeOK; }
};
})(typeof window !== 'undefined' ? window : globalThis);
