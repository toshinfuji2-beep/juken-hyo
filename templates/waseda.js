/* 早大プレ型：枠線付きの項目表＋折り線＋下半分に注意事項と地図・ロゴ */
JukenTemplates.register({
  id: 'waseda',
  name: '早大プレ型',
  category: 'ベーシック',
  description: '枠線付きの項目表と折り線。下半分に注意事項と地図。折って持参する形式。',
  swatch: ['#C00000', '#ffffff', '#1f2937'],
  defaults: {},                                   /* 共通スキーマの既定値がそのまま早大プレ型の既定値 */
  legacyKeys: ['venue', 'room', 'date', 'system', 'faculty', 'sched'],
  /* 旧形式（固定項目）→ 項目モデル */
  migrate: function (sv) {
    var o = sv, JT = JukenTemplates;
    if (!Array.isArray(o.items)) {
      var its = JT.defItems(), by = {};
      its.forEach(function (i) { by[i.label] = i; });
      if (typeof o.venue === 'string') by['試験場'].value = o.venue;
      if (typeof o.room === 'string') by['教室'].value = o.room;
      if (typeof o.date === 'string') by['試験日'].value = o.date;
      if (typeof o.system === 'string') by['入試制度'].value = o.system;
      if (typeof o.faculty === 'string') by['志望学部'].fallback = o.faculty;
      if (Array.isArray(o.sched)) by['試験時間'].rows = o.sched;
      o.items = its;
    }
    if (o.badgeOn === undefined && o.badge === '') o.badgeOn = false;
    return o;
  },
  render: function (st, V, C) {
    var t = C.page('waseda', V, V.swap ? 'sw' : '');
    var hd = C.el('div', 'w-hd');
    hd.appendChild(C.edit(C.el('span', 'w-hd-t', V.hdr), 'hdr'));
    if (V.badgeOn && V.badge) hd.appendChild(C.edit(C.el('span', 'w-badge', V.badge), 'badge'));
    t.appendChild(hd);
    if (V.markOn && V.mark) t.appendChild(C.edit(C.el('div', 'w-mark', V.mark), 'mark'));
    var tb = C.el('div', 'w-tbl'); t.appendChild(tb);
    var tbH = 0;
    function addRow(its) {
      var half = its.length > 1 || its[0].width === 'half', sch = its.some(function (i) { return i.source === 'schedule'; });
      var h = half && !sch ? 20.8 : 17.8;
      if (sch) {
        var n = Math.max.apply(null, its.map(function (i) { return i.source === 'schedule' ? C.sched(i).length : 0; }));
        h = Math.max(20.4, n * C.SIZE.sch[its[0].size] * 0.46 + 2);
      }
      tbH += h;
      var r = C.el('div', 'w-row'); r.style.height = h + 'mm'; tb.appendChild(r);
      its.forEach(function (it) {
        var wide = it.width !== 'half', c = C.el('div', 'w-c' + (wide ? ' wide' : ''));
        C.item(c, it); c.appendChild(C.el('div', 'w-l', it.label));
        var v = C.el('div', 'w-v');
        if (it.source === 'schedule') {
          v.className += ' w-sch'; v.style.fontSize = C.SIZE.sch[it.size] + 'pt'; v.style.lineHeight = '1.3';
          C.sched(it).forEach(function (x) { var d = C.el('div'); d.appendChild(C.el('b', null, x.c)); d.appendChild(C.el('i', null, x.t)); v.appendChild(d); });
        } else {
          C.itemEdit(v, it); v.textContent = C.value(it, st);
          v.style.fontSize = C.SIZE[wide ? 'full' : 'half'][it.size] + 'pt';
          if (wide) { v.style.lineHeight = h + 'mm'; v.style.letterSpacing = it.source === 'date' ? '.2em' : '.05em'; } else v.style.letterSpacing = '.08em';
          if (it.align === 'left') v.className += ' al-l'; else if (it.align === 'center') v.className += ' al-c';
          if (it.color === 'accent') v.className += ' ac';
          C.fitText(t, v);
        }
        c.appendChild(v); r.appendChild(c);
      });
    }
    C.rows(V).forEach(addRow);
    var wm = C.watermark(V, { top: 22.3, height: tbH }); if (wm) t.appendChild(wm);
    var fo = C.fold(V); if (fo) t.appendChild(fo);
    var lo = C.el('div', 'w-lo');
    if (V.noteTitle) lo.appendChild(C.edit(C.el('div', 'w-nh', V.noteTitle), 'noteTitle'));
    C.notes(V).forEach(function (n) { lo.appendChild(C.el('div', 'w-n' + (n.accent ? ' r' : ''), '・' + n.text)); });
    t.appendChild(lo);
    var ri = C.el('div', 'w-ri'), im = C.images(V);
    if (im.map) { var i1 = C.el('img'); i1.src = im.map; i1.alt = ''; ri.appendChild(i1); }
    if (im.logo) { var i2 = C.el('img'); i2.src = im.logo; i2.alt = ''; ri.appendChild(i2); }
    t.appendChild(ri);
    return t;
  },
  styles: [
    '.tpl-waseda{padding:0;display:block;position:relative;line-height:1.3}',
    '.tpl-waseda .w-hd{position:absolute;left:8mm;top:6.5mm;display:flex;align-items:center;gap:6mm;white-space:nowrap}',
    '.tpl-waseda .w-hd-t{font-size:13pt}',
    '.tpl-waseda .w-badge{background:var(--tac);color:#fff;font-size:13pt;height:8.6mm;line-height:8.6mm;padding:0 4.5mm}',
    '.tpl-waseda .w-mark{position:absolute;right:19mm;top:4mm;font-size:38pt;font-weight:700;letter-spacing:.25em;margin-right:-.25em;line-height:1.2;white-space:nowrap}',
    '.tpl-waseda .w-tbl{position:absolute;left:19.5mm;top:22.3mm;width:171mm;border:1.5pt solid var(--tac);border-bottom:0}',
    '.tpl-waseda .w-row{display:flex;border-bottom:1.5pt solid var(--tac)}',
    '.tpl-waseda .w-c{position:relative;flex:1;min-width:0;height:100%}',
    '.tpl-waseda .w-c+.w-c{border-left:1.5pt solid var(--tac)}',
    '.tpl-waseda .w-l{position:absolute;left:2mm;top:1mm;font-size:10pt;white-space:nowrap}',
    '.tpl-waseda .w-v{position:absolute;left:3mm;right:3mm;top:0;bottom:0;padding-top:5.5mm;white-space:nowrap;overflow:hidden;text-align:center;font-size:26pt;line-height:1.25}',
    '.tpl-waseda .wide .w-l{top:50%;transform:translateY(-50%)}',
    '.tpl-waseda .wide .w-v{left:25mm;text-align:left;padding-top:0;font-size:28pt}',
    '.tpl-waseda .w-v.al-l{text-align:left}.tpl-waseda .w-v.al-c{text-align:center}',
    '.tpl-waseda .w-v.ac{color:var(--tac);font-weight:700}',
    '.tpl-waseda .w-sub{font-size:.4em;line-height:1.1}',
    '.tpl-waseda .w-sch{display:flex;flex-direction:column;justify-content:center;overflow:hidden;padding-top:0}',
    '.tpl-waseda .w-sch div{white-space:nowrap}',
    '.tpl-waseda .w-sch b{display:inline-block;width:15mm;font-weight:400}',
    '.tpl-waseda .w-sch i{font-style:normal;letter-spacing:.22em}',
    '.tpl-waseda .w-lo{position:absolute;left:20mm;top:158.5mm;width:85mm}',
    '.tpl-waseda .w-nh{display:inline-block;background:var(--tac);color:#fff;font-size:13pt;padding:1mm 3.5mm;margin-bottom:4mm}',
    '.tpl-waseda .w-n{font-size:11.5pt;line-height:1.4;padding-left:1.3em;text-indent:-1.3em;margin:0 0 .5mm 1mm;line-break:strict}',
    '.tpl-waseda .w-n.r{color:var(--tac)}',
    '.tpl-waseda .w-ri{position:absolute;left:115mm;top:160mm;width:78mm}',
    '.tpl-waseda.sw .w-lo{left:108mm}.tpl-waseda.sw .w-ri{left:20mm}',
    '.tpl-waseda .w-ri img{display:block;width:100%;height:auto}',
    '.tpl-waseda .w-ri img+img{margin-top:5mm}'
  ].join('\n')
});
