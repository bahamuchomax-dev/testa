# Firebase 読み取り監査 / 削減方針（FIREBASE_READ_AUDIT）

## 2026-06-14 追加対応: in-flight read dedupe
- `readCache` を TTL キャッシュだけでなく、同一 key の in-flight read を共有する実装に更新。
- 同じ Firestore 対象を複数画面/複数コンポーネントが同時に要求しても、fetch は1回にまとまる。
- `invalidate()` / `invalidatePrefix()` / `set()` / `clear()` は pending read も無効化し、保存/削除後に古い read 結果が cache を再汚染しない。
- 失敗した read は cache せず、次回 `get()` で再試行できる。
- 回帰テスト: `test/readCache.test.js`。

最終更新: このドキュメントは Firestore 読み取り回数の削減とセキュリティ強化のための監査結果です。

## 0. 調査方法

`src`（`legacy` を除く）と `src/legacy/oriex-app.bundle.js` に対して次のパターンを検索しました。

```
onSnapshot  getDocs  getDoc  collection(  query(  where(  orderBy(  limit(
setInterval  setTimeout  addDoc  setDoc  updateDoc  deleteDoc
```

重要な前提（正確さのため明記）:

- **ライブアプリの本体は `src/legacy/oriex-app.bundle.js`（minify 済み・約2MB・手編集不可）** です。`src/App.jsx` / `src/features/*` の多くは移行用スキャフォールドで、まだマウントされていません（`src/main.js` は legacy バンドルを起動）。
- legacy バンドルには **Firebase SDK 本体がバンドルされている**ため、パターン件数は「アプリのコード＋SDK内部コード」の合算です。ソースマップが同梱されていないため、minify 済みコードでの**呼び出し単位の正確な特定はできません**。件数は傾向の把握用です。
- 実際に編集可能な層（`src/services/repository/*`、`src/services/firebase/*`）は現在 **localStorage 実装＋Firestore スタブ**（`firebaseEnabled = false`）です。ここが将来 Firestore を有効化する唯一の接続点（`src/services/firebase/client.js` のコメント参照）であり、本対応では**この層に安全で低読み取りなパターンを実装**しました。

## 1. パターン件数（legacy バンドル, SDK 込み・参考値）

| パターン | 件数 | 備考 |
|---|---:|---|
| `query(` | 98 | SDK 内部を含む。アプリは `where`/`orderBy`/`limit` を併用している形跡あり |
| `isTeacher` | 81 | 役割分岐が多数（先生UI/権限） |
| `limit(` | 56 | 既に `limit` を多用（良い兆候） |
| `collection(` | 45 | コレクション参照 |
| `getDoc` | 30 | 単発読み取り中心（リアルタイム購読ではない） |
| `orderBy(` | 19 | 並べ替え付き取得 |
| `where(` | 11 | 絞り込み |
| `setInterval` | 8 | SDK 内部を含む。ポーリングの実体は要・移行時確認 |
| `onAuthStateChanged` | 3 | 認証状態 |
| `onSnapshot` | 1 | **SDK のエラーメッセージ文字列内のみ**。アプリ層のリアルタイム購読は確認できず |

> `onSnapshot` の唯一の出現は Firebase SDK の `includeMetadataChanges` に関するエラー文言の中で、**アプリがリアルタイム購読を張っている証拠は見つかりませんでした**。ライブアプリは「単発 `getDoc` ＋ ポーリング（setInterval）」型と推測されます。

## 2. React 層（編集可能・localStorage / Firestore ターゲット）の読み取り

