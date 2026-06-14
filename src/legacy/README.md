# src/legacy

## これは何か

`oriex-app.bundle.js` は、元の `index.html` に直書きされていた**製品ビルド済みのReactアプリ本体**（minify済み）。
読み込まれると自身で `createRoot(#root).render(...)` を実行し、アプリ全体を描画する。

依存しているのは次のグローバルだけで、`src/main.js` がこの読み込み前に用意している:

- `window.THREE` — `public/three.min.js` を `src/services/loadThree.js` の `loadThree()` で**遅延ロード**する
  （index.html の同期クラシックスクリプトは廃止）。legacy のライブ3Dのために、`src/main.js` が初回ペイント後に
  background warm（`requestIdleCallback`／`load` 後の `loadThree()`）で `window.THREE` を準備する。
- `window.OriexHamu3D` — `src/features/hamster/oriexHamu3D.js`
- `window.__oxBg` / `window.__oxPbg` / `window.__oxAv` / `window.__oxStudy` — `src/services/oxHelpers.js`

## なぜ残しているか

sourcemap が無いため、このbundleから元のReactソースを完全復元することはできない。
全画面を一度に書き直すとアプリが止まるリスクが高いので、**未移行の画面はこのbundleが描画し続ける**ことで、
動作を保ったまま1画面ずつ `src/features/*` に移すための「凍結したレガシー層」として置いている。

## 触ってはいけない

- このファイルは**手編集しない**（minify済みで、変更は事実上不可能かつ危険）。
- ESLint も対象外にしてある（`eslint.config.js` で ignore）。

## どう無くすか

`MIGRATION.md` の手順で画面を1つずつ `src/features/*` + `src/App.jsx` に移し、
全画面が移行できたら:

1. `src/main.js` の読み込み先をこのbundleから `src/App.jsx` に切り替える、
2. この `src/legacy/` ディレクトリを削除する。
