# FILE_STRUCTURE

Oriex の現行構成と、修正時に触る場所の対応です。

## 全体

```txt
oriex/
  index.html
  package.json
  package-lock.json
  vite.config.js
  eslint.config.js
  README.md
  .gitignore
  public/
    manifest.webmanifest
    sw.js
    three.min.js
    icon-180.png
    icon-192.png
    icon-512.png
  src/
    main.js
    App.jsx
    features/
    services/
    lib/
    styles/
    legacy/
  test/
  docs/
```

## 起動順

`src/main.js` は次の順番で読み込みます。

```txt
styles/utilities.css
styles/app.css
features/hamster/oriexHamu3D.js
services/oxHelpers.js
legacy/oriex-app.bundle.js
features/localAi/index.jsx
```

実際に動いている多くの画面は、まだ `src/legacy/oriex-app.bundle.js` が描画しています。新しい修正は、可能な限り手書きの `src/features/`、`src/services/`、`src/styles/app.css` に入れます。

## features

```txt
src/features/home/
  Home.jsx
  homePhotoStorage.js

src/features/localAi/
  LocalAiPanel.jsx
  LocalAiPage.jsx
  LocalAiSettings.jsx
  localAiClient.js
  localAiPrompts.js
  localAiQuality.js
  localAiSchemas.js
  localAiStorage.js
  pdfTextExtractor.js
  components/
  panels/
  utils/

src/features/records/
src/features/review/
src/features/factory/
src/features/profile/
src/features/teacher/
src/features/hamster/
```

テーマ写真の保存・圧縮は `src/features/home/homePhotoStorage.js`、背景反映UIは `src/services/oxHelpers.js` の `window.__oxBg` が担当します。写真ON時は `#oxbg-photo-layer` を作り、`body.oxbg-on` とCSS変数で固定背景として表示します。

ローカルAIは `src/features/localAi/` に閉じています。通信は `localAiClient.js`、設定保存は `localAiStorage.js`、PDF抽出は `pdfTextExtractor.js` です。

## services

```txt
src/services/oxHelpers.js
src/services/firebase/client.js
src/services/repository/
  localStore.js
  paths.js
  recordsRepository.js
  booksRepository.js
  profileRepository.js
  teacherProblemsRepository.js
```

`oxHelpers.js` は、レガシーバンドルが参照する `window.__oxBg`、`window.__oxPbg`、`window.__oxAv`、`window.__oxStudy` を提供します。

Repository層は、画面から保存先を直接触らないための境界です。Firestore Rules、認証、データ構造は今回の配布では変更しません。

## lib

```txt
src/lib/minutes.js
src/lib/sanitize.js
src/lib/wordKey.js
```

依存の少ない純粋関数を置きます。ここは単体テストを追加しやすい場所です。

## styles

```txt
src/styles/app.css
src/styles/utilities.css
```

`app.css` は手書きの編集対象です。`utilities.css` は生成CSSなので原則触りません。

テーマ写真ON時の背景透過は `oxHelpers.js` が注入するCSSで制御します。legacy本体の `#root > div` にある全画面背景は写真ON時だけ透明化し、カード類は読みやすい半透明白にします。

## legacy

```txt
src/legacy/oriex-app.bundle.js
src/legacy/README.md
```

`oriex-app.bundle.js` はminify済みのレガシーバンドルです。直接編集しません。画面移行が進んだら、`src/features/` 側へ置き換えていきます。

## test

```txt
test/*.test.js
```

主なテスト対象:

```txt
ローカルAIのURL制限
ローカルAIのスキーマ/品質/整形
PDFテキスト抽出の純粋ロジック
テーマ写真のIndexedDB保存/復元/削除
テーマ写真のruntime反映
テーマ写真の `#oxbg-photo-layer` 作成/削除と `afterTheme()` 復元
localStorageに画像base64を保存しないこと
外部送信しないこと
```

## docs

```txt
docs/LOCAL_AI.md
docs/SECURITY_CHECKLIST.md
docs/FILE_STRUCTURE.md
docs/MIGRATION.md
```

配布前に、READMEとdocsの内容が現行仕様と矛盾していないか確認します。

## dev ZIPに含めるもの

```txt
package.json
package-lock.json
index.html
vite.config.js
eslint.config.js
README.md
.gitignore
src/
public/
test/
docs/
```

## dev ZIPに含めないもの

```txt
node_modules/
dist/
coverage/
.cache/
.env
.env.local
.git/
.DS_Store
```
