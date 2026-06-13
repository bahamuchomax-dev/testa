# Oriex — 移行ガイド（MIGRATION）

> このファイルは2部構成です。
> 第1部「v5-5 現状整理」＝v5-5時点の完了内容と現在の構成。
> 第2部「React / Vite 段階的移行」＝以前からの移行方針（内容は変更していません）。

---

# 第1部　v5-5 現状整理

## 目的

今後の Oriex ローカルAI v5 以降の開発をしやすくするための **構成整理と完了状態の記録**。
v5-5時点では、ローカルAIの画面分割、決定的バリデータ、テーマ写真の端末内保存・復元・実表示修正まで反映済み。

## 結論（重要）

このリポジトリは元から、責務ごとに分割された段階的移行構成になっており、
目標フォルダ構成（依頼書 1 章）の大部分を **すでに満たしていた**。
そのため今回は、壊れる危険のある大移動は避け、**安全で確実に価値のある最小限の整理**に絞った。
何を・なぜ「やらなかったか」も後述する（手抜きではなく意図的判断）。

## これまでにやったこと（変更したファイル）

| 種別 | 対象 | 内容 |
|---|---|---|
| 移動 | `src/app/App.jsx` → `src/App.jsx` | 過去の整理で目標構成に合わせて1階層上げた。現在の移行先Reactシェルは `src/App.jsx`。 |
| 移動+加筆 | ルート `MIGRATION.md` → `docs/MIGRATION.md` | 目標構成（docs配下）に合わせて移動。今回の整理内容（この第1部）を先頭に加筆。第2部の既存内容は変更なし。 |
| 追加 | `docs/FILE_STRUCTURE.md` | どのフォルダが何を担当し、新機能をどこに足すか、触ってはいけない生成物は何か。 |
| 追加 | `docs/LOCAL_AI.md` | ローカルAI（Ollama）の仕組み・許可URL（localhost/127.0.0.1のみ。LAN IPは許可しない）・JSON Schema・自己検査・修正生成・PDF処理。 |
| 追加 | `docs/SECURITY_CHECKLIST.md` | 外部AI禁止／APIキー禁止／localhost/127.0.0.1のみ許可／PDF本文の外部送信禁止／生成結果の自動保存禁止 等。 |
| 更新 | `README.md` | セットアップ・各npmスクリプト・ローカルAIの使い方・フォルダ構成・編集すべきファイルを整理。テスト件数の記述ずれ（62→69）も修正。 |
| 更新 | `src/main.jsx`（コメントのみ）, `src/legacy/README.md` | 過去の `src/app/App.jsx` 参照を `src/App.jsx` に追従。コードの挙動は不変。 |
| 更新 | `.gitignore` | `.env` / `.env.local` を明示追加（配布物に混入させないため）。 |

> 上記以外の **ソースコードの中身（ロジック・UI・データ構造）は変更していない。**

## 移動したファイル（パス対応）

```txt
MIGRATION.md            → docs/MIGRATION.md
src/app/App.jsx         → src/App.jsx
```

## 変更していない仕様（明示）

- 既存の動作・UI・デザイン。
- Firestore Rules、認証処理、データ構造。
- ローカルAIの接続先制限（`http://localhost:11434` / `http://127.0.0.1:11434` のみ。LAN IPは許可しない）。
- 外部AI APIへ送信しない設計。
- 生成結果を自動保存しない方針（コピー / .txt 保存のみ）。
- `src/legacy/oriex-app.bundle.js`（レガシーbundle）には一切触れていない。
- `dist/` は生成物として扱い、ソースとして編集していない。

## v5-5時点で完了したこと

