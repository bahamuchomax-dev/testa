# BUG_AUDIT

バグ修正フェーズ第1段階：実機確認とバグ一覧化。

## GitHub 公開前最終整理（README / docs）

- [x] README/docs 最終整理を実施。起動、build、test、`security:scan`、GitHub Pages 公開前確認、ローカルAI、Ollama 要件、テーマ写真/アバター保存、Firebase/XSS/CSP/secret scan 状況を README に集約。
- [x] `scripts/securityScan.mjs` 冒頭コメントの古い FULL 許可説明を修正。FULL 許可は廃止、`scripts/securityScan.mjs` と `test/secretScanStatic.test.js` は NAME 免除のみ、HARD は原則全ファイルで検出、テスト用 fake 値だけ `secret-scan-allow-fixture` 行マーカーで明示許可する方針に更新。
- [x] `docs/GITHUB_RELEASE_CHECKLIST.md` を追加。`npm ci`、`lint`、`test`、`security:scan`、`build`、`audit`、外部AI文字列チェック、ZIP 内容確認、PC/スマホ実機確認、Service Worker、ハムスター3D、テーマ写真、アバター保存/復元、XSS 簡易確認を公開前チェックとして整理。
- [x] README の docs 索引を実在 docs のみに整理。`docs/FIRESTORE_RULES_DRAFT.md` はこの ZIP に存在しないため索引には載せず、Rules 関連は `firestore.rules`、`docs/SECURITY_CHECKLIST.md`、`docs/FIREBASE_READ_AUDIT.md` を参照する形にした。
- [x] 古い説明/コメントを修正。three.js の index.html 同期読み込み前提コメント、CSP が提案のみという古い説明、securityScan の FULL 許可説明を現仕様に合わせた。
- [ ] 未対応事項: GitHub Pages 反映後の PC 実機確認、スマホ実機確認、Service Worker 更新確認、ハムスター3D確認、テーマ写真確認、アバター保存/復元確認、XSS 簡易確認。

## UI 小修正（選択中教科カード / ローカルAI UI 一時停止）

- [x] 選択中教科カードが透明ボタンのように見える UI バグを修正。原因は legacy 側が選択中カードに `background: ${色}12` 相当の極薄アクセント背景をインライン指定していたこと。
- [x] legacy bundle は直接編集せず、`src/services/oxHelpers.js` で英単語/熟語/漢字/化学/古文のカードだけに `data-ox-subject-card` / `data-ox-subject-selected` を付与し、`src/styles/app.css` の限定 CSS override で選択中も白/半透明白のカード背景を維持するようにした。
- [x] 選択中カードは accent 色の border / label / underline / icon を維持。テーマ写真背景では白カードの不透明度を少し上げ、視認性を落とさない。
- [x] ローカルAIボタンは一時的に非表示/アクセス停止。`src/main.jsx` は `LOCAL_AI_UI_ENABLED` が `false` の間 `mountLocalAiSidecar` を読み込まず、通常起動で浮遊ボタンを出さない。
- [x] `App.jsx` の `TABS` から `localai` / `AI` を外した。ローカルAI実装自体（`src/features/localAi/`、Ollama 通信、検証テスト）は削除せず保持。
- [x] 将来再有効化する場合は `src/features/localAi/uiFlag.js` の `LOCAL_AI_UI_ENABLED` と sidecar mount / App 側導線を戻す。

## 監査方法と前提（重要）

- このコンテナ環境では**ブラウザでの実操作（クリック/入力/再読込）はできません**。本監査は
  `npm ci` / `lint` / `test`（177 pass）/ `build`（64 modules, 成功）/ `audit`（0）/ `npm run dev`
  （`http://localhost:5173/` が HTTP 200）の出力と、**ソースコードの静的精査**にもとづきます。
- **構造上の最重要事実**: `src/main.jsx` が実際にマウントするのは
  (1) `src/styles/*`、(2) `features/hamster/oriexHamu3D.js`（`window.OriexHamu3D`）、
  (3) `services/oxHelpers.js`（テーマ写真/プロフィール背景/アバター）、
  (4) **`src/legacy/oriex-app.bundle.js`（凍結された本体・minify・#root に自己マウント）**、
  (5) `features/localAi`（サイドカー）です。
  → つまり **ホーム/記録/参考書/単語追加/ハムスター/先生配信/計画確認 などの「実機」画面は legacy バンドルの描画**であり、
  ソースからの詳細デバッグはできません（minify 済み）。
  ソースで挙動を確認できるライブ部分は **oxHelpers（テーマ写真など）と localAi サイドカー（6パネル）** です。
