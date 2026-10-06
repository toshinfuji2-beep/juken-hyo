# 受験票デザイン ファイル形式（`.juken.json`）

アプリの「保存済みデザイン」から **書き出し／読み込み** できるデザインファイルの仕様です。
Claude（チャット）にデザインを作ってもらい、そのJSONを「ファイルから読み込み」「JSONを貼り付けて読み込み」で取り込めます。
この文書は `templates/api.js`（共通スキーマ `JukenTemplates.FIELDS` / `mkVals` / `normItems`）と `templates/*.js`（各テンプレート）、`index.html` の `importDesign` の実装から起こしています。テンプレートの作り方は `templates/README.md` を参照。

## 1. 外側の形（エンベロープ）

```json
{
  "format": "juken-design",
  "version": 1,
  "name": "デザイン名（任意）",
  "template": "waseda",
  "data": { }
}
```

| キー | 型 | 必須 | 説明 |
|---|---|---|---|
| `format` | string | 必須 | 固定値 `"juken-design"`。違うと「受験票デザインのファイルではありません」エラー |
| `version` | number | 推奨 | 現在は `1`。`1` より大きいとエラー（アプリ更新を促す） |
| `name` | string | 任意 | デザイン名。読み込み後に「デザインを保存」するときの保存名の初期値になる |
| `template` | string | 必須 | テンプレートID（`templates/*.js` で登録されたもの。現在は `"waseda"`（早大プレ型）と `"simple"`（シンプル））。未登録のIDはエラー |
| `data` | object | 任意 | テンプレート設定（下記）。省略・一部だけでもよい |

### 読み込み時の扱い（重要）

- `data` に **無い／型が違う／不正な値のキーは、そのテンプレートの既定値**で補われます（現在のエディタの値は引き継がれません。毎回「既定値＋ファイルの内容」になります）。
  - 型チェックは厳密です。`check` は true/false（文字列 `"true"` は不可）、`number` は数値（文字列 `"148.5"` は不可）、`color` は `#RRGGBB` の6桁16進、`select` は選択肢のいずれか、`text`/`textarea`/`lines` は文字列。不正なら黙って既定値になります。
- `data` の中の **未対応キーは無視**され、読み込み後のメッセージに「未対応の項目を無視: …」と表示されます（綴り間違いの発見用）。
- `data.items`（早大プレ型）は **配列ごとの置き換え**です。省略すると既定の8項目、指定すると指定したものだけ（追加・削除・並べ替え自由）になります。各項目の欠けたキーは項目の既定値（§3.2）で補われます。
- 読み込んだだけでは共有されません。内容を確認して「デザインを保存」を押すと共有デザインになります。
- 書き出し（「ファイルに書き出し」）は、共有デザインの保存内容と同じ `data`（画像はdataURL含む全キー）を出力します。

## 2. 画像フィールド（`map` / `logo`）

アプリ内部のモデルは `{ "d": "<画像>", "hide": false }` です。

| キー | 型 | 意味 |
|---|---|---|
| `d` | string | `""`＝既定画像（早大プレ型: map は `assets/map-fujisawa.png`、logo は `assets/logo-fujisawa.png`）／dataURL（`data:image/...`）／相対パス（例 `"assets/map-fujisawa.png"`） |
| `hide` | boolean | `true`で非表示 |

ファイルでは次の簡略記法も使えます（読み込み時に上のモデルへ変換）。

| 書き方 | 結果 |
|---|---|
| キーを省略 / `null` / `true` / `""` | 既定画像 |
| `false` | 非表示（`{d:"",hide:true}`） |
| `"data:image/png;base64,..."` または `"assets/xxx.png"`（文字列） | その画像（`{d:文字列,hide:false}`） |
| `{ "d": "...", "hide": false }` | そのまま |

- 相対パスはアプリ（`index.html`）からの相対です。リポジトリの `assets/` にある画像のみ表示されます。`http:`などのスキーム付きや `/` 始まりのパスは受け付けず、既定画像に戻されます。
- 現在 `assets/` にあるのは `map-fujisawa.png` と `logo-fujisawa.png`。新しい画像はdataURLで埋め込むか、リポジトリに追加してから相対パスで指定します。
- データが大きい（約1.5MB超）と保存時に確認が出ます。画像はなるべく小さく。

## 3. 共通設定（すべてのテンプレートで共通）／テンプレート `waseda`（早大プレ型）