| 種別 | 対象 | 内容 |
|---|---|---|
| 整理 | `src/features/localAi/LocalAiPanel.jsx` | 巨大な単一画面から、`panels/`・`components/`・`utils/` へ分割済み。`LocalAiPanel.jsx` はタブ構成とパネル呼び出しの薄い入口になっている。 |
| 追加 | `src/features/localAi/localAiValidators.js` | ローカルAI出力の決定的バリデータを実装済み。単語範囲外混入など、LLMの自己検査だけに任せたくない条件をコードで検査する。 |
| 追加 | `test/localAiValidators.test.js` | 上記バリデータのテストを追加済み。 |
| 修正 | テーマ写真 | 写真BlobをIndexedDBに保存し、選択後すぐBlob URLで背景へ反映。写真ON時は `body.oxbg-on` を付ける。 |
| 修正 | テーマ写真 | 起動時にIndexedDBから復元し、削除時はIndexedDB・CSS変数・`body.oxbg-on` を解除する。画像本体はlocalStorageへbase64保存しない。 |
| 修正 | テーマ写真 | 実画面で写真がlegacy本体の全画面背景に隠れないよう、写真ON時に `#oxbg-photo-layer` を作成する方式へ更新。`#root` は `z-index:1`、写真レイヤーは `z-index:0` とし、`body.oxbg-on #root > div` の全画面背景を透明化する。 |
| テスト | テーマ写真 | `#oxbg-photo-layer` の作成、背景画像設定、非負のz-index、削除、`afterTheme()` 後の復元、legacy全画面背景透明化CSSを確認するテストを追加済み。 |

## あえて「やらなかった」こと と その理由

「目標フォルダ構成と完全一致させなくてよい」「壊さない」「機能追加しない」という条件に従い、
次は **意図的に見送った**（必要になった時点で第2部の手順に沿って進める）。

| 見送った変更 | 理由 |
|---|---|
| `src/services/` → `src/lib/{firebase,storage,…}` への改名移動 | import 箇所が約25ファイル＋全テストに波及する高リスク変更で、機能的な利得がない。現状の `services/`（データ・連携層）と `lib/`（純ロジック）はすでに責務分離できている。`docs/FILE_STRUCTURE.md` に対応表を記載。 |
| `src/lib/{minutes,sanitize,wordKey}.js` の `utils/` `security/` への細分化 | 3つの小さなファイルで、フラットな方が見つけやすい。サブフォルダ化は import を壊すだけで利得が薄い。 |
| `localAi/index.jsx` → `index.js` への改名 | このファイルは JSX を含む（`Sidecar` コンポーネント）。`.jsx` が正しく、importerも `.jsx` 指定。改名はビルドを壊す恐れ。 |
| `public/` の `icons/` `images/` `data/` サブフォルダ化 | `icon-*.png` / `manifest.webmanifest` / `sw.js` / `three.min.js` は `index.html`・`manifest.webmanifest`・`sw.js` から **絶対URL（`/icon-180.png` 等）で参照**されている。移動するとURLが変わり、PWA・SWキャッシュ・アイコン表示が壊れる＝挙動変更。フラットのまま維持。 |
| 空の `src/components/{common,layout,ui}/` `src/assets/` の作成 | 現時点で入れる中身がない。空フォルダの先行作成はノイズになるため、代わりに `docs/FILE_STRUCTURE.md` に「新規共有UIはどこに置くか」を明記。 |
| `public/robots.txt` の追加 | 既存になく、デプロイ挙動に関わる。今回は「既存物の整理」が目的のため追加しない。 |

## 将来 v5-5 以降で触る場所（次の一手）

1. **Firestore 接続**（第2部「Firestore 接続」）。配線箇所は `src/services/firebase/client.js` の1ファイルのみ。
2. **Firestore Rules の配備**（第2部「Firestore Rules」）。UIの `if (!isTeacher)` はセキュリティではない。
3. **PWA を `vite-plugin-pwa` へ**（第2部「PWA」）。手書き `public/sw.js` の更新事故を減らす。
4. （必要になったら）`src/services/` の `src/lib/` 統合や共有UI用の `src/components/` 新設。先に `docs/FILE_STRUCTURE.md` の方針に従う。

---

# 第2部　React / Vite 段階的移行（既存・内容変更なし）


## このプロジェクトの位置づけ

元の `index.html` は、巨大なCSSとビルド済みJavaScriptが直書きされた1ファイル構成だった。
sourcemap が無いため、ビルド済みbundleから元のReactソース（ファイル名・変数名・コンポーネント境界・設計意図）を**完全復元することはできない**。

そこでこのリポジトリは「完全復元」ではなく、**段階的移行**の土台として作られている。
今すぐ編集したい部分（3Dエンジン・データ層・CSS・各画面の実体）を切り出して編集可能にしつつ、
未移行の画面は `src/legacy/oriex-app.bundle.js`（元の製品ビルド）が引き続き描画することで、アプリは動いたまま保たれている。

参考ドキュメントの10ステップに対する現状は次のとおり。

