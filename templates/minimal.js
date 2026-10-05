/* ミニマル：罫線をほぼ使わない。ラベルと値の縦積みを、余白と整列だけで見せる */
(function () {
'use strict';
var FONT_HREF = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=Noto+Sans+JP:wght@400;500&family=Noto+Serif+JP:wght@400;500&display=swap';
var FONT_LOAD = ['300 14px "Inter"', '500 14px "Inter"', '400 10px "Noto Sans JP"', '500 10px "Noto Sans JP"', '400 10px "Noto Serif JP"', '500 10px "Noto Serif JP"'];
var SANS = '"Inter","Noto Sans JP","Yu Gothic","Hiragino Sans",Meiryo,sans-serif';
var SERIF = '"Inter","Noto Serif JP","Yu Mincho","Hiragino Mincho ProN","MS PMincho",serif';
var fontP = null;
function loadFonts() {
  if (fontP) return fontP;
  fontP = new Promise(function (res) {
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONT_HREF; l.setAttribute('data-jt-font', 'minimal');
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

var NSZ = { S: 24, M: 30, L: 36, XL: 42 }, VSZ = { S: 11, M: 12.5, L: 14, XL: 16 }, SSZ = { S: 10.5, M: 12, L: 13, XL: 15 };
var X0 = 22, W = 166, COLG = 12, TOP = 46;

JukenTemplates.register({
  id: 'minimal',
  name: 'ミニマル',
  category: 'ベーシック',
  description: '罫線を使わず、余白と整列だけで見せる。右上に大きな受験番号。折り線は既定でなし。',
  swatch: ['#111111', '#888888', '#ffffff'],
  defaults: { accent: '#111111', secondary: '#888888', font: 'gothic', hdr: '2024年度　早稲田大学受験票', wmOp: 6, wmAcc: false, wmColor: '#111111', wmBold: false, wmSize: 30, wmSp: 0.5, foldOn: false },
  uses: ['header', 'badge', 'mark', 'accent', 'secondary', 'font', 'fold', 'notes', 'swap', 'images', 'wm'],
  render: function (st, V, C) {
    var t = C.page('minimal', V, (V.swap ? 'sw ' : '') + (V.font === 'mincho' ? 'mi' : ''));
    t.style.fontFamily = V.font === 'mincho' ? SERIF : SANS;

    /* ---- 上部：見出し（左）と受験番号（右） ---- */
    var vis = C.visible(V);
    var numIt = vis.filter(function (i) { return /受験番号/.test(i.label) && i.source !== 'schedule'; })[0] || null;
    var hasMark = V.markOn && V.mark;
    var hd = C.el('div', 'm-hd'); hd.style.width = (numIt ? 96 : W) + 'mm';
    if (hasMark) hd.appendChild(C.edit(C.el('div', 'm-mark', V.mark), 'mark'));
    var ti = C.edit(C.el('div', 'm-t', V.hdr), 'hdr'); C.fitText(t, ti, 8); hd.appendChild(ti);
    if (V.badgeOn && V.badge) hd.appendChild(C.edit(C.el('div', 'm-badge', V.badge), 'badge'));
    t.appendChild(hd);
    if (numIt) {
      var nb = C.item(C.el('div', 'm-num'), numIt);
      nb.appendChild(C.el('div', 'm-l', numIt.label));
      var nv = C.itemEdit(C.el('div', 'm-nv' + (numIt.color === 'accent' ? ' ac' : ''), C.value(numIt, st)), numIt); setFs(nv, NSZ[numIt.size]); C.fitText(t, nv, 14);
      nb.appendChild(nv); t.appendChild(nb);
    }

    /* ---- 項目（縦積み） ---- */
    var rows = C.rows(V).map(function (r) { return r.filter(function (i) { return i !== numIt; }); }).filter(function (r) { return r.length; });
    var avail = Math.max(40, (V.foldOn ? V.foldPos - 8 : 163) - TOP);
    function cont(it, sc) {
      if (it.source === 'schedule') return 3.4 + 1.4 + Math.max(1, C.sched(it).length) * SSZ[it.size] * sc * 0.3528 * 1.5;
      return 3.4 + 1.4 + VSZ[it.size] * sc * 0.3528 * 1.4;
    }
    function rowC(r, sc) { return Math.max.apply(null, r.map(function (i) { return cont(i, sc); })); }
    function total(sc, gap) { var s = 0; rows.forEach(function (r) { s += rowC(r, sc); }); return s + Math.max(0, rows.length - 1) * gap; }
    var sc = 1, gap = 6;
    while (total(sc, gap) > avail && gap > 3.2) gap -= 0.2;
    while (total(sc, gap) > avail && sc > 0.55) sc -= 0.02;
    var col = (W - COLG) / 2;
    var list = C.el('div', 'm-list'); list.style.top = TOP + 'mm'; list.style.rowGap = gap + 'mm';
    var used = 0;
    rows.forEach(function (its) {
      var r = C.el('div', 'm-row'); r.style.height = rowC(its, sc) + 'mm'; used += rowC(its, sc) + gap;
      its.forEach(function (it, ci) {
        var c = C.item(C.el('div', 'm-c'), it);
        c.style.width = (its.length > 1 || it.width === 'half' ? col : W) + 'mm';
        c.appendChild(C.el('div', 'm-l', it.label));
        var v = C.el('div', 'm-v');
        if (it.source === 'schedule') {
          v.className += ' sch'; var fs = SSZ[it.size] * sc; v.style.fontSize = fs + 'pt';
          C.sched(it).forEach(function (x) {
            var d = C.el('div'), tm = C.el('span', 'tm', x.t); tm.style.minWidth = (13 * fs * 0.3528 * 0.58 + 3) + 'mm';
            d.appendChild(tm); d.appendChild(C.el('span', 'sj', x.c)); v.appendChild(d);
          });
        } else {
          C.itemEdit(v, it); v.textContent = C.value(it, st); setFs(v, VSZ[it.size] * sc);
          if (it.color === 'accent') v.className += ' ac';
          if (it.align === 'center') v.className += ' al-c';
          C.fitText(t, v, 7);
        }
        c.appendChild(v); r.appendChild(c);
      });
      list.appendChild(r);
    });
    used = Math.max(0, used - gap);
    var wm = C.watermark(V, { top: TOP, height: used }); if (wm) t.appendChild(wm);
    t.appendChild(list);
    var fo = C.fold(V); if (fo) t.appendChild(fo);

    /* ---- 下部 ---- */
    var L = V.foldOn ? Math.max(V.foldPos + 8, TOP + used + 6) : TOP + used + 12;
    if (!V.foldOn) { var ln = C.el('div', 'm-rule'); ln.style.top = (L - 6) + 'mm'; t.appendChild(ln); }
    var im = C.images(V), hasIm = !!(im.map || im.logo), notes = C.notes(V);
    var lo = C.el('div', 'm-lo' + (hasIm ? '' : ' nm')); lo.style.top = L + 'mm';
    var lh = 297 - 16 - L, nc = C.el('div', 'm-nc');
    if (V.noteTitle) nc.appendChild(C.edit(C.el('div', 'm-nh', V.noteTitle), 'noteTitle'));
    var nbx = C.el('div', 'm-nb'), nw = hasIm ? 104 : 80, nh = (lh - (V.noteTitle ? 7 : 0)) * (hasIm ? 1 : 1.9);
    var nfs = noteFs(notes, nw, nh, 9.5, 6.8, 1.75, 1.6);
    nbx.style.fontSize = nfs + 'pt'; nbx.style.setProperty('--ng', (nfs >= 9 ? 1.6 : 0.8) + 'mm');
    notes.forEach(function (n) {
      var d = C.el('div', 'm-n' + (n.accent ? ' r' : '')); d.textContent = n.text; nbx.appendChild(d);
    });
    nc.appendChild(nbx); lo.appendChild(nc);
    if (hasIm) {
      var ic = C.el('div', 'm-im'); ic.style.setProperty('--mh', Math.max(20, lh - (im.logo ? 17 : 0)) + 'mm');
      if (im.map) { var mp = C.el('div', 'm-map'), i1 = C.el('img'); i1.src = im.map; i1.alt = ''; mp.appendChild(i1); ic.appendChild(mp); }
      if (im.logo) { var lg = C.el('div', 'm-logo'), i2 = C.el('img'); i2.src = im.logo; i2.alt = ''; lg.appendChild(i2); ic.appendChild(lg); }
      lo.appendChild(ic);
    }
    t.appendChild(lo);
    refit(t, C);
    return t;
  },
  styles: [
    '.tpl-minimal{display:block;padding:0;color:#111;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.tpl-minimal .m-hd{position:absolute;left:22mm;top:18mm}',
    '.tpl-minimal .m-mark{font-size:7.5pt;font-weight:500;letter-spacing:.16em;color:var(--tac);line-height:1;margin-bottom:3mm;white-space:nowrap}',
    '.tpl-minimal .m-t{font-size:11pt;font-weight:500;letter-spacing:.08em;line-height:1.5;white-space:nowrap;overflow:hidden}',
    '.tpl-minimal .m-badge{margin-top:1.2mm;font-size:8pt;letter-spacing:.1em;color:var(--tac2);white-space:nowrap}',
    '.tpl-minimal .m-num{position:absolute;right:22mm;top:17mm;width:80mm;text-align:right}',
    '.tpl-minimal .m-num .m-l{text-align:right}',
    '.tpl-minimal .m-nv{margin-top:1.6mm;font-weight:300;letter-spacing:.01em;line-height:1.1;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;color:#111}',
    '.tpl-minimal .m-nv.ac{color:var(--tac)}',
    '.tpl-minimal .m-l{font-size:8pt;font-weight:400;letter-spacing:.12em;line-height:1.3;color:var(--tac2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.tpl-minimal .m-list{position:absolute;left:22mm;width:166mm;display:flex;flex-direction:column;z-index:1}',
    '.tpl-minimal .m-row{display:flex;gap:12mm;align-items:flex-start;overflow:hidden}',
    '.tpl-minimal .m-c{flex:none;min-width:0;overflow:hidden}',
    '.tpl-minimal .m-v{margin-top:1.4mm;font-weight:500;letter-spacing:.04em;line-height:1.4;white-space:nowrap;overflow:hidden;font-variant-numeric:tabular-nums;color:#111}',
    '.tpl-minimal .m-v.ac{color:var(--tac)}',
    '.tpl-minimal .m-v.al-c{text-align:center}',
    '.tpl-minimal .m-v.sch{line-height:1.5}.tpl-minimal .m-v.sch>div{white-space:nowrap}',
    '.tpl-minimal .m-v.sch .tm{display:inline-block;letter-spacing:.04em;font-variant-numeric:tabular-nums}',
    '.tpl-minimal .m-v.sch .sj{letter-spacing:.12em}',
    '.tpl-minimal .jt-wm{z-index:2;font-family:' + SANS + '}',
    '.tpl-minimal .jt-fold{left:0;width:210mm;gap:4mm;font-size:6.5pt;font-weight:400;letter-spacing:.3em;color:#999;z-index:1}',
    '.tpl-minimal .jt-fold span{border-top:.3pt dotted #888}',
    '.tpl-minimal .m-rule{position:absolute;left:22mm;width:166mm;height:0;border-top:.3pt solid #111}',
    '.tpl-minimal .m-lo{position:absolute;left:22mm;width:166mm;bottom:16mm;display:flex;gap:12mm;z-index:1}',
    '.tpl-minimal.sw .m-lo{flex-direction:row-reverse}',
    '.tpl-minimal .m-nc{flex:1 1 0;min-width:0;max-width:104mm}',
    '.tpl-minimal .m-lo.nm .m-nc{max-width:none}',
    '.tpl-minimal .m-nh{font-size:8pt;letter-spacing:.2em;color:var(--tac2);line-height:1;margin-bottom:4.5mm}',
    '.tpl-minimal .m-lo.nm .m-nb{column-count:2;column-gap:12mm}',
    '.tpl-minimal .m-n{line-height:1.75;margin-bottom:var(--ng,1.6mm);break-inside:avoid;line-break:strict;text-wrap:pretty;text-align:justify;color:#333}',
    '.tpl-minimal .m-n.r{color:var(--tac);font-weight:500}',
    '.tpl-minimal .m-im{flex:none;width:50mm;display:flex;flex-direction:column;gap:4mm;min-height:0}',
    '.tpl-minimal .m-map{flex:0 1 auto;min-height:0;display:flex;align-items:flex-start}',
    '.tpl-minimal .m-map img{display:block;max-width:100%;max-height:var(--mh,100mm);object-fit:contain}',
    '.tpl-minimal .m-logo{flex:none;height:11mm;display:flex;align-items:center}',
    '.tpl-minimal .m-logo img{max-height:100%;max-width:100%;object-fit:contain}'
  ].join('\n')
});
})();
