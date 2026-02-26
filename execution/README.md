# Execution Scripts (Layer 3 — Doing the Work)

This folder contains **deterministic Python scripts** that handle API calls, data processing, file operations, and database interactions.

## Guidelines

- Scripts should be **reliable, testable, and fast**.
- Always use scripts instead of manual work.
- Well-commented code with proper error handling.
- Load secrets from `.env` using `python-dotenv`.
- Check this folder before writing a new script — reuse existing tools when possible.

## Template

Use `_template.py` as a starting point for new execution scripts.
