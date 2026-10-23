/**
 * Dynamic clinical-field API.
 * Definitions describe the UI control; values are JSON scalars/arrays attached
 * to exactly one supported clinical record and revisions are retained.
 */
import { Router } from "express";
import { z } from "zod";
import { pool, transaction } from "../db.js";

const router = Router();
const actorUserId = 1;

// Whitelist context-to-table mappings before any identifier enters SQL text.
const contexts = {
  patient: { table: "patients", id: "patient_id" },
  visit: { table: "visits", id: "visit_id" },
  prescription: { table: "prescriptions", id: "prescription_id" },
  lab_order: { table: "lab_orders", id: "lab_order_id" },
  allergy: { table: "allergies", id: "allergy_id" },
  immunization: { table: "immunizations", id: "immunization_id" },
  follow_up: { table: "follow_ups", id: "follow_up_id" },
};

const fieldSchema = z
  .object({
    key: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/)
      .max(80),
    label: z.string().trim().min(1).max(150),
    type: z.enum([
      "text",
      "textarea",
      "number",
      "date",
      "boolean",
      "dropdown",
      "checkbox",
    ]),
    helpText: z.string().max(500).nullish(),
    options: z.array(z.string().trim().min(1).max(150)).default([]),
    validationRules: z.record(z.string(), z.unknown()).default({}),
    sectionName: z
      .string()
      .trim()
      .min(1)
      .max(150)
      .default("Additional information"),
    displayOrder: z.number().int().min(0).optional(),
    required: z.boolean().default(false),
  })
  .superRefine((field, ctx) => {
    if (
      ["dropdown", "checkbox"].includes(field.type) &&
      !field.options.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "At least one option is required",
      });
    }
  });

/** Resolve a public context name to a trusted table/primary-key pair. */
function contextFrom(req) {
  const context = contexts[req.params.context];
  if (!context) {
    const error = new Error("Unsupported custom-field context");
    error.status = 400;
    throw error;
  }
  return context;
}

/** Handle JSON returned either decoded by mysql2 or still serialized as text. */
function parseJson(value, fallback = null) {
  if (value == null || typeof value !== "string") return value ?? fallback;
  // mysql2 decodes JSON scalar strings to plain JavaScript strings, while
  // arrays/objects may still arrive serialized depending on server settings.
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Decode JSON metadata before sending field definitions to React. */
function normalizedFields(rows) {
  return rows.map((row) => ({
    ...row,
    options: parseJson(row.options, []),
    validation_rules: parseJson(row.validation_rules, {}),
  }));
}

/** Reject values for records that do not exist or have been soft-deleted. */
async function ensureRecord(db, context, recordId) {
  const [[record]] = await db.execute(
    `SELECT ${context.id} FROM ${context.table} WHERE ${context.id}=? AND deleted_at IS NULL`,
    [recordId],
  );
  if (!record) {
    const error = new Error("Clinical record not found");
    error.status = 404;
    throw error;
  }
}

/** Enforce required, type, range, length, option, and date rules from metadata. */
function validateValue(field, value) {
  const rules = parseJson(field.validation_rules, {}) || {};
  const empty =
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);
  if (field.is_required && empty)
    throw Object.assign(new Error(`${field.label} is required`), {
      status: 400,
    });
  if (empty) return null;
  if (field.field_type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw Object.assign(new Error(`${field.label} must be a number`), {
        status: 400,
      });
    if (rules.min != null && value < rules.min)
      throw Object.assign(
        new Error(`${field.label} must be at least ${rules.min}`),
        { status: 400 },
      );
    if (rules.max != null && value > rules.max)
      throw Object.assign(
        new Error(`${field.label} must be at most ${rules.max}`),
        { status: 400 },
      );
  } else if (field.field_type === "boolean") {
    if (typeof value !== "boolean")
      throw Object.assign(new Error(`${field.label} must be true or false`), {
        status: 400,
      });
  } else if (field.field_type === "date") {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw Object.assign(new Error(`${field.label} must be a date`), {
        status: 400,
      });
  } else if (field.field_type === "dropdown") {
    const options = parseJson(field.options, []);
    if (!options.includes(value))
      throw Object.assign(
        new Error(`${field.label} contains an invalid option`),
        { status: 400 },
      );
  } else if (field.field_type === "checkbox") {
    const options = parseJson(field.options, []);
    if (!Array.isArray(value) || value.some((item) => !options.includes(item)))
      throw Object.assign(
        new Error(`${field.label} contains invalid options`),
        { status: 400 },
      );
  } else if (typeof value !== "string") {
    throw Object.assign(new Error(`${field.label} must be text`), {
      status: 400,
    });
  } else if (rules.maxLength != null && value.length > rules.maxLength) {
    throw Object.assign(new Error(`${field.label} is too long`), {
      status: 400,
    });
  }
  return value;
}