| ファイル | 関数 | 対象 | 方式（現状） | タイミング | 読取/操作 | リアルタイム必須 | 方針 |
|---|---|---|---|---|---|---|---|
| `repository/recordsRepository.js` | `list/weekly` | `users/{uid}/records` | localStorage（同期） | 画面表示時 | 自uidのみ | 不要 | Firestore化時は `buildRecordsQuery`（uid＋直近30日＋limit） |
| `repository/recordsRepository.js` | `add/remove` | 同上 | localStorage | 保存/削除時 | 書込 | 不要 | `assertOwnUid` で uid 固定。保存後は該当キャッシュだけ invalidate |
| `repository/booksRepository.js` | `list/add/remove` | `users/{uid}/bookLogs` | localStorage | 画面表示/保存時 | 自uidのみ | 不要 | `buildBookLogsQuery`（uid/bookId＋date range＋limit） |
| `repository/profileRepository.js` | `get/save` | `profiles/{uid}` | localStorage | ログイン直後/保存時 | 自uidのみ | 不要 | ログイン直後に1回。常時購読しない。保存は特権フィールド除去＋uid固定 |
| `repository/teacherProblemsRepository.js` | `listDelivered` | `users/{uid}/deliveredProblems` | localStorage | 画面表示/提出後 | 自uidのみ | 不要 | `buildDeliveredProblemsQuery`（uid＋limit）。answers は別ストアで生徒に渡さない |
| `repository/teacherProblemsRepository.js` | `createProblem/getAnswer/removeProblem` | `deliveredProblems` / `teacherProblemAnswers` | localStorage | 先生操作時 | 書込/単発 | 不要 | 先生のみ（`assertTeacher`）。`getAnswer` は生徒に到達しない |
| `services/oxHelpers.js` | `refresh`（×3: 背景/プロフィール背景/アバター） | （Firestoreではない） | `setInterval(800ms)` | 常時 | ローカルの `uid()` 監視 | — | **Firestore 読み取りではない**（IndexedDB/localStorage のローカル設定再読込）。テーマ写真を壊さないため本対応では変更せず |

`src`（legacy 除く）には **`onSnapshot` も全件 `getDocs` も存在しません**（テスト `firebaseSecurity.test.js` で「onSnapshot を src に追加しない」ことを継続的に検査）。

## 3. コレクション別・取得タイミング方針（採用）

- **計画確認**: 20秒に1回のポーリングを維持（唯一の定期取得）。`planCheckPoller`（`PLAN_CHECK_INTERVAL_MS = 20000`）で、対象を現在ユーザーに限定・`limit` 前提・**非表示中は取得停止**・`start()` は冪等（二重 interval 禁止）・unmount で `stop()`＝`clearInterval`。
- **プロフィール/自分の権限**: ログイン直後に1回。手動更新のみ。常時購読しない。
- **生徒一覧（先生）**: 先生画面を開いた時に取得。`buildStudentsQuery`（`teacherId==自分`＋`orderBy`＋`limit`）。追加/編集/削除後に再取得。全生徒取得はしない。
- **学習記録**: 記録画面を開いた時に取得。`buildRecordsQuery`（直近30日＋`limit`）。保存後は追加分をUI反映、必要なら手動更新。
- **参考書ログ**: 画面を開いた時。`buildBookLogsQuery`（`userId`/`bookId`/date range/`limit`）。全件取得しない。
- **単語/復習**: ユーザー単位・画面を開いた時のみ。localStorage 運用のものは無理に Firestore 移行しない。
- **先生からの配信**: 生徒側は画面を開いた時に取得。提出/回答後に必要分だけ再取得。常時購読しない。不要な `seenBy` 書き込みを増やさない。
- **DM/チャット系**: 本当にリアルタイムが必要な場合のみ `onSnapshot`、かつ対象 thread だけ。一覧全体の常時購読は禁止（現状アプリ層に該当購読は見当たらず）。

## 4. キャッシュ / invalidate 方針

- `readCache`（`CACHE_TTL_MS = 60_000`）で同一データの短時間二重取得を防止。
- 保存/削除/更新後は該当キーだけ `invalidate(key)` / `invalidatePrefix("records:")`。
- 手動更新ボタンは残す。
- **計画確認の20秒取得はこのTTLの例外**（`planCheckPoller` 側で制御）。

## 5. クエリ制約（全件取得の構造的禁止）

`repository/firestoreQueries.js` のビルダーは `{ path, constraints }` 記述子を返し、`assertScoped()` が **`uid`/`teacherId` のスコープ**と **`limit`** の欠落を検出して例外を投げます。これにより「絞り忘れた全件取得」はビルド時点で失敗します（テスト済み）。日付範囲は `recentSinceCutoff(days)`（既定30日）。