- `src/features/{home,records,review,factory,profile,teacher,hamster}/*` の React コンポーネントは
  **まだ未マウントの移行スキャフォールド**です（`src/App.jsx` も未使用）。これらの不具合は
  「将来 React シェルを稼働させたときに顕在化する潜在バグ」として記録します。

---

## 重大

（白画面・全機能停止・保存不能などの致命バグ）

- 現時点で**確定した重大バグはなし**。
  - 根拠: `build` 成功・`dev` が 200・`test` 全 pass。ライブの React 部（oxHelpers / localAi）は
    静的精査で初期描画を妨げる例外要因が見当たらない。
  - 留保: legacy バンドル内の画面はブラウザ実操作未実施のため、**「重大バグなし」を断定はできません**。
    GitHub 反映後に実機（PC＋スマホ）で ホーム/記録/参考書/配信/計画確認 の白画面・無反応を要確認。

---

## 中

- [x] 画面: PWA 全体（Service Worker）— **修正済み（bug-fix phase 2）**
  内容: `public/sw.js` が存在するのに登録されておらず、PWA キャッシュ/オフラインが効いていなかった。
  対応: `src/main.jsx` 末尾で**本番ビルドのみ・`window load` 後・1回だけ**登録するように追加。
        `navigator.serviceWorker` がある場合のみ実行し、`${import.meta.env.BASE_URL}sw.js`（GitHub Pages サブパス対応）を
        登録、成功は `console.info`、失敗は `console.warn` で記録し `.catch` でアプリを壊さない。
        開発時（`import.meta.env.PROD === false`）は登録しないのでキャッシュ事故も回避。
  テスト: `test/appShellStatic.test.js` で登録コード・PROD ガード・load イベント・BASE_URL パス・`.catch` の存在を検査。

- [x] 画面: React シェル `src/App.jsx`（未マウント・潜在）— **調査済み／案A採用（bug-fix phase 5）**
  調査結果: `App.jsx` は**どこからも import されておらず未マウント**（`main.jsx` は legacy バンドルを起動）。
        `tab === "teacher"` 分岐はあるが `TABS` に `teacher` が無く、`teacher` を設定する導線も無い＝**到達不能**。
        ただし**ライブ本体は legacy バンドル**で React シェルは動いていないため、ユーザーに見える実害（デッドタブ）は無い。
        また `TeacherProblems` 自体が `isTeacher(profile)` で非先生にUIを出さず、各操作は `assertTeacher` で防御済み＝
        仮に到達しても**非先生に先生UIは出ない**。
  採用案: **案A**（未マウントのため teacher タブは増やさない）。理由: 未稼働シェルに片肺の導線を足すと誤解・将来バグの
        温床になり利点が無い。安全側に倒して docs/コメント整理に留めた。
  対応: `App.jsx` の teacher 分岐に **TODO(react-shell) コメント**を追加（TABS に入れていない理由／将来は
        isTeacher で先生のみ表示／records は Home 経由で到達）。Firestore/Rules/データ構造・legacy バンドルは未変更。
  テスト: `test/appShellRouting.test.js`（teacher 分岐は存在するが TABS 未登録＝ungated nav 無し・TODO 明記・
        将来 isTeacher ガード言及／`TeacherProblems` に isTeacher＋assertTeacher／`main.jsx` は legacy 起動で App 未マウント）。

