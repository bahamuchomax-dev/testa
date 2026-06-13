/* ============================================================
 * localAiValidators — タスク別の決定的（コード側）検査（v5-3）
 * ------------------------------------------------------------
 * AIの自己検査(localAiQuality.js)だけに頼らず、アプリ側のコードでも
 * 危ない出力を検出する。すべて純粋関数（ネットワーク/DOM非依存）で、
 * Ollama にも何も送らない。各検査は次の共通形を返す:
 *
 *   { ok, issues, warnings, blockedQuestionNumbers, scorePenalty }
 *     ok                     : issues が無ければ true
 *     issues                 : 重大（範囲外・本文不一致・人格否定 等）
 *     warnings               : 注意（多すぎ・偏り・推測の断定 等）
 *     blockedQuestionNumbers : 問題番号（小テスト/PDF）
 *     scorePenalty           : finalCheck.score から引く目安
 *
 * 重要: 出力がそのタスクの形（署名フィールド）でない場合は検査を
 * スキップして ok を返す。これは自己検査/スキーマ検証の領分であり、
 * 別タスクのデータに誤発火しないため（v5-2の挙動を壊さない）。
 * ============================================================ */

import { LOCAL_AI_TASKS } from "./localAiPrompts.js";

const STATUS_RANK = { usable: 0, caution: 1, blocked: 2 };

function emptyResult() {
  return { ok: true, issues: [], warnings: [], blockedQuestionNumbers: [], scorePenalty: 0 };
}

function finalizeResult({ issues = [], warnings = [], blockedQuestionNumbers = [] } = {}) {
  const uniq = (a) => Array.from(new Set(a.map((x) => String(x)).filter(Boolean)));
  const i = uniq(issues);
  const w = uniq(warnings);
  const blocked = Array.from(new Set(blockedQuestionNumbers.filter((n) => n != null)));
  return {
    ok: i.length === 0,
    issues: i,
    warnings: w,
    blockedQuestionNumbers: blocked,
    scorePenalty: Math.min(100, i.length * 20 + w.length * 5),
  };
}

