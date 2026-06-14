# React Migration Plan

Status: phase 0 inventory only. Do not switch the live entry to `App.jsx` in this phase.

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

- `src/features/profile/Profile.jsx`: profile scaffold. Uses `profileRepository` and IndexedDB-backed avatar storage. Good first migration candidate because the data surface is narrow.
- `src/features/records/Records.jsx`: learning-record scaffold. Uses `recordsRepository`; migrate after profile so uid-scoped save/load behavior is already proven.
- `src/features/review/Review.jsx`: review scaffold. Currently needs real word/history data wiring before it can replace the legacy screen.
- `src/features/factory/Factory.jsx`: small-test scaffold. Currently needs real word data wiring before live use.
- `src/features/teacher/TeacherProblems.jsx`: teacher authoring scaffold. Has `isTeacher` and `assertTeacher` UI guards, but must stay hidden until auth and Rules behavior is verified end to end.
- `src/features/home/Home.jsx`: dashboard scaffold. Uses repository weekly rollups, but does not yet own the visible subject/stage card UX.
- `src/features/hamster/HamsterRoom.jsx`: React 3D room scaffold. Keep legacy live until visual and lazy `loadThree()` behavior is verified on device.
- `src/features/localAi/*`: local AI implementation. Source remains, UI access is intentionally paused.

## Unmounted React Surface

`src/App.jsx` currently imports and can render Home, Records, Review, Factory, Profile, TeacherProblems, and a lazy HamsterRoom. It is not imported by `src/main.js`, and it is not reachable by users.

`TABS` intentionally excludes:

- `localai`: local AI UI is paused.
- `teacher`: teacher UI must only become reachable after teacher-only navigation is added with role checks.
- `records`: currently reached from Home in the scaffold instead of the tab bar.

## Recommended Migration Order

1. Profile
2. Records / learning records
3. Review
4. Factory / small tests
5. TeacherProblems
6. Home / subject cards
7. HamsterRoom final visual check, if still needed
8. Legacy bundle removal

Rationale:

- Profile is smallest and already has strong avatar-storage tests.
- Records proves uid-scoped repository reads/writes before study flows depend on them.
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

- Keep phase 0 tests static: confirm `src/main.js` still boots legacy, `App.jsx` remains a scaffold, local AI UI remains paused, and this plan exists.
- For each migrated screen, add focused unit/static tests around the repository calls and data shape used by that screen.
- Before replacing a visible legacy screen, run `npm run lint`, `npm run test`, `npm run security:scan`, `npm run build`, and `npm audit`.
- After each live route switch, run a browser smoke check on GitHub Pages and a mobile-width visual check.
- For TeacherProblems, add role-specific tests and run Rules emulator tests where the environment can download the Firestore emulator jar.
