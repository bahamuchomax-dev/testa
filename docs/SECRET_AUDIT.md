# SECRET_AUDIT

GitHub 公開前の「秘密情報混入」チェックの方針と使い方。

## 使い方

```bash
npm run security:scan
```

- `scripts/securityScan.mjs` が対象ファイルを走査し、**FAIL があれば exit 1**（CI で落とせる）、無ければ exit 0。
- Firebase/Google Web の apiKey 形（`AIza...`）は **WARN（報告のみ・exit 0）**。フロントに含まれてよいもので、Service Account の秘密鍵ではないことだけ確認する。

スキャン対象: `src/` `public/` `test/` `docs/` `package.json` `package-lock.json` `index.html` `firebase.json` `firestore.rules` `.gitignore` `README.md`（`node_modules`/`dist`/`coverage` と画像等バイナリは除外）。

## 検索する秘密情報パターン

FAIL（混入禁止・exit 1）:

- PEM 秘密鍵ヘッダ（`BEGIN ... PRIVATE KEY` 形式。RSA/EC/OpenSSH 等を含む）
- Service Account JSON（`type` が `service_account`、`private_key` フィールドを持つ JSON）
- `private_key` / `service_account` / `client_secret` / `GOOGLE_APPLICATION_CREDENTIALS` / `firebase-adminsdk` の名称（許可リスト外のコードに出た場合）
- 外部AIキー/エンドポイント: `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `api.openai.com` / `api.anthropic.com` / `generativelanguage.googleapis.com`
- OpenAI 形式キー（`sk-` + 20文字以上の英数）

WARN（フロント可・要確認・exit 0）:

- Google/Firebase Web の apiKey 形（`AIza` + 35文字以上）

## 許可リスト（誤検知対策）

方針: **HARD（実鍵 material）は原則すべてのファイルで検出する**（FULL 許可は廃止）。許可するのは
「名称トークン」と「明示マーカー付きのテスト用 fake 値だけ」。

- **NAME 免除のみ**（名称トークンは無視するが、**実鍵 material（PEM / SA JSON / 長い `sk-` キー）は検出する**）:
  - `docs/` 配下、`.gitignore`、`package-lock.json`（名称を説明・無視設定・依存 manifest として正当に含む）
  - `scripts/securityScan.mjs`、`test/secretScanStatic.test.js`（検索パターン定義・テスト用 fake を含むが、
    **本物の秘密 material はここでも FAIL にする**）
- **行単位の明示許可マーカー**: 行に `secret-scan-allow-fixture` を含む場合のみ、その行は HARD/NAME/WARN を
  すべてスキップする。**テスト用の本物風 fake 値専用**で、レビューで可視・行スコープのため誤用しにくい。
  本物の秘密鍵を通すための汎用バイパスとして使わないこと。
- **絶対に許可しないもの**: 本物の秘密鍵、`.env`、Service Account JSON。マーカーの無い実鍵 material は
  許可リストに関わらず FAIL（`scripts/` や `test/` 内でも検出される）。

## Firebase Web config と Service Account 秘密鍵の違い（重要）

- **Firebase Web config の `apiKey`（`AIza...`）はフロントに含めてよい。** これは「どの Firebase プロジェクトか」を示す**識別子**であり、秘密ではない。アクセス制御は **Firestore Rules** と（将来）**App Check** が担う。本スキャンでも **WARN** 止まり。
- **Service Account の `private_key`（PEM）/ `firebase-adminsdk` の JSON は絶対にフロント・公開リポジトリに入れてはいけない。** これは**サーバ管理者権限**を与える本物の秘密鍵で、漏れると Firestore/Storage を全権操作される。本スキャンでは **FAIL**。
- まとめ: `apiKey`（公開可・識別子）≠ `private_key`（秘密・管理者権限）。前者は OK、後者は厳禁。

## GitHub に入れてはいけないもの

- `.env` / `.env.local` / `.env.*.local`
- Service Account JSON（`serviceAccount*.json` / `*service-account*.json` / `firebase-adminsdk*.json`）
- 任意の PEM 秘密鍵、`client_secret`、`GOOGLE_APPLICATION_CREDENTIALS` が指す鍵ファイル
- 外部AIの APIキー（OpenAI/Anthropic/Gemini など）

これらは `.gitignore` で除外済み。誤って追加した場合は履歴からの削除（`git filter-repo` 等）と**鍵のローテーション**が必要。

## ZIP 混入チェックと保証範囲

- 本スキャンは**リポジトリ内ファイル**を対象とする静的チェックで、**秘密情報の混入を減らすための仕組み**。
- **最終 ZIP の中身（実物）の保証はしない。** 配布 ZIP に何が入ったかの確認は、**ZIP 作成後に別レビューで実施**すること。
- Claude / Codex は最終 ZIP の実物を保証しない。`security:scan` の PASS は「リポジトリのスキャン対象に FAIL パターンが無い」ことのみを意味する。
