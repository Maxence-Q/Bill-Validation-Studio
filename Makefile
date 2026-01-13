# Simple Python "makefile" to manage venv, env vars, and run/debug entry points.
# Usage examples:
#   make install                     # create venv + install requirements.txt
#   make brief                       # run event_brief.py (uses .env, activates venv)
#   make brief ARGS="--id 1234"      # run event_brief.py with event_id = 1234
#   make eval                        # run eval_langsmith.py
#   make run FILE=path/to/file.py    # run any python file
#   make clean                       # remove venv and build caches
#
# Notes:
# - Requires bash/make (works great on WSL/Linux/macOS). On Windows native, use WSL or Git Bash.
# - Expects a .env file at repo root (see .env.example). All vars will be exported for the run.
# - PYTHONPATH is set to repo root so intra-repo imports work (e.g., `from LLM...`).
#
# If your venv folder is named differently, call: make install VENV=.venv

SHELL := /bin/bash

# Config (override on CLI, e.g., make install VENV=.venv PY=python3.12)
VENV ?= venv
PY   ?= python3
PIP  := $(VENV)/bin/pip
PYBIN:= $(VENV)/bin/python

# Default target
.DEFAULT_GOAL := help

# --- Helpers ---
define _ensure_venv
	@if [ ! -d "$(VENV)" ]; then \
		echo ">>> Creating venv at $(VENV) with $(PY)"; \
		$(PY) -m venv $(VENV); \
	fi
endef

define _ensure_dotenv
	@if [ ! -f ".env" ]; then \
		if [ -f ".env.example" ]; then \
			echo ">>> No .env found. Copying .env.example to .env (edit it)"; \
			cp .env.example .env; \
		else \
			echo ">>> No .env found. Create one with your secrets (see .env.example)"; \
		fi; \
	fi
endef

# Export all vars from .env for the current shell (works with lines VAR=VALUE and no spaces)
define _export_env
	set -a; \
	[ -f .env ] && . ./.env; \
	set +a
endef

# --- Targets ---

help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' Makefile | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

venv: ## Create virtual environment if missing
	$(call _ensure_venv)
	@echo ">>> venv ready: $(VENV)"

install: venv ## Install/upgrade pip and requirements.txt
	@$(call _ensure_venv)
	@$(PYBIN) -m pip install --upgrade pip wheel
	@if [ -f "requirements.txt" ]; then \
		echo ">>> Installing requirements.txt"; \
		$(PIP) install -r requirements.txt; \
	else \
		echo ">>> No requirements.txt found. Skipping."; \
	fi
	@echo ">>> Install done."

run: ## Run arbitrary python file: make run FILE=foo.py [ARGS="..."]
	@$(call _ensure_venv)
	@$(call _ensure_dotenv) 
	@bash -lc '$(_export_env); source "$(VENV)/bin/activate"; PYTHONPATH=$$(pwd) "$(PYBIN)" "$(FILE)" $(ARGS)'

eval: ## Run eval_langsmith.py (LangSmith evaluation)
	@$(MAKE) run FILE=-m ARGS='tests.eval_langsmith $(ARGS)'

module-manager-test: ## module_manager.py
	@$(MAKE) run FILE=module_manager.py ARGS='$(ARGS)'

gathering-result:
	@$(MAKE) run FILE=-m ARGS='tests.test_perturbation.gathering_result $(ARGS)'

scenario-recreation: ## module_manager.py
	@$(MAKE) run FILE=-m ARGS='tests.test_perturbation.scenario_recreation.module_manager_re $(ARGS)'

gathering-organisation:
	@$(MAKE) run FILE=-m ARGS='utils.organisations.gather $(ARGS)'
filtering-organisation:
	@$(MAKE) run FILE=-m ARGS='utils.organisations.filter $(ARGS)'

## New rules:

##

debug: ## Run with debugger: make debug FILE=foo.py [ARGS="..."]
	@$(call _ensure_venv)
	@$(call _ensure_dotenv)
	@bash -lc '$(_export_env); source "$(VENV)/bin/activate"; PYTHONPATH=$$(pwd) "$(PYBIN)" -m debugpy --listen 5678 --wait-for-client "$(FILE)" $(ARGS)'

check-env: ## Print which critical env vars are set (without revealing values)
	@$(call _ensure_dotenv)
	@bash -lc '$(_export_env); for v in GROQ_API_KEY LANGSMITH_API_KEY LANGCHAIN_ENDPOINT LANGCHAIN_TRACING LANGCHAIN_TRACING_V2 LANGCHAIN_PROJECT; do \
		if [ -z "$${!v}" ]; then echo "❌ $$v is NOT set"; else echo "✅ $$v is set"; fi; \
	done'

clean: ## Remove venv and Python caches
	@rm -rf "$(VENV)" .pytest_cache __pycache__ **/__pycache__ .mypy_cache .ruff_cache .coverage dist build *.egg-info

.PHONY: help venv install run brief eval debug check-env clean
