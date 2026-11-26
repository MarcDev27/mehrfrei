# Mehrfrei – Fenstertage & Brückentage 2027

A static website with 170 indexable pages: Austria and Germany in German and English; Switzerland in German, English, French and Italian. It covers all 9 Austrian states, 16 German states and 26 Swiss cantons, plus homepages and a product page per language. Switzerland currently has public holidays only; Swiss school holidays are often set by municipalities and are not included yet. Every page includes an interactive leave planner. No server, no database, no cookies.

## Going live (about 30 minutes)

1. **Domain:** buy one and replace `baseUrl` in `config.json`. You can also replace `siteName`.
2. **Imprint:** fill in `owner` in `config.json`. An imprint (Impressum) is mandatory in Austria. Also review the privacy policy text on `/datenschutz/`.
3. **Hosting:** the repository is connected to Netlify, which runs `node build.js` on every push to `main` and publishes `dist/` (see `netlify.toml`). No manual uploads.
4. **Local build (optional):** `node build.js` writes the whole site to `dist/`. Node.js 18 or newer, no npm packages needed.
5. **Google Search Console:** verify the domain and submit `https://<domain>/sitemap.xml`. Do the same in Bing Webmaster Tools, which also feeds ChatGPT and Copilot search.
6. **Turn off ad placeholders:** set `showAdPlaceholders` to `false` until AdSense is approved.

## Monetization

- **Google AdSense:** apply once the site is live with real content. After approval, enter `ca-pub-…` as `adsenseClient` and rebuild. The ad slots and `ads.txt` are generated automatically. In the EU you need a Google-certified consent banner. Google's own one, under "Privacy & messaging" in AdSense, is free.
- **Journey by Mediavine:** pays more than AdSense and becomes available at about 1,000 sessions a month from Tier 1 countries.
- **Paid planner:** enter the product URL as `product.url` and rebuild. Use Lemon Squeezy, Gumroad or Paddle. As "merchant of record" they handle EU VAT for you.

## Yearly update (November)

1. Set `year` in `config.json` to the next year.
2. Add `data/school-<year>.json` with the school holidays. Sources: BMBWF for Austria, the KMK holiday calendar (PDF) for Germany.
3. Commit and push; Netlify rebuilds automatically. Public holidays are calculated automatically from the rules in `data/at.json` and `data/de.json`.

## Adding a country

Create `data/<cc>.json` in the same format as `at.json`: regions, holiday rules (fixed date, Easter offset or special function), and URL paths. Add school holiday periods to the school file. Then add the country code to `countries` in `config.json`. For wording that differs by country (e.g. Swiss "Ferientage"), see the overrides in `engine/strings.js` and `swissify()` in `build.js`. The engine (`engine/core.js`) needs no changes.

## Structure

- `engine/core.js`: holiday rules, Easter calculation, optimizer (exact dynamic programming), formatting. The same file runs in Node and in the browser.
- `engine/render.js` and `engine/strings.js`: planner HTML and text, shared by the build and the browser.
- `assets/app.js`: interactivity. It also syncs settings to the URL (`?u=12&f=1`) so a plan can be shared, and exports the plan as an .ics calendar file.
- `build.js`: generates the pages, sitemap with hreflang, `robots.txt`, `llms.txt`, JSON-LD (FAQ, breadcrumbs, WebApplication) and `404.html`.

## Netlify free plan

New Netlify accounts get 300 credits a month on the free plan. A production deploy costs 15 credits and bandwidth costs 20 credits per GB. When the credits run out, the site pauses until the next month. So batch changes into a few pushes. Once traffic grows, upgrade to Personal ($9 a month) before you reach the limit.

## Languages

`config.json` → `languages` sets which languages each country is published in. German and English text lives in `build.js`, in the region, country and home page functions. French and Italian page text lives in the `RO` object in `build.js`. Planner text for all languages is in `engine/strings.js`, and date formats are in `engine/core.js`. Holiday names and notes come from the data files, with one entry per language.