## 6. Firestore Rules（`firestore.rules` — 本番適用前ハード化, stage 3）

役割は**サーバ設定のカスタムクレーム**（`request.auth.token.teacher` / `.admin`）で判定し、クライアント書き込み可能なフィールドには依存しません（＝生徒は自分で先生化できない）。stage 3 で「特権フィールド以外なら何でも書ける／先生なら担当外にも書ける／解答を先生全員が読める」を塞ぎました。

- 生徒: 自分の `profiles/{uid}` を読める。更新は**ホワイトリスト**（`name`/`bio`/`avatar`/`avatarUrl`/`theme`/`updatedAt` のみ・`hasOnly`）で、`role`/`isTeacher`/`teacherId`/`admin` も**未知フィールド（`teacherOnlyNote`・`internalMemo` など）も作成・変更不可**。`users/{自分}/records|bookLogs` は書き込み時に `data.userId == 自分` を必須化＋フィールドをホワイトリスト化。他人の `users/*` と `teacherProblemAnswers/*` は読めない。
- 先生: 担当生徒（`profiles.teacherId == 自分`）の `records`/`bookLogs`/`deliveredProblems`/`profile` を読める。`users/{u}/deliveredProblems` への配信は**担当生徒のみ**（`teaches(u)` または admin）で `data.userId == u` 必須・**解答フィールド禁止**。`teacherProblemAnswers` は**自分が所有する解答（`teacherId == 自分`）または担当生徒（`studentUid`）の解答のみ**読める（先生全員共有ではない）。
- 管理者（`admin` クレーム）: `teacherAllowlist/*` の付与/剥奪・役割変更が可能。`teacherAllowlist` は `list()` 不可。
- student-visible な問題（`users/{u}/deliveredProblems`・top-level `deliveredProblems`・`public/data/teacherProblems`）は `answer`/`correctAnswer`/`explanation`/`solution`/`answerKey`/`answers` を**書き込み時に禁止**。top-level `deliveredProblems` の read は **teacher/admin のみ**に制限（生徒は `users/{uid}/deliveredProblems` から読む）。
- 既定 deny（`match /{document=**} { allow read, write: if false }`）。

### 影響範囲（重要）

- **`firestore.rules` の変更のみ**で、アプリの動作（現状 localStorage）には影響しません。デプロイすると上記の境界が**サーバ側で強制**されます。
- **前提となるデータ要件**: `teacherProblemAnswers` の各 doc は **`teacherId` を必須**（生徒別解答なら `studentUid` も）にしてください。これらが無い既存 answer doc は新Rules下では読めなくなります（本番適用前のデータ整備が必要）。student-visible な問題 doc には解答系フィールドを入れないでください。
- 役割は**カスタムクレーム**運用（Admin SDK もしくは管理者限定の Cloud Function で `teacher`/`admin` を付与）。`profiles.role` 等をクライアントから変える経路は Rules・コード両方で塞いでいます。
- `teaches()` は割り当て確認に `get()` を1回使用（先生が生徒データを読むときのみ、低頻度）。
- **コレクション名・データ構造・認証方式は変更していません**（`paths.js` の既存レイアウトに準拠）。破壊的 migration はありません。

### 本番適用可否

Rules 自体は**本番適用前レベルまで厳格化済み**です。ただし**本番適用可とするには (a) answer doc への `teacherId`/`studentUid` 付与、(b) カスタムクレーム付与の運用、(c) Rules エミュレータでの挙動テスト（下記）の3点が前提**です。現時点では「静的検査済み＋エミュレータ挙動テスト整備済み（CLIがある環境で実行）の本番適用前 Rules」という位置づけです。

### `public/data/teacherProblems` の扱い（重要な運用ルール）

`public/data/teacherProblems` は全ログインユーザーが read 可能です。次の運用を厳守してください。

