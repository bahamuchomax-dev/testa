# XSS_AUDIT

XSS / HTML 注入対策の監査と対応。

## 監査方法

`src` 全体（legacy バンドル含む）を以下パターンで grep し、ユーザー入力が混ざりうる経路を精査:
`dangerouslySetInnerHTML / innerHTML / outerHTML / insertAdjacentHTML / document.write /
eval( / new Function / javascript: / onerror / onload / onclick / iframe / script / style= /
srcdoc / data:text/html`。

## 監査結果

### 非 legacy ソース（React / services）— 安全

| ファイル | 該当 | 危険度 | ユーザー入力混入 | 修正方針 | 状態 |
|---|---|---|---|---|---|
| React 全般（`features/*`, `App.jsx`） | `dangerouslySetInnerHTML` / `innerHTML` 等は **0 件** | 低 | 表示は全て `{text}`（React が自動エスケープ） | 現状維持＋静的テストで再発防止 | ✅ |
| `services/oxHelpers.js` | `document.createElement` + `el.textContent=...` + 静的 `style.cssText` + `el.onclick=cb` | 低 | テキストは `textContent`（HTML 非解釈）。style は静的文字列、onclick は関数代入（属性注入ではない） | 変更不要 | ✅ |
| `services/loadThree.js` ほか | `onload`/`onerror` は `addEventListener`／DOM オブジェクトのイベント。`createElement("script")` は自前の three ローダで src は同一オリジン固定 | 低 | 無し（URL は `${BASE_URL}three.min.js` 固定） | 変更不要 | ✅ |
| `features/profile/Profile.jsx` | `<img src={avatarUrl}>` | 低 | `avatarUrl` は自前生成の **blob: URL** のみ（`createObjectURL`） | 変更不要（URL 検証が要る将来用に `sanitizeUrl` 提供） | ✅ |

**結論**: React 層は `dangerouslySetInnerHTML` を一切使わず、表示は `{text}`／改行は CSS `white-space: pre-wrap` で行う方針のため、保存データに `<script>` 等が混ざっても**実行されない**（リテラル表示）。

### 多層防御として追加したサニタイズ

- 新規 `src/services/security/sanitizeText.js`（`escapeHtml` / `stripDangerousHtml` / `sanitizePlainText` / `sanitizeUrl` / `hasLikelyXss`）。
- `services/repository/profileRepository.js` の `save()` で **name / bio を保存前に `sanitizePlainText`**（タグ・危険スキームのみ除去、日本語・英数・改行は保持）。保存 payload に危険 HTML を入れない。

### legacy バンドル（`src/legacy/oriex-app.bundle.js`）— **未確認・編集禁止**

minify 済みの凍結バンドル。grep 上の出現数（参考・編集不可）:

- `dangerouslySetInnerHTML` … 12
- `innerHTML` … 5
- `javascript:` … 3
- `createElement("script")` … 4
- `eval(` / `new Function` / `srcdoc` / `data:text/html` / `insertAdjacentHTML` / `document.write` … 0

これらにユーザー入力が流れているかは**ソースが無いため確認不可**。多くは元 React ビルド由来（リッチ表示や動的 script 読込）と推測されるが、断定できない。バンドルは直接編集しない方針のため、本フェーズでは**ライブ legacy 経路の XSS は未確認事項**として残す（下記「今後の実機確認項目」）。

## サニタイズ関数の使い分け

- `sanitizePlainText(input, {maxLength, trim})`: **プレーンテキスト保存/表示**用（プロフィール名・自己紹介・先生メモ・生徒入力・学習記録・参考書ログ・配信本文・解答コメント）。実 HTML タグと危険スキーム・制御文字を除去し、日本語/英数/改行/タブは保持。`a<b`（`>` 無し）は壊さない。
- `escapeHtml(input)`: 文字列を **HTML 文字列に埋め込む**必要がある場合に `& < > " '` をエンティティ化。
- `stripDangerousHtml(input)`: **HTML として表示する必要がある場合のみ**（危険タグ/属性/スキームを除去し他の HTML は残す）。原則 React の `{text}` 表示を使い、これは使わない。
- `sanitizeUrl(input)`: `href`/`src` に入れる URL の検証。`http/https/mailto/tel/blob`・相対・フラグメントのみ許可、`javascript:`/`vbscript:`/`data:` は空文字に。
- `hasLikelyXss(input)`: 保存拒否や警告判定用のヒューリスティック。

## 表示方針（原則）

- `dangerouslySetInnerHTML` は使わない（静的テストで再発防止）。
- `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write` の代入・呼び出しを非 legacy ソースで禁止（静的テスト）。
- React では `{text}` で表示、改行維持は `white-space: pre-wrap`。
- HTML 表示が必要な場合のみ `stripDangerousHtml` を通す。
- ローカルAI 入力／PDF 抽出本文は**原文を保持**（保存時に壊さない）。安全化は**表示時・コピー時**に寄せる。
  現状 AI 結果は `{text}`（React エスケープ）で表示・コピーはプレーンテキストのため `<script>` は実行されない。

## CSP（Content-Security-Policy）

**安全な部分集合のみ実適用済み**（`index.html` の `<meta http-equiv>`）:

```
object-src 'none'; base-uri 'self'
```

- `object-src 'none'`: プラグイン/`<object>`/`<embed>` を禁止（本アプリは未使用）。
- `base-uri 'self'`: 注入された `<base>` による相対URL乗っ取りを防止（本アプリは相対URL前提）。
- これらは `<meta>` で有効化でき、**スクリプト/スタイル/フォント/Ollama接続を制限しない**ため legacy も壊さない。

**`script-src` / `style-src` / `connect-src` / `default-src` は今回も見送り**。理由:
- `index.html` の**インライン `<script>`**（縦向きロック）が `script-src 'self'` でブロックされる。
- legacy バンドルが `createElement("script")`（4箇所）等の動的処理を行い、厳格 CSP で**ライブ機能が壊れる恐れ**（ソース無しで影響確認不可）。
- `connect-src` は Firebase SDK の多数エンドポイント＋Ollama＋フォントを正確に列挙する必要があり、漏れると live が壊れる。
- `frame-ancestors` は **`<meta>` では無効**（HTTPヘッダ専用）。GitHub Pages はヘッダを設定できないため、クリックジャッキング対策は別途（移行後のヘッダ設定可能なホスト or フレームバスター）で検討。

将来の厳格化手順（前提作業）: (1) インライン script を外部 `.js` 化、(2) フォント自前ホスト（本ビルド環境は外部フォント取得不可のため別環境で実施）、(3) legacy の動的 script を React 移行で解消、(4) その後 `script-src 'self'` 等を追加。推奨フルポリシーは下記:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob:;
connect-src 'self' http://localhost:11434 http://127.0.0.1:11434;
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
```

## legacy bundle で未確認の箇所

- `dangerouslySetInnerHTML`(12)/`innerHTML`(5)/`javascript:`(3) にユーザー入力が流れていないか（ソース無しで未確認）。
- これらは編集禁止のため、移行（React 化）で当該画面を bundle から外す際に各経路を `{text}`／`sanitizePlainText` に置換して解消する。

## 今後の実機確認項目

- プロフィール名/自己紹介/先生メモ/配信本文に `<script>`/`<img onerror>` を入力 → 保存・再表示で**実行されない**こと（legacy ライブ画面）。
- ローカルAI 出力に HTML が混ざっても表示・コピーで実行されないこと。
- アバター/テーマ写真の blob: URL 表示が CSP 提案下でも壊れないこと（CSP 採用検討時）。
