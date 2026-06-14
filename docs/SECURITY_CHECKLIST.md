# SECURITY_CHECKLIST

配布前に確認する安全仕様のチェックリストです。ローカルAI、テーマ写真、保存方針、ZIP内容を対象にします。

## ローカルAI

- [ ] 通信先は `http://localhost:11434` と `http://127.0.0.1:11434` のみ。
- [ ] 外部AI API、外部AI SDK、APIキー入力欄を追加していない。
- [ ] LAN IP、任意ホスト、https、`0.0.0.0`、`::1` へのAI通信を許可していない。
- [ ] PDF本文、先生メモ、生徒情報を外部送信していない。
- [ ] 生成結果を自動で `localStorage`、Firestore、その他の永続領域に保存していない。
- [ ] `localStorage` に保存するのはローカルAI設定だけ。
- [ ] APIキーをコード、`.env`、`localStorage` に保存していない。

## スマホ向け埋め込みAI（実験）

- [ ] 実験機能であり、通常UIでは無効（`EMBEDDED_AI_UI_ENABLED = false`）。本番導線に出していない。
- [ ] `src/main.js` から import しておらず、初期表示・初期 bundle に含めていない。
- [ ] プロンプト・入力文・生徒データ・先生メモを外部AI APIへ送信していない。
- [ ] 外部AI API / 外部AI エンドポイント / AIキー / `.env` を追加していない。
- [ ] エンジン/ライブラリは opt-in 時のみ動的 import する設計（今回はライブラリ依存を追加していない）。
- [ ] モデル取得先を使う場合は docs に明記し、入力文は送らない。長文プロンプトを `localStorage` に保存しない。
- [ ] IndexedDB / Cache Storage にモデルキャッシュが作られる場合は docs に明記する。
- [ ] 生成結果を HTML として描画しない（`dangerouslySetInnerHTML` / `innerHTML` 不使用）。
- [ ] Ollama 実装を削除していない。LocalAI UI 停止状態を勝手に戻していない。
- [ ] 実エンジンはまだ追加していない（依存追加なし）。具体的なエンジン候補名は src ではなく docs に記載（src はベンダ中立）。
- [ ] フェーズ2の実機診断プローブは端末機能の有無を読むだけ。診断結果を外部送信しない / 自動保存しない / Firebaseへ送らない。
- [ ] プローブは権限要求しない（位置情報・連絡先・写真・マイク・カメラを要求しない）。
- [ ] プローブは未マウント（`EMBEDDED_AI_PROBE_ENABLED = false`、通常UI未表示）。診断結果はコピー用テキスト表示のみ。
- [ ] 診断は明示URL（`?oriexProbe=embedded-ai` / `#embedded-ai-probe`）でのみ開く。通常アクセスは legacy 起動のまま、診断chunkを読み込まない。診断UIは dynamic import で別chunk。
- [ ] フェーズ3A WebGPU PoC は adapter のみで実エンジン/モデル/依存を未追加。`EMBEDDED_AI_POC_ENABLED = false`、通常UI/TABS未表示、隠しURL（`?oriexProbe=embedded-ai-poc` / `#embedded-ai-poc`）でのみ到達、dynamic importで別chunk。
- [ ] PoCはプロンプトを `localStorage` 等に保存しない、結果を Firebase等へ自動送信しない、入力文を外部AI APIへ送らない、生成結果をHTMLとして描画しない。モデル取得先を使う場合は docs に明記し入力は送らない。
- [ ] フェーズ3B WebLLM（`@mlc-ai/web-llm`）は隠しPoC URLでのみ・ユーザー押下時だけ動的import。トップレベルで重いライブラリをimportしない。初期bundle非同梱（`index.html`非参照）。モデル/ランタイム取得先（Hugging Face / MLC libs host）をdocsに明記。取得はモデル/重み取得であり入力文の送信ではない。IndexedDB/Cache Storageに入るのはモデル/ランタイムのみ。`@mlc-ai/web-llm` は外部AI APIではない。

## PDF

- [ ] PDFテキスト抽出はブラウザ内で行う。
- [ ] PDFファイル本体を外部送信していない。
- [ ] 画像PDF/OCRは未対応として明示している。
- [ ] 画像PDFを無理にAIへ送る経路を追加していない。

## テーマ写真

