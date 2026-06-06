---
title: Freshscan Api
emoji: 🐠
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

# FreshScan AI - Backend API

This backend API runs on Hugging Face Spaces using a custom Docker container.
It provides endpoints for fish freshness classification and user authentication.

## Local Development
Refer to `.env.example` to set up your local environment, then run:

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```
