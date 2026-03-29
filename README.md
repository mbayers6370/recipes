# ab ovo

`ab ovo` is a recipe app for saving recipes, planning meals, building grocery lists, and cooking from a clean step-by-step view.

It is built with Next.js, Prisma, PostgreSQL, and a small PWA layer so it can be installed on a phone.

## Features

- Save recipes and organize them by type
- Import recipes from URLs, pasted text, and screenshots
- Plan meals by day and meal type
- Add recipe ingredients to a grocery list
- Use cook mode with inline step timers
- Install the app on iPhone or Android

## Tech Stack

- Next.js 16
- React 19
- Prisma
- PostgreSQL / Neon
- Zod
- Lucide React

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Copy the environment file

```bash
cp .env.example .env
```

3. Fill in your database URL and JWT secrets in `.env`

4. Run migrations

```bash
npm run db:migrate
```

5. Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run db:migrate
npm run db:generate
npm run db:studio
```

## Project Structure

```text
app/
  (app)/        Authenticated pages
  (auth)/       Login and signup
  api/          API route handlers
  offline/      Offline fallback page
components/     Shared components
context/        React context providers
lib/            Helpers, parsers, auth, validators
prisma/         Schema and migrations
public/         Static and PWA assets
types/          Shared TypeScript types
```

## Deployment

Vercel is the easiest deployment target for this project.

1. Push the repo to GitHub
2. Import the repo into Vercel
3. Add the environment variables from `.env`
4. Deploy

## Notes

- PWA install support is configured in `public/manifest.json` and `public/sw.js`
- Auth uses cookie-based access and refresh tokens
- Imported recipes are normalized into local app data so the app does not depend on third-party websites at read time

## Setup Guide

For the full setup flow, environment variable details, and deployment notes, see [SETUP.md](./SETUP.md).
