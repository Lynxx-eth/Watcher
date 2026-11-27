#!/usr/bin/env bash
# One-shot backend bootstrap. Run from the repo root: bash backend/scripts/setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."   # -> backend/

echo "[1/5] Python venv + dependencies"
python3 -m venv .venv
.venv/bin/pip install -q -r requirements-dev.txt

echo "[2/5] .env"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    created backend/.env — set DEMO_PIN (4-12 digits) and a real GEOCODER_USER_AGENT"
fi

echo "[3/5] Database (expects PostgreSQL from 'docker compose up -d db')"
.venv/bin/alembic upgrade head

echo "[4/5] Demo profile"
if grep -q '^DEMO_PIN=.\+' .env; then
  .venv/bin/python -m app.cli seed-demo
else
  echo "    skipped — set DEMO_PIN in backend/.env then: .venv/bin/python -m app.cli seed-demo"
fi

echo "[5/5] Tests"
.venv/bin/pytest -q || echo "    (tests reported failures — see output above)"

echo "Done. Create an admin with: .venv/bin/python -m app.cli create-admin"
echo "Run the API with:          .venv/bin/uvicorn app.main:app --reload --port 8000"
