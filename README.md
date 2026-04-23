<p align="center">
  <img src="public/fish.gif" alt="FreshScan AI Logo" width="96" height="96" style="border-radius: 12px;" />
</p>

<h1 align="center">FreshScan AI</h1>

<p align="center">
  Real-time fish freshness assessment using Edge AI. Ensure consumer safety, vendor transparency, and minimize food waste.
</p>

<p align="center">
  <a href="https://github.com/gloooomed/FreshScan/issues/new?labels=bug">Report Bug</a>
  ·
  <a href="https://github.com/gloooomed/FreshScan/issues/new?labels=enhancement">Request Feature</a>
</p>

<p align="center">
  <a href="https://github.com/gloooomed/FreshScan/stargazers">
    <img src="https://img.shields.io/github/stars/gloooomed/FreshScan?style=for-the-badge&labelColor=1a1a2e&color=4f8ef7&label=STARS" alt="Stars" />
  </a>
  <a href="https://github.com/gloooomed/FreshScan/forks">
    <img src="https://img.shields.io/github/forks/gloooomed/FreshScan?style=for-the-badge&labelColor=1a1a2e&color=4f8ef7&label=FORKS" alt="Forks" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/LICENSE-MIT-brightgreen?style=for-the-badge&labelColor=1a1a2e" alt="License" />
  </a>
</p>

---

## What it does

- **Dual-Stream AI Engine** - Analyzes three biologically-significant freshness markers (gill, eye, and body) to distill into a single actionable Freshness Index (0–100).
- **Real-Time Camera Scanning** - Specialized inference (< 50ms) runs directly on device, providing instant freshness grades and explainable reports.
- **Market Trust Map** - Aggregates and overlays anonymized scan data onto a live, interactive map to visualize reliable vendor locations globally.

---

## Tech Stack

| Category | Technology |
|---|---|
| Frontend | [![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev) [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org) |
| Backend | [![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com) [![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org) |
| AI / ML | [![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)](https://pytorch.org) |
| Core UI | [![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev) [![TailwindCSS](https://img.shields.io/badge/TailwindCSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com) |
| Infra | [![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com) |

---

## Getting Started

### Fast path (2 commands)

```bash
git clone https://github.com/gloooomed/FreshScan.git
cd FreshScan
npm run setup   # installs everything, writes .env, optionally starts local Supabase
npm run dev
```

Open **http://localhost:5173** → click **⚡ DEV LOGIN** → you're in.

The `setup` script auto-detects your environment and picks the right DB path:

| Your setup | DB used | Isolation |
|-----------|---------|-----------|
| No Docker / no Supabase CLI | Shared dev Supabase (anon key) | Isolated by `user_id` |
| Docker + Supabase CLI installed | **Fully local Docker Supabase** | Completely isolated |

### Full local Supabase (recommended for contributors)

If you want a completely private database with no shared keys:

```bash
# Install prerequisites (once)
brew install supabase/tap/supabase
# Start Docker Desktop, then:

npm run setup          # starts local Supabase, applies migrations + seed
npm run dev
```

The setup script writes `backend/.env` automatically with the local Docker credentials.  
You can also manage Supabase manually:

```bash
npm run supabase:start   # start local Supabase containers
npm run supabase:reset   # wipe + re-apply migrations and seed data
npm run supabase:stop    # stop containers
```

Local Supabase Studio (DB admin UI) → http://localhost:54323

### What works out of the box

| Feature | Status |
|---------|--------|
| Full UI | `localhost:5173` |
| Google OAuth | Bypassed — ` DEV LOGIN` button |
| Fish scanning | Demo mode — random scores, no `.pth` files needed |
| Grad-CAM heatmap | Synthetic overlay (PIL only) |
| Scan history / DB | Local Docker **or** shared dev Supabase |
| Market map | Pre-seeded with 8 Kolkata fish markets |
| Real ML inference | Optional — uncomment `MODEL_DIR` in `backend/.env` |

---

## Production Deployment

The production stack is:

| Service | Role | URL |
|---------|------|-----|
| **Vercel** | React SPA (static) | https://fresh-scan-ai-sage.vercel.app |
| **Hugging Face Spaces** | FastAPI + PyTorch backend | https://karansingh12-freshscan-api.hf.space |
| **Supabase** | Auth + database + storage | Your project dashboard |

### Supabase Dashboard (one-time)

Go to **Authentication → URL Configuration** and add:

| Setting | Value |
|---------|-------|
| Site URL | `https://fresh-scan-ai-sage.vercel.app` |
| Redirect URLs | `http://localhost:5173/**` |
| | `https://fresh-scan-ai-sage.vercel.app/**` |

### Vercel — Environment Variables

Add in **Project → Settings → Environment Variables**:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://karansingh12-freshscan-api.hf.space` |

### Hugging Face Space — Repository Secrets

Add in **Space → Settings → Repository secrets**:

| Secret | Value |
|--------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Anon/public key |
| `SUPABASE_SERVICE_KEY` | Service role key |
| `FRONTEND_URL` | `https://fresh-scan-ai-sage.vercel.app` |
| `API_BASE_URL` | `https://karansingh12-freshscan-api.hf.space` |
| `HF_MODEL_REPO` | `karansingh12/freshscan-models` |
| `MODEL_TOKEN` | Your HF token (repo is private) |

The Space uses `Dockerfile` + `startup.sh` — models are downloaded from HF Hub automatically at container start.

---

## Project Structure

```
FreshScan/
├── backend/                  # FastAPI backend
│   ├── main.py               # Application entry point
│   └── api/                  # Endpoints (scan, history, vendors)
├── src/                      # React frontend source
│   ├── components/           # Reusable UI components
│   ├── pages/                # Features: Scanner, Dashboard, MarketMap
│   ├── lib/                  # API client and utilities
│   ├── App.tsx               # Main routing
│   └── index.css             # Tailwind configuration and design tokens
├── public/                   # Static assets (images, app icons)
├── Models/                   # Pre-compiled PyTorch models for inference
├── Training_Notebook/        # Jupyter notebooks for model training pipelines
├── package.json              # Concurrently handles frontend + backend scripts
└── DOCUMENTATION.md          # Comprehensive architecture overview
```

---

## Contributing

### Prerequisites

Make sure you have the following before contributing:

| Requirement | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org/) | v18+ | LTS recommended |
| [Python](https://python.org/) | 3.12+ | Required for FastAPI / PyTorch |
| [Git](https://git-scm.com/) | Any recent | For version control |

Set up your local environment using the steps in [Getting Started](#getting-started) above.

### Steps

Contributions are welcome! Here's how to get involved:

1. **Fork** the repository
2. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. **Make your changes** and commit with a clear message:
   ```bash
   git commit -m "feat: add your feature description"
   ```
4. **Push** to your fork:
   ```bash
   git push origin feat/your-feature-name
   ```
5. **Open a Pull Request** against `main` and describe what you changed and why.

### Guidelines

- Keep PRs focused - one feature or fix per PR.
- Follow the existing code style (TypeScript strict, Tailwind configuration, FastAPI patterns).
- Do not commit local environments or `__pycache__` artifacts.
- For larger changes, consult `DOCUMENTATION.md` and open an issue first to discuss the approach.

---

## License

MIT with Commons Clause - free for personal and educational use. Commercial use not permitted without permission. See [LICENSE](LICENSE) for details.