**すべてのテンプレートは同じ設定スキーマ（この§3の `data`）を使います。** テンプレートを切り替えても項目・文字・画像は引き継がれ、テンプレートが使わないキーは無視されるだけです（色 `accent`/`secondary` と `font` だけは切り替え時に新しいテンプレートの既定になります）。テンプレート固有の追加設定は `data.tpl[テンプレートID]` に入ります（§4）。早大プレ型はこの共通スキーマをすべて使います。

A4縦1枚。上半分に枠線付きの項目表、折り線、下半分に注意事項（左）と地図・ロゴ（右）。

### 3.1 `data` のキー一覧

| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| `hdr` | string | `"2024年度　早稲田大学受験票"` | ヘッダー左の文字 |
| `badge` | string | `"折って試験当日持参"` | ヘッダーのバッジ（アクセント色の塗り・白文字）の文字 |
| `badgeOn` | boolean | `true` | バッジ表示。`badge`が空文字でも非表示 |
| `mark` | string | `"24早"` | 右上の大きなマーク文字（38pt・字間広め。長い文字は右上に収まる範囲で） |
| `markOn` | boolean | `true` | マーク表示 |
| `items` | array of item | 既定8項目（§3.7） | 項目表。上から順に描画 |
| `accent` | string | `"#C00000"` | アクセント色（`#RRGGBB`のみ）。表の罫線・バッジ・見出し・`color:"accent"`の文字・「!」注意事項に使用 |
| `secondary` | string | `"#444444"` | サブカラー（`#RRGGBB`）。テンプレートによって背景色・補助色に使う（早大プレ型では未使用） |
| `font` | `"gothic"` \| `"mincho"` | `"gothic"` | 全体のフォント（ゴシック／明朝） |
| `tpl` | object | `{}` | テンプレート固有の設定 `{ "<テンプレートID>": { … } }`。そのテンプレートの `extras` で定義されたキーのみ（§4） |
| `foldOn` | boolean | `true` | 折り線（破線）を表示 |
| `foldPos` | number | `148.5` | 折り線の位置（用紙上端からmm） |
| `foldLabel` | string | `"＜山折り＞"` | 折り線中央の文字（空なら線のみ） |
| `noteTitle` | string | `"注意事項"` | 下半分の見出し（アクセント色の塗り）。空なら見出しなし |
| `notes` | string | 既定の6行（§3.5） | 注意事項。改行区切りで1行1項目。先頭 `!` でアクセント色 |
| `swap` | boolean | `false` | `true`で注意事項（左）と画像（右）を左右入れ替え |
| `map` | image | 既定画像 | 地図画像（§2）。右側の上 |
| `logo` | image | 既定画像 | ロゴ画像（§2）。mapの下に縦に並ぶ |

**透かし文字**（すべて省略可。`wmOn` が無い／`false` なら透かしなし＝既存ファイルは変わりません）:

| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| `wmOn` | boolean | `false` | 透かし文字を表示 |
| `wmText` | string | `"2027"` | 透かしの文字（空なら非表示） |
| `wmAcc` | boolean | `true` | `true`で色をアクセント色に合わせる |
| `wmColor` | string | `"#C00000"` | 色（`wmAcc:false`のとき有効。`#RRGGBB`） |
| `wmOp` | number | `18` | 不透明度（0〜100 %） |
| `wmSize` | number | `26` | 文字の大きさ（mm） |
| `wmSp` | number | `0.6` | 字間（em） |
| `wmRot` | number | `0` | 回転（度） |
| `wmBold` | boolean | `true` | 太字 |
| `wmAnchor` | `"top"` \| `"mid"` \| `"bot"` \| `"page"` | `"mid"` | 縦位置の基準（表の上端／中央／下端／用紙の上端） |
| `wmY` | number | `0` | 縦位置（mm）。基準からのずれ（`page`のときは用紙上端からの位置）。文字の中心の位置 |
| `wmX` | number | `0` | 横のずれ（mm）。基本は用紙の左右中央 |

透かしは表の上に重なって描画されます（印刷でも色が出ます）。例: `designs/sodai-pre-2027.juken.json`（`wmAnchor:"bot"`, `wmY:-20` で「志望学部」〜「試験時間」あたり）。プレビューでは透かしをダブルクリックで文字編集、クリックで設定欄が開きます。`simple` テンプレートでは未対応です。

