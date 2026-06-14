# BUG_AUDIT

## Startup white-screen hardening (2026-06-14)
- [x] Verified the Vite dev server renders the Oriex login screen instead of a blank `#root`.
- [x] Verified the production `dist/` build renders when served from the GitHub Pages project subpath `/testa/`.
- [x] Added `scripts/pagesSmokeCheck.mjs` to fail deployment when `dist/index.html` has project-page-unsafe asset references or required Pages files are missing.
- [x] Wired the Pages smoke check into `.github/workflows/deploy-pages.yml` after `npm run build` and before `upload-pages-artifact`.
- [x] Added a static test so the Pages workflow keeps publishing `dist` after running the smoke check.
- [ ] GitHub repository Settings -> Pages -> Source must remain `GitHub Actions`; serving `main` / root can still show a white screen because root `index.html` is Vite source, not a built artifact.

## Startup root-source fallback (2026-06-14)
- [x] Found the live GitHub Pages URL was serving repository-root `index.html` (`/src/main.jsx`) instead of the `dist/` artifact (`./assets/index-*.js`), leaving the app unable to start when Pages branch/root deployment won the race.
- [x] Renamed the entry from `src/main.jsx` to `src/main.js` so GitHub Pages can serve it with a JavaScript-compatible MIME type in repository-root fallback mode.
- [x] Moved startup CSS loading from JS imports to `index.html` stylesheet links. Raw CSS module imports are not valid in repository-root static hosting and would stop startup before the legacy bundle mounts.
- [x] Kept `src/main.js` booting `src/legacy/oriex-app.bundle.js`; `src/App.jsx` is still not mounted.
- [x] Local AI UI remains paused through `LOCAL_AI_UI_ENABLED = false`; the dynamic sidecar import is still guarded.
- [ ] GitHub Pages Settings should still be switched to Source = `GitHub Actions`; the root-source fallback is a safety net, not the preferred deployment path.

## React migration phase 0 inventory (2026-06-14)
- [x] Confirmed `src/main.js` is still the live entry and still boots `src/legacy/oriex-app.bundle.js`; `src/App.jsx` is not mounted.
- [x] Documented the current legacy-owned screens, existing React scaffolds, unmounted React surfaces, risk points, and recommended migration order in `docs/REACT_MIGRATION_PLAN.md`.
- [x] Kept Local AI UI paused. `LOCAL_AI_UI_ENABLED` remains `false`, `localai` is not in `App.jsx` tabs, and the implementation remains in `src/features/localAi/`.
- [x] Added static tests that guard the phase 0 plan, legacy entry, App scaffold status, migration order, legacy no-direct-edit rule, and local AI pause.
- [ ] No screen was migrated in this phase. The next safe live migration target is Profile.

## React migration phase 1 Profile preparation (2026-06-14)
- [x] Adopted the safe phase 1 approach: Profile was prepared inside the unmounted React scaffold; the production entry was not switched to `App.jsx`.
- [x] Fixed the React Profile save path so it calls `profileRepository.save(profileUid, { name, bio })` instead of leaving the save call inside a comment.
- [x] Added explicit name/bio `maxLength` props aligned with repository clamps: name 120, bio 4000.
- [x] Kept `profileRepository.save()` as the only text save path, preserving `sanitizeProfileUpdate`, `sanitizePlainText`, and privileged-field removal.
- [x] Kept avatar storage on IndexedDB Blob helpers and object URL revoke behavior; no localStorage base64 avatar storage was added.
- [x] Added uid guards before profile/avatar save/delete actions.
- [x] Added `test/profileReactMigration.test.js` for static Profile migration safety checks.
- [ ] The visible legacy profile screen remains live. Manual desktop/mobile checks are still needed before a Profile-only live switch.

## React migration phase 2 Records inventory (2026-06-14)
- [x] Confirmed `src/features/records/Records.jsx` exists, but the live app still uses the legacy bundle for the visible learning-record screen.
- [x] Confirmed `src/App.jsx` has a Records branch for the future scaffold, while `records` is not in `TABS` and `src/main.js` still boots legacy.
- [x] Documented Records migration requirements in `docs/REACT_MIGRATION_PLAN.md`: props, save path, localStorage repository, Firestore read constraints, and manual-check items.
- [x] Confirmed current editable storage path is `recordsRepository` -> `lsKey.records(uid)` localStorage. Firestore remains disabled/stubbed and no Rules/data structure changes were made.
- [x] Noted that the manual `subject` field is free text and must receive `sanitizePlainText` plus an explicit `maxLength` before any live switch.
- [x] Added `test/recordsReactMigration.test.js` to guard legacy entry, hidden Records production navigation, Local AI pause, and Records migration documentation.
- [ ] Records was not made live. Next phase must implement/test subject sanitize + clamp and verify save/delete/reload/weekly rollup before route exposure.