- **全ログインユーザーに見えてよい「公開問題」だけ**を置く。
- 個別配信は `users/{uid}/deliveredProblems` を使う（生徒ごとの出し分けはこちら）。
- **正答 / 解説 / answerKey は入れない**（Rules でも `noAnswerFields()` とフィールド whitelist で禁止済み）。
- **先生用の下書きは別コレクションに分離**する（例: `teacherDrafts/{teacherId}/...`。公開ブロードキャストに下書きを置かない）。

### Rules エミュレータ挙動テスト（stage 4 で追加, stage 4.5 で強化）

`test/firestoreRules.emulator.test.js` を追加し、`@firebase/rules-unit-testing` で未ログイン/生徒/先生/管理者の許可・拒否を実際に検証します。通常の `npm run test` からは除外（`vite.config.js` で `*.emulator.test.js` を exclude）し、`npm run test:rules`（`firebase emulators:exec --only firestore "vitest run --config vitest.rules.config.mjs"`）で別実行します。

**再現性（stage 4.5）**: `firebase-tools` を devDependencies に追加したため、`npm run test:rules` は **ローカルの `node_modules/.bin/firebase`** を使います（グローバル CLI 不要。`firebase: not found` を回避）。`firebase.json` のエミュレータは衝突しにくい `127.0.0.1:18080`（**必要なら `firebase.json` の `emulators.firestore.port` を変更可**。テストは `firebase emulators:exec` が設定する `FIRESTORE_EMULATOR_HOST` を読むため、ポートを変えてもテスト側の修正は不要です）。

> **注意**: 初回の `test:rules` では Firestore Emulator のバイナリ（`cloud-firestore-emulator-*.jar`）を Google のサーバ（`storage.googleapis.com`）からダウンロードする必要があります。**ネットワーク制限のある環境ではこのダウンロードに失敗します**（本コンテナでは 403 で取得不可）。一度ダウンロード済みの環境、またはegress許可のある環境で実行してください。`npm run test:rules` が green になってから、本番 Rules の適用を判断してください。

検証内容（抜粋）: 未ログインは profiles/records 読取・broadcast 作成不可／生徒は自分の profile のみ読取・許可フィールドのみ更新・role/isTeacher/teacherId/admin・未知フィールド不可・自分の records のみ作成・answers 読取不可／先生は担当生徒のみ profile/records 読取・担当生徒へのみ配信・student-visible に answer 系不可・自分の teacherId の answers のみ読取／管理者は role 等変更・teacherAllowlist 書込可・list 不可。**stage 4.5 追加**: answer update で `studentUid` を担当外へ変更不可・担当生徒へは可・`teacherId` を他先生へ変更不可／broadcast・top-level deliveredProblem で `teacherId` 偽装不可（自分の uid のみ、admin は例外）／per-student deliveredProblem に `teacherId` を入れられない（policy B）。

`teacherProblemAnswers` の create/update は**フィールド whitelist**（`teacherId`/`studentUid`/`problemId`/`answer`/`score`/`feedback`/`createdAt`/`updatedAt`）＋ `studentUid` がある場合 `teaches(studentUid)`（または admin）を **create と update の両方で**要求。`teacherId` は自分の uid 固定（変更不可）。生徒は read/write 不可。

**teacherId 偽装防止（stage 4.5）**: `public/data/teacherProblems` と top-level `deliveredProblems` の create/update は、非 admin の先生に `request.resource.data.teacherId == request.auth.uid` を必須化（admin は例外）。`users/{u}/deliveredProblems` は **policy B** を採用＝`teacherId` フィールドを持たせない（whitelist に含めない）。書き手は `teaches(u)` で担当先生に固定、`userId == u` も必須のため偽装の余地がありません。

**最終ハード化（stage 4.6）**:

