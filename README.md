# SkillSwap MVP

A mobile app that lets young users exchange skills peer-to-peer using a time-credit system.

## Stack

| Layer | Tech |
|---|---|
| Mobile | React Native + Expo |
| API | Node.js + Express |
| Database | PostgreSQL 16 |
| Real-time | Socket.io |
| Auth | JWT (access + refresh rotation) |

## Repo structure

```
skillswap/
├── backend/          ← Node/Express API
│   ├── src/
│   │   ├── controllers/
│   │   ├── database/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   ├── socket/
│   │   └── utils/
│   ├── Dockerfile
│   └── package.json
├── mobile/           ← React Native / Expo (Sprint 1+)
├── database/         ← Extra migrations, seed scripts
├── docs/
├── docker-compose.yml
└── README.md
```

## Quick start (Docker)

```bash
# 1. Clone the repo
git clone https://github.com/ostrolawzyy-beep/skillswap.git
cd skillswap

# 2. Copy env
cp backend/.env.example backend/.env
# Edit JWT_SECRET and DB_PASSWORD in backend/.env

# 3. Start services
docker compose up -d

# 4. Run migrations
docker compose exec backend npm run migrate
```

## API endpoints (Sprint 1)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /health | — | Health check |
| POST | /api/v1/auth/register | — | Create account |
| POST | /api/v1/auth/login | — | Get tokens |
| POST | /api/v1/auth/refresh | — | Rotate refresh token |
| POST | /api/v1/auth/logout | — | Revoke refresh token |
| GET | /api/v1/profile/me | ✅ Bearer | Own profile |
| GET | /api/v1/profile/:userId | ✅ Bearer | Public profile |
| PUT | /api/v1/profile/me | ✅ Bearer | Update profile + photo |

## Sprint roadmap

- [x] **Sprint 1** — Setup, Auth, Profile
- [ ] **Sprint 2** — Skills, Availabilities, Search
- [ ] **Sprint 3** — Matching score, Exchanges, Chat
- [ ] **Sprint 4** — Credit system, Reviews, History
