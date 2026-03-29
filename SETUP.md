# ab ovo — Setup Guide

## Prerequisites

- Node.js 18+
- A PostgreSQL database
- A free [Neon](https://neon.tech) database works well for this project

## 1. Install dependencies

```bash
npm install
```

## 2. Create your local environment file

```bash
cp .env.example .env
```

Fill in these values:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `NEXT_PUBLIC_APP_URL`

### Environment variable notes

`DATABASE_URL`
: Use a PostgreSQL connection string. If you use Neon, choose the Prisma/Postgres connection string.

`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
: Generate two different secrets:

```bash
openssl rand -base64 64
openssl rand -base64 64
```

`NEXT_PUBLIC_APP_URL`
: Use `http://localhost:3000` for local development.

Important:
: Do not set `NODE_ENV` manually in `.env`. Next.js handles that for you.

## 3. Run the database migrations

```bash
npm run db:migrate
```

If you need to regenerate Prisma client manually:

```bash
npm run db:generate
```

If you want to inspect the database in a UI:

```bash
npm run db:studio
```

## 4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and create an account.

## Deploy to Vercel

Vercel is the easiest host for this repo.

1. Push the repo to GitHub
2. Import the repo into Vercel
3. Add these environment variables in the Vercel dashboard:
   - `DATABASE_URL`
   - `JWT_ACCESS_SECRET`
   - `JWT_REFRESH_SECRET`
   - `NEXT_PUBLIC_APP_URL`
4. Deploy

For production, set:

- `NEXT_PUBLIC_APP_URL` to your real Vercel URL or custom domain

## Install on Your Phone

### iPhone

1. Open the deployed app in Safari
2. Tap the Share button
3. Tap `Add to Home Screen`

### Android

1. Open the deployed app in Chrome
2. Tap `Add to Home screen` or `Install app`

## Project Layout

```text
app/
  (app)/        Authenticated product pages
  (auth)/       Login and signup
  api/          API route handlers
  offline/      Offline fallback page
components/     Shared components
context/        React providers
lib/            Auth, parsers, validators, utilities
prisma/         Schema and migrations
public/         Static and PWA assets
types/          Shared TypeScript types
```

## App Notes

- Auth uses cookie-based access and refresh tokens
- The app is configured as a PWA
- Recipe imports are parsed and normalized into local app data
- The route guard lives in `proxy.ts`
