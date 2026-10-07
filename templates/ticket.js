/* チケット：上半分をイベントチケット（本券＋半券・ミシン目・切り欠き）として描く。下半分は白地に注意事項と地図 */
(function () {
  var JT = JukenTemplates, ID = 'ticket';
  /* Webフォント（Google Fonts のみ）。<link> を一度だけ差し込む */
  (function () {
    var lid = 'jt-font-' + ID;
    if (document.getElementById(lid)) return;
    var l = document.createElement('link'); l.id = lid; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=M+PLUS+1p:wght@500;700;800&family=Noto+Sans+JP:wght@400;500;700&display=swap';
    document.head.appendChild(l);
  })();

  var FF = '"Noto Sans JP","Yu Gothic","Meiryo","Hiragino Sans",sans-serif';
  var HF = '"M PLUS 1p","Noto Sans JP","Yu Gothic",sans-serif';
  var PTH = { S: 10, M: 12.5, L: 15, XL: 17 }, PTF = { S: 10, M: 13.5, L: 16, XL: 19 };

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
  /* 装飾バーコード（受験番号から縞を作る。読み取り用ではない） */
  function barcode(C, text) {
    var s = String(text || '').replace(/[^0-9A-Za-z]/g, '') || '000', seq = [1, 1, 1], i, j;
    for (i = 0; i < s.length && i < 14; i++) { var c = s.charCodeAt(i); for (j = 0; j < 5; j++) seq.push(1 + ((c * (j + 3) + j * 7 + i * 3) % 3)); }
    i = 0; while (seq.length < 44) { seq.push(1 + ((s.charCodeAt(i % s.length) + seq.length * 5) % 3)); i++; }
    seq.push(1, 1, 1);
    if (seq.length % 2 === 0) seq.push(1);
    var bc = C.el('div', 'tk-bars');
    seq.forEach(function (w, k) { var b = C.el('i', k % 2 ? 'sp' : 'b'); b.style.flexGrow = w; bc.appendChild(b); });
    return bc;
  }

  JT.register({
    id: ID,
    name: 'チケット',
    category: 'ポップ',
    description: 'イベントチケット風。半券付きのバイオレット×サンフラワー。',
    swatch: ['#5B3FD6', '#FFC53D', '#ffffff'],
    defaults: { accent: '#5B3FD6', secondary: '#FFC53D', font: 'gothic', hdr: '2024年度　早稲田大学受験票', badge: '折って試験当日持参', badgeOn: true, mark: '24早', markOn: true, foldOn: true, wmAcc: true, wmOp: 14 },
    uses: ['header', 'badge', 'mark', 'accent', 'secondary', 'fold', 'notes', 'swap', 'images', 'wm'],
    render: function (st, V, C) {
      var t = C.page(ID, V, V.swap ? 'sw' : ''); t._shr = [];
      t.style.fontFamily = C.pickFont(V, FF, FF);
      function fitT(e, min) { e._fs0 = e.style.fontSize; return C.fitText(t, e, min); }
      var num = pickVis(V, /受験番号|^番号$|^No\.?$/i, /カナ|氏名/);
      var nm = pickVis(V, /氏名|名前/, /カナ|フリガナ|ふりがな/) || pickVis(V, /氏名|名前/);
      var dt = V.items.filter(function (i) { return !i.hidden && i.source === 'date'; })[0] || null;
      var rest = V.items.filter(function (i) { return !i.hidden && i !== num; });
      var V2 = {}; for (var k0 in V) V2[k0] = V[k0]; V2.items = rest;

      var tkTop = 12, tkH = Math.max(80, Math.min(V.foldPos - 7, 200) - tkTop);
      var tk = C.el('div', 'tk'); tk.style.height = tkH + 'mm'; t.appendChild(tk);
      var main = C.el('div', 'tk-main'), stub = C.el('div', 'tk-stub'); tk.appendChild(main); tk.appendChild(stub);
      ['t', 'b'].forEach(function (p) { tk.appendChild(C.el('div', 'tk-notch ' + p)); });
      tk.appendChild(C.el('div', 'tk-perf'));

      /* ---- 本券：上段（バッジ・マーク） ---- */
      var top = C.el('div', 'tk-top'); main.appendChild(top);
      if (V.badgeOn && V.badge) { var bg = C.edit(C.el('div', 'tk-badge', V.badge), 'badge'); fitT(bg, 6); top.appendChild(bg); }
      if (V.markOn && V.mark) { var mk = C.edit(C.el('div', 'tk-mark', V.mark), 'mark'); fitT(mk, 6); top.appendChild(mk); }
      /* タイトル＋受験番号ピル */
      var hrow = C.el('div', 'tk-hrow'); main.appendChild(hrow);
      var ti = C.edit(C.el('div', 'tk-title'), 'hdr');
      segs(V.hdr).forEach(function (s) { var d = C.el('div', 'tk-tl', s); fitT(d, 8); ti.appendChild(d); });
      hrow.appendChild(ti);
      if (num) {
        var pill = C.item(C.el('div', 'tk-pill'), num); pill.appendChild(C.el('em', null, num.label));
        var pv = C.itemEdit(C.el('div', 'tk-pv', C.value(num, st)), num); pv.style.fontSize = ({ S: 18, M: 22, L: 26, XL: 30 })[num.size] + 'pt';
        fitT(pv, 10); pill.appendChild(pv); hrow.appendChild(pill);
      }

      /* ---- 本券：項目ブロック ---- */
      var blocks = C.el('div', 'tk-blocks'); main.appendChild(blocks);
      var rows = C.rows(V2), nat = [], tot = 0, GAP = 1.8;
      rows.forEach(function (r) {
        var sch = r.some(function (i) { return i.source === 'schedule'; }), h;
        if (sch) { var n = Math.max.apply(null, r.map(function (i) { return i.source === 'schedule' ? C.sched(i).length : 0; })); h = 7 + n * (C.SIZE.sch[r[0].size] * 0.72 * 0.353 * 1.45); }
        else h = r.length > 1 ? 14 : 12;
        nat.push(h); tot += h + GAP;
      });
      var availB = tkH - 14 - 7 - 18 - 4 - 3 - 7; /* 上段7・タイトル行18・余白など */
      var kk = Math.min(1, availB / (tot || 1)), fs = Math.max(0.6, Math.min(1, kk * 1.05));
      rows.forEach(function (r, ri) {
        var row = C.el('div', 'tk-row' + (r.length > 1 ? ' two' : '')); row.style.flex = nat[ri] + ' 1 0'; row.style.maxHeight = nat[ri] * 1.15 + 'mm';
        r.forEach(function (it) {
          var half = r.length > 1, b = C.item(C.el('div', 'tk-b'), it); b.appendChild(C.el('div', 'tk-l', it.label));
          var v;
          if (it.source === 'schedule') {
            v = C.el('div', 'tk-sch'); v.style.fontSize = C.SIZE.sch[it.size] * 0.72 * fs + 'pt';
            C.sched(it).forEach(function (x) { var d = C.el('div'); d.appendChild(C.el('b', null, x.c)); d.appendChild(C.el('i', null, x.t)); v.appendChild(d); });
          } else {
            v = C.itemEdit(C.el('div', 'tk-v', C.value(it, st)), it); v.style.fontSize = (half ? PTH : PTF)[it.size] * fs + 'pt';
            if (it.align === 'center') v.className += ' al-c';
            if (it.color === 'accent') v.className += ' ac';
            fitT(v, 8);
          }
          b.appendChild(v); row.appendChild(b);
        });
        blocks.appendChild(row);
      });

      /* ---- 半券 ---- */
      var sh = C.el('div', 'tk-sh'); stub.appendChild(sh);
      if (V.markOn && V.mark) { var m2 = C.el('div', 'tk-smark', V.mark); fitT(m2, 6); sh.appendChild(m2); }
      sh.appendChild(C.el('div', 'tk-sub', '控え'));
      function sblock(it, cls, pt, min) {
        var d = C.item(C.el('div', 'tk-sb ' + cls), it); d.appendChild(C.el('div', 'tk-sl', it.label));
        var v = C.el('div', 'tk-sv', C.value(it, st)); v.style.fontSize = pt + 'pt'; fitT(v, min); d.appendChild(v); stub.appendChild(d);
      }
      if (num) sblock(num, 'num', 24, 10);
      if (nm) sblock(nm, '', 12, 7);
      if (dt) sblock(dt, '', 9.5, 6);
      var vn = pickVis(V, /試験場|会場/);
      if (vn && vn !== num && vn !== nm) sblock(vn, '', 9.5, 6);
      stub.appendChild(C.el('div', 'tk-sp'));
      var bcw = C.el('div', 'tk-bc'); bcw.appendChild(barcode(C, num ? C.value(num, st) : ''));
      bcw.appendChild(C.el('div', 'tk-bn', num ? C.value(num, st) : '')); stub.appendChild(bcw);

      var wm = C.watermark(V, { top: tkTop, height: tkH });
      if (wm) { if (V.wmAcc) wm.style.color = V.secondary; t.appendChild(wm); }
      var fo = C.fold(V); if (fo) t.appendChild(fo);

      /* ---- 下部：注意事項＋画像 ---- */
      var nt = Math.max(tkTop + tkH + 8, V.foldPos + 9), zone = C.el('div', 'tk-zone'); zone.style.top = nt + 'mm'; t.appendChild(zone);
      var im = C.images(V), hasIm = !!(im.map || im.logo);
      var body = C.el('div', 'tk-body'); zone.appendChild(body);
      var left = C.el('div', 'tk-lft'); body.appendChild(left);
      if (V.noteTitle) left.appendChild(C.edit(C.el('div', 'tk-nh', V.noteTitle), 'noteTitle'));
      var ns = C.el('div', 'tk-notes'); left.appendChild(ns);
      C.notes(V).forEach(function (n) {
        var d = C.el('div', 'tk-n' + (n.accent ? ' r' : '')); d.appendChild(C.el('i')); d.appendChild(C.el('span', null, n.text)); ns.appendChild(d);
      });
      t._shr.push({ el: ns, maxMm: 288 - nt - (V.noteTitle ? 12 : 2), pt: 9 });
      if (hasIm) {
        var ri = C.el('div', 'tk-im');
        if (im.map) { var w1 = C.el('div', 'mp'), i1 = C.el('img'); i1.src = im.map; i1.alt = ''; w1.appendChild(i1); ri.appendChild(w1); }
        if (im.logo) { var i2 = C.el('img', 'lg'); i2.src = im.logo; i2.alt = ''; ri.appendChild(i2); }
        body.appendChild(ri);
      }
      post(t, C);
      return t;
    },
    styles: [
      '.tpl-ticket{padding:0;display:block;line-height:1.35;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.tpl-ticket .tk{position:absolute;left:12mm;top:12mm;width:186mm;background:var(--tac);border-radius:4mm;overflow:hidden;color:#fff;display:flex}',
      '.tpl-ticket .tk-main{position:relative;flex:none;width:131mm;height:100%;padding:7mm 8mm 7mm 9mm;display:flex;flex-direction:column;background:radial-gradient(circle at 100% 0,rgba(255,255,255,.1) 0 34mm,transparent 34.3mm),radial-gradient(circle at 78% 0,rgba(255,255,255,.07) 0 22mm,transparent 22.3mm)}',
      '.tpl-ticket .tk-stub{position:relative;flex:1;min-width:0;height:100%;padding:7mm 6mm 7mm 6.5mm;display:flex;flex-direction:column;background:rgba(0,0,0,.14)}',
      '.tpl-ticket .tk-perf{position:absolute;left:131mm;top:4.5mm;bottom:4.5mm;width:0;border-left:1.2pt dashed rgba(255,255,255,.75)}',
      '.tpl-ticket .tk-notch{position:absolute;left:127.5mm;width:7mm;height:7mm;border-radius:50%;background:#fff}',
      '.tpl-ticket .tk-notch.t{top:-3.5mm}.tpl-ticket .tk-notch.b{bottom:-3.5mm}',
      '.tpl-ticket .tk-top{display:flex;align-items:center;justify-content:space-between;height:7mm;flex:none;gap:3mm}',
      '.tpl-ticket .tk-badge{max-width:62mm;height:6mm;line-height:6mm;padding:0 3mm;border-radius:3mm;background:var(--tac2);color:var(--tac);font-family:' + HF + ';font-weight:800;font-size:8pt;letter-spacing:.06em;white-space:nowrap;overflow:hidden}',
      '.tpl-ticket .tk-mark{max-width:26mm;overflow:hidden;white-space:nowrap;font-family:' + HF + ';font-weight:800;font-size:13pt;letter-spacing:.14em;color:rgba(255,255,255,.88);line-height:1.3;margin-right:-.14em}',
      '.tpl-ticket .tk-hrow{display:flex;align-items:center;justify-content:space-between;gap:5mm;height:20mm;flex:none;margin-top:2mm}',
      '.tpl-ticket .tk-title{flex:1;min-width:0}',
      '.tpl-ticket .tk-tl{display:block;overflow:hidden;white-space:nowrap;font-family:' + HF + ';font-weight:800;font-size:20pt;line-height:1.28;letter-spacing:.02em}',
      '.tpl-ticket .tk-pill{flex:none;width:47mm;height:18mm;border-radius:9mm;background:var(--tac2);color:var(--tac);padding:1.6mm 4mm 0;text-align:center;overflow:hidden}',
      '.tpl-ticket .tk-pill em{display:block;font-style:normal;font-weight:700;font-size:6.5pt;letter-spacing:.18em;line-height:1.2;white-space:nowrap}',
      '.tpl-ticket .tk-pv{display:block;overflow:hidden;white-space:nowrap;font-family:' + HF + ';font-weight:800;line-height:1.2;letter-spacing:.06em;font-variant-numeric:tabular-nums}',
      '.tpl-ticket .tk-blocks{flex:1;min-height:0;display:flex;flex-direction:column;gap:1.8mm;margin-top:3mm}',
      '.tpl-ticket .tk-row{display:flex;gap:1.8mm;min-height:0}',
      '.tpl-ticket .tk-b{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;padding:0 3.2mm;border-radius:2.6mm;background:rgba(255,255,255,.14)}',
      '.tpl-ticket .tk-l{font-size:6.5pt;font-weight:500;letter-spacing:.14em;color:rgba(255,255,255,.72);white-space:nowrap;line-height:1.3}',
      '.tpl-ticket .tk-v{overflow:hidden;white-space:nowrap;font-family:' + HF + ';font-weight:800;line-height:1.3;letter-spacing:.03em}',
      '.tpl-ticket .tk-v.al-c{text-align:center}.tpl-ticket .tk-v.ac,.tpl-ticket .tk-sv.ac{color:var(--tac2)}',
      '.tpl-ticket .tk-sch{display:flex;flex-direction:column;justify-content:center;line-height:1.4;margin-top:.4mm}',
      '.tpl-ticket .tk-sch div{display:flex;gap:4mm;white-space:nowrap}',
      '.tpl-ticket .tk-sch b{flex:none;width:20mm;font-family:' + HF + ';font-weight:800}',
      '.tpl-ticket .tk-sch i{font-style:normal;font-weight:700;letter-spacing:.08em;font-variant-numeric:tabular-nums}',
      '.tpl-ticket .tk-sh{display:flex;align-items:baseline;justify-content:space-between;gap:2mm;height:7mm;flex:none;white-space:nowrap}',
      '.tpl-ticket .tk-smark{max-width:24mm;overflow:hidden;font-family:' + HF + ';font-weight:800;font-size:12pt;letter-spacing:.1em;color:var(--tac2);line-height:1.3}',
      '.tpl-ticket .tk-sub{font-size:7pt;font-weight:700;letter-spacing:.3em;color:rgba(255,255,255,.75);margin-left:auto}',
      '.tpl-ticket .tk-sb{margin-top:3.6mm;flex:none}',
      '.tpl-ticket .tk-sl{font-size:6.5pt;font-weight:500;letter-spacing:.14em;color:rgba(255,255,255,.72);line-height:1.3;white-space:nowrap}',
      '.tpl-ticket .tk-sv{display:block;overflow:hidden;white-space:nowrap;font-family:' + HF + ';font-weight:800;line-height:1.3;letter-spacing:.04em;font-variant-numeric:tabular-nums}',
      '.tpl-ticket .tk-sb.num .tk-sv{color:var(--tac2);letter-spacing:.06em}',
      '.tpl-ticket .tk-sp{flex:1}',
      '.tpl-ticket .tk-bc{flex:none}',
      '.tpl-ticket .tk-bars{display:flex;height:15mm;width:100%}',
      '.tpl-ticket .tk-bars i{display:block;flex-basis:0;min-width:0}.tpl-ticket .tk-bars i.b{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.tpl-ticket .tk-bn{margin-top:1.2mm;font-size:6.5pt;letter-spacing:.34em;text-align:center;color:rgba(255,255,255,.85);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden}',
      '.tpl-ticket .tk-zone{position:absolute;left:14mm;width:182mm}',
      '.tpl-ticket .tk-body{display:flex;gap:9mm;align-items:flex-start}',
      '.tpl-ticket.sw .tk-body{flex-direction:row-reverse}',
      '.tpl-ticket .tk-lft{flex:1;min-width:0}',
      '.tpl-ticket .tk-nh{display:inline-block;height:6.6mm;line-height:6.6mm;padding:0 4mm;border-radius:3.3mm;background:var(--tac);color:#fff;font-family:' + HF + ';font-weight:800;font-size:10pt;letter-spacing:.12em;margin-bottom:4mm;white-space:nowrap}',
      '.tpl-ticket .tk-notes{font-size:9pt;line-height:1.7;line-break:strict;text-wrap:pretty;color:#222}',
      '.tpl-ticket .tk-n{display:flex;gap:2.6mm;margin:0 0 1.6mm}',
      '.tpl-ticket .tk-n i{flex:none;width:1.8mm;height:1.8mm;margin-top:2.1mm;border-radius:.6mm;background:var(--tac);opacity:.5}',
      '.tpl-ticket .tk-n span{flex:1;min-width:0}',
      '.tpl-ticket .tk-n.r i{opacity:1}.tpl-ticket .tk-n.r span{font-weight:700;color:var(--tac)}',
      '.tpl-ticket .tk-im{flex:none;width:64mm;padding-top:1mm}',
      '.tpl-ticket .tk-im .mp{border:.6pt solid #d9d4ee;border-radius:3mm;overflow:hidden;padding:2mm;background:#fff}',
      '.tpl-ticket .tk-im img{display:block;width:100%;height:auto}',
      '.tpl-ticket .tk-im img.lg{margin-top:4mm;max-height:12mm;width:auto;max-width:100%;object-fit:contain}',
      '.tpl-ticket .jt-fold{font-size:7.5pt;letter-spacing:.3em;color:#555;left:0}',
      '.tpl-ticket .jt-fold span{border-top:.7pt dashed #777}'
    ].join('\n')
  });
})();
