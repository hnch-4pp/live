# Hunches

A skill-based prediction platform where users predict outcomes of sports, music, entertainment, and finance events to win real prizes — Amazon gift cards, Starbucks cards, and branded merch. No money wagered.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/hunches run dev` — run the frontend (port 20921)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (artifacts/hunches), wouter routing, React Query, Tailwind CSS
- API: Express 5 (artifacts/api-server)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → lib/api-spec/openapi.yaml)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle table definitions: categories, prizes, hunches, options, predictions
- `artifacts/api-server/src/routes/` — Express route handlers (hunches.ts, categories.ts, health.ts)
- `artifacts/hunches/src/` — React frontend (pages, components)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks
- `lib/api-zod/src/generated/api.ts` — generated Zod validation schemas

## Architecture decisions

- Contract-first API: OpenAPI spec drives both server-side Zod validation and client-side React Query hooks via Orval codegen
- `buildHunch()` helper in hunches router assembles full hunch objects by joining categories, prizes, and options
- Categories are stored with a color and icon slug for frontend rendering
- Prediction submission increments the hunch's participantCount inline (no separate aggregation job)
- Auth is UI-only (login/signup pages exist as forms but no real session/JWT layer yet)

## Product

- **Home**: Hero with live stats, featured hunches carousel, full browsable list with category filters
- **Hunch Detail**: Full description, countdown timer, community prediction percentages, "Make your Hunch" CTA
- **Login / Signup**: Auth form UI (no backend auth yet)
- **Legal pages**: Terms & Conditions, Privacy Policy, Responsible Play

## User preferences

- No emojis in the UI
- This is a prediction platform, NOT betting/gambling — legal footer must always clarify this
- Prizes are preset (gift cards, merch) — no money wagered

## Gotchas

- After editing DB schema, run `pnpm run typecheck:libs` to rebuild composite libs before typechecking the API server
- After any OpenAPI spec change, re-run codegen before using updated hooks/schemas
- `buildHunch()` does N+1 queries — acceptable for now given dataset size, optimize with joins if load increases
- The `/hunches/featured` and `/hunches/stats` routes must be registered BEFORE `/hunches/:id` in Express or the `:id` param captures them

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
