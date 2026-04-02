# Live Regional Alerts Map

A static website for GitHub Pages that combines **verifiable public feeds** with an interactive map for **Israel**, **Lebanon**, and **Iran**. It includes **English / Arabic** UI (with RTL), optional **desktop notifications**, and a **Wise** support button using recipient reference **78935292**.

## What it actually shows (important)

- **In the browser (near–live):** [GDACS](https://www.gdacs.org/) hazard centroids (earthquakes, floods, cyclones, droughts, volcanoes) and [USGS](https://earthquake.usgs.gov/) earthquakes, filtered to the country view.
- **Merged file (`data/live.json`):** Headlines from [UN News RSS](https://news.un.org/en/rss-feeds) (Middle East + Peace & security) plus **optional** rows from Israel’s Home Front JSON **when the fetch job can reach it** (often geo‑blocked outside Israel).

There is **no trustworthy global open API** for:

- live missile / drone tracks,
- military “jamming polygons”,
- or a single authoritative real‑time casualty ledger.

Casualty or injury numbers should only appear when **you link to the institutional report** that published them (this site lists those links; it does not invent numbers). For **evacuation orders**, users must still follow **official civil defence / government channels** in each country.

## What you need to run it

| Requirement | Why |
|-------------|-----|
| A **GitHub** account | Hosting on GitHub Pages |
| This repository pushed to GitHub | Source for Pages + Actions |
| **GitHub Pages** enabled | **Settings → Pages →** deploy from branch (usually `main`) and folder **`/` (root)** |
| **GitHub Actions** enabled | Runs `scripts/fetch-live.mjs` on a schedule to refresh `data/live.json` |
| **Workflow write access** | The workflow commits updates to `data/live.json` (needs `contents: write`, already set in the workflow) |

Optional improvements you can add later:

| Optional | Purpose |
|----------|---------|
| **ACLED API** credentials | Weekly conflict events with fatalities (requires [ACLED access](https://acleddata.com/)); extend `scripts/fetch-live.mjs` |
| **ReliefWeb API `appname`** | Structured humanitarian reports ([ReliefWeb API](https://apidoc.reliefweb.int/)); requires registration |
| **Your own HTTPS proxy** for `alerts.json` | Set env **`OREF_PROXY_URL`** when running the script or in CI if Pikud Haoref JSON is geo‑blocked |

## Local preview

From this folder:

```bash
npx --yes serve .
```

Then open the URL shown (for example `http://localhost:3000`).  
Refresh `data/live.json` locally with:

```bash
node scripts/fetch-live.mjs
```

## Deploy on GitHub Pages

1. Push the repo to GitHub.
2. **Settings → Pages → Build and deployment:** Source **Deploy from a branch**, branch **`main`**, folder **`/` (root)**.
3. **Settings → Actions → General:** allow Actions to run; under **Workflow permissions**, choose **Read and write** so the data job can push commits.
4. Open **Actions → Update live data → Run workflow** once to verify.
5. Your site will be at `https://<user>.github.io/<repo>/` (or a custom domain if you add one).

## Wise support

The UI includes an **Open Wise** button and shows reference **78935292** with a copy control. If you have a **Wise.me** or **wise.com/pay/me/...** link, you can replace the button `href` in `index.html` with that URL for one‑tap payments.

## Files to know

| Path | Role |
|------|------|
| `index.html` | Page shell, language toggle, country tabs, support block |
| `css/styles.css` | Layout, dark theme, RTL |
| `js/app.js` | Map, polling, layers, notifications, filtering |
| `js/i18n.js` | English / Arabic strings |
| `js/regions.js` | Bounding boxes and keyword routing |
| `data/live.json` | Aggregated RSS / optional oref output |
| `scripts/fetch-live.mjs` | Node 20+ script that writes `data/live.json` |
| `.github/workflows/update-data.yml` | Scheduled refresh (every 15 minutes) |

## Ethics and accuracy

This project is a **transparency aid**, not a replacement for official warnings. Prefer **primary institutions** (UN agencies, governments, verified civil defence) and treat all automated keyword matching as **imperfect**.

## License

You may use and modify this project for non‑harmful purposes. Data remains under the terms of each upstream source (GDACS, USGS, UN, etc.).
