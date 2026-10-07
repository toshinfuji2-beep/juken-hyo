/* ナチュラル：セージグリーンの細枠カード。受験番号は淡い面に大きく、試験時間はタイムライン */
(function () {
  var JT = JukenTemplates, ID = 'natural';
  /* Webフォント（Google Fonts のみ）。<link> を一度だけ差し込む */
  (function () {
    var lid = 'jt-font-' + ID;
    if (document.getElementById(lid)) return;
    var l = document.createElement('link'); l.id = lid; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700&display=swap';
    document.head.appendChild(l);
  })();

  var FF = '"Zen Maru Gothic","Hiragino Maru Gothic ProN","Yu Gothic","Meiryo",sans-serif';
  var INK = '#3b3835';
  var PTH = { S: 11, M: 13.5, L: 16, XL: 18.5 }, PTF = { S: 11.5, M: 14.5, L: 17, XL: 20 };

  function rgb(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function tint(h, a) { var c = rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function shade(h, k) { var c = rgb(h).map(function (v) { return Math.round(v * k); }); return '#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }
  function post(t, C) {
    var n = 0;
    function go() {
      if (!t.isConnected) { if (n++ < 30) setTimeout(go, 120); return; }
      (t._fits || []).forEach(function (e) { if (e._fs0 != null) e.style.fontSize = e._fs0; C.fit(e, e._fitMin); });
      (t._shr || []).forEach(function (o) {
        var fs = o.pt; o.el.style.fontSize = fs + 'pt';
        var k = 0; while (o.el.scrollHeight > o.maxMm * C.PXMM + 1 && fs > 6 && k++ < 50) { fs -= 0.25; o.el.style.fontSize = fs + 'pt'; }
      });
    }
    setTimeout(function () { go(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); }, 30);
  }
  function pickVis(V, re, not) { var it = JT.ctx.findItem(V, re, not); return it && !it.hidden ? it : null; }

  JT.register({
    id: ID,
    name: 'ナチュラル',
    category: 'ナチュラル',
    description: 'セージグリーンの細枠カードと丸ゴシック。穏やかで清潔、保護者にも好印象。',
    swatch: ['#6B8F71', '#8A817C', '#E2EAE3', '#ffffff'],
    defaults: { accent: '#6B8F71', secondary: '#8A817C', font: 'gothic', hdr: '2024年度　早稲田大学受験票', badge: '折って試験当日持参', badgeOn: true, mark: '24早', markOn: true, foldOn: true, wmAcc: true, wmOp: 14 },
    uses: ['header', 'badge', 'mark', 'accent', 'secondary', 'fold', 'notes', 'swap', 'images', 'wm'],
    render: function (st, V, C) {
      var t = C.page(ID, V, V.swap ? 'sw' : ''); t._shr = [];
      t.style.fontFamily = C.pickFont(V, FF, FF); t.style.setProperty('--ink', INK); t.style.setProperty('--sage-d', shade(V.accent, 0.62));
      t.style.setProperty('--sage-l', tint(V.accent, .15)); t.style.setProperty('--sage-m', tint(V.accent, .35));
      function fitT(e, min) { e._fs0 = e.style.fontSize; return C.fitText(t, e, min); }
      var num = pickVis(V, /受験番号|^番号$|^No\.?$/i, /カナ|氏名/);
      var nm = pickVis(V, /氏名|名前/, /カナ|フリガナ|ふりがな/) || pickVis(V, /氏名|名前/);
      if (nm === num) nm = null;
      var rest = V.items.filter(function (i) { return !i.hidden && i !== num && i !== nm; });
      var V2 = {}; for (var k0 in V) V2[k0] = V[k0]; V2.items = rest;
      var bottom = Math.max(100, Math.min(V.foldPos - 4, 210));
      function lab(txt) { var d = C.el('div', 'na-lab'); d.appendChild(C.el('i')); d.appendChild(C.el('span', null, txt)); return d; }

      /* ---- ヘッダー ---- */
      var hd = C.el('div', 'na-hd'); t.appendChild(hd);
      var tw = C.el('div', 'na-tw'); hd.appendChild(tw);
      tw.appendChild(C.el('i', 'na-dot'));
      var ti = C.edit(C.el('div', 'na-title', V.hdr || ''), 'hdr'); fitT(ti, 8); tw.appendChild(ti);
      if (V.badgeOn && V.badge) { var bg = C.edit(C.el('div', 'na-badge', V.badge), 'badge'); fitT(bg, 6); hd.appendChild(bg); }
      if (V.markOn && V.mark) {
        var mc = C.el('div', 'na-mark'), mk = C.edit(C.el('span', null, V.mark), 'mark'); fitT(mk, 6); mc.appendChild(mk); hd.appendChild(mc);
      }

      /* ---- ヒーロー（受験番号・氏名） ---- */
      var hero = C.el('div', 'na-hero'); t.appendChild(hero);
      if (num) {
        var nb = C.item(C.el('div', 'na-nbox'), num); nb.appendChild(lab(num.label));
        var nv = C.itemEdit(C.el('div', 'na-num', C.value(num, st)), num); nv.style.fontSize = ({ S: 22, M: 28, L: 34, XL: 40 })[num.size] + 'pt';
        fitT(nv, 12); nb.appendChild(nv); hero.appendChild(nb);
      }
      if (nm) {
        var mb = C.item(C.el('div', 'na-mbox'), nm); mb.appendChild(lab(nm.label));
        var mv = C.itemEdit(C.el('div', 'na-nm', C.value(nm, st)), nm); mv.style.fontSize = ({ S: 15, M: 19, L: 23, XL: 27 })[nm.size] + 'pt';
        if (nm.color === 'accent') mv.className += ' ac';
        fitT(mv, 9); mb.appendChild(mv); hero.appendChild(mb);
      }
      var heroH = (num || nm) ? 26 : 0;
      hero.style.height = heroH + 'mm';

      /* ---- 詳細カード ---- */
      var top = 12 + 15 + 4 + heroH + (heroH ? 4 : 0), avail = bottom - top, PADV = 3;
      var card = C.el('div', 'na-card'); card.style.top = top + 'mm'; t.appendChild(card);
      var rows = C.rows(V2), nat = [], tot = 0;
      rows.forEach(function (r) {
        var sch = r.some(function (i) { return i.source === 'schedule'; }), h;
        if (sch) { var n = Math.max.apply(null, r.map(function (i) { return i.source === 'schedule' ? C.sched(i).length : 0; })); h = Math.max(13, 4 + n * (C.SIZE.sch[r[0].size] * 0.8 * 0.353 * 1.55)); }
        else h = r.length > 1 ? 15.5 : 12.5;
        nat.push(h); tot += h;
      });
      var inner = Math.min(tot, avail - 2 * PADV), kk = tot ? inner / tot : 1, fs = Math.max(0.6, Math.min(1, kk * 1.05));
      var H = inner + 2 * PADV; card.style.height = H + 'mm';
      var cin = C.el('div', 'na-cin'); card.appendChild(cin);
      rows.forEach(function (r, ri) {
        var row = C.el('div', 'na-row' + (r.length > 1 ? ' two' : '')); row.style.flex = nat[ri] + ' 1 0';
        r.forEach(function (it) {
          var c = C.item(C.el('div', 'na-c'), it); c.appendChild(lab(it.label));
          var v;
          if (it.source === 'schedule') {
            v = C.el('div', 'na-tl'); v.style.fontSize = C.SIZE.sch[it.size] * 0.8 * fs + 'pt';
            C.sched(it).forEach(function (x) { var d = C.el('div'); d.appendChild(C.el('s')); d.appendChild(C.el('i', null, x.t)); d.appendChild(C.el('b', null, x.c)); v.appendChild(d); });
          } else {
            v = C.itemEdit(C.el('div', 'na-v', C.value(it, st)), it); v.style.fontSize = (r.length > 1 ? PTH : PTF)[it.size] * fs + 'pt';
            if (it.align === 'center') v.className += ' al-c';
            if (it.color === 'accent') v.className += ' ac';
            fitT(v, 8);
          }
          c.appendChild(v); row.appendChild(c);
        });
        cin.appendChild(row);
      });
      var wm = C.watermark(V, { top: top, height: H }); if (wm) t.appendChild(wm);
      var fo = C.fold(V); if (fo) t.appendChild(fo);

      /* ---- 下部：注意事項＋画像 ---- */
      var nt = Math.max(bottom + 12, V.foldPos + 9), zone = C.el('div', 'na-zone'); zone.style.top = nt + 'mm'; t.appendChild(zone);
      var im = C.images(V), hasIm = !!(im.map || im.logo);
      var body = C.el('div', 'na-body'); zone.appendChild(body);
      var left = C.el('div', 'na-lft'); body.appendChild(left);
      if (V.noteTitle) { var nh = C.el('div', 'na-nh'); nh.appendChild(C.el('i')); nh.appendChild(C.edit(C.el('span', null, V.noteTitle), 'noteTitle')); left.appendChild(nh); }
      var ns = C.el('div', 'na-notes'); left.appendChild(ns);
      C.notes(V).forEach(function (n) {
        var d = C.el('div', 'na-n' + (n.accent ? ' r' : '')); d.appendChild(C.el('i')); d.appendChild(C.el('span', null, n.text)); ns.appendChild(d);
      });
      t._shr.push({ el: ns, maxMm: 288 - nt - (V.noteTitle ? 13 : 2), pt: 9.5 });
      if (hasIm) {
        var ri = C.el('div', 'na-im');
        if (im.map) { var w1 = C.el('div', 'mp'), i1 = C.el('img'); i1.src = im.map; i1.alt = ''; w1.appendChild(i1); ri.appendChild(w1); }
        if (im.logo) { var i2 = C.el('img', 'lg'); i2.src = im.logo; i2.alt = ''; ri.appendChild(i2); }
        body.appendChild(ri);
      }
      post(t, C);
      return t;
    },
    styles: [
      '.tpl-natural{padding:0;display:block;line-height:1.35;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.tpl-natural .na-hd{position:absolute;left:14mm;top:12mm;width:182mm;height:15mm}',
      '.tpl-natural .na-tw{position:absolute;left:0;top:0;width:118mm;height:9mm;display:flex;align-items:center;gap:3mm}',
      '.tpl-natural .na-dot{flex:none;width:3.4mm;height:3.4mm;border-radius:50%;background:var(--tac)}',
      '.tpl-natural .na-title{flex:1;min-width:0;overflow:hidden;white-space:nowrap;font-weight:700;font-size:17pt;line-height:1.4;letter-spacing:.05em}',
      '.tpl-natural .na-badge{position:absolute;left:0;top:10mm;max-width:70mm;height:5.2mm;line-height:4.6mm;padding:0 3mm;border-radius:2.6mm;border:.6pt solid var(--tac);background:var(--sage-l);color:var(--sage-d);font-weight:700;font-size:7.5pt;letter-spacing:.08em;white-space:nowrap;overflow:hidden}',
      '.tpl-natural .na-mark{position:absolute;right:0;top:-1mm;width:17mm;height:17mm;border-radius:50%;background:var(--sage-l);border:.8pt solid var(--tac);display:flex;align-items:center;justify-content:center}',
      '.tpl-natural .na-mark span{display:block;max-width:13.4mm;overflow:hidden;white-space:nowrap;text-align:center;font-weight:700;font-size:11.5pt;letter-spacing:.04em;line-height:1.3;color:var(--sage-d)}',
      '.tpl-natural .na-hero{position:absolute;left:14mm;top:31mm;width:182mm;display:flex;gap:4mm}',
      '.tpl-natural .na-nbox{flex:none;width:84mm;height:100%;border-radius:3mm;background:var(--sage-l);padding:0 5mm;display:flex;flex-direction:column;justify-content:center;overflow:hidden}',
      '.tpl-natural .na-mbox{flex:1;min-width:0;height:100%;border-radius:3mm;border:.8pt solid var(--tac);padding:0 5mm;display:flex;flex-direction:column;justify-content:center;overflow:hidden}',
      '.tpl-natural .na-lab{display:flex;align-items:center;gap:1.8mm;white-space:nowrap;line-height:1.2}',
      '.tpl-natural .na-lab i{flex:none;width:2.2mm;height:2.2mm;border-radius:50%;background:var(--tac)}',
      '.tpl-natural .na-lab span{font-size:7.5pt;font-weight:500;color:var(--tac2);letter-spacing:.08em}',
      '.tpl-natural .na-num{display:block;overflow:hidden;white-space:nowrap;font-weight:700;color:var(--sage-d);line-height:1.35;letter-spacing:.1em;margin-top:1.4mm;font-variant-numeric:tabular-nums}',
      '.tpl-natural .na-nm{display:block;overflow:hidden;white-space:nowrap;font-weight:700;line-height:1.5;letter-spacing:.06em;margin-top:2.4mm}',
      '.tpl-natural .na-nm.ac,.tpl-natural .na-v.ac{color:var(--sage-d)}',
      '.tpl-natural .na-card{position:absolute;left:14mm;width:182mm;border:.8pt solid var(--tac);border-radius:3mm;padding:3mm 6mm}',
      '.tpl-natural .na-cin{height:100%;display:flex;flex-direction:column}',
      '.tpl-natural .na-row{display:flex;gap:10mm;min-height:0;position:relative}',
      '.tpl-natural .na-row+.na-row{border-top:.6pt dashed var(--sage-m)}',
      '.tpl-natural .na-row.two .na-c+.na-c:before{content:"";position:absolute;left:50%;top:3mm;bottom:3mm;border-left:.6pt dotted var(--sage-m);margin-left:-5mm}',
      '.tpl-natural .na-c{flex:1;min-width:0;display:flex;align-items:center;gap:4mm}',
      '.tpl-natural .na-row:not(.two) .na-lab{flex:none;width:30mm}',
      '.tpl-natural .na-row.two .na-c{flex-direction:column;align-items:stretch;justify-content:center;gap:.6mm}',
      '.tpl-natural .na-v{flex:1;min-width:0;overflow:hidden;white-space:nowrap;font-weight:700;line-height:1.4;letter-spacing:.05em}',
      '.tpl-natural .na-row.two .na-v{flex:none}',
      '.tpl-natural .na-v.al-c{text-align:center}',
      '.tpl-natural .na-tl{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;position:relative;line-height:1.5}',
      '.tpl-natural .na-tl:before{content:"";position:absolute;left:.95mm;top:.9em;bottom:.9em;border-left:.7pt solid var(--tac)}',
      '.tpl-natural .na-tl div{position:relative;display:flex;align-items:center;gap:4mm;white-space:nowrap;padding-left:6mm}',
      '.tpl-natural .na-tl s{position:absolute;left:0;top:50%;width:2mm;height:2mm;margin-top:-1mm;border-radius:50%;background:#fff;border:1pt solid var(--tac);box-sizing:border-box}',
      '.tpl-natural .na-tl i{font-style:normal;flex:none;width:30mm;font-weight:500;color:var(--tac2);letter-spacing:.08em;font-variant-numeric:tabular-nums}',
      '.tpl-natural .na-tl b{font-weight:700;letter-spacing:.06em}',
      '.tpl-natural .na-zone{position:absolute;left:14mm;width:182mm}',
      '.tpl-natural .na-body{display:flex;gap:10mm;align-items:flex-start}',
      '.tpl-natural.sw .na-body{flex-direction:row-reverse}',
      '.tpl-natural .na-lft{flex:1;min-width:0}',
      '.tpl-natural .na-nh{display:inline-flex;align-items:center;gap:2.2mm;height:7mm;padding:0 5mm 0 3.6mm;border-radius:3.5mm;background:var(--sage-l);margin-bottom:4.4mm;white-space:nowrap}',
      '.tpl-natural .na-nh i{width:2.4mm;height:2.4mm;border-radius:50%;background:var(--tac)}',
      '.tpl-natural .na-nh span{font-weight:700;font-size:10.5pt;letter-spacing:.12em;color:var(--sage-d)}',
      '.tpl-natural .na-notes{font-size:9.5pt;line-height:1.85;line-break:strict;text-wrap:pretty;font-weight:500}',
      '.tpl-natural .na-n{display:flex;gap:3mm;margin:0 0 1.4mm}',
      '.tpl-natural .na-n i{flex:none;width:1.7mm;height:1.7mm;margin-top:2.6mm;border-radius:50%;background:var(--tac);opacity:.55}',
      '.tpl-natural .na-n span{flex:1;min-width:0}',
      '.tpl-natural .na-n.r i{opacity:1}.tpl-natural .na-n.r span{font-weight:700;color:var(--sage-d)}',
      '.tpl-natural .na-im{flex:none;width:64mm;padding-top:1mm}',
      '.tpl-natural .na-im .mp{border:.8pt solid var(--tac);border-radius:3mm;overflow:hidden;background:#fff}',
      '.tpl-natural .na-im .mp img{display:block;width:100%;height:auto}',
      '.tpl-natural .na-im img.lg{display:block;margin-top:4mm;max-height:12mm;width:auto;max-width:100%;object-fit:contain}',
      '.tpl-natural .jt-fold{font-size:7.5pt;font-weight:500;letter-spacing:.3em;color:var(--tac2);left:0}',
      '.tpl-natural .jt-fold span{border-top:.8pt dashed var(--tac2)}'
    ].join('\n')
  });
})();
