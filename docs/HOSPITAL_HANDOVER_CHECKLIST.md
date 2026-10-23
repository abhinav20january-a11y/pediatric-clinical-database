# Hospital Handover Readiness Checklist

The current repository is a capable academic and workflow prototype. It must not hold real patient data or be represented as production-certified until the receiving hospital completes the controls below.

## Implemented application workflows

- Expanded patient registration with legal/preferred name, demographics, contacts, address, language, registration source, identifiers, guardian details, and consent flags.
- Transactional patient creation and editable patient demographics with audit entries.
- Patient summary tabs for demographics, identifiers, guardians, allergies, immunizations, encounters, and follow-ups.
- Transactional encounter entry and editing for diagnosis, history, examination, clinical plan, vital signs, and pediatric growth measurements.
- Prescription creation and editing with multiple medication items, dose, frequency, route, duration, and patient instructions.
- Allergy and immunization creation/editing with status history retained.
- Laboratory order and result entry with status, reference range, result notes, and abnormal-result indication.
- Follow-up worklist with category, priority, owner, due date, contact channel/status, next action, outcome, completion state, notes, and history.
- Overdue work-item detection, filters, patient search, and role/user assignment.
- Database constraints, indexes, views, transaction examples, and synthetic data.

## Mandatory before real deployment

- Replace the demo actor with real identity-provider authentication and server-enforced role/permission checks.
- Define hospital-specific access roles, emergency access, break-glass auditing, joiner/mover/leaver procedures, and session controls.
- Encrypt traffic and sensitive data, move secrets to an approved secret store, and establish key rotation.
- Perform jurisdiction-specific privacy, consent, retention, and data-residency review.
- Add immutable audit export, monitoring, alerting, incident response, and periodic access review.
- Complete threat modeling, dependency/security scanning, penetration testing, and remediation.
- Establish validated backups, point-in-time recovery, disaster recovery objectives, restore drills, and downtime procedures.
- Validate clinical terminology, forms, ranges, workflows, and alerting with pediatric clinicians and hospital governance.
- Add duplicate-patient detection and an approved merge/unmerge workflow.
- Define integration requirements for FHIR/HL7, laboratory, pharmacy, billing, identity, SMS/email, and national health systems.
- Add comprehensive automated unit, API, migration, authorization, accessibility, browser, performance, and load tests.
- Establish environments, release approvals, database migration controls, support ownership, training, SOPs, and service-level targets.

## Standards alignment

The expanded model follows the general shape of HL7 FHIR Patient, Appointment, and Task concepts: patient identifiers and contacts, appointment/encounter separation, and owned tasks with status and priority. This is alignment for design clarity, not a claim of FHIR conformance. A formal conformance layer, profiles, terminology bindings, validation, and interoperability testing are still required.
