Environment separation (dev vs prod)

- Development:
  - Use `.env.development` for local development. It is loaded by our wrapper `scripts/prisma-dev.sh` when running Prisma CLI.
  - Next.js also reads `.env.development` at runtime, so the app uses the same values.
  - Commands:
    - `npm run prisma:migrate:dev` → runs `prisma migrate dev` with variables from `.env.development`.
    - `npm run dev` → Next dev server.

- Production:
  - Do not commit real credentials. Do not use `.env` in production.
  - Provide `DATABASE_URL` via your hosting environment’s secrets/vars.
  - You may keep a `.env.production.example` (placeholder) in the repo for reference.
  - Commands in production:
    - `npm run prisma:deploy` → applies pending migrations using the environment’s `DATABASE_URL`.

Notes
- The legacy `.env` file is not used anymore for CLI workflows. Keep development values in `.env.development`.
- Never run `prisma migrate dev` against production. Use `prisma migrate deploy` in production.
- All application state (e.g., class→rooms mapping) is persisted server-side in the database.

