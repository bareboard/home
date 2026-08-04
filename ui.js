/*
 * CAMBRETH INTELLIGENCE — ui.js  v3
 * Auto-updating glue + newspaper-style router. Additive only.
 *
 * What it does (no buttons):
 *   1. Loads data/raw-industrial.json -> prices, headlines, articles, founder.
 *   2. Renders the price table into #price-table (Markets section).
 *   3. "Acquires" every Guardian content section on the homepage and fills it with
 *      Cambreth industry content (same layout, thin dividers between articles).
 *   4. Renders the Founder's Words section (daily quote by Fahadh Haneef Cambreth).
 *   5. Hash router (#/markets, #/article/lithium-..., #/about, ...) so every
 *      category and article opens its own page on the site — newspaper style,
 *      shareable URLs, back button works. No more 404s.
 *   6. Auto-synthesis: the AI replaces #articles with original deep articles and
 *      every article card opens its full page at #/article/<slug>.
 *   7. IndexedDB cache + 30-min refresh.
 */

(function () {
  "use strict";

  var DATA_URL = "data/raw-industrial.json";
  var DB_NAME = "CriticalSynthesisCache";
  var CACHE_KEY = "lastSynthesis";
  var REFRESH_MS = 30 * 60 * 1000;

  var rawData = { prices: [], headlines: [], articles: [], ai_articles: [], founder: {}, founder_today: {} };
  var aiArticles = {};      // slug -> {headline, body, byline, date} (from AI)
  var currentRoute = "";

  /* ============================ IndexedDB ============================ */
  var DB_VERSION = 3;
  function openDB() {
    return new Promise(function (resolve) {
      if (!("indexedDB" in window)) return resolve(null);
      try {
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function (e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache");
        };
        req.onsuccess = function (e) { resolve(e.target.result); };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }
  function cachePut(key, val) {
    return openDB().then(function (db) {
      if (!db || !db.objectStoreNames.contains("cache")) return;
      try { db.transaction("cache", "readwrite").objectStore("cache").put(val, key); } catch (e) {}
    });
  }
  function cacheGet(key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        if (!db || !db.objectStoreNames.contains("cache")) return resolve(null);
        try {
          var g = db.transaction("cache").objectStore("cache").get(key);
          g.onsuccess = function () { resolve(g.result || null); };
          g.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    });
  }

  /* ============================ Styles ============================ */
  function injectStyles() {
    if (document.getElementById("cambreth-ai-styles")) return;
    var css = [
      "#price-table,#articles,[data-ai-category]{font-family:GuardianTextSans,\"Guardian Text Sans Web\",\"Helvetica Neue\",Helvetica,Arial,\"Lucida Grande\",sans-serif}",
      ".cambreth-table{width:100%;border-collapse:collapse;font-size:.875rem;line-height:1.35}",
      ".cambreth-table th,.cambreth-table td{padding:9px 10px;border:1px solid var(--article-border,#DCDCDC);text-align:left;vertical-align:top}",
      ".cambreth-table thead th{background:var(--masthead-nav-background,#171717);color:#fff;font-family:\"GH Guardian Headline\",Georgia,serif;font-weight:700;font-size:.95rem}",
      ".cambreth-table tbody tr:nth-child(even){background:var(--table-block-stripe,#EDEDED)}",
      ".cambreth-up{color:var(--football-form-win,#3DB540);font-weight:700}.cambreth-down{color:var(--article-link-text,#C70000);font-weight:700}",
      ".cambreth-tag{display:inline-block;font-weight:700;font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;color:var(--article-section-title-news,#121212);border:1px solid var(--article-border,#DCDCDC);border-radius:20px;padding:2px 9px;margin-right:6px}",
      /* feed cards + thin dividers between articles */
      ".cambreth-feed{list-style:none;margin:0;padding:0}",
      ".cambreth-item{position:relative;padding:16px 8px;border-top:1px solid var(--article-border,#DCDCDC)}",
      ".cambreth-item:first-child{border-top:0}",
      ".cambreth-item a.cambreth-headline{display:block;font-family:\"GH Guardian Headline\",Georgia,serif;font-weight:700;font-size:1.25rem;line-height:1.15;color:var(--headline-colour,#121212);text-decoration:none;margin:4px 0 6px}",
      ".cambreth-item a.cambreth-headline:hover{color:var(--article-link-text,#C70000)}",
      ".cambreth-item .cambreth-kicker{font-weight:700;color:var(--kicker-text-live,#F6F6F6);background:var(--card-kicker-text,#C70000);display:inline-block;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;padding:2px 7px}",
      ".cambreth-item .cambreth-summary{font-family:GuardianTextEgyptian,Georgia,serif;font-size:.9375rem;line-height:1.4;color:var(--card-trail-text,#707070);margin:0 0 6px}",
      ".cambreth-item .cambreth-meta{font-size:.75rem;color:var(--card-footer-text,#707070)}",
      ".cambreth-item .cambreth-img{position:relative;margin:0 0 8px;width:100%;max-width:420px}",
      ".cambreth-item .cambreth-img img{display:block;width:100%;height:auto}",
      ".cambreth-item .cambreth-img .credit{position:absolute;left:0;bottom:0;background:rgba(0,0,0,.6);color:#fff;font-size:.62rem;padding:2px 6px}",
      /* article page */
      ".cambreth-article{max-width:760px;margin:0 auto;padding:20px 10px 40px}",
      ".cambreth-article .cambreth-kicker{font-weight:700;color:var(--article-link-text,#C70000);font-size:.78rem;letter-spacing:.08em;text-transform:uppercase}",
      ".cambreth-article h1{font-family:\"GH Guardian Headline\",Georgia,serif;font-weight:700;font-size:2rem;line-height:1.1;margin:8px 0}",
      ".cambreth-article .standfirst{font-family:GuardianTextEgyptian,Georgia,serif;font-size:1.1rem;line-height:1.4;color:var(--article-text,#121212);font-weight:700;margin:0 0 14px}",
      ".cambreth-article .byline{color:var(--byline,#C70000);font-weight:700;font-size:.9rem;margin:0 0 4px}",
      ".cambreth-article .dateline{color:var(--dateline,#545454);font-size:.8rem;margin:0 0 16px}",
      ".cambreth-article .heroimg{margin:0 0 8px;width:100%}",
      ".cambreth-article .heroimg img{display:block;width:100%;height:auto}",
      ".cambreth-article .imgcredit{color:var(--caption-text,#707070);font-size:.72rem;margin:0 0 18px}",
      ".cambreth-article .body p{font-family:GuardianTextEgyptian,Georgia,serif;font-size:1.0625rem;line-height:1.55;color:var(--article-text,#121212);margin:0 0 16px}",
      ".cambreth-article .body b{font-weight:700}",
      ".cambreth-key{background:var(--callout-highlight-background,#FFE500);color:var(--callout-highlight-text,#121212);padding:10px 12px;font-weight:700;font-size:.95rem;margin:18px 0}",
      ".cambreth-related{margin-top:22px;padding-top:14px;border-top:1px solid var(--article-border,#DCDCDC)}",
      ".cambreth-related h4{font-family:\"GH Guardian Headline\",Georgia,serif;font-weight:700;margin:0 0 8px}",
      ".cambreth-related a{color:var(--article-link-text,#C70000);font-weight:700;display:block;margin:4px 0}",
      /* category page */
      ".cambreth-cat{max-width:980px;margin:0 auto;padding:20px 10px 40px}",
      ".cambreth-cat .cathead{border-top:2px solid #FF4200;padding-top:8px;margin-bottom:16px}",
      ".cambreth-cat .cathead .kicker{font-weight:700;color:#FF4200;font-size:.75rem;letter-spacing:.08em;text-transform:uppercase}",
      ".cambreth-cat .cathead h1{font-family:\"GH Guardian Headline\",Georgia,serif;font-weight:700;font-size:2.2rem;margin:2px 0 0}",
      ".cambreth-cat .catgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px}",
      /* founder */
      ".cambreth-founder{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap}",
      ".cambreth-founder .avatar{width:96px;height:96px;border-radius:50%;overflow:hidden;background:var(--masthead-nav-background,#171717);color:#fff;display:flex;align-items:center;justify-content:center;font-family:\"GH Guardian Headline\",Georgia,serif;font-weight:700;font-size:1.6rem;flex:0 0 auto}",
      ".cambreth-founder .avatar img{width:100%;height:100%;object-fit:cover;display:block}",
      ".cambreth-founder .fname{font-family:\"GH Guardian Headline\",Georgia,serif;font-weight:700;font-size:1.4rem;margin:0 0 2px}",
      ".cambreth-founder .frole{color:var(--caption-text,#707070);font-size:.8rem;margin:0 0 10px}",
      ".cambreth-founder .fquote{font-family:GuardianTextEgyptian,Georgia,serif;font-size:1.25rem;line-height:1.45;font-weight:700;margin:0}",
      ".cambreth-founder .fsign{font-weight:700;color:var(--byline,#C70000);margin:10px 0 0}",
      ".cambreth-progress{font-size:.85rem;font-style:italic;color:var(--article-text,#121212);border-left:3px solid #FF4200;padding:8px 12px;background:rgba(255,66,0,.06)}",
      ".cambreth-spark{width:100%;max-width:420px;background:var(--card-media-background,#F6F6F6);display:block}"
    ].join("\n");
    var st = document.createElement("style");
    st.id = "cambreth-ai-styles";
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ============================ utils ============================ */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fmtPrice(p) {
    var v = Number(p.price);
    if (!isFinite(v)) return "GAP";
    return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  function slugify(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  }
  function todayStr() {
    return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }
  function dayIndex() {
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 864e5);
  }
  function sparkline(price, low, high, label) {
    var w = 420, h = 90, pad = 8;
    var v = Number(price) || 0;
    var lo = Number(low) || v * 0.85, hi = Number(high) || v * 1.15;
    if (hi === lo) hi = lo + 1;
    var x = function (i) { return pad + i * ((w - 2 * pad) / 7); };
    var y = function (val) { return h - pad - ((val - lo) / (hi - lo)) * (h - 2 * pad); };
    var pts = [];
    for (var i = 0; i < 8; i++) { pts.push(x(i) + "," + y(lo + (hi - lo) * Math.abs(Math.sin(i * 1.3)) * 0.5 + v * 0.08)); }
    var up = v >= (Number(price) || v);
    var color = "#C70000";
    return '<svg class="cambreth-spark" viewBox="0 0 ' + w + " " + h +
      '" role="img" aria-label="' + esc(label) + ' price trend">' +
      '<rect width="' + w + '" height="' + h + '" fill="#F6F6F6"/>' +
      '<polyline points="' + pts.join(" ") + '" fill="none" stroke="' + color +
      '" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<text x="' + pad + '" y="' + (h - 6) + '" font-size="11" fill="#707070">' +
      esc(label) + " · " + fmtPrice({ price: v }) + "</text></svg>";
  }

  /* ============================ price table ============================ */
  function renderPrices(prices) {
    var container = document.getElementById("price-table");
    if (!container || !prices || !prices.length) return;
    var head = ["Mineral / Fuel", "Form", "Unit", "Price", "Daily Δ%", "Chemistry Key Fact", "Economic Note", "Source"];
    var html = '<table class="cambreth-table"><thead><tr>' + head.map(function (h) { return "<th>" + h + "</th>"; }).join("") + "</tr></thead><tbody>";
    for (var i = 0; i < prices.length; i++) {
      var p = prices[i];
      var chg = Number(p.change_pct);
      var arrow = chg > 0 ? '<span class="cambreth-up">▲ ' + chg.toFixed(2) + "</span>"
        : chg < 0 ? '<span class="cambreth-down">▼ ' + Math.abs(chg).toFixed(2) + "</span>"
        : "<span>—</span>";
      html += "<tr><td><strong>" + esc(p.name) + "</strong></td><td>" + esc(p.form || "") +
        "</td><td>" + esc(p.unit || "") + "</td><td><strong>" + fmtPrice(p) + "</strong></td><td>" + arrow +
        "</td><td>" + esc(p.chemistry_key_fact || "") + "</td><td>" + esc(p.economic_note || "") +
        "</td><td>" + esc(p.source || "") + "</td></tr>";
    }
    html += "</tbody></table>";
    if (prices.some(function (p) { return p.reliability === "assessed-seed"; })) {
      html += '<p style="font-size:.75rem;color:var(--caption-text,#707070);margin-top:6px">* Assessed baseline values, source + date tagged per row. Refreshed automatically each morning by the Daily Dig.</p>';
    }
    container.innerHTML = html;
  }

  /* ============================ article helpers ============================ */
  function cardHTML(a, opts) {
    opts = opts || {};
    var external = !a.body && a.url;
    var url = external ? esc(a.url) : "#/article/" + esc(a.slug);
    var img = "";
    if (a.image) {
      img = '<div class="cambreth-img"><img src="' + esc(a.image) + '" alt="' + esc(a.headline) +
        '" loading="lazy"/><span class="credit">' + esc(a.image_credit || "Source") + "</span></div>";
    } else if (!opts.noSpark) {
      img = sparkline(a.price, a.low, a.high, a.name || a.kicker || a.headline);
    }
    return '<li class="cambreth-item"><span class="cambreth-kicker">' + esc(a.kicker || a.category || "Analysis") +
      "</span><a class=\"cambreth-headline\" href=\"" + url + '"' + (external ? ' target="_blank" rel="noopener"' : "") + '>' + esc(a.headline) + "</a>" +
      '<p class="cambreth-summary">' + esc(a.summary || "") + "</p>" + img +
      '<p class="cambreth-meta">' + esc(a.byline || "Cambreth Intelligence") + " · " + esc(a.date || todayStr()) + "</p></li>";
  }

  function pickArticles(cat, n) {
    var pool = (rawData.ai_articles || []).concat(rawData.articles || []);
    var arts = pool.filter(function (a) {
      return !cat || a.category === cat || a.kicker === cat;
    });
    if (arts.length < n) {
      var news = (rawData.headlines || []).filter(function (h) { return !cat || h.category === cat; });
      for (var i = 0; i < news.length && arts.length < n; i++) {
        var h = news[i];
        arts.push({ slug: slugify(h.title), headline: h.title, summary: h.summary || "", kicker: h.category || cat || "Markets", category: h.category, byline: h.source || "Industry wire", date: (h.date || "").slice(0, 10), image: h.image || "", image_credit: h.source, url: h.url });
      }
    }
    return arts.slice(0, n || 6);
  }

  /* ============================ section acquisition ============================ */
  var SECTION_MAP = {
    "news": { title: "Markets", kicker: "Top stories", cat: "Markets" },
    "special-report": { title: "Supply chain report", kicker: "Special report", cat: "Supply chain" },
    "in-focus": { title: "Policy in focus", kicker: "In focus", cat: "Policy" },
    "features": { title: "Analysis", kicker: "Features", cat: "Intelligence" },
    "more-features": { title: "Offtake & deal flow", kicker: "Deal flow", cat: "Supply chain" },
    "opinion": { title: "Founder's Words", kicker: "Founder", cat: "__founder__" },
    "more-opinion": { title: "Founder's Words · Archive", kicker: "Archive", cat: "__founder__" },
    "editorials": { title: "Policy watch", kicker: "Editorials", cat: "Policy" },
    "cartoon": { title: "Charts & data", kicker: "Visual", cat: "Intelligence" },
    "sport": { title: "Oil & gas", kicker: "Energy", cat: "Markets" },
    "more-top-stories": { title: "Daily industry brief", kicker: "Briefing", cat: "__rss__" },
    "climate-crisis-&-environment": { title: "Energy transition", kicker: "Climate & energy", cat: "Demand" },
    "uk-news": { title: "Construction materials", kicker: "Regional", cat: "Supply chain" },
    "world-news": { title: "Global supply", kicker: "World", cat: "Supply chain" },
    "culture": { title: "Company intelligence", kicker: "Companies", cat: "Supply chain" },
    "what-to-watch": { title: "Market briefings", kicker: "Watch", cat: "Intelligence" },
    "what-to-listen-to": { title: "Podcasts & briefings", kicker: "Listen", cat: "Intelligence" },
    "what-to-read": { title: "Reports & research", kicker: "Read", cat: "Intelligence" },
    "what-to-play": { title: "Data tools", kicker: "Tools", cat: "Intelligence" },
    "more-culture": { title: "Markets & pricing", kicker: "Markets", cat: "Markets" },
    "lifestyle": { title: "Demand & technology", kicker: "Demand", cat: "Demand" },
    "food": { title: "Energy inputs", kicker: "Energy", cat: "Demand" },
    "fashion-&-beauty": { title: "Minerals in industry", kicker: "Industry", cat: "Markets" },
    "relationships": { title: "Policy & trade", kicker: "Trade", cat: "Policy" },
    "health-&-fitness": { title: "Critical minerals health", kicker: "Health", cat: "Intelligence" },
    "more-lifestyle": { title: "More demand", kicker: "More", cat: "Demand" },
    "you-may-have-missed": { title: "You may have missed", kicker: "Catch up", cat: "Markets" },
    "take-part": { title: "Submit intelligence", kicker: "Contribute", cat: "Intelligence" },
    "in-pictures": { title: "Charts & data", kicker: "Visual", cat: "Intelligence" },
    "most-viewed": { title: "Most tracked", kicker: "Most viewed", cat: "Markets" }
  };

  function acquireSections() {
    var main = document.querySelector("main");
    if (!main) return;
    var sections = main.querySelectorAll("section[id]");
    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      var id = sec.getAttribute("id");
      if (id === "markets") { renderPrices(rawData.prices || []); continue; }
      var map = SECTION_MAP[id];
      if (!map) continue;
      var h2 = sec.querySelector("h2");
      if (h2) h2.textContent = map.title;
      if (id === "opinion") { renderFounder(sec); continue; }
      if (id === "more-opinion") { renderFounderArchive(sec); continue; }
      if (map.cat === "__rss__") {
        var c2 = sec.querySelector('div[id^="container-"]');
        var u2 = c2 ? c2.querySelector("ul") : null;
        if (!u2) { if (!c2) continue; u2 = document.createElement("ul"); c2.appendChild(u2); }
        u2.className = "cambreth-feed";
        u2.removeAttribute("data-testid");
        u2.innerHTML = (rawData.headlines || []).slice(0, 8).map(function (h) {
          return '<li class="cambreth-item"><span class="cambreth-kicker">' + esc(h.category || "Markets") + "</span>" +
            (h.url ? '<a class="cambreth-headline" href="' + esc(h.url) + '" target="_blank" rel="noopener">' : '<a class="cambreth-headline" href="#/">') + esc(h.title) + "</a>" +
            '<p class="cambreth-meta">' + esc(h.source || "") + " · " + esc(h.date || "") + "</p></li>";
        }).join("");
        continue;
      }
      // find the cards container: use the section's container div; inject our feed in it
      var container = sec.querySelector('div[id^="container-"]');
      var ul = container ? container.querySelector("ul") : null;
      if (!ul) {
        if (!container) continue;
        ul = document.createElement("ul");
        container.appendChild(ul);
      }
      var arts = pickArticles(map.cat, 6);
      ul.className = "cambreth-feed";
      ul.removeAttribute("data-testid");
      ul.innerHTML = arts.map(function (a) { return cardHTML(a); }).join("");
    }
  }

  function renderFounder(sec) {
    var f = rawData.founder || {};
    var ft = rawData.founder_today || {};
    var quote = ft.quote || ((f.quotes && f.quotes.length) ? f.quotes[dayIndex() % f.quotes.length] : "");
    var photo = (ft.photo || f.photo) ? '<img src="' + esc(ft.photo || f.photo) + '" alt="' + esc(ft.name || f.name) + '"/>' : "FHC";
    var inner = sec.querySelector('div[id^="container-"]') || sec;
    var html = '<div class="cambreth-founder">' +
      '<div class="avatar">' + photo + "</div>" +
      "<div><p class=\"fname\">" + esc(ft.name || f.name || "Fahadh Haneef Cambreth") + "</p>" +
      '<p class="frole">' + esc(ft.role || f.role || "Founder, The Cambreth Organization") + "</p>" +
      '<blockquote class="fquote">"' + esc(quote) + '"</blockquote>' +
      '<p class="fsign">' + esc(ft.signoff || f.signoff || "— Fahadh Haneef Cambreth") + "</p>" +
      '<p class="cambreth-meta" style="margin-top:8px">A word from the Founder · new each day</p></div></div>';
    inner.innerHTML = html;
  }

  function renderFounderArchive(sec) {
    var f = rawData.founder || {};
    var qs = f.quotes || [];
    var inner = sec.querySelector('div[id^="container-"]') || sec;
    inner.innerHTML = qs.map(function (q, i) {
      return '<li class="cambreth-item" style="list-style:none"><blockquote class="fquote" style="font-family:GuardianTextEgyptian,Georgia,serif;font-size:1.1rem;font-weight:700;margin:0">"' + esc(q) + '"</blockquote><p class="cambreth-meta">' + esc(f.name || "Fahadh Haneef Cambreth") + " · Day " + (i + 1) + "</p></li>";
    }).join("");
  }

  /* ============================ category + article pages ============================ */
  function setMain(html) {
    var main = document.querySelector("main");
    if (!main) return;
    main.innerHTML = '<div class="cambreth-cat">' + html + "</div>";
    window.scrollTo(0, 0);
  }

  function renderCategoryPage(parts) {
    var cat = parts[0] || "markets";
    var sub = parts[1] || "";
    var cats = ["markets", "supply-chain", "policy", "demand", "intelligence"];
    var pretty = { "markets": "Markets", "supply-chain": "Supply chain", "policy": "Policy", "demand": "Demand", "intelligence": "Intelligence" };
    var title = pretty[cat] || "Cambreth Intelligence";
    var arts = (rawData.articles || []).filter(function (a) {
      if (!sub) return a.category.toLowerCase() === title.toLowerCase();
      return a.kicker.toLowerCase() === sub.replace(/-/g, " ").toLowerCase();
    });
    var html = '<div class="cathead"><span class="kicker">Cambreth Intelligence · ' + esc(title) + "</span><h1>" + esc(sub ? title + " · " + sub.replace(/-/g, " ") : title) + "</h1></div>";
    if (cat === "markets") {
      var prices = rawData.prices || [];
      var tbl = '<div id="price-table" style="overflow-x:auto"><p class="cambreth-progress">Loading…</p></div>';
      html += "<div style=\"margin-bottom:22px\">" + tbl + "</div>";
    }
    var cards = arts.length ? arts.map(function (a) { return cardHTML(a); }).join("") : "<p>Content updates daily.</p>";
    html += '<ul class="cambreth-feed">' + cards + "</ul>";
    if (!arts.length && cats.indexOf(cat) !== -1) {
      // fall back to RSS headlines for the category
      var news = (rawData.headlines || []).filter(function (h) { return (h.category || "").toLowerCase() === title.toLowerCase(); });
      html = '<div class="cathead"><span class="kicker">Cambreth Intelligence · ' + esc(title) + "</span><h1>" + esc(title) + "</h1></div>" +
        '<ul class="cambreth-feed">' + news.map(function (h) {
          return '<li class="cambreth-item"><span class="cambreth-kicker">' + esc(h.category || "Markets") + "</span>" +
            (h.url ? '<a class="cambreth-headline" href="' + esc(h.url) + '" target="_blank" rel="noopener">' : '<a class="cambreth-headline" href="#/">') + esc(h.title) + "</a>" +
            '<p class="cambreth-meta">' + esc(h.source) + " · " + esc(h.date || "") + "</p></li>";
        }).join("") + "</ul>";
    }
    setMain(html);
    if (cat === "markets") renderPrices(rawData.prices || []);
  }

  function renderArticlePage(slug) {
    var arts = (rawData.articles || []).concat(rawData.ai_articles || []).concat(Object.keys(aiArticles).map(function (k) {
      return Object.assign({ slug: k }, aiArticles[k]);
    }));
    var a = null;
    for (var i = 0; i < arts.length; i++) if (arts[i].slug === slug) { a = arts[i]; break; }
    if (!a) { setMain("<p>Article not found.</p><p><a href=\"#/\">← Back to homepage</a></p>"); return; }
    var body = (a.body || a.content || "").split("\n").filter(Boolean).map(function (p) {
      if (p.indexOf("**Key Takeaway:**") === 0 || p.indexOf("Key Takeaway:") === 0) {
        return '<div class="cambreth-key">' + esc(p.replace("**Key Takeaway:**", "Key Takeaway: ")) + "</div>";
      }
      return "<p>" + esc(p) + "</p>";
    }).join("");
    var hero = "";
    if (a.image) {
      hero = '<figure class="heroimg"><img src="' + esc(a.image) + '" alt="' + esc(a.headline) + '"/></figure>' +
        '<p class="imgcredit">' + esc(a.image_credit || "Source") + "</p>";
    } else if (a.price != null) {
      hero = sparkline(a.price, a.low, a.high, a.name || a.kicker);
    }
    var related = (a.related_categories || []).map(function (c) {
      var rel = pickArticles(c, 1)[0];
      return rel && rel.slug !== a.slug ? '<a href="#/article/' + esc(rel.slug) + '">' + esc(rel.headline) + "</a>" : "";
    }).filter(Boolean).join("");
    var html = '<div class="cambreth-article"><span class="cambreth-kicker">' + esc(a.kicker || a.category || "Analysis") +
      '</span><h1>' + esc(a.headline) + "</h1>" +
      '<p class="standfirst">' + esc(a.summary || "") + "</p>" +
      '<p class="byline">By ' + esc(a.byline || "Cambreth Intelligence") + "</p>" +
      '<p class="dateline">' + esc(a.date || todayStr()) + " · " + esc(a.category || "") + "</p>" +
      hero + '<div class="body">' + body + "</div>" +
      (related ? '<div class="cambreth-related"><h4>Related</h4>' + related + "</div>" : "") +
      '<p style="margin-top:24px"><a href="#/">← Back to homepage</a></p></div>';
    setMain(html);
  }

  var SIMPLE_PAGES = {
    "about": { title: "About", body: "" },
    "client-access": { title: "Client Access", body: "Institutional access to the full Cambreth Intelligence platform — pricing analytics, offtake deal flow, policy trackers and project pipelines — is available to qualified counterparties. Contact our client desk to arrange access." },
    "data-licensing": { title: "Data Licensing", body: "Our daily price assessments, supply-chain datasets and regulatory trackers are available under enterprise licensing. Source attribution and assessment dates are preserved in all licensed outputs." },
    "careers": { title: "Careers", body: "We are building a team of analysts, commodity specialists and engineers across critical minerals, energy transition and construction materials. Expressions of interest are welcome." },
    "contact": { title: "Contact", body: "Reach the Cambreth Intelligence desk for research requests, media enquiries and commercial partnerships." },
    "help": { title: "Help Centre", body: "Guidance on using the platform, interpreting price assessments and navigating the daily brief." },
    "privacy": { title: "Privacy Policy", body: "The Cambreth Organization handles personal data in accordance with applicable law. This static platform sets no trackers and stores no personal information." },
    "terms": { title: "Terms & Conditions", body: "Content is provided for professional information purposes and does not constitute investment advice. Source attribution is maintained on all data." },
    "signin": { title: "Client Sign-in", body: "Client sign-in is provisioned by the Cambreth client desk. If you hold an account, access is granted through your institutional credentials." },
    "enterprise-access": { title: "Enterprise Access", body: "Enterprise subscriptions provide full platform access, daily data delivery and analyst support." }
  };

  function renderSimplePage(slug) {
    var p = SIMPLE_PAGES[slug] || { title: slug, body: "This page is under preparation." };
    setMain('<div class="cathead"><span class="kicker">Cambreth Intelligence</span><h1>' + esc(p.title) + "</h1></div>" +
      '<div class="body"><p>' + esc(p.body) + "</p></div><p><a href=\"#/\">← Back to homepage</a></p>");
  }

  /* ============================ About page ============================ */
  function renderAboutPage() {
    var a = rawData.about || {};
    var site = a.site_name || "Bareboard";
    var tag = a.tagline || "";
    var sections = a.sections || [];
    var html = '<div class="cambreth-cat cambreth-about">' +
      '<div class="cathead"><span class="kicker">About · ' + esc(site) + '</span><h1>About The Cambreth Organization</h1></div>' +
      (tag ? '<p class="standfirst" style="max-width:720px;margin:0 0 26px">' + esc(tag) + '</p>' : '');
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      html += '<section class="about-sec" style="margin:0 0 30px;padding:0 0 22px;border-bottom:1px solid var(--article-border,#DCDCDC)">' +
        '<span class="cambreth-kicker" style="background:transparent;color:#FF4200;border:1px solid #FF4200;border-radius:20px;padding:2px 9px;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;font-weight:700;display:inline-block;margin-bottom:8px">' + esc(s.kicker || "") + '</span>' +
        '<h2 style="font-family:GH Guardian Headline,Georgia,serif;font-weight:700;font-size:1.7rem;line-height:1.15;margin:4px 0 10px;color:var(--headline-colour,#121212)">' + esc(s.title || "") + '</h2>';
      (s.body || []).forEach(function (p) {
        html += '<p style="font-family:GuardianTextEgyptian,Georgia,serif;font-size:1.0625rem;line-height:1.55;color:var(--article-text,#121212);margin:0 0 14px;max-width:760px">' + esc(p) + '</p>';
      });
      if (s.links && s.links.length) {
        html += '<p style="margin:6px 0 0">' + s.links.map(function (l) {
          return '<a class="cambreth-related-a" href="' + esc(l.url) + '" style="font-weight:700;color:var(--article-link-text,#C70000);margin-right:16px">' + esc(l.label) + '</a>';
        }).join("") + '</p>';
      }
      html += '</section>';
    }
    html += '<p><a href="#/">← Back to homepage</a></p></div>';
    setMain(html);
  }

  /* ============================ Search ============================ */
  function renderSearchPage(q) {
    var html = '<div class="cambreth-cat cambreth-search">' +
      '<div class="cathead"><span class="kicker">Cambreth Intelligence · Search</span><h1>Search</h1></div>' +
      '<input id="cambreth-q" class="cambreth-search-input" type="search" placeholder="Search articles, minerals, prices, policy…" value="' + esc(q || "") + '" style="width:100%;max-width:560px;padding:12px 14px;font-size:1rem;font-family:GuardianTextSans,sans-serif;border:1px solid var(--article-border,#DCDCDC);border-radius:4px;margin-bottom:18px;color:var(--article-text,#121212);background:var(--article-background,#fff)" />' +
      '<div id="cambreth-results" class="cambreth-feed"></div></div>';
    setMain(html);
    var input = document.getElementById("cambreth-q");
    if (input) {
      input.focus();
      input.addEventListener("input", function () {
        if (history.replaceState) history.replaceState(null, "", "#/search?q=" + encodeURIComponent(input.value));
        updateSearchResults(input.value);
      });
    }
    updateSearchResults(q || "");
  }

  function searchIndex() {
    var items = [];
    var pool = (rawData.ai_articles || []).concat(rawData.articles || []);
    pool.forEach(function (a) { items.push({ a: a }); });
    (rawData.headlines || []).forEach(function (h) {
      items.push({ a: { slug: slugify(h.title), headline: h.title, summary: h.summary || "", kicker: h.category || "Markets", byline: h.source || "", date: (h.date || "").slice(0, 10), url: h.url, body: "" } });
    });
    (rawData.prices || []).forEach(function (p) {
      items.push({ a: { slug: "", headline: p.name + " — " + fmtPrice(p) + " " + (p.unit || ""), summary: p.economic_note || p.chemistry_key_fact || "", kicker: p.form || "Price", byline: p.source || "", date: p.assessment_date || "", body: p.chemistry_key_fact || "" } });
    });
    return items;
  }

  function updateSearchResults(q) {
    var box = document.getElementById("cambreth-results");
    if (!box) return;
    q = (q || "").toLowerCase().trim();
    if (!q) { box.innerHTML = '<p class="cambreth-progress">Type to search articles, minerals and prices across the platform.</p>'; return; }
    var items = searchIndex().filter(function (it) {
      var a = it.a;
      var hay = ((a.headline || "") + " " + (a.summary || "") + " " + (a.body || "") + " " + (a.kicker || "") + " " + (a.name || "") + " " + (a.form || "") + " " + (a.category || "")).toLowerCase();
      return hay.indexOf(q) !== -1;
    }).slice(0, 14);
    if (!items.length) { box.innerHTML = '<p>No results for "' + esc(q) + '".</p>'; return; }
    box.innerHTML = items.map(function (it) { return cardHTML(it.a); }).join("");
  }

  /* ============================ router ============================ */
  function route() {
    var raw = location.hash || "#/";
    var qm = raw.split("?")[1] || "";
    var path = raw.replace(/^#\//, "").split("?")[0];
    var parts = path.split("/").filter(Boolean);
    var key = parts.join("/");
    if (key === currentRoute && document.querySelector("main .cambreth-cat")) return;
    currentRoute = key;
    if (!parts.length) { currentRoute = ""; return; }   // home is already rendered in place
    if (parts[0] === "article") { renderArticlePage(parts[1]); return; }
    if (parts[0] === "founders-words") { renderFounderArchivePage(); return; }
    if (parts[0] === "about") { renderAboutPage(); return; }
    if (parts[0] === "search") {
      var q = "";
      try { q = decodeURIComponent((qm.match(/q=([^&]*)/) || [])[1] || ""); } catch (e) {}
      renderSearchPage(q); return;
    }
    var cat = ["markets", "supply-chain", "policy", "demand", "intelligence"].indexOf(parts[0]) !== -1;
    if (cat) { renderCategoryPage(parts); return; }
    if (SIMPLE_PAGES[parts[0]]) { renderSimplePage(parts[0]); return; }
    setMain("<p>Page not found.</p><p><a href=\"#/\">← Back to homepage</a></p>");
  }

  function renderFounderArchivePage() {
    var f = rawData.founder || {};
    var qs = f.quotes || [];
    var html = '<div class="cathead"><span class="kicker">Cambreth Intelligence · Founder</span><h1>Founder\'s Words</h1></div>' +
      '<ul class="cambreth-feed">' + qs.map(function (q) {
        return '<li class="cambreth-item" style="list-style:none"><blockquote style="font-family:GuardianTextEgyptian,Georgia,serif;font-size:1.15rem;line-height:1.45;font-weight:700;margin:0">"' + esc(q) + '"</blockquote></li>';
      }).join("") + "</ul><p><a href=\"#/\">← Back to homepage</a></p>";
    setMain(html);
  }

  function interceptClicks() {
    document.addEventListener("submit", function (e) {
      var inp = e.target && e.target.querySelector ? e.target.querySelector("#gu-search-desktop") : null;
      if (inp) {
        e.preventDefault();
        location.hash = "#/search?q=" + encodeURIComponent(inp.value);
      }
    });
    document.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("a") : null;
      if (!a) return;
      var href = a.getAttribute("href") || "";
      if (href.indexOf("http") === 0) return; // external stays external
      if (href.indexOf("#") === 0) return;    // hash links handled by router
      if (href.charAt(0) === "/") {           // internal site link -> hash route (kills 404s)
        e.preventDefault();
        location.hash = "#" + href;
      }
    });
  }

  /* ============================ headlines / AI ============================ */
  function renderBrief(headlines) {
    var container = document.getElementById("articles");
    if (!container) return;
    var cards = (headlines || []).slice(0, 12).map(function (h) {
      var img = h.image ? '<div class="cambreth-img"><img src="' + esc(h.image) + '" alt="' + esc(h.title) + '" loading="lazy"/><span class="credit">' + esc(h.source || "Source") + "</span></div>" : "";
      return '<li class="cambreth-item"><span class="cambreth-kicker">' + esc(h.category || "Markets") + "</span>" +
        (h.url ? '<a class="cambreth-headline" href="' + esc(h.url) + '" target="_blank" rel="noopener">' : '<a class="cambreth-headline" href="#/">') + esc(h.title) + "</a>" +
        '<p class="cambreth-meta">' + esc(h.source || "") + " · " + esc(h.date || "") + "</p>" + img + "</li>";
    }).join("");
    container.className = "cambreth-feed";
    container.innerHTML = cards || "<p>Content updates daily.</p>";
  }

  function extractStructuredOutput(aiText) {
    var prices = [];
    var m = aiText.match(/```json\s*(\[[\s\S]*?\])\s*```/) || aiText.match(/(\[\s*\{[\s\S]*?\}\s*\])/);
    if (m) { try { var p = JSON.parse(m[1].trim()); prices = Array.isArray(p) ? p : (p.prices || []); } catch (e) {} }
    var body = aiText.replace(/```json[\s\S]*?```/i, "");
    var blocks = body.split(/(?=^### )/m).map(function (s) { return s.trim(); }).filter(Boolean);
    aiArticles = {};
    var cards = [];
    for (var i = 0; i < blocks.length; i++) {
      var h = blocks[i].match(/^### (.+)$/m);
      if (!h) continue;
      var slug = slugify(h[1]) || ("ai-" + i);
      aiArticles[slug] = {
        headline: h[1], byline: "Cambreth Intelligence", date: todayStr(),
        category: "Analysis", kicker: "Deep analysis",
        summary: (blocks[i].split("\n")[1] || "").replace(/\*\*/g, "").slice(0, 160),
        body: blocks[i].replace(/^### .+$/m, "").trim()
      };
      cards.push(cardHTML(aiArticles[slug]));
    }
    return { prices: prices, cards: cards.join("") };
  }

  function autoRun() {
    var articlesDiv = document.getElementById("articles");
    var note = document.createElement("p");
    note.className = "cambreth-progress";
    note.textContent = "Preparing deep synthesis engine (first run downloads the model once)…";
    if (articlesDiv) articlesDiv.appendChild(note);
    return Promise.resolve().then(function () {
      if (!window.CriticalAI) throw new Error("ai-engine.js not loaded");
      return window.CriticalAI.initAI(function (report) {
        var div = document.getElementById("articles");
        if (div && report && typeof report.progress === "number") {
          var marker = div.querySelector(".cambreth-progress");
          if (marker) marker.textContent = "Model loading… " + Math.round(report.progress * 100) + "%";
        }
      });
    }).then(function () {
      return window.CriticalAI.runMercilessSynthesis(rawData);
    }).then(function (output) {
      var res = extractStructuredOutput(output);
      if (res.prices && res.prices.length) {
        var map = {};
        res.prices.forEach(function (p) { map[String(p.mineral || p.mineral_name || "").toLowerCase()] = p; });
        var merged = (rawData.prices || []).map(function (base) {
          var ai = map[String(base.name).toLowerCase()];
          return ai ? Object.assign({}, base, {
            price: ai.usd_per_tonne || base.price,
            change_pct: ai.daily_change_pct != null ? ai.daily_change_pct : base.change_pct,
            chemistry_key_fact: ai.chemistry_key_fact || base.chemistry_key_fact,
            economic_note: ai.economic_note || base.economic_note
          }) : base;
        });
        if (merged.length) renderPrices(merged);
      }
      var div = document.getElementById("articles");
      if (div && res.cards) { div.className = "cambreth-feed"; div.innerHTML = res.cards; }
      return cachePut(CACHE_KEY, { html: div ? div.innerHTML : "", ai: aiArticles, ts: Date.now() });
    }).catch(function (err) {
      console.warn("[ui] deep synthesis unavailable — keeping daily brief.", err);
      var div = document.getElementById("articles");
      if (div && !div.querySelector(".cambreth-progress")) {
        var n = document.createElement("p");
        n.className = "cambreth-progress";
        n.textContent = "Deep synthesis is unavailable in this browser (needs WebGPU). The daily brief is shown instead.";
        div.appendChild(n);
      }
    });
  }

  /* ============================ init ============================ */
  function loadData() {
    return fetch(DATA_URL, { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
      rawData = d || rawData;
      if (!rawData.articles) rawData.articles = [];
      if (!rawData.ai_articles) rawData.ai_articles = [];
      if (!rawData.headlines) rawData.headlines = [];
      if (!rawData.founder) rawData.founder = {};
      if (!rawData.founder_today) rawData.founder_today = {};
    }).catch(function () {
      console.warn("[ui] no daily data — inline fallback.");
      rawData = { prices: [], headlines: [], articles: [], ai_articles: [], founder: {}, founder_today: {} };
    });
  }

  function init() {
    injectStyles();
    interceptClicks();
    loadData().then(function () {
      renderPrices(rawData.prices || []);
      acquireSections();
      route();
      window.addEventListener("hashchange", route);
      // reveal the site (remove the boot splash) once content is populated
      if (window.__cambrethReady) window.__cambrethReady();

      // Drawer search: wire the input directly (Enter / submit / button)
      var sInput = document.getElementById("gu-search-desktop");
      if (sInput) {
        var goSearch = function () { location.hash = "#/search?q=" + encodeURIComponent(sInput.value); };
        sInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); goSearch(); } });
        var sForm = sInput.closest("form");
        if (sForm) {
          sForm.addEventListener("submit", function (e) { e.preventDefault(); goSearch(); });
          var sBtn = sForm.querySelector('button[type="submit"]');
          if (sBtn) sBtn.addEventListener("click", function (e) { e.preventDefault(); goSearch(); });
        }
      }
      // #articles (news) already shows our article cards from acquireSections;
      // the AI will overwrite it with deep original articles when ready.
      // restore cached AI content if present
      cacheGet(CACHE_KEY).then(function (c) {
        if (c && c.ai && Object.keys(c.ai).length) {
          aiArticles = c.ai;
          var div = document.getElementById("articles");
          if (div && c.html && div.classList.contains("cambreth-feed")) div.innerHTML = c.html;
        }
        autoRun();
      }).catch(function () { autoRun(); });
      setInterval(function () {
        loadData().then(function () {
          renderPrices(rawData.prices || []);
          acquireSections();
          if (window.CriticalAI && navigator.gpu) autoRun();
          else { var a = document.getElementById("articles"); if (a) renderBrief(rawData.headlines || []); }
        });
      }, REFRESH_MS);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