- [x] 画面: マイ/プロフィール `src/features/profile/Profile.jsx`（未マウント・潜在）— **修正済み（bug-fix phase 3）**
  過去の問題: アバターを `toDataURL` で base64 化し profile レコード経由で localStorage に保存していた（quota/肥大リスク）。
  対応: テーマ写真と同方式の **IndexedDB Blob 保存**へ変更。新規 `src/services/avatarStorage.js`
        （DB `oriexavatar`／store `imgs`／key `avatar_<uid>`、テーマ写真の DB `oriexbg` とは**完全分離**）を追加し、
        画像は**長辺512pxへ縮小・圧縮した Blob**として保存。圧縮は実績のある `compressImageToBlob` を共有。
        プレビューは Blob URL（`createObjectURL`）で即反映し、差し替え/アンマウント時に `revokeObjectURL`。
        起動/表示時に IndexedDB から復元、削除ボタンで `deleteAvatarBlob`＋revoke。
        **localStorage には画像 base64 を一切入れず**、プロフィール保存 payload は `{name, bio}` のみ
        （avatar 画像本体は含めない）。file input に `capture` は付けない。
  テスト: `test/avatarStorage.test.js`（保存/読み出し/削除/uid 分離/テーマ写真DBと非衝突/base64・localStorage 不使用の静的検査/
        payload に画像を含めない/capture 無し）。テーマ写真テスト（`homePhotoStorage.test.js` 等）は引き続き全パス。

---

## 小