## React migration phase 3 Records minimal hardening (2026-06-14)
- [x] Kept the safe approach: Records was hardened inside the unmounted React scaffold; the production entry was not switched to `App.jsx` and `records` was not added to `TABS`.
- [x] `recordsRepository.add()` now sanitizes the free-text `subject` with `sanitizePlainText` (strips HTML tags + dangerous schemes such as `javascript:`, removes control chars, trims) before persisting; normal Japanese / line breaks are preserved.
- [x] Added `RECORDS_SUBJECT_MAX_LENGTH = 80` in the repository as the single source of truth; the subject clamp and the `Records.jsx` input `maxLength` both use it so they cannot drift.
- [x] A whitespace-only subject is stored as `""` (safe default); the UI keeps rendering the `学習` fallback for empty subjects.
- [x] Added uid guards in `Records.jsx` `submit`/`del` (no uid -> no repository call, error shown). The repository keeps pinning writes/removes to the current user via `assertOwnUid`.
- [x] Kept `minutes` validation unchanged (`parsePositiveMinutes`: round, reject < 1 / NaN / negatives). No upper bound added on purpose; the recommended Firestore-phase cap (~1440/day) is documented in `docs/REACT_MIGRATION_PLAN.md`.
- [x] Kept storage on `recordsRepository` -> `lsKey.records(uid)` localStorage. Firestore, Rules, auth, and data structure were not touched. A `TODO(firestore)` marker records the scoped-query + readCache + Rules-emulator-green conditions.
- [x] Rows still render with plain `{text}`; no `dangerouslySetInnerHTML` / `innerHTML` / `insertAdjacentHTML` / `document.write`.
- [x] Expanded `test/recordsReactMigration.test.js` with phase 3 static guards plus behavioural unit tests: `<script>`/`<img onerror>`/`javascript:` payloads are neutralised, normal Japanese survives, over-long subjects clamp to 80, whitespace-only subjects become `""`, invalid minutes are rejected, and writes stay uid-scoped.
- [x] Kept Local AI UI paused, theme-photo/avatar storage, service worker, and three.js lazy loading unchanged.
- [ ] Records is still not a production route. The next phase decides whether Records is reached from Home only or also as a tab, and verifies save/delete/reload/weekly rollup on desktop + mobile before any route exposure.

