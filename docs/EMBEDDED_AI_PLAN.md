# Embedded (On-Device) AI Plan

> 概要（日本語）: スマホ向け埋め込みAIは**実験機能**です。現在は通常UIでは無効（`EMBEDDED_AI_UI_ENABLED = false`）で、初期表示では読み込みません。Ollama（PC向け・高品質ローカルAI）は残します。これは外部AI APIではなく、入力文・生徒データ・先生メモを外部AI APIへ送信しません。端末によっては動作せず、初回はモデル取得が必要な可能性があります。失敗してもアプリ本体は壊れません。

Status: experiment, phase 1 (foundation only). The embedded AI is an **experimental** feature and is **disabled in the normal UI** (`EMBEDDED_AI_UI_ENABLED = false`). No model and no AI library are bundled in this phase — only an abstraction layer, a device probe, a dev-only panel, and these docs.

## Purpose

Give Oriex a path to a small AI that can run **on the device** — phones included — so study help can work without a PC and without any external AI API. Phase 1 only lays the foundation; it does not replace anything.

## Two AI tracks (and how they differ)

- **Ollama (kept, unchanged):** PC-oriented, high quality, connects to a local Ollama server on `localhost` / `127.0.0.1`. This remains the high-quality local-AI track. Its implementation is NOT removed. Its UI is currently paused along with the rest of the Local AI UI.
- **Embedded AI (this experiment):** phone-oriented, experimental, light use cases, inference **inside the browser on the device**. Not high quality, not a replacement for Ollama.

| | Ollama | Embedded AI |
| --- | --- | --- |
| Target | PC | Phone / low-power |
| Quality | High | Light / best-effort |
| Where it runs | Local Ollama server (localhost) | In the browser, on the device |
| Status | Kept (UI paused) | Experiment, UI disabled |

## This is NOT an external AI API

The embedded AI is **not** an external AI API. OpenAI, Anthropic, and Gemini style hosted APIs are not used, not added, and not configured. No AI API keys and no `.env` are introduced.

**Model download vs. prompt sending — the key distinction:**

- An embedded engine, once one is plugged in, **may download model files and/or a runtime library** from the engine provider (for example a CDN). That download contains no user data — it is just the model/runtime bytes.
- The user's typed text, student data, and teacher memos are **processed on the device** and are **never sent to an external AI API**.

> 埋め込みAIは、モデルファイルやライブラリを取得する場合がある。
> ただし、ユーザーの入力文・生徒データ・先生メモを外部AI APIへ送信しない。

## Performance reality on phones

On-device inference can be heavy: phones vary widely, the first run may need a large model download, it uses battery, and some devices simply cannot run it. The experiment must degrade gracefully ("この端末では使えません") rather than hang or white-screen.

## Loading policy (must not load on startup)

- The embedded AI is **not loaded on initial render** and is **not imported by `src/main.js`**, so it adds nothing to app startup or the initial bundle.
- A model/library is loaded **only** when the user explicitly opts in (presses "端末内AIを試す").
- A real engine is plugged in later via `registerEmbeddedAiEngine(loader)`, where `loader` does a **dynamic `import()`** of its library. Example shape (not done in this phase):

  ```js
  registerEmbeddedAiEngine(async () => {
    const mod = await import("some-in-browser-llm-lib");
    const engine = await mod.createEngine({ /* model id, etc. */ });
    return { generate: (prompt) => engine.run(prompt) };
  });
  ```

- Concurrent load attempts share one in-flight Promise (no double download).
- On any failure the client returns a graceful `{ ok: false, reason }`; the UI shows "この端末では使えません" and never breaks the app.

## Phase 1 use case (kept small)

Exactly one tiny use case: **a short review suggestion built from today's study memo** (`EMBEDDED_AI_EXPERIMENT = "review-suggestion"`). It was chosen because the input is short, strict JSON output is not required, and a failure does not break any core feature.

