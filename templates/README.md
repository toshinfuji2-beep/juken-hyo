# テンプレート API

受験票のデザイン（テンプレート）は `templates/<id>.js` に1ファイルずつ置きます。ビルドは不要です。

1. `templates/<id>.js` を作り、`JukenTemplates.register({...})` を呼ぶ。
2. `index.html` の `<script src="templates/simple.js"></script>` の下に `<script src="templates/<id>.js"></script>` を1行足す（`api.js` が最初）。
3. かんたんモードのギャラリー（カテゴリ別）と詳細編集の「デザイン」に自動で並びます。

## register の引数

```js
JukenTemplates.register({
  id: 'chic-navy',              // 半角小文字・数字・ハイフン。CSSの .tpl-chic-navy になる
  name: 'シック（紺）',          // 表示名
  category: 'シック',            // ギャラリーの見出し（ベーシック / シック / ポップ / ナチュラル / モダン。新しい名前も可）
  description: '紺の罫線と明朝',  // 任意（カードのツールチップ）
  swatch: ['#1e3a5f', '#ffffff'],// カードに出す代表色
  defaults: { accent: '#1e3a5f', secondary: '#e8edf3', font: 'mincho', hdr: '○○模試　受験票' },
                                 // 共通設定の既定値の上書き（任意）。切り替え時は accent/secondary/font だけ適用される
  uses: ['header','badge','mark','accent','secondary','font','fold','notes','swap','images','wm'],
                                 // 任意。使う共通項目だけ列挙（省略＝すべて）。使わない項目は詳細編集に出ない
  extras: [ { k:'showStub', type:'check', label:'控えを付ける', def:false } ],
                                 // 任意。固有設定。V.tpl['chic-navy'].showStub に入る。型: text check number color select(opts) lines image
  migrate: function (data) { return data; },   // 任意。旧形式のデータを共通スキーマに直す（data は複製済み）
  legacyKeys: [],               // 任意。migrate が読む旧キー名（読み込み時の「未対応の項目」警告を出さないため）
  render: function (student, V, C) { /* A4の1ページ要素を返す */ },
  styles: '.tpl-chic-navy .x{...}' // CSS文字列。必ず .tpl-<id> の下にスコープする
});
```

## 共通設定 V（すべてのテンプレートで同じ）

`render` の第2引数 `V` は常に完全な設定（欠けは既定値）です。キーは `JukenTemplates.FIELDS`、全文は `DESIGN_FORMAT.md` §3。

| キー | 内容 |
|---|---|
| `items[]` | 項目。`{id,label,source:'column'|'fixed'|'date'|'schedule'|'autonumber',column,value,rows[{t,c}],auto,fallback,autoEmpty,width:'full'|'half',size:'S|M|L|XL',color:'black'|'accent',align,hidden}` |
| `hdr` / `badge`,`badgeOn` / `mark`,`markOn` | ヘッダー文字・バッジ・右上マーク |
| `accent` / `secondary` / `font`(`gothic`/`mincho`) | 色・書体 |
| `noteTitle` / `notes` / `swap` | 注意事項の見出し・本文（行頭「!」でアクセント）・左右入れ替え |
| `map` / `logo` | 画像 `{d,hide}` |
| `foldOn`,`foldPos`,`foldLabel` | 折り線 |
| `wmOn`,`wmText`,`wm*` | 透かし |
| `tpl[<id>]` | そのテンプレートの `extras` の値 |

テンプレートを切り替えても `V` の内容と名簿はそのまま残ります（色と書体だけ新テンプレートの既定へ）。

## student（1名分）

`{ idx, row, sample, col(item) }`。値は自分で読まず、`C.value(item, student)` を使う。名簿がない間は `sample:true`（サンプル値が入る）。

## C（ツールキット）