## Embedded (on-device) AI experiment phase 1 foundation (2026-06-14)
- [x] Added an experimental in-browser AI foundation under `src/features/embeddedAi/` without touching the Ollama Local AI track or its paused UI.
- [x] `EMBEDDED_AI_UI_ENABLED = false`; the experiment is not exposed from normal navigation and is not imported by `src/main.js`, so it adds nothing to startup or the initial bundle.
- [x] Took the safe option: no AI library dependency was added this phase. Only an abstraction layer (`embeddedAiClient.js`), a non-throwing device probe (`embeddedAiDevice.js`), config/flags (`embeddedAiConfig.js`), and a dev-only panel (`EmbeddedAiExperimentPanel.jsx`).
- [x] The client is a swappable seam: a real engine is plugged in later via `registerEmbeddedAiEngine(loader)` whose `loader` does a dynamic `import()`, runs only on opt-in, shares one in-flight Promise, and fails gracefully to `{ ok:false }` (no white screen).
- [x] No external AI API / endpoint / key / `.env` was added. Prompts, student data, and teacher memos are never sent to an external AI API. The feature source names no AI vendor/endpoint.
- [x] Generated text renders as plain `{text}`; no `dangerouslySetInnerHTML` / `innerHTML`. The experiment input is clamped (800 chars) and long prompts are not stored in `localStorage`.
- [x] Picked one small use case (today's study memo -> short review suggestion) and documented model-fetch / on-device cache policy in `docs/EMBEDDED_AI_PLAN.md`.
- [x] Added `test/embeddedAiStatic.test.js` (static guards + behavioural unit tests: default engine-not-bundled, empty-prompt reject, pluggable engine, shared in-flight load, graceful loader failure, clamped prompt).
- [x] Updated `README.md`, `docs/SECURITY_CHECKLIST.md`, and `docs/REACT_MIGRATION_PLAN.md`.
- [ ] No engine runs yet (foundation only). Enabling requires choosing an engine that runs on target phones, documenting its model source + on-device cache, a lazy dynamic-import chunk, verified graceful failure on real devices, and a clean external-AI scan.

## Embedded (on-device) AI experiment phase 1.5 src tidy + engine candidate docs (2026-06-14)
- [x] Moved concrete engine names out of `src/features/embeddedAi/` comments into `docs/EMBEDDED_AI_PLAN.md`; the feature source is now vendor-neutral (`embeddedAiClient.js` and `embeddedAiConfig.js` no longer name WebLLM / Transformers.js / MediaPipe / Ollama). The "register later via `registerEmbeddedAiEngine` + lazy dynamic import on opt-in" policy is kept. No implementation code changed.
- [x] Added an `## Engine Candidates` comparison (WebLLM-style, Transformers.js-style, MediaPipe LLM Inference-style, and abstraction-only) covering mobile expectation, first-download size, WebGPU/WASM requirements, iPhone/Android differences, PWA fit, "not an external AI API", model-fetch vs input-send, and Oriex-specific cautions — without over-committing.
- [x] Added a `## Phase 2 Entry Criteria` section (WebGPU/required APIs on real phones, acceptable first-download size, not in initial bundle, lazy dynamic import on opt-in, graceful failure, no prompt/student data to external AI APIs, clean security:scan + external-AI grep, no impact on core features on failure).
- [x] No real engine, no npm dependency, no model added. `EMBEDDED_AI_UI_ENABLED` stays `false`; embedded AI is still not imported by `src/main.js` / `src/App.jsx` and not shown in normal UI. Ollama implementation and the paused Local AI UI are unchanged.
- [x] Updated `test/embeddedAiStatic.test.js` with phase 1.5 checks: feature source has no engine/vendor name, no AI API key name, neutral swappable-engine policy, docs contain Engine Candidates + the candidate names + Phase 2 Entry Criteria, and the experiment stays disabled/unimported.
- [x] Updated `README.md`, `docs/SECURITY_CHECKLIST.md`, and `docs/REACT_MIGRATION_PLAN.md`.
- [ ] Engine choice still pending real-device investigation in phase 2.

## Embedded (on-device) AI experiment phase 2 device probe (2026-06-14)
- [x] Added a device-readiness diagnostic (`src/features/embeddedAi/embeddedAiProbe.js`) with `collectEmbeddedAiProbeReport` / `summarizeEmbeddedAiReadiness` / `formatEmbeddedAiProbeReport`. No real AI model/engine and no npm dependency were added.
- [x] Probe reads only capability signals (WebGPU, IndexedDB, storage estimate, memory/cores, secure context, online, platform/language/userAgent, mobile/iOS/Android/Safari/Chrome). Every read is wrapped so a missing API never throws; `storage.estimate()` rejection is handled.
- [x] Readiness summary returns a hedged `likely / limited / unlikely / unknown` with reasons/warnings/nextActions (no over-commitment).
- [x] Chose approach A: `EmbeddedAiProbePanel.jsx` is an unmounted dev-only component (plus `EMBEDDED_AI_PROBE_ENABLED = false`). It is not imported by `src/main.js` / `src/App.jsx` and is not in the normal UI.
- [x] No external send and no auto-save: the probe/panel contain no network calls (fetch/XHR/beacon), no backend writes, and no browser-storage writes; results are shown as plain text for manual copy. No permissions are requested. No raw-HTML sinks.
- [x] `EMBEDDED_AI_UI_ENABLED` stays `false`; Ollama implementation and the paused Local AI UI are unchanged. Home / Records / Profile production routes untouched.
- [x] Added `docs/EMBEDDED_AI_PLAN.md` sections `## Phase 2 Device Probe` and `## Manual Device Checklist`; updated `README.md`, `docs/SECURITY_CHECKLIST.md`, `docs/REACT_MIGRATION_PLAN.md`.
- [x] Added `test/embeddedAiProbe.test.js` (capability reads, no-throw on estimate failure, readiness levels, plain-text format) and extended `test/embeddedAiStatic.test.js` (probe disabled/unimported, no send/save, no permissions, no HTML sink, docs sections present).
- [ ] Real-device results (iPhone Safari / Android Chrome / PC Chrome, online/offline, installed PWA) still need to be collected manually to choose a phase-3 engine candidate.

## Embedded (on-device) AI experiment phase 2.5 hidden probe URL route (2026-06-14)
- [x] Added a hidden URL gate so the device probe can be opened on a real phone without exposing it in the normal UI. URL forms: `?oriexProbe=embedded-ai` or `#embedded-ai-probe` (matcher in `src/features/embeddedAi/embeddedAiProbeRoute.js`, never throws).
- [x] `src/main.js`: on a normal visit it boots the legacy app as before; only when the probe URL is detected does it dynamic-import `mountProbe.jsx` (a separate lazy chunk) and mount the probe instead. On any probe-load failure it falls back to the legacy app (no white screen). The legacy boot string `legacy/oriex-app.bundle.js` is preserved; no `App.jsx` entry, no `createRoot(` and no JSX added to the `.js` entry.
- [x] Initial bundle unaffected: the probe panel + React live in the lazy chunk; the only static main.js addition is the tiny URL matcher. The probe chunk is not loaded on a normal visit.
- [x] `EMBEDDED_AI_UI_ENABLED` and `EMBEDDED_AI_PROBE_ENABLED` both remain `false`; not added to TABS / normal nav; Local AI UI pause, Ollama implementation, and Home/Records/Profile routes unchanged.
- [x] Probe still does not send or auto-save results (no network, no backend, no browser-storage write) and requests no permissions; results are plain text for manual copy. Confirmed the six required notices are shown in `EmbeddedAiProbePanel.jsx`.
- [x] Added `docs/EMBEDDED_AI_PLAN.md` section `## Opening the Device Probe`; updated `README.md` and `docs/SECURITY_CHECKLIST.md`.
- [x] Added `test/embeddedAiProbeRoute.test.js` (normal URL → no probe; query/hash forms → probe; near-miss rejects; never throws; main.js wiring: legacy preserved, gated dynamic import, no static panel import) and updated `test/embeddedAiStatic.test.js` for the gated route.
- [ ] Real-device probe results still to be collected via the URL to choose the phase-3 engine candidate.

## Embedded (on-device) AI experiment phase 2.6 device-results template (2026-06-14)
- [x] Added `docs/EMBEDDED_AI_DEVICE_RESULTS.md`: a recording template for real-device probe results (Purpose, Probe URLs, Devices to Test, a Result Template table, How to Decide Phase 3, and Privacy Notes). Docs-only — no code, no dependency, no model.
- [x] The template table has rows for iPhone Safari / Android Chrome / PC Chrome (browser + PWA) and columns for Readiness / WebGPU / IndexedDB / Storage quota / Storage usage / Secure context / Notes.
- [x] Phase-3 decision guidance recorded (likely → WebGPU engines viable; limited → prefer Transformers.js-style small models; unlikely → keep PC Ollama, skip embedded production UI; unknown → re-check probe logic / browser support).
- [x] Privacy notes added: no personal info (names, student data, teacher memos, learning records) in results; results are not auto-sent / not auto-saved; share only device/browser/readiness/WebGPU/IndexedDB/storage; check screenshots for personal info.
- [x] Linked from `README.md` and `docs/EMBEDDED_AI_PLAN.md` (Opening the Device Probe).
- [x] No code changed: `EMBEDDED_AI_UI_ENABLED` / `EMBEDDED_AI_PROBE_ENABLED` stay `false`, normal UI unchanged, legacy boot preserved, no external AI / dependency / model added.
- [x] Added `test/embeddedAiDeviceResultsDocs.test.js` (file exists, probe URLs, device rows, required columns, privacy note, phase-3 criteria, linked from README/plan).
- [ ] The table is intentionally empty until measured on real devices.

## Firebase read hardening (2026-06-14)
- [x] Other bug checks focused on Firebase/read paths, repository guardrails, polling, and non-legacy dangerous read patterns.
- [x] `readCache` now deduplicates same-key in-flight reads, so two screens requesting the same Firestore target at the same moment share one fetch.
- [x] `readCache` now prevents an invalidated in-flight read from repopulating stale cache after save/delete.
- [x] Added regression tests for in-flight read sharing, failed-read retry, invalidate safety, and prefix invalidation safety.
- [ ] Legacy bundle read behavior remains minified and not directly edited; future React migration should replace each legacy read with scoped query + `readCache`.

## Security hardening (2026-06-14)
- [x] `sanitizeUrl` blocks protocol-relative (`//host`) and UNC-style (`\\host`) URLs so attacker-controlled values cannot bypass the scheme allow-list.
- [x] `sanitizeUrl` keeps `blob:` support only for same-origin blob URLs; external-origin blob URLs are rejected.
- [x] `public/sw.js` caches only same-origin static assets instead of every same-origin GET response.
- [x] `npm run security:scan` now includes `.github` workflow files.
- [ ] Legacy bundle still contains historical DOM/password-flow risk markers and should be migrated or retired in a future phase; the bundle was not edited directly.

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
- [x] ローカルAIボタンは一時的に非表示/アクセス停止。`src/main.js` は `LOCAL_AI_UI_ENABLED` が `false` の間 `mountLocalAiSidecar` を読み込まず、通常起動で浮遊ボタンを出さない。
- [x] `App.jsx` の `TABS` から `localai` / `AI` を外した。ローカルAI実装自体（`src/features/localAi/`、Ollama 通信、検証テスト）は削除せず保持。
- [x] 将来再有効化する場合は `src/features/localAi/uiFlag.js` の `LOCAL_AI_UI_ENABLED` と sidecar mount / App 側導線を戻す。

## 監査方法と前提（重要）

- このコンテナ環境では**ブラウザでの実操作（クリック/入力/再読込）はできません**。本監査は
  `npm ci` / `lint` / `test`（177 pass）/ `build`（64 modules, 成功）/ `audit`（0）/ `npm run dev`
  （`http://localhost:5173/` が HTTP 200）の出力と、**ソースコードの静的精査**にもとづきます。
- **構造上の最重要事実**: `src/main.js` が実際にマウントするのは
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
  対応: `src/main.js` 末尾で**本番ビルドのみ・`window load` 後・1回だけ**登録するように追加。
        `navigator.serviceWorker` がある場合のみ実行し、`${import.meta.env.BASE_URL}sw.js`（GitHub Pages サブパス対応）を
        登録、成功は `console.info`、失敗は `console.warn` で記録し `.catch` でアプリを壊さない。
        開発時（`import.meta.env.PROD === false`）は登録しないのでキャッシュ事故も回避。
  テスト: `test/appShellStatic.test.js` で登録コード・PROD ガード・load イベント・BASE_URL パス・`.catch` の存在を検査。

- [x] 画面: React シェル `src/App.jsx`（未マウント・潜在）— **調査済み／案A採用（bug-fix phase 5）**
  調査結果: `App.jsx` は**どこからも import されておらず未マウント**（`main.js` は legacy バンドルを起動）。
        `tab === "teacher"` 分岐はあるが `TABS` に `teacher` が無く、`teacher` を設定する導線も無い＝**到達不能**。
        ただし**ライブ本体は legacy バンドル**で React シェルは動いていないため、ユーザーに見える実害（デッドタブ）は無い。
        また `TeacherProblems` 自体が `isTeacher(profile)` で非先生にUIを出さず、各操作は `assertTeacher` で防御済み＝
        仮に到達しても**非先生に先生UIは出ない**。
  採用案: **案A**（未マウントのため teacher タブは増やさない）。理由: 未稼働シェルに片肺の導線を足すと誤解・将来バグの
        温床になり利点が無い。安全側に倒して docs/コメント整理に留めた。
  対応: `App.jsx` の teacher 分岐に **TODO(react-shell) コメント**を追加（TABS に入れていない理由／将来は
        isTeacher で先生のみ表示／records は Home 経由で到達）。Firestore/Rules/データ構造・legacy バンドルは未変更。
  テスト: `test/appShellRouting.test.js`（teacher 分岐は存在するが TABS 未登録＝ungated nav 無し・TODO 明記・
        将来 isTeacher ガード言及／`TeacherProblems` に isTeacher＋assertTeacher／`main.js` は legacy 起動で App 未マウント）。

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
        完全遅延にできない**。そこで `main.js` で**初回ペイント後（`requestIdleCallback`／`load` 後）に背景で
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
  `HamsterRoom` はオンデマンド、`main.js` は初回ペイント後に背景で warm。テスト追加（`test/loadThree.test.js`）。
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
