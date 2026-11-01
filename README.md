# Trip Planner

Curated guides (things to do, dining, shopping), a hotel comparison and a shared day-by-day planner for any trip.
See [PLAN.md](PLAN.md) for the architecture, milestones and decisions.

**Status:** milestone 1 (port). The app renders the original Charleston trip from a test fixture
(`src/data/charleston.ts`). Plans are saved in the browser only.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Checks

- `npm test`: unit tests for the planner rules (availability, distances, holidays, initials).
- `npm run typecheck`: TypeScript.
- `npm run check:private`: fails if a name from the original family trip, or anything shaped like a secret key,
  is in a file that would be committed. It also runs automatically before every build, so a Vercel deploy fails
  instead of publishing it.

The original `charleston-reference.html` stays out of the repo on purpose (see `.gitignore`).
