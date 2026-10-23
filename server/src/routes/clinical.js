/**
 * Clinical CRUD routes for encounters, diagnoses, observations,
 * prescriptions, laboratory orders, allergies, and immunizations.
 */
import { Router } from "express";
import { z } from "zod";
import { pool, transaction } from "../db.js";

const router = Router();

// Zod schemas form the API boundary and reject malformed clinical payloads.
const optionalNumber = z.union([z.number(), z.null()]).optional();
const encounterSchema = z.object({
  doctorId: z.number().int().positive(),
  visitStartedAt: z.string().min(16),
  visitEndedAt: z.string().nullable().optional(),
  chiefComplaint: z.string().min(2).max(500),
  disposition: z
    .enum(["home", "admitted", "referred", "observation", "left_without_care"])
    .default("home"),
  history: z.string().max(10000).optional(),
  examination: z.string().max(10000).optional(),
  clinicalNotes: z.string().max(10000).optional(),
  diagnosisName: z.string().max(180).optional(),
  icdCode: z.string().max(20).optional(),
  diagnosisType: z
    .enum(["provisional", "confirmed", "differential", "resolved"])
    .default("confirmed"),
  temperatureC: optionalNumber,
  heartRateBpm: optionalNumber,
  respiratoryRateBpm: optionalNumber,
  systolicBp: optionalNumber,
  diastolicBp: optionalNumber,
  oxygenSaturation: optionalNumber,
  heightCm: optionalNumber,
  weightKg: optionalNumber,
  headCircumferenceCm: optionalNumber,
  heightPercentile: optionalNumber,
  weightPercentile: optionalNumber,
});
const allergySchema = z.object({
  allergen: z.string().min(1).max(120),
  reaction: z.string().max(255).optional(),
  severity: z.enum(["mild", "moderate", "severe", "unknown"]),
  status: z.enum(["active", "resolved", "unconfirmed"]).default("active"),
});
const immunizationSchema = z.object({
  vaccineName: z.string().min(1).max(150),
  doseNumber: z.number().int().positive().nullable().optional(),
  administeredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lotNumber: z.string().max(80).optional(),
  administeredBy: z.number().int().positive().nullable().optional(),
});
const prescriptionSchema = z.object({
  visitId: z.number().int().positive(),
  doctorId: z.number().int().positive(),
  prescribedAt: z.string().min(16),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        medicationId: z.number().int().positive(),
        dose: z.string().min(1).max(80),
        frequency: z.string().min(1).max(80),
        route: z.string().min(1).max(60),
        durationDays: z.number().int().positive().nullable().optional(),
        instructions: z.string().max(500).optional(),
      }),
    )
    .min(1),
});
const labSchema = z.object({
  visitId: z.number().int().positive(),
  labTestId: z.number().int().positive(),
  orderedBy: z.number().int().positive(),
  status: z.enum(["ordered", "collected", "completed", "cancelled"]),
  orderedAt: z.string().min(16),
  resultValue: z.string().max(120).optional(),
  isAbnormal: z.boolean().default(false),
  resultNotes: z.string().max(500).optional(),
  resultedAt: z.string().nullable().optional(),
});
const deletionSchema = z.object({ reason: z.string().trim().min(3).max(500) });

// Return reference catalogues used by encounter, prescription, and lab forms.
router.get("/meta", async (_req, res, next) => {
  try {
    const [[doctors], [medications], [labTests]] = await Promise.all([
      pool.query(
        `SELECT d.doctor_id,u.full_name,d.specialization FROM doctors d JOIN users u USING(user_id) ORDER BY u.full_name`,
      ),
      pool.query(
        `SELECT medication_id,generic_name,brand_name,form,strength FROM medications WHERE is_active ORDER BY generic_name`,
      ),
      pool.query(
        `SELECT lab_test_id,test_code,test_name,unit,reference_range FROM lab_tests ORDER BY test_name`,
      ),
    ]);
    res.json({ doctors, medications, labTests });
  } catch (e) {
    next(e);
  }
});