| # | ステップ | 状態 |
|---|---|---|
| 1 | Viteで起動できる最小構成を作る | ✅ 完了 |
| 2 | 巨大bundle依存をやめる | 🟡 進行中（bundleは「凍結したレガシー画面」として明示分離。各画面を移したら縮む） |
| 3 | 画面ごとにReactコンポーネント化する | 🟡 雛形を用意（`src/features/*`）。1画面ずつ本採用していく |
| 4 | CSSを整理する | ✅ 生成Tailwind（`utilities.css`）と手書きCSS（`app.css`）に分離 |
| 5 | データ層をRepository化する | ✅ `src/services/repository/*` を実装 |
| 6 | localStorage fallbackを残す | ✅ Repositoryは現状localStorage実装 |
| 7 | Firestore接続を段階的に入れる | ⬜ 未着手（`firebase/client.js` に配線手順をコメントで用意） |
| 8 | uid混線・認証待ち・Rulesを固める | 🟡 設計と雛形あり（`authReady`、key/value一致保存）。Rules本体は未配備 |
| 9 | テストを追加する | ✅ 壊れやすい境界に対するテストを同梱 |
| 10 | PWAとbundle sizeを調整する | 🟡 手書きSWを同梱。`vite-plugin-pwa` への移行が次段階 |

## いま編集できるもの（Stage 1 で実体化済み）

- `src/features/hamster/oriexHamu3D.js` — 3Dハムスターエンジン（手書き・可読）。
- `src/services/oxHelpers.js` — 背景画像 / アバター / 学習分集計の各ヘルパー。
- `src/styles/app.css` — `.rx-*` / `.oriex-*` の手書きスタイル（**ここを編集する**）。
- `src/styles/utilities.css` — 生成Tailwind（基本さわらない）。
- `src/services/repository/*` — 画面が保存先を意識しないためのデータ層。
- `src/lib/*` — `minutes` / `wordKey` / `sanitize` の純ロジック。
- `src/features/localAi/` — ローカルAI画面。`panels/`・`components/`・`utils/` に分割済み。
- `src/features/*/*.jsx` + `src/App.jsx` — 移行先の画面雛形（下記参照）。

## まだレガシー側にあるもの

実際に動いている各画面（ホーム・復習・Factory・プロフィール・先生問題・記録・ハムスター）の
**Reactソースは `src/legacy/oriex-app.bundle.js` の中**にあり、minify済みのため直接編集には向かない。
`src/features/*` の `.jsx` は、それらを置き換えるための**手書きの移行先**で、現状はまだ `main.jsx` から読み込まれていない。

## 画面を1つ移行する手順

1. `src/features/<screen>/<Screen>.jsx` を、レガシー画面の実挙動を見ながら実装（雛形が用意済み）。
   データの読み書きは必ず `src/services/repository/*` 経由にする（localStorage / Firestore を画面に直書きしない）。
2. `src/App.jsx` でその画面を本採用する（該当タブで実コンポーネントを描画）。
3. レガシー側の同じ画面を無効化する。最終的に全画面が移行したら:
   - `src/main.jsx` の読み込み先を `src/legacy/oriex-app.bundle.js` から `src/App.jsx` に切り替える、
   - `src/legacy/` を削除する。
4. `npm run build` と `npm run test` で確認する。

> `src/legacy/oriex-app.bundle.js` を触らないと直せない状態が残っている限り、
> 「本当に編集しやすいReact/Vite化」は完了ではない、という点を判断基準にする。

## 各画面の雛形に入っている修正（参考ドキュメント由来）

- **Home** — localStorage直読みをやめ、Records/TeacherProblems と同じRepository経由の週次集計で表示する。
- **Records** — `parsePositiveMinutes` が0.4分を0にせず、1分未満を拒否。手動ログに `source:"manual"`、保存失敗はUI表示。
- **Review** — 先頭20件固定ではなくランダム抽出。間違えた単語を優先。履歴を `wordId` / `category` / `stage` で区別。
- **Factory** — 削除を `id` ではなく `wordKey()` で行い、id無しの古いデータをまとめて消さない。
- **Profile** — 保存前に `undefined` を除去（Firestore対策）、変化が無ければ書き込まない。`role`/`isTeacher` は画面から書かない。アバターは画像形式チェック・5MB制限・1600pxリサイズ・失敗時エラー表示。
- **TeacherProblems** — 問題本文と解答を別ストアに分離し、生徒に解答を送らない。全体配信と個別配信を分ける。
- **HamsterRoom** — `env.an` を渡してランタイムクラッシュを防ぎ、状態変更のたびにシーンを作り直さず初回だけ生成する。

