# Trip Planner: plan

Status: **planning only, nothing built yet.** Waiting on the questions at the bottom.

This turns `charleston-reference.html` into a general trip planner: anyone enters a destination, dates and travelers, and gets curated Activity, Dining and Shopping guides, a map, and a shared day planner.

---

## 1. What I found in the reference page

I read all 2,059 lines. Everything on your "keep" list is there and works the way you described. Some details matter for the rebuild:

**How it's built today**
- The **dining guide** is data-driven: it renders from one list of cards (`CARDS`), so the planner and the guide always agree.
- The **activity and shopping guides** are typed out by hand as HTML, and each one also has a second, shorter copy in `CARDS` for the planner. The two copies sometimes disagree. In the new app every place is **one card**, and the guide, map and planner all draw from it.
- Availability rules work exactly as you described: `slots`, `dates`, and `byDow` (per-weekday slots), plus meals-only and no-meals rules, duplicate blocking, and a "why not" reason.
- Walk times are measured from **Marion Square**, not from the chosen hotel. The new app measures from whichever hotel you pick.
- Places past 25 minutes on foot show "Short drive (N min on foot)" or a hand-written `off` note. Rule 6 asks for a real drive estimate, so I'll calculate one.
- Room tax is fixed at 14%, the hotel rates are typed in, and the shop count is hardcoded as "17 shops."

**A bug worth knowing about.** On the Edmund's Oast card, the highlights and the Heads up were typed *inside* the weekday rules by mistake (line 1258). The planner never shows them, and the weekday rules pick up junk entries. I'll fix this in the port.

**Several reference sources wouldn't pass your own curation rules.** This matters because the acceptance check compares the new app with the reference.
- Viator listings ("rated 5.0 by every reviewer" is crowd-sourced): sweetgrass class, candle-making, wildlife photography.
- Tour operators' own pages used as the only source: the sweet treats tour, the Festival of Lights trolley, the chocolate class.
- Travel blogs and aggregators: thebettervacation.com, an OwnerRez rental-company blog (breweries), Travel Noire, Bite of the Best, OysterLink, Hotels Above Par.
- These are mostly activities. Restaurants are well sourced (Michelin, James Beard, Resy, City Paper, Post and Courier).

Under rule 1, the generator would drop most tours and classes unless a credible publication has covered them. See question 4.

---

## 2. Recommended architecture

### The short version

| Piece | Choice | Why, in plain terms |
|---|---|---|
| Hosting | **Cloudflare** (Workers + static assets) | One account covers the site, the database, bot protection, rate limiting and the long-running research jobs. Each push to a GitHub branch gets its own preview link. The free tier is generous; the $5/month plan removes a tight CPU limit and is what I'd use before going public. |
| Front end | **React + Vite + TypeScript** | React is the most widely used way to build interactive pages, so help and examples are easy to find, and splitting the page into components (card, slot, day, map) makes it easier to change later. Vite is the build tool and makes a plain static site. |
| Styling | **Your existing CSS, ported almost as-is** | Keeps the look identical. Color tokens get neutral names (`--accent` instead of `--haint`) but keep the same values, light and dark. No Tailwind. |
| API | **Hono** on the same Cloudflare Worker | A small, fast web framework for the handful of server endpoints. |
| Database | **Cloudflare D1** (SQLite) | Stores trips, plans and the guide cache. Plenty for this, and it's in the same account. |
| Long research jobs | **Cloudflare Workflows** | Research takes a few minutes. Workflows run step by step with automatic retries, so a slow web search never times out a page load. |
| Bot protection | **Cloudflare Turnstile** | A free, mostly invisible "are you human" check, required before any paid research runs. |
| Live sync (later) | **Durable Objects** | When we add live two-person editing, this is Cloudflare's built-in tool for it, so we won't need to change hosts. |
| Shared validation | **Zod** schemas | One definition of a "card" that the server, the client and the tests all check against. |
| Tests | **Vitest** for the logic, **Playwright** for the browser | Playwright can check the acceptance list automatically: 400px width, dark mode, and links opened in a fresh private session. |