- [ ] 写真選択UIから `input type="file" accept="image/*"` を開ける。
- [ ] iPhone/PWA対応として `capture` を付けていない。
- [ ] 選択後に `input.value` をリセットしている。
- [ ] 大きな画像は長辺1600px程度に圧縮して保存する。
- [ ] 写真BlobはIndexedDBに保存する。
- [ ] 画像本体を `localStorage` にbase64保存していない。
- [ ] 写真を外部送信していない。
- [ ] 保存後すぐにBlob URLを作り、背景CSSへ反映する。
- [ ] 写真ON時に `#oxbg-photo-layer` が作成され、`z-index:-1` ではない固定背景レイヤーとして表示される。
- [ ] 写真ON時に `body.oxbg-on` が付く。
- [ ] 写真ON時に `#root` は背景レイヤーより上に配置され、legacy本体の全画面背景divは透明化される。
- [ ] 削除時にIndexedDBから消え、CSS変数と `body.oxbg-on` が解除される。
- [ ] 削除時に `#oxbg-photo-layer` も削除される。
- [ ] 起動時にIndexedDBから復元する。
- [ ] テーマ色変更後も `window.__oxBg.afterTheme?.()` で背景を再適用できる。
- [ ] 失敗時に「保存OK / 読み出しOK / CSS反映NG」のように失敗箇所が分かる表示を出す。

## Firestore / 認証

`firestore.rules`（本番適用前にハード化した草案）に対するチェック。役割はサーバ設定のカスタムクレーム（`request.auth.token.teacher`/`.admin`）で判定する前提。

- [ ] コレクション名・データ構造・認証方式を変更していない。
- [ ] `profiles` の本人作成/更新がホワイトリスト（`hasOnly`）で、`role`/`isTeacher`/`teacherId`/`admin` や未知フィールドを本人が作成・変更できない。
- [ ] `records`/`bookLogs` の書き込みで `request.resource.data.userId == request.auth.uid`（path所有者と一致）を必須化している。
- [ ] `users/{u}/deliveredProblems` の書き込みが担当先生（`teaches(u)`）または管理者のみで、`data.userId == u` 必須。
- [ ] student-visible な問題（`deliveredProblems`・`public/data/teacherProblems`）に `answer`/`correctAnswer`/`explanation`/`solution`/`answerKey` を書けない。
- [ ] `teacherProblemAnswers` を先生全員で共有していない（所有先生 `teacherId` か担当生徒 `studentUid`、または管理者のみ read）。
- [ ] 生徒は `teacherProblemAnswers` を一切読めない。
- [ ] top-level `deliveredProblems` が「サインイン全員 read」のままになっていない（teacher/admin のみ）。
- [ ] `teacherAllowlist` は管理者のみ書き込み・`list()` 禁止。
- [ ] 末尾に default-deny がある。
- [ ] 本番適用前に answer doc へ `teacherId`（必要なら `studentUid`）を必須化する旨を docs に明記している。
- [ ] UIの `if (!isTeacher)` はセキュリティではなく、コード側ガード（`assertTeacher`/`assertOwnUid`/`sanitizeProfileUpdate`）と二重化している。
- [ ] `public/data/teacherProblems` には全ログインユーザーに見えてよい公開問題だけを置く。
- [ ] 個別配信は `users/{uid}/deliveredProblems` を使う。
- [ ] `public/data/teacherProblems` に正答/解説/answerKey を入れない。
- [ ] 先生用の下書きは公開ブロードキャストと別コレクションに分離する。
- [ ] `teacherProblemAnswers` の create/update はフィールド whitelist 済みで、`studentUid` がある場合は担当生徒（`teaches`）か admin に限定。
- [ ] Rules エミュレータ挙動テスト（`npm run test:rules`）を Firebase CLI のある環境で実行した（無ければ未実行の理由を記録）。
- [ ] エミュレータテストは通常の `npm run test` に混ざっていない（`*.emulator.test.js` を除外）。
- [ ] `firebase-tools` は devDependency にあり、`test:rules` はローカル CLI（`node_modules/.bin/firebase`）を使う（グローバル CLI 非依存）。
- [ ] 初回 `test:rules` は Firestore Emulator の jar ダウンロードが必要で、ネットワーク制限環境では失敗しうる旨を理解している。
- [ ] `teacherProblemAnswers` の update で `teacherId` 変更不可・`studentUid` 変更時は担当生徒（`teaches`）必須。
- [ ] `public/data/teacherProblems` と top-level `deliveredProblems` の書き込みで `teacherId == request.auth.uid`（admin 例外）を必須化し、teacherId 偽装を防止。
- [ ] `users/{u}/deliveredProblems` は teacherId 方針が明確（policy B＝フィールドを持たせない）。
- [ ] devDependency 追加後も `npm audit` が 0（`overrides` で transitive 勧告を解消、dist 非混入）。
- [ ] `public/data/teacherProblems` と top-level `deliveredProblems` は **admin でも** `noAnswerFields()`＋whitelist を通る（admin 例外は teacherId が他人でもよい点のみ）。
- [ ] 同2コレクションの delete は所有者限定（`isAdmin() || (isTeacher() && resource.data.teacherId == request.auth.uid)`）で、他先生の問題を削除できない。
- [ ] `teacherProblemAnswers` の read は案A（owner teacher か admin のみ）。担当生徒でも他先生作成の answer は読めない。

