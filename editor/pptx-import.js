/* PowerPoint (.pptx) → フリーデザイン要素への変換。window.PptxImport
   使い方：
     var pkg = await PptxImport.open(arrayBuffer);        // JSZip が読み込み済みであること（window.JSZip）
     var r   = await PptxImport.convertSlide(pkg, 0, {maxPx:1600, skipMedia:false});
       r = { elements:[…free要素…], bg:'#ffffff', stats:{count, skipped:{種類:数}, emf:[…], images, aspectDiff, scale}, name }
     var t   = await PptxImport.slideTexts(pkg, i);       // {要素id:文字}（名簿の読み取り用。画像は読まない）
   要素の id はスライド内の位置（木の添字）から作るため、同じ型から複製したスライド同士では同じ id になる。
   単位：PowerPoint の EMU（1mm=36000）→ A4（210×297mm）へ縦横比を保って拡大縮小し、中央に置く。 */
(function (g) {
'use strict';
var EMU = 36000;           /* 1mm */
var PT = 25.4 / 72;        /* 1pt = mm */
var LH = 1.2;              /* 行間100% の CSS 換算 */

/* ---------- XML の小さな道具（名前空間を無視して localName で辿る） ---------- */
function parseXml(s) {
  var d = new DOMParser().parseFromString(s, 'application/xml');
  if (d.getElementsByTagName('parsererror').length) throw new Error('XMLを読み取れませんでした');
  return d.documentElement;
}
function kids(n, name) {
  var o = [], c = n && n.firstElementChild;
  for (; c; c = c.nextElementSibling) if (!name || c.localName === name) o.push(c);
  return o;
}
function kid(n, name) { var c = n && n.firstElementChild; for (; c; c = c.nextElementSibling) if (c.localName === name) return c; return null; }
function path(n) { for (var i = 1; i < arguments.length && n; i++) n = kid(n, arguments[i]); return n || null; }
function at(n, a, d) { if (!n) return d; var v = n.getAttribute(a); return v == null ? d : v; }
function atn(n, a, d) { var v = n ? n.getAttribute(a) : null; if (v == null || v === '') return d; v = +v; return isFinite(v) ? v : d; }
function dirOf(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
function resolvePath(base, target) {
  if (/^\//.test(target)) return target.slice(1);
  var parts = dirOf(base).split('/').filter(Boolean);
  target.split('/').forEach(function (s) { if (s === '..') parts.pop(); else if (s && s !== '.') parts.push(s); });
  return parts.join('/');
}

/* ---------- 色 ---------- */
var PRST = { black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', gray: '808080', grey: '808080', dkGray: 'A9A9A9', ltGray: 'D3D3D3', darkGray: 'A9A9A9', lightGray: 'D3D3D3', orange: 'FFA500', purple: '800080', cyan: '00FFFF', magenta: 'FF00FF', navy: '000080', darkRed: '8B0000', darkBlue: '00008B', darkGreen: '006400', pink: 'FFC0CB', brown: 'A52A2A' };
function h2rgb(h) { h = String(h).replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0]; }
function rgb2h(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
function rgb2hsl(c) {
  var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
  if (d) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  return [h, s, l];
}
function hsl2rgb(a) {
  var h = a[0], s = a[1], l = a[2];
  function f(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
  if (!s) return [l * 255, l * 255, l * 255];
  var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
}
var SCHEME_ALIAS = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' };
/* 色指定ノード（solidFill など）→ '#rrggbb'（透明度は白との混合で表現）。解決できなければ null */
function color(node, cx) {
  if (!node) return null;
  var c = node.localName && /Clr$/.test(node.localName) ? node : null;
  if (!c) { c = kids(node).filter(function (k) { return /^(srgbClr|schemeClr|prstClr|sysClr|hslClr|scrgbClr)$/.test(k.localName); })[0]; }
  if (!c) return null;
  var rgb, n = c.localName, v = c.getAttribute('val');
  if (n === 'srgbClr') rgb = h2rgb(v);
  else if (n === 'prstClr') rgb = h2rgb(PRST[v] || '000000');
  else if (n === 'sysClr') rgb = h2rgb(c.getAttribute('lastClr') || (v === 'window' ? 'FFFFFF' : '000000'));
  else if (n === 'scrgbClr') rgb = [atn(c, 'r', 0) / 1000, atn(c, 'g', 0) / 1000, atn(c, 'b', 0) / 1000].map(function (x) { return x * 2.55; });
  else if (n === 'hslClr') rgb = hsl2rgb([atn(c, 'hue', 0) / 21600000, atn(c, 'sat', 0) / 100000, atn(c, 'lum', 0) / 100000]);
  else {
    if (v === 'phClr') { if (!cx.phClr) return null; rgb = h2rgb(cx.phClr); }
    else {
      var nm = cx.clrMap && cx.clrMap[v] ? cx.clrMap[v] : (SCHEME_ALIAS[v] || v), hx = cx.theme.colors[nm] || cx.theme.colors[v];
      if (!hx) return null; rgb = h2rgb(hx);
    }
  }
  var alpha = 1;
  kids(c).forEach(function (m) {
    var x = atn(m, 'val', 100000) / 100000, hsl;
    switch (m.localName) {
      case 'lumMod': hsl = rgb2hsl(rgb); hsl[2] = Math.min(1, hsl[2] * x); rgb = hsl2rgb(hsl); break;
      case 'lumOff': hsl = rgb2hsl(rgb); hsl[2] = Math.max(0, Math.min(1, hsl[2] + x)); rgb = hsl2rgb(hsl); break;
      case 'satMod': hsl = rgb2hsl(rgb); hsl[1] = Math.min(1, hsl[1] * x); rgb = hsl2rgb(hsl); break;
      case 'satOff': hsl = rgb2hsl(rgb); hsl[1] = Math.max(0, Math.min(1, hsl[1] + x)); rgb = hsl2rgb(hsl); break;
      case 'tint': rgb = rgb.map(function (ch) { return ch * x + 255 * (1 - x); }); break;
      case 'shade': rgb = rgb.map(function (ch) { return ch * x; }); break;
      case 'alpha': alpha = x; break;
    }
  });
  if (alpha < 1) rgb = rgb.map(function (ch) { return ch * alpha + 255 * (1 - alpha); });
  return rgb2h(rgb);
}

/* ---------- パッケージ ---------- */
async function readText(zip, p) { var f = zip.file(p); if (!f) return null; return f.async('string'); }
async function readXml(pkg, p) {
  if (pkg.cache[p]) return pkg.cache[p];
  var s = await readText(pkg.zip, p); if (s == null) return null;
  return (pkg.cache[p] = parseXml(s.replace(/^﻿/, '')));
}
async function readRels(pkg, p) {
  var rp = dirOf(p) + '/_rels/' + p.slice(p.lastIndexOf('/') + 1) + '.rels', key = 'rels:' + rp;
  if (pkg.cache[key]) return pkg.cache[key];
  var x = await readXml(pkg, rp), m = {};
  if (x) kids(x, 'Relationship').forEach(function (r) { m[r.getAttribute('Id')] = { type: r.getAttribute('Type') || '', target: r.getAttribute('TargetMode') === 'External' ? '' : resolvePath(p, r.getAttribute('Target') || '') }; });
  return (pkg.cache[key] = m);
}
function relOfType(rels, re) { for (var k in rels) if (re.test(rels[k].type)) return rels[k]; return null; }

function parseTheme(x) {
  var th = { colors: {}, minorEa: '', majorEa: '', minorLt: '', majorLt: '' };
  if (!x) return th;
  var cs = path(x, 'themeElements', 'clrScheme');
  if (cs) kids(cs).forEach(function (c) {
    var ch = kids(c)[0]; if (!ch) return;
    th.colors[c.localName] = (ch.localName === 'sysClr' ? at(ch, 'lastClr', '000000') : at(ch, 'val', '000000')).replace('#', '');
  });
  var fs = path(x, 'themeElements', 'fontScheme');
  if (fs) {
    ['minor', 'major'].forEach(function (k) {
      var f = kid(fs, k + 'Font'); if (!f) return;
      th[k + 'Lt'] = at(kid(f, 'latin'), 'typeface', '');
      var ea = at(kid(f, 'ea'), 'typeface', '');
      if (!ea) kids(f, 'font').forEach(function (s) { if (s.getAttribute('script') === 'Jpan') ea = s.getAttribute('typeface') || ea; });
      th[k + 'Ea'] = ea;
    });
  }
  return th;
}

/* 開く。失敗時は message が日本語の Error（e.code=encrypted|notzip|empty|nopres） */
async function open(buf) {
  if (!g.JSZip) throw mkErr('notzip', 'ファイルを読み取る部品を読み込めませんでした。通信状況を確認してもう一度お試しください。');
  var u8 = new Uint8Array(buf);
  if (u8.length > 8 && u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0)
    throw mkErr('encrypted', 'このファイルはパスワードで保護されているか、古い形式（.ppt）です。パスワードを外す、または「名前を付けて保存」で .pptx にしてからもう一度お試しください。');
  var zip;
  try { zip = await g.JSZip.loadAsync(buf); } catch (e) { throw mkErr('notzip', 'ファイルを開けませんでした。壊れているか、PowerPoint（.pptx）ではない可能性があります。'); }
  var pkg = { zip: zip, cache: {}, media: {} };
  var pres = await readXml(pkg, 'ppt/presentation.xml');
  if (!pres) throw mkErr('nopres', 'PowerPointのファイルとして読み取れませんでした（presentation.xml がありません）。');
  var sz = path(pres, 'sldSz');
  pkg.sz = { cx: atn(sz, 'cx', 9144000), cy: atn(sz, 'cy', 6858000) };
  var rels = await readRels(pkg, 'ppt/presentation.xml'), ids = kid(pres, 'sldIdLst');
  pkg.slides = kids(ids, 'sldId').map(function (s, i) {
    var rid = s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || s.getAttribute('r:id');
    return rels[rid] ? { idx: i, path: rels[rid].target } : null;
  }).filter(Boolean).map(function (s, i) { s.idx = i; return s; });
  if (!pkg.slides.length) throw mkErr('empty', 'スライドが1枚もありません。');
  pkg.defTextStyle = kid(pres, 'defaultTextStyle');
  return pkg;
}
function mkErr(code, msg) { var e = new Error(msg); e.code = code; return e; }

/* ---------- スライドの文脈（レイアウト・マスター・テーマ・色の対応表） ---------- */
async function slideCtx(pkg, i) {
  var sp = pkg.slides[i].path, sx = await readXml(pkg, sp), srels = await readRels(pkg, sp);
  var lr = relOfType(srels, /slideLayout$/), lp = lr ? lr.target : null, lx = lp ? await readXml(pkg, lp) : null;
  var lrels = lp ? await readRels(pkg, lp) : {}, mr = relOfType(lrels, /slideMaster$/), mp = mr ? mr.target : null, mx = mp ? await readXml(pkg, mp) : null;
  var mrels = mp ? await readRels(pkg, mp) : {}, tr = relOfType(mrels, /theme$/), theme = parseTheme(tr ? await readXml(pkg, tr.target) : null);
  var map = null, cm = mx && kid(mx, 'clrMap');
  if (cm) { map = {}; for (var a = 0; a < cm.attributes.length; a++) map[cm.attributes[a].name] = cm.attributes[a].value; }
  var ov = path(sx, 'clrMapOvr', 'overrideClrMapping');
  if (ov) { map = map || {}; for (var b = 0; b < ov.attributes.length; b++) map[ov.attributes[b].name] = ov.attributes[b].value; }
  var lov = !ov && lx && path(lx, 'clrMapOvr', 'overrideClrMapping');
  if (lov) { map = map || {}; for (var c = 0; c < lov.attributes.length; c++) map[lov.attributes[c].name] = lov.attributes[c].value; }
  return { slide: sx, slidePath: sp, srels: srels, layout: lx, layoutPath: lp, lrels: lrels, master: mx, masterPath: mp, mrels: mrels, theme: theme, clrMap: map || {} };
}

/* ---------- プレースホルダーの継承 ---------- */
function phOf(sp) { return path(sp, 'nvSpPr', 'nvPr', 'ph') || path(sp, 'nvPicPr', 'nvPr', 'ph'); }
function shapesOf(root) { var tree = path(root, 'cSld', 'spTree'); return tree ? kids(tree) : []; }
function findPh(root, ph) {
  if (!root || !ph) return null;
  var type = at(ph, 'type', 'body'), idx = at(ph, 'idx', null), best = null;
  shapesOf(root).forEach(function (s) {
    var p = phOf(s); if (!p || best) return;
    var pt = at(p, 'type', 'body'), pi = at(p, 'idx', null);
    if (idx != null && pi === idx) best = s;
  });
  if (best) return best;
  var fam = function (t) { return t === 'ctrTitle' ? 'title' : t === 'subTitle' ? 'body' : t; };
  shapesOf(root).forEach(function (s) {
    var p = phOf(s); if (!p || best) return;
    if (fam(at(p, 'type', 'body')) === fam(type)) best = s;
  });
  return best;
}
function xfrmOf(spPr) {
  var x = spPr && kid(spPr, 'xfrm'); if (!x) return null;
  var off = kid(x, 'off'), ext = kid(x, 'ext');
  if (!off || !ext) return null;
  return { x: atn(off, 'x', 0), y: atn(off, 'y', 0), cx: atn(ext, 'cx', 0), cy: atn(ext, 'cy', 0), rot: atn(x, 'rot', 0) / 60000, flipH: x.getAttribute('flipH') === '1' || x.getAttribute('flipH') === 'true', flipV: x.getAttribute('flipV') === '1' || x.getAttribute('flipV') === 'true' };
}

/* ---------- 書体の対応付け ---------- */
function isCjk(s) { return /[　-ヿ㐀-鿿＀-￯]/.test(s); }
function fontKey(face, cjk) {
  face = face || '';
  if (/明朝|mincho|serif|times|georgia|garamond|century|cambria|palatino|book antiqua|ming|song/i.test(face) && !/sans/i.test(face)) return 'mincho';
  if (/丸|maru|rounded|ゴシックＭ?ＰＲ?|comic/i.test(face) && /丸|maru|rounded/i.test(face)) return 'maru';
  if (!cjk && /^(inter|arial|helvetica|calibri|segoe|verdana|tahoma|roboto|open sans|lato)/i.test(face)) return 'sans-en';
  return 'gothic';
}

/* ---------- 塗り・線 ---------- */
function fillOf(spPr, style, cx) {
  if (spPr) {
    var ch = kids(spPr).filter(function (k) { return /^(noFill|solidFill|gradFill|pattFill|blipFill|grpFill)$/.test(k.localName); })[0];
    if (ch) {
      switch (ch.localName) {
        case 'noFill': case 'grpFill': return { none: true };
        case 'solidFill': var c = color(ch, cx); return c ? { hex: c } : { none: true };
        case 'gradFill':
          var gs = kids(path(ch, 'gsLst'), 'gs').map(function (s) { return color(s, cx); }).filter(Boolean);
          if (!gs.length) return { none: true };
          var avg = [0, 0, 0]; gs.forEach(function (h) { var r = h2rgb(h); avg[0] += r[0]; avg[1] += r[1]; avg[2] += r[2]; });
          return { hex: rgb2h(avg.map(function (v) { return v / gs.length; })), approx: '(グラデーション)' };
        case 'pattFill': var fg = color(kid(ch, 'bgClr'), cx) || color(kid(ch, 'fgClr'), cx); return fg ? { hex: fg, approx: '(パターン)' } : { none: true };
        case 'blipFill': return { none: true, blip: true };
      }
    }
  }
  var fr = style && kid(style, 'fillRef');
  if (fr && atn(fr, 'idx', 0) > 0) { var cc = color(fr, Object.assign({}, cx, { phClr: null })); if (cc) return { hex: cc }; }
  return { none: true };
}
function dashOf(v) { return /^(dash|lgDash|sysDash|dashDot|lgDashDot|lgDashDotDot|sysDashDot|sysDashDotDot)$/.test(v) ? 'dashed' : /^(dot|sysDot)$/.test(v) ? 'dotted' : 'solid'; }
function lineOf(spPr, style, cx, defNone) {
  var ln = spPr && kid(spPr, 'ln'), lr = style && kid(style, 'lnRef'), idx = lr ? atn(lr, 'idx', 0) : 0;
  var w = ln && ln.getAttribute('w') != null ? atn(ln, 'w', 9525) : (idx === 1 ? 6350 : idx === 2 ? 12700 : idx >= 3 ? 19050 : 9525);
  if (ln) {
    var f = kids(ln).filter(function (k) { return /^(noFill|solidFill|gradFill|pattFill)$/.test(k.localName); })[0];
    if (f) {
      if (f.localName === 'noFill') return null;
      var c = f.localName === 'solidFill' ? color(f, cx) : (color(kid(path(f, 'gsLst') || f, 'gs'), cx) || null);
      if (!c) return null;
      return { w: w / 12700, hex: c, dash: dashOf(at(kid(ln, 'prstDash'), 'val', 'solid')) };
    }
    if (lr && idx > 0) { var c2 = color(lr, Object.assign({}, cx, { phClr: null })); if (c2) return { w: w / 12700, hex: c2, dash: dashOf(at(kid(ln, 'prstDash'), 'val', 'solid')) }; }
    return null;
  }
  if (lr && idx > 0 && !defNone) { var c3 = color(lr, Object.assign({}, cx, { phClr: null })); if (c3) return { w: w / 12700, hex: c3, dash: 'solid' }; }
  return null;
}

/* ---------- 位置の変換（グループ・拡大縮小・回転） ---------- */
function groupInfo(grpSpPr) {
  var x = kid(grpSpPr, 'xfrm'); if (!x) return null;
  var off = kid(x, 'off'), ext = kid(x, 'ext'), co = kid(x, 'chOff'), ce = kid(x, 'chExt');
  return { ox: atn(off, 'x', 0), oy: atn(off, 'y', 0), ex: atn(ext, 'cx', 0), ey: atn(ext, 'cy', 0), cox: atn(co, 'x', 0), coy: atn(co, 'y', 0), cex: atn(ce, 'cx', 0), cey: atn(ce, 'cy', 0), rot: atn(x, 'rot', 0) / 60000, flipH: x.getAttribute('flipH') === '1', flipV: x.getAttribute('flipV') === '1' };
}
function rotPt(px, py, cx, cy, deg) { var r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), dx = px - cx, dy = py - cy; return [cx + dx * c - dy * s, cy + dx * s + dy * c]; }
/* EMU のフレーム → ページ座標(mm)のフレーム。f={x,y,cx,cy,rot,flipH,flipV} */
function toPage(f, chain, T) {
  var cx = f.x + f.cx / 2, cy = f.y + f.cy / 2, w = f.cx, h = f.cy, rot = f.rot || 0, fh = !!f.flipH, fv = !!f.flipV;
  chain.forEach(function (gi) {
    var sx = gi.cex ? gi.ex / gi.cex : 1, sy = gi.cey ? gi.ey / gi.cey : 1;
    cx = gi.ox + (cx - gi.cox) * sx; cy = gi.oy + (cy - gi.coy) * sy; w *= sx; h *= sy;
    var gcx = gi.ox + gi.ex / 2, gcy = gi.oy + gi.ey / 2;
    if (gi.flipH) { cx = 2 * gcx - cx; fh = !fh; }
    if (gi.flipV) { cy = 2 * gcy - cy; fv = !fv; }
    if (gi.rot) { var p = rotPt(cx, cy, gcx, gcy, gi.rot); cx = p[0]; cy = p[1]; rot += gi.rot; }
  });
  var wm = w / EMU * T.S, hm = h / EMU * T.S;
  return { cx: cx / EMU * T.S + T.ox, cy: cy / EMU * T.S + T.oy, w: wm, h: hm, x: cx / EMU * T.S + T.ox - wm / 2, y: cy / EMU * T.S + T.oy - hm / 2, rot: ((rot % 360) + 540) % 360 - 180, flipH: fh, flipV: fv };
}
/* フレーム内の部分矩形（フレーム左上からの相対 lx,ly,lw,lh）を回転込みで要素の x,y に */
function sub(f, lx, ly, lw, lh) {
  var dx = lx + lw / 2 - f.w / 2, dy = ly + lh / 2 - f.h / 2, p = rotPt(f.cx + dx, f.cy + dy, f.cx, f.cy, f.rot || 0);
  return { x: p[0] - lw / 2, y: p[1] - lh / 2, w: lw, h: lh, rot: f.rot || 0 };
}

/* ---------- 文字 ---------- */
function charW(ch, size) { var c = ch.charCodeAt(0); return (c > 0x2e7f ? 1 : /[A-Z0-9]/.test(ch) ? 0.62 : /[ilI.,:;'|!]/.test(ch) ? 0.3 : 0.52) * size * PT; }
function estLines(text, size, widthMm) {
  var n = 0; String(text).split('\n').forEach(function (ln) {
    var w = 0, lines = 1; Array.from(ln).forEach(function (ch) { var cw = charW(ch, size); if (w + cw > widthMm && w > 0) { lines++; w = cw; } else w += cw; });
    n += lines;
  });
  return n;
}
function txStyleOf(master, phType, isPh) {
  var ts = master && path(master, 'txStyles'); if (!ts) return null;
  if (!isPh) return kid(ts, 'otherStyle');
  return kid(ts, phType === 'title' || phType === 'ctrTitle' ? 'titleStyle' : /^(body|subTitle|obj|)$/.test(phType) || !phType ? 'bodyStyle' : 'otherStyle');
}

/* txBody → テキスト要素の配列。frame=ページ座標のフレーム（toPage の結果）。o={base,T,cx,chain-of-lstStyles,fontRefClr,insets,anchor,cell} */
function textElems(txBody, frame, o) {
  var T = o.T, bp = kid(txBody, 'bodyPr'), paras = kids(txBody, 'p');
  if (!paras.length) return [];
  var lst = [kid(txBody, 'lstStyle')].concat(o.lsts || []).concat([o.txStyle, T.pkg.defTextStyle]).filter(Boolean);
  var fontScale = 1; var naf = kid(bp, 'normAutofit'); if (naf && naf.getAttribute('fontScale')) fontScale = atn(naf, 'fontScale', 100000) / 100000;
  var lnRed = naf ? atn(naf, 'lnSpcReduction', 0) / 100000 : 0;
  var ins = o.insets || { l: atn(bp, 'lIns', 91440), t: atn(bp, 'tIns', 45720), r: atn(bp, 'rIns', 91440), b: atn(bp, 'bIns', 45720) };
  var conv = function (e) { return e / EMU * T.S; };
  var anchor = o.anchor || at(bp, 'anchor', 't'), vert = at(bp, 'vert', 'horz'), wrapNone = at(bp, 'wrap', 'square') === 'none';
  var lvl = function (n) { return lst.map(function (l) { return kid(l, 'lvl' + (n + 1) + 'pPr'); }).filter(Boolean); };
  var counters = {}, groups = [];
  paras.forEach(function (p) {
    var pPr = kid(p, 'pPr'), l = atn(pPr, 'lvl', 0), lv = lvl(l), pn = [pPr].concat(lv).filter(Boolean);
    var drs = lv.map(function (x) { return kid(x, 'defRPr'); }).filter(Boolean);
    var pa = function (name, d) { for (var i = 0; i < pn.length; i++) { var v = pn[i].getAttribute(name); if (v != null) return v; } return d; };
    var pchild = function (name) { for (var i = 0; i < pn.length; i++) { var c = kid(pn[i], name); if (c) return c; } return null; };
    var runs = [], text = '';
    kids(p).forEach(function (c) {
      var n = c.localName;
      if (n === 'r' || n === 'fld') { var t = kid(c, 't'); runs.push({ rPr: kid(c, 'rPr'), t: t ? t.textContent : '' }); }
      else if (n === 'br') runs.push({ rPr: kid(c, 'rPr'), t: '\n' });
    });
    runs.forEach(function (r) { text += r.t; });
    /* 箇条書き */
    var bu = '';
    var bnone = pchild('buNone'), bch = pchild('buChar'), bnum = pchild('buAutoNum');
    var first = pPr && kids(pPr).filter(function (k) { return /^bu(None|Char|AutoNum)$/.test(k.localName); })[0];
    if (first) { bnone = first.localName === 'buNone' ? first : null; bch = first.localName === 'buChar' ? first : null; bnum = first.localName === 'buAutoNum' ? first : null; }
    if (text && !bnone) {
      if (bch) bu = at(bch, 'char', '・').replace(/[•●▪■]/, '・');
      else if (bnum) { counters[l] = (counters[l] || 0) + 1; bu = counters[l] + '.'; }
    }
    if (!bnum || !text) { if (!bnum) counters[l] = 0; }
    /* 支配的なラン（文字数が最大） */
    var dom = null, best = -1;
    runs.forEach(function (r) { var n = r.t.replace(/\s/g, '').length; if (n > best) { best = n; dom = r; } });
    var rp = dom ? dom.rPr : kid(p, 'endParaRPr');
    var nodes = [rp].concat(drs).filter(Boolean);
    var ra = function (name) { for (var i = 0; i < nodes.length; i++) { var v = nodes[i].getAttribute(name); if (v != null) return v; } return null; };
    var rchild = function (name) { for (var i = 0; i < nodes.length; i++) { var c = kid(nodes[i], name); if (c) return c; } return null; };
    var sz = (atn({ getAttribute: function () { return ra('sz'); } }, 'x', 0) || 1800) / 100;
    var szN = +ra('sz') || 1800; sz = szN / 100;
    var cj = isCjk(text);
    var theme = T.cx.theme, face = function (nm) {
      var f = rchild(nm); var t = f ? f.getAttribute('typeface') : ''; if (!t) return '';
      if (/^\+mn-ea$/.test(t)) return theme.minorEa || theme.minorLt; if (/^\+mj-ea$/.test(t)) return theme.majorEa || theme.majorLt;
      if (/^\+mn-lt$/.test(t)) return theme.minorLt; if (/^\+mj-lt$/.test(t)) return theme.majorLt; if (/^\+/.test(t)) return ''; return t;
    };
    var fc = rchild('solidFill'), col = fc ? color(fc, T.cx) : null;
    if (!col && o.fontRefClr) col = o.fontRefClr;
    if (!col) { var dfc = null; nodes.forEach(function (nd) { if (!dfc) dfc = kid(nd, 'solidFill'); }); col = color(dfc, T.cx) || (o.cell && o.cell.color) || '#000000'; }
    var algn = pa('algn', 'l'), bold = ra('b') != null ? (ra('b') === '1' || ra('b') === 'true') : !!(o.cell && o.cell.bold);
    var uu = ra('u'), strike = ra('strike'), spc = +ra('spc') || 0, cap = ra('cap');
    var ls = pchild('lnSpc'), lh = LH;
    if (ls) { var pc = kid(ls, 'spcPct'), pt = kid(ls, 'spcPts'); if (pc) lh = atn(pc, 'val', 100000) / 100000 * LH; else if (pt) lh = Math.max(0.6, atn(pt, 'val', 0) / 100 / (sz * fontScale)); }
    lh = Math.max(0.6, lh * (1 - lnRed));
    var sb = pchild('spcBef'), sa = pchild('spcAft'), spPt = function (s) { if (!s) return 0; var pp = kid(s, 'spcPts'), pc2 = kid(s, 'spcPct'); return pp ? atn(pp, 'val', 0) / 100 : pc2 ? atn(pc2, 'val', 0) / 100000 * sz * LH : 0; };
    if (cap === 'all') text = text.toUpperCase();
    var sig = [szN, bold, ra('i'), uu, strike, col, algn, spc, lh.toFixed(2), fontKey(cj ? (face('ea') || face('latin')) : (face('latin') || face('ea')), cj)].join('|');
    var ent = { text: (bu ? bu : '') + text, sig: sig, sz: sz * fontScale, bold: bold, italic: ra('i') === '1' || ra('i') === 'true', underline: !!uu && uu !== 'none', strike: !!strike && strike !== 'noStrike', col: col, algn: algn, spc: spc, lh: lh, bef: spPt(sb), aft: spPt(sa), font: fontKey(cj ? (face('ea') || face('latin')) : (face('latin') || face('ea')), cj), cap: cap };
    var lastG = groups[groups.length - 1];
    if (lastG && lastG.sig === sig) { lastG.paras.push(ent); } else groups.push({ sig: sig, paras: [ent], ent: ent });
  });
  if (!groups.length || !groups.some(function (gp) { return gp.paras.some(function (p) { return p.text.trim(); }); })) {
    /* 空の文字: 要素にしない（全部空白のとき） */
    if (!groups.some(function (gp) { return gp.paras.some(function (p) { return p.text.length; }); })) return [];
  }
  /* 空の文字だけのグループは落とす（先頭・末尾） */
  while (groups.length && !groups[0].paras.some(function (p) { return p.text.trim(); }) && groups.length > 1) groups.shift();
  while (groups.length > 1 && !groups[groups.length - 1].paras.some(function (p) { return p.text.trim(); })) groups.pop();
  var il = conv(ins.l), it = conv(ins.t), ir = conv(ins.r), ib = conv(ins.b);
  var vv = vert === 'vert270';
  var fw = vv ? frame.h : frame.w, fh = vv ? frame.w : frame.h;
  var tw = Math.max(1, fw - il - ir), th = Math.max(1, fh - it - ib);
  var out = [];
  var mk = function (gp, ly, lh2, k) {
    var e = gp.ent, txt = gp.paras.map(function (p) { return p.text; }).join('\n'), r;
    if (vv) { var rr = sub({ cx: frame.cx, cy: frame.cy, w: frame.w, h: frame.h, rot: frame.rot }, 0, 0, frame.w, frame.h); r = { x: frame.cx - fh / 2 + it, y: frame.cy - fw / 2 + il, w: th, h: tw, rot: frame.rot - 90 }; }
    else r = sub(frame, il, ly, tw, lh2);
    var el = { type: 'text', id: o.base + 't' + k, x: r.x, y: r.y, w: r.w, h: r.h, rot: r.rot, text: txt, font: e.font, size: e.sz * T.S, weight: e.bold ? 700 : 400, italic: e.italic, underline: e.underline, strike: e.strike, color: e.col,
      align: e.algn === 'ctr' ? 'center' : e.algn === 'r' ? 'right' : /^(just|dist|justLow)$/.test(e.algn) ? 'justify' : 'left',
      valign: groups.length > 1 ? 'top' : anchor === 'ctr' ? 'middle' : anchor === 'b' ? 'bottom' : 'top', lineHeight: e.lh, letterSpacing: e.spc ? e.spc / 100 / Math.max(1, e.sz / fontScale) : 0, vertical: vert === 'vert' || vert === 'eaVert', fit: (wrapNone || (groups.length === 1 && gp.paras.length === 1 && txt.indexOf('\n') < 0 && estLines(txt, e.sz * T.S, tw * 1.25) <= 1)) ? 'shrink' : 'none', padding: 0, name: txt.replace(/\s+/g, ' ').slice(0, 20) || 'テキスト' };
    if (o.locked) el.locked = true;
    if (o.groupId) el.groupId = o.groupId;
    out.push(el);
  };
  if (groups.length === 1) { mk(groups[0], it, th, 0); return out; }
  /* 複数の書式 → 段落ごとに積む（高さは文字数から推定） */
  var hs = groups.map(function (gp) {
    var hh = 0; gp.paras.forEach(function (p) { hh += estLines(p.text || ' ', p.sz * T.S, wrapNone ? 1e6 : tw * 0.96) * p.sz * T.S * p.lh * PT + (p.bef + p.aft) * PT * T.S; });
    return hh * 1.0;
  });
  var total = hs.reduce(function (a, b) { return a + b; }, 0), y0 = anchor === 'ctr' ? it + (th - total) / 2 : anchor === 'b' ? it + th - total : it;
  groups.forEach(function (gp, k) { mk(gp, y0, hs[k] + 0.01, k); y0 += hs[k]; });
  return out;
}

/* ---------- 画像 ---------- */
function loadImg(url) { return new Promise(function (ok, ng) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ng(new Error('img')); }; i.src = url; }); }
function mimeOf(p) { var e = (p.split('.').pop() || '').toLowerCase(); return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml' }[e] || ''; }
function placeholderSvg(w, h, label) {
  var W = 400, H = Math.max(40, Math.round(400 * h / Math.max(1, w))), lines = [], cur = '';
  Array.from(label).forEach(function (ch) { if (cur.length >= 22 && /[。、）（\s]/.test(ch) || cur.length >= 26) { lines.push(cur); cur = ''; } cur += ch; });
  if (cur) lines.push(cur);
  var fs = 15, y0 = H / 2 - (lines.length - 1) * fs * 0.7;
  var t = lines.map(function (l, i) { return '<text x="' + W / 2 + '" y="' + (y0 + i * fs * 1.4) + '" font-size="' + fs + '" text-anchor="middle" fill="#475569" font-family="sans-serif">' + l.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }) + '</text>'; }).join('');
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" preserveAspectRatio="none"><defs><pattern id="h" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="#f1f5f9"/><line x1="0" y1="0" x2="0" y2="14" stroke="#dbe3ec" stroke-width="5"/></pattern></defs><rect width="' + W + '" height="' + H + '" fill="url(#h)"/><rect x="1" y="1" width="' + (W - 2) + '" height="' + (H - 2) + '" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="8 5"/>' + t + '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
var EMF_MSG = function (ext) { return 'この画像は読み込めない形式です（' + ext + '）。右クリック→図の変更で差し替え'; };
/* 画像1枚 → {src} か {placeholder:'EMF'}。crop={l,t,r,b}(0-1)。frame の縦横比に引き伸ばして焼き込む */
async function imageSrc(pkg, p, frame, crop, flipH, flipV, maxPx) {
  var ext = (p.split('.').pop() || '').toLowerCase();
  if (/^(emf|wmf|tif|tiff|wdp|jxr|pict|emz|wmz)$/.test(ext)) return { placeholder: ext.toUpperCase().replace(/^(EMZ)$/, 'EMF').replace(/^WMZ$/, 'WMF').replace(/^TIFF$/, 'TIF') };
  var f = pkg.zip.file(p); if (!f) return { missing: true };
  var u8 = await f.async('uint8array'), mime = mimeOf(p) || 'image/png';
  var url = URL.createObjectURL(new Blob([u8], { type: mime }));
  try {
    if (mime === 'image/svg+xml') { return { src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new TextDecoder().decode(u8)) }; }
    var im = await loadImg(url), sw = im.naturalWidth, sh = im.naturalHeight;
    if (!sw || !sh) return { missing: true };
    var cl = crop && (crop.l || crop.t || crop.r || crop.b) ? crop : { l: 0, t: 0, r: 0, b: 0 };
    var cw = sw * (1 - cl.l - cl.r), ch = sh * (1 - cl.t - cl.b);
    var ratio = frame.w > 0 && frame.h > 0 ? frame.w / frame.h : cw / ch;
    var tw = Math.min(maxPx, Math.max(cw, ch * ratio)), th = tw / ratio;
    if (th > maxPx) { th = maxPx; tw = th * ratio; }
    tw = Math.max(1, Math.round(Math.min(tw, cw * 1.01 + 1) )); th = Math.max(1, Math.round(tw / ratio));
    var cv = document.createElement('canvas'); cv.width = tw; cv.height = th;
    var cx = cv.getContext('2d'), jpeg = mime === 'image/jpeg';
    if (jpeg) { cx.fillStyle = '#fff'; cx.fillRect(0, 0, tw, th); }
    cx.save(); cx.translate(flipH ? tw : 0, flipV ? th : 0); cx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    cx.drawImage(im, sw * cl.l, sh * cl.t, cw, ch, 0, 0, tw, th); cx.restore();
    return { src: jpeg ? cv.toDataURL('image/jpeg', 0.88) : cv.toDataURL('image/png') };
  } catch (e) { return { missing: true }; } finally { URL.revokeObjectURL(url); }
}

/* ---------- 変換本体 ---------- */
var LINE_PRST = /^(line|straightConnector1|bentConnector\d|curvedConnector\d)$/;
var RECT_PRST = /^(rect|roundRect|flowChartProcess|flowChartPredefinedProcess|flowChartInternalStorage|snip1Rect|snip2SameRect|snip2DiagRect|snipRoundRect|round1Rect|round2SameRect|round2DiagRect|frame|bevel|cube|can|foldedCorner|plaque|flowChartDocument|flowChartMultidocument|flowChartTerminator|flowChartAlternateProcess|flowChartPunchedCard)$/;
var ELL_PRST = /^(ellipse|flowChartConnector|flowChartSummingJunction|flowChartOr|donut|noSmoking|smileyFace)$/;
var ROUND_PRST = /^(roundRect|flowChartAlternateProcess|flowChartTerminator)$/;

function skip(st, kind) { st.skipped[kind] = (st.skipped[kind] || 0) + 1; }
function addEl(st, e) { st.out.push(e); }

function shapeNames(c) { var nv = kid(c, 'nvSpPr') || kid(c, 'nvPicPr') || kid(c, 'nvCxnSpPr') || kid(c, 'nvGraphicFramePr'); var cn = nv && kid(nv, 'cNvPr'); return cn ? cn : null; }

async function walk(tree, chain, prefix, st, level) {
  var list = kids(tree);
  for (var i = 0; i < list.length; i++) {
    var c = list[i], key = prefix + i, n = c.localName;
    if (n === 'nvGrpSpPr' || n === 'grpSpPr' || n === 'extLst') continue;
    var cn = shapeNames(c); if (cn && (cn.getAttribute('hidden') === '1' || cn.getAttribute('hidden') === 'true')) continue;
    try {
      if (n === 'grpSp') {
        var gi = groupInfo(kid(c, 'grpSpPr'));
        if (!gi) continue;
        var gid = st.gid || ('g' + st.tag + key);
        var saved = st.gid; st.gid = gid;
        await walk(c, [gi].concat(chain), key + '_', st, level + 1);
        st.gid = saved;
      } else if (n === 'sp' || n === 'cxnSp') await doShape(c, chain, key, st);
      else if (n === 'pic') await doPic(c, chain, key, st);
      else if (n === 'graphicFrame') await doFrame(c, chain, key, st);
      else if (n === 'AlternateContent') {
        var fb = kid(c, 'Fallback') || kid(c, 'Choice');
        if (fb) await walk(fb, chain, key + '_', st, level);
      } else if (n === 'contentPart') skip(st, '埋め込みコンテンツ');
    } catch (e) { if (g.console) console.warn('pptx-import', e); skip(st, '読み取れなかった要素'); }
  }
}

async function doShape(sp, chain, key, st) {
  var spPr = kid(sp, 'spPr'), style = kid(sp, 'style'), ph = phOf(sp), cx = st.cx, T = st.T;
  var fr = xfrmOf(spPr), lsts = [], inheritTx = null;
  if (ph) {
    var ls = findPh(st.layout, ph), ms = findPh(st.master, ph);
    if (!fr) { fr = xfrmOf(ls && kid(ls, 'spPr')) || xfrmOf(ms && kid(ms, 'spPr')); }
    [ls, ms].forEach(function (s) { var l = s && path(s, 'txBody', 'lstStyle'); if (l) lsts.push(l); });
  }
  var txBody = kid(sp, 'txBody'), hasText = txBody && kids(txBody, 'p').some(function (p) { return kids(p).some(function (r) { return (r.localName === 'r' || r.localName === 'fld') && (kid(r, 't') || {}).textContent; }); });
  if (!fr) { if (hasText) skip(st, '位置が不明な図形'); return; }
  var pr = kid(spPr, 'prstGeom'), prst = pr ? at(pr, 'prst', 'rect') : (kid(spPr, 'custGeom') ? 'custom' : 'rect');
  var f = toPage(fr, chain, T), cxS = Object.assign({}, cx);
  var fillR = fillOf(spPr, style, cx), lnR = lineOf(spPr, style, cx, false);
  if (sp.localName === 'cxnSp' || LINE_PRST.test(prst)) {
    if (!lnR) return;
    var hw = f.w / 2, hh = f.h / 2, ax = -hw, ay = -hh, bx = hw, by = hh;
    if (f.flipH) { ax = -ax; bx = -bx; } if (f.flipV) { ay = -ay; by = -by; }
    var p1 = rotPt(f.cx + ax, f.cy + ay, f.cx, f.cy, f.rot), p2 = rotPt(f.cx + bx, f.cy + by, f.cx, f.cy, f.rot);
    var dx = p2[0] - p1[0], dy = p2[1] - p1[1], len = Math.sqrt(dx * dx + dy * dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
    if (ang > 90) ang -= 180; else if (ang < -90) ang += 180;
    addEl(st, { type: 'line', id: st.tag + key + 'l', x: (p1[0] + p2[0]) / 2 - len / 2, y: (p1[1] + p2[1]) / 2, w: len, rot: ang, stroke: lnR.hex, strokeWidth: lnR.w * T.S, dash: lnR.dash, name: '線', locked: st.locked || undefined, groupId: st.gid || undefined });
    return;
  }
  var kind = ELL_PRST.test(prst) ? 'ellipse' : (RECT_PRST.test(prst) ? 'rect' : null);
  var drawn = false, re = null;
  if (!kind && (fillR.hex || lnR) && prst !== 'rect') { skip(st, prst === 'custom' ? '自由な形の図形（枠で代用せず省略）' : '図形（' + prst + '）'); }
  if (kind && (fillR.hex || lnR)) {
    var sw = lnR ? lnR.w * T.S : 0, pad = sw * PT / 2;
    var rad = 0; if (ROUND_PRST.test(prst) && kind === 'rect') { var adj = 16667; var gd = kid(kid(pr, 'avLst'), 'gd'); if (gd) { var m = /val\s+(\d+)/.exec(gd.getAttribute('fmla') || ''); if (m) adj = +m[1]; } rad = Math.min(f.w, f.h) * adj / 100000; if (prst === 'flowChartTerminator') rad = Math.min(f.w, f.h) / 2; }
    if (/^round/.test(prst)) rad = Math.min(f.w, f.h) * 0.16667; if (/^snip/.test(prst) || prst === 'frame') rad = 0;
    re = { type: kind, id: st.tag + key + 'r', x: f.x - pad, y: f.y - pad, w: f.w + pad * 2, h: f.h + pad * 2, rot: f.rot, fill: fillR.hex || 'transparent', stroke: lnR ? lnR.hex : 'transparent', strokeWidth: sw, dash: lnR ? lnR.dash : 'solid', radius: rad > 0 ? rad + pad : 0, name: (hasText ? '' : '') + (kind === 'ellipse' ? '円' : '四角形') };
    if (st.locked) re.locked = true; if (st.gid) re.groupId = st.gid;
    if (fillR.approx) st.notes.push(fillR.approx);
    addEl(st, re); drawn = true;
  }
  if (fillR.blip) skip(st, '図形の画像塗りつぶし');
  if (!hasText) return;
  var pairGid = null;
  if (drawn && !st.gid) pairGid = 'g' + st.tag + key + 'p';
  var fontRefClr = null, fRef = style && kid(style, 'fontRef');
  if (fRef) fontRefClr = color(fRef, Object.assign({}, cx, { phClr: null }));
  var phType = ph ? at(ph, 'type', 'body') : '';
  var els = textElems(txBody, f, { base: st.tag + key, T: T, lsts: lsts, txStyle: txStyleOf(st.master, phType, !!ph), fontRefClr: fontRefClr, locked: st.locked, groupId: st.gid || pairGid });
  els.forEach(function (e) { addEl(st, e); });
  if (pairGid && re && !els.length) { /* 文字がなければ組にしない */ }
  if (pairGid && re && els.length) re.groupId = pairGid;
}

async function doPic(pic, chain, key, st) {
  var spPr = kid(pic, 'spPr'), fr = xfrmOf(spPr); if (!fr) return;
  var bf = kid(pic, 'blipFill'), blip = bf && kid(bf, 'blip'); if (!blip) return;
  var rid = blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') || blip.getAttribute('r:embed');
  var rel = st.rels[rid]; if (!rel) { skip(st, '画像（参照切れ）'); return; }
  var f = toPage(fr, chain, st.T), sr = kid(bf, 'srcRect');
  var crop = sr ? { l: atn(sr, 'l', 0) / 100000, t: atn(sr, 't', 0) / 100000, r: atn(sr, 'r', 0) / 100000, b: atn(sr, 'b', 0) / 100000 } : null;
  var el = { type: 'image', id: st.tag + key + 'i', x: f.x, y: f.y, w: f.w, h: f.h, rot: f.rot, fit: 'contain', name: '画像' };
  if (st.locked) el.locked = true; if (st.gid) el.groupId = st.gid;
  var ext = (rel.target.split('.').pop() || '').toUpperCase();
  if (st.opts.skipMedia) { el.src = ''; addEl(st, el); st.images++; return; }
  var r = await getImage(st, rel.target, f, crop, f.flipH, f.flipV);
  if (r.placeholder) { el.src = placeholderSvg(f.w, f.h, EMF_MSG(r.placeholder)); el.name = '画像（' + r.placeholder + '・差し替えてください）'; st.emf.push({ type: r.placeholder, name: el.name }); }
  else if (r.src) { el.src = r.src; st.images++; }
  else { skip(st, '画像（読み取れず）'); return; }
  addEl(st, el);
}
async function getImage(st, p, f, crop, fh, fv) {
  var k = [p, st.opts.maxPx, Math.round(f.w * 10), Math.round(f.h * 10), crop ? [crop.l, crop.t, crop.r, crop.b].join(',') : '', fh, fv].join('|');
  var c = st.pkg.media; if (c[k]) return c[k];
  return (c[k] = await imageSrc(st.pkg, p, f, crop, fh, fv, st.opts.maxPx));
}

/* 表 */
var DEF_TBL = '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}';
async function doFrame(fr, chain, key, st) {
  var gd = path(fr, 'graphic', 'graphicData'), tbl = gd && kid(gd, 'tbl');
  if (!tbl) { skip(st, gd && /chart/.test(at(gd, 'uri', '')) ? 'グラフ' : gd && /diagram/.test(at(gd, 'uri', '')) ? 'SmartArt' : '表以外の埋め込み'); return; }
  var xf = kid(fr, 'xfrm'), off = kid(xf, 'off'); if (!off) return;
  var T = st.T, cols = kids(kid(tbl, 'tblGrid'), 'gridCol').map(function (c) { return atn(c, 'w', 0); }), trs = kids(tbl, 'tr');
  var rows = trs.map(function (r) { return atn(r, 'h', 0); });
  /* 行の高さが0・小さすぎる表（pptxgenjs など）は、文字の大きさから必要な高さを求める */
  trs.forEach(function (tr, r) {
    var need = 0;
    kids(tr, 'tc').forEach(function (tc) {
      var tcPr = kid(tc, 'tcPr'), tb = kid(tc, 'txBody'); if (!tb) return;
      var h = atn(tcPr, 'marT', 45720) + atn(tcPr, 'marB', 45720), lines = 0, mx = 1200;
      kids(tb, 'p').forEach(function (p) {
        var sz = 1800; kids(p, 'r').forEach(function (rr) { var rp = kid(rr, 'rPr'); if (rp && rp.getAttribute('sz')) sz = Math.max(sz === 1800 ? 0 : sz, +rp.getAttribute('sz')); });
        var ep = kid(p, 'endParaRPr'); if (sz === 1800 && ep && ep.getAttribute('sz')) sz = +ep.getAttribute('sz');
        lines += sz / 100 * 1.2 * 12700; mx = Math.max(mx, sz);
      });
      need = Math.max(need, h + lines);
    });
    if (rows[r] < need) rows[r] = Math.round(need);
  });
  var X = [atn(off, 'x', 0)], Y = [atn(off, 'y', 0)];
  cols.forEach(function (w) { X.push(X[X.length - 1] + w); }); rows.forEach(function (h) { Y.push(Y[Y.length - 1] + h); });
  var tp = kid(tbl, 'tblPr'), styleId = tp && kid(tp, 'tableStyleId') ? kid(tp, 'tableStyleId').textContent : '', defStyle = styleId === DEF_TBL;
  var firstRow = tp && (tp.getAttribute('firstRow') === '1'), bandRow = tp && (tp.getAttribute('bandRow') === '1');
  var acc1 = st.cx.theme.colors.accent1 ? '#' + st.cx.theme.colors.accent1 : '#4472c4';
  var tint = function (hex, x) { return rgb2h(h2rgb(hex).map(function (v) { return v * x + 255 * (1 - x); })); };
  var hEdges = {}, vEdges = {}; /* h[r][c]: 行境界 r の列 c の区間。v[c][r] */
  var setEdge = function (map, a, b, ln) { var k = a + '_' + b; map[k] = ln; };
  var occupied = {}, cells = [];
  trs.forEach(function (tr, r) {
    var tcs = kids(tr, 'tc'), c = 0;
    tcs.forEach(function (tc) {
      while (occupied[r + '_' + c]) c++;
      var gs = atn(tc, 'gridSpan', 1), rs = atn(tc, 'rowSpan', 1);
      for (var rr = 0; rr < rs; rr++) for (var cc = 0; cc < gs; cc++) occupied[(r + rr) + '_' + (c + cc)] = 1;
      if (tc.getAttribute('hMerge') !== '1' && tc.getAttribute('vMerge') !== '1') cells.push({ tc: tc, r: r, c: c, gs: gs, rs: rs });
      c += gs;
    });
  });
  cells.forEach(function (cl) {
    var tcPr = kid(cl.tc, 'tcPr'), c0 = cl.c, c1 = Math.min(cols.length, cl.c + cl.gs), r0 = cl.r, r1 = Math.min(rows.length, cl.r + cl.rs);
    var fillN = tcPr && kids(tcPr).filter(function (k) { return /^(noFill|solidFill|gradFill|pattFill|blipFill)$/.test(k.localName); })[0], fill = null;
    if (fillN) { if (fillN.localName === 'solidFill') fill = color(fillN, st.cx); else if (fillN.localName === 'gradFill' || fillN.localName === 'pattFill') fill = (fillOf(tcPr, null, st.cx) || {}).hex || null; }
    else if (defStyle) { if (firstRow && cl.r === 0) fill = acc1; else fill = tint(acc1, bandRow && (cl.r % 2 === 1) ? 0.4 : 0.2); if (bandRow && firstRow) fill = cl.r === 0 ? acc1 : tint(acc1, cl.r % 2 === 1 ? 0.4 : 0.2); }
    var fr0 = toPage({ x: X[c0], y: Y[r0], cx: X[c1] - X[c0], cy: Y[r1] - Y[r0], rot: 0 }, chain, T);
    if (fill) { var re = { type: 'rect', id: st.tag + key + 'c' + r0 + '_' + c0, x: fr0.x, y: fr0.y, w: fr0.w, h: fr0.h, rot: fr0.rot, fill: fill, stroke: 'transparent', strokeWidth: 0, name: '表のセル' }; if (st.locked) re.locked = true; if (st.gid) re.groupId = st.gid; addEl(st, re); }
    ['L', 'R', 'T', 'B'].forEach(function (sd) {
      var ln = tcPr && kid(tcPr, 'ln' + sd); if (!ln) return;
      var f2 = kids(ln).filter(function (k) { return /^(noFill|solidFill)$/.test(k.localName); })[0];
      var style = f2 && f2.localName === 'solidFill' ? { w: atn(ln, 'w', 12700) / 12700, hex: color(f2, st.cx), dash: dashOf(at(kid(ln, 'prstDash'), 'val', 'solid')) } : null;
      if (f2 && f2.localName === 'noFill') style = false;
      if (style === null) return;
      if (sd === 'L' || sd === 'R') { var cc2 = sd === 'L' ? c0 : c1; for (var q = r0; q < r1; q++) setEdge(vEdges, cc2, q, style); }
      else { var rr2 = sd === 'T' ? r0 : r1; for (var q2 = c0; q2 < c1; q2++) setEdge(hEdges, rr2, q2, style); }
    });
    /* 文字 */
    var tb = kid(cl.tc, 'txBody');
    if (tb) {
      var ins = { l: atn(tcPr, 'marL', 91440), r: atn(tcPr, 'marR', 91440), t: atn(tcPr, 'marT', 45720), b: atn(tcPr, 'marB', 45720) };
      var cellSt = defStyle && firstRow && cl.r === 0 ? { color: '#ffffff', bold: true } : null;
      var els = textElems(tb, fr0, { base: st.tag + key + 'x' + r0 + '_' + c0, T: T, insets: ins, anchor: at(tcPr, 'anchor', 't'), cell: cellSt, locked: st.locked, groupId: st.gid, txStyle: txStyleOf(st.master, '', false) });
      els.forEach(function (e) { addEl(st, e); });
    }
  });
  /* 罫線（同じ書式の連続区間を1本にまとめる） */
  var emitLines = function (isH) {
    var map = isH ? hEdges : vEdges, nOuter = isH ? rows.length : cols.length, nInner = isH ? cols.length : rows.length;
    for (var a = 0; a <= nOuter; a++) {
      var run = null;
      for (var b = 0; b <= nInner; b++) {
        var s = b < nInner ? map[a + '_' + b] : null, same = run && s && s.hex === run.s.hex && s.w === run.s.w && s.dash === run.s.dash;
        if (run && !same) {
          var p1 = isH ? { x: X[run.b0], y: Y[a] } : { x: X[a], y: Y[run.b0] }, p2 = isH ? { x: X[b], y: Y[a] } : { x: X[a], y: Y[b] };
          var A = toPage({ x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), cx: Math.abs(p2.x - p1.x), cy: Math.abs(p2.y - p1.y), rot: 0 }, chain, T);
          var len = isH ? A.w : A.h, mx = A.cx, my = A.cy;
          var le = { type: 'line', id: st.tag + key + (isH ? 'h' : 'v') + a + '_' + run.b0, x: mx - len / 2, y: my, w: len, rot: isH ? A.rot : A.rot + 90, stroke: run.s.hex, strokeWidth: run.s.w * T.S, dash: run.s.dash, name: '表の罫線' };
          if (st.locked) le.locked = true; if (st.gid) le.groupId = st.gid; addEl(st, le); run = null;
        }
        if (!run && s && s.hex) run = { b0: b, s: s };
      }
    }
  };
  emitLines(true); emitLines(false);
}

/* 背景 */
async function bgOf(cx, st) {
  var nodes = [cx.slide, cx.layout, cx.master];
  for (var i = 0; i < nodes.length; i++) {
    var bg = nodes[i] && path(nodes[i], 'cSld', 'bg'); if (!bg) continue;
    var pr = kid(bg, 'bgPr'), ref = kid(bg, 'bgRef');
    if (pr) {
      var f = fillOf(pr, null, cx);
      if (f.hex) return { hex: f.hex };
      if (f.blip) {
        var bf = kid(pr, 'blipFill'), blip = bf && kid(bf, 'blip'), rid = blip && (blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') || blip.getAttribute('r:embed'));
        var rels = i === 0 ? cx.srels : i === 1 ? cx.lrels : cx.mrels, rel = rels[rid];
        if (rel) return { img: rel.target };
      }
      return { hex: '#ffffff' };
    }
    if (ref) { var cc = color(ref, Object.assign({}, cx, { phClr: null })); if (cc) return { hex: cc }; }
  }
  return { hex: '#ffffff' };
}

async function convertSlide(pkg, i, opts) {
  opts = Object.assign({ maxPx: 1600, skipMedia: false }, opts || {});
  var cx = await slideCtx(pkg, i);
  var cxx = pkg.sz.cx, cyy = pkg.sz.cy, wmm = cxx / EMU, hmm = cyy / EMU, S = Math.min(210 / wmm, 297 / hmm);
  var T = { S: S, ox: (210 - wmm * S) / 2, oy: (297 - hmm * S) / 2, pkg: pkg, cx: cx };
  var st = { out: [], skipped: {}, emf: [], notes: [], images: 0, cx: cx, T: T, pkg: pkg, opts: opts, layout: cx.layout, master: cx.master, tag: 's', gid: null, locked: false, rels: cx.srels };
  var bg = await bgOf(cx, st), pageBg = bg.hex || '#ffffff';
  if (bg.img && !opts.skipMedia) {
    var bgEl = { type: 'image', id: 'bg', x: T.ox, y: T.oy, w: wmm * S, h: hmm * S, fit: 'cover', locked: true, name: '背景画像', src: '' };
    var r = await getImage(st, bg.img, { w: bgEl.w, h: bgEl.h }, null, false, false);
    if (r.src) { bgEl.src = r.src; st.out.push(bgEl); st.images++; }
    else if (r.placeholder) { st.emf.push({ type: r.placeholder, name: '背景画像' }); }
  }
  /* マスター → レイアウト → スライドの順（後ろほど前面） */
  var hideM = (cx.layout && at(cx.layout, 'showMasterSp', '1') === '0') || at(cx.slide, 'showMasterSp', '1') === '0';
  var hideL = at(cx.slide, 'showMasterSp', '1') === '0';
  var drawStatic = async function (root, rels, tag) {
    if (!root) return;
    var tree = path(root, 'cSld', 'spTree'); if (!tree) return;
    var keep = kids(tree).filter(function (c) { return !phOf(c) || (c.localName === 'pic'); });
    st.tag = tag; st.locked = true; st.rels = rels; st.gid = null;
    for (var q = 0; q < keep.length; q++) {
      var c = keep[q], key = String(kids(tree).indexOf(c)), n = c.localName;
      try {
        if (n === 'sp' || n === 'cxnSp') await doShape(c, [], key, st);
        else if (n === 'pic') await doPic(c, [], key, st);
        else if (n === 'grpSp') { var gi = groupInfo(kid(c, 'grpSpPr')); if (gi) { st.gid = 'g' + tag + key; await walk(c, [gi], key + '_', st, 1); st.gid = null; } }
        else if (n === 'graphicFrame') await doFrame(c, [], key, st);
      } catch (e) { if (g.console) console.warn('pptx-import', e); skip(st, '読み取れなかった要素'); }
    }
    st.locked = false;
  };
  if (!hideM) await drawStatic(cx.master, cx.mrels, 'M');
  if (!hideL) await drawStatic(cx.layout, cx.lrels, 'L');
  st.tag = 's'; st.locked = false; st.rels = cx.srels; st.gid = null;
  var tree = path(cx.slide, 'cSld', 'spTree');
  if (tree) await walk(tree, [], '', st, 0);
  var els = g.JukenFree ? g.JukenFree.normElements(st.out) : st.out;
  var dropped = st.out.length - els.length;
  var sk = st.skipped, skTotal = Object.keys(sk).reduce(function (a, k) { return a + sk[k]; }, 0);
  var aspectDiff = Math.abs(wmm / hmm - 210 / 297) > 0.01;
  return {
    elements: els, bg: pageBg,
    stats: { count: els.length, skipped: sk, skippedTotal: skTotal, emf: st.emf, images: st.images, aspectDiff: aspectDiff, scale: S, size: { w: wmm, h: hmm }, dropped: dropped, notes: st.notes }
  };
}

async function slideTexts(pkg, i) {
  var r = await convertSlide(pkg, i, { skipMedia: true }), m = {};
  r.elements.forEach(function (e) { if (e.type === 'text') m[e.id] = e.text; });
  return m;
}

g.PptxImport = { open: open, convertSlide: convertSlide, slideTexts: slideTexts, placeholderSvg: placeholderSvg, EMF_MSG: EMF_MSG };
})(window);