// Reconstruct one consultation from its normalized visit, record, diagnosis, and measurements.
router.get("/visits/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [[visits], [records], [diagnoses], [vitals], [growth]] =
      await Promise.all([
        pool.execute(
          "SELECT * FROM visits WHERE visit_id=? AND deleted_at IS NULL",
          [id],
        ),
        pool.execute(
          "SELECT * FROM medical_records WHERE visit_id=? AND deleted_at IS NULL",
          [id],
        ),
        pool.execute(
          `SELECT d.* FROM diagnoses d JOIN medical_records mr USING(medical_record_id) WHERE mr.visit_id=? AND d.deleted_at IS NULL AND mr.deleted_at IS NULL ORDER BY d.is_primary DESC`,
          [id],
        ),
        pool.execute(
          "SELECT * FROM vital_signs WHERE visit_id=? AND deleted_at IS NULL ORDER BY measured_at DESC LIMIT 1",
          [id],
        ),
        pool.execute(
          "SELECT * FROM growth_records WHERE visit_id=? AND deleted_at IS NULL",
          [id],
        ),
      ]);
    if (!visits[0])
      return res.status(404).json({ error: "Encounter not found" });
    res.json({
      visit: visits[0],
      record: records[0] || null,
      diagnoses,
      vitals: vitals[0] || null,
      growth: growth[0] || null,
    });
  } catch (e) {
    next(e);
  }
});

// Create all parts of a consultation atomically so partial medical records cannot remain.
router.post("/patients/:patientId/encounters", async (req, res, next) => {
  try {
    const patientId = Number(req.params.patientId),
      d = encounterSchema.parse(req.body);
    const result = await transaction(async (db) => {
      const [v] = await db.execute(
        `INSERT INTO visits(patient_id,doctor_id,visit_started_at,visit_ended_at,chief_complaint,disposition) VALUES(?,?,?,?,?,?)`,
        [
          patientId,
          d.doctorId,
          d.visitStartedAt,
          d.visitEndedAt || null,
          d.chiefComplaint,
          d.disposition,
        ],
      );
      const [mr] = await db.execute(
        `INSERT INTO medical_records(visit_id,history,examination,clinical_notes,recorded_by) VALUES(?,?,?,?,1)`,
        [
          v.insertId,
          d.history || null,
          d.examination || null,
          d.clinicalNotes || null,
        ],
      );
      if (d.diagnosisName)
        await db.execute(
          `INSERT INTO diagnoses(medical_record_id,icd_code,diagnosis_name,diagnosis_type,is_primary) VALUES(?,?,?,?,TRUE)`,
          [mr.insertId, d.icdCode || null, d.diagnosisName, d.diagnosisType],
        );
      if (
        [
          d.temperatureC,
          d.heartRateBpm,
          d.respiratoryRateBpm,
          d.systolicBp,
          d.diastolicBp,
          d.oxygenSaturation,
        ].some((x) => x != null)
      )
        await db.execute(
          `INSERT INTO vital_signs(visit_id,temperature_c,heart_rate_bpm,respiratory_rate_bpm,systolic_bp,diastolic_bp,oxygen_saturation,measured_at,measured_by) VALUES(?,?,?,?,?,?,?,?,1)`,
          [
            v.insertId,
            d.temperatureC ?? null,
            d.heartRateBpm ?? null,
            d.respiratoryRateBpm ?? null,
            d.systolicBp ?? null,
            d.diastolicBp ?? null,
            d.oxygenSaturation ?? null,
            d.visitStartedAt,
          ],
        );
      if (d.heightCm != null || d.weightKg != null)
        await db.execute(
          `INSERT INTO growth_records(visit_id,patient_id,height_cm,weight_kg,head_circumference_cm,height_percentile,weight_percentile,measured_at) VALUES(?,?,?,?,?,?,?,?)`,
          [
            v.insertId,
            patientId,
            d.heightCm ?? null,
            d.weightKg ?? null,
            d.headCircumferenceCm ?? null,
            d.heightPercentile ?? null,
            d.weightPercentile ?? null,
            d.visitStartedAt,
          ],
        );
      await audit(db, "CREATE", "visit", v.insertId, {
        patient_id: patientId,
        chief_complaint: d.chiefComplaint,
      });
      return v.insertId;
    });
    res.status(201).json({ visitId: result });
  } catch (e) {
    next(e);
  }
});

