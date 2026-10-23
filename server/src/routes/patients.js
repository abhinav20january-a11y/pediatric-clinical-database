/**
 * Patient registry routes: search, complete longitudinal profile, registration,
 * controlled demographic updates, and soft deletion.
 */
import { Router } from "express";
import { z } from "zod";
import { pool, transaction } from "../db.js";

const router = Router();

// Registration requires identity and guardian data; edits use a partial schema.
const patientSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  middleName: z.string().max(80).optional(),
  preferredName: z.string().max(80).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sexAtBirth: z.enum(["female", "male", "intersex", "unknown"]),
  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"])
    .default("unknown"),
  phone: z.string().max(30).optional(),
  alternatePhone: z.string().max(30).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  addressLine: z.string().max(255).optional(),
  addressLine2: z.string().max(255).optional(),
  city: z.string().max(80).optional(),
  stateProvince: z.string().max(80).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(80).default("India"),
  nationality: z.string().max(80).optional(),
  preferredLanguage: z.string().max(60).default("English"),
  communicationPreference: z
    .enum(["phone", "sms", "email", "portal", "guardian"])
    .default("guardian"),
  registrationSource: z
    .enum(["walk_in", "referral", "emergency", "transfer", "online"])
    .default("walk_in"),
  consentToTreatment: z.boolean().default(false),
  consentToContact: z.boolean().default(false),
  guardianName: z.string().min(1).max(120),
  guardianPhone: z.string().min(5).max(30),
  guardianEmail: z.string().email().or(z.literal("")).optional(),
  relationship: z.string().min(1).max(40),
  identifierType: z
    .enum([
      "national_health_id",
      "government_id",
      "passport",
      "birth_certificate",
      "other",
    ])
    .optional(),
  identifierValue: z.string().max(120).optional(),
});

const patientUpdateSchema = patientSchema
  .omit({
    guardianName: true,
    guardianPhone: true,
    guardianEmail: true,
    relationship: true,
    identifierType: true,
    identifierValue: true,
  })
  .partial();

