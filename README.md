# Oriex

Oriex は、学習記録、復習、単語練習、先生問題、プロフィール、ハムスター3D、ローカルAI支援をまとめた React + Vite アプリです。

このリポジトリは、元の大きな legacy bundle を残しながら、編集しやすい機能から `src/features/` と `src/services/` に切り出している段階的移行構成です。`src/legacy/oriex-app.bundle.js` と `dist/` は直接編集しません。新しい修正は、原則として移行済みの手書きソースと docs に入れます。

## 開発環境

初回セットアップと起動:

```bash
npm ci
npm run dev
```

Vite のローカル開発サーバーが起動します。表示された localhost の URL をブラウザで開いて確認します。

## コマンド一覧

GitHub 公開前に通常確認するコマンド:

```bash
npm ci
npm run dev
npm run lint
npm run test
npm run security:scan
npm run build
npm audit
```

各コマンドの役割:

| コマンド | 用途 |
| --- | --- |
| `npm ci` | `package-lock.json` に固定された依存関係をクリーンにインストールする |
| `npm run dev` | 開発サーバーを起動する |
| `npm run lint` | ESLint で静的チェックする |
| `npm run test` | 通常の Vitest を実行する |
| `npm run security:scan` | 秘密鍵、Service Account JSON、外部AIキー/エンドポイント混入を検出する |
| `npm run build` | GitHub Pages 配布用の `dist/` を生成する |
| `npm audit` | npm 依存関係の脆弱性を確認する |

Firestore Rules Emulator は環境依存のため別枠です:

```bash
npm run test:rules
```

`test:rules` は Firebase CLI と Firestore Emulator を使います。初回実行時に Firestore Emulator の jar 取得が必要になるため、ネットワーク制限がある環境では失敗する可能性があります。

## GitHub Pages 公開前

