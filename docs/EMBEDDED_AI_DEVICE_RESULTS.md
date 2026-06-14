# Embedded AI Device Probe Results

## Purpose

このファイルは、スマホ向け埋め込みAIの実機診断結果を記録するためのものです。
診断はAIモデルを読み込まず、入力文や学習データを外部送信しません。

診断画面の開き方・仕組みは [docs/EMBEDDED_AI_PLAN.md](./EMBEDDED_AI_PLAN.md) の「Opening the Device Probe」を参照してください。

## Probe URLs

`<user>` / `<repo>` は実際の GitHub Pages の値に置き換えてください（例: `oriex-src-final2`）。

- https://<user>.github.io/<repo>/?oriexProbe=embedded-ai
- https://<user>.github.io/<repo>/#embedded-ai-probe

通常アクセスでは診断画面は出ません。上記URLのときだけ診断パネルが開きます。

## Devices to Test

- iPhone Safari
- Android Chrome
- PC Chrome
- PWAホーム画面追加後
- オンライン
- オフライン

## Result Template

診断パネルの「端末を診断する」を押し、表示された値とコピーした診断テキストを見ながら、以下の表に記入してください。空欄のままコミットしてもOK（未測定が分かるように）。

| Device | Browser | PWA/Browser | Online | Readiness | WebGPU | IndexedDB | Storage quota | Storage usage | Secure context | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| iPhone | Safari | Browser | Online |  |  |  |  |  |  |  |
| iPhone | Safari | PWA | Online |  |  |  |  |  |  |  |
| Android | Chrome | Browser | Online |  |  |  |  |  |  |  |
| Android | Chrome | PWA | Online |  |  |  |  |  |  |  |
| PC | Chrome | Browser | Online |  |  |  |  |  |  |  |

オフラインや追加端末を確認した場合は、同じ列で行を増やしてください（例: `Online` 列に `Offline` と記入）。

- **Readiness**: `likely` / `limited` / `unlikely` / `unknown`
- **WebGPU / IndexedDB / Secure context**: `yes` / `no`
- **Storage quota / usage**: 診断テキストの `storage.quota` / `storage.usage`（MB 目安、取得不可なら `不明`）

## How to Decide Phase 3

実機の Readiness 集計を見て、フェーズ3で試すエンジン候補を決めます。

- **likely が多い**: WebGPU系エンジンも候補にできる。
- **limited が多い**: Transformers.js系の小型モデルを優先する。
- **unlikely が多い**: スマホ埋め込みAIの本番UI化は見送り、PC Ollama中心にする。
- **unknown が多い**: 診断ロジックまたはブラウザ対応の追加確認が必要。

判定は1台では決めず、iPhone / Android / PC の傾向で判断してください。断定しすぎないこと。

## Privacy Notes

- 診断結果に名前、生徒情報、先生メモ、学習記録、個人情報を貼らないでください。
- 診断結果は自動送信されません。
- 診断結果は自動保存されません。
- 結果を共有する場合は、端末名・ブラウザ・readiness・WebGPU / IndexedDB / storage 程度に留めてください。
- スクリーンショットを共有する場合は、個人情報が写っていないか確認してください。