// Update the consultation and upsert its one-to-one record/growth information.
router.put("/visits/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id),
      d = encounterSchema.parse(req.body);
    await transaction(async (db) => {
      const [[visit]] = await db.execute(
        "SELECT patient_id FROM visits WHERE visit_id=? AND deleted_at IS NULL",
        [id],
      );
      if (!visit) {
        const e = new Error("Encounter not found");
        e.status = 404;
        throw e;
      }
      await db.execute(
        `UPDATE visits SET doctor_id=?,visit_started_at=?,visit_ended_at=?,chief_complaint=?,disposition=? WHERE visit_id=? AND deleted_at IS NULL`,
        [
          d.doctorId,
          d.visitStartedAt,
          d.visitEndedAt || null,
          d.chiefComplaint,
          d.disposition,
          id,
        ],
      );
      await db.execute(
        `INSERT INTO medical_records(visit_id,history,examination,clinical_notes,recorded_by) VALUES(?,?,?,?,1) ON DUPLICATE KEY UPDATE history=VALUES(history),examination=VALUES(examination),clinical_notes=VALUES(clinical_notes),recorded_by=1,deleted_at=NULL,deleted_by=NULL,deletion_reason=NULL`,
        [id, d.history || null, d.examination || null, d.clinicalNotes || null],
      );
      const [[mr]] = await db.execute(
        "SELECT medical_record_id FROM medical_records WHERE visit_id=? AND deleted_at IS NULL",
        [id],
      );
      const [[primary]] = await db.execute(
        "SELECT diagnosis_id FROM diagnoses WHERE medical_record_id=? AND is_primary=TRUE AND deleted_at IS NULL LIMIT 1",
        [mr.medical_record_id],
      );
      if (d.diagnosisName) {
        if (primary)
          await db.execute(
            `UPDATE diagnoses SET icd_code=?,diagnosis_name=?,diagnosis_type=? WHERE diagnosis_id=? AND deleted_at IS NULL`,
            [
              d.icdCode || null,
              d.diagnosisName,
              d.diagnosisType,
              primary.diagnosis_id,
            ],
          );
        else
          await db.execute(
            `INSERT INTO diagnoses(medical_record_id,icd_code,diagnosis_name,diagnosis_type,is_primary) VALUES(?,?,?,?,TRUE)`,
            [
              mr.medical_record_id,
              d.icdCode || null,
              d.diagnosisName,
              d.diagnosisType,
            ],
          );
      }
      const [[vs]] = await db.execute(
        "SELECT vital_sign_id FROM vital_signs WHERE visit_id=? AND deleted_at IS NULL ORDER BY measured_at DESC LIMIT 1",
        [id],
      );
      if (
        [
          d.temperatureC,
          d.heartRateBpm,
          d.respiratoryRateBpm,
          d.systolicBp,
          d.diastolicBp,
          d.oxygenSaturation,
        ].some((x) => x != null)
      ) {
        if (vs)
          await db.execute(
            `UPDATE vital_signs SET temperature_c=?,heart_rate_bpm=?,respiratory_rate_bpm=?,systolic_bp=?,diastolic_bp=?,oxygen_saturation=?,measured_at=? WHERE vital_sign_id=? AND deleted_at IS NULL`,
            [
              d.temperatureC ?? null,
              d.heartRateBpm ?? null,
              d.respiratoryRateBpm ?? null,
              d.systolicBp ?? null,
              d.diastolicBp ?? null,
              d.oxygenSaturation ?? null,
              d.visitStartedAt,
              vs.vital_sign_id,
            ],
          );
        else
          await db.execute(
            `INSERT INTO vital_signs(visit_id,temperature_c,heart_rate_bpm,respiratory_rate_bpm,systolic_bp,diastolic_bp,oxygen_saturation,measured_at,measured_by) VALUES(?,?,?,?,?,?,?,?,1)`,
            [
              id,
              d.temperatureC ?? null,
              d.heartRateBpm ?? null,
              d.respiratoryRateBpm ?? null,
              d.systolicBp ?? null,
              d.diastolicBp ?? null,
              d.oxygenSaturation ?? null,
              d.visitStartedAt,
            ],
          );
      }
      await db.execute(
        `INSERT INTO growth_records(visit_id,patient_id,height_cm,weight_kg,head_circumference_cm,height_percentile,weight_percentile,measured_at) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE height_cm=VALUES(height_cm),weight_kg=VALUES(weight_kg),head_circumference_cm=VALUES(head_circumference_cm),height_percentile=VALUES(height_percentile),weight_percentile=VALUES(weight_percentile),measured_at=VALUES(measured_at),deleted_at=NULL,deleted_by=NULL,deletion_reason=NULL`,
        [
          id,
          visit.patient_id,
          d.heightCm ?? null,
          d.weightKg ?? null,
          d.headCircumferenceCm ?? null,
          d.heightPercentile ?? null,
          d.weightPercentile ?? null,
          d.visitStartedAt,
        ],
      );
      await audit(db, "UPDATE", "visit", id, {
        chief_complaint: d.chiefComplaint,
      });
    });
    res.json({ visitId: id });
  } catch (e) {
    next(e);
  }
});
// Clinical records are retired, never physically deleted through the API.
router.delete("/visits/:id", softDelete("visits", "visit_id", "visit"));