読み込み時のみ許容される旧形式キー（`items`未指定のときだけ有効）: `venue`, `room`, `date`, `system`, `faculty`, `sched`。新規作成では使わないでください。また `badgeOn` 未指定で `badge` が空文字なら `badgeOn:false` になります。

### 3.2 項目（item）モデル

`items` の各要素は次のオブジェクトです。**`label` と `source` 以外は省略可**（省略時は既定値）。

| キー | 型 | 既定 | 説明 |
|---|---|---|---|
| `id` | string | 自動 | 識別子。省略してよい（読み込み時に自動採番）。編集UI内部用 |
| `label` | string | `""` | 項目名（枠の左上／左に表示）。名簿の一覧表示では「受験番号」「氏名」を含む項目名が識別に使われる |
| `source` | `"column"` \| `"fixed"` \| `"date"` \| `"schedule"` \| `"autonumber"` | `"fixed"` | 値の取得方法（§3.3）。不明な値は `fixed` |
| `column` | string | `""` | `source:"column"` のとき、Excel/CSVファイルや表ごと貼り付けで読み込む際に対応させる見出し名（空なら `label`）。通常の名簿入力は「項目ごとの貼り付け欄」（項目 `id` に紐づく）で行い、この値は書き換えられません |
| `value` | string | `""` | `fixed` のときの表示文字／`date` のときの日付（`"YYYY-MM-DD"`） |
| `fallback` | string | `""` | `column` で名簿の値が空のとき表示する文字 |
| `rows` | array of `{t,c}` | `[]` | `schedule` の行（§3.3） |
| `auto` | object | `{"prefix":"","start":1,"digits":3}` | `autonumber` の設定。`prefix`: 接頭辞(string)、`start`: 開始番号(number)、`digits`: 桁数(number, 1以上)。連番は `prefix + (start+行番号)をdigits桁0埋め` |
| `width` | `"full"` \| `"half"` | `"full"` | 幅。§3.4参照 |
| `size` | `"S"` \| `"M"` \| `"L"` \| `"XL"` | `"M"` | 文字サイズ（§3.6の表） |
| `color` | `"black"` \| `"accent"` | `"black"` | 文字色。`accent`はアクセント色の太字 |
| `align` | `""` \| `"left"` \| `"center"` | `""` | 揃え。`""`は自動（半幅＝中央、全幅＝左） |
| `autoEmpty` | boolean | `false` | `column` で名簿の値が空のとき `auto` の連番を入れる（`fallback` が空のときだけ） |
| `hidden` | boolean | `false` | `true`で表に出さない（定義だけ残す） |

型が違う値は無視されて既定値になります（例: `size:"XXL"` → `"M"`）。

### 3.3 `source` ごとの値

| source | 値の決まり方 | 使うキー |
|---|---|---|
| `column` | 名簿の列 `column` の値。空なら `fallback`。列が見つからなくても `fallback` | `column`, `fallback` |
| `fixed` | `value` をそのまま表示（1行・折り返しなし） | `value` |
| `date` | `value`（`YYYY-MM-DD`）を `2023年7月2日（日）` 形式で表示（全幅では字間広め）。形式が違う文字列はそのまま表示 | `value` |
| `autonumber` | 連番（`auto`）。名簿の行順で `start`, `start+1`, … | `auto` |
| `schedule` | 時間割。各行が「科目 時間」の1行になる | `rows`, `size` |

- **列名の解決**: `column` は名簿の見出しと正規化（空白除去・大小文字無視）して一致を探し、無ければ同義語グループで探します。同義語グループ:
  - 氏名: 氏名 / 名前 / 生徒名 / お名前 / name
  - カナ氏名: カナ氏名 / カナ / フリガナ / ふりがな / よみ / 読み / ヨミ / かな
  - 受験番号: 受験番号 / 番号 / id / 生徒番号 / no / no.
  - 志望学部: 志望学部 / 学部 / 志望
  - 教室: 教室 / 会場 / 部屋
  - 学校名: 学校名 / 学校 / 高校 / 在籍校
  - 学年: 学年 / 学年名