- [x] 画面: PWA メタ（`index.html` / `public/manifest.webmanifest`）— **修正済み（bug-fix phase 2）**
  内容: `index.html` の `theme-color`(#FBF8F3) と manifest の `theme_color`(#1a1248) が不一致だった。
  対応: **`#FBF8F3`（明るいクリーム）に統一**（manifest の `theme_color` を更新）。
  理由: Oriex の実 UI 基調は `app.css` の `html,body,#root` 背景＝暖色クリームのグラデーション
        （`#fff8f4 → #fdede6 → #f5ddd0`）。`#FBF8F3` がこの基調に一致し、`#1a1248`（濃紺）は旧い残存値だったため。
  テスト: `test/appShellStatic.test.js` で index.html と manifest の色一致を検査。

- [ ] 画面: 復習提案/単語追加 React スキャフォールド（`Review.jsx` / `Factory.jsx`、未マウント・潜在）
  内容: `App.jsx` から常に空 props（`words={[]} history={{}}`）で描画され、中身が空のプレースホルダ。
  原因予想: データ供給（legacy からの語彙/履歴受け渡し）が未配線。
  修正方針: React シェル稼働フェーズでデータソースを配線。今回は記録のみ。

- [x] 画面: 起動時の資産ロード（`index.html`）— **修正済み（bug-fix phase 4）**
  過去の問題: `three.min.js`（約 594KB）を**全ページで同期 classic script として読み込み**、初期表示をブロックしていた。
  対応: index.html の同期 `<script src="/three.min.js">` を**削除**。新規 `src/services/loadThree.js`
        （`window.THREE` 済みなら即 resolve／読み込み中 Promise を共有して二重 `<script>` 防止／
        `src=${import.meta.env.BASE_URL}three.min.js`／`async=true`／成功で `resolve(window.THREE)`／失敗で reject）を追加。
        React の `HamsterRoom` は `useEffect` で `await loadThree()` してからエンジン起動＝**完全オンデマンド**。
  完全遅延ロードできなかった理由（ライブのハムスター）: ライブのハムスター画面は**凍結された legacy バンドル**が描画し、
        画面を開いた瞬間に `window.OriexHamu3D(canvas, env)` を**同期的に**呼び、その中で `window.THREE` を同期参照する。
        バンドルは編集禁止で「開いた時に await して読む」フックを差し込めないため、**ライブ経路だけは画面表示時のみの
        完全遅延にできない**。そこで `main.jsx` で**初回ペイント後（`requestIdleCallback`／`load` 後）に背景で
        `loadThree()` を実行**し、`window.THREE` を非ブロッキングで温める（ユーザーがハムスターを開く頃には準備済み）。
        これで「初期表示が重い」という本来の問題（レンダーブロッキング）は解消し、3D も維持される。
  3D/ハムスターへの影響: 機能は維持。React `HamsterRoom` はオンデマンド化（より堅牢）。`oriexHamu3D.js` は未変更。
  テスト: `test/loadThree.test.js`（既存 THREE 再利用／二重呼びで script 1つ／BASE_URL 相当 src・async／失敗 reject／
        リトライ可／index.html に同期 three script 無し／main・HamsterRoom が loadThree を使用）。

- [x] 画面: PDF問題作成（localAi `PdfQuestionPanel.jsx`、ライブ）
  内容: PDF 選択の `<input type="file">` に**アクセシブルな名前が無い**（`Field` の `<label>` は `htmlFor` 未関連付け）。
  修正方針: `aria-label="PDF教材を選択"` を付与。→ **修正済み（phase 1）＋ phase 2 で回帰防止テスト追加**
        （`test/appShellStatic.test.js` が file input の `aria-label` を検査）。

---

## 問題なし確認済み

- ホーム: legacy バンドルが `#root` に自己マウントし、`build` 成功・`dev` 200。
  （ライブのホームは legacy 描画。React 版ホームは未マウントのスキャフォールド。）
- テーマ写真: `services/oxHelpers.js` が `#oxbg-photo-layer`（専用レイヤ要素）＋ `body.oxbg-on` ＋
  CSS 変数 `--oriex-home-photo-*` ＋ `html/#root` の `data-home-photo` ＋ **IndexedDB**（`idbGet`/`idbPut`、
  `createObjectURL`/`revokeObjectURL`）で実装。**localStorage に画像 base64 を入れる箇所は無し**
  （`readAsDataURL`/`toDataURL`/`base64` 検出 0、`localStorage.setItem` は設定値のみ）。仕様健全・破壊なし。
- ローカルAI: `localAiClient.js` の接続先許可は **`http://localhost:11434` と `http://127.0.0.1:11434` のみ**。
  `https` / `0.0.0.0` / `::1` / LAN IP / その他はすべて `level:"blocked"` で `throwIfBlocked()` が `LocalAiError` を throw。
  サイドカーは aria-label / `role="dialog"` / 二重マウント防止つき。品質バッジ・本文/詳細コピー・PDF 根拠表示・
  小テストの問題別警告は formatter にテストあり（`localAiFormatters.test.js`）。**生成結果の自動保存は無し**。
- Firebase安全仕様: React 層は localStorage リポジトリ＋Firestore スタブ（`firebaseEnabled=false`,`getDb→null`）。
  **アプリ層に `onSnapshot`/恒常 query 購読は無し**（不要読み取り増加なし）。書き込みは
  `sanitizeProfileUpdate`/`assertOwnUid`/`assertTeacher` でガード。`firestore.rules` と各テストは**未変更**。
  Rules/認証/データ構造は本タスクで一切触っていない（`test` 177 pass、`audit` 0）。

---

## 今回（bug-fix phase 4）あえて触らなかった項目

- `App.jsx` の `teacher` タブ導線（React シェル本格稼働とセット）
- React シェルの本格稼働 / `Review`・`Factory` のデータ配線
- legacy バンドル内部（`oriexHamu3D.js` も挙動を変えないため未変更）
- ライブのハムスターを「画面表示時のみ」完全遅延にすること（legacy バンドル制約のため。上記参照）

## 次に修正すべき優先順位（更新）

1. （実機）GitHub 反映後に PC＋スマホで legacy 画面の白画面/無反応/保存復元/スマホ幅崩れを確認。あわせて
   **(a) SW 登録**（本番で一度だけ・更新時に古い資産が固定化しないか）、**(b) ハムスター 3D が背景 loadThree 後に
   正しく描画されるか**（特に開くのが速い場合）、**(c) アバターの保存/復元**を実機確認。
2. React シェル稼働フェーズ：`App.jsx` の `teacher` 導線（先生のみ `isTeacher` 表示）・`records` 整理・
   `Review`/`Factory` のデータ配線（※ phase 5 で teacher 導線は「シェル稼働まで保留」と確定）。
3. （Firebase）egress 許可環境で `npm run test:rules` を green 確認してから本番 Rules 適用判断。
4. （任意）`three.min.js` 自体の最適化（必要部分のみの three ビルド等、legacy 依存を外せた後）。
5. （XSS）legacy バンドルを React 化して `dangerouslySetInnerHTML`/`innerHTML`/`javascript:` 経路を解消し、
   インライン script を外部化したうえで CSP（`docs/XSS_AUDIT.md` の提案）を適用判断。配信本文/先生メモ等の
   入力にも `sanitizePlainText` を順次適用。

## 変更履歴

- phase 1: 監査・`docs/BUG_AUDIT.md` 作成・PDF file input に `aria-label` 付与。
- phase 2: Service Worker 登録（本番のみ・load 後・BASE_URL・fail-safe）／theme-color を `#FBF8F3` に統一／
  静的テスト追加（`test/appShellStatic.test.js`）。
- phase 3: プロフィールアバターを IndexedDB Blob 保存へ（`src/services/avatarStorage.js`、長辺512px、
  Blob URL プレビュー、base64/localStorage 不使用、payload から画像除外）／テスト追加（`test/avatarStorage.test.js`）。
- phase 4: `three.min.js` の同期ロードを廃止し `loadThree()`（遅延・dedup・BASE_URL・async・fail-safe）を追加。
  `HamsterRoom` はオンデマンド、`main.jsx` は初回ペイント後に背景で warm。テスト追加（`test/loadThree.test.js`）。
- phase 5: `App.jsx` の TeacherProblems 導線を調査＝**未マウントのため案A**（タブ追加せず TODO コメント整理）。
  `TeacherProblems` の isTeacher/assertTeacher 防御を確認。`src/legacy/README.md` の three.js 説明を現仕様
  （loadThree 遅延＋background warm）へ更新。テスト追加（`test/appShellRouting.test.js`）。
- security(XSS): `src/services/security/sanitizeText.js`（escapeHtml/stripDangerousHtml/sanitizePlainText/
  sanitizeUrl/hasLikelyXss）を追加。`profileRepository.save` で name/bio を保存前に無害化。React 層は
  `dangerouslySetInnerHTML` 不使用・`{text}` 表示で安全（静的テストで担保）。CSP は提案のみ（index.html の
  インライン script と legacy 依存のため見送り）。legacy バンドル内の `dangerouslySetInnerHTML`(12)/`innerHTML`(5)/
  `javascript:`(3) は編集禁止のため未確認＝`docs/XSS_AUDIT.md` に記録。テスト追加（`test/sanitizeText.test.js`）。
- security(追補): 安全な meta CSP（`object-src 'none'; base-uri 'self'`）を index.html に実適用（strict 化は legacy/
  インライン script/外部フォント取得不可のため見送り）。プロフィール name/bio に長さ上限（120/4000）。SW は版付き
  キャッシュ＋API 非キャッシュを確認（現状維持）。テスト追加（CSP/clamp）。App Check・本物の Auth・APIキー制限は別枠。
- security(secret-scan): `scripts/securityScan.mjs`（FAIL=実鍵material/SA JSON/外部AIキー、WARN=Firebase Web apiKey）
  ＋ `npm run security:scan` ＋ `.gitignore` 補強（.env*/serviceAccount*/firebase-adminsdk*）＋ `docs/SECRET_AUDIT.md`
  （apiKey は識別子=フロント可／private_key=管理者権限=厳禁の区別を明記）。テスト追加（`test/secretScanStatic.test.js`）。
  ※ 最終 ZIP の実物チェックは別レビューで必要（本スキャンはリポジトリ静的チェックのみ）。
- ui(カテゴリカード色抜け): 原因＝カテゴリ（英単語/熟語/漢字/化学/古文）は**データ駆動**で、各カードの色は
  **ライブの legacy バンドルが render 時にインライン適用**する。あるカテゴリに色が無い/未設定だとアイコン背景や
  ドットが**色抜け（透明）**する。バンドルは編集禁止のため、(1) 配色の単一ソース `src/services/categoryColors.js`
  （全カテゴリに accent/softBg/iconBg、未知でも安全 fallback で undefined を出さない）を追加、(2) React 側
  `Factory` のカテゴリバッジを `colorForCategory` で常時色付け、(3) `src/styles/app.css` 末尾に**色抜け防止の
  CSS フォールバック**（`.rx-q .ic`/`.rx-rec .ic`/`.rx-rec-s .ic` の背景＝`--accent-soft`、`.rx-frame-chip span`＝
  `--accent`。インラインのカテゴリ色が来れば従来どおり上書き）。テスト追加（`test/categoryColors.test.js`）。
  限界: ライブ一覧の**カテゴリ別の固有パレット**はバンドル内にあり遡及的に揃えられない（色抜けは防止済み）。
  完全な配色一致は React 移行時に `categoryColors.js` を単一ソースとして適用する。

## 実機確認項目（カテゴリカード色）

- 単語カテゴリカードで**全カテゴリに色が付く**か（英単語/熟語/漢字/化学/古文、特に以前色抜けしていたもの）。
- **選択中カード**の border / label / underline が accent 系で色づくか。
- **未選択カード**のアイコン背景が薄く（softBg/accent-soft）色づくか。
- **スマホ幅**でも色抜け・色化けしないか（折返し時含む）。
