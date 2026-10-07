/* 「元の文字に合わせる」：取り込んだデザインの元の文字（画像の一部）と、書体一覧の各書体で同じ文字を描いたものを比べて、近い順に並べる。window.FontMatch
   - 元の文字の画像（canvas の一部）を「文字の部分（インク）」だけに切り出し、一定の大きさに正規化して比べる
   - 比べ方：同じ文字列を各書体で描き、同じ正規化をして画素の差を平均（細め・太めの2種類を試す）
   - 書体は使うときだけ読み込む（JukenFonts.use ＋ document.fonts.load） */
(function (g) {
'use strict';
var GW = 192, GH = 40;

/* canvas の矩形 r={x,y,w,h}（px）→ インク（背景と違う画素）の濃さ配列 GW×GH と縦横比。インクが無ければ null */
function inkGrid(src, r) {
  var sx = Math.max(0, Math.floor(r.x)), sy = Math.max(0, Math.floor(r.y)), sw = Math.max(2, Math.min(src.width - sx, Math.ceil(r.w))), sh = Math.max(2, Math.min(src.height - sy, Math.ceil(r.h)));
  var c = document.createElement('canvas'); c.width = sw; c.height = sh; var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  var d = x.getImageData(0, 0, sw, sh).data, i, j, br = 0, bg = 0, bb = 0, n = 0;
  for (i = 0; i < sw; i++) for (j = 0; j < sh; j++) { if (i < 2 || j < 2 || i >= sw - 2 || j >= sh - 2) { var k = (j * sw + i) * 4; br += d[k]; bg += d[k + 1]; bb += d[k + 2]; n++; } }
  br /= n; bg /= n; bb /= n;
  var ink = new Float32Array(sw * sh), x0 = sw, x1 = -1, y0 = sh, y1 = -1, p;
  for (j = 0; j < sh; j++) for (i = 0; i < sw; i++) {
    p = (j * sw + i) * 4; var dist = Math.abs(d[p] - br) + Math.abs(d[p + 1] - bg) + Math.abs(d[p + 2] - bb), v = Math.max(0, Math.min(1, (dist - 60) / 200));
    ink[j * sw + i] = v; if (v > 0.5) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
  }
  if (x1 < 0) return null;
  return norm(ink, sw, sh, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}
/* インク配列の外接矩形を GW×GH に伸縮（縦横比は別に保持） */
function norm(ink, sw, sh, x0, y0, w, h) {
  var c = document.createElement('canvas'); c.width = sw; c.height = sh; var x = c.getContext('2d'), im = x.createImageData(sw, sh), i;
  for (i = 0; i < sw * sh; i++) { var v = 255 - Math.round(ink[i] * 255); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
  x.putImageData(im, 0, 0);
  var o = document.createElement('canvas'); o.width = GW; o.height = GH; var ox = o.getContext('2d', { willReadFrequently: true }); ox.fillStyle = '#fff'; ox.fillRect(0, 0, GW, GH); ox.imageSmoothingEnabled = true; ox.imageSmoothingQuality = 'high';
  ox.drawImage(c, x0, y0, w, h, 0, 0, GW, GH);
  var d = ox.getImageData(0, 0, GW, GH).data, a = new Float32Array(GW * GH);
  for (i = 0; i < GW * GH; i++) a[i] = 1 - d[i * 4] / 255;
  return { a: a, ratio: w / h };
}
/* 書体 css・太さ・文字列を描いて同じ形式にする */
function renderGrid(css, weight, text) {
  var H = 120, c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true });
  x.font = weight + ' ' + H + 'px ' + css; var w = Math.ceil(x.measureText(text).width) + 40; if (w > 4000) return null;
  c.width = w; c.height = Math.round(H * 1.7); x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#000'; x.textBaseline = 'alphabetic'; x.font = weight + ' ' + H + 'px ' + css; x.fillText(text, 20, H * 1.2);
  return inkGrid(c, { x: 0, y: 0, w: c.width, h: c.height });
}
function diff(a, b) {
  var s = 0, n = GW * GH, i; for (i = 0; i < n; i++) s += Math.abs(a.a[i] - b.a[i]);
  var rp = Math.abs(Math.log(a.ratio / b.ratio));
  return s / n * 4 + rp * 0.6;
}

/* 候補（日本語が描ける書体）のうち、文字列が全部描ける・読み込める書体だけで順位づけ。
   o: {ids:[...], onProgress(i,n), weights:[400,700], cancelled()}。戻り値 Promise<[{id, weight, score}]>（近い順・最大8件） */
function rank(src, rect, text, o) {
  o = o || {}; var JF = g.JukenFonts, tx = String(text || '').replace(/\s+/g, ' ').trim();
  if (!JF || !tx) return Promise.resolve([]);
  var target = inkGrid(src, rect); if (!target) return Promise.resolve([]);
  var ids = o.ids || JF.list().filter(function (f) { return f.kind !== 'std' && f.cat !== '英字' && (f.kind === 'gf' || JF.has(f.id)); }).map(function (f) { return f.id; });
  var ws = o.weights || [400, 700], out = [], i = 0;
  return new Promise(function (done) {
    (function next() {
      if (i >= ids.length || (o.cancelled && o.cancelled())) { out.sort(function (a, b) { return a.score - b.score; }); done(out.slice(0, 8)); return; }
      var id = ids[i++], f = JF.get(id); if (o.onProgress) o.onProgress(i, ids.length);
      Promise.resolve(JF.use(id)).then(function () {
        return Promise.all(ws.map(function (w) { return document.fonts.load(w + ' 40px ' + JF.css(id), tx).catch(function () { }); }));
      }).then(function () {
        if (g.JukenCheck) { g.JukenCheck.resetMemo(); }
        var tested = {};
        ws.forEach(function (w) {
          var sw = JF.snap(id, w); if (tested[sw]) return; tested[sw] = 1;
          var fam = f.family; if (g.JukenCheck && g.JukenCheck.isProbeOK() && !Array.from(tx).every(function (ch) { return /\s/.test(ch) || g.JukenCheck.hasGlyph(fam, ch, sw, ''); })) return;   /* 字形が無い書体は除く */
          var gr = renderGrid(JF.css(id), sw, tx); if (gr) out.push({ id: id, weight: sw, score: diff(target, gr) });
        });
      }).catch(function () { }).then(function () { setTimeout(next, 0); });
    })();
  });
}
/* PDFの書体名（ABCDEF+MS-Gothic-Bold など）→ {id, weight}。分からなければ null */
function fromPdfName(raw) {
  var JF = g.JukenFonts; if (!JF || !raw) return null;
  var n = String(raw).replace(/^[A-Z]{6}\+/, '').replace(/[-_,]/g, ' ').trim(); if (!n || /^(g_d|f\d|font|type)/i.test(n)) return null;
  var w = /black|heavy|ultra|extrabold|ub\b/i.test(n) ? 900 : /bold|demi|semibold|\bb\b|太/i.test(n) ? 700 : /light|thin|\bl\b|細/i.test(n) ? 300 : 400;
  var id = JF.fromName(n.replace(/\b(bold|regular|medium|light|black|italic|oblique|roman|mt|ps|std|pro|pr6n?)\b/gi, ' ').replace(/\s+/g, ' '));
  return { id: id, weight: JF.snap(id, w), name: String(raw).replace(/^[A-Z]{6}\+/, '') };
}
g.FontMatch = { rank: rank, fromPdfName: fromPdfName, inkGrid: inkGrid };
})(window);