// Return active definitions and, when recordId is supplied, its current values.
router.get("/:context", async (req, res, next) => {
  try {
    const context = contextFrom(req),
      recordId = req.query.recordId ? Number(req.query.recordId) : null;
    const params = [req.params.context];
    let valueJoin = "";
    if (recordId) {
      valueJoin = `LEFT JOIN clinical_custom_field_values v ON v.custom_field_id=f.custom_field_id AND v.${context.id}=? AND v.deleted_at IS NULL`;
      params.unshift(recordId);
    }
    const [rows] = await pool.execute(
      `SELECT f.*,${recordId ? "v.custom_value_id,v.value_json,v.version value_version" : "NULL custom_value_id,NULL value_json,NULL value_version"}
      FROM clinical_custom_fields f ${valueJoin}
      WHERE f.context_type=? AND f.deleted_at IS NULL
      ORDER BY f.section_name,f.display_order,f.custom_field_id`,
      params,
    );
    res.json({
      context: req.params.context,
      recordId,
      fields: normalizedFields(rows).map((row) => ({
        ...row,
        value: parseJson(row.value_json),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Add one field definition to the requested screen context.
router.post("/:context", async (req, res, next) => {
  try {
    contextFrom(req);
    const data = fieldSchema.parse(req.body);
    const result = await transaction(async (db) => {
      let displayOrder = data.displayOrder;
      if (displayOrder == null) {
        const [[position]] = await db.execute(
          `SELECT COALESCE(MAX(display_order),0)+1 next_order FROM clinical_custom_fields WHERE context_type=? AND deleted_at IS NULL`,
          [req.params.context],
        );
        displayOrder = position.next_order;
      }
      const [created] = await db.execute(
        `INSERT INTO clinical_custom_fields
        (context_type,field_key,label,field_type,help_text,options,validation_rules,section_name,display_order,is_required,created_by)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
        [
          req.params.context,
          data.key,
          data.label,
          data.type,
          data.helpText || null,
          ["dropdown", "checkbox"].includes(data.type)
            ? JSON.stringify(data.options)
            : null,
          JSON.stringify(data.validationRules),
          data.sectionName,
          displayOrder,
          data.required,
          actorUserId,
        ],
      );
      await db.execute(
        `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,after_data)
        VALUES(?,'CREATE','clinical_custom_field',?,JSON_OBJECT('context',?,'field_key',?,'label',?))`,
        [
          actorUserId,
          created.insertId,
          req.params.context,
          data.key,
          data.label,
        ],
      );
      return created.insertId;
    });
    res.status(201).json({ customFieldId: result });
  } catch (error) {
    next(error);
  }
});

// Edit field metadata; prevent unsafe type changes after values already exist.
router.put("/:context/:fieldId", async (req, res, next) => {
  try {
    contextFrom(req);
    const fieldId = Number(req.params.fieldId),
      data = fieldSchema.parse(req.body);
    await transaction(async (db) => {
      const [[before]] = await db.execute(
        `SELECT * FROM clinical_custom_fields WHERE custom_field_id=? AND context_type=? AND deleted_at IS NULL FOR UPDATE`,
        [fieldId, req.params.context],
      );
      if (!before)
        throw Object.assign(new Error("Custom field not found"), {
          status: 404,
        });
      if (before.field_type !== data.type) {
        const [[usage]] = await db.execute(
          "SELECT COUNT(*) total FROM clinical_custom_field_values WHERE custom_field_id=? AND deleted_at IS NULL",
          [fieldId],
        );
        if (usage.total)
          throw Object.assign(
            new Error(
              "Field type cannot change after values have been recorded",
            ),
            { status: 409 },
          );
      }
      await db.execute(
        `UPDATE clinical_custom_fields SET label=?,field_type=?,help_text=?,options=?,validation_rules=?,section_name=?,display_order=?,is_required=? WHERE custom_field_id=?`,
        [
          data.label,
          data.type,
          data.helpText || null,
          ["dropdown", "checkbox"].includes(data.type)
            ? JSON.stringify(data.options)
            : null,
          JSON.stringify(data.validationRules),
          data.sectionName,
          data.displayOrder ?? before.display_order,
          data.required,
          fieldId,
        ],
      );
      await db.execute(
        `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data) VALUES(?,'UPDATE','clinical_custom_field',?,JSON_OBJECT('label',?,'type',?),JSON_OBJECT('label',?,'type',?))`,
        [
          actorUserId,
          fieldId,
          before.label,
          before.field_type,
          data.label,
          data.type,
        ],
      );
    });
    res.json({ customFieldId: fieldId });
  } catch (error) {
    next(error);
  }
});

// Retire the definition through soft deletion so historical answers remain valid.
router.delete("/:context/:fieldId", async (req, res, next) => {
  try {
    contextFrom(req);
    const fieldId = Number(req.params.fieldId);
    const data = z
      .object({
        reason: z
          .string()
          .trim()
          .min(3)
          .max(500)
          .default("Field retired by clinician"),
      })
      .parse(req.body || {});
    const [result] = await pool.execute(
      `UPDATE clinical_custom_fields SET deleted_at=CURRENT_TIMESTAMP,deleted_by=?,deletion_reason=? WHERE custom_field_id=? AND context_type=? AND deleted_at IS NULL`,
      [actorUserId, data.reason, fieldId, req.params.context],
    );
    if (!result.affectedRows)
      return res.status(404).json({ error: "Custom field not found" });
    await pool.execute(
      `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,after_data) VALUES(?,'SOFT_DELETE','clinical_custom_field',?,JSON_OBJECT('reason',?))`,
      [actorUserId, fieldId, data.reason],
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// Validate and upsert all custom answers for one record in a single transaction.
router.put("/:context/records/:recordId", async (req, res, next) => {
  try {
    const context = contextFrom(req),
      recordId = Number(req.params.recordId);
    const supplied = z
      .object({ values: z.record(z.string(), z.unknown()) })
      .parse(req.body).values;
    await transaction(async (db) => {
      await ensureRecord(db, context, recordId);
      const [fields] = await db.execute(
        `SELECT * FROM clinical_custom_fields WHERE context_type=? AND deleted_at IS NULL ORDER BY custom_field_id FOR UPDATE`,
        [req.params.context],
      );
      const known = new Set(
        fields.map((field) => String(field.custom_field_id)),
      );
      const unknown = Object.keys(supplied).filter((key) => !known.has(key));
      if (unknown.length)
        throw Object.assign(
          new Error(`Unknown custom field: ${unknown.join(", ")}`),
          { status: 400 },
        );
      for (const field of fields) {
        const key = String(field.custom_field_id),
          value = validateValue(field, supplied[key]);
        const [[current]] = await db.execute(
          `SELECT custom_value_id,version,value_json,deleted_at FROM clinical_custom_field_values WHERE custom_field_id=? AND ${context.id}=? FOR UPDATE`,
          [field.custom_field_id, recordId],
        );
        if (value === null) {
          if (current?.custom_value_id && current.value_json !== null) {
            const nextVersion = current.version + 1;
            await db.execute(
              `UPDATE clinical_custom_field_values SET value_json=NULL,version=?,recorded_by=?,deleted_at=CURRENT_TIMESTAMP,deleted_by=?,deletion_reason='Value cleared by clinician' WHERE custom_value_id=?`,
              [nextVersion, actorUserId, actorUserId, current.custom_value_id],
            );
            await db.execute(
              `INSERT INTO clinical_custom_field_value_history(custom_value_id,version,value_json,changed_by) VALUES(?,?,NULL,?)`,
              [current.custom_value_id, nextVersion, actorUserId],
            );
          }
          continue;
        }
        const encoded = JSON.stringify(value);
        if (current) {
          if (
            !current.deleted_at &&
            JSON.stringify(parseJson(current.value_json)) === encoded
          )
            continue;
          const nextVersion = current.version + 1;
          await db.execute(
            `UPDATE clinical_custom_field_values SET value_json=?,version=?,recorded_by=?,deleted_at=NULL,deleted_by=NULL,deletion_reason=NULL WHERE custom_value_id=?`,
            [encoded, nextVersion, actorUserId, current.custom_value_id],
          );
          await db.execute(
            `INSERT INTO clinical_custom_field_value_history(custom_value_id,version,value_json,changed_by) VALUES(?,?,?,?)`,
            [current.custom_value_id, nextVersion, encoded, actorUserId],
          );
        } else {
          const columns = [
            "custom_field_id",
            context.id,
            "value_json",
            "recorded_by",
          ];
          const [created] = await db.execute(
            `INSERT INTO clinical_custom_field_values(${columns.join(",")}) VALUES(?,?,?,?)`,
            [field.custom_field_id, recordId, encoded, actorUserId],
          );
          await db.execute(
            `INSERT INTO clinical_custom_field_value_history(custom_value_id,version,value_json,changed_by) VALUES(?,1,?,?)`,
            [created.insertId, encoded, actorUserId],
          );
        }
      }
      await db.execute(
        `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,after_data) VALUES(?,'UPDATE',?, ?,JSON_OBJECT('custom_fields_saved',?))`,
        [
          actorUserId,
          `${req.params.context}_custom_fields`,
          recordId,
          Object.keys(supplied).length,
        ],
      );
    });
    res.json({ context: req.params.context, recordId });
  } catch (error) {
    next(error);
  }
});

// Return the chronological revision history for every custom answer on a record.
router.get("/:context/records/:recordId/history", async (req, res, next) => {
  try {
    const context = contextFrom(req),
      recordId = Number(req.params.recordId);
    const [rows] = await pool.execute(
      `SELECT h.history_id,h.version,h.value_json,h.changed_at,u.full_name changed_by,
      f.custom_field_id,f.field_key,f.label FROM clinical_custom_field_value_history h
      JOIN clinical_custom_field_values v ON v.custom_value_id=h.custom_value_id
      JOIN clinical_custom_fields f ON f.custom_field_id=v.custom_field_id
      JOIN users u ON u.user_id=h.changed_by
      WHERE f.context_type=? AND v.${context.id}=? ORDER BY h.changed_at DESC,h.history_id DESC`,
      [req.params.context, recordId],
    );
    res.json(rows.map((row) => ({ ...row, value: parseJson(row.value_json) })));
  } catch (error) {
    next(error);
  }
});

export default router;
