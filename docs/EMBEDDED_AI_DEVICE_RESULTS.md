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
| iPhone | Safari | Browser | Online | likely | true | true | 39322 MB | 3 MB | true | iPhone Safari でも WebGPU・IndexedDB 利用可。WebGPU系の実験候補。iOS Safari の実性能はフェーズ3で別途確認。deviceMemory=unknown / hardwareConcurrency=4 |
| iPhone | Safari | PWA | Online |  |  |  |  |  |  |  |
| Android | Chrome | Browser | Online | likely | true | true | 10244 MB | 4 MB | true | Pixel 9。WebGPU・IndexedDB 利用でき secure context。WebGPU系エンジンの実験候補。deviceMemory=16 / hardwareConcurrency=12 |
| Android | Chrome | PWA | Online |  |  |  |  |  |  |  |
| PC | Chrome | Browser | Online |  |  |  |  |  |  |  |

オフラインや追加端末を確認した場合は、同じ列で行を増やしてください（例: `Online` 列に `Offline` と記入）。

- **Readiness**: `likely` / `limited` / `unlikely` / `unknown`
- **WebGPU / IndexedDB / Secure context**: `yes` / `no`
- **Storage quota / usage**: 診断テキストの `storage.quota` / `storage.usage`（MB 目安、取得不可なら `不明`）

## Recorded Results (detail)

実機で診断した値です。個人情報は含めていません（端末・ブラウザ・診断値のみ）。

**Android Chrome**

```txt
Device: Pixel 9
Browser: Android Chrome
Readiness: likely
WebGPU: true
IndexedDB: true
Storage quota: 10244 MB
Storage usage: 4 MB
Secure context: true
Online: true
deviceMemory: 16
hardwareConcurrency: 12
Notes: WebGPU・IndexedDB が利用でき、secure context。Android ChromeではWebGPU系エンジンの実験候補。
```

**iPhone Safari**

```txt
Device: iPhone
Browser: Safari
Readiness: likely
WebGPU: true
IndexedDB: true
Storage quota: 39322 MB
Storage usage: 3 MB
Secure context: true
Online: true
deviceMemory: unknown
hardwareConcurrency: 4
Notes: iPhone SafariでもWebGPU・IndexedDBが利用可能。WebGPU系エンジンの実験候補。ただしiOS Safariの実性能はフェーズ3で別途確認。
```

PC Chrome / PWA / オフラインは未測定（表は空欄のまま）。

## Phase 3 Direction (from results)

Android Chrome と iPhone Safari の両方で readiness likely / WebGPU true / IndexedDB true が確認できたため、フェーズ3では WebGPU系エンジンを第一候補にできる。

ただし、初回モデルサイズ・実行速度・メモリ・iOS Safariの実性能は未確認のため、Transformers.js系の小型モデルも保険候補として残す。

実モデル・実エンジンはまだ未追加で、本番UIにもまだ出さない（`EMBEDDED_AI_UI_ENABLED` / `EMBEDDED_AI_PROBE_ENABLED` は false のまま）。

フェーズ3A（着手済み）では、上記判断に基づき WebGPU系エンジンの最小PoC足場（adapter ＋ 隠しURL `?oriexProbe=embedded-ai-poc` / `#embedded-ai-poc` ＋ `EMBEDDED_AI_POC_ENABLED = false`）のみを追加し、実エンジンは見送り（defer）。初回モデルサイズ・速度・メモリ・iOS Safari実性能を実機で確認してからフェーズ3Bで実エンジンを判断する。詳細は [docs/EMBEDDED_AI_PLAN.md](./EMBEDDED_AI_PLAN.md) の「Phase 3A WebGPU PoC」を参照。

フェーズ3Bでは WebLLM系エンジン（依存 `@mlc-ai/web-llm` 0.2.84、model id `Qwen2.5-0.5B-Instruct-q4f16_1-MLC`）を adapter に最小接続。隠しPoC URLでのみ・ユーザーが「モデルを読み込む」を押した時だけ動的importで取得し、初期bundleには混ざらない。`EMBEDDED_AI_POC_ENABLED = false`（案A）のため既定は無効。実機で次を測って記録する必要がある: **初回モデル読み込み時間 / 生成時間 / メモリ / 失敗率**（Android Chrome・iPhone Safari）。記入欄:

```txt
WebLLM spike (Qwen2.5-0.5B-Instruct-q4f16_1-MLC):

Android Chrome:
  model load time:
  generate time:
  memory ok:
  result quality (短評):
  failed?:

iPhone Safari:
  model load time:
  generate time:
  memory ok:
  result quality (短評):
  failed?:
```

## How to Decide Phase 3

実機の Readiness 集計を見て、フェーズ3で試すエンジン候補を決めます。

- **likely が多い**: WebGPU系エンジンも候補にできる。
- **limited が多い**: Transformers.js系の小型モデルを優先する。
- **unlikely が多い**: スマホ埋め込みAIの本番UI化は見送り、PC Ollama中心にする。
- **unknown が多い**: 診断ロジックまたはブラウザ対応の追加確認が必要。

判定は1台では決めず、iPhone / Android / PC の傾向で判断してください。断定しすぎないこと。

## Phase 3C WebLLM Real Device Results

実機での WebLLM PoC スパイク測定欄です。**Phase 3C は検証用ブランチ `embedded-ai-webllm-device-spike` 限定**で、`EMBEDDED_AI_POC_ENABLED = true` は**一時的**です。**main へ戻す前に必ず false に戻します。** 通常UIには出さず、隠しURL（`?oriexProbe=embedded-ai-poc` / `#embedded-ai-poc`）でのみ実行します。モデル/ランタイムは取得されますが、入力文は外部AI APIへ送信しません。実データ・個人情報は入力しないでください（固定サンプルのみ）。

実機確認順:

1. PC Chrome
2. iPhone Safari

Android は今回は未測定です。

固定入力:

```txt
今日は英単語を20個覚えた。数学は二次関数のグラフを復習した。明日は確認テストをしたい。
```

| Device | Browser | Model | First load time | Cached load time | Generation time | Success | Error | Notes |
|---|---|---|---|---|---|---|---|---|
| PC | Chrome | Qwen2.5-0.5B-Instruct-q4f16_1-MLC |  |  |  |  |  |  |
| iPhone | Safari | Qwen2.5-0.5B-Instruct-q4f16_1-MLC |  |  |  |  |  |  |
| Android | Chrome | Qwen2.5-0.5B-Instruct-q4f16_1-MLC | Not tested | Not tested | Not tested | Not tested |  | Android device unavailable |

記入は PoC画面のコピー用診断ログ（`modelLoadDurationMs` / `generationDurationMs` / `success` / `error` / `firstOrCachedLoad` など）から転記してください。診断ログには入力本文は含まれず、`inputLength` のみが入ります。



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
