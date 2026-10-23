/**
 * Follow-up workflow routes: queues, visit-linked history, assignment, notes,
 * completion outcomes, and auditable soft deletion.
 */
import { Router } from "express";
import { z } from "zod";
import { pool, transaction } from "../db.js";

const router = Router();

// Creation and partial-update contracts are kept separate intentionally.
const followUpSchema = z.object({
  visitId: z.number().int().positive(),
  category: z.enum([
    "clinical_review",
    "lab_result",
    "medication",
    "immunization",
    "growth_monitoring",
    "referral",
    "care_coordination",
    "other",
  ]),
  priority: z.enum(["routine", "urgent", "high_risk"]),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(2).max(255),
  assignedUserId: z.number().int().positive().nullable().optional(),
  contactChannel: z.enum([
    "phone",
    "sms",
    "email",
    "portal",
    "in_person",
    "none",
  ]),
  nextAction: z.string().max(500).optional(),
});
const updateSchema = z.object({
  category: z
    .enum([
      "clinical_review",
      "lab_result",
      "medication",
      "immunization",
      "growth_monitoring",
      "referral",
      "care_coordination",
      "other",
    ])
    .optional(),
  priority: z.enum(["routine", "urgent", "high_risk"]).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  reason: z.string().min(2).max(255).optional(),
  status: z
    .enum(["pending", "scheduled", "completed", "cancelled", "overdue"])
    .optional(),
  assignedUserId: z.number().int().positive().nullable().optional(),
  contactChannel: z
    .enum(["phone", "sms", "email", "portal", "in_person", "none"])
    .optional(),
  contactStatus: z
    .enum([
      "not_started",
      "attempted",
      "reached",
      "message_left",
      "unreachable",
      "declined",
    ])
    .optional(),
  nextAction: z.string().max(500).nullable().optional(),
  outcome: z.string().max(5000).nullable().optional(),
});

// Supply active assignees and recent visits needed by the create/edit controls.
router.get("/meta", async (_req, res, next) => {
  try {
    const [[users], [visits]] = await Promise.all([
      pool.query(
        `SELECT u.user_id,u.full_name,r.role_name FROM users u JOIN roles r USING(role_id) WHERE u.is_active ORDER BY u.full_name`,
      ),
      pool.query(
        `SELECT v.visit_id,v.patient_id,v.visit_started_at,CONCAT(p.first_name,' ',p.last_name) patient_name,p.medical_record_number FROM visits v JOIN patients p USING(patient_id) WHERE v.deleted_at IS NULL AND p.deleted_at IS NULL ORDER BY v.visit_started_at DESC LIMIT 200`,
      ),
    ]);
    res.json({ users, visits });
  } catch (e) {
    next(e);
  }
});