- 名簿未読み込みのプレビューでは、同義語グループに当たる列名にサンプル値（受験番号001、氏名「藤沢 太郎」など）、当たらない列名には `〈列名〉` が入ります。
- **schedule の行**: `{ "t": "10:00〜11:30", "c": "英語" }`。`t`=時間文字列、`c`=科目・内容（どちらも string）。`t`と`c`が両方空の行は描画されません。表示は左に`c`（15mm幅）、右に`t`（字間広め）。scheduleでは `color` / `align` は効きません。`width:"half"`にしても時間割として使う場合は `full` を推奨。
- 値が長いと1行に収まるまでフォントが自動縮小されます（最小6px）。

### 3.4 レイアウト規則

- 表は用紙上端から22.3mm、左19.5mm、幅171mm。項目は `hidden:false` のものだけを上から順に配置します。
- **半幅の並び**: `width:"half"` の項目が**連続して2つ**あると1行に横並び（50%ずつ）。半幅が1つだけ（前後が全幅）の場合は1行に単独で置かれ、全幅と同じ幅ですがラベル上・値中央の「半幅スタイル」で描画されます。3連続の半幅は「2つ＋1つ」になります。
- **全幅**: ラベルが左（縦中央）、値は左から25mmの位置から左揃え。
- **行の高さ（mm）**: 半幅の行＝20.8、全幅の行＝17.8、scheduleを含む行＝`max(20.4, 有効行数 × スケジュール文字pt × 0.46 + 2)`。
- 注意事項は用紙上端から158.5mm、左20mm、幅85mm（`swap:true`なら左108mm）、画像は上端160mm・左115mm・幅78mm（`swap:true`なら左20mm）に固定配置。**項目表の高さの合計が `foldPos`−22.3mm 程度（既定で約126mm）に収まるように**項目数・サイズを調整してください（既定8項目の合計は約116mm、紺の例は約104mm）。収まらないと折り線や注意事項に重なります。
- 画像は幅いっぱい（78mm）で縦に並べて表示（mapが上、logoが下）。両方 `hide` なら右側は空。

### 3.5 注意事項（`notes`）

- 1つの文字列で、改行（JSONでは `\n`）で区切って1行1項目。前後の空白は除去、空行は無視。
- 各行の先頭に自動で「・」が付き、折り返し時はぶら下げインデントになります。
- 行頭が `!`（半角）または `！`（全角）の行は **アクセント色**になり、`!`自体は表示されません。
- 既定値:
  ```
  !こちらの受験票を折って試験当日に持参してください。
  入場の際、受験票の提示が必要です。
  !試験教室は8:30から開いています。試験時間の30分前までに試験教室に入場してください。
  試験教室の座席に着席する際に、机に貼られている受験番号と一致していることを確認してください。
  受験票は試験時間中机上に置きますので、何も書き込まないでください。（書き込みを発見した場合、不正行為となる可能性があります。）
  受験票は入学後の学生証交付の際に必要になりますので、大切に保管してください。
  ```
  （各行の間はJSON内では `\n`、`!`で始まる行が赤）

### 3.6 文字サイズ（pt）

| size | 半幅（half） | 全幅（full） | schedule |
|---|---|---|---|
| S | 20 | 20 | 11 |
| M | 26 | 24 | 14 |
| L | 30 | 28 | 17 |
| XL | 34 | 34 | 20 |

ラベル（項目名）は常に10pt。全幅の値は字間 .05em（`date`は .2em）、半幅は .08em。

### 3.7 既定の8項目

| label | source | column / value / rows | width | size | color |
|---|---|---|---|---|---|
| 受験番号 | column | column=`受験番号` | half | L | black |
| 試験場 | fixed | value=`東進HS 藤沢校` | half | XL | accent |
| カナ氏名 | column | column=`カナ氏名` | half | M | black |
| 教室 | fixed | value=`レクチャールーム` | half | M | black |
| 試験日 | date | value=`2023-07-02` | full | L | black |
| 入試制度 | fixed | value=`第一回早大プレ` | full | L | black |
| 志望学部 | column | column=`志望学部` | full | L | black |
| 試験時間 | schedule | rows=英語 10:00〜11:30 / 国語 13:00〜14:30 / 社会 15:30〜16:30 | full | M | black |

## 4. テンプレート `simple`（シンプル）とテンプレート固有設定

`simple` も §3 の共通設定（`hdr`=タイトル、`items`、`notes`、`noteTitle`、`accent`、`secondary`、`font`）を使い、項目を上から順に並べる白黒レイアウトです（`badge`/`mark`/画像/折り線/透かしは使いません）。固有設定は `data.tpl.simple`:

| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| `belongings` | string | `"筆記用具
消しゴム
時計（通信機能のないもの）"` | 持ち物（1行1項目） |
| `contact` | string | `""` | 問い合わせ先（1行） |
| `photo` | boolean | `false` | 写真貼付欄を表示 |
| `stub` | boolean | `false` | 切り取り線＋控えを表示（ラベルに「受験番号」「氏名」を含む項目を使う） |

固有設定のキーは、各テンプレートの `extras` 定義（型は `text`/`check`/`number`/`color`/`select`/`lines`/`image`）が正で、不正な値は既定値になります。

### 旧形式（`simple` の `school`/`title`/`date`/`time`/`place`/`sched`/`items`(文字列)/`notes`/`contact`/`photo`/`stub`/`apre`/`astart`/`adig`）

読み込み時に自動で共通スキーマへ変換されます（`title`→`hdr`、持ち物→`tpl.simple.belongings`、日付・時刻・会場・時間割・主催→項目、`apre/astart/adig`→「受験番号」項目の `autoEmpty`+`auto`）。旧形式の保存済みデザイン・`.juken.json` もそのまま読めます。新規には使わないでください。

## 5. 作成のコツ（Claudeがデザインを作るとき）

1. `format`・`version`・`template` を必ず入れる。`data` は変えたいキーだけでもよい（残りは既定値）。ただし `items` を書く場合は表に出したい項目を**すべて**書く。
2. 表の高さ合計（§3.4）が `foldPos`−22.3mm 以内か計算する。
3. アクセント色は `#RRGGBB`（6桁）。短縮形 `#C00` は不可（既定色に戻る）。
4. 注意事項で強調したい行は先頭に `!`。
5. 画像を出さないなら `"map": false`。既定のままなら省略。
6. JSONは有効な形式で（末尾カンマ・コメント不可）。読み込み時のエラーメッセージで原因が分かります。

## 6. 完全な例1：既定の早大プレ型

`designs/default-sodai-pre.juken.json`

```json
{
  "format": "juken-design",
  "version": 1,
  "name": "早大プレ（標準）",
  "template": "waseda",
  "data": {
    "hdr": "2024年度　早稲田大学受験票",
    "badge": "折って試験当日持参",
    "badgeOn": true,
    "mark": "24早",
    "markOn": true,
    "items": [
      {
        "label": "受験番号",
        "source": "column",
        "column": "受験番号",
        "value": "",
        "rows": [],
        "auto": {
          "prefix": "",
          "start": 1,
          "digits": 3
        },
        "fallback": "",
        "width": "half",
        "size": "L",
        "color": "black",
        "align": "",
        "hidden": false
      },
      {
        "label": "試験場",
        "source": "fixed",
        "column": "",
        "value": "東進HS 藤沢校",
        "rows": [],
        "auto": {
          "prefix": "",
          "start": 1,
          "digits": 3
        },
        "fallback": "",
        "width": "half",
        "size": "XL",
        "color": "accent",
        "align": "",
        "hidden": false
      },
      {
        "label": "カナ氏名",
        "source": "column",
        "column": "カナ氏名",
        "value": "",
        "rows": [],
        "auto": {
          "prefix": "",
          "start": 1,
          "digits": 3
        },
        "fallback": "",
        "width": "half",
        "size": "M",
        "color": "black",
        "align": "",
        "hidden": false
      },
      {
        "label": "教室",
        "source": "fixed",
        "column": "",
        "value": "レクチャールーム",
        "rows": [],
        "auto": {
          "prefix": "",
          "start": 1,
          "digits": 3
        },
        "fallback": "",
        "width": "half",
        "size": "M",
        "color": "black",
        "align": "",
        "hidden": false
      },
      {
        "label": "試験日",
        "source": "date",
        "column": "",
        "value": "2023-07-02",
        "rows": [],
        "auto": {
          "prefix": "",
          "start": 1,
          "digits": 3
        },
        "fallback": "",
        "width": "full",
        "size": "L",
        "color": "black",
        "align": "",
        "hidden": false
      },
      {
        "label": "入試制度",
        "source": "fixed",
        "column": "",
        "value": "第一回早大プレ",
        "rows": [],
        "auto": {
          "prefix": "",
          "start": 1,
          "digits": 3
        },
        "fallback": "",
        "width": "full",
        "size": "L",
        "color": "black",
        "align": "",
        "hidden": false
      },
      {
        "label": "志望学部",
        "source": "column",
        "column": "志望学部",
        "value": "",
        "rows": [],
        "auto": {
          "prefix": "",
          "start": 1,
          "digits": 3
        },
        "fallback": "",
        "width": "full",
        "size": "L",
        "color": "black",
        "align": "",
        "hidden": false
      },
      {
        "label": "試験時間",
        "source": "schedule",
        "column": "",
        "value": "",
        "rows": [
          {
            "t": "10:00〜11:30",
            "c": "英語"
          },
          {
            "t": "13:00〜14:30",
            "c": "国語"
          },
          {
            "t": "15:30〜16:30",
            "c": "社会"
          }
        ],
        "auto": {
          "prefix": "",
          "start": 1,
          "digits": 3
        },
        "fallback": "",
        "width": "full",
        "size": "M",
        "color": "black",
        "align": "",
        "hidden": false
      }
    ],
    "accent": "#C00000",
    "font": "gothic",
    "foldOn": true,
    "foldPos": 148.5,
    "foldLabel": "＜山折り＞",
    "noteTitle": "注意事項",
    "notes": "!こちらの受験票を折って試験当日に持参してください。\n入場の際、受験票の提示が必要です。\n!試験教室は8:30から開いています。試験時間の30分前までに試験教室に入場してください。\n試験教室の座席に着席する際に、机に貼られている受験番号と一致していることを確認してください。\n受験票は試験時間中机上に置きますので、何も書き込まないでください。（書き込みを発見した場合、不正行為となる可能性があります。）\n受験票は入学後の学生証交付の際に必要になりますので、大切に保管してください。",
    "swap": false,
    "map": {
      "d": "assets/map-fujisawa.png",
      "hide": false
    },
    "logo": {
      "d": "assets/logo-fujisawa.png",
      "hide": false
    }
  }
}
```

