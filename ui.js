/*
 * CAMBRETH INTELLIGENCE — ui.js
 * Auto-updating glue for the daily synthesis pipeline. Additive only.
 *
 * Behaviour (no buttons — fully automatic):
 *   1. On load: fetch data/raw-industrial.json (cache: no-store) and render the
 *      price table into #price-table immediately.
 *   2. Render the day's headlines (auto-categorised) into #articles right away,
 *      so the page is never empty even before the AI model loads.
 *   3. Then auto-run the synthesis engine once (if WebGPU is available): the
 *      AI reads the daily data, runs 10 iterations, and replaces #articles with
 *      original newspaper-grade content + refreshes #price-table.
 *   4. Cache the last synthesis in IndexedDB so revisits are instant.
 *   5. Re-check the daily data every 30 minutes (auto-refresh).
 *
 * Works with any layout: it targets the exact IDs #price-table and #articles,
 * plus any element carrying data-ai-category="..." (fills that section's content).
 */

(function () {
  "use strict";

  const DATA_URL = "data/raw-industrial.json";
  const DB_NAME = "CriticalSynthesisCache";
  const CACHE_KEY = "lastSynthesis";
  const REFRESH_MS = 30 * 60 * 1000; // 30 min

  let rawData = { prices: [], headlines: [], chemistry: [] };

  /* ---------------- IndexedDB ---------------- */
  const DB_VERSION = 2;
  function openDB() {
    return new Promise((resolve) => {
      if (!("indexedDB" in window)) return resolve(null);
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("cache")) {
            db.createObjectStore("cache");
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }

  async function cacheSynthesis(html) {
    try {
      const db = await openDB();
      if (!db || !db.objectStoreNames.contains("cache")) return;
      const tx = db.transaction("cache", "readwrite");
      tx.objectStore("cache").put({ html, ts: Date.now() }, CACHE_KEY);
    } catch (e) { /* non-fatal */ }
  }

  async function loadCachedSynthesis() {
    try {
      const db = await openDB();
      if (!db || !db.objectStoreNames.contains("cache")) return null;
      return await new Promise((resolve) => {
        try {
          const get = db.transaction("cache").objectStore("cache").get(CACHE_KEY);
          get.onsuccess = () => resolve(get.result || null);
          get.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
      });
    } catch (e) { return null; }
  }

  /* ---------------- Inject theme-matching styles once ---------------- */
  function injectStyles() {
    if (document.getElementById("cambreth-ai-styles")) return;
    const style = document.createElement("style");
    style.id = "cambreth-ai-styles";
    style.textContent = `
      #price-table, #articles, [data-ai-category] {
        font-family: GuardianTextSans, "Guardian Text Sans Web", "Helvetica Neue", Helvetica, Arial, "Lucida Grande", sans-serif;
      }
      .cambreth-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; line-height: 1.35; }
      .cambreth-table th, .cambreth-table td { padding: 9px 10px; border: 1px solid var(--article-border, #DCDCDC); text-align: left; vertical-align: top; }
      .cambreth-table thead th {
        background: var(--masthead-nav-background, #171717); color: #FFFFFF;
        font-family: "GH Guardian Headline", Georgia, serif; font-weight: 700; font-size: 0.95rem;
      }
      .cambreth-table tbody tr:nth-child(even) { background: var(--table-block-stripe, #EDEDED); }
      .cambreth-up { color: var(--football-form-win, #3DB540); font-weight: 700; }
      .cambreth-down { color: var(--article-link-text, #C70000); font-weight: 700; }
      .cambreth-tag {
        display: inline-block; font-family: GuardianTextSans, sans-serif; font-weight: 700;
        font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase;
        color: var(--article-section-title-news, #121212);
        border: 1px solid var(--article-border, #DCDCDC); border-radius: 20px; padding: 2px 9px; margin-right: 6px;
      }
      .cambreth-ai-card { padding: 8px 0; }
      .cambreth-ai-card h3 {
        font-family: "GH Guardian Headline", Georgia, serif; font-weight: 700;
        font-size: 1.25rem; line-height: 1.15; margin: 0 0 6px; color: var(--headline-colour, #121212);
      }
      .cambreth-ai-card p { margin: 0 0 8px; color: var(--article-text, #121212); }
      .cambreth-key { background: var(--callout-highlight-background, #FFE500); color: var(--callout-highlight-text, #121212); padding: 8px 10px; font-weight: 700; }
      .cambreth-byline { color: var(--byline, #C70000); font-weight: 700; }
      .cambreth-progress {
        font-family: GuardianTextSans, sans-serif; font-size: 0.85rem; font-style: italic;
        color: var(--article-text, #121212); border-left: 3px solid #FF4200; padding: 8px 12px; background: rgba(255, 66, 0, 0.06);
      }
    `;
    document.head.appendChild(style);
  }

  /* ---------------- Renderers ---------------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtPrice(p) {
    const v = Number(p.price);
    if (!isFinite(v)) return "GAP";
    return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  function renderPrices(prices) {
    const container = document.getElementById("price-table");
    if (!container || !prices || !prices.length) return;
    const head = ["Mineral / Fuel", "Form", "Unit", "Price", "Daily Δ%", "Chemistry Key Fact", "Economic Note", "Source"];
    let html = `<table class="cambreth-table"><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>`;
    for (const p of prices) {
      const chg = Number(p.change_pct);
      const arrow = chg > 0 ? `<span class="cambreth-up">▲ ${chg.toFixed(2)}</span>`
        : chg < 0 ? `<span class="cambreth-down">▼ ${Math.abs(chg).toFixed(2)}</span>`
        : `<span>—</span>`;
      html += `<tr>
        <td><strong>${esc(p.name)}</strong></td>
        <td>${esc(p.form || "")}</td>
        <td>${esc(p.unit || "")}</td>
        <td><strong>${fmtPrice(p)}</strong></td>
        <td>${arrow}</td>
        <td>${esc(p.chemistry_key_fact || "")}</td>
        <td>${esc(p.economic_note || "")}</td>
        <td>${esc(p.source || "")}</td>
      </tr>`;
    }
    html += `</tbody></table>`;
    if (prices.some(p => p.reliability === "assessed-seed")) {
      html += `<p style="font-size:0.75rem;color:var(--caption-text,#707070);margin-top:6px">
        * Assessed baseline values (source + date tagged per row); refreshed automatically by the Daily Dig each morning.</p>`;
    }
    container.innerHTML = html;
  }

  function renderHeadlines(headlines) {
    const container = document.getElementById("articles");
    if (!container || !headlines || !headlines.length) return;
    const cards = headlines.slice(0, 12).map(h => {
      const cat = esc(h.category || "Markets");
      const title = esc(h.title || "");
      const src = esc(h.source || "");
      const date = esc(h.date || "");
      const url = h.url ? ` href="${esc(h.url)}" target="_blank" rel="noopener"` : "";
      return `<div class="cambreth-ai-card"><h3><a${url} style="color:inherit;text-decoration:none">${title}</a></h3>
        <p><span class="cambreth-tag">${cat}</span><span class="cambreth-byline">${src}</span> · ${date}</p>
        <p>${esc(h.summary || "")}</p></div>`;
    }).join("");
    container.innerHTML = `<h3 style="font-family:GH Guardian Headline,Georgia,serif;font-weight:700;font-size:1.5rem">Daily Industry Brief — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</h3>` + cards;
  }

  function extractStructuredOutput(aiText) {
    let prices = [];
    const jsonMatch = aiText.match(/```json\s*(\[[\s\S]*?\])\s*```/) || aiText.match(/(\[\s*\{[\s\S]*?\}\s*\])/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        prices = Array.isArray(parsed) ? parsed : (parsed.prices || []);
      } catch (e) { /* fall through */ }
    }
    let body = aiText.replace(/```json[\s\S]*?```/i, "");
    const cards = body.split(/(?=^### )/m).map(s => s.trim()).filter(Boolean).map(article => {
      const h = article.match(/^### (.+)$/m);
      const head = h ? h[1] : "Analysis";
      const inner = article.replace(/^### .+$/m, "").trim();
      return `<div class="cambreth-ai-card"><h3>${esc(head)}</h3><p>${inner.replace(/\n/g, "<br>")}</p></div>`;
    }).join("");
    return { prices, articlesHTML: cards || `<div class="cambreth-ai-card"><p>${esc(aiText)}</p></div>` };
  }

  /* ---------------- Data loading ---------------- */
  async function loadDailyData() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      rawData = await res.json();
    } catch (e) {
      console.warn("[ui] no daily data yet — using inline fallback.");
      rawData = { prices: [], headlines: [] };
    }
    renderPrices(rawData.prices || []);
    return rawData;
  }

  /* ---------------- Auto synthesis (no button) ---------------- */
  async function autoRun() {
    const articlesDiv = document.getElementById("articles");
    if (articlesDiv) {
      articlesDiv.insertAdjacentHTML("beforeend",
        `<p class="cambreth-progress">Auto-synthesis: preparing engine (first run downloads the model once, then cached)…</p>`);
    }
    try {
      if (!window.CriticalAI) throw new Error("ai-engine.js not loaded");
      await window.CriticalAI.initAI((report) => {
        const div = document.getElementById("articles");
        if (div && report && typeof report.progress === "number") {
          const marker = div.querySelector(".cambreth-progress");
          if (marker) marker.textContent = `Model loading… ${Math.round(report.progress * 100)}%`;
        }
      });
      const output = await window.CriticalAI.runMercilessSynthesis(rawData);
      const { prices, articlesHTML } = extractStructuredOutput(output);
      if (prices.length) {
        // map AI prices onto the existing table for continuity
        const map = {};
        for (const p of prices) {
          const key = String(p.mineral || p.mineral_name || "").toLowerCase();
          if (key) map[key] = p;
        }
        const merged = (rawData.prices || []).map(base => {
          const ai = map[String(base.name).toLowerCase()];
          if (ai) {
            return Object.assign({}, base, {
              price: ai.usd_per_tonne || base.price,
              change_pct: ai.daily_change_pct != null ? ai.daily_change_pct : base.change_pct,
              chemistry_key_fact: ai.chemistry_key_fact || base.chemistry_key_fact,
              economic_note: ai.economic_note || base.economic_note,
            });
          }
          return base;
        });
        if (merged.length) renderPrices(merged);
      }
      if (articlesDiv) {
        articlesDiv.innerHTML = articlesHTML;
      }
      await cacheSynthesis(articlesDiv ? articlesDiv.innerHTML : "");
      console.log("%c[ui] synthesis cached", "color:#FF4200;font-weight:bold");
    } catch (err) {
      console.warn("[ui] auto-synthesis unavailable — keeping daily brief.", err);
      // Keep the daily headlines visible; show a small note.
      const note = document.createElement("p");
      note.className = "cambreth-progress";
      note.textContent = "Deep synthesis is unavailable in this browser (needs WebGPU). Daily brief is shown instead.";
      if (articlesDiv && !articlesDiv.querySelector(".cambreth-progress")) articlesDiv.appendChild(note);
    }
  }

  /* ---------------- Init ---------------- */
  async function init() {
    injectStyles();
    const cached = await loadCachedSynthesis();
    const articlesDiv = document.getElementById("articles");

    // 1) daily data + prices (always fresh)
    await loadDailyData();

    // 2) if we have a cached synthesis and fresh headlines, show cache instantly
    if (cached && cached.html && articlesDiv) {
      articlesDiv.innerHTML = cached.html;
    } else {
      renderHeadlines(rawData.headlines || []);
    }

    // 3) auto-synthesize (runs in background; replaces #articles when ready)
    autoRun();

    // 4) refresh loop — keeps the page current without any user action
    setInterval(() => {
      loadDailyData().then(() => {
        // if a cached synthesis exists, do a light AI refresh only when engine is warm
        if (window.CriticalAI && navigator.gpu) autoRun();
        else renderHeadlines(rawData.headlines || []);
      });
    }, REFRESH_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
