/* ネイビー・エグゼクティブ：紙端までの紺の帯＋ゴールドの細線。ホテルの招待状のような格式 */
(function () {
'use strict';
var FONT_HREF = 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@500;700&family=Noto+Sans+JP:wght@400;500;700&display=swap';
var FONT_LOAD = ['500 14px "Noto Serif JP"', '700 14px "Noto Serif JP"', '400 10px "Noto Sans JP"', '500 10px "Noto Sans JP"', '700 10px "Noto Sans JP"'];
var SERIF = '"Noto Serif JP","Yu Mincho","Hiragino Mincho ProN","MS PMincho",serif';
var SANS = '"Noto Sans JP","Yu Gothic","Hiragino Sans",Meiryo,sans-serif';
var fontP = null;
function loadFonts() {
  if (fontP) return fontP;
  fontP = new Promise(function (res) {
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONT_HREF; l.setAttribute('data-jt-font', 'navy-exec');
    l.onload = function () { res(); }; l.onerror = function () { res(); }; document.head.appendChild(l);
  }).then(function () {
    return Promise.all(FONT_LOAD.map(function (s) { return document.fonts.load(s, 'あア永Aa0'); }));
  }).catch(function () {});
  return fontP;
}
/* Webフォントが届いたら字幅が変わるので、縮小対象を測り直す */
function refit(t, C) {
  function go() { (t._fits || []).forEach(function (e) { e.style.fontSize = e._fs0 || ''; C.fit(e, e._fitMin); }); }
  loadFonts().then(function () { go(); return document.fonts.ready; }).then(go);
}
function setFs(e, pt) { e.style.fontSize = pt + 'pt'; e._fs0 = e.style.fontSize; return e; }
function noteFs(list, w, h, max, min, lh, gap) {
  for (var fs = max; fs >= min; fs -= 0.25) {
    var cpl = Math.max(4, Math.floor(w / (fs * 0.3528))), n = 0;
    list.forEach(function (x) { n += Math.max(1, Math.ceil(x.text.length / cpl)); });
    if (n * fs * 0.3528 * lh + (list.length - 1) * gap <= h) return fs;
  }
  return min;
}
loadFonts();

var VSZ = { S: 10.5, M: 12.5, L: 14.5, XL: 17 }, SSZ = { S: 9.5, M: 11, L: 12.5, XL: 14 }, NSZ = { S: 26, M: 30, L: 34, XL: 38 };
var MIN_H = 10.5, GAP = 2.2;

JukenTemplates.register({
  id: 'navy-exec',
  name: 'ネイビー・エグゼクティブ',
  category: 'シック',
  description: '紙端まで広がる紺の帯とゴールドの細線。受験番号を枠で見せる、格式ある一枚。',
  swatch: ['#14213D', '#B8975A', '#F4F5F7', '#ffffff'],
  defaults: { accent: '#14213D', secondary: '#B8975A', font: 'gothic', hdr: '2024年度　早稲田大学受験票', wmOp: 7, wmAcc: true, wmBold: true, wmSize: 30, wmSp: 0.5, foldOn: true },
  uses: ['header', 'badge', 'mark', 'accent', 'secondary', 'font', 'fold', 'notes', 'swap', 'images', 'wm'],
  render: function (st, V, C) {
    var t = C.page('navy-exec', V, (V.swap ? 'sw ' : '') + (V.font === 'mincho' ? 'mi' : ''));
    t.style.fontFamily = C.pickFont(V, SANS, SERIF);

    /* ---- 紺の帯 ---- */
    var band = C.el('div', 'n-band'); t.appendChild(band);
    var bl = C.el('div', 'n-bl');
    if (V.badgeOn && V.badge) bl.appendChild(C.edit(C.el('div', 'n-badge', V.badge), 'badge'));
    var ti = C.edit(C.el('div', 'n-t', V.hdr), 'hdr'); C.fitText(t, ti, 10); bl.appendChild(ti);
    band.appendChild(bl);
    var br = C.el('div', 'n-br');
    if (V.markOn && V.mark) br.appendChild(C.edit(C.el('div', 'n-mark', V.mark), 'mark'));
    br.appendChild(C.el('div', 'n-en', 'ADMISSION TICKET'));
    br.appendChild(C.el('div', 'n-jp', '受験票'));
    band.appendChild(br);

    /* ---- 受験番号・氏名（ヒーロー） ---- */
    var vis = C.visible(V);
    var numIt = vis.filter(function (i) { return /受験番号/.test(i.label) && i.source !== 'schedule'; })[0] || null;
    var nameIts = vis.filter(function (i) { return /氏名|名前/.test(i.label) && i.source !== 'schedule' && i !== numIt; });
    var kanaIt = nameIts.filter(function (i) { return /カナ|ｶﾅ|フリガナ|ふりがな/.test(i.label); })[0] || null;
    var mainIt = nameIts.filter(function (i) { return i !== kanaIt; })[0] || null;
    var heroNum = numIt, heroMain = mainIt || kanaIt, heroKana = mainIt && kanaIt ? kanaIt : null;
    var heroUsed = [heroNum, heroMain, heroKana].filter(Boolean);
    var hero = C.el('div', 'n-hero'); t.appendChild(hero);
    var HERO_TOP = 50, HERO_H = 22;
    if (heroNum) {
      var nb = C.item(C.el('div', 'n-num'), heroNum);
      nb.appendChild(C.el('div', 'n-l', heroNum.label));
      var nv = C.itemEdit(C.el('div', 'n-nv', C.value(heroNum, st)), heroNum); setFs(nv, NSZ[heroNum.size]); C.fitText(t, nv, 14); nb.appendChild(nv);
      hero.appendChild(nb);
    }
    if (heroMain) {
      var nm = C.item(C.el('div', 'n-name'), heroMain);
      nm.appendChild(C.el('div', 'n-l', heroKana || !mainIt ? '氏名' : heroMain.label));
      if (heroKana) { var kv = C.itemEdit(C.el('div', 'n-kana', C.value(heroKana, st)), heroKana); C.fitText(t, kv, 6); nm.appendChild(kv); }
      var mv = C.itemEdit(C.el('div', 'n-nmv' + (heroMain.color === 'accent' ? ' ac' : ''), C.value(heroMain, st)), heroMain); setFs(mv, heroKana || mainIt ? 22 : 17); C.fitText(t, mv, 9); nm.appendChild(mv);
      hero.appendChild(nm);
    }
    if (!heroUsed.length) HERO_H = 0;
    if (!heroNum) hero.className += ' no-num';

    /* ---- カードのグリッド ---- */
    var rest = vis.filter(function (i) { return heroUsed.indexOf(i) < 0; }), rows = [], q = 0;
    while (q < rest.length) {
      var a = rest[q], b = rest[q + 1];
      if (a.width === 'half' && b && b.width === 'half') { rows.push([a, b]); q += 2; } else { rows.push([a]); q++; }
    }
    var GTOP = HERO_TOP + (HERO_H ? HERO_H + 5 : 0) - 0;
    if (!HERO_H) GTOP = 52;
    var avail = Math.max(36, (V.foldOn ? V.foldPos - 6 : 165) - GTOP);
    function horiz(it, sc) {
      if (it.width === 'half' || it.source !== 'schedule') return false;
      var fs = SSZ[it.size] * sc * 0.3528, rs = C.sched(it), n = rs.length;
      if (n < 1 || n > 4) return false;
      var w = 0; rs.forEach(function (r) { w += 13 * fs * 0.6 + 3 + Math.max(2, r.c.length) * fs * 1.15 + 6; });
      return w <= 140;
    }
    function cardH(it, sc) {
      if (it.source === 'schedule') {
        var n = Math.max(1, C.sched(it).length), fs = SSZ[it.size] * sc * 0.3528;
        return Math.max(MIN_H, (horiz(it, sc) ? 1 : n) * fs * 1.55 + 5.5);
      }
      return Math.max(MIN_H, VSZ[it.size] * sc * 0.3528 * 1.4 + 5.5);
    }
    function rowH(r, sc) { return Math.max.apply(null, r.map(function (i) { return cardH(i, sc); })); }
    function rowMin(r, sc) { return Math.max(8, rowH(r, sc) - 3.5); }
    function total(sc) { var s = 0; rows.forEach(function (r) { s += rowH(r, sc); }); return s + Math.max(0, rows.length - 1) * GAP; }
    function minTotal(sc) { var s = 0; rows.forEach(function (r) { s += rowMin(r, sc); }); return s + Math.max(0, rows.length - 1) * GAP * 0.6; }
    var sc = 1; while (sc > 0.5 && minTotal(sc) > avail) sc -= 0.02;
    var sumR = 0, sumM = 0; rows.forEach(function (r) { sumR += rowH(r, sc); sumM += rowMin(r, sc); });
    var gapN = Math.max(0, rows.length - 1), kk = sumR + gapN * GAP > avail ? Math.max(0, Math.min(1, (avail - gapN * GAP * 0.6 - sumM) / Math.max(0.1, sumR - sumM))) : 1;
    var gp = kk < 1 ? GAP * 0.6 : GAP;
    var grid = C.el('div', 'n-grid'); grid.style.top = GTOP + 'mm'; grid.style.rowGap = gp + 'mm';
    var used = 0;
    rows.forEach(function (r) {
      var h = rowMin(r, sc) + (rowH(r, sc) - rowMin(r, sc)) * kk; used += h + gp;
      r.forEach(function (it) {
        var half = r.length > 1, c = C.item(C.el('div', 'n-c' + (half ? ' h' : '')), it);
        c.style.height = h + 'mm';
        c.appendChild(C.el('span', 'n-cl', it.label));
        var v = C.el('div', 'n-cv');
        if (it.source === 'schedule') {
          var hz = horiz(it, sc), fs = SSZ[it.size] * sc; v.className += ' sch' + (hz ? ' hz' : ''); v.style.fontSize = fs + 'pt';
          C.sched(it).forEach(function (x) {
            var d = C.el('div', 'se'); d.appendChild(C.el('i', null, x.t)); d.appendChild(C.el('b', null, x.c)); v.appendChild(d);
          });
        } else {
          C.itemEdit(v, it); v.textContent = C.value(it, st); setFs(v, VSZ[it.size] * sc);
          if (it.color === 'accent') v.className += ' ac';
          if (it.align === 'center') v.className += ' al-c';
          C.fitText(t, v, 7);
        }
        c.appendChild(v);
        if (!half) c.style.gridColumn = '1 / -1';
        grid.appendChild(c);
      });
    });
    used = Math.max(0, used - gp);
    var wm = C.watermark(V, { top: GTOP, height: used }); if (wm) t.appendChild(wm);
    t.appendChild(grid);
    var fo = C.fold(V); if (fo) t.appendChild(fo);

    /* ---- 下半分 ---- */
    var L = V.foldOn ? Math.max(V.foldPos + 8, GTOP + used + 5) : GTOP + used + 10;
    var im = C.images(V), hasIm = !!(im.map || im.logo), notes = C.notes(V);
    var lo = C.el('div', 'n-lo' + (hasIm ? '' : ' nm')); lo.style.top = L + 'mm';
    var lh = 297 - 15 - L, nc = C.el('div', 'n-nc');
    if (V.noteTitle) nc.appendChild(C.edit(C.el('div', 'n-nh', V.noteTitle), 'noteTitle'));
    var nbx = C.el('div', 'n-nb'), nw = hasIm ? 104 : 82, nh = (lh - (V.noteTitle ? 8 : 0)) * (hasIm ? 1 : 1.9);
    var nfs = noteFs(notes, nw - 5, nh, 9.5, 6.8, 1.6, 1.3);
    nbx.style.fontSize = nfs + 'pt'; nbx.style.setProperty('--ng', (nfs >= 9 ? 1.4 : 0.7) + 'mm');
    notes.forEach(function (n) {
      var d = C.el('div', 'n-n' + (n.accent ? ' r' : '')); d.appendChild(C.el('span', null, n.text)); nbx.appendChild(d);
    });
    nc.appendChild(nbx); lo.appendChild(nc);
    if (hasIm) {
      var ic = C.el('div', 'n-im'); ic.style.setProperty('--mh', Math.max(20, lh - (im.logo ? 17 : 0)) + 'mm');
      if (im.map) { var mp = C.el('div', 'n-map'), i1 = C.el('img'); i1.src = im.map; i1.alt = ''; mp.appendChild(i1); ic.appendChild(mp); }
      if (im.logo) { var lg = C.el('div', 'n-logo'), i2 = C.el('img'); i2.src = im.logo; i2.alt = ''; lg.appendChild(i2); ic.appendChild(lg); }
      lo.appendChild(ic);
    }
    t.appendChild(lo);
    refit(t, C);
    return t;
  },
  styles: [
    '.tpl-navy-exec{display:block;padding:0;color:#1d2433;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.tpl-navy-exec .n-band{position:absolute;left:0;top:0;width:210mm;height:42mm;background:var(--tac);border-bottom:.9pt solid var(--tac2);padding:0 18mm;display:flex;align-items:flex-end;justify-content:space-between;gap:8mm;padding-bottom:9mm}',
    '.tpl-navy-exec .n-bl{flex:1 1 0;min-width:0}',
    '.tpl-navy-exec .n-badge{font-family:' + SANS + ';font-size:7.5pt;letter-spacing:.2em;line-height:1;color:rgba(255,255,255,.6);margin-bottom:3.4mm;white-space:nowrap}',
    '.tpl-navy-exec .n-t{font-family:' + SERIF + ';font-weight:500;font-size:24pt;line-height:12mm;letter-spacing:.06em;color:#fff;white-space:nowrap;overflow:hidden}',
    '.tpl-navy-exec .n-br{flex:none;text-align:right;color:var(--tac2);display:flex;flex-direction:column;align-items:flex-end}',
    '.tpl-navy-exec .n-mark{font-family:' + SANS + ';font-size:8.5pt;font-weight:700;letter-spacing:.12em;line-height:1;border:.6pt solid var(--tac2);padding:1.4mm 2.4mm 1.4mm 3mm;margin-bottom:4mm;white-space:nowrap}',
    '.tpl-navy-exec .n-en{font-family:' + SANS + ';font-size:7.5pt;font-weight:500;letter-spacing:.25em;margin-right:-.25em;line-height:1;white-space:nowrap}',
    '.tpl-navy-exec .n-jp{font-family:' + SERIF + ';font-size:16pt;font-weight:500;letter-spacing:.3em;margin-right:-.3em;line-height:1;margin-top:2mm;white-space:nowrap}',
    '.tpl-navy-exec .n-hero{position:absolute;left:18mm;top:50mm;width:174mm;height:22mm;display:flex;align-items:stretch;gap:8mm;z-index:1}',
    '.tpl-navy-exec .n-num{flex:none;width:68mm;border:.8pt solid var(--tac2);padding:2.6mm 5mm 0;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;padding-bottom:2mm}',
    '.tpl-navy-exec .n-l{font-family:' + SANS + ';font-size:7pt;font-weight:500;letter-spacing:.2em;color:var(--tac2);line-height:1;white-space:nowrap}',
    '.tpl-navy-exec .n-nv{color:var(--tac);font-family:' + SERIF + ';font-weight:700;letter-spacing:.05em;font-variant-numeric:tabular-nums;line-height:1.15;white-space:nowrap;overflow:hidden}',
    '.tpl-navy-exec .n-name{flex:1 1 0;min-width:0;display:flex;flex-direction:column;justify-content:space-between;padding:2.6mm 0 2mm}',
    '.tpl-navy-exec .n-kana{font-size:9pt;letter-spacing:.18em;color:#5a6270;line-height:1.2;white-space:nowrap;overflow:hidden}',
    '.tpl-navy-exec .n-nmv{font-family:' + SERIF + ';font-weight:700;letter-spacing:.12em;color:var(--tac);line-height:1.2;white-space:nowrap;overflow:hidden}',
    '.tpl-navy-exec .n-grid{position:absolute;left:18mm;width:174mm;display:grid;grid-template-columns:1fr 1fr;column-gap:2.2mm;z-index:1}',
    '.tpl-navy-exec .n-c{min-width:0;background:#F4F5F7;border-radius:1mm;display:flex;align-items:center;padding:0 4.5mm;gap:4mm}',
    '.tpl-navy-exec .n-cl{flex:none;width:17mm;overflow:hidden;font-size:7.5pt;font-weight:500;letter-spacing:.14em;color:var(--tac2);white-space:nowrap}',
    '.tpl-navy-exec .n-c.h .n-cl{letter-spacing:.1em}',
    '.tpl-navy-exec .n-cv{flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;font-weight:500;letter-spacing:.05em;line-height:1.4;font-variant-numeric:tabular-nums;color:#1d2433}',
    '.tpl-navy-exec.mi .n-cv{font-family:' + SERIF + '}',
    '.tpl-navy-exec .n-cv.ac{color:var(--tac);font-weight:700}',
    '.tpl-navy-exec .n-cv.al-c{text-align:center}',
    '.tpl-navy-exec .n-cv.sch{line-height:1.55}',
    '.tpl-navy-exec .n-cv.sch .se{white-space:nowrap}',
    '.tpl-navy-exec .n-cv.sch i{font-style:normal;letter-spacing:.06em;font-variant-numeric:tabular-nums}',
    '.tpl-navy-exec .n-cv.sch b{font-weight:500;margin-left:.9em;letter-spacing:.14em}',
    '.tpl-navy-exec .n-cv.sch.hz{display:flex;gap:7mm;align-items:center}',
    '.tpl-navy-exec .jt-wm{z-index:2;font-family:' + SERIF + '}',
    '.tpl-navy-exec .jt-fold{left:0;width:210mm;gap:4mm;font-family:' + SANS + ';font-size:6.5pt;font-weight:400;letter-spacing:.3em;color:#8a909b;z-index:1}',
    '.tpl-navy-exec .jt-fold span{border-top:.4pt dashed #8a909b}',
    '.tpl-navy-exec .n-lo{position:absolute;left:18mm;width:174mm;bottom:15mm;display:flex;gap:11mm;z-index:1}',
    '.tpl-navy-exec.sw .n-lo{flex-direction:row-reverse}',
    '.tpl-navy-exec .n-nc{flex:1 1 0;min-width:0;max-width:104mm}',
    '.tpl-navy-exec .n-lo.nm .n-nc{max-width:none}',
    '.tpl-navy-exec .n-nh{font-size:8pt;font-weight:700;letter-spacing:.22em;color:var(--tac);line-height:1;margin-bottom:4mm}',
    '.tpl-navy-exec .n-lo.nm .n-nb{column-count:2;column-gap:10mm}',
    '.tpl-navy-exec .n-n{position:relative;padding-left:4mm;line-height:1.6;margin-bottom:var(--ng,1.4mm);break-inside:avoid;line-break:strict;text-wrap:pretty;text-align:justify;color:#2a3140}',
    '.tpl-navy-exec .n-n:before{content:"";position:absolute;left:.3mm;top:.62em;width:1.3mm;height:1.3mm;background:var(--tac2);transform:rotate(45deg)}',
    '.tpl-navy-exec .n-n.r{font-weight:700;color:var(--tac)}.tpl-navy-exec .n-n.r:before{background:var(--tac)}',
    '.tpl-navy-exec .n-im{flex:none;width:59mm;display:flex;flex-direction:column;gap:4mm;min-height:0;align-items:flex-end}',
    '.tpl-navy-exec .n-map{flex:0 1 auto;min-height:0;display:flex;align-items:flex-start;width:100%}',
    '.tpl-navy-exec .n-map img{display:block;max-width:100%;max-height:var(--mh,100mm);object-fit:contain;border:.5pt solid #c9ccd3;background:#fff}',
    '.tpl-navy-exec .n-logo{flex:none;height:12mm;display:flex;align-items:center;justify-content:flex-end;width:100%}',
    '.tpl-navy-exec .n-logo img{max-height:100%;max-width:100%;object-fit:contain}'
  ].join('\n')
});
})();