// Find all earlier follow-ups for the patient who owns the supplied visit.
router.get("/history/by-visit/:visitId", async (req, res, next) => {
  try {
    const visitId = Number(req.params.visitId);
    const [rows] = await pool.execute(
      `SELECT f.follow_up_id,f.visit_id,f.category,f.priority,f.due_date,f.reason,
    f.status,f.next_action,f.outcome,f.completed_at,f.updated_at,
    (SELECT COUNT(*) FROM follow_up_notes n WHERE n.follow_up_id=f.follow_up_id) note_count
    FROM follow_ups f JOIN visits v ON v.visit_id=f.visit_id
    WHERE v.patient_id=(SELECT patient_id FROM visits WHERE visit_id=? AND deleted_at IS NULL)
      AND f.deleted_at IS NULL AND v.deleted_at IS NULL
    ORDER BY f.due_date DESC,f.follow_up_id DESC`,
      [visitId],
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Return the filtered operational queue and promote past-due pending work to overdue.
router.get("/", async (req, res, next) => {
  try {
    await pool.query(
      "UPDATE follow_ups SET status='overdue' WHERE deleted_at IS NULL AND status='pending' AND due_date<CURRENT_DATE",
    );
    const status = String(req.query.status || "open"),
      priority = String(req.query.priority || "all"),
      q = String(req.query.q || "").trim();
    const [rows] = await pool.execute(
      `SELECT f.*,v.patient_id,v.visit_started_at,p.medical_record_number,CONCAT(p.first_name,' ',p.last_name) patient_name,
    u.full_name assigned_to,du.full_name doctor_name,
    (SELECT JSON_OBJECTAGG(cf.field_key,cv.value_json)
       FROM clinical_custom_field_values cv JOIN clinical_custom_fields cf USING(custom_field_id)
       WHERE cv.follow_up_id=f.follow_up_id AND cv.deleted_at IS NULL AND cf.deleted_at IS NULL) custom_values,
    (SELECT COUNT(*) FROM follow_up_notes n WHERE n.follow_up_id=f.follow_up_id) note_count
    FROM follow_ups f JOIN visits v USING(visit_id) JOIN patients p USING(patient_id)
    LEFT JOIN users u ON u.user_id=f.assigned_user_id LEFT JOIN doctors d ON d.doctor_id=v.doctor_id LEFT JOIN users du ON du.user_id=d.user_id
    WHERE f.deleted_at IS NULL AND v.deleted_at IS NULL AND p.deleted_at IS NULL
      AND (?='all' OR (?='open' AND f.status IN ('pending','scheduled','overdue')) OR f.status=?)
      AND (?='all' OR f.priority=?)
      AND (?='' OR p.medical_record_number LIKE CONCAT('%',?,'%') OR p.first_name LIKE CONCAT('%',?,'%') OR p.last_name LIKE CONCAT('%',?,'%') OR f.reason LIKE CONCAT('%',?,'%'))
    ORDER BY FIELD(f.priority,'high_risk','urgent','routine'),f.due_date ASC`,
      [status, status, status, priority, priority, q, q, q, q, q],
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Load one task, its note timeline, and earlier tasks for the same patient.
router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [[items], [notes], [previous]] = await Promise.all([
      pool.execute(
        `SELECT f.*,v.patient_id,p.medical_record_number,CONCAT(p.first_name,' ',p.last_name) patient_name,u.full_name assigned_to,
    (SELECT JSON_OBJECTAGG(cf.field_key,cv.value_json)
       FROM clinical_custom_field_values cv JOIN clinical_custom_fields cf USING(custom_field_id)
       WHERE cv.follow_up_id=f.follow_up_id AND cv.deleted_at IS NULL AND cf.deleted_at IS NULL) custom_values
    FROM follow_ups f JOIN visits v USING(visit_id) JOIN patients p USING(patient_id) LEFT JOIN users u ON u.user_id=f.assigned_user_id WHERE f.follow_up_id=? AND f.deleted_at IS NULL AND v.deleted_at IS NULL AND p.deleted_at IS NULL`,
        [id],
      ),
      pool.execute(
        `SELECT n.*,u.full_name author_name FROM follow_up_notes n JOIN users u ON u.user_id=n.author_user_id WHERE n.follow_up_id=? ORDER BY n.created_at DESC`,
        [id],
      ),
      pool.execute(
        `SELECT pf.follow_up_id,pf.visit_id,pf.category,pf.priority,pf.due_date,pf.reason,pf.status,
    pf.next_action,pf.outcome,pf.completed_at,(SELECT COUNT(*) FROM follow_up_notes n WHERE n.follow_up_id=pf.follow_up_id) note_count
    FROM follow_ups pf JOIN visits pv ON pv.visit_id=pf.visit_id
    WHERE pv.patient_id=(SELECT v.patient_id FROM follow_ups f JOIN visits v USING(visit_id) WHERE f.follow_up_id=? AND f.deleted_at IS NULL)
      AND pf.follow_up_id<>? AND pf.deleted_at IS NULL AND pv.deleted_at IS NULL
    ORDER BY pf.due_date DESC,pf.follow_up_id DESC LIMIT 20`,
        [id, id],
      ),
    ]);
    if (!items[0])
      return res.status(404).json({ error: "Follow-up not found" });
    res.json({ followUp: items[0], notes, previous });
  } catch (e) {
    next(e);
  }
});

// Create a visit-linked task and its audit event in one transaction.
router.post("/", async (req, res, next) => {
  try {
    const d = followUpSchema.parse(req.body);
    const result = await transaction(async (db) => {
      const [r] = await db.execute(
        `INSERT INTO follow_ups(visit_id,category,priority,assigned_user_id,due_date,reason,contact_channel,next_action,status) VALUES(?,?,?,?,?,?,?,?, 'pending')`,
        [
          d.visitId,
          d.category,
          d.priority,
          d.assignedUserId || null,
          d.dueDate,
          d.reason,
          d.contactChannel,
          d.nextAction || null,
        ],
      );
      await db.execute(
        `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,after_data) VALUES(1,'CREATE','follow_up',?,JSON_OBJECT('priority',?,'due_date',?,'reason',?))`,
        [r.insertId, d.priority, d.dueDate, d.reason],
      );
      return r.insertId;
    });
    res.status(201).json({ followUpId: result });
  } catch (e) {
    next(e);
  }
});

// Apply only supplied task fields and append a status-change note for traceability.
router.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id),
      d = updateSchema.parse(req.body);
    const map = {
      category: "category",
      priority: "priority",
      dueDate: "due_date",
      reason: "reason",
      status: "status",
      assignedUserId: "assigned_user_id",
      contactChannel: "contact_channel",
      contactStatus: "contact_status",
      nextAction: "next_action",
      outcome: "outcome",
    };
    const entries = Object.entries(d);
    if (!entries.length)
      return res.status(400).json({ error: "No changes supplied" });
    await transaction(async (db) => {
      const [[before]] = await db.execute(
        "SELECT * FROM follow_ups WHERE follow_up_id=? AND deleted_at IS NULL",
        [id],
      );
      if (!before) {
        const e = new Error("Follow-up not found");
        e.status = 404;
        throw e;
      }
      const set = entries.map(([k]) => `${map[k]}=?`).join(",");
      await db.execute(
        `UPDATE follow_ups SET ${set},completed_at=CASE WHEN ?='completed' THEN COALESCE(completed_at,CURRENT_TIMESTAMP) ELSE completed_at END WHERE follow_up_id=? AND deleted_at IS NULL`,
        [...entries.map(([, v]) => (v === "" ? null : v)), d.status || "", id],
      );
      await db.execute(
        `INSERT INTO follow_up_notes(follow_up_id,author_user_id,note_type,note_text) VALUES(?,1,'status_change',?)`,
        [id, `Updated: ${entries.map(([k]) => k).join(", ")}`],
      );
    });
    res.json({ followUpId: id });
  } catch (e) {
    next(e);
  }
});

// Append, rather than overwrite, a dated communication or clinical note.
router.post("/:id/notes", async (req, res, next) => {
  try {
    const id = Number(req.params.id),
      d = z
        .object({
          noteType: z.enum([
            "clinical",
            "contact_attempt",
            "status_change",
            "coordination",
            "general",
          ]),
          noteText: z.string().min(2).max(5000),
          contactChannel: z
            .enum(["phone", "sms", "email", "portal", "in_person", "none"])
            .nullable()
            .optional(),
        })
        .parse(req.body);
    const [r] = await pool.execute(
      "INSERT INTO follow_up_notes(follow_up_id,author_user_id,note_type,note_text,contact_channel) VALUES(?,1,?,?,?)",
      [id, d.noteType, d.noteText, d.contactChannel || null],
    );
    res.status(201).json({ noteId: r.insertId });
  } catch (e) {
    next(e);
  }
});

// Soft-delete the task and retain the reason in both the row and audit trail.
router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id),
      d = z.object({ reason: z.string().min(3).max(500) }).parse(req.body);
    const [r] = await pool.execute(
      `UPDATE follow_ups SET deleted_at=CURRENT_TIMESTAMP,deleted_by=1,deletion_reason=? WHERE follow_up_id=? AND deleted_at IS NULL`,
      [d.reason, id],
    );
    if (!r.affectedRows)
      return res.status(404).json({ error: "Follow-up not found" });
    await pool.execute(
      `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,after_data) VALUES(1,'SOFT_DELETE','follow_up',?,JSON_OBJECT('reason',?))`,
      [id, d.reason],
    );
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
