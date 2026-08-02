# UNC SSL Generator

A free SSL certificate generator for the UNC (Universal Network Coin) ecosystem — like ZeroSSL, built for UNC customers, miners, and members.

## Stack

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL (SQLAlchemy + Alembic)
- **CA**: Let's Encrypt via the ACME protocol

## Features

- Email/password signup and login (JWT auth)
- Add domains and verify ownership three ways:
  - Upload a file to the domain's web server
  - Add a DNS TXT record
  - Verify via an email address on the domain (e.g. `admin@yourdomain.com`)
- Request a real Let's Encrypt SSL certificate once a domain is verified
- Built-in SSL checker — inspect any host's certificate, expiry, issuer, and TLS version
- `unc_wallet_address` / `is_unc_member` fields on `User` are wired in as the hook point for UNC-specific
  gating (e.g. premium cert types for wallet holders) — plug in your UNC auth/payment logic there

## Important: how certificate validation actually works

Let's Encrypt validates domain ownership itself, directly against the customer's domain — it never talks to
our backend. So:

- Our own domain-ownership check (HTTP file / DNS TXT / email) gates who's allowed to request a cert on our
  platform, but only HTTP and DNS satisfy Let's Encrypt's own challenge requirements.
- Certificate issuance is a **two-step** flow: `POST /api/certificates` starts an ACME order and returns the
  exact file path/DNS record to publish; `POST /api/certificates/{id}/finalize` is called once that's live, and
  completes issuance.
- Domains verified only by email must re-verify via HTTP or DNS before a real certificate can be issued —
  ACME has no email challenge type.

## Local development

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
docker compose up --build
```

Backend: http://localhost:8000 (docs at `/docs`)
Frontend: http://localhost:3000

### Without Docker

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# frontend
cd frontend
npm install
npm run dev
```

## Going to production

- Point `ACME_DIRECTORY_URL` at the production Let's Encrypt directory (`https://acme-v02.api.letsencrypt.org/directory`) — the default is the staging directory, which issues untrusted test certs.
- The ACME account private key is written to `backend/data/acme_account_key.pem` — back it up and keep it secret.
- In-progress ACME orders are held in-process (`app/services/acme_client.py`); a multi-instance deployment needs sticky sessions per issuance flow, or to persist the order URL and reconstruct it.
- Configure real SMTP credentials for domain-ownership and account emails.