/* 空白・改行（全角空白含む）を吸収した比較用テキスト。 */
function normalizeText(s) {
  return String(s == null ? "" : s).replace(/\s/g, "");
}
function asString(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
/* オブジェクト/配列を再帰的にたどって文字列だけ集める（表現チェック用）。 */
function collectStrings(value, bag) {
  if (value == null) return bag;
  if (typeof value === "string") {
    bag.push(value);
    return bag;
  }
  if (Array.isArray(value)) {
    for (const x of value) collectStrings(x, bag);
    return bag;
  }
  if (typeof value === "object") {
    for (const k of Object.keys(value)) collectStrings(value[k], bag);
    return bag;
  }
  bag.push(String(value));
  return bag;
}

/* 危険表現のパターン（自己検査と同じ観点をコード側でも持つ）。 */
const PERSONA_PATTERNS = [
  "やる気がない", "やる気が無い", "やる気のなさ", "怠け", "なまけ", "サボ",
  "だらしない", "性格が悪い", "性格的に", "能力がない", "能力不足", "向いていない", "頭が悪い",
];
const MEDICAL_PATTERNS = [
  "うつ病", "発達障害", "学習障害", "ADHD", "ASD", "自閉", "診断", "精神疾患", "障害があ",
];
const EXCESS_PATTERNS = [
  "絶対に伸びる", "絶対伸びる", "必ず伸びる", "必ず合格", "確実に合格", "100%合格", "絶対合格", "間違いなく合格",
];
const FAMILY_PATTERNS = ["家庭環境", "家庭の事情", "親が", "離婚", "ネグレクト", "経済的", "貧困", "虐待"];
const ASSERT_PATTERNS = ["絶対", "必ず", "間違いなく", "に違いない", "断言", "確実に"];

function findPatterns(text, patterns) {
  const hits = [];
  for (const p of patterns) if (text.includes(p)) hits.push(p);
  return hits;
}

/* ---- 単語リストのトークン化（英単語・訳語・品詞などを許可集合に） ---- */
function splitWordLine(line) {
  return String(line || "")
    .split(/[,、，/\u30fb|]|\t| {2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}
function buildWordTokens(sourceWords) {
  const lines = Array.isArray(sourceWords) ? sourceWords : String(sourceWords || "").split(/\r?\n/);
  const tokenSet = new Set();
  for (const line of lines) for (const p of splitWordLine(line)) tokenSet.add(p.toLowerCase());
  return { tokenSet };
}
function countWordEntries(sourceWords) {
  const lines = Array.isArray(sourceWords) ? sourceWords : String(sourceWords || "").split(/\r?\n/);
  return lines.map((l) => String(l).trim()).filter(Boolean).length;
}

/* ============================================================
 * 2. 単語小テストの検査
 * ============================================================ */
export function validateVocabQuiz(quiz, sourceWords) {
  if (!quiz || typeof quiz !== "object" || !Array.isArray(quiz.items)) return emptyResult();
  const issues = [];
  const warnings = [];
  const blocked = [];
  const { tokenSet } = buildWordTokens(sourceWords);
  const hasWordList = tokenSet.size > 0;
  const items = quiz.items;

  // answerKey（任意フィールド）の数が問題数と一致しているか
  if (Array.isArray(quiz.answerKey) && quiz.answerKey.length !== items.length) {
    issues.push(`解答(answerKey)の数(${quiz.answerKey.length})と問題数(${items.length})が一致していません。`);
  }

  const answerIndices = [];
  const seenNos = new Set();
  items.forEach((q, idx) => {
    const no = q && q.no != null ? q.no : idx + 1;
    if (!q || typeof q !== "object") {
      issues.push(`${idx + 1}問目の形式が不正です。`);
      blocked.push(no);
      return;
    }

    const answer = String(q.answer == null ? "" : q.answer).trim();
    if (!answer) {
      issues.push(`${no}問目に解答がありません。`);
      blocked.push(no);
    }

    if (seenNos.has(no)) warnings.push(`問題番号 ${no} が重複しています。`);
    seenNos.add(no);

    const choices = Array.isArray(q.choices) ? q.choices.map((c) => String(c == null ? "" : c).trim()) : null;
    if (choices && choices.length) {
      const lc = choices.map((c) => c.toLowerCase());
      if (new Set(lc).size !== lc.length) {
        issues.push(`${no}問目の選択肢に重複があります。`);
        blocked.push(no);
      }
      if (hasWordList) {
        const outside = choices.filter((c) => c && !tokenSet.has(c.toLowerCase()));
        if (outside.length) {
          issues.push(`${no}問目の選択肢に範囲外の単語があります: ${outside.join(", ")}`);
          blocked.push(no);
        }
      }
      if (answer && !lc.includes(answer.toLowerCase())) {
        issues.push(`${no}問目の正答が選択肢に含まれていません。`);
        blocked.push(no);
      }
      const ai = lc.indexOf(answer.toLowerCase());
      if (ai >= 0) answerIndices.push(ai);
    }

    if (hasWordList && answer && !tokenSet.has(answer.toLowerCase())) {
      // cloze/sentence では正答が文になり得るので、短い語のときだけ注意。
      if (answer.length <= 24 && !answer.includes(" ")) {
        warnings.push(`${no}問目の正答が単語リストに見当たりません: ${answer}`);
      }
    }

    if (hasWordList) {
      const latin = (String(q.question || "").match(/[A-Za-z][A-Za-z'-]+/g) || []).map((w) => w.toLowerCase());
      const stray = latin.filter((w) => w.length >= 3 && !tokenSet.has(w));
      if (stray.length) {
        warnings.push(`${no}問目の問題文に範囲外の英単語の可能性: ${Array.from(new Set(stray)).join(", ")}`);
      }
    }
  });

  if (answerIndices.length >= 4 && new Set(answerIndices).size === 1) {
    warnings.push("4択の正答位置が偏っています（すべて同じ位置）。");
  }
  if (hasWordList) {
    const wordCount = countWordEntries(sourceWords);
    if (wordCount > 0 && items.length > wordCount) {
      warnings.push(`問題数(${items.length})が単語数(${wordCount})より多くなっています。`);
    }
  }

  return finalizeResult({ issues, warnings, blockedQuestionNumbers: blocked });
}

/* ============================================================
 * 3. PDF問題の検査
 * ============================================================ */
function normalizeSource(extractedPages) {
  if (Array.isArray(extractedPages)) {
    const pageNumbers = new Set();
    let raw = "";
    for (const p of extractedPages) {
      if (p && p.page != null) pageNumbers.add(Number(p.page));
      raw += " " + String((p && p.text) || "");
    }
    return { fullTextNorm: normalizeText(raw), fullTextRaw: raw, pageNumbers, hasPages: pageNumbers.size > 0 };
  }
  const raw = String(extractedPages || "");
  return { fullTextNorm: normalizeText(raw), fullTextRaw: raw, pageNumbers: new Set(), hasPages: false };
}

export function validatePdfQuestions(result, extractedPages) {
  if (!result || typeof result !== "object" || !Array.isArray(result.questions)) return emptyResult();
  const issues = [];
  const warnings = [];
  const blocked = [];
  const { fullTextNorm, fullTextRaw, pageNumbers, hasPages } = normalizeSource(extractedPages);

  result.questions.forEach((q, idx) => {
    const no = q && q.no != null ? q.no : idx + 1;
    if (!q || typeof q !== "object") {
      issues.push(`${idx + 1}問目の形式が不正です。`);
      blocked.push(no);
      return;
    }

    // sourcePage
    if (hasPages) {
      if (q.sourcePage == null) {
        issues.push(`${no}問目に sourcePage がありません。`);
        blocked.push(no);
      } else if (!pageNumbers.has(Number(q.sourcePage))) {
        issues.push(`${no}問目の sourcePage(${q.sourcePage}) が抽出ページ範囲外です。`);
        blocked.push(no);
      }
    } else if (q.sourcePage != null && Number(q.sourcePage) <= 0) {
      issues.push(`${no}問目の sourcePage(${q.sourcePage}) が不正です。`);
      blocked.push(no);
    }

    // sourceQuote
    const quote = String(q.sourceQuote == null ? "" : q.sourceQuote).trim();
    if (!quote) {
      issues.push(`${no}問目の sourceQuote が空です。`);
      blocked.push(no);
    } else if (fullTextNorm && !fullTextNorm.includes(normalizeText(quote))) {
      issues.push(`${no}問目の sourceQuote が本文中に見つかりません。`);
      blocked.push(no);
    }

    // questions と answer の対応
    const answer = String(q.answer == null ? "" : q.answer).trim();
    const choices = Array.isArray(q.choices) ? q.choices : null;
    if (!answer && choices && choices.length) warnings.push(`${no}問目に解答がありません。`);

    // 本文にない数値（高シグナル・誤検知を抑えるため2桁以上のみ）
    if (fullTextRaw) {
      const nums = String(q.question || "").match(/\d+/g) || [];
      const strayNums = nums.filter((n) => n.length >= 2 && !fullTextRaw.includes(n));
      if (strayNums.length) {
        warnings.push(`${no}問目に本文にない数値の可能性: ${Array.from(new Set(strayNums)).join(", ")}`);
      }
    }
  });

  return finalizeResult({ issues, warnings, blockedQuestionNumbers: blocked });
}

/* ============================================================
 * 4. 指導報告書の検査（テキスト出力）
 * ============================================================ */
export function validateReportCleanup(result, inputText) {
  const outText = typeof result === "string" ? result : (result && (result.text || result.report)) || "";
  if (!String(outText).trim()) return emptyResult();
  const inputRaw = String(inputText == null ? "" : inputText);
  const inNorm = inputRaw.replace(/\s/g, "");
  const issues = [];
  const warnings = [];

  // 入力にない点数（数字を含む採点表現）
  const digitScores = String(outText).match(/\d+\s*(?:点|\/\s*\d+|割)/g) || [];
  for (const tok of new Set(digitScores.map((s) => s.replace(/\s/g, "")))) {
    const num = (tok.match(/\d+/) || [])[0];
    if (num && !inNorm.includes(num)) issues.push(`入力にない点数（${tok}）が報告書に含まれています。`);
  }
  for (const w of ["満点", "合格点", "赤点"]) {
    if (String(outText).includes(w) && !inputRaw.includes(w)) {
      warnings.push(`入力にない点数表現（${w}）が含まれている可能性があります。`);
    }
  }

  // 入力にない宿題
  if (/宿題/.test(outText) && !/宿題|課題|プリント|ワーク/.test(inputRaw)) {
    warnings.push("入力にない宿題に言及している可能性があります。");
  }
  // 入力にない欠席・体調など
  for (const w of ["欠席", "遅刻", "早退", "発熱", "入院", "欠課"]) {
    if (String(outText).includes(w) && !inputRaw.includes(w)) {
      warnings.push(`入力にない事項（${w}）に言及している可能性があります。`);
    }
  }

  if (findPatterns(outText, PERSONA_PATTERNS).length) issues.push("生徒の人格を評価する表現が含まれています。");
  if (findPatterns(outText, EXCESS_PATTERNS).length) warnings.push("過剰な表現（絶対/必ず など）が含まれています。");
  if (findPatterns(outText, MEDICAL_PATTERNS).length) issues.push("医療・心理診断のような表現が含まれています。");

  return finalizeResult({ issues, warnings });
}

/* ============================================================
 * 5. 生徒カルテ要約の検査
 * ============================================================ */
export function validateStudentSummary(result) {
  if (!result || typeof result !== "object") return emptyResult();
  const sigKeys = [
    "current", "strengths", "issues", "nextFocus", "forGuardian", "teacherOnlyNote", "nextAction",
    "facts", "inferences",
  ];
  if (!sigKeys.some((k) => k in result)) return emptyResult();

  const issues = [];
  const warnings = [];
  const text = collectStrings(result, []).join("\n");

  if (findPatterns(text, PERSONA_PATTERNS).length) issues.push("生徒の人格を否定する表現が含まれています。");
  if (findPatterns(text, MEDICAL_PATTERNS).length) issues.push("医療・心理診断のような表現が含まれています。");
  if (findPatterns(text, FAMILY_PATTERNS).length) warnings.push("家庭事情の推測が含まれている可能性があります。");

  // facts / inferences があるなら、inferences が断定的でないか
  if (Array.isArray(result.inferences)) {
    const infText = result.inferences.map(asString).join("\n");
    if (findPatterns(infText, ASSERT_PATTERNS).length) warnings.push("推測（inferences）が断定的な表現になっています。");
  }
  // 点数の断定（入力との比較はできないため、断定表現との併用時のみ注意）
  if (/\d+\s*点/.test(text) && findPatterns(text, ASSERT_PATTERNS).length) {
    warnings.push("点数に関する断定的な表現が含まれています。確認してください。");
  }

  return finalizeResult({ issues, warnings });
}

/* ============================================================
 * 6. 復習提案の検査（構造）
 * ============================================================ */
export function validateReviewPlan(result) {
  if (!result || typeof result !== "object") return emptyResult();
  const sigKeys = [
    "priority", "tomorrowTasks", "threeDayReview", "weakUnits", "quizCandidates", "teacherNote", "studentMessage",
    "todayReview", "tomorrow", "after3Days", "after7Days",
  ];
  if (!sigKeys.some((k) => k in result)) return emptyResult();

  const issues = [];
  const warnings = [];
  const arr = (v) => (Array.isArray(v) ? v : []);
  const priority = arr(result.priority).length ? arr(result.priority) : arr(result.todayReview);
  const tomorrow = result.tomorrowTasks != null ? arr(result.tomorrowTasks) : arr(result.tomorrow);
  const after3 = result.threeDayReview != null ? arr(result.threeDayReview) : arr(result.after3Days);
  const after7 = arr(result.after7Days);
  const quizCandidates = arr(result.quizCandidates);

  if (!priority.length) issues.push("復習提案に優先度（priority/todayReview）がありません。");
  if (!("tomorrowTasks" in result) && !("tomorrow" in result)) {
    issues.push("復習提案に「明日やること（tomorrowTasks）」がありません。");
  }
  if (!quizCandidates.length) warnings.push("小テスト候補（quizCandidates）がありません。");

  const missingReason = arr(result.priority).some(
    (p) => p && typeof p === "object" && !String(p.reason || "").trim()
  );
  if (missingReason) warnings.push("優先順位に理由（reason）のない項目があります。");

  const total = priority.length + tomorrow.length + after3.length + after7.length;
  if (tomorrow.length > 12 || total > 25) warnings.push("復習量が多すぎる可能性があります。");

  const text = collectStrings(result, []).join("\n");
  if (findPatterns(text, PERSONA_PATTERNS).length) issues.push("生徒を責める/人格を評価する表現が含まれています。");

  return finalizeResult({ issues, warnings });
}

/* ============================================================
 * 7. ディスパッチ & finalCheck への反映
 * ============================================================ */
export function runTaskValidator({ taskType, output, input } = {}) {
  switch (taskType) {
    case LOCAL_AI_TASKS.VOCAB_QUIZ:
      return validateVocabQuiz(output, input);
    case LOCAL_AI_TASKS.PDF_QUESTION_GENERATION:
      return validatePdfQuestions(output, input);
    case LOCAL_AI_TASKS.REPORT_CLEANUP:
      return validateReportCleanup(output, input);
    case LOCAL_AI_TASKS.STUDENT_SUMMARY:
      return validateStudentSummary(output);
    case LOCAL_AI_TASKS.REVIEW_PLAN:
      return validateReviewPlan(output);
    default:
      return emptyResult();
  }
}

const MAJOR_VALIDATOR_PATTERNS = [
  "範囲外", "本文中に見つかり", "本文にない", "入力にない", "人格", "やる気がない", "医療", "心理診断", "診断", "ページ範囲外",
];
function hasMajorValidatorIssue(validator) {
  const text = (validator.issues || []).join("\n");
  return MAJOR_VALIDATOR_PATTERNS.some((p) => text.includes(p));
}
function worseStatus(a, b) {
  return (STATUS_RANK[a] ?? 0) >= (STATUS_RANK[b] ?? 0) ? a : b;
}

/* validator の結果を finalCheck に反映（status は悪い方向にのみ変える）。 */
export function applyValidatorToFinalCheck(finalCheck, validator) {
  const base =
    finalCheck && typeof finalCheck === "object"
      ? finalCheck
      : { score: 0, status: "caution", warnings: [], summary: "" };
  if (!validator) return base;
  const extra = [...(validator.issues || []), ...(validator.warnings || [])];
  const warnings = [...(base.warnings || []), ...extra];
  let status = base.status;
  if (!validator.ok) {
    status = hasMajorValidatorIssue(validator) ? "blocked" : worseStatus(status, "caution");
  } else if ((validator.warnings || []).length) {
    status = worseStatus(status, "caution");
  }
  const score = Math.max(0, (base.score ?? 0) - (validator.scorePenalty || 0));
  let summary = base.summary;
  if (status === "blocked" && base.status !== "blocked") {
    summary = "コード側の検査で重大な問題が見つかりました。確認してください。";
  } else if (status === "caution" && base.status === "usable") {
    summary = "コード側の検査で注意点が見つかりました。確認してください。";
  }
  return { ...base, status, warnings, score, summary };
}