| 関数 | 説明 |
|---|---|
| `C.page(id, V, extraCls)` | A4ページ要素（`.ticket.tpl-<id>`）を作る。`--tac`=アクセント色、`--tac2`=サブカラー、フォントも設定済み。**render はこれを返す** |
| `C.value(it, student)` | 項目の値（固定/日付/連番/名簿の列→代替文字→自動採番） |
| `C.rows(V)` | 表示する項目を行に分ける（連続する半幅2つは `[a,b]`、他は `[a]`） |
| `C.visible(V)` / `C.sched(it)` / `C.findItem(V, /正規表現/, 除外正規表現)` | 表示項目 / 時間割の有効行 / ラベルで項目を探す |
| `C.SIZE` | 文字サイズ表（pt）。`C.SIZE.half\|full\|sch[it.size]` |
| `C.fitText(page, el, minPx)` | 1行に収まるまで自動縮小（表示後に実行される） |
| `C.notes(V)` | 注意事項 `[{text, accent}]` |
| `C.images(V)` / `C.imageSrc(v, 'map'\|'logo')` | 画像の src（非表示なら空文字。既定は assets/ の藤沢校） |
| `C.watermark(V, {top, height})` | 透かし要素（無効なら null）。top/height=表などの範囲(mm)。縦位置の基準に使う |
| `C.fold(V)` | 折り線要素（無効なら null） |
| `C.item(el, it)` | 要素をクリックで項目選択できるようにする（`data-item`） |
| `C.itemEdit(el, it)` | 固定文字の項目の値要素をダブルクリック編集可に（`data-edit="item:id"`） |
| `C.edit(el, 'hdr')` | 設定キーをダブルクリック編集可に（`V.hdr` など） |
| `C.extraEdit(el, id, k)` | 固有設定の文字をダブルクリック編集可に |
| `C.el(tag, cls, text)` / `C.esc(s)` / `C.lines(s)` / `C.fmtDate('YYYY-MM-DD')` / `C.autoNum(auto, idx)` / `C.font(V)` / `C.clone(o)` | 小道具 |

編集フック（`data-item`/`data-edit`）は詳細編集モードのときだけ反応します。

## 最小の例

```js
JukenTemplates.register({
  id: 'mini', name: 'ミニ', category: 'ベーシック', swatch: ['#2563eb', '#ffffff'],
  defaults: { accent: '#2563eb', hdr: '受験票' },
  uses: ['header', 'accent', 'font', 'notes'],
  render: function (st, V, C) {
    var t = C.page('mini', V);
    t.appendChild(C.edit(C.el('h1', 'm-h', V.hdr), 'hdr'));
    C.rows(V).forEach(function (row) {
      row.forEach(function (it) {
        var p = C.item(C.el('p', 'm-r'), it);
        p.appendChild(C.el('b', null, it.label + '：'));
        if (it.source === 'schedule') C.sched(it).forEach(function (r) { p.appendChild(C.el('span', null, r.c + ' ' + r.t + '　')); });
        else { var v = C.itemEdit(C.el('span', null, C.value(it, st)), it); p.appendChild(v); C.fitText(t, v); }
        t.appendChild(p);
      });
    });
    C.notes(V).forEach(function (n) { t.appendChild(C.el('div', 'm-n', '・' + n.text)); });
    return t;
  },
  styles: '.tpl-mini{padding:20mm}.tpl-mini .m-h{color:var(--tac);margin:0 0 8mm}.tpl-mini .m-r{font-size:16pt;margin:0 0 4mm}.tpl-mini .m-n{font-size:10pt}'
});
```

## 守ること

- 印刷は白地に黒（＋テンプレートの色）。ページは `210mm × 297mm` 固定、はみ出しは `.ticket` の `overflow:hidden` で切られます。
- 氏名など個人情報は `student`（名簿）経由でのみ扱い、設定 `V` には保存されません。保存時のサムネイルは `sample` の生徒で描画されます。
- CSS は `.tpl-<id>` の下に書き、`mm`/`pt` を使う（印刷とPDFで同じ見た目にするため）。
- 項目数や時間割の行数が増えてもページに収まるよう、行の高さは項目から計算する。
- 動作確認：ブラウザで開き、サンプル表示・名簿あり・「全員表示」・かんたんモードのギャラリー・保存したときのサムネイルを確認する。

## フリーデザイン（`free`）と独自の設定型

- `templates/free.js` は A4 に要素（text/field/rect/ellipse/line/image/notes/table/fold）を mm で絶対配置するテンプレート。要素モデルは `DESIGN_FORMAT.md` §7。エディタは `editor/free-editor.js`（`FreeEditor.open()`）。
- `JukenFree`（`window.JukenFree`）: `normElement(s)` `newElement(type, props)` `starter(V)`（初期レイアウトの要素配列）`geom/aabb` `resolveText`。フェーズB（既存テンプレート→キャンバス変換・スターター集）は、`JukenFree.newElement` で要素を作って `V.tpl.free.elements` に入れるだけで実装できます。
- `extras` には `{ type:'json', norm:function(saved, def){…}, hidden:true }` を使えます（`norm` が正規化。`hidden:true` は詳細編集の設定欄に出さない）。
- `ctx.fitText` の対象に `e._fitBase`（縮小前のfont-size）・`e._fitH=true`（高さのはみ出しも縮小）を設定できます。
