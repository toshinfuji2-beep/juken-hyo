/* モダン・グリッド：スイス・タイポグラフィ。巨大な受験番号＋横罫だけの項目表＋2段組の注意事項 */
(function () {
  var JT = JukenTemplates, ID = 'modern-grid';
  /* Webフォント（Google Fonts のみ）。<link> を一度だけ差し込む */
  (function () {
    var lid = 'jt-font-' + ID;
    if (document.getElementById(lid)) return;
    var l = document.createElement('link'); l.id = lid; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@500;800;900&family=Noto+Sans+JP:wght@400;500;700;900&display=swap';
    document.head.appendChild(l);
  })();

  var FF = '"Noto Sans JP","Yu Gothic","Meiryo","Hiragino Sans",sans-serif';
  var NF = '"Inter","Noto Sans JP","Yu Gothic",sans-serif';
  var EN = { '受験番号': 'EXAM NO.', '氏名': 'NAME', 'カナ氏名': 'NAME (KANA)', '試験日': 'DATE', '実施日': 'DATE', '試験場': 'VENUE', '試験会場': 'VENUE', '会場': 'VENUE', '教室': 'ROOM', '入試制度': 'EXAM', '志望学部': 'FACULTY', '志望校': 'TARGET', '試験時間': 'SCHEDULE', '学校名': 'SCHOOL', '学年': 'GRADE', '集合時刻': 'MEET AT', '主催': 'HOST' };
  var PT = { S: 11, M: 14, L: 17, XL: 20 };

  /* フォント読み込み後・表示後に縮小を再計算（アプリ側の fit は表示直後で、フォント未読込のことがあるため） */
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
    while (a.length > (max || 2)) {   /* 行数の上限：隣り合う短い行を連結 */
      var bi = 0, bl = 1e9;
      for (var i = 0; i < a.length - 1; i++) { var l = a[i].length + a[i + 1].length; if (l < bl) { bl = l; bi = i; } }
      a.splice(bi, 2, a[bi] + ' ' + a[bi + 1]);
    }
    return a;
  }

  JT.register({
    id: ID,
    name: 'モダン・グリッド',
    category: 'モダン',
    description: '巨大な受験番号と横罫だけの項目表。スイス・タイポグラフィ風のオレンジ×黒。',
    swatch: ['#FF4F00', '#111111', '#ffffff'],
    defaults: { accent: '#FF4F00', secondary: '#111111', font: 'gothic', hdr: '2024年度　早稲田大学受験票', badge: '折って試験当日持参', badgeOn: true, mark: '24早', markOn: true, foldOn: true, wmAcc: false, wmColor: '#111111', wmOp: 8 },
    uses: ['header', 'badge', 'mark', 'accent', 'secondary', 'fold', 'notes', 'swap', 'images', 'wm'],
    render: function (st, V, C) {
      var t = C.page(ID, V, V.swap ? 'sw' : ''); t._shr = [];
      t.style.fontFamily = C.pickFont(V, FF, FF); t.style.setProperty('--ink', V.secondary);
      function fitT(e, min) { e._fs0 = e.style.fontSize; return C.fitText(t, e, min); }
      var num = pickVis(V, /受験番号|^番号$|^No\.?$/i, /カナ|氏名/);
      var nm = pickVis(V, /氏名|名前/, /カナ|フリガナ|ふりがな/) || pickVis(V, /氏名|名前/);
      if (nm === num) nm = null;
      var dt = V.items.filter(function (i) { return !i.hidden && i.source === 'date'; })[0] || null;
      var rest = V.items.filter(function (i) { return !i.hidden && i !== num && i !== nm && i !== dt; });
      var V2 = {}; for (var k0 in V) V2[k0] = V[k0]; V2.items = rest;

      /* ---- ヒーロー ---- */
      var hero = C.el('div', 'mg-hero'); t.appendChild(hero);
      var L = C.el('div', 'mg-l'), R = C.el('div', 'mg-r'); hero.appendChild(L); hero.appendChild(R);
      function lab(it) { var d = C.el('div', 'mg-lab'); d.appendChild(C.el('b', null, EN[it.label] || '')); d.appendChild(C.el('span', null, it.label)); return d; }
      function titleEl(cls) {
        var ti = C.edit(C.el('div', cls), 'hdr'), ss = segs(V.hdr);
        ss.forEach(function (s) { var d = C.el('div', 'mg-tl', s); fitT(d, 8); ti.appendChild(d); });
        return ti;
      }
      if (num) {
        var nb = C.item(C.el('div', 'mg-nbox'), num); nb.appendChild(lab(num));
        var nv = C.itemEdit(C.el('div', 'mg-num', C.value(num, st)), num);
        nv.style.fontSize = ({ S: 30, M: 38, L: 48, XL: 48 })[num.size] + 'mm'; nv.style.height = ({ S: 25, M: 31, L: 40, XL: 40 })[num.size] + 'mm'; nv.style.lineHeight = nv.style.height;
        fitT(nv, 18); nb.appendChild(nv); L.appendChild(nb);
      } else L.appendChild(titleEl('mg-title big'));
      if (nm) {
        var nb2 = C.item(C.el('div', 'mg-nmbox'), nm); nb2.appendChild(lab(nm));
        var nv2 = C.itemEdit(C.el('div', 'mg-nm', C.value(nm, st)), nm); nv2.style.fontSize = ({ S: 14, M: 18, L: 22, XL: 26 })[nm.size] + 'pt';
        if (nm.color === 'accent') nv2.className += ' ac';
        fitT(nv2, 9); nb2.appendChild(nv2); L.appendChild(nb2);
      }
      /* 右：バッジ・マーク・試験名・日付 */
      if (V.badgeOn && V.badge) { var bg = C.edit(C.el('div', 'mg-badge', V.badge), 'badge'); fitT(bg, 6); R.appendChild(bg); }
      var sq = C.el('div', 'mg-sq'); R.appendChild(sq);
      if (V.markOn && V.mark) { var mk = C.edit(C.el('span', 'mg-mk', V.mark), 'mark'); fitT(mk, 6); sq.appendChild(mk); }
      if (num) R.appendChild(titleEl('mg-title'));
      if (dt) {
        var db = C.item(C.el('div', 'mg-dbox'), dt); db.appendChild(lab(dt));
        var dv = C.itemEdit(C.el('div', 'mg-date', C.value(dt, st)), dt); dv.style.fontSize = PT[dt.size] * 0.9 + 'pt';
        if (dt.color === 'accent') dv.className += ' ac';
        fitT(dv, 8); db.appendChild(dv); R.appendChild(db);
      }

      /* ---- 項目表 ---- */
      var top = 78, bottom = Math.max(100, Math.min(V.foldPos - 4, 210)), avail = bottom - top;
      var tb = C.el('div', 'mg-tbl'); tb.style.top = top - 2 + 'mm'; t.appendChild(tb);
      var rows = C.rows(V2), nat = [], tot = 0;
      rows.forEach(function (r) {
        var sch = r.some(function (i) { return i.source === 'schedule'; }), h;
        if (sch) { var n = Math.max.apply(null, r.map(function (i) { return i.source === 'schedule' ? C.sched(i).length : 0; })); h = Math.max(13, n * (C.SIZE.sch[r[0].size] * 0.8 * 0.353 * 1.45) + 5); }
        else h = r.length > 1 ? 15.5 : 12.5;
        nat.push(h); tot += h;
      });
      var H = Math.min(tot, avail), kk = tot ? H / tot : 1, fs = Math.max(0.62, Math.min(1, kk * 1.06));
      tb.style.height = H + 'mm';
      rows.forEach(function (r, ri) {
        var row = C.el('div', 'mg-row' + (r.length > 1 ? ' two' : '')); row.style.flex = nat[ri] + ' 1 0';
        r.forEach(function (it) {
          var cell = C.item(C.el('div', 'mg-cell'), it); cell.appendChild(lab(it));
          var v;
          if (it.source === 'schedule') {
            v = C.el('div', 'mg-sch'); var sp = C.SIZE.sch[it.size] * 0.8 * fs; v.style.fontSize = sp + 'pt';
            C.sched(it).forEach(function (x) { var d = C.el('div'); d.appendChild(C.el('b', null, x.c)); d.appendChild(C.el('i', null, x.t)); v.appendChild(d); });
          } else {
            v = C.itemEdit(C.el('div', 'mg-v', C.value(it, st)), it); v.style.fontSize = PT[it.size] * fs + 'pt';
            if (it.align === 'center') v.className += ' al-c';
            if (it.color === 'accent') v.className += ' ac';
            fitT(v, 8);
          }
          cell.appendChild(v); row.appendChild(cell);
        });
        tb.appendChild(row);
      });
      var wm = C.watermark(V, { top: top, height: H }); if (wm) t.appendChild(wm);
      var fo = C.fold(V); if (fo) t.appendChild(fo);

      /* ---- 下部：注意事項（2段組）＋画像 ---- */
      var nt = Math.max(bottom + 12, V.foldPos + 9), zone = C.el('div', 'mg-zone'); zone.style.top = nt + 'mm'; t.appendChild(zone);
      var im = C.images(V), hasIm = !!(im.map || im.logo);
      var hd = C.el('div', 'mg-nh'); if (V.noteTitle) { hd.appendChild(C.edit(C.el('span', null, V.noteTitle), 'noteTitle')); hd.appendChild(C.el('em', null, 'NOTICE')); } zone.appendChild(hd);
      var body = C.el('div', 'mg-body'); zone.appendChild(body);
      var ns = C.el('div', 'mg-notes' + (hasIm ? ' one' : '')); body.appendChild(ns);
      C.notes(V).forEach(function (n, i) {
        var d = C.el('div', 'mg-n' + (n.accent ? ' r' : ''));
        d.appendChild(C.el('b', null, (i < 9 ? '0' : '') + (i + 1))); d.appendChild(C.el('span', null, n.text)); ns.appendChild(d);
      });
      var maxH = 288 - nt - 12;
      t._shr.push({ el: ns, maxMm: maxH, pt: 9 });
      if (hasIm) {
        var ri = C.el('div', 'mg-im');
        if (im.map) { var i1 = C.el('img'); i1.src = im.map; i1.alt = ''; ri.appendChild(i1); }
        if (im.logo) { var i2 = C.el('img', 'lg'); i2.src = im.logo; i2.alt = ''; ri.appendChild(i2); }
        body.appendChild(ri);
      }
      post(t, C);
      return t;
    },
    styles: [
      '.tpl-modern-grid{padding:0;display:block;line-height:1.35;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.tpl-modern-grid .mg-hero{position:absolute;left:14mm;top:12mm;width:182mm;height:56mm}',
      '.tpl-modern-grid .mg-l{position:absolute;left:0;top:0;width:106mm}',
      '.tpl-modern-grid .mg-r{position:absolute;left:112mm;top:0;width:70mm;height:56mm}',
      '.tpl-modern-grid .mg-lab{display:flex;align-items:baseline;gap:2mm;white-space:nowrap;line-height:1.2}',
      '.tpl-modern-grid .mg-lab b{font-family:' + NF + ';font-weight:800;font-size:6.5pt;letter-spacing:.14em}',
      '.tpl-modern-grid .mg-lab span{font-size:7.5pt;font-weight:500;color:#666;letter-spacing:.08em}',
      '.tpl-modern-grid .mg-nbox .mg-lab b{color:var(--tac)}',
      '.tpl-modern-grid .mg-num{display:block;overflow:hidden;white-space:nowrap;color:var(--tac);font-family:' + NF + ';font-weight:900;letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin:1mm 0 0 -1.2mm}',
      '.tpl-modern-grid .mg-nmbox{margin-top:2mm}',
      '.tpl-modern-grid .mg-nm{display:block;overflow:hidden;white-space:nowrap;font-weight:900;line-height:1.35;letter-spacing:.04em;margin-top:.6mm}',
      '.tpl-modern-grid .mg-nm.ac,.tpl-modern-grid .mg-v.ac,.tpl-modern-grid .mg-date.ac{color:var(--tac)}',
      '.tpl-modern-grid .mg-badge{position:absolute;left:0;top:0;max-width:54mm;height:6mm;line-height:6mm;padding:0 2.6mm;background:var(--ink);color:#fff;font-size:7.5pt;font-weight:700;letter-spacing:.08em;white-space:nowrap;overflow:hidden}',
      '.tpl-modern-grid .mg-sq{position:absolute;right:0;top:0;width:12mm;height:12mm;background:var(--tac);color:#fff;display:flex;align-items:center;justify-content:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.tpl-modern-grid .mg-mk{display:block;max-width:10.4mm;overflow:hidden;white-space:nowrap;font-size:9pt;font-weight:900;text-align:center;letter-spacing:.02em;line-height:1.3}',
      '.tpl-modern-grid .mg-r>div.mg-title{position:absolute;left:0;top:16mm;width:70mm}',
      '.tpl-modern-grid .mg-title .mg-tl{display:block;overflow:hidden;white-space:nowrap;font-size:16pt;font-weight:900;line-height:1.3;letter-spacing:.02em}',
      '.tpl-modern-grid .mg-title.big .mg-tl{font-size:30pt;letter-spacing:.01em}',
      '.tpl-modern-grid .mg-dbox{position:absolute;left:0;bottom:0;width:70mm}',
      '.tpl-modern-grid .mg-date{display:block;overflow:hidden;white-space:nowrap;font-weight:900;line-height:1.4;letter-spacing:.02em;font-variant-numeric:tabular-nums;margin-top:.6mm}',
      '.tpl-modern-grid .mg-tbl{position:absolute;left:14mm;width:182mm;margin-top:0;border-top:2.5pt solid var(--ink);padding-top:0;display:flex;flex-direction:column}',
      '.tpl-modern-grid .mg-row{display:flex;gap:8mm;align-items:stretch;min-height:0;border-bottom:.6pt solid var(--ink)}',
      '.tpl-modern-grid .mg-row:last-child{border-bottom:1pt solid var(--ink)}',
      '.tpl-modern-grid .mg-cell{flex:1;min-width:0;display:flex;align-items:center;gap:4mm;padding:0}',
      '.tpl-modern-grid .mg-row:not(.two) .mg-lab{flex:none;width:36mm;flex-direction:column;align-items:flex-start;gap:.3mm}',
      '.tpl-modern-grid .mg-row.two .mg-cell{flex-direction:column;align-items:stretch;justify-content:center;gap:.8mm}',
      '.tpl-modern-grid .mg-v{flex:1;min-width:0;overflow:hidden;white-space:nowrap;font-weight:700;line-height:1.35;letter-spacing:.03em}',
      '.tpl-modern-grid .mg-v.al-c{text-align:center}',
      '.tpl-modern-grid .mg-sch{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;line-height:1.4}',
      '.tpl-modern-grid .mg-sch div{display:flex;gap:4mm;white-space:nowrap}',
      '.tpl-modern-grid .mg-sch b{flex:none;width:24mm;font-weight:700}',
      '.tpl-modern-grid .mg-sch i{font-style:normal;font-family:' + NF + ',' + FF + ';font-weight:500;letter-spacing:.06em;font-variant-numeric:tabular-nums}',
      '.tpl-modern-grid .mg-zone{position:absolute;left:14mm;width:182mm;border-top:2.5pt solid var(--ink)}',
      '.tpl-modern-grid .mg-nh{display:flex;align-items:baseline;gap:3mm;padding:2.2mm 0 3.5mm;white-space:nowrap}',
      '.tpl-modern-grid .mg-nh span{font-size:11pt;font-weight:900;letter-spacing:.12em}',
      '.tpl-modern-grid .mg-nh em{font-style:normal;font-family:' + NF + ';font-weight:800;font-size:6.5pt;letter-spacing:.2em;color:#666}',
      '.tpl-modern-grid .mg-body{display:flex;gap:8mm;align-items:flex-start}',
      '.tpl-modern-grid.sw .mg-body{flex-direction:row-reverse}',
      '.tpl-modern-grid .mg-notes{flex:1;min-width:0;column-count:2;column-gap:8mm;font-size:9pt;line-height:1.6;line-break:strict;text-wrap:pretty}',
      '.tpl-modern-grid .mg-notes.one{column-count:1}',
      '.tpl-modern-grid .mg-n{display:flex;gap:2.2mm;margin:0 0 1.6mm;break-inside:avoid}',
      '.tpl-modern-grid .mg-n b{flex:none;width:5mm;font-family:' + NF + ';font-weight:900;font-size:.95em;letter-spacing:.02em;color:var(--tac)}',
      '.tpl-modern-grid .mg-n span{flex:1;min-width:0}',
      '.tpl-modern-grid .mg-n.r span{font-weight:700;color:var(--tac)}',
      '.tpl-modern-grid .mg-im{flex:none;width:62mm}',
      '.tpl-modern-grid .mg-im img{display:block;width:100%;height:auto}',
      '.tpl-modern-grid .mg-im img.lg{margin-top:4mm;max-height:12mm;width:auto;max-width:100%;object-fit:contain}',
      '.tpl-modern-grid .jt-fold{font-size:7pt;letter-spacing:.3em;color:var(--ink);left:0}',
      '.tpl-modern-grid .jt-fold span{border-top:.5pt dashed var(--ink)}'
    ].join('\n')
  });
})();