**Alternative: Vercel + Next.js + Supabase.** This is just as reasonable and has more tutorials. Its downsides here are three separate accounts, function time limits that the long research jobs would hit (so we'd need a separate job queue), and a free plan that's limited to non-commercial use. I'd only pick it if you already use Vercel or Supabase.

### How the pieces fit

```
Browser (React app)
  ├─ Trip setup ─────────────► POST /api/trips            → creates trip, returns edit + view links
  ├─ Guides / map / planner ─► GET  /api/trips/:viewId    → trip + guides + plan
  ├─ Planner edits ──────────► PUT/DELETE /api/trips/:id/placements/:pid  (edit token required)
  └─ "Research this trip" ───► POST /api/generate (Turnstile + quotas) → starts a Workflow
                                    │
Cloudflare Workflow ────────────────┘
  1. Check cache (destination + date window) → if fresh, done, $0
  2. Research each guide with Claude + web search + web fetch → JSON cards
  3. Validate: schema, source allowlist, URL checks, geocode, dates
  4. Save to cache; client polls for progress ("Researching dining… 2 of 3")
```

### Card model

The schema you listed, plus a few fields the reference already relies on:

```ts
Card {
  id, kind: "do" | "eat" | "shop",
  title, area, addr, lat, lon,
  cuisine?,            // or type, for activities and shops
  price?,              // "$$$" or "$65 / person", only when sourced
  when,                // short timing line, e.g. "Leaves 5 pm, about 3 hours"  (added: reference uses it everywhere)
  badges[],            // "Michelin star", "James Beard semifinalist 2026"
  stars[],             // 1–2 highlights
  con?,                // Heads up
  link,                // primary source
  sources[],           // { url, publisher, published?, checkedAt, status }  (added)
  slots[], dates[], byDow{},   // availability rules, unchanged
  cats[],              // guide filter tabs (michelin, beard, classic, new, drinks, gifts…)
  interests[],         // which interest tags it serves → "Good for: Maria, Dev"
  misc,                // "No booking needed"
  check,               // "Confirm days when booking"
  hotelId?,            // card only applies when staying at that hotel (room service, hotel spa)  (added)
  tier                 // credibility tier 1–3, used for ranking  (added, computed)
}
```

Walk and drive times are **calculated** from the selected hotel, never stored. Walk = straight-line distance × 1.25 at 80 m/min. Past 25 minutes on foot it switches to a drive estimate, labeled "about N min drive (approx.)."

### Recommendation engine (milestone 4)

**The approach.** Each guide (Activities, Dining, Shopping) gets its own research run, plus a small one for hotel suggestions and date-specific events. Each run calls Claude on the Anthropic API with the **web search** and **web fetch** tools. The prompt contains your curation rules word for word, and the result must match the card schema (structured output).

**Validation pass.** This runs on our server, not in the model, so the rules are enforced by code.
1. **Schema check.** Anything malformed is dropped.
2. **Source check.** Each card needs at least one source from an **allowlist** of credible publishers: Michelin, jamesbeard.org, Condé Nast Traveler, TIME, NYT, Bon Appétit, Food & Wine, Garden & Gun, Fodor's, Afar, Resy, Eater, The Infatuation, nps.gov, and similar. Local papers and critics get their own tier and are checked case by case. A **blocklist** covers Yelp, Tripadvisor, TikTok, Instagram, Viator and GetYourGuide reviews, and similar. A place's own website can supply hours and booking details, but it never counts as the credibility source.
3. **"Did it actually read this?" check.** The source URL must be one the model actually retrieved during that research run. This catches invented links.
4. **Link check.** Our server requests each URL. Some big publishers (Michelin, Resy) block automated checks, so a "403 Forbidden" from an allowlisted publisher that the model successfully read counts as OK. A 404 or a dead domain gets the card dropped.
5. **Geocode check.** We look up the address ourselves rather than trusting the model's coordinates. If the result is far from the claimed neighborhood, the card is flagged.
6. **Date check.** Weekday closures become `byDow`, and seasonal or holiday closures become `dates`. A built-in holiday calendar triggers rule 8's reminder.
7. **Staleness check.** If the newest source is older than about 18 months, the Heads up gets "details may have changed."
8. Anything that fails is **dropped or shown as "unverified" in a separate, clearly labeled pile**, never mixed in with the verified picks.

**Caching** comes in two layers, so repeat trips are nearly free:
- **Destination layer** (places, recognition, weekly hours), kept about 60–90 days. It's **not tied to your travelers**: it researches broadly across all interest tags, and personalization (ranking, "For Maria" tabs, "Good for") happens in your browser. Without this, every new group would pay for fresh research.
- **Date layer** (seasonal closures, events, holiday hours) for that specific date window. This one is small and cheap to refresh.
- "Refresh this guide" re-runs one guide. It's rate-limited too.

**Ranking within each guide:** credibility tier first (Michelin star, James Beard award, landmark), then the number of traveler interests it matches, then distance from the selected hotel.

**Expected cost per newly researched trip** (my estimate; I'll measure real numbers on the Charleston run and put them in the README):

| Model | New destination | Same destination, new dates | Repeat (cached) |
|---|---|---|---|
| Claude Opus 5.5 ($4 / $20 per million tokens in/out) | **~$5–9** | ~$0.75–1.50 | ~$0 |
| Claude Sonnet 5.5 ($2 / $10 per million tokens) | **~$2.50–4.50** | ~$0.40–0.80 | ~$0 |

Web searches add $10 per 1,000 searches, about $0.50–1.00 a trip, and that's already included above. Web fetch costs only the tokens it reads. Most of the cost is the search results the model reads.

**Protecting your bill**, in layers:
- A Turnstile check before any research.
- A **per-visitor quota** (per IP address and browser session, stored only as a short-lived hashed counter), e.g. 2 new destinations a day.
- A **global daily dollar cap** that the server tracks; past it, new research pauses until tomorrow and cached destinations still work.
- A monthly spend limit you set yourself in the Anthropic Console, as a hard backstop.
- The API key lives only in Cloudflare's encrypted secrets and is never sent to the browser. A test checks for this.

### Maps (milestone 5)

- **MapLibre GL** with **OpenFreeMap** tiles. They're free, need no API key and have no usage cap, and require an OpenStreetMap attribution, which we'll show. I picked MapLibre over Leaflet because its vector maps can be recolored to match your palette in both light and dark mode; Leaflet's image tiles can't really do dark mode.
- **Geocoding: Geoapify**, free up to 3,000 lookups a day, with the key kept on the server. Results are cached forever per address, so each place is looked up once. (I'll confirm their terms allow storing results before building.)
- Kept from the reference: numbered pins sorted by walking distance, the synced list (tap a pin or a row to expand it), hotel markers, 10- and 20-minute walk rings around the selected hotel, and "about an X-minute drive" rows for places too far to pin.

### Sharing (milestone 6)

- Creating a trip gives you **two links**:
  - View link: `/t/<viewId>`
  - Edit link: `/t/<viewId>#edit=<secret>`
  - Both IDs are long and random, so they can't be guessed. The edit secret goes after the `#`, which browsers never send to servers or put in referrer headers. The app sends it only on save requests, and the database stores only a scrambled (hashed) copy.
- **Each placed card is saved as its own row** (same as the reference's per-card documents). Two people editing different cards never overwrite each other, and only edits to the *same* card are last-write-wins.
- **Delete this trip** (edit link only, confirms first) removes the trip, its plan and its travelers right away.
- The only personal data stored is traveler first names and interests. No accounts, emails or analytics.

### Roadmap after v1

- **Compare stay options**: a neutral version of the hotel upgrade case and Plan A vs Plan B.
- Live sync between editors (Durable Objects).
- Compare two date options (the reference's Dec 26–29 vs Dec 27–30 toggle).
- Print or PDF itinerary.

---

## 3. Milestones

Each milestone ends with something working that you can open, and a local commit you push with GitHub Desktop.

1. **Port.** Rebuild the reference as React components, using the Charleston data as a fixture: one card list, three traveler placeholders ("Traveler 1–3"), Marion Square hotels. Strip all personal content (names, the grief framing, the letter, Buck, the persuasion sections, Plan A/B). Fix the Edmund's Oast bug. Plans are saved in your browser for now. **→ Your sign-off on look and feel.**
2. **Generalize.** Days come from the date range; traveler chips, initials, colors and "For [name]" tabs come from the traveler list (2–8 people); guides are drawn from the schema; ranking; hotel picker for distances. Unit tests for availability rules, the double-booking warning and walk/drive math.
3. **Trip setup.** Destination, dates, travelers with interest tags and free text, optional hotels, rooms and budget comfort. Hotel comparison and calculator driven by the hotels you enter.
4. **Recommendation engine.** Research workflow, validator, cache, quotas, Turnstile, spend cap. Acceptance: Charleston, Dec 26–30, four travelers, side by side with the reference.
5. **Real map and geocoding.**
6. **Sharing.** Database, edit and view links, delete trip.
7. **Deploy.** Production plus preview deploys; README with setup, environment variables and real measured costs.

You'll need to do a few account steps yourself (I can't create accounts or enter payment details): a Cloudflare account, an Anthropic API key with billing, a Geoapify key, and connecting the GitHub repo to Cloudflare. I'll write exact click-by-click steps when we get there (milestones 4–7). Milestones 1–3 need none of this.

---

## 4. Open questions

1. **Hosting:** OK to go with Cloudflare? Or do you already have Vercel or Supabase accounts you'd rather use?
2. **Model and budget:** Claude Opus 5.5 (best research quality, ~$5–9 per new destination) or Claude Sonnet 5.5 (~half that)? I can also build it so the model is a one-line setting and we compare both on Charleston. And what daily spend cap feels right? I'd suggest starting at $20/day with 2 new destinations per visitor per day.
3. **Who can trigger paid research at launch?** Fully open to anyone, or behind a simple shared access code (not a login) until you've seen real costs? I'd suggest the access code first.
4. **Tours and classes vs rule 1:** Applied strictly, rule 1 drops most bookable tours and classes (chocolate class, sweetgrass class, candle-making, photo walk), because their only "proof" is Viator ratings or the operator's own site. Keep the rule strict, or allow an exception for experiences covered by a respected local paper or a tourism board? (I'd still never use crowd-sourced ratings.)
5. **Hotel rates and room tax:** Rule 3 says never invent prices. I'd suggest that **you type in the nightly rates** (the app links to each hotel's booking page), and the app **researches the local room tax with a cited source** that you can edit. OK? And for the comparison rows, the reference's are feel, spa, rooftop, sweets, dining, pool, recognition and rate. I'd make them generic (feel, spa, rooftop or bar, food and drink, pool, recognition, rate) and add a row for an interest when a traveler has it, such as "Sweets." OK?
6. **Where in the world:** US destinations first (dollars, miles, US holidays, the US-heavy publication list), or international from day one? International needs local credible sources per country, currencies and local holidays, which is doable but adds work to milestone 4.
7. **Old trips:** Auto-delete trips some time after the trip ends (say 90 days), or keep them until someone clicks Delete?
8. **The reference file in git:** It contains your family's personal content, and GitHub repos are often public. I've set up `.gitignore` to keep `charleston-reference.html` **out** of the repo; only the stripped Charleston fixture will be committed. OK? And is the repo going to be public or private?

Smaller defaults I'll use unless you say otherwise: trips up to 14 nights; the Charleston color palette stays the default for every destination; the reference's two-date-option toggle is dropped for now (see Roadmap); the site launches on a free `*.workers.dev` address until you pick a domain.