// Search active patients by MRN, identifier, phone, or partial name.
router.get("/", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const [rows] = await pool.execute(
      `SELECT patient_id,medical_record_number,first_name,last_name,preferred_name,date_of_birth,sex_at_birth,blood_group,phone
      FROM patients WHERE is_active AND deleted_at IS NULL AND (?='' OR medical_record_number LIKE CONCAT('%',?,'%') OR phone LIKE CONCAT('%',?,'%') OR first_name LIKE CONCAT('%',?,'%') OR last_name LIKE CONCAT('%',?,'%') OR EXISTS(SELECT 1 FROM patient_identifiers pi WHERE pi.patient_id=patients.patient_id AND pi.deleted_at IS NULL AND pi.identifier_value LIKE CONCAT('%',?,'%')))
      ORDER BY created_at DESC LIMIT 50`,
      [q, q, q, q, q, q],
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// Load a complete longitudinal profile using parallel, independent SELECTs.
router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [
      [patients],
      [guardians],
      [visits],
      [allergies],
      [immunizations],
      [identifiers],
      [coverages],
      [followUps],
      [prescriptionRows],
      [labs],
    ] = await Promise.all([
      pool.execute(
        "SELECT * FROM patients WHERE patient_id=? AND deleted_at IS NULL",
        [id],
      ),
      pool.execute(
        `SELECT g.*,pg.relationship,pg.is_primary FROM patient_guardians pg JOIN guardians g USING(guardian_id) WHERE pg.patient_id=?`,
        [id],
      ),
      pool.execute(
        "SELECT * FROM v_patient_visit_summary WHERE patient_id=? ORDER BY visit_started_at DESC",
        [id],
      ),
      pool.execute(
        "SELECT * FROM allergies WHERE patient_id=? AND deleted_at IS NULL ORDER BY FIELD(status,'active','unconfirmed','resolved'),allergen",
        [id],
      ),
      pool.execute(
        "SELECT * FROM immunizations WHERE patient_id=? AND deleted_at IS NULL ORDER BY administered_on DESC",
        [id],
      ),
      pool.execute(
        "SELECT * FROM patient_identifiers WHERE patient_id=? AND deleted_at IS NULL ORDER BY is_primary DESC,created_at",
        [id],
      ),
      pool.execute(
        "SELECT * FROM insurance_coverages WHERE patient_id=? AND status='active' AND deleted_at IS NULL ORDER BY is_primary DESC",
        [id],
      ),
      pool.execute(
        `SELECT f.*,u.full_name assigned_to FROM follow_ups f JOIN visits v USING(visit_id) LEFT JOIN users u ON u.user_id=f.assigned_user_id WHERE v.patient_id=? AND f.deleted_at IS NULL AND v.deleted_at IS NULL ORDER BY f.due_date DESC`,
        [id],
      ),
      pool.execute(
        `SELECT pr.prescription_id,pr.visit_id,pr.doctor_id,pr.prescribed_at,pr.notes,u.full_name doctor_name,pi.prescription_item_id,pi.medication_id,pi.dose,pi.frequency,pi.route,pi.duration_days,pi.instructions,m.generic_name,m.brand_name,m.form,m.strength FROM prescriptions pr JOIN doctors d USING(doctor_id) JOIN users u USING(user_id) JOIN prescription_items pi USING(prescription_id) JOIN medications m USING(medication_id) WHERE pr.patient_id=? AND pr.deleted_at IS NULL AND pi.deleted_at IS NULL ORDER BY pr.prescribed_at DESC,pi.prescription_item_id`,
        [id],
      ),
      pool.execute(
        `SELECT lo.*,lt.test_code,lt.test_name,lt.unit,lt.reference_range,lr.result_value,lr.is_abnormal,lr.notes result_notes,lr.resulted_at,u.full_name ordered_by_name FROM lab_orders lo JOIN visits v USING(visit_id) JOIN lab_tests lt USING(lab_test_id) JOIN doctors d ON d.doctor_id=lo.ordered_by JOIN users u USING(user_id) LEFT JOIN lab_results lr ON lr.lab_order_id=lo.lab_order_id AND lr.deleted_at IS NULL WHERE v.patient_id=? AND lo.deleted_at IS NULL AND v.deleted_at IS NULL ORDER BY lo.ordered_at DESC`,
        [id],
      ),
    ]);
    if (!patients[0])
      return res.status(404).json({ error: "Patient not found" });
    const prescriptions = [
      ...new Set(prescriptionRows.map((r) => r.prescription_id)),
    ].map((pid) => {
      const rows = prescriptionRows.filter((r) => r.prescription_id === pid),
        r = rows[0];
      return {
        prescription_id: pid,
        visit_id: r.visit_id,
        doctor_id: r.doctor_id,
        prescribed_at: r.prescribed_at,
        notes: r.notes,
        doctor_name: r.doctor_name,
        items: rows.map((x) => ({
          prescription_item_id: x.prescription_item_id,
          medication_id: x.medication_id,
          dose: x.dose,
          frequency: x.frequency,
          route: x.route,
          duration_days: x.duration_days,
          instructions: x.instructions,
          generic_name: x.generic_name,
          brand_name: x.brand_name,
          form: x.form,
          strength: x.strength,
        })),
      };
    });
    res.json({
      patient: patients[0],
      guardians,
      visits,
      allergies,
      immunizations,
      identifiers,
      coverages,
      followUps,
      prescriptions,
      labs,
    });
  } catch (error) {
    next(error);
  }
});