- **admin も解答系フィールドを公開問題へ書けない**: `public/data/teacherProblems` と top-level `deliveredProblems` の create/update は、`(isAdmin() || (isTeacher() && teacherId==自分)) && noAnswerFields() && hasOnly([...])` の形にし、**admin 例外は「teacherId が他人でもよい」だけ**に限定。`noAnswerFields()` とフィールド whitelist は admin にも必ず適用されます。
- **削除は所有者限定**: 同2コレクションの delete を `isAdmin() || (isTeacher() && resource.data.teacherId == request.auth.uid)` に変更。先生は**自分の `teacherId` の問題だけ**削除でき、他先生の問題は削除できません。
- **`teacherProblemAnswers` の read は最も安全な案A（READ POLICY = A）**: read は `isAdmin() || (isTeacher() && resource.data.teacherId == request.auth.uid)` のみ。担当生徒であっても、**他先生が作成した answer doc は読めません**（`studentUid` ベースの読み取りは許可しない）。write 側は従来どおり `teacherId==自分` 固定＋`studentUid` があれば `teaches(studentUid)` を create/update 双方で要求。生徒は read/write 一切不可。

**監査クリーン化**: `firebase-tools` の transitive 依存（`gaxios > uuid`）の moderate 勧告を、`package.json` の `overrides: { "uuid": "^11.1.1" }` で解消し `npm audit` を 0 に保っています（dev 専用ツールのみ影響、`dist` には含まれません）。


## 7. コード側の権限防御（Rules と二重化）

- `services/firebase/authz.js`: `isTeacher/isAdmin`（表示制御）、`assertTeacher`（先生専用関数の入口、非先生は例外）、`assertOwnUid`（書き込み uid を現在ユーザーに固定＝クライアント uid を信用しない）、`sanitizeProfileUpdate`/`PRIVILEGED_FIELDS`（保存前に `role`/`isTeacher` 等を除去）。
- `profileRepository.save`: 保存前に `sanitizeProfileUpdate`＋`assertOwnUid`。`records`/`books`/`teacherProblems` の書き込みは `assertOwnUid` で uid 固定。
- `TeacherProblems.jsx`: `isTeacher(profile)` 確認後だけ作成UI・解答表示を出す。非先生には「先生専用です」のみ表示。`create`/`reveal`/`del` は `assertTeacher` で保護。

## 8. 残す onSnapshot / ポーリング

- **残す onSnapshot**: アプリ層に該当購読は確認できず（唯一の出現は SDK 内部の文言）。新規追加もしない（テストで継続検査）。
- **残す20秒ポーリング**: 計画確認のみ。React 層では `planCheckPoller`（20s・非表示停止・冪等・unmount で clear）。
- **削減した/しない `setInterval`**: legacy バンドル内の `setInterval` は手編集不可のため本対応では変更せず、移行時に `planCheckPoller`/`readCache`/scoped query へ置換する方針を記載。`oxHelpers.js` の 800ms ポーラー（テーマ写真/プロフィール背景/アバター）は **Firestore 読み取りではない**ため、テーマ写真機能を壊さないよう変更していません。

## 9. 未対応事項

- **Rules エミュレータ挙動テストはローカル CLI で実行できる形に改善したが、この環境ではネットワーク制限により実行不可**: `firebase-tools` を devDependencies に追加し、`npm run test:rules` は `node_modules/.bin/firebase`（ローカル）を使うため `firebase: not found` は解消しました。実際にエミュレータ起動まで進みますが、Firestore Emulator の jar 取得先 `storage.googleapis.com` が**許可ネットワーク外のため 403 でダウンロードできず**、本コンテナでは完走できません（Java 21 は導入済み）。egress 許可のある環境、または jar ダウンロード済みの環境で `npm run test:rules` を実行してください。静的検査（`test/firestoreRulesStatic.test.js`）は通常テストで継続実行します。
- **本番適用前のデータ整備が未対応**: `teacherProblemAnswers` の各 doc に `teacherId`（生徒別なら `studentUid`）を付与する移行、および `teacher`/`admin` カスタムクレーム付与の運用整備。
- legacy バンドルの個別読み取りは minify のため呼び出し単位で特定できず、件数ベースの傾向と移行方針の提示に留めています。実際の削減は各画面の React 移行時に上記パターンへ置換して実施します。
- `oxHelpers.js` の 800ms ローカルポーラーの統合（イベント駆動化）は、テーマ写真機能への影響回避を優先し本対応では見送り。