## 生成物と配布ZIP

- [ ] `node_modules/` を含めていない。
- [ ] `dist/` を含めていない。
- [ ] `coverage/` を含めていない。
- [ ] `.cache/` を含めていない。
- [ ] `.env` と `.env.local` を含めていない。
- [ ] `.git/` を含めていない。
- [ ] `.DS_Store` を含めていない。
- [ ] ZIP内パス区切りが `/` になっている。

## 検証コマンド

```bash
npm ci
npm run dev
npm run lint
npm run test
npm run security:scan
npm run build
npm audit
```

Rules Emulator は環境依存のため別枠で実行します。

```bash
npm run test:rules
```

初回実行時は Firestore Emulator の jar ダウンロードが必要で、ネットワーク制限環境では失敗する可能性があります。

外部AI文字列チェックは、`src`、`package.json`、`.env*`、`dist` を対象にし、禁止語が0件であることを確認します。

## XSS / HTML 注入対策（security hardening）

- [ ] React 表示は `{text}`（自動エスケープ）。`dangerouslySetInnerHTML` は使わない（静的テストで担保）。
- [ ] 非 legacy ソースで `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write` の代入・呼び出しをしない。
- [ ] プレーンテキスト入力（プロフィール名/自己紹介/先生メモ/生徒入力/学習記録/参考書ログ/配信本文/解答）は
      保存前に `sanitizePlainText` で無害化（日本語・改行は保持）。プロフィールは `profileRepository.save` で実施済み。
- [ ] URL を `href`/`src` に入れる場合は `sanitizeUrl`（`javascript:`/`data:` を拒否）。アバターは自前 blob: のみ。
- [ ] ローカルAI 出力/PDF 本文は原文保持。安全化は表示時・コピー時（現状 `{text}` 表示で実行されない）。
- [x] 安全な範囲の meta CSP（`object-src 'none'; base-uri 'self'`）は適用済み。strict 化（script-src 等）は index.html のインライン script と legacy 依存を解消後に適用判断。
- [ ] legacy バンドルの `dangerouslySetInnerHTML`/`innerHTML`/`javascript:` は未確認（編集禁止）。React 移行時に解消。

## セキュリティ強化 追補（やれる範囲から）

- [x] 安全な範囲の meta CSP を適用（`object-src 'none'; base-uri 'self'`）。strict 化（script-src 等）は legacy 依存と
      インライン script、`frame-ancestors` の meta 非対応、外部フォント取得不可のため見送り（`docs/XSS_AUDIT.md`）。
- [x] プロフィール name/bio に**長さ上限**（name 120 / bio 4000）を追加し、巨大入力による localStorage 圧迫を抑止。
- [x] Service Worker は版付きキャッシュ＋旧キャッシュ削除＋ navigation は network-first、**Firestore/Firebase 等の
      クロスオリジンは非インターセプト**（API 応答をキャッシュしない）であることを確認（現状維持）。
- [ ] （別枠・要設計）Firebase App Check／本物の Firebase Auth への移行（匿名+password 比較の置換）／APIキー制限。

## 秘密情報スキャン（GitHub 公開前）

- [ ] `npm run security:scan` を実行し **FAIL 0** を確認（WARN=Firebase Web apiKey は可）。詳細は `docs/SECRET_AUDIT.md`。
- [ ] `.env` / `.env.local` / `.env.*.local` を**混入禁止**（`.gitignore` 済）。
- [ ] **Service Account 秘密鍵**（`private_key` / `firebase-adminsdk*.json` / `serviceAccount*.json`）を**混入禁止**。
- [ ] **外部AIキー**（OpenAI/Anthropic/Gemini）を**混入禁止**。
- [ ] **Firebase Web config の `apiKey`（`AIza...`）はフロント可**（識別子）／**Admin SDK の `private_key` は厳禁**（管理者権限）という違いを理解。
- [ ] **最終 ZIP の中身は別途実物確認する**（このスキャンはリポジトリ内の静的チェックで、ZIP 実物は保証しない）。
