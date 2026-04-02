#!/usr/bin/env node
/**
 * Server-side aggregator for feeds that block browser CORS or geo-restrict JSON.
 * Run locally: node scripts/fetch-live.mjs
 * Outputs: ../data/live.json (relative to this file)
 */
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "live.json");

const UN_FEEDS = [
  {
    url: "https://news.un.org/feed/subscribe/en/news/region/middle-east/feed/rss.xml",
    source: "UN News — Middle East",
  },
  {
    url: "https://news.un.org/feed/subscribe/en/news/topic/peace-and-security/feed/rss.xml",
    source: "UN News — Peace and security",
  },
];

const OREF_URL =
  process.env.OREF_PROXY_URL ||
  "https://www.oref.org.il/WarningMessages/alert/alerts.json";

function stripCdata(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1").trim();
}

function stripHtml(s) {
  return stripCdata(s)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m ? stripCdata(m[1].trim()) : "";
}

function parseRss(xml, sourceLabel, limit = 35) {
  const items = [];
  const re = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) && items.length < limit) {
    const block = m[1];
    const title = extractTag(block, "title");
    let link = extractTag(block, "link");
    if (!link) {
      const guid = extractTag(block, "guid");
      if (guid && /^https?:\/\//i.test(guid)) link = guid;
    }
    const pubDate = extractTag(block, "pubDate");
    const description = extractTag(block, "description") || extractTag(block, "summary");
    if (!title || !link) continue;
    items.push({
      id: `un:${link}`,
      source: sourceLabel,
      title: stripHtml(title),
      summary: stripHtml(description).slice(0, 600),
      published: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      url: link.replace(/&amp;/g, "&"),
    });
  }
  return items;
}

const KW = {
  israel: ["israel", "gaza", "palestin", "tel aviv", "jerusalem", "west bank", "occupied palestinian"],
  lebanon: ["lebanon", "beirut", "tripoli", "tyre", "sidon", "unifil", "blue line"],
  iran: ["iran", "tehran", "isfahan", "mashhad", "persian gulf", "islamic republic of iran"],
};

function inferCountries(text) {
  const lower = text.toLowerCase();
  /** @type {string[]} */
  const hits = [];
  for (const c of Object.keys(KW)) {
    if (KW[c].some((k) => lower.includes(k))) hits.push(c);
  }
  return hits;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "LiveRegionalAlerts/1.0 (+https://github.com/pages; data aggregation)",
      Accept: "application/rss+xml, application/xml, text/xml, application/json, */*",
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function fetchOrefAlerts() {
  /** @type {any[]} */
  const out = [];
  try {
    const res = await fetch(OREF_URL, {
      headers: {
        "User-Agent": "LiveRegionalAlerts/1.0",
        Accept: "application/json",
      },
    });
    if (!res.ok) return out;
    const j = await res.json();
    const alerts = j?.data || j?.alerts || [];
    const list = Array.isArray(alerts) ? alerts : [];
    const ts = j?.id ? new Date(Number(j.id)).toISOString() : new Date().toISOString();
    for (const a of list) {
      const title = a?.title || a?.data || "Home Front alert";
      const desc = a?.desc || "";
      out.push({
        id: `oref:${title}:${a?.alertDate || ts}`,
        source: "Israel Home Front (oref JSON)",
        title: String(title),
        summary: String(desc || title).slice(0, 400),
        published: a?.alertDate ? new Date(a.alertDate.replace(" ", "T")).toISOString() : ts,
        url: "https://www.oref.org.il/",
        country: "israel",
      });
    }
  } catch {
    /* geo-blocked or schema change */
  }
  return out;
}

async function main() {
  /** @type {any[]} */
  const alerts = [];

  for (const feed of UN_FEEDS) {
    try {
      const xml = await fetchText(feed.url);
      const items = parseRss(xml, feed.source);
      for (const it of items) {
        const blob = `${it.title} ${it.summary}`;
        const countries = inferCountries(blob);
        if (countries.length === 1) it.country = countries[0];
        alerts.push(it);
      }
    } catch (e) {
      console.warn("RSS skip:", feed.url, e.message);
    }
  }

  const oref = await fetchOrefAlerts();
  alerts.push(...oref);

  const byId = new Map();
  for (const a of alerts) {
    if (!a.id) continue;
    if (!byId.has(a.id)) byId.set(a.id, a);
  }
  const deduped = [...byId.values()];
  deduped.sort((a, b) => String(b.published).localeCompare(String(a.published)));

  const payload = {
    fetchedAt: new Date().toISOString(),
    alerts: deduped,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.log("Wrote", OUT, "items:", deduped.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
