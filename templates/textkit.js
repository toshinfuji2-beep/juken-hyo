/* 文字の取り扱い共通部品（window.JukenText）。api.js より先に読み込む。
   - 髙・﨑・𠮷（サロゲートペア）・異体字セレクタ（IVS：葛\uE0100 など）を壊さない：文字数・切り詰め・先頭N字は「書記素」単位
   - 文字コードの判定（UTF-8 / UTF-16 / Shift_JIS）と、取り込んだ文字列の掃除（ゼロ幅文字・改行）
   - 名前の種類判定（かな／漢字）、文字化けらしさの判定
   氏名は NFKC などの正規化をしない（﨑 → 崎 のように別の字になるため）。正規化するのは数字と空白だけ。 */
(function (g) {
'use strict';

/* ---------- 書記素（見た目の1文字）単位の処理 ---------- */
var segmenter = null;
try { if (typeof Intl !== 'undefined' && Intl.Segmenter) segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' }); } catch (e) { segmenter = null; }
var VS = /^[\uFE00-\uFE0F\u{E0100}-\u{E01EF}\u3099\u309A\u200D]$/u;
/* 文字列 → 書記素の配列。Intl.Segmenter が無い環境では コードポイント＋後続の異体字セレクタ／結合文字をまとめる */
function seg(s) {
  s = s == null ? '' : String(s);
  if (!s) return [];
  if (segmenter) { var o = []; var it = segmenter.segment(s)[Symbol.iterator](), r; while (!(r = it.next()).done) o.push(r.value.segment); return o; }
  var cps = Array.from(s), out = [];
  cps.forEach(function (c) { if (out.length && VS.test(c)) out[out.length - 1] += c; else out.push(c); });
  return out;
}
function len(s) { return seg(s).length; }
/* 先頭 n 文字 */
function first(s, n) { return seg(s).slice(0, Math.max(0, n)).join(''); }
/* 末尾 n 文字 */
function last(s, n) { var a = seg(s); return a.slice(Math.max(0, a.length - (n == null ? 1 : n))).join(''); }
/* n 文字を超えたら末尾に … を付けて切り詰め（… を含めて n 文字） */
function cut(s, n, ell) {
  var a = seg(s); if (a.length <= n) return a.join('');
  ell = ell == null ? '…' : ell; return a.slice(0, Math.max(0, n - seg(ell).length)).join('') + ell;
}

/* ---------- 文字の種類 ---------- */
var KANJI = /[㐀-䶿一-鿿豈-﫿\u{20000}-\u{3134F}々〆]/u;
var KANA_ONLY = /^[ぁ-ゖ゛-ゟ゠-ヿㇰ-ㇿｦ-ﾟ\u3099\u309A・･ー\uFE00-\uFE0F\u{E0100}-\u{E01EF}\s\u3000]+$/u;
function hasKanji(s) { return KANJI.test(String(s == null ? '' : s)); }
function isKana(s) { s = String(s == null ? '' : s).trim(); return !!s && KANA_ONLY.test(s) && /[ぁ-ヿｦ-ﾟ]/.test(s); }
/* 値の種類：かな／カナだけ → 'カナ氏名'、漢字を含む → '氏名'、どちらでもなければ '' */
function classifyName(s) {
  s = String(s == null ? '' : s).trim();
  if (!s || /[0-9０-９]/.test(s)) return '';
  if (isKana(s)) return 'カナ氏名';
  if (hasKanji(s)) return '氏名';
  return '';
}

/* ---------- 取り込み文字列の掃除 ---------- */
var ZW = /[\u200B\uFEFF\u2060]/g;
function clean(s) { return String(s == null ? '' : s).replace(ZW, '').replace(/\r\n?|\u2028|\u2029/g, '\n'); }
/* 前後の空白（全角空白含む）を除き、ゼロ幅文字を取る */
function trim(s) { return clean(s).replace(/^[\s\u3000]+|[\s\u3000]+$/g, ''); }
/* 数字と空白だけを半角にそろえる（氏名・漢字は触らない） */
function normDigits(s) { return String(s == null ? '' : s).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }); }
function normSpaces(s) { return String(s == null ? '' : s).replace(/\u3000/g, ' '); }

/* ---------- 文字コードの判定と変換 ---------- */
function toU8(buf) { return buf instanceof Uint8Array ? buf : new Uint8Array(buf.buffer ? buf.buffer : buf); }
function dec(label, u8, fatal) { return new TextDecoder(label, { fatal: !!fatal }).decode(u8); }
/* バイト列 → {text, enc}。BOM → 厳密な UTF-8 → UTF-16（NULが多い）→ Shift_JIS（ブラウザの shift_jis は CP932 互換）→ EUC-JP の順 */
function decodeBytes(buf) {
  var u = toU8(buf), n = u.length, text, i;
  if (n >= 3 && u[0] === 0xEF && u[1] === 0xBB && u[2] === 0xBF) return { text: clean(dec('utf-8', u.subarray(3))), enc: 'utf-8-bom' };
  if (n >= 2 && u[0] === 0xFF && u[1] === 0xFE) return { text: clean(dec('utf-16le', u.subarray(2))), enc: 'utf-16le' };
  if (n >= 2 && u[0] === 0xFE && u[1] === 0xFF) return { text: clean(dec('utf-16be', u.subarray(2))), enc: 'utf-16be' };
  try { text = dec('utf-8', u, true); return { text: clean(text), enc: 'utf-8' }; } catch (e) { }
  var pairs = n >> 1, z0 = 0, z1 = 0;
  for (i = 0; i + 1 < n; i += 2) { if (u[i] === 0) z0++; if (u[i + 1] === 0) z1++; }
  if (pairs >= 2) {
    if (z1 >= pairs * 0.1 && z0 <= pairs * 0.02) return { text: clean(dec('utf-16le', u)), enc: 'utf-16le' };
    if (z0 >= pairs * 0.1 && z1 <= pairs * 0.02) return { text: clean(dec('utf-16be', u)), enc: 'utf-16be' };
  }
  text = dec('shift_jis', u);
  if (/�/.test(text)) { try { var t2 = dec('euc-jp', u); if ((t2.match(/�/g) || []).length < (text.match(/�/g) || []).length) return { text: clean(t2), enc: 'euc-jp' }; } catch (e) { } }
  return { text: clean(text), enc: 'shift_jis' };
}

/* ---------- 文字化けらしさ ---------- */
var LATIN_MOJI = /[ÃÂãåçæèéêëìíîï][\u0080-\u00BFŒœŠšŸŽžƒˆ˜–—‘-„†-•…‰‹›€™]/g;
/* 日本語の受験票に出てこない文字種（インド系・アラビア・タイ・チベット・ハングル・エチオピア・ギリシャ・キリル・IPA・制御図形など）。
   ToUnicode が無いPDFなどでは、グリフ番号がこうした文字として読み出される。①②（U+2460〜）や ā ō、記号 ○×△ は含めない */
var FOREIGN = /[\u{250}-\u{2FF}\u{370}-\u{10FF}\u{1100}-\u{11FF}\u{1200}-\u{1DFF}\u{1E00}-\u{1FFF}\u{2400}-\u{243F}\u{2C00}-\u{2DFF}\u{A000}-\u{ABFF}\u{AC00}-\u{D7FF}\u{FB1D}-\u{FDFF}\u{FE70}-\u{FEFE}]/u;
/* 0〜1。私用領域・置換文字・制御文字・部首／互換漢字の羅列・日本語に出ない文字種・UTF-8をLatin-1で読んだ形（ã‚ など）の割合 */
function garbageRatio(s) {
  s = String(s == null ? '' : s).replace(/\s+/g, '');
  var cps = Array.from(s), tot = cps.length; if (!tot) return 0;
  var bad = 0, compat = 0;
  cps.forEach(function (c) {
    var u = c.codePointAt(0);
    if ((u >= 0xE000 && u <= 0xF8FF) || u === 0xFFFD || u < 0x20 || (u >= 0x7F && u <= 0x9F) || (u >= 0x2E80 && u <= 0x2FDF) || (u >= 0x31C0 && u <= 0x31EF) || (u >= 0xF0000) || FOREIGN.test(c)) bad++;
    else if (u >= 0xF900 && u <= 0xFAFF) compat++;
  });
  if (compat >= 3 && compat >= tot * 0.4) bad += compat;
  var lm = s.match(LATIN_MOJI); if (lm && lm.length >= 2) bad += lm.length * 2;
  return Math.min(1, bad / tot);
}
function isGarbage(s, th) { return garbageRatio(s) >= (th == null ? 0.25 : th); }

g.JukenText = { seg: seg, len: len, first: first, last: last, cut: cut, hasKanji: hasKanji, isKana: isKana, classifyName: classifyName, clean: clean, trim: trim, normDigits: normDigits, normSpaces: normSpaces, decodeBytes: decodeBytes, garbageRatio: garbageRatio, isGarbage: isGarbage };
})(typeof window !== 'undefined' ? window : globalThis);
