# React Migration Plan

Status: phase 3 Records minimal hardening is complete, but the live app still boots the legacy bundle. Records is still NOT a production route. Do not switch the live entry to `App.jsx` yet.

## Current Structure

- `index.html` loads `src/main.js` during development and repository-root static fallback. Production GitHub Pages should serve the Vite `dist/` artifact.
- `src/main.js` is the live entry. It installs the editable globals, imports `src/legacy/oriex-app.bundle.js`, and lets the legacy bundle self-mount into `#root`.
- `src/App.jsx` is not mounted. It is a React migration scaffold for screens that will be peeled out of the legacy bundle later.
- `src/features/localAi/uiFlag.js` keeps `LOCAL_AI_UI_ENABLED = false`. The local AI implementation remains in `src/features/localAi/`, but normal navigation and the sidecar launcher are paused.
- `src/legacy/oriex-app.bundle.js` remains frozen. Do not edit it directly.

## Live Legacy Surface

These user-visible areas are still drawn by `src/legacy/oriex-app.bundle.js` today:

- Login and registration flow.
- Home dashboard and the subject/stage cards.
- Study and quiz flows for vocabulary, phrases, kanji, chemistry, and kobun.
- The visible records, review, factory/small-test, profile, teacher/problem, and hamster screens reached from the current app.
- Any legacy-only data wiring that has not yet been reconnected to `src/services/repository/*`.

Helpers outside the bundle already support the live legacy app:

- `src/services/oxHelpers.js` handles theme-photo, avatar, study helper, and subject-card runtime fixes.
- `src/features/hamster/oriexHamu3D.js` exposes `window.OriexHamu3D`.
- `src/services/loadThree.js` warms and loads `three.min.js` without a blocking script tag.

## React Screens Already Present

- `src/features/profile/Profile.jsx`: phase 1 prepared profile scaffold. Uses `profileRepository` and IndexedDB-backed avatar storage. It has explicit input length limits, uid guards, object URL revocation, and text-only save payloads. It is still unmounted in production.
- `src/features/records/Records.jsx`: learning-record scaffold (phase 3 hardened). Uses `recordsRepository`; the free-text subject is sanitized + clamped (`RECORDS_SUBJECT_MAX_LENGTH`) and writes are uid-guarded. Still unmounted in production.
- `src/features/review/Review.jsx`: review scaffold. Currently needs real word/history data wiring before it can replace the legacy screen.
- `src/features/factory/Factory.jsx`: small-test scaffold. Currently needs real word data wiring before live use.
- `src/features/teacher/TeacherProblems.jsx`: teacher authoring scaffold. Has `isTeacher` and `assertTeacher` UI guards, but must stay hidden until auth and Rules behavior is verified end to end.
- `src/features/home/Home.jsx`: dashboard scaffold. Uses repository weekly rollups, but does not yet own the visible subject/stage card UX.
- `src/features/hamster/HamsterRoom.jsx`: React 3D room scaffold. Keep legacy live until visual and lazy `loadThree()` behavior is verified on device.
- `src/features/localAi/*`: local AI implementation. Source remains, UI access is intentionally paused.
- `src/features/embeddedAi/*`: experimental on-device (in-browser) AI foundation (phase 1, comment-tidied in phase 1.5, device-probe added in phase 2). Abstraction layer + device probe + diagnostic probe + dev-only panels; no model/library is bundled and the source is vendor-neutral. `EMBEDDED_AI_UI_ENABLED` and `EMBEDDED_AI_PROBE_ENABLED` are both `false`, nothing here is imported by `src/main.js`, and it is a separate track from the Ollama Local AI. The phase-2 probe only reads device capabilities (no send, no save). Engine candidates, phase-2 entry criteria, and the device-probe procedure are in `docs/EMBEDDED_AI_PLAN.md`.

## Unmounted React Surface

`src/App.jsx` currently imports and can render Home, Records, Review, Factory, Profile, TeacherProblems, and a lazy HamsterRoom. It is not imported by `src/main.js`, and it is not reachable by users.

`TABS` intentionally excludes:

- `localai`: local AI UI is paused.
- `teacher`: teacher UI must only become reachable after teacher-only navigation is added with role checks.
- `records`: currently reached from Home in the scaffold instead of the tab bar.

## Phase 1 Profile Preparation

Profile was selected first because its data surface is smaller than Home/study flows and it already has strong safety primitives:

- `profileRepository.save()` applies `sanitizeProfileUpdate`, `sanitizePlainText`, and max-length clamps (`name` 120, `bio` 4000).
- Avatar bytes are handled by `src/services/avatarStorage.js` as IndexedDB Blob data, with long-edge compression around 512px.
- React rendering uses normal `{text}` output. `dangerouslySetInnerHTML` is not used.
- Bio preview and editing preserve line breaks with `white-space: pre-wrap`.