公開先リポジトリは [bahamuchomax-dev/testa](https://github.com/bahamuchomax-dev/testa) を想定しています。

公開前は [docs/GITHUB_RELEASE_CHECKLIST.md](./docs/GITHUB_RELEASE_CHECKLIST.md) を上から確認してください。最低限、`lint`、`test`、`security:scan`、`build`、`audit`、外部AI文字列チェック、ZIP内容確認、PC/スマホ実機確認、Service Worker 更新確認、ハムスター3D、テーマ写真、アバター保存/復元、XSS 簡易確認を行います。

Vite は `base: "./"` で設定しており、GitHub Pages のプロジェクトサブパスでも相対URLで動く構成です。`dist/` は生成物なので、開発 ZIP やソース管理には含めません。GitHub Pages はリポジトリ直下ではなく、GitHub Actions が生成した `dist/` artifact を配信してください。

起動入口は `src/main.js` です。通常は Vite/GitHub Actions の build artifact から起動しますが、GitHub Pages が誤ってリポジトリ直下を配信しても最低限 legacy app が起動できるよう、入口は JSX を含まない `.js` にし、CSS は `index.html` から読み込んでいます。

## ローカルAI

ローカルAI機能は、同じ端末で起動した Ollama にだけ接続します。外部AI API、外部AI SDK、外部AI APIキー入力欄は使いません。外部AI APIを追加しないでください。

ローカルAI実装は残っていますが、現在UIからのアクセスは一時停止中です。通常画面の浮遊ボタンと App タブには表示されません。再有効化する場合は `src/features/localAi/uiFlag.js` の `LOCAL_AI_UI_ENABLED` と sidecar mount / App 側の導線を戻してください。

Ollama の必要条件:

```bash
ollama serve
ollama pull qwen2.5:14b-instruct
```

推奨モデル:

```txt
qwen2.5:14b-instruct  推奨。文章整理、要約、問題作成のバランスがよい
qwen2.5:7b-instruct   軽量。低スペックPC向け
qwen2.5:32b-instruct  高性能PC向け。重いが精度を狙える
```

ローカルAIの安全仕様:

```txt
通信先は http://localhost:11434 / http://127.0.0.1:11434 のみ許可
外部AI APIは使わない
APIキーは扱わない
生成結果は自動保存しない
PDFはブラウザ内でテキスト抽出する
画像PDF/OCRは未対応
```

ローカルAIの設定は `localStorage` に保存しますが、保存するのは接続先URL、モデル、モデルプロファイル、最後に使ったタブなどの設定だけです。生徒情報、先生メモ、PDF本文、生成結果は自動保存しません。

詳細は [docs/LOCAL_AI.md](./docs/LOCAL_AI.md) を参照してください。

## スマホ向け埋め込みAI（実験）

スマホ単体でも動く可能性のある「端末内AI（埋め込みAI）」の土台を**実験機能**として追加しました。Ollama（PC向け・高品質ローカルAI）の置き換えではなく、別トラックです。

- 現在は通常UIでは**無効**です（`src/features/embeddedAi/embeddedAiConfig.js` の `EMBEDDED_AI_UI_ENABLED = false`）。通常画面には出していません。
- 外部AI APIではありません。AIキーや `.env` も追加していません。Ollama 実装は残しています。
- 初期表示では読み込みません。`src/main.js` からも import していないため、起動や初期 bundle に影響しません。
- エンジン/ライブラリは、ユーザーが明示的に「端末内AIを試す」を押した時にだけ、動的 import で読み込む設計です（将来エンジンを差し込む前提の抽象層）。今回はライブラリ依存を追加せず、抽象層・端末判定・dev専用パネル・docs のみです。
- 初回はモデル取得が必要になる可能性があり、端末によっては動作しません。失敗してもアプリ本体と学習データは壊れません。
- モデルを取得する場合でも、入力文・生徒データ・先生メモは外部AI APIへ送信しません。生成結果はテキストとして描画し、HTMLとしては描画しません。

将来の有効化条件と詳細は [docs/EMBEDDED_AI_PLAN.md](./docs/EMBEDDED_AI_PLAN.md) を参照してください。実エンジンはまだ追加していません。候補（WebLLM系 / Transformers.js系 / MediaPipe系 / 抽象層のみ継続）の比較とフェーズ2の判断基準は同docsの「Engine Candidates」「Phase 2 Entry Criteria」にまとめてあり、実機調査の後に候補を選びます。srcはベンダ中立に保ち、具体的なエンジン名はdocs側にのみ記載しています。

フェーズ2では**実機診断プローブ**のみを追加しました（実モデル/実エンジンは未追加）。`embeddedAiProbe.js` が WebGPU / IndexedDB / ストレージ容量目安 / メモリ / オンライン状態 / 端末種別などを読み取り、`likely / limited / unlikely / unknown` の目安を返します。診断は端末機能の有無を表示するだけで、結果を外部送信・自動保存しません。確認用UIは未マウントの `EmbeddedAiProbePanel.jsx`（`EMBEDDED_AI_PROBE_ENABLED = false`）で、通常UIには出していません。実機確認手順は同docsの「Phase 2 Device Probe」「Manual Device Checklist」を参照。結果を見てフェーズ3でエンジン候補を決めます。

埋め込みAI診断は通常UIには表示されません。実機調査時のみ docs/EMBEDDED_AI_PLAN.md の診断URL（`?oriexProbe=embedded-ai` または `#embedded-ai-probe`）で開きます。通常アクセスでは従来どおり legacy アプリが起動し、診断UIのchunkは読み込まれません。

フェーズ3で実エンジンを選ぶ前に、iPhone / Android / PC で診断し、結果を [docs/EMBEDDED_AI_DEVICE_RESULTS.md](./docs/EMBEDDED_AI_DEVICE_RESULTS.md) のテンプレートに記録します。診断結果には名前・生徒情報・先生メモ・学習記録などの個人情報を含めないでください。

## テーマ写真とアバター

テーマ写真とプロフィールアバターは、どちらも端末内の IndexedDB に Blob として保存します。画像本体を `localStorage` に base64 保存せず、外部送信もしません。

テーマ写真:

```txt
長辺1600px程度に圧縮して IndexedDB に保存
Blob URL でホーム/テーマ背景へ反映
再読み込み後は IndexedDB から復元
削除すると IndexedDB から消える
iPhone/PWA 向けに capture は付けず、選択後に input value をリセット
```

アバター:

```txt
長辺512px程度に圧縮して IndexedDB に保存
プロフィール保存 payload には name / bio のみ入れる
画像本体、base64、data URL は localStorage に入れない
Blob URL でプレビューし、差し替え/削除時に復元状態を確認する
```

テーマ写真の背景反映は `window.__oxBg` が担当します。写真ON時は `body.oxbg-on` を付け、`#oxbg-photo-layer` に Blob URL を反映します。legacy 本体の全画面背景は写真ON時だけ透明化し、`#root` は背景レイヤーより上に配置します。

## セキュリティ状況

Firebase / Firestore:

```txt
Firestore Rules、認証方式、データ構造はこの最終整理では変更していません
firestore.rules は既存のままです
通常の npm run test から Rules Emulator テストは分離しています
Rules Emulator は npm run test:rules で別途確認します
```

XSS / CSP:

```txt
非 legacy ソースは React の通常エスケープと sanitizeText 系テストで確認
非 legacy ソースの危険な HTML sink は静的テストで確認
index.html には安全な範囲の meta CSP（object-src 'none'; base-uri 'self'）を適用済み
strict な script-src 等は legacy / inline script 依存を解消してから判断
legacy bundle 内の HTML 経路は未確認事項として docs に残しています
```

秘密情報スキャン:

```txt
npm run security:scan で FAIL 0 を確認する
Firebase Web config の apiKey 形は WARN 扱い
Service Account 秘密鍵、実鍵 material、外部AIキー/エンドポイントは FAIL
FULL 許可は廃止済み
scripts/securityScan.mjs と test/secretScanStatic.test.js は NAME 免除のみ
テスト用 fake 値だけ secret-scan-allow-fixture の行マーカーで明示許可
```

詳細は [docs/SECURITY_CHECKLIST.md](./docs/SECURITY_CHECKLIST.md)、[docs/XSS_AUDIT.md](./docs/XSS_AUDIT.md)、[docs/SECRET_AUDIT.md](./docs/SECRET_AUDIT.md) を参照してください。

## React migration

Profile is the first React migration target. Phase 1 prepared `src/features/profile/Profile.jsx` inside the unmounted React scaffold: text saves go through `profileRepository.save()` with sanitize/clamp, avatar images stay in IndexedDB Blob storage, and object URL cleanup is guarded. The production entry has not been switched: `src/main.js` still boots the legacy bundle, so the visible legacy profile screen remains live until a later Profile-only switch decision.

Records / learning logs were hardened in phase 3, but are still not production-visible. `src/features/records/Records.jsx` stays behind the unmounted scaffold and `records` is not in `TABS`. The free-text subject is now sanitized + length-clamped before it is saved: `recordsRepository.add()` runs the subject through `sanitizePlainText` (HTML tags and `javascript:`-style schemes stripped, control chars removed, trimmed) and clamps it to `RECORDS_SUBJECT_MAX_LENGTH` (80). `Records.jsx` sets the same constant as the input `maxLength`, guards every save/delete on a usable uid, and renders rows with plain `{text}` (no raw-HTML sinks). `minutes` validation is unchanged (`parsePositiveMinutes`). Storage is still localStorage via the repository; Firestore is not connected. Moving Records to Firestore later requires a scoped query + `readCache` + Rules emulator green.

Next migration decision: either switch Profile live after desktop/mobile checks, decide whether Records is reached from Home only or also as a tab and verify save/delete/reload/weekly rollup before route exposure, or continue preparing the remaining screens behind the unmounted scaffold.

## Docs

主要 docs:

- [docs/SECURITY_CHECKLIST.md](./docs/SECURITY_CHECKLIST.md)
- [docs/XSS_AUDIT.md](./docs/XSS_AUDIT.md)
- [docs/SECRET_AUDIT.md](./docs/SECRET_AUDIT.md)
- [docs/BUG_AUDIT.md](./docs/BUG_AUDIT.md)
- [docs/FIREBASE_READ_AUDIT.md](./docs/FIREBASE_READ_AUDIT.md)
- [docs/REACT_MIGRATION_PLAN.md](./docs/REACT_MIGRATION_PLAN.md)
- [docs/LOCAL_AI.md](./docs/LOCAL_AI.md)
- [docs/GITHUB_RELEASE_CHECKLIST.md](./docs/GITHUB_RELEASE_CHECKLIST.md)

`docs/FIRESTORE_RULES_DRAFT.md` はこの ZIP には存在しないため索引に載せていません。Rules 関連は `firestore.rules`、[docs/SECURITY_CHECKLIST.md](./docs/SECURITY_CHECKLIST.md)、[docs/FIREBASE_READ_AUDIT.md](./docs/FIREBASE_READ_AUDIT.md) を確認してください。

## 触らないもの

```txt
node_modules/
dist/
coverage/
.cache/
.env
.env.local
.git/
.DS_Store
src/legacy/oriex-app.bundle.js
src/styles/utilities.css
```

`dist/` は `npm run build` の生成物です。`node_modules/`、`dist/`、`.env*`、`.git/` は公開用 ZIP や開発 ZIP に含めません。

## 既知の未対応事項

- PC/スマホ実機での最終確認は GitHub Pages 反映後に実施します。
- Service Worker 更新確認、ハムスター3D、テーマ写真、アバター保存/復元、XSS 簡易確認は公開前チェックリストに残しています。
- 画像PDF/OCRには未対応です。テキスト抽出できるPDFのみ対応します。
- スマホなど別端末のブラウザから、LAN上のPCで動く Ollama へ直接送る構成は許可していません。
- legacy bundle 内に残る画面は段階的移行中です。直接編集せず、React 移行時に `src/features/` と `src/services/` 側へ寄せます。

## GitHub での公開と CI / Pages

このリポジトリには GitHub 用のワークフローが含まれています（`.github/workflows/`）。

- `ci.yml` … `push`（main）と Pull Request で `npm ci → lint → test → security:scan → build → npm audit` を自動実行します。秘密情報スキャン（`security:scan`）も CI で必ず走ります。
- `deploy-pages.yml` … main への push で Vite ビルドを GitHub Pages へ自動デプロイします。`vite` の `base: "./"` によりプロジェクトのサブパス配信でもアセットが解決されます。ビルド後に `node scripts/pagesSmokeCheck.mjs dist` を実行し、白画面につながる asset 参照漏れをデプロイ前に検出します。

### 初回プッシュ

```bash
git init
git add .
git commit -m "Initial commit: Oriex"
git branch -M main
git remote add origin https://github.com/<ユーザー名>/<リポジトリ名>.git
git push -u origin main
```

### GitHub Pages を有効化（Actions デプロイを使う場合）

リポジトリの **Settings → Pages → Build and deployment → Source** を **「GitHub Actions」** に設定します。以後、main への push で自動デプロイされます。Source が `main` / root のままだと、Vite の開発用 `index.html` が配信されて白画面になる可能性があります。手動で `dist/` をアップロードする運用を続ける場合は `deploy-pages.yml` を使わなくても構いません。

### 公開前チェック（ローカル）

```bash
npm ci
npm run lint
npm run test
npm run security:scan   # 秘密鍵 / Service Account / 外部AIキー混入チェック
npm run build
npm audit
```

> 秘密情報の扱いは `docs/SECRET_AUDIT.md` を参照してください。Firebase Web の `apiKey` はフロントに含まれてよい識別子（スキャンは WARN）で、Service Account の秘密鍵（private key）は厳禁（FAIL）です。**配布 ZIP 自体の実物確認は別レビューで行ってください。**
