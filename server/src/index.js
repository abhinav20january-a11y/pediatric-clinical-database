/** Express API composition root: middleware, routes, health check, and errors. */
import "dotenv/config";
import cors from "cors";
import express from "express";
import { pool } from "./db.js";
import patientsRouter from "./routes/patients.js";
import followupsRouter from "./routes/followups.js";
import clinicalRouter from "./routes/clinical.js";
import dynamicFieldsRouter from "./routes/dynamic-fields.js";

const app = express();

// API middleware is configured once so every feature route behaves consistently.
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

// Lightweight readiness endpoint used to confirm that MySQL is reachable.
app.get("/api/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    next(error);
  }
});

// Fetch independent dashboard summaries concurrently to reduce response time.
app.get("/api/dashboard", async (_req, res, next) => {
  try {
    const [[counts], [upcoming], [recent]] = await Promise.all([
      pool.query(`SELECT
        (SELECT COUNT(*) FROM patients WHERE is_active AND deleted_at IS NULL) patients,
        (SELECT COUNT(*) FROM appointments WHERE DATE(scheduled_at)=CURRENT_DATE) appointments_today,
        (SELECT COUNT(*) FROM visits WHERE deleted_at IS NULL) visits,
        (SELECT COUNT(*) FROM follow_ups WHERE deleted_at IS NULL AND status IN ('pending','scheduled','overdue')) open_followups`),
      pool.query(`SELECT a.appointment_id,a.scheduled_at,a.status,a.reason,
        CONCAT(p.first_name,' ',p.last_name) patient_name,u.full_name doctor_name
        FROM appointments a JOIN patients p USING(patient_id) JOIN doctors d USING(doctor_id) JOIN users u USING(user_id)
        WHERE a.scheduled_at >= CURRENT_DATE ORDER BY a.scheduled_at LIMIT 6`),
      pool.query(
        `SELECT * FROM v_patient_visit_summary ORDER BY visit_started_at DESC LIMIT 5`,
      ),
    ]);
    res.json({ counts: counts[0], upcoming, recent });
  } catch (error) {
    next(error);
  }
});

// Each domain owns its routes; this file only assigns their common URL prefixes.
app.use("/api/patients", patientsRouter);
app.use("/api/followups", followupsRouter);
app.use("/api/clinical", clinicalRouter);
app.use("/api/dynamic-fields", dynamicFieldsRouter);

// Convert validation and application errors into one predictable JSON shape.
app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error.status || (error.name === "ZodError" ? 400 : 500);
  res.status(status).json({
    error: status === 500 ? "Unexpected server error" : error.message,
    details: error.issues || undefined,
  });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Pediatric API listening on ${port}`));
