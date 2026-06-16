<div align="center">
  <a href="https://github.com/jpdevhub/FreshScanAi">
    <img src="public/fish.gif" alt="FreshScan AI Logo" width="96" style="border-radius: 12px;" />
  </a>
  <h1 align="center">FreshScan AI</h1>
  <h3 align="center">
    Real-time fish freshness assessment using Edge AI — ensure consumer safety, vendor transparency, and minimize food waste.
    <br /><br>
    <a href="https://github.com/jpdevhub/FreshScanAi/issues/new?labels=bug">Report Bug</a>
    &middot;
    <a href="https://github.com/jpdevhub/FreshScanAi/issues/new?labels=feature">Request Feature</a>
  </h3>
</div>

<div align="center">

[![GitHub Stars](https://img.shields.io/github/stars/jpdevhub/FreshScanAi?style=for-the-badge&labelColor=1a1a2e&color=4f8ef7)](https://github.com/jpdevhub/FreshScanAi/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/jpdevhub/FreshScanAi?style=for-the-badge&labelColor=1a1a2e&color=4f8ef7)](https://github.com/jpdevhub/FreshScanAi/network/members)
[![MIT License](https://img.shields.io/badge/LICENSE-MIT-brightgreen?style=for-the-badge&labelColor=1a1a2e)](LICENSE)

</div>

---

## About

FreshScan AI analyzes three biologically-significant freshness markers — **gill**, **eye**, and **body** — to produce a single Freshness Index (0–100). Inference runs in under 50ms directly on-device, and anonymized scan data is aggregated onto an interactive Market Trust Map to surface reliable vendor locations.

---

## Tech Stack

| Category | Technology | Badges |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS | ![React](https://img.shields.io/badge/React_19-%2320232a.svg?style=flat-square&logo=react&logoColor=%2361DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?style=flat-square&logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-%23646CFF.svg?style=flat-square&logo=vite&logoColor=white) ![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-%2338B2AC.svg?style=flat-square&logo=tailwind-css&logoColor=white) |
| **Backend** | FastAPI, Python 3.12 | ![FastAPI](https://img.shields.io/badge/FastAPI-%23009688.svg?style=flat-square&logo=fastapi&logoColor=white) ![Python](https://img.shields.io/badge/Python_3.12-%233776AB.svg?style=flat-square&logo=python&logoColor=white) |
| **AI / ML** | PyTorch, Grad-CAM | ![PyTorch](https://img.shields.io/badge/PyTorch-%23EE4C2C.svg?style=flat-square&logo=pytorch&logoColor=white) ![Grad-CAM](https://img.shields.io/badge/Grad--CAM-Computer_Vision-blueviolet?style=flat-square) |
| **Database** | Supabase (Postgres + Auth + Storage) | ![Supabase](https://img.shields.io/badge/Supabase-%233ECF8E.svg?style=flat-square&logo=supabase&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-%23316192.svg?style=flat-square&logo=postgresql&logoColor=white) |
| **Deployment** | Vercel (frontend), Hugging Face Spaces (backend) | ![Vercel](https://img.shields.io/badge/Vercel-%23000000.svg?style=flat-square&logo=vercel&logoColor=white) ![Hugging Face](https://img.shields.io/badge/%F0%9F%A4%97_Hugging_Face-Spaces-FFD21E?style=flat-square) |

---

## Project Structure

```
FreshScanAi/
├── backend/               # FastAPI backend (inference, auth, history, vendors)
│   ├── main.py
│   ├── api/
│   ├── migrations/
│   └── requirements.txt
├── src/                   # React frontend
│   ├── components/
│   ├── pages/             # Scanner, Dashboard, MarketMap
│   ├── lib/               # API client and utilities
│   └── App.tsx
├── public/                # Static assets
├── Models/                # Pre-compiled PyTorch model weights
├── Training_Notebook/     # Model training pipelines (Jupyter)
├── scripts/               # Dev setup and backend start scripts
├── DOCUMENTATION.md       # Full architecture reference
└── CONTRIBUTING.md        # Contribution guidelines
```

---

## Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | v18 or later |
| Python | 3.12 or later |
| Git | Any recent version |

### Quick Start

```bash
git clone https://github.com/jpdevhub/FreshScanAi.git
cd FreshScanAi
npm run setup
npm run dev
```

Open `http://localhost:5173` and click **DEV LOGIN** to bypass Google OAuth locally.

The setup script detects your environment automatically:

| Environment | Database |
|---|---|
| No Docker | Shared dev Supabase (isolated by `user_id`) |
| Docker + Supabase CLI | Fully local Docker Supabase |

### Environment Variables

**Frontend** — copy `.env.example` to `.env.local`:

```env
VITE_API_URL=          # leave blank for local dev; Vite proxy handles /api/*
VITE_DEV_MODE=true     # enables DEV LOGIN button; never set true in production
VITE_TURNSTILE_SITE_KEY=  # Cloudflare Turnstile site key
```

**Backend** — copy `backend/.env.example` to `backend/.env`:

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_KEY=<auto-filled by npm run setup>
SUPABASE_SERVICE_KEY=
FRONTEND_URL=http://localhost:5173
API_BASE_URL=http://localhost:8000
TURNSTILE_SECRET_KEY=
DEV_BYPASS_AUTH=true   # never set true in production
```

> Note: When using production auth flows, set `VITE_TURNSTILE_SITE_KEY` in the frontend and `TURNSTILE_SECRET_KEY` in the backend. This enables Cloudflare Turnstile protection for auth endpoint requests.

> Authentication start requests are rate limited in the backend to 5 requests per minute. Invalid or missing Turnstile tokens are rejected with a standard 400 response.

### Available Scripts

| Script | Description |
|---|---|
| `npm run setup` | Install dependencies, write `.env.local` (frontend) & `.env` (backend), optionally start local Supabase |
| `npm run dev` | Start frontend and backend concurrently |
| `npm run build` | Production build (TypeScript + Vite) |
| `npm run lint` | Run ESLint across the codebase |
| `npm run supabase:start` | Start local Supabase Docker containers |
| `npm run supabase:stop` | Stop local Supabase Docker containers |
| `npm run supabase:reset` | Wipe and re-apply migrations with seed data |

### What Works Out of the Box

| Feature | Status |
|---|---|
| Full UI | `localhost:5173` |
| Google OAuth | Bypassed via DEV LOGIN button |
| Fish scanning | Demo mode — random scores, no `.pth` files needed |
| Grad-CAM heatmap | Synthetic overlay (PIL only) |
| Scan history / DB | Local Docker or shared dev Supabase |
| Market map | Pre-seeded with 8 Kolkata fish markets |
| Real ML inference | Optional — set `MODEL_DIR` in `backend/.env` |

---

## Production Deployment

| Service | Role | URL |
|---|---|---|
| Vercel | React SPA | https://fresh-scan-ai-sage.vercel.app |
| Hugging Face Spaces | FastAPI + PyTorch | https://karansingh12-freshscan-api.hf.space |
| Supabase | Auth, database, storage | Your project dashboard |

### Vercel — Environment Variables

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://karansingh12-freshscan-api.hf.space` |

### Hugging Face Space — Repository Secrets

| Secret | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Anon/public key |
| `SUPABASE_SERVICE_KEY` | Service role key |
| `FRONTEND_URL` | `https://fresh-scan-ai-sage.vercel.app` |
| `API_BASE_URL` | `https://karansingh12-freshscan-api.hf.space` |
| `HF_MODEL_REPO` | `karansingh12/freshscan-models` |
| `MODEL_TOKEN` | HF token for private model repo |

The Space runs via `Dockerfile` + `startup.sh`. Models are downloaded from HF Hub automatically at container start.

### Supabase — URL Configuration (one-time)

In Authentication → URL Configuration, add:

| Setting | Value |
|---|---|
| Site URL | `https://fresh-scan-ai-sage.vercel.app` |
| Redirect URLs | `http://localhost:5173/**`, `https://fresh-scan-ai-sage.vercel.app/**` |

---

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

1. Fork the repository
2. Create a branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: description"`
4. Push to your fork: `git push origin feat/your-feature`
5. Open a pull request against `main`

For larger changes, open an issue first to discuss your approach.

---

## Contact

| Channel | Handle / Address |
|---|---|
| Discord | `Razen04` |
| Email | karanrathore23@zohomail.in |

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
