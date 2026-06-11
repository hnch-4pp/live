---
name: Hunch /hunch routing
description: Why /hunch/* must be served by the static SPA, not the Express API server.
---

## Rule

`artifact.toml` for the API server must only list `paths = ["/api"]`.
Do NOT add `/hunch` (or any SPA route) to the API server's paths.

## Why

Replit's deployment sends SIGTERM to the API server every ~15 minutes.
During the ~15–30s restart window (before `/api/healthz` passes), any
path routed to Express returns nothing → blank white page for users.

The static file handler (hunches SPA) never restarts; it always serves
`index.html` for `/*` via the rewrite rule. So `/hunch/*` loads
reliably 100% of the time when served from the static handler.

## How to apply

- `/hunch/*` → static SPA (artifact.toml `paths = ["/api"]` only)
- OG/social bot previews → `/api/og/hunch/:slug` (Express, always under `/api`)
- If you need a new SPA-level route, keep it out of the API server paths
