# ab ovo — Setup Guide

## Prerequisites
- Node.js 18+
- A free [Neon](https://neon.tech) PostgreSQL account (or any PostgreSQL)

## 1. Install dependencies
```bash
npm install
```

## 2. Configure environment
Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

**DATABASE_URL** — Get from [neon.tech](https://neon.tech) → New Project → Connection String (select "Prisma" mode for the correct format).

**JWT secrets** — Generate two secrets:
```bash
openssl rand -base64 64  # JWT_ACCESS_SECRET
openssl rand -base64 64  # JWT_REFRESH_SECRET
```

## 3. Set up the database
```bash
npx prisma migrate dev --name init
```

This creates all tables in your PostgreSQL database.

## 4. Run the dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and create your account.

---

## Deploy to Vercel (recommended, free tier)

1. Push to GitHub
2. Import project at [vercel.com](https://vercel.com)
3. Add environment variables in Vercel dashboard (same as `.env`)
4. Deploy — done

Vercel works perfectly with Neon PostgreSQL and Next.js.

---

## Install on your phone (PWA)

### iOS (Safari)
1. Open the app URL in Safari
2. Tap the Share button (box with arrow)
3. Tap "Add to Home Screen"
4. Tap "Add"

### Android (Chrome)
1. Open the app URL in Chrome
2. Tap the ⋮ menu → "Add to Home Screen"
3. Or wait for the install prompt banner

---

## Architecture

```
ab ovo/
├── app/
│   ├── (app)/          # Protected app pages
│   │   ├── page.tsx    # Dashboard/home
│   │   ├── recipes/    # Recipe list, detail, import, cook mode
│   │   ├── plan/       # Weekly meal planner
│   │   ├── grocery/    # Grocery lists
│   │   └── profile/    # User profile
│   ├── (auth)/         # Login & signup
│   ├── api/            # API routes
│   └── generated/      # Prisma client (auto-generated)
├── lib/
│   ├── auth.ts         # JWT + bcrypt auth helpers
│   ├── db.ts           # Prisma client singleton
│   ├── recipe-parser.ts # URL import / JSON-LD parsing
│   └── validators.ts   # Zod schemas
├── prisma/
│   └── schema.prisma   # Database schema
└── middleware.ts        # Route protection
```

## Auth design (security notes)

- Passwords: **bcrypt** with 12 rounds (OWASP recommended)
- Session: **dual-token** — short-lived access token (15min httpOnly cookie) + long-lived refresh token (30 days, stored as SHA-256 hash)
- Token rotation: every refresh issues a new refresh token; old one is revoked
- Token reuse detection: if a revoked refresh token is used, ALL user tokens are revoked
- Middleware: protects all non-public routes at the edge

## Phase 2 roadmap
- [ ] PDF/screenshot recipe import (OCR)
- [ ] Pantry tracking
- [ ] Nutrition analysis (USDA API)
- [ ] Substitution suggestions
- [ ] Shared household grocery lists
- [ ] Voice navigation in cook mode
