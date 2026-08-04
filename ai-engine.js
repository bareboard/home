/*
 * CAMBRETH INTELLIGENCE — ai-engine.js
 * Client-side synthesis engine (WebLLM + Phi-3-mini). Additive only.
 *
 * Responsibilities:
 *   - Loads a small open LLM inside the browser (WebGPU) once, then caches it.
 *   - Runs a 10-iteration "merciless" synthesis over the daily raw-industrial.json:
 *     researcher / chemist / economist / original copywriter passes.
 *   - Returns STRICT JSON-first (prices array) followed by original markdown articles.
 *   - Exposes window.CriticalAI = { initAI, runMercilessSynthesis }.
 *
 * Failure handling: if WebGPU is unavailable or the model cannot load, we throw a
 * clear, catchable error and the UI falls back to the RSS/seed content — the site
 * never breaks.
 */

const MODEL_ID = "Phi-3-mini-4k-instruct-q4f16_1-MLC";
const MODEL_URL = "https://huggingface.co/mlc-ai/Phi-3-mini-4k-instruct-q4f16_1-MLC/resolve/main/";
const WEBLLM_URL = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.46/+esm";

const SYSTEM_PROMPT = `You are L-CAPTER FH 166, a merciless domain-specialized intelligence for Critical Minerals, Aggregates, Oil and EV battery metals.

Perform ALL of these roles simultaneously across 10+ reasoning iterations:
- Researcher: cross-reference every raw source for mine output, regulatory filings, supply disruptions, production statistics, commodity flows. Ignore generic/wikipedia junk.
- Chemist: give exact formulas (Li2CO3, Ni0.8Co0.1Mn0.1(OH)2), reaction pathways, purity thresholds (>99.5% battery-grade), extraction chemistry, environmental impact, cathode/anode implications.
- Economist: model current rates, forward curves, supply/demand imbalance, regional cost differentials, investment signals, geopolitical risk premia, long-term value projections.
- Original copywriter: NEVER copy or paraphrase source text. Synthesize fresh, authoritative, newspaper-grade prose. Add unique angles combining chemistry with economics.

RAW INDUSTRIAL DATA:
[INSERT_RAW_DATA_HERE]

STRICT OUTPUT FORMAT:
1) FIRST: a single JSON array named "prices" with objects: {mineral, usd_per_tonne, daily_change_pct, chemistry_key_fact, economic_note}. Wrap it in a markdown \\\`\\\`\\\`json ... \\\`\\\`\\\` code block.
2) THEN: 4-6 original full articles in markdown. Each must have: ### Headline, Byline "By L-CAPTER FH 166", 650-950 word body dense with chemistry + economics + rates, and a **Key Takeaway** box.
Never hallucinate numbers. Cite only transformed synthesis. Minimum 10 iterations.`;

let engine = null;
let engineReady = false;

async function loadWebLLM() {
  if (typeof self !== "undefined" && self.CreateMLCEngine) {
    return self.CreateMLCEngine;
  }
  const mod = await import(/* webpackIgnore: true */ WEBLLM_URL);
  return mod.CreateMLCEngine || self.CreateMLCEngine;
}

async function initAI(progressCallback) {
  if (engineReady) return true;
  if (typeof navigator === "undefined" || !navigator.gpu) {
    throw new Error("WebGPU is not available in this browser. Use desktop Chrome/Edge, or rely on the daily cached content.");
  }
  try {
    const CreateMLCEngine = await loadWebLLM();
    engine = await CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (report) => {
        if (typeof progressCallback === "function") progressCallback(report);
      },
      appConfig: { modelUrl: MODEL_URL },
    });
    engineReady = true;
    console.log("%c[L-CAPTER FH 166] engine ready", "color:#FF4200;font-weight:bold");
    return true;
  } catch (err) {
    console.error("[L-CAPTER FH 166] init failed:", err);
    throw new Error("Model load failed. Check WebGPU support or network.");
  }
}

async function runMercilessSynthesis(rawData) {
  if (!engine) throw new Error("Call initAI() first.");

  const messages = [
    { role: "system", content: SYSTEM_PROMPT.replace("[INSERT_RAW_DATA_HERE]", JSON.stringify(rawData || {})) },
    { role: "user", content: "Execute 10-iteration no-mercy research across all global industrial channels for critical minerals, oil, EV battery metals. Analyze chemistry, economics, latest rates. Output STRICT JSON-first followed by original rewritten articles." },
  ];

  const minerals = ["LithiumCarbonate", "Cobalt", "Nickel", "Graphite"];

  for (let i = 0; i < 10; i++) {
    const reply = await engine.chat.completions.create({
      messages,
      temperature: 0.25,
      max_gen_len: 8192,
      top_p: 0.95,
    });
    const text = (reply.choices && reply.choices[0] && reply.choices[0].message.content || "").trim();
    messages.push({ role: "assistant", content: text });
    const lower = text.toLowerCase();

    // Tool pass: fetch real chemistry facts into the context when relevant
    if (lower.includes("pubchem") || lower.includes("lithium") || lower.includes("chemistry")) {
      for (const m of minerals) {
        try {
          const res = await fetch(
            "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/" + m +
            "/property/MolecularFormula,MolecularWeight,InChI/JSON"
          );
          const body = await res.text();
          messages.push({ role: "tool", content: `PubChem ${m}: ${body.slice(0, 400)}` });
        } catch (e) {
          messages.push({ role: "tool", content: `PubChem fetch for ${m} unavailable` });
        }
      }
    }

    if (lower.includes("usgs") || lower.includes("eia") || lower.includes("rate") || lower.includes("price")) {
      messages.push({
        role: "tool",
        content: "Reference: rawData.prices carry live FRED assessments and researched seed baselines with sources and dates; do not invent values.",
      });
    }
  }

  const finalOutput = messages[messages.length - 1].content;
  console.log("%c[L-CAPTER FH 166] synthesis complete (10 iterations)", "color:#FF4200;font-weight:bold");
  return finalOutput;
}

window.CriticalAI = { initAI, runMercilessSynthesis };
