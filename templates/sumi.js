/* 墨（すみ）：モノクロ＋朱の角印。明朝の静かな公式書類 */
(function () {
'use strict';
var FONT_HREF = 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500;700&family=Noto+Sans+JP:wght@300;400;500&display=swap';
var FONT_LOAD = ['400 14px "Shippori Mincho"', '700 14px "Shippori Mincho"', '300 10px "Noto Sans JP"', '400 10px "Noto Sans JP"'];
var SERIF = '"Shippori Mincho","Yu Mincho","Hiragino Mincho ProN","MS PMincho",serif';
var SANS = '"Noto Sans JP","Yu Gothic","Hiragino Sans",Meiryo,sans-serif';
var fontP = null;
function loadFonts() {
  if (fontP) return fontP;
  fontP = new Promise(function (res) {
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONT_HREF; l.setAttribute('data-jt-font', 'sumi');
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
    var cpl = Math.max(4, Math.floor(w / (fs * 0.3528)) - 2), n = 0;
    list.forEach(function (x) { n += Math.max(1, Math.ceil(x.text.length / cpl)); });
    if (n * fs * 0.3528 * lh + (list.length - 1) * gap <= h) return fs;
  }
  return min;
}
loadFonts();

var NUMSZ = { S: 20, M: 24, L: 28, XL: 32 }, VSZ = { S: 11, M: 13, L: 15.5, XL: 19 }, SSZ = { S: 10, M: 12, L: 14, XL: 16 };

JukenTemplates.register({
  id: 'sumi',
  name: '墨',
  category: 'シック',
  description: '明朝と細い罫線、朱の角印ひとつ。大学の公式書類のような静けさ。',
  swatch: ['#1A1A1A', '#C8442B', '#ffffff'],
  defaults: { accent: '#C8442B', secondary: '#666666', font: 'mincho', hdr: '2024年度　早稲田大学受験票', wmOp: 8, wmAcc: false, wmColor: '#1A1A1A', wmBold: false, wmSize: 30, wmSp: 0.5, foldOn: true },
  uses: ['header', 'badge', 'mark', 'accent', 'font', 'fold', 'notes', 'swap', 'images', 'wm'],
  render: function (st, V, C) {
    var t = C.page('sumi', V, (V.swap ? 'sw ' : '') + (V.font === 'gothic' ? 'g' : ''));
    t.style.fontFamily = C.pickFont(V, SANS, SERIF);

    /* ---- header ---- */
    var hasSeal = V.markOn && V.mark;
    var hd = C.el('div', 's-hd'); if (hasSeal) hd.style.width = '148mm';
    var ti = C.edit(C.el('div', 's-t', V.hdr), 'hdr'); C.fitText(t, ti, 9); hd.appendChild(ti);
    if (V.badgeOn && V.badge) hd.appendChild(C.edit(C.el('div', 's-badge', V.badge), 'badge'));
    t.appendChild(hd);
    if (hasSeal) {
      var seal = C.el('div', 's-seal'); seal.appendChild(C.el('span', null, '受験票')); t.appendChild(seal);
      t.appendChild(C.edit(C.el('div', 's-mk', V.mark), 'mark'));
    }

    /* ---- rows ---- */
    var TOP = 44, rows = C.rows(V);
    var avail = Math.max(40, (V.foldOn ? V.foldPos - 7 : 163) - TOP);
    function fsOf(it, sc) { return (/受験番号/.test(it.label) ? NUMSZ : VSZ)[it.size] * sc; }
    function rowH(its, sc) {
      var h = 0;
      its.forEach(function (it) {
        var x = it.source === 'schedule' ? Math.max(1, C.sched(it).length) * SSZ[it.size] * sc * 0.3528 * 1.62 + 7 : fsOf(it, sc) * 0.3528 + 8.5;
        h = Math.max(h, x, 13);
      });
      return h;
    }
    function total(sc, k) { var s = 0; rows.forEach(function (r) { s += rowH(r, sc) * k; }); return s; }
    var sc = 1; while (sc > 0.62 && total(sc, 1) > avail) sc -= 0.02;
    var nat = total(sc, 1), k = nat > avail ? avail / nat : 1;
    var tb = C.el('div', 's-tbl'), used = 0;
    rows.forEach(function (its) {
      var h = rowH(its, sc) * k, r = C.el('div', 's-row'); r.style.height = h + 'mm'; used += h;
      its.forEach(function (it) {
        var c = C.item(C.el('div', 's-c' + (its.length > 1 ? ' h' : '')), it);
        c.appendChild(C.el('span', 's-l', it.label));
        var v = C.el('div', 's-v');
        if (it.source === 'schedule') {
          v.className += ' sch'; var fs = SSZ[it.size] * sc; v.style.fontSize = fs + 'pt';
          C.sched(it).forEach(function (x) {
            var d = C.el('div'), tm = C.el('span', 'tm', x.t); tm.style.minWidth = (13 * fs * 0.3528 * 0.62 + 2) + 'mm';
            d.appendChild(tm); d.appendChild(C.el('span', 'sj', x.c)); v.appendChild(d);
          });
        } else {
          C.itemEdit(v, it); v.textContent = C.value(it, st);
          setFs(v, fsOf(it, sc));
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

    /* ---- lower ---- */
    var L = V.foldOn ? Math.max(V.foldPos + 7, TOP + used + 4) : TOP + used + 11;
    var im = C.images(V), hasIm = !!(im.map || im.logo), notes = C.notes(V);
    var lo = C.el('div', 's-lo' + (hasIm ? '' : ' nm')); lo.style.top = L + 'mm';
    var lh = 297 - 15 - L, nc = C.el('div', 's-nc');
    if (V.noteTitle) nc.appendChild(C.edit(C.el('div', 's-nh', V.noteTitle), 'noteTitle'));
    var nb = C.el('div', 's-nb'), nw = hasIm ? 104 : 82, nh = (lh - (V.noteTitle ? 7 : 0)) * (hasIm ? 1 : 1.9);
    var nfs = noteFs(notes, nw - 6, nh, 9.5, 6.8, 1.6, 1.2);
    nb.style.fontSize = nfs + 'pt'; nb.style.setProperty('--ng', (nfs >= 9 ? 1.3 : 0.7) + 'mm');
    notes.forEach(function (n, i) {
      var d = C.el('div', 's-n' + (n.accent ? ' r' : '')); d.appendChild(C.el('b', null, String(i + 1)));
      d.appendChild(C.el('span', null, n.text)); nb.appendChild(d);
    });
    nc.appendChild(nb); lo.appendChild(nc);
    if (hasIm) {
      var ic = C.el('div', 's-im'); ic.style.setProperty('--mh', Math.max(20, lh - (im.logo ? 17 : 0)) + 'mm');
      if (im.map) { var mp = C.el('div', 's-map'), i1 = C.el('img'); i1.src = im.map; i1.alt = ''; mp.appendChild(i1); ic.appendChild(mp); }
      if (im.logo) { var lg = C.el('div', 's-logo'), i2 = C.el('img'); i2.src = im.logo; i2.alt = ''; lg.appendChild(i2); ic.appendChild(lg); }
      lo.appendChild(ic);
    }
    t.appendChild(lo);
    refit(t, C);
    return t;
  },
  styles: [
    '.tpl-sumi{display:block;padding:0;color:#1A1A1A;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.tpl-sumi .s-hd{position:absolute;left:18mm;top:17mm;width:174mm}',
    '.tpl-sumi .s-t{font-size:20pt;line-height:11mm;letter-spacing:.1em;white-space:nowrap;overflow:hidden;font-weight:500}',
    '.tpl-sumi .s-badge{display:inline-block;margin-top:3.5mm;font-family:' + SANS + ';font-weight:400;font-size:7.5pt;letter-spacing:.2em;line-height:1;color:var(--tac2);border:.3pt solid var(--tac2);padding:1.3mm 2.4mm 1.3mm 2.6mm;white-space:nowrap}',
    '.tpl-sumi .s-seal{position:absolute;right:18mm;top:14mm;width:18mm;height:18mm;border:1.1pt solid var(--tac);color:var(--tac);transform:rotate(-3deg);display:flex;align-items:center;justify-content:center;outline:.3pt solid var(--tac);outline-offset:-1.5mm;overflow:hidden}',
    '.tpl-sumi .s-seal span{writing-mode:vertical-rl;text-orientation:upright;font-weight:700;font-size:4.6mm;line-height:1;letter-spacing:.12em;margin-right:-.12em;white-space:nowrap}',
    '.tpl-sumi .s-mk{position:absolute;right:18mm;top:34.5mm;max-width:50mm;font-family:' + SANS + ';font-weight:400;font-size:7pt;letter-spacing:.16em;margin-right:-.16em;line-height:1;color:#1A1A1A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}',
    '.tpl-sumi .s-tbl{position:absolute;left:18mm;top:44mm;width:174mm;border-top:.8pt solid #1A1A1A;z-index:1}',
    '.tpl-sumi .s-row{display:flex;border-bottom:.3pt solid #1A1A1A}',
    '.tpl-sumi .s-row:last-child{border-bottom-width:.8pt}',
    '.tpl-sumi .s-c{flex:1 1 0;min-width:0;display:flex;align-items:center}',
    '.tpl-sumi .s-c.h:first-child{padding-right:5mm}',
    '.tpl-sumi .s-c.h+.s-c.h{padding-left:5mm;border-left:.3pt solid #1A1A1A}',
    '.tpl-sumi .s-l{flex:none;width:22mm;font-family:' + SANS + ';font-weight:300;font-size:7.5pt;letter-spacing:.3em;color:#666;white-space:nowrap}',
    '.tpl-sumi .s-v{flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;line-height:1.35;letter-spacing:.06em;font-weight:500;font-variant-numeric:tabular-nums}',
    '.tpl-sumi .s-v.num{letter-spacing:.04em}',
    '.tpl-sumi .s-v.ac{color:var(--tac);font-weight:700}',
    '.tpl-sumi .s-v.al-c{text-align:center}',
    '.tpl-sumi .s-v.sch{line-height:1.62}.tpl-sumi .s-v.sch>div{white-space:nowrap}',
    '.tpl-sumi .s-v.sch .tm{display:inline-block;letter-spacing:.08em;font-variant-numeric:tabular-nums}',
    '.tpl-sumi .s-v.sch .sj{letter-spacing:.16em}',
    '.tpl-sumi .jt-wm{z-index:0;font-family:' + SERIF + ';color:#1A1A1A}',
    '.tpl-sumi .jt-fold{left:0;width:210mm;gap:4mm;font-family:' + SANS + ';font-size:6.5pt;font-weight:300;letter-spacing:.3em;color:#666;z-index:1}',
    '.tpl-sumi .jt-fold span{border-top:.3pt dotted #444}',
    '.tpl-sumi .s-lo{position:absolute;left:18mm;width:174mm;bottom:15mm;display:flex;gap:11mm;z-index:1}',
    '.tpl-sumi.sw .s-lo{flex-direction:row-reverse}',
    '.tpl-sumi .s-nc{flex:1 1 0;min-width:0;max-width:104mm}',
    '.tpl-sumi .s-lo.nm .s-nc{max-width:none}',
    '.tpl-sumi .s-nh{font-family:' + SANS + ';font-weight:400;font-size:7.5pt;letter-spacing:.3em;color:#666;line-height:1;margin-bottom:4mm}',
    '.tpl-sumi .s-lo.nm .s-nb{column-count:2;column-gap:10mm}',
    '.tpl-sumi .s-n{display:flex;gap:1.6mm;line-height:1.6;margin-bottom:var(--ng,1.2mm);break-inside:avoid;line-break:strict;text-wrap:pretty;text-align:justify}',
    '.tpl-sumi .s-n b{flex:none;width:4.4mm;font-weight:400;font-variant-numeric:tabular-nums;color:#666}',
    '.tpl-sumi .s-n.r{font-weight:700}.tpl-sumi .s-n.r b{color:var(--tac);font-weight:700}',
    '.tpl-sumi .s-im{flex:none;width:59mm;display:flex;flex-direction:column;gap:4mm;min-height:0}',
    '.tpl-sumi .s-map{flex:0 1 auto;min-height:0;display:flex;align-items:flex-start}',
    '.tpl-sumi .s-map img{display:block;max-width:100%;max-height:var(--mh,100mm);object-fit:contain;border:.3pt solid #1A1A1A;padding:1mm;background:#fff}',
    '.tpl-sumi .s-logo{flex:none;height:12mm;display:flex;align-items:center;justify-content:flex-start}',
    '.tpl-sumi .s-logo img{max-height:100%;max-width:100%;object-fit:contain}'
  ].join('\n')
});
})();