// Register the patient, primary guardian, MRN, optional identifier, and audit row atomically.
router.post("/", async (req, res, next) => {
  try {
    const data = patientSchema.parse(req.body);
    const result = await transaction(async (db) => {
      const [patient] = await db.execute(
        `INSERT INTO patients(medical_record_number,first_name,middle_name,last_name,preferred_name,date_of_birth,sex_at_birth,blood_group,phone,alternate_phone,email,address_line,address_line_2,city,state_province,postal_code,country,nationality,preferred_language,communication_preference,registration_source,consent_to_treatment,consent_to_contact,consent_recorded_at)
        VALUES(CONCAT('TMP-',LEFT(REPLACE(UUID(),'-',''),26)),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CASE WHEN ? OR ? THEN CURRENT_TIMESTAMP END)`,
        [
          data.firstName,
          data.middleName || null,
          data.lastName,
          data.preferredName || null,
          data.dateOfBirth,
          data.sexAtBirth,
          data.bloodGroup,
          data.phone || null,
          data.alternatePhone || null,
          data.email || null,
          data.addressLine || null,
          data.addressLine2 || null,
          data.city || null,
          data.stateProvince || null,
          data.postalCode || null,
          data.country,
          data.nationality || null,
          data.preferredLanguage,
          data.communicationPreference,
          data.registrationSource,
          data.consentToTreatment,
          data.consentToContact,
          data.consentToTreatment,
          data.consentToContact,
        ],
      );
      const mrn = `PED-${new Date().getUTCFullYear()}-${String(patient.insertId).padStart(4, "0")}`;
      await db.execute(
        "UPDATE patients SET medical_record_number=? WHERE patient_id=?",
        [mrn, patient.insertId],
      );
      const [guardian] = await db.execute(
        "INSERT INTO guardians(full_name,phone,email) VALUES(?,?,?)",
        [data.guardianName, data.guardianPhone, data.guardianEmail || null],
      );
      await db.execute(
        "INSERT INTO patient_guardians(patient_id,guardian_id,relationship,is_primary) VALUES(?,?,?,TRUE)",
        [patient.insertId, guardian.insertId, data.relationship],
      );
      await db.execute(
        `INSERT INTO patient_identifiers(patient_id,identifier_type,identifier_value,is_primary) VALUES(?,'hospital_mrn',?,TRUE)`,
        [patient.insertId, mrn],
      );
      if (data.identifierType && data.identifierValue)
        await db.execute(
          "INSERT INTO patient_identifiers(patient_id,identifier_type,identifier_value) VALUES(?,?,?)",
          [patient.insertId, data.identifierType, data.identifierValue],
        );
      await db.execute(
        `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,after_data) VALUES(1,'CREATE','patient',?,JSON_OBJECT('mrn',?))`,
        [patient.insertId, mrn],
      );
      return { patientId: patient.insertId, medicalRecordNumber: mrn };
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// Update only explicitly supplied and whitelisted demographic fields.
router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id),
      data = patientUpdateSchema.parse(req.body);
    const map = {
      firstName: "first_name",
      middleName: "middle_name",
      lastName: "last_name",
      preferredName: "preferred_name",
      dateOfBirth: "date_of_birth",
      sexAtBirth: "sex_at_birth",
      bloodGroup: "blood_group",
      phone: "phone",
      alternatePhone: "alternate_phone",
      email: "email",
      addressLine: "address_line",
      addressLine2: "address_line_2",
      city: "city",
      stateProvince: "state_province",
      postalCode: "postal_code",
      country: "country",
      nationality: "nationality",
      preferredLanguage: "preferred_language",
      communicationPreference: "communication_preference",
      registrationSource: "registration_source",
      consentToTreatment: "consent_to_treatment",
      consentToContact: "consent_to_contact",
    };
    const entries = Object.entries(data).filter(([k]) => map[k]);
    if (!entries.length)
      return res.status(400).json({ error: "No editable fields supplied" });
    await transaction(async (db) => {
      const [[before]] = await db.execute(
        "SELECT * FROM patients WHERE patient_id=? AND deleted_at IS NULL",
        [id],
      );
      if (!before) {
        const e = new Error("Patient not found");
        e.status = 404;
        throw e;
      }
      const set = entries.map(([k]) => `${map[k]}=?`).join(",");
      await db.execute(
        `UPDATE patients SET ${set},consent_recorded_at=CASE WHEN consent_recorded_at IS NULL AND (consent_to_treatment OR consent_to_contact) THEN CURRENT_TIMESTAMP ELSE consent_recorded_at END WHERE patient_id=?`,
        [...entries.map(([, v]) => (v === "" ? null : v)), id],
      );
      await db.execute(
        `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data) VALUES(1,'UPDATE','patient',?,JSON_OBJECT('first_name',?,'last_name',?,'phone',?),JSON_OBJECT('fields_changed',?))`,
        [
          id,
          before.first_name,
          before.last_name,
          before.phone,
          entries.map(([k]) => k).join(","),
        ],
      );
    });
    res.json({ patientId: id });
  } catch (error) {
    next(error);
  }
});

// Preserve the patient row while removing it from normal active-record queries.
router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = z
      .object({ reason: z.string().min(3).max(500) })
      .parse(req.body);
    const [result] = await pool.execute(
      `UPDATE patients SET is_active=FALSE,deleted_at=CURRENT_TIMESTAMP,
      deleted_by=1,deletion_reason=? WHERE patient_id=? AND deleted_at IS NULL`,
      [data.reason, id],
    );
    if (!result.affectedRows)
      return res.status(404).json({ error: "Patient not found" });
    await pool.execute(
      `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,after_data)
      VALUES(1,'SOFT_DELETE','patient',?,JSON_OBJECT('reason',?))`,
      [id, data.reason],
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