## 7. 完全な例2：紺・明朝・地図なし・試験時間を大きく

`designs/example-navy.juken.json`（`items` は必要なキーだけを書いた省略形。省いたキーは既定値）

```json
{
  "format": "juken-design",
  "version": 1,
  "name": "早大プレ（紺・明朝）",
  "template": "waseda",
  "data": {
    "hdr": "第3回　東進模擬試験　受験票",
    "badge": "印刷して当日持参",
    "badgeOn": true,
    "mark": "模試",
    "markOn": true,
    "items": [
      {
        "label": "受験番号",
        "source": "column",
        "column": "受験番号",
        "width": "half",
        "size": "L"
      },
      {
        "label": "氏名",
        "source": "column",
        "column": "氏名",
        "width": "half",
        "size": "L"
      },
      {
        "label": "試験日",
        "source": "date",
        "value": "2026-11-15",
        "size": "L"
      },
      {
        "label": "試験会場",
        "source": "fixed",
        "value": "東進衛星予備校 藤沢校",
        "size": "L",
        "color": "accent"
      },
      {
        "label": "志望校",
        "source": "column",
        "column": "志望学部",
        "fallback": "未記入",
        "size": "M",
        "align": "left"
      },
      {
        "label": "試験時間",
        "source": "schedule",
        "size": "XL",
        "rows": [
          {
            "t": "9:30〜11:00",
            "c": "英語"
          },
          {
            "t": "12:00〜13:30",
            "c": "数学"
          },
          {
            "t": "14:30〜16:00",
            "c": "国語"
          }
        ]
      }
    ],
    "accent": "#1F3A93",
    "font": "mincho",
    "foldOn": true,
    "foldPos": 148.5,
    "foldLabel": "＜山折り＞",
    "noteTitle": "注意事項",
    "notes": "!この受験票を試験当日に必ず持参してください。\n試験開始の30分前までに入場してください。\n受験票は試験中、机の上に置いてください。\n筆記用具・時計（通信機能のないもの）を持参してください。",
    "swap": false,
    "map": {
      "d": "",
      "hide": true
    },
    "logo": {
      "d": "assets/logo-fujisawa.png",
      "hide": false
    }
  }
}
```

## 8. 部分ファイルの例（最小）

アクセント色だけ変え、項目を2つにし、地図を非表示にする。他はすべて既定値。

```json
{
  "format": "juken-design",
  "version": 1,
  "template": "waseda",
  "data": {
    "accent": "#007A33",
    "items": [
      { "label": "受験番号", "source": "column", "column": "受験番号" },
      { "label": "試験時間", "source": "schedule", "rows": [ { "t": "10:00", "c": "英語" } ] }
    ],
    "map": false
  }
}
```