// Allergy endpoints maintain patient-level safety information across visits.
router.post("/patients/:patientId/allergies", async (req, res, next) => {
  try {
    const patientId = Number(req.params.patientId),
      d = allergySchema.parse(req.body);
    const [r] = await pool.execute(
      `INSERT INTO allergies(patient_id,allergen,reaction,severity,status) VALUES(?,?,?,?,?)`,
      [patientId, d.allergen, d.reaction || null, d.severity, d.status],
    );
    res.status(201).json({ allergyId: r.insertId });
  } catch (e) {
    next(e);
  }
});
router.put("/allergies/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id),
      d = allergySchema.parse(req.body);
    const [r] = await pool.execute(
      `UPDATE allergies SET allergen=?,reaction=?,severity=?,status=? WHERE allergy_id=? AND deleted_at IS NULL`,
      [d.allergen, d.reaction || null, d.severity, d.status, id],
    );
    if (!r.affectedRows)
      return res.status(404).json({ error: "Allergy not found" });
    res.json({ allergyId: id });
  } catch (e) {
    next(e);
  }
});
router.delete(
  "/allergies/:id",
  softDelete("allergies", "allergy_id", "allergy"),
);

// Immunization endpoints maintain the patient's longitudinal vaccine history.
router.post("/patients/:patientId/immunizations", async (req, res, next) => {
  try {
    const patientId = Number(req.params.patientId),
      d = immunizationSchema.parse(req.body);
    const [r] = await pool.execute(
      `INSERT INTO immunizations(patient_id,vaccine_name,dose_number,administered_on,lot_number,administered_by) VALUES(?,?,?,?,?,?)`,
      [
        patientId,
        d.vaccineName,
        d.doseNumber ?? null,
        d.administeredOn,
        d.lotNumber || null,
        d.administeredBy ?? null,
      ],
    );
    res.status(201).json({ immunizationId: r.insertId });
  } catch (e) {
    next(e);
  }
});
router.put("/immunizations/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id),
      d = immunizationSchema.parse(req.body);
    const [r] = await pool.execute(
      `UPDATE immunizations SET vaccine_name=?,dose_number=?,administered_on=?,lot_number=?,administered_by=? WHERE immunization_id=? AND deleted_at IS NULL`,
      [
        d.vaccineName,
        d.doseNumber ?? null,
        d.administeredOn,
        d.lotNumber || null,
        d.administeredBy ?? null,
        id,
      ],
    );
    if (!r.affectedRows)
      return res.status(404).json({ error: "Immunization not found" });
    res.json({ immunizationId: id });
  } catch (e) {
    next(e);
  }
});
router.delete(
  "/immunizations/:id",
  softDelete("immunizations", "immunization_id", "immunization"),
);