What phase 1 changed:

- Fixed the React Profile save path so the save call is active and text-only.
- Added explicit `maxLength` props matching the repository clamps.
- Added uid checks before profile/avatar save/delete actions.
- Kept avatar preview object URLs revoked on replacement and unmount.
- Added `test/profileReactMigration.test.js` to guard the Profile migration safety rules.

What phase 1 did not change:

- `src/main.js` still boots `src/legacy/oriex-app.bundle.js`.
- `src/App.jsx` is still not mounted by the live entry.
- The visible legacy profile screen remains in the legacy bundle until a later switch.
- Firebase, Firestore Rules, auth, data structure, Local AI pause, theme-photo storage, service worker, and three.js delayed loading were not changed.

Manual checks still needed before a live Profile switch:

- Edit name and bio on a real desktop browser.
- Confirm long name/bio input clamps visually and after reload.
- Paste dangerous HTML and confirm it is not executed.
- Select, reload, and delete an avatar.
- Repeat the same checks on a mobile-width viewport and at least one real phone.

## Phase 2 Records Inventory

Records / learning logs were inspected after Profile preparation. This phase does not make Records visible in production.

Current state:

- `src/features/records/Records.jsx` exists as an unmounted React scaffold.
- `src/App.jsx` imports Records and has a `tab === "records"` branch, but `records` is not in `TABS`.
- The only scaffold path to Records is `Home` calling `onOpen("records")`; because `src/App.jsx` is not mounted by `src/main.js`, this path is not live.
- The visible learning-record screen remains inside `src/legacy/oriex-app.bundle.js`.
- `src/services/repository/recordsRepository.js` owns `list()`, `add()`, `remove()`, and `weekly()`.
- Current editable repository storage is localStorage via `lsKey.records(uid)`. Firestore is still disabled/stubbed.

Migration preparation notes:

- Props needed by the React Records scaffold are `uid` and optional `onBack`.
- `records.add(uid, { minutes, subject, source: "manual" })` is the manual save path.
- `minutes` already flows through `parsePositiveMinutes`, rejecting sub-minute and invalid values.
- `subject` is free text and should be sanitized before save with `sanitizePlainText`.
- Add an explicit `maxLength` to the subject input before any live switch.
- Display rows with normal `{text}` rendering only; do not use `dangerouslySetInnerHTML`.
- Keep teacher/student separation in Rules and repository boundaries. Records writes must stay pinned to `assertOwnUid`.
- Firestore migration should use a scoped recent-records query such as current uid + recent date window + limit, fronted by `readCache`.
- Saving/removing a record should invalidate only the records cache key/prefix, not broad profile or teacher data.

Conditions before Records can go live:

- Add and test `sanitizePlainText` + `maxLength` for the manual subject field.
- Decide whether Records is reached only from Home or also as a tab; do not add a production tab until the whole shell route is intentionally enabled.
- Verify save, delete, reload, and weekly rollup on desktop and mobile widths.
- Confirm no extra Firestore read loops, `onSnapshot`, or unbounded `getDocs` were introduced.
- Keep Profile phase 1 behavior, Local AI pause, theme-photo storage, avatar storage, service worker, and three.js lazy loading unchanged.

## Phase 3 Records Minimal Hardening

Records was hardened after the phase 2 inventory. This phase still does **not** make Records visible in production; the live learning-record screen remains the legacy one inside `src/legacy/oriex-app.bundle.js`. The goal was only to make the React Records scaffold safe to migrate later.

What phase 3 changed:

- `recordsRepository.add()` now sanitizes the free-text `subject` with `sanitizePlainText` before persisting it: HTML tags and dangerous schemes (`javascript:`, etc.) are stripped, control characters are removed, the value is trimmed, and it is clamped to `RECORDS_SUBJECT_MAX_LENGTH`. Normal Japanese / English / line breaks are preserved. `subject` is free text, so this sanitize/clamp is mandatory before any live exposure.
- A whitespace-only `subject` is stored as the empty string (a safe default); the UI renders the existing `学習` fallback for empty subjects.
- `RECORDS_SUBJECT_MAX_LENGTH` is defined once in the repository (value `80`) and imported by `Records.jsx`, which sets the subject input `maxLength` to the same constant. The subject input therefore has a maxLength of 80, matching the repository clamp, so the two cannot drift.
- `Records.jsx` now guards on uid: `submit` and `del` refuse to call the repository when there is no usable uid, and show an error instead. The repository keeps pinning writes/removes to the current user via `assertOwnUid`, so a client-passed uid that differs from the signed-in user is ignored.
- Rows continue to render with plain `{text}` expressions. `dangerouslySetInnerHTML` and `innerHTML`/`insertAdjacentHTML`/`document.write` are not used.