## 7. テンプレート `free`（フリーデザイン）の要素モデル

A4（210×297mm）に要素を絶対配置するテンプレート。`data.tpl.free = { "bg": "#ffffff", "elements": [ … ], "guides": [ {"axis":"x"|"y","pos":mm} ] }`。
項目（`items`）・注意事項・画像・透かし（`wm*`）は共通設定（§3）をそのまま使い、要素から参照します。座標・サイズはすべて **mm、左上原点**。`elements` は **配列の後ろほど前面**。不正な値は読み込み時に既定値へ（`JukenFree.normElement`）。

**共通キー**: `id`(string) `type` `x` `y` `w` `h` `rot`(度) `opacity`(0〜1) `locked` `hidden` `name` `groupId`(任意。下記「グループ」)。`line`/`fold` は `h` を持たず、`y` が線の位置（当たり判定は±1.5mm）。
**色**: `#rrggbb` / `#rgb` / `"transparent"`(または空=なし) / `"accent"`・`"secondary"`（デザインの色に追従するトークン）。

| type | 固有キー（既定値） |
|---|---|
| `text` | `text`（`{{項目名}}` `{{ヘッダー}}` `{{バッジ}}` `{{マーク}}` を生徒ごとに差し込み）`font`(gothic/mincho/maru/sans-en) `size`(pt) `weight` `italic` `underline` `strike`(真偽。既定false) `color` `align`(left/center/right/justify=両端揃え) `valign`(top/middle/bottom) `lineHeight` `letterSpacing`(em) `vertical`(縦書き) `fit`(none/shrink=1行で自動縮小) `bg` `padding`(mm) |
| `field` | `itemId`（項目の `id`）`showLabel` `labelText` `labelSize` `labelColor` `labelPos`(top/left) ＋ text と同じ文字スタイル。時間割項目は行で表示 |
| `rect` / `ellipse` | `fill` `stroke` `strokeWidth`(pt) `dash`(solid/dashed/dotted) `radius`(mm・rectのみ) |
| `line` | `stroke` `strokeWidth` `dash`（長さ=`w`、回転=`rot`） |
| `image` | `src`（dataURL / `assets/…` / `"map"` / `"logo"`＝このデザインの地図・ロゴ）`fit`(contain/cover) `radius` |
| `notes` | `title` `size` `color` `accentColor` `bullet`(number/dot/none) `lineHeight` `fit`。本文は共通設定の `notes`（行頭`!`で強調） |
| `table` | `itemIds[]`（半幅2つは横並び）`borderColor` `labelBg` `labelColor` `color` `size` `rowGap`(セル上下余白mm) `itemSize`(true=各項目の `size` S/M/L/XL を倍率0.8/1/1.2/1.4で反映。既定false)。行の高さは枠の高さを等分 |
| `fold` | `label` `size` `color` `strokeWidth` `dash`（既定 x=0,w=210,y=148.5） |

**グループ**: 要素の `groupId`（文字列）が同じ要素どうしを1つのグループとして扱います（PowerPointのグループ化に相当）。要素は平らな配列のまま、グループのメンバーは重なり順で連続して並べます。`groupId` は任意で、無い（旧データ）要素は単独です。グループは一緒に移動・拡大縮小・回転・複製・コピーされ、ページ上のクリックはグループ全体を、もう一度クリックすると中の1つを選びます。メンバーが1つだけのグループは読み込み時（`normElements`）に解除されます。入れ子のグループはなく、グループ化し直すと平らな1グループになります。

透かしは共通設定 `wmOn` 等を使い、ページ全体（`wmAnchor` の top/mid/bot＝用紙の上端/中央/下端）に最前面で描画されます。
フリーデザインのJSON例は、アプリで作って「ファイルに書き出し」したものを参照してください。

**既存デザインからの変換**: 既存テンプレート（またはいま開いているデザイン）を「自由編集」に変換すると、画面外に描画したDOMを `rect`（背景・罫線・角丸。円は `ellipse`、片側だけの罫線は細い `rect`/`line`）・`text`（書体は gothic/mincho/maru/sans-en に対応付け。`{{ヘッダー}}` `{{バッジ}}` `{{マーク}}` は差し込みに戻す）・`field`（項目の値だけ。`itemId` で結び、`showLabel:false`。項目名は別の `text`）・`notes`（本文のみ）・`fold`・`image`（`"map"`/`"logo"`）に置き換えます（最大150個）。透かしは共通設定を維持し、`wmAnchor:"page"`・`wmY`（用紙の上端からのmm）に変換します。色が `accent`/`secondary` と一致するものはトークン参照になります。

