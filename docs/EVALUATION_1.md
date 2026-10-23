# Evaluation 1 Demonstration

## Objective

Demonstrate a normalized, constrained and independently useful pediatric relational database before discussing dynamic forms.

## Suggested 12-minute flow

1. Open `docs/DESIGN.md` and explain the core ER model and 3NF decisions.
2. Run `database/schema.sql`, then `database/seed.sql` against a fresh MySQL instance.
3. Show patient `PED-2026-0003` in the UI and open the visit timeline.
4. Run queries 1, 2, 7, 11 and 16 from `evaluation_queries.sql`.
5. Attempt a duplicate MRN or a visit end before its start to demonstrate constraints.
6. Run the transaction block and show both the appointment and matching audit row.
7. Run the first `EXPLAIN ANALYZE` benchmark and identify `idx_visit_patient_date`.

## Coverage checklist

- 36 tables covering the relational core, JSON questionnaires and clinical custom fields
- Primary/foreign keys, checks, unique rules and junction relationships
- Patient/guardian, scheduling, visits, clinical record, pediatrics, medication, labs and follow-up
- Three reporting views, one procedure, three audit triggers and three validation/retention triggers
- 21 joins, aggregations, subqueries, window/report queries
- Repeatable synthetic sample data and a transaction demonstration

All patient identities and contact details are synthetic.
