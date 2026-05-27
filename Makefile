SHELL := /bin/bash
.DEFAULT_GOAL := help

ifneq (,$(wildcard .env))
include .env
export
endif

PNPM ?= pnpm
COMPOSE ?= docker compose

API_PORT ?= 4000
CLIENT_PORT ?= 3000
WEB_PORT ?= $(API_PORT)
VITE_API_BASE_URL ?= http://localhost:$(API_PORT)

.PHONY: help env install db-up dev dev-api dev-client start build check docker-up docker-down docker-logs clean

help: ## Show available commands.
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make <target>\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*##/ {printf "  %-14s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

env: ## Create .env from .env.example if it does not exist.
	@test -f .env && echo ".env already exists" || cp .env.example .env

install: ## Install workspace dependencies.
	$(PNPM) install

db-up: ## Start local Docker Postgres and wait until it is healthy.
	@set -euo pipefail; \
	$(COMPOSE) up -d postgres; \
	container_id="$$($(COMPOSE) ps -q postgres)"; \
	if [ -z "$$container_id" ]; then \
		echo "Postgres container was not created"; \
		exit 1; \
	fi; \
	printf "Waiting for Postgres"; \
	for _ in {1..30}; do \
		status="$$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' "$$container_id")"; \
		if [ "$$status" = "healthy" ]; then \
			printf "\nPostgres is healthy on localhost:$${DB_PORT:-5432}\n"; \
			exit 0; \
		fi; \
		printf "."; \
		sleep 1; \
	done; \
	printf "\nPostgres did not become healthy in time\n"; \
	$(COMPOSE) logs postgres; \
	exit 1

dev: db-up ## Start Docker Postgres, API, and client dev servers using .env values.
	@set -euo pipefail; \
	WEB_PORT="$(WEB_PORT)" VITE_API_BASE_URL="$(VITE_API_BASE_URL)" $(PNPM) --filter applypilot-api dev & \
	api_pid=$$!; \
	VITE_API_BASE_URL="$(VITE_API_BASE_URL)" $(PNPM) --filter applypilot-client dev -- --port "$(CLIENT_PORT)" & \
	client_pid=$$!; \
	trap 'kill $$api_pid $$client_pid 2>/dev/null || true' INT TERM EXIT; \
	wait $$api_pid $$client_pid

dev-api: ## Start only the API dev server.
	WEB_PORT="$(WEB_PORT)" $(PNPM) --filter applypilot-api dev

dev-client: ## Start only the Vite client dev server.
	VITE_API_BASE_URL="$(VITE_API_BASE_URL)" $(PNPM) --filter applypilot-client dev -- --port "$(CLIENT_PORT)"

start: ## Start the API in production mode.
	WEB_PORT="$(WEB_PORT)" $(PNPM) start

build: ## Build the client.
	$(PNPM) build

check: ## Run project checks.
	$(PNPM) check

docker-up: ## Build and start Docker Compose services.
	$(COMPOSE) up --build

docker-down: ## Stop Docker Compose services.
	$(COMPOSE) down

docker-logs: ## Follow Docker Compose logs.
	$(COMPOSE) logs -f

clean: ## Remove generated dependency and build directories.
	rm -rf node_modules api/node_modules client/node_modules client/dist api/dist