// Prescription endpoints save a header plus one or more medication instructions.
router.post("/patients/:patientId/prescriptions", async (req, res, next) => {
  try {
    const patientId = Number(req.params.patientId),
      d = prescriptionSchema.parse(req.body);
    const id = await savePrescription(null, patientId, d);
    res.status(201).json({ prescriptionId: id });
  } catch (e) {
    next(e);
  }
});
router.put("/prescriptions/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id),
      d = prescriptionSchema.parse(req.body);
    const [[rx]] = await pool.execute(
      "SELECT patient_id FROM prescriptions WHERE prescription_id=? AND deleted_at IS NULL",
      [id],
    );
    if (!rx) return res.status(404).json({ error: "Prescription not found" });
    await savePrescription(id, rx.patient_id, d);
    res.json({ prescriptionId: id });
  } catch (e) {
    next(e);
  }
});
router.delete("/prescriptions/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id),
      d = deletionSchema.parse(req.body);
    await transaction(async (db) => {
      const [r] = await db.execute(
        `UPDATE prescriptions SET deleted_at=CURRENT_TIMESTAMP,deleted_by=1,deletion_reason=? WHERE prescription_id=? AND deleted_at IS NULL`,
        [d.reason, id],
      );
      if (!r.affectedRows) {
        const e = new Error("Prescription not found");
        e.status = 404;
        throw e;
      }
      await db.execute(
        `UPDATE prescription_items SET deleted_at=CURRENT_TIMESTAMP,deleted_by=1,deletion_reason=? WHERE prescription_id=? AND deleted_at IS NULL`,
        [`Parent prescription deleted: ${d.reason}`, id],
      );
      await audit(db, "SOFT_DELETE", "prescription", id, { reason: d.reason });
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// Lab endpoints manage an order and its optional one-to-one current result.
router.post("/labs", async (req, res, next) => {
  try {
    const d = labSchema.parse(req.body);
    const id = await saveLab(null, d);
    res.status(201).json({ labOrderId: id });
  } catch (e) {
    next(e);
  }
});
router.put("/labs/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id),
      d = labSchema.parse(req.body);
    await saveLab(id, d);
    res.json({ labOrderId: id });
  } catch (e) {
    next(e);
  }
});
router.delete("/labs/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id),
      d = deletionSchema.parse(req.body);
    await transaction(async (db) => {
      const [r] = await db.execute(
        `UPDATE lab_orders SET deleted_at=CURRENT_TIMESTAMP,deleted_by=1,deletion_reason=? WHERE lab_order_id=? AND deleted_at IS NULL`,
        [d.reason, id],
      );
      if (!r.affectedRows) {
        const e = new Error("Lab order not found");
        e.status = 404;
        throw e;
      }
      await db.execute(
        `UPDATE lab_results SET deleted_at=CURRENT_TIMESTAMP,deleted_by=1,deletion_reason=? WHERE lab_order_id=? AND deleted_at IS NULL`,
        [`Parent lab order deleted: ${d.reason}`, id],
      );
      await audit(db, "SOFT_DELETE", "lab_order", id, { reason: d.reason });
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

/**
 * Create or replace the editable contents of a prescription. Existing items are
 * soft-deleted on edit so the previous instructions remain recoverable.
 */
async function savePrescription(id, patientId, d) {
  return transaction(async (db) => {
    let rxId = id;
    if (id) {
      await db.execute(
        `UPDATE prescriptions SET visit_id=?,doctor_id=?,prescribed_at=?,notes=? WHERE prescription_id=? AND deleted_at IS NULL`,
        [d.visitId, d.doctorId, d.prescribedAt, d.notes || null, id],
      );
      await db.execute(
        `UPDATE prescription_items SET deleted_at=CURRENT_TIMESTAMP,deleted_by=1,deletion_reason='Replaced during prescription edit' WHERE prescription_id=? AND deleted_at IS NULL`,
        [id],
      );
    } else {
      const [r] = await db.execute(
        `INSERT INTO prescriptions(visit_id,patient_id,doctor_id,prescribed_at,notes) VALUES(?,?,?,?,?)`,
        [d.visitId, patientId, d.doctorId, d.prescribedAt, d.notes || null],
      );
      rxId = r.insertId;
    }
    for (const item of d.items)
      await db.execute(
        `INSERT INTO prescription_items(prescription_id,medication_id,dose,frequency,route,duration_days,instructions) VALUES(?,?,?,?,?,?,?)`,
        [
          rxId,
          item.medicationId,
          item.dose,
          item.frequency,
          item.route,
          item.durationDays ?? null,
          item.instructions || null,
        ],
      );
    await audit(db, id ? "UPDATE" : "CREATE", "prescription", rxId, {
      patient_id: patientId,
      item_count: d.items.length,
    });
    return rxId;
  });
}
/** Create/update a lab order and upsert its optional current result atomically. */
async function saveLab(id, d) {
  return transaction(async (db) => {
    let orderId = id;
    if (id) {
      const [r] = await db.execute(
        `UPDATE lab_orders SET visit_id=?,lab_test_id=?,ordered_by=?,status=?,ordered_at=? WHERE lab_order_id=? AND deleted_at IS NULL`,
        [d.visitId, d.labTestId, d.orderedBy, d.status, d.orderedAt, id],
      );
      if (!r.affectedRows) {
        const e = new Error("Lab order not found");
        e.status = 404;
        throw e;
      }
    } else {
      const [r] = await db.execute(
        `INSERT INTO lab_orders(visit_id,lab_test_id,ordered_by,status,ordered_at) VALUES(?,?,?,?,?)`,
        [d.visitId, d.labTestId, d.orderedBy, d.status, d.orderedAt],
      );
      orderId = r.insertId;
    }
    if (d.resultValue)
      await db.execute(
        `INSERT INTO lab_results(lab_order_id,result_value,is_abnormal,notes,resulted_at) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE result_value=VALUES(result_value),is_abnormal=VALUES(is_abnormal),notes=VALUES(notes),resulted_at=VALUES(resulted_at),deleted_at=NULL,deleted_by=NULL,deletion_reason=NULL`,
        [
          orderId,
          d.resultValue,
          d.isAbnormal,
          d.resultNotes || null,
          d.resultedAt || d.orderedAt,
        ],
      );
    await audit(db, id ? "UPDATE" : "CREATE", "lab_order", orderId, {
      status: d.status,
      test_id: d.labTestId,
    });
    return orderId;
  });
}
/** Write a compact JSON audit event using the same transaction connection. */
async function audit(db, action, type, id, data) {
  await db.execute(
    `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,after_data) VALUES(1,?,?,?,?)`,
    [action, type, id, JSON.stringify(data)],
  );
}
/** Build a consistent soft-delete handler for approved clinical table names. */
function softDelete(table, idColumn, entityType) {
  return async (req, res, next) => {
    try {
      const id = Number(req.params.id),
        d = deletionSchema.parse(req.body);
      await transaction(async (db) => {
        const [r] = await db.execute(
          `UPDATE ${table} SET deleted_at=CURRENT_TIMESTAMP,deleted_by=1,deletion_reason=? WHERE ${idColumn}=? AND deleted_at IS NULL`,
          [d.reason, id],
        );
        if (!r.affectedRows) {
          const e = new Error(`${entityType.replace("_", " ")} not found`);
          e.status = 404;
          throw e;
        }
        await audit(db, "SOFT_DELETE", entityType, id, { reason: d.reason });
      });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  };
}

export default router;
