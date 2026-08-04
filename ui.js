/*
 * BAREBOARD (CNBC-style) — ui.js
 * Auto-updating engine for the CNBC-clone shell. Same backend as before
 * (dig.py -> raw-industrial.json -> daily AI articles). Additive only:
 * it fills the existing CNBC containers with our content, keeping the
 * exact theme/style/behavior.
 *
 * Features:
 *   - LIVE breaking bar: "LIVE" label + train-style marquee of the hottest
 *     headlines; the X button folds the bar up and away (smooth rise).
 *   - Ticker: the market strip is rebuilt with OUR minerals/rates
 *     (from the daily prices file), keeping the MarketCard style + up/down.
 *   - Tabs: the ASIA/EUR/US tabs become OUR sectors with short labels.
 *   - Quick Links: ours; each opens its own page with a big, daily-updated
 *     list of that sector's news.
 *   - Hero: the featured card shows the HOTTEST story with its image and
 *     the gradient scrim, and links to the article.
 *   - Article sections: every section container is filled with our news
 *     (categorised), all clickable to their own pages.
 *   - Router: Business-Insider-style clean URLs (history API + GitHub Pages
 *     404.html redirect) with a hash fallback for local testing.
 */

(function () {
  "use strict";

  var DATA_URL = "data/raw-industrial.json";
  var REFRESH_MS = 30 * 60 * 1000;

  var rawData = { prices: [], headlines: [], articles: [], ai_articles: [], founder: {}, founder_today: {}, sectors: [], quicklinks: [] };
  var C = null; // content.json (sectors/quicklinks) loaded client-side

  /* ---------------- utils ---------------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function slugify(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  }
  function fmt(v) {
    var n = Number(v);
    if (!isFinite(n)) return "GAP";
    return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  function todayStr() {
    return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }
  function dayIndex() {
    var now = new Date(), start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 864e5);
  }

  function loadContent() {
    return fetch("data/content.json", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (c) { C = c; rawData.sectors = c.sectors || []; rawData.quicklinks = c.quicklinks || []; })
      .catch(function () { /* optional */ });
  }

  function loadData() {
    return fetch(DATA_URL, { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        rawData = Object.assign(rawData, d || {});
        if (!rawData.articles) rawData.articles = [];
        if (!rawData.ai_articles) rawData.ai_articles = [];
        if (!rawData.headlines) rawData.headlines = [];
        if (!rawData.founder) rawData.founder = {};
        if (!rawData.founder_today) rawData.founder_today = {};
      })
      .catch(function () {
        console.warn("[bareboard] no daily data yet — using inline fallback.");
        rawData = Object.assign(rawData, { prices: [], headlines: [], articles: [], ai_articles: [] });
      });
  }

  function allArticles() {
    return (rawData.ai_articles || []).concat(rawData.articles || []);
  }
  function hottest(n) {
    var arts = allArticles();
    if (!arts.length) return [];
    return arts.slice(0, n || 1);
  }
  function bySector(slug, n) {
    var map = {
      "oil-gas": ["Markets", "oil", "gas", "Energy"],
      "critical-minerals": ["Markets", "Rare earths", "Lithium", "Cobalt", "Graphite"],
      "coal-mining": ["Supply chain", "Mining & projects"],
      "battery-ev": ["Demand", "Electric vehicles"],
      "grid-storage": ["Demand", "Grid storage"],
      "policy-trade": ["Policy"],
      "markets": ["Markets"],
      "supply-chain": ["Supply chain", "Processing & refining"]
    };
    var keys = map[slug] || ["Markets"];
    var arts = allArticles().filter(function (a) {
      var cat = String(a.category || a.kicker || "");
      return keys.some(function (k) { return cat.toLowerCase().indexOf(k.toLowerCase()) !== -1; });
    });
    if (arts.length < n) {
      var more = allArticles().filter(function (a) { return arts.indexOf(a) === -1; });
      arts = arts.concat(more);
    }
    return arts.slice(0, n || 8);
  }

  /* ---------------- 1) LIVE breaking bar ---------------- */
  function initLiveBar() {
    var heading = document.querySelector(".BreakingNews-heading");
    if (heading) heading.innerHTML = "LIVE <span class=\"BreakingNews-newsText\"></span>";

    var marquee = document.querySelector(".BreakingNews-marquee");
    var headlines = (rawData.headlines || []).map(function (h) { return h.title; })
      .concat(hottest(6).map(function (a) { return a.headline; }))
      .filter(Boolean);
    var text = headlines.length
      ? headlines.join("   •   ") + "   •   "
      : "Bareboard — critical minerals, energy transition and industrial supply intelligence, refreshed daily.   •   ";
    if (marquee) marquee.textContent = text;

    // X button folds the bar up and away with a smooth rise
    var close = document.querySelector(".BreakingNews-closeButton");
    if (close) {
      close.addEventListener("click", function () {
        var bar = document.querySelector(".BreakingNews-container");
        if (!bar) return;
        bar.style.transition = "max-height .45s ease, opacity .35s ease, transform .45s ease";
        bar.style.maxHeight = bar.scrollHeight + "px";
        // force reflow then animate up
        void bar.offsetHeight;
        bar.style.maxHeight = "0px";
        bar.style.opacity = "0";
        bar.style.transform = "translateY(-100%)";
        bar.style.overflow = "hidden";
        setTimeout(function () { bar.classList.add("bareboard-folded"); }, 480);
      });
    }
  }

  /* ---------------- 2) ticker (our minerals) ---------------- */
  function buildTicker() {
    var wrap = document.getElementById("market-data-scroll-container");
    if (!wrap) return;
    wrap.style.maxWidth = "100%";
    wrap.style.width = "100%";
    wrap.style.overflowX = "auto";
    wrap.style.WebkitOverflowScrolling = "touch";
    var prices = (rawData.prices || []).slice(0, 12);
    if (!prices.length) return;
    wrap.innerHTML = prices.map(function (p) {
      var up = Number(p.change_pct) >= 0;
      var sym = String(p.symbol || p.name || "MIN").split(" ")[0].toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7) || "MIN";
      var arrow = up ? "MarketCard-triangle-up" : "MarketCard-triangle-down";
      var sr = up ? "Uptrend" : "Downtrend";
      var match = allArticles().filter(function (a) {
        return (a.headline + " " + (a.kicker || "")).toLowerCase().indexOf(String(p.name).toLowerCase().split(" ")[0]) !== -1;
      })[0];
      var link = match ? "#/article/" + esc(match.slug) : "#/sector/critical-minerals";
      return '<a href="' + link + '" class="MarketCard-container ' +
        (up ? "MarketCard-up" : "MarketCard-down") + ' MarketCard-wrap">' +
        '<div class="MarketCard-row"><span class="MarketCard-symbol">' + esc(sym) + '</span>' +
        '<span class="MarketCard-stockPosition">' + fmt(p.price) + '</span></div>' +
        '<div class="MarketCard-row"><span class="' + arrow + '"><span class="MarketCard-SROnly">' + sr + '</span></span>' +
        '<div class="MarketCard-changeData"><span class="MarketCard-changesPts">' +
        (up ? "+" : "") + fmt(p.price * (Number(p.change_pct) / 100)) + '</span>' +
        '<span class="MarketCard-changesPct">' + (up ? "+" : "") + Number(p.change_pct).toFixed(2) + '%</span></div></div>' +
        '<div class="MarketCard-row"><span class="MarketCard-lastTime">' + esc(p.unit || "") + " · " + esc((p.assessment_date || "").slice(0, 10)) + '</span></div></a>';
    }).join("");
  }

  /* ---------------- 3) tabs -> our sectors (short labels) ---------------- */
  function buildTabs() {
    var tabs = document.querySelectorAll(".MarketsBannerMenu-marketOption");
    var sectors = rawData.sectors || [];
    if (!tabs.length || !sectors.length) return;
    tabs.forEach(function (btn, i) {
      var s = sectors[i % sectors.length];
      btn.textContent = s.short || s.label;
      btn.setAttribute("aria-label", s.label);
      btn.setAttribute("data-sector", s.slug);
      btn.onclick = function () { go("#/sector/" + s.slug); };
    });
    if (tabs[0]) tabs[0].classList.add("MarketsBannerMenu-activeMarket");
  }

  /* ---------------- 4) quick links -> ours ---------------- */
  function buildQuickLinks() {
    var container = document.querySelector(".QuickLinks-scrollableContainer");
    if (!container) return;
    container.style.maxWidth = "100%";
    container.style.width = "100%";
    container.style.overflowX = "auto";
    var ql = rawData.quicklinks || [];
    if (!ql.length) return;
    // keep the desktop header span if present
    var html = "";
    ql.forEach(function (q) {
      html += '<span class="QuickLinks-quickLink"><a href="#/sector/' + esc(q.slug) + '" title="' + esc(q.label) + '">' + esc(q.label) + "</a></span>";
    });
    // preserve the first "Quick Links" label span (desktop)
    var labelSpan = container.querySelector(".QuickLinks-desktopHeader");
    container.innerHTML = (labelSpan ? labelSpan.outerHTML : "") + html;
  }

  /* ---------------- 5) hero (hottest + gradient scrim) ---------------- */
  function buildHero() {
    var card = document.querySelector(".FeaturedCard-container");
    var hero = document.querySelector(".FeaturedNewsHero-container");
    if (!card) return;
    var hot = hottest(1)[0];
    if (!hot) return;
    var link = card.querySelector("a[href]");
    if (link) link.setAttribute("href", "#/article/" + esc(hot.slug));
    // title
    var titleEl = card.querySelector(".FeaturedCard-title, .FeaturedCard-headline, h3, h2");
    if (titleEl) titleEl.textContent = hot.headline;
    // image (keep gradient scrim: the image container has the overlay)
    var img = card.querySelector("img");
    if (img && hot.image) { img.src = hot.image; img.alt = esc(hot.headline); }
    // description
    var desc = card.querySelector(".FeaturedCard-description, .FeaturedCard-dek, p");
    if (desc) desc.textContent = hot.summary || "";
  }

  /* ---------------- 6) article sections -> our news ---------------- */
  function buildSections() {
    var sections = document.querySelectorAll(".SectionWrapper-container");
    var order = ["markets", "critical-minerals", "oil-gas", "battery-ev", "grid-storage", "supply-chain", "policy-trade", "coal-mining", "markets", "critical-minerals", "oil-gas", "battery-ev", "grid-storage", "supply-chain", "policy-trade"];
    sections.forEach(function (sec, i) {
      var slug = order[i % order.length];
      var arts = bySector(slug, 4);
      var titleA = sec.querySelector(".SectionWrapper-title a, .SectionWrapper-title");
      if (titleA) {
        var s = (rawData.sectors || []).filter(function (x) { return x.slug === slug; })[0];
        titleA.textContent = (s ? s.label : "News") + " — latest";
        titleA.setAttribute("href", "#/sector/" + slug);
      }
      var cards = sec.querySelectorAll('[data-test="Card"], .Card');
      if (cards.length) {
        cards.forEach(function (c, j) {
          var a = arts[j] || arts[0];
          if (!a) return;
          var link = c.querySelector("a[href]");
          if (link) link.setAttribute("href", "#/article/" + esc(a.slug));
          var h = c.querySelector("h3, h2, .Card-title, .Card-headline, .RiverHeadline-headline");
          if (h) h.textContent = a.headline;
          var dek = c.querySelector(".Card-description, .Card-dek, .RiverHeadline-description, p");
          if (dek && dek.textContent && dek.textContent.trim().length > 20 && a.summary) dek.textContent = a.summary;
          var img = c.querySelector("img");
          if (img && a.image) img.src = a.image;
        });
      } else {
        // fallback: inject a simple list into the section content
        var content = sec.querySelector(".SectionWrapper-content, .Layout-layout");
        if (content) {
          content.innerHTML = '<div class="Layout-layout">' + arts.map(function (a) {
            return '<div class="Column" data-test="Card" style="padding:8px"><a href="#/article/' + esc(a.slug) + '" style="text-decoration:none;color:inherit">' +
              '<h3 style="font-size:16px;font-weight:700;margin:0 0 4px">' + esc(a.headline) + "</h3>" +
              '<p style="font-size:13px;color:#747474;margin:0">' + esc(a.summary || "") + "</p></a></div>";
          }).join("") + "</div>";
        }
      }
    });
  }

  /* ---------------- 6c) fill every CNBC headline container with our content ---------------- */
  function fillAllHeadlines() {
    var arts = allArticles();
    if (!arts.length) return;
    // teaser strips
    var teasers = document.querySelectorAll(".MarketsBanner-teaser a, .MarketsBanner-teaserContainer a");
    teasers.forEach(function (a, i) {
      var h = hottest(1)[0];
      if (h) { a.setAttribute("href", "#/article/" + esc(h.slug)); a.textContent = h.headline; }
    });
    // secondary cards
    var secondary = document.querySelectorAll(".SecondaryCard-headline a, .SecondaryCard-headline");
    secondary.forEach(function (el, i) {
      var h = arts[i % arts.length];
      if (!h) return;
      if (el.tagName === "A") { el.setAttribute("href", "#/article/" + esc(h.slug)); el.textContent = h.headline; }
      else { var a = el.querySelector("a"); if (a) { a.setAttribute("href", "#/article/" + esc(h.slug)); a.textContent = h.headline; } }
    });
    // latest news list items
    var latest = document.querySelectorAll(".LatestNews-headline a, .LatestNews-headline");
    latest.forEach(function (el, i) {
      var h = hottest(12)[i] || arts[i % arts.length];
      if (!h) return;
      if (el.tagName === "A") { el.setAttribute("href", "#/article/" + esc(h.slug)); el.textContent = h.headline; }
      else { var a = el.querySelector("a"); if (a) { a.setAttribute("href", "#/article/" + esc(h.slug)); a.textContent = h.headline; } }
    });
    // river plus cards
    var river = document.querySelectorAll(".RiverPlusCard-cardLeft .RiverHeadline-headline a, .RiverPlusCard-cardLeft .RiverHeadline-headline");
    river.forEach(function (el, i) {
      var h = arts[i % arts.length];
      if (!h) return;
      if (el.tagName === "A") { el.setAttribute("href", "#/article/" + esc(h.slug)); el.textContent = h.headline; }
      else { var a = el.querySelector("a"); if (a) { a.setAttribute("href", "#/article/" + esc(h.slug)); a.textContent = h.headline; } }
    });
    // any Card-title anchors (including anchors that ARE the title)
    var cardTitles = document.querySelectorAll("a.Card-title, a.Card-headline, .Card-title a, .Card-headline a");
    cardTitles.forEach(function (a, i) {
      var h = arts[i % arts.length];
      if (!h) return;
      a.setAttribute("href", "#/article/" + esc(h.slug));
      a.textContent = h.headline;
    });
    // the Quote Finder popular quotes -> our minerals
    var quotes = document.querySelectorAll(".QuoteFinder-popularQuote, [class*='popularQuote'], .QuoteFinder-popularQuotes a");
    quotes.forEach(function (el, i) {
      var p = (rawData.prices || [])[i % (rawData.prices || []).length];
      if (p) {
        var txt = p.name + " " + p.price;
        if (el.tagName === "A") el.textContent = txt;
        else { var a = el.querySelector("a"); if (a) a.textContent = txt; }
      }
    });
  }

  /* ---------------- 6b) TrendingNow breaker -> our hottest ---------------- */
  function buildTrending() {
    var container = document.querySelector(".TrendingNowBreaker-container, [id*='TrendingNowBreaker'], .TrendingNow-trendingNowContainer");
    if (!container) return;
    var hot = hottest(8);
    if (!hot.length) return;
    // replace text links inside with our headlines
    var links = container.querySelectorAll("a");
    if (links.length) {
      links.forEach(function (a, i) {
        var h = hot[i % hot.length];
        if (h) {
          a.setAttribute("href", "#/article/" + esc(h.slug));
          a.textContent = h.headline;
        }
      });
    } else {
      container.innerHTML = '<div style="padding:12px 16px;font-weight:800;letter-spacing:1px;font-size:11px;color:#f0b90b">TRENDING</div>' +
        hot.map(function (h) { return '<a href="#/article/' + esc(h.slug) + '" style="display:block;padding:8px 16px;border-bottom:1px solid #e3e6eb;text-decoration:none;color:inherit;font-weight:700;font-size:15px">' + esc(h.headline) + "</a>"; }).join("");
    }
  }

  /* ---------------- 7) router: clean URLs (BI style) ---------------- */
  function readPath() {
    // hash routes first (local testing + fallback)
    var h = location.hash || "";
    if (h.indexOf("#/") === 0) return h.slice(1);
    // GH Pages: 404.html stores the intended path in sessionStorage
    var redirect = null;
    try { redirect = sessionStorage.getItem("bareboard-redirect"); } catch (e) {}
    if (redirect) {
      try { sessionStorage.removeItem("bareboard-redirect"); } catch (e) {}
      return redirect;
    }
    var p = location.pathname;
    // strip repo prefix: find the segment that is a known route
    var known = ["article", "sector", "about", "search", "founders-words", "quick", ""];
    var parts = p.split("/").filter(Boolean);
    for (var i = 0; i < parts.length; i++) {
      if (known.indexOf(parts[i]) !== -1) {
        return "/" + parts.slice(i).join("/");
      }
    }
    return "/";
  }

  function routePath(path) {
    var qm = (path || "").split("?")[1] || "";
    var parts = (path || "").split("?")[0].split("/").filter(Boolean);
    if (!parts.length) { renderHome(); return; }
    if (parts[0] === "article") { renderArticle(parts[1]); return; }
    if (parts[0] === "sector" || parts[0] === "quick") { renderSector(parts[1]); return; }
    if (parts[0] === "about") { renderAbout(); return; }
    if (parts[0] === "founders-words") { renderFounders(); return; }
    if (parts[0] === "search") { renderSearch((qm.match(/q=([^&]*)/) || [])[1] || ""); return; }
    renderHome();
  }

  function go(hash) {
    // clean URL via history API
    var path = hash.replace(/^#/, "");
    try {
      history.pushState({}, "", path);
    } catch (e) { location.hash = hash; }
    routePath(path);
    window.scrollTo(0, 0);
  }

  /* ---------------- pages ---------------- */
  function renderHome() {
    // The homepage shell is already populated by the fill functions;
    // just make sure nothing else changed. Ensure main visible.
    var main = document.querySelector("main, #main, .PageBuilder, #bareboard-page");
    if (main) main.style.display = "";
  }

  function pageShell(title, kicker) {
    var main = document.querySelector("main, #main, .PageBuilder, #bareboard-page");
    if (!main) {
      var container = document.createElement("div");
      container.id = "bareboard-page";
      document.body.appendChild(container);
      main = container;
    } else {
      // ensure a single page container (drop stale duplicates)
      var all = document.querySelectorAll("#bareboard-page");
      for (var i = 1; i < all.length; i++) all[i].parentNode.removeChild(all[i]);
    }
    main.innerHTML = '<div style="max-width:1200px;margin:0 auto;padding:24px 16px">' +
      '<div style="border-top:3px solid #f0b90b;padding-top:8px;margin-bottom:18px">' +
      '<span style="font-weight:800;letter-spacing:1px;color:#f0b90b;font-size:11px">' + esc(kicker || "Bareboard") + "</span>" +
      '<h1 style="font-size:30px;font-weight:800;margin:4px 0 0;line-height:1.1">' + esc(title) + "</h1></div>";
    return main;
  }

  function renderSector(slug) {
    var s = (rawData.sectors || []).filter(function (x) { return x.slug === slug; })[0];
    var title = s ? s.label : (slug || "News");
    var main = pageShell(title, "Bareboard · Sector");
    var arts = bySector(slug, 20);
    var html = "";
    if (s && s.blurb) html += '<p style="max-width:760px;color:#3c3c3c;margin:0 0 18px">' + esc(s.blurb) + "</p>";
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px">';
    if (!arts.length) arts = hottest(6);
    arts.forEach(function (a) {
      html += '<a href="#/article/' + esc(a.slug) + '" style="text-decoration:none;color:inherit;border:1px solid #e3e6eb;border-radius:6px;overflow:hidden;display:block">' +
        (a.image ? '<img src="' + esc(a.image) + '" alt="' + esc(a.headline) + '" style="width:100%;height:150px;object-fit:cover;display:block"/>' : "") +
        '<div style="padding:12px"><h3 style="font-size:17px;font-weight:700;margin:0 0 6px;line-height:1.25">' + esc(a.headline) + "</h3>" +
        '<p style="font-size:13px;color:#747474;margin:0">' + esc(a.summary || "") + "</p></div></a>";
    });
    html += "</div><p style=\"margin-top:20px\"><a href=\"#/\" style=\"color:#0c68d1\">← Back to home</a></p>";
    main.insertAdjacentHTML("beforeend", html);
    window.scrollTo(0, 0);
  }

  function openArticle(slug) {
    var arts = allArticles();
    var a = null;
    for (var i = 0; i < arts.length; i++) if (arts[i].slug === slug) { a = arts[i]; break; }
    if (!a) return;
    var paras = (a.body || "").split("\n").filter(Boolean).map(function (p) {
      if (p.indexOf("Key Takeaway:") === 0 || p.indexOf("**Key Takeaway:**") === 0) {
        return '<div style="background:#f0b90b;padding:12px 14px;font-weight:700;margin:16px 0">' + esc(p.replace(/\*\*/g, "")) + "</div>";
      }
      return "<p>" + esc(p) + "</p>";
    }).join("");
    var html =
      '<div class="bareboard-modal-backdrop" id="bareboard-modal">' +
        '<div class="bareboard-modal" role="dialog" aria-modal="true">' +
          '<button class="bareboard-modal-close" aria-label="Close">×</button>' +
          '<div class="bareboard-modal-scroll">' +
            '<span style="font-weight:800;letter-spacing:1px;color:#f0b90b;font-size:11px">' + esc(a.kicker || a.category || "Analysis") + "</span>" +
            '<h1 style="font-size:30px;font-weight:800;margin:6px 0 10px;line-height:1.12">' + esc(a.headline) + "</h1>" +
            '<p style="font-size:18px;color:#3c3c3c;font-weight:600;margin:0 0 12px">' + esc(a.summary || "") + "</p>" +
            '<p style="font-weight:700;color:#0c68d1;margin:0 0 2px">By ' + esc(a.byline || "Bareboard Intelligence") + "</p>" +
            '<p style="font-size:12px;color:#747474;margin:0 0 16px">' + esc(a.date || todayStr()) + " · " + esc(a.category || "") + "</p>" +
            (a.image ? '<figure style="margin:0 0 6px"><img src="' + esc(a.image) + '" alt="' + esc(a.headline) + '" style="width:100%;max-height:420px;object-fit:cover;display:block"/></figure>' +
              '<p style="font-size:11px;color:#747474;margin:0 0 16px">' + esc(a.image_credit || "Source") + "</p>" : "") +
            '<div style="max-width:760px">' + paras + "</div>" +
          "</div>" +
        "</div>" +
      "</div>";
    // remove any existing modal then add
    var old = document.getElementById("bareboard-modal");
    if (old) old.parentNode.removeChild(old);
    var div = document.createElement("div");
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);
    document.body.style.overflow = "hidden";
    var close = document.querySelector(".bareboard-modal-close");
    var backdrop = document.getElementById("bareboard-modal");
    function closeModal() {
      if (backdrop) backdrop.parentNode.removeChild(backdrop);
      document.body.style.overflow = "";
    }
    if (close) close.addEventListener("click", closeModal);
    if (backdrop) backdrop.addEventListener("click", function (e) { if (e.target === backdrop) closeModal(); });
    document.addEventListener("keydown", function escHandler(e) { if (e.key === "Escape") { closeModal(); document.removeEventListener("keydown", escHandler); } });
  }

  function renderArticle(slug) { openArticle(slug); }

  function renderAbout() {
    var a = (rawData.about) || {};
    var main = pageShell("About The Cambreth Organization", "Bareboard · About");
    var html = a.tagline ? '<p style="max-width:760px;font-size:18px;color:#3c3c3c;font-weight:600">' + esc(a.tagline) + "</p>" : "";
    (a.sections || []).forEach(function (s) {
      html += '<section style="margin:0 0 26px;padding:0 0 18px;border-bottom:1px solid #e3e6eb">' +
        '<span style="font-weight:800;letter-spacing:1px;color:#f0b90b;font-size:11px">' + esc(s.kicker || "") + "</span>" +
        '<h2 style="font-size:22px;font-weight:800;margin:4px 0 8px">' + esc(s.title || "") + "</h2>" +
        (s.body || []).map(function (p) { return '<p style="max-width:760px;color:#3c3c3c;margin:0 0 10px">' + esc(p) + "</p>"; }).join("") +
        (s.links ? s.links.map(function (l) { return '<a href="' + esc(l.url) + '" style="color:#0c68d1;font-weight:700;margin-right:14px">' + esc(l.label) + "</a>"; }).join("") : "") +
        "</section>";
    });
    main.insertAdjacentHTML("beforeend", html + '<p><a href="#/" style="color:#0c68d1">← Back to home</a></p>');
    window.scrollTo(0, 0);
  }

  function renderFounders() {
    var f = rawData.founder_today || rawData.founder || {};
    var qs = (rawData.founder && rawData.founder.quotes) || [];
    var main = pageShell("Founder's Words", "Bareboard · Founder");
    var html = '<div style="max-width:720px;border-left:4px solid #f0b90b;padding:14px 18px;background:#fafafa;margin:0 0 20px">' +
      '<p style="font-size:22px;font-weight:700;line-height:1.4;margin:0 0 8px">"' + esc(f.quote || (qs[dayIndex() % qs.length] || "")) + '"</p>' +
      '<p style="font-weight:800;color:#f0b90b;margin:0">' + esc(f.name || "Fahadh Haneef Cambreth") + "</p>" +
      '<p style="font-size:12px;color:#747474;margin:2px 0 0">' + esc(f.role || "Founder, The Cambreth Organization") + "</p></div>";
    qs.forEach(function (q) {
      html += '<p style="font-size:16px;font-weight:600;line-height:1.4;border-bottom:1px solid #e3e6eb;padding:10px 0">"' + esc(q) + '"</p>';
    });
    main.insertAdjacentHTML("beforeend", html + '<p><a href="#/" style="color:#0c68d1">← Back to home</a></p>');
    window.scrollTo(0, 0);
  }

  function renderSearch(q) {
    var main = pageShell("Search", "Bareboard · Search");
    main.insertAdjacentHTML("beforeend",
      '<input id="bareboard-q" type="search" placeholder="Search sectors, articles, minerals…" value="' + esc(q) + '" style="width:100%;max-width:520px;padding:12px 14px;font-size:15px;border:1px solid #d5d9e0;border-radius:4px;margin-bottom:16px"/>' +
      '<div id="bareboard-results"></div>');
    var input = document.getElementById("bareboard-q");
    input.focus();
    input.addEventListener("input", function () { renderSearchResults(input.value); });
    renderSearchResults(q);
  }
  function renderSearchResults(q) {
    var box = document.getElementById("bareboard-results");
    if (!box) return;
    q = (q || "").toLowerCase().trim();
    if (!q) { box.innerHTML = '<p style="color:#747474">Type to search…</p>'; return; }
    var items = allArticles().filter(function (a) {
      return ((a.headline || "") + " " + (a.summary || "") + " " + (a.body || "") + " " + (a.category || "") + " " + (a.kicker || "")).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 14);
    box.innerHTML = items.length ? items.map(function (a) {
      return '<a href="#/article/' + esc(a.slug) + '" style="display:block;text-decoration:none;color:inherit;border-bottom:1px solid #e3e6eb;padding:10px 0">' +
        '<h3 style="font-size:16px;font-weight:700;margin:0 0 4px">' + esc(a.headline) + "</h3>" +
        '<p style="font-size:13px;color:#747474;margin:0">' + esc(a.summary || "") + "</p></a>";
    }).join("") : '<p>No results for "' + esc(q) + '".</p>';
  }

  function injectModalCSS() {
    if (document.getElementById("bareboard-modal-css")) return;
    var st = document.createElement("style");
    st.id = "bareboard-modal-css";
    st.textContent =
      ".bareboard-modal-backdrop{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.55);display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow-y:auto}" +
      ".bareboard-modal{background:#fff;max-width:820px;width:100%;border-radius:8px;position:relative;box-shadow:0 10px 40px rgba(0,0,0,.25)}" +
      ".bareboard-modal-scroll{padding:26px 22px 34px;max-height:88vh;overflow-y:auto}" +
      ".bareboard-modal-close{position:absolute;top:10px;right:12px;font-size:26px;line-height:1;border:0;background:none;cursor:pointer;color:#333;padding:4px 8px}" +
      ".bareboard-modal-close:hover{color:#f0b90b}" +
      "@media(max-width:600px){.bareboard-modal-backdrop{padding:0}.bareboard-modal{border-radius:0;min-height:100vh}.bareboard-modal-scroll{max-height:100vh;padding:20px 16px 30px}}" +
      "/* fix X-fold: remove reserved space + ticker mobile width */" +
      ".BreakingNews-container.bareboard-folded{display:none !important}" +
      "#market-data-scroll-container,.MarketsBanner-marketData,.MarketsBanner-main{width:100% !important;max-width:100% !important}" +
      ".MarketsBanner-container{max-width:100% !important;overflow-x:auto}";
    document.head.appendChild(st);
  }

  /* ---------------- nav: replace CNBC links with our sectors ---------------- */
  function buildNav() {
    var navLinks = document.querySelector(".nav-menu-navLinks");
    if (!navLinks) return;
    var sectors = rawData.sectors || [];
    if (!sectors.length) return;
    var mainLinks = document.querySelector(".nav-menu-mainLinksWrapperStart");
    if (!mainLinks) return;
    var block = document.createElement("div");
    block.className = "nav-menu-navLinks";
    block.style.display = "flex";
    block.style.flexWrap = "wrap";
    block.style.alignItems = "center";
    sectors.forEach(function (s) {
      var a = document.createElement("a");
      a.href = "#/sector/" + s.slug;
      a.textContent = s.short || s.label;
      a.title = s.label;
      a.className = "nav-menu-button bareboard-navlink";
      a.style.cssText = "font-weight:700;font-size:13px;letter-spacing:.3px;padding:8px 10px;text-decoration:none;color:inherit;white-space:nowrap";
      var div = document.createElement("div");
      div.className = "nav-menu-primaryLink";
      div.appendChild(a);
      block.appendChild(div);
    });
    var oldBlock = mainLinks.querySelector(".nav-menu-navLinks");
    if (oldBlock) oldBlock.parentNode.replaceChild(block, oldBlock);

    // Mobile: the desktop nav is hidden; surface our sectors + search in the header wrapper
    var wrap = document.querySelector(".CNBCGlobalNav-wrapper");
    if (wrap && !document.getElementById("bareboard-mobile-nav")) {
      var mn = document.createElement("div");
      mn.id = "bareboard-mobile-nav";
      mn.style.cssText = "display:none;width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:6px 10px;border-top:1px solid #e3e6eb";
      sectors.forEach(function (s) {
        var a = document.createElement("a");
        a.href = "#/sector/" + s.slug;
        a.textContent = s.short || s.label;
        a.title = s.label;
        a.style.cssText = "font-weight:700;font-size:12px;padding:6px 9px;text-decoration:none;color:#2e2e2e;white-space:nowrap;display:inline-block";
        mn.appendChild(a);
      });
      wrap.appendChild(mn);
      var mq = window.matchMedia("(max-width: 1019px)");
      var apply = function () { mn.style.display = mq.matches ? "block" : "none"; };
      mq.addEventListener ? mq.addEventListener("change", apply) : mq.addListener(apply);
      apply();
    }
  }

  /* ---------------- boot + refresh ---------------- */
  function headerFixes() {
    if (document.getElementById("bareboard-header-css")) return;
    var st = document.createElement("style");
    st.id = "bareboard-header-css";
    st.textContent =
      ".nav-menu-primaryLink.video, .nav-menu-primaryLink.watchlist, .nav-menu-primaryLink.investing_club, .nav-menu-primaryLink.pro { display:none !important; }" +
      ".nav-menu-navLinks, .nav-menu-mainLinksWrapperStart { overflow-x:auto; -webkit-overflow-scrolling:touch; }" +
      "@media (max-width: 1019px) { .nav-menu-navLinks { flex-wrap:nowrap !important; } }" +
      ".nav-menu-primaryLink { flex: 0 0 auto; }" +
      ".nav-menu-button::before { display:none !important; }" +
      ".nav-menu-primaryLink a::after { display:none !important; }" +
      /* Search must stay visible on mobile; hide the livestream/red-dot wrapper */
      ".CNBCGlobalNav-rightNavigationWrapper { display:flex !important; }" +
      ".CNBCGlobalNav-searchWrapper { display:inline-flex !important; }" +
      ".CNBCGlobalNav-livestreamWrapper { display:none !important; }" +
      ".WatchLivestream-watchContainer { display:none !important; }" +
      "@media (max-width: 1019px) { .CNBCGlobalNav-rightNavigationWrapper { flex:0 0 auto; display:flex; align-items:center; } }" +
      /* force header grid to make room for search on mobile */
      "@media (max-width: 1019px) { .CNBCGlobalNav-gridContainer { display:block !important; } .CNBCGlobalNav-wrapper { display:block !important; } .CNBCGlobalNav-rightNavigationWrapper { display:flex !important; width:auto !important; padding:4px 10px !important; } .CNBCGlobalNav-searchWrapper { margin-right:8px !important; } .SearchToggle-button { white-space:nowrap; } }";
    document.head.appendChild(st);
  }

  function containStrips() {
    // Guarantee the scroll strips never widen the page (clone CSS gaps)
    var sels = [".MarketsBanner-container", ".MarketsBanner-main", ".MarketsBanner-marketData",
                "#market-data-scroll-container", ".QuickLinks-scrollableContainer",
                ".FeaturedBreaker-rightSlide", ".BreakingNews-gridContainer"];
    sels.forEach(function (sel) {
      var els = document.querySelectorAll(sel);
      for (var i = 0; i < els.length; i++) {
        els[i].style.maxWidth = "100%";
        els[i].style.overflowX = "auto";
        els[i].style.WebkitOverflowScrolling = "touch";
      }
    });
  }

  function init() {
    loadContent().then(loadData).then(function () {
      injectModalCSS();
      headerFixes();
      containStrips();
      buildNav();
      initLiveBar();
      buildTicker();
      buildTabs();
      buildQuickLinks();
      buildHero();
      buildSections();
      buildTrending();
      fillAllHeadlines();
      // router
      var path = readPath();
      if (path && path !== "/" && path !== "/home") { routePath(path); }
      window.addEventListener("popstate", function () { routePath(readPath()); });
      window.addEventListener("hashchange", function () { routePath(readPath()); });
      document.addEventListener("click", function (e) {
        var a = e.target.closest ? e.target.closest("a") : null;
        if (!a) return;
        var href = a.getAttribute("href") || "";
        if (href.indexOf("#") === 0 && href.indexOf("#/") === 0 && href.indexOf("http") === -1) {
          e.preventDefault();
          go(href);
        }
      });
      // reveal site (boot splash)
      if (window.__bareboardReady) window.__bareboardReady();
    });
    setInterval(function () {
      loadData().then(function () {
        initLiveBar();
        buildTicker();
        buildTabs();
        buildQuickLinks();
        buildHero();
        buildSections();
        if (location.pathname !== "/" && readPath() !== "/") routePath(readPath());
      });
    }, REFRESH_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
