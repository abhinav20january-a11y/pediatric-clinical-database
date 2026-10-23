/**
 * Optional benchmark-data generator. Records are inserted in transactions and
 * bounded batches so large evaluation datasets do not exhaust memory.
 */
import "dotenv/config";
import { pool, transaction } from "./db.js";

const target = Math.min(
  Math.max(Number(process.env.SCALE_PATIENTS || 10000), 1),
  100000,
);
const batchSize = 500;
for (let start = 0; start < target; start += batchSize) {
  const size = Math.min(batchSize, target - start);
  await transaction(async (db) => {
    for (let i = 0; i < size; i++) {
      const n = start + i + 1,
        mrn = `SCALE-${String(n).padStart(6, "0")}`;
      const [p] = await db.execute(
        `INSERT IGNORE INTO patients(medical_record_number,first_name,last_name,date_of_birth,sex_at_birth,blood_group,city)
        VALUES(?,?,?,DATE_SUB('2026-01-01',INTERVAL ? DAY),?,?,?)`,
        [
          mrn,
          `Child${n}`,
          `Synthetic${n % 1000}`,
          n % 6200,
          n % 2 ? "female" : "male",
          "unknown",
          "Synthetic City",
        ],
      );
      if (!p.insertId) continue;
      const [a] = await db.execute(
        `INSERT INTO appointments(patient_id,doctor_id,scheduled_at,status,reason,created_by)
        VALUES(?,1,DATE_ADD('2024-01-01',INTERVAL ? HOUR),'completed','Synthetic benchmark visit',1)`,
        [p.insertId, n],
      );
      const [v] = await db.execute(
        `INSERT INTO visits(appointment_id,patient_id,doctor_id,visit_started_at,visit_ended_at,chief_complaint)
        VALUES(?,?,1,DATE_ADD('2024-01-01',INTERVAL ? HOUR),DATE_ADD('2024-01-01',INTERVAL ? MINUTE),'Synthetic record')`,
        [a.insertId, p.insertId, n, n * 60 + 20],
      );
      await db.execute(
        `INSERT INTO medical_records(visit_id,history,examination,clinical_notes,recorded_by) VALUES(?,?,?, ?,2)`,
        [
          v.insertId,
          "Synthetic history",
          "Synthetic examination",
          "Synthetic note",
        ],
      );
    }
  });
  console.log(`Generated ${Math.min(start + size, target)} / ${target}`);
}
await pool.end();
