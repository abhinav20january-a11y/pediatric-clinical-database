/**
 * Patient workspace containing registration, longitudinal clinical history,
 * encounters, prescriptions, laboratory work, allergies, and immunizations.
 */
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  Edit3,
  Search,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";
import { api } from "../api.js";
import DynamicFieldsManager, {
  saveDynamicFieldValues,
} from "../components/DynamicFieldsManager.jsx";

/* ─── Blank patient template ─────────────────────────────── */
const blank = {
  firstName: "",
  middleName: "",
  lastName: "",
  preferredName: "",
  dateOfBirth: "",
  sexAtBirth: "unknown",
  bloodGroup: "unknown",
  phone: "",
  alternatePhone: "",
  email: "",
  addressLine: "",
  addressLine2: "",
  city: "",
  stateProvince: "",
  postalCode: "",
  country: "India",
  nationality: "Indian",
  preferredLanguage: "English",
  communicationPreference: "guardian",
  registrationSource: "walk_in",
  consentToTreatment: false,
  consentToContact: false,
  guardianName: "",
  guardianPhone: "",
  guardianEmail: "",
  relationship: "",
  identifierType: "national_health_id",
  identifierValue: "",
};

// Translate snake_case API fields into the camelCase names used by form state.
const fromPatient = (p) => ({
  patientId: p.patient_id,
  firstName: p.first_name || "",
  middleName: p.middle_name || "",
  lastName: p.last_name || "",
  preferredName: p.preferred_name || "",
  dateOfBirth: String(p.date_of_birth || "").slice(0, 10),
  sexAtBirth: p.sex_at_birth || "unknown",
  bloodGroup: p.blood_group || "unknown",
  phone: p.phone || "",
  alternatePhone: p.alternate_phone || "",
  email: p.email || "",
  addressLine: p.address_line || "",
  addressLine2: p.address_line_2 || "",
  city: p.city || "",
  stateProvince: p.state_province || "",
  postalCode: p.postal_code || "",
  country: p.country || "India",
  nationality: p.nationality || "",
  preferredLanguage: p.preferred_language || "English",
  communicationPreference: p.communication_preference || "guardian",
  registrationSource: p.registration_source || "walk_in",
  consentToTreatment: !!p.consent_to_treatment,
  consentToContact: !!p.consent_to_contact,
});

/* ─── Age calculator ─────────────────────────────────────── */
/** Calculate an age label without treating the date as local midnight. */
function calcAge(dob) {
  if (!dob) return "—";
  const birth = new Date(dob),
    now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) years--;
  if (years < 2) {
    const totalMonths = years * 12 + (months < 0 ? months + 12 : months);
    return `${totalMonths} months`;
  }
  return `${years} yrs`;
}

