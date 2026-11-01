# Trip Planner: plan

Status: **planning only, nothing built yet.** Round 1 answers are in (section 4). A few follow-up questions are still open.

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

**Several reference sources wouldn't pass the curation rules**, mostly for activities:
- Viator listings ("rated 5.0 by every reviewer" is crowd-sourced): sweetgrass class, candle-making, wildlife photography.
- Tour operators' own pages used as the only source: the sweet treats tour, the Festival of Lights trolley, the chocolate class.
- Travel blogs and aggregators: thebettervacation.com, an OwnerRez rental-company blog, Travel Noire, Bite of the Best, OysterLink, Hotels Above Par.

Restaurants are well sourced (Michelin, James Beard, Resy, City Paper, Post and Courier). Your answer to question 4 (local papers and tourism boards count for experiences) brings many of the activities back, as long as the research finds that coverage.

---

## 2. Architecture

### The short version

This is the same stack as your WGI golf app, so the setup steps will feel familiar.

| Piece | Choice | Why, in plain terms |
|---|---|---|
| Hosting | **Vercel** | You already have it. Every push to a GitHub branch gets its own preview link automatically. The free Hobby plan covers this (it's for non-commercial use, which a free trip planner is). |
| Framework | **Next.js + React + TypeScript** | Vercel's own framework: pages and server code live in one project, and it's what WGI uses. |
| Styling | **Your existing CSS, ported almost as-is** | Keeps the look identical. Color tokens get neutral names (`--accent` instead of `--haint`) but keep the same values, light and dark. No Tailwind. |
| Database | **Neon Postgres + Prisma** | Same as WGI. Added from Vercel's Marketplace in a couple of clicks, with a free tier that's plenty here. (I'm not suggesting Supabase because its free projects pause after a week without visits, which is a bad fit for a site people open now and then.) |
| Rate limits and quotas | **Upstash Redis** | Also one click in the Vercel Marketplace, free tier. Counts research requests per visitor and tracks the daily spend cap. |
| Research jobs | **Next.js background tasks**, one per guide | Each research job has to finish within Vercel's time limit for a single server call (5 minutes on Hobby), so each guide gets its own job. The page shows progress ("Researching dining… 2 of 3"). |
| Bot protection | **Cloudflare Turnstile** | A free, mostly invisible "are you human" check that works on any host, including Vercel. It only needs a free key. |
| Shared validation | **Zod** schemas | One definition of a "card" that the server, the client and the tests all check against. |
| PDF summary | **@react-pdf/renderer**, in the browser | Builds a real PDF file on the visitor's own device, so it costs nothing to run and works on phones. |
| Tests | **Vitest** for the logic, **Playwright** for the browser | Playwright can check the acceptance list automatically: 400px width, dark mode, and links opened in a fresh private session. |

### How the pieces fit

```
Browser (Next.js app)
  ├─ Trip setup ─────────────► POST /api/trips            → creates trip, returns edit + view links
  ├─ Guides / map / planner ─► GET  /api/trips/:viewId    → trip + guides + plan
  ├─ Planner edits, own spots ► PUT/DELETE /api/trips/:id/...  (edit secret required)
  ├─ Download PDF ───────────► built in the browser, no server cost
  └─ "Research this trip" ───► POST /api/research (Turnstile + access code + quotas)
                                    │
Background job (one per guide) ─────┘
  1. Check the library/cache (destination + date window) → if found, done, $0
  2. Research with Claude + web search + web fetch → JSON cards
  3. Validate: schema, source rules, URL checks, geocode, dates
  4. Save to the library; the page picks up the results
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
  tier,                // credibility tier 1–4, used for ranking  (added, computed)
  origin               // "researched" | "yours"  (added: your own spots, see below)
}
```

Walk and drive times are **calculated** from the selected hotel, never stored. Walk = straight-line distance × 1.25 at 80 m/min. Past 25 minutes on foot it switches to a drive estimate, labeled "about N min drive (approx.)."

### Your own spots (new, from question 4)

Anyone with the edit link can add a place the guides don't list: name, type (do, eat or shop), address (we look it up for the map), when it's open (days and time slots, the same rules the planner enforces), an optional link and a note.

- These cards carry a clear **"Added by you"** label and never get credibility badges, since nobody vetted them. They have their own **"Your spots"** filter tab.
- They belong to that one trip only. They never go into the shared research library and other trips never see them, so no moderation is needed.
- They count as planner cards like any other, and a meal-type spot can only go in meal slots.

### Recommendation engine (milestone 4)

**The approach.** Each guide (Activities, Dining, Shopping) gets its own research run, plus a small one for hotel suggestions, room tax and date-specific events. Each run calls Claude on the Anthropic API with the **web search** and **web fetch** tools. The prompt contains your curation rules word for word, and the result must match the card schema.

**Validation pass.** This runs in our own server code, so the rules are enforced by code, not left to the AI.
1. **Schema check.** Anything malformed is dropped.
2. **Source check.** Each card needs at least one source in an accepted tier:
   - **Tier 1:** Michelin stars, James Beard awards, National Historic Landmarks, national park sites.
   - **Tier 2:** major national publications (Condé Nast Traveler, TIME, NYT, Bon Appétit, Food & Wine, Garden & Gun, Fodor's Choice, Afar), plus James Beard finalists, semifinalists and America's Classics, and Michelin Bib Gourmand and Recommended.
   - **Tier 3:** Resy Hit List, Eater, The Infatuation, and respected local critics and papers.
   - **Tier 4, experiences only** (tours, classes, events): an editorial feature from the official tourism board. A paid member directory listing doesn't count, since many tourism boards list every business that pays dues.
   - **Never accepted:** Yelp, Tripadvisor, TikTok, Instagram, and Viator or GetYourGuide ratings. A place's own website can supply hours and booking details, but never counts as the credibility source.
3. **"Did it actually read this?" check.** The source URL must be one the AI actually retrieved during that research run. This catches invented links.
4. **Link check.** Our server requests each URL. Some big publishers (Michelin, Resy) block automated checks, so a "403 Forbidden" from an accepted publisher the AI successfully read counts as OK. A 404 or a dead domain gets the card dropped.
5. **Geocode check.** We look up the address ourselves rather than trusting the AI's coordinates. If the result is far from the claimed neighborhood, the card is flagged.
6. **Date check.** Weekday closures become `byDow`, and seasonal or holiday closures become `dates`. A built-in holiday calendar triggers rule 8's reminder.
7. **Staleness check.** If the newest source is older than about 18 months, the Heads up gets "details may have changed."
8. Anything that fails is **dropped or shown as "unverified" in a separate, clearly labeled pile**, never mixed in with the verified picks.

**The research library (cache).** Research is saved so nobody pays for the same city twice:
- **Destination layer** (places, recognition, weekly hours), kept about 60–90 days. It's **not tied to your travelers**: it researches broadly across all interest tags, and personalization (ranking, "For Maria" tabs, "Good for") happens in the browser.
- **Date layer** (seasonal closures, events, holiday hours) for that specific date window. Small and cheap to refresh.
- "Refresh this guide" re-runs one guide, and it's rate-limited too.
- **Pre-researched destinations** (see question 2 in section 4): I can fill the library ahead of time from Claude Code sessions, under the same rules and validator, at no API cost.

**Ranking within each guide:** credibility tier first, then the number of traveler interests it matches, then distance from the selected hotel.

**Expected cost per newly researched trip** (my estimate; I'll measure real numbers on the Charleston run and put them in the README):

| Model | New destination | Same destination, new dates | Already in the library |
|---|---|---|---|
| Claude Opus 5.5 ($4 / $20 per million tokens in/out) | **~$5–9** | ~$0.75–1.50 | $0 |
| Claude Sonnet 5.5 ($2 / $10 per million tokens) | **~$2.50–4.50** | ~$0.40–0.80 | $0 |

Web searches add $10 per 1,000 searches, about $0.50–1.00 a trip, and that's already included above. Hosting, the database, maps and the PDF are $0 on free tiers.

**Protecting your bill**, in layers:
- A Turnstile check before any research.
- An **access code** for starting new research (see section 4). It's not a login.
- A **per-visitor quota** (per IP address and browser session, stored only as a short-lived hashed counter), e.g. 2 new destinations a day.
- A **global daily dollar cap**; past it, new research pauses until tomorrow and the library keeps working.
- A monthly spend limit you set yourself in the Anthropic Console, as a hard backstop.
- The API key lives only in Vercel's encrypted environment variables and is never sent to the browser. A test checks for this.

### Maps (milestone 5)

- **MapLibre GL** with **OpenFreeMap** tiles. They're free, need no API key and have no usage cap, and require an OpenStreetMap attribution, which we'll show. I picked MapLibre over Leaflet because its vector maps can be recolored to match your palette in both light and dark mode; Leaflet's image tiles can't really do dark mode.
- **Geocoding: Geoapify**, free up to 3,000 lookups a day, with the key kept on the server. Results are cached forever per address, so each place is looked up once. (I'll confirm their terms allow storing results before building.) Geoapify covers the whole world, so it's ready for international.
- Kept from the reference: numbered pins sorted by walking distance, the synced list (tap a pin or a row to expand it), hotel markers, 10- and 20-minute walk rings around the selected hotel, and "about an X-minute drive" rows for places too far to pin.

### Sharing, expiry and the PDF (milestone 6)

- Creating a trip gives you **two links**:
  - View link: `/t/<viewId>`
  - Edit link: `/t/<viewId>#edit=<secret>`
  - Both IDs are long and random, so they can't be guessed. The edit secret goes after the `#`, which browsers never send to servers or put in referrer headers. The app sends it only on save requests, and the database stores only a scrambled (hashed) copy.
- **Each placed card is saved as its own row** (same as the reference's per-card documents). Two people editing different cards never overwrite each other, and only edits to the *same* card are last-write-wins.
- **Auto-delete 90 days after check-out.** A nightly Vercel Cron job removes expired trips. Since there are no accounts or emails, the trip page shows a banner instead: "This trip will be deleted on Mar 30, 2027. Download the PDF to keep it."
- **Download PDF summary**, available from both links. It includes:
  - the trip, the travelers and the hotel picked
  - each day with who's going to what
  - each card's address, highlights, Heads up and source link
  - the holiday-hours reminder when it applies
- **Delete this trip now** (edit link only, confirms first) removes the trip, its plan, its travelers and its own spots right away.
- The only personal data stored is traveler first names and interests. No accounts, emails or analytics.

### Ready for international (from question 6)

v1 targets US destinations, but I'll avoid painting us into a corner:
- Each trip stores its country, currency and units.
- Dates and money are formatted with the browser's built-in locale tools.
- The holiday calendar uses a library that covers many countries.
- The source tiers are stored per region, so adding, say, UK or Italian publications later is a data change, not a rewrite.
- Michelin and Condé Nast already cover much of the world.

### Roadmap after v1

- **Compare stay options**: a neutral version of the hotel upgrade case and Plan A vs Plan B.
- Live sync between editors.
- Compare two date options (the reference's Dec 26–29 vs Dec 27–30 toggle).
- International destinations: per-country publications, currencies and holidays.
- Live hotel prices. This needs a booking partner such as Expedia or Booking.com, which requires approval and usually affiliate links.

---

## 3. Milestones

Each milestone ends with something working that you can open, and a local commit you push with GitHub Desktop.

1. **Port.** Rebuild the reference in Next.js, using the Charleston data as a fixture: one card list, placeholder travelers ("Traveler 1–3"), Marion Square hotels. Strip all personal content, and add an automatic check that fails if any of the family names, or anything shaped like an API key, ever shows up in committed files. Fix the Edmund's Oast bug. Plans are saved in your browser for now. **→ Your sign-off on look and feel.**
2. **Generalize.** Days come from the date range; traveler chips, initials, colors and "For [name]" tabs come from the traveler list (2–8 people); guides are drawn from the schema; ranking; hotel picker for distances. Unit tests for availability rules, the double-booking warning and walk/drive math.
3. **Trip setup and your own spots.** Destination, dates, travelers with interest tags and free text, optional hotels, rooms and budget comfort. Hotel comparison and calculator driven by the hotels you enter. The "Add your own spot" form.
4. **Recommendation engine.** Research jobs, validator, research library, access code, quotas, Turnstile, spend cap. Acceptance: Charleston, Dec 26–30, four travelers, side by side with the reference.
5. **Real map and geocoding.**
6. **Sharing.** Database, edit and view links, the PDF summary, 90-day auto-delete and "Delete this trip now."
7. **Deploy.** Production plus preview deploys on Vercel; README with setup, environment variables and real measured costs.

You'll need to do a few account steps yourself (I can't create accounts or enter payment details): add Neon and Upstash from the Vercel Marketplace, get an Anthropic API key with billing, a Turnstile key and a Geoapify key, and connect the GitHub repo to Vercel. I'll write click-by-click steps when we get there (milestones 4–7). Milestones 1–3 need none of this.

---

## 4. Decisions so far

| # | Question | Decision |
|---|---|---|
| 1 | Hosting | **Vercel** (same stack as WGI: Next.js, Neon, Prisma) |
| 2 | Model and budget | Open: cost explained, waiting on your choice (see below) |
| 3 | Access code | Open: explained, waiting on your choice |
| 4 | Tours and classes | **Accept respected local papers and tourism-board editorial coverage for experiences.** Plus **"Add your own spot"** for places not listed. |
| 5 | Hotel rates and table rows | Open: explained, waiting on your OK |
| 6 | Where | **US first**, built so international can be added soon |
| 7 | Old trips | **Auto-delete 90 days after check-out**, plus a **Download PDF summary** |
| 8 | Git | **Families' personal content stays out of the repo.** The repo is designed to be safe as public. |

### Still open

- **2. Which model, and on-demand research or a pre-researched library to start?**
  - (a) On-demand from day one, about $5–9 (Opus) or $2.50–4.50 (Sonnet) per new destination, billed to an Anthropic API account.
  - (b) Start with a library of destinations that I research ahead of time from Claude Code (covered by your Claude subscription, $0 in API charges), and add on-demand research later.
  - (c) Both: the library for everyone, and on-demand research behind the access code.
  - What daily cap feels right? I suggest $20.
- **3. Access code for new research at launch: yes or no?**
- **5. OK that you type in hotel rates, while the app looks up the room tax with a cited source? And OK with the generic table rows plus interest-driven extras?**
- **4, my reading:** the tourism-board exception applies to experiences only (tours, classes, events). Restaurants and shops keep the stricter list. Say so if you meant everything.
- **8, which GitHub account:** golf-outing lives under the WGI account. Should this one go there too, or under a personal account?
