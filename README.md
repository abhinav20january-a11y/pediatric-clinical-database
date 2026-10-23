# Pediatric Patient Management & Dynamic Clinical Database System

A database-first, full-stack pediatric clinical database prototype. It uses MySQL 8 for the relational hospital foundation, with an Express API and React demonstration interface.

## What is included

- 36 relational tables covering the Evaluation 1 scope and expanded clinical workflows
- Foreign keys, checks, uniqueness rules, audit triggers and practical indexes
- Repeatable synthetic seed data (no real patient information)
- Demonstration dataset with 30 synthetic patients, 30 guardians, 7 doctors, 31 appointments and 17 completed visits
- 21 demonstration/reporting queries, views, a stored procedure and a safe transaction
- Dashboard, patient search and longitudinal patient history
- Expanded registration, editable demographics, identifiers, guardian contacts, consent capture and patient safety summary
- Clinical record workspace for encounters, diagnosis, history, examination, care plan, vital signs and growth measurements
- Create and edit prescriptions with multiple medication items, dose, frequency, route, duration and instructions
- Create and edit allergy and immunization records
- Laboratory order and result management, including abnormal-result flags and reference ranges
- Follow-up worklist with assignment, priority, due dates, contact tracking, outcomes and an activity timeline
- JSON form tables for versioned templates, visit-linked responses and revision history (database evaluation; no separate clinical forms page)
- Database-backed doctor-defined fields on patients, visits, prescriptions, laboratory orders, allergies, immunizations and follow-ups; definitions and typed JSON values can be added, edited and safely retired from the relevant screen
- Recoverable soft deletion for clinical records (`deleted_at`, `deleted_by`, `deletion_reason`) with restrictive audit/history foreign keys
- Reason-required soft-delete API operations for patients, visits, allergies, immunizations, prescriptions, lab orders and follow-ups
- Visit-linked form response revisions in the database, plus previous patient follow-up history during follow-up creation and review
- `EXPLAIN ANALYZE` examples for core query patterns
- Docker-based one-command local setup

## Quick start

Requirements: Docker Desktop with Docker Compose.

```bash
cp .env.example .env
docker compose up --build
```

Open the app at <http://localhost:5173>. The API health check is <http://localhost:3000/api/health>. MySQL is exposed on port `3307` to avoid conflicts with a local installation.

The database now installs directly from its current definition. There are no historical upgrade scripts or `ALTER TABLE` steps. Docker uses a new `mysql_current_data` volume; the earlier `mysql_data` volume is left intact.

Demo sign-in is intentionally omitted: this is an academic prototype. API requests use the seeded administrator (`user_id = 1`) as the audit actor.

## Run without Docker

Start MySQL 8.4 or newer. From the project root, initialize an empty database with:

```bash
mysql -h 127.0.0.1 -P 3307 -u root -p < database/schema.sql
mysql -h 127.0.0.1 -P 3307 -u root -p < database/seed.sql
```

The setup creates `pediatric_clinic`. Create or grant your MySQL application user access to that database, then copy `.env.example` to `.env`, set its connection details, and run:

```bash
npm install
npm run dev
```

The fresh local database prepared for this workspace runs on `127.0.0.1:3307`, with its files in `tmp/mysql-current-20261021/`. Its application connection matches `.env.example`. The separately installed MySQL instance was left untouched. The previous SQL source files are recoverable from `output/backups/database-before-fresh-20261021.zip`.

## Evaluation map

- `database/schema.sql`: all 36 current tables, columns, foreign keys, checks, indexes, views, triggers and the patient timeline procedure.
- `database/seed.sql`: synthetic patients, doctors, clinical records, field definitions and follow-up history.
- `database/queries/`: evaluation and performance queries.
- Evaluation 1 walkthrough: `docs/EVALUATION_1.md`.
- Architecture, normalization and ER model: `docs/DESIGN.md`.

Evaluation 2 database evidence includes the JSON form tables, revision history and reporting queries. The hospital workflow expansion is documented in `docs/HOSPITAL_HANDOVER_CHECKLIST.md`.

## Useful commands

```bash
npm run dev          # API + Vite UI
npm run build        # production client build
npm run check        # server syntax + production client build
npm run seed:large   # generate configurable high-volume synthetic data
```

Set `SCALE_PATIENTS` before `seed:large` (default 10,000; maximum 100,000). The generator batches inserts and only creates synthetic records.

## Safety boundary

This is not production medical software. It contains synthetic data only. Real deployment would require identity integration, authorization enforcement, encryption/key management, consent and retention policies, jurisdiction-specific privacy review, operational monitoring and clinical validation.