## Model fetch & cache policy

- No model is fetched in phase 1 (no engine is bundled).
- When an engine is added later, the model/runtime is fetched from the **engine provider (e.g. a CDN)**, recorded here before use. The exact source must be added to this doc at that time.
- The engine may cache model bytes **on the device** in IndexedDB and/or Cache Storage. If so, that cache must be documented here.
- Even when a model source is contacted for the download, **the user's input text is not sent** to it.
- Long prompts are not stored in `localStorage`. The experiment input is clamped (`EMBEDDED_AI_INPUT_MAX_LENGTH`, 800 chars).

## Security rules

- Prompts are not sent to any external AI API.
- No OpenAI / Anthropic / Gemini (or other hosted AI) endpoint is added.
- The model source (for the download only) is documented here before use; input text is never sent to it.
- Generated text is rendered as plain text (`{text}`), never as HTML. `dangerouslySetInnerHTML` / `innerHTML` are not used.
- Firebase, Firestore, Rules, auth, and data structure are untouched.

## Files (phase 1)

- `src/features/embeddedAi/embeddedAiConfig.js` — flags, experiment id, input cap, UI warnings, model-source note.
- `src/features/embeddedAi/embeddedAiDevice.js` — capability probe (WebGPU, `navigator.gpu`, IndexedDB, offline, low-memory, mobile). Never throws.
- `src/features/embeddedAi/embeddedAiClient.js` — pluggable abstraction: `checkEmbeddedAiSupport`, `loadEmbeddedAiEngine`, `generateEmbeddedAiText`, `registerEmbeddedAiEngine`, `buildReviewSuggestionPrompt`, `resetEmbeddedAiForTests`.
- `src/features/embeddedAi/EmbeddedAiExperimentPanel.jsx` — dev-only panel. Not wired to production.

## Engine Candidates

