# Evaluation 2 Demonstration

## Objective

Show that clinical fields can change without changing the physical schema, and that the same database supports large datasets and query tuning.

## Suggested database demonstration

1. Open a patient record and use **Customize fields** to add a clinical field. Enter a value and save the record.
2. Query `clinical_custom_fields`, `clinical_custom_field_values` and `clinical_custom_field_value_history` to explain metadata, JSON values and revisions.
3. Show that patient fields carry across visits while visit fields belong to one encounter.
4. Query `custom_forms`, `custom_form_fields`, `custom_form_responses` and `custom_form_response_history` to explain the separate versioned questionnaire database model. There is no separate questionnaire builder page in the UI.
5. Generate 10,000 synthetic patients, then run `performance_benchmarks.sql`.
6. Explain composite-index column order and demonstrate keyset pagination.

## Scale procedure

Start at 10,000 records and capture query time, examined rows and chosen index from `EXPLAIN ANALYZE`. Repeat at 50,000 and 100,000 patients. Use identical hardware and a warmed buffer pool for comparable measurements. The generator is deliberately configurable because generating the final target during ordinary setup would make the project slow to install.

## Dynamic design rationale

Metadata defines form, section, field, type, validation, options and order. Answers are stored as a validated JSON object linked to a visit and a specific immutable template version. Every save creates a response-history revision and an audit record. Stable clinical concepts stay relational instead of being forced into JSON; frequently reported answer properties can use generated columns and indexes.