## 9. 自分のデザインの取り込み（PowerPoint / PDF / 画像）

ステップ①の「自分のデザインを取り込む」から、`.pptx`・PDF・画像（PNG/JPEG）を **フリーデザイン（`free`）+ 項目（`items`）** に変換します。保存されるデータは通常のフリーデザインと同じで、特別な形式は増えません。実装は `editor/pptx-import.js`（PPTX変換）と `editor/design-import.js`（画面）。ブラウザ内だけで処理され、ファイルは送信されません（上限30MB。JSZip・pdf.js は cdnjs から必要なときだけ読み込み）。

**PowerPoint（.pptx）**: スライドサイズをA4（210×297mm）に縦横比を保って拡大縮小し中央に置きます（縦横比が違うと余白ができ、画面でお知らせします）。スライドが複数あるときは一覧から1枚を選びます。
- 図形 → `rect`/`ellipse`（角丸は `radius`、塗り・線の色/太さ/破線）。文字付き図形は図形＋`text`。テキストボックス → `text`（書体は gothic/mincho/maru/sans-en に対応付け、太字・斜体・下線・色・文字位置・縦書き・自動縮小に対応。書式が段落で違えば段落ごとに別の `text`）。直線・コネクタ → `line`（斜めは `rot`）。
- 表（`a:tbl`）→ セルごとの `rect`（塗り）＋`text`＋罫線の `line`（同じ書式の連続区間は1本）。行の高さが0の表は文字の大きさから補います。
- グループ → 子要素にグループ変換（拡大縮小・回転・反転）を適用し、同じ `groupId`。回転（`rot`）・反転は可能な範囲で反映。重なり順は元のまま。マスター/レイアウトの背景・非プレースホルダー図形は下に固定（`locked`）で入ります。プレースホルダーの位置・文字スタイルは継承。
- 色は `srgbClr`/`schemeClr`（テーマ色・`lumMod`/`lumOff`/`tint`/`shade`/`alpha`）を解決。透明度は白との混合で表現。
- 画像（`p:pic`）→ `image`（トリミング・反転・引き伸ばしを反映して焼き込み、長辺1600px以下のdataURL）。**EMF/WMF/TIFF はブラウザで描画できない**ため、斜線の枠（`image`）に「この画像は読み込めない形式です（EMF）。右クリック→図の変更で差し替え」と書いて置き、取り込み結果に件数を出します。
- 取り込めないもの（グラフ・SmartArt・自由な形・図形の種類によるもの・画像塗りつぶし等）は省略し、種類と個数を結果に出します。要素数は最大600。
- 各要素の `id` はスライド内の位置から作るため、同じ原本から複製したスライドどうしで同じになります（名簿の読み取りに利用）。

**画像・PDF**: 1枚目（PDFは選んだページ。pdf.js で描画）を、A4全面・`locked`・`fit:"contain"` の `image` 要素（背景）にします。その上に「差し込み枠」（`text`、`{{項目名}}`、`fit:"shrink"`）をドラッグで置きます。PPTXの見た目が崩れるときは、PowerPointで「PDFとして保存」したものをこの方法で取り込むと確実です。

**差し込み箇所の指定**: 文字（`text`）をクリックして項目（受験番号・氏名・カナ氏名・志望学部・教室・学校名・学年・新しい項目）を選ぶと、その要素の `text` が `{{項目名}}`（`fit:"shrink"`）に置き換わり、同名の `items`（`source:"column"`）が作られます。「あとで編集できるように」を選ぶと `source:"fixed"`（`value`＝元の文字）の項目になり、ステップ②で書き換えられます。「変えない」は元の文字のまま。隣のラベル（受験番号・カナ氏名など）・数字だけ・カタカナだけの文字は候補として強調され、まとめて適用できます。

**名簿の読み取り**（スライドが複数のPPTX）: 割り当てた項目について、全スライドの同じ `id` の文字を集めて名簿の貼り付け欄に入れます。名簿はこの端末のメモリ上だけで、保存・送信されません。