## uid別保存の注意（混線対策）

ユーザー切り替え時、Reactのstateが一瞬前の値を保持したまま保存effectが走ると、
前ユーザーのデータを新ユーザーのキーに書き込む事故が起きる。
stateに「読み込み元キー」を持たせ、現在のキーと一致するときだけ保存する。

```js
const [state, setState] = useState(() => ({ key: currentKey, value: load(currentKey) }));
useEffect(() => { setState({ key: currentKey, value: load(currentKey) }); }, [currentKey]);
useEffect(() => { if (state.key !== currentKey) return; save(currentKey, state.value); }, [currentKey, state]);
```

## Firestore 接続（次段階）

`src/services/firebase/client.js` が唯一の配線箇所。手順:

1. `npm i firebase`
2. `FIREBASE_CONFIG`（または `import.meta.env.VITE_FIREBASE_*`）を設定
3. `firebaseEnabled = true`
4. `getDb()` を `import()` で動的読み込みにして、必要なときだけFirebaseを落とす（初回bundleを軽く保つ）
5. すべてのRepository購読を `authReady` で待つ（匿名サインイン完了前に `users/{uid}/...` を読まない）

各Repositoryは localStorage 実装を**オフラインfallbackとして残し**、Firestore実装を同じI/Fで足す。

## Firestore Rules（草案＝本番適用前ハード化済み・`firestore.rules`）

UIの `if (!isTeacher) return;` はセキュリティではない。`firestore.rules` に本番適用前レベルまで厳格化した草案を用意した（役割は**サーバ設定のカスタムクレーム** `request.auth.token.teacher` / `.admin` で判定。クライアント書き込み可能フィールドには依存しない）。要点:

- **profiles**: 本人の作成/更新は**ホワイトリスト**（`name`/`bio`/`avatar`/`avatarUrl`/`theme`/`createdAt`/`updatedAt` のみ、`hasOnly`）。`role`/`isTeacher`/`teacherId`/`admin` 等および未知フィールド（`teacherOnlyNote`・`internalMemo` など）は本人が作成・変更できない。これらの変更は管理者のみ。
- **records / bookLogs**: 書き込みは本人のみ。`request.resource.data.userId == request.auth.uid`（＝path所有者と一致）を必須化し、フィールドもホワイトリスト化。
- **users/{u}/deliveredProblems**: 書き込みは **担当先生（`teaches(u)`）または管理者のみ**。`data.userId == u` を必須化し、`answer`/`correctAnswer`/`explanation`/`solution`/`answerKey`/`answers` 等の解答フィールドを禁止。
- **teacherProblemAnswers**: 先生は**自分が所有する解答（`teacherId == 自分`）または担当生徒（`studentUid`）の解答のみ**読める。先生全員での共有はしない。生徒は一切読めない。**本番適用前に answer doc へ `teacherId`（必要に応じて `studentUid`）を必須化すること**（これが無い既存docはRules上読めなくなる）。
- **deliveredProblems（top-level）**: read を **teacher/admin のみ**に制限（生徒は `users/{uid}/deliveredProblems` から読む）。書き込みは解答フィールド禁止。
- **public/data/teacherProblems**: 全サインインユーザーが read（公開ブロードキャスト）。書き込みは先生のみ＋解答フィールド禁止。
- **teacherAllowlist**: 付与/剥奪は管理者のみ。`list()` 禁止（列挙不可）。
- 末尾は明示的 default-deny。

検証: `test/firestoreRulesStatic.test.js`（エミュレータ無しでの静的検査）で上記ガードの存在を継続確認。**Rules エミュレータでの挙動テストは未導入（未対応）**。


## PWA（次段階）

現状は手書きの `public/sw.js`（network-first navigations + stale-while-revalidate）。
更新事故を減らすため、`vite-plugin-pwa` でprecacheをビルド生成する方式へ移行するのが望ましい。

## 確認コマンド

```bash
npm ci          # package.json と package-lock.json を同期（CI前提）
npm run lint
npm run test
npm run build
```
