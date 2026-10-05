/* シンプル：項目を上から順に並べる白黒の受験票（写真欄・控えも選べる） */
(function () {
  var JT = JukenTemplates;
  var SZ = { S: 11, M: 14, L: 22, XL: 30 };
  var NOTES_S = 'この受験票は試験当日必ず持参してください。\n集合時刻に遅れないように来場してください。\n試験中は携帯電話・スマートフォンの電源を切ってください。';
  function simpleItems(o) {
    o = o || {};
    var m = JT.mkItem, a = (typeof o.astart === 'number' ? o.astart : 1);
    var its = [
      m('受験番号', 'column', { column: '受験番号', width: 'half', size: 'L', autoEmpty: true, auto: { prefix: String(o.apre || ''), start: a, digits: Math.max(1, +o.adig || 3) } }),
      m('氏名', 'column', { column: '氏名', width: 'half', size: 'L' }),
      m('カナ氏名', 'column', { column: 'カナ氏名', size: 'M' }),
      m('学校名', 'column', { column: '学校名', width: 'half' }),
      m('学年', 'column', { column: '学年', width: 'half' })];
    if (o.school) its.unshift(m('主催', 'fixed', { value: String(o.school) }));
    its.push(m('実施日', 'date', { value: typeof o.date === 'string' ? o.date : '' }));
    its.push(m('集合時刻', 'fixed', { value: typeof o.time === 'string' ? o.time : '09:00' }));
    its.push(m('会場', 'fixed', { value: String(o.place || '') }));
    its.push(m('試験時間', 'schedule', { rows: Array.isArray(o.sched) ? o.sched : [{ t: '09:00〜10:00', c: '国語' }, { t: '10:20〜11:20', c: '数学' }] }));
    return its;
  }
  JT.register({
    id: 'simple',
    name: 'シンプル',
    category: 'ベーシック',
    description: '項目を上から順に並べる白黒の受験票。持ち物・写真欄・控えを付けられます。',
    swatch: ['#000000', '#ffffff', '#eeeeee'],
    uses: ['header', 'notes', 'accent', 'secondary', 'font'],
    defaults: { hdr: '校内実力テスト', accent: '#000000', secondary: '#eeeeee', font: 'mincho', notes: NOTES_S, noteTitle: '注意事項' },
    extras: [
      { k: 'belongings', type: 'lines', label: '持ち物（1行1項目）', def: '筆記用具\n消しゴム\n時計（通信機能のないもの）' },
      { k: 'contact', type: 'text', label: '問い合わせ先（1行）', def: '' },
      { k: 'photo', type: 'check', label: '写真貼付欄を表示', def: false },
      { k: 'stub', type: 'check', label: '切り取り線＋控え（試験官用）', def: false }
    ],
    legacyKeys: ['school', 'title', 'date', 'time', 'place', 'sched', 'contact', 'photo', 'stub', 'apre', 'astart', 'adig'],
    /* 旧形式（title/school/date/time/place/sched/items=持ち物の文字列…）→ 共通スキーマ */
    migrate: function (o) {
      var old = typeof o.items === 'string' || (!Array.isArray(o.items) && ['title', 'school', 'place', 'sched', 'time', 'apre', 'astart', 'adig'].some(function (k) { return k in o; }));
      if (!old) return o;
      return {
        hdr: typeof o.title === 'string' ? o.title : '校内実力テスト',
        accent: '#000000', secondary: '#eeeeee', font: 'mincho',
        notes: typeof o.notes === 'string' ? o.notes : NOTES_S,
        items: simpleItems(o),
        tpl: { simple: {
          belongings: typeof o.items === 'string' ? o.items : undefined,
          contact: typeof o.contact === 'string' ? o.contact : undefined,
          photo: typeof o.photo === 'boolean' ? o.photo : undefined,
          stub: typeof o.stub === 'boolean' ? o.stub : undefined } }
      };
    },
    render: function (st, V, C) {
      var X = V.tpl.simple, t = C.page('simple', V);
      var m = C.el('div', 's-main');
      var h = C.el('div', 's-head'); h.appendChild(C.el('div', 's-lab', '受験票'));
      var ti = C.edit(C.el('div', 's-title', V.hdr || ''), 'hdr'); h.appendChild(ti); C.fitText(t, ti); m.appendChild(h);
      var tbl = null, first = true;
      function flush() {
        if (!tbl) return;
        var top = C.el('div', 's-top'); top.appendChild(tbl);
        if (first && X.photo) top.appendChild(C.el('div', 's-photo', '写真\n（縦4cm×横3cm）'));
        m.appendChild(top); tbl = null; first = false;
      }
      C.rows(V).forEach(function (row) {
        if (row[0].source === 'schedule') {
          flush();
          var rs = C.sched(row[0]); if (!rs.length) return;
          var w = C.el('div'); C.item(w, row[0]); w.appendChild(C.el('div', 's-h', row[0].label || '時間割'));
          var tb = C.el('table', 's-sch');
          rs.forEach(function (r) { var tr = document.createElement('tr'); tr.appendChild(C.el('th', null, r.t)); tr.appendChild(C.el('td', null, r.c)); tb.appendChild(tr); });
          w.appendChild(tb); m.appendChild(w); return;
        }
        var r = C.el('div', 's-r'), any = false;
        row.forEach(function (it) {
          var val = C.value(it, st);
          if (!val && (it.source === 'fixed' || it.source === 'date')) return;
          any = true;
          var c = C.el('div', 's-c'); C.item(c, it);
          c.appendChild(C.el('div', 's-k', it.label));
          var v = C.el('div', 's-v' + (it.color === 'accent' ? ' ac' : ''), val); C.itemEdit(v, it);
          v.style.fontSize = SZ[it.size] + 'pt'; if (it.align === 'center') v.style.textAlign = 'center';
          if (it.size === 'L' || it.size === 'XL') v.style.fontWeight = '700';
          c.appendChild(v); C.fitText(t, v); r.appendChild(c);
        });
        if (any) { if (!tbl) tbl = C.el('div', 's-tbl'); tbl.appendChild(r); }
      });
      flush();
      var bl = C.lines(X.belongings);
      if (bl.length) { var w2 = C.el('div'); w2.appendChild(C.el('div', 's-h', '持ち物')); var u = C.el('ul', 's-list'); bl.forEach(function (x) { u.appendChild(C.el('li', null, x)); }); w2.appendChild(u); m.appendChild(w2); }
      var nt = C.notes(V);
      if (nt.length) {
        var w3 = C.el('div'); if (V.noteTitle) w3.appendChild(C.edit(C.el('div', 's-h', V.noteTitle), 'noteTitle'));
        var o = C.el('ol', 's-list'); nt.forEach(function (n) { o.appendChild(C.el('li', n.accent ? 'r' : '', n.text)); }); w3.appendChild(o); m.appendChild(w3);
      }
      if (X.contact) m.appendChild(C.el('div', 's-foot', 'お問い合わせ：' + X.contact));
      t.appendChild(m);
      if (X.stub) {
        var sb = C.el('div', 's-stub'); sb.appendChild(C.el('div', 's-cut', '✂'));
        var a = C.el('div', 's-lab', '受験票（控え）'); a.style.textAlign = 'left'; a.style.letterSpacing = '.3em'; sb.appendChild(a);
        var no = C.findItem(V, /受験番号/), nm = C.findItem(V, /氏名|名前/, /カナ|フリガナ|ふりがな/);
        [no, nm].forEach(function (it) {
          if (!it) return;
          var c = C.el('div', 's-c'); c.appendChild(C.el('div', 's-k', it.label));
          var v = C.el('div', 's-v', C.value(it, st)); v.style.fontSize = (it === no ? 24 : 20) + 'pt'; v.style.fontWeight = '700';
          c.appendChild(v); C.fitText(t, v); sb.appendChild(c);
        });
        var ex = C.findItem(V, /試験日|実施日/), line = [V.hdr, ex ? C.value(ex, st) : ''].filter(Boolean).join('　');
        if (line) sb.appendChild(C.el('div', null, line));
        t.appendChild(sb);
      }
      return t;
    },
    styles: [
      '.tpl-simple{padding:15mm;display:flex;flex-direction:column}',
      '.tpl-simple .s-main{flex:1;min-height:0;display:flex;flex-direction:column;gap:3.5mm}',
      '.tpl-simple .s-head{text-align:center;border-bottom:1.2mm double var(--tac);padding-bottom:3mm}',
      '.tpl-simple .s-lab{font-size:13pt;letter-spacing:.6em;white-space:nowrap;font-weight:700}',
      '.tpl-simple .s-title{font-size:22pt;font-weight:700;margin-top:1mm;white-space:nowrap;overflow:hidden}',
      '.tpl-simple .s-top{display:flex;gap:3mm;align-items:stretch}',
      '.tpl-simple .s-tbl{flex:1;min-width:0;border:.6mm solid var(--tac)}',
      '.tpl-simple .s-r{display:flex}.tpl-simple .s-r+.s-r{border-top:.3mm solid var(--tac)}',
      '.tpl-simple .s-c{flex:1;min-width:0;display:flex;align-items:baseline;gap:4mm;padding:2mm 4mm}',
      '.tpl-simple .s-c+.s-c{border-left:.3mm solid var(--tac)}',
      '.tpl-simple .s-k{font-size:9pt;width:20mm;flex:none;white-space:nowrap}',
      '.tpl-simple .s-v{flex:1;min-width:0;white-space:nowrap;overflow:hidden;line-height:1.3}',
      '.tpl-simple .s-v.ac{color:var(--tac);font-weight:700}',
      '.tpl-simple .s-photo{width:30mm;flex:none;border:.3mm solid var(--tac);display:flex;align-items:center;justify-content:center;font-size:8pt;text-align:center;color:#444;white-space:pre-line}',
      '.tpl-simple .s-h{font-weight:700;font-size:10.5pt;border-left:1.5mm solid var(--tac);padding-left:2mm;margin-bottom:1mm;white-space:nowrap}',
      '.tpl-simple .s-sch{border-collapse:collapse;width:100%}',
      '.tpl-simple .s-sch th,.tpl-simple .s-sch td{border:.3mm solid var(--tac);padding:1.5mm 3mm;text-align:left;font-size:12pt}',
      '.tpl-simple .s-sch th{width:42mm;background:var(--tac2);font-weight:400;white-space:nowrap}',
      '.tpl-simple .s-list{margin:0;padding-left:6mm;font-size:10pt}',
      '.tpl-simple ul.s-list{padding-left:5mm}',
      '.tpl-simple .s-list li.r{font-weight:700}',
      '.tpl-simple .s-foot{margin-top:auto;border-top:.3mm solid #000;padding-top:2mm;font-size:9.5pt;white-space:pre-line}',
      '.tpl-simple .s-stub{height:72mm;margin:3mm 0 0;border-top:.4mm dashed #000;position:relative;padding-top:6mm;display:flex;flex-direction:column;gap:2mm;flex:none}',
      '.tpl-simple .s-cut{position:absolute;top:-3.6mm;left:6mm;background:#fff;padding:0 2mm;font-size:12pt;line-height:1}'
    ].join('\n')
  });
})();
