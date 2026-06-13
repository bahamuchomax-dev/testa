# LOCAL_AI

Oriex のローカルAI機能は、同じ端末で動く Ollama だけを使う学習支援機能です。外部AI API、APIキー、外部AI SDKは使いません。

> 現在、ローカルAIの UI 導線は一時停止中です。`src/features/localAi/` の実装と Ollama 通信コードは残していますが、通常画面の浮遊ボタンと App タブからはアクセスできません。再有効化する場合は `src/features/localAi/uiFlag.js` の `LOCAL_AI_UI_ENABLED` と sidecar mount / App 側の導線を戻してください。

## 起動

1. Ollama をインストールする。
2. Ollama を起動する。
3. 推奨モデルを取得する。
4. UI 一時停止を解除した環境で Oriex を開き、ローカルAI画面から接続確認する。

```bash
ollama serve
ollama pull qwen2.5:14b-instruct
```

推奨モデル:

```txt
qwen2.5:14b-instruct  推奨
qwen2.5:7b-instruct   軽量
qwen2.5:32b-instruct  高性能PC向け
```

## 許可する通信先

許可する通信先は次の2つだけです。

```txt
http://localhost:11434
http://127.0.0.1:11434
```

それ以外のURL、LAN IP、任意のホスト、https、`0.0.0.0`、`::1` はブロックします。スマホやPWAから同じLAN内の別端末へ直接送る構成も許可しません。

## できること

- 今日の学習記録から復習案を作る。
- 先生メモを報告文に整える。
- 単語リストから小テストを作る。
- 生徒カルテを要約する。
- PDF教材から問題案を作る。
- 接続確認で、ローカル処理であることを確認する。

## 品質制御

ローカルAIは `temperature: 0.1`、`num_ctx: 16384` を基本に、次の流れで結果を確認します。

```txt
初回生成
自己検査
必要な場合だけ修正生成
最終チェック
```

JSON出力が必要なタスクは `localAiSchemas.js` のスキーマで検証します。壊れたJSONや必須項目不足の場合は、UI側でテキスト表示へフォールバックし、アプリ全体が落ちないようにします。

## 保存しないもの

次の内容は自動保存しません。

```txt
生成結果
先生メモ
生徒情報
PDF本文
PDFファイル
```

ユーザーが必要な場合だけ、コピーまたは `.txt` 保存を行います。

`localStorage` に保存するのは、接続先URL、モデル、モデルプロファイル、最後に使ったタブなどの設定だけです。APIキーは扱いません。

## PDF

PDFはブラウザ内で `pdfjs-dist` を使ってテキスト抽出します。PDFファイルそのものや抽出テキストを外部へ送る経路は作りません。

未対応:

```txt
画像PDF
スキャンPDF
OCR
```

画像PDFの場合は、テキスト抽出できない旨を返します。

## 実装場所

```txt
src/features/localAi/localAiClient.js      Ollama通信、許可URL判定、タイムアウト
src/features/localAi/localAiPrompts.js     プロンプト
src/features/localAi/localAiSchemas.js     JSONスキーマ、抽出、必須項目検証
src/features/localAi/localAiQuality.js     自己検査、修正生成、最終チェック
src/features/localAi/localAiStorage.js     設定のみlocalStorage保存
src/features/localAi/pdfTextExtractor.js   ブラウザ内PDFテキスト抽出
src/features/localAi/LocalAiPanel.jsx      入力フォームと結果表示
src/features/localAi/index.jsx             サイドカー起動
```

## トラブルシューティング

- 接続できない: `ollama serve` が動いているか確認する。
- モデルがない: `ollama pull qwen2.5:14b-instruct` を実行する。
- 応答が遅い: 軽量モデルに切り替えるか、入力を短くする。
- PDFが読めない: テキスト選択できるPDFか確認する。画像PDF/OCRは未対応。

## 検証

```bash
npm run lint
npm run test
npm run build
npm audit
```
