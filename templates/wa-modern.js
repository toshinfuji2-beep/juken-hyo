/* 和モダン：縦書きの題字「受験票」、市松の細い帯、朱の淡いラベル欄の表 */
(function () {
'use strict';
var FONT_HREF = 'https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@400;700;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap';
var FONT_LOAD = ['800 14px "Shippori Mincho B1"', '700 14px "Shippori Mincho B1"', '400 10px "Zen Kaku Gothic New"', '500 10px "Zen Kaku Gothic New"', '700 10px "Zen Kaku Gothic New"'];
var SERIF = '"Shippori Mincho B1","Yu Mincho","Hiragino Mincho ProN","MS PMincho",serif';
var SANS = '"Zen Kaku Gothic New","Yu Gothic","Hiragino Sans",Meiryo,sans-serif';
var fontP = null;
function loadFonts() {
  if (fontP) return fontP;
  fontP = new Promise(function (res) {
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONT_HREF; l.setAttribute('data-jt-font', 'wa-modern');
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

var NUMSZ = { S: 20, M: 24, L: 30, XL: 34 }, VSZ = { S: 10.5, M: 12.5, L: 14.5, XL: 17.5 }, SSZ = { S: 9.5, M: 11, L: 12.5, XL: 14 };
var TOP = 30, TW = 148;

JukenTemplates.register({
  id: 'wa-modern',
  name: '和モダン',
  category: '和',
  description: '縦書きの題字と市松の帯。朱の淡いラベル欄、墨の細罫。伝統と現代のあいだ。',
  swatch: ['#B7282E', '#222222', '#A67C2E', '#ffffff'],
  defaults: { accent: '#B7282E', secondary: '#A67C2E', font: 'gothic', hdr: '2024年度　早稲田大学受験票', wmOp: 8, wmAcc: false, wmColor: '#222222', wmBold: true, wmSize: 30, wmSp: 0.5, foldOn: true },
  uses: ['header', 'badge', 'mark', 'accent', 'secondary', 'font', 'fold', 'notes', 'swap', 'images', 'wm'],
  render: function (st, V, C) {
    var t = C.page('wa-modern', V, (V.swap ? 'sw ' : '') + (V.font === 'mincho' ? 'mi' : ''));
    t.style.fontFamily = V.font === 'mincho' ? SERIF : SANS;

    t.appendChild(C.el('div', 'w-check'));
    /* ---- 縦書きの題字 ---- */
    t.appendChild(C.el('div', 'w-vline'));
    t.appendChild(C.el('div', 'w-vt', '受験票'));
    if (V.markOn && V.mark) {
      var mk = C.edit(C.el('div', 'w-mark', V.mark), 'mark');
      mk.style.fontSize = Math.max(7, Math.min(12, 22 / Math.max(2, Array.from(V.mark).length) * 1.2)) + 'pt';
      t.appendChild(mk);
    }
    /* ---- 見出し行 ---- */
    var hd = C.el('div', 'w-hd'); hd.style.width = TW + 'mm';
    var ti = C.edit(C.el('div', 'w-t', V.hdr), 'hdr'); C.fitText(t, ti, 9); hd.appendChild(ti);
    if (V.badgeOn && V.badge) hd.appendChild(C.edit(C.el('div', 'w-badge', V.badge), 'badge'));
    t.appendChild(hd);

    /* ---- 表 ---- */
    var rows = C.rows(V);
    var avail = Math.max(40, (V.foldOn ? V.foldPos - 7 : 163) - TOP);
    function fsOf(it, sc) { return (/受験番号/.test(it.label) ? NUMSZ : VSZ)[it.size] * sc; }
    function cont(it, sc) {
      if (it.source === 'schedule') return Math.max(1, C.sched(it).length) * SSZ[it.size] * sc * 0.3528 * 1.6;
      return fsOf(it, sc) * 0.3528 * 1.3;
    }
    function rowC(r, sc) { return Math.max.apply(null, r.map(function (i) { return cont(i, sc); })); }
    function rowH(r, sc) { return Math.max(11.5, rowC(r, sc) + 6.5); }
    function rowMin(r, sc) { return Math.max(8.5, rowC(r, sc) + 3); }
    function minTotal(sc) { var s = 0; rows.forEach(function (r) { s += rowMin(r, sc); }); return s; }
    var sc = 1; while (sc > 0.5 && minTotal(sc) > avail) sc -= 0.02;
    var sumR = 0, sumM = 0; rows.forEach(function (r) { sumR += rowH(r, sc); sumM += rowMin(r, sc); });
    var kk = sumR > avail ? Math.max(0, (avail - sumM) / Math.max(0.1, sumR - sumM)) : 1;
    var tb = C.el('div', 'w-tbl'), used = 0;
    rows.forEach(function (its) {
      var h = rowMin(its, sc) + (rowH(its, sc) - rowMin(its, sc)) * kk, r = C.el('div', 'w-row'); r.style.height = h + 'mm'; used += h;
      its.forEach(function (it) {
        var c = C.item(C.el('div', 'w-c' + (its.length > 1 ? ' h' : '')), it);
        c.appendChild(C.el('div', 'w-l', it.label));
        var v = C.el('div', 'w-v');
        if (it.source === 'schedule') {
          v.className += ' sch'; var fs = SSZ[it.size] * sc; v.style.fontSize = fs + 'pt';
          C.sched(it).forEach(function (x) {
            var d = C.el('div'), tm = C.el('span', 'tm', x.t); tm.style.minWidth = (13 * fs * 0.3528 * 0.6 + 2) + 'mm';
            d.appendChild(tm); d.appendChild(C.el('span', 'sj', x.c)); v.appendChild(d);
          });
        } else {
          C.itemEdit(v, it); v.textContent = C.value(it, st); setFs(v, fsOf(it, sc));
          if (/受験番号/.test(it.label)) v.className += ' num';
          if (it.color === 'accent') v.className += ' ac';
          if (it.align === 'center') v.className += ' al-c';
          C.fitText(t, v, 7);
        }
        c.appendChild(v); r.appendChild(c);
      });
      tb.appendChild(r);
    });
    var wm = C.watermark(V, { top: TOP, height: used }); if (wm) t.appendChild(wm);
    t.appendChild(tb);
    var fo = C.fold(V); if (fo) t.appendChild(fo);

    /* ---- 下半分 ---- */
    var L = V.foldOn ? Math.max(V.foldPos + 7, TOP + used + 4) : TOP + used + 11;
    var im = C.images(V), hasIm = !!(im.map || im.logo), notes = C.notes(V);
    var lo = C.el('div', 'w-lo' + (hasIm ? '' : ' nm')); lo.style.top = L + 'mm';
    var lh = 297 - 15 - L, nc = C.el('div', 'w-nc');
    if (V.noteTitle) nc.appendChild(C.edit(C.el('div', 'w-nh', V.noteTitle), 'noteTitle'));
    var nb = C.el('div', 'w-nb'), nw = hasIm ? 104 : 82, nh = (lh - (V.noteTitle ? 8 : 0)) * (hasIm ? 1 : 1.9);
    var nfs = noteFs(notes, nw - 6, nh, 9.5, 6.8, 1.7, 1.2);
    nb.style.fontSize = nfs + 'pt'; nb.style.setProperty('--ng', (nfs >= 9 ? 1.2 : 0.6) + 'mm');
    notes.forEach(function (n, i) {
      var d = C.el('div', 'w-n' + (n.accent ? ' r' : '')); d.appendChild(C.el('b', null, String(i + 1)));
      d.appendChild(C.el('span', null, n.text)); nb.appendChild(d);
    });
    nc.appendChild(nb); lo.appendChild(nc);
    if (hasIm) {
      var ic = C.el('div', 'w-im'); ic.style.setProperty('--mh', Math.max(20, lh - (im.logo ? 17 : 0)) + 'mm');
      if (im.map) { var mp = C.el('div', 'w-map'), i1 = C.el('img'); i1.src = im.map; i1.alt = ''; mp.appendChild(i1); ic.appendChild(mp); }
      if (im.logo) { var lg = C.el('div', 'w-logo'), i2 = C.el('img'); i2.src = im.logo; i2.alt = ''; lg.appendChild(i2); ic.appendChild(lg); }
      lo.appendChild(ic);
    }
    t.appendChild(lo);
    refit(t, C);
    return t;
  },
  styles: [
    '.tpl-wa-modern{display:block;padding:0;color:#222;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.tpl-wa-modern .w-check{position:absolute;left:0;top:0;width:210mm;height:5mm;background:repeating-conic-gradient(var(--tac) 0% 25%,#fff 0% 50%) 0 0/5mm 5mm}',
    '.tpl-wa-modern .w-vline{position:absolute;left:171.5mm;top:14mm;width:0;height:50mm;border-left:.8pt solid var(--tac)}',
    '.tpl-wa-modern .w-vt{position:absolute;right:15mm;top:13mm;writing-mode:vertical-rl;font-family:' + SERIF + ';font-weight:800;font-size:40pt;line-height:1;letter-spacing:.12em;color:#222;white-space:nowrap}',
    '.tpl-wa-modern .w-mark{position:absolute;right:15.6mm;top:63mm;width:14mm;height:14mm;background:var(--tac);color:#fff;border-radius:.8mm;font-family:' + SERIF + ';font-weight:800;line-height:1;letter-spacing:.04em;display:flex;align-items:center;justify-content:center;white-space:nowrap;overflow:hidden}',
    '.tpl-wa-modern .w-hd{position:absolute;left:18mm;top:13.5mm;display:flex;align-items:center;gap:5mm;height:9mm}',
    '.tpl-wa-modern .w-t{flex:1 1 0;min-width:0;font-weight:700;font-size:13pt;letter-spacing:.1em;white-space:nowrap;overflow:hidden;line-height:1.5}',
    '.tpl-wa-modern .w-badge{flex:none;font-size:7.5pt;font-weight:700;letter-spacing:.14em;color:var(--tac);border:.5pt solid var(--tac);padding:1.2mm 2.4mm 1.2mm 2.6mm;line-height:1;white-space:nowrap}',
    '.tpl-wa-modern .w-tbl{position:absolute;left:18mm;top:30mm;width:148mm;border:.5pt solid #222;z-index:1;background:#fff}',
    '.tpl-wa-modern .w-row{display:flex}',
    '.tpl-wa-modern .w-row+.w-row{border-top:.5pt solid #222}',
    '.tpl-wa-modern .w-c{flex:1 1 0;min-width:0;display:flex;align-items:stretch}',
    '.tpl-wa-modern .w-c.h+.w-c.h{border-left:.5pt solid #222}',
    '.tpl-wa-modern .w-l{flex:none;width:21mm;display:flex;align-items:center;padding-left:3mm;font-size:8pt;font-weight:500;letter-spacing:.14em;color:#3a2a2a;background:#f8ebeb;background:color-mix(in srgb,var(--tac) 8%,#fff);border-right:.5pt solid #222;white-space:nowrap;overflow:hidden}',
    '.tpl-wa-modern .w-v{flex:1 1 0;min-width:0;align-self:center;padding:0 3mm;white-space:nowrap;overflow:hidden;font-weight:500;letter-spacing:.06em;line-height:1.4;font-variant-numeric:tabular-nums}',
    '.tpl-wa-modern.mi .w-v{font-family:' + SERIF + '}',
    '.tpl-wa-modern .w-v.num{font-family:' + SERIF + ';font-weight:700;letter-spacing:.05em}',
    '.tpl-wa-modern .w-v.ac{color:var(--tac);font-weight:700}',
    '.tpl-wa-modern .w-v.al-c{text-align:center}',
    '.tpl-wa-modern .w-v.sch{line-height:1.6}.tpl-wa-modern .w-v.sch>div{white-space:nowrap}',
    '.tpl-wa-modern .w-v.sch .tm{display:inline-block;letter-spacing:.06em;font-variant-numeric:tabular-nums}',
    '.tpl-wa-modern .w-v.sch .sj{letter-spacing:.16em}',
    '.tpl-wa-modern .jt-wm{z-index:2;font-family:' + SERIF + '}',
    '.tpl-wa-modern .jt-fold{left:0;width:210mm;gap:4mm;font-family:' + SANS + ';font-size:6.5pt;font-weight:500;letter-spacing:.3em;color:#555;z-index:1}',
    '.tpl-wa-modern .jt-fold span{border-top:.5pt dashed #222}',
    '.tpl-wa-modern .w-lo{position:absolute;left:18mm;width:174mm;bottom:15mm;display:flex;gap:11mm;z-index:1}',
    '.tpl-wa-modern.sw .w-lo{flex-direction:row-reverse}',
    '.tpl-wa-modern .w-nc{flex:1 1 0;min-width:0;max-width:104mm}',
    '.tpl-wa-modern .w-lo.nm .w-nc{max-width:none}',
    '.tpl-wa-modern .w-nh{display:flex;align-items:center;gap:2.4mm;font-family:' + SERIF + ';font-weight:800;font-size:12pt;letter-spacing:.2em;line-height:1;margin-bottom:4mm;color:#222}',
    '.tpl-wa-modern .w-nh:before{content:"";flex:none;width:2.4mm;height:2.4mm;background:var(--tac)}',
    '.tpl-wa-modern .w-lo.nm .w-nb{column-count:2;column-gap:10mm}',
    '.tpl-wa-modern .w-n{display:flex;gap:1.8mm;line-height:1.7;margin-bottom:var(--ng,1.2mm);break-inside:avoid;line-break:strict;text-wrap:pretty;text-align:justify}',
    '.tpl-wa-modern .w-n b{flex:none;width:4.4mm;font-family:' + SERIF + ';font-weight:700;color:var(--tac2);font-variant-numeric:tabular-nums}',
    '.tpl-wa-modern .w-n.r{font-weight:700;color:var(--tac)}',
    '.tpl-wa-modern .w-im{flex:none;width:59mm;display:flex;flex-direction:column;gap:4mm;min-height:0}',
    '.tpl-wa-modern .w-map{flex:0 1 auto;min-height:0;display:flex;align-items:flex-start}',
    '.tpl-wa-modern .w-map img{display:block;max-width:100%;max-height:var(--mh,100mm);object-fit:contain;border:.5pt solid #222;background:#fff}',
    '.tpl-wa-modern .w-logo{flex:none;height:12mm;display:flex;align-items:center}',
    '.tpl-wa-modern .w-logo img{max-height:100%;max-width:100%;object-fit:contain}'
  ].join('\n')
});
})();