/* ══════════════════════════════════════════════════════════
   Main Patients Page
═══════════════════════════════════════════════════════════ */
/** Searchable patient registry and entry point for registration/profile actions. */
export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("");
  const [error, setError] = useState("");

  const load = (term = "") =>
    api(`/patients?q=${encodeURIComponent(term)}`)
      .then(setPatients)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const detail = (id) =>
    api(`/patients/${id}`)
      .then(setSelected)
      .catch((e) => setError(e.message));

  return (
    <>
      <section className="toolbar">
        <div>
          <span className="eyebrow">Master patient index</span>
          <h2>Patient Records</h2>
          <p>Search by name, MRN, or phone number.</p>
        </div>
        <button className="button" onClick={() => setMode("new")}>
          <UserPlus size={17} /> Register Patient
        </button>
      </section>

      <section className="panel">
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div className="search">
            <Search size={18} color="var(--muted)" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                load(e.target.value);
              }}
              placeholder="Search patients by name, MRN, or phone..."
            />
          </div>
          {error && (
            <div className="notice error">
              <X size={16} />
              {error}
            </div>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>MRN</th>
                <th>Patient</th>
                <th>Date of Birth</th>
                <th>Age</th>
                <th>Sex</th>
                <th>Blood Group</th>
                <th>Contact</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr
                  key={p.patient_id}
                  onClick={() => detail(p.patient_id)}
                  tabIndex={0}
                  aria-label={`Open record for ${p.first_name} ${p.last_name}`}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      detail(p.patient_id);
                    }
                  }}
                >
                  <td>
                    <code>{p.medical_record_number}</code>
                  </td>
                  <td>
                    <strong>
                      {p.first_name} {p.last_name}
                    </strong>
                    <small>
                      {p.preferred_name
                        ? `Preferred: ${p.preferred_name}`
                        : "Registered patient"}
                    </small>
                  </td>
                  <td>
                    {new Date(p.date_of_birth).toLocaleDateString("en-IN")}
                  </td>
                  <td>{calcAge(p.date_of_birth)}</td>
                  <td className="capitalize">{p.sex_at_birth}</td>
                  <td>
                    <span className="pill">{p.blood_group}</span>
                  </td>
                  <td>
                    {p.phone || (
                      <span style={{ color: "var(--muted)" }}>
                        Not recorded
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!patients.length && <p className="empty">No patients found.</p>}
        </div>
      </section>

      {selected && (
        <PatientDrawer
          data={selected}
          onClose={() => setSelected(null)}
          onEdit={() => setMode("edit")}
          onRefresh={() => detail(selected.patient.patient_id)}
        />
      )}
      {mode && (
        <PatientForm
          mode={mode}
          initial={mode === "edit" ? fromPatient(selected.patient) : blank}
          onClose={() => setMode("")}
          onSaved={async (result) => {
            setMode("");
            await load(q);
            await detail(result.patientId);
          }}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   Patient Detail Drawer
═══════════════════════════════════════════════════════════ */
/** Longitudinal patient record with actions for each supported clinical area. */
function PatientDrawer({ data, onClose, onEdit, onRefresh }) {
  const [tab, setTab] = useState("overview");
  const [action, setAction] = useState(null);
  const [meta, setMeta] = useState(null);

  const p = data.patient;
  const allergies = data.allergies || [];
  const immunizations = data.immunizations || [];
  const followUps = data.followUps || [];
  const visits = data.visits || [];
  const prescriptions = data.prescriptions || [];
  const labs = data.labs || [];
  const activeAllergies = allergies.filter((a) => a.status === "active");

  const lastVisit = visits[0];
  const firstVisit = visits[visits.length - 1];

  const open = async (next) => {
    setMeta(await api("/clinical/meta"));
    setAction(next);
  };
  const changed = async () => {
    setAction(null);
    await onRefresh();
  };

  const tabs = [
    ["overview", "Overview"],
    ["diagnosis", "Diagnosis & History"],
    ["examination", "Examination"],
    ["investigations", "Investigations"],
    ["followups", "Follow-ups"],
    ["demographics", "Demographics"],
    ["care", "Safety & Care"],
  ];

  return (
    <div className="overlay">
      <div className="drawer wide-drawer">
        <button className="close" onClick={onClose}>
          <X />
        </button>

        {/* ── Header ── */}
        <div className="record-heading">
          <div>
            <span className="eyebrow">
              {p.medical_record_number} · Pediatric Department
            </span>
            <h2>
              {p.first_name} {p.middle_name || ""} {p.last_name}
            </h2>
            <p>
              {p.preferred_name ? `Preferred: ${p.preferred_name} · ` : ""}
              {new Date(p.date_of_birth).toLocaleDateString("en-IN")} ·{" "}
              <span className="capitalize">{p.sex_at_birth}</span> ·{" "}
              {calcAge(p.date_of_birth)}
            </p>
          </div>
          <button className="secondary-button" onClick={onEdit}>
            <Edit3 size={15} /> Edit Demographics
          </button>
        </div>

        {/* ── Patient summary ── */}
        <div className="patient-cards">
          <div className="pcard dark">
            <span className="pcard-label">Date of birth</span>
            <span className="pcard-value">
              {new Date(p.date_of_birth).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
            <span className="pcard-sub">
              {p.sex_at_birth} · {calcAge(p.date_of_birth)}
            </span>
          </div>
          <div className="pcard teal">
            <span className="pcard-label">Blood group</span>
            <span className="pcard-value">{p.blood_group || "—"}</span>
            <span className="pcard-sub">
              {activeAllergies.length} active allerg
              {activeAllergies.length !== 1 ? "ies" : "y"}
            </span>
          </div>
          <div className="pcard tan">
            <span className="pcard-label">Guardian</span>
            <span className="pcard-value" style={{ fontSize: "1rem" }}>
              {data.guardians[0]?.full_name || "—"}
            </span>
            <span className="pcard-sub">
              {data.guardians[0]?.relationship || "Contact"}
            </span>
          </div>
          <div className="pcard blue-card">
            <span className="pcard-label">Last visit</span>
            <span className="pcard-value" style={{ fontSize: "1rem" }}>
              {lastVisit
                ? new Date(lastVisit.visit_started_at).toLocaleDateString(
                    "en-IN",
                    { day: "2-digit", month: "short", year: "numeric" },
                  )
                : "—"}
            </span>
            <span className="pcard-sub">
              {visits.length} total visit{visits.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="tabs">
          {tabs.map(([k, l]) => (
            <button
              key={k}
              className={tab === k ? "active" : ""}
              onClick={() => setTab(k)}
            >
              {l}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {tab === "overview" && (
          <>
            <div className="detail-grid">
              <Info label="Phone" value={p.phone} />
              <Info label="Language" value={p.preferred_language} />
              <Info label="Blood Group" value={p.blood_group} />
              <Info label="Guardian" value={data.guardians[0]?.full_name} />
              <Info label="Active Allergies" value={activeAllergies.length} />
              <Info
                label="Open Follow-ups"
                value={
                  followUps.filter(
                    (f) => !["completed", "cancelled"].includes(f.status),
                  ).length
                }
              />
            </div>

            <Section title="Personal Details" icon={ShieldCheck}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 24,
                }}
              >
                <div>
                  <p
                    style={{
                      fontWeight: 700,
                      fontSize: 12,
                      color: "var(--blue)",
                      textTransform: "uppercase",
                      letterSpacing: ".08em",
                      marginBottom: 10,
                    }}
                  >
                    Patient
                  </p>
                  <InfoRow
                    label="Name"
                    value={`${p.first_name} ${p.last_name}`}
                  />
                  <InfoRow label="Age" value={calcAge(p.date_of_birth)} />
                  <InfoRow label="Gender" value={p.sex_at_birth} />
                  <InfoRow
                    label="Address"
                    value={[p.address_line, p.city, p.state_province]
                      .filter(Boolean)
                      .join(", ")}
                  />
                  <InfoRow label="Phone" value={p.phone} />
                  <InfoRow label="WhatsApp" value={p.alternate_phone} />
                  <InfoRow label="Physician" value={lastVisit?.doctor_name} />
                  <InfoRow label="MRN" value={p.medical_record_number} />
                  <InfoRow
                    label="Registered on"
                    value={new Date(
                      p.created_at || Date.now(),
                    ).toLocaleDateString("en-IN")}
                  />
                </div>
                {data.guardians.slice(0, 2).map((g, idx) => (
                  <div key={g.guardian_id}>
                    <p
                      style={{
                        fontWeight: 700,
                        fontSize: 12,
                        color: "var(--teal)",
                        textTransform: "uppercase",
                        letterSpacing: ".08em",
                        marginBottom: 10,
                      }}
                    >
                      {g.relationship || (idx === 0 ? "Father" : "Mother")}
                    </p>
                    <InfoRow label="Name" value={g.full_name} />
                    <InfoRow label="Age" value="—" />
                    <InfoRow label="Education" value="—" />
                    <InfoRow label="Occupation" value="—" />
                    <InfoRow label="Phone" value={g.phone} />
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Clinical Alerts" icon={AlertTriangle}>
              {activeAllergies.length ? (
                activeAllergies.map((a) => (
                  <div className="clinical-item" key={a.allergy_id}>
                    <strong>{a.allergen}</strong>
                    <span className={`pill ${a.severity}`}>{a.severity}</span>
                    <small>{a.reaction || "Reaction not recorded"}</small>
                  </div>
                ))
              ) : (
                <Empty text="No active allergy recorded" />
              )}
            </Section>

            <Section title="Recent Encounters" icon={ClipboardList}>
              {visits.slice(0, 4).map((v) => (
                <Timeline item={v} key={v.visit_id} />
              ))}
              {!visits.length && <Empty text="No encounters recorded" />}
            </Section>
          </>
        )}

        {/* ── Diagnosis & History Tab ── */}
        {tab === "diagnosis" && (
          <Section
            title="Longitudinal Clinical History"
            icon={ClipboardList}
            action={
              <button
                className="secondary-button"
                onClick={() => open({ type: "encounter" })}
              >
                <UserPlus size={15} /> Add Encounter
              </button>
            }
          >
            {visits.length ? (
              visits.map((v) => (
                <div className="editable-row" key={v.visit_id}>
                  <Timeline item={v} />
                  <button
                    onClick={() => open({ type: "encounter", id: v.visit_id })}
                  >
                    <Edit3 size={15} /> Edit
                  </button>
                </div>
              ))
            ) : (
              <Empty text="No clinical history recorded" />
            )}
          </Section>
        )}

        {/* ── Examination Tab ── */}
        {tab === "examination" && (
          <Section
            title="Prescriptions & Medications"
            icon={ClipboardList}
            action={
              <button
                className="secondary-button"
                onClick={() => open({ type: "prescription" })}
              >
                <UserPlus size={15} /> New Prescription
              </button>
            }
          >
            {prescriptions.length ? (
              prescriptions.map((rx) => (
                <div className="prescription-card" key={rx.prescription_id}>
                  <div>
                    <strong>
                      {new Date(rx.prescribed_at).toLocaleDateString("en-IN")}
                    </strong>
                    <small>
                      {rx.doctor_name} · Encounter #{rx.visit_id}
                    </small>
                  </div>
                  <button
                    onClick={() => open({ type: "prescription", item: rx })}
                  >
                    <Edit3 size={15} /> Edit
                  </button>
                  {rx.items.map((item) => (
                    <div
                      className="medication-line"
                      key={item.prescription_item_id}
                    >
                      <strong>
                        {item.generic_name} {item.strength}
                      </strong>
                      <span>
                        {item.dose} · {item.frequency} · {item.route}
                      </span>
                      <small>
                        {item.duration_days
                          ? `${item.duration_days} days · `
                          : ""}
                        {item.instructions || "No additional instructions"}
                      </small>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <Empty text="No prescriptions recorded" />
            )}
          </Section>
        )}

        {/* ── Investigations Tab ── */}
        {tab === "investigations" && (
          <Section
            title="Laboratory Orders & Results"
            icon={ClipboardList}
            action={
              <button
                className="secondary-button"
                onClick={() => open({ type: "lab" })}
              >
                <UserPlus size={15} /> New Lab Order
              </button>
            }
          >
            {labs.length ? (
              labs.map((l) => (
                <div className="lab-row" key={l.lab_order_id}>
                  <div>
                    <strong>{l.test_name}</strong>
                    <small>
                      {l.test_code} · Ordered{" "}
                      {new Date(l.ordered_at).toLocaleDateString("en-IN")} by{" "}
                      {l.ordered_by_name}
                    </small>
                  </div>
                  <div>
                    <span
                      className={`pill ${l.is_abnormal ? "severe" : l.status}`}
                    >
                      {l.result_value
                        ? `${l.result_value} ${l.unit || ""}`
                        : l.status}
                    </span>
                    <small>
                      {l.reference_range ? `Ref: ${l.reference_range}` : ""}
                    </small>
                  </div>
                  <button
                    className="row-edit"
                    onClick={() => open({ type: "lab", item: l })}
                  >
                    <Edit3 size={15} /> Edit
                  </button>
                </div>
              ))
            ) : (
              <Empty text="No laboratory orders recorded" />
            )}
          </Section>
        )}

        {/* ── Follow-ups Tab ── */}
        {tab === "followups" && (
          <Section title="Care Follow-up Plan" icon={ClipboardList}>
            {followUps.length ? (
              followUps.map((f) => (
                <div className="clinical-item" key={f.follow_up_id}>
                  <strong>{f.reason}</strong>
                  <span className={`pill ${f.priority}`}>
                    {f.priority.replace("_", " ")}
                  </span>
                  <small>
                    Due {new Date(f.due_date).toLocaleDateString("en-IN")} ·{" "}
                    {f.assigned_to || "Unassigned"} · {f.status}
                  </small>
                </div>
              ))
            ) : (
              <Empty text="No follow-ups recorded" />
            )}
          </Section>
        )}

        {/* ── Demographics Tab ── */}
        {tab === "demographics" && (
          <>
            <Section title="Identity & Communication" icon={ShieldCheck}>
              <dl className="record-list">
                <dt>Full legal name</dt>
                <dd>
                  {p.first_name} {p.middle_name} {p.last_name}
                </dd>
                <dt>Email</dt>
                <dd>{p.email || "Not recorded"}</dd>
                <dt>Phones</dt>
                <dd>
                  {[p.phone, p.alternate_phone].filter(Boolean).join(" / ") ||
                    "Not recorded"}
                </dd>
                <dt>Language</dt>
                <dd>{p.preferred_language}</dd>
                <dt>Communication preference</dt>
                <dd className="capitalize">{p.communication_preference}</dd>
                <dt>Nationality</dt>
                <dd>{p.nationality || "Not recorded"}</dd>
                <dt>Address</dt>
                <dd>
                  {[
                    p.address_line,
                    p.address_line_2,
                    p.city,
                    p.state_province,
                    p.postal_code,
                    p.country,
                  ]
                    .filter(Boolean)
                    .join(", ") || "Not recorded"}
                </dd>
              </dl>
            </Section>
            <Section title="Identifiers" icon={ShieldCheck}>
              {data.identifiers.map((i) => (
                <div className="clinical-item" key={i.patient_identifier_id}>
                  <strong className="capitalize">
                    {i.identifier_type.replaceAll("_", " ")}
                  </strong>
                  <code>{i.identifier_value}</code>
                </div>
              ))}
            </Section>
            <Section title="Guardian & Emergency Contacts" icon={ShieldCheck}>
              {data.guardians.map((g) => (
                <div className="clinical-item" key={g.guardian_id}>
                  <strong>{g.full_name}</strong>
                  <span>{g.relationship}</span>
                  <small>
                    {g.phone}
                    {g.email ? ` · ${g.email}` : ""}
                  </small>
                </div>
              ))}
            </Section>

            {/* Dynamic custom fields per patient */}
            <CustomFieldsPanel patientId={p.patient_id} />
          </>
        )}

        {/* ── Safety & Care Tab ── */}
        {tab === "care" && (
          <>
            <Section
              title="Allergies"
              icon={AlertTriangle}
              action={
                <button
                  className="secondary-button"
                  onClick={() => open({ type: "allergy" })}
                >
                  Add Allergy
                </button>
              }
            >
              {allergies.length ? (
                allergies.map((a) => (
                  <div className="clinical-item" key={a.allergy_id}>
                    <strong>{a.allergen}</strong>
                    <span>{a.reaction}</span>
                    <small>
                      Severity: {a.severity} · {a.status}
                    </small>
                    <button
                      className="row-edit"
                      onClick={() => open({ type: "allergy", item: a })}
                    >
                      <Edit3 size={15} /> Edit
                    </button>
                  </div>
                ))
              ) : (
                <Empty text="No active allergies recorded" />
              )}
            </Section>
            <Section
              title="Immunizations"
              icon={ShieldCheck}
              action={
                <button
                  className="secondary-button"
                  onClick={() => open({ type: "immunization" })}
                >
                  Add Immunization
                </button>
              }
            >
              {immunizations.length ? (
                immunizations.map((i) => (
                  <div className="clinical-item" key={i.immunization_id}>
                    <strong>{i.vaccine_name}</strong>
                    <span>Dose {i.dose_number || "—"}</span>
                    <small>
                      {new Date(i.administered_on).toLocaleDateString("en-IN")}{" "}
                      · Lot {i.lot_number || "not recorded"}
                    </small>
                    <button
                      className="row-edit"
                      onClick={() => open({ type: "immunization", item: i })}
                    >
                      <Edit3 size={15} /> Edit
                    </button>
                  </div>
                ))
              ) : (
                <Empty text="No immunizations recorded" />
              )}
            </Section>
          </>
        )}
      </div>

      {/* ── Clinical action modals ── */}
      {action?.type === "encounter" && (
        <EncounterModal
          patient={p}
          visitId={action.id}
          meta={meta}
          onClose={() => setAction(null)}
          onSaved={changed}
        />
      )}
      {action?.type === "prescription" && (
        <PrescriptionModal
          patient={p}
          visits={visits}
          item={action.item}
          meta={meta}
          onClose={() => setAction(null)}
          onSaved={changed}
        />
      )}
      {action?.type === "lab" && (
        <LabModal
          visits={visits}
          item={action.item}
          meta={meta}
          onClose={() => setAction(null)}
          onSaved={changed}
        />
      )}
      {action?.type === "allergy" && (
        <AllergyModal
          patient={p}
          item={action.item}
          onClose={() => setAction(null)}
          onSaved={changed}
        />
      )}
      {action?.type === "immunization" && (
        <ImmunizationModal
          patient={p}
          item={action.item}
          meta={meta}
          onClose={() => setAction(null)}
          onSaved={changed}
        />
      )}
    </div>
  );
}

/** Patient-level custom information that remains visible across all visits. */
function CustomFieldsPanel({ patientId }) {
  return (
    <DynamicFieldsManager
      context="patient"
      recordId={patientId}
      title="Additional patient details"
      description="Information available across this patient’s visits."
    />
  );
}

/* ══════════════════════════════════════════════════════════
   Patient Registration / Edit Form
═══════════════════════════════════════════════════════════ */
/** Shared create/edit patient form; registration additionally captures a guardian. */
function PatientForm({ mode, initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [customValues, setCustomValues] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        ...form,
        consentToTreatment: !!form.consentToTreatment,
        consentToContact: !!form.consentToContact,
      };
      delete body.patientId;
      const result = await api(
        mode === "edit" ? `/patients/${initial.patientId}` : "/patients",
        {
          method: mode === "edit" ? "PUT" : "POST",
          body: JSON.stringify(body),
        },
      );
      await saveDynamicFieldValues("patient", result.patientId, customValues);
      onSaved(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay center">
      <form className="modal large-modal" onSubmit={submit}>
        <button type="button" className="close" onClick={onClose}>
          <X />
        </button>
        <span className="eyebrow">
          {mode === "edit" ? "Patient Administration" : "Master Patient Index"}
        </span>
        <h2>
          {mode === "edit" ? "Edit Patient Record" : "Register a New Patient"}
        </h2>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
          Fields marked * are required. Record consent only after the guardian
          has agreed.
        </p>
        {error && (
          <div className="notice error">
            <X size={16} />
            {error}
          </div>
        )}

        <FormSection title="Patient Identity">
          <div className="form-grid three">
            <Field label="First name *">
              <input
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                required
              />
            </Field>
            <Field label="Middle name">
              <input
                value={form.middleName}
                onChange={(e) => set("middleName", e.target.value)}
              />
            </Field>
            <Field label="Last name *">
              <input
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                required
              />
            </Field>
            <Field label="Preferred name">
              <input
                value={form.preferredName}
                onChange={(e) => set("preferredName", e.target.value)}
              />
            </Field>
            <Field label="Date of birth *">
              <input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.dateOfBirth}
                onChange={(e) => set("dateOfBirth", e.target.value)}
                required
              />
            </Field>
            <Field label="Sex at birth *">
              <Select
                value={form.sexAtBirth}
                onChange={(v) => set("sexAtBirth", v)}
                items={["female", "male", "intersex", "unknown"]}
              />
            </Field>
            <Field label="Blood group">
              <Select
                value={form.bloodGroup}
                onChange={(v) => set("bloodGroup", v)}
                items={[
                  "unknown",
                  "A+",
                  "A-",
                  "B+",
                  "B-",
                  "AB+",
                  "AB-",
                  "O+",
                  "O-",
                ]}
              />
            </Field>
            <Field label="Nationality">
              <input
                value={form.nationality}
                onChange={(e) => set("nationality", e.target.value)}
              />
            </Field>
            <Field label="Preferred language">
              <input
                value={form.preferredLanguage}
                onChange={(e) => set("preferredLanguage", e.target.value)}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Contact & Address">
          <div className="form-grid three">
            <Field label="Primary phone">
              <input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
            <Field label="Alternate phone">
              <input
                value={form.alternatePhone}
                onChange={(e) => set("alternatePhone", e.target.value)}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Address line 1" wide>
              <input
                value={form.addressLine}
                onChange={(e) => set("addressLine", e.target.value)}
              />
            </Field>
            <Field label="Address line 2">
              <input
                value={form.addressLine2}
                onChange={(e) => set("addressLine2", e.target.value)}
              />
            </Field>
            <Field label="City">
              <input
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </Field>
            <Field label="State / Province">
              <input
                value={form.stateProvince}
                onChange={(e) => set("stateProvince", e.target.value)}
              />
            </Field>
            <Field label="Postal code">
              <input
                value={form.postalCode}
                onChange={(e) => set("postalCode", e.target.value)}
              />
            </Field>
            <Field label="Country">
              <input
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
              />
            </Field>
            <Field label="Communication preference">
              <Select
                value={form.communicationPreference}
                onChange={(v) => set("communicationPreference", v)}
                items={["guardian", "phone", "sms", "email", "portal"]}
              />
            </Field>
          </div>
        </FormSection>

        {mode === "new" && (
          <>
            <FormSection title="Guardian / Emergency Contact">
              <div className="form-grid three">
                <Field label="Guardian name *">
                  <input
                    value={form.guardianName}
                    onChange={(e) => set("guardianName", e.target.value)}
                    required
                  />
                </Field>
                <Field label="Relationship *">
                  <input
                    value={form.relationship}
                    onChange={(e) => set("relationship", e.target.value)}
                    required
                  />
                </Field>
                <Field label="Guardian phone *">
                  <input
                    value={form.guardianPhone}
                    onChange={(e) => set("guardianPhone", e.target.value)}
                    required
                  />
                </Field>
                <Field label="Guardian email">
                  <input
                    type="email"
                    value={form.guardianEmail}
                    onChange={(e) => set("guardianEmail", e.target.value)}
                  />
                </Field>
              </div>
            </FormSection>
            <FormSection title="Additional Identifier">
              <div className="form-grid three">
                <Field label="Identifier type">
                  <Select
                    value={form.identifierType}
                    onChange={(v) => set("identifierType", v)}
                    items={[
                      "national_health_id",
                      "government_id",
                      "passport",
                      "birth_certificate",
                      "other",
                    ]}
                  />
                </Field>
                <Field label="Identifier value">
                  <input
                    value={form.identifierValue}
                    onChange={(e) => set("identifierValue", e.target.value)}
                  />
                </Field>
                <Field label="Registration source">
                  <Select
                    value={form.registrationSource}
                    onChange={(v) => set("registrationSource", v)}
                    items={[
                      "walk_in",
                      "referral",
                      "emergency",
                      "transfer",
                      "online",
                    ]}
                  />
                </Field>
              </div>
            </FormSection>
          </>
        )}

        <FormSection title="Consent">
          <div className="consent-grid">
            <label>
              <input
                type="checkbox"
                checked={form.consentToTreatment}
                onChange={(e) => set("consentToTreatment", e.target.checked)}
              />
              <span>
                <strong>Consent to treatment</strong>
                <small>
                  Guardian consent has been obtained and documented.
                </small>
              </span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.consentToContact}
                onChange={(e) => set("consentToContact", e.target.checked)}
              />
              <span>
                <strong>Consent to contact</strong>
                <small>
                  Hospital may send care reminders using the selected channel.
                </small>
              </span>
            </label>
          </div>
        </FormSection>

        <DynamicFieldsManager
          context="patient"
          recordId={mode === "edit" ? initial.patientId : null}
          values={customValues}
          onValuesChange={setCustomValues}
        />

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="button" type="submit" disabled={saving}>
            {saving
              ? "Saving..."
              : mode === "edit"
                ? "Save Changes"
                : "Create Patient Record"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Clinical Modals
═══════════════════════════════════════════════════════════ */
/** Create or edit one consultation and its record, diagnosis, vitals, and growth. */
function EncounterModal({ patient, visitId, meta, onClose, onSaved }) {
  const empty = {
    doctorId: meta.doctors[0]?.doctor_id || "",
    visitStartedAt: new Date().toISOString().slice(0, 16),
    visitEndedAt: "",
    chiefComplaint: "",
    disposition: "home",
    history: "",
    examination: "",
    clinicalNotes: "",
    diagnosisName: "",
    icdCode: "",
    diagnosisType: "confirmed",
    temperatureC: "",
    heartRateBpm: "",
    respiratoryRateBpm: "",
    systolicBp: "",
    diastolicBp: "",
    oxygenSaturation: "",
    heightCm: "",
    weightKg: "",
    headCircumferenceCm: "",
    heightPercentile: "",
    weightPercentile: "",
  };
  const [form, setForm] = useState(empty);
  const [customValues, setCustomValues] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!visitId);
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!visitId) return;
    api(`/clinical/visits/${visitId}`)
      .then((d) => {
        const v = d.visit,
          r = d.record || {},
          dx = d.diagnoses[0] || {},
          vs = d.vitals || {},
          g = d.growth || {};
        setForm({
          doctorId: v.doctor_id,
          visitStartedAt: toLocal(v.visit_started_at),
          visitEndedAt: v.visit_ended_at ? toLocal(v.visit_ended_at) : "",
          chiefComplaint: v.chief_complaint || "",
          disposition: v.disposition || "home",
          history: r.history || "",
          examination: r.examination || "",
          clinicalNotes: r.clinical_notes || "",
          diagnosisName: dx.diagnosis_name || "",
          icdCode: dx.icd_code || "",
          diagnosisType: dx.diagnosis_type || "confirmed",
          temperatureC: vs.temperature_c ?? "",
          heartRateBpm: vs.heart_rate_bpm ?? "",
          respiratoryRateBpm: vs.respiratory_rate_bpm ?? "",
          systolicBp: vs.systolic_bp ?? "",
          diastolicBp: vs.diastolic_bp ?? "",
          oxygenSaturation: vs.oxygen_saturation ?? "",
          heightCm: g.height_cm ?? "",
          weightKg: g.weight_kg ?? "",
          headCircumferenceCm: g.head_circumference_cm ?? "",
          heightPercentile: g.height_percentile ?? "",
          weightPercentile: g.weight_percentile ?? "",
        });
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [visitId]);

  async function submit(e) {
    e.preventDefault();
    try {
      const numbers = [
        "doctorId",
        "temperatureC",
        "heartRateBpm",
        "respiratoryRateBpm",
        "systolicBp",
        "diastolicBp",
        "oxygenSaturation",
        "heightCm",
        "weightKg",
        "headCircumferenceCm",
        "heightPercentile",
        "weightPercentile",
      ];
      const body = { ...form };
      numbers.forEach(
        (k) => (body[k] = body[k] === "" ? null : Number(body[k])),
      );
      const result = await api(
        visitId
          ? `/clinical/visits/${visitId}`
          : `/clinical/patients/${patient.patient_id}/encounters`,
        { method: visitId ? "PUT" : "POST", body: JSON.stringify(body) },
      );
      await saveDynamicFieldValues(
        "visit",
        visitId || result.visitId,
        customValues,
      );
      onSaved();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <ClinicalModal
      title={visitId ? "Edit Clinical Encounter" : "New Clinical Encounter"}
      subtitle={`${patient.first_name} ${patient.last_name}`}
      onClose={onClose}
    >
      {loading ? (
        <p>Loading encounter...</p>
      ) : (
        <form onSubmit={submit}>
          {error && <div className="notice error">{error}</div>}
          <FormSection title="Encounter Details">
            <div className="form-grid three">
              <Field label="Clinician *">
                <select
                  value={form.doctorId}
                  onChange={(e) => set("doctorId", e.target.value)}
                  required
                >
                  {meta.doctors.map((d) => (
                    <option value={d.doctor_id} key={d.doctor_id}>
                      {d.full_name} · {d.specialization}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Started *">
                <input
                  type="datetime-local"
                  value={form.visitStartedAt}
                  onChange={(e) => set("visitStartedAt", e.target.value)}
                  required
                />
              </Field>
              <Field label="Ended">
                <input
                  type="datetime-local"
                  value={form.visitEndedAt}
                  onChange={(e) => set("visitEndedAt", e.target.value)}
                />
              </Field>
              <Field label="Disposition">
                <Select
                  value={form.disposition}
                  onChange={(v) => set("disposition", v)}
                  items={[
                    "home",
                    "admitted",
                    "referred",
                    "observation",
                    "left_without_care",
                  ]}
                />
              </Field>
              <Field label="Chief complaint *" wide>
                <textarea
                  value={form.chiefComplaint}
                  onChange={(e) => set("chiefComplaint", e.target.value)}
                  required
                />
              </Field>
            </div>
          </FormSection>
          <FormSection title="Clinical Documentation">
            <div className="form-grid">
              <Field label="History">
                <textarea
                  value={form.history}
                  onChange={(e) => set("history", e.target.value)}
                />
              </Field>
              <Field label="Examination">
                <textarea
                  value={form.examination}
                  onChange={(e) => set("examination", e.target.value)}
                />
              </Field>
              <Field label="Clinical assessment and plan" wide>
                <textarea
                  value={form.clinicalNotes}
                  onChange={(e) => set("clinicalNotes", e.target.value)}
                />
              </Field>
              <Field label="Primary diagnosis">
                <input
                  value={form.diagnosisName}
                  onChange={(e) => set("diagnosisName", e.target.value)}
                />
              </Field>
              <Field label="ICD code">
                <input
                  value={form.icdCode}
                  onChange={(e) => set("icdCode", e.target.value)}
                />
              </Field>
              <Field label="Diagnosis status">
                <Select
                  value={form.diagnosisType}
                  onChange={(v) => set("diagnosisType", v)}
                  items={[
                    "provisional",
                    "confirmed",
                    "differential",
                    "resolved",
                  ]}
                />
              </Field>
            </div>
          </FormSection>
          <FormSection title="Vital Signs">
            <div className="form-grid three">
              {[
                ["temperatureC", "Temperature (°C)"],
                ["heartRateBpm", "Heart rate (bpm)"],
                ["respiratoryRateBpm", "Respiratory rate"],
                ["systolicBp", "Systolic BP"],
                ["diastolicBp", "Diastolic BP"],
                ["oxygenSaturation", "O₂ saturation (%)"],
              ].map(([k, l]) => (
                <Field label={l} key={k}>
                  <input
                    type="number"
                    step="0.1"
                    value={form[k]}
                    onChange={(e) => set(k, e.target.value)}
                  />
                </Field>
              ))}
            </div>
          </FormSection>
          <FormSection title="Growth Measurements">
            <div className="form-grid three">
              {[
                ["heightCm", "Height (cm)"],
                ["weightKg", "Weight (kg)"],
                ["headCircumferenceCm", "Head circumference (cm)"],
                ["heightPercentile", "Height percentile"],
                ["weightPercentile", "Weight percentile"],
              ].map(([k, l]) => (
                <Field label={l} key={k}>
                  <input
                    type="number"
                    step="0.1"
                    value={form[k]}
                    onChange={(e) => set(k, e.target.value)}
                  />
                </Field>
              ))}
            </div>
          </FormSection>
          <DynamicFieldsManager
            context="visit"
            recordId={visitId}
            values={customValues}
            onValuesChange={setCustomValues}
          />
          <ModalActions
            onClose={onClose}
            label={visitId ? "Save Encounter" : "Create Encounter"}
          />
        </form>
      )}
    </ClinicalModal>
  );
}

/** Edit a prescription header and its repeatable list of medication items. */
function PrescriptionModal({ patient, visits, item, meta, onClose, onSaved }) {
  const [form, setForm] = useState({
    visitId: item?.visit_id || visits[0]?.visit_id || "",
    doctorId: item?.doctor_id || meta.doctors[0]?.doctor_id || "",
    prescribedAt: item
      ? toLocal(item.prescribed_at)
      : new Date().toISOString().slice(0, 16),
    notes: item?.notes || "",
    items: item?.items?.map((x) => ({
      medicationId: x.medication_id,
      dose: x.dose,
      frequency: x.frequency,
      route: x.route,
      durationDays: x.duration_days || "",
      instructions: x.instructions || "",
    })) || [
      {
        medicationId: meta.medications[0]?.medication_id || "",
        dose: "",
        frequency: "",
        route: "oral",
        durationDays: "",
        instructions: "",
      },
    ],
  });
  const [error, setError] = useState("");
  const [customValues, setCustomValues] = useState({});
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));
  const updateItem = (i, k, v) =>
    setForm((x) => ({
      ...x,
      items: x.items.map((it, n) => (n === i ? { ...it, [k]: v } : it)),
    }));

  async function submit(e) {
    e.preventDefault();
    try {
      const body = {
        ...form,
        visitId: Number(form.visitId),
        doctorId: Number(form.doctorId),
        items: form.items.map((x) => ({
          ...x,
          medicationId: Number(x.medicationId),
          durationDays: x.durationDays ? Number(x.durationDays) : null,
        })),
      };
      const result = await api(
        item
          ? `/clinical/prescriptions/${item.prescription_id}`
          : `/clinical/patients/${patient.patient_id}/prescriptions`,
        { method: item ? "PUT" : "POST", body: JSON.stringify(body) },
      );
      await saveDynamicFieldValues(
        "prescription",
        item?.prescription_id || result.prescriptionId,
        customValues,
      );
      onSaved();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <ClinicalModal
      title={item ? "Edit Prescription" : "New Prescription"}
      subtitle={`${patient.first_name} ${patient.last_name}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {error && <div className="notice error">{error}</div>}
        <div className="form-grid three">
          <Field label="Encounter *">
            <select
              value={form.visitId}
              onChange={(e) => set("visitId", e.target.value)}
              required
            >
              {visits.map((v) => (
                <option value={v.visit_id} key={v.visit_id}>
                  #{v.visit_id} ·{" "}
                  {new Date(v.visit_started_at).toLocaleDateString("en-IN")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prescriber *">
            <select
              value={form.doctorId}
              onChange={(e) => set("doctorId", e.target.value)}
              required
            >
              {meta.doctors.map((d) => (
                <option value={d.doctor_id} key={d.doctor_id}>
                  {d.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prescribed at">
            <input
              type="datetime-local"
              value={form.prescribedAt}
              onChange={(e) => set("prescribedAt", e.target.value)}
              required
            />
          </Field>
          <Field label="Prescription note" wide>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
        </div>
        <FormSection title="Medication Items">
          {form.items.map((med, i) => (
            <div className="med-editor" key={i}>
              <Field label="Medication *">
                <select
                  value={med.medicationId}
                  onChange={(e) =>
                    updateItem(i, "medicationId", e.target.value)
                  }
                >
                  {meta.medications.map((m) => (
                    <option value={m.medication_id} key={m.medication_id}>
                      {m.generic_name} · {m.strength} · {m.form}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Dose *">
                <input
                  value={med.dose}
                  onChange={(e) => updateItem(i, "dose", e.target.value)}
                  required
                />
              </Field>
              <Field label="Frequency *">
                <input
                  value={med.frequency}
                  onChange={(e) => updateItem(i, "frequency", e.target.value)}
                  required
                />
              </Field>
              <Field label="Route *">
                <input
                  value={med.route}
                  onChange={(e) => updateItem(i, "route", e.target.value)}
                  required
                />
              </Field>
              <Field label="Duration (days)">
                <input
                  type="number"
                  min="1"
                  value={med.durationDays}
                  onChange={(e) =>
                    updateItem(i, "durationDays", e.target.value)
                  }
                />
              </Field>
              <Field label="Instructions">
                <input
                  value={med.instructions}
                  onChange={(e) =>
                    updateItem(i, "instructions", e.target.value)
                  }
                />
              </Field>
              {form.items.length > 1 && (
                <button
                  type="button"
                  className="row-remove"
                  onClick={() =>
                    setForm((x) => ({
                      ...x,
                      items: x.items.filter((_, n) => n !== i),
                    }))
                  }
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setForm((x) => ({
                ...x,
                items: [
                  ...x.items,
                  {
                    medicationId: meta.medications[0]?.medication_id || "",
                    dose: "",
                    frequency: "",
                    route: "oral",
                    durationDays: "",
                    instructions: "",
                  },
                ],
              }))
            }
          >
            Add Medication
          </button>
        </FormSection>
        <DynamicFieldsManager
          context="prescription"
          recordId={item?.prescription_id}
          values={customValues}
          onValuesChange={setCustomValues}
        />
        <ModalActions
          onClose={onClose}
          label={item ? "Save Prescription" : "Create Prescription"}
        />
      </form>
    </ClinicalModal>
  );
}

/** Create/edit a lab order and optionally record the current result. */
function LabModal({ visits, item, meta, onClose, onSaved }) {
  const [form, setForm] = useState({
    visitId: item?.visit_id || visits[0]?.visit_id || "",
    labTestId: item?.lab_test_id || meta.labTests[0]?.lab_test_id || "",
    orderedBy: item?.ordered_by || meta.doctors[0]?.doctor_id || "",
    status: item?.status || "ordered",
    orderedAt: item
      ? toLocal(item.ordered_at)
      : new Date().toISOString().slice(0, 16),
    resultValue: item?.result_value || "",
    isAbnormal: !!item?.is_abnormal,
    resultNotes: item?.result_notes || "",
    resultedAt: item?.resulted_at ? toLocal(item.resulted_at) : "",
  });
  const [error, setError] = useState("");
  const [customValues, setCustomValues] = useState({});
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    try {
      const body = {
        ...form,
        visitId: Number(form.visitId),
        labTestId: Number(form.labTestId),
        orderedBy: Number(form.orderedBy),
      };
      const result = await api(
        item ? `/clinical/labs/${item.lab_order_id}` : "/clinical/labs",
        { method: item ? "PUT" : "POST", body: JSON.stringify(body) },
      );
      await saveDynamicFieldValues(
        "lab_order",
        item?.lab_order_id || result.labOrderId,
        customValues,
      );
      onSaved();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <ClinicalModal
      title={item ? "Edit Laboratory Order" : "New Laboratory Order"}
      subtitle="Order and result management"
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {error && <div className="notice error">{error}</div>}
        <div className="form-grid three">
          <Field label="Encounter *">
            <select
              value={form.visitId}
              onChange={(e) => set("visitId", e.target.value)}
            >
              {visits.map((v) => (
                <option value={v.visit_id} key={v.visit_id}>
                  #{v.visit_id} ·{" "}
                  {new Date(v.visit_started_at).toLocaleDateString("en-IN")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Test *">
            <select
              value={form.labTestId}
              onChange={(e) => set("labTestId", e.target.value)}
            >
              {meta.labTests.map((t) => (
                <option value={t.lab_test_id} key={t.lab_test_id}>
                  {t.test_name} · {t.test_code}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ordering clinician">
            <select
              value={form.orderedBy}
              onChange={(e) => set("orderedBy", e.target.value)}
            >
              {meta.doctors.map((d) => (
                <option value={d.doctor_id} key={d.doctor_id}>
                  {d.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ordered at">
            <input
              type="datetime-local"
              value={form.orderedAt}
              onChange={(e) => set("orderedAt", e.target.value)}
            />
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(v) => set("status", v)}
              items={["ordered", "collected", "completed", "cancelled"]}
            />
          </Field>
          <Field label="Result value">
            <input
              value={form.resultValue}
              onChange={(e) => set("resultValue", e.target.value)}
            />
          </Field>
          <Field label="Resulted at">
            <input
              type="datetime-local"
              value={form.resultedAt}
              onChange={(e) => set("resultedAt", e.target.value)}
            />
          </Field>
          <label className="check">
            <input
              type="checkbox"
              checked={form.isAbnormal}
              onChange={(e) => set("isAbnormal", e.target.checked)}
            />{" "}
            Abnormal result
          </label>
          <Field label="Result notes" wide>
            <textarea
              value={form.resultNotes}
              onChange={(e) => set("resultNotes", e.target.value)}
            />
          </Field>
        </div>
        <DynamicFieldsManager
          context="lab_order"
          recordId={item?.lab_order_id}
          values={customValues}
          onValuesChange={setCustomValues}
        />
        <ModalActions onClose={onClose} label="Save Laboratory Record" />
      </form>
    </ClinicalModal>
  );
}

/** Create or edit a longitudinal allergy and reaction record. */
function AllergyModal({ patient, item, onClose, onSaved }) {
  const [form, setForm] = useState({
    allergen: item?.allergen || "",
    reaction: item?.reaction || "",
    severity: item?.severity || "unknown",
    status: item?.status || "active",
  });
  const [error, setError] = useState("");
  const [customValues, setCustomValues] = useState({});
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    try {
      const result = await api(
        item
          ? `/clinical/allergies/${item.allergy_id}`
          : `/clinical/patients/${patient.patient_id}/allergies`,
        { method: item ? "PUT" : "POST", body: JSON.stringify(form) },
      );
      await saveDynamicFieldValues(
        "allergy",
        item?.allergy_id || result.allergyId,
        customValues,
      );
      onSaved();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <ClinicalModal
      title={item ? "Edit Allergy" : "Add Allergy"}
      subtitle={`${patient.first_name} ${patient.last_name}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {error && <div className="notice error">{error}</div>}
        <div className="form-grid">
          <Field label="Allergen *">
            <input
              value={form.allergen}
              onChange={(e) => set("allergen", e.target.value)}
              required
            />
          </Field>
          <Field label="Reaction">
            <input
              value={form.reaction}
              onChange={(e) => set("reaction", e.target.value)}
            />
          </Field>
          <Field label="Severity">
            <Select
              value={form.severity}
              onChange={(v) => set("severity", v)}
              items={["unknown", "mild", "moderate", "severe"]}
            />
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(v) => set("status", v)}
              items={["active", "resolved", "unconfirmed"]}
            />
          </Field>
        </div>
        <DynamicFieldsManager
          context="allergy"
          recordId={item?.allergy_id}
          values={customValues}
          onValuesChange={setCustomValues}
        />
        <ModalActions onClose={onClose} label="Save Allergy" />
      </form>
    </ClinicalModal>
  );
}

/** Create or edit one vaccine dose in the patient's immunization history. */
function ImmunizationModal({ patient, item, meta, onClose, onSaved }) {
  const [form, setForm] = useState({
    vaccineName: item?.vaccine_name || "",
    doseNumber: item?.dose_number || "",
    administeredOn: item
      ? String(item.administered_on).slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    lotNumber: item?.lot_number || "",
    administeredBy: item?.administered_by || "",
  });
  const [error, setError] = useState("");
  const [customValues, setCustomValues] = useState({});
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    try {
      const body = {
        ...form,
        doseNumber: form.doseNumber ? Number(form.doseNumber) : null,
        administeredBy: form.administeredBy
          ? Number(form.administeredBy)
          : null,
      };
      const result = await api(
        item
          ? `/clinical/immunizations/${item.immunization_id}`
          : `/clinical/patients/${patient.patient_id}/immunizations`,
        { method: item ? "PUT" : "POST", body: JSON.stringify(body) },
      );
      await saveDynamicFieldValues(
        "immunization",
        item?.immunization_id || result.immunizationId,
        customValues,
      );
      onSaved();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <ClinicalModal
      title={item ? "Edit Immunization" : "Record Immunization"}
      subtitle={`${patient.first_name} ${patient.last_name}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {error && <div className="notice error">{error}</div>}
        <div className="form-grid">
          <Field label="Vaccine *">
            <input
              value={form.vaccineName}
              onChange={(e) => set("vaccineName", e.target.value)}
              required
            />
          </Field>
          <Field label="Dose number">
            <input
              type="number"
              min="1"
              value={form.doseNumber}
              onChange={(e) => set("doseNumber", e.target.value)}
            />
          </Field>
          <Field label="Date administered *">
            <input
              type="date"
              value={form.administeredOn}
              onChange={(e) => set("administeredOn", e.target.value)}
              required
            />
          </Field>
          <Field label="Lot number">
            <input
              value={form.lotNumber}
              onChange={(e) => set("lotNumber", e.target.value)}
            />
          </Field>
          <Field label="Administered by">
            <select
              value={form.administeredBy}
              onChange={(e) => set("administeredBy", e.target.value)}
            >
              <option value="">Not specified</option>
              {meta.doctors.map((d) => (
                <option value={d.doctor_id} key={d.doctor_id}>
                  {d.full_name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <DynamicFieldsManager
          context="immunization"
          recordId={item?.immunization_id}
          values={customValues}
          onValuesChange={setCustomValues}
        />
        <ModalActions onClose={onClose} label="Save Immunization" />
      </form>
    </ClinicalModal>
  );
}

/* ─── Reusable helper components ─────────────────────────── */
/** Accessible modal shell shared by all clinical editing workflows. */
function ClinicalModal({ title, subtitle, onClose, children }) {
  return (
    <div className="overlay center clinical-overlay">
      <div className="modal large-modal">
        <button type="button" className="close" onClick={onClose}>
          <X />
        </button>
        <span className="eyebrow">Clinical Record · {subtitle}</span>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Standard cancel/save button row for clinical forms. */
function ModalActions({ onClose, label }) {
  return (
    <div className="modal-actions">
      <button type="button" className="secondary-button" onClick={onClose}>
        Cancel
      </button>
      <button className="button" type="submit">
        {label}
      </button>
    </div>
  );
}

/** Convert a stored date/time into the format expected by datetime-local inputs. */
function toLocal(value) {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

/** Consistent label and layout wrapper for form controls. */
function Field({ label, children, wide }) {
  return (
    <label className={wide ? "wide" : ""}>
      {label}
      {children}
    </label>
  );
}

/** Reusable select for small database enum values. */
function Select({ value, onChange, items }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {items.map((x) => (
        <option value={x} key={x}>
          {x.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}

/** Group related inputs under a readable clinical subsection heading. */
function FormSection({ title, children }) {
  return (
    <section className="form-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/** Read-only patient-record section with an optional action button. */
function Section({ title, icon: Icon, action, children }) {
  return (
    <section className="record-section">
      <div className="section-heading">
        <h3>
          <Icon size={17} />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Display one label/value pair in summary grids. */
function Info({ label, value }) {
  return (
    <div>
      <small>{label}</small>
      <strong>{value === 0 ? 0 : value || "—"}</strong>
    </div>
  );
}

/** Display one compact row inside lists and cards. */
function InfoRow({ label, value }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "110px 1fr",
        gap: "4px 12px",
        padding: "6px 0",
        borderBottom: "1px solid var(--line)",
        fontSize: 13,
      }}
    >
      <span style={{ color: "var(--muted)", fontWeight: 500 }}>{label}</span>
      <span
        style={{
          fontWeight: 600,
          color: value ? "var(--ink)" : "var(--muted)",
        }}
      >
        {value || "—"}
      </span>
    </div>
  );
}

/** Format one visit summary as a chronological timeline item. */
function Timeline({ item: v }) {
  return (
    <div className="timeline-row">
      <span></span>
      <div>
        <strong>{v.diagnoses || "Clinical review"}</strong>
        <p>{v.chief_complaint}</p>
        <small>
          {new Date(v.visit_started_at).toLocaleString("en-IN")} ·{" "}
          {v.doctor_name}
        </small>
      </div>
    </div>
  );
}

/** Standard empty state used when no records exist in a section. */
function Empty({ text }) {
  return <p className="empty compact">{text}</p>;
}
