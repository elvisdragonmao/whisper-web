.PHONY: lint format fix check install-hooks

# Run Ruff linter (no auto-fix)
lint:
	ruff check app/

# Run Ruff formatter (check only, no write)
format:
	ruff format --check app/

# Auto-fix lint issues + reformat in place
fix:
	ruff check --fix app/
	ruff format app/

# Full quality check (lint + format) — suitable for CI
check: lint format

# Install pre-commit hooks into the local git repo
install-hooks:
	pre-commit install
