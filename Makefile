# WATCHER — common tasks. Run `make help` for the list.
# Requires: Docker (for Postgres), Python 3.11+, Node 20.19+.

.DEFAULT_GOAL := help
SHELL := /bin/bash
PY := backend/.venv/bin/python
PIP := backend/.venv/bin/pip

.PHONY: help
help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

## ---- database ----
.PHONY: db-up db-down
db-up:  ## Start the PostgreSQL container
	docker compose up -d db

db-down:  ## Stop the PostgreSQL container
	docker compose down

## ---- backend ----
.PHONY: backend-install backend-env migrate seed admin backend test dev-backend purge
backend-install:  ## Create venv and install backend deps
	python3 -m venv backend/.venv
	$(PIP) install -q -r backend/requirements-dev.txt

backend-env:  ## Create backend/.env from the example if missing
	@test -f backend/.env || (cp backend/.env.example backend/.env && echo "Created backend/.env — set DEMO_PIN and a real GEOCODER_USER_AGENT")

migrate:  ## Apply database migrations
	cd backend && .venv/bin/alembic upgrade head

seed:  ## Create/refresh the fictional demo profile
	cd backend && .venv/bin/python -m app.cli seed-demo

admin:  ## Create an admin account (prompts)
	cd backend && .venv/bin/python -m app.cli create-admin

purge:  ## Delete expired sessions
	cd backend && .venv/bin/python -m app.cli purge-sessions

test:  ## Run the backend test suite
	cd backend && .venv/bin/pytest -q

dev-backend:  ## Run the API with reload on :8000
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

backend: backend-install backend-env db-up ## First-time backend setup (install + env + db + migrate + seed)
	@sleep 2
	$(MAKE) migrate
	@grep -q '^DEMO_PIN=.\+' backend/.env && $(MAKE) seed || echo "Set DEMO_PIN in backend/.env, then run: make seed"

## ---- frontends ----
.PHONY: frontend-install dev-client dev-enroll dev-admin build typecheck
frontend-install:  ## Install all frontend deps (npm workspaces)
	npm install

dev-client:  ## Run the main sign-in app on :5173
	npm run dev:client
dev-enroll:  ## Run the enrolment site on :5175
	npm run dev:enroll
dev-admin:  ## Run the admin app on :5174
	npm run dev:admin

build:  ## Production build of all three frontends
	npm run build
typecheck:  ## Type-check all three frontends
	npm run typecheck

## ---- everything ----
.PHONY: setup
setup: backend frontend-install  ## First-time setup of backend + frontends
	@echo ""
	@echo "Setup done. Next:"
	@echo "  1) set DEMO_PIN in backend/.env (then: make seed)"
	@echo "  2) make admin          # create your admin login"
	@echo "  3) make dev-backend    # terminal 1"
	@echo "  4) make dev-client     # terminal 2  -> http://localhost:5173"
	@echo "     make dev-enroll     # terminal 3  -> http://localhost:5175"
	@echo "     make dev-admin      # terminal 4  -> http://localhost:5174"
