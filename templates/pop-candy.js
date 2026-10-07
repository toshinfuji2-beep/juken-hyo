/* ポップ・キャンディ：丸ゴシックと4色のカード、ステッカー風バッジ、色付き丸数字の注意事項 */
(function () {
  var JT = JukenTemplates, ID = 'pop-candy';
  /* Webフォント（Google Fonts のみ）。<link> を一度だけ差し込む */
  (function () {
    var lid = 'jt-font-' + ID;
    if (document.getElementById(lid)) return;
    var l = document.createElement('link'); l.id = lid; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@500;700;800&display=swap';
    document.head.appendChild(l);
  })();

  var FF = '"M PLUS Rounded 1c","Hiragino Maru Gothic ProN","Yu Gothic","Meiryo",sans-serif';
  var INK = '#2B2D42', MINT = '#2EC4A6', YEL = '#FFD23F';
  var PTH = { S: 10.5, M: 13, L: 15.5, XL: 18 }, PTF = { S: 11, M: 14, L: 16.5, XL: 19.5 };

  function rgb(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function tint(h, a) { var c = rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function onCol(h) {   /* 色の上に載せる文字色（明るければインク、暗ければ白） */
    var c = rgb(h).map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) > 0.3 ? INK : '#fff';
  }
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
  function segs(s, max) {
    var a = String(s || '').split(/[\s　]+/).filter(Boolean);
    while (a.length > (max || 2)) {
      var bi = 0, bl = 1e9;
      for (var i = 0; i < a.length - 1; i++) { var l = a[i].length + a[i + 1].length; if (l < bl) { bl = l; bi = i; } }
      a.splice(bi, 2, a[bi] + ' ' + a[bi + 1]);
    }
    return a;
  }

  JT.register({
    id: ID,
    name: 'ポップ・キャンディ',
    category: 'ポップ',
    description: 'ピンク・ミント・イエロー・スカイの4色カード。丸ゴシックで明るく親しみやすい。',
    swatch: ['#FF6FA8', '#2EC4A6', '#FFD23F', '#4CC9F0'],
    defaults: { accent: '#FF6FA8', secondary: '#4CC9F0', font: 'gothic', hdr: '2024年度　早稲田大学受験票', badge: '折って試験当日持参', badgeOn: true, mark: '24早', markOn: true, foldOn: true, wmAcc: true, wmOp: 16 },
    uses: ['header', 'badge', 'mark', 'accent', 'secondary', 'fold', 'notes', 'swap', 'images', 'wm'],
    render: function (st, V, C) {
      var t = C.page(ID, V, V.swap ? 'sw' : ''); t._shr = [];
      t.style.fontFamily = C.pickFont(V, FF, FF); t.style.setProperty('--ink', INK); t.style.setProperty('--on-ac', onCol(V.accent)); t.style.setProperty('--on-sc', onCol(V.secondary));
      var PAL = [V.accent, MINT, YEL, V.secondary];
      function fitT(e, min) { e._fs0 = e.style.fontSize; return C.fitText(t, e, min); }
      var num = pickVis(V, /受験番号|^番号$|^No\.?$/i, /カナ|氏名/);
      var nm = pickVis(V, /氏名|名前/, /カナ|フリガナ|ふりがな/) || pickVis(V, /氏名|名前/);
      if (nm === num) nm = null;
      var rest = V.items.filter(function (i) { return !i.hidden && i !== num && i !== nm; });
      var V2 = {}; for (var k0 in V) V2[k0] = V[k0]; V2.items = rest;
      var bottom = Math.max(100, Math.min(V.foldPos - 4, 210));

      /* 背景：上半分だけの淡いドット */
      var dots = C.el('div', 'pc-dots'); dots.style.height = bottom + 'mm'; t.appendChild(dots);

      /* ---- ヘッダー ---- */
      var hd = C.el('div', 'pc-hd'); t.appendChild(hd);
      var ti = C.edit(C.el('div', 'pc-title'), 'hdr');
      segs(V.hdr).forEach(function (s) { var d = C.el('div', 'pc-tl', s); fitT(d, 8); ti.appendChild(d); });
      hd.appendChild(ti);
      if (V.markOn && V.mark) {
        var mc = C.el('div', 'pc-mark'), mk = C.edit(C.el('span', null, V.mark), 'mark'); fitT(mk, 6); mc.appendChild(mk); hd.appendChild(mc);
      }
      if (V.badgeOn && V.badge) {
        var bw = C.el('div', 'pc-badge'), bt = C.edit(C.el('span', null, V.badge), 'badge'); fitT(bt, 6); bw.appendChild(bt); hd.appendChild(bw);
      }

      /* ---- 受験番号ピル＋氏名 ---- */
      var idr = C.el('div', 'pc-id'); t.appendChild(idr);
      if (num) {
        var pill = C.item(C.el('div', 'pc-pill'), num);
        var chip = C.el('em', null, num.label); pill.appendChild(chip);
        var pv = C.itemEdit(C.el('div', 'pc-pv', C.value(num, st)), num); pv.style.fontSize = ({ S: 20, M: 26, L: 30, XL: 34 })[num.size] + 'pt';
        fitT(pv, 10); pill.appendChild(pv); idr.appendChild(pill);
      }
      if (nm) {
        var nb = C.item(C.el('div', 'pc-nm' + (num ? '' : ' solo')), nm);
        nb.appendChild(C.el('em', null, nm.label));
        var nv = C.itemEdit(C.el('div', 'pc-nv', C.value(nm, st)), nm); nv.style.fontSize = ({ S: 14, M: 17, L: 20, XL: 23 })[nm.size] + 'pt';
        if (nm.color === 'accent') nv.className += ' ac';
        fitT(nv, 9); nb.appendChild(nv); idr.appendChild(nb);
      }
      var idH = (num || nm) ? 17 : 0;

      /* ---- カード ---- */
      var top = 12 + 25 + 3 + idH + (idH ? 6 : 0), avail = bottom - top, GAP = 3;
      var cards = C.el('div', 'pc-cards'); cards.style.top = top + 'mm'; t.appendChild(cards);
      var rows = C.rows(V2), nat = [], tot = 0, ci = 0;
      rows.forEach(function (r) {
        var sch = r.some(function (i) { return i.source === 'schedule'; }), h;
        if (sch) { var n = Math.max.apply(null, r.map(function (i) { return i.source === 'schedule' ? C.sched(i).length : 0; })); h = Math.max(13, 5 + n * (C.SIZE.sch[r[0].size] * 0.78 * 0.353 * 1.45)); }
        else h = r.length > 1 ? 16 : 12.5;
        nat.push(h); tot += h + GAP;
      });
      tot -= GAP;
      var H = Math.min(tot, avail), kk = tot ? Math.min(1, avail / tot) : 1, fs = Math.max(0.6, Math.min(1, kk * 1.05));
      cards.style.height = H + 'mm';
      rows.forEach(function (r, ri) {
        var row = C.el('div', 'pc-row' + (r.length > 1 ? ' two' : '') + (r.length > 1 && nat[ri] * (H - GAP * (rows.length - 1)) / (tot - GAP * (rows.length - 1)) < 13.6 ? ' flat' : '')); row.style.flex = nat[ri] + ' 1 0';
        r.forEach(function (it) {
          var col = PAL[ci++ % 4], half = r.length > 1;
          var c = C.item(C.el('div', 'pc-c'), it); c.style.borderColor = col; c.style.backgroundColor = '#fff'; c.style.backgroundImage = 'linear-gradient(' + tint(col, .14) + ',' + tint(col, .14) + ')';
          var lb = C.el('span', 'pc-lb', it.label); lb.style.background = col; lb.style.color = onCol(col); c.appendChild(lb);
          var v;
          if (it.source === 'schedule') {
            v = C.el('div', 'pc-sch'); v.style.fontSize = C.SIZE.sch[it.size] * 0.78 * fs + 'pt';
            C.sched(it).forEach(function (x, xi) {
              var d = C.el('div'), b = C.el('b', null, x.c); d.appendChild(b); d.appendChild(C.el('i', null, x.t)); v.appendChild(d);
            });
          } else {
            v = C.itemEdit(C.el('div', 'pc-v', C.value(it, st)), it); v.style.fontSize = (half ? PTH : PTF)[it.size] * fs + 'pt';
            if (it.align === 'center') v.className += ' al-c';
            if (it.color === 'accent') v.className += ' ac';
            fitT(v, 8);
          }
          c.appendChild(v); row.appendChild(c);
        });
        cards.appendChild(row);
      });
      var wm = C.watermark(V, { top: top, height: H }); if (wm) t.appendChild(wm);
      var fo = C.fold(V); if (fo) t.appendChild(fo);

      /* ---- 下部：注意事項＋画像 ---- */
      var nt = Math.max(bottom + 12, V.foldPos + 9), zone = C.el('div', 'pc-zone'); zone.style.top = nt + 'mm'; t.appendChild(zone);
      var im = C.images(V), hasIm = !!(im.map || im.logo);
      var body = C.el('div', 'pc-body'); zone.appendChild(body);
      var left = C.el('div', 'pc-lft'); body.appendChild(left);
      if (V.noteTitle) left.appendChild(C.edit(C.el('div', 'pc-nh', V.noteTitle), 'noteTitle'));
      var ns = C.el('div', 'pc-notes'); left.appendChild(ns);
      C.notes(V).forEach(function (n, i) {
        var d = C.el('div', 'pc-n' + (n.accent ? ' r' : '')), col = PAL[i % 4], b = C.el('b', null, String(i + 1));
        b.style.background = col; b.style.color = onCol(col); d.appendChild(b);
        var sp = C.el('span'); sp.appendChild(C.el('u', null, n.text)); d.appendChild(sp); ns.appendChild(d);
      });
      t._shr.push({ el: ns, maxMm: 288 - nt - (V.noteTitle ? 13 : 2), pt: 9.5 });
      if (hasIm) {
        var ri = C.el('div', 'pc-im');
        if (im.map) { var w1 = C.el('div', 'mp'), i1 = C.el('img'); i1.src = im.map; i1.alt = ''; w1.appendChild(i1); ri.appendChild(w1); }
        if (im.logo) { var i2 = C.el('img', 'lg'); i2.src = im.logo; i2.alt = ''; ri.appendChild(i2); }
        body.appendChild(ri);
      }
      post(t, C);
      return t;
    },
    styles: [
      '.tpl-pop-candy{padding:0;display:block;line-height:1.35;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.tpl-pop-candy .pc-dots{position:absolute;left:0;top:0;width:210mm;background-image:radial-gradient(circle,rgba(43,45,66,.1) 0 .42mm,transparent .5mm);background-size:4.4mm 4.4mm;background-position:2mm 2mm}',
      '.tpl-pop-candy .pc-hd{position:absolute;left:14mm;top:12mm;width:182mm;height:25mm}',
      '.tpl-pop-candy .pc-title{position:relative;z-index:0;display:inline-block;max-width:110mm;vertical-align:top;padding:0 1mm}',
      '.tpl-pop-candy .pc-title:before{content:"";position:absolute;z-index:-1;left:-5mm;right:-6mm;top:-2mm;bottom:-2.2mm;background:' + YEL + ';border-radius:58% 42% 55% 45%/60% 52% 48% 40%;transform:rotate(-1.6deg)}',
      '.tpl-pop-candy .pc-tl{display:block;overflow:hidden;white-space:nowrap;font-weight:800;font-size:26pt;line-height:1.28;letter-spacing:.02em}',
      '.tpl-pop-candy .pc-mark{position:absolute;right:0;top:-1mm;width:23mm;height:23mm;border-radius:50%;background:' + MINT + ';color:' + INK + ';display:flex;align-items:center;justify-content:center;transform:rotate(7deg);box-shadow:0 0 0 1.2mm #fff,0 .5mm 1.6mm 1.2mm rgba(43,45,66,.22)}',
      '.tpl-pop-candy .pc-mark span{display:block;max-width:18mm;overflow:hidden;white-space:nowrap;text-align:center;font-weight:800;font-size:15pt;letter-spacing:.04em;line-height:1.3}',
      '.tpl-pop-candy .pc-badge{position:absolute;right:30mm;top:1.5mm;width:38mm;height:9.5mm;border-radius:2.6mm;background:var(--tac2);color:var(--on-sc);display:flex;align-items:center;justify-content:center;padding:0 2.2mm;transform:rotate(-4deg);box-shadow:0 0 0 1.2mm #fff,0 .5mm 1.6mm 1.2mm rgba(43,45,66,.22)}',
      '.tpl-pop-candy .pc-badge span{display:block;max-width:100%;overflow:hidden;white-space:nowrap;font-weight:800;font-size:8.5pt;letter-spacing:.04em;line-height:1.3}',
      '.tpl-pop-candy .pc-id{position:absolute;left:14mm;top:44mm;width:182mm;height:17mm;display:flex;align-items:center;gap:6mm}',
      '.tpl-pop-candy .pc-pill{flex:none;width:88mm;height:17mm;border-radius:8.5mm;background:var(--ink);color:#fff;display:flex;align-items:center;gap:3.5mm;padding:0 6mm 0 3mm}',
      '.tpl-pop-candy .pc-pill em{flex:none;font-style:normal;font-weight:800;font-size:7.5pt;letter-spacing:.08em;height:7mm;line-height:7mm;padding:0 3mm;border-radius:3.5mm;background:var(--tac);color:var(--on-ac);white-space:nowrap}',
      '.tpl-pop-candy .pc-pv{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-align:center;font-weight:800;line-height:1.3;letter-spacing:.1em;margin-right:-.1em;font-variant-numeric:tabular-nums}',
      '.tpl-pop-candy .pc-nm{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center}',
      '.tpl-pop-candy .pc-nm em{align-self:flex-start;font-style:normal;font-weight:800;font-size:7pt;letter-spacing:.08em;height:5mm;line-height:5mm;padding:0 2.4mm;border-radius:2.5mm;background:var(--tac2);color:var(--on-sc);white-space:nowrap;margin-bottom:.8mm}',
      '.tpl-pop-candy .pc-nv{display:block;overflow:hidden;white-space:nowrap;font-weight:800;line-height:1.3;letter-spacing:.03em}',
      '.tpl-pop-candy .pc-nv.ac,.tpl-pop-candy .pc-v.ac{color:var(--tac)}',
      '.tpl-pop-candy .pc-cards{position:absolute;left:14mm;width:182mm;display:flex;flex-direction:column;gap:3mm}',
      '.tpl-pop-candy .pc-row{display:flex;gap:3mm;min-height:0}',
      '.tpl-pop-candy .pc-c{flex:1;min-width:0;display:flex;align-items:center;gap:4mm;border:2pt solid;border-radius:5mm;padding:0 4.5mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.tpl-pop-candy .pc-lb{flex:none;width:23mm;text-align:center;height:5.6mm;line-height:5.6mm;border-radius:2.8mm;font-weight:800;font-size:7.5pt;letter-spacing:.04em;white-space:nowrap;overflow:hidden;padding:0 1.5mm}',
      '.tpl-pop-candy .pc-row.two .pc-c{flex-direction:column;align-items:stretch;justify-content:center;gap:1mm}',
      '.tpl-pop-candy .pc-row.two .pc-lb{align-self:flex-start;width:auto;max-width:100%;padding:0 2.6mm}',
      '.tpl-pop-candy .pc-row.flat .pc-c{flex-direction:row;align-items:center;gap:3mm;padding:0 4mm}',
      '.tpl-pop-candy .pc-row.flat .pc-lb{align-self:center;flex:none;height:5mm;line-height:5mm;font-size:7pt}',
      '.tpl-pop-candy .pc-v{flex:1;min-width:0;overflow:hidden;white-space:nowrap;font-weight:800;line-height:1.3;letter-spacing:.03em}',
      '.tpl-pop-candy .pc-v.al-c{text-align:center}',
      '.tpl-pop-candy .pc-sch{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;line-height:1.4}',
      '.tpl-pop-candy .pc-sch div{display:flex;gap:4mm;white-space:nowrap}',
      '.tpl-pop-candy .pc-sch b{flex:none;width:20mm;font-weight:800}',
      '.tpl-pop-candy .pc-sch i{font-style:normal;font-weight:700;letter-spacing:.08em;font-variant-numeric:tabular-nums}',
      '.tpl-pop-candy .pc-zone{position:absolute;left:14mm;width:182mm}',
      '.tpl-pop-candy .pc-body{display:flex;gap:9mm;align-items:flex-start}',
      '.tpl-pop-candy.sw .pc-body{flex-direction:row-reverse}',
      '.tpl-pop-candy .pc-lft{flex:1;min-width:0}',
      '.tpl-pop-candy .pc-nh{display:inline-block;height:7mm;line-height:7mm;padding:0 5mm;border-radius:3.5mm;background:var(--tac);color:var(--on-ac);font-weight:800;font-size:10.5pt;letter-spacing:.1em;margin-bottom:4mm;white-space:nowrap}',
      '.tpl-pop-candy .pc-notes{font-size:9.5pt;line-height:1.65;line-break:strict;text-wrap:pretty;font-weight:500}',
      '.tpl-pop-candy .pc-n{display:flex;gap:3mm;margin:0 0 2mm}',
      '.tpl-pop-candy .pc-n b{flex:none;width:5.4mm;height:5.4mm;margin-top:.9mm;border-radius:50%;text-align:center;font-size:8pt;font-weight:800;line-height:5.4mm}',
      '.tpl-pop-candy .pc-n span{flex:1;min-width:0}',
      '.tpl-pop-candy .pc-n u{text-decoration:none}',
      '.tpl-pop-candy .pc-n.r u{font-weight:800;background:linear-gradient(transparent 58%,rgba(255,210,63,.75) 58%);-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.tpl-pop-candy .pc-im{flex:none;width:64mm}',
      '.tpl-pop-candy .pc-im .mp{border:2pt solid var(--tac2);border-radius:5mm;overflow:hidden;padding:2.2mm;background:#fff}',
      '.tpl-pop-candy .pc-im img{display:block;width:100%;height:auto}',
      '.tpl-pop-candy .pc-im img.lg{margin-top:4mm;max-height:12mm;width:auto;max-width:100%;object-fit:contain}',
      '.tpl-pop-candy .jt-fold{font-size:7.5pt;font-weight:700;letter-spacing:.3em;color:var(--ink);left:0}',
      '.tpl-pop-candy .jt-fold span{border-top:1pt dashed rgba(43,45,66,.55)}'
    ].join('\n')
  });
})();
