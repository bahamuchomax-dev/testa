# GITHUB_RELEASE_CHECKLIST

GitHub 公開前の最終チェックリストです。公開先は [bahamuchomax-dev/testa](https://github.com/bahamuchomax-dev/testa) を想定します。

## 1. クリーンインストールと基本検証

```bash
npm ci
npm run lint
npm run test
npm run security:scan
npm run build
npm audit
```

- [ ] `npm ci` が成功する。
- [ ] `npm run lint` が成功する。
- [ ] `npm run test` が成功する。
- [ ] `npm run security:scan` が FAIL 0 で成功する。
- [ ] `npm run build` が成功し、`dist/` が生成される。
- [ ] `npm audit` で公開前に対応すべき脆弱性がない。

## 2. Rules Emulator（環境依存）

```bash
npm run test:rules
```

- [ ] Firebase CLI / Firestore Emulator を使える環境で `npm run test:rules` を実行する。
- [ ] 初回実行時は Firestore Emulator の jar 取得が必要。ネットワーク制限がある環境では失敗する可能性がある。
- [ ] 実行できない場合は、未実行の理由をリリースメモに残す。

## 3. 外部AI文字列チェック

```bash
grep -RInE "api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|genron_anthropicApiKey|anthropic-dangerous-direct-browser-access|OPENAI|ANTHROPIC|GEMINI|CLAUDE_API|Claude API" src package.json .env* dist 2>/dev/null || true
```

- [ ] `src`、`package.json`、`.env*`、`dist` に外部AI API/キー/旧ブラウザ直叩きトークンが残っていない。
- [ ] `docs/` や `test/secretScanStatic.test.js` の監査用説明・検出テストと混同しない。
- [ ] ローカルAIは Ollama の localhost 接続のみで、外部AI APIを追加していない。

## 4. ZIP 内容確認

- [ ] ZIP に `node_modules/` が無い。
- [ ] ZIP に `dist/` が無い。
- [ ] ZIP に `.env` / `.env.local` / `.env.*.local` が無い。
- [ ] ZIP に `.git/` が無い。
- [ ] ZIP に `coverage/` / `.cache/` / `.DS_Store` が無い。
- [ ] legacy bundle を直接編集していない。

## 5. 実機確認

- [ ] PC 実機でトップ画面が白画面にならない。
- [ ] PC 実機で主要画面のクリック、入力、保存、再読み込みが動く。
- [ ] スマホ実機でトップ画面が白画面にならない。
- [ ] スマホ実機で横幅崩れ、入力不能、スクロール不能がない。
- [ ] Service Worker 更新確認を行う。古いキャッシュで更新が止まらないことを見る。
- [ ] ハムスター3Dが表示され、操作できる。
- [ ] テーマ写真を選択、反映、再読み込み復元、削除できる。
- [ ] アバターを選択、保存、再読み込み復元、削除できる。
- [ ] 通常画面にローカルAIの浮遊ボタン/タブが表示されない。再有効化時は Ollama localhost 接続だけが許可されることを確認する。

## 6. XSS 簡易確認

- [ ] プロフィール名/自己紹介に `<script>alert(1)</script>` を入れて保存・再表示しても実行されない。
- [ ] 先生メモ、配信本文、生徒入力、学習記録などのテキスト欄に HTML を入れても表示時に実行されない。
- [ ] `javascript:` URL や `data:` URL をユーザー入力由来で `href` / `src` に入れていない。
- [ ] legacy bundle 内の未確認経路は `docs/XSS_AUDIT.md` の未対応事項として扱う。

## 7. 公開直前の確認

- [ ] README の起動手順、build 手順、test 手順、security:scan 手順が最新。
- [ ] `docs/SECURITY_CHECKLIST.md`、`docs/XSS_AUDIT.md`、`docs/SECRET_AUDIT.md`、`docs/BUG_AUDIT.md` を確認した。
- [ ] GitHub Pages の Source が **GitHub Actions** になっている。`main` / root 配信のままだと Vite 開発用 `index.html` が配信され、白画面になる可能性がある。
- [ ] Actions の Pages deploy で `node scripts/pagesSmokeCheck.mjs dist` が成功している。
- [ ] Firestore Rules / 認証 / データ構造 / テーマ写真 / アバター / ローカルAIの仕様を本リリースで不要に変更していない。
- [ ] 公開するコミットまたは ZIP の範囲を最終確認した。