`minutes` validation was intentionally left as-is. `parsePositiveMinutes` still rounds to a whole minute and rejects anything below 1 (`0`, `0.4`, `NaN`, negatives). There is currently **no upper bound** on minutes. Adding one is a deliberate non-goal of this phase to avoid changing existing validation behaviour. Recommended for the Firestore phase: enforce a sane per-record cap (for example, reject values implausibly larger than a single day, i.e. above ~1440 minutes, or whatever the product decides) in both JS and Firestore Rules at the same time.

What phase 3 did not change:

- `src/main.js` still boots `src/legacy/oriex-app.bundle.js`; `src/App.jsx` is still unmounted.
- `records` is still not in `TABS`; Records is only reachable from the unmounted Home scaffold.
- Storage is still localStorage via `lsKey.records(uid)`. Firestore is not connected.
- Firebase, Firestore Rules, auth, data structure, Local AI pause, theme-photo storage, avatar storage, service worker, and three.js delayed loading were not touched.

Storage location and Firestore plan:

- Records data still lives in localStorage behind `recordsRepository`. Do not switch to Firestore in this phase.
- When Records does move to Firestore, the condition is: a scoped query (current uid + recent date window + `limit`) fronted by `readCache`, add/remove invalidating only the records cache key (never broad profile/teacher data), no `onSnapshot` or unbounded `getDocs`, and Rules emulator tests green. A `TODO(firestore)` marker in `recordsRepository.js` records this.

Conditions before Records can go live (next phase decision):

- Decide whether Records is reached only from Home or also as a tab; do not add a production tab until the whole shell route is intentionally enabled with the rest of the React shell.
- Verify save, delete, reload, and weekly rollup on desktop and mobile widths.
- Confirm no extra Firestore read loops were introduced.
- Keep Profile phase 1 behaviour, Local AI pause, theme-photo storage, avatar storage, service worker, and three.js lazy loading unchanged.

## Recommended Migration Order

1. Profile live switch decision
2. Records / learning records implementation or live-switch preparation
3. Review
4. Factory / small tests
5. TeacherProblems
6. Home / subject cards
7. HamsterRoom final visual check, if still needed
8. Legacy bundle removal

Rationale:

- Profile is smallest and now has phase 1 preparation tests; the next decision is whether to switch just Profile live or move to Records scaffolding.
- Records proves uid-scoped repository reads/writes before study flows depend on them, but its free-text subject field still needs sanitize/clamp work before production exposure.
- Review and Factory both need real word/history data wiring, so they should come after repository behavior is stable.
- TeacherProblems has the highest auth/Rules risk and should wait until the role path is explicit.
- Home and subject cards are the app's main navigation and visual identity, so they should move late.
- Removing `src/legacy/oriex-app.bundle.js` is the final step only after every visible route has a React owner.

## Migration Risks

- Do not edit `src/legacy/oriex-app.bundle.js` directly.
- Do not change Firebase Rules, auth, or Firestore data structure as part of screen migration.
- Keep theme photo and avatar storage behavior intact. Theme photo and avatar images must remain Blob/IndexedDB based, not localStorage base64.
- Keep Local AI paused unless a separate task explicitly re-enables it.
- Avoid mounting `App.jsx` globally until the target screen has matching data, visual state, and tests.
- Review and Factory must not go live with empty `words` or placeholder history.
- TeacherProblems must not be exposed to non-teachers; UI guards are not a replacement for Firestore Rules.
- Service worker and GitHub Pages asset paths should be rechecked after entry changes.

## Areas To Avoid Migrating First

- Login/auth and Firebase identity bootstrapping.
- Firestore Rules or Firestore schema.
- The full Home/subject-card shell.
- Local AI UI re-enable.
- Legacy-only internals that cannot be safely understood from the minified bundle.

## Test Policy

- Keep migration tests static until a screen is intentionally switched live: confirm `src/main.js` still boots legacy, `App.jsx` remains a scaffold, local AI UI remains paused, and this plan exists.
- For each migrated screen, add focused unit/static tests around the repository calls and data shape used by that screen.
- Before replacing a visible legacy screen, run `npm run lint`, `npm run test`, `npm run security:scan`, `npm run build`, and `npm audit`.
- After each live route switch, run a browser smoke check on GitHub Pages and a mobile-width visual check.
- For TeacherProblems, add role-specific tests and run Rules emulator tests where the environment can download the Firestore emulator jar.