A comparison to decide what (if anything) to try in phase 2. Nothing here is a commitment — every option needs real-device testing. None of these is an external AI API; they all run inference on the device. The only thing that may be fetched from the network is the **model / runtime bytes** (from the engine's own source, e.g. a CDN). User input text is not sent to that source.

**WebLLM-style engines (e.g. @mlc-ai/web-llm):**
- Mobile expectation: plausible on devices with working **WebGPU**, otherwise unlikely.
- First-download size: a concern — LLM weights can be hundreds of MB; this dominates first-run time and storage.
- Requirements: WebGPU (with a WASM fallback path on some builds); meaningful RAM.
- iPhone/Android: Android Chrome WebGPU is further along; iOS Safari WebGPU support is newer and must be verified on real hardware.
- PWA fit: workable in principle (it is a JS/WASM library), but the large cached model needs an explicit cache strategy.
- Notes for Oriex: keep it out of the initial bundle (lazy dynamic import), gate behind device checks, and show progress + a clear "この端末では使えません" fallback.

**Transformers.js-style engines (e.g. @huggingface/transformers):**
- Mobile expectation: better for **small models** and classification/embedding/summarization than for full chat LLMs.
- First-download size: smaller models exist, so the download can be more modest than a full LLM.
- Requirements: runs on WASM (and can use WebGPU where available); lighter floor than a big LLM.
- iPhone/Android: small models are more likely to run across both, but quality/speed vary.
- PWA fit: generally good for small models; still cache the model bytes deliberately.
- Notes for Oriex: a realistic match for the phase-1 use case (short review suggestion / summarization) if a small model is "good enough"; do not expect strong general chat quality.

**MediaPipe LLM Inference-style engines (Google MediaPipe):**
- Mobile expectation: designed for on-device inference; a candidate, but web/PWA-only usage needs investigation.
- First-download size: model-dependent; can be large.
- Requirements: WASM/GPU depending on build; specific model formats.
- iPhone/Android: strong on Android tooling historically; web + iOS behaviour must be checked on real devices.
- PWA fit: needs verification that it works purely from a PWA without native packaging.
- Notes for Oriex: treat as "investigate on real devices first"; do not assume PWA support.

**Abstraction-only (continue as today):**
- Mobile expectation: N/A (no engine runs); always "safe".
- First-download size: none.
- Requirements: none.
- iPhone/Android: identical (feature stays off).
- PWA fit: perfect (nothing added).
- Notes for Oriex: the safest state. Keep the embedded AI out of the production UI until device compatibility and model size are confirmed by real testing. This is the current state.

## Phase 2 Device Results (summary)

Real-device probe results are recorded in [docs/EMBEDDED_AI_DEVICE_RESULTS.md](./EMBEDDED_AI_DEVICE_RESULTS.md). So far Android Chrome (Pixel 9) and iPhone Safari both returned **readiness `likely`**, **WebGPU `true`**, and **IndexedDB `true`** in a secure context. Based on that, phase 3 can make a **WebGPU-style engine the first candidate**, while keeping a **Transformers.js-style small model as a fallback** because first-run model size, runtime speed, memory, and real iOS Safari performance are still unverified. No real model/engine has been added, and the embedded AI is still not exposed in the production UI (`EMBEDDED_AI_UI_ENABLED` / `EMBEDDED_AI_PROBE_ENABLED` stay `false`). PC Chrome and the PWA/offline rows are not yet measured.

## Phase 2 Entry Criteria

Try a real engine in phase 2 only when all of these hold:

- Target phones can actually use WebGPU / the engine's required APIs (verified on real iPhone and Android, not just spec tables).
- The first-run model download size is acceptable for the use case and clearly disclosed to the user before fetch.
- The engine and model are NOT in the initial bundle.
- The engine loads via a lazy dynamic import, only on explicit opt-in, with a shared in-flight Promise.
- Unsupported devices fail gracefully ("この端末では使えません") with no white screen.
- Prompts, input text, student data, and teacher memos are never sent to an external AI API.
- `npm run security:scan` and the external-AI string grep stay clean.
- A failure (download, init, or generation) does not affect any core feature or stored learning data.



## Phase 2 Device Probe

Phase 2 adds a **diagnostic only** — no real AI model and no AI library are loaded. It reads device capability signals so we can judge, on real phones, whether an on-device engine could ever run, and then pick a candidate in phase 3.

Checked signals:

- **WebGPU** (`navigator.gpu`) — the fast path for several engines.
- **IndexedDB** — needed to cache model bytes on the device.
- **Storage estimate** (`navigator.storage.estimate()`) — coarse quota / usage, to judge whether a model would fit.
- **Memory / cores** (`navigator.deviceMemory`, `navigator.hardwareConcurrency`) — rough capacity hints.
- **Secure context, online/offline, platform, language, userAgent** — environment context.
- **Device class flags** — likely mobile / iOS / Android / Safari / Chrome.

What to look at per platform:

- **iPhone Safari:** WebGPU is newer here; expect it may be missing or limited. IndexedDB + storage estimate behaviour varies. This is the environment most likely to land in "limited".
- **Android Chrome:** WebGPU is further along; more likely to reach "likely", subject to memory/storage.
- **PC Chrome:** usually the most capable; good as a positive control, but not representative of phones.

Privacy rules for the probe:

- The diagnostic result is **not auto-sent** anywhere (診断結果を自動送信しない) and **not auto-saved** (自動保存しない); no network transmission, no backend write, no browser-storage write.
- No permissions are requested (no location / contacts / photos / mic / camera).
- The report contains only capability flags + coarse estimates + standard environment fields (e.g. userAgent). No learning data, no student data, no personal contact info.
- The result is shown as plain text for **manual** copy; sharing it is the developer's explicit choice.

The probe is **not** in the normal UI. It lives in an unmounted component (`EmbeddedAiProbePanel.jsx`, approach A) plus a flag `EMBEDDED_AI_PROBE_ENABLED = false`. Use the readiness summary (`likely` / `limited` / `unlikely` / `unknown`) across devices to choose a phase-3 engine candidate.

## Manual Device Checklist

Run the probe on each of these and record the readiness level + notes:

- [ ] iPhone Safari
- [ ] Android Chrome
- [ ] PC Chrome
- [ ] Served from GitHub Pages (HTTPS), page renders
- [ ] After "Add to Home Screen" (installed PWA)
- [ ] Online state
- [ ] Offline state
- [ ] `storage.estimate()` returns a quota/usage (or is gracefully "不明")
- [ ] WebGPU present?
- [ ] IndexedDB present?
- [ ] No white screen / no thrown error in any of the above

## Opening the Device Probe

The probe is **not** in the normal UI and is **not** a tab. A normal visit always boots the regular app. The probe opens only when the URL explicitly asks for it, via either form (served over HTTPS, e.g. GitHub Pages):

- Query: `https://<user>.github.io/<repo>/?oriexProbe=embedded-ai`
- Hash: `https://<user>.github.io/<repo>/#embedded-ai-probe`

When that URL is detected, `src/main.js` skips the normal app and dynamic-imports the probe panel as a separate lazy chunk (the probe chunk is never loaded on a normal visit). If the probe fails to load, it falls back to the normal app rather than showing a white screen.

What the probe does and does not do:

- It loads **no AI model** and **no AI library** — it only reads device capability flags.
- The diagnostic result is **not auto-sent** and **not auto-saved** (no network transmission, no backend write, no browser-storage write). The result is shown as plain text to copy and share manually.
- `EMBEDDED_AI_UI_ENABLED` and `EMBEDDED_AI_PROBE_ENABLED` both stay `false`; normal UI exposure remains disabled. The URL route is the only way in, intended for real-device investigation.

Check on each environment and record the readiness level:

- iPhone Safari
- Android Chrome
- PC Chrome
- After "Add to Home Screen" (installed PWA) — open the same URL / route

Record results in the template at [docs/EMBEDDED_AI_DEVICE_RESULTS.md](./EMBEDDED_AI_DEVICE_RESULTS.md). Before choosing a phase-3 engine, probe iPhone / Android / PC and fill that table. Do not paste any personal information (names, student data, teacher memos, learning records) into the results.

## Phase 3C WebLLM Device Spike

Phase 3C is the **real-device spike** for the WebLLM PoC. It runs on a dedicated verification branch only.

- **Branch-only flag:** `EMBEDDED_AI_POC_ENABLED = true` is set **temporarily** on the device-spike branch so the hidden PoC URL can load/generate on a real phone. `EMBEDDED_AI_UI_ENABLED` and `EMBEDDED_AI_PROBE_ENABLED` stay `false`. **The PoC flag MUST be reset to `false` before merging to main.** Even with it true, the PoC is never in normal navigation/TABS — it is reachable only via `?oriexProbe=embedded-ai-poc` / `#embedded-ai-poc`.
- **Deploy policy:** the GitHub Pages workflow deploys automatically only from `main`. Pushing `embedded-ai-webllm-device-spike` does not auto-deploy. For a temporary real-device check, run the existing `Deploy to GitHub Pages` workflow manually (`workflow_dispatch`) from the `embedded-ai-webllm-device-spike` branch, then redeploy `main` after the test. Do not merge this branch into `main` while `EMBEDDED_AI_POC_ENABLED = true`.
- **Still gated:** the model is loaded only when the user presses "モデルを読み込む"; opening the page loads nothing. Generation is gated behind WebGPU + IndexedDB and fails gracefully.
- **Measurement log:** the PoC panel emits a copy-friendly plain-text diagnostic (timestamp, device summary, userAgent, readiness, WebGPU, IndexedDB, secureContext, online, model id, load start/finish/duration, first-or-cached, generation start/finish/duration, success/failure, error, input length, output length, storage quota and usage before/after). The log contains **only lengths and metrics — never the input body**; `inputLength` is logged, not the memo text. It is not auto-saved or auto-sent.
- **Fixed sample input (no personal data):** "今日は英単語を20個覚えた。数学は二次関数のグラフを復習した。明日は確認テストをしたい。" → "今日やるべき復習を3つ以内で短く提案". No student names, teacher memos, real records, profiles, PDFs, or long input.
- **Model fetch vs input send:** the model weights / WASM runtime are fetched and cached on-device; the input text is processed on-device and never sent to an external AI API.
- **Order:** measure PC Chrome first as the positive-control device, then iPhone Safari. Android is not measured in this pass and remains `Not tested`. For each measured device, open the hidden URL, load the model (record first load), generate the fixed sample (record generation time + success), reload and load again (record cached load). If iPhone Safari crashes, freezes, or loads too slowly, stop and record the error. Record everything in the Phase 3C table in `docs/EMBEDDED_AI_DEVICE_RESULTS.md`.

## Phase 3B WebLLM Spike

Phase 3B wires a single WebGPU-first candidate — a **WebLLM engine** — into the adapter seam as a spike, behind the hidden PoC URL only.

**Outcome: dependency added (kept).** `@mlc-ai/web-llm` (0.2.84) installs cleanly, `npm run build` / `npm run test` / `npm run security:scan` pass, and it stays out of the initial bundle (it is reached only through a dynamic `import()` inside the loader, so Vite emits it as a separate lazy chunk that `index.html` does not reference). No model weights are committed to the repo.

- Dependency: `@mlc-ai/web-llm` (verified version 0.2.84).
- Model id: `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` — chosen from the installed package's `prebuiltAppConfig.model_list` (0.5B class, q4f16, `low_resource_required: true`, ~945 MB VRAM). Not guessed.
- Model id confirmed via: `node -e` against the installed `@mlc-ai/web-llm`'s `prebuiltAppConfig.model_list`.
- API confirmed against the installed package: `CreateMLCEngine(modelId, { initProgressCallback })` and `engine.chat.completions.create({ messages, temperature, max_tokens })`.

**Model fetch vs input send (important):**
- When the user explicitly loads the model, the engine fetches **model weights** from the engine provider (Hugging Face: `https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC`) and the **WASM runtime** from the MLC libs host (`https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/`).
- That download is **engine/weights/runtime only**. The user's input text is processed **on-device** and is **never sent to an external AI API**. These sources are not AI API endpoints.
- The engine may cache the model/runtime on-device in IndexedDB / Cache Storage. The only thing cached is model/runtime — not prompts, not results, not learning data.

**Loading is explicit, never on page open:**
- `webLlmEngineLoader.js` does NOT import `@mlc-ai/web-llm` at module top level. The `import()` is inside the loader function registered via `registerWebGpuEngineLoader`.
- The PoC panel registers the loader on mount (cheap, imports nothing). The library + model are fetched only when the user presses "モデルを読み込む". Opening the PoC page fetches no model.
- `loadWebGpuEmbeddedAiEngine` gates on WebGPU + IndexedDB before any import, shares one in-flight load (no double download), and fails gracefully (no white screen).

**Flag policy (option A, the safe default):** `EMBEDDED_AI_POC_ENABLED` stays `false`. The PoC page opens via the hidden URL but the load/generate buttons are disabled; the WebLLM wiring exists and is ready. Real-device verification is done by temporarily setting the flag `true` in source for local dev (never committed as `true`), then exercising the PoC URL on a real phone.

**Use case (one only):** today's study memo → ≤3-line review suggestion. Input clamped to 800 chars; output trimmed to ≤3 lines of plain text. No PDF dumps, no bulk teacher memos, no student records, no long generation, no auto-save, no Firebase send, no HTML rendering, no inferring personal info.

**Still to verify on real devices (record in `docs/EMBEDDED_AI_DEVICE_RESULTS.md`):** first-run model download time, generation time, memory headroom, and failure rate — on Android Chrome and especially iPhone Safari. If real iOS Safari behaviour is poor, fall back to the Transformers.js-style small-model candidate (kept in reserve) and, if needed, revert the dependency.

## Phase 3A WebGPU PoC

Phase 3A builds the **minimal WebGPU PoC scaffold**. Because Android Chrome (Pixel 9) and iPhone Safari both probed `likely` with WebGPU `true` and IndexedDB `true`, a **WebGPU-style engine is the first candidate**. A **Transformers.js-style small model is kept as a fallback** (it can run on WASM if real iOS Safari performance disappoints).

**Decision this phase: the real engine is DEFERRED (adapter only).** No AI library dependency was added, for these reasons:
- A WebGPU in-browser LLM library is heavy and its model weights are large (often hundreds of MB) — not something to wire in before measuring first-run size, speed, and memory on real phones.
- Real iOS Safari performance is still unverified (phase 2.7 confirmed capability flags, not throughput).
- Adding it now risks build/chunk bloat and unproven device behaviour. Deferring is the safe call, not a failure.

So phase 3A ships:
- `src/features/embeddedAi/engines/webGpuEngineAdapter.js` — a swappable seam (`loadWebGpuEmbeddedAiEngine`, `generateWithWebGpuEmbeddedAi`, `registerWebGpuEngineLoader`, `resetWebGpuEmbeddedAiEngineForTests`). It bundles no model/library, gates on WebGPU + IndexedDB, shares one in-flight load, and returns a graceful `{ ok:false, reason }` (no white screen). With no engine wired it returns `engine-not-bundled`.
- A hidden PoC route (`embeddedAiPocRoute.js`) + panel (`EmbeddedAiPocPanel.jsx`) + lazy mount (`mountPoc.jsx`), reachable only via `?oriexProbe=embedded-ai-poc` or `#embedded-ai-poc`. Not in TABS, not in normal navigation.
- A flag `EMBEDDED_AI_POC_ENABLED = false`. Even on the hidden URL the generate action only runs when this is intentionally set to `true` in source for local dev; the panel otherwise shows that the PoC is disabled. The PoC is never exposed in the production UI.

**Wiring a real engine later (phase 3B):** call `registerWebGpuEngineLoader(loader)`, where `loader` does a dynamic `import()` of the chosen library inside itself (so it stays a lazy chunk, never in the initial bundle) and returns `{ generate(prompt) }`. Concrete library choice belongs in `docs/EMBEDDED_AI_DEVICE_RESULTS.md` / this file at that time.

**Use case (kept to one):** today's study memo → a short review suggestion (≤3 lines). Input is clamped to 800 chars. No PDF dumps, no bulk teacher memos, no student records, no long generation, no strict JSON, no auto-save, no Firebase send.

**Model fetch vs input send (important):** when a real engine is added, it **may download model / runtime bytes** from the engine provider (e.g. a CDN) and cache them on the device (IndexedDB / Cache Storage). That download carries no user data. The user's **input text is processed on-device and is never sent to an external AI API.** The exact model source and on-device cache must be recorded here before any real engine is enabled.

**Still to verify on real devices before phase 3B:** first-run model size, generation speed, memory headroom, and real iOS Safari throughput. Record them in `docs/EMBEDDED_AI_DEVICE_RESULTS.md`.

## Future enable conditions

Before the embedded AI may appear in any real UI:

1. Pick an engine that genuinely runs on target phones and document its model source + on-device cache here.
2. Add it via `registerEmbeddedAiEngine` with a dynamic import — never in the initial bundle, and keep the build size acceptable (lazy chunk only).
3. Verify graceful failure on unsupported devices (no white screen) on real phones.
4. Confirm no prompt/student data leaves the device and the external-AI string scan stays clean.
5. Decide exposure separately from the paused Local AI UI; do not silently re-enable either.
